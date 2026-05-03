#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Creating Vent-tech catalogue public site in: $ROOT_DIR"

mkdir -p "$ROOT_DIR/app/routes"
mkdir -p "$ROOT_DIR/app/templates/partials"
mkdir -p "$ROOT_DIR/app/templates/errors"
mkdir -p "$ROOT_DIR/app/static/css"
mkdir -p "$ROOT_DIR/app/static/js"

touch "$ROOT_DIR/app/__init__.py"
touch "$ROOT_DIR/app/routes/__init__.py"

cat > "$ROOT_DIR/requirements.txt" <<'EOF'
fastapi
uvicorn
jinja2
httpx
python-dotenv
python-multipart
EOF

cat > "$ROOT_DIR/vent-tech-catalogue.env.example" <<'EOF'
BACKEND_API_BASE_URL=https://p2.bitrep.nz
PUBLIC_SITE_URL=http://0.0.0.0:8004
SITE_NAME=Vent-tech catalogue
REQUEST_TIMEOUT_SECONDS=10
CATALOGUE_CACHE_PATH=/tmp/vent-tech-catalogue-cache.json
CATALOGUE_REFRESH_INTERVAL_SECONDS=300
EOF

cat > "$ROOT_DIR/.env" <<'EOF'
BACKEND_API_BASE_URL=https://p2.bitrep.nz
PUBLIC_SITE_URL=http://0.0.0.0:8004
SITE_NAME=Vent-tech catalogue
REQUEST_TIMEOUT_SECONDS=10
CATALOGUE_CACHE_PATH=/tmp/vent-tech-catalogue-cache.json
CATALOGUE_REFRESH_INTERVAL_SECONDS=300
EOF

cat > "$ROOT_DIR/app/config.py" <<'EOF'
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    backend_api_base_url = os.getenv("BACKEND_API_BASE_URL", "https://p2.bitrep.nz").rstrip("/")
    public_site_url = os.getenv("PUBLIC_SITE_URL", "http://localhost:8004").rstrip("/")
    site_name = os.getenv("SITE_NAME", "Vent-tech catalogue")
    request_timeout_seconds = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "10"))
    catalogue_cache_path = os.getenv("CATALOGUE_CACHE_PATH", "/tmp/vent-tech-catalogue-cache.json")
    catalogue_refresh_interval_seconds = float(os.getenv("CATALOGUE_REFRESH_INTERVAL_SECONDS", "300"))


settings = Settings()
EOF

cat > "$ROOT_DIR/app/slug.py" <<'EOF'
import re


def slugify(value):
    value = str(value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def product_url(product):
    return f"/products/{product['id']}-{slugify(product.get('model'))}"


def series_url(series):
    return f"/series/{series['id']}-{slugify(series.get('name'))}"


def product_type_url(product_type):
    return f"/products/type/{product_type['key']}"
EOF

cat > "$ROOT_DIR/app/seo.py" <<'EOF'
from app.config import settings


def seo_meta(title, description="", path="/"):
    canonical = f"{settings.public_site_url}{path}"

    return {
        "title": f"{title} | {settings.site_name}",
        "description": description or settings.site_name,
        "canonical": canonical,
    }
EOF

cat > "$ROOT_DIR/app/api_client.py" <<'EOF'
import json
import httpx
from app.config import settings


class CatalogueApi:
    def __init__(self):
        self.base_url = settings.backend_api_base_url
        self.timeout = settings.request_timeout_seconds

    async def _get(self, path, params=None):
        url = f"{self.base_url}{path}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()

    async def product_types(self):
        return await self._get("/api/cms/product-types")

    async def products(self, **filters):
        params = {k: v for k, v in filters.items() if v not in (None, "")}

        if isinstance(params.get("parameter_filters"), dict):
            params["parameter_filters"] = json.dumps(params["parameter_filters"])

        return await self._get("/api/cms/products", params=params)

    async def product(self, product_id):
        return await self._get(f"/api/cms/products/{product_id}")

    async def series_list(self, product_type_key=None):
        params = {"product_type_key": product_type_key} if product_type_key else None
        return await self._get("/api/cms/series", params=params)

    async def series(self, series_id):
        return await self._get(f"/api/cms/series/{series_id}")

    def media_url(self, relative_url):
        if not relative_url:
            return None

        if relative_url.startswith("http://") or relative_url.startswith("https://"):
            return relative_url

        return f"{self.base_url}{relative_url}"


api = CatalogueApi()
EOF

cat > "$ROOT_DIR/app/main.py" <<'EOF'
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.routes import pages, finder
from app.slug import product_url, series_url, product_type_url
from app.api_client import api

app = FastAPI(title="Vent-tech catalogue")

app.mount("/static", StaticFiles(directory="app/static"), name="static")

templates = Jinja2Templates(directory="app/templates")
templates.env.globals["product_url"] = product_url
templates.env.globals["series_url"] = series_url
templates.env.globals["product_type_url"] = product_type_url
templates.env.globals["media_url"] = api.media_url

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
EOF

cat > "$ROOT_DIR/app/routes/pages.py" <<'EOF'
from fastapi import APIRouter, Request, HTTPException
from fastapi.templating import Jinja2Templates

from app.api_client import api
from app.seo import seo_meta

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")


async def common_context():
    product_types = await api.product_types()
    return {"product_types": product_types}


@router.get("/")
async def homepage(request: Request):
    products = await api.products()
    series = await api.series_list()

    context = await common_context()
    context.update({
        "request": request,
        "seo": seo_meta(
            "Product Finder",
            "Find suitable industrial products by product type, mounting style, discharge type, and specification range.",
            "/",
        ),
        "products": products,
        "series": series,
    })

    return templates.TemplateResponse("index.html", context)


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

    return templates.TemplateResponse("product_type.html", context)


@router.get("/series/{series_slug}")
async def series_page(request: Request, series_slug: str):
    series_id = int(series_slug.split("-")[0])
    series = await api.series(series_id)

    context = await common_context()
    context.update({
        "request": request,
        "seo": seo_meta(
            series["name"],
            f"View product information, specifications, graphs, PDFs, and models for {series['name']}.",
            f"/series/{series_slug}",
        ),
        "series": series,
    })

    return templates.TemplateResponse("series.html", context)


@router.get("/products/{product_slug}")
async def product_page(request: Request, product_slug: str):
    product_id = int(product_slug.split("-")[0])
    product = await api.product(product_id)

    context = await common_context()
    context.update({
        "request": request,
        "seo": seo_meta(
            product["model"],
            f"View specifications, graphs, images, and PDFs for {product['model']}.",
            f"/products/{product_slug}",
        ),
        "product": product,
    })

    return templates.TemplateResponse("product.html", context)
EOF

cat > "$ROOT_DIR/app/routes/finder.py" <<'EOF'
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
        rpm = coerce_float(rpm_line.get("rpm"))
        if rpm is not None:
            rpm_values.add(rpm)
        for point in rpm_line.get("points", []) or []:
            airflow = coerce_float(point.get("airflow"))
            pressure = coerce_float(point.get("pressure"))
            if airflow is not None:
                airflow_values.add(airflow)
            if pressure is not None:
                pressure_values.add(pressure)

    for point in product.get("efficiency_points", []) or []:
        airflow = coerce_float(point.get("airflow"))
        if airflow is not None:
            airflow_values.add(airflow)

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
EOF

cat > "$ROOT_DIR/app/templates/base.html" <<'EOF'
<!doctype html>
<html lang="en-NZ">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ seo.title }}</title>
  <meta name="description" content="{{ seo.description }}">
  <link rel="canonical" href="{{ seo.canonical }}">

  <link
    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
    rel="stylesheet"
  >

  <link rel="stylesheet" href="{{ url_for('static', path='css/site.css') }}">
</head>

<body>
  {% include "partials/nav.html" %}

  <main class="container py-4">
    {% block content %}{% endblock %}
  </main>

  <footer class="border-top mt-5 py-4 bg-white">
    <div class="container small text-muted">
      Vent-tech catalogue · Product data, graphs, PDFs, and images are supplied by the catalogue API.
    </div>
  </footer>

  <script src="{{ url_for('static', path='js/finder.js') }}?v=20260427"></script>
</body>
</html>
EOF

cat > "$ROOT_DIR/app/templates/partials/nav.html" <<'EOF'
<nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
  <div class="container">
    <a class="navbar-brand fw-semibold" href="/">Vent-tech catalogue</a>

    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div id="mainNav" class="collapse navbar-collapse">
      <ul class="navbar-nav ms-auto">
        {% for type in product_types %}
          <li class="nav-item">
            <a class="nav-link" href="{{ product_type_url(type) }}">
              {{ type.label }}
            </a>
          </li>
        {% endfor %}
      </ul>
    </div>
  </div>
</nav>
EOF

cat > "$ROOT_DIR/app/templates/index.html" <<'EOF'
{% extends "base.html" %}

{% block content %}

<div class="mb-4">
  <h1 class="h2 mb-2">Product Finder</h1>
  <p class="text-muted mb-0">
    Filter the catalogue by product type and key engineering parameters.
  </p>
</div>

<div class="row g-4">
  <aside class="col-lg-3">
    <form id="finder-form" class="card shadow-sm border-0">
      <div class="card-body">
        <h2 class="h5 mb-3">Filter products</h2>

        <label class="form-label">Product type</label>
        <select class="form-select mb-3" name="product_type_key">
          <option value="">All product types</option>
          {% for type in product_types %}
            <option value="{{ type.key }}">{{ type.label }}</option>
          {% endfor %}
        </select>

        <label class="form-label">Mounting style</label>
        <select class="form-select mb-3" name="mounting_style">
          <option value="">Any</option>
          <option value="Wall mounted">Wall mounted</option>
          <option value="Ceiling mounted">Ceiling mounted</option>
          <option value="Inline">Inline</option>
        </select>

        <label class="form-label">Discharge type</label>
        <select class="form-select mb-3" name="discharge_type">
          <option value="">Any</option>
          <option value="Vertical">Vertical</option>
          <option value="Horizontal">Horizontal</option>
        </select>

        <label class="form-label">Search</label>
        <input class="form-control" name="search" placeholder="Model or keyword">
      </div>
    </form>
  </aside>

  <section class="col-lg-9">
    <div id="finder-results">
      {% include "partials/product_results.html" %}
    </div>
  </section>
</div>

{% endblock %}
EOF

cat > "$ROOT_DIR/app/templates/product_type.html" <<'EOF'
{% extends "base.html" %}

{% block content %}

<div class="mb-4">
  <h1 class="h2">{{ selected_type.label }}</h1>
  <p class="text-muted">Browse available series and products for this category.</p>
</div>

{% if selected_type.series_names %}
<div class="card shadow-sm border-0 mb-4">
  <div class="card-body">
    <h2 class="h5 mb-3">Series names</h2>
    <div class="d-flex flex-wrap gap-2">
      {% for series_name in selected_type.series_names %}
        <span class="badge text-bg-light border">{{ series_name }}</span>
      {% endfor %}
    </div>
  </div>
</div>
{% endif %}

<h2 class="h4 mb-3">Series</h2>

<div class="row g-3 mb-5">
  {% for series in series %}
    <div class="col-md-6 col-xl-4">
      {% include "partials/series_card.html" %}
    </div>
  {% else %}
    <p class="text-muted">No series found for this product type.</p>
  {% endfor %}
</div>

<h2 class="h4 mb-3">Products</h2>

<div class="row g-3">
  {% for product in products %}
    <div class="col-md-6 col-xl-4">
      {% include "partials/product_card.html" %}
    </div>
  {% endfor %}
</div>

{% endblock %}
EOF

cat > "$ROOT_DIR/app/templates/series.html" <<'EOF'
{% extends "base.html" %}

{% block content %}

<div class="row g-4">
  <div class="col-lg-8">
    <h1 class="h2">{{ series.name }}</h1>
    <p class="text-muted">{{ series.product_type_label }}</p>

    {% if series.description1_html %}
      <div class="content-block">
        {{ series.description1_html | safe }}
      </div>
    {% endif %}

    {% if series.series_graph_image_url %}
      <div class="card my-4">
        <div class="card-header fw-semibold">Performance graph</div>
        <div class="card-body">
          <img class="img-fluid" src="{{ media_url(series.series_graph_image_url) }}" alt="{{ series.name }} graph">
        </div>
      </div>
    {% endif %}

    <h2 class="h4 mt-4">Products in this series</h2>

    <div class="row g-3">
      {% for product in series.products %}
        <div class="col-md-6">
          {% include "partials/product_card.html" %}
        </div>
      {% endfor %}
    </div>
  </div>

  <aside class="col-lg-4">
    {% include "partials/pdf_panel.html" %}
  </aside>
</div>

{% endblock %}
EOF

cat > "$ROOT_DIR/app/templates/product.html" <<'EOF'
{% extends "base.html" %}

{% block content %}

<div class="row g-4">
  <div class="col-lg-8">
    <h1 class="h2">{{ product.model }}</h1>

    <p class="text-muted">
      {{ product.product_type_label }}
      {% if product.series_name %}
        · {{ product.series_name }}
      {% endif %}
    </p>

    {% if product.primary_product_image_url %}
      <img
        class="img-fluid rounded border mb-4 product-main-image"
        src="{{ media_url(product.primary_product_image_url) }}"
        alt="{{ product.model }}"
      >
    {% endif %}

    {% if product.description1_html %}
      <div class="content-block mb-4">
        {{ product.description1_html | safe }}
      </div>
    {% endif %}

    {% if product.graph_image_url %}
      <div class="card my-4">
        <div class="card-header fw-semibold">Performance graph</div>
        <div class="card-body">
          <img class="img-fluid" src="{{ media_url(product.graph_image_url) }}" alt="{{ product.model }} graph">
        </div>
      </div>
    {% endif %}

    <h2 class="h4 mt-4">Specifications</h2>
    {% include "partials/specs_table.html" %}
  </div>

  <aside class="col-lg-4">
    {% include "partials/pdf_panel.html" %}
  </aside>
</div>

{% endblock %}
EOF

cat > "$ROOT_DIR/app/templates/partials/product_results.html" <<'EOF'
<div class="mb-3 fw-semibold">
  {{ products|length }} products match
</div>

<div class="row g-3">
  {% for product in products %}
    <div class="col-md-6 col-xl-4">
      {% include "partials/product_card.html" %}
    </div>
  {% else %}
    <div class="col-12">
      <div class="alert alert-light border">
        No products match these filters.
      </div>
    </div>
  {% endfor %}
</div>
EOF

cat > "$ROOT_DIR/app/templates/partials/product_card.html" <<'EOF'
<div class="card h-100 shadow-sm border-0 product-card">
  {% if product.primary_product_image_url %}
    <img
      src="{{ media_url(product.primary_product_image_url) }}"
      class="card-img-top product-card-image"
      alt="{{ product.model }}"
    >
  {% endif %}

  <div class="card-body">
    <h3 class="h5 card-title">
      <a class="stretched-link text-decoration-none" href="{{ product_url(product) }}">
        {{ product.model }}
      </a>
    </h3>

    <p class="text-muted small mb-2">
      {{ product.product_type_label }}
      {% if product.series_name %} · {{ product.series_name }}{% endif %}
    </p>

    {% if product.product_pdf_url %}
      <span class="badge text-bg-light border">PDF available</span>
    {% endif %}
  </div>
</div>
EOF

cat > "$ROOT_DIR/app/templates/partials/series_card.html" <<'EOF'
<div class="card h-100 shadow-sm border-0">
  <div class="card-body">
    <h3 class="h5">
      <a class="stretched-link text-decoration-none" href="{{ series_url(series) }}">
        {{ series.name }}
      </a>
    </h3>

    <p class="text-muted small mb-2">
      {{ series.product_type_label }}
    </p>

    <p class="small mb-0">
      {{ series.product_count }} products
    </p>
  </div>
</div>
EOF

cat > "$ROOT_DIR/app/templates/partials/specs_table.html" <<'EOF'
{% for group in product.parameter_groups %}
  <div class="card mb-3">
    <div class="card-header fw-semibold">
      {{ group.group_name }}
    </div>

    <div class="table-responsive">
      <table class="table table-sm mb-0">
        <tbody>
          {% for param in group.parameters %}
            <tr>
              <th class="w-50">{{ param.parameter_name }}</th>
              <td>
                {% if param.value_string %}
                  {{ param.value_string }}
                {% elif param.value_number is not none %}
                  {{ param.value_number }}
                {% endif %}

                {% if param.unit %}
                  {{ param.unit }}
                {% endif %}
              </td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
  </div>
{% endfor %}
EOF

cat > "$ROOT_DIR/app/templates/partials/pdf_panel.html" <<'EOF'
<div class="card shadow-sm border-0">
  <div class="card-body">
    <h2 class="h5">Downloads</h2>

    {% set pdf_url =
      product.product_pdf_url if product is defined and product.product_pdf_url
      else series.series_pdf_url if series is defined and series.series_pdf_url
      else None
    %}

    {% if pdf_url %}
      <a class="btn btn-primary w-100 mb-3" href="{{ media_url(pdf_url) }}" target="_blank">
        Download PDF
      </a>

      <div class="ratio ratio-4x3 border rounded overflow-hidden">
        <iframe src="{{ media_url(pdf_url) }}" title="PDF preview"></iframe>
      </div>
    {% else %}
      <p class="text-muted mb-0">No PDF available.</p>
    {% endif %}
  </div>
</div>
EOF

cat > "$ROOT_DIR/app/templates/errors/404.html" <<'EOF'
{% extends "base.html" %}

{% block content %}
<div class="py-5">
  <h1 class="h2">Page not found</h1>
  <p class="text-muted">The catalogue page you requested could not be found.</p>
  <a href="/" class="btn btn-primary">Back to product finder</a>
</div>
{% endblock %}
EOF

cat > "$ROOT_DIR/app/static/css/site.css" <<'EOF'
:root {
  --catalogue-border: #dee2e6;
  --catalogue-muted-bg: #f8f9fa;
}

body {
  background: #f7f8fa;
}

.navbar-brand {
  letter-spacing: -0.02em;
}

.card {
  border-radius: 0.75rem;
}

.product-card-image {
  height: 180px;
  object-fit: contain;
  background: #fff;
  padding: 1rem;
  border-bottom: 1px solid var(--catalogue-border);
}

.product-main-image {
  background: #fff;
  max-height: 420px;
  object-fit: contain;
}

.content-block {
  line-height: 1.6;
}

.table th {
  color: #495057;
  font-weight: 600;
}
EOF

cat > "$ROOT_DIR/app/static/js/finder.js" <<'EOF'
const form = document.querySelector("#finder-form");
const results = document.querySelector("#finder-results");

async function updateResults() {
  if (!form || !results) return;

  const params = new URLSearchParams(new FormData(form));

  const response = await fetch(`/finder/results?${params.toString()}`);
  const html = await response.text();

  results.innerHTML = html;
}

if (form) {
  form.addEventListener("change", updateResults);
  form.addEventListener("input", () => {
    clearTimeout(window.finderTimer);
    window.finderTimer = setTimeout(updateResults, 250);
  });
}
EOF

cat > "$ROOT_DIR/Containerfile" <<'EOF'
FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY vent-tech-catalogue.env.example ./.env.example

EXPOSE 8004

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
EOF

cat > "$ROOT_DIR/run_container.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

podman build -t vent-tech-catalogue:latest -f Containerfile .

podman rm -f vent-tech-catalogue 2>/dev/null || true

podman run -d \
  --name vent-tech-catalogue \
  --env-file .env \
  -p 8004:8004 \
  vent-tech-catalogue:latest

echo "Vent-tech catalogue is running on http://localhost:8004"
EOF

chmod +x "$ROOT_DIR/run_container.sh"

cat > "$ROOT_DIR/README.md" <<'EOF'
# Vent-tech catalogue

Server-rendered public catalogue site.

This app does not own product data. It renders public HTML by calling the existing customer-facing CMS API.

## API source

```text
https://p2.bitrep.nz
