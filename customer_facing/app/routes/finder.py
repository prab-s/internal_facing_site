from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse

from app.api_client import api
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
    products = await api.products(
        search=search,
        product_type_key=product_type_key,
        series_id=series_id or None,
        parameter_filters=parameter_filters or None,
    )

    series_map = {}
    for product in products:
        series_key = product.get("series_id")
        if series_key is None:
            continue
        series_entry = series_map.setdefault(
            series_key,
            {
                "id": series_key,
                "name": product.get("series_name") or "Series",
                "product_type_label": product.get("product_type_label"),
                "product_count": 0,
            },
        )
        series_entry["product_count"] += 1

    series = sorted(series_map.values(), key=lambda item: item["name"].casefold())

    return templates.TemplateResponse(
        request,
        "partials/product_results.html",
        {
            "request": request,
            "series": series,
            "products": products,
        },
    )


@router.get("/finder/metadata", response_class=JSONResponse)
async def finder_metadata(
    product_type_key: str = "",
    search: str = "",
    series_id: str = "",
    parameter_filters: str = "",
):
    if not product_type_key:
        return JSONResponse({"series": [], "groups": []})

    product_types = await api.product_types()
    selected_type = next((item for item in product_types if item.get("key") == product_type_key), None)
    if not selected_type:
        return JSONResponse({"series": [], "groups": []})

    product_query = {
        "product_type_key": product_type_key,
        "search": search,
        "parameter_filters": parameter_filters or None,
    }
    if series_id:
        product_query["series_id"] = series_id

    products = await api.products(**product_query)

    values_by_key: dict[tuple[str, str], dict] = {}
    series_values: dict[str, dict] = {}
    group_order: dict[str, int] = {}
    for product in products:
        if product.get("series_id") is not None:
            series_key = str(product.get("series_id"))
            if series_key not in series_values:
                series_values[series_key] = {
                    "id": product.get("series_id"),
                    "name": product.get("series_name") or "Series",
                    "product_count": 0,
                }
            series_values[series_key]["product_count"] += 1

        for group in product.get("parameter_groups", []) or []:
            group_name = str(group.get("group_name", "")).strip()
            if not group_name:
                continue
            group_key = group_name.casefold()
            if group_key not in group_order:
                group_order[group_key] = len(group_order)
            for parameter in group.get("parameters", []) or []:
                parameter_name = str(parameter.get("parameter_name", "")).strip()
                if not parameter_name:
                    continue

                key = (group_name.casefold(), parameter_name.casefold())
                entry = values_by_key.setdefault(
                    key,
                    {
                        "group_name": group_name,
                        "parameter_name": parameter_name,
                        "sort_order": parameter.get("sort_order", 0),
                        "string_values": set(),
                        "numeric_values": set(),
                        "unit": None,
                    },
                )

                if parameter.get("value_string") not in (None, ""):
                    entry["string_values"].add(str(parameter.get("value_string")).strip())
                if parameter.get("value_number") is not None:
                    entry["numeric_values"].add(float(parameter.get("value_number")))
                if not entry["unit"] and parameter.get("unit"):
                    entry["unit"] = str(parameter.get("unit")).strip()

    groups_map: dict[str, dict] = {}
    for (group_key, parameter_key), values_entry in values_by_key.items():
        group_name = values_entry["group_name"]
        group = groups_map.setdefault(
            group_key,
            {
                "group_name": group_name,
                "sort_order": group_order.get(group_key, len(group_order)),
                "parameters": {},
            },
        )
        parameter_name = values_entry["parameter_name"]
        string_values = sorted(values_entry["string_values"])
        numeric_values = sorted(values_entry["numeric_values"])

        if string_values:
            kind = "select"
        elif numeric_values:
            kind = "range"
        else:
            kind = "select"

        group["parameters"][parameter_key] = {
            "parameter_name": parameter_name,
            "sort_order": values_entry["sort_order"],
            "kind": kind,
            "unit": values_entry.get("unit"),
            "string_values": string_values,
            "numeric_values": numeric_values,
        }

    groups = []
    for group in groups_map.values():
        groups.append({
            "group_name": group["group_name"],
            "sort_order": group["sort_order"],
            "parameters": sorted(group["parameters"].values(), key=lambda item: item["sort_order"]),
        })

    return JSONResponse({
        "product_type_key": product_type_key,
        "series": sorted(series_values.values(), key=lambda item: item["name"].casefold()),
        "groups": sorted(groups, key=lambda item: item["sort_order"]),
    })
