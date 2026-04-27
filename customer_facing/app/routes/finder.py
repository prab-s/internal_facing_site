import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse

from app.api_client import api
from app.view_templates import templates

router = APIRouter()
GRAPH_FILTER_GROUP_NAME = "__graph__"


def coerce_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def collect_graph_values(product: dict) -> dict[str, set[float]]:
    rpm_values: set[float] = set()
    airflow_values: set[float] = set()
    pressure_values: set[float] = set()

    for rpm_line in product.get("rpm_lines", []) or []:
        rpm = rpm_line.get("rpm")
        if rpm is not None:
            rpm_values.add(float(rpm))
        for point in rpm_line.get("points", []) or []:
            airflow = point.get("airflow")
            pressure = point.get("pressure")
            if airflow is not None:
                airflow_values.add(float(airflow))
            if pressure is not None:
                pressure_values.add(float(pressure))

    for point in product.get("efficiency_points", []) or []:
        airflow = point.get("airflow")
        if airflow is not None:
            airflow_values.add(float(airflow))

    return {
        "rpm": rpm_values,
        "airflow": airflow_values,
        "pressure": pressure_values,
    }


def collect_graph_values_from_products(products: list[dict]) -> dict[str, set[float]]:
    graph_values = {
        "rpm": set(),
        "airflow": set(),
        "pressure": set(),
    }
    for product in products:
        product_graph_values = collect_graph_values(product)
        for field_name, values in product_graph_values.items():
            graph_values[field_name].update(values)
    return graph_values


def collect_graph_values_from_product_type(product_type: dict) -> dict[str, set[float]]:
    rpm_values: set[float] = set()
    airflow_values: set[float] = set()
    pressure_values: set[float] = set()

    for rpm_line in product_type.get("rpm_line_presets", []) or []:
        rpm = coerce_float(rpm_line.get("rpm"))
        if rpm is not None:
            rpm_values.add(rpm)
        for point in rpm_line.get("point_presets", []) or []:
            airflow = coerce_float(point.get("airflow"))
            pressure = coerce_float(point.get("pressure"))
            if airflow is not None:
                airflow_values.add(airflow)
            if pressure is not None:
                pressure_values.add(pressure)

    for point in product_type.get("efficiency_point_presets", []) or []:
        airflow = coerce_float(point.get("airflow"))
        if airflow is not None:
            airflow_values.add(airflow)

    return {
        "rpm": rpm_values,
        "airflow": airflow_values,
        "pressure": pressure_values,
    }


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

    products_task = api.products(**product_query)
    graph_values_task = api.product_graph_values(**product_query)
    products, graph_values_payload = await asyncio.gather(products_task, graph_values_task, return_exceptions=True)

    if isinstance(products, Exception):
        raise products
    if isinstance(graph_values_payload, Exception):
        graph_values_payload = None

    values_by_key: dict[tuple[str, str], dict] = {}
    series_values: dict[str, dict] = {}
    group_order: dict[str, int] = {}
    graph_group_values = {
        "rpm": {
            "parameter_name": "RPM",
            "sort_order": 0,
            "unit": selected_type.get("graph_line_value_unit") or "RPM",
            "numeric_values": set(),
        },
        "airflow": {
            "parameter_name": "Airflow",
            "sort_order": 1,
            "unit": selected_type.get("graph_x_axis_unit") or "L/s",
            "numeric_values": set(),
        },
        "pressure": {
            "parameter_name": "Pressure",
            "sort_order": 2,
            "unit": selected_type.get("graph_y_axis_unit") or "Pa",
            "numeric_values": set(),
        },
    }
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
                numeric_value = coerce_float(parameter.get("value_number"))
                if numeric_value is None:
                    numeric_value = coerce_float(parameter.get("value_string"))
                if numeric_value is not None:
                    entry["numeric_values"].add(numeric_value)
                if not entry["unit"] and parameter.get("unit"):
                    entry["unit"] = str(parameter.get("unit")).strip()

    fallback_graph_values = collect_graph_values_from_products(products)
    for field_name, field_values in fallback_graph_values.items():
        graph_group_values[field_name]["numeric_values"].update(field_values)

    type_graph_values = collect_graph_values_from_product_type(selected_type)
    for field_name, field_values in type_graph_values.items():
        if not graph_group_values[field_name]["numeric_values"]:
            graph_group_values[field_name]["numeric_values"].update(field_values)

    if isinstance(graph_values_payload, dict):
        graph_values_section = graph_values_payload.get("graph_values", graph_values_payload)
        for field_name, field_values in (graph_values_section or {}).items():
            if field_name in graph_group_values:
                graph_group_values[field_name]["numeric_values"].update(
                    float(value) for value in (field_values or []) if value is not None
                )

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

        range_min = numeric_values[0] if numeric_values else None
        range_max = numeric_values[-1] if numeric_values else None
        group["parameters"][parameter_key] = {
            "parameter_name": parameter_name,
            "sort_order": values_entry["sort_order"],
            "kind": kind,
            "unit": values_entry.get("unit"),
            "string_values": string_values,
            "numeric_values": numeric_values,
            "range_min": range_min,
            "range_max": range_max,
        }

    groups = []
    for group in groups_map.values():
        groups.append({
            "group_name": group["group_name"],
            "sort_order": group["sort_order"],
            "parameters": sorted(group["parameters"].values(), key=lambda item: item["sort_order"]),
        })

    graph_group = {
        "group_name": GRAPH_FILTER_GROUP_NAME,
        "sort_order": len(groups) + 1000,
        "parameters": [
            {
                "parameter_name": field["parameter_name"],
                "sort_order": field["sort_order"],
                "kind": "range",
                "unit": field["unit"],
                "string_values": [],
                "numeric_values": sorted(field["numeric_values"]),
                "range_min": min(field["numeric_values"]) if field["numeric_values"] else None,
                "range_max": max(field["numeric_values"]) if field["numeric_values"] else None,
            }
            for field in graph_group_values.values()
        ],
    }
    groups.append(graph_group)

    return JSONResponse({
        "product_type_key": product_type_key,
        "series": sorted(series_values.values(), key=lambda item: item["name"].casefold()),
        "groups": sorted(groups, key=lambda item: item["sort_order"]),
    })
