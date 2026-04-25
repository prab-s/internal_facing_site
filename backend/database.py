import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DEFAULT_DATA_DIR = os.path.join(PROJECT_ROOT, "data")
os.makedirs(DEFAULT_DATA_DIR, exist_ok=True)

DEFAULT_DB_PATH = os.path.join(DEFAULT_DATA_DIR, "fans.db")
PRIMARY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")


def _build_engine(database_url: str):
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite:") else {}
    return create_engine(
        database_url,
        connect_args=connect_args,
        echo=False,
    )


engine = _build_engine(PRIMARY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _get_product_table_name(inspector):
    tables = set(inspector.get_table_names())
    if "products" in tables:
        return "products"
    if "fans" in tables:
        return "fans"
    return None


def get_db():
    db = SessionLocal()
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
    _remove_deprecated_fan_notes_column(engine)
    _remove_deprecated_product_optional_columns(engine)
    _ensure_product_platform_columns(engine)
    _ensure_series_template_columns(engine)
    _rename_series_comments_column(engine)
    _ensure_product_type_columns(engine)
    _ensure_product_type_parameter_preset_columns(engine)
    _remove_deprecated_product_type_secondary_axis_label(engine)
    _ensure_user_columns(engine)
    _seed_product_types(engine)
    _migrate_legacy_map_points(engine)


def _ensure_fan_columns(target_engine):
    inspector = inspect(target_engine)
    product_table_name = _get_product_table_name(inspector)
    if not product_table_name:
        return

    boolean_true_sql = "TRUE" if target_engine.dialect.name == "postgresql" else "1"
    existing_columns = {column["name"] for column in inspector.get_columns(product_table_name)}
    missing_columns = {
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
                connection.execute(text(f"ALTER TABLE {product_table_name} ADD COLUMN {column_name} {column_type}"))
        connection.execute(
            text(
                f"UPDATE {product_table_name} SET show_rpm_band_shading = {boolean_true_sql} "
                "WHERE show_rpm_band_shading IS NULL"
            )
        )


def _ensure_product_platform_columns(target_engine):
    inspector = inspect(target_engine)
    product_table_name = _get_product_table_name(inspector)
    if not product_table_name:
        return

    existing_columns = {column["name"] for column in inspector.get_columns(product_table_name)}
    missing_columns = {
        "product_type_id": "INTEGER",
        "series_id": "INTEGER",
        "series_name": "VARCHAR(255)",
        "template_id": "VARCHAR(128)",
        "printed_template_id": "VARCHAR(128)",
        "online_template_id": "VARCHAR(128)",
        "description1_html": "TEXT",
        "description2_html": "TEXT",
        "description3_html": "TEXT",
        "comments_html": "TEXT",
    }

    with target_engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE {product_table_name} ADD COLUMN {column_name} {column_type}"))
        connection.execute(
            text(
                f"""
                UPDATE {product_table_name}
                SET
                    printed_template_id = COALESCE(printed_template_id, template_id),
                    online_template_id = COALESCE(online_template_id, template_id)
                WHERE template_id IS NOT NULL
                """
            )
        )


def _ensure_series_template_columns(target_engine):
    inspector = inspect(target_engine)
    if "series" not in set(inspector.get_table_names()):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("series")}
    missing_columns = {
        "printed_template_id": "VARCHAR(128)",
        "online_template_id": "VARCHAR(128)",
    }

    with target_engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE series ADD COLUMN {column_name} {column_type}"))
        connection.execute(
            text(
                """
                UPDATE series
                SET
                    printed_template_id = COALESCE(printed_template_id, template_id),
                    online_template_id = COALESCE(online_template_id, template_id)
                WHERE template_id IS NOT NULL
                """
            )
        )


def _rename_series_comments_column(target_engine):
    inspector = inspect(target_engine)
    if "series" not in set(inspector.get_table_names()):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("series")}
    if "comments_html" not in existing_columns or "description4_html" in existing_columns:
        return

    with target_engine.begin() as connection:
        connection.execute(text("ALTER TABLE series RENAME COLUMN comments_html TO description4_html"))


def _ensure_product_type_columns(target_engine):
    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "product_types" not in tables:
        return

    boolean_false_sql = "FALSE" if target_engine.dialect.name == "postgresql" else "0"
    existing_columns = {column["name"] for column in inspector.get_columns("product_types")}
    missing_columns = {
        "supports_graph_overlays": f"BOOLEAN NOT NULL DEFAULT {boolean_false_sql}",
        "supports_band_graph_style": f"BOOLEAN NOT NULL DEFAULT {boolean_false_sql}",
        "graph_line_value_label": "VARCHAR(128)",
        "graph_line_value_unit": "VARCHAR(64)",
        "graph_x_axis_label": "VARCHAR(128)",
        "graph_x_axis_unit": "VARCHAR(64)",
        "graph_y_axis_label": "VARCHAR(128)",
        "graph_y_axis_unit": "VARCHAR(64)",
        "product_template_id": "VARCHAR(128)",
        "printed_product_template_id": "VARCHAR(128)",
        "online_product_template_id": "VARCHAR(128)",
        "band_graph_background_color": "VARCHAR(32)",
        "band_graph_label_text_color": "VARCHAR(32)",
        "band_graph_faded_opacity": "FLOAT",
        "band_graph_permissible_label_color": "VARCHAR(32)",
    }

    with target_engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE product_types ADD COLUMN {column_name} {column_type}"))
        connection.execute(
            text(
                """
                UPDATE product_types
                SET
                    printed_product_template_id = COALESCE(printed_product_template_id, product_template_id),
                    online_product_template_id = COALESCE(online_product_template_id, product_template_id)
                WHERE product_template_id IS NOT NULL
                """
            )
        )


def _ensure_product_type_parameter_preset_columns(target_engine):
    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "product_type_parameter_presets" not in tables:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("product_type_parameter_presets")}
    missing_columns = {
        "value_string": "TEXT",
        "value_number": "FLOAT",
    }

    with target_engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE product_type_parameter_presets ADD COLUMN {column_name} {column_type}")
                )


def _seed_product_types(target_engine):
    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    required_tables = {
        "product_types",
        "product_type_parameter_group_presets",
        "product_type_parameter_presets",
    }
    if not required_tables.issubset(tables):
        return

    seeds = [
        {
            "key": "fan",
            "label": "Fan",
            "supports_graph": True,
            "graph_kind": "fan_map",
            "supports_graph_overlays": True,
            "supports_band_graph_style": True,
            "graph_line_value_label": "RPM",
            "graph_line_value_unit": "RPM",
            "graph_x_axis_label": "Airflow",
            "graph_x_axis_unit": "L/s",
            "graph_y_axis_label": "Pressure",
            "graph_y_axis_unit": "Pa",
            "product_template_id": None,
            "band_graph_background_color": "#ffffff",
            "band_graph_label_text_color": "#000000",
            "band_graph_faded_opacity": 0.18,
            "band_graph_permissible_label_color": "#000000",
            "groups": [
                ("Impeller", [("Size", "mm"), ("Type", None), ("Material", None), ("Motor finish", None)]),
                ("Motor", [("Type", None), ("IP Rating", None), ("Insulation", None), ("Power", "kW"), ("Power Supply", None), ("Speed", "RPM"), ("FLC", "A"), ("Capacitor", None), ("Control", None), ("Protection", None)]),
                ("Fan", [("Plate", None), ("Weight", "kg"), ("Max. Temp", "°C")]),
            ],
        },
        {
            "key": "silencer",
            "label": "Silencer",
            "supports_graph": True,
            "graph_kind": "silencer_loss",
            "supports_graph_overlays": False,
            "supports_band_graph_style": False,
            "graph_line_value_label": "Diameter",
            "graph_line_value_unit": "mm",
            "graph_x_axis_label": "Volume Flow",
            "graph_x_axis_unit": "L/s",
            "graph_y_axis_label": "Pressure Loss",
            "graph_y_axis_unit": "Pa",
            "product_template_id": None,
            "band_graph_background_color": "#ffffff",
            "band_graph_label_text_color": "#000000",
            "band_graph_faded_opacity": 0.18,
            "band_graph_permissible_label_color": "#000000",
            "groups": [
                ("Silencer", [("Diameter", "mm"), ("Length", "mm"), ("Casing", None), ("Media", None), ("Weight", "kg")]),
            ],
        },
        {
            "key": "speed_controller",
            "label": "Speed Controller",
            "supports_graph": False,
            "graph_kind": None,
            "supports_graph_overlays": False,
            "supports_band_graph_style": False,
            "graph_line_value_label": None,
            "graph_line_value_unit": None,
            "graph_x_axis_label": None,
            "graph_x_axis_unit": None,
            "graph_y_axis_label": None,
            "graph_y_axis_unit": None,
            "product_template_id": None,
            "band_graph_background_color": "#ffffff",
            "band_graph_label_text_color": "#000000",
            "band_graph_faded_opacity": 0.18,
            "band_graph_permissible_label_color": "#000000",
            "groups": [
                ("Controller", [("Power Supply", None), ("Current", "A"), ("Mounting", None), ("Protection", None)]),
            ],
        },
    ]

    with target_engine.begin() as connection:
        product_type_ids: dict[str, int] = {}
        for seed in seeds:
            created_product_type = False
            existing = connection.execute(
                text("SELECT id FROM product_types WHERE key = :key"),
                {"key": seed["key"]},
            ).scalar()
            if existing is None:
                created_product_type = True
                inserted = connection.execute(
                    text(
                        """
                        INSERT INTO product_types (
                            key,
                            label,
                            supports_graph,
                            graph_kind,
                            supports_graph_overlays,
                            supports_band_graph_style,
                            graph_line_value_label,
                            graph_line_value_unit,
                            graph_x_axis_label,
                            graph_x_axis_unit,
                            graph_y_axis_label,
                            graph_y_axis_unit,
                            product_template_id,
                            band_graph_background_color,
                            band_graph_label_text_color,
                            band_graph_faded_opacity,
                            band_graph_permissible_label_color
                        )
                        VALUES (
                            :key,
                            :label,
                            :supports_graph,
                            :graph_kind,
                            :supports_graph_overlays,
                            :supports_band_graph_style,
                            :graph_line_value_label,
                            :graph_line_value_unit,
                            :graph_x_axis_label,
                            :graph_x_axis_unit,
                            :graph_y_axis_label,
                            :graph_y_axis_unit,
                            :product_template_id,
                            :band_graph_background_color,
                            :band_graph_label_text_color,
                            :band_graph_faded_opacity,
                            :band_graph_permissible_label_color
                        )
                        """
                    ),
                    {
                        "key": seed["key"],
                        "label": seed["label"],
                        "supports_graph": seed["supports_graph"],
                        "graph_kind": seed["graph_kind"],
                        "supports_graph_overlays": seed["supports_graph_overlays"],
                        "supports_band_graph_style": seed["supports_band_graph_style"],
                        "graph_line_value_label": seed["graph_line_value_label"],
                        "graph_line_value_unit": seed["graph_line_value_unit"],
                        "graph_x_axis_label": seed["graph_x_axis_label"],
                        "graph_x_axis_unit": seed["graph_x_axis_unit"],
                        "graph_y_axis_label": seed["graph_y_axis_label"],
                        "graph_y_axis_unit": seed["graph_y_axis_unit"],
                        "product_template_id": seed["product_template_id"],
                        "band_graph_background_color": seed["band_graph_background_color"],
                        "band_graph_label_text_color": seed["band_graph_label_text_color"],
                        "band_graph_faded_opacity": seed["band_graph_faded_opacity"],
                        "band_graph_permissible_label_color": seed["band_graph_permissible_label_color"],
                    },
                )
                existing = connection.execute(
                    text("SELECT id FROM product_types WHERE key = :key"),
                    {"key": seed["key"]},
                ).scalar()
            else:
                connection.execute(
                    text(
                        """
                        UPDATE product_types
                        SET
                            label = :label,
                            supports_graph = :supports_graph,
                            graph_kind = :graph_kind,
                            supports_graph_overlays = :supports_graph_overlays,
                            supports_band_graph_style = :supports_band_graph_style,
                            graph_line_value_label = :graph_line_value_label,
                            graph_line_value_unit = :graph_line_value_unit,
                            graph_x_axis_label = :graph_x_axis_label,
                            graph_x_axis_unit = :graph_x_axis_unit,
                            graph_y_axis_label = :graph_y_axis_label,
                            graph_y_axis_unit = :graph_y_axis_unit,
                            band_graph_background_color = :band_graph_background_color,
                            band_graph_label_text_color = :band_graph_label_text_color,
                            band_graph_faded_opacity = :band_graph_faded_opacity,
                            band_graph_permissible_label_color = :band_graph_permissible_label_color
                        WHERE id = :id
                        """
                    ),
                    {
                        "id": existing,
                        "label": seed["label"],
                        "supports_graph": seed["supports_graph"],
                        "graph_kind": seed["graph_kind"],
                        "supports_graph_overlays": seed["supports_graph_overlays"],
                        "supports_band_graph_style": seed["supports_band_graph_style"],
                        "graph_line_value_label": seed["graph_line_value_label"],
                        "graph_line_value_unit": seed["graph_line_value_unit"],
                        "graph_x_axis_label": seed["graph_x_axis_label"],
                        "graph_x_axis_unit": seed["graph_x_axis_unit"],
                        "graph_y_axis_label": seed["graph_y_axis_label"],
                        "graph_y_axis_unit": seed["graph_y_axis_unit"],
                        "band_graph_background_color": seed["band_graph_background_color"],
                        "band_graph_label_text_color": seed["band_graph_label_text_color"],
                        "band_graph_faded_opacity": seed["band_graph_faded_opacity"],
                        "band_graph_permissible_label_color": seed["band_graph_permissible_label_color"],
                    },
                )
                if seed["product_template_id"] is None:
                    connection.execute(
                        text(
                            """
                            UPDATE product_types
                            SET product_template_id = NULL
                            WHERE id = :id AND product_template_id = 'product-default'
                            """
                        ),
                        {"id": existing},
                    )
            product_type_ids[seed["key"]] = int(existing)

            existing_group_count = connection.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM product_type_parameter_group_presets
                    WHERE product_type_id = :product_type_id
                    """
                ),
                {"product_type_id": existing},
            ).scalar()
            if not created_product_type and existing_group_count:
                # Preserve saved presets for existing product types instead of
                # reapplying the built-in seed definitions on every startup.
                continue

            for group_index, (group_name, parameters) in enumerate(seed["groups"]):
                group_id = connection.execute(
                    text(
                        """
                        SELECT id
                        FROM product_type_parameter_group_presets
                        WHERE product_type_id = :product_type_id AND group_name = :group_name
                        """
                    ),
                    {"product_type_id": existing, "group_name": group_name},
                ).scalar()
                if group_id is None:
                    connection.execute(
                        text(
                            """
                            INSERT INTO product_type_parameter_group_presets (product_type_id, group_name, sort_order)
                            VALUES (:product_type_id, :group_name, :sort_order)
                            """
                        ),
                        {
                            "product_type_id": existing,
                            "group_name": group_name,
                            "sort_order": group_index,
                        },
                    )
                    group_id = connection.execute(
                        text(
                            """
                            SELECT id
                            FROM product_type_parameter_group_presets
                            WHERE product_type_id = :product_type_id AND group_name = :group_name
                            """
                        ),
                        {"product_type_id": existing, "group_name": group_name},
                    ).scalar()
                else:
                    connection.execute(
                        text(
                            """
                            UPDATE product_type_parameter_group_presets
                            SET sort_order = :sort_order
                            WHERE id = :id
                            """
                        ),
                        {"id": group_id, "sort_order": group_index},
                    )

                for parameter_index, (parameter_name, preferred_unit) in enumerate(parameters):
                    preset_exists = connection.execute(
                        text(
                            """
                            SELECT id
                            FROM product_type_parameter_presets
                            WHERE group_preset_id = :group_preset_id AND parameter_name = :parameter_name
                            """
                        ),
                        {
                            "group_preset_id": group_id,
                            "parameter_name": parameter_name,
                        },
                    ).scalar()
                    if preset_exists is None:
                        connection.execute(
                            text(
                                """
                                INSERT INTO product_type_parameter_presets (
                                    group_preset_id,
                                    parameter_name,
                                    sort_order,
                                    preferred_unit,
                                    value_string,
                                    value_number
                                )
                                VALUES (
                                    :group_preset_id,
                                    :parameter_name,
                                    :sort_order,
                                    :preferred_unit,
                                    NULL,
                                    NULL
                                )
                                """
                            ),
                            {
                                "group_preset_id": group_id,
                                "parameter_name": parameter_name,
                                "sort_order": parameter_index,
                                "preferred_unit": preferred_unit,
                            },
                        )
                    else:
                        connection.execute(
                            text(
                                """
                                UPDATE product_type_parameter_presets
                                SET sort_order = :sort_order, preferred_unit = :preferred_unit
                                WHERE id = :id
                                """
                            ),
                            {
                                "id": preset_exists,
                                "sort_order": parameter_index,
                                "preferred_unit": preferred_unit,
                            },
                        )

        fan_product_type_id = product_type_ids.get("fan")
        if fan_product_type_id is not None:
            product_table_name = _get_product_table_name(inspect(target_engine))
            connection.execute(
                text(
                    f"""
                    UPDATE {product_table_name}
                    SET product_type_id = :product_type_id
                    WHERE product_type_id IS NULL
                    """
                ),
                {"product_type_id": fan_product_type_id},
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
    product_table_name = _get_product_table_name(inspector)
    if not product_table_name:
        return

    existing_columns = [column["name"] for column in inspector.get_columns(product_table_name)]
    if "manufacturer" not in existing_columns:
        return

    if target_engine.dialect.name == "postgresql":
        with target_engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE {product_table_name} DROP COLUMN IF EXISTS manufacturer"))
        return

    if target_engine.dialect.name != "sqlite":
        return

    temp_table_name = f"{product_table_name}__new"
    product_index_name = "ix_products_id" if product_table_name == "products" else "ix_fans_id"

    with target_engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text(f"DROP TABLE IF EXISTS {temp_table_name}"))
        connection.execute(
            text(
                f"""
                CREATE TABLE {temp_table_name} (
                    id INTEGER PRIMARY KEY,
                    model VARCHAR(255) NOT NULL,
                    notes TEXT,
                    graph_image_path VARCHAR(512),
                    show_rpm_band_shading BOOLEAN NOT NULL DEFAULT 1,
                    band_graph_background_color VARCHAR(32),
                    band_graph_label_text_color VARCHAR(32),
                    band_graph_faded_opacity FLOAT,
                    band_graph_permissible_label_color VARCHAR(32)
                )
                """
            )
        )
        connection.execute(
            text(
                f"""
                INSERT INTO {temp_table_name} (
                    id,
                    model,
                    notes,
                    graph_image_path,
                    show_rpm_band_shading,
                    band_graph_background_color,
                    band_graph_label_text_color,
                    band_graph_faded_opacity,
                    band_graph_permissible_label_color
                )
                SELECT
                    id,
                    model,
                    notes,
                    graph_image_path,
                    show_rpm_band_shading,
                    NULL AS band_graph_background_color,
                    NULL AS band_graph_label_text_color,
                    NULL AS band_graph_faded_opacity,
                    NULL AS band_graph_permissible_label_color
                FROM {product_table_name}
                """
            )
        )
        connection.execute(text(f"DROP TABLE {product_table_name}"))
        connection.execute(text(f"ALTER TABLE {temp_table_name} RENAME TO {product_table_name}"))
        connection.execute(text(f"CREATE INDEX IF NOT EXISTS {product_index_name} ON {product_table_name} (id)"))
        connection.execute(text("PRAGMA foreign_keys=ON"))


def _remove_deprecated_fan_notes_column(target_engine):
    inspector = inspect(target_engine)
    product_table_name = _get_product_table_name(inspector)
    if not product_table_name:
        return

    existing_columns = [column["name"] for column in inspector.get_columns(product_table_name)]
    if "notes" not in existing_columns:
        return

    if target_engine.dialect.name == "postgresql":
        with target_engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE {product_table_name} DROP COLUMN IF EXISTS notes"))
        return

    if target_engine.dialect.name != "sqlite":
        return

    temp_table_name = f"{product_table_name}__new"
    product_index_name = "ix_products_id" if product_table_name == "products" else "ix_fans_id"

    with target_engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text(f"DROP TABLE IF EXISTS {temp_table_name}"))
        connection.execute(
            text(
                f"""
                CREATE TABLE {temp_table_name} (
                    id INTEGER PRIMARY KEY,
                    model VARCHAR(255) NOT NULL,
                    graph_image_path VARCHAR(512),
                    show_rpm_band_shading BOOLEAN NOT NULL DEFAULT 1,
                    band_graph_background_color VARCHAR(32),
                    band_graph_label_text_color VARCHAR(32),
                    band_graph_faded_opacity FLOAT,
                    band_graph_permissible_label_color VARCHAR(32)
                )
                """
            )
        )
        connection.execute(
            text(
                f"""
                INSERT INTO {temp_table_name} (
                    id,
                    model,
                    graph_image_path,
                    show_rpm_band_shading,
                    band_graph_background_color,
                    band_graph_label_text_color,
                    band_graph_faded_opacity,
                    band_graph_permissible_label_color
                )
                SELECT
                    id,
                    model,
                    graph_image_path,
                    show_rpm_band_shading,
                    band_graph_background_color,
                    band_graph_label_text_color,
                    band_graph_faded_opacity,
                    band_graph_permissible_label_color
                FROM {product_table_name}
                """
            )
        )
        connection.execute(text(f"DROP TABLE {product_table_name}"))
        connection.execute(text(f"ALTER TABLE {temp_table_name} RENAME TO {product_table_name}"))
        connection.execute(text(f"CREATE INDEX IF NOT EXISTS {product_index_name} ON {product_table_name} (id)"))
        connection.execute(text("PRAGMA foreign_keys=ON"))


def _remove_deprecated_product_optional_columns(target_engine):
    inspector = inspect(target_engine)
    product_table_name = _get_product_table_name(inspector)
    if not product_table_name:
        return

    existing_columns = {column["name"] for column in inspector.get_columns(product_table_name)}
    deprecated_columns = [name for name in ("diameter_mm", "max_rpm") if name in existing_columns]
    if not deprecated_columns:
        return

    if target_engine.dialect.name == "postgresql":
        with target_engine.begin() as connection:
            for column_name in deprecated_columns:
                connection.execute(text(f"ALTER TABLE {product_table_name} DROP COLUMN IF EXISTS {column_name}"))
        return

    if target_engine.dialect.name != "sqlite":
        return

    temp_table_name = f"{product_table_name}__new"
    product_index_name = "ix_products_id" if product_table_name == "products" else "ix_fans_id"

    with target_engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text(f"DROP TABLE IF EXISTS {temp_table_name}"))
        connection.execute(
            text(
                f"""
                CREATE TABLE {temp_table_name} (
                    id INTEGER PRIMARY KEY,
                    product_type_id INTEGER,
                    model VARCHAR(255) NOT NULL,
                    description1_html TEXT,
                    description2_html TEXT,
                    description3_html TEXT,
                    comments_html TEXT,
                    graph_image_path VARCHAR(512),
                    show_rpm_band_shading BOOLEAN NOT NULL DEFAULT 1,
                    band_graph_background_color VARCHAR(32),
                    band_graph_label_text_color VARCHAR(32),
                    band_graph_faded_opacity FLOAT,
                    band_graph_permissible_label_color VARCHAR(32),
                    FOREIGN KEY(product_type_id) REFERENCES product_types (id)
                )
                """
            )
        )
        connection.execute(
            text(
                f"""
                INSERT INTO {temp_table_name} (
                    id,
                    product_type_id,
                    model,
                    description1_html,
                    description2_html,
                    description3_html,
                    comments_html,
                    graph_image_path,
                    show_rpm_band_shading,
                    band_graph_background_color,
                    band_graph_label_text_color,
                    band_graph_faded_opacity,
                    band_graph_permissible_label_color
                )
                SELECT
                    id,
                    product_type_id,
                    model,
                    description1_html,
                    description2_html,
                    description3_html,
                    comments_html,
                    graph_image_path,
                    show_rpm_band_shading,
                    band_graph_background_color,
                    band_graph_label_text_color,
                    band_graph_faded_opacity,
                    band_graph_permissible_label_color
                FROM {product_table_name}
                """
            )
        )
        connection.execute(text(f"DROP TABLE {product_table_name}"))
        connection.execute(text(f"ALTER TABLE {temp_table_name} RENAME TO {product_table_name}"))
        connection.execute(text(f"CREATE INDEX IF NOT EXISTS {product_index_name} ON {product_table_name} (id)"))
        connection.execute(text("PRAGMA foreign_keys=ON"))


def _remove_deprecated_product_type_secondary_axis_label(target_engine):
    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "product_types" not in tables:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("product_types")}
    if "graph_secondary_axis_label" not in existing_columns:
        return

    if target_engine.dialect.name == "postgresql":
        with target_engine.begin() as connection:
            connection.execute(text("ALTER TABLE product_types DROP COLUMN IF EXISTS graph_secondary_axis_label"))
        return

    if target_engine.dialect.name != "sqlite":
        return

    with target_engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        connection.execute(text("DROP TABLE IF EXISTS product_types__new"))
        connection.execute(
            text(
                """
                CREATE TABLE product_types__new (
                    id INTEGER PRIMARY KEY,
                    key VARCHAR(64) NOT NULL UNIQUE,
                    label VARCHAR(255) NOT NULL,
                    supports_graph BOOLEAN NOT NULL DEFAULT 0,
                    graph_kind VARCHAR(64),
                    supports_graph_overlays BOOLEAN NOT NULL DEFAULT 0,
                    supports_band_graph_style BOOLEAN NOT NULL DEFAULT 0,
                    graph_line_value_label VARCHAR(128),
                    graph_line_value_unit VARCHAR(64),
                    graph_x_axis_label VARCHAR(128),
                    graph_x_axis_unit VARCHAR(64),
                    graph_y_axis_label VARCHAR(128),
                    graph_y_axis_unit VARCHAR(64),
                    product_template_id VARCHAR(128),
                    printed_product_template_id VARCHAR(128),
                    online_product_template_id VARCHAR(128)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO product_types__new (
                    id,
                    key,
                    label,
                    supports_graph,
                    graph_kind,
                    supports_graph_overlays,
                    supports_band_graph_style,
                    graph_line_value_label,
                    graph_line_value_unit,
                    graph_x_axis_label,
                    graph_x_axis_unit,
                    graph_y_axis_label,
                    graph_y_axis_unit,
                    product_template_id,
                    printed_product_template_id,
                    online_product_template_id
                )
                SELECT
                    id,
                    key,
                    label,
                    supports_graph,
                    graph_kind,
                    supports_graph_overlays,
                    supports_band_graph_style,
                    graph_line_value_label,
                    graph_line_value_unit,
                    graph_x_axis_label,
                    graph_x_axis_unit,
                    graph_y_axis_label,
                    graph_y_axis_unit,
                    product_template_id,
                    printed_product_template_id,
                    online_product_template_id
                FROM product_types
                """
            )
        )
        connection.execute(text("DROP TABLE product_types"))
        connection.execute(text("ALTER TABLE product_types__new RENAME TO product_types"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_product_types_id ON product_types (id)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_product_types_key ON product_types (key)"))
        connection.execute(text("PRAGMA foreign_keys=ON"))


def _migrate_legacy_map_points(target_engine):
    if target_engine.dialect.name != "sqlite":
        return

    inspector = inspect(target_engine)
    tables = set(inspector.get_table_names())
    if "map_points" not in tables:
        return
    existing_columns = {column["name"] for column in inspector.get_columns("map_points")}
    product_table_name = _get_product_table_name(inspector) or "products"
    product_fk_column = "product_id" if product_table_name == "products" else "fan_id"

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
                    {product_fk_column} INTEGER NOT NULL,
                    rpm FLOAT NOT NULL,
                    FOREIGN KEY({product_fk_column}) REFERENCES {product_table_name} (id)
                )
                """
            )
        )
        connection.execute(
            text(
                f"""
                CREATE TABLE rpm_points (
                    id INTEGER PRIMARY KEY,
                    {product_fk_column} INTEGER NOT NULL,
                    rpm_line_id INTEGER NOT NULL,
                    flow FLOAT NOT NULL,
                    pressure FLOAT NOT NULL,
                    FOREIGN KEY({product_fk_column}) REFERENCES {product_table_name} (id),
                    FOREIGN KEY(rpm_line_id) REFERENCES rpm_lines (id)
                )
                """
            )
        )
        connection.execute(
            text(
                f"""
                CREATE TABLE efficiency_points (
                    id INTEGER PRIMARY KEY,
                    {product_fk_column} INTEGER NOT NULL,
                    flow FLOAT NOT NULL,
                    efficiency_centre FLOAT,
                    efficiency_lower_end FLOAT,
                    efficiency_higher_end FLOAT,
                    permissible_use FLOAT,
                    FOREIGN KEY({product_fk_column}) REFERENCES {product_table_name} (id)
                )
                """
            )
        )
        connection.execute(
            text(
                f"""
                INSERT INTO rpm_lines ({product_fk_column}, rpm)
                SELECT DISTINCT fan_id, rpm
                FROM map_points
                """
            )
        )
        connection.execute(
            text(
                f"""
                INSERT INTO efficiency_points (
                    {product_fk_column},
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
                f"""
                INSERT INTO rpm_points ({product_fk_column}, rpm_line_id, flow, pressure)
                SELECT
                    mp.fan_id,
                    rl.id,
                    mp.flow,
                    mp.pressure
                FROM map_points mp
                JOIN rpm_lines rl
                  ON rl.{product_fk_column} = mp.fan_id
                 AND rl.rpm = mp.rpm
                """
            )
        )
        connection.execute(text("DROP TABLE map_points"))
        connection.execute(text("PRAGMA foreign_keys=ON"))
