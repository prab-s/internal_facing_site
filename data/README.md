# Data folder

- **curve_points_example.csv** — Example format for curve import: `flow, pressure [, efficiency] [, rpm] [, curve_type]`. Header and lines starting with `#` are ignored.
- **map_points_example.csv** — Example format for map import: `rpm, flow, pressure [, efficiency]`. One row per point; multiple RPM values produce multiple lines on the fan map.

No application code lives here; only import examples and runtime-generated assets.
