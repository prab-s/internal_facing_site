"""
SQLAlchemy models. MVP data model: Fan, CurvePoint, MapPoint.
Optional numeric fields on Fan (diameter_mm, max_rpm) included for future filters;
MVP filters can use manufacturer/model text only.
"""
from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class Fan(Base):
    __tablename__ = "fans"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer = Column(String(255), nullable=False)
    model = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    # Optional numeric fields for filtering (MVP: optional, can be null)
    diameter_mm = Column(Float, nullable=True)
    max_rpm = Column(Float, nullable=True)

    map_points = relationship("MapPoint", back_populates="fan", cascade="all, delete-orphan")


class MapPoint(Base):
    __tablename__ = "map_points"

    id = Column(Integer, primary_key=True, index=True)
    fan_id = Column(Integer, ForeignKey("fans.id"), nullable=False)
    rpm = Column(Float, nullable=False)
    flow = Column(Float, nullable=False)
    pressure = Column(Float, nullable=False)
    efficiency = Column(Float, nullable=True)

    fan = relationship("Fan", back_populates="map_points")
