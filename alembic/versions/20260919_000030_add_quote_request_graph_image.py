"""Persist graph screenshots submitted with quote enquiries."""

from alembic import op
import sqlalchemy as sa


revision = "20260919_000030"
down_revision = "20260917_000029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("quote_requests")}
    if "graph_image_filename" not in columns:
        op.add_column("quote_requests", sa.Column("graph_image_filename", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("quote_requests", "graph_image_filename")
