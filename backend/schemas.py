"""
Pydantic schemas for request/response validation.
"""
from typing import Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


# --- Fan ---
class FanBase(BaseModel):
    model: str
    notes: Optional[str] = None
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    show_rpm_band_shading: bool = True
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    diameter_mm: Optional[float] = None
    max_rpm: Optional[float] = None


class FanCreate(FanBase):
    pass


class FanUpdate(BaseModel):
    model: Optional[str] = None
    notes: Optional[str] = None
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    show_rpm_band_shading: Optional[bool] = None
    band_graph_background_color: Optional[str] = None
    band_graph_label_text_color: Optional[str] = None
    band_graph_faded_opacity: Optional[float] = None
    band_graph_permissible_label_color: Optional[str] = None
    diameter_mm: Optional[float] = None
    max_rpm: Optional[float] = None


class FanResponse(FanBase):
    id: int
    graph_image_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    product_images: list["ProductImageResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


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
    fan_id: int

    model_config = ConfigDict(from_attributes=True)


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
    fan_id: int
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
    fan_id: int

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ProductImageResponse(BaseModel):
    id: int
    fan_id: int
    file_name: str
    sort_order: int
    url: str

    model_config = ConfigDict(from_attributes=True)


class ProductImageReorder(BaseModel):
    image_ids: list[int] = Field(..., min_length=1)


class GraphImageMaintenanceResponse(BaseModel):
    message: str
    fans_processed: int = 0
    files_deleted: int = 0


class DatabaseMirrorStatusResponse(BaseModel):
    mirror_enabled: bool
    message: str
    sqlite_counts: dict[str, int] = Field(default_factory=dict)
    postgres_counts: dict[str, int] = Field(default_factory=dict)
    count_differences: dict[str, int] = Field(default_factory=dict)


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


class CmsFanResponse(BaseModel):
    id: int
    model: str
    notes: Optional[str] = None
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    diameter_mm: Optional[float] = None
    max_rpm: Optional[float] = None
    graph_image_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


FanResponse.model_rebuild()
