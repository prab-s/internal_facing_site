"""create series table

Revision ID: 20260419_000005
Revises: 20260419_000004
Create Date: 2026-04-19 03:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260419_000005"
down_revision = "20260419_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "series" not in inspector.get_table_names():
        op.create_table(
            "series",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("product_type_id", sa.Integer(), sa.ForeignKey("product_types.id"), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("description_html", sa.Text(), nullable=True),
            sa.Column("features_html", sa.Text(), nullable=True),
            sa.Column("specifications_html", sa.Text(), nullable=True),
            sa.Column("comments_html", sa.Text(), nullable=True),
            sa.Column("template_id", sa.String(length=128), nullable=True),
            sa.UniqueConstraint("product_type_id", "name", name="uq_series_product_type_name"),
        )

    inspector = sa.inspect(bind)
    if "products" in inspector.get_table_names():
        product_columns = {column["name"] for column in inspector.get_columns("products")}
        if "series_id" not in product_columns:
            with op.batch_alter_table("products") as batch_op:
                batch_op.add_column(sa.Column("series_id", sa.Integer(), nullable=True))
                batch_op.create_foreign_key("fk_products_series_id", "series", ["series_id"], ["id"])

    inspector = sa.inspect(bind)
    product_columns = {column["name"] for column in inspector.get_columns("products")} if "products" in inspector.get_table_names() else set()
    if {"product_type_id", "series_name", "series_id"}.issubset(product_columns):
        op.execute(
            sa.text(
                """
                INSERT INTO series (product_type_id, name)
                SELECT DISTINCT product_type_id, series_name
                FROM products
                WHERE product_type_id IS NOT NULL
                  AND series_name IS NOT NULL
                  AND TRIM(series_name) <> ''
                  AND NOT EXISTS (
                    SELECT 1
                    FROM series existing
                    WHERE existing.product_type_id = products.product_type_id
                      AND existing.name = products.series_name
                  )
                """
            )
        )
        op.execute(
            sa.text(
                """
                UPDATE products
                SET series_id = (
                  SELECT s.id
                  FROM series s
                  WHERE s.product_type_id = products.product_type_id
                    AND s.name = products.series_name
                )
                WHERE series_name IS NOT NULL
                  AND TRIM(series_name) <> ''
                  AND series_id IS NULL
                """
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "products" in inspector.get_table_names():
        product_columns = {column["name"] for column in inspector.get_columns("products")}
        if "series_id" in product_columns:
            with op.batch_alter_table("products") as batch_op:
                batch_op.drop_constraint("fk_products_series_id", type_="foreignkey")
                batch_op.drop_column("series_id")

    inspector = sa.inspect(bind)
    if "series" in inspector.get_table_names():
        op.drop_table("series")
