"""add printed and online template fields

Revision ID: 20260425_000011
Revises: 20260421_000010
Create Date: 2026-04-25 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260425_000011"
down_revision = "20260421_000010"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("products", "printed_template_id"):
        op.add_column("products", sa.Column("printed_template_id", sa.String(length=128), nullable=True))
    if not _has_column("products", "online_template_id"):
        op.add_column("products", sa.Column("online_template_id", sa.String(length=128), nullable=True))
    if not _has_column("series", "printed_template_id"):
        op.add_column("series", sa.Column("printed_template_id", sa.String(length=128), nullable=True))
    if not _has_column("series", "online_template_id"):
        op.add_column("series", sa.Column("online_template_id", sa.String(length=128), nullable=True))
    if not _has_column("product_types", "printed_product_template_id"):
        op.add_column("product_types", sa.Column("printed_product_template_id", sa.String(length=128), nullable=True))
    if not _has_column("product_types", "online_product_template_id"):
        op.add_column("product_types", sa.Column("online_product_template_id", sa.String(length=128), nullable=True))

    op.execute(
        """
        UPDATE products
        SET
            printed_template_id = template_id,
            online_template_id = template_id
        WHERE template_id IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE series
        SET
            printed_template_id = template_id,
            online_template_id = template_id
        WHERE template_id IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE product_types
        SET
            printed_product_template_id = product_template_id,
            online_product_template_id = product_template_id
        WHERE product_template_id IS NOT NULL
        """
    )


def downgrade() -> None:
    if _has_column("product_types", "online_product_template_id"):
        op.drop_column("product_types", "online_product_template_id")
    if _has_column("product_types", "printed_product_template_id"):
        op.drop_column("product_types", "printed_product_template_id")
    if _has_column("series", "online_template_id"):
        op.drop_column("series", "online_template_id")
    if _has_column("series", "printed_template_id"):
        op.drop_column("series", "printed_template_id")
    if _has_column("products", "online_template_id"):
        op.drop_column("products", "online_template_id")
    if _has_column("products", "printed_template_id"):
        op.drop_column("products", "printed_template_id")
