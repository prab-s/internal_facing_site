import json
import logging

from app.config import settings


GRAPH_FILTER_GROUP_NAME = "__graph__"
logger = logging.getLogger(__name__)


class ParameterFilterError(ValueError):
    pass


def trace_finder_filter(message: str, *args):
    if settings.finder_debug:
        logger.warning(message, *args)


def coerce_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_parameter_filters(raw_filters: str | None) -> list[dict]:
    if not raw_filters:
        return []

    try:
        decoded = json.loads(raw_filters)
    except json.JSONDecodeError as exc:
        raise ParameterFilterError(f"Invalid parameter_filters JSON: {exc.msg}") from exc

    if not isinstance(decoded, list):
        raise ParameterFilterError("parameter_filters must be a JSON array")

    normalized_filters: list[dict] = []
    for item in decoded:
        if not isinstance(item, dict):
            raise ParameterFilterError("Each parameter filter must be an object")

        group_name = str(item.get("group_name", "")).strip()
        parameter_name = str(item.get("parameter_name", "")).strip()
        value_string = item.get("value_string")
        min_number = item.get("min_number")
        max_number = item.get("max_number")

        if not group_name or not parameter_name:
            raise ParameterFilterError("Each parameter filter must include group_name and parameter_name")

        try:
            normalized = {
                "group_name": group_name,
                "parameter_name": parameter_name,
                "value_string": str(value_string).strip() if value_string not in {None, ""} else None,
                "min_number": float(min_number) if min_number not in {None, ""} else None,
                "max_number": float(max_number) if max_number not in {None, ""} else None,
            }
        except (TypeError, ValueError) as exc:
            raise ParameterFilterError("parameter_filters numeric bounds must be valid numbers") from exc

        if normalized["value_string"] is None and normalized["min_number"] is None and normalized["max_number"] is None:
            raise ParameterFilterError("Each parameter filter must include value_string or at least one numeric bound")

        if (
            normalized["min_number"] is not None
            and normalized["max_number"] is not None
            and normalized["min_number"] > normalized["max_number"]
        ):
            raise ParameterFilterError("parameter_filters numeric min cannot be greater than max")

        normalized_filters.append(normalized)

    return normalized_filters


def graph_filter_values(product: dict) -> dict[str, list[float]]:
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
        "rpm": sorted(rpm_values),
        "airflow": sorted(airflow_values),
        "pressure": sorted(pressure_values),
    }


def graph_filter_values_for_products(products: list[dict]) -> dict[str, list[float]]:
    rpm_values: set[float] = set()
    airflow_values: set[float] = set()
    pressure_values: set[float] = set()

    for product in products:
        graph_values = graph_filter_values(product)
        rpm_values.update(graph_values["rpm"])
        airflow_values.update(graph_values["airflow"])
        pressure_values.update(graph_values["pressure"])

    return {
        "rpm": sorted(rpm_values),
        "airflow": sorted(airflow_values),
        "pressure": sorted(pressure_values),
    }


def graph_filter_values_from_product_type(product_type: dict) -> dict[str, list[float]]:
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
        "rpm": sorted(rpm_values),
        "airflow": sorted(airflow_values),
        "pressure": sorted(pressure_values),
    }


def value_in_window(value: float, minimum: float | None, maximum: float | None) -> bool:
    if minimum is not None and value < minimum:
        return False
    if maximum is not None and value > maximum:
        return False
    return True


def product_matches_parameter_filters(product: dict, parameter_filters: list[dict]) -> bool:
    if not parameter_filters:
        return True

    product_label = f"{product.get('model') or 'unknown model'} (id={product.get('id')})"
    grouped_parameters: dict[tuple[str, str], list[dict]] = {}
    for group in product.get("parameter_groups", []) or []:
        group_name = (group.get("group_name") or "").strip().casefold()
        for parameter in group.get("parameters", []) or []:
            parameter_name = (parameter.get("parameter_name") or "").strip().casefold()
            grouped_parameters.setdefault((group_name, parameter_name), []).append(parameter)

    graph_values = graph_filter_values(product)

    for filter_item in parameter_filters:
        filter_key = (
            filter_item["group_name"].strip().casefold(),
            filter_item["parameter_name"].strip().casefold(),
        )
        if filter_key[0] == GRAPH_FILTER_GROUP_NAME:
            min_number = filter_item.get("min_number")
            max_number = filter_item.get("max_number")
            graph_metric_values = graph_values.get(filter_key[1], [])
            trace_finder_filter(
                "finder trace: product=%s graph_filter=%s min=%s max=%s values=%s",
                product_label,
                filter_key[1],
                min_number,
                max_number,
                graph_metric_values,
            )
            if not graph_metric_values:
                trace_finder_filter(
                    "finder trace result: product=%s graph_filter=%s matched=False reason=no_graph_values",
                    product_label,
                    filter_key[1],
                )
                return False
            graph_matches = [value_in_window(metric_value, min_number, max_number) for metric_value in graph_metric_values]
            trace_finder_filter(
                "finder trace compare: product=%s graph_filter=%s comparisons=%s mode=all",
                product_label,
                filter_key[1],
                graph_matches,
            )
            if not all(graph_matches):
                trace_finder_filter(
                    "finder trace result: product=%s graph_filter=%s matched=False reason=graph_value_out_of_window",
                    product_label,
                    filter_key[1],
                )
                return False
            continue

        matching_parameters = grouped_parameters.get(filter_key, [])
        trace_finder_filter(
            "finder trace: product=%s spec_filter=%s.%s candidates=%s",
            product_label,
            filter_key[0],
            filter_key[1],
            len(matching_parameters),
        )
        if not matching_parameters:
            trace_finder_filter(
                "finder trace result: product=%s spec_filter=%s.%s matched=False reason=no_matching_parameters",
                product_label,
                filter_key[0],
                filter_key[1],
            )
            return False

        value_string = filter_item.get("value_string")
        min_number = filter_item.get("min_number")
        max_number = filter_item.get("max_number")

        matched = False
        for parameter in matching_parameters:
            if value_string is not None:
                if (parameter.get("value_string") or "").strip().casefold() == value_string.casefold():
                    matched = True
                    break
                continue

            value_number = parameter.get("value_number")
            if value_number is None:
                continue

            if value_in_window(float(value_number), min_number, max_number):
                matched = True
                break

        if not matched:
            trace_finder_filter(
                "finder trace result: product=%s spec_filter=%s.%s matched=False reason=no_parameter_match value_string=%s min=%s max=%s",
                product_label,
                filter_key[0],
                filter_key[1],
                value_string,
                min_number,
                max_number,
            )
            return False

        trace_finder_filter(
            "finder trace result: product=%s spec_filter=%s.%s matched=True value_string=%s min=%s max=%s",
            product_label,
            filter_key[0],
            filter_key[1],
            value_string,
            min_number,
            max_number,
        )

    return True


def filter_products(
    products: list[dict],
    *,
    product_type_key: str = "",
    search: str = "",
    series_id: str | int | None = None,
    parameter_filters: list[dict] | None = None,
) -> list[dict]:
    normalized_type_key = str(product_type_key or "").strip()
    normalized_search = str(search or "").strip().casefold()
    normalized_series_id = str(series_id).strip() if series_id not in (None, "") else ""
    normalized_filters = parameter_filters or []

    filtered_products: list[dict] = []
    for product in products:
        if normalized_type_key and (product.get("product_type_key") or "") != normalized_type_key:
            continue
        if normalized_search and normalized_search not in str(product.get("model") or "").casefold():
            continue
        if normalized_series_id and str(product.get("series_id") or "").strip() != normalized_series_id:
            continue
        if not product_matches_parameter_filters(product, normalized_filters):
            continue
        filtered_products.append(product)

    trace_finder_filter(
        "finder trace filter_products: type=%s series=%s search=%s filters=%s matched=%d",
        normalized_type_key or "*",
        normalized_series_id or "*",
        normalized_search or "*",
        normalized_filters,
        len(filtered_products),
    )
    return sorted(filtered_products, key=lambda item: str(item.get("model") or "").casefold())


def build_series_summary_from_products(products: list[dict]) -> list[dict]:
    series_map: dict[str, dict] = {}
    for product in products:
        series_key = product.get("series_id")
        if series_key is None:
            continue
        series_key_text = str(series_key)
        series_entry = series_map.setdefault(
            series_key_text,
            {
                "id": series_key,
                "name": product.get("series_name") or "Series",
                "product_type_label": product.get("product_type_label"),
                "product_count": 0,
            },
        )
        series_entry["product_count"] += 1

    return sorted(series_map.values(), key=lambda item: str(item.get("name") or "").casefold())


def build_finder_metadata(selected_type: dict, products: list[dict], product_type_key: str) -> dict:
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

    fallback_graph_values = graph_filter_values_for_products(products)
    for field_name, field_values in fallback_graph_values.items():
        graph_group_values[field_name]["numeric_values"].update(field_values)

    type_graph_values = graph_filter_values_from_product_type(selected_type)
    for field_name, field_values in type_graph_values.items():
        if not graph_group_values[field_name]["numeric_values"]:
            graph_group_values[field_name]["numeric_values"].update(field_values)

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
        groups.append(
            {
                "group_name": group["group_name"],
                "sort_order": group["sort_order"],
                "parameters": sorted(group["parameters"].values(), key=lambda item: item["sort_order"]),
            }
        )

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

    return {
        "product_type_key": product_type_key,
        "series": sorted(series_values.values(), key=lambda item: str(item.get("name") or "").casefold()),
        "groups": sorted(groups, key=lambda item: item["sort_order"]),
    }
