import unittest
from fastapi import HTTPException
from backend.main import (
    bulk_import_build_graph_state, bulk_import_downsample_series,
    normalize_bulk_import_rows,
)


class GraphImportAccuracyTests(unittest.TestCase):
    def rows(self):
        return [{"airflow_l_s": i * 10 + .1, "pressure_1000rpm": 500 - 3 * i + .25,
                 "efficiency_centre": i * 5 + .125 if i <= 20 else None} for i in range(101)]

    def test_defaults_preserve_all_points_and_values(self):
        state = bulk_import_build_graph_state(self.rows())
        self.assertEqual(len(state["rpmPoints"]), 101)
        self.assertEqual(state["rpmPoints"][0]["airflow"], .1)
        self.assertEqual(state["rpmPoints"][0]["pressure"], 500.25)
        self.assertEqual(state["efficiencyPoints"][0]["efficiency_centre"], .125)

    def test_scaling_and_simplification_are_independent_options(self):
        rows = self.rows()
        full = bulk_import_build_graph_state(rows)
        simple = bulk_import_build_graph_state(rows, downsample_imported_curves=True, downsample_point_count=15)
        scaled = bulk_import_build_graph_state(rows, auto_scale_overlays=True)
        self.assertEqual(len(simple["rpmPoints"]), 15)
        self.assertEqual(scaled["rpmPoints"], full["rpmPoints"])
        self.assertNotEqual(scaled["efficiencyPoints"], full["efficiencyPoints"])
        self.assertEqual(rows, self.rows())

    def test_missing_first_value_does_not_remove_curve_or_invent_point(self):
        rows = normalize_bulk_import_rows([
            {"airflow_l_s": 100, "pressure_1000rpm": "#N/A"},
            {"airflow_l_s": 200, "pressure_1000rpm": 300.75},
        ], copy_permissible_use=False)
        points = bulk_import_build_graph_state(rows)["rpmPoints"]
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]["airflow"], 200)
        self.assertEqual(points[0]["pressure"], 300.75)

    def test_simplification_preserves_narrow_dip_and_endpoints(self):
        points = [{"airflow": i * 10, "pressure": 500 - 3 * i - (150 if i == 36 else 0)} for i in range(101)]
        result = bulk_import_downsample_series(points, target_count=5)
        self.assertIn(points[36], result)
        self.assertEqual(result[0], points[0])
        self.assertEqual(result[-1], points[-1])
        self.assertTrue(all(point in points for point in result))

    def test_invalid_values_and_counts_are_rejected(self):
        with self.assertRaises(HTTPException):
            bulk_import_build_graph_state([{"airflow_l_s": 0, "pressure_1000rpm": "1,200"}])
        for count in [0, 1, 2.5]:
            with self.assertRaises(HTTPException):
                bulk_import_downsample_series([], target_count=count)
