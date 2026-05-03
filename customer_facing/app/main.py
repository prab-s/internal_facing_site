from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles

from app.catalogue_cache import catalogue_cache
from app.config import settings
from app.routes import pages, finder
from app.api_client import ApiClientError
from app.view_templates import TEMPLATE_DIR, templates

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
