"""drop legacy description columns

Revision ID: 20260420_000008
Revises: 20260420_000007
Create Date: 2026-04-20 10:45:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260420_000008"
down_revision = "20260420_000007"
branch_labels = None
depends_on = None


def _sync_and_drop_legacy_columns(table_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns(table_name)}
    legacy_pairs = [
        ("description_html", "description1_html"),
        ("features_html", "description2_html"),
        ("specifications_html", "description3_html"),
    ]
    present_legacy_pairs = [(old_name, new_name) for old_name, new_name in legacy_pairs if old_name in columns and new_name in columns]

    for old_name, new_name in present_legacy_pairs:
        op.execute(
            sa.text(
                f"""
                UPDATE {table_name}
                SET {new_name} = COALESCE({new_name}, {old_name})
                WHERE {old_name} IS NOT NULL
                """
            )
        )

    legacy_columns = [old_name for old_name, _ in legacy_pairs if old_name in columns]
    if not legacy_columns:
        return

    with op.batch_alter_table(table_name) as batch_op:
        for column_name in legacy_columns:
            batch_op.drop_column(column_name)


def upgrade() -> None:
    for table_name in ("products", "series"):
        _sync_and_drop_legacy_columns(table_name)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table_name in ("products", "series"):
        if table_name not in inspector.get_table_names():
            continue
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        with op.batch_alter_table(table_name) as batch_op:
            if "description_html" not in columns:
                batch_op.add_column(sa.Column("description_html", sa.Text(), nullable=True))
            if "features_html" not in columns:
                batch_op.add_column(sa.Column("features_html", sa.Text(), nullable=True))
            if "specifications_html" not in columns:
                batch_op.add_column(sa.Column("specifications_html", sa.Text(), nullable=True))

        op.execute(
            sa.text(
                f"""
                UPDATE {table_name}
                SET
                  description_html = COALESCE(description_html, description1_html),
                  features_html = COALESCE(features_html, description2_html),
                  specifications_html = COALESCE(specifications_html, description3_html)
                """
            )
        )
