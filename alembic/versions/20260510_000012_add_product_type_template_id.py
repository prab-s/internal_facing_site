"""add product type template id

Revision ID: 20260510_000012
Revises: 20260425_000011
Create Date: 2026-05-10 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260510_000012"
down_revision = "20260425_000011"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("product_types", "product_type_template_id"):
        op.add_column("product_types", sa.Column("product_type_template_id", sa.String(length=128), nullable=True))


def downgrade() -> None:
    if _has_column("product_types", "product_type_template_id"):
        op.drop_column("product_types", "product_type_template_id")
