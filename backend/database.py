import os
import hashlib
import colorsys
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DEFAULT_DATA_DIR = os.path.join(PROJECT_ROOT, "data")
os.makedirs(DEFAULT_DATA_DIR, exist_ok=True)

PRIMARY_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not PRIMARY_DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be configured with a PostgreSQL connection string.")
if not PRIMARY_DATABASE_URL.startswith("postgresql"):
    raise RuntimeError("Only PostgreSQL is supported for DATABASE_URL.")
def _build_engine(database_url: str):
    return create_engine(
        database_url,
        echo=False,
    )


engine = _build_engine(PRIMARY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Diagnostic activity writes happen in request middleware while endpoint
# dependencies may still hold their normal request connections. Keep those
# writes off the main request pool so logging cannot starve application work.
activity_engine = create_engine(
    PRIMARY_DATABASE_URL,
    poolclass=NullPool,
    echo=False,
)
ActivitySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=activity_engine)

Base = declarative_base()


def _get_product_table_name(inspector):
    tables = set(inspector.get_table_names())
    if "products" in tables:
        return "products"
    if "fans" in tables:
        return "fans"
    return None


def _hex_from_hsl(hue: float, saturation: float, lightness: float) -> str:
    red, green, blue = colorsys.hls_to_rgb(hue % 1.0, lightness, saturation)
    return "#{:02x}{:02x}{:02x}".format(int(red * 255), int(green * 255), int(blue * 255))


def allocate_series_tab_color(seed: int | str, used_colors: set[str] | None = None) -> str:
    normalized_used = {str(color).strip().lower() for color in (used_colors or set()) if str(color).strip()}
    digest = hashlib.sha1(str(seed).encode("utf-8")).digest()
    base_hue = int.from_bytes(digest[:2], "big") / 65535.0
    base_saturation = 0.64 + (digest[2] / 255.0) * 0.12
    base_lightness = 0.46 + (digest[3] / 255.0) * 0.08

    for offset in range(720):
        hue = (base_hue + (offset * 0.61803398875)) % 1.0
        saturation = min(0.82, base_saturation + ((offset % 5) * 0.01))
        lightness = min(0.58, base_lightness + ((offset % 7) * 0.008))
        candidate = _hex_from_hsl(hue, saturation, lightness)
        if candidate.lower() not in normalized_used:
            return candidate

    raise RuntimeError("Unable to allocate a unique series tab color.")


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
    _ensure_series_contents_description_column(engine)
    _ensure_series_tab_color_column(engine)
    _ensure_product_type_columns(engine)
    _ensure_product_type_parameter_preset_columns(engine)
    _remove_deprecated_product_type_secondary_axis_label(engine)
    _ensure_user_columns(engine)
    _ensure_app_settings_smtp_columns(engine)
    _migrate_silencer_product_type_to_attenuator(engine)
    _migrate_silencer_product_type_pdfs(engine)
    _seed_product_types(engine)
    _ensure_product_type_sort_order(engine)
    _seed_site_pages()


def _seed_site_pages():
    """Create the initial CMS records without overwriting client changes."""
    from backend.models import SitePage
    from backend.site_cms import default_site_pages

    with SessionLocal() as db:
        changed = False
        for seed in default_site_pages():
            if db.query(SitePage).filter(SitePage.slug == seed["slug"]).first():
                continue
            db.add(SitePage(
                slug=seed["slug"],
                label=seed["label"],
                content_type=seed["content_type"],
                draft_content=seed["content"],
                published_content=seed["content"],
                draft_layout=seed.get("layout"),
                published_layout=seed.get("layout"),
                draft_seo=seed["seo"],
                published_seo=seed["seo"],
                status="published",
                published_at=datetime.now(timezone.utc),
            ))
            changed = True
        if changed:
            db.commit()


def sanitize_stored_rich_text(models, sanitizer, *, dry_run: bool = False) -> dict:
    """Sanitize persisted rich text only when explicitly requested.

    A JSON snapshot is written before committing changes so the operation is
    reversible if a legacy field contains formatting outside the allowlist.
    """
    rich_text_models = (
        (models.Product, (*tuple(f"description{index}_html" for index in range(1, 11)), "comments_html")),
        (models.Series, (*tuple(f"description{index}_html" for index in range(1, 11)), "contents_description")),
    )
    changed_values = []
    with SessionLocal() as db:
        for model, fields in rich_text_models:
            for record in db.query(model).all():
                for field in fields:
                    current = getattr(record, field, None)
                    cleaned = sanitizer(current)
                    if cleaned != current:
                        changed_values.append({
                            "model": model.__name__,
                            "id": record.id,
                            "field": field,
                            "original": current,
                            "sanitized": cleaned,
                        })

        result = {
            "dry_run": dry_run,
            "changed_count": len(changed_values),
            "backup_path": None,
        }
        if dry_run or not changed_values:
            return result

        backup_dir = Path(DEFAULT_DATA_DIR) / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = backup_dir / f"rich_text_before_sanitize_{timestamp}.json"
        backup_path.write_text(
            json.dumps(changed_values, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        for item in changed_values:
            model = next(model for model, _ in rich_text_models if model.__name__ == item["model"])
            record = db.get(model, item["id"])
            setattr(record, item["field"], item["sanitized"])
        db.commit()
        result["backup_path"] = str(backup_path)
        return result


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
        "permissible_use_mode": "VARCHAR(32) NOT NULL DEFAULT 'both'",
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
        connection.execute(
            text(
                f"UPDATE {product_table_name} SET permissible_use_mode = 'both' "
                "WHERE permissible_use_mode IS NULL OR permissible_use_mode = ''"
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
        **{f"description{index}_html": "TEXT" for index in range(4, 11)},
        "description_field_count": "INTEGER",
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
        connection.execute(
            text(f"UPDATE {product_table_name} SET description_field_count = 0 WHERE description_field_count IS NULL")
        )
        connection.execute(
            text(
                f"""
                UPDATE {product_table_name}
                SET description4_html = comments_html, comments_html = NULL
                WHERE description4_html IS NULL AND comments_html IS NOT NULL
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
        **{f"description{index}_html": "TEXT" for index in range(5, 11)},
        "description_field_count": "INTEGER",
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
        connection.execute(
            text("UPDATE series SET description_field_count = 0 WHERE description_field_count IS NULL")
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


def _ensure_series_contents_description_column(target_engine):
    inspector = inspect(target_engine)
    if "series" not in set(inspector.get_table_names()):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("series")}
    if "contents_description" not in existing_columns:
        with target_engine.begin() as connection:
            connection.execute(text("ALTER TABLE series ADD COLUMN contents_description TEXT"))
    elif target_engine.dialect.name == "postgresql":
        with target_engine.begin() as connection:
            connection.execute(text("ALTER TABLE series ALTER COLUMN contents_description TYPE TEXT"))


def _ensure_series_tab_color_column(target_engine):
    inspector = inspect(target_engine)
    if "series" not in set(inspector.get_table_names()):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("series")}
    if "series_tab_color" not in existing_columns:
        with target_engine.begin() as connection:
            connection.execute(text("ALTER TABLE series ADD COLUMN series_tab_color VARCHAR(32)"))

    with target_engine.begin() as connection:
        rows = connection.execute(text("SELECT id, series_tab_color FROM series ORDER BY id")).mappings().all()
        counts: dict[str, int] = {}
        for row in rows:
            color = row.get("series_tab_color")
            normalized_color = str(color).strip().lower() if color else ""
            if normalized_color:
                counts[normalized_color] = counts.get(normalized_color, 0) + 1

        used_colors: set[str] = set()
        rows_needing_color: list[dict] = []
        for row in rows:
            color = row.get("series_tab_color")
            normalized_color = str(color).strip().lower() if color else ""
            if normalized_color and counts.get(normalized_color, 0) == 1 and normalized_color not in used_colors:
                used_colors.add(normalized_color)
                continue
            rows_needing_color.append(row)

        for row in rows_needing_color:
            series_id = row["id"]
            next_color = allocate_series_tab_color(series_id, used_colors)
            used_colors.add(next_color.lower())
            connection.execute(
                text("UPDATE series SET series_tab_color = :series_tab_color WHERE id = :id"),
                {"series_tab_color": next_color, "id": series_id},
            )


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
        "sort_order": "INTEGER NOT NULL DEFAULT 0",
        "graph_line_value_label": "VARCHAR(128)",
        "graph_line_value_unit": "VARCHAR(64)",
        "graph_x_axis_label": "VARCHAR(128)",
        "graph_x_axis_unit": "VARCHAR(64)",
        "graph_y_axis_label": "VARCHAR(128)",
        "graph_y_axis_unit": "VARCHAR(64)",
        "product_type_template_id": "VARCHAR(128)",
        "product_type_pdf_series_order": "JSON",
        "product_template_id": "VARCHAR(128)",
        "series_template_id": "VARCHAR(128)",
        "printed_product_template_id": "VARCHAR(128)",
        "online_product_template_id": "VARCHAR(128)",
        "contents_icon_url": "VARCHAR(512)",
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
        "value_type": "TEXT",
        "value_string": "TEXT",
        "value_number": "FLOAT",
    }

    with target_engine.begin() as connection:
        for column_name, column_type in missing_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(f"ALTER TABLE product_type_parameter_presets ADD COLUMN {column_name} {column_type}")
                )
        connection.execute(
            text(
                """
                UPDATE product_type_parameter_presets
                SET value_type = CASE
                    WHEN value_string IS NOT NULL THEN 'string'
                    WHEN value_number IS NOT NULL OR preferred_unit IS NOT NULL THEN 'number'
                    ELSE 'string'
                END
                WHERE value_type IS NULL OR value_type = ''
                """
            )
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
            "sort_order": 0,
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
            "key": "speed_controller",
            "label": "Speed Controller",
            "sort_order": 1,
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
        {
            "key": "attenuator",
            "label": "Attenuator",
            "sort_order": 2,
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
                ("Attenuator", [("Diameter", "mm"), ("Length", "mm"), ("Casing", None), ("Media", None), ("Weight", "kg")]),
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
                            sort_order,
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
                            :sort_order,
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
                        "sort_order": seed["sort_order"],
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
                            sort_order = :sort_order,
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
                        "sort_order": seed["sort_order"],
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
                                    value_type,
                                    value_string,
                                    value_number
                                )
                                VALUES (
                                    :group_preset_id,
                                    :parameter_name,
                                    :sort_order,
                                    :preferred_unit,
                                    CASE WHEN :preferred_unit IS NULL THEN 'string' ELSE 'number' END,
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


def _migrate_silencer_product_type_to_attenuator(target_engine):
    inspector = inspect(target_engine)
    if "product_types" not in set(inspector.get_table_names()):
        return

    with target_engine.begin() as connection:
        attenuator_id = connection.execute(
            text("SELECT id FROM product_types WHERE key = :key"),
            {"key": "attenuator"},
        ).scalar()
        silencer_id = connection.execute(
            text("SELECT id FROM product_types WHERE key = :key"),
            {"key": "silencer"},
        ).scalar()

        if silencer_id is not None and attenuator_id is None:
            connection.execute(
                text(
                    """
                    UPDATE product_types
                    SET key = :new_key,
                        label = :label
                    WHERE id = :id
                    """
                ),
                {"id": silencer_id, "new_key": "attenuator", "label": "Attenuator"},
            )
            attenuator_id = silencer_id
        elif attenuator_id is not None:
            connection.execute(
                text(
                    """
                    UPDATE product_types
                    SET label = :label
                    WHERE id = :id
                    """
                ),
                {"id": attenuator_id, "label": "Attenuator"},
            )

        if attenuator_id is not None:
            connection.execute(
                text(
                    """
                    UPDATE product_type_parameter_group_presets
                    SET group_name = :new_name
                    WHERE product_type_id = :product_type_id AND group_name = :old_name
                    """
                ),
                {
                    "product_type_id": attenuator_id,
                    "old_name": "Silencer",
                    "new_name": "Attenuator",
                },
            )


def _migrate_silencer_product_type_pdfs(target_engine):
    pdf_dir = Path(DEFAULT_DATA_DIR) / "product_type_pdfs"
    legacy_pdf = pdf_dir / "product_type_printed_silencer.pdf"
    renamed_pdf = pdf_dir / "product_type_printed_attenuator.pdf"
    if legacy_pdf.exists():
        pdf_dir.mkdir(parents=True, exist_ok=True)
        if renamed_pdf.exists():
            legacy_pdf.unlink()
        else:
            legacy_pdf.replace(renamed_pdf)


def _ensure_product_type_sort_order(target_engine):
    inspector = inspect(target_engine)
    if "product_types" not in set(inspector.get_table_names()):
        return

    with target_engine.begin() as connection:
        connection.execute(
            text(
                """
                UPDATE product_types
                SET sort_order = CASE
                    WHEN key = 'fan' THEN 0
                    WHEN key = 'speed_controller' THEN 1
                    WHEN key = 'attenuator' THEN 2
                    WHEN sort_order = 0 THEN 1000 + id
                    ELSE sort_order
                END
                """
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


def _ensure_app_settings_smtp_columns(target_engine):
    inspector = inspect(target_engine)
    if "app_settings" not in set(inspector.get_table_names()):
        return
    existing_columns = {column["name"] for column in inspector.get_columns("app_settings")}
    if "smtp_security" not in existing_columns:
        with target_engine.begin() as connection:
            connection.execute(text("ALTER TABLE app_settings ADD COLUMN smtp_security VARCHAR(16)"))


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
    existing_columns = {column["name"] for column in inspector.get_columns(product_table_name)}
    if "manufacturer" not in existing_columns:
        return
    with target_engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {product_table_name} DROP COLUMN IF EXISTS manufacturer"))


def _remove_deprecated_fan_notes_column(target_engine):
    inspector = inspect(target_engine)
    product_table_name = _get_product_table_name(inspector)
    if not product_table_name:
        return
    existing_columns = {column["name"] for column in inspector.get_columns(product_table_name)}
    if "notes" not in existing_columns:
        return
    with target_engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {product_table_name} DROP COLUMN IF EXISTS notes"))


def _remove_deprecated_product_optional_columns(target_engine):
    inspector = inspect(target_engine)
    product_table_name = _get_product_table_name(inspector)
    if not product_table_name:
        return
    existing_columns = {column["name"] for column in inspector.get_columns(product_table_name)}
    deprecated_columns = [name for name in ("diameter_mm", "max_rpm") if name in existing_columns]
    if not deprecated_columns:
        return
    with target_engine.begin() as connection:
        for column_name in deprecated_columns:
            connection.execute(text(f"ALTER TABLE {product_table_name} DROP COLUMN IF EXISTS {column_name}"))


def _remove_deprecated_product_type_secondary_axis_label(target_engine):
    inspector = inspect(target_engine)
    if "product_types" not in set(inspector.get_table_names()):
        return
    existing_columns = {column["name"] for column in inspector.get_columns("product_types")}
    if "graph_secondary_axis_label" not in existing_columns:
        return
    with target_engine.begin() as connection:
        connection.execute(text("ALTER TABLE product_types DROP COLUMN IF EXISTS graph_secondary_axis_label"))
