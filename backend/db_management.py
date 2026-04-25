"""
Database preparation helpers for local SIT and deployment startup.

This module introduces a light Alembic workflow without ripping out the
existing runtime `init_db()` safety net yet. The current approach is:

- create the target database if it does not already exist
- run Alembic `upgrade head` for brand-new databases
- stamp existing legacy databases at the baseline revision and upgrade forward

Legacy startup initialization still runs afterward and can fill in any gaps for
older databases until we fully move schema evolution into Alembic revisions.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Iterable

import psycopg
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL, make_url


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ALEMBIC_INI_PATH = PROJECT_ROOT / "alembic.ini"
KNOWN_APP_TABLES = {
    "users",
    "products",
    "fans",
    "product_types",
    "product_type_parameter_group_presets",
    "product_type_parameter_presets",
    "product_parameter_groups",
    "product_parameters",
    "rpm_lines",
    "rpm_points",
    "efficiency_points",
    "product_images",
    "app_settings",
}

PRINTED_ONLINE_TEMPLATE_REVISION = "20260425_000011"


def _iter_configured_database_urls() -> Iterable[str]:
    seen: set[str] = set()
    for value in (os.getenv("DATABASE_URL"),):
        if value and value not in seen:
            seen.add(value)
            yield value


def _make_engine(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite:") else {}
    return create_engine(database_url, connect_args=connect_args)


def _ensure_sqlite_parent_dir_exists(url: URL) -> None:
    database = url.database
    if not database or database == ":memory:":
        return
    Path(database).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


def _postgres_maintenance_url(url: URL) -> URL:
    return url.set(database="postgres")


def _ensure_postgres_database_exists(url: URL) -> None:
    if not url.database:
        return

    maintenance_url = _postgres_maintenance_url(url)
    connect_kwargs = {
        "host": maintenance_url.host,
        "port": maintenance_url.port,
        "dbname": maintenance_url.database,
        "user": maintenance_url.username,
        "password": maintenance_url.password,
    }

    with psycopg.connect(**connect_kwargs, autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (url.database,))
            exists = cursor.fetchone() is not None
            if not exists:
                cursor.execute(
                    "CREATE DATABASE {} OWNER {}".format(
                        _quote_postgres_identifier(url.database),
                        _quote_postgres_identifier(url.username or "postgres"),
                    )
                )


def _quote_postgres_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def ensure_database_exists(database_url: str) -> None:
    url = make_url(database_url)
    if url.drivername.startswith("sqlite"):
        _ensure_sqlite_parent_dir_exists(url)
        return
    if url.drivername.startswith("postgresql"):
        _ensure_postgres_database_exists(url)


def _build_alembic_config(database_url: str) -> Config:
    config = Config(str(ALEMBIC_INI_PATH))
    config.set_main_option("script_location", str(PROJECT_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def _database_has_alembic_version(engine: Engine) -> bool:
    return "alembic_version" in set(inspect(engine).get_table_names())


def _database_has_app_tables(engine: Engine) -> bool:
    table_names = set(inspect(engine).get_table_names())
    return bool(table_names & KNOWN_APP_TABLES)


def _get_current_alembic_revision(engine: Engine) -> str | None:
    if not _database_has_alembic_version(engine):
        return None
    with engine.connect() as connection:
        return connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar()


def _schema_matches_printed_online_template_revision(engine: Engine) -> bool:
    inspector = inspect(engine)
    required_columns = {
        "products": {"printed_template_id", "online_template_id"},
        "series": {"printed_template_id", "online_template_id"},
        "product_types": {"printed_product_template_id", "online_product_template_id"},
    }
    for table_name, columns in required_columns.items():
        if table_name not in set(inspector.get_table_names()):
            return False
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        if not columns.issubset(existing_columns):
            return False
    return True


def _apply_compatibility_schema(engine: Engine) -> None:
    from backend import models  # noqa: F401
    from backend.database import (
        Base,
        _ensure_fan_columns,
        _ensure_product_platform_columns,
        _ensure_product_type_columns,
        _ensure_product_type_parameter_preset_columns,
        _ensure_rpm_line_columns,
        _ensure_user_columns,
        _migrate_legacy_map_points,
        _remove_deprecated_fan_manufacturer_column,
        _remove_deprecated_fan_notes_column,
        _remove_deprecated_product_optional_columns,
        _remove_deprecated_product_type_secondary_axis_label,
        _seed_product_types,
    )

    Base.metadata.create_all(bind=engine)
    _ensure_fan_columns(engine)
    _ensure_rpm_line_columns(engine)
    _remove_deprecated_fan_manufacturer_column(engine)
    _remove_deprecated_fan_notes_column(engine)
    _remove_deprecated_product_optional_columns(engine)
    _ensure_product_platform_columns(engine)
    _ensure_product_type_columns(engine)
    _ensure_product_type_parameter_preset_columns(engine)
    _remove_deprecated_product_type_secondary_axis_label(engine)
    _ensure_user_columns(engine)
    _seed_product_types(engine)
    _migrate_legacy_map_points(engine)


def prepare_database(database_url: str) -> None:
    ensure_database_exists(database_url)
    alembic_config = _build_alembic_config(database_url)
    engine = _make_engine(database_url)
    try:
        has_alembic_version = _database_has_alembic_version(engine)
        has_app_tables = _database_has_app_tables(engine)

        if has_alembic_version:
            current_revision = _get_current_alembic_revision(engine)
            if (
                current_revision != PRINTED_ONLINE_TEMPLATE_REVISION
                and _schema_matches_printed_online_template_revision(engine)
            ):
                command.stamp(alembic_config, PRINTED_ONLINE_TEMPLATE_REVISION)
            command.upgrade(alembic_config, "head")
            _apply_compatibility_schema(engine)
            return

        if has_app_tables:
            if _schema_matches_printed_online_template_revision(engine):
                command.stamp(alembic_config, PRINTED_ONLINE_TEMPLATE_REVISION)
                command.upgrade(alembic_config, "head")
                _apply_compatibility_schema(engine)
                return
            command.stamp(alembic_config, "20260418_000001")
            command.upgrade(alembic_config, "head")
            _apply_compatibility_schema(engine)
            return

        command.upgrade(alembic_config, "head")
        _apply_compatibility_schema(engine)
    finally:
        engine.dispose()


def prepare_configured_databases() -> None:
    for database_url in _iter_configured_database_urls():
        prepare_database(database_url)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare Internal Facing databases.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser(
        "prepare-configured-databases",
        help="Prepare DATABASE_URL when set.",
    )

    prepare_parser = subparsers.add_parser(
        "prepare-database",
        help="Prepare one explicit database URL.",
    )
    prepare_parser.add_argument("database_url")
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.command == "prepare-configured-databases":
        prepare_configured_databases()
        return

    if args.command == "prepare-database":
        prepare_database(args.database_url)
        return

    parser.error(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
