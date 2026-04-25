"""Baseline schema for Internal Facing."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260418_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=1024), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "product_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("supports_graph", sa.Boolean(), nullable=False),
        sa.Column("graph_kind", sa.String(length=64), nullable=True),
        sa.Column("supports_graph_overlays", sa.Boolean(), nullable=False),
        sa.Column("supports_band_graph_style", sa.Boolean(), nullable=False),
        sa.Column("graph_line_value_label", sa.String(length=128), nullable=True),
        sa.Column("graph_line_value_unit", sa.String(length=64), nullable=True),
        sa.Column("graph_x_axis_label", sa.String(length=128), nullable=True),
        sa.Column("graph_x_axis_unit", sa.String(length=64), nullable=True),
        sa.Column("graph_y_axis_label", sa.String(length=128), nullable=True),
        sa.Column("graph_y_axis_unit", sa.String(length=64), nullable=True),
        sa.Column("product_template_id", sa.String(length=128), nullable=True),
        sa.Column("graph_secondary_axis_label", sa.String(length=128), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_product_types_id"), "product_types", ["id"], unique=False)
    op.create_index(op.f("ix_product_types_key"), "product_types", ["key"], unique=True)

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("band_graph_background_color", sa.String(length=32), nullable=True),
        sa.Column("band_graph_label_text_color", sa.String(length=32), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_app_settings_id"), "app_settings", ["id"], unique=False)

    op.create_table(
        "fans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_type_id", sa.Integer(), nullable=True),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("description_html", sa.Text(), nullable=True),
        sa.Column("features_html", sa.Text(), nullable=True),
        sa.Column("specifications_html", sa.Text(), nullable=True),
        sa.Column("comments_html", sa.Text(), nullable=True),
        sa.Column("graph_image_path", sa.String(length=512), nullable=True),
        sa.Column("show_rpm_band_shading", sa.Boolean(), nullable=False),
        sa.Column("band_graph_background_color", sa.String(length=32), nullable=True),
        sa.Column("band_graph_label_text_color", sa.String(length=32), nullable=True),
        sa.Column("band_graph_faded_opacity", sa.Float(), nullable=True),
        sa.Column("band_graph_permissible_label_color", sa.String(length=32), nullable=True),
        sa.Column("diameter_mm", sa.Float(), nullable=True),
        sa.Column("max_rpm", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["product_type_id"], ["product_types.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_fans_id"), "fans", ["id"], unique=False)

    op.create_table(
        "product_type_parameter_group_presets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_type_id", sa.Integer(), nullable=False),
        sa.Column("group_name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["product_type_id"], ["product_types.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_product_type_parameter_group_presets_id"),
        "product_type_parameter_group_presets",
        ["id"],
        unique=False,
    )

    op.create_table(
        "rpm_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fan_id", sa.Integer(), nullable=False),
        sa.Column("rpm", sa.Float(), nullable=False),
        sa.Column("band_color", sa.String(length=32), nullable=True),
        sa.ForeignKeyConstraint(["fan_id"], ["fans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_rpm_lines_id"), "rpm_lines", ["id"], unique=False)

    op.create_table(
        "efficiency_points",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fan_id", sa.Integer(), nullable=False),
        sa.Column("flow", sa.Float(), nullable=False),
        sa.Column("efficiency_centre", sa.Float(), nullable=True),
        sa.Column("efficiency_lower_end", sa.Float(), nullable=True),
        sa.Column("efficiency_higher_end", sa.Float(), nullable=True),
        sa.Column("permissible_use", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["fan_id"], ["fans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_efficiency_points_id"), "efficiency_points", ["id"], unique=False)

    op.create_table(
        "product_images",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fan_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=512), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["fan_id"], ["fans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_product_images_id"), "product_images", ["id"], unique=False)

    op.create_table(
        "product_parameter_groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fan_id", sa.Integer(), nullable=False),
        sa.Column("group_name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["fan_id"], ["fans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_product_parameter_groups_id"), "product_parameter_groups", ["id"], unique=False)

    op.create_table(
        "product_type_parameter_presets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_preset_id", sa.Integer(), nullable=False),
        sa.Column("parameter_name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("preferred_unit", sa.String(length=64), nullable=True),
        sa.Column("value_string", sa.Text(), nullable=True),
        sa.Column("value_number", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(
            ["group_preset_id"],
            ["product_type_parameter_group_presets.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_product_type_parameter_presets_id"),
        "product_type_parameter_presets",
        ["id"],
        unique=False,
    )

    op.create_table(
        "rpm_points",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("fan_id", sa.Integer(), nullable=False),
        sa.Column("rpm_line_id", sa.Integer(), nullable=False),
        sa.Column("flow", sa.Float(), nullable=False),
        sa.Column("pressure", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["fan_id"], ["fans.id"]),
        sa.ForeignKeyConstraint(["rpm_line_id"], ["rpm_lines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_rpm_points_id"), "rpm_points", ["id"], unique=False)

    op.create_table(
        "product_parameters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("parameter_name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("value_string", sa.Text(), nullable=True),
        sa.Column("value_number", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["product_parameter_groups.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_product_parameters_id"), "product_parameters", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_product_parameters_id"), table_name="product_parameters")
    op.drop_table("product_parameters")
    op.drop_index(op.f("ix_rpm_points_id"), table_name="rpm_points")
    op.drop_table("rpm_points")
    op.drop_index(op.f("ix_product_type_parameter_presets_id"), table_name="product_type_parameter_presets")
    op.drop_table("product_type_parameter_presets")
    op.drop_index(op.f("ix_product_parameter_groups_id"), table_name="product_parameter_groups")
    op.drop_table("product_parameter_groups")
    op.drop_index(op.f("ix_product_images_id"), table_name="product_images")
    op.drop_table("product_images")
    op.drop_index(op.f("ix_efficiency_points_id"), table_name="efficiency_points")
    op.drop_table("efficiency_points")
    op.drop_index(op.f("ix_rpm_lines_id"), table_name="rpm_lines")
    op.drop_table("rpm_lines")
    op.drop_index(
        op.f("ix_product_type_parameter_group_presets_id"),
        table_name="product_type_parameter_group_presets",
    )
    op.drop_table("product_type_parameter_group_presets")
    op.drop_index(op.f("ix_fans_id"), table_name="fans")
    op.drop_table("fans")
    op.drop_index(op.f("ix_app_settings_id"), table_name="app_settings")
    op.drop_table("app_settings")
    op.drop_index(op.f("ix_product_types_key"), table_name="product_types")
    op.drop_index(op.f("ix_product_types_id"), table_name="product_types")
    op.drop_table("product_types")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
