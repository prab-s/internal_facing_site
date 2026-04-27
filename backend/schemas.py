"""
Pydantic schemas for request/response validation.
"""
from typing import Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


# --- Product ---
class ProductTypeParameterPresetResponse(BaseModel):
    id: int
    parameter_name: str
    sort_order: int
    preferred_unit: Optional[str] = None
    value_string: Optional[str] = None
    value_number: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ProductTypeParameterPresetUpdate(BaseModel):
    parameter_name: str
    preferred_unit: Optional[str] = None
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
    printed_product_template_id: Optional[str] = None
    online_product_template_id: Optional[str] = None
    parameter_group_presets: list[ProductTypeParameterGroupPresetUpdate] = Field(default_factory=list)
    rpm_line_presets: list[ProductTypeRpmLinePresetUpdate] = Field(default_factory=list)
    efficiency_point_presets: list[ProductTypeEfficiencyPointPresetUpdate] = Field(default_factory=list)


class ProductTypeResponse(BaseModel):
    id: int
    key: str
    label: str
    series_names: list[str] = Field(default_factory=list)
    product_type_pdf_url: Optional[str] = None
    product_type_printed_pdf_url: Optional[str] = None
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
    product_template_id: Optional[str] = None
    printed_product_template_id: Optional[str] = None
    online_product_template_id: Optional[str] = None
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    parameter_group_presets: list[ProductTypeParameterGroupPresetResponse] = Field(default_factory=list)
    rpm_line_presets: list[ProductTypeRpmLinePresetResponse] = Field(default_factory=list)
    efficiency_point_presets: list[ProductTypeEfficiencyPointPresetResponse] = Field(default_factory=list)

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
    product_template_id: Optional[str] = None
    printed_product_template_id: Optional[str] = None
    online_product_template_id: Optional[str] = None
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
    product_template_id: Optional[str] = None
    printed_product_template_id: Optional[str] = None
    online_product_template_id: Optional[str] = None
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


class SeriesBase(BaseModel):
    name: str
    product_type_key: str
    description1_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description1_html", "description_html"))
    description2_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description2_html", "features_html"))
    description3_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description3_html", "specifications_html"))
    description4_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description4_html", "comments_html"))
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None


class SeriesCreate(SeriesBase):
    pass


class SeriesUpdate(BaseModel):
    name: Optional[str] = None
    product_type_key: Optional[str] = None
    description1_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description1_html", "description_html"))
    description2_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description2_html", "features_html"))
    description3_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description3_html", "specifications_html"))
    description4_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description4_html", "comments_html"))
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
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    product_count: int = 0
    series_graph_image_url: Optional[str] = None
    series_pdf_url: Optional[str] = None
    series_printed_pdf_url: Optional[str] = None
    series_online_pdf_url: Optional[str] = None
    series_tab_color: Optional[str] = None

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


class ProductBase(BaseModel):
    model: str
    product_type_key: Optional[str] = "fan"
    series_id: Optional[int] = None
    series_name: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    description1_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description1_html", "description_html"))
    description2_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description2_html", "features_html"))
    description3_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description3_html", "specifications_html"))
    comments_html: Optional[str] = None
    show_rpm_band_shading: bool = True
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    parameter_groups: list[ProductParameterGroupInput] = Field(default_factory=list)


class ProductCreate(ProductBase):
    rpm_lines: list["ProductRpmLineInput"] = Field(default_factory=list)
    efficiency_points: list["ProductEfficiencyPointInput"] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    model: Optional[str] = None
    product_type_key: Optional[str] = None
    series_id: Optional[int] = None
    series_name: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    description1_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description1_html", "description_html"))
    description2_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description2_html", "features_html"))
    description3_html: Optional[str] = Field(default=None, validation_alias=AliasChoices("description3_html", "specifications_html"))
    comments_html: Optional[str] = None
    show_rpm_band_shading: Optional[bool] = None
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    parameter_groups: Optional[list[ProductParameterGroupInput]] = None


class ProductResponse(ProductBase):
    id: int
    product_type_label: Optional[str] = None
    graph_image_url: Optional[str] = None
    product_pdf_url: Optional[str] = None
    product_printed_pdf_url: Optional[str] = None
    product_online_pdf_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    parameter_groups: list["ProductParameterGroupResponse"] = Field(default_factory=list)
    product_images: list["ProductImageResponse"] = Field(default_factory=list)

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
    product_id: int = Field(
        ...,
        validation_alias=AliasChoices("product_id", "fan_id"),
        serialization_alias="product_id",
    )


class RpmPointBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    rpm_line_id: int
    airflow: float = Field(
        ...,
        validation_alias=AliasChoices("airflow", "flow"),
        serialization_alias="airflow",
    )
    pressure: float


class RpmPointCreate(RpmPointBase):
    pass


class RpmPointResponse(RpmPointBase):
    id: int
    product_id: int = Field(
        ...,
        validation_alias=AliasChoices("product_id", "fan_id"),
        serialization_alias="product_id",
    )
    rpm: Optional[float] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# --- Efficiency points ---
class EfficiencyPointBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    airflow: float = Field(
        ...,
        validation_alias=AliasChoices("airflow", "flow"),
        serialization_alias="airflow",
    )
    efficiency_centre: Optional[float] = None
    efficiency_lower_end: Optional[float] = None
    efficiency_higher_end: Optional[float] = None
    permissible_use: Optional[float] = None


class EfficiencyPointCreate(EfficiencyPointBase):
    pass


class EfficiencyPointResponse(EfficiencyPointBase):
    id: int
    product_id: int = Field(
        ...,
        validation_alias=AliasChoices("product_id", "fan_id"),
        serialization_alias="product_id",
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class CmsProductGraphValuesResponse(BaseModel):
    rpm: list[float] = Field(default_factory=list)
    airflow: list[float] = Field(default_factory=list)
    pressure: list[float] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductImageResponse(BaseModel):
    id: int
    product_id: int = Field(
        ...,
        validation_alias=AliasChoices("product_id", "fan_id"),
        serialization_alias="product_id",
    )
    file_name: str
    sort_order: int
    url: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ProductImageReorder(BaseModel):
    image_ids: list[int] = Field(..., min_length=1)


class GraphImageMaintenanceResponse(BaseModel):
    message: str
    products_processed: int = 0
    files_deleted: int = 0


class PdfMaintenanceResponse(BaseModel):
    message: str
    products_processed: int = 0


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


class BandGraphStyleSettings(BaseModel):
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class AuthSessionResponse(BaseModel):
    authenticated: bool
    username: Optional[str] = None
    is_admin: bool = False


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
    comments_html: Optional[str] = None
    graph_image_url: Optional[str] = None
    product_pdf_url: Optional[str] = None
    product_printed_pdf_url: Optional[str] = None
    product_online_pdf_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    parameter_groups: list["ProductParameterGroupResponse"] = Field(default_factory=list)
    rpm_lines: list[RpmLineResponse] = Field(default_factory=list)
    efficiency_points: list[EfficiencyPointResponse] = Field(default_factory=list)

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

    model_config = ConfigDict(from_attributes=True)


class CmsSeriesResponse(BaseModel):
    id: int
    name: str
    product_type_key: Optional[str] = None
    product_type_label: Optional[str] = None
    description1_html: Optional[str] = None
    description2_html: Optional[str] = None
    description3_html: Optional[str] = None
    comments_html: Optional[str] = None
    template_id: Optional[str] = None
    printed_template_id: Optional[str] = None
    online_template_id: Optional[str] = None
    product_count: int = 0
    series_graph_image_url: Optional[str] = None
    series_pdf_url: Optional[str] = None
    series_printed_pdf_url: Optional[str] = None
    series_online_pdf_url: Optional[str] = None
    series_tab_color: Optional[str] = None
    products: list[CmsSeriesProductSummary] = Field(default_factory=list)

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
    contents_html: str = ""
    intro_page_count: int = 0
    page_count: int = 0
    product_type_pdf_url: Optional[str] = None
    product_type_printed_pdf_url: Optional[str] = None
    series: list[ProductTypePdfSeriesResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

ProductResponse.model_rebuild()
ProductParameterGroupResponse.model_rebuild()
RpmLineResponse.model_rebuild()
