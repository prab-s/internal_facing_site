import smtplib
from unittest.mock import patch

from backend.email import SMTPConfig, send_email, smtp_connection_test


def test_send_email_does_not_connect_when_smtp_is_unconfigured():
    config = SMTPConfig()

    with patch.object(smtplib, "SMTP") as smtp:
        assert send_email("recipient@example.test", "Subject", "Body", config=config) is False

    smtp.assert_not_called()


def test_send_email_uses_generic_smtp_configuration():
    config = SMTPConfig(
        host="smtp.example.test",
        port=587,
        username="user",
        password="password",
        use_tls=True,
        from_address="catalogue@example.test",
    )

    with patch.object(smtplib, "SMTP") as smtp_class:
        smtp = smtp_class.return_value
        assert send_email("recipient@example.test", "Subject", "Body", config=config) is True

    smtp_class.assert_called_once_with("smtp.example.test", 587, timeout=20)
    smtp.starttls.assert_called_once()
    smtp.login.assert_called_once_with("user", "password")
    smtp.send_message.assert_called_once()


def test_smtp_connection_uses_implicit_ssl_mode():
    config = SMTPConfig(
        host="smtp.example.test",
        port=465,
        from_address="catalogue@example.test",
        security="ssl",
    )

    with patch.object(smtplib, "SMTP_SSL") as smtp_class:
        smtp_connection_test(config)

    smtp_class.assert_called_once_with("smtp.example.test", 465, timeout=20)
    smtp_class.return_value.starttls.assert_not_called()


def test_smtp_connection_authenticates_without_sending():
    config = SMTPConfig(
        host="smtp.example.test",
        port=587,
        username="user",
        password="password",
        from_address="catalogue@example.test",
    )

    with patch.object(smtplib, "SMTP") as smtp_class:
        smtp_connection_test(config)

    smtp_class.return_value.login.assert_called_once_with("user", "password")
    smtp_class.return_value.send_message.assert_not_called()
