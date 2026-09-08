import sys
from pathlib import Path


CUSTOMER_FACING_ROOT = Path(__file__).resolve().parents[1] / "customer_facing"
if str(CUSTOMER_FACING_ROOT) not in sys.path:
    sys.path.insert(0, str(CUSTOMER_FACING_ROOT))

from app.routes.pages import build_series_graph_payload


def test_series_graph_uses_backend_payload_with_low_line_role():
    backend_payload = {
        "hasGraphData": True,
        "graphMode": "series",
        "rpmLines": [
            {"id": 10, "rpm": 10, "line_role": "low", "display_label": "HMLJS-1 low"},
            {"id": 11, "rpm": 11, "line_role": "high", "display_label": "HMLJS-1 high"},
        ],
        "rpmPoints": [
            {"id": 1, "rpm_line_id": 10, "airflow": 1, "pressure": 2},
            {"id": 2, "rpm_line_id": 11, "airflow": 1, "pressure": 3},
        ],
    }

    payload = build_series_graph_payload(
        {"name": "A series", "series_graph_payload": backend_payload},
        {"supports_graph": True},
        [],
    )

    assert [line["line_role"] for line in payload["rpmLines"]] == ["low", "high"]
    assert payload["rpmPoints"][0]["rpm_line_id"] == 10
