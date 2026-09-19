"""
Pydantic schemas for request/response validation.
"""
from datetime import datetime
from typing import Annotated, Literal, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, confloat, field_validator, model_validator


# --- Product ---
class _RichTextAliasMixin(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def _remap_richtext_aliases(cls, data):
        if not isinstance(data, dict):
            return data

        data = dict(data)
        alias_map = {
            "description1_html": ("description_html",),
            "description2_html": ("features_html",),
            "description3_html": ("specifications_html",),
        }
        for canonical_name, legacy_names in alias_map.items():
            if data.get(canonical_name) is not None:
                continue
            for legacy_name in legacy_names:
                if legacy_name in data and data[legacy_name] is not None:
                    data[canonical_name] = data[legacy_name]
                    break
        return data


class ProductTypeParameterPresetResponse(BaseModel):
    id: int
    parameter_name: str
    sort_order: int
    preferred_unit: Optional[str] = None
    value_type: Literal["string", "number"] = "string"
    value_string: Optional[str] = None
    value_number: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class InternalDeviceActivityResponse(BaseModel):
    id: int
    occurred_at: str
    username: Optional[str] = None
    device_fingerprint: str
    route_group: Optional[str] = None
    event: str
    payload: dict = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class ProductTypeParameterPresetUpdate(BaseModel):
    parameter_name: str
    preferred_unit: Optional[str] = None
    value_type: Literal["string", "number"] = "string"
    value_string: Optional[str] = None
    value_number: Optional[float] = None


class ProductTypeParameterGroupPresetResponse(BaseModel):
    id: int
    group_name: str
    sort_order: int
    parameter_presets: list[ProductTypeParameterPresetResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductTypeParameterGroupPresetUpdate(BaseModel):
    group_name: str
    parameters: list[ProductTypeParameterPresetUpdate] = Field(default_factory=list)


class ProductTypeRpmPointPresetResponse(BaseModel):
    id: int
    airflow: float
    pressure: float
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class ProductTypeRpmPointPresetUpdate(BaseModel):
    airflow: float
    pressure: float


class ProductTypeRpmLinePresetResponse(BaseModel):
    id: int
    rpm: float
    band_color: Optional[str] = None
    sort_order: int
    point_presets: list[ProductTypeRpmPointPresetResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductTypeRpmLinePresetUpdate(BaseModel):
    rpm: float
    band_color: Optional[str] = None
    points: list[ProductTypeRpmPointPresetUpdate] = Field(default_factory=list)


class ProductTypeEfficiencyPointPresetResponse(BaseModel):
    id: int
    airflow: float
    efficiency_centre: Optional[float] = None
    efficiency_lower_end: Optional[float] = None
    efficiency_higher_end: Optional[float] = None
    permissible_use: Optional[float] = None
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class ProductTypeEfficiencyPointPresetUpdate(BaseModel):
    airflow: float
    efficiency_centre: Optional[float] = None
    efficiency_lower_end: Optional[float] = None
    efficiency_higher_end: Optional[float] = None
    permissible_use: Optional[float] = None


class ProductTypePresetUpdate(BaseModel):
    product_template_id: Optional[str] = None
    series_template_id: Optional[str] = None
    printed_product_template_id: Optional[str] = None
    online_product_template_id: Optional[str] = None
    parameter_group_presets: list[ProductTypeParameterGroupPresetUpdate] = Field(default_factory=list)
    rpm_line_presets: list[ProductTypeRpmLinePresetUpdate] = Field(default_factory=list)
    efficiency_point_presets: list[ProductTypeEfficiencyPointPresetUpdate] = Field(default_factory=list)


class ProductTypeSeriesSummaryResponse(BaseModel):
    id: int
    name: str
    product_type_key: Optional[str] = None
    product_type_label: Optional[str] = None
    product_count: int = 0
    primary_series_image_url: Optional[str] = None
    series_pdf_url: Optional[str] = None
    series_printed_pdf_url: Optional[str] = None
    series_online_pdf_url: Optional[str] = None
    series_tab_color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProductTypeResponse(BaseModel):
    id: int
    key: str
    label: str
    series_names: list[str] = Field(default_factory=list)
    series: list[ProductTypeSeriesSummaryResponse] = Field(default_factory=list)
    series_count: int = 0
    product_count: int = 0
    product_type_pdf_url: Optional[str] = None
    product_type_printed_pdf_url: Optional[str] = None
    product_type_printed_pdf_size_bytes: Optional[int] = None
    product_type_pdf_series_order: list[int] = Field(default_factory=list)
    supports_graph: bool
    graph_kind: Optional[str] = None
    supports_graph_overlays: bool = False
    supports_band_graph_style: bool = False
    graph_line_value_label: Optional[str] = None
    graph_line_value_unit: Optional[str] = None
    graph_x_axis_label: Optional[str] = None
    graph_x_axis_unit: Optional[str] = None
    graph_y_axis_label: Optional[str] = None
    graph_y_axis_unit: Optional[str] = None
    product_type_template_id: Optional[str] = None
    product_template_id: Optional[str] = None
    series_template_id: Optional[str] = None
    printed_product_template_id: Optional[str] = None
    online_product_template_id: Optional[str] = None
    contents_icon_url: Optional[str] = None
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    parameter_group_presets: list[ProductTypeParameterGroupPresetResponse] = Field(default_factory=list)
    rpm_line_presets: list[ProductTypeRpmLinePresetResponse] = Field(default_factory=list)
    efficiency_point_presets: list[ProductTypeEfficiencyPointPresetResponse] = Field(default_factory=list)
    associated_documents: list["AssociatedDocumentResponse"] = Field(default_factory=list)

    @field_validator("product_type_pdf_series_order", mode="before")
    @classmethod
    def _default_missing_pdf_series_order(cls, value):
        return value or []

    model_config = ConfigDict(from_attributes=True)


class ProductTypeCreate(BaseModel):
    key: Optional[str] = None
    label: str
    supports_graph: bool = False
    graph_kind: Optional[str] = None
    supports_graph_overlays: bool = False
    supports_band_graph_style: bool = False
    graph_line_value_label: Optional[str] = None
    graph_line_value_unit: Optional[str] = None
    graph_x_axis_label: Optional[str] = None
    graph_x_axis_unit: Optional[str] = None
    graph_y_axis_label: Optional[str] = None
    graph_y_axis_unit: Optional[str] = None
    product_type_template_id: Optional[str] = None
    product_type_pdf_series_order: list[int] = Field(default_factory=list)
    product_template_id: Optional[str] = None
    series_template_id: Optional[str] = None
    printed_product_template_id: Optional[str] = None
    online_product_template_id: Optional[str] = None
    contents_icon_url: Optional[str] = None
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None


class ProductTypeUpdate(BaseModel):
    key: Optional[str] = None
    label: Optional[str] = None
    supports_graph: Optional[bool] = None
    graph_kind: Optional[str] = None
    supports_graph_overlays: Optional[bool] = None
    supports_band_graph_style: Optional[bool] = None
    graph_line_value_label: Optional[str] = None
    graph_line_value_unit: Optional[str] = None
    graph_x_axis_label: Optional[str] = None
    graph_x_axis_unit: Optional[str] = None
    graph_y_axis_label: Optional[str] = None
    graph_y_axis_unit: Optional[str] = None
    product_type_template_id: Optional[str] = None
    product_type_pdf_series_order: Optional[list[int]] = None
    product_template_id: Optional[str] = None
    printed_product_template_id: Optional[str] = None
    online_product_template_id: Optional[str] = None
    contents_icon_url: Optional[str] = None
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None


class TemplateDefinitionResponse(BaseModel):
    id: str
    label: str
    type: str
    path: str
    stylesheet: Optional[str] = None


class AssociatedDocumentResponse(BaseModel):
    id: int
    owner_type: str
    original_file_name: str
    file_name: str
    mime_type: Optional[str] = None
    sort_order: int = 0
    download_url: Optional[str] = None
    file_size_bytes: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class TemplateRegistryResponse(BaseModel):
    product_templates: list[TemplateDefinitionResponse] = Field(default_factory=list)
    series_templates: list[TemplateDefinitionResponse] = Field(default_factory=list)
    product_type_templates: list[TemplateDefinitionResponse] = Field(default_factory=list)


class TemplateCreateRequest(BaseModel):
    template_type: str
    label: str
    template_id: Optional[str] = None
    source_template_id: Optional[str] = None


class TemplateFileResponse(BaseModel):
    id: str
    label: str
    type: str
    html_path: str
    css_path: Optional[str] = None
    html_content: str
    css_content: str = ""


class TemplateFileUpdateRequest(BaseModel):
    html_content: str
    css_content: str = ""


class TemplateAssetUploadRequest(BaseModel):
    filename: str
    data_url: str


class TemplateAssetUploadResponse(BaseModel):
    filename: str
    relative_path: str
    file_url: str


class SitePageResponse(BaseModel):
    id: int
    slug: str
    label: str
    content_type: str
    draft_content: dict = Field(default_factory=dict)
    published_content: dict = Field(default_factory=dict)
    draft_layout: Optional[list] = None
    published_layout: Optional[list] = None
    draft_seo: dict = Field(default_factory=dict)
    published_seo: dict = Field(default_factory=dict)
    status: str
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SitePageUpdateRequest(BaseModel):
    content: dict = Field(default_factory=dict)
    seo: dict = Field(default_factory=dict)
    layout: Optional[list] = None


class SitePageCreateRequest(BaseModel):
    label: str
    slug: Optional[str] = None
    template: str = "standard"
    layout: Optional[list] = None


class CmsNavigationUpdateRequest(BaseModel):
    order: list[str] = Field(default_factory=list)
    items: Optional[list[dict]] = None


class SiteAssetResponse(BaseModel):
    id: int
    original_file_name: str
    file_name: str
    mime_type: Optional[str] = None
    file_size_bytes: int = 0
    created_at: Optional[datetime] = None
    used_by: list[str] = Field(default_factory=list)
    url: str

    model_config = ConfigDict(from_attributes=True)


class FileManagerEntryResponse(BaseModel):
    name: str
    path: str
    type: str
    size_bytes: Optional[int] = None
    modified_at: Optional[str] = None
    protected: bool = False


class FileManagerListingResponse(BaseModel):
    root: str
    path: str
    parent_path: Optional[str] = None
    entries: list[FileManagerEntryResponse] = Field(default_factory=list)


class FileManagerCreateFolderRequest(BaseModel):
    folder_name: str


class FileManagerRenameRequest(BaseModel):
    new_name: str


class FileManagerDeleteRequest(BaseModel):
    recursive: bool = True


class FileManagerContentResponse(BaseModel):
    name: str
    path: str
    content: str


class FileManagerContentUpdateRequest(BaseModel):
    content: str


class BulkImportTableSummaryResponse(BaseModel):
    name: str
    kind: str
    row_count: int = 0


class BulkImportColumnNormalizationResponse(BaseModel):
    raw_header: str
    normalized_header: str
    role: str
    rpm: Optional[float] = None
    reason: Optional[str] = None


class BulkImportSheetNormalizationResponse(BaseModel):
    sheet_name: str
    row_count: int = 0
    include_in_import: bool = True
    raw_headers: list[str] = Field(default_factory=list)
    normalized_headers: list[str] = Field(default_factory=list)
    columns: list[BulkImportColumnNormalizationResponse] = Field(default_factory=list)
    rpm_line_count: int = 0
    rpm_point_count: int = 0
    efficiency_point_count: int = 0
    has_efficiency_upper: bool = False
    has_efficiency_lower: bool = False
    error: Optional[str] = None


class BulkImportManifestSheetResponse(BaseModel):
    sheet_name: str
    product_model: Optional[str] = None
    product_type_key: Optional[str] = None
    series_id: Optional[int] = None
    series_name: Optional[str] = None
    image_count: int = 0


class BulkImportResponse(BaseModel):
    dry_run: bool
    tables: list[BulkImportTableSummaryResponse] = Field(default_factory=list)
    sheet_normalizations: list[BulkImportSheetNormalizationResponse] = Field(default_factory=list)
    manifest_sheets: list[BulkImportManifestSheetResponse] = Field(default_factory=list)
    skipped_sheets: list[str] = Field(default_factory=list)
    created_series: int = 0
    updated_series: int = 0
    created_products: int = 0
    updated_products: int = 0
    created_series_images: int = 0
    created_product_images: int = 0
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class BulkActionRequest(BaseModel):
    action: Literal["pdf_template", "permissible_use_mode", "scale_efficiency_lines"]
    product_type_key: str
    series_id: Optional[int] = None
    template_id: Optional[str] = None
    template_entity: Literal["products", "series"] = "products"
    permissible_use_mode: Optional[Literal["dedicated", "upper", "lower", "both", "none"]] = None


class BulkActionResponse(BaseModel):
    action: str
    product_type_key: str
    series_id: Optional[int] = None
    affected_product_count: int = 0
    changed_product_count: int = 0
    skipped_product_count: int = 0
    message: str


class BulkImageImportResponse(BaseModel):
    target_kind: str
    target_id: int
    file_names: list[str] = Field(default_factory=list)
    image_count: int = 0
    overwritten_file_names: list[str] = Field(default_factory=list)


class SeriesBase(_RichTextAliasMixin):
    name: str
    product_type_key: str
    description1_html: Optional[str] = None
    description2_html: Optional[str] = None
    description3_html: Optional[str] = None
    description4_html: Optional[str] = None
    description5_html: Optional[str] = None
    description6_html: Optional[str] = None
    description7_html: Optional[str] = None
    description8_html: Optional[str] = None
    description9_html: Optional[str] = None
    description10_html: Optional[str] = None
    description_field_count: int = 0
    contents_description: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None


class SeriesCreate(SeriesBase):
    pass


class SeriesUpdate(_RichTextAliasMixin):
    name: Optional[str] = None
    product_type_key: Optional[str] = None
    description1_html: Optional[str] = None
    description2_html: Optional[str] = None
    description3_html: Optional[str] = None
    description4_html: Optional[str] = None
    description5_html: Optional[str] = None
    description6_html: Optional[str] = None
    description7_html: Optional[str] = None
    description8_html: Optional[str] = None
    description9_html: Optional[str] = None
    description10_html: Optional[str] = None
    description_field_count: Optional[int] = None
    contents_description: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None


class SeriesResponse(BaseModel):
    id: int
    name: str
    product_type_key: Optional[str] = None
    product_type_label: Optional[str] = None
    description1_html: Optional[str] = None
    description2_html: Optional[str] = None
    description3_html: Optional[str] = None
    description4_html: Optional[str] = None
    description5_html: Optional[str] = None
    description6_html: Optional[str] = None
    description7_html: Optional[str] = None
    description8_html: Optional[str] = None
    description9_html: Optional[str] = None
    description10_html: Optional[str] = None
    description_field_count: int = 0
    contents_description: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    product_count: int = 0
    primary_series_image_url: Optional[str] = None
    public_primary_series_image_url: Optional[str] = None
    secondary_series_image_url: Optional[str] = None
    series_graph_image_url: Optional[str] = None
    series_pdf_url: Optional[str] = None
    series_printed_pdf_url: Optional[str] = None
    series_printed_pdf_size_bytes: Optional[int] = None
    series_online_pdf_url: Optional[str] = None
    series_tab_color: Optional[str] = None
    series_images: list["SeriesImageResponse"] = Field(default_factory=list)
    performance_table_html: Optional[str] = None
    series_graph_payload: Optional[dict] = None
    associated_documents: list[AssociatedDocumentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SeriesImageResponse(BaseModel):
    id: int
    series_id: int
    file_name: str
    sort_order: int
    url: str
    public_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProductParameterResponse(BaseModel):
    id: int
    parameter_name: str
    sort_order: int
    value_string: Optional[str] = None
    value_number: Optional[float] = None
    unit: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProductParameterGroupResponse(BaseModel):
    id: int
    group_name: str
    sort_order: int
    parameters: list[ProductParameterResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductParameterInput(BaseModel):
    parameter_name: str
    sort_order: int = 0
    value_string: Optional[str] = None
    value_number: Optional[float] = None
    unit: Optional[str] = None


class ProductParameterGroupInput(BaseModel):
    group_name: str
    sort_order: int = 0
    parameters: list[ProductParameterInput] = Field(default_factory=list)


NumericValue = confloat(strict=True)


class FanAcousticTableRow(BaseModel):
    speed_rpm: Optional[NumericValue] = None
    peak_pressure_pa: Optional[NumericValue] = None
    peak_power_kw: Optional[NumericValue] = None
    running_frequency_hz: Optional[NumericValue] = None
    running_voltage_v: Optional[NumericValue] = None
    sound_pressure_db_3m: Optional[NumericValue] = None
    sound_power_levels: dict[str, Optional[NumericValue]] = Field(default_factory=dict)


class FanAcousticTable(BaseModel):
    variant_mode: Literal["default", "override_1ph", "override_3ph"] = "default"
    sound_power_columns: list[str] = Field(default_factory=list)
    rows: list[FanAcousticTableRow] = Field(default_factory=list)


class ProductBase(_RichTextAliasMixin):
    model: str
    product_type_key: Optional[str] = "fan"
    series_id: Optional[int] = None
    series_name: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    description1_html: Optional[str] = None
    description2_html: Optional[str] = None
    description3_html: Optional[str] = None
    description4_html: Optional[str] = None
    description5_html: Optional[str] = None
    description6_html: Optional[str] = None
    description7_html: Optional[str] = None
    description8_html: Optional[str] = None
    description9_html: Optional[str] = None
    description10_html: Optional[str] = None
    description_field_count: int = 0
    comments_html: Optional[str] = None
    show_rpm_band_shading: bool = True
    permissible_use_mode: str = "both"
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    parameter_groups: list[ProductParameterGroupInput] = Field(default_factory=list)
    fan_acoustic_table: Optional[FanAcousticTable] = None


class ProductCreate(ProductBase):
    rpm_lines: list["ProductRpmLineInput"] = Field(default_factory=list)
    efficiency_points: list["ProductEfficiencyPointInput"] = Field(default_factory=list)


class ProductUpdate(_RichTextAliasMixin):
    model: Optional[str] = None
    product_type_key: Optional[str] = None
    series_id: Optional[int] = None
    series_name: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    description1_html: Optional[str] = None
    description2_html: Optional[str] = None
    description3_html: Optional[str] = None
    description4_html: Optional[str] = None
    description5_html: Optional[str] = None
    description6_html: Optional[str] = None
    description7_html: Optional[str] = None
    description8_html: Optional[str] = None
    description9_html: Optional[str] = None
    description10_html: Optional[str] = None
    description_field_count: Optional[int] = None
    comments_html: Optional[str] = None
    show_rpm_band_shading: Optional[bool] = None
    permissible_use_mode: Optional[str] = None
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    parameter_groups: Optional[list[ProductParameterGroupInput]] = None
    fan_acoustic_table: Optional[FanAcousticTable] = None


class ProductGraphDataReplace(BaseModel):
    rpm_lines: list["ProductRpmLineInput"] = Field(default_factory=list)
    efficiency_points: list["ProductEfficiencyPointInput"] = Field(default_factory=list)


class ProductResponse(ProductBase):
    id: int
    product_type_label: Optional[str] = None
    graph_image_url: Optional[str] = None
    grouped_specs_main_table: Optional[str] = None
    product_pdf_url: Optional[str] = None
    product_printed_pdf_url: Optional[str] = None
    product_printed_pdf_size_bytes: Optional[int] = None
    product_online_pdf_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    parameter_groups: list["ProductParameterGroupResponse"] = Field(default_factory=list)
    product_images: list["ProductImageResponse"] = Field(default_factory=list)
    associated_documents: list[AssociatedDocumentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductSelectorResponse(BaseModel):
    """Small payload used by selectors that do not need full product data."""

    id: int
    model: str
    product_type_key: Optional[str] = None
    product_type_label: Optional[str] = None
    series_id: Optional[int] = None
    series_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProductRpmPointInput(BaseModel):
    airflow: float
    pressure: float


class ProductRpmLineInput(BaseModel):
    rpm: float
    band_color: Optional[str] = None
    points: list[ProductRpmPointInput] = Field(default_factory=list)


class ProductEfficiencyPointInput(BaseModel):
    airflow: float
    efficiency_centre: Optional[float] = None
    efficiency_lower_end: Optional[float] = None
    efficiency_higher_end: Optional[float] = None
    permissible_use: Optional[float] = None

# --- RPM lines / points ---
class RpmLineBase(BaseModel):
    rpm: float
    band_color: Optional[str] = None


class RpmLineCreate(RpmLineBase):
    pass


class RpmLineUpdate(BaseModel):
    rpm: Optional[float] = None
    band_color: Optional[str] = None


class RpmLineResponse(RpmLineBase):
    id: int
    points: list["RpmPointResponse"] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    product_id: int = Field(validation_alias=AliasChoices("product_id", "fan_id"), serialization_alias="product_id")


class RpmPointBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    rpm_line_id: int
    airflow: float = Field(validation_alias=AliasChoices("airflow", "flow"), serialization_alias="airflow")
    pressure: float


class RpmPointCreate(RpmPointBase):
    pass


class RpmPointResponse(RpmPointBase):
    id: int
    product_id: int = Field(validation_alias=AliasChoices("product_id", "fan_id"), serialization_alias="product_id")
    rpm: Optional[float] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# --- Efficiency points ---
class EfficiencyPointBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    airflow: float = Field(validation_alias=AliasChoices("airflow", "flow"), serialization_alias="airflow")
    efficiency_centre: Optional[float] = None
    efficiency_lower_end: Optional[float] = None
    efficiency_higher_end: Optional[float] = None
    permissible_use: Optional[float] = None


class EfficiencyPointCreate(EfficiencyPointBase):
    pass


class EfficiencyPointResponse(EfficiencyPointBase):
    id: int
    product_id: int = Field(validation_alias=AliasChoices("product_id", "fan_id"), serialization_alias="product_id")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ProductImageResponse(BaseModel):
    id: int
    product_id: int = Field(validation_alias=AliasChoices("product_id", "fan_id"), serialization_alias="product_id")
    file_name: str
    sort_order: int
    url: str
    public_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ProductImageReorder(BaseModel):
    image_ids: list[int] = Field(..., min_length=1)


class SeriesImageReorder(BaseModel):
    image_ids: list[int] = Field(..., min_length=1)


class GraphImageMaintenanceResponse(BaseModel):
    message: str
    products_processed: int = 0
    files_deleted: int = 0


class PdfMaintenanceResponse(BaseModel):
    message: str
    products_processed: int = 0


class SetupLogEntryResponse(BaseModel):
    id: int
    timestamp: str
    level: str
    logger: str
    message: str
    formatted: str


class PublicAccessLogEntryResponse(SetupLogEntryResponse):
    payload: dict[str, object] = Field(default_factory=dict)


class MaintenanceJobResponse(BaseModel):
    id: str
    job_type: str
    status: str
    progress_message: Optional[str] = None
    progress_current: Optional[int] = None
    progress_total: Optional[int] = None
    progress_percent: Optional[float] = None
    error: Optional[str] = None
    result_message: Optional[str] = None
    result_download_url: Optional[str] = None
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class QuoteRequestCreate(BaseModel):
    name: str
    company: Optional[str] = None
    email: str
    phone: Optional[str] = None
    request_type: Optional[str] = None
    attributes: list[str] = Field(default_factory=list)
    airflow_min: Optional[str] = None
    airflow_max: Optional[str] = None
    pressure_min: Optional[str] = None
    pressure_max: Optional[str] = None
    power_limit: Optional[str] = None
    helper_thing: Optional[str] = None
    helper_room_size: Optional[str] = None
    helper_three_phase: Optional[str] = None
    helper_constraints: Optional[str] = None
    short_notes: Optional[str] = None
    details: Optional[str] = None
    page_type: Optional[str] = None
    page_title: Optional[str] = None
    page_summary: Optional[str] = None
    page_card_title: Optional[str] = None
    page_card_summary: Optional[str] = None
    page_url: Optional[str] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    origin: Optional[str] = None
    product_type: Optional[dict] = None
    series: Optional[dict] = None
    product: Optional[dict] = None
    website: Optional[str] = None
    page_context: Optional[dict] = None
    graph_image_data_url: Optional[str] = None


class QuoteRequestResponse(BaseModel):
    id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    status: str
    email_status: str
    email_error: Optional[str] = None
    acknowledgement_email_status: str = "pending"
    acknowledgement_email_error: Optional[str] = None
    verification_provider: str
    verification_status: str
    verification_error: Optional[str] = None
    name: str
    company: Optional[str] = None
    email: str
    phone: Optional[str] = None
    request_type: str
    attributes: list[str] = Field(default_factory=list)
    airflow_min: Optional[str] = None
    airflow_max: Optional[str] = None
    pressure_min: Optional[str] = None
    pressure_max: Optional[str] = None
    power_limit: Optional[str] = None
    graph_image_url: Optional[str] = None
    graph_upload_token: Optional[str] = None
    short_notes: Optional[str] = None
    details: Optional[str] = None
    page_type: Optional[str] = None
    page_title: Optional[str] = None
    page_summary: Optional[str] = None
    page_card_title: Optional[str] = None
    page_card_summary: Optional[str] = None
    page_url: Optional[str] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    origin: Optional[str] = None
    product_type: Optional[dict] = None
    series: Optional[dict] = None
    product: Optional[dict] = None
    context_json: dict = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class QuoteRequestGraphImageUpload(BaseModel):
    upload_token: str
    graph_image_data_url: str


class QuoteRequestStatusUpdate(BaseModel):
    status: str


class BandGraphStyleSettings(BaseModel):
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class QuoteRequestNotificationSettings(BaseModel):
    quote_request_recipient_emails: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SMTPSettings(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_use_tls: bool = True
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    smtp_from_address: str = ""
    password_configured: bool = False
    status: Literal["configured", "not_configured"] = "not_configured"
    source: Literal["saved", "environment"] = "environment"


class SMTPSettingsUpdate(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: Optional[str] = None
    smtp_use_tls: bool = True
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    smtp_from_address: str = ""


class QuoteRequestEmailTestRequest(BaseModel):
    recipient_email: str


class QuoteRequestEmailTestResponse(BaseModel):
    message: str
    recipient_email: str


class SMTPTestRequest(BaseModel):
    recipient_email: Optional[str] = None


class SMTPTestResponse(BaseModel):
    success: bool = True
    operation: Literal["connection", "delivery"]
    stage: str
    code: str
    message: str
    detail: Optional[str] = None
    correlation_id: str


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class AuthSessionResponse(BaseModel):
    authenticated: bool
    username: Optional[str] = None
    is_admin: bool = False
    cookie_secure: bool = False
    client_ip_v4: Optional[str] = None
    client_ip_v6: Optional[str] = None
    client_ip: Optional[str] = None
    device_ip_v4: Optional[str] = None
    device_ip_v6: Optional[str] = None
    device_ip: Optional[str] = None
    csrf_token: Optional[str] = None


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    is_admin: bool = False


class UserPasswordUpdate(BaseModel):
    password: str = Field(..., min_length=8)


class AuthPasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class CmsProductResponse(BaseModel):
    id: int
    model: str
    product_type_key: Optional[str] = None
    product_type_label: Optional[str] = None
    series_id: Optional[int] = None
    series_name: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    description1_html: Optional[str] = None
    description2_html: Optional[str] = None
    description3_html: Optional[str] = None
    description4_html: Optional[str] = None
    description5_html: Optional[str] = None
    description6_html: Optional[str] = None
    description7_html: Optional[str] = None
    description8_html: Optional[str] = None
    description9_html: Optional[str] = None
    description10_html: Optional[str] = None
    description_field_count: int = 0
    comments_html: Optional[str] = None
    graph_image_url: Optional[str] = None
    grouped_specs_main_table: Optional[str] = None
    product_pdf_url: Optional[str] = None
    product_printed_pdf_url: Optional[str] = None
    product_printed_pdf_size_bytes: Optional[int] = None
    product_online_pdf_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    public_primary_product_image_url: Optional[str] = None
    product_images: list["ProductImageResponse"] = Field(default_factory=list)
    parameter_groups: list["ProductParameterGroupResponse"] = Field(default_factory=list)
    rpm_lines: list[RpmLineResponse] = Field(default_factory=list)
    efficiency_points: list[EfficiencyPointResponse] = Field(default_factory=list)
    fan_acoustic_table: Optional[FanAcousticTable] = None
    associated_documents: list[AssociatedDocumentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CmsSeriesProductSummary(BaseModel):
    id: int
    model: str
    product_type_key: Optional[str] = None
    product_type_label: Optional[str] = None
    series_id: Optional[int] = None
    series_name: Optional[str] = None
    product_pdf_url: Optional[str] = None
    product_printed_pdf_url: Optional[str] = None
    product_online_pdf_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    public_primary_product_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CmsSeriesResponse(BaseModel):
    id: int
    name: str
    product_type_key: Optional[str] = None
    product_type_label: Optional[str] = None
    description1_html: Optional[str] = None
    description2_html: Optional[str] = None
    description3_html: Optional[str] = None
    description4_html: Optional[str] = None
    description5_html: Optional[str] = None
    description6_html: Optional[str] = None
    description7_html: Optional[str] = None
    description8_html: Optional[str] = None
    description9_html: Optional[str] = None
    description10_html: Optional[str] = None
    description_field_count: int = 0
    comments_html: Optional[str] = None
    contents_description: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    product_count: int = 0
    series_graph_image_url: Optional[str] = None
    series_pdf_url: Optional[str] = None
    series_printed_pdf_url: Optional[str] = None
    series_printed_pdf_size_bytes: Optional[int] = None
    series_online_pdf_url: Optional[str] = None
    series_tab_color: Optional[str] = None
    primary_series_image_url: Optional[str] = None
    public_primary_series_image_url: Optional[str] = None
    secondary_series_image_url: Optional[str] = None
    series_images: list[SeriesImageResponse] = Field(default_factory=list)
    products: list[CmsSeriesProductSummary] = Field(default_factory=list)
    performance_table_html: Optional[str] = None
    series_graph_payload: Optional[dict] = None
    associated_documents: list[AssociatedDocumentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductTypePdfProductResponse(BaseModel):
    id: int
    model: str
    series_id: Optional[int] = None
    series_name: Optional[str] = None
    product_type_key: Optional[str] = None
    product_type_label: Optional[str] = None
    primary_product_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProductTypePdfSeriesResponse(BaseModel):
    id: int
    name: str
    series_tab_color: Optional[str] = None
    series_description_html: Optional[str] = None
    first_product_image_uri: Optional[str] = None
    page_start: int = 0
    page_end: int = 0
    page_count: int = 0
    product_count: int = 0
    products: list[ProductTypePdfProductResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductTypePdfResponse(BaseModel):
    id: int
    key: str
    label: str
    series_names: list[str] = Field(default_factory=list)
    series_names_html: str = ""
    series_groups_html: str = ""
    contents_html: str = ""
    contents_icon_url: Optional[str] = None
    intro_page_count: int = 0
    page_count: int = 0
    product_type_pdf_url: Optional[str] = None
    product_type_printed_pdf_url: Optional[str] = None
    series: list[ProductTypePdfSeriesResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

ProductResponse.model_rebuild()
ProductTypeResponse.model_rebuild()
ProductParameterGroupResponse.model_rebuild()
RpmLineResponse.model_rebuild()
