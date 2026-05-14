"""
SQLAlchemy models for the internal product catalogue.
"""
import os
import re
import hashlib
import colorsys
import json

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.database import Base
from backend.timezone import file_mtime_token


def _versioned_media_url(file_path: str, route_prefix: str, file_name: str) -> str | None:
    if not os.path.isfile(file_path):
        return None

    version = file_mtime_token(file_path)
    return f"{route_prefix}/{file_name}?v={version}" if version is not None else f"{route_prefix}/{file_name}"


def _stable_hex_color(identity: str | int) -> str:
    digest = hashlib.sha1(str(identity).encode("utf-8")).digest()
    hue = int.from_bytes(digest[:2], "big") / 65535.0
    saturation = 0.62 + (digest[2] / 255.0) * 0.18
    lightness = 0.44 + (digest[3] / 255.0) * 0.08
    red, green, blue = colorsys.hls_to_rgb(hue, lightness, saturation)
    return "#{:02x}{:02x}{:02x}".format(int(red * 255), int(green * 255), int(blue * 255))


FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS = ["63", "125", "250", "500", "1k", "2k", "4k", "8k"]


def _fan_acoustic_default_table() -> dict:
    return {"sound_power_columns": list(FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS), "rows": []}


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
                "sound_pressure_db_3m": _fan_acoustic_coerce_number(public_row.get("sound_pressure_db_3m")),
                "sound_power_levels": public_row["sound_power_levels"],
            }
        )
    return {"sound_power_columns": sound_power_columns, "rows": rows}


def _fan_acoustic_lines_by_id(rpm_lines) -> dict[int, object]:
    return {int(line.id): line for line in rpm_lines or [] if getattr(line, "id", None) is not None}


def _fan_acoustic_sync_rows(table: dict | None, rpm_lines=None) -> dict:
    table = table or _fan_acoustic_default_table()
    sound_power_columns = _fan_acoustic_normalize_columns(table.get("sound_power_columns"))
    source_rows = [row for row in (table.get("rows") or []) if isinstance(row, dict)]
    current_lines = list(rpm_lines or [])

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

    return _fan_acoustic_sync_rows({"sound_power_columns": sound_power_columns, "rows": merged_rows}, rpm_lines=rpm_lines)


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


class ProductType(Base):
    __tablename__ = "product_types"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), nullable=False, unique=True, index=True)
    label = Column(String(255), nullable=False)
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
    product_template_id = Column(String(128), nullable=True)
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

    @property
    def series_names(self):
        series_items = sorted(
            self.series or [],
            key=lambda item: (item.name or "").casefold(),
        )
        return [series.name for series in series_items if series.name]

    @property
    def product_type_pdf_url(self):
        return self.product_type_printed_pdf_url

    @property
    def product_type_printed_pdf_url(self):
        safe_key = re.sub(r"[^a-z0-9]+", "_", (self.key or "").strip().lower()).strip("_")
        file_name = f"product_type_printed_{safe_key or 'unknown'}.pdf"
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_type_pdfs", file_name)
        return _versioned_media_url(file_path, "/api/cms/media/product_type_pdfs", file_name)


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
    template_id = Column(String(128), nullable=True)
    printed_template_id = Column(String(128), nullable=True)
    online_template_id = Column(String(128), nullable=True)
    series_tab_color = Column(String(32), nullable=True)

    product_type = relationship("ProductType", back_populates="series")
    products = relationship("Product", back_populates="series")

    @property
    def product_type_key(self):
        return self.product_type.key if self.product_type else None

    @property
    def product_type_label(self):
        return self.product_type.label if self.product_type else None

    @property
    def product_count(self):
        return len(self.products or [])

    @property
    def series_graph_image_url(self):
        safe_name = re.sub(r"[^a-z0-9]+", "_", (f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}")).strip("_")
        file_name = f"series_graph_{safe_name or 'unknown'}.png"
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_graphs", file_name)
        return _versioned_media_url(file_path, "/api/cms/media/series_graphs", file_name)

    @property
    def series_pdf_url(self):
        return self.series_online_pdf_url or self.series_printed_pdf_url or self.legacy_series_pdf_url

    @property
    def legacy_series_pdf_url(self):
        safe_name = re.sub(r"[^a-z0-9]+", "_", (f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}")).strip("_")
        file_name = f"series_{safe_name or 'unknown'}.pdf"
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_pdfs", file_name)
        return _versioned_media_url(file_path, "/api/cms/media/series_pdfs", file_name)

    @property
    def series_printed_pdf_url(self):
        safe_name = re.sub(r"[^a-z0-9]+", "_", (f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}")).strip("_")
        file_name = f"series_printed_{safe_name or 'unknown'}.pdf"
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_pdfs", file_name)
        return _versioned_media_url(file_path, "/api/cms/media/series_pdfs", file_name)

    @property
    def series_online_pdf_url(self):
        safe_name = re.sub(r"[^a-z0-9]+", "_", (f"{self.product_type_key or 'series'}_{(self.name or '').strip().lower()}")).strip("_")
        file_name = f"series_online_{safe_name or 'unknown'}.pdf"
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "series_pdfs", file_name)
        return _versioned_media_url(file_path, "/api/cms/media/series_pdfs", file_name)


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
    comments_html = Column(Text, nullable=True)
    graph_image_path = Column(String(512), nullable=True)
    show_rpm_band_shading = Column(Boolean, nullable=False, default=True)
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

    @property
    def graph_image_url(self):
        if not self.graph_image_path:
            return None
        file_path = self.graph_image_path
        version = None
        try:
            version = int(os.path.getmtime(file_path))
        except OSError:
            version = None
        file_name = os.path.basename(file_path)
        return (
            f"/api/cms/media/product_graphs/{file_name}?v={version}"
            if version is not None
            else f"/api/cms/media/product_graphs/{file_name}"
        )

    @property
    def primary_product_image_url(self):
        if not self.product_images:
            return None
        first_image = sorted(self.product_images, key=lambda img: (img.sort_order, img.id))[0]
        return first_image.url

    @property
    def product_pdf_url(self):
        return self.product_online_pdf_url or self.product_printed_pdf_url or self.legacy_product_pdf_url

    @property
    def legacy_product_pdf_url(self):
        safe_model = re.sub(r"[^a-z0-9]+", "_", (self.model or "").strip().lower()).strip("_")
        file_name = f"product_{safe_model or 'unknown'}.pdf" if self.model is not None else None
        if not file_name:
            return None
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_pdfs", file_name)
        return _versioned_media_url(file_path, "/api/cms/media/product_pdfs", file_name)

    @property
    def product_printed_pdf_url(self):
        safe_model = re.sub(r"[^a-z0-9]+", "_", (self.model or "").strip().lower()).strip("_")
        file_name = f"product_printed_{safe_model or 'unknown'}.pdf" if self.model is not None else None
        if not file_name:
            return None
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_pdfs", file_name)
        return _versioned_media_url(file_path, "/api/cms/media/product_pdfs", file_name)

    @property
    def product_online_pdf_url(self):
        safe_model = re.sub(r"[^a-z0-9]+", "_", (self.model or "").strip().lower()).strip("_")
        file_name = f"product_online_{safe_model or 'unknown'}.pdf" if self.model is not None else None
        if not file_name:
            return None
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_pdfs", file_name)
        return _versioned_media_url(file_path, "/api/cms/media/product_pdfs", file_name)

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


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    band_graph_background_color = Column(String(32), nullable=True)
    band_graph_label_text_color = Column(String(32), nullable=True)


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
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_images", self.file_name)
        version = None
        try:
            version = int(os.path.getmtime(file_path))
        except OSError:
            version = None
        return (
            f"/api/cms/media/product_images/{self.file_name}?v={version}"
            if version is not None
            else f"/api/cms/media/product_images/{self.file_name}"
        )
