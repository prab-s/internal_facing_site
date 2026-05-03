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


@router.get("/")
async def homepage(request: Request):
    start = time.perf_counter()
    context = await common_context()
    product_types = context["product_types"]
    context.update({
        "request": request,
        "seo": seo_meta(
            "Vent-tech catalogue",
            "Overview of the Vent-tech catalogue and product families.",
            "/",
        ),
        "featured_product_type_key": product_types[0]["key"] if product_types else "",
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
    context.update({
        "request": request,
        "seo": seo_meta(
            series["name"],
            f"View product information, specifications, graphs, PDFs, and models for {series['name']}.",
            canonical_path,
        ),
        "series": series,
        "series_products": cached_products,
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
    context.update({
        "request": request,
        "seo": seo_meta(
            product["model"],
            f"View specifications, graphs, images, and PDFs for {product['model']}.",
            canonical_path,
        ),
        "product": product,
        "product_sections": optional_sections(
            ("Overview", product.get("description1_html")),
            ("Features", product.get("description2_html")),
            ("Specifications", product.get("description3_html")),
            ("Notes", product.get("comments_html")),
        ),
    })

    logger.info("Rendered product page %s in %.1fms", product_id, (time.perf_counter() - start) * 1000.0)

    return templates.TemplateResponse(request, "product.html", context)
