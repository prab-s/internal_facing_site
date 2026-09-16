from types import SimpleNamespace

from backend.main import _quote_request_acknowledgement_body, _send_quote_request_acknowledgement, _quote_request_body
from backend.email import SMTPConfig


def test_quote_request_email_includes_captured_performance_targets():
    record = SimpleNamespace(
        status="new",
        request_type="standard",
        name="Sam Example",
        company="Example Ltd",
        email="sam@example.test",
        phone="021 000 0000",
        attributes=[],
        airflow_min="",
        airflow_max="",
        pressure_min="",
        pressure_max="",
        power_limit="",
        page_url="https://example.test/finder",
        page_card_title="Fan finder",
        page_card_summary="",
        page_type="finder",
        verification_provider="honeypot",
        verification_status="passed",
        email_status="pending",
        short_notes="",
        details="",
        context_json={
            "enquiry_workflow": {
                "performance_target": {"airflow": "1200", "pressure": "350"},
            }
        },
    )

    body = _quote_request_body(record)

    assert "Captured performance targets:" in body
    assert "Airflow target: 1200" in body
    assert "Pressure target: 350" in body


def test_customer_acknowledgement_contains_submitted_enquiry_without_internal_metadata(monkeypatch):
    record = SimpleNamespace(
        name="Sam Example",
        company="Example Ltd",
        email="sam@example.test",
        phone="021 000 0000",
        request_type="tailored",
        attributes=["airflow", "noise"],
        airflow_min="1200",
        airflow_max="1800",
        pressure_min="300",
        pressure_max="750",
        power_limit="2.2 kW",
        short_notes="Quiet operation needed",
        details="For a workshop retrofit.",
        client_ip="203.0.113.1",
        verification_status="passed",
    )
    body = _quote_request_acknowledgement_body(record)
    assert "Here is a copy of what you sent:" in body
    assert "Tailored product" in body
    assert "For a workshop retrofit." in body
    assert "203.0.113.1" not in body
    assert "verification" not in body.lower()

    captured = {}
    monkeypatch.setattr("backend.main.send_email", lambda recipient, subject, message, **kwargs: captured.update(recipient=recipient, subject=subject, message=message) or True)
    assert _send_quote_request_acknowledgement(record, SMTPConfig(host="smtp.test", port=587, from_address="team@venttech.test"))
    assert captured["recipient"] == "sam@example.test"
    assert captured["subject"] == "We received your Vent-Tech enquiry"
