"""Allow public enquiries to upload graph screenshots after saving."""

from alembic import op
import sqlalchemy as sa

revision = "20260919_000031"
down_revision = "20260919_000030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("quote_requests")}
    if "graph_upload_token" not in columns:
        op.add_column("quote_requests", sa.Column("graph_upload_token", sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column("quote_requests", "graph_upload_token")
