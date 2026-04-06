"""
Pydantic schemas for request/response validation.
"""
from typing import Optional
from pydantic import BaseModel, Field


# --- Fan ---
class FanBase(BaseModel):
    manufacturer: str
    model: str
    notes: Optional[str] = None
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    show_rpm_band_shading: bool = True
    diameter_mm: Optional[float] = None
    max_rpm: Optional[float] = None


class FanCreate(FanBase):
    pass


class FanUpdate(BaseModel):
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    notes: Optional[str] = None
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    show_rpm_band_shading: Optional[bool] = None
    diameter_mm: Optional[float] = None
    max_rpm: Optional[float] = None


class FanResponse(FanBase):
    id: int
    graph_image_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None
    product_images: list["ProductImageResponse"] = Field(default_factory=list)

    class Config:
        from_attributes = True


# --- RPM lines / points ---
class RpmLineBase(BaseModel):
    rpm: float


class RpmLineCreate(RpmLineBase):
    pass


class RpmLineResponse(RpmLineBase):
    id: int
    fan_id: int

    class Config:
        from_attributes = True


class RpmPointBase(BaseModel):
    rpm_line_id: int
    flow: float
    pressure: float


class RpmPointCreate(RpmPointBase):
    pass


class RpmPointResponse(RpmPointBase):
    id: int
    fan_id: int
    rpm: Optional[float] = None

    class Config:
        from_attributes = True


# --- Efficiency points ---
class EfficiencyPointBase(BaseModel):
    flow: float
    efficiency_centre: Optional[float] = None
    efficiency_lower_end: Optional[float] = None
    efficiency_higher_end: Optional[float] = None
    permissible_use: Optional[float] = None


class EfficiencyPointCreate(EfficiencyPointBase):
    pass


class EfficiencyPointResponse(EfficiencyPointBase):
    id: int
    fan_id: int

    class Config:
        from_attributes = True


class ProductImageResponse(BaseModel):
    id: int
    fan_id: int
    file_name: str
    sort_order: int
    url: str

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True


class CmsFanResponse(BaseModel):
    id: int
    manufacturer: str
    model: str
    notes: Optional[str] = None
    mounting_style: Optional[str] = None
    discharge_type: Optional[str] = None
    diameter_mm: Optional[float] = None
    max_rpm: Optional[float] = None
    graph_image_url: Optional[str] = None
    primary_product_image_url: Optional[str] = None

    class Config:
        from_attributes = True


FanResponse.model_rebuild()
