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
    diameter_mm: Optional[float] = None
    max_rpm: Optional[float] = None


class FanCreate(FanBase):
    pass


class FanUpdate(BaseModel):
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    notes: Optional[str] = None
    diameter_mm: Optional[float] = None
    max_rpm: Optional[float] = None


class FanResponse(FanBase):
    id: int

    class Config:
        from_attributes = True


# --- MapPoint ---
class MapPointBase(BaseModel):
    rpm: float
    flow: float
    pressure: float
    efficiency: Optional[float] = None


class MapPointCreate(MapPointBase):
    pass


class MapPointResponse(MapPointBase):
    id: int
    fan_id: int

    class Config:
        from_attributes = True


# --- Bulk import (CSV rows as list of dict-like objects) ---
class MapPointBulk(BaseModel):
    points: list[MapPointCreate] = Field(..., min_length=1)
