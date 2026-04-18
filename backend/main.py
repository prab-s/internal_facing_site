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
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from backend.database import (
    DEFAULT_DATA_DIR,
    SessionLocal,
    get_db,
    init_db,
    is_mirror_enabled,
    mirror_db_session,
)
from backend.models import Fan, RpmLine, RpmPoint, EfficiencyPoint, ProductImage, User
from backend.models import AppSettings
from backend.schemas import (
    BandGraphStyleSettings,
    DatabaseMirrorStatusResponse,
    FanCreate,
    FanUpdate,
    FanResponse,
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
    CmsFanResponse,
    LoginRequest,
    UserCreate,
    UserPasswordUpdate,
    UserResponse,
    UserUpdate,
    ProductImageResponse,
    ProductImageReorder,
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


def fan_slug(fan: Fan) -> str:
    return sanitize_name(fan.model)


def product_image_file_name(fan: Fan, index: int, extension: str) -> str:
    ext = extension.lower()
    if not ext.startswith("."):
        ext = f".{ext}"
    return f"pic_{fan_slug(fan)}_{index}{ext}"


def graph_file_name(fan: Fan) -> str:
    return f"graph_{fan_slug(fan)}.png"


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


def get_or_create_app_settings(db: Session) -> AppSettings:
    settings = db.get(AppSettings, 1)
    if settings is None:
        settings = AppSettings(id=1)
        db.add(settings)
        db.flush()
    return settings


def sync_product_image_files(fan: Fan):
    ordered_images = sorted(fan.product_images, key=lambda image: (image.sort_order, image.id))
    temp_paths = {}

    for image in ordered_images:
        current_path = image_file_path(image.file_name)
        if current_path.exists():
            temp_path = image_file_path(f"tmp_{image.id}_{image.file_name}")
            current_path.rename(temp_path)
            temp_paths[image.id] = temp_path

    for index, image in enumerate(ordered_images, start=1):
        suffix = Path(image.file_name).suffix or ".jpg"
        final_name = product_image_file_name(fan, index, suffix)
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


def sync_graph_image(fan: Fan, rpm_lines: list[RpmLine], efficiency_points: list[EfficiencyPoint]):
    rpm_point_list = sorted(
        [point for rpm_line in rpm_lines for point in rpm_line.points],
        key=lambda point: (point.rpm or 0, point.airflow),
    )
    efficiency_point_list = sorted(efficiency_points, key=lambda point: point.airflow)
    previous_path = Path(fan.graph_image_path) if fan.graph_image_path else None

    if not rpm_point_list and not efficiency_point_list:
        if previous_path:
            remove_file(previous_path)
        fan.graph_image_path = None
        return

    final_path = PRODUCT_GRAPHS_DIR / graph_file_name(fan)
    tmp_path = PRODUCT_GRAPHS_DIR / f"tmp_{graph_file_name(fan)}"
    if tmp_path.exists():
        tmp_path.unlink()

    payload = {
        "title": f"{fan.model} Fan Map",
        "showRpmBandShading": fan.show_rpm_band_shading,
        "graphStyle": {
            "band_graph_background_color": fan.band_graph_background_color,
            "band_graph_label_text_color": fan.band_graph_label_text_color,
            "band_graph_faded_opacity": fan.band_graph_faded_opacity,
            "band_graph_permissible_label_color": fan.band_graph_permissible_label_color,
        },
        "rpmLines": [
            {
                "id": line.id,
                "fan_id": line.fan_id,
                "rpm": line.rpm,
                "band_color": line.band_color,
            }
            for line in sorted(rpm_lines, key=lambda line: line.rpm)
        ],
        "rpmPoints": [
            {
                "id": point.id,
                "fan_id": point.fan_id,
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
                "fan_id": point.fan_id,
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
    fan.graph_image_path = str(final_path)


def delete_fan_assets(fan: Fan):
    for image in fan.product_images:
        delete_product_image_file(image)
    if fan.graph_image_path:
        remove_file(fan.graph_image_path)


def refresh_graph_for_fan(db: Session, fan: Fan):
    db.refresh(fan)
    sync_graph_image(fan, list(fan.rpm_lines), list(fan.efficiency_points))


def clear_all_graph_images(db: Session) -> int:
    deleted_files = 0
    for graph_file in PRODUCT_GRAPHS_DIR.iterdir():
        if not graph_file.is_file():
            continue
        graph_file.unlink(missing_ok=True)
        deleted_files += 1

    for fan in db.query(Fan).all():
        fan.graph_image_path = None

    return deleted_files


def _copy_fan_fields(source: Fan, target: Fan):
    target.model = source.model
    target.notes = source.notes
    target.mounting_style = source.mounting_style
    target.discharge_type = source.discharge_type
    target.graph_image_path = source.graph_image_path
    target.show_rpm_band_shading = source.show_rpm_band_shading
    target.band_graph_background_color = source.band_graph_background_color
    target.band_graph_label_text_color = source.band_graph_label_text_color
    target.band_graph_faded_opacity = source.band_graph_faded_opacity
    target.band_graph_permissible_label_color = source.band_graph_permissible_label_color
    target.diameter_mm = source.diameter_mm
    target.max_rpm = source.max_rpm


def _sync_postgres_sequences(db: Session):
    if db.bind.dialect.name != "postgresql":
        return

    for table_name in ["fans", "rpm_lines", "rpm_points", "efficiency_points", "product_images"]:
        db.execute(
            text(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{table_name}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table_name}), 1),
                    (SELECT COUNT(*) > 0 FROM {table_name})
                )
                """
            )
        )


def mirror_fan_to_postgres(fan_id: int):
    if not is_mirror_enabled():
        return

    with SessionLocal() as source_db, mirror_db_session() as mirror_db:
        if mirror_db is None:
            return

        source_fan = source_db.get(Fan, fan_id)
        mirror_fan = mirror_db.get(Fan, fan_id)

        if source_fan is None:
            if mirror_fan is not None:
                mirror_db.delete(mirror_fan)
                mirror_db.commit()
            return

        if mirror_fan is None:
            mirror_fan = Fan(id=fan_id)
            mirror_db.add(mirror_fan)

        _copy_fan_fields(source_fan, mirror_fan)
        mirror_db.flush()

        source_rpm_lines = (
            source_db.query(RpmLine).filter(RpmLine.fan_id == fan_id).order_by(RpmLine.id).all()
        )
        mirror_rpm_lines = {line.id: line for line in mirror_db.query(RpmLine).filter(RpmLine.fan_id == fan_id).all()}
        source_rpm_line_ids = {line.id for line in source_rpm_lines}

        for source_line in source_rpm_lines:
            mirror_line = mirror_rpm_lines.get(source_line.id)
            if mirror_line is None:
                mirror_line = RpmLine(id=source_line.id, fan_id=fan_id)
                mirror_db.add(mirror_line)
            mirror_line.fan_id = fan_id
            mirror_line.rpm = source_line.rpm
            mirror_line.band_color = source_line.band_color

        for mirror_line_id, mirror_line in mirror_rpm_lines.items():
            if mirror_line_id not in source_rpm_line_ids:
                mirror_db.delete(mirror_line)

        source_rpm_points = (
            source_db.query(RpmPoint).filter(RpmPoint.fan_id == fan_id).order_by(RpmPoint.id).all()
        )
        mirror_rpm_points = {point.id: point for point in mirror_db.query(RpmPoint).filter(RpmPoint.fan_id == fan_id).all()}
        source_rpm_point_ids = {point.id for point in source_rpm_points}

        for source_point in source_rpm_points:
            mirror_point = mirror_rpm_points.get(source_point.id)
            if mirror_point is None:
                mirror_point = RpmPoint(id=source_point.id, fan_id=fan_id)
                mirror_db.add(mirror_point)
            mirror_point.fan_id = fan_id
            mirror_point.rpm_line_id = source_point.rpm_line_id
            mirror_point.airflow = source_point.airflow
            mirror_point.pressure = source_point.pressure

        for mirror_point_id, mirror_point in mirror_rpm_points.items():
            if mirror_point_id not in source_rpm_point_ids:
                mirror_db.delete(mirror_point)

        source_efficiency_points = (
            source_db.query(EfficiencyPoint)
            .filter(EfficiencyPoint.fan_id == fan_id)
            .order_by(EfficiencyPoint.id)
            .all()
        )
        mirror_efficiency_points = {
            point.id: point
            for point in mirror_db.query(EfficiencyPoint).filter(EfficiencyPoint.fan_id == fan_id).all()
        }
        source_efficiency_point_ids = {point.id for point in source_efficiency_points}

        for source_point in source_efficiency_points:
            mirror_point = mirror_efficiency_points.get(source_point.id)
            if mirror_point is None:
                mirror_point = EfficiencyPoint(id=source_point.id, fan_id=fan_id)
                mirror_db.add(mirror_point)
            mirror_point.fan_id = fan_id
            mirror_point.airflow = source_point.airflow
            mirror_point.efficiency_centre = source_point.efficiency_centre
            mirror_point.efficiency_lower_end = source_point.efficiency_lower_end
            mirror_point.efficiency_higher_end = source_point.efficiency_higher_end
            mirror_point.permissible_use = source_point.permissible_use

        for mirror_point_id, mirror_point in mirror_efficiency_points.items():
            if mirror_point_id not in source_efficiency_point_ids:
                mirror_db.delete(mirror_point)

        source_product_images = (
            source_db.query(ProductImage).filter(ProductImage.fan_id == fan_id).order_by(ProductImage.id).all()
        )
        mirror_product_images = {
            image.id: image
            for image in mirror_db.query(ProductImage).filter(ProductImage.fan_id == fan_id).all()
        }
        source_product_image_ids = {image.id for image in source_product_images}

        for source_image in source_product_images:
            mirror_image = mirror_product_images.get(source_image.id)
            if mirror_image is None:
                mirror_image = ProductImage(id=source_image.id, fan_id=fan_id)
                mirror_db.add(mirror_image)
            mirror_image.fan_id = fan_id
            mirror_image.file_name = source_image.file_name
            mirror_image.sort_order = source_image.sort_order

        for mirror_image_id, mirror_image in mirror_product_images.items():
            if mirror_image_id not in source_product_image_ids:
                mirror_db.delete(mirror_image)

        mirror_db.flush()
        _sync_postgres_sequences(mirror_db)
        mirror_db.commit()


def sync_all_data_to_postgres():
    if not is_mirror_enabled():
        return

    with SessionLocal() as source_db, mirror_db_session() as mirror_db:
        source_tables = set(inspect(source_db.bind).get_table_names())
        mirror_tables = set(inspect(mirror_db.bind).get_table_names())

        if "users" in source_tables and "users" in mirror_tables:
            source_users = source_db.query(User).order_by(User.id).all()
            mirror_users = {user.id: user for user in mirror_db.query(User).all()}
            source_user_ids = {user.id for user in source_users}

            for source_user in source_users:
                mirror_user = mirror_users.get(source_user.id)
                if mirror_user is None:
                    mirror_user = User(id=source_user.id)
                    mirror_db.add(mirror_user)
                mirror_user.username = source_user.username
                mirror_user.password_hash = source_user.password_hash
                mirror_user.is_admin = source_user.is_admin
                mirror_user.is_active = source_user.is_active

            for mirror_user_id, mirror_user in mirror_users.items():
                if mirror_user_id not in source_user_ids:
                    mirror_db.delete(mirror_user)

            mirror_db.commit()

        if "app_settings" in source_tables and "app_settings" in mirror_tables:
            source_settings = source_db.get(AppSettings, 1)
            mirror_settings = mirror_db.get(AppSettings, 1)

            if source_settings is None:
                if mirror_settings is not None:
                    mirror_db.delete(mirror_settings)
            else:
                if mirror_settings is None:
                    mirror_settings = AppSettings(id=1)
                    mirror_db.add(mirror_settings)
                mirror_settings.band_graph_background_color = source_settings.band_graph_background_color
                mirror_settings.band_graph_label_text_color = source_settings.band_graph_label_text_color

            mirror_db.commit()

    with SessionLocal() as db:
        fan_ids = [fan_id for (fan_id,) in db.query(Fan.id).all()]

    for fan_id in fan_ids:
        mirror_fan_to_postgres(fan_id)


def sync_all_data_to_postgres_safely():
    if not is_mirror_enabled():
        return
    try:
        sync_all_data_to_postgres()
    except Exception:
        logger.exception("Postgres mirror full sync failed")


def mirror_fan_to_postgres_safely(fan_id: int):
    if not is_mirror_enabled():
        return
    try:
        mirror_fan_to_postgres(fan_id)
    except Exception:
        logger.exception("Postgres mirror sync failed for fan_id=%s", fan_id)


def get_database_counts(db: Session) -> dict[str, int]:
    return {
        "app_settings": db.query(AppSettings).count(),
        "users": db.query(User).count(),
        "fans": db.query(Fan).count(),
        "rpm_lines": db.query(RpmLine).count(),
        "rpm_points": db.query(RpmPoint).count(),
        "efficiency_points": db.query(EfficiencyPoint).count(),
        "product_images": db.query(ProductImage).count(),
    }


def require_fan(db: Session, fan_id: int) -> Fan:
    fan = db.get(Fan, fan_id)
    if not fan:
        raise HTTPException(404, "Fan not found")
    return fan


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
                    "Fan Graphs backup bundle",
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
        "description": "Endpoints that do not require the staff session cookie.",
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
        "name": "CMS",
        "description": "Read-only customer-facing CMS endpoints secured by the CMS bearer token.",
    },
    {
        "name": "Fans",
        "description": "Fan catalogue CRUD endpoints for the internal app.",
    },
    {
        "name": "RPM Lines",
        "description": "RPM line management for a fan.",
    },
    {
        "name": "RPM Points",
        "description": "RPM curve point management for a fan.",
    },
    {
        "name": "Efficiency Points",
        "description": "Efficiency curve point management for a fan.",
    },
    {
        "name": "Product Images",
        "description": "Product image upload, ordering, and deletion endpoints.",
    },
    {
        "name": "Media",
        "description": "Protected media file serving endpoints.",
    },
    {
        "name": "Maintenance",
        "description": "Operational and data maintenance endpoints.",
    },
]

app = FastAPI(
    title="Fan Graphs API",
    description=(
        "Internal API for the Fan Graphs application.\n\n"
        "Endpoints tagged `Public` do not require the staff session cookie.\n"
        "Endpoints tagged `CMS` do not use the staff session cookie either; they require the CMS bearer token instead."
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
    sync_all_data_to_postgres_safely()


# --- Health ---
@app.get("/api/health", tags=["Public"])
def health():
    return {"ok": True}


@app.get("/openapi.json", dependencies=[Depends(get_current_user)])
def openapi_schema():
    return app.openapi()


@app.get("/docs", include_in_schema=False, dependencies=[Depends(get_current_user)])
def swagger_ui():
    return get_swagger_ui_html(openapi_url="/openapi.json", title="Fan Graphs API Docs")


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
    sync_all_data_to_postgres_safely()
    return settings


@app.get("/api/cms/fans", response_model=list[CmsFanResponse], dependencies=[Depends(require_cms_token)], tags=["CMS"])
def list_cms_fans(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
):
    q = db.query(Fan)
    if search:
        s = f"%{search}%"
        q = q.filter(Fan.model.ilike(s))
    return q.order_by(Fan.model).all()


@app.get("/api/cms/fans/{fan_id}", response_model=CmsFanResponse, dependencies=[Depends(require_cms_token)], tags=["CMS"])
def get_cms_fan(fan_id: int, db: Session = Depends(get_db)):
    fan = db.get(Fan, fan_id)
    if not fan:
        raise HTTPException(status_code=404, detail="Fan not found")
    return fan


# --- Fans CRUD ---
@app.get("/api/fans", response_model=list[FanResponse], dependencies=[Depends(get_current_user)], tags=["Fans"])
def list_fans(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None, description="Search model"),
    model: Optional[str] = Query(None),
    mounting_style: Optional[str] = Query(None),
    discharge_type: Optional[str] = Query(None),
):
    q = db.query(Fan)
    if search:
        s = f"%{search}%"
        q = q.filter(Fan.model.ilike(s))
    if model:
        q = q.filter(Fan.model.ilike(f"%{model}%"))
    if mounting_style:
        q = q.filter(Fan.mounting_style == mounting_style)
    if discharge_type:
        q = q.filter(Fan.discharge_type == discharge_type)
    return q.order_by(Fan.model).all()


@app.post("/api/fans", response_model=FanResponse, dependencies=[Depends(get_current_user)], tags=["Fans"])
def create_fan(body: FanCreate, db: Session = Depends(get_db)):
    fan_data = body.model_dump()
    fan_data["band_graph_background_color"] = normalize_color_value(fan_data.get("band_graph_background_color"))
    fan_data["band_graph_label_text_color"] = normalize_color_value(fan_data.get("band_graph_label_text_color"))
    fan_data["band_graph_permissible_label_color"] = normalize_color_value(fan_data.get("band_graph_permissible_label_color"))
    fan = Fan(**fan_data)
    db.add(fan)
    db.commit()
    db.refresh(fan)
    sync_graph_image(fan, [], [])
    db.commit()
    db.refresh(fan)
    mirror_fan_to_postgres_safely(fan.id)
    return fan


@app.get("/api/fans/{fan_id}", response_model=FanResponse, dependencies=[Depends(get_current_user)], tags=["Fans"])
def get_fan(fan_id: int, db: Session = Depends(get_db)):
    fan = db.get(Fan, fan_id)
    if not fan:
        raise HTTPException(404, "Fan not found")
    return fan


@app.put("/api/fans/{fan_id}", response_model=FanResponse, dependencies=[Depends(get_current_user)], tags=["Fans"])
def update_fan(fan_id: int, body: FanUpdate, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if k in {"band_graph_background_color", "band_graph_label_text_color", "band_graph_permissible_label_color"}:
            setattr(fan, k, normalize_color_value(v))
        elif k == "band_graph_faded_opacity":
            setattr(fan, k, None if v is None else max(0, min(1, float(v))))
        else:
            setattr(fan, k, v)
    sync_product_image_files(fan)
    sync_graph_image(fan, list(fan.rpm_lines), list(fan.efficiency_points))
    db.commit()
    db.refresh(fan)
    mirror_fan_to_postgres_safely(fan.id)
    return fan


@app.patch("/api/fans/{fan_id}", response_model=FanResponse, dependencies=[Depends(get_current_user)], tags=["Fans"])
def patch_fan(fan_id: int, body: FanUpdate, db: Session = Depends(get_db)):
    return update_fan(fan_id, body, db)


@app.delete("/api/fans/{fan_id}", dependencies=[Depends(get_current_user)], tags=["Fans"])
def delete_fan(fan_id: int, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    delete_fan_assets(fan)
    db.delete(fan)
    db.commit()
    mirror_fan_to_postgres_safely(fan_id)
    return {"deleted": fan_id}


# --- RPM lines / points ---
@app.get("/api/fans/{fan_id}/rpm-lines", response_model=list[RpmLineResponse], dependencies=[Depends(get_current_user)], tags=["RPM Lines"])
def get_rpm_lines(fan_id: int, db: Session = Depends(get_db)):
    require_fan(db, fan_id)
    return db.query(RpmLine).filter(RpmLine.fan_id == fan_id).order_by(RpmLine.rpm).all()


@app.post("/api/fans/{fan_id}/rpm-lines", response_model=RpmLineResponse, dependencies=[Depends(get_current_user)], tags=["RPM Lines"])
def create_rpm_line(fan_id: int, body: RpmLineCreate, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    existing = db.query(RpmLine).filter(RpmLine.fan_id == fan_id, RpmLine.rpm == body.rpm).first()
    if existing:
        raise HTTPException(400, "RPM line already exists")
    line = RpmLine(fan_id=fan_id, rpm=body.rpm, band_color=normalize_color_value(body.band_color))
    db.add(line)
    db.commit()
    refresh_graph_for_fan(db, fan)
    db.commit()
    db.refresh(line)
    mirror_fan_to_postgres_safely(fan_id)
    return line


@app.put("/api/fans/{fan_id}/rpm-lines/{line_id}", response_model=RpmLineResponse, dependencies=[Depends(get_current_user)], tags=["RPM Lines"])
def update_rpm_line(fan_id: int, line_id: int, body: RpmLineUpdate, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    line = db.get(RpmLine, line_id)
    if not line or line.fan_id != fan_id:
        raise HTTPException(404, "RPM line not found")

    updates = body.model_dump(exclude_unset=True)
    if "rpm" in updates and updates["rpm"] is not None:
        existing = (
            db.query(RpmLine)
            .filter(RpmLine.fan_id == fan_id, RpmLine.rpm == updates["rpm"], RpmLine.id != line_id)
            .first()
        )
        if existing:
            raise HTTPException(400, "RPM line already exists")
        line.rpm = updates["rpm"]
    if "band_color" in updates:
        line.band_color = normalize_color_value(updates["band_color"])

    db.commit()
    refresh_graph_for_fan(db, fan)
    db.commit()
    db.refresh(line)
    mirror_fan_to_postgres_safely(fan_id)
    return line


@app.delete("/api/fans/{fan_id}/rpm-lines/{line_id}", dependencies=[Depends(get_current_user)], tags=["RPM Lines"])
def delete_rpm_line(fan_id: int, line_id: int, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    line = db.get(RpmLine, line_id)
    if not line or line.fan_id != fan_id:
        raise HTTPException(404, "RPM line not found")
    db.delete(line)
    db.commit()
    refresh_graph_for_fan(db, fan)
    db.commit()
    mirror_fan_to_postgres_safely(fan_id)
    return {"deleted": line_id}


@app.get("/api/fans/{fan_id}/rpm-points", response_model=list[RpmPointResponse], dependencies=[Depends(get_current_user)], tags=["RPM Points"])
def get_rpm_points(fan_id: int, db: Session = Depends(get_db)):
    require_fan(db, fan_id)
    return (
        db.query(RpmPoint)
        .join(RpmLine, RpmPoint.rpm_line_id == RpmLine.id)
        .filter(RpmPoint.fan_id == fan_id)
        .order_by(RpmLine.rpm, RpmPoint.airflow)
        .all()
    )


@app.post("/api/fans/{fan_id}/rpm-points", response_model=RpmPointResponse, dependencies=[Depends(get_current_user)], tags=["RPM Points"])
def create_rpm_point(
    fan_id: int,
    body: RpmPointCreate,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    fan = require_fan(db, fan_id)
    line = db.get(RpmLine, body.rpm_line_id)
    if not line or line.fan_id != fan_id:
        raise HTTPException(404, "RPM line not found")
    point = RpmPoint(fan_id=fan_id, **body.model_dump())
    db.add(point)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_fan(db, fan)
        db.commit()
    db.refresh(point)
    mirror_fan_to_postgres_safely(fan_id)
    return point


@app.put("/api/fans/{fan_id}/rpm-points/{point_id}", response_model=RpmPointResponse, dependencies=[Depends(get_current_user)], tags=["RPM Points"])
def update_rpm_point(
    fan_id: int,
    point_id: int,
    body: RpmPointCreate,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    fan = require_fan(db, fan_id)
    line = db.get(RpmLine, body.rpm_line_id)
    if not line or line.fan_id != fan_id:
        raise HTTPException(404, "RPM line not found")
    point = db.get(RpmPoint, point_id)
    if not point or point.fan_id != fan_id:
        raise HTTPException(404, "RPM point not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(point, key, value)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_fan(db, fan)
        db.commit()
    db.refresh(point)
    mirror_fan_to_postgres_safely(fan_id)
    return point


@app.delete("/api/fans/{fan_id}/rpm-points/{point_id}", dependencies=[Depends(get_current_user)], tags=["RPM Points"])
def delete_rpm_point(
    fan_id: int,
    point_id: int,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    fan = require_fan(db, fan_id)
    point = db.get(RpmPoint, point_id)
    if not point or point.fan_id != fan_id:
        raise HTTPException(404, "RPM point not found")
    db.delete(point)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_fan(db, fan)
        db.commit()
    mirror_fan_to_postgres_safely(fan_id)
    return {"deleted": point_id}


@app.get("/api/fans/{fan_id}/efficiency-points", response_model=list[EfficiencyPointResponse], dependencies=[Depends(get_current_user)], tags=["Efficiency Points"])
def get_efficiency_points(fan_id: int, db: Session = Depends(get_db)):
    require_fan(db, fan_id)
    return (
        db.query(EfficiencyPoint)
        .filter(EfficiencyPoint.fan_id == fan_id)
        .order_by(EfficiencyPoint.airflow)
        .all()
    )


@app.post("/api/fans/{fan_id}/efficiency-points", response_model=EfficiencyPointResponse, dependencies=[Depends(get_current_user)], tags=["Efficiency Points"])
def create_efficiency_point(
    fan_id: int,
    body: EfficiencyPointCreate,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    fan = require_fan(db, fan_id)
    point = EfficiencyPoint(fan_id=fan_id, **body.model_dump())
    db.add(point)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_fan(db, fan)
        db.commit()
    db.refresh(point)
    mirror_fan_to_postgres_safely(fan_id)
    return point


@app.put("/api/fans/{fan_id}/efficiency-points/{point_id}", response_model=EfficiencyPointResponse, dependencies=[Depends(get_current_user)], tags=["Efficiency Points"])
def update_efficiency_point(
    fan_id: int,
    point_id: int,
    body: EfficiencyPointCreate,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    fan = require_fan(db, fan_id)
    point = db.get(EfficiencyPoint, point_id)
    if not point or point.fan_id != fan_id:
        raise HTTPException(404, "Efficiency point not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(point, key, value)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_fan(db, fan)
        db.commit()
    db.refresh(point)
    mirror_fan_to_postgres_safely(fan_id)
    return point


@app.delete("/api/fans/{fan_id}/efficiency-points/{point_id}", dependencies=[Depends(get_current_user)], tags=["Efficiency Points"])
def delete_efficiency_point(
    fan_id: int,
    point_id: int,
    regenerate_graph: bool = Query(True),
    db: Session = Depends(get_db),
):
    fan = require_fan(db, fan_id)
    point = db.get(EfficiencyPoint, point_id)
    if not point or point.fan_id != fan_id:
        raise HTTPException(404, "Efficiency point not found")
    db.delete(point)
    db.commit()
    if regenerate_graph:
        refresh_graph_for_fan(db, fan)
        db.commit()
    mirror_fan_to_postgres_safely(fan_id)
    return {"deleted": point_id}


@app.post("/api/fans/{fan_id}/graph-image/refresh", response_model=FanResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def refresh_fan_graph_image(fan_id: int, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    refresh_graph_for_fan(db, fan)
    db.commit()
    db.refresh(fan)
    mirror_fan_to_postgres_safely(fan_id)
    return fan


@app.post("/api/maintenance/databases/resync-postgres", response_model=DatabaseMirrorStatusResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def resync_postgres_mirror():
    if not is_mirror_enabled():
        return DatabaseMirrorStatusResponse(
            mirror_enabled=False,
            message="Postgres mirror is not enabled.",
        )

    sync_all_data_to_postgres()

    with SessionLocal() as sqlite_db, mirror_db_session() as postgres_db:
        sqlite_counts = get_database_counts(sqlite_db)
        postgres_counts = get_database_counts(postgres_db)

    return DatabaseMirrorStatusResponse(
        mirror_enabled=True,
        message="Postgres mirror resynced from SQLite.",
        sqlite_counts=sqlite_counts,
        postgres_counts=postgres_counts,
        count_differences={
            key: postgres_counts.get(key, 0) - sqlite_counts.get(key, 0)
            for key in sqlite_counts
        },
    )


@app.get("/api/maintenance/databases/mirror-status", response_model=DatabaseMirrorStatusResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def get_postgres_mirror_status():
    with SessionLocal() as sqlite_db:
        sqlite_counts = get_database_counts(sqlite_db)

    if not is_mirror_enabled():
        return DatabaseMirrorStatusResponse(
            mirror_enabled=False,
            message="Postgres mirror is not enabled.",
            sqlite_counts=sqlite_counts,
        )

    with mirror_db_session() as postgres_db:
        postgres_counts = get_database_counts(postgres_db)

    return DatabaseMirrorStatusResponse(
        mirror_enabled=True,
        message="Postgres mirror is enabled.",
        sqlite_counts=sqlite_counts,
        postgres_counts=postgres_counts,
        count_differences={
            key: postgres_counts.get(key, 0) - sqlite_counts.get(key, 0)
            for key in sqlite_counts
        },
    )


@app.post("/api/maintenance/graph-images/regenerate-all", response_model=GraphImageMaintenanceResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def regenerate_all_graph_images(db: Session = Depends(get_db)):
    fans = db.query(Fan).all()
    for fan in fans:
        refresh_graph_for_fan(db, fan)
    db.commit()
    sync_all_data_to_postgres_safely()
    return GraphImageMaintenanceResponse(
        message="Graph images regenerated.",
        fans_processed=len(fans),
        files_deleted=0,
    )


@app.delete("/api/maintenance/graph-images", response_model=GraphImageMaintenanceResponse, dependencies=[Depends(get_current_user)], tags=["Maintenance"])
def delete_all_graph_images(db: Session = Depends(get_db)):
    deleted_files = clear_all_graph_images(db)
    db.commit()
    sync_all_data_to_postgres_safely()
    return GraphImageMaintenanceResponse(
        message="Graph image files deleted and fan graph paths cleared.",
        fans_processed=0,
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


@app.get("/api/fans/{fan_id}/product-images", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"])
def get_product_images(fan_id: int, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    return sorted(fan.product_images, key=lambda image: (image.sort_order, image.id))


@app.post("/api/fans/{fan_id}/product-images", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"])
async def upload_product_images(
    fan_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    fan = require_fan(db, fan_id)
    if not files:
        raise HTTPException(400, "No files provided")

    next_order = len(fan.product_images)
    for upload in files:
        suffix = os.path.splitext(upload.filename or "")[1].lower() or ".jpg"
        image = ProductImage(
            fan_id=fan_id,
            file_name=f"upload_{fan_id}_{next_order}{suffix}",
            sort_order=next_order,
        )
        db.add(image)
        db.flush()
        contents = await upload.read()
        with open(image_file_path(image.file_name), "wb") as output:
            output.write(contents)
        next_order += 1

    sync_product_image_files(fan)
    db.commit()
    db.refresh(fan)
    mirror_fan_to_postgres_safely(fan_id)
    return sorted(fan.product_images, key=lambda image: (image.sort_order, image.id))


@app.post("/api/fans/{fan_id}/product-images/reorder", response_model=list[ProductImageResponse], dependencies=[Depends(get_current_user)], tags=["Product Images"])
def reorder_product_images(fan_id: int, body: ProductImageReorder, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    images_by_id = {image.id: image for image in fan.product_images}
    if set(body.image_ids) != set(images_by_id.keys()):
        raise HTTPException(400, "Image order must include every existing image exactly once")

    for index, image_id in enumerate(body.image_ids):
        images_by_id[image_id].sort_order = index

    sync_product_image_files(fan)
    db.commit()
    db.refresh(fan)
    mirror_fan_to_postgres_safely(fan_id)
    return sorted(fan.product_images, key=lambda image: (image.sort_order, image.id))


@app.delete("/api/fans/{fan_id}/product-images/{image_id}", dependencies=[Depends(get_current_user)], tags=["Product Images"])
def delete_product_image(fan_id: int, image_id: int, db: Session = Depends(get_db)):
    fan = require_fan(db, fan_id)
    image = db.get(ProductImage, image_id)
    if not image or image.fan_id != fan_id:
        raise HTTPException(404, "Product image not found")

    delete_product_image_file(image)
    db.delete(image)
    db.flush()
    sync_product_image_files(fan)
    db.commit()
    mirror_fan_to_postgres_safely(fan_id)
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
