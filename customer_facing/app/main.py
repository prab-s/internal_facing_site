import os
import secrets
import logging

import httpx

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.routes import pages, finder, telemetry, media
from app.api_client import api
from app.catalogue_cache import catalogue_cache
from app.config import settings
from app.view_templates import templates

FRAME_ANCESTORS = os.getenv(
    "FRAME_ANCESTORS",
    "'self' http://localhost:8001 http://127.0.0.1:8001 http://192.168.18.33:8001 http://xps.local:8001",
).strip()
FRAME_ANCESTORS_EXPLICIT = bool(os.getenv("FRAME_ANCESTORS", "").strip())
SECURITY_CONFIGURATION_STRICT = os.getenv("SECURITY_CONFIGURATION_STRICT", "false").strip().lower() in {"1", "true", "yes", "on"}
SECURITY_CONFIGURATION_FILE = os.getenv("SECURITY_CONFIGURATION_FILE", ".env.sit" if not SECURITY_CONFIGURATION_STRICT else ".env.deploy").strip()
logger = logging.getLogger(__name__)

app = FastAPI(title="Vent-tech catalogue")

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/api/site-version", include_in_schema=False)
async def site_version():
    return JSONResponse(
        {"version": settings.app_build_marker},
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@app.get("/api/health/security", include_in_schema=False)
async def security_health():
    errors = []
    if SECURITY_CONFIGURATION_STRICT and not FRAME_ANCESTORS_EXPLICIT:
        errors.append("FRAME_ANCESTORS is not explicitly configured.")
    payload = {
        "ok": not errors,
        "strict": SECURITY_CONFIGURATION_STRICT,
        "errors": errors,
        "frame_ancestors_source": "FRAME_ANCESTORS" if FRAME_ANCESTORS_EXPLICIT else "development defaults",
    }
    return JSONResponse(status_code=200 if not errors else 503, content=payload)


@app.post("/api/cache/refresh", include_in_schema=False)
async def refresh_cache(request: Request):
    configured_token = settings.cms_api_token
    authorization = request.headers.get("authorization", "")
    supplied_token = authorization.removeprefix("Bearer ").strip()
    if not configured_token or not supplied_token or not secrets.compare_digest(supplied_token, configured_token):
        raise HTTPException(status_code=401, detail="Invalid cache refresh credentials.")

    await catalogue_cache.refresh()
    snapshot = catalogue_cache.snapshot()
    return {
        "product_types": len(snapshot.product_types),
        "series": len(snapshot.series),
        "products": len(snapshot.products),
        "fetched_at": snapshot.fetched_at,
    }


@app.post("/api/quote-requests", include_in_schema=False)
async def proxy_quote_request(request: Request):
    """Forward public enquiries to the backend while keeping the browser same-origin."""
    try:
        payload = await request.json()
    except (TypeError, ValueError):
        return JSONResponse(status_code=400, content={"detail": "Enquiry request must contain valid JSON."})

    try:
        async with httpx.AsyncClient(timeout=settings.quote_request_timeout_seconds) as client:
            response = await client.post(
                f"{settings.backend_api_base_url}/api/quote-requests",
                json=payload,
                headers={"Accept": "application/json"},
            )
    except httpx.HTTPError:
        logger.exception("Unable to forward customer enquiry to the backend")
        return JSONResponse(
            status_code=502,
            content={"detail": "We could not reach the enquiry service. Please try again."},
        )

    try:
        response_payload = response.json()
    except ValueError:
        logger.error("Backend returned a non-JSON response for a customer enquiry (status %s)", response.status_code)
        return JSONResponse(
            status_code=502,
            content={"detail": "The enquiry service returned an invalid response. Please try again."},
        )

    return JSONResponse(status_code=response.status_code, content=response_payload)


@app.post("/api/quote-requests/{quote_request_id}/graph-image", include_in_schema=False)
async def proxy_quote_request_graph_image(quote_request_id: int, request: Request):
    try:
        payload = await request.json()
    except (TypeError, ValueError):
        return JSONResponse(status_code=400, content={"detail": "Graph image request must contain valid JSON."})
    try:
        async with httpx.AsyncClient(timeout=settings.quote_request_timeout_seconds) as client:
            response = await client.post(
                f"{settings.backend_api_base_url}/api/quote-requests/{quote_request_id}/graph-image",
                json=payload,
                headers={"Accept": "application/json"},
            )
    except httpx.HTTPError:
        logger.exception("Unable to forward enquiry graph image to the backend")
        return JSONResponse(status_code=502, content={"detail": "We could not save the graph image."})
    try:
        response_payload = response.json()
    except ValueError:
        response_payload = {"detail": "The enquiry service returned an invalid response."}
    return JSONResponse(status_code=response.status_code, content=response_payload)

app.include_router(pages.router)
app.include_router(finder.router)
app.include_router(telemetry.router)
app.include_router(media.router)


@app.middleware("http")
async def prevent_html_caching(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; "
        "frame-src 'self' https://www.google.com https://maps.google.com; "
        f"frame-ancestors {FRAME_ANCESTORS}; base-uri 'self'; form-action 'self'",
    )
    content_type = response.headers.get("content-type", "")
    if content_type.startswith("text/html"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response


@app.on_event("startup")
async def startup():
    logger.info("Security configuration: customer-facing CSP frame-ancestors=%s", FRAME_ANCESTORS)
    logger.info(
        "Customer-facing CSP configuration source: %s",
        "FRAME_ANCESTORS" if FRAME_ANCESTORS_EXPLICIT else "development defaults",
    )
    if not FRAME_ANCESTORS_EXPLICIT:
        logger.warning(
            "CSP framing is using development defaults. Add FRAME_ANCESTORS='https://framing-host.example' "
            "to %s, then restart the application.",
            SECURITY_CONFIGURATION_FILE,
        )
    await catalogue_cache.initialize()


@app.on_event("shutdown")
async def shutdown():
    await catalogue_cache.shutdown()


@app.exception_handler(404)
async def not_found(request: Request, exc):
    product_types = catalogue_cache.product_types()
    if not product_types:
        try:
            product_types = await api.product_types()
        except Exception:
            product_types = []

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
            "enquiry_cms": {},
            "site_navigation": [],
        },
        status_code=404,
    )
