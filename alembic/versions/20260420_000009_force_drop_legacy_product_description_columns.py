"""force drop legacy product description columns

Revision ID: 20260420_000009
Revises: 20260420_000008
Create Date: 2026-04-20 10:55:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260420_000009"
down_revision = "20260420_000008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "products" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("products")}
    if "description_html" in columns and "description1_html" in columns:
        op.execute(sa.text("UPDATE products SET description1_html = COALESCE(description1_html, description_html) WHERE description_html IS NOT NULL"))
    if "features_html" in columns and "description2_html" in columns:
        op.execute(sa.text("UPDATE products SET description2_html = COALESCE(description2_html, features_html) WHERE features_html IS NOT NULL"))
    if "specifications_html" in columns and "description3_html" in columns:
        op.execute(sa.text("UPDATE products SET description3_html = COALESCE(description3_html, specifications_html) WHERE specifications_html IS NOT NULL"))

    if bind.dialect.name == "postgresql":
        op.execute(sa.text("ALTER TABLE products DROP COLUMN IF EXISTS description_html"))
        op.execute(sa.text("ALTER TABLE products DROP COLUMN IF EXISTS features_html"))
        op.execute(sa.text("ALTER TABLE products DROP COLUMN IF EXISTS specifications_html"))
        return

    remaining_columns = {column["name"] for column in sa.inspect(bind).get_columns("products")}
    legacy_columns = [name for name in ("description_html", "features_html", "specifications_html") if name in remaining_columns]
    if not legacy_columns:
        return
    with op.batch_alter_table("products") as batch_op:
        for column_name in legacy_columns:
            batch_op.drop_column(column_name)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "products" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("products")}
    with op.batch_alter_table("products") as batch_op:
        if "description_html" not in columns:
            batch_op.add_column(sa.Column("description_html", sa.Text(), nullable=True))
        if "features_html" not in columns:
            batch_op.add_column(sa.Column("features_html", sa.Text(), nullable=True))
        if "specifications_html" not in columns:
            batch_op.add_column(sa.Column("specifications_html", sa.Text(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE products
            SET
              description_html = COALESCE(description_html, description1_html),
              features_html = COALESCE(features_html, description2_html),
              specifications_html = COALESCE(specifications_html, description3_html)
            """
        )
    )
