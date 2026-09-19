import colorsys
import hashlib
import re

from fastapi import APIRouter, Request, HTTPException

from app.api_client import api
from app.catalogue_cache import catalogue_cache
from app.seo import seo_meta
from app.view_templates import templates

router = APIRouter()


ENGINEERING_SERVICES = [
    {
        "title": "Laser cutting",
        "badge": "01",
        "image": "/static/media/laser-cutter.svg",
        "summary": "Clean, accurate part profiles for prototypes, production runs, and custom fabrication.",
        "points": [
            "Repeatable cut profiles",
            "Efficient sheet utilisation",
            "Suitable for one-off and repeat work",
        ],
    },
    {
        "title": "Brake pressing",
        "badge": "02",
        "image": "/static/media/brake-press.svg",
        "summary": "Controlled folds, returns, and formed sections to help parts fit and assemble cleanly.",
        "points": [
            "Accurate bends and returns",
            "Formed panels and brackets",
            "Consistent results across a run",
        ],
    },
    {
        "title": "Rolling",
        "badge": "03",
        "image": "/static/media/roller.svg",
        "summary": "Curved sections and controlled radii for practical metalwork and airflow applications.",
        "points": [
            "Controlled curved sections",
            "Repeatable radii",
            "Support for custom shapes",
        ],
    },
    {
        "title": "Flanging",
        "badge": "04",
        "image": "/static/media/flanger.svg",
        "summary": "Stiffened edges and tidy finishing details that support robust, practical assembly.",
        "points": [
            "Stiffened component edges",
            "Neat assembly details",
            "Useful for custom ducting and parts",
        ],
    },
]


def _cached_series_by_id(series_id: int) -> dict | None:
    for series in catalogue_cache.series_list():
        if str(series.get("id")) == str(series_id):
            return series
    return None


def _cached_product_by_id(product_id: int) -> dict | None:
    for product in catalogue_cache.products():
        if str(product.get("id")) == str(product_id):
            return product
    return None


async def common_context():
    product_types = catalogue_cache.product_types()
    if not product_types:
        try:
            product_types = await api.product_types()
        except Exception:
            product_types = []
    try:
        site_navigation = await api.site_navigation()
    except Exception:
        site_navigation = []
    return {"product_types": product_types, "enquiry_cms": {}, "site_navigation": site_navigation}


def quote_request_context(
    request: Request,
    *,
    page_type: str,
    page_title: str = "",
    page_summary: str = "",
    page_card_title: str = "",
    page_card_summary: str = "",
    product_type: dict | None = None,
    series: dict | None = None,
    product: dict | None = None,
) -> dict:
    """Build the stable public context consumed by the enquiry workflow."""
    return {
        "pageType": page_type,
        "pageTitle": page_title,
        "pageSummary": page_summary,
        "pageCardTitle": page_card_title,
        "pageCardSummary": page_card_summary,
        "pageUrl": str(request.url),
        "productType": product_type or {},
        "series": series or {},
        "product": product or {},
    }


async def site_page_context(slug):
    """Return published CMS content while keeping the public site resilient."""
    try:
        return await api.site_page(slug)
    except Exception:
        return {"content": {}, "seo": {}}


def build_downloads(record: dict | None, pdf_keys: tuple[str, ...], pdf_label: str) -> list[dict]:
    if not record:
        return []
    downloads = []
    for key in pdf_keys:
        url = record.get(key)
        if url:
            downloads.append({
                "label": f"📑 {pdf_label}",
                "url": url,
                "note": "Generated printed PDF",
                "size": format_file_size(record.get(key.replace("_url", "_size_bytes"))),
            })
            break
    for document in record.get("associated_documents") or []:
        url = document.get("download_url")
        if url:
            downloads.append({
                "label": f"📄 {document.get('original_file_name') or 'Download document'}",
                "url": url,
                "note": "Associated document",
                "size": format_file_size(document.get("file_size_bytes")),
            })
    return downloads


def format_file_size(size_bytes) -> str:
    try:
        size = float(size_bytes)
    except (TypeError, ValueError):
        return ""
    if size < 1024:
        return f"{int(size)} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.0f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def build_description_sections(record: dict) -> list[dict]:
    sections: list[dict] = []

    def append_legacy_description_four() -> None:
        has_description_four = any(
            str(section.get("key") or "").casefold() == "description4_html"
            for section in sections
        )
        legacy_html = str(record.get("comments_html") or "")
        if not has_description_four and legacy_html.strip():
            sections.append({
                "key": "description4_html",
                "title": "Description 4",
                "html": legacy_html,
                "order": 4,
            })

    explicit_sections = record.get("description_sections")
    if isinstance(explicit_sections, list) and explicit_sections:
        for index, section in enumerate(explicit_sections, start=1):
            html_value = section.get("html") if isinstance(section, dict) else None
            if html_value in (None, "") and isinstance(section, dict):
                html_value = section.get("content") or section.get("body")
            if not str(html_value or "").strip():
                continue
            sections.append({
                "key": (section.get("key") if isinstance(section, dict) else None) or f"description{index}_html",
                "title": (section.get("title") if isinstance(section, dict) else None)
                or (section.get("label") if isinstance(section, dict) else None)
                or f"Description {index}",
                "html": html_value or "",
            })
        append_legacy_description_four()
        return sections

    pattern = re.compile(r"^description(\d+)_html$", re.IGNORECASE)
    for key, value in record.items():
        match = pattern.match(str(key))
        if not match:
            continue
        if not str(value or "").strip() or int(match.group(1)) > 10:
            continue
        sections.append({
            "key": key,
            "order": int(match.group(1)),
            "title": f"Description {int(match.group(1))}",
            "html": value or "",
        })

    append_legacy_description_four()
    sections.sort(key=lambda item: item.get("order", 0))
    for section in sections:
        section.pop("order", None)

    return sections


def build_product_graph_payload(product: dict, product_type: dict | None) -> dict:
    graph_config_source = product_type or {}

    def resolve_field(name: str, fallback=None):
        value = graph_config_source.get(name)
        if value not in (None, ""):
            return value
        value = product.get(name)
        if value not in (None, ""):
            return value
        return fallback

    rpm_lines = []
    for index, line in enumerate(sorted(product.get("rpm_lines", []) or [], key=lambda item: (item.get("rpm", 0), item.get("id", 0)))):
        rpm_lines.append({
            "rpm": line.get("rpm"),
            "band_color": line.get("band_color"),
            "sort_order": line.get("sort_order", index),
            "points": [
                {
                    "airflow": point.get("airflow"),
                    "pressure": point.get("pressure"),
                    "sort_order": point.get("sort_order", point_index),
                }
                for point_index, point in enumerate(sorted(line.get("points", []) or [], key=lambda item: item.get("sort_order", item.get("id", 0))))
            ],
        })

    efficiency_points = []
    for index, point in enumerate(sorted(product.get("efficiency_points", []) or [], key=lambda item: (item.get("airflow", 0), item.get("id", 0)))):
        efficiency_points.append({
            "airflow": point.get("airflow"),
            "sort_order": point.get("sort_order", index),
            "efficiency_centre": point.get("efficiency_centre"),
            "efficiency_lower_end": point.get("efficiency_lower_end"),
            "efficiency_higher_end": point.get("efficiency_higher_end"),
            "permissible_use": point.get("permissible_use"),
        })

    return {
        "productModel": product.get("model"),
        "graphMode": "product",
        "hasGraphData": bool(rpm_lines or efficiency_points),
        "graphConfig": {
            "graph_kind": resolve_field("graph_kind"),
            "supports_graph": bool(resolve_field("supports_graph", False)),
            "supports_graph_overlays": bool(resolve_field("supports_graph_overlays", True)),
            "supports_band_graph_style": bool(resolve_field("supports_band_graph_style", True)),
            "graph_line_value_label": resolve_field("graph_line_value_label"),
            "graph_line_value_unit": resolve_field("graph_line_value_unit"),
            "graph_x_axis_label": resolve_field("graph_x_axis_label"),
            "graph_x_axis_unit": resolve_field("graph_x_axis_unit"),
            "graph_y_axis_label": resolve_field("graph_y_axis_label"),
            "graph_y_axis_unit": resolve_field("graph_y_axis_unit"),
            "band_graph_background_color": resolve_field("band_graph_background_color"),
            "band_graph_label_text_color": resolve_field("band_graph_label_text_color"),
            "band_graph_faded_opacity": resolve_field("band_graph_faded_opacity"),
            "band_graph_permissible_label_color": resolve_field("band_graph_permissible_label_color"),
        },
        "showRpmBandShading": bool(product.get("show_rpm_band_shading", True)),
        "rpmLines": rpm_lines,
        "efficiencyPoints": efficiency_points,
    }


def build_series_graph_payload(series: dict, product_type: dict | None, series_products: list[dict]) -> dict:
    # The backend already builds the series graph from the fully-loaded ORM
    # relationships. Prefer that payload so the customer site preserves the
    # synthetic line roles (including the low line) and point-to-line IDs.
    existing_payload = series.get("series_graph_payload")
    if isinstance(existing_payload, dict) and existing_payload.get("rpmLines"):
        return {
            **existing_payload,
            "productModel": existing_payload.get("productModel") or series.get("name"),
            "graphMode": existing_payload.get("graphMode") or "series",
        }

    graph_config_source = product_type or {}

    def resolve_field(name: str, fallback=None):
        value = graph_config_source.get(name)
        if value not in (None, ""):
            return value
        return fallback

    if not product_type or not product_type.get("supports_graph", False):
        return {
            "productModel": series.get("name"),
            "graphMode": "series",
            "hasGraphData": False,
            "graphConfig": {
                "graph_kind": resolve_field("graph_kind"),
                "supports_graph": False,
                "supports_graph_overlays": bool(resolve_field("supports_graph_overlays", True)),
                "supports_band_graph_style": bool(resolve_field("supports_band_graph_style", True)),
                "graph_line_value_label": resolve_field("graph_line_value_label"),
                "graph_line_value_unit": resolve_field("graph_line_value_unit"),
                "graph_x_axis_label": resolve_field("graph_x_axis_label"),
                "graph_x_axis_unit": resolve_field("graph_x_axis_unit"),
                "graph_y_axis_label": resolve_field("graph_y_axis_label"),
                "graph_y_axis_unit": resolve_field("graph_y_axis_unit"),
            },
            "showRpmBandShading": False,
            "rpmLines": [],
            "efficiencyPoints": [],
        }

    synthetic_lines: list[dict] = []
    next_line_id = 1

    def product_color_for_identity(identity):
        if identity in (None, ""):
            return "#64748b"
        digest = hashlib.sha1(str(identity).encode("utf-8")).digest()
        hue = int.from_bytes(digest[:2], "big") / 65535.0
        saturation = 0.62 + (digest[2] / 255.0) * 0.18
        lightness = 0.44 + (digest[3] / 255.0) * 0.08
        red, green, blue = colorsys.hls_to_rgb(hue, lightness, saturation)
        return "#{:02x}{:02x}{:02x}".format(int(red * 255 * 0.72), int(green * 255 * 0.72), int(blue * 255 * 0.72))

    ordered_products = sorted(series_products or [], key=lambda item: str(item.get("model") or "").casefold())
    for product in ordered_products:
        ordered_lines = sorted(product.get("rpm_lines", []) or [], key=lambda item: (item.get("rpm", 0), item.get("id", 0)))
        if not ordered_lines:
            continue
        product_color = product_color_for_identity(product.get("id"))

        selected_lines = [line for line in ordered_lines if line.get("points")]
        if not selected_lines:
            continue
        if len(selected_lines) > 1:
            selected_lines = [selected_lines[0], selected_lines[-1]]

        for index, line in enumerate(selected_lines):
            synthetic_line_id = next_line_id
            next_line_id += 1
            line_rpm = line.get("rpm")
            display_label = (
                f"{product.get('model')} low"
                if len(selected_lines) > 1 and index == 0
                else f"{product.get('model')} high"
                if len(selected_lines) > 1
                else f"{product.get('model')}"
            )
            synthetic_lines.append({
                "id": synthetic_line_id,
                "rpm": synthetic_line_id,
                "display_label": display_label,
                "band_color": product_color,
                "line_role": "low" if len(selected_lines) > 1 and index == 0 else "high",
                "points": [],
            })
            for point in sorted(line.get("points", []) or [], key=lambda item: (item.get("airflow", 0), item.get("id", 0))):
                synthetic_lines[-1]["points"].append({
                    "id": point.get("id"),
                    "airflow": point.get("airflow"),
                    "pressure": point.get("pressure"),
                })

    return {
        "productModel": series.get("name"),
        "graphMode": "series",
        "hasGraphData": bool(synthetic_lines),
        "graphConfig": {
            "graph_kind": resolve_field("graph_kind"),
            "supports_graph": True,
            "supports_graph_overlays": bool(resolve_field("supports_graph_overlays", True)),
            "supports_band_graph_style": bool(resolve_field("supports_band_graph_style", True)),
            "graph_line_value_label": resolve_field("graph_line_value_label"),
            "graph_line_value_unit": resolve_field("graph_line_value_unit"),
            "graph_x_axis_label": resolve_field("graph_x_axis_label"),
            "graph_x_axis_unit": resolve_field("graph_x_axis_unit"),
            "graph_y_axis_label": resolve_field("graph_y_axis_label"),
            "graph_y_axis_unit": resolve_field("graph_y_axis_unit"),
            "band_graph_background_color": resolve_field("band_graph_background_color"),
            "band_graph_label_text_color": resolve_field("band_graph_label_text_color"),
            "band_graph_faded_opacity": resolve_field("band_graph_faded_opacity"),
            "band_graph_permissible_label_color": resolve_field("band_graph_permissible_label_color"),
        },
        "showRpmBandShading": False,
        "rpmLines": synthetic_lines,
        "efficiencyPoints": [],
    }


def build_product_graph_payload(product: dict, product_type: dict | None) -> dict:
    graph_config_source = product_type or {}

    def resolve_field(name: str, fallback=None):
        value = graph_config_source.get(name)
        if value not in (None, ""):
            return value
        value = product.get(name)
        if value not in (None, ""):
            return value
        return fallback

    rpm_lines = []
    for index, line in enumerate(sorted(product.get("rpm_lines", []) or [], key=lambda item: (item.get("rpm", 0), item.get("id", 0)))):
        rpm_lines.append({
            "rpm": line.get("rpm"),
            "band_color": line.get("band_color"),
            "sort_order": line.get("sort_order", index),
            "points": [
                {
                    "airflow": point.get("airflow"),
                    "pressure": point.get("pressure"),
                    "sort_order": point.get("sort_order", point_index),
                }
                for point_index, point in enumerate(sorted(line.get("points", []) or [], key=lambda item: item.get("sort_order", item.get("id", 0))))
            ],
        })

    efficiency_points = []
    for index, point in enumerate(sorted(product.get("efficiency_points", []) or [], key=lambda item: (item.get("airflow", 0), item.get("id", 0)))):
        efficiency_points.append({
            "airflow": point.get("airflow"),
            "sort_order": point.get("sort_order", index),
            "efficiency_centre": point.get("efficiency_centre"),
            "efficiency_lower_end": point.get("efficiency_lower_end"),
            "efficiency_higher_end": point.get("efficiency_higher_end"),
            "permissible_use": point.get("permissible_use"),
        })

    return {
        "productModel": product.get("model"),
        "hasGraphData": bool(rpm_lines or efficiency_points),
        "graphConfig": {
            "graph_kind": resolve_field("graph_kind"),
            "supports_graph": bool(resolve_field("supports_graph", False)),
            "supports_graph_overlays": bool(resolve_field("supports_graph_overlays", True)),
            "supports_band_graph_style": bool(resolve_field("supports_band_graph_style", True)),
            "graph_line_value_label": resolve_field("graph_line_value_label"),
            "graph_line_value_unit": resolve_field("graph_line_value_unit"),
            "graph_x_axis_label": resolve_field("graph_x_axis_label"),
            "graph_x_axis_unit": resolve_field("graph_x_axis_unit"),
            "graph_y_axis_label": resolve_field("graph_y_axis_label"),
            "graph_y_axis_unit": resolve_field("graph_y_axis_unit"),
            "band_graph_background_color": resolve_field("band_graph_background_color"),
            "band_graph_label_text_color": resolve_field("band_graph_label_text_color"),
            "band_graph_faded_opacity": resolve_field("band_graph_faded_opacity"),
            "band_graph_permissible_label_color": resolve_field("band_graph_permissible_label_color"),
        },
        "showRpmBandShading": bool(product.get("show_rpm_band_shading", True)),
        "rpmLines": rpm_lines,
        "efficiencyPoints": efficiency_points,
    }


@router.get("/")
async def homepage(request: Request):
    products = catalogue_cache.products()
    if not products:
        try:
            products = await api.products()
        except Exception:
            products = []
    series = catalogue_cache.series_list()
    product_types_context = await common_context()
    home_product_types = catalogue_cache.home_product_types()
    if not home_product_types:
        home_product_types = product_types_context["product_types"]
    featured_product_type = home_product_types[0] if home_product_types else None

    context = dict(product_types_context)
    context.update({
        "request": request,
        "seo": seo_meta(
            "Product Finder",
            "Find suitable industrial products by product type, mounting style, discharge type, and specification range.",
            "/",
        ),
        "products": products,
        "series": series,
        "home_product_types": home_product_types,
        "featured_product_type": featured_product_type,
        "quote_request_context": quote_request_context(
            request,
            page_type="home",
            page_title="Product Finder",
            page_summary="Find suitable industrial products by product type and specification range.",
        ),
    })

    return templates.TemplateResponse(request, "index.html", context)


# Marketing pages use the same persisted section renderer as custom CMS pages.
@router.get("/contact")
async def contact_page(request: Request):
    return await render_cms_page(request, "contact")


@router.get("/engineering-services")
async def engineering_services_page(request: Request):
    return await render_cms_page(request, "engineering-services")


@router.get("/past-projects")
async def past_projects_page(request: Request):
    return await render_cms_page(request, "past-projects")


@router.get("/about-us")
async def about_us_page(request: Request):
    return await render_cms_page(request, "about-us")


@router.get("/products")
async def products_page(request: Request):
    search = request.query_params.get("search", "").strip()
    products = catalogue_cache.products()
    if not products:
        try:
            products = await api.products()
        except Exception:
            products = []

    context = await common_context()
    try:
        all_product_types_pdf = await api.all_product_types_pdf()
    except Exception:
        all_product_types_pdf = {"available": False}
    all_product_types_pdf["size"] = format_file_size(all_product_types_pdf.get("size_bytes"))
    context.update({
        "request": request,
        "seo": seo_meta(
            "Product Finder",
            "Find suitable industrial products by product type, mounting style, discharge type, and specification range.",
            "/products",
        ),
        "series": catalogue_cache.series_list(),
        "products": products,
        "search": search,
        "all_product_types_pdf": all_product_types_pdf,
        "quote_request_context": quote_request_context(
            request,
            page_type="products",
            page_title="Product Finder",
            page_summary="Find suitable industrial products by product type and specification range.",
        ),
    })

    return templates.TemplateResponse(request, "products.html", context)


@router.get("/products/type/{product_type_key}")
async def product_type_page(request: Request, product_type_key: str):
    selected_type = catalogue_cache.product_type(product_type_key)
    if not selected_type:
        try:
            product_types = await api.product_types()
        except Exception:
            product_types = []
        selected_type = next((x for x in product_types if x["key"] == product_type_key), None)

    if not selected_type:
        raise HTTPException(status_code=404)

    series = catalogue_cache.series_list(product_type_key=product_type_key)
    products = catalogue_cache.products(product_type_key=product_type_key)
    if not products:
        try:
            products = await api.products(product_type_key=product_type_key)
        except Exception:
            products = []

    context = await common_context()
    context.update({
        "request": request,
        "seo": seo_meta(
            selected_type["label"],
            f"Browse {selected_type['label']} series and products.",
            f"/products/type/{product_type_key}",
        ),
        "selected_type": selected_type,
        "series": series,
        "products": products,
        "product_type_downloads": build_downloads(
            selected_type,
            ("product_type_printed_pdf_url", "product_type_pdf_url"),
            f"{selected_type['label']} catalogue",
        ),
        "quote_request_context": quote_request_context(
            request,
            page_type="product-type",
            page_title=selected_type["label"],
            page_summary=f"Browse {selected_type['label']} series and products.",
            product_type=selected_type,
        ),
    })

    return templates.TemplateResponse(request, "product_type.html", context)


@router.get("/series/{series_slug}")
async def series_page(request: Request, series_slug: str):
    series_id_str = series_slug.split("-", 1)[0]
    if not series_id_str.isdigit():
        raise HTTPException(status_code=404)

    series_id = int(series_id_str)
    series = None
    try:
        series = await api.series(series_id)
    except Exception:
        series = _cached_series_by_id(series_id)
    if series is None:
        raise HTTPException(status_code=404)

    context = await common_context()
    product_type = next((x for x in context["product_types"] if x["key"] == series.get("product_type_key")), None)
    series_products = []
    try:
        series_products = await api.products(series_id=series_id)
    except Exception:
        series_products = catalogue_cache.products(series_id=series_id)
    context.update({
        "request": request,
        "seo": seo_meta(
            series["name"],
            f"View product information, specifications, graphs, PDFs, and models for {series['name']}.",
            f"/series/{series_slug}",
        ),
        "series": series,
        "product_type": product_type,
        "series_products": series_products,
        "series_sections": build_description_sections(series),
        "series_performance_table_html": series.get("performance_table_html") or "",
        "series_graph": build_series_graph_payload(series, product_type, series_products),
        "product_type_downloads": build_downloads(
            product_type,
            ("product_type_printed_pdf_url", "product_type_pdf_url"),
            f"{product_type['label']} catalogue" if product_type else "Product catalogue",
        ),
        "series_downloads": build_downloads(
            series, ("series_printed_pdf_url", "series_pdf_url"), "PDF spec sheet"
        ),
        "quote_request_context": quote_request_context(
            request,
            page_type="series",
            page_title=series["name"],
            page_summary=f"View products, specifications, graphs, and documents for {series['name']}.",
            product_type=product_type,
            series=series,
        ),
    })

    return templates.TemplateResponse(request, "series.html", context)


@router.get("/products/{product_slug}")
async def product_page(request: Request, product_slug: str):
    product_id_str = product_slug.split("-", 1)[0]
    if not product_id_str.isdigit():
        raise HTTPException(status_code=404)

    product_id = int(product_id_str)
    product = None
    try:
        product = await api.product(product_id)
    except Exception:
        product = _cached_product_by_id(product_id)
    if product is None:
        raise HTTPException(status_code=404)

    context = await common_context()
    product_type = next((x for x in context["product_types"] if x["key"] == product.get("product_type_key")), None)
    product_series = None
    if product.get("series_id"):
        try:
            product_series = await api.series(product["series_id"])
        except Exception:
            product_series = _cached_series_by_id(product["series_id"])
    context.update({
        "request": request,
        "seo": seo_meta(
            product["model"],
            f"View specifications, graphs, images, and PDFs for {product['model']}.",
            f"/products/{product_slug}",
        ),
        "product": product,
        "series": product_series,
        "product_sections": build_description_sections(product),
        "product_graph": build_product_graph_payload(product, product_type),
        "product_type_downloads": build_downloads(
            product_type,
            ("product_type_printed_pdf_url", "product_type_pdf_url"),
            f"{product_type['label']} catalogue" if product_type else "Product catalogue",
        ),
        "series_downloads": build_downloads(
            _cached_series_by_id(product.get("series_id")) if product.get("series_id") else None,
            ("series_printed_pdf_url", "series_pdf_url"),
            "PDF spec sheet",
        ),
        "product_downloads": build_downloads(
            product, ("product_printed_pdf_url", "product_pdf_url"), "PDF spec sheet"
        ),
        "quote_request_context": quote_request_context(
            request,
            page_type="product",
            page_title=product["model"],
            page_summary=f"View specifications, images, graphs, and documents for {product['model']}.",
            product_type=product_type,
            series=product_series,
            product=product,
        ),
    })

    return templates.TemplateResponse(request, "product.html", context)


@router.get("/{page_slug}")
async def cms_page(request: Request, page_slug: str):
    if page_slug in {"api", "static", "products", "series", "contact", "about-us", "engineering-services", "past-projects"}:
        raise HTTPException(status_code=404)
    return await render_cms_page(request, page_slug)


async def render_cms_page(request: Request, page_slug: str):
    cms = await site_page_context(page_slug)
    if not cms.get("content") or cms.get("content_type") == "modal":
        raise HTTPException(status_code=404)
    context = await common_context()
    # Keep previously published pages available until their CMS replacement is published.
    legacy_templates = {
        "about-us": "about_us.html", "contact": "contact.html",
        "engineering-services": "engineering_services.html", "past-projects": "past_projects.html",
    }
    context.update({
        "request": request,
        "page": {"label": cms.get("label") or page_slug.replace("-", " ").title(), "layout": cms.get("layout") or []},
        "content": cms.get("content", {}),
        "seo": seo_meta(cms.get("seo", {}).get("title") or page_slug.replace("-", " ").title(), cms.get("seo", {}).get("description") or "", f"/{page_slug}"),
        "quote_request_context": quote_request_context(
            request,
            page_type="cms-page",
            page_title=cms.get("label") or page_slug.replace("-", " ").title(),
            page_summary=cms.get("seo", {}).get("description") or "",
        ),
    })
    if cms.get("layout") is None and page_slug in legacy_templates:
        context.update(cms=cms.get("content", {}), services=cms.get("content", {}).get("services") or ENGINEERING_SERVICES, request_quote_url="#quoteRequestModal")
        return templates.TemplateResponse(request, legacy_templates[page_slug], context)
    return templates.TemplateResponse(request, "cms_page.html", context)
