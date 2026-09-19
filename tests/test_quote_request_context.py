from starlette.requests import Request

from backend.main import _normalise_quote_request_payload, _quote_request_throttle_key, _validate_action
from backend.schemas import QuoteRequestCreate
from customer_facing.app.routes.pages import plural_product_type_label, quote_request_context


def test_quote_request_normalises_cms_workflow_context():
    payload = QuoteRequestCreate(
        name="Sam Example",
        email="sam@example.test",
        page_context={
            "enquiry_workflow": {
                "context_fields": {"airflow": True, "pressure": True},
                "performance_target": {"airflow": 1200, "pressure": "350"},
            }
        },
    )

    normalised = _normalise_quote_request_payload(payload)

    assert normalised["context_json"]["enquiry_workflow"] == {
        "context_fields": {"airflow": True, "pressure": True},
        "performance_target": {"airflow": "1200", "pressure": "350"},
    }


def test_quote_request_context_defaults_unknown_cms_fields_to_enabled():
    payload = QuoteRequestCreate(
        name="Sam Example",
        email="sam@example.test",
        page_context={
            "enquiry_workflow": {
                "context_fields": {"airflow": False},
                "performance_target": {"airflow": 1200, "pressure": 350},
            }
        },
    )

    normalised = _normalise_quote_request_payload(payload)

    assert normalised["context_json"]["enquiry_workflow"]["context_fields"] == {
        "airflow": False,
        "pressure": True,
    }
    assert normalised["context_json"]["enquiry_workflow"]["performance_target"] == {
        "airflow": "1200",
        "pressure": "350",
    }


def test_public_page_context_preserves_catalogue_and_url_context():
    context = quote_request_context(
        type("Request", (), {"url": "https://example.test/products/42-fan?source=catalogue"})(),
        page_type="product",
        page_title="Fan 42",
        product_type={"key": "fan", "label": "Fans"},
        series={"id": 7, "name": "A Series"},
        product={"id": 42, "model": "Fan 42"},
    )

    assert context["pageType"] == "product"
    assert context["pageUrl"].endswith("?source=catalogue")
    assert context["productType"]["label"] == "Fans"
    assert context["series"]["name"] == "A Series"
    assert context["product"]["model"] == "Fan 42"


def test_cms_modal_action_can_configure_per_action_context_fields():
    action = _validate_action({
        "type": "modal",
        "target": "quoteRequestModal",
        "contextFields": {"airflow": True, "pressure": False},
    })

    assert action["contextFields"] == {"airflow": True, "pressure": False}


def test_quote_request_throttle_key_uses_the_public_client_address():
    payload = QuoteRequestCreate(name="Sam Example", email="sam@example.test")
    request = Request({"type": "http", "headers": [], "client": ("203.0.113.42", 443)})

    assert _quote_request_throttle_key(payload, request) == "203.0.113.42"


def test_product_type_labels_are_pluralised_for_object_page_hierarchy():
    assert plural_product_type_label("Fan") == "Fans"
    assert plural_product_type_label("Speed Controller") == "Speed Controllers"
    assert plural_product_type_label("Accessories") == "Accessories"
