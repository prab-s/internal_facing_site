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

    model_config = ConfigDict(from_attributes=True)


class ProductTypeParameterGroupPresetResponse(BaseModel):
    id: int
    group_name: str
    sort_order: int
    parameter_presets: list[ProductTypeParameterPresetResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductTypeResponse(BaseModel):
    id: int
    key: str
    label: str
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
    parameter_group_presets: list[ProductTypeParameterGroupPresetResponse] = Field(default_factory=list)

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
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    description_html: Optional[str] = None
    features_html: Optional[str] = None
    specifications_html: Optional[str] = None
    comments_html: Optional[str] = None
    show_rpm_band_shading: bool = True
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    parameter_groups: list[ProductParameterGroupInput] = Field(default_factory=list)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    model: Optional[str] = None
    product_type_key: Optional[str] = None
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    description_html: Optional[str] = None
    features_html: Optional[str] = None
    specifications_html: Optional[str] = None
    comments_html: Optional[str] = None
    show_rpm_band_shading: Optional[bool] = None
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None


class ProductResponse(ProductBase):
    id: int
    product_type_label: Optional[str] = None
    graph_image_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    parameter_groups: list["ProductParameterGroupResponse"] = Field(default_factory=list)
    product_images: list["ProductImageResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Compatibility aliases kept temporarily while older imports are phased out.
FanBase = ProductBase
FanCreate = ProductCreate
FanUpdate = ProductUpdate
FanResponse = ProductResponse


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
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    description_html: Optional[str] = None
    features_html: Optional[str] = None
    specifications_html: Optional[str] = None
    comments_html: Optional[str] = None
    graph_image_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    parameter_groups: list["ProductParameterGroupResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Compatibility alias kept temporarily for older CMS integrations.
CmsFanResponse = CmsProductResponse


ProductResponse.model_rebuild()
ProductParameterGroupResponse.model_rebuild()
