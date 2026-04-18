import os
from contextlib import contextmanager

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DEFAULT_DATA_DIR = os.path.join(PROJECT_ROOT, "data")
os.makedirs(DEFAULT_DATA_DIR, exist_ok=True)

DEFAULT_DB_PATH = os.path.join(DEFAULT_DATA_DIR, "fans.db")
PRIMARY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
POSTGRES_DATABASE_URL = os.getenv("POSTGRES_DATABASE_URL")


def _build_engine(database_url: str):
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite:") else {}
    return create_engine(
        database_url,
        connect_args=connect_args,
        echo=False,
    )


engine = _build_engine(PRIMARY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

mirror_engine = _build_engine(POSTGRES_DATABASE_URL) if POSTGRES_DATABASE_URL else None
MirrorSessionLocal = (
    sessionmaker(autocommit=False, autoflush=False, bind=mirror_engine)
    if mirror_engine is not None
    else None
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def is_mirror_enabled() -> bool:
    return MirrorSessionLocal is not None


@contextmanager
def mirror_db_session():
    if MirrorSessionLocal is None:
        yield None
        return

    db = MirrorSessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from backend import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_fan_columns(engine)
    _ensure_rpm_line_columns(engine)
    _remove_deprecated_fan_manufacturer_column(engine)
    _ensure_user_columns(engine)
    _migrate_legacy_map_points(engine)

    if mirror_engine is not None:
        Base.metadata.create_all(bind=mirror_engine)
        _ensure_fan_columns(mirror_engine)
        _ensure_rpm_line_columns(mirror_engine)
        _remove_deprecated_fan_manufacturer_column(mirror_engine)
        _ensure_user_columns(mirror_engine)
        _migrate_legacy_map_points(mirror_engine)


def _ensure_fan_columns(target_engine):
    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "fans" not in tables:
        return

    boolean_true_sql = "TRUE" if target_engine.dialect.name == "postgresql" else "1"
    existing_columns = {column["name"] for column in inspector.get_columns("fans")}
    missing_columns = {
        "mounting_style": "VARCHAR(255)",
        "discharge_type": "VARCHAR(255)",
        "graph_image_path": "VARCHAR(512)",
        "show_rpm_band_shading": f"BOOLEAN NOT NULL DEFAULT {boolean_true_sql}",
        "band_graph_background_color": "VARCHAR(32)",
        "band_graph_label_text_color": "VARCHAR(32)",
        "band_graph_faded_opacity": "FLOAT",
        "band_graph_permissible_label_color": "VARCHAR(32)",
    }

    with target_engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE fans ADD COLUMN {column_name} {column_type}"))
        connection.execute(
            text(
                f"UPDATE fans SET show_rpm_band_shading = {boolean_true_sql} "
                "WHERE show_rpm_band_shading IS NULL"
            )
        )


def _ensure_user_columns(target_engine):
    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    boolean_true_sql = "TRUE" if target_engine.dialect.name == "postgresql" else "1"
    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    missing_columns = {
        "is_admin": f"BOOLEAN NOT NULL DEFAULT {boolean_true_sql}",
        "is_active": f"BOOLEAN NOT NULL DEFAULT {boolean_true_sql}",
    }

    with target_engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"))
        connection.execute(text(f"UPDATE users SET is_admin = {boolean_true_sql} WHERE is_admin IS NULL"))
        connection.execute(text(f"UPDATE users SET is_active = {boolean_true_sql} WHERE is_active IS NULL"))


def _ensure_rpm_line_columns(target_engine):
    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "rpm_lines" not in tables:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("rpm_lines")}
    if "band_color" in existing_columns:
        return

    with target_engine.begin() as connection:
        connection.execute(text("ALTER TABLE rpm_lines ADD COLUMN band_color VARCHAR(32)"))


def _remove_deprecated_fan_manufacturer_column(target_engine):
    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "fans" not in tables:
        return

    existing_columns = [column["name"] for column in inspector.get_columns("fans")]
    if "manufacturer" not in existing_columns:
        return

    if target_engine.dialect.name == "postgresql":
        with target_engine.begin() as connection:
            connection.execute(text("ALTER TABLE fans DROP COLUMN IF EXISTS manufacturer"))
        return

    if target_engine.dialect.name != "sqlite":
        return

    with target_engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text("DROP TABLE IF EXISTS fans__new"))
        connection.execute(
            text(
                """
                CREATE TABLE fans__new (
                    id INTEGER PRIMARY KEY,
                    model VARCHAR(255) NOT NULL,
                    notes TEXT,
                    mounting_style VARCHAR(255),
                    discharge_type VARCHAR(255),
                    graph_image_path VARCHAR(512),
                    show_rpm_band_shading BOOLEAN NOT NULL DEFAULT 1,
                    band_graph_background_color VARCHAR(32),
                    band_graph_label_text_color VARCHAR(32),
                    band_graph_faded_opacity FLOAT,
                    band_graph_permissible_label_color VARCHAR(32),
                    diameter_mm FLOAT,
                    max_rpm FLOAT
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO fans__new (
                    id,
                    model,
                    notes,
                    mounting_style,
                    discharge_type,
                    graph_image_path,
                    show_rpm_band_shading,
                    band_graph_background_color,
                    band_graph_label_text_color,
                    band_graph_faded_opacity,
                    band_graph_permissible_label_color,
                    diameter_mm,
                    max_rpm
                )
                SELECT
                    id,
                    model,
                    notes,
                    mounting_style,
                    discharge_type,
                    graph_image_path,
                    show_rpm_band_shading,
                    NULL AS band_graph_background_color,
                    NULL AS band_graph_label_text_color,
                    NULL AS band_graph_faded_opacity,
                    NULL AS band_graph_permissible_label_color,
                    diameter_mm,
                    max_rpm
                FROM fans
                """
            )
        )
        connection.execute(text("DROP TABLE fans"))
        connection.execute(text("ALTER TABLE fans__new RENAME TO fans"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_fans_id ON fans (id)"))
        connection.execute(text("PRAGMA foreign_keys=ON"))


def _migrate_legacy_map_points(target_engine):
    if target_engine.dialect.name != "sqlite":
        return

    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "map_points" not in tables:
        return
    existing_columns = {column["name"] for column in inspector.get_columns("map_points")}

    with target_engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text("DROP TABLE IF EXISTS rpm_points"))
        connection.execute(text("DROP TABLE IF EXISTS rpm_lines"))
        connection.execute(text("DROP TABLE IF EXISTS efficiency_points"))
        connection.execute(
            text(
                """
                CREATE TABLE rpm_lines (
                    id INTEGER PRIMARY KEY,
                    fan_id INTEGER NOT NULL,
                    rpm FLOAT NOT NULL,
                    FOREIGN KEY(fan_id) REFERENCES fans (id)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE rpm_points (
                    id INTEGER PRIMARY KEY,
                    fan_id INTEGER NOT NULL,
                    rpm_line_id INTEGER NOT NULL,
                    flow FLOAT NOT NULL,
                    pressure FLOAT NOT NULL,
                    FOREIGN KEY(fan_id) REFERENCES fans (id),
                    FOREIGN KEY(rpm_line_id) REFERENCES rpm_lines (id)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE efficiency_points (
                    id INTEGER PRIMARY KEY,
                    fan_id INTEGER NOT NULL,
                    flow FLOAT NOT NULL,
                    efficiency_centre FLOAT,
                    efficiency_lower_end FLOAT,
                    efficiency_higher_end FLOAT,
                    permissible_use FLOAT,
                    FOREIGN KEY(fan_id) REFERENCES fans (id)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO rpm_lines (fan_id, rpm)
                SELECT DISTINCT fan_id, rpm
                FROM map_points
                """
            )
        )
        connection.execute(
            text(
                f"""
                INSERT INTO efficiency_points (
                    fan_id,
                    flow,
                    efficiency_centre,
                    efficiency_lower_end,
                    efficiency_higher_end,
                    permissible_use
                )
                SELECT DISTINCT
                    fan_id,
                    flow,
                    {"efficiency_centre" if "efficiency_centre" in existing_columns else "efficiency"} AS efficiency_centre,
                    {"efficiency_lower_end" if "efficiency_lower_end" in existing_columns else "lower_permissible"} AS efficiency_lower_end,
                    {"efficiency_higher_end" if "efficiency_higher_end" in existing_columns else "upper_permissible"} AS efficiency_higher_end,
                    {"permissible_use" if "permissible_use" in existing_columns else "NULL"} AS permissible_use
                FROM map_points
                WHERE
                    {"efficiency_centre" if "efficiency_centre" in existing_columns else "efficiency"} IS NOT NULL
                    OR {"efficiency_lower_end" if "efficiency_lower_end" in existing_columns else "lower_permissible"} IS NOT NULL
                    OR {"efficiency_higher_end" if "efficiency_higher_end" in existing_columns else "upper_permissible"} IS NOT NULL
                    OR {"permissible_use" if "permissible_use" in existing_columns else "NULL"} IS NOT NULL
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO rpm_points (fan_id, rpm_line_id, flow, pressure)
                SELECT
                    mp.fan_id,
                    rl.id,
                    mp.flow,
                    mp.pressure
                FROM map_points mp
                JOIN rpm_lines rl
                  ON rl.fan_id = mp.fan_id
                 AND rl.rpm = mp.rpm
                """
            )
        )
        connection.execute(text("DROP TABLE map_points"))
        connection.execute(text("PRAGMA foreign_keys=ON"))
