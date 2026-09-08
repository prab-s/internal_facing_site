"""Small, provider-neutral SMTP email abstraction."""

from __future__ import annotations

import os
import base64
import hashlib
import smtplib
import socket
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from collections.abc import Sequence

from cryptography.fernet import Fernet


_TRUE_VALUES = {"1", "true", "yes", "on"}
SMTP_SECURITY_MODES = {"starttls", "ssl", "none"}


class SMTPDiagnosticError(RuntimeError):
    """A safe, staged SMTP error suitable for support diagnostics."""

    def __init__(self, stage: str, code: str, message: str, detail: str = ""):
        self.stage = stage
        self.code = code
        self.user_message = message
        self.detail = detail[:240]
        super().__init__(message)


def _env_flag(value: str) -> bool:
    return value.strip().lower() in _TRUE_VALUES


@dataclass(frozen=True)
class SMTPConfig:
    host: str = ""
    port: int = 587
    username: str = ""
    password: str = ""
    use_tls: bool = True
    from_address: str = ""
    security: str = ""

    @classmethod
    def from_environment(cls) -> "SMTPConfig":
        port_value = os.getenv("SMTP_PORT", "587").strip() or "587"
        try:
            port = int(port_value)
        except ValueError as exc:
            raise ValueError("SMTP_PORT must be an integer") from exc

        security = os.getenv("SMTP_SECURITY", "").strip().lower()
        use_tls = _env_flag(os.getenv("SMTP_USE_TLS", "true"))
        if security in SMTP_SECURITY_MODES:
            use_tls = security == "starttls"
        return cls(
            host=os.getenv("SMTP_HOST", "").strip(),
            port=port,
            username=os.getenv("SMTP_USERNAME", "").strip(),
            password=os.getenv("SMTP_PASSWORD", ""),
            use_tls=use_tls,
            from_address=os.getenv("SMTP_FROM_ADDRESS", "").strip(),
            security=security,
        )

    @property
    def security_mode(self) -> str:
        mode = (self.security or "").strip().lower()
        if mode in SMTP_SECURITY_MODES:
            return mode
        return "starttls" if self.use_tls else "none"

    @property
    def is_configured(self) -> bool:
        if not self.host or not self.from_address or self.port <= 0:
            return False
        return bool(self.username) == bool(self.password)


def _fernet(secret: str | None = None) -> Fernet:
    application_secret = secret if secret is not None else os.getenv("SESSION_SECRET", "")
    if not application_secret:
        raise ValueError("SESSION_SECRET is required to protect SMTP credentials")
    key = base64.urlsafe_b64encode(hashlib.sha256(application_secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_smtp_password(password: str, secret: str | None = None) -> str:
    return _fernet(secret).encrypt(password.encode("utf-8")).decode("ascii")


def decrypt_smtp_password(encrypted_password: str | None, secret: str | None = None) -> str:
    if not encrypted_password:
        return ""
    return _fernet(secret).decrypt(encrypted_password.encode("ascii")).decode("utf-8")


def send_email(
    recipient: str | Sequence[str],
    subject: str,
    body: str,
    *,
    reply_to: str | None = None,
    attachments: Sequence[dict] | None = None,
    config: SMTPConfig | None = None,
) -> bool:
    """Send a plain-text email, or return False without connecting if unconfigured."""
    smtp = config or SMTPConfig.from_environment()
    if not smtp.is_configured:
        return False

    recipients = [recipient] if isinstance(recipient, str) else list(recipient)
    recipients = [address.strip() for address in recipients if address.strip()]
    if not recipients:
        raise ValueError("At least one email recipient is required")

    message = EmailMessage()
    message["To"] = ", ".join(recipients)
    message["From"] = smtp.from_address
    message["Subject"] = subject
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(body)
    for attachment in attachments or []:
        content = attachment.get("content", b"")
        if isinstance(content, str):
            content = content.encode("utf-8")
        message.add_attachment(
            content,
            maintype=attachment.get("maintype", "application"),
            subtype=attachment.get("subtype", "octet-stream"),
            filename=attachment.get("filename", "attachment"),
        )

    server = None
    try:
        server = _open_smtp_connection(smtp)
        if smtp.username:
            try:
                server.login(smtp.username, smtp.password)
            except Exception as exc:
                raise _diagnostic_error("authentication", exc) from exc
        try:
            server.send_message(message)
        except Exception as exc:
            raise _diagnostic_error("message_submission", exc) from exc
    finally:
        if server is not None:
            try:
                server.quit()
            except Exception:
                pass
    return True


def smtp_connection_test(config: SMTPConfig) -> None:
    """Open, negotiate, and authenticate SMTP without sending a message."""
    server = None
    try:
        server = _open_smtp_connection(config)
        if config.username:
            try:
                server.login(config.username, config.password)
            except Exception as exc:
                raise _diagnostic_error("authentication", exc) from exc
    finally:
        if server is not None:
            try:
                server.quit()
            except Exception:
                pass


def _open_smtp_connection(smtp: SMTPConfig):
    if not smtp.is_configured:
        raise SMTPDiagnosticError(
            "configuration",
            "smtp_not_configured",
            "Complete the SMTP host, port, and From address before testing.",
        )

    try:
        if smtp.security_mode == "ssl":
            server = smtplib.SMTP_SSL(smtp.host, smtp.port, timeout=20)
        else:
            server = smtplib.SMTP(smtp.host, smtp.port, timeout=20)
        server.ehlo()
        if smtp.security_mode == "starttls":
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
        return server
    except Exception as exc:
        raise _diagnostic_error("connection", exc) from exc


def _diagnostic_error(stage: str, exc: Exception) -> SMTPDiagnosticError:
    detail = str(exc).strip()
    if isinstance(exc, (socket.gaierror,)):
        return SMTPDiagnosticError(stage, "smtp_dns_failed", "The SMTP host could not be resolved.", detail)
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return SMTPDiagnosticError(stage, "smtp_timeout", "The SMTP server did not respond in time.", detail)
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return SMTPDiagnosticError("authentication", "smtp_auth_failed", "SMTP authentication was rejected. Check the username, password, or app password.", detail)
    if isinstance(exc, ssl.SSLError):
        return SMTPDiagnosticError("tls", "smtp_tls_failed", "TLS negotiation failed. Check the security mode and port.", detail)
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return SMTPDiagnosticError("message_submission", "smtp_recipient_rejected", "The recipient address was rejected by the SMTP server.", detail)
    if isinstance(exc, smtplib.SMTPSenderRefused):
        return SMTPDiagnosticError("message_submission", "smtp_sender_rejected", "The From address was rejected by the SMTP server.", detail)
    if isinstance(exc, smtplib.SMTPException):
        return SMTPDiagnosticError(stage, "smtp_protocol_failed", "The SMTP server rejected the operation.", detail)
    return SMTPDiagnosticError(stage, "smtp_connection_failed", "The application could not complete the SMTP operation.", detail)
