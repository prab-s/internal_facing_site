"""rename series comments_html to description4_html

Revision ID: 20260421_000010
Revises: 20260420_000009
Create Date: 2026-04-21 12:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260421_000010"
down_revision = "20260420_000009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "series" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("series")}
    if "comments_html" not in columns or "description4_html" in columns:
        return

    if bind.dialect.name == "postgresql":
        op.execute(sa.text("ALTER TABLE series RENAME COLUMN comments_html TO description4_html"))
        return

    with op.batch_alter_table("series") as batch_op:
        batch_op.alter_column("comments_html", new_column_name="description4_html")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "series" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("series")}
    if "description4_html" not in columns or "comments_html" in columns:
        return

    if bind.dialect.name == "postgresql":
        op.execute(sa.text("ALTER TABLE series RENAME COLUMN description4_html TO comments_html"))
        return

    with op.batch_alter_table("series") as batch_op:
        batch_op.alter_column("description4_html", new_column_name="comments_html")
