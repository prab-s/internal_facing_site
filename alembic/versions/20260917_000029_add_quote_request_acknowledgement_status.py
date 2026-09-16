"""Track customer acknowledgement delivery for quote requests."""

from alembic import op
import sqlalchemy as sa


revision = "20260917_000029"
down_revision = "20260903_000028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("quote_requests")}
    if "acknowledgement_email_status" not in columns:
        op.add_column("quote_requests", sa.Column("acknowledgement_email_status", sa.String(length=32), nullable=False, server_default="pending"))
    if "acknowledgement_email_error" not in columns:
        op.add_column("quote_requests", sa.Column("acknowledgement_email_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("quote_requests", "acknowledgement_email_error")
    op.drop_column("quote_requests", "acknowledgement_email_status")
