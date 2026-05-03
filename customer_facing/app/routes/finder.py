from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse

from app.catalogue_cache import catalogue_cache
from app.catalogue_data import ParameterFilterError
from app.view_templates import templates

router = APIRouter()


@router.get("/finder/results", response_class=HTMLResponse)
async def finder_results(
    request: Request,
    product_type_key: str = "",
    search: str = "",
    series_id: str = "",
    parameter_filters: str = "",
):
    try:
        result = catalogue_cache.finder_results(
            product_type_key=product_type_key,
            search=search,
            series_id=series_id or None,
            parameter_filters=parameter_filters or "",
        )
    except ParameterFilterError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return templates.TemplateResponse(
        request,
        "partials/product_results.html",
        {
            "request": request,
            "series": result["series"],
            "products": result["products"],
        },
    )


@router.get("/finder/metadata", response_class=JSONResponse)
async def finder_metadata(
    product_type_key: str = "",
    search: str = "",
    series_id: str = "",
    parameter_filters: str = "",
):
    try:
        metadata = catalogue_cache.finder_metadata(
            product_type_key=product_type_key,
            search=search,
            series_id=series_id or None,
            parameter_filters=parameter_filters or "",
        )
    except ParameterFilterError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return JSONResponse(metadata)
