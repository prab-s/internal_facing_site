import csv
import datetime
import hashlib
import io
import json
import logging
import os
import re
import secrets
import shutil
import subprocess
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session, selectinload, joinedload

from backend.database import (
    DEFAULT_DATA_DIR,
    SessionLocal,
    get_db,
    init_db,
)
from backend.models import (
    Product,
    RpmLine,
    RpmPoint,
    EfficiencyPoint,
    ProductImage,
    ProductType,
    ProductParameterGroup,
    ProductParameter,
    User,
)
from backend.models import AppSettings
from backend.schemas import (
    BandGraphStyleSettings,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    GraphImageMaintenanceResponse,
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
    LoginRequest,
    UserCreate,
    UserPasswordUpdate,
    UserResponse,
    UserUpdate,
    ProductImageResponse,
    ProductImageReorder,
    ProductTypeResponse,
)

SAFE_CHARS_RE = re.compile(r"[^a-z0-9]+")
PRODUCT_IMAGES_DIR = Path(DEFAULT_DATA_DIR) / "product_images"
PRODUCT_GRAPHS_DIR = Path(DEFAULT_DATA_DIR) / "product_graphs"
PRODUCT_PDFS_DIR = Path(DEFAULT_DATA_DIR) / "product_pdfs"
BACKUP_OUTPUT_DIR = Path(DEFAULT_DATA_DIR) / "backups"
WORDPRESS_SITE_DIR = Path("/app/wordpress_site")
FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"
ECHARTS_RENDER_SCRIPT = FRONTEND_DIR / "scripts" / "render_product_graph.mjs"
PRODUCT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
PRODUCT_GRAPHS_DIR.mkdir(parents=True, exist_ok=True)
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


def sanitize_name(value: str) -> str:
    cleaned = SAFE_CHARS_RE.sub("_", (value or "").strip().lower()).strip("_")
    return cleaned or "unknown"


def product_slug(product: Product) -> str:
    return sanitize_name(product.model)


def product_image_file_name(product: Product, index: int, extension: str) -> str:
    ext = extension.lower()
    if not ext.startswith("."):
        ext = f".{ext}"
    return f"pic_{product_slug(product)}_{index}{ext}"


def graph_file_name(product: Product) -> str:
    return f"graph_{product_slug(product)}.png"


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


def get_product_type_by_key(db: Session, product_type_key: str | None) -> ProductType:
    desired_key = (product_type_key or "fan").strip() or "fan"
    product_type = db.query(ProductType).filter(ProductType.key == desired_key).first()
    if product_type is None:
        raise HTTPException(status_code=400, detail=f"Unknown product type: {desired_key}")
    return product_type


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


def product_matches_parameter_filters(product: Product, parameter_filters: list[dict]) -> bool:
    if not parameter_filters:
        return True

    grouped_parameters: dict[tuple[str, str], list[ProductParameter]] = {}
    for group in product.parameter_groups:
        group_name = (group.group_name or "").strip().casefold()
        for parameter in group.parameters:
            parameter_name = (parameter.parameter_name or "").strip().casefold()
            grouped_parameters.setdefault((group_name, parameter_name), []).append(parameter)

    for filter_item in parameter_filters:
        filter_key = (
            filter_item["group_name"].strip().casefold(),
            filter_item["parameter_name"].strip().casefold(),
        )
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

            if min_number is not None and parameter.value_number < min_number:
                continue
            if max_number is not None and parameter.value_number > max_number:
                continue

            matched = True
            break

        if not matched:
            return False

    return True


fan_matches_parameter_filters = product_matches_parameter_filters


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


require_fan = require_product


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


def create_backup_bundle() -> Path:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_name = f"fan_graphs_backup_{timestamp}.zip"
    archive_path = BACKUP_OUTPUT_DIR / archive_name

    with tempfile.TemporaryDirectory() as staging_dir_raw:
        staging_dir = Path(staging_dir_raw)
        postgres_dump_path = staging_dir / "postgres_dump.sql"
        postgres_dump = run_command(
            ["pg_dump", postgres_cli_database_url(), "--no-owner", "--no-privileges"]
        )
        postgres_dump_path.write_bytes(postgres_dump.stdout)

        for media_dir in [PRODUCT_IMAGES_DIR, PRODUCT_GRAPHS_DIR, PRODUCT_PDFS_DIR]:
            if media_dir.is_dir():
                target_dir = staging_dir / "data" / media_dir.name
                target_dir.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(media_dir, target_dir, dirs_exist_ok=True)

        if wordpress_available():
            wordpress_dump_path = staging_dir / "wordpress_dump.sql"
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
                    "- data/product_pdfs : future PDF assets (if present)",
                    "- wordpress_dump.sql : WordPress MariaDB dump (if present)",
                    "- wordpress/wp-content.tar : WordPress content snapshot (if present)",
                ]
            ),
            encoding="utf-8",
        )

        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for root, _, files in os.walk(staging_dir):
                for file_name in files:
                    full_path = Path(root) / file_name
                    archive.write(full_path, full_path.relative_to(staging_dir))

    return archive_path


def restore_backup_bundle(archive_bytes: bytes):
    with tempfile.TemporaryDirectory() as staging_dir_raw:
        staging_dir = Path(staging_dir_raw)
        archive_path = staging_dir / "upload.zip"
        archive_path.write_bytes(archive_bytes)
        with zipfile.ZipFile(archive_path, "r") as archive:
            archive.extractall(staging_dir)

        postgres_dump_path = staging_dir / "postgres_dump.sql"
        if not postgres_dump_path.is_file():
            raise RuntimeError("Backup archive does not contain postgres_dump.sql")

        run_command(
            [
                "psql",
                postgres_cli_database_url(),
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                f"DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO {POSTGRES_USER}; GRANT ALL ON SCHEMA public TO public;",
            ]
        )
        run_command(
            ["psql", postgres_cli_database_url(), "-v", "ON_ERROR_STOP=1"],
            input_bytes=postgres_dump_path.read_bytes(),
        )

        wordpress_dump_path = staging_dir / "wordpress_dump.sql"
        wordpress_content_tar = staging_dir / "wordpress" / "wp-content.tar"
        if wordpress_available() and wordpress_dump_path.is_file():
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
            wp_content_dir = WORDPRESS_SITE_DIR / "wp-content"
            shutil.rmtree(wp_content_dir, ignore_errors=True)
            with tarfile.open(wordpress_content_tar, "r") as tar:
                tar.extractall(WORDPRESS_SITE_DIR)

        for media_dir in ["product_images", "product_graphs", "product_pdfs"]:
            source_dir = staging_dir / "data" / media_dir
            target_dir = Path(DEFAULT_DATA_DIR) / media_dir
            shutil.rmtree(target_dir, ignore_errors=True)
            target_dir.mkdir(parents=True, exist_ok=True)
            if source_dir.is_dir():
                shutil.copytree(source_dir, target_dir, dirs_exist_ok=True)


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
    return db.query(ProductType).order_by(ProductType.label).all()


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
@app.get("/api/cms/products", response_model=list[CmsProductResponse], dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], summary="List customer-facing products", description="Read-only product catalogue feed for the WordPress customer-facing site. Supports search, product type, and grouped-parameter filtering.")
def list_cms_products(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
    product_type_key: Optional[str] = Query(None),
    parameter_filters: Optional[str] = Query(None),
):
    parsed_parameter_filters = parse_parameter_filters(parameter_filters)
    q = db.query(Product).options(
        joinedload(Product.product_type),
        selectinload(Product.product_images),
        selectinload(Product.parameter_groups).selectinload(ProductParameterGroup.parameters),
    )
    if search:
        s = f"%{search}%"
        q = q.filter(Product.model.ilike(s))
    if product_type_key:
        q = q.join(ProductType).filter(ProductType.key == product_type_key)
    results = q.order_by(Product.model).all()
    return [product for product in results if product_matches_parameter_filters(product, parsed_parameter_filters)]


@app.get("/api/cms/fans/{product_id}", response_model=CmsProductResponse, dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], include_in_schema=False)
@app.get("/api/cms/products/{product_id}", response_model=CmsProductResponse, dependencies=[Depends(require_cms_token)], tags=["Customer CMS"], summary="Get one customer-facing product", description="Returns a single product record, including grouped specifications and media URLs, for the WordPress customer-facing site.")
def get_cms_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


# --- Products CRUD ---
@app.get("/api/fans", response_model=list[ProductResponse], dependencies=[Depends(get_current_user)], tags=["Products"], include_in_schema=False)
@app.get("/api/products", response_model=list[ProductResponse], dependencies=[Depends(get_current_user)], tags=["Products"], summary="List internal products", description="Primary internal catalogue endpoint used by the Svelte staff application.")
def list_products(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search model"),
    model: Optional[str] = Query(None),
    product_type_key: Optional[str] = Query(None),
    mounting_style: Optional[str] = Query(None),
    discharge_type: Optional[str] = Query(None),
    parameter_filters: Optional[str] = Query(None),
):
    parsed_parameter_filters = parse_parameter_filters(parameter_filters)
    q = db.query(Product).options(
        joinedload(Product.product_type),
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
    if mounting_style:
        q = q.filter(Product.mounting_style == mounting_style)
    if discharge_type:
        q = q.filter(Product.discharge_type == discharge_type)
    results = q.order_by(Product.model).all()
    return [product for product in results if product_matches_parameter_filters(product, parsed_parameter_filters)]


@app.post("/api/fans", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], include_in_schema=False)
@app.post("/api/products", response_model=ProductResponse, dependencies=[Depends(get_current_user)], tags=["Products"], summary="Create a product")
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    product_data = body.model_dump()
    product_type = get_product_type_by_key(db, product_data.pop("product_type_key", "fan"))
    parameter_groups = product_data.pop("parameter_groups", [])
    product_data["band_graph_background_color"] = normalize_color_value(product_data.get("band_graph_background_color"))
    product_data["band_graph_label_text_color"] = normalize_color_value(product_data.get("band_graph_label_text_color"))
    product_data["band_graph_permissible_label_color"] = normalize_color_value(product_data.get("band_graph_permissible_label_color"))
    product_data["product_type_id"] = product_type.id
    product = Product(**product_data)
    product.product_type = product_type
    db.add(product)
    db.flush()
    sync_product_parameter_groups(product, parameter_groups)
    db.commit()
    db.refresh(product)
    sync_graph_image(product, [], [])
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
    if "product_type_key" in updates:
        product_type = get_product_type_by_key(db, updates.pop("product_type_key"))
        product.product_type_id = product_type.id
        product.product_type = product_type
    if "parameter_groups" in updates:
        sync_product_parameter_groups(product, updates.pop("parameter_groups"))
    for k, v in updates.items():
        if k in {"band_graph_background_color", "band_graph_label_text_color", "band_graph_permissible_label_color"}:
            setattr(product, k, normalize_color_value(v))
        elif k == "band_graph_faded_opacity":
            setattr(product, k, None if v is None else max(0, min(1, float(v))))
        else:
            setattr(product, k, v)
    sync_product_image_files(product)
    sync_graph_image(product, list(product.rpm_lines), list(product.efficiency_points))
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
    return db.query(RpmLine).filter(RpmLine.product_id == product_id).order_by(RpmLine.rpm).all()


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


@app.delete("/api/maintenance/graph-images", response_model=GraphImageMaintenanceResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def delete_all_graph_images(db: Session = Depends(get_db)):
    deleted_files = clear_all_graph_images(db)
    db.commit()
    return GraphImageMaintenanceResponse(
        message="Graph image files deleted and product graph paths cleared.",
        products_processed=0,
        files_deleted=deleted_files,
    )


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
