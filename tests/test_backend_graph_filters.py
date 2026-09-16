from types import SimpleNamespace
from io import BytesIO
import unittest
from unittest.mock import patch

from openpyxl import Workbook

from backend.main import (
    _canonical_associated_document_owner_type,
    bulk_import_find_best_overlay_scale_factor,
    bulk_import_find_highest_efficiency_overlay_key,
    bulk_import_scale_overlay_points_to_highest_rpm_line,
    load_graph_import_rows,
    normalize_bulk_import_rows,
    normalize_bulk_import_name,
    ordered_product_type_pdf_series,
    product_matches_parameter_filters,
)


class AssociatedDocumentOwnerTypeTests(unittest.TestCase):
    def test_product_type_route_slug_is_normalized_for_delete_handler(self):
        self.assertEqual(_canonical_associated_document_owner_type("product-types"), "product_type")

    def test_product_route_slug_is_normalized_for_delete_handler(self):
        self.assertEqual(_canonical_associated_document_owner_type("products"), "product")

    def test_non_product_type_owner_types_are_unchanged(self):
        self.assertEqual(_canonical_associated_document_owner_type("product"), "product")
        self.assertEqual(_canonical_associated_document_owner_type("series"), "series")


class ProductTypePdfSeriesOrderTests(unittest.TestCase):
    def test_explicit_series_order_is_followed_and_unlisted_series_remain_alphabetical(self):
        series_a = SimpleNamespace(id=1, name="Alpha")
        series_b = SimpleNamespace(id=2, name="Bravo")
        series_c = SimpleNamespace(id=3, name="Charlie")
        product_type = SimpleNamespace(
            series=[series_c, series_a, series_b],
            product_type_pdf_series_order=[3],
        )

        self.assertEqual(
            [series.name for series in ordered_product_type_pdf_series(product_type)],
            ["Charlie", "Alpha", "Bravo"],
        )

    def test_invalid_or_duplicate_series_ids_are_ignored(self):
        series_a = SimpleNamespace(id=1, name="Alpha")
        series_b = SimpleNamespace(id=2, name="Bravo")
        product_type = SimpleNamespace(
            series=[series_a, series_b],
            product_type_pdf_series_order=[999, 2, 2, "invalid"],
        )

        self.assertEqual(
            [series.name for series in ordered_product_type_pdf_series(product_type)],
            ["Bravo", "Alpha"],
        )


def make_parameter(group_name: str, parameter_name: str, value_number=None, value_string=None):
    return SimpleNamespace(
        group_name=group_name,
        parameter_name=parameter_name,
        value_number=value_number,
        value_string=value_string,
    )


def make_rpm_line(rpm: float, airflow_pressure_pairs: list[tuple[float, float]]):
    points = [
        SimpleNamespace(airflow=airflow, pressure=pressure)
        for airflow, pressure in airflow_pressure_pairs
    ]
    return SimpleNamespace(rpm=rpm, points=points)


class GraphFilterRangeTests(unittest.TestCase):
    def test_graph_rpm_filter_rejects_products_with_any_rpm_above_max(self):
        product = SimpleNamespace(
            id=1,
            model="Test Fan",
            parameter_groups=[],
            rpm_lines=[
                make_rpm_line(1800, [(10.0, 100.0)]),
                make_rpm_line(2400, [(12.0, 120.0)]),
            ],
            efficiency_points=[],
        )
        filters = [
            {
                "group_name": "__graph__",
                "parameter_name": "rpm",
                "min_number": None,
                "max_number": 2300,
                "value_string": None,
            }
        ]

        self.assertFalse(product_matches_parameter_filters(product, filters))

    def test_graph_rpm_filter_allows_products_with_all_rpms_within_window(self):
        product = SimpleNamespace(
            id=2,
            model="Control Fan",
            parameter_groups=[],
            rpm_lines=[
                make_rpm_line(1800, [(10.0, 100.0)]),
                make_rpm_line(2200, [(12.0, 120.0)]),
            ],
            efficiency_points=[],
        )
        filters = [
            {
                "group_name": "__graph__",
                "parameter_name": "rpm",
                "min_number": None,
                "max_number": 2300,
                "value_string": None,
            }
        ]

        self.assertTrue(product_matches_parameter_filters(product, filters))


class BulkImportNormalizationTests(unittest.TestCase):
    def test_missing_first_row_values_are_not_invented(self):
        rows = [
            {
                "airflow_l_s": "0",
                "pressure_650rpm": "#N/A",
                "pressure_800rpm": "#N/A",
            },
            {
                "airflow_l_s": "5",
                "pressure_650rpm": "#N/A",
                "pressure_800rpm": "#N/A",
            },
            {
                "airflow_l_s": "10",
                "pressure_650rpm": "#N/A",
                "pressure_800rpm": "120",
            },
            {
                "airflow_l_s": "15",
                "pressure_650rpm": "88",
                "pressure_800rpm": "#N/A",
            },
        ]

        normalized = normalize_bulk_import_rows(rows)

        self.assertNotIn("pressure_650rpm", normalized[0])
        self.assertNotIn("pressure_800rpm", normalized[0])
        self.assertNotIn("pressure_650rpm", normalized[1])
        self.assertNotIn("pressure_800rpm", normalized[1])
        self.assertNotIn("pressure_650rpm", normalized[2])
        self.assertEqual(normalized[2]["pressure_800rpm"], "120")
        self.assertEqual(normalized[3]["pressure_650rpm"], "88")
        self.assertNotIn("pressure_800rpm", normalized[3])

    def test_overlay_scale_factor_does_not_apply_a_hidden_bias(self):
        rpm_profile = {
            "points": [
                {"axis": 0.0, "value": 10.0},
                {"axis": 10.0, "value": 30.0},
            ],
            "axis_extents": {
                "flowMax": 10.0,
                "pressureMax": 30.0,
                "overlayMax": 30.0,
            },
        }
        terminal_point = {"airflow": 5.0, "value": 10.0}

        scale_factor = bulk_import_find_best_overlay_scale_factor(
            terminal_point,
            rpm_profile,
        )

        self.assertIsNotNone(scale_factor)
        self.assertAlmostEqual(scale_factor, 2.0, places=2)

    def test_graph_import_loader_reads_first_workbook_sheet(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Graph"
        sheet.append(["airflow_l_s", "pressure_650rpm"])
        sheet.append([0, "#N/A"])
        sheet.append([35, 45])

        buffer = BytesIO()
        workbook.save(buffer)

        rows = load_graph_import_rows("graph-data.xlsx", buffer.getvalue())

        self.assertEqual(
            rows,
            [
                ["airflow_l_s", "pressure_650rpm"],
                [0, "#N/A"],
                [35, 45],
            ],
        )

    def test_missing_permissible_use_values_follow_the_highest_efficiency_line(self):
        rows = [
            {
                "airflow_l_s": "0",
                "efficiency_centre": "40",
                "efficiency_lower_end": "12",
                "efficiency_higher_end": "14",
            },
            {
                "airflow_l_s": "10",
                "efficiency_centre": "50",
                "efficiency_lower_end": "24",
                "efficiency_higher_end": "28",
            },
        ]

        normalized = normalize_bulk_import_rows(rows)

        self.assertEqual(normalized[0]["permissible_use"], "40")
        self.assertEqual(normalized[1]["permissible_use"], "50")

    def test_missing_efficiency_overlay_values_are_removed_instead_of_zeroed(self):
        rows = [
            {
                "airflow_l_s": "0",
                "efficiency_centre": "#N/A",
                "efficiency_lower_end": "#N/A",
                "efficiency_higher_end": "45",
            },
            {
                "airflow_l_s": "35",
                "efficiency_centre": "#N/A",
                "efficiency_lower_end": "#N/A",
                "efficiency_higher_end": "55",
            },
        ]

        normalized = normalize_bulk_import_rows(rows)

        self.assertNotIn("efficiency_centre", normalized[0])
        self.assertNotIn("efficiency_lower_end", normalized[0])
        self.assertEqual(normalized[0]["efficiency_higher_end"], "45")
        self.assertNotIn("efficiency_centre", normalized[1])
        self.assertNotIn("efficiency_lower_end", normalized[1])
        self.assertEqual(normalized[1]["efficiency_higher_end"], "55")

    def test_efficiency_alias_headers_keep_the_upper_and_lower_order(self):
        rows = [
            {
                "airflow_l_s": "0",
                "Upper Red Curve": "40",
                "Lower Red Curve": "30",
                "Red High": "50",
                "Red Low": "20",
            }
        ]

        normalized = normalize_bulk_import_rows(rows)

        self.assertEqual(normalized[0]["efficiency_higher_end"], "50")
        self.assertEqual(normalized[0]["efficiency_lower_end"], "20")
        self.assertEqual(normalize_bulk_import_name("Upper Red Curve"), "efficiency_higher_end")
        self.assertEqual(normalize_bulk_import_name("Lower Red Curve"), "efficiency_lower_end")

    def test_highest_efficiency_source_prefers_the_upper_line_when_peaks_tie(self):
        rows = [
            {
                "airflow_l_s": "0",
                "efficiency_centre": "15",
                "efficiency_lower_end": "20",
                "efficiency_higher_end": "20",
            },
            {
                "airflow_l_s": "10",
                "efficiency_centre": "14",
                "efficiency_lower_end": "19",
                "efficiency_higher_end": "19",
            },
        ]

        self.assertEqual(
            bulk_import_find_highest_efficiency_overlay_key(rows),
            "efficiency_higher_end",
        )

    def test_overlay_scaling_uses_the_highest_efficiency_peak_not_the_last_row(self):
        rpm_lines = [
            {"id": 1, "rpm": 1800},
            {"id": 2, "rpm": 2400},
        ]
        rpm_points = [
            {"rpm_line_id": 2, "airflow": 0, "pressure": 10},
            {"rpm_line_id": 2, "airflow": 10, "pressure": 20},
            {"rpm_line_id": 2, "airflow": 20, "pressure": 30},
        ]
        overlay_points = [
            {
                "airflow": 5,
                "efficiency_centre": 7,
                "efficiency_lower_end": None,
                "efficiency_higher_end": None,
                "permissible_use": None,
            },
            {
                "airflow": 10,
                "efficiency_centre": 15,
                "efficiency_lower_end": None,
                "efficiency_higher_end": None,
                "permissible_use": None,
            },
            {
                "airflow": 20,
                "efficiency_centre": 12,
                "efficiency_lower_end": None,
                "efficiency_higher_end": None,
                "permissible_use": None,
            },
        ]

        scaled = bulk_import_scale_overlay_points_to_highest_rpm_line(
            overlay_points,
            rpm_lines,
            rpm_points,
        )

        self.assertAlmostEqual(scaled[0]["efficiency_centre"], 7 * 20 / 15)
        self.assertEqual(scaled[1]["efficiency_centre"], 20)
        self.assertEqual(scaled[2]["efficiency_centre"], 16)

    def test_overlay_scaling_scales_each_efficiency_column_independently(self):
        rpm_lines = [
            {"id": 1, "rpm": 1800},
            {"id": 2, "rpm": 2400},
        ]
        rpm_points = [
            {"rpm_line_id": 2, "airflow": 12, "pressure": 36},
            {"rpm_line_id": 2, "airflow": 24, "pressure": 72},
            {"rpm_line_id": 2, "airflow": 36, "pressure": 108},
        ]
        overlay_points = [
            {
                "airflow": 2,
                "efficiency_centre": 6,
                "efficiency_lower_end": 4,
                "efficiency_higher_end": 2,
                "permissible_use": None,
            },
            {
                "airflow": 4,
                "efficiency_centre": 12,
                "efficiency_lower_end": 8,
                "efficiency_higher_end": 4,
                "permissible_use": None,
            },
            {
                "airflow": 6,
                "efficiency_centre": 18,
                "efficiency_lower_end": 12,
                "efficiency_higher_end": 6,
                "permissible_use": None,
            },
        ]

        with patch(
            "backend.main.bulk_import_find_best_overlay_scale_factor",
            side_effect=[2, 3, 6],
        ):
            scaled = bulk_import_scale_overlay_points_to_highest_rpm_line(
                overlay_points,
                rpm_lines,
                rpm_points,
            )

        self.assertEqual(scaled[2]["efficiency_centre"], 36)
        self.assertEqual(scaled[2]["efficiency_lower_end"], 36)
        self.assertEqual(scaled[2]["efficiency_higher_end"], 36)

    def test_overlay_scaling_preserves_decimal_precision(self):
        rpm_lines = [
            {"id": 1, "rpm": 1800},
            {"id": 2, "rpm": 2400},
        ]
        rpm_points = [
            {"rpm_line_id": 2, "airflow": 0, "pressure": 10},
            {"rpm_line_id": 2, "airflow": 10, "pressure": 20},
            {"rpm_line_id": 2, "airflow": 20, "pressure": 30},
        ]
        overlay_points = [
            {
                "airflow": 5,
                "efficiency_centre": 7,
                "efficiency_lower_end": None,
                "efficiency_higher_end": None,
                "permissible_use": None,
            },
            {
                "airflow": 10,
                "efficiency_centre": 15,
                "efficiency_lower_end": None,
                "efficiency_higher_end": None,
                "permissible_use": None,
            },
        ]

        with patch(
            "backend.main.bulk_import_find_best_overlay_scale_factor",
            return_value=1.23456,
        ):
            scaled = bulk_import_scale_overlay_points_to_highest_rpm_line(
                overlay_points,
                rpm_lines,
                rpm_points,
            )

        self.assertEqual(scaled[0]["airflow"], 5)
        self.assertEqual(scaled[1]["airflow"], 10)
        self.assertAlmostEqual(scaled[0]["efficiency_centre"], 7 * 1.23456)
        self.assertAlmostEqual(scaled[1]["efficiency_centre"], 15 * 1.23456)

if __name__ == "__main__":
    unittest.main()
