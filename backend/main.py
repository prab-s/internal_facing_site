import csv
import datetime
import hashlib
import html
import io
import json
import logging
import os
import re
import secrets
import shlex
import shutil
import subprocess
import tarfile
import tempfile
import threading
import zipfile
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session, selectinload, joinedload
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color, HexColor
from reportlab.pdfgen import canvas

from backend.database import (
    DEFAULT_DATA_DIR,
    SessionLocal,
    get_db,
    init_db,
    allocate_series_tab_color,
)
from backend.models import (
    Product,
    Series,
    RpmLine,
    RpmPoint,
    EfficiencyPoint,
    ProductImage,
    ProductType,
    ProductTypeParameterGroupPreset,
    ProductTypeParameterPreset,
    ProductTypeRpmLinePreset,
    ProductTypeRpmPointPreset,
    ProductTypeEfficiencyPointPreset,
    ProductParameterGroup,
    ProductParameter,
    User,
)
from backend.models import AppSettings
from backend.schemas import (
    BandGraphStyleSettings,
    CmsProductGraphValuesResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    GraphImageMaintenanceResponse,
    MaintenanceJobResponse,
    PdfMaintenanceResponse,
    RpmLineCreate,
    RpmLineUpdate,
    RpmLineResponse,
    RpmPointCreate,
    RpmPointResponse,
    EfficiencyPointCreate,
    EfficiencyPointResponse,
    AuthSessionResponse,
    AuthPasswordChangeRequest,
    CmsProductResponse,
    CmsSeriesResponse,
    LoginRequest,
    UserCreate,
    UserPasswordUpdate,
    UserResponse,
    UserUpdate,
    ProductImageResponse,
    ProductImageReorder,
    ProductTypeResponse,
    ProductTypeCreate,
    ProductTypeParameterGroupPresetUpdate,
    ProductTypePresetUpdate,
    ProductTypeUpdate,
    ProductTypeParameterPresetUpdate,
    SeriesCreate,
    SeriesResponse,
    SeriesUpdate,
    TemplateCreateRequest,
    TemplateFileResponse,
    TemplateFileUpdateRequest,
    TemplateRegistryResponse,
    ProductTypePdfResponse,
)

SAFE_CHARS_RE = re.compile(r"[^a-z0-9]+")
GRAPH_FILTER_GROUP_NAME = "__graph__"
PRODUCT_IMAGES_DIR = Path(DEFAULT_DATA_DIR) / "product_images"
PRODUCT_GRAPHS_DIR = Path(DEFAULT_DATA_DIR) / "product_graphs"
PRODUCT_PDFS_DIR = Path(DEFAULT_DATA_DIR) / "product_pdfs"
PRODUCT_TYPE_PDFS_DIR = Path(DEFAULT_DATA_DIR) / "product_type_pdfs"
SERIES_GRAPHS_DIR = Path(DEFAULT_DATA_DIR) / "series_graphs"
SERIES_PDFS_DIR = Path(DEFAULT_DATA_DIR) / "series_pdfs"
BACKUP_OUTPUT_DIR = Path(DEFAULT_DATA_DIR) / "backups"
WORDPRESS_SITE_DIR = Path("/app/wordpress_site")
FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"
TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates"
TEMPLATE_REGISTRY_PATH = TEMPLATES_DIR / "registry.json"
ECHARTS_RENDER_SCRIPT = FRONTEND_DIR / "scripts" / "render_product_graph.mjs"
PRODUCT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
PRODUCT_GRAPHS_DIR.mkdir(parents=True, exist_ok=True)
PRODUCT_PDFS_DIR.mkdir(parents=True, exist_ok=True)
PRODUCT_TYPE_PDFS_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
logger = logging.getLogger(__name__)
SESSION_SECRET = os.getenv("SESSION_SECRET", "")
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "false").strip().lower() in {"1", "true", "yes", "on"}
BOOTSTRAP_ADMIN_USERNAME = os.getenv("BOOTSTRAP_ADMIN_USERNAME", "admin").strip()
BOOTSTRAP_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "").strip()
CMS_API_TOKEN = os.getenv("CMS_API_TOKEN", "").strip()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
POSTGRES_DB = os.getenv("POSTGRES_DB", "").strip()
POSTGRES_USER = os.getenv("POSTGRES_USER", "").strip()
WORDPRESS_DB_NAME = os.getenv("WORDPRESS_DB_NAME", "").strip()
WORDPRESS_DB_USER = os.getenv("WORDPRESS_DB_USER", "").strip()
WORDPRESS_DB_PASSWORD = os.getenv("WORDPRESS_DB_PASSWORD", "").strip()
WORDPRESS_DB_ROOT_PASSWORD = os.getenv("WORDPRESS_DB_ROOT_PASSWORD", "").strip()
PASSWORD_HASH_ITERATIONS = 600_000
POSTGRES_CLIENT_IMAGE = os.getenv("PG_CLIENT_IMAGE", "docker.io/library/postgres:16").strip() or "docker.io/library/postgres:16"
MAINTENANCE_JOBS: dict[str, dict] = {}
MAINTENANCE_JOBS_LOCK = threading.Lock()


def sanitize_name(value: str) -> str:
    cleaned = SAFE_CHARS_RE.sub("_", (value or "").strip().lower()).strip("_")
    return cleaned or "unknown"


def template_token_slug(value: str) -> str:
    return sanitize_name(value)


def product_slug(product: Product) -> str:
    return sanitize_name(product.model)


def series_slug(series: Series) -> str:
    return sanitize_name(f"{series.product_type_key or 'series'}_{series.name}")


def apply_product_type_parameter_presets(product_type: ProductType, preset_groups: list[ProductTypeParameterGroupPresetUpdate]):
    product_type.parameter_group_presets.clear()

    for group_index, group in enumerate(preset_groups or []):
        group_name = (group.group_name or "").strip()
        if not group_name:
            raise HTTPException(status_code=400, detail="Each parameter group needs a name.")

        group_model = ProductTypeParameterGroupPreset(
            group_name=group_name,
            sort_order=group_index,
        )

        seen_parameters: set[str] = set()
        for parameter_index, parameter in enumerate(group.parameters or []):
            parameter_name = (parameter.parameter_name or "").strip()
            if not parameter_name:
                raise HTTPException(status_code=400, detail=f"Each parameter in '{group_name}' needs a name.")

            normalized_parameter_name = parameter_name.casefold()
            if normalized_parameter_name in seen_parameters:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parameter names must be unique within '{group_name}'.",
                )
            seen_parameters.add(normalized_parameter_name)

            preferred_unit = (parameter.preferred_unit or "").strip() or None
            value_string = None if parameter.value_string is None else str(parameter.value_string).strip() or None
            value_number = None if parameter.value_number is None else float(parameter.value_number)
            if value_string is not None and value_number is not None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Each parameter preset in '{group_name}' must be either text or number, not both.",
                )
            if value_string is not None and preferred_unit is not None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Text parameter presets in '{group_name}' cannot define a unit.",
                )
            group_model.parameter_presets.append(
                ProductTypeParameterPreset(
                    parameter_name=parameter_name,
                    sort_order=parameter_index,
                    preferred_unit=preferred_unit,
                    value_string=value_string,
                    value_number=value_number,
                )
            )

        product_type.parameter_group_presets.append(group_model)


def apply_product_type_rpm_line_presets(product_type: ProductType, preset_lines: list):
    product_type.rpm_line_presets.clear()

    for line_index, line in enumerate(preset_lines or []):
        line_model = ProductTypeRpmLinePreset(
            rpm=float(line.rpm),
            band_color=(line.band_color or "").strip() or None,
            sort_order=line_index,
        )

        for point_index, point in enumerate(line.points or []):
            line_model.point_presets.append(
                ProductTypeRpmPointPreset(
                    airflow=float(point.airflow),
                    pressure=float(point.pressure),
                    sort_order=point_index,
                )
            )

        product_type.rpm_line_presets.append(line_model)


def apply_product_type_efficiency_point_presets(product_type: ProductType, preset_points: list):
    product_type.efficiency_point_presets.clear()

    for point_index, point in enumerate(preset_points or []):
        product_type.efficiency_point_presets.append(
            ProductTypeEfficiencyPointPreset(
                airflow=float(point.airflow),
                efficiency_centre=point.efficiency_centre,
                efficiency_lower_end=point.efficiency_lower_end,
                efficiency_higher_end=point.efficiency_higher_end,
                permissible_use=point.permissible_use,
                sort_order=point_index,
            )
        )


def apply_product_type_presets(
    product_type: ProductType,
    preset_groups: list[ProductTypeParameterGroupPresetUpdate],
    preset_lines: list,
    preset_efficiency_points: list,
    product_template_id: str | None = None,
    printed_product_template_id: str | None = None,
    online_product_template_id: str | None = None,
):
    apply_product_type_parameter_presets(product_type, preset_groups)
    apply_product_type_rpm_line_presets(product_type, preset_lines)
    apply_product_type_efficiency_point_presets(product_type, preset_efficiency_points)
    if printed_product_template_id is None and online_product_template_id is None:
        printed_product_template_id = product_template_id
        online_product_template_id = product_template_id
    product_type.printed_product_template_id = validate_template_id(printed_product_template_id, "product")
    product_type.online_product_template_id = validate_template_id(online_product_template_id, "product")
    product_type.product_template_id = (
        product_type.online_product_template_id
        or product_type.printed_product_template_id
        or validate_template_id(product_template_id, "product")
    )


def resolve_product_type_default_template_id(product_type: ProductType, variant: str) -> str | None:
    candidate = (
        product_type.printed_product_template_id
        if variant == "printed"
        else product_type.online_product_template_id
    ) or product_type.product_template_id
    if not candidate:
        return None
    try:
        return validate_template_id(candidate, "product")
    except HTTPException:
        return None


def resolve_template_pair(
    template_type: str,
    legacy_template_id: str | None = None,
    printed_template_id: str | None = None,
    online_template_id: str | None = None,
) -> tuple[str | None, str | None]:
    if printed_template_id is None and online_template_id is None and legacy_template_id is not None:
        printed_template_id = legacy_template_id
        online_template_id = legacy_template_id
    return (
        validate_template_id(printed_template_id, template_type),
        validate_template_id(online_template_id, template_type),
    )


def resolve_product_type_band_graph_style_defaults(product_type: ProductType) -> dict:
    return {
        "band_graph_background_color": normalize_color_value(product_type.band_graph_background_color) or "#ffffff",
        "band_graph_label_text_color": normalize_color_value(product_type.band_graph_label_text_color) or "#000000",
        "band_graph_faded_opacity": (
            product_type.band_graph_faded_opacity if product_type.band_graph_faded_opacity is not None else 0.18
        ),
        "band_graph_permissible_label_color": (
            normalize_color_value(product_type.band_graph_permissible_label_color)
            or normalize_color_value(product_type.band_graph_label_text_color)
            or "#000000"
        ),
    }


def build_product_type_rpm_line_presets(product_type: ProductType) -> list[dict]:
    preset_lines: list[dict] = []
    for line in product_type.rpm_line_presets or []:
        preset_lines.append(
            {
                "rpm": line.rpm,
                "band_color": line.band_color,
                "points": [
                    {
                        "airflow": point.airflow,
                        "pressure": point.pressure,
                    }
                    for point in line.point_presets or []
                ],
            }
        )
    return preset_lines


def build_product_type_efficiency_point_presets(product_type: ProductType) -> list[dict]:
    return [
        {
            "airflow": point.airflow,
            "efficiency_centre": point.efficiency_centre,
            "efficiency_lower_end": point.efficiency_lower_end,
            "efficiency_higher_end": point.efficiency_higher_end,
            "permissible_use": point.permissible_use,
        }
        for point in product_type.efficiency_point_presets or []
    ]


def load_template_registry() -> dict:
    if not TEMPLATE_REGISTRY_PATH.exists():
        return {"product_templates": [], "series_templates": [], "product_type_templates": []}
    with TEMPLATE_REGISTRY_PATH.open("r", encoding="utf-8") as handle:
        registry = json.load(handle)
    if not isinstance(registry, dict):
        return {"product_templates": [], "series_templates": [], "product_type_templates": []}
    return {
        "product_templates": list(registry.get("product_templates") or []),
        "series_templates": list(registry.get("series_templates") or []),
        "product_type_templates": list(registry.get("product_type_templates") or []),
    }


def save_template_registry(registry: dict):
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATE_REGISTRY_PATH.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")


def template_collection_name(template_type: str) -> str:
    normalized = (template_type or "").strip().lower()
    if normalized not in {"product", "series", "product_type"}:
        raise HTTPException(status_code=400, detail="Template type must be 'product', 'series', or 'product_type'.")
    return f"{normalized}_templates"


def template_type_directory(template_type: str) -> Path:
    normalized = (template_type or "").strip().lower()
    if normalized not in {"product", "series", "product_type"}:
        raise HTTPException(status_code=400, detail="Template type must be 'product', 'series', or 'product_type'.")
    directory = TEMPLATES_DIR / normalized
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def infer_template_label_from_slug(template_type: str, slug: str) -> str:
    prefix = "Product" if template_type == "product" else "Series" if template_type == "series" else "Product Type"
    readable = slug.replace("_", " ").replace("-", " ").strip()
    readable = " ".join(word.capitalize() for word in readable.split()) or "Template"
    return f"{prefix} {readable}"


def sync_template_registry_with_disk() -> dict:
    registry = load_template_registry()
    synchronized: dict[str, list[dict]] = {"product_templates": [], "series_templates": [], "product_type_templates": []}

    for template_type in ("product", "series", "product_type"):
        collection_name = template_collection_name(template_type)
        existing_by_path = {}
        existing_by_id = {}
        for item in registry.get(collection_name, []):
            if not isinstance(item, dict):
                continue
            item_path = str(item.get("path") or "").strip()
            item_id = str(item.get("id") or "").strip()
            if item_path:
                existing_by_path[item_path] = dict(item)
            if item_id:
                existing_by_id[item_id] = dict(item)

        template_dir = template_type_directory(template_type)
        for child in sorted([entry for entry in template_dir.iterdir() if entry.is_dir()], key=lambda entry: entry.name):
            template_path = child / "template.html"
            if not template_path.is_file():
                continue

            relative_html_path = str(template_path.relative_to(TEMPLATES_DIR.parent))
            relative_css_path = child / "template.css"
            entry = (
                existing_by_path.get(relative_html_path)
                or existing_by_id.get(f"{template_type}-{sanitize_name(child.name)}")
                or {}
            )
            template_id = str(entry.get("id") or f"{template_type}-{sanitize_name(child.name)}").strip()
            label = str(entry.get("label") or infer_template_label_from_slug(template_type, child.name)).strip()
            stylesheet = (
                str(relative_css_path.relative_to(TEMPLATES_DIR.parent))
                if relative_css_path.is_file()
                else None
            )
            synchronized[collection_name].append(
                {
                    "id": template_id,
                    "label": label,
                    "type": template_type,
                    "path": relative_html_path,
                    "stylesheet": stylesheet,
                }
            )

    if synchronized != registry:
        save_template_registry(synchronized)
    return synchronized


def scaffold_blank_template(template_type: str, destination_dir: Path):
    if template_type == "product":
        html_content = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{product.model}} | Product PDF</title>
    <link rel="stylesheet" href="./template.css" />
  </head>
  <body>
    <main class="sheet">
      <h1>{{product.model}}</h1>
      <div>{{product.description1_html}}</div>
      <div>{{product.grouped_specs_table}}</div>
      <img src="{{product.graph_image_url}}" alt="{{product.model}} graph" />
    </main>
  </body>
</html>
"""
    elif template_type == "product_type":
        html_content = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{product_type.label}} | Product Type PDF</title>
    <link rel="stylesheet" href="./template.css" />
  </head>
  <body>
    <main class="sheet">
      <h1>{{product_type.label}}</h1>
      <div>{{product_type.series_names}}</div>
      <div>{{product_type.contents_html}}</div>
    </main>
  </body>
</html>
"""
    else:
        html_content = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{series.name}} | Series PDF</title>
    <link rel="stylesheet" href="./template.css" />
  </head>
  <body>
    <main class="sheet">
      <h1>{{series.name}}</h1>
      <div>{{series.description1_html}}</div>
      <img src="{{series.graph_image_url}}" alt="{{series.name}} graph" />
      <div>{{series.products_summary_table}}</div>
    </main>
  </body>
</html>
"""
    css_content = """.sheet { font-family: Arial, sans-serif; padding: 24px; }\nimg { max-width: 100%; height: auto; }\n"""
    destination_dir.mkdir(parents=True, exist_ok=False)
    (destination_dir / "template.html").write_text(html_content, encoding="utf-8")
    (destination_dir / "template.css").write_text(css_content, encoding="utf-8")


def validate_template_id(template_id: str | None, template_type: str) -> str | None:
    normalized = (template_id or "").strip() or None
    if normalized is None:
        return None
    registry = sync_template_registry_with_disk()
    collection_name = template_collection_name(template_type)
    valid_ids = {
        str(item.get("id")).strip()
        for item in registry.get(collection_name, [])
        if isinstance(item, dict) and item.get("id")
    }
    if normalized not in valid_ids:
        raise HTTPException(status_code=400, detail=f"Unknown {template_type} template id: {normalized}")
    return normalized


def get_template_definition(template_id: str | None, template_type: str) -> dict | None:
    normalized = validate_template_id(template_id, template_type)
    if normalized is None:
        return None
    registry = sync_template_registry_with_disk()
    collection_name = template_collection_name(template_type)
    for item in registry.get(collection_name, []):
        if isinstance(item, dict) and str(item.get("id")).strip() == normalized:
            return item
    return None


def require_template_definition(template_id: str, template_type: str) -> dict:
    template_definition = get_template_definition(template_id, template_type)
    if template_definition is None:
        raise HTTPException(status_code=404, detail="Template not found.")
    return template_definition


def find_chromium_binary() -> str:
    candidates = [
        os.getenv("CHROMIUM_BIN", "").strip(),
        "chromium",
        "chromium-browser",
        "google-chrome",
        "google-chrome-stable",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise RuntimeError("No Chromium-compatible browser was found for PDF rendering.")


def product_image_file_name(product: Product, index: int, extension: str) -> str:
    ext = extension.lower()
    if not ext.startswith("."):
        ext = f".{ext}"
    return f"pic_{product_slug(product)}_{index}{ext}"


def graph_file_name(product: Product) -> str:
    return f"graph_{product_slug(product)}.png"


def product_pdf_file_name(product: Product, variant: str) -> str:
    return f"product_{variant}_{product_slug(product)}.pdf"


def product_pdf_path(product: Product, variant: str) -> Path:
    return PRODUCT_PDFS_DIR / product_pdf_file_name(product, variant)


def series_graph_file_name(series: Series) -> str:
    return f"series_graph_{series_slug(series)}.png"


def series_pdf_file_name(series: Series, variant: str) -> str:
    return f"series_{variant}_{series_slug(series)}.pdf"


def series_graph_path(series: Series) -> Path:
    return SERIES_GRAPHS_DIR / series_graph_file_name(series)


def series_pdf_path(series: Series, variant: str) -> Path:
    return SERIES_PDFS_DIR / series_pdf_file_name(series, variant)


def product_type_pdf_file_name(product_type: ProductType, variant: str) -> str:
    return f"product_type_{variant}_{sanitize_name(product_type.key or product_type.label or 'unknown')}.pdf"


def product_type_pdf_path(product_type: ProductType, variant: str) -> Path:
    return PRODUCT_TYPE_PDFS_DIR / product_type_pdf_file_name(product_type, variant)


def image_file_path(file_name: str) -> Path:
    return PRODUCT_IMAGES_DIR / file_name


def remove_file(path: str | os.PathLike | None):
    if not path:
        return
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass


def normalize_color_value(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


SERIES_TAB_FALLBACK_COLOR = "#64748b"
SERIES_TAB_TEXT_COLOR = "#ffffff"
SERIES_TAB_STRIP_WIDTH = 25
SERIES_TAB_OUTER_MARGIN_TOP = 2
SERIES_TAB_OUTER_MARGIN_BOTTOM = 2
SERIES_TAB_SLOT_GAP = 3
SERIES_TAB_SLOT_FILL_RATIO = 0.9
SERIES_TAB_MAX_LABEL_CHARS = 26
SERIES_TAB_CORNER_RADIUS = 4


def series_tab_color_for_identity(identity: int | str | None) -> str:
    if identity in (None, ""):
        return SERIES_TAB_FALLBACK_COLOR
    digest = hashlib.sha1(str(identity).encode("utf-8")).digest()
    hue = int.from_bytes(digest[:2], "big") / 65535.0
    saturation = 0.62 + (digest[2] / 255.0) * 0.18
    lightness = 0.44 + (digest[3] / 255.0) * 0.08

    import colorsys

    red, green, blue = colorsys.hls_to_rgb(hue, lightness, saturation)
    return "#{:02x}{:02x}{:02x}".format(int(red * 255), int(green * 255), int(blue * 255))


def _shorten_tab_label(label: str) -> str:
    value = " ".join((label or "").split()).strip()
    if len(value) <= SERIES_TAB_MAX_LABEL_CHARS:
        return value
    return value[: SERIES_TAB_MAX_LABEL_CHARS - 1].rstrip() + "…"


def _hex_to_rgb(value: str) -> tuple[float, float, float]:
    text = (value or "").strip().lstrip("#")
    if len(text) != 6:
        return (0.39, 0.47, 0.53)
    return tuple(int(text[index : index + 2], 16) / 255.0 for index in (0, 2, 4))


def _series_tab_layout(page_height: float, tab_count: int) -> list[tuple[float, float]]:
    count = max(int(tab_count), 1)
    usable_height = max(page_height - SERIES_TAB_OUTER_MARGIN_TOP - SERIES_TAB_OUTER_MARGIN_BOTTOM, 0)
    total_slot_gap = SERIES_TAB_SLOT_GAP * max(count - 1, 0)
    slot_height = (usable_height - total_slot_gap) / count if count else usable_height
    slot_height = max(slot_height, 1)
    tab_height = max(slot_height * SERIES_TAB_SLOT_FILL_RATIO, 1)
    positions: list[tuple[float, float]] = []

    for index in range(count):
        slot_top = page_height - SERIES_TAB_OUTER_MARGIN_TOP - (index * (slot_height + SERIES_TAB_SLOT_GAP))
        y_position = slot_top - tab_height
        positions.append((y_position, tab_height))

    return positions


def render_pdf_from_html(html_content: str, output_path: Path) -> None:
    browser_binary = find_chromium_binary()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="pdf-render-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        html_path = temp_dir / "document.html"
        html_path.write_text(html_content, encoding="utf-8")

        result = subprocess.run(
            [
                browser_binary,
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--allow-file-access-from-files",
                "--print-to-pdf-no-header",
                f"--print-to-pdf={output_path}",
                html_path.as_uri(),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not output_path.is_file():
            raise RuntimeError((result.stderr or result.stdout or "Chromium failed to render the PDF.").strip())


def merge_pdf_files(source_paths: list[Path], output_path: Path) -> None:
    writer = PdfWriter()
    for source_path in source_paths:
        reader = PdfReader(str(source_path))
        for page in reader.pages:
            writer.add_page(page)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as handle:
        writer.write(handle)


def _build_pdf_overlay(page_width: float, page_height: float, page_number: int, tabs: list[dict]) -> PdfReader:
    from io import BytesIO

    buffer = BytesIO()
    overlay = canvas.Canvas(buffer, pagesize=(page_width, page_height))
    tab_items = tabs or []
    tab_x = page_width - SERIES_TAB_STRIP_WIDTH
    tab_layout = _series_tab_layout(page_height, len(tab_items))

    for index, tab in enumerate(tab_items or [{}]):
        tab_label = str(tab.get("tab_label") or "")
        tab_color = str(tab.get("tab_color") or SERIES_TAB_FALLBACK_COLOR)
        tab_opacity = float(tab.get("tab_opacity") if tab.get("tab_opacity") is not None else 1.0)
        y_position, tab_height = tab_layout[index] if index < len(tab_layout) else (0.0, page_height)
        red, green, blue = _hex_to_rgb(tab_color)
        fill_alpha = max(0.05, min(1.0, tab_opacity))
        fill_color = Color(red, green, blue, alpha=fill_alpha)
        border_color = Color(max(0.0, red * 0.72), max(0.0, green * 0.72), max(0.0, blue * 0.72), alpha=min(0.9, fill_alpha))
        overlay.saveState()
        overlay.setFillColor(fill_color)
        overlay.setStrokeColor(border_color)
        overlay.setLineWidth(0.5)
        overlay.roundRect(tab_x, y_position, SERIES_TAB_STRIP_WIDTH, tab_height, SERIES_TAB_CORNER_RADIUS, stroke=1, fill=1)
        overlay.restoreState()

        overlay.saveState()
        overlay.translate(page_width - (SERIES_TAB_STRIP_WIDTH / 2), y_position + (tab_height / 2))
        overlay.rotate(90)
        overlay.setFillColor(HexColor(SERIES_TAB_TEXT_COLOR))
        overlay.setFont("Helvetica-Bold", 8.25)
        overlay.drawCentredString(0, -3, _shorten_tab_label(tab_label))
        overlay.restoreState()

    overlay.setFillColor(HexColor("#000000"))
    overlay.setFont("Helvetica", 9)
    overlay.drawRightString(page_width - SERIES_TAB_STRIP_WIDTH - 10, 10, str(page_number))
    overlay.showPage()
    overlay.save()
    buffer.seek(0)
    return PdfReader(buffer)


def stamp_pdf_file(input_path: Path, output_path: Path, page_decorations: list[dict]) -> None:
    reader = PdfReader(str(input_path))
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        decoration = page_decorations[index] if index < len(page_decorations) else {}
        page_width = float(page.mediabox.width)
        page_height = float(page.mediabox.height)
        overlay_tabs = decoration.get("tabs")
        if overlay_tabs is None:
            overlay_tabs = [
                {
                    "tab_label": str(decoration.get("tab_label") or ""),
                    "tab_color": str(decoration.get("tab_color") or SERIES_TAB_FALLBACK_COLOR),
                    "tab_opacity": float(decoration.get("tab_opacity") if decoration.get("tab_opacity") is not None else 1.0),
                }
            ]
        overlay_reader = _build_pdf_overlay(page_width, page_height, index + 1, list(overlay_tabs))
        page.merge_page(overlay_reader.pages[0])
        writer.add_page(page)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as handle:
        writer.write(handle)


def pdf_page_count(pdf_path: Path) -> int:
    return len(PdfReader(str(pdf_path)).pages)


def get_product_type_by_key(db: Session, product_type_key: str | None) -> ProductType:
    desired_key = (product_type_key or "fan").strip() or "fan"
    product_type = db.query(ProductType).filter(ProductType.key == desired_key).first()
    if product_type is None:
        raise HTTPException(status_code=400, detail=f"Unknown product type: {desired_key}")
    return product_type


def get_series_by_id(db: Session, series_id: int | None) -> Series | None:
    if series_id is None:
        return None
    series = db.get(Series, series_id)
    if series is None:
        raise HTTPException(status_code=400, detail=f"Unknown series id: {series_id}")
    return series


def sync_product_series(product: Product, series: Series | None) -> None:
    product.series = series
    product.series_id = series.id if series else None
    product.series_name = series.name if series else None


def ensure_series_tab_color(db: Session, series: Series) -> str:
    existing_color = (series.series_tab_color or "").strip()
    if existing_color:
        return existing_color

    used_colors = {
        str(value[0]).strip().lower()
        for value in db.query(Series.series_tab_color)
        .filter(Series.series_tab_color.isnot(None), Series.id != series.id)
        .all()
        if value[0]
    }
    seed = series.id if series.id is not None else f"{series.product_type_id}:{series.name}"
    series.series_tab_color = allocate_series_tab_color(seed, used_colors)
    return series.series_tab_color


def sync_product_parameter_groups(product: Product, groups_payload: list[dict]):
    normalized_groups: list[dict] = []
    for group_index, group in enumerate(groups_payload or []):
        group_name = str(group.get("group_name", "")).strip()
        if not group_name:
            raise HTTPException(status_code=400, detail="Each parameter group must have a name.")

        seen_parameter_names: set[str] = set()
        normalized_parameters: list[dict] = []
        for parameter_index, parameter in enumerate(group.get("parameters") or []):
            parameter_name = str(parameter.get("parameter_name", "")).strip()
            if not parameter_name:
                raise HTTPException(status_code=400, detail=f"Each parameter in '{group_name}' must have a name.")
            if parameter_name.lower() in seen_parameter_names:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parameter names must be unique within '{group_name}'.",
                )
            seen_parameter_names.add(parameter_name.lower())

            raw_value_string = parameter.get("value_string")
            value_string = None if raw_value_string is None else str(raw_value_string).strip() or None
            value_number = parameter.get("value_number")
            unit = None if parameter.get("unit") is None else str(parameter.get("unit")).strip() or None

            if value_string is not None and value_number is not None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parameter '{parameter_name}' in '{group_name}' cannot have both text and numeric values.",
                )
            if value_string is not None and unit is not None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parameter '{parameter_name}' in '{group_name}' cannot have a unit without a numeric value.",
                )

            normalized_parameters.append(
                {
                    "parameter_name": parameter_name,
                    "sort_order": parameter_index,
                    "value_string": value_string,
                    "value_number": None if value_number is None else float(value_number),
                    "unit": unit,
                }
            )

        normalized_groups.append(
            {
                "group_name": group_name,
                "sort_order": group_index,
                "parameters": normalized_parameters,
            }
        )

    product.parameter_groups.clear()
    for group_data in normalized_groups:
        group = ProductParameterGroup(
            group_name=group_data["group_name"],
            sort_order=group_data["sort_order"],
        )
        for parameter_data in group_data["parameters"]:
            group.parameters.append(ProductParameter(**parameter_data))
        product.parameter_groups.append(group)


def get_or_create_app_settings(db: Session) -> AppSettings:
    settings = db.get(AppSettings, 1)
    if settings is None:
        settings = AppSettings(id=1)
        db.add(settings)
        db.flush()
    return settings


def sync_product_image_files(product: Product):
    ordered_images = sorted(product.product_images, key=lambda image: (image.sort_order, image.id))
    temp_paths = {}

    for image in ordered_images:
        current_path = image_file_path(image.file_name)
        if current_path.exists():
            temp_path = image_file_path(f"tmp_{image.id}_{image.file_name}")
            current_path.rename(temp_path)
            temp_paths[image.id] = temp_path

    for index, image in enumerate(ordered_images, start=1):
        suffix = Path(image.file_name).suffix or ".jpg"
        final_name = product_image_file_name(product, index, suffix)
        final_path = image_file_path(final_name)
        temp_path = temp_paths.get(image.id)
        if temp_path and temp_path.exists():
            if final_path.exists():
                final_path.unlink()
            temp_path.rename(final_path)
        image.file_name = final_name
        image.sort_order = index - 1


def render_richtext_html(value: str | None) -> str:
    return value or '<p class="placeholder">Not provided.</p>'


def render_grouped_specs_table(product: Product) -> str:
    groups = sorted(product.parameter_groups, key=lambda group: (group.sort_order, group.id))
    if not groups:
        return '<p class="placeholder">No grouped specifications available.</p>'

    sections: list[str] = []
    for group in groups:
        rows: list[str] = []
        for parameter in sorted(group.parameters, key=lambda item: (item.sort_order, item.id)):
            if parameter.value_string not in {None, ""}:
                value_html = html.escape(parameter.value_string)
            elif parameter.value_number is not None:
                number_value = f"{parameter.value_number:g}"
                value_html = html.escape(f"{number_value} {parameter.unit}".strip())
            else:
                value_html = "—"
            rows.append(
                "<tr>"
                f"<th>{html.escape(parameter.parameter_name)}</th>"
                f"<td>{value_html}</td>"
                "</tr>"
            )

        sections.append(
            '<section class="spec-group">'
            f"<h3>{html.escape(group.group_name)}</h3>"
            '<table class="spec-table"><tbody>'
            + "".join(rows)
            + "</tbody></table></section>"
        )

    return "".join(sections)


def render_grouped_specs_group_html(product: Product, group_name: str) -> str:
    target_slug = template_token_slug(group_name)
    matching_groups = [
        group
        for group in sorted(product.parameter_groups, key=lambda item: (item.sort_order, item.id))
        if template_token_slug(group.group_name or "") == target_slug
    ]
    if not matching_groups:
        return f'<p class="placeholder">No {html.escape(group_name.lower())} grouped specifications available.</p>'

    rows: list[str] = []
    for group in matching_groups:
        for parameter in sorted(group.parameters, key=lambda item: (item.sort_order, item.id)):
            if parameter.value_string not in {None, ""}:
                value_html = html.escape(parameter.value_string)
            elif parameter.value_number is not None:
                number_value = f"{parameter.value_number:g}"
                value_html = html.escape(f"{number_value} {parameter.unit}".strip())
            else:
                value_html = "—"
            rows.append(
                "<div class=\"spec-list__row\">"
                f"<dt>{html.escape(parameter.parameter_name)}</dt>"
                f"<dd>{value_html}</dd>"
                "</div>"
            )

    if not rows:
        return f'<p class="placeholder">No {html.escape(group_name.lower())} grouped specifications available.</p>'

    return '<dl class="spec-list">' + "".join(rows) + "</dl>"


def format_parameter_value(parameter: ProductParameter) -> str:
    if parameter.value_string not in {None, ""}:
        return parameter.value_string
    if parameter.value_number is not None:
        number_value = f"{parameter.value_number:g}"
        return f"{number_value} {parameter.unit}".strip()
    return ""


def build_grouped_spec_token_map(product: Product) -> dict[str, str]:
    replacements: dict[str, str] = {}
    groups = sorted(product.parameter_groups, key=lambda group: (group.sort_order, group.id))
    for group in groups:
        group_key = template_token_slug(group.group_name or "")
        if not group_key:
            continue
        for parameter in sorted(group.parameters, key=lambda item: (item.sort_order, item.id)):
            parameter_key = template_token_slug(parameter.parameter_name or "")
            if not parameter_key:
                continue
            replacements[f"{{{{spec.{group_key}.{parameter_key}}}}}"] = html.escape(format_parameter_value(parameter))
    return replacements


def build_grouped_spec_group_token_map(product: Product) -> dict[str, str]:
    replacements: dict[str, str] = {}
    for group_name in ("impeller", "motor", "fan"):
        target_slug = template_token_slug(group_name)
        matching_groups = [
            group
            for group in sorted(product.parameter_groups, key=lambda item: (item.sort_order, item.id))
            if template_token_slug(group.group_name or "") == target_slug
        ]
        if not matching_groups:
            replacements[f"{{{{product.grouped_specs_{group_name}_html}}}}"] = (
                f'<p class="placeholder">No {html.escape(group_name.lower())} grouped specifications available.</p>'
            )
            continue

        rows: list[str] = []
        for group in matching_groups:
            for parameter in sorted(group.parameters, key=lambda item: (item.sort_order, item.id)):
                if parameter.value_string not in {None, ""}:
                    value_html = html.escape(parameter.value_string)
                elif parameter.value_number is not None:
                    number_value = f"{parameter.value_number:g}"
                    value_html = html.escape(f"{number_value} {parameter.unit}".strip())
                else:
                    value_html = "—"
                rows.append(
                    "<div class=\"spec-list__row\">"
                    f"<dt>{html.escape(parameter.parameter_name)}</dt>"
                    f"<dd>{value_html}</dd>"
                    "</div>"
                )

        if not rows:
            replacements[f"{{{{product.grouped_specs_{group_name}_html}}}}"] = (
                f'<p class="placeholder">No {html.escape(group_name.lower())} grouped specifications available.</p>'
            )
            continue

        replacements[f"{{{{product.grouped_specs_{group_name}_html}}}}"] = '<dl class="spec-list">' + "".join(rows) + "</dl>"
    return replacements


def render_fan_map_points_table(product: Product) -> str:
    ordered_lines = sorted(product.rpm_lines, key=lambda line: (line.rpm, line.id))
    if not ordered_lines:
        return '<p class="placeholder">No fan map points available.</p>'

    rows: list[str] = []
    for line in ordered_lines:
        ordered_points = sorted(line.points or [], key=lambda point: (point.airflow, point.id))
        if not ordered_points:
            rows.append(
                "<tr>"
                f"<td>{html.escape(f'{line.rpm:g}')}</td>"
                "<td colspan=\"3\">No points recorded</td>"
                "</tr>"
            )
            continue

        for index, point in enumerate(ordered_points, start=1):
            rows.append(
                "<tr>"
                f"<td>{html.escape(f'{line.rpm:g}')}</td>"
                f"<td>{html.escape(str(index))}</td>"
                f"<td>{html.escape(f'{point.airflow:g}')}</td>"
                f"<td>{html.escape(f'{point.pressure:g}')}</td>"
                "</tr>"
            )

    return (
        '<table class="fan-map-points-table">'
        '<caption>Fan Map Points</caption>'
        "<thead><tr>"
        "<th>RPM Line</th>"
        "<th>Point</th>"
        "<th>Airflow</th>"
        "<th>Pressure</th>"
        "</tr></thead><tbody>"
        + "".join(rows)
        + "</tbody></table>"
    )


def render_image_gallery_html(product: Product) -> str:
    ordered_images = sorted(product.product_images, key=lambda image: (image.sort_order, image.id))
    if not ordered_images:
        return '<p class="placeholder">No product images available.</p>'

    items: list[str] = []
    for index, image in enumerate(ordered_images, start=1):
        image_path = image_file_path(image.file_name)
        if not image_path.is_file():
            continue
        items.append(
            '<figure class="gallery-item">'
            f'<img src="{image_path.as_uri()}" alt="{html.escape(product.model)} image {index}" class="gallery-image" />'
            f'<figcaption>{html.escape("Primary image" if index == 1 else f"Image {index}")}</figcaption>'
            "</figure>"
        )

    return "".join(items) if items else '<p class="placeholder">No product images available.</p>'


def build_product_pdf_html(product: Product, variant: str) -> str:
    template_id = product.printed_template_id if variant == "printed" else product.online_template_id
    template_definition = get_template_definition(template_id or product.template_id or "product-default", "product")
    if template_definition is None:
        raise RuntimeError("No product PDF template is configured.")

    project_root = Path(__file__).resolve().parents[1]
    template_path = project_root / template_definition["path"]
    stylesheet_path = project_root / template_definition.get("stylesheet", "")
    if not template_path.is_file():
        raise RuntimeError(f"Product template file is missing: {template_path}")

    html_template = template_path.read_text(encoding="utf-8")
    stylesheet_text = stylesheet_path.read_text(encoding="utf-8") if stylesheet_path.is_file() else ""
    html_template = html_template.replace('<link rel="stylesheet" href="./template.css" />', f"<style>\n{stylesheet_text}\n</style>")

    primary_image_uri = ""
    if product.product_images:
        first_image = sorted(product.product_images, key=lambda img: (img.sort_order, img.id))[0]
        first_image_path = image_file_path(first_image.file_name)
        if first_image_path.is_file():
            primary_image_uri = first_image_path.as_uri()

    graph_image_uri = ""
    if product.graph_image_path:
        graph_path = Path(product.graph_image_path)
        if graph_path.is_file():
            graph_image_uri = graph_path.as_uri()

    replacements = {
        "{{product.model}}": html.escape(product.model or ""),
        "{{product.product_type_label}}": html.escape(product.product_type_label or ""),
        "{{product.series_name}}": html.escape(product.series_name_value or ""),
        "{{product.description1_html}}": render_richtext_html(product.description1_html),
        "{{product.description2_html}}": render_richtext_html(product.description2_html),
        "{{product.description3_html}}": render_richtext_html(product.description3_html),
        "{{product.description_html}}": render_richtext_html(product.description1_html),
        "{{product.features_html}}": render_richtext_html(product.description2_html),
        "{{product.specifications_html}}": render_richtext_html(product.description3_html),
        "{{product.comments_html}}": render_richtext_html(product.comments_html),
        "{{product.grouped_specs_table}}": render_grouped_specs_table(product),
        "{{product.fan_map_points_table}}": render_fan_map_points_table(product),
        "{{product.image_gallery}}": render_image_gallery_html(product),
        "{{product.primary_product_image_url}}": primary_image_uri,
        "{{product.graph_image_url}}": graph_image_uri,
    }
    replacements.update(build_grouped_spec_group_token_map(product))
    replacements.update(build_grouped_spec_token_map(product))

    rendered = html_template
    for token, value in replacements.items():
        rendered = rendered.replace(token, value)
    return rendered


def generate_product_pdf(product: Product, variant: str) -> Path:
    output_path = product_pdf_path(product, variant)
    with tempfile.TemporaryDirectory(prefix="product-pdf-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        base_path = temp_dir / f"product_{variant}_{product_slug(product)}_base.pdf"
        render_pdf_from_html(build_product_pdf_html(product, variant), base_path)
        series_color = (
            (product.series.series_tab_color if product.series else None)
            or series_tab_color_for_identity(product.series_id or product.series_name_value or product.id)
        )
        stamp_pdf_file(
            base_path,
            output_path,
            [
                {
                    "tab_label": product.series_name_value or product.product_type_label or product.model or "Product",
                    "tab_color": series_color,
                }
                for _ in range(pdf_page_count(base_path))
            ],
        )

    return output_path


def get_template_label(template_id: str | None, template_type: str) -> str:
    template_definition = get_template_definition(template_id, template_type)
    return str(template_definition.get("label")) if template_definition else "Default"


def series_graph_rule_label() -> str:
    return "Highest and lowest line from each product"


def render_series_products_summary_table(series: Series) -> str:
    ordered_products = sorted(series.products or [], key=lambda product: (product.model or "").lower())
    if not ordered_products:
        return '<p class="placeholder">No products are linked to this series yet.</p>'

    candidate_columns: list[tuple[str, str, str]] = []
    seen_columns: set[tuple[str, str]] = set()
    for product in ordered_products:
        for group in sorted(product.parameter_groups, key=lambda item: (item.sort_order, item.id)):
            for parameter in sorted(group.parameters, key=lambda item: (item.sort_order, item.id)):
                key = (group.group_name or "", parameter.parameter_name or "")
                if not key[0] or not key[1] or key in seen_columns:
                    continue
                seen_columns.add(key)
                candidate_columns.append((key[0], key[1], f"{key[0]}: {key[1]}"))
                if len(candidate_columns) >= 6:
                    break
            if len(candidate_columns) >= 6:
                break
        if len(candidate_columns) >= 6:
            break

    def parameter_value_map(product: Product) -> dict[tuple[str, str], str]:
        values: dict[tuple[str, str], str] = {}
        for group in product.parameter_groups:
            for parameter in group.parameters:
                values[(group.group_name or "", parameter.parameter_name or "")] = format_parameter_value(parameter) or "—"
        return values

    header_cells = [
        "<th>Model</th>",
        *[f"<th>{html.escape(label)}</th>" for _, _, label in candidate_columns],
    ]

    body_rows: list[str] = []
    for product in ordered_products:
        values = parameter_value_map(product)
        data_cells = [
            f"<td>{html.escape(product.model or '—')}</td>",
            *[
                f"<td>{html.escape(values.get((group_name, parameter_name), '—'))}</td>"
                for group_name, parameter_name, _ in candidate_columns
            ],
        ]
        body_rows.append("<tr>" + "".join(data_cells) + "</tr>")

    return (
        '<table class="series-summary-table"><thead><tr>'
        + "".join(header_cells)
        + "</tr></thead><tbody>"
        + "".join(body_rows)
        + "</tbody></table>"
    )


def build_series_graph_payload(series: Series) -> dict | None:
    product_type = series.product_type
    if not product_type or not product_type.supports_graph:
        return None

    synthetic_lines: list[dict] = []
    synthetic_points: list[dict] = []
    next_line_id = 1
    next_point_id = 1

    ordered_products = sorted(series.products or [], key=lambda product: (product.model or "").lower())
    for product in ordered_products:
        ordered_lines = sorted(product.rpm_lines or [], key=lambda line: line.rpm)
        if not ordered_lines:
            continue
        selected_lines = [ordered_lines[0]]
        if len(ordered_lines) > 1 and ordered_lines[-1].id != ordered_lines[0].id:
            selected_lines.append(ordered_lines[-1])

        for index, line in enumerate(selected_lines):
            display_label = (
                f"{product.model} low"
                if len(selected_lines) > 1 and index == 0
                else f"{product.model} high"
                if len(selected_lines) > 1
                else f"{product.model}"
            )
            synthetic_line_id = next_line_id
            next_line_id += 1
            synthetic_lines.append(
                {
                    "id": synthetic_line_id,
                    "product_id": product.id,
                    "rpm": synthetic_line_id,
                    "display_label": display_label,
                    "band_color": line.band_color,
                }
            )
            for point in sorted(line.points or [], key=lambda item: item.airflow):
                synthetic_points.append(
                    {
                        "id": next_point_id,
                        "product_id": product.id,
                        "rpm_line_id": synthetic_line_id,
                        "rpm": synthetic_line_id,
                        "airflow": point.airflow,
                        "pressure": point.pressure,
                    }
                )
                next_point_id += 1

    if not synthetic_points:
        return None

    return {
        "title": f"{series.name} Series Graph",
        "showRpmBandShading": False,
        "graphConfig": build_graph_config(product_type),
        "graphStyle": None,
        "rpmLines": synthetic_lines,
        "rpmPoints": synthetic_points,
        "efficiencyPoints": [],
    }


def generate_series_graph(series: Series) -> Path:
    payload = build_series_graph_payload(series)
    if payload is None:
        raise RuntimeError("No graph-capable products with line data are linked to this series.")

    final_path = series_graph_path(series)
    tmp_path = SERIES_GRAPHS_DIR / f"tmp_{series_graph_file_name(series)}"
    final_path.parent.mkdir(parents=True, exist_ok=True)
    if tmp_path.exists():
        tmp_path.unlink()

    result = subprocess.run(
        ["node", str(ECHARTS_RENDER_SCRIPT), str(tmp_path)],
        cwd=str(FRONTEND_DIR),
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "ECharts graph render failed: "
            + (result.stderr.strip() or result.stdout.strip() or f"exit code {result.returncode}")
        )

    shutil.move(tmp_path, final_path)
    return final_path


def build_series_pdf_html(series: Series, variant: str) -> str:
    template_id = series.printed_template_id if variant == "printed" else series.online_template_id
    template_definition = get_template_definition(template_id or series.template_id or "series-default", "series")
    if template_definition is None:
        raise RuntimeError("No series PDF template is configured.")

    project_root = Path(__file__).resolve().parents[1]
    template_path = project_root / template_definition["path"]
    stylesheet_path = project_root / template_definition.get("stylesheet", "")
    if not template_path.is_file():
        raise RuntimeError(f"Series template file is missing: {template_path}")

    html_template = template_path.read_text(encoding="utf-8")
    stylesheet_text = stylesheet_path.read_text(encoding="utf-8") if stylesheet_path.is_file() else ""
    html_template = html_template.replace('<link rel="stylesheet" href="./template.css" />', f"<style>\n{stylesheet_text}\n</style>")

    graph_uri = ""
    graph_path = series_graph_path(series)
    if graph_path.is_file():
        graph_uri = graph_path.as_uri()

    replacements = {
        "{{series.name}}": html.escape(series.name or ""),
        "{{series.product_type_label}}": html.escape(series.product_type_label or ""),
        "{{series.description1_html}}": render_richtext_html(series.description1_html),
        "{{series.description2_html}}": render_richtext_html(series.description2_html),
        "{{series.description3_html}}": render_richtext_html(series.description3_html),
        "{{series.description4_html}}": render_richtext_html(series.description4_html),
        "{{series.comments_html}}": render_richtext_html(series.description4_html),
        "{{series.template_label}}": html.escape(get_template_label(template_id or series.template_id, "series")),
        "{{series.product_count}}": html.escape(str(len(series.products or []))),
        "{{series.graph_rule_label}}": html.escape(series_graph_rule_label()),
        "{{series.graph_image_url}}": graph_uri,
        "{{series.products_summary_table}}": render_series_products_summary_table(series),
    }

    rendered = html_template
    for token, value in replacements.items():
        rendered = rendered.replace(token, value)
    return rendered


def build_series_pdf_base(series: Series, variant: str, temp_dir: Path) -> tuple[Path, int]:
    cover_base_path = temp_dir / f"series_{variant}_{series_slug(series)}_cover.pdf"
    render_pdf_from_html(build_series_pdf_html(series, variant), cover_base_path)

    product_base_paths: list[Path] = []
    for product in sorted(series.products or [], key=lambda item: (item.model or "").casefold()):
        product_base_path = temp_dir / f"product_{variant}_{product_slug(product)}_series_base.pdf"
        render_pdf_from_html(build_product_pdf_html(product, variant), product_base_path)
        product_base_paths.append(product_base_path)

    merged_base_path = temp_dir / f"series_{variant}_{series_slug(series)}_base.pdf"
    merge_pdf_files([cover_base_path, *product_base_paths], merged_base_path)
    return merged_base_path, pdf_page_count(merged_base_path)


def generate_series_pdf(series: Series, variant: str) -> Path:
    output_path = series_pdf_path(series, variant)
    with tempfile.TemporaryDirectory(prefix="series-pdf-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        base_path, page_count = build_series_pdf_base(series, variant, temp_dir)
        stamp_pdf_file(
            base_path,
            output_path,
            [
                {
                    "tab_label": series.name or "Series",
                    "tab_color": series.series_tab_color or SERIES_TAB_FALLBACK_COLOR,
                }
                for _ in range(page_count)
            ],
        )

    return output_path


def product_primary_image_uri(product: Product) -> str:
    ordered_images = sorted(product.product_images or [], key=lambda img: (img.sort_order, img.id))
    if not ordered_images:
        return ""
    first_image_path = image_file_path(ordered_images[0].file_name)
    if not first_image_path.is_file():
        return ""
    return first_image_path.as_uri()


def build_product_type_series_legend_html(series_summaries: list[dict]) -> str:
    if not series_summaries:
        return '<p class="placeholder">No series are linked to this product type yet.</p>'

    items = []
    for summary in series_summaries:
        series_name = html.escape(str(summary.get("name") or "Series"))
        series_color = html.escape(str(summary.get("series_tab_color") or SERIES_TAB_FALLBACK_COLOR))
        page_range = ""
        page_start = summary.get("page_start")
        page_end = summary.get("page_end")
        if page_start and page_end:
            page_range = f"Pages {page_start} to {page_end}"
        elif page_start:
            page_range = f"Starts at page {page_start}"
        product_count = int(summary.get("product_count") or 0)
        items.append(
            '<li class="series-legend__item">'
            f'<span class="series-legend__swatch" style="background:{series_color};"></span>'
            '<div class="series-legend__text">'
            f'<div class="series-legend__name">{series_name}</div>'
            f'<div class="series-legend__meta">{product_count} products{(" · " + html.escape(page_range)) if page_range else ""}</div>'
            "</div></li>"
        )

    return '<ul class="series-legend">' + "".join(items) + "</ul>"


def build_product_type_contents_html(product_type: ProductType, series_summaries: list[dict]) -> str:
    if not series_summaries:
        return '<p class="placeholder">No series are linked to this product type yet.</p>'

    parts: list[str] = ['<div class="product-type-contents">']
    for summary in series_summaries:
        series_name = html.escape(str(summary.get("name") or "Series"))
        series_color = html.escape(str(summary.get("series_tab_color") or SERIES_TAB_FALLBACK_COLOR))
        product_count = int(summary.get("product_count") or 0)
        product_cards: list[str] = []
        for product in summary.get("products") or []:
            product_name = html.escape(str(product.get("model") or "Product"))
            image_uri = html.escape(str(product.get("primary_product_image_uri") or ""))
            image_html = (
                f'<img src="{image_uri}" alt="{product_name}" class="product-card__image" />'
                if image_uri
                else '<div class="product-card__placeholder">No image</div>'
            )
            product_cards.append(
                '<article class="product-card">'
                f"{image_html}"
                f'<div class="product-card__name">{product_name}</div>'
                "</article>"
            )

        parts.append(
            '<section class="series-group" '
            f'style="--series-accent: {series_color};">'
            '<div class="series-group__header">'
            f'<h3 class="series-group__title">{series_name}</h3>'
            f'<div class="series-group__meta">{product_count} products</div>'
            "</div>"
            '<div class="series-group__grid">'
            + "".join(product_cards)
            + "</div></section>"
        )

    parts.append("</div>")
    return "".join(parts)


def build_product_type_pdf_html(product_type: ProductType, contents_html: str, series_legend_html: str) -> str:
    template_definition = get_template_definition("product_type-default", "product_type")
    if template_definition is None:
        raise RuntimeError("No product type PDF template is configured.")

    project_root = Path(__file__).resolve().parents[1]
    template_path = project_root / template_definition["path"]
    stylesheet_path = project_root / template_definition.get("stylesheet", "")
    if not template_path.is_file():
        raise RuntimeError(f"Product type template file is missing: {template_path}")

    html_template = template_path.read_text(encoding="utf-8")
    stylesheet_text = stylesheet_path.read_text(encoding="utf-8") if stylesheet_path.is_file() else ""
    html_template = html_template.replace('<link rel="stylesheet" href="./template.css" />', f"<style>\n{stylesheet_text}\n</style>")

    replacements = {
        "{{product_type.key}}": html.escape(product_type.key or ""),
        "{{product_type.label}}": html.escape(product_type.label or ""),
        "{{product_type.series_names}}": html.escape(", ".join(product_type.series_names or [])),
        "{{product_type.series_legend_html}}": series_legend_html,
        "{{product_type.contents_html}}": contents_html,
    }

    rendered = html_template
    for token, value in replacements.items():
        rendered = rendered.replace(token, value)
    return rendered


def build_product_type_pdf_base(product_type: ProductType, temp_dir: Path) -> tuple[Path, dict]:
    ordered_series = sorted(product_type.series or [], key=lambda item: (item.name or "").casefold())
    series_summaries: list[dict] = []
    series_base_paths: list[Path] = []

    for series in ordered_series:
        series_base_path, series_page_count = build_series_pdf_base(series, "printed", temp_dir)
        series_base_paths.append(series_base_path)
        series_summaries.append(
            {
                "id": series.id,
                "name": series.name,
                "series_tab_color": series.series_tab_color or SERIES_TAB_FALLBACK_COLOR,
                "page_count": series_page_count,
                "product_count": len(series.products or []),
                "products": [
                    {
                        "id": product.id,
                        "model": product.model,
                        "series_id": product.series_id,
                        "series_name": product.series_name_value,
                        "product_type_key": product.product_type_key,
                        "product_type_label": product.product_type_label,
                        "primary_product_image_uri": product_primary_image_uri(product),
                    }
                    for product in sorted(series.products or [], key=lambda item: (item.model or "").casefold())
                ],
            }
        )

    contents_html = build_product_type_contents_html(product_type, series_summaries)
    series_legend_html = build_product_type_series_legend_html(series_summaries)
    intro_base_path = temp_dir / f"product_type_printed_{sanitize_name(product_type.key or product_type.label or 'unknown')}_intro.pdf"
    render_pdf_from_html(build_product_type_pdf_html(product_type, contents_html, series_legend_html), intro_base_path)
    intro_page_count = pdf_page_count(intro_base_path)

    page_start = intro_page_count + 1
    for summary in series_summaries:
        page_end = page_start + summary["page_count"] - 1
        summary["page_start"] = page_start
        summary["page_end"] = page_end
        page_start = page_end + 1

    merged_base_path = temp_dir / f"product_type_printed_{sanitize_name(product_type.key or product_type.label or 'unknown')}_base.pdf"
    merge_pdf_files([intro_base_path, *series_base_paths], merged_base_path)
    return merged_base_path, {
        "intro_page_count": intro_page_count,
        "page_count": pdf_page_count(merged_base_path),
        "series_summaries": series_summaries,
        "contents_html": contents_html,
        "series_legend_html": series_legend_html,
    }


def build_product_type_page_decorations(metadata: dict) -> list[dict]:
    decorations: list[dict] = []
    series_summaries = metadata.get("series_summaries") or []
    series_tabs = [
        {
            "series_id": summary.get("id"),
            "tab_label": summary.get("name") or "Series",
            "tab_color": summary.get("series_tab_color") or SERIES_TAB_FALLBACK_COLOR,
        }
        for summary in series_summaries
    ]

    for _ in range(int(metadata.get("intro_page_count") or 0)):
        decorations.append(
            {
                "tabs": [
                    {**tab, "tab_opacity": 0.2}
                    for tab in series_tabs
                ]
            }
        )

    for active_summary in series_summaries:
        active_id = active_summary.get("id")
        page_count = int(active_summary.get("page_count") or 0)
        for _ in range(page_count):
            decorations.append(
                {
                    "tabs": [
                        {
                            **tab,
                            "tab_opacity": 1.0 if tab.get("series_id") == active_id else 0.2,
                        }
                        for tab in series_tabs
                    ]
                }
            )

    return decorations


def generate_product_type_pdf(product_type: ProductType) -> Path:
    output_path = product_type_pdf_path(product_type, "printed")
    with tempfile.TemporaryDirectory(prefix="product-type-pdf-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        base_path, metadata = build_product_type_pdf_base(product_type, temp_dir)
        page_decorations = build_product_type_page_decorations(metadata)
        stamp_pdf_file(base_path, output_path, page_decorations)
    return output_path


def delete_product_image_file(image: ProductImage):
    remove_file(image_file_path(image.file_name))


def build_graph_config(product_type: ProductType | None) -> dict:
    return {
        "graph_kind": product_type.graph_kind if product_type else "fan_map",
        "supports_graph_overlays": product_type.supports_graph_overlays if product_type else True,
        "supports_band_graph_style": product_type.supports_band_graph_style if product_type else True,
        "graph_line_value_label": product_type.graph_line_value_label if product_type else "RPM",
        "graph_line_value_unit": product_type.graph_line_value_unit if product_type else "RPM",
        "graph_x_axis_label": product_type.graph_x_axis_label if product_type else "Airflow",
        "graph_x_axis_unit": product_type.graph_x_axis_unit if product_type else "L/s",
        "graph_y_axis_label": product_type.graph_y_axis_label if product_type else "Pressure",
        "graph_y_axis_unit": product_type.graph_y_axis_unit if product_type else "Pa",
    }


def parse_parameter_filters(raw_filters: str | None) -> list[dict]:
    if not raw_filters:
        return []

    try:
        decoded = json.loads(raw_filters)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid parameter_filters JSON: {exc.msg}") from exc

    if not isinstance(decoded, list):
        raise HTTPException(status_code=400, detail="parameter_filters must be a JSON array")

    normalized_filters: list[dict] = []
    for item in decoded:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="Each parameter filter must be an object")

        group_name = str(item.get("group_name", "")).strip()
        parameter_name = str(item.get("parameter_name", "")).strip()
        value_string = item.get("value_string")
        min_number = item.get("min_number")
        max_number = item.get("max_number")

        if not group_name or not parameter_name:
            raise HTTPException(status_code=400, detail="Each parameter filter must include group_name and parameter_name")

        try:
            normalized = {
                "group_name": group_name,
                "parameter_name": parameter_name,
                "value_string": str(value_string).strip() if value_string not in {None, ""} else None,
                "min_number": float(min_number) if min_number not in {None, ""} else None,
                "max_number": float(max_number) if max_number not in {None, ""} else None,
            }
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="parameter_filters numeric bounds must be valid numbers") from exc

        if normalized["value_string"] is None and normalized["min_number"] is None and normalized["max_number"] is None:
            raise HTTPException(
                status_code=400,
                detail="Each parameter filter must include value_string or at least one numeric bound",
            )

        if (
            normalized["min_number"] is not None and
            normalized["max_number"] is not None and
            normalized["min_number"] > normalized["max_number"]
        ):
            raise HTTPException(status_code=400, detail="parameter_filters numeric min cannot be greater than max")

        normalized_filters.append(normalized)

    return normalized_filters


def graph_filter_values(product: Product) -> dict[str, list[float]]:
    rpm_values: set[float] = set()
    airflow_values: set[float] = set()
    pressure_values: set[float] = set()

    for rpm_line in product.rpm_lines or []:
        if rpm_line.rpm is not None:
            rpm_values.add(float(rpm_line.rpm))
        for point in rpm_line.points or []:
            if point.airflow is not None:
                airflow_values.add(float(point.airflow))
            if point.pressure is not None:
                pressure_values.add(float(point.pressure))

    for point in product.efficiency_points or []:
        if point.airflow is not None:
            airflow_values.add(float(point.airflow))

    return {
        "rpm": sorted(rpm_values),
        "airflow": sorted(airflow_values),
        "pressure": sorted(pressure_values),
    }


def graph_filter_values_for_products(products: list[Product]) -> dict[str, list[float]]:
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


def value_in_window(value: float, minimum: float | None, maximum: float | None) -> bool:
    if minimum is not None and value < minimum:
        return False
    if maximum is not None and value > maximum:
        return False
    return True


def product_matches_parameter_filters(product: Product, parameter_filters: list[dict]) -> bool:
    if not parameter_filters:
        return True

    grouped_parameters: dict[tuple[str, str], list[ProductParameter]] = {}
    for group in product.parameter_groups:
            group_name = (group.group_name or "").strip().casefold()
            for parameter in group.parameters:
                parameter_name = (parameter.parameter_name or "").strip().casefold()
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
            if not graph_metric_values:
                return False
            if not any(value_in_window(metric_value, min_number, max_number) for metric_value in graph_metric_values):
                return False
            continue

        matching_parameters = grouped_parameters.get(filter_key, [])
        if not matching_parameters:
            return False

        value_string = filter_item.get("value_string")
        min_number = filter_item.get("min_number")
        max_number = filter_item.get("max_number")

        matched = False
        for parameter in matching_parameters:
            if value_string is not None:
                if (parameter.value_string or "").strip().casefold() == value_string.casefold():
                    matched = True
                    break
                continue

            if parameter.value_number is None:
                continue

            if value_in_window(parameter.value_number, min_number, max_number):
                matched = True
                break

        if not matched:
            return False

    return True


def sync_graph_image(product: Product, rpm_lines: list[RpmLine], efficiency_points: list[EfficiencyPoint]):
    rpm_point_list = sorted(
        [point for rpm_line in rpm_lines for point in rpm_line.points],
        key=lambda point: (point.rpm or 0, point.airflow),
    )
    efficiency_point_list = sorted(efficiency_points, key=lambda point: point.airflow)
    previous_path = Path(product.graph_image_path) if product.graph_image_path else None

    if not rpm_point_list and not efficiency_point_list:
        if previous_path:
            remove_file(previous_path)
        product.graph_image_path = None
        return

    final_path = PRODUCT_GRAPHS_DIR / graph_file_name(product)
    tmp_path = PRODUCT_GRAPHS_DIR / f"tmp_{graph_file_name(product)}"
    if tmp_path.exists():
        tmp_path.unlink()

    payload = {
        "title": f"{product.model} Product Graph",
        "showRpmBandShading": product.show_rpm_band_shading,
        "graphConfig": build_graph_config(product.product_type),
        "graphStyle": {
            "band_graph_background_color": product.band_graph_background_color,
            "band_graph_label_text_color": product.band_graph_label_text_color,
            "band_graph_faded_opacity": product.band_graph_faded_opacity,
            "band_graph_permissible_label_color": product.band_graph_permissible_label_color,
        },
        "rpmLines": [
            {
                "id": line.id,
                "product_id": line.product_id,
                "rpm": line.rpm,
                "band_color": line.band_color,
            }
            for line in sorted(rpm_lines, key=lambda line: line.rpm)
        ],
        "rpmPoints": [
            {
                "id": point.id,
                "product_id": point.product_id,
                "rpm_line_id": point.rpm_line_id,
                "rpm": point.rpm,
                "airflow": point.airflow,
                "pressure": point.pressure,
            }
            for point in rpm_point_list
        ],
        "efficiencyPoints": [
            {
                "id": point.id,
                "product_id": point.product_id,
                "airflow": point.airflow,
                "efficiency_centre": point.efficiency_centre,
                "efficiency_lower_end": point.efficiency_lower_end,
                "efficiency_higher_end": point.efficiency_higher_end,
                "permissible_use": point.permissible_use,
            }
            for point in efficiency_point_list
        ],
    }

    result = subprocess.run(
        ["node", str(ECHARTS_RENDER_SCRIPT), str(tmp_path)],
        cwd=str(FRONTEND_DIR),
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "ECharts graph render failed: "
            + (result.stderr.strip() or result.stdout.strip() or f"exit code {result.returncode}")
        )

    if previous_path and previous_path != final_path:
        remove_file(previous_path)
    shutil.move(tmp_path, final_path)
    product.graph_image_path = str(final_path)


def delete_product_assets(product: Product):
    for image in product.product_images:
        delete_product_image_file(image)
    if product.graph_image_path:
        remove_file(product.graph_image_path)


def refresh_graph_for_product(db: Session, product: Product):
    db.refresh(product)
    sync_graph_image(product, list(product.rpm_lines), list(product.efficiency_points))


def clear_all_graph_images(db: Session) -> int:
    deleted_files = 0
    for graph_file in PRODUCT_GRAPHS_DIR.iterdir():
        if not graph_file.is_file():
            continue
        graph_file.unlink(missing_ok=True)
        deleted_files += 1

    for product in db.query(Product).all():
        product.graph_image_path = None

    return deleted_files


def require_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    return product


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_HASH_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iteration_text, salt_hex, expected_hex = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iteration_text)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(expected_hex)
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return secrets.compare_digest(actual, expected)


def ensure_auth_config():
    missing = []
    if not SESSION_SECRET:
        missing.append("SESSION_SECRET")
    if missing:
        raise RuntimeError(
            "Authentication is enabled but required environment variables are missing: "
            + ", ".join(missing)
        )


def ensure_bootstrap_admin():
    with SessionLocal() as db:
        existing_user = db.query(User).first()
        if existing_user is not None:
            return
        if not BOOTSTRAP_ADMIN_USERNAME or not BOOTSTRAP_ADMIN_PASSWORD:
            raise RuntimeError(
                "No users exist yet. Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD "
                "so the first admin account can be created."
            )
        admin_user = User(
            username=BOOTSTRAP_ADMIN_USERNAME,
            password_hash=hash_password(BOOTSTRAP_ADMIN_PASSWORD),
            is_admin=True,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()


def is_authenticated(request: Request) -> bool:
    return request.session.get("authenticated") is True and request.session.get("user_id") is not None


def get_authenticated_user_id(request: Request) -> Optional[int]:
    user_id = request.session.get("user_id")
    return int(user_id) if user_id is not None else None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = get_authenticated_user_id(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        request.session.clear()
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_cms_token(request: Request):
    if not CMS_API_TOKEN:
        raise HTTPException(status_code=503, detail="CMS API token is not configured")

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        provided_token = auth_header[7:].strip()
    else:
        provided_token = request.headers.get("X-CMS-Token", "").strip()

    if not provided_token or not secrets.compare_digest(provided_token, CMS_API_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid CMS token")


def active_admin_count(db: Session) -> int:
    return db.query(User).filter(User.is_admin.is_(True), User.is_active.is_(True)).count()


def postgres_cli_database_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    if DATABASE_URL.startswith("postgresql+psycopg://"):
        return "postgresql://" + DATABASE_URL[len("postgresql+psycopg://"):]
    return DATABASE_URL


def wordpress_available() -> bool:
    return bool(WORDPRESS_DB_NAME and WORDPRESS_DB_USER and WORDPRESS_DB_PASSWORD and WORDPRESS_DB_ROOT_PASSWORD)


def run_command(command: list[str], *, input_bytes: bytes | None = None):
    result = subprocess.run(command, input=input_bytes, capture_output=True, check=False)
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="ignore").strip()
        stdout = result.stdout.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(stderr or stdout or f"Command failed: {' '.join(command)}")
    return result


def postgres_tool_database_url() -> str:
    return postgres_cli_database_url()


def container_runtime_binary() -> str | None:
    for candidate in ("podman", "docker"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def run_postgres_client_tool(arguments: list[str], *, input_bytes: bytes | None = None):
    tool_name = arguments[0]
    if shutil.which(tool_name):
        direct_command = [tool_name, postgres_tool_database_url(), *arguments[1:]]
        return run_command(direct_command, input_bytes=input_bytes)

    runtime = container_runtime_binary()
    if not runtime:
        raise RuntimeError(
            f"{tool_name} is not installed and no container runtime (podman/docker) is available for fallback."
        )

    container_command = [
        runtime,
        "run",
        "--rm",
        "--network",
        "host",
        "-e",
        f"DATABASE_URL={postgres_tool_database_url()}",
        POSTGRES_CLIENT_IMAGE,
        "sh",
        "-lc",
        " ".join([tool_name, '"$DATABASE_URL"'] + [shlex.quote(arg) for arg in arguments[1:]]),
    ]
    return run_command(container_command, input_bytes=input_bytes)


def utc_now_iso() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def create_maintenance_job(job_type: str) -> dict:
    job_id = uuid4().hex
    job = {
        "id": job_id,
        "job_type": job_type,
        "status": "queued",
        "progress_message": "Queued",
        "progress_current": None,
        "progress_total": None,
        "progress_percent": None,
        "error": None,
        "result_message": None,
        "result_download_url": None,
        "created_at": utc_now_iso(),
        "started_at": None,
        "completed_at": None,
    }
    with MAINTENANCE_JOBS_LOCK:
        MAINTENANCE_JOBS[job_id] = job
    return job


def update_maintenance_job(job_id: str, **updates):
    with MAINTENANCE_JOBS_LOCK:
        job = MAINTENANCE_JOBS.get(job_id)
        if not job:
            return
        job.update(updates)


def get_maintenance_job_or_404(job_id: str) -> dict:
    with MAINTENANCE_JOBS_LOCK:
        job = MAINTENANCE_JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Maintenance job not found")
        return dict(job)


def serialize_maintenance_job(job: dict) -> MaintenanceJobResponse:
    return MaintenanceJobResponse(**job)


def start_maintenance_job(job_type: str, work):
    job = create_maintenance_job(job_type)

    def runner():
        update_maintenance_job(job["id"], status="running", started_at=utc_now_iso(), progress_message="Starting")

        def progress(message: str, current: int | None = None, total: int | None = None):
            updates = {"progress_message": message}
            if current is not None:
                updates["progress_current"] = current
            if total is not None:
                updates["progress_total"] = total
            if current is not None and total not in (None, 0):
                updates["progress_percent"] = round((current / total) * 100, 1)
            elif total == 0:
                updates["progress_percent"] = 100.0
            update_maintenance_job(job["id"], **updates)

        try:
            result = work(progress) or {}
            result_updates = dict(result)
            result_updates.setdefault("progress_message", result.get("progress_message") or "Completed")
            result_updates.setdefault("result_message", result.get("result_message"))
            result_updates.setdefault("result_download_url", result.get("result_download_url"))
            result_updates["status"] = "completed"
            result_updates["completed_at"] = utc_now_iso()
            update_maintenance_job(job["id"], **result_updates)
        except Exception as exc:
            logger.exception("Maintenance job failed: %s", job_type)
            update_maintenance_job(
                job["id"],
                status="failed",
                error=str(exc),
                progress_message="Failed",
                completed_at=utc_now_iso(),
            )

    thread = threading.Thread(target=runner, daemon=True, name=f"maintenance-{job['id']}")
    thread.start()
    return job


def create_backup_bundle(progress_callback=None) -> Path:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_name = f"fan_graphs_backup_{timestamp}.zip"
    archive_path = BACKUP_OUTPUT_DIR / archive_name
    backup_stages_total = 8

    with tempfile.TemporaryDirectory() as staging_dir_raw:
        staging_dir = Path(staging_dir_raw)
        postgres_dump_path = staging_dir / "postgres_dump.sql"
        if progress_callback:
            progress_callback("Creating PostgreSQL dump", 1, backup_stages_total)
        postgres_dump = run_postgres_client_tool(
            ["pg_dump", "--no-owner", "--no-privileges"]
        )
        postgres_dump_path.write_bytes(postgres_dump.stdout)

        for offset, media_dir in enumerate([PRODUCT_IMAGES_DIR, PRODUCT_GRAPHS_DIR, PRODUCT_PDFS_DIR, SERIES_GRAPHS_DIR, SERIES_PDFS_DIR], start=2):
            if media_dir.is_dir():
                if progress_callback:
                    progress_callback(f"Collecting {media_dir.name}", offset, backup_stages_total)
                target_dir = staging_dir / "data" / media_dir.name
                target_dir.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(media_dir, target_dir, dirs_exist_ok=True)

        if wordpress_available():
            wordpress_dump_path = staging_dir / "wordpress_dump.sql"
            if progress_callback:
                progress_callback("Creating WordPress database dump", 7, backup_stages_total)
            wordpress_dump = run_command(
                [
                    "mariadb-dump",
                    "-h",
                    "wordpress_db",
                    "-u",
                    WORDPRESS_DB_USER,
                    f"-p{WORDPRESS_DB_PASSWORD}",
                    WORDPRESS_DB_NAME,
                ]
            )
            wordpress_dump_path.write_bytes(wordpress_dump.stdout)

            wp_content_dir = WORDPRESS_SITE_DIR / "wp-content"
            if wp_content_dir.is_dir():
                if progress_callback:
                    progress_callback("Collecting WordPress content", 7, backup_stages_total)
                wordpress_dir = staging_dir / "wordpress"
                wordpress_dir.mkdir(parents=True, exist_ok=True)
                with tarfile.open(wordpress_dir / "wp-content.tar", "w") as tar:
                    tar.add(wp_content_dir, arcname="wp-content")

        readme = staging_dir / "README.txt"
        readme.write_text(
            "\n".join(
                [
                    "Internal Facing backup bundle",
                    "Generated by the admin maintenance API.",
                    "",
                    "Contents:",
                    "- postgres_dump.sql : PostgreSQL database dump",
                    "- data/product_images : uploaded product images (if present)",
                    "- data/product_graphs : generated graph images (if present)",
                    "- data/product_pdfs : generated product PDF assets (if present)",
                    "- data/product_type_pdfs : generated product type PDF assets (if present)",
                    "- data/series_graphs : generated series graph images (if present)",
                    "- data/series_pdfs : generated series PDF assets (if present)",
                    "- wordpress_dump.sql : WordPress MariaDB dump (if present)",
                    "- wordpress/wp-content.tar : WordPress content snapshot (if present)",
                ]
            ),
            encoding="utf-8",
        )

        if progress_callback:
            progress_callback("Creating backup archive", 8, backup_stages_total)
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for root, _, files in os.walk(staging_dir):
                for file_name in files:
                    full_path = Path(root) / file_name
                    archive.write(full_path, full_path.relative_to(staging_dir))

    return archive_path


def restore_backup_bundle(archive_bytes: bytes, progress_callback=None):
    restore_stages_total = 9
    with tempfile.TemporaryDirectory() as staging_dir_raw:
        staging_dir = Path(staging_dir_raw)
        archive_path = staging_dir / "upload.zip"
        archive_path.write_bytes(archive_bytes)
        if progress_callback:
            progress_callback("Extracting backup archive", 1, restore_stages_total)
        with zipfile.ZipFile(archive_path, "r") as archive:
            archive.extractall(staging_dir)

        postgres_dump_path = staging_dir / "postgres_dump.sql"
        if not postgres_dump_path.is_file():
            raise RuntimeError("Backup archive does not contain postgres_dump.sql")

        if progress_callback:
            progress_callback("Resetting PostgreSQL schema", 2, restore_stages_total)
        run_postgres_client_tool(
            [
                "psql",
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid(); DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO {POSTGRES_USER}; GRANT ALL ON SCHEMA public TO public;",
            ]
        )
        if progress_callback:
            progress_callback("Importing PostgreSQL dump", 3, restore_stages_total)
        run_postgres_client_tool(
            ["psql", "-v", "ON_ERROR_STOP=1"],
            input_bytes=postgres_dump_path.read_bytes(),
        )

        wordpress_dump_path = staging_dir / "wordpress_dump.sql"
        wordpress_content_tar = staging_dir / "wordpress" / "wp-content.tar"
        if wordpress_available() and wordpress_dump_path.is_file():
            if progress_callback:
                progress_callback("Restoring WordPress database", 4, restore_stages_total)
            run_command(
                [
                    "mariadb",
                    "-h",
                    "wordpress_db",
                    "-u",
                    "root",
                    f"-p{WORDPRESS_DB_ROOT_PASSWORD}",
                    "-e",
                    (
                        f"DROP DATABASE IF EXISTS `{WORDPRESS_DB_NAME}`; "
                        f"CREATE DATABASE `{WORDPRESS_DB_NAME}`; "
                        f"GRANT ALL PRIVILEGES ON `{WORDPRESS_DB_NAME}`.* TO '{WORDPRESS_DB_USER}'@'%'; "
                        "FLUSH PRIVILEGES;"
                    ),
                ]
            )
            run_command(
                [
                    "mariadb",
                    "-h",
                    "wordpress_db",
                    "-u",
                    "root",
                    f"-p{WORDPRESS_DB_ROOT_PASSWORD}",
                    WORDPRESS_DB_NAME,
                ],
                input_bytes=wordpress_dump_path.read_bytes(),
            )

        if wordpress_content_tar.is_file():
            if progress_callback:
                progress_callback("Restoring WordPress content", 5, restore_stages_total)
            wp_content_dir = WORDPRESS_SITE_DIR / "wp-content"
            shutil.rmtree(wp_content_dir, ignore_errors=True)
            with tarfile.open(wordpress_content_tar, "r") as tar:
                tar.extractall(WORDPRESS_SITE_DIR)

        for offset, media_dir in enumerate(
            ["product_images", "product_graphs", "product_pdfs", "product_type_pdfs", "series_graphs", "series_pdfs"],
            start=4,
        ):
            if progress_callback:
                progress_callback(f"Restoring {media_dir}", min(offset, restore_stages_total - 1), restore_stages_total)
            source_dir = staging_dir / "data" / media_dir
            target_dir = Path(DEFAULT_DATA_DIR) / media_dir
            shutil.rmtree(target_dir, ignore_errors=True)
            target_dir.mkdir(parents=True, exist_ok=True)
            if source_dir.is_dir():
                shutil.copytree(source_dir, target_dir, dirs_exist_ok=True)


def run_post_restore_schema_prep(progress_callback=None):
    if progress_callback:
        progress_callback("Running database migrations", 9, 9)
    from backend.db_management import prepare_configured_databases

    prepare_configured_databases()
    init_db()


OPENAPI_TAGS = [
    {
        "name": "Public",
        "description": "Unauthenticated health and authentication bootstrap endpoints.",
    },
    {
        "name": "Authentication",
        "description": "Staff login and session management endpoints.",
    },
    {
        "name": "Users",
        "description": "Staff user administration endpoints.",
    },
    {
        "name": "Customer CMS",
        "description": "Read-only product data endpoints used by the WordPress customer-facing site via the CMS bearer token.",
    },
    {
        "name": "Customer Media",
        "description": "Public customer-facing product image and graph file endpoints intended for rendered website pages.",
    },
    {
        "name": "Products",
        "description": "Product catalogue CRUD endpoints for the internal app.",
    },
    {
        "name": "Product Types",
        "description": "Product type definitions and seeded parameter preset libraries.",
    },
    {
        "name": "Series",
        "description": "Series records that group products within a product type.",
    },
    {
        "name": "Templates",
        "description": "Controlled-list template definitions used for product and series PDF/layout selection.",
    },
    {
        "name": "RPM Lines",
        "description": "RPM line management for a graph-capable product.",
    },
    {
        "name": "RPM Points",
        "description": "RPM curve point management for a graph-capable product.",
    },
    {
        "name": "Efficiency Points",
        "description": "Efficiency curve point management for a graph-capable product.",
    },
    {
        "name": "Product Images",
        "description": "Product image upload, ordering, and deletion endpoints.",
    },
    {
        "name": "Media",
        "description": "Protected internal media endpoints for staff-only direct access.",
    },
    {
        "name": "Maintenance",
        "description": "Operational and data maintenance endpoints.",
    },
]

app = FastAPI(
    title="Internal Facing API",
    description=(
        "Product platform API for the Internal Facing application.\n\n"
        "Use `/api/products...` for the internal staff application.\n"
        "Use `/api/cms/products...` for the customer-facing WordPress integration.\n"
        "Use `/api/cms/media/...` for public customer-facing product images and graph files.\n"
        "Legacy `/api/fans...` and `/api/cms/fans...` aliases still work, but they are intentionally hidden from the schema."
    ),
    openapi_tags=OPENAPI_TAGS,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET or "dev-session-secret-change-me",
    same_site="lax",
    https_only=AUTH_COOKIE_SECURE,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://xps.local:8001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    ensure_auth_config()
    init_db()
    ensure_bootstrap_admin()


# --- Health ---
@app.get("/api/health", tags=["Public"])
def health():
    return {"ok": True}


@app.get("/openapi.json", dependencies=[Depends(get_current_user)])
def openapi_schema():
    return app.openapi()


@app.get("/docs", include_in_schema=False, dependencies=[Depends(get_current_user)])
def swagger_ui():
    return get_swagger_ui_html(openapi_url="/openapi.json", title="Internal Facing API Docs")


@app.get("/api/product-types", response_model=list[ProductTypeResponse], dependencies=[Depends(get_current_user)], tags=["Product Types"])
def list_product_types(db: Session = Depends(get_db)):
    return (
        db.query(ProductType)
        .options(
            selectinload(ProductType.series),
            selectinload(ProductType.parameter_group_presets).selectinload(
                ProductTypeParameterGroupPreset.parameter_presets
            ),
            selectinload(ProductType.rpm_line_presets).selectinload(ProductTypeRpmLinePreset.point_presets),
            selectinload(ProductType.efficiency_point_presets),
        )
        .order_by(ProductType.label)
        .all()
    )


@app.get(
    "/api/cms/product-types",
    response_model=list[ProductTypeResponse],
    dependencies=[Depends(require_cms_token)],
    tags=["Customer CMS"],
    summary="List customer-facing product types",
    description="Read-only product-type feed for the WordPress customer-facing site.",
)
def list_cms_product_types(db: Session = Depends(get_db)):
    return (
        db.query(ProductType)
        .options(
            selectinload(ProductType.series),
            selectinload(ProductType.parameter_group_presets).selectinload(
                ProductTypeParameterGroupPreset.parameter_presets
            ),
            selectinload(ProductType.rpm_line_presets).selectinload(ProductTypeRpmLinePreset.point_presets),
            selectinload(ProductType.efficiency_point_presets),
        )
        .order_by(ProductType.label)
        .all()
    )


@app.post("/api/product-types", response_model=ProductTypeResponse, dependencies=[Depends(get_current_user)], tags=["Product Types"])
def create_product_type(body: ProductTypeCreate, db: Session = Depends(get_db)):
    label = (body.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Product type label is required.")

    key = sanitize_name((body.key or "").strip() or label)
    if not key:
        raise HTTPException(status_code=400, detail="Product type key is required.")

    existing = db.query(ProductType).filter(ProductType.key == key).first()
    if existing:
        raise HTTPException(status_code=400, detail="A product type with that key already exists.")

    printed_product_template_id, online_product_template_id = resolve_template_pair(
        "product",
        body.product_template_id,
        body.printed_product_template_id,
        body.online_product_template_id,
    )

    product_type = ProductType(
        key=key,
        label=label,
        supports_graph=bool(body.supports_graph),
        graph_kind=(body.graph_kind or "").strip() or None,
        supports_graph_overlays=bool(body.supports_graph_overlays),
        supports_band_graph_style=bool(body.supports_band_graph_style),
        graph_line_value_label=(body.graph_line_value_label or "").strip() or None,
        graph_line_value_unit=(body.graph_line_value_unit or "").strip() or None,
        graph_x_axis_label=(body.graph_x_axis_label or "").strip() or None,
        graph_x_axis_unit=(body.graph_x_axis_unit or "").strip() or None,
        graph_y_axis_label=(body.graph_y_axis_label or "").strip() or None,
        graph_y_axis_unit=(body.graph_y_axis_unit or "").strip() or None,
        printed_product_template_id=printed_product_template_id,
        online_product_template_id=online_product_template_id,
        product_template_id=online_product_template_id or printed_product_template_id,
        band_graph_background_color=normalize_color_value(body.band_graph_background_color),
        band_graph_label_text_color=normalize_color_value(body.band_graph_label_text_color),
        band_graph_faded_opacity=None if body.band_graph_faded_opacity is None else max(0, min(1, float(body.band_graph_faded_opacity))),
        band_graph_permissible_label_color=normalize_color_value(body.band_graph_permissible_label_color),
    )
    db.add(product_type)
    db.commit()
    db.refresh(product_type)
    return product_type


@app.put("/api/product-types/{product_type_id}", response_model=ProductTypeResponse, dependencies=[Depends(get_current_user)], tags=["Product Types"])
def update_product_type(product_type_id: int, body: ProductTypeUpdate, db: Session = Depends(get_db)):
    product_type = db.query(ProductType).filter(ProductType.id == product_type_id).first()
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found.")

    updates = body.model_dump(exclude_unset=True)

    if "key" in updates:
        new_key = sanitize_name((updates.get("key") or "").strip())
        if not new_key:
            raise HTTPException(status_code=400, detail="Product type key cannot be blank.")
        duplicate = db.query(ProductType).filter(ProductType.key == new_key, ProductType.id != product_type_id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="A product type with that key already exists.")
        product_type.key = new_key

    if "label" in updates:
        label = (updates.get("label") or "").strip()
        if not label:
            raise HTTPException(status_code=400, detail="Product type label cannot be blank.")
        product_type.label = label

    if any(field in updates for field in ("product_template_id", "printed_product_template_id", "online_product_template_id")):
        printed_product_template_id, online_product_template_id = resolve_template_pair(
            "product",
            updates.pop("product_template_id", None),
            updates.pop("printed_product_template_id", None),
            updates.pop("online_product_template_id", None),
        )
        if body.model_fields_set.intersection({"product_template_id", "printed_product_template_id"}):
            product_type.printed_product_template_id = printed_product_template_id
        if body.model_fields_set.intersection({"product_template_id", "online_product_template_id"}):
            product_type.online_product_template_id = online_product_template_id
        product_type.product_template_id = (
            product_type.online_product_template_id
            or product_type.printed_product_template_id
        )

    for field in [
        "supports_graph",
        "supports_graph_overlays",
        "supports_band_graph_style",
        "graph_kind",
        "graph_line_value_label",
        "graph_line_value_unit",
        "graph_x_axis_label",
        "graph_x_axis_unit",
        "graph_y_axis_label",
        "graph_y_axis_unit",
        "band_graph_background_color",
        "band_graph_label_text_color",
        "band_graph_faded_opacity",
        "band_graph_permissible_label_color",
    ]:
        if field in updates:
            value = updates[field]
            if isinstance(value, str):
                value = value.strip() or None
            if field in {"band_graph_background_color", "band_graph_label_text_color", "band_graph_permissible_label_color"}:
                value = normalize_color_value(value)
            elif field == "band_graph_faded_opacity":
                value = None if value is None else max(0, min(1, float(value)))
            setattr(product_type, field, value)

    db.commit()
    db.refresh(product_type)
    return product_type


@app.put(
    "/api/product-types/{product_type_id}/parameter-group-presets",
    response_model=ProductTypeResponse,
    dependencies=[Depends(get_current_user)],
    tags=["Product Types"],
    summary="Replace presets for a product type",
)
def update_product_type_parameter_group_presets(
    product_type_id: int,
    body: ProductTypePresetUpdate,
    db: Session = Depends(get_db),
):
    product_type = (
        db.query(ProductType)
        .options(
            selectinload(ProductType.parameter_group_presets).selectinload(
                ProductTypeParameterGroupPreset.parameter_presets
            ),
            selectinload(ProductType.rpm_line_presets).selectinload(ProductTypeRpmLinePreset.point_presets),
            selectinload(ProductType.efficiency_point_presets),
        )
        .filter(ProductType.id == product_type_id)
        .first()
    )
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found.")

    apply_product_type_presets(
        product_type,
        body.parameter_group_presets,
        body.rpm_line_presets,
        body.efficiency_point_presets,
        body.product_template_id,
        body.printed_product_template_id,
        body.online_product_template_id,
    )
    db.commit()
    db.refresh(product_type)
    return product_type


@app.get(
    "/api/product-types/{product_type_id}/pdf-context",
    response_model=ProductTypePdfResponse,
    dependencies=[Depends(get_current_user)],
    tags=["Product Types"],
    summary="Inspect the product type PDF data context",
)
def get_product_type_pdf_context(product_type_id: int, db: Session = Depends(get_db)):
    product_type = (
        db.query(ProductType)
        .options(
            selectinload(ProductType.series)
            .selectinload(Series.products)
            .selectinload(Product.product_images),
            selectinload(ProductType.series).selectinload(Series.products).selectinload(Product.product_type),
            selectinload(ProductType.series).selectinload(Series.products).selectinload(Product.series),
        )
        .filter(ProductType.id == product_type_id)
        .first()
    )
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found.")

    with tempfile.TemporaryDirectory(prefix="product-type-context-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        _, metadata = build_product_type_pdf_base(product_type, temp_dir)

    return ProductTypePdfResponse(
        id=product_type.id,
        key=product_type.key,
        label=product_type.label,
        series_names=product_type.series_names,
        contents_html=metadata["contents_html"],
        intro_page_count=metadata["intro_page_count"],
        page_count=metadata["page_count"],
        product_type_pdf_url=product_type.product_type_pdf_url,
        product_type_printed_pdf_url=product_type.product_type_printed_pdf_url,
        series=metadata["series_summaries"],
    )


@app.post(
    "/api/product-types/{product_type_id}/pdf/refresh",
    response_model=ProductTypePdfResponse,
    dependencies=[Depends(get_current_user)],
    tags=["Product Types"],
    summary="Generate the product type PDF",
)
def refresh_product_type_pdf(product_type_id: int, db: Session = Depends(get_db)):
    product_type = (
        db.query(ProductType)
        .options(
            selectinload(ProductType.series)
            .selectinload(Series.products)
            .selectinload(Product.product_images),
            selectinload(ProductType.series).selectinload(Series.products).selectinload(Product.product_type),
            selectinload(ProductType.series).selectinload(Series.products).selectinload(Product.series),
        )
        .filter(ProductType.id == product_type_id)
        .first()
    )
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found.")

    try:
        generate_product_type_pdf(product_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to generate product type PDF: {exc}") from exc

    with tempfile.TemporaryDirectory(prefix="product-type-context-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        _, metadata = build_product_type_pdf_base(product_type, temp_dir)

    db.refresh(product_type)
    return ProductTypePdfResponse(
        id=product_type.id,
        key=product_type.key,
        label=product_type.label,
        series_names=product_type.series_names,
        contents_html=metadata["contents_html"],
        intro_page_count=metadata["intro_page_count"],
        page_count=metadata["page_count"],
        product_type_pdf_url=product_type.product_type_pdf_url,
        product_type_printed_pdf_url=product_type.product_type_printed_pdf_url,
        series=metadata["series_summaries"],
    )


@app.get("/api/templates", response_model=TemplateRegistryResponse, dependencies=[Depends(get_current_user)], tags=["Templates"], summary="List available templates")
def list_templates():
    return sync_template_registry_with_disk()


@app.post("/api/templates/refresh", response_model=TemplateRegistryResponse, dependencies=[Depends(get_current_user)], tags=["Templates"], summary="Refresh template registry from disk")
def refresh_templates():
    return sync_template_registry_with_disk()


@app.post("/api/templates", response_model=TemplateRegistryResponse, dependencies=[Depends(get_current_user)], tags=["Templates"], summary="Create a new template")
def create_template(body: TemplateCreateRequest):
    template_type = (body.template_type or "").strip().lower()
    template_dir = template_type_directory(template_type)
    registry = sync_template_registry_with_disk()
    collection_name = template_collection_name(template_type)
    existing_ids = {str(item.get("id")).strip() for item in registry.get(collection_name, []) if isinstance(item, dict)}

    label = (body.label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Template label is required.")

    template_id = (body.template_id or "").strip() or f"{template_type}-{sanitize_name(label)}"
    if template_id in existing_ids:
        raise HTTPException(status_code=400, detail="A template with that id already exists.")

    directory_slug = sanitize_name(template_id.replace(f"{template_type}-", "", 1))
    destination_dir = template_dir / directory_slug
    if destination_dir.exists():
        raise HTTPException(status_code=400, detail="A template directory with that name already exists.")

    source_template_id = (body.source_template_id or "").strip() or None
    if source_template_id:
        source_definition = get_template_definition(source_template_id, template_type)
        if source_definition is None:
            raise HTTPException(status_code=404, detail="Source template not found.")
        source_path = Path(__file__).resolve().parents[1] / source_definition["path"]
        if not source_path.is_file():
            raise HTTPException(status_code=404, detail="Source template files are missing on disk.")
        shutil.copytree(source_path.parent, destination_dir)
    else:
        scaffold_blank_template(template_type, destination_dir)

    registry = sync_template_registry_with_disk()
    for item in registry.get(collection_name, []):
        if item.get("path") == str((destination_dir / "template.html").relative_to(Path(__file__).resolve().parents[1])):
            item["id"] = template_id
            item["label"] = label
            item["type"] = template_type
            break
    save_template_registry(registry)
    return sync_template_registry_with_disk()


@app.delete("/api/templates/{template_type}/{template_id}", response_model=TemplateRegistryResponse, dependencies=[Depends(get_current_user)], tags=["Templates"], summary="Delete a template")
def delete_template(template_type: str, template_id: str, db: Session = Depends(get_db)):
    normalized_type = (template_type or "").strip().lower()
    registry = sync_template_registry_with_disk()
    collection_name = template_collection_name(normalized_type)
    entry = next(
        (
            item
            for item in registry.get(collection_name, [])
            if isinstance(item, dict) and str(item.get("id")).strip() == template_id
        ),
        None,
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Template not found.")

    if normalized_type == "product":
        in_use = (
            db.query(Product)
            .filter(
                (Product.template_id == template_id)
                | (Product.printed_template_id == template_id)
                | (Product.online_template_id == template_id)
            )
            .count()
            + db.query(ProductType)
            .filter(
                (ProductType.product_template_id == template_id)
                | (ProductType.printed_product_template_id == template_id)
                | (ProductType.online_product_template_id == template_id)
            )
            .count()
        )
    elif normalized_type == "series":
        in_use = (
            db.query(Series)
            .filter(
                (Series.template_id == template_id)
                | (Series.printed_template_id == template_id)
                | (Series.online_template_id == template_id)
            )
            .count()
        )
    elif normalized_type == "product_type":
        in_use = 1 if template_id == "product_type-default" else 0
    else:
        raise HTTPException(status_code=400, detail="Template type must be 'product', 'series', or 'product_type'.")

    if in_use:
        raise HTTPException(status_code=400, detail="Template is still assigned. Reassign records before deleting it.")

    template_path = Path(__file__).resolve().parents[1] / str(entry.get("path") or "")
    template_dir = template_path.parent
    if template_dir.exists():
        shutil.rmtree(template_dir, ignore_errors=True)

    registry[collection_name] = [
        item
        for item in registry.get(collection_name, [])
        if not (isinstance(item, dict) and str(item.get("id")).strip() == template_id)
    ]
    save_template_registry(registry)
    return sync_template_registry_with_disk()


@app.get(
    "/api/templates/{template_type}/{template_id}/files",
    response_model=TemplateFileResponse,
    dependencies=[Depends(get_current_user)],
    tags=["Templates"],
    summary="Load template source files",
)
def get_template_files(template_type: str, template_id: str):
    normalized_type = (template_type or "").strip().lower()
    if normalized_type not in {"product", "series", "product_type"}:
        raise HTTPException(status_code=400, detail="Template type must be 'product', 'series', or 'product_type'.")

    template_definition = require_template_definition(template_id, normalized_type)
    template_path = Path(__file__).resolve().parents[1] / str(template_definition.get("path") or "")
    if not template_path.is_file():
        raise HTTPException(status_code=404, detail="Template HTML file is missing.")

    stylesheet_path = None
    stylesheet_value = template_definition.get("stylesheet")
    if stylesheet_value:
        stylesheet_path = Path(__file__).resolve().parents[1] / str(stylesheet_value)

    return TemplateFileResponse(
        id=str(template_definition.get("id") or template_id),
        label=str(template_definition.get("label") or template_id),
        type=normalized_type,
        html_path=str(template_path.relative_to(Path(__file__).resolve().parents[1])),
        css_path=str(stylesheet_path.relative_to(Path(__file__).resolve().parents[1])) if stylesheet_path and stylesheet_path.exists() else str(stylesheet_value or "") or None,
        html_content=template_path.read_text(encoding="utf-8"),
        css_content=stylesheet_path.read_text(encoding="utf-8") if stylesheet_path and stylesheet_path.is_file() else "",
    )


@app.put(
    "/api/templates/{template_type}/{template_id}/files",
    response_model=TemplateFileResponse,
    dependencies=[Depends(get_current_user)],
    tags=["Templates"],
    summary="Save template source files",
)
def update_template_files(template_type: str, template_id: str, body: TemplateFileUpdateRequest):
    normalized_type = (template_type or "").strip().lower()
    if normalized_type not in {"product", "series", "product_type"}:
        raise HTTPException(status_code=400, detail="Template type must be 'product', 'series', or 'product_type'.")

    template_definition = require_template_definition(template_id, normalized_type)
    template_path = Path(__file__).resolve().parents[1] / str(template_definition.get("path") or "")
    if not template_path.is_file():
        raise HTTPException(status_code=404, detail="Template HTML file is missing.")

    stylesheet_value = str(template_definition.get("stylesheet") or "").strip()
    stylesheet_path = (Path(__file__).resolve().parents[1] / stylesheet_value) if stylesheet_value else (template_path.parent / "template.css")

    template_path.write_text(body.html_content, encoding="utf-8")
    stylesheet_path.parent.mkdir(parents=True, exist_ok=True)
    stylesheet_path.write_text(body.css_content or "", encoding="utf-8")

    registry = sync_template_registry_with_disk()
    collection_name = template_collection_name(normalized_type)
    for item in registry.get(collection_name, []):
        if isinstance(item, dict) and str(item.get("id") or "").strip() == template_id:
            item["stylesheet"] = str(stylesheet_path.relative_to(Path(__file__).resolve().parents[1]))
            break
    save_template_registry(registry)

    return TemplateFileResponse(
        id=str(template_definition.get("id") or template_id),
        label=str(template_definition.get("label") or template_id),
        type=normalized_type,
        html_path=str(template_path.relative_to(Path(__file__).resolve().parents[1])),
        css_path=str(stylesheet_path.relative_to(Path(__file__).resolve().parents[1])),
        html_content=body.html_content,
        css_content=body.css_content or "",
    )


@app.get("/api/series", response_model=list[SeriesResponse], dependencies=[Depends(get_current_user)], tags=["Series"], summary="List series")
def list_series(
    db: Session = Depends(get_db),
    product_type_key: Optional[str] = Query(None),
):
    q = db.query(Series).options(joinedload(Series.product_type))
    if product_type_key:
        q = q.join(ProductType).filter(ProductType.key == product_type_key)
    return q.order_by(Series.name).all()


@app.post("/api/series", response_model=SeriesResponse, dependencies=[Depends(get_current_user)], tags=["Series"], summary="Create a series")
def create_series(body: SeriesCreate, db: Session = Depends(get_db)):
    product_type = get_product_type_by_key(db, body.product_type_key)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Series name is required.")
    existing = (
        db.query(Series)
        .filter(Series.product_type_id == product_type.id, Series.name.ilike(name))
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="A series with that name already exists for this product type.")
    printed_template_id, online_template_id = resolve_template_pair(
        "series",
        body.template_id,
        body.printed_template_id,
        body.online_template_id,
    )

    series = Series(
        product_type_id=product_type.id,
        name=name,
        description1_html=body.description1_html,
        description2_html=body.description2_html,
        description3_html=body.description3_html,
        description4_html=body.description4_html,
        printed_template_id=printed_template_id,
        online_template_id=online_template_id,
        template_id=online_template_id or printed_template_id,
    )
    series.product_type = product_type
    db.add(series)
    db.flush()
    ensure_series_tab_color(db, series)
    db.commit()
    db.refresh(series)
    return series


@app.put("/api/series/{series_id}", response_model=SeriesResponse, dependencies=[Depends(get_current_user)], tags=["Series"], summary="Update a series")
def update_series(series_id: int, body: SeriesUpdate, db: Session = Depends(get_db)):
    series = db.get(Series, series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    updates = body.model_dump(exclude_unset=True)
    if "product_type_key" in updates:
        product_type = get_product_type_by_key(db, updates.pop("product_type_key"))
        series.product_type_id = product_type.id
        series.product_type = product_type
    if "name" in updates:
        name = (updates["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Series name is required.")
        existing = (
            db.query(Series)
            .filter(
                Series.product_type_id == series.product_type_id,
                Series.name.ilike(name),
                Series.id != series_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="A series with that name already exists for this product type.")
        series.name = name
    for field in ("description1_html", "description2_html", "description3_html", "description4_html"):
        if field in updates:
            setattr(series, field, updates[field])
    if any(field in updates for field in ("template_id", "printed_template_id", "online_template_id")):
        printed_template_id, online_template_id = resolve_template_pair(
            "series",
            updates.get("template_id"),
            updates.get("printed_template_id"),
            updates.get("online_template_id"),
        )
        if "printed_template_id" in updates or "template_id" in updates:
            series.printed_template_id = printed_template_id
        if "online_template_id" in updates or "template_id" in updates:
            series.online_template_id = online_template_id
        series.template_id = series.online_template_id or series.printed_template_id
    for product in series.products:
        product.series_name = series.name
    ensure_series_tab_color(db, series)
    db.commit()
    db.refresh(series)
    return series


@app.delete("/api/series/{series_id}", dependencies=[Depends(get_current_user)], tags=["Series"], summary="Delete a series")
def delete_series(series_id: int, db: Session = Depends(get_db)):
    series = db.get(Series, series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    for product in list(series.products):
        sync_product_series(product, None)
    db.delete(series)
    db.commit()
    return {"deleted": series_id}


@app.post("/api/series/{series_id}/graph-image/refresh", response_model=SeriesResponse, dependencies=[Depends(get_current_user)], tags=["Series"], summary="Generate a series graph image")
def refresh_series_graph_image(series_id: int, db: Session = Depends(get_db)):
    series = db.get(Series, series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    db.refresh(series)
    try:
        generate_series_graph(series)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to generate series graph: {exc}") from exc
    db.refresh(series)
    return series


@app.post("/api/series/{series_id}/pdf/refresh", response_model=SeriesResponse, dependencies=[Depends(get_current_user)], tags=["Series"], summary="Generate a series PDF")
def refresh_series_pdf(series_id: int, db: Session = Depends(get_db)):
    series = db.get(Series, series_id)
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    db.refresh(series)
    try:
        if series.product_type and series.product_type.supports_graph:
            generate_series_graph(series)
        generate_series_pdf(series, "printed")
        generate_series_pdf(series, "online")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to generate series PDF: {exc}") from exc
    db.refresh(series)
    return series


@app.get("/api/auth/session", response_model=AuthSessionResponse, tags=["Public", "Authentication"])
def get_auth_session(request: Request):
    if not is_authenticated(request):
        return AuthSessionResponse(authenticated=False)
    return AuthSessionResponse(
        authenticated=True,
        username=request.session.get("username"),
        is_admin=bool(request.session.get("is_admin")),
    )


@app.post("/api/auth/login", response_model=AuthSessionResponse, tags=["Public", "Authentication"])
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username.strip()).first()
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["authenticated"] = True
    request.session["user_id"] = user.id
    request.session["username"] = user.username
    request.session["is_admin"] = user.is_admin
    return AuthSessionResponse(authenticated=True, username=user.username, is_admin=user.is_admin)


@app.post("/api/auth/logout", response_model=AuthSessionResponse, tags=["Public", "Authentication"])
def logout(request: Request):
    request.session.clear()
    return AuthSessionResponse(authenticated=False)


@app.post("/api/auth/change-password", response_model=AuthSessionResponse, tags=["Authentication"])
def change_password(
    body: AuthPasswordChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    request.session["username"] = current_user.username
    request.session["is_admin"] = current_user.is_admin
    return AuthSessionResponse(authenticated=True, username=current_user.username, is_admin=current_user.is_admin)


@app.get("/api/users", response_model=list[UserResponse], tags=["Users"])
def list_users(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.username).all()


@app.post("/api/users", response_model=UserResponse, tags=["Users"])
def create_user(body: UserCreate, _: User = Depends(require_admin_user), db: Session = Depends(get_db)):
    username = body.username.strip()
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=username,
        password_hash=hash_password(body.password),
        is_admin=body.is_admin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.patch("/api/users/{user_id}", response_model=UserResponse, tags=["Users"])
def update_user(
    user_id: int,
    body: UserUpdate,
    current_user: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    updates = body.model_dump(exclude_unset=True)
    if "is_admin" in updates:
        if user.is_admin and not updates["is_admin"] and active_admin_count(db) <= 1:
            raise HTTPException(status_code=400, detail="At least one active admin account is required")
        user.is_admin = updates["is_admin"]
    if "is_active" in updates:
        if user.is_admin and not updates["is_active"] and active_admin_count(db) <= 1:
            raise HTTPException(status_code=400, detail="At least one active admin account is required")
        if user.id == current_user.id and not updates["is_active"]:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        user.is_active = updates["is_active"]
    db.commit()
    db.refresh(user)
    return user


@app.put("/api/users/{user_id}/password", response_model=UserResponse, tags=["Users"])
def update_user_password(
    user_id: int,
    body: UserPasswordUpdate,
    _: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.password)
    db.commit()
    db.refresh(user)
    return user


@app.get("/api/settings/band-graph-style", response_model=BandGraphStyleSettings, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def get_band_graph_style_settings(db: Session = Depends(get_db)):
    return get_or_create_app_settings(db)


@app.put("/api/settings/band-graph-style", response_model=BandGraphStyleSettings, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def update_band_graph_style_settings(body: BandGraphStyleSettings, db: Session = Depends(get_db)):
    settings = get_or_create_app_settings(db)
    settings.band_graph_background_color = normalize_color_value(body.band_graph_background_color)
    settings.band_graph_label_text_color = normalize_color_value(body.band_graph_label_text_color)
    db.commit()
    db.refresh(settings)
    return settings


@app.get("/api/cms/fans", response_model=list[CmsProductResponse], dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], include_in_schema=False)
@app.get("/api/cms/products", response_model=list[CmsProductResponse], dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], summary="List customer-facing products", description="Read-only product catalogue feed for the WordPress customer-facing site. Supports search, product type, series, and grouped-parameter filtering.")
def list_cms_products(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
    product_type_key: Optional[str] = Query(None),
    series_id: Optional[int] = Query(None),
    series_name: Optional[str] = Query(None),
    parameter_filters: Optional[str] = Query(None),
):
    parsed_parameter_filters = parse_parameter_filters(parameter_filters)
    q = db.query(Product).options(
        joinedload(Product.product_type),
        joinedload(Product.series),
        selectinload(Product.product_images),
        selectinload(Product.parameter_groups).selectinload(ProductParameterGroup.parameters),
        selectinload(Product.rpm_lines).selectinload(RpmLine.points),
        selectinload(Product.efficiency_points),
    )
    if search:
        s = f"%{search}%"
        q = q.filter(Product.model.ilike(s))
    if product_type_key:
        q = q.join(ProductType).filter(ProductType.key == product_type_key)
    if series_id is not None:
        q = q.filter(Product.series_id == series_id)
    if series_name:
        q = q.filter(Product.series_name.ilike(f"%{series_name}%"))
    results = q.order_by(Product.model).all()
    return [product for product in results if product_matches_parameter_filters(product, parsed_parameter_filters)]


@app.get("/api/cms/fans/{product_id}", response_model=CmsProductResponse, dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], include_in_schema=False)
@app.get("/api/cms/products/{product_id}", response_model=CmsProductResponse, dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], summary="Get one customer-facing product", description="Returns a single product record, including grouped specifications and media URLs, for the WordPress customer-facing site.")
def get_cms_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(
            joinedload(Product.product_type),
            joinedload(Product.series),
            selectinload(Product.product_images),
            selectinload(Product.parameter_groups).selectinload(ProductParameterGroup.parameters),
            selectinload(Product.rpm_lines).selectinload(RpmLine.points),
            selectinload(Product.efficiency_points),
        )
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.get(
    "/api/cms/product-graph-values",
    response_model=CmsProductGraphValuesResponse,
    dependencies=[Depends(require_cms_token)],
    tags=["Customer CMS"],
    summary="Get customer-facing graph filter values",
    description="Returns graph filter ranges for the current customer-facing finder filters.",
)
def get_cms_product_graph_values(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
    product_type_key: Optional[str] = Query(None),
    series_id: Optional[int] = Query(None),
    parameter_filters: Optional[str] = Query(None),
):
    parsed_parameter_filters = parse_parameter_filters(parameter_filters)
    q = db.query(Product).options(
        joinedload(Product.product_type),
        selectinload(Product.parameter_groups).selectinload(ProductParameterGroup.parameters),
        selectinload(Product.rpm_lines).selectinload(RpmLine.points),
        selectinload(Product.efficiency_points),
    )
    if search:
        s = f"%{search}%"
        q = q.filter(Product.model.ilike(s))
    if product_type_key:
        q = q.join(ProductType).filter(ProductType.key == product_type_key)
    if series_id is not None:
        q = q.filter(Product.series_id == series_id)

    products = [
        product
        for product in q.order_by(Product.model).all()
        if product_matches_parameter_filters(product, parsed_parameter_filters)
    ]

    graph_values = graph_filter_values_for_products(products)
    return CmsProductGraphValuesResponse(
        rpm=graph_values["rpm"],
        airflow=graph_values["airflow"],
        pressure=graph_values["pressure"],
    )


@app.get("/api/cms/series", response_model=list[CmsSeriesResponse], dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], summary="List customer-facing series", description="Read-only series feed for the WordPress customer-facing site. Supports product type filtering.")
def list_cms_series(
    db: Session = Depends(get_db),
    product_type_key: Optional[str] = Query(None),
):
    q = db.query(Series).options(
        joinedload(Series.product_type),
        selectinload(Series.products).joinedload(Product.product_type),
        selectinload(Series.products).selectinload(Product.product_images),
    )
    if product_type_key:
        q = q.join(ProductType).filter(ProductType.key == product_type_key)
    return q.order_by(Series.name).all()


@app.get("/api/cms/series/{series_id}", response_model=CmsSeriesResponse, dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], summary="Get one customer-facing series", description="Returns a single series record, including its linked products, for the WordPress customer-facing site.")
def get_cms_series(series_id: int, db: Session = Depends(get_db)):
    series = (
        db.query(Series)
        .options(
            joinedload(Series.product_type),
            selectinload(Series.products).joinedload(Product.product_type),
            selectinload(Series.products).selectinload(Product.product_images),
        )
        .filter(Series.id == series_id)
        .first()
    )
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    return series


# --- Products CRUD ---
@app.get("/api/fans", response_model=list[ProductResponse], dependencies=[Depends(get_current_user)], tags=["Products"], include_in_schema=False)
@app.get("/api/products", response_model=list[ProductResponse], dependencies=[Depends(get_current_user)], tags=["Products"], summary="List internal products", description="Primary internal catalogue endpoint used by the Svelte staff application. Supports search, product type, series, and grouped-parameter filtering.")
def list_products(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search model"),
    model: Optional[str] = Query(None),
    product_type_key: Optional[str] = Query(None),
    series_id: Optional[int] = Query(None),
    series_name: Optional[str] = Query(None),
    parameter_filters: Optional[str] = Query(None),
):
    parsed_parameter_filters = parse_parameter_filters(parameter_filters)
    q = db.query(Product).options(
        joinedload(Product.product_type),
        joinedload(Product.series),
        selectinload(Product.product_images),
        selectinload(Product.parameter_groups).selectinload(ProductParameterGroup.parameters),
    )
    if search:
        s = f"%{search}%"
        q = q.filter(Product.model.ilike(s))
    if model:
        q = q.filter(Product.model.ilike(f"%{model}%"))
    if product_type_key:
        q = q.join(ProductType).filter(ProductType.key == product_type_key)
    if series_id is not None:
        q = q.filter(Product.series_id == series_id)
    if series_name:
        q = q.filter(Product.series_name.ilike(f"%{series_name}%"))
    results = q.order_by(Product.model).all()
    return [product for product in results if product_matches_parameter_filters(product, parsed_parameter_filters)]


@app.post("/api/fans", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], include_in_schema=False)
@app.post("/api/products", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], summary="Create a product")
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    product_data = body.model_dump()
    product_type = get_product_type_by_key(db, product_data.pop("product_type_key", "fan"))
    series = get_series_by_id(db, product_data.pop("series_id", None))
    parameter_groups = product_data.pop("parameter_groups", [])
    rpm_line_presets = product_data.pop("rpm_lines", [])
    efficiency_point_presets = product_data.pop("efficiency_points", [])
    if not rpm_line_presets:
        rpm_line_presets = build_product_type_rpm_line_presets(product_type)
    if not efficiency_point_presets:
        efficiency_point_presets = build_product_type_efficiency_point_presets(product_type)
    band_graph_style_defaults = resolve_product_type_band_graph_style_defaults(product_type)
    product_data["band_graph_background_color"] = (
        normalize_color_value(product_data.get("band_graph_background_color"))
        or band_graph_style_defaults["band_graph_background_color"]
    )
    product_data["band_graph_label_text_color"] = (
        normalize_color_value(product_data.get("band_graph_label_text_color"))
        or band_graph_style_defaults["band_graph_label_text_color"]
    )
    product_data["band_graph_faded_opacity"] = (
        product_data.get("band_graph_faded_opacity")
        if product_data.get("band_graph_faded_opacity") is not None
        else band_graph_style_defaults["band_graph_faded_opacity"]
    )
    product_data["band_graph_permissible_label_color"] = (
        normalize_color_value(product_data.get("band_graph_permissible_label_color"))
        or band_graph_style_defaults["band_graph_permissible_label_color"]
    )
    printed_template_id, online_template_id = resolve_template_pair(
        "product",
        product_data.get("template_id"),
        product_data.get("printed_template_id"),
        product_data.get("online_template_id"),
    )
    product_data["printed_template_id"] = printed_template_id or resolve_product_type_default_template_id(product_type, "printed")
    product_data["online_template_id"] = online_template_id or resolve_product_type_default_template_id(product_type, "online")
    product_data["template_id"] = product_data["online_template_id"] or product_data["printed_template_id"]
    product_data["product_type_id"] = product_type.id
    if series is not None and series.product_type_id != product_type.id:
        raise HTTPException(status_code=400, detail="Selected series does not belong to the chosen product type.")
    product_data["series_name"] = series.name if series is not None else (product_data.get("series_name") or None)
    product = Product(**product_data)
    product.product_type = product_type
    sync_product_series(product, series)
    db.add(product)
    db.flush()
    sync_product_parameter_groups(product, parameter_groups)
    created_rpm_lines: list[RpmLine] = []
    for line_index, line in enumerate(rpm_line_presets or []):
        line_model = RpmLine(
            product_id=product.id,
            rpm=line.get("rpm"),
            band_color=normalize_color_value(line.get("band_color")) or None,
        )
        db.add(line_model)
        db.flush()
        created_rpm_lines.append(line_model)

        for point in line.get("points") or []:
            db.add(
                RpmPoint(
                    product_id=product.id,
                    rpm_line_id=line_model.id,
                    airflow=point.get("airflow"),
                    pressure=point.get("pressure"),
                )
            )

    for point_index, point in enumerate(efficiency_point_presets or []):
        db.add(
            EfficiencyPoint(
                product_id=product.id,
                airflow=point.get("airflow"),
                efficiency_centre=point.get("efficiency_centre"),
                efficiency_lower_end=point.get("efficiency_lower_end"),
                efficiency_higher_end=point.get("efficiency_higher_end"),
                permissible_use=point.get("permissible_use"),
            )
        )

    db.commit()
    db.refresh(product)
    sync_graph_image(product, created_rpm_lines or list(product.rpm_lines), list(product.efficiency_points))
    db.commit()
    db.refresh(product)
    return product


@app.get("/api/fans/{product_id}", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], include_in_schema=False)
@app.get("/api/products/{product_id}", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], summary="Get one product")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    return product


@app.put("/api/fans/{product_id}", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], include_in_schema=False)
@app.put("/api/products/{product_id}", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], summary="Replace a product")
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    updates = body.model_dump(exclude_unset=True)
    next_product_type = product.product_type
    if "product_type_key" in updates:
        product_type = get_product_type_by_key(db, updates.pop("product_type_key"))
        product.product_type_id = product_type.id
        product.product_type = product_type
        next_product_type = product_type
        if product.series is not None and product.series.product_type_id != product_type.id:
            sync_product_series(product, None)
    if "series_id" in updates:
        series = get_series_by_id(db, updates.pop("series_id"))
        if series is not None and next_product_type is not None and series.product_type_id != next_product_type.id:
            raise HTTPException(status_code=400, detail="Selected series does not belong to the chosen product type.")
        sync_product_series(product, series)
    if "parameter_groups" in updates:
        sync_product_parameter_groups(product, updates.pop("parameter_groups"))
    if any(field in updates for field in ("template_id", "printed_template_id", "online_template_id")):
        printed_template_id, online_template_id = resolve_template_pair(
            "product",
            updates.pop("template_id", None),
            updates.pop("printed_template_id", None),
            updates.pop("online_template_id", None),
        )
        if body.model_fields_set.intersection({"template_id", "printed_template_id"}):
            product.printed_template_id = printed_template_id
        if body.model_fields_set.intersection({"template_id", "online_template_id"}):
            product.online_template_id = online_template_id
        product.template_id = product.online_template_id or product.printed_template_id
    for k, v in updates.items():
        if k in {"band_graph_background_color", "band_graph_label_text_color", "band_graph_permissible_label_color"}:
            setattr(product, k, normalize_color_value(v))
        elif k == "band_graph_faded_opacity":
            setattr(product, k, None if v is None else max(0, min(1, float(v))))
        else:
            setattr(product, k, v)
    if product.series is not None:
        product.series_name = product.series.name
    sync_product_image_files(product)
    db.commit()
    db.refresh(product)
    return product


@app.patch("/api/fans/{product_id}", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], include_in_schema=False)
@app.patch("/api/products/{product_id}", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], summary="Partially update a product")
def patch_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    return update_product(product_id, body, db)


@app.delete("/api/fans/{product_id}", dependencies=[Depends(get_current_user)], tags=["Products"], include_in_schema=False)
@app.delete("/api/products/{product_id}", dependencies=[Depends(get_current_user)], tags=["Products"], summary="Delete a product")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    delete_product_assets(product)
    db.delete(product)
    db.commit()
    return {"deleted": product_id}


# --- RPM lines / points ---
@app.get("/api/fans/{product_id}/rpm-lines", response_model=list[RpmLineResponse], dependencies=[Depends(get_current_user)], tags=["RPM Lines"], include_in_schema=False)
@app.get("/api/products/{product_id}/rpm-lines", response_model=list[RpmLineResponse], dependencies=[Depends(get_current_user)], tags=["RPM Lines"])
def get_rpm_lines(product_id: int, db: Session = Depends(get_db)):
    require_product(db, product_id)
    return (
        db.query(RpmLine)
        .options(selectinload(RpmLine.points))
        .filter(RpmLine.product_id == product_id)
        .order_by(RpmLine.rpm)
        .all()
    )


@app.post("/api/fans/{product_id}/rpm-lines", response_model=RpmLineResponse, dependencies=[Depends(get_current_user)], tags=["RPM Lines"], include_in_schema=False)
@app.post("/api/products/{product_id}/rpm-lines", response_model=RpmLineResponse, dependencies=[Depends(get_current_user)], tags=["RPM Lines"])
def create_rpm_line(product_id: int, body: RpmLineCreate, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    existing = db.query(RpmLine).filter(RpmLine.product_id == product_id, RpmLine.rpm == body.rpm).first()
    if existing:
        raise HTTPException(400, "RPM line already exists")
    line = RpmLine(product_id=product_id, rpm=body.rpm, band_color=normalize_color_value(body.band_color))
    db.add(line)
    db.commit()
    refresh_graph_for_product(db, product)
    db.commit()
    db.refresh(line)
    return line


@app.put("/api/fans/{product_id}/rpm-lines/{line_id}", response_model=RpmLineResponse, dependencies=[Depends(get_current_user)], tags=["RPM Lines"], include_in_schema=False)
@app.put("/api/products/{product_id}/rpm-lines/{line_id}", response_model=RpmLineResponse, dependencies=[Depends(get_current_user)], tags=["RPM Lines"])
def update_rpm_line(product_id: int, line_id: int, body: RpmLineUpdate, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    line = db.get(RpmLine, line_id)
    if not line or line.product_id != product_id:
        raise HTTPException(404, "RPM line not found")

    updates = body.model_dump(exclude_unset=True)
    if "rpm" in updates and updates["rpm"] is not None:
        existing = (
            db.query(RpmLine)
            .filter(RpmLine.product_id == product_id, RpmLine.rpm == updates["rpm"], RpmLine.id != line_id)
            .first()
        )
        if existing:
            raise HTTPException(400, "RPM line already exists")
        line.rpm = updates["rpm"]
    if "band_color" in updates:
        line.band_color = normalize_color_value(updates["band_color"])

    db.commit()
    refresh_graph_for_product(db, product)
    db.commit()
    db.refresh(line)
    return line


@app.delete("/api/fans/{product_id}/rpm-lines/{line_id}", dependencies=[Depends(get_current_user)], tags=["RPM Lines"], include_in_schema=False)
@app.delete("/api/products/{product_id}/rpm-lines/{line_id}", dependencies=[Depends(get_current_user)], tags=["RPM Lines"])
def delete_rpm_line(product_id: int, line_id: int, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    line = db.get(RpmLine, line_id)
    if not line or line.product_id != product_id:
        raise HTTPException(404, "RPM line not found")
    db.delete(line)
    db.commit()
    refresh_graph_for_product(db, product)
    db.commit()
    return {"deleted": line_id}


@app.get("/api/fans/{product_id}/rpm-points", response_model=list[RpmPointResponse], dependencies=[Depends(get_current_user)], tags=["RPM Points"], include_in_schema=False)
@app.get("/api/products/{product_id}/rpm-points", response_model=list[RpmPointResponse], dependencies=[Depends(get_current_user)], tags=["RPM Points"])
def get_rpm_points(product_id: int, db: Session = Depends(get_db)):
    require_product(db, product_id)
    return (
        db.query(RpmPoint)
        .options(joinedload(RpmPoint.rpm_line))
        .join(RpmLine, RpmPoint.rpm_line_id == RpmLine.id)
        .filter(RpmPoint.product_id == product_id)
        .order_by(RpmLine.rpm, RpmPoint.airflow)
        .all()
    )


@app.post("/api/fans/{product_id}/rpm-points", response_model=RpmPointResponse, dependencies=[Depends(get_current_user)], tags=["RPM Points"], include_in_schema=False)
@app.post("/api/products/{product_id}/rpm-points", response_model=RpmPointResponse, dependencies=[Depends(get_current_user)], tags=["RPM Points"])
def create_rpm_point(
    product_id: int,
    body: RpmPointCreate,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    product = require_product(db, product_id)
    line = db.get(RpmLine, body.rpm_line_id)
    if not line or line.product_id != product_id:
        raise HTTPException(404, "RPM line not found")
    point = RpmPoint(product_id=product_id, **body.model_dump())
    db.add(point)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_product(db, product)
        db.commit()
    db.refresh(point)
    return point


@app.put("/api/fans/{product_id}/rpm-points/{point_id}", response_model=RpmPointResponse, dependencies=[Depends(get_current_user)], tags=["RPM Points"], include_in_schema=False)
@app.put("/api/products/{product_id}/rpm-points/{point_id}", response_model=RpmPointResponse, dependencies=[Depends(get_current_user)], tags=["RPM Points"])
def update_rpm_point(
    product_id: int,
    point_id: int,
    body: RpmPointCreate,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    product = require_product(db, product_id)
    line = db.get(RpmLine, body.rpm_line_id)
    if not line or line.product_id != product_id:
        raise HTTPException(404, "RPM line not found")
    point = db.get(RpmPoint, point_id)
    if not point or point.product_id != product_id:
        raise HTTPException(404, "RPM point not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(point, key, value)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_product(db, product)
        db.commit()
    db.refresh(point)
    return point


@app.delete("/api/fans/{product_id}/rpm-points/{point_id}", dependencies=[Depends(get_current_user)], tags=["RPM Points"], include_in_schema=False)
@app.delete("/api/products/{product_id}/rpm-points/{point_id}", dependencies=[Depends(get_current_user)], tags=["RPM Points"])
def delete_rpm_point(
    product_id: int,
    point_id: int,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    product = require_product(db, product_id)
    point = db.get(RpmPoint, point_id)
    if not point or point.product_id != product_id:
        raise HTTPException(404, "RPM point not found")
    db.delete(point)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_product(db, product)
        db.commit()
    return {"deleted": point_id}


@app.get("/api/fans/{product_id}/efficiency-points", response_model=list[EfficiencyPointResponse], dependencies=[Depends(get_current_user)], tags=["Efficiency Points"], include_in_schema=False)
@app.get("/api/products/{product_id}/efficiency-points", response_model=list[EfficiencyPointResponse], dependencies=[Depends(get_current_user)], tags=["Efficiency Points"])
def get_efficiency_points(product_id: int, db: Session = Depends(get_db)):
    require_product(db, product_id)
    return (
        db.query(EfficiencyPoint)
        .filter(EfficiencyPoint.product_id == product_id)
        .order_by(EfficiencyPoint.airflow)
        .all()
    )


@app.post("/api/fans/{product_id}/efficiency-points", response_model=EfficiencyPointResponse, dependencies=[Depends(get_current_user)], tags=["Efficiency Points"], include_in_schema=False)
@app.post("/api/products/{product_id}/efficiency-points", response_model=EfficiencyPointResponse, dependencies=[Depends(get_current_user)], tags=["Efficiency Points"])
def create_efficiency_point(
    product_id: int,
    body: EfficiencyPointCreate,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    product = require_product(db, product_id)
    point = EfficiencyPoint(product_id=product_id, **body.model_dump())
    db.add(point)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_product(db, product)
        db.commit()
    db.refresh(point)
    return point


@app.put("/api/fans/{product_id}/efficiency-points/{point_id}", response_model=EfficiencyPointResponse, dependencies=[Depends(get_current_user)], tags=["Efficiency Points"], include_in_schema=False)
@app.put("/api/products/{product_id}/efficiency-points/{point_id}", response_model=EfficiencyPointResponse, dependencies=[Depends(get_current_user)], tags=["Efficiency Points"])
def update_efficiency_point(
    product_id: int,
    point_id: int,
    body: EfficiencyPointCreate,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    product = require_product(db, product_id)
    point = db.get(EfficiencyPoint, point_id)
    if not point or point.product_id != product_id:
        raise HTTPException(404, "Efficiency point not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(point, key, value)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_product(db, product)
        db.commit()
    db.refresh(point)
    return point


@app.delete("/api/fans/{product_id}/efficiency-points/{point_id}", dependencies=[Depends(get_current_user)], tags=["Efficiency Points"], include_in_schema=False)
@app.delete("/api/products/{product_id}/efficiency-points/{point_id}", dependencies=[Depends(get_current_user)], tags=["Efficiency Points"])
def delete_efficiency_point(
    product_id: int,
    point_id: int,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    product = require_product(db, product_id)
    point = db.get(EfficiencyPoint, point_id)
    if not point or point.product_id != product_id:
        raise HTTPException(404, "Efficiency point not found")
    db.delete(point)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_product(db, product)
        db.commit()
    return {"deleted": point_id}


@app.post("/api/fans/{product_id}/graph-image/refresh", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"], include_in_schema=False)
@app.post("/api/products/{product_id}/graph-image/refresh", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def refresh_product_graph_image(product_id: int, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    refresh_graph_for_product(db, product)
    db.commit()
    db.refresh(product)
    return product


@app.post("/api/fans/{product_id}/pdf/refresh", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"], include_in_schema=False)
@app.post("/api/products/{product_id}/pdf/refresh", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"], summary="Generate a product PDF")
def refresh_product_pdf(product_id: int, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    if product.product_type and product.product_type.supports_graph:
        refresh_graph_for_product(db, product)
    try:
        generate_product_pdf(product, "printed")
        generate_product_pdf(product, "online")
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to generate product PDF: {exc}") from exc
    db.commit()
    db.refresh(product)
    return product


@app.post("/api/maintenance/graph-images/regenerate-all", response_model=GraphImageMaintenanceResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def regenerate_all_graph_images(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    for product in products:
        refresh_graph_for_product(db, product)
    db.commit()
    return GraphImageMaintenanceResponse(
        message="Graph images regenerated.",
        products_processed=len(products),
        files_deleted=0,
    )


@app.post("/api/maintenance/jobs/graph-images/regenerate-all", response_model=MaintenanceJobResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"], summary="Start regenerating all graph images")
def start_regenerate_all_graph_images_job():
    def work(progress):
        with SessionLocal() as db:
            products = db.query(Product).all()
            total = len(products)
            for index, product in enumerate(products, start=1):
                progress(f"Generating graph {index} of {total}: {product.model}", index, total)
                refresh_graph_for_product(db, product)
            db.commit()
        return {
            "result_message": "Graph images regenerated.",
            "products_processed": total,
        }

    return serialize_maintenance_job(start_maintenance_job("regenerate_all_graph_images", work))


@app.post("/api/maintenance/product-pdfs/regenerate-all", response_model=PdfMaintenanceResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def regenerate_all_product_pdfs(db: Session = Depends(get_db)):
    products = db.query(Product).options(joinedload(Product.product_type)).all()
    processed = 0
    for product in products:
        if product.product_type and product.product_type.supports_graph:
            refresh_graph_for_product(db, product)
        generate_product_pdf(product, "printed")
        generate_product_pdf(product, "online")
        processed += 1
    db.commit()
    return PdfMaintenanceResponse(
        message="Product PDFs regenerated.",
        products_processed=processed,
    )


@app.post("/api/maintenance/jobs/product-pdfs/regenerate-all", response_model=MaintenanceJobResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"], summary="Start regenerating all product PDFs")
def start_regenerate_all_product_pdfs_job():
    def work(progress):
        with SessionLocal() as db:
            products = db.query(Product).options(joinedload(Product.product_type)).all()
            total = len(products)
            processed = 0
            for index, product in enumerate(products, start=1):
                progress(f"Generating PDF {index} of {total}: {product.model}", index, total)
                if product.product_type and product.product_type.supports_graph:
                    refresh_graph_for_product(db, product)
                generate_product_pdf(product, "printed")
                generate_product_pdf(product, "online")
                processed += 1
            db.commit()
        return {
            "result_message": "Product PDFs regenerated.",
            "products_processed": processed,
        }

    return serialize_maintenance_job(start_maintenance_job("regenerate_all_product_pdfs", work))


@app.delete("/api/maintenance/graph-images", response_model=GraphImageMaintenanceResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def delete_all_graph_images(db: Session = Depends(get_db)):
    deleted_files = clear_all_graph_images(db)
    db.commit()
    return GraphImageMaintenanceResponse(
        message="Graph image files deleted and product graph paths cleared.",
        products_processed=0,
        files_deleted=deleted_files,
    )


@app.post("/api/maintenance/jobs/graph-images/clear", response_model=MaintenanceJobResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"], summary="Start clearing all graph images")
def start_delete_all_graph_images_job():
    def work(progress):
        with SessionLocal() as db:
            progress("Clearing stored graph image files", 0, 1)
            deleted_files = clear_all_graph_images(db)
            db.commit()
        return {
            "result_message": "Graph image files deleted and product graph paths cleared.",
            "files_deleted": deleted_files,
            "progress_current": 1,
            "progress_total": 1,
            "progress_percent": 100.0,
        }

    return serialize_maintenance_job(start_maintenance_job("clear_all_graph_images", work))


@app.get("/api/maintenance/backups/download", dependencies=[Depends(require_admin_user)], tags=["Maintenance"])
def download_backup_bundle():
    try:
        archive_path = create_backup_bundle()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to create backup bundle: {exc}") from exc

    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=archive_path.name,
    )


@app.post("/api/maintenance/jobs/backups/create", response_model=MaintenanceJobResponse, dependencies=[Depends(require_admin_user)], tags=["Maintenance"], summary="Start creating a backup bundle")
def start_backup_bundle_job():
    def work(progress):
        archive_path = create_backup_bundle(progress)
        return {
            "result_message": f"Backup bundle created: {archive_path.name}",
            "result_download_url": f"/api/maintenance/jobs/{job['id']}/download",
            "result_file_path": str(archive_path),
            "progress_current": 1,
            "progress_total": 1,
            "progress_percent": 100.0,
        }

    job = start_maintenance_job("create_backup_bundle", work)
    return serialize_maintenance_job(job)


@app.post("/api/maintenance/backups/restore", dependencies=[Depends(require_admin_user)], tags=["Maintenance"])
async def restore_backup_bundle_endpoint(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip backup bundle.")

    try:
        archive_bytes = await file.read()
        restore_backup_bundle(archive_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to restore backup bundle: {exc}") from exc

    return {"message": "Backup bundle restored successfully."}


@app.post("/api/maintenance/jobs/backups/restore", response_model=MaintenanceJobResponse, dependencies=[Depends(require_admin_user)], tags=["Maintenance"], summary="Start restoring a backup bundle")
async def start_restore_backup_bundle_job(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip backup bundle.")

    archive_bytes = await file.read()

    def work(progress):
        restore_backup_bundle(archive_bytes, progress)
        run_post_restore_schema_prep(progress)
        return {
            "result_message": "Backup bundle restored successfully.",
            "progress_current": 1,
            "progress_total": 1,
            "progress_percent": 100.0,
        }

    return serialize_maintenance_job(start_maintenance_job("restore_backup_bundle", work))


@app.get("/api/maintenance/jobs/{job_id}", response_model=MaintenanceJobResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"], summary="Get maintenance job status")
def get_maintenance_job(job_id: str):
    return serialize_maintenance_job(get_maintenance_job_or_404(job_id))


@app.get("/api/maintenance/jobs/{job_id}/download", dependencies=[Depends(require_admin_user)], tags=["Maintenance"], summary="Download a completed backup bundle")
def download_maintenance_job_file(job_id: str):
    job = get_maintenance_job_or_404(job_id)
    if job.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Maintenance job is not complete yet.")
    file_path = job.get("result_file_path")
    if not file_path:
        raise HTTPException(status_code=404, detail="This maintenance job does not have a downloadable file.")
    archive_path = Path(file_path)
    if not archive_path.is_file():
        raise HTTPException(status_code=404, detail="The generated file is no longer available.")
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=archive_path.name,
    )


@app.get("/api/fans/{product_id}/product-images", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"], include_in_schema=False)
@app.get("/api/products/{product_id}/product-images", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"])
def get_product_images(product_id: int, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    return sorted(product.product_images, key=lambda image: (image.sort_order, image.id))


@app.post("/api/fans/{product_id}/product-images", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"], include_in_schema=False)
@app.post("/api/products/{product_id}/product-images", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"])
async def upload_product_images(
    product_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    product = require_product(db, product_id)
    if not files:
        raise HTTPException(400, "No files provided")

    next_order = len(product.product_images)
    for upload in files:
        suffix = os.path.splitext(upload.filename or "")[1].lower() or ".jpg"
        image = ProductImage(
            product_id=product_id,
            file_name=f"upload_{product_id}_{next_order}{suffix}",
            sort_order=next_order,
        )
        db.add(image)
        db.flush()
        contents = await upload.read()
        with open(image_file_path(image.file_name), "wb") as output:
            output.write(contents)
        next_order += 1

    sync_product_image_files(product)
    db.commit()
    db.refresh(product)
    return sorted(product.product_images, key=lambda image: (image.sort_order, image.id))


@app.post("/api/fans/{product_id}/product-images/reorder", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"], include_in_schema=False)
@app.post("/api/products/{product_id}/product-images/reorder", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"])
def reorder_product_images(product_id: int, body: ProductImageReorder, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    images_by_id = {image.id: image for image in product.product_images}
    if set(body.image_ids) != set(images_by_id.keys()):
        raise HTTPException(400, "Image order must include every existing image exactly once")

    for index, image_id in enumerate(body.image_ids):
        images_by_id[image_id].sort_order = index

    sync_product_image_files(product)
    db.commit()
    db.refresh(product)
    return sorted(product.product_images, key=lambda image: (image.sort_order, image.id))


@app.delete("/api/fans/{product_id}/product-images/{image_id}", dependencies=[Depends(get_current_user)], tags=["Product Images"], include_in_schema=False)
@app.delete("/api/products/{product_id}/product-images/{image_id}", dependencies=[Depends(get_current_user)], tags=["Product Images"])
def delete_product_image(product_id: int, image_id: int, db: Session = Depends(get_db)):
    product = require_product(db, product_id)
    image = db.get(ProductImage, image_id)
    if not image or image.product_id != product_id:
        raise HTTPException(404, "Product image not found")

    delete_product_image_file(image)
    db.delete(image)
    db.flush()
    sync_product_image_files(product)
    db.commit()
    return {"deleted": image_id}


@app.get("/api/media/product_images/{file_name}", dependencies=[Depends(get_current_user)], tags=["Media"])
def serve_product_image(file_name: str):
    file_path = image_file_path(file_name)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Product image not found")
    return FileResponse(file_path)


@app.get("/api/media/product_graphs/{file_name}", dependencies=[Depends(get_current_user)], tags=["Media"])
def serve_product_graph(file_name: str):
    file_path = PRODUCT_GRAPHS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Product graph not found")
    return FileResponse(file_path)


@app.get("/api/media/product_pdfs/{file_name}", dependencies=[Depends(get_current_user)], tags=["Media"])
def serve_product_pdf(file_name: str):
    file_path = PRODUCT_PDFS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Product PDF not found")
    return FileResponse(file_path, media_type="application/pdf")


@app.get("/api/media/product_type_pdfs/{file_name}", dependencies=[Depends(get_current_user)], tags=["Media"])
def serve_product_type_pdf(file_name: str):
    file_path = PRODUCT_TYPE_PDFS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Product type PDF not found")
    return FileResponse(file_path, media_type="application/pdf")


@app.get("/api/media/series_graphs/{file_name}", dependencies=[Depends(get_current_user)], tags=["Media"])
def serve_series_graph(file_name: str):
    file_path = SERIES_GRAPHS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Series graph not found")
    return FileResponse(file_path)


@app.get("/api/media/series_pdfs/{file_name}", dependencies=[Depends(get_current_user)], tags=["Media"])
def serve_series_pdf(file_name: str):
    file_path = SERIES_PDFS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Series PDF not found")
    return FileResponse(file_path, media_type="application/pdf")


@app.get(
    "/api/cms/media/product_images/{file_name}",
    tags=["Customer Media"],
    summary="Get a public customer product image",
    description="Public product image endpoint intended for rendered customer-facing pages.",
)
def serve_cms_product_image(file_name: str):
    file_path = image_file_path(file_name)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Product image not found")
    return FileResponse(file_path)


@app.get(
    "/api/cms/media/product_graphs/{file_name}",
    tags=["Customer Media"],
    summary="Get a public customer product graph image",
    description="Public graph image endpoint intended for rendered customer-facing pages and downloads.",
)
def serve_cms_product_graph(file_name: str):
    file_path = PRODUCT_GRAPHS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Product graph not found")
    return FileResponse(file_path)


@app.get(
    "/api/cms/media/product_pdfs/{file_name}",
    tags=["Customer Media"],
    summary="Get a public customer product PDF",
    description="Public product PDF endpoint intended for customer-facing downloads.",
)
def serve_cms_product_pdf(file_name: str):
    file_path = PRODUCT_PDFS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Product PDF not found")
    return FileResponse(file_path, media_type="application/pdf")


@app.get(
    "/api/cms/media/product_type_pdfs/{file_name}",
    tags=["Customer Media"],
    summary="Get a public customer product type PDF",
    description="Public product type PDF endpoint intended for customer-facing downloads.",
)
def serve_cms_product_type_pdf(file_name: str):
    file_path = PRODUCT_TYPE_PDFS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Product type PDF not found")
    return FileResponse(file_path, media_type="application/pdf")


@app.get(
    "/api/cms/media/series_graphs/{file_name}",
    tags=["Customer Media"],
    summary="Get a public customer series graph image",
    description="Public series graph endpoint intended for rendered customer-facing pages and downloads.",
)
def serve_cms_series_graph(file_name: str):
    file_path = SERIES_GRAPHS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Series graph not found")
    return FileResponse(file_path)


@app.get(
    "/api/cms/media/series_pdfs/{file_name}",
    tags=["Customer Media"],
    summary="Get a public customer series PDF",
    description="Public series PDF endpoint intended for customer-facing downloads.",
)
def serve_cms_series_pdf(file_name: str):
    file_path = SERIES_PDFS_DIR / file_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Series PDF not found")
    return FileResponse(file_path, media_type="application/pdf")


# --- Frontend static serving ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
FRONTEND_BUILD_DIR = os.path.join(PROJECT_ROOT, "frontend", "build")

if os.path.isdir(FRONTEND_BUILD_DIR):
    app.mount("/_app", StaticFiles(directory=os.path.join(FRONTEND_BUILD_DIR, "_app")), name="frontend_app")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(FRONTEND_BUILD_DIR, "index.html"))

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        requested_path = os.path.join(FRONTEND_BUILD_DIR, full_path)
        if os.path.isfile(requested_path):
            return FileResponse(requested_path)
        return FileResponse(os.path.join(FRONTEND_BUILD_DIR, "index.html"))
