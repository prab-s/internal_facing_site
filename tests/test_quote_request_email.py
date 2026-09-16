from types import SimpleNamespace

from backend.main import _quote_request_body


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
