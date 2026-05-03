import httpx
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from app.catalogue_cache import catalogue_cache
from app.config import settings
from app.routes import pages, finder
from app.api_client import ApiClientError
from app.view_templates import TEMPLATE_DIR, templates

root_logger = logging.getLogger()
root_logger.setLevel(getattr(logging, settings.log_level, logging.INFO))
root_logger.info(
    "Customer-facing app booting build=%s backend_api_base_url=%s public_site_url=%s log_level=%s finder_debug=%s",
    settings.app_build_marker,
    settings.backend_api_base_url,
    settings.public_site_url,
    settings.log_level,
    settings.finder_debug,
)
print(
    "Customer-facing app booting "
    f"build={settings.app_build_marker} "
    f"backend_api_base_url={settings.backend_api_base_url} "
    f"public_site_url={settings.public_site_url} "
    f"log_level={settings.log_level} "
    f"finder_debug={settings.finder_debug}",
    flush=True,
)

app = FastAPI(
    title=settings.site_name,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.mount("/static", StaticFiles(directory=TEMPLATE_DIR.parent / "static"), name="static")

app.include_router(pages.router)
app.include_router(finder.router)


@app.middleware("http")
async def add_build_marker_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-App-Build"] = settings.app_build_marker
    return response


@app.on_event("startup")
async def startup_catalogue_cache():
    app.state.catalogue_cache = catalogue_cache
    await catalogue_cache.initialize()


@app.on_event("shutdown")
async def shutdown_catalogue_cache():
    await catalogue_cache.shutdown()


@app.post("/api/cache/refresh")
async def refresh_catalogue_cache(request: Request):
    provided_token = (request.headers.get("authorization") or "").removeprefix("Bearer ").strip()
    if not settings.cms_api_token or provided_token != settings.cms_api_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    await catalogue_cache.refresh_best_effort()
    snapshot = catalogue_cache.snapshot()
    return {
        "refreshed": True,
        "fetched_at": snapshot.fetched_at,
        "product_types": len(snapshot.product_types),
        "series": len(snapshot.series),
        "products": len(snapshot.products),
    }


@app.get("/api/cms/media/{media_path:path}")
async def proxy_cms_media(media_path: str, request: Request):
    upstream_url = f"{settings.backend_api_base_url}/api/cms/media/{media_path}"
    if request.url.query:
        upstream_url = f"{upstream_url}?{request.url.query}"

    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            upstream = await client.get(upstream_url)
            upstream.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or f"Media request failed with status {exc.response.status_code}."
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Media is unavailable right now.") from exc

    passthrough_headers = {}
    for header_name in ("content-type", "cache-control", "etag", "last-modified", "content-disposition"):
        if header_name in upstream.headers:
            passthrough_headers[header_name] = upstream.headers[header_name]

    return Response(content=upstream.content, media_type=upstream.headers.get("content-type"), headers=passthrough_headers)


@app.exception_handler(404)
async def not_found(request: Request, exc):
    product_types = request.app.state.catalogue_cache.product_types() if hasattr(request.app.state, "catalogue_cache") else []

    return templates.TemplateResponse(
        request,
        "errors/404.html",
        {
            "request": request,
            "product_types": product_types,
            "seo": {
                "title": "Page not found | Vent-tech catalogue",
                "description": "The requested page could not be found.",
                "canonical": str(request.url),
            },
        },
        status_code=404,
    )


@app.exception_handler(ApiClientError)
async def upstream_error(request: Request, exc: ApiClientError):
    product_types = request.app.state.catalogue_cache.product_types() if hasattr(request.app.state, "catalogue_cache") else []

    return templates.TemplateResponse(
        request,
        "errors/upstream.html",
        {
            "request": request,
            "product_types": product_types,
            "seo": {
                "title": f"Catalogue unavailable | {settings.site_name}",
                "description": "The catalogue is temporarily unavailable.",
                "canonical": str(request.url),
            },
            "message": exc.message,
            "status_code": exc.status_code,
        },
        status_code=502 if exc.status_code < 500 else exc.status_code,
    )
