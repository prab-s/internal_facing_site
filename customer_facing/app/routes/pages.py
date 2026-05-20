import logging
import time

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse

from app.api_client import api, ApiClientError
from app.catalogue_cache import catalogue_cache
from app.seo import seo_meta
from app.slug import product_url, products_url, series_url
from app.view_templates import templates

router = APIRouter()
logger = logging.getLogger(__name__)


async def common_context():
    product_types = catalogue_cache.product_types()
    return {"product_types": product_types}


def parse_slug_id(value: str) -> int:
    try:
        return int(str(value).split("-", 1)[0])
    except (TypeError, ValueError):
        raise HTTPException(status_code=404) from None


def optional_sections(*pairs):
    return [{"title": title, "html": html} for title, html in pairs if html]


def download_group(title: str, description: str, items: list[dict]) -> dict:
    return {"title": title, "description": description, "links": [item for item in items if item.get("url")]}


def request_quote_url() -> str:
    return "mailto:admin@venttech.co.nz?subject=Vent-Tech%20quote%20request"


def product_type_downloads(selected_type: dict) -> list[dict]:
    items = [
        {"label": "Main catalogue", "url": selected_type.get("product_type_pdf_url"), "note": "Product type overview"},
        {"label": "Printed brochure", "url": selected_type.get("product_type_printed_pdf_url"), "note": "Layout-ready brochure"},
    ]
    return [item for item in items if item["url"]]


def series_downloads(series: dict) -> list[dict]:
    items = [
        {"label": "Series brochure", "url": series.get("series_pdf_url"), "note": "Series overview"},
        {"label": "Printed PDF", "url": series.get("series_printed_pdf_url"), "note": "Press-friendly version"},
        {"label": "Online PDF", "url": series.get("series_online_pdf_url"), "note": "Web-ready version"},
    ]
    return [item for item in items if item["url"]]


def product_downloads(product: dict) -> list[dict]:
    items = [
        {"label": "Model datasheet", "url": product.get("product_pdf_url"), "note": "Exact model PDF"},
        {"label": "Printed PDF", "url": product.get("product_printed_pdf_url"), "note": "Press-friendly version"},
        {"label": "Online PDF", "url": product.get("product_online_pdf_url"), "note": "Web-ready version"},
    ]
    return [item for item in items if item["url"]]


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

    product_type_name = str(product.get("product_type_label") or product_type.get("label") or product_type.get("key") or "").strip()
    series_name = str(product.get("series_name") or "").strip()
    product_name = str(product.get("model") or "").strip()
    title_prefix = f"{product_type_name} | " if product_type_name else ""
    title_middle = f"{series_name} - " if series_name else ""
    graph_title = f"{title_prefix}{title_middle}{product_name} performance graph".strip()

    return {
        "productModel": product.get("model"),
        "graphTitle": graph_title,
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
    graph_config_source = product_type or {}

    def resolve_field(name: str, fallback=None):
        value = graph_config_source.get(name)
        if value not in (None, ""):
            return value
        return fallback

    if not product_type or not product_type.get("supports_graph", False):
        return {
            "productModel": series.get("name"),
            "graphTitle": f"{str(series.get('name') or '').strip()} performance graph".strip(),
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

    ordered_products = sorted(series_products or [], key=lambda item: str(item.get("model") or "").casefold())
    for product in ordered_products:
        ordered_lines = sorted(product.get("rpm_lines", []) or [], key=lambda item: (item.get("rpm", 0), item.get("id", 0)))
        if not ordered_lines:
            continue

        selected_lines = [ordered_lines[0]]
        if len(ordered_lines) > 1 and ordered_lines[-1] != ordered_lines[0]:
            selected_lines.append(ordered_lines[-1])

        for index, line in enumerate(selected_lines):
            synthetic_line_id = next_line_id
            next_line_id += 1
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
                "band_color": line.get("band_color"),
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
        "graphTitle": f"{str(series.get('name') or '').strip()} performance graph".strip(),
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


@router.get("/")
async def homepage(request: Request):
    start = time.perf_counter()
    context = await common_context()
    product_types = context["product_types"]
    featured_product_type = product_types[0] if product_types else None
    home_product_types = []
    for product_type in product_types:
        preview_images = []
        type_products = catalogue_cache.products(product_type_key=product_type.get("key", ""))
        series_list = catalogue_cache.series_list(product_type_key=product_type.get("key", ""))
        first_product_by_series: dict[str, dict] = {}
        for product in type_products:
            series_id = product.get("series_id")
            if series_id is None:
                continue
            series_key = str(series_id)
            if series_key not in first_product_by_series:
                first_product_by_series[series_key] = product

        for series in series_list:
            series_product = first_product_by_series.get(str(series.get("id")))
            if not series_product:
                continue
            preview_image_url = series_product.get("primary_product_image_url") or series_product.get("graph_image_url")
            if preview_image_url:
                preview_images.append(preview_image_url)

        if len(preview_images) < 4:
            seen_images = set(preview_images)
            for product in type_products:
                for preview_image_url in (
                    product.get("primary_product_image_url"),
                    product.get("graph_image_url"),
                ):
                    if not preview_image_url or preview_image_url in seen_images:
                        continue
                    preview_images.append(preview_image_url)
                    seen_images.add(preview_image_url)
                    if len(preview_images) >= 4:
                        break
                if len(preview_images) >= 4:
                    break

        if not preview_images:
            fallback_image = product_type.get("contents_icon_url")
            if fallback_image:
                preview_images = [fallback_image]

        home_product_types.append({
            **product_type,
            "preview_images": preview_images,
            "series_count": len(series_list),
            "product_count": len(type_products),
        })
    context.update({
        "request": request,
        "seo": seo_meta(
            "Vent-tech catalogue",
            "Overview of the Vent-tech catalogue and product types.",
            "/",
        ),
        "featured_product_type": featured_product_type,
        "home_product_types": home_product_types,
    })
    logger.info("Rendered homepage in %.1fms (%d product types)", (time.perf_counter() - start) * 1000.0, len(product_types))
    return templates.TemplateResponse(request, "index.html", context)


@router.get("/products")
async def products_page(request: Request):
    start = time.perf_counter()
    products = catalogue_cache.products()
    context = await common_context()
    context.update({
        "request": request,
        "seo": seo_meta(
            "Product Finder",
            "Find suitable industrial products by product type, mounting style, discharge type, and specification range.",
            products_url(),
        ),
        "products": products,
    })
    logger.info(
        "Rendered products page in %.1fms (%d products, %d product types)",
        (time.perf_counter() - start) * 1000.0,
        len(products),
        len(context["product_types"]),
    )
    return templates.TemplateResponse(request, "products.html", context)


@router.get("/contact")
async def contact_page(request: Request):
    context = await common_context()
    context.update({
        "request": request,
        "seo": seo_meta(
            "Contact Vent-Tech",
            "Get in touch with Vent-Tech for selection support, quotations, and project enquiries.",
            "/contact",
        ),
        "request_quote_url": request_quote_url(),
    })
    return templates.TemplateResponse(request, "contact.html", context)


@router.get("/finder")
async def finder_page_redirect():
    return RedirectResponse(products_url(), status_code=307)


@router.get("/products/type/{product_type_key}")
async def product_type_page(request: Request, product_type_key: str):
    start = time.perf_counter()
    selected_type = catalogue_cache.product_type(product_type_key)

    if not selected_type:
        raise HTTPException(status_code=404)

    series = catalogue_cache.series_list(product_type_key=product_type_key)
    products = catalogue_cache.products(product_type_key=product_type_key)

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
        "product_type_downloads": product_type_downloads(selected_type),
        "request_quote_url": request_quote_url(),
    })
    logger.info(
        "Rendered product type page %s in %.1fms (%d series, %d products)",
        product_type_key,
        (time.perf_counter() - start) * 1000.0,
        len(series),
        len(products),
    )
    return templates.TemplateResponse(request, "product_type.html", context)


@router.get("/series/{series_slug}")
async def series_page(request: Request, series_slug: str):
    start = time.perf_counter()
    series_id = parse_slug_id(series_slug)
    try:
        series = await api.series(series_id)
    except ApiClientError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404) from exc
        raise

    canonical_path = series_url(series)
    if request.url.path != canonical_path:
        return RedirectResponse(canonical_path, status_code=307)

    cached_products = catalogue_cache.products(series_id=series_id)

    context = await common_context()
    product_type = catalogue_cache.product_type(series.get("product_type_key"))
    context.update({
        "request": request,
        "seo": seo_meta(
            series["name"],
            f"View product information, specifications, graphs, PDFs, and models for {series['name']}.",
            canonical_path,
        ),
        "series": series,
        "product_type": product_type,
        "series_products": cached_products,
        "series_downloads": series_downloads(series),
        "product_type_downloads": product_type_downloads(product_type) if product_type else [],
        "request_quote_url": request_quote_url(),
        "series_graph": build_series_graph_payload(series, product_type, cached_products),
        "series_sections": optional_sections(
            ("Overview", series.get("description1_html")),
            ("Features", series.get("description2_html")),
            ("Specifications", series.get("description3_html")),
            ("Notes", series.get("comments_html")),
        ),
    })

    logger.info(
        "Rendered series page %s in %.1fms (%d cached products)",
        series_id,
        (time.perf_counter() - start) * 1000.0,
        len(cached_products),
    )

    return templates.TemplateResponse(request, "series.html", context)


@router.get("/products/{product_slug}")
async def product_page(request: Request, product_slug: str):
    start = time.perf_counter()
    product_id = parse_slug_id(product_slug)
    try:
        product = await api.product(product_id)
    except ApiClientError as exc:
        if exc.status_code == 404:
            raise HTTPException(status_code=404) from exc
        raise

    canonical_path = product_url(product)
    if request.url.path != canonical_path:
        return RedirectResponse(canonical_path, status_code=307)

    context = await common_context()
    product_type = catalogue_cache.product_type(product.get("product_type_key"))
    series = await api.series(product["series_id"]) if product.get("series_id") else None
    context.update({
        "request": request,
        "seo": seo_meta(
            product["model"],
            f"View specifications, graphs, images, and PDFs for {product['model']}.",
            canonical_path,
        ),
        "product": product,
        "product_type": product_type,
        "series": series,
        "product_downloads": product_downloads(product),
        "series_downloads": series_downloads(series) if series else [],
        "product_type_downloads": product_type_downloads(product_type) if product_type else [],
        "request_quote_url": request_quote_url(),
        "product_graph": build_product_graph_payload(product, product_type),
        "product_sections": optional_sections(
            ("Overview", product.get("description1_html")),
            ("Features", product.get("description2_html")),
            ("Specifications", product.get("description3_html")),
            ("Notes", product.get("comments_html")),
        ),
    })

    logger.info("Rendered product page %s in %.1fms", product_id, (time.perf_counter() - start) * 1000.0)

    return templates.TemplateResponse(request, "product.html", context)
