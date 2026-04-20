"""add product template id

Revision ID: 20260419_000006
Revises: 20260419_000005
Create Date: 2026-04-19 22:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260419_000006"
down_revision = "20260419_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("template_id", sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "template_id")
