from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse

from app.api_client import api, ApiClientError
from app.seo import seo_meta
from app.slug import product_url, series_url
from app.view_templates import templates

router = APIRouter()


async def common_context():
    product_types = await api.product_types()
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
    products = await api.products()

    context = await common_context()
    context.update({
        "request": request,
        "seo": seo_meta(
            "Product Finder",
            "Find suitable industrial products by product type, mounting style, discharge type, and specification range.",
            "/",
        ),
        "products": products,
    })

    return templates.TemplateResponse(request, "index.html", context)


@router.get("/products/type/{product_type_key}")
async def product_type_page(request: Request, product_type_key: str):
    product_types = await api.product_types()
    selected_type = next((x for x in product_types if x["key"] == product_type_key), None)

    if not selected_type:
        raise HTTPException(status_code=404)

    series = await api.series_list(product_type_key=product_type_key)
    products = await api.products(product_type_key=product_type_key)

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

    return templates.TemplateResponse(request, "product_type.html", context)


@router.get("/series/{series_slug}")
async def series_page(request: Request, series_slug: str):
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

    context = await common_context()
    context.update({
        "request": request,
        "seo": seo_meta(
            series["name"],
            f"View product information, specifications, graphs, PDFs, and models for {series['name']}.",
            canonical_path,
        ),
        "series": series,
        "series_sections": optional_sections(
            ("Overview", series.get("description1_html")),
            ("Features", series.get("description2_html")),
            ("Specifications", series.get("description3_html")),
            ("Notes", series.get("comments_html")),
        ),
    })

    return templates.TemplateResponse(request, "series.html", context)


@router.get("/products/{product_slug}")
async def product_page(request: Request, product_slug: str):
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

    return templates.TemplateResponse(request, "product.html", context)
