"""
SQLAlchemy models for the internal product catalogue.
"""
import os
import re
from pathlib import Path
import hashlib
import colorsys
import json
import html

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.timezone import file_mtime_milliseconds


def _versioned_media_url(file_path: str, route_prefix: str, file_name: str) -> str | None:
    if not os.path.isfile(file_path):
        return None

    version = file_mtime_milliseconds(file_path)
    return f"{route_prefix}/{file_name}?v={version}" if version is not None else f"{route_prefix}/{file_name}"


def _latest_generated_media_file(directory: str, stem: str, extension: str) -> Path | None:
    base = Path(directory)
    candidates = list(base.glob(f"{stem}_????????_??????{extension}"))
    legacy = base / f"{stem}{extension}"
    if legacy.is_file():
        candidates.append(legacy)
    return max(candidates, key=lambda path: path.stat().st_mtime_ns) if candidates else None


def _media_file_size_bytes(file_path: str) -> int | None:
    try:
        return os.path.getsize(file_path)
    except OSError:
        return None


def _stable_hex_color(identity: str | int) -> str:
    digest = hashlib.sha1(str(identity).encode("utf-8")).digest()
    hue = int.from_bytes(digest[:2], "big") / 65535.0
    saturation = 0.62 + (digest[2] / 255.0) * 0.18
    lightness = 0.44 + (digest[3] / 255.0) * 0.08
    red, green, blue = colorsys.hls_to_rgb(hue, lightness, saturation)
    return "#{:02x}{:02x}{:02x}".format(int(red * 255), int(green * 255), int(blue * 255))


FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS = ["63", "125", "250", "500", "1k", "2k", "4k", "8k"]


def _fan_acoustic_default_table() -> dict:
    return {"variant_mode": "default", "sound_power_columns": list(FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS), "rows": []}


def _fan_acoustic_normalize_variant_mode(value) -> str:
    value = str(value or "default").strip().lower()
    return value if value in {"default", "override_1ph", "override_3ph"} else "default"


def _fan_acoustic_normalize_columns(columns) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for column in columns or []:
        label = str(column or "").strip()
        if not label or label in seen:
            continue
        seen.add(label)
        normalized.append(label)
    return normalized or list(FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS)


def _fan_acoustic_coerce_number(value):
    if value in {None, ""}:
        return None
    try:
        if isinstance(value, bool):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _fan_acoustic_normalize_row(row: dict | None, sound_power_columns: list[str], rpm_line_id: int | None = None) -> dict:
    row = row or {}
    sound_power_levels = row.get("sound_power_levels") if isinstance(row.get("sound_power_levels"), dict) else {}
    normalized_row = {
        "speed_rpm": _fan_acoustic_coerce_number(row.get("speed_rpm")),
        "peak_pressure_pa": _fan_acoustic_coerce_number(row.get("peak_pressure_pa")),
        "peak_power_kw": _fan_acoustic_coerce_number(row.get("peak_power_kw")),
        "running_frequency_hz": _fan_acoustic_coerce_number(row.get("running_frequency_hz")),
        "running_voltage_v": _fan_acoustic_coerce_number(row.get("running_voltage_v")),
        "sound_pressure_db_3m": _fan_acoustic_coerce_number(row.get("sound_pressure_db_3m")),
        "sound_power_levels": {
            column: _fan_acoustic_coerce_number(sound_power_levels.get(column))
            for column in sound_power_columns
        },
    }
    if rpm_line_id is not None:
        normalized_row["_rpm_line_id"] = int(rpm_line_id)
    elif row.get("_rpm_line_id") is not None:
        normalized_row["_rpm_line_id"] = int(row.get("_rpm_line_id"))
    return normalized_row


def _fan_acoustic_public_table(table: dict | None) -> dict:
    table = table or {}
    sound_power_columns = _fan_acoustic_normalize_columns(table.get("sound_power_columns"))
    rows = []
    for row in table.get("rows") or []:
        if not isinstance(row, dict):
            row = {}
        public_row = {key: value for key, value in row.items() if not str(key).startswith("_")}
        public_row["sound_power_levels"] = {
            column: _fan_acoustic_coerce_number((row.get("sound_power_levels") or {}).get(column))
            for column in sound_power_columns
        }
        rows.append(
            {
                "speed_rpm": _fan_acoustic_coerce_number(public_row.get("speed_rpm")),
                "peak_pressure_pa": _fan_acoustic_coerce_number(public_row.get("peak_pressure_pa")),
                "peak_power_kw": _fan_acoustic_coerce_number(public_row.get("peak_power_kw")),
                "running_frequency_hz": _fan_acoustic_coerce_number(public_row.get("running_frequency_hz")),
                "running_voltage_v": _fan_acoustic_coerce_number(public_row.get("running_voltage_v")),
                "sound_pressure_db_3m": _fan_acoustic_coerce_number(public_row.get("sound_pressure_db_3m")),
                "sound_power_levels": public_row["sound_power_levels"],
            }
        )
    return {"variant_mode": _fan_acoustic_normalize_variant_mode(table.get("variant_mode")), "sound_power_columns": sound_power_columns, "rows": rows}


def _fan_acoustic_lines_by_id(rpm_lines) -> dict[int, object]:
    return {int(line.id): line for line in rpm_lines or [] if getattr(line, "id", None) is not None}


def _fan_acoustic_sync_rows(table: dict | None, rpm_lines=None) -> dict:
    table = table or _fan_acoustic_default_table()
    sound_power_columns = _fan_acoustic_normalize_columns(table.get("sound_power_columns"))
    source_rows = [row for row in (table.get("rows") or []) if isinstance(row, dict)]
    # Always rebuild rows in ascending RPM order so the table stays stable
    # even when the ORM relationship returns lines in an unspecified order.
    current_lines = sorted(
        list(rpm_lines or []),
        key=lambda line: (
            _fan_acoustic_coerce_number(getattr(line, "rpm", None)) if getattr(line, "rpm", None) is not None else float("inf"),
            int(getattr(line, "id", 0) or 0),
        ),
    )

    if not current_lines:
        return {
            "sound_power_columns": sound_power_columns,
            "rows": [_fan_acoustic_normalize_row(row, sound_power_columns) for row in source_rows],
        }

    rows_by_line_id: dict[int, dict] = {}
    fallback_rows: list[dict] = []
    for row in source_rows:
        line_id = row.get("_rpm_line_id")
        if line_id is not None:
            try:
                rows_by_line_id[int(line_id)] = row
                continue
            except (TypeError, ValueError):
                pass
        fallback_rows.append(row)

    fallback_index = 0
    synced_rows: list[dict] = []
    for line in current_lines:
        line_id = getattr(line, "id", None)
        line_rpm = getattr(line, "rpm", None)
        source_row = None
        if line_id is not None and int(line_id) in rows_by_line_id:
            source_row = rows_by_line_id.pop(int(line_id))
        elif fallback_index < len(fallback_rows):
            source_row = fallback_rows[fallback_index]
            fallback_index += 1
        else:
            source_row = {}

        synced_rows.append(
            {
                **_fan_acoustic_normalize_row(source_row, sound_power_columns, rpm_line_id=int(line_id) if line_id is not None else None),
                "speed_rpm": _fan_acoustic_coerce_number(line_rpm),
            }
        )

    return {"sound_power_columns": sound_power_columns, "rows": synced_rows}


def _fan_acoustic_merge_tables(existing_table: dict | None, incoming_table: dict | None, rpm_lines=None) -> dict:
    existing_table = existing_table or _fan_acoustic_default_table()
    incoming_table = incoming_table or {}
    sound_power_columns = _fan_acoustic_normalize_columns(
        incoming_table.get("sound_power_columns") if incoming_table.get("sound_power_columns") is not None else existing_table.get("sound_power_columns")
    )

    existing_rows = [row for row in (existing_table.get("rows") or []) if isinstance(row, dict)]
    incoming_rows = [row for row in (incoming_table.get("rows") or []) if isinstance(row, dict)]

    merged_rows: list[dict] = []
    max_rows = max(len(existing_rows), len(incoming_rows))
    for index in range(max_rows):
        source_row = incoming_rows[index] if index < len(incoming_rows) else {}
        fallback_row = existing_rows[index] if index < len(existing_rows) else {}
        merged_rows.append(
            {
                "_rpm_line_id": fallback_row.get("_rpm_line_id"),
                "speed_rpm": source_row.get("speed_rpm", fallback_row.get("speed_rpm")),
                "peak_pressure_pa": source_row.get("peak_pressure_pa", fallback_row.get("peak_pressure_pa")),
                "peak_power_kw": source_row.get("peak_power_kw", fallback_row.get("peak_power_kw")),
                "running_frequency_hz": source_row.get("running_frequency_hz", fallback_row.get("running_frequency_hz")),
                "running_voltage_v": source_row.get("running_voltage_v", fallback_row.get("running_voltage_v")),
                "sound_pressure_db_3m": source_row.get("sound_pressure_db_3m", fallback_row.get("sound_pressure_db_3m")),
                "sound_power_levels": {
                    column: (source_row.get("sound_power_levels") or {}).get(
                        column,
                        (fallback_row.get("sound_power_levels") or {}).get(column),
                    )
                    for column in sound_power_columns
                },
            }
        )

    return _fan_acoustic_sync_rows({"variant_mode": _fan_acoustic_normalize_variant_mode(incoming_table.get("variant_mode") if incoming_table.get("variant_mode") is not None else existing_table.get("variant_mode")), "sound_power_columns": sound_power_columns, "rows": merged_rows}, rpm_lines=rpm_lines)


def _fan_acoustic_parse_table(raw_value) -> dict | None:
    if raw_value is None or raw_value == "":
        return None
    if isinstance(raw_value, str):
        try:
            raw_value = json.loads(raw_value)
        except json.JSONDecodeError:
            return None
    if not isinstance(raw_value, dict):
        return None
    return raw_value


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(1024), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)


class InternalDeviceActivity(Base):
    __tablename__ = "internal_device_activity"

    id = Column(Integer, primary_key=True, index=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    username = Column(String(255), nullable=True, index=True)
    device_fingerprint = Column(String(512), nullable=False, index=True)
    route_group = Column(String(128), nullable=True, index=True)
    event = Column(String(64), nullable=False, default="request", index=True)
    payload = Column(JSON, nullable=False, default=dict)


class ProductType(Base):
    __tablename__ = "product_types"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), nullable=False, unique=True, index=True)
    label = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    supports_graph = Column(Boolean, nullable=False, default=False)
    graph_kind = Column(String(64), nullable=True)
    supports_graph_overlays = Column(Boolean, nullable=False, default=False)
    supports_band_graph_style = Column(Boolean, nullable=False, default=False)
    graph_line_value_label = Column(String(128), nullable=True)
    graph_line_value_unit = Column(String(64), nullable=True)
    graph_x_axis_label = Column(String(128), nullable=True)
    graph_x_axis_unit = Column(String(64), nullable=True)
    graph_y_axis_label = Column(String(128), nullable=True)
    graph_y_axis_unit = Column(String(64), nullable=True)
    product_type_template_id = Column(String(128), nullable=True)
    product_type_pdf_series_order = Column(JSON, nullable=True, default=list)
    product_template_id = Column(String(128), nullable=True)
    series_template_id = Column(String(128), nullable=True)
    printed_product_template_id = Column(String(128), nullable=True)
    online_product_template_id = Column(String(128), nullable=True)
    contents_icon_url = Column(String(512), nullable=True)
    band_graph_background_color = Column(String(32), nullable=True)
    band_graph_label_text_color = Column(String(32), nullable=True)
    band_graph_faded_opacity = Column(Float, nullable=True)
    band_graph_permissible_label_color = Column(String(32), nullable=True)
    parameter_group_presets = relationship(
        "ProductTypeParameterGroupPreset",
        back_populates="product_type",
        cascade="all, delete-orphan",
        order_by="ProductTypeParameterGroupPreset.sort_order",
    )
    rpm_line_presets = relationship(
        "ProductTypeRpmLinePreset",
        back_populates="product_type",
        cascade="all, delete-orphan",
        order_by="ProductTypeRpmLinePreset.sort_order",
    )
    efficiency_point_presets = relationship(
        "ProductTypeEfficiencyPointPreset",
        back_populates="product_type",
        cascade="all, delete-orphan",
        order_by="ProductTypeEfficiencyPointPreset.sort_order",
    )
    series = relationship("Series", back_populates="product_type", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="product_type")
    associated_documents = relationship(
        "AssociatedDocument", back_populates="product_type", cascade="all, delete-orphan",
        foreign_keys="AssociatedDocument.product_type_id",
    )

    @property
    def series_names(self):
        series_items = sorted(
            self.series or [],
            key=lambda item: (item.name or "").casefold(),
        )
        return [series.name for series in series_items if series.name]

    @property
    def series_count(self):
        return len(self.series or [])

    @property
    def product_count(self):
        linked_products = list(self.products or [])
        for series in self.series or []:
            linked_products.extend(series.products or [])
        return len(linked_products)

    @property
    def product_type_pdf_url(self):
        return self.product_type_printed_pdf_url

    @property
    def product_type_printed_pdf_url(self):
        safe_key = re.sub(r"[^a-z0-9]+", "_", (self.key or "").strip().lower()).strip("_")
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_type_pdfs")
        file_path = _latest_generated_media_file(directory, f"product_type_printed_{safe_key or 'unknown'}", ".pdf")
        return _versioned_media_url(str(file_path), "/api/public/media/product_type_pdfs", file_path.name) if file_path else None

    @property
    def product_type_printed_pdf_size_bytes(self):
        safe_key = re.sub(r"[^a-z0-9]+", "_", (self.key or "").strip().lower()).strip("_")
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_type_pdfs")
        file_path = _latest_generated_media_file(directory, f"product_type_printed_{safe_key or 'unknown'}", ".pdf")
        return _media_file_size_bytes(str(file_path)) if file_path else None


class ProductTypeParameterGroupPreset(Base):
    __tablename__ = "product_type_parameter_group_presets"

    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=False)
    group_name = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    product_type = relationship("ProductType", back_populates="parameter_group_presets")
    parameter_presets = relationship(
        "ProductTypeParameterPreset",
        back_populates="group_preset",
        cascade="all, delete-orphan",
        order_by="ProductTypeParameterPreset.sort_order",
    )


class ProductTypeParameterPreset(Base):
    __tablename__ = "product_type_parameter_presets"

    id = Column(Integer, primary_key=True, index=True)
    group_preset_id = Column(Integer, ForeignKey("product_type_parameter_group_presets.id"), nullable=False)
    parameter_name = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    preferred_unit = Column(String(64), nullable=True)
    value_type = Column(String(16), nullable=False, default="string", server_default="string")
    value_string = Column(Text, nullable=True)
    value_number = Column(Float, nullable=True)

    group_preset = relationship("ProductTypeParameterGroupPreset", back_populates="parameter_presets")


class ProductTypeRpmLinePreset(Base):
    __tablename__ = "product_type_rpm_line_presets"

    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=False)
    rpm = Column(Float, nullable=False)
    band_color = Column(String(32), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    product_type = relationship("ProductType", back_populates="rpm_line_presets")
    point_presets = relationship(
        "ProductTypeRpmPointPreset",
        back_populates="line_preset",
        cascade="all, delete-orphan",
        order_by="ProductTypeRpmPointPreset.sort_order",
    )


class ProductTypeRpmPointPreset(Base):
    __tablename__ = "product_type_rpm_point_presets"

    id = Column(Integer, primary_key=True, index=True)
    line_preset_id = Column(Integer, ForeignKey("product_type_rpm_line_presets.id"), nullable=False)
    airflow = Column(Float, nullable=False)
    pressure = Column(Float, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    line_preset = relationship("ProductTypeRpmLinePreset", back_populates="point_presets")


class ProductTypeEfficiencyPointPreset(Base):
    __tablename__ = "product_type_efficiency_point_presets"

    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=False)
    airflow = Column(Float, nullable=False)
    efficiency_centre = Column(Float, nullable=True)
    efficiency_lower_end = Column(Float, nullable=True)
    efficiency_higher_end = Column(Float, nullable=True)
    permissible_use = Column(Float, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    product_type = relationship("ProductType", back_populates="efficiency_point_presets")


class Series(Base):
    __tablename__ = "series"

    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description1_html = Column(Text, nullable=True)
    description2_html = Column(Text, nullable=True)
    description3_html = Column(Text, nullable=True)
    description4_html = Column(Text, nullable=True)
    description5_html = Column(Text, nullable=True)
    description6_html = Column(Text, nullable=True)
    description7_html = Column(Text, nullable=True)
    description8_html = Column(Text, nullable=True)
    description9_html = Column(Text, nullable=True)
    description10_html = Column(Text, nullable=True)
    description_field_count = Column(Integer, nullable=False, default=0)
    contents_description = Column(Text, nullable=True)
    template_id = Column(String(128), nullable=True)
    printed_template_id = Column(String(128), nullable=True)
    online_template_id = Column(String(128), nullable=True)
    series_tab_color = Column(String(32), nullable=True)

    product_type = relationship("ProductType", back_populates="series")
    products = relationship("Product", back_populates="series")
    series_images = relationship(
        "SeriesImage",
        back_populates="series",
        cascade="all, delete-orphan",
        order_by="SeriesImage.sort_order",
    )
    associated_documents = relationship(
        "AssociatedDocument", back_populates="series", cascade="all, delete-orphan",
        foreign_keys="AssociatedDocument.series_id",
    )

    @property
    def product_type_key(self):
        return self.product_type.key if self.product_type else None

    @property
    def product_type_label(self):
        return self.product_type.label if self.product_type else None

    @property
    def product_count(self):
        cached_count = getattr(self, "_product_count", None)
        if cached_count is not None:
            return int(cached_count)
        return len(self.products or [])

    @property
    def primary_series_image_url(self):
        if not self.series_images:
            return None
        first_image = sorted(self.series_images, key=lambda img: (img.sort_order, img.id))[0]
        return first_image.url

    @property
    def public_primary_series_image_url(self):
        if not self.series_images:
            return None
        first_image = sorted(self.series_images, key=lambda img: (img.sort_order, img.id))[0]
        return first_image.public_url

    @property
    def secondary_series_image_url(self):
        if len(self.series_images or []) < 2:
            return None
        second_image = sorted(self.series_images, key=lambda img: (img.sort_order, img.id))[1]
        return second_image.url

    @property
    def series_graph_image_url(self):
        safe_name = re.sub(r"[^a-z0-9]+", "_", (f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}")).strip("_")
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_graphs")
        file_path = _latest_generated_media_file(directory, f"series_graph_{safe_name or 'unknown'}", ".png")
        return _versioned_media_url(str(file_path), "/api/public/media/series_graphs", file_path.name) if file_path else None

    @property
    def series_pdf_url(self):
        return self.series_printed_pdf_url or self.legacy_series_pdf_url

    @property
    def legacy_series_pdf_url(self):
        safe_name = re.sub(r"[^a-z0-9]+", "_", (f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}")).strip("_")
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_pdfs")
        file_path = _latest_generated_media_file(directory, f"series_{safe_name or 'unknown'}", ".pdf")
        return _versioned_media_url(str(file_path), "/api/public/media/series_pdfs", file_path.name) if file_path else None

    @property
    def series_printed_pdf_url(self):
        safe_name = re.sub(r"[^a-z0-9]+", "_", (f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}")).strip("_")
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_pdfs")
        file_path = _latest_generated_media_file(directory, f"series_printed_{safe_name or 'unknown'}", ".pdf")
        return _versioned_media_url(str(file_path), "/api/public/media/series_pdfs", file_path.name) if file_path else None

    @property
    def series_online_pdf_url(self):
        safe_name = re.sub(r"[^a-z0-9]+", "_", (f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}")).strip("_")
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_pdfs")
        file_path = _latest_generated_media_file(directory, f"series_online_{safe_name or 'unknown'}", ".pdf")
        return _versioned_media_url(str(file_path), "/api/public/media/series_pdfs", file_path.name) if file_path else None

    @property
    def series_printed_pdf_size_bytes(self):
        safe_name = re.sub(
            r"[^a-z0-9]+", "_", f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}"
        ).strip("_")
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_pdfs")
        file_path = _latest_generated_media_file(directory, f"series_printed_{safe_name or 'unknown'}", ".pdf")
        return _media_file_size_bytes(str(file_path)) if file_path else None


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=True)
    series_id = Column(Integer, ForeignKey("series.id"), nullable=True)
    series_name = Column(String(255), nullable=True)
    template_id = Column(String(128), nullable=True)
    printed_template_id = Column(String(128), nullable=True)
    online_template_id = Column(String(128), nullable=True)
    model = Column(String(255), nullable=False)
    description1_html = Column(Text, nullable=True)
    description2_html = Column(Text, nullable=True)
    description3_html = Column(Text, nullable=True)
    description4_html = Column(Text, nullable=True)
    description5_html = Column(Text, nullable=True)
    description6_html = Column(Text, nullable=True)
    description7_html = Column(Text, nullable=True)
    description8_html = Column(Text, nullable=True)
    description9_html = Column(Text, nullable=True)
    description10_html = Column(Text, nullable=True)
    description_field_count = Column(Integer, nullable=False, default=0)
    comments_html = Column(Text, nullable=True)
    graph_image_path = Column(String(512), nullable=True)
    show_rpm_band_shading = Column(Boolean, nullable=False, default=True)
    permissible_use_mode = Column(String(32), nullable=False, default="both")
    band_graph_background_color = Column(String(32), nullable=True)
    band_graph_label_text_color = Column(String(32), nullable=True)
    band_graph_faded_opacity = Column(Float, nullable=True)
    band_graph_permissible_label_color = Column(String(32), nullable=True)
    _fan_acoustic_table_json = Column("fan_acoustic_table", Text, nullable=True)

    product_type = relationship("ProductType", back_populates="products")
    series = relationship("Series", back_populates="products")
    rpm_lines = relationship("RpmLine", back_populates="product", cascade="all, delete-orphan")
    efficiency_points = relationship("EfficiencyPoint", back_populates="product", cascade="all, delete-orphan")
    parameter_groups = relationship(
        "ProductParameterGroup",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductParameterGroup.sort_order",
    )
    product_images = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order",
    )
    associated_documents = relationship(
        "AssociatedDocument", back_populates="product", cascade="all, delete-orphan",
        foreign_keys="AssociatedDocument.product_id",
    )

    @property
    def graph_image_url(self):
        if not self.graph_image_path:
            return None
        file_path = self.graph_image_path
        file_name = os.path.basename(file_path)
        version = file_mtime_milliseconds(file_path)
        return (
            f"/api/public/media/product_graphs/{file_name}?v={version}"
            if version is not None
            else f"/api/public/media/product_graphs/{file_name}"
        )

    @property
    def primary_product_image_url(self):
        if not self.product_images:
            return None
        first_image = sorted(self.product_images, key=lambda img: (img.sort_order, img.id))[0]
        return first_image.url

    @property
    def public_primary_product_image_url(self):
        if not self.product_images:
            return None
        first_image = sorted(self.product_images, key=lambda img: (img.sort_order, img.id))[0]
        return first_image.public_url

    @property
    def grouped_specs_main_table(self):
        matching_groups = [
            group
            for group in sorted(self.parameter_groups or [], key=lambda item: (item.sort_order, item.id))
            if (group.group_name or "").strip().lower() == "main"
        ]
        if not matching_groups:
            return None

        rows: list[str] = []
        for group in matching_groups:
            for parameter in sorted(group.parameters or [], key=lambda item: (item.sort_order, item.id)):
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

        if not rows:
            return None

        return '<table class="spec-table"><tbody>' + "".join(rows) + "</tbody></table>"

    @property
    def product_pdf_url(self):
        return self.product_printed_pdf_url or self.legacy_product_pdf_url

    @property
    def legacy_product_pdf_url(self):
        safe_model = re.sub(r"[^a-z0-9]+", "_", (self.model or "").strip().lower()).strip("_")
        if self.model is None:
            return None
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_pdfs")
        file_path = _latest_generated_media_file(directory, f"product_{safe_model or 'unknown'}", ".pdf")
        return _versioned_media_url(str(file_path), "/api/public/media/product_pdfs", file_path.name) if file_path else None

    @property
    def product_printed_pdf_url(self):
        safe_model = re.sub(r"[^a-z0-9]+", "_", (self.model or "").strip().lower()).strip("_")
        if self.model is None:
            return None
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_pdfs")
        file_path = _latest_generated_media_file(directory, f"product_printed_{safe_model or 'unknown'}", ".pdf")
        return _versioned_media_url(str(file_path), "/api/public/media/product_pdfs", file_path.name) if file_path else None

    @property
    def product_online_pdf_url(self):
        safe_model = re.sub(r"[^a-z0-9]+", "_", (self.model or "").strip().lower()).strip("_")
        if self.model is None:
            return None
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_pdfs")
        file_path = _latest_generated_media_file(directory, f"product_online_{safe_model or 'unknown'}", ".pdf")
        return _versioned_media_url(str(file_path), "/api/public/media/product_pdfs", file_path.name) if file_path else None

    @property
    def product_printed_pdf_size_bytes(self):
        safe_model = re.sub(r"[^a-z0-9]+", "_", (self.model or "").strip().lower()).strip("_")
        if self.model is None:
            return None
        directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_pdfs")
        file_path = _latest_generated_media_file(directory, f"product_printed_{safe_model or 'unknown'}", ".pdf")
        return _media_file_size_bytes(str(file_path)) if file_path else None

    @property
    def product_type_key(self):
        return self.product_type.key if self.product_type else None

    @property
    def product_type_label(self):
        return self.product_type.label if self.product_type else None

    @property
    def series_name_value(self):
        return self.series.name if self.series else self.series_name

    @property
    def description_html(self):
        return self.description1_html

    @description_html.setter
    def description_html(self, value):
        self.description1_html = value

    @property
    def features_html(self):
        return self.description2_html

    @features_html.setter
    def features_html(self, value):
        self.description2_html = value

    @property
    def specifications_html(self):
        return self.description3_html

    @specifications_html.setter
    def specifications_html(self, value):
        self.description3_html = value

    @property
    def fan_acoustic_table(self):
        if self.product_type_key != "fan":
            return None
        raw_table = _fan_acoustic_parse_table(self._fan_acoustic_table_json) or _fan_acoustic_default_table()
        synced_table = _fan_acoustic_sync_rows(raw_table, self.rpm_lines)
        return _fan_acoustic_public_table(synced_table)

    @fan_acoustic_table.setter
    def fan_acoustic_table(self, value):
        if self.product_type_key != "fan":
            self._fan_acoustic_table_json = None
            return

        incoming_table = _fan_acoustic_parse_table(value)
        if incoming_table is None:
            incoming_table = _fan_acoustic_default_table()

        existing_table = _fan_acoustic_parse_table(self._fan_acoustic_table_json) or _fan_acoustic_default_table()
        merged_table = _fan_acoustic_merge_tables(existing_table, incoming_table, self.rpm_lines)
        self._fan_acoustic_table_json = json.dumps(merged_table)


def _series_description_alias_property(field_name):
    def getter(self):
        return getattr(self, field_name)

    def setter(self, value):
        setattr(self, field_name, value)

    return property(getter, setter)


Series.description_html = _series_description_alias_property("description1_html")
Series.features_html = _series_description_alias_property("description2_html")
Series.specifications_html = _series_description_alias_property("description3_html")
Series.comments_html = _series_description_alias_property("description4_html")


class AssociatedDocument(Base):
    __tablename__ = "associated_documents"

    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=True)
    series_id = Column(Integer, ForeignKey("series.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    owner_type = Column(String(32), nullable=False)
    original_file_name = Column(String(512), nullable=False)
    file_name = Column(String(512), nullable=False, unique=True)
    mime_type = Column(String(255), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    product_type = relationship("ProductType", back_populates="associated_documents", foreign_keys=[product_type_id])
    series = relationship("Series", back_populates="associated_documents", foreign_keys=[series_id])
    product = relationship("Product", back_populates="associated_documents", foreign_keys=[product_id])

    @property
    def download_url(self):
        return f"/api/public/media/associated_documents/{self.owner_type}/{self.owner_id}/{self.file_name}"

    @property
    def owner_id(self):
        return self.product_type_id or self.series_id or self.product_id

    @property
    def file_size_bytes(self):
        return _media_file_size_bytes(
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "associated_documents", self.owner_type, str(self.owner_id), self.file_name)
        )


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    band_graph_background_color = Column(String(32), nullable=True)
    band_graph_label_text_color = Column(String(32), nullable=True)
    quote_request_recipient_emails = Column(Text, nullable=True)
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_username = Column(String(255), nullable=True)
    smtp_password_encrypted = Column(Text, nullable=True)
    smtp_use_tls = Column(Boolean, nullable=True)
    smtp_security = Column(String(16), nullable=True)
    smtp_from_address = Column(String(255), nullable=True)
    cms_navigation_order = Column(Text, nullable=True)


class MaintenanceJob(Base):
    __tablename__ = "maintenance_jobs"

    id = Column(String(64), primary_key=True)
    job_type = Column(String(160), nullable=False, index=True)
    status = Column(String(32), nullable=False, index=True)
    progress_message = Column(Text, nullable=True)
    progress_current = Column(Integer, nullable=True)
    progress_total = Column(Integer, nullable=True)
    progress_percent = Column(Float, nullable=True)
    error = Column(Text, nullable=True)
    result_message = Column(Text, nullable=True)
    result_download_url = Column(Text, nullable=True)
    created_at = Column(String(64), nullable=False)
    started_at = Column(String(64), nullable=True)
    completed_at = Column(String(64), nullable=True)
    cancel_requested = Column(Boolean, nullable=False, default=False)


class SitePage(Base):
    """Structured content for the small set of customer-facing marketing pages."""

    __tablename__ = "site_pages"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(80), nullable=False, unique=True, index=True)
    label = Column(String(160), nullable=False)
    content_type = Column(String(32), nullable=False, default="page")
    draft_content = Column(JSON, nullable=False, default=dict)
    published_content = Column(JSON, nullable=False, default=dict)
    draft_layout = Column(JSON, nullable=True)
    published_layout = Column(JSON, nullable=True)
    draft_seo = Column(JSON, nullable=False, default=dict)
    published_seo = Column(JSON, nullable=False, default=dict)
    status = Column(String(32), nullable=False, default="published")
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)


class SiteAsset(Base):
    """CMS-managed media with usage metadata kept separate from page JSON."""

    __tablename__ = "site_assets"

    id = Column(Integer, primary_key=True, index=True)
    original_file_name = Column(String(512), nullable=False)
    file_name = Column(String(512), nullable=False, unique=True)
    mime_type = Column(String(255), nullable=True)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class QuoteRequest(Base):
    __tablename__ = "quote_requests"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    status = Column(String(32), nullable=False, default="new")
    email_status = Column(String(32), nullable=False, default="pending")
    email_error = Column(Text, nullable=True)
    verification_provider = Column(String(32), nullable=False, default="none")
    verification_status = Column(String(32), nullable=False, default="not_configured")
    verification_error = Column(Text, nullable=True)
    name = Column(String(120), nullable=False)
    company = Column(String(160), nullable=True)
    email = Column(String(160), nullable=False)
    phone = Column(String(80), nullable=True)
    request_type = Column(String(32), nullable=False, default="unsure")
    attributes = Column(JSON, nullable=False, default=list)
    airflow_min = Column(String(40), nullable=True)
    airflow_max = Column(String(40), nullable=True)
    pressure_min = Column(String(40), nullable=True)
    pressure_max = Column(String(40), nullable=True)
    power_limit = Column(String(60), nullable=True)
    short_notes = Column(String(300), nullable=True)
    details = Column(Text, nullable=True)
    page_type = Column(String(80), nullable=True)
    page_title = Column(String(200), nullable=True)
    page_summary = Column(String(500), nullable=True)
    page_card_title = Column(String(200), nullable=True)
    page_card_summary = Column(String(500), nullable=True)
    page_url = Column(String(500), nullable=True)
    client_ip = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    referrer = Column(Text, nullable=True)
    origin = Column(Text, nullable=True)
    context_json = Column(JSON, nullable=False, default=dict)


class ProductParameterGroup(Base):
    __tablename__ = "product_parameter_groups"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    group_name = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    product = relationship("Product", back_populates="parameter_groups")
    parameters = relationship(
        "ProductParameter",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="ProductParameter.sort_order",
    )

class ProductParameter(Base):
    __tablename__ = "product_parameters"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("product_parameter_groups.id"), nullable=False)
    parameter_name = Column(String(255), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    value_string = Column(Text, nullable=True)
    value_number = Column(Float, nullable=True)
    unit = Column(String(64), nullable=True)

    group = relationship("ProductParameterGroup", back_populates="parameters")


class RpmLine(Base):
    __tablename__ = "rpm_lines"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    rpm = Column(Float, nullable=False)
    band_color = Column(String(32), nullable=True)

    product = relationship("Product", back_populates="rpm_lines")
    points = relationship("RpmPoint", back_populates="rpm_line", cascade="all, delete-orphan")

class RpmPoint(Base):
    __tablename__ = "rpm_points"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    rpm_line_id = Column(Integer, ForeignKey("rpm_lines.id"), nullable=False)
    airflow = Column("flow", Float, nullable=False)
    pressure = Column(Float, nullable=False)

    rpm_line = relationship("RpmLine", back_populates="points")

    @property
    def rpm(self):
        return self.rpm_line.rpm if self.rpm_line else None

    @property
    def flow(self):
        return self.airflow

    @flow.setter
    def flow(self, value):
        self.airflow = value

class EfficiencyPoint(Base):
    __tablename__ = "efficiency_points"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    airflow = Column("flow", Float, nullable=False)
    efficiency_centre = Column(Float, nullable=True)
    efficiency_lower_end = Column(Float, nullable=True)
    efficiency_higher_end = Column(Float, nullable=True)
    permissible_use = Column(Float, nullable=True)

    product = relationship("Product", back_populates="efficiency_points")

    @property
    def flow(self):
        return self.airflow

    @flow.setter
    def flow(self, value):
        self.airflow = value

class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    file_name = Column(String(512), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    product = relationship("Product", back_populates="product_images")

    @property
    def url(self):
        base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_images")
        file_path = os.path.join(base_dir, f"product_{self.product_id}", self.file_name)
        if not os.path.exists(file_path):
            legacy_path = os.path.join(base_dir, self.file_name)
            if os.path.exists(legacy_path):
                file_path = legacy_path
        version = file_mtime_milliseconds(file_path)
        return (
            f"/api/public/media/product_images/{self.product_id}/{self.file_name}?v={version}"
            if version is not None
            else f"/api/public/media/product_images/{self.product_id}/{self.file_name}"
        )

    @property
    def public_url(self):
        """A smaller derivative used only by the customer-facing catalogue."""
        base_dir = Path(os.path.dirname(os.path.dirname(__file__))) / "data" / "product_images"
        source_path = base_dir / f"product_{self.product_id}" / self.file_name
        if not source_path.is_file():
            source_path = base_dir / self.file_name
        derivative_name = f"{self.file_name}.webp"
        derivative_path = base_dir / f"product_{self.product_id}" / derivative_name
        version = file_mtime_milliseconds(derivative_path) or file_mtime_milliseconds(source_path)
        return (
            f"/api/public/media/product_images/{self.product_id}/{derivative_name}?v={version}"
            if version is not None
            else f"/api/public/media/product_images/{self.product_id}/{derivative_name}"
        )


class SeriesImage(Base):
    __tablename__ = "series_images"

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(Integer, ForeignKey("series.id"), nullable=False)
    file_name = Column(String(512), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    series = relationship("Series", back_populates="series_images")

    @property
    def url(self):
        base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_images")
        file_path = os.path.join(base_dir, f"series_{self.series_id}", self.file_name)
        if not os.path.exists(file_path):
            legacy_path = os.path.join(base_dir, self.file_name)
            if os.path.exists(legacy_path):
                file_path = legacy_path
        version = file_mtime_milliseconds(file_path)
        return (
            f"/api/public/media/series_images/{self.series_id}/{self.file_name}?v={version}"
            if version is not None
            else f"/api/public/media/series_images/{self.series_id}/{self.file_name}"
        )

    @property
    def public_url(self):
        base_dir = Path(os.path.dirname(os.path.dirname(__file__))) / "data" / "series_images"
        source_path = base_dir / f"series_{self.series_id}" / self.file_name
        if not source_path.is_file():
            source_path = base_dir / self.file_name
        derivative_name = f"{self.file_name}.webp"
        derivative_path = base_dir / f"series_{self.series_id}" / derivative_name
        version = file_mtime_milliseconds(derivative_path) or file_mtime_milliseconds(source_path)
        return (
            f"/api/public/media/series_images/{self.series_id}/{derivative_name}?v={version}"
            if version is not None
            else f"/api/public/media/series_images/{self.series_id}/{derivative_name}"
        )
