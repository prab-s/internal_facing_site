"""add product series name

Revision ID: 20260419_000004
Revises: 20260419_000003
Create Date: 2026-04-19 02:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260419_000004"
down_revision = "20260419_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("series_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "series_name")
