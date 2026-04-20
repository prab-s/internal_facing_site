"""rename description fields

Revision ID: 20260420_000007
Revises: 20260419_000006
Create Date: 2026-04-20 10:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260420_000007"
down_revision = "20260419_000006"
branch_labels = None
depends_on = None


def _rename_if_present(table_name: str, old_name: str, new_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
      return
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if old_name not in columns or new_name in columns:
        return
    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column(old_name, new_column_name=new_name)


def upgrade() -> None:
    for table_name in ("products", "series"):
        _rename_if_present(table_name, "description_html", "description1_html")
        _rename_if_present(table_name, "features_html", "description2_html")
        _rename_if_present(table_name, "specifications_html", "description3_html")


def downgrade() -> None:
    for table_name in ("products", "series"):
        _rename_if_present(table_name, "description1_html", "description_html")
        _rename_if_present(table_name, "description2_html", "features_html")
        _rename_if_present(table_name, "description3_html", "specifications_html")
