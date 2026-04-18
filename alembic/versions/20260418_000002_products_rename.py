"""Rename fans schema to products/product_id."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260418_000002"
down_revision = "20260418_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "fans" in tables and "products" in tables:
        existing_products = bind.execute(sa.text("SELECT COUNT(*) FROM products")).scalar() or 0
        if existing_products:
            raise RuntimeError(
                "Cannot rename fans to products because both tables already exist and products is not empty."
            )
        op.drop_table("products")
        tables.remove("products")

    if "fans" in tables and "products" not in tables:
        op.rename_table("fans", "products")

    _rename_fk_column("product_parameter_groups", "fan_id", "product_id")
    _rename_fk_column("rpm_lines", "fan_id", "product_id")
    _rename_fk_column("rpm_points", "fan_id", "product_id")
    _rename_fk_column("efficiency_points", "fan_id", "product_id")
    _rename_fk_column("product_images", "fan_id", "product_id")

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "ix_fans_id" in {index["name"] for index in inspector.get_indexes("products")}:
        op.drop_index("ix_fans_id", table_name="products")
    if "ix_products_id" not in {index["name"] for index in sa.inspect(bind).get_indexes("products")}:
        op.create_index("ix_products_id", "products", ["id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "ix_products_id" in {index["name"] for index in inspector.get_indexes("products")}:
        op.drop_index("ix_products_id", table_name="products")
    if "ix_fans_id" not in {index["name"] for index in sa.inspect(bind).get_indexes("products")}:
        op.create_index("ix_fans_id", "products", ["id"], unique=False)

    _rename_fk_column("product_images", "product_id", "fan_id")
    _rename_fk_column("efficiency_points", "product_id", "fan_id")
    _rename_fk_column("rpm_points", "product_id", "fan_id")
    _rename_fk_column("rpm_lines", "product_id", "fan_id")
    _rename_fk_column("product_parameter_groups", "product_id", "fan_id")

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "products" in tables and "fans" not in tables:
        op.rename_table("products", "fans")


def _rename_fk_column(table_name: str, old_name: str, new_name: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if old_name not in columns or new_name in columns:
        return

    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column(old_name, new_column_name=new_name)
