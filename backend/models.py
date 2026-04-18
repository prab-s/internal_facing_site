"""
SQLAlchemy models for the fan catalogue.
"""
import os

from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(1024), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)


class Fan(Base):
    __tablename__ = "fans"

    id = Column(Integer, primary_key=True, index=True)
    model = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    mounting_style = Column(String(255), nullable=True)
    discharge_type = Column(String(255), nullable=True)
    graph_image_path = Column(String(512), nullable=True)
    show_rpm_band_shading = Column(Boolean, nullable=False, default=True)
    band_graph_background_color = Column(String(32), nullable=True)
    band_graph_label_text_color = Column(String(32), nullable=True)
    band_graph_faded_opacity = Column(Float, nullable=True)
    band_graph_permissible_label_color = Column(String(32), nullable=True)
    # Optional numeric fields for filtering (MVP: optional, can be null)
    diameter_mm = Column(Float, nullable=True)
    max_rpm = Column(Float, nullable=True)

    rpm_lines = relationship("RpmLine", back_populates="fan", cascade="all, delete-orphan")
    efficiency_points = relationship("EfficiencyPoint", back_populates="fan", cascade="all, delete-orphan")
    product_images = relationship(
        "ProductImage",
        back_populates="fan",
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
            f"/api/media/product_graphs/{file_name}?v={version}"
            if version is not None
            else f"/api/media/product_graphs/{file_name}"
        )

    @property
    def primary_product_image_url(self):
        if not self.product_images:
            return None
        first_image = sorted(self.product_images, key=lambda img: (img.sort_order, img.id))[0]
        return first_image.url


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    band_graph_background_color = Column(String(32), nullable=True)
    band_graph_label_text_color = Column(String(32), nullable=True)


class RpmLine(Base):
    __tablename__ = "rpm_lines"

    id = Column(Integer, primary_key=True, index=True)
    fan_id = Column(Integer, ForeignKey("fans.id"), nullable=False)
    rpm = Column(Float, nullable=False)
    band_color = Column(String(32), nullable=True)

    fan = relationship("Fan", back_populates="rpm_lines")
    points = relationship("RpmPoint", back_populates="rpm_line", cascade="all, delete-orphan")


class RpmPoint(Base):
    __tablename__ = "rpm_points"

    id = Column(Integer, primary_key=True, index=True)
    fan_id = Column(Integer, ForeignKey("fans.id"), nullable=False)
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
    fan_id = Column(Integer, ForeignKey("fans.id"), nullable=False)
    airflow = Column("flow", Float, nullable=False)
    efficiency_centre = Column(Float, nullable=True)
    efficiency_lower_end = Column(Float, nullable=True)
    efficiency_higher_end = Column(Float, nullable=True)
    permissible_use = Column(Float, nullable=True)

    fan = relationship("Fan", back_populates="efficiency_points")

    @property
    def flow(self):
        return self.airflow

    @flow.setter
    def flow(self, value):
        self.airflow = value


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    fan_id = Column(Integer, ForeignKey("fans.id"), nullable=False)
    file_name = Column(String(512), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)

    fan = relationship("Fan", back_populates="product_images")

    @property
    def url(self):
        file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "product_images", self.file_name)
        version = None
        try:
            version = int(os.path.getmtime(file_path))
        except OSError:
            version = None
        return (
            f"/api/media/product_images/{self.file_name}?v={version}"
            if version is not None
            else f"/api/media/product_images/{self.file_name}"
        )
