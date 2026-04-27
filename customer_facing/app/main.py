from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routes import pages, finder
from app.api_client import api, ApiClientError
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


@app.exception_handler(404)
async def not_found(request: Request, exc):
    product_types = []

    try:
        product_types = await api.product_types()
    except Exception:
        pass

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
    product_types = []

    try:
        product_types = await api.product_types()
    except Exception:
        pass

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
