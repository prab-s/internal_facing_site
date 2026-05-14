"""add fan acoustic table to products

Revision ID: 20260514_000013
Revises: 20260510_000012
Create Date: 2026-05-14 23:40:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260514_000013"
down_revision = "20260510_000012"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("products", "fan_acoustic_table"):
        op.add_column("products", sa.Column("fan_acoustic_table", sa.Text(), nullable=True))


def downgrade() -> None:
    if _has_column("products", "fan_acoustic_table"):
        op.drop_column("products", "fan_acoustic_table")
