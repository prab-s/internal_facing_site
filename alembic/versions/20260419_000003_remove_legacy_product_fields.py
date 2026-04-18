"""Remove legacy product optional fields and secondary graph axis label."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260419_000003"
down_revision = "20260418_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "products" in inspector.get_table_names():
        product_columns = {column["name"] for column in inspector.get_columns("products")}
        removable_product_columns = [name for name in ("diameter_mm", "max_rpm") if name in product_columns]
        if removable_product_columns:
            with op.batch_alter_table("products") as batch_op:
                for column_name in removable_product_columns:
                    batch_op.drop_column(column_name)

    inspector = sa.inspect(bind)
    if "product_types" in inspector.get_table_names():
        product_type_columns = {column["name"] for column in inspector.get_columns("product_types")}
        if "graph_secondary_axis_label" in product_type_columns:
            with op.batch_alter_table("product_types") as batch_op:
                batch_op.drop_column("graph_secondary_axis_label")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "product_types" in inspector.get_table_names():
        product_type_columns = {column["name"] for column in inspector.get_columns("product_types")}
        if "graph_secondary_axis_label" not in product_type_columns:
            with op.batch_alter_table("product_types") as batch_op:
                batch_op.add_column(sa.Column("graph_secondary_axis_label", sa.String(length=128), nullable=True))

    inspector = sa.inspect(bind)
    if "products" in inspector.get_table_names():
        product_columns = {column["name"] for column in inspector.get_columns("products")}
        with op.batch_alter_table("products") as batch_op:
            if "diameter_mm" not in product_columns:
                batch_op.add_column(sa.Column("diameter_mm", sa.Float(), nullable=True))
            if "max_rpm" not in product_columns:
                batch_op.add_column(sa.Column("max_rpm", sa.Float(), nullable=True))
