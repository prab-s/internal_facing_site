import asyncio
from copy import deepcopy
from pathlib import Path
import sys

import pytest
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "customer_facing"))
from app.routes import pages
from backend.site_cms import default_site_page_map
from backend.site_page_layouts import MARKETING_PAGE_SLUGS, marketing_page_layout


@pytest.mark.parametrize("slug", MARKETING_PAGE_SLUGS)
def test_marketing_routes_render_saved_layout_and_subsequent_edits(monkeypatch, slug):
    cms = deepcopy(default_site_page_map()[slug])
    async def site_page(_slug):
        assert _slug == slug
        return cms
    async def common():
        return {"product_types": [], "enquiry_cms": {}, "site_navigation": []}
    monkeypatch.setattr(pages, "site_page_context", site_page)
    monkeypatch.setattr(pages, "common_context", common)
    request = Request({"type": "http", "method": "GET", "path": f"/{slug}", "headers": [], "scheme": "http", "server": ("test", 80), "query_string": b""})
    handler = getattr(pages, slug.replace("-", "_") + "_page")
    response = asyncio.run(handler(request))
    assert response.template.name == "cms_page.html"
    assert cms["content"]["hero_heading"].encode() in response.body
    cms["layout"] = [{"id": "edited", "type": "rich-text", "width": "full", "content": "<h1>Saved CMS replacement</h1>"}]
    response = asyncio.run(handler(request))
    assert b"Saved CMS replacement" in response.body
    assert cms["content"]["hero_heading"].encode() not in response.body
    cms["layout"] = []
    response = asyncio.run(handler(request))
    assert response.template.name == "cms_page.html"
    assert b"Saved CMS replacement" not in response.body
    cms["layout"] = None
    response = asyncio.run(handler(request))
    assert response.template.name == slug.replace("-", "_") + ".html"


def test_contact_layout_preserves_every_email_and_clickable_phone():
    page = default_site_page_map()["contact"]
    content = page["content"]
    cards = next(s["cards"] for s in page["layout"] if s["id"] == "contact-contacts")
    assert len(cards) == len(content["contacts"])
    for card, contact in zip(cards, content["contacts"]):
        assert f'mailto:{contact["email"]}' in card["content"]
        assert contact["phone"] in card["content"]
        assert 'href="tel:+64' in card["content"]


def test_conversion_escapes_text_and_keeps_placeholder_disclosures():
    page = default_site_page_map()["past-projects"]
    content = deepcopy(page["content"])
    content["hero_heading"] = '<script>alert("unsafe")</script>'
    layout = marketing_page_layout("past-projects", content)
    assert "<script>" not in layout[0]["content"]
    assert "placeholder" in layout[0]["content"]
    assert any(s["type"] == "cards" for s in layout)
    assert "layout" not in default_site_page_map()["enquiries-modal"]


def test_terms_page_is_an_editable_footer_only_cms_page():
    terms = default_site_page_map()["terms-and-conditions"]
    assert terms["label"] == "Terms & Conditions"
    assert terms["layout"][0]["type"] == "rich-text"


def test_layout_only_cms_page_renders_without_a_separate_content_object(monkeypatch):
    terms = deepcopy(default_site_page_map()["terms-and-conditions"])

    async def site_page(slug):
        assert slug == "terms-and-conditions"
        return terms

    async def common():
        return {"product_types": [], "enquiry_cms": {}, "site_navigation": []}

    monkeypatch.setattr(pages, "site_page_context", site_page)
    monkeypatch.setattr(pages, "common_context", common)
    request = Request({"type": "http", "method": "GET", "path": "/terms-and-conditions", "headers": [], "scheme": "http", "server": ("test", 80), "query_string": b""})
    response = asyncio.run(pages.render_cms_page(request, "terms-and-conditions"))
    assert response.template.name == "cms_page.html"
    assert b"Terms &amp; Conditions" in response.body


def test_empty_enabled_section_image_does_not_reserve_an_image_column():
    template = pages.templates.env.get_template("partials/cms_sections.html")
    markup = template.module.render_sections([{
        "id": "copy-only",
        "type": "image-text",
        "width": "full",
        "content": "<p>Copy should use the full card width.</p>",
        "showImage": True,
        "image": "",
    }])
    assert "cms-has-image" not in markup
    assert "cms-copy" in markup
