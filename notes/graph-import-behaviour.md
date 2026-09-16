# Graph import and live preview

- Imports preserve all supplied points and decimal coordinates by default. Blank and `#N/A` values remain absent; malformed numeric values are rejected.
- Downsampling is optional. It retains original points, endpoints and points with the largest remaining interpolation error. The target must be an integer of at least two. Overlay peaks may add one point beyond the target.
- Automatic efficiency/permissible-use alignment is optional and off by default. It scales each overlay independently to the highest-RPM curve as displayed after RPM simplification.
- Editor options update the draft immediately. Saving commits the displayed draft.
- Changing options repeatedly recalculates from the same reference, avoiding cumulative scaling or point loss caused solely by toggling options.
- When the user manually changes the draft, that currently visible edited draft becomes the reference for subsequent option changes. In particular, editing an already simplified draft establishes that simplified draft as the new reference. Reimporting restores the uploaded data as the reference. Reference history is editor-session state, not a new database history feature.
- Editor and viewer use the same sampled curve contours, including the boundaries used by shaded regions. Moving one overlay handle horizontally does not move other lines sharing its former table row.
- Point tables show 100 rows per page. Rendering limits extra interpolated samples, uses binary searches for curve lookups, and batches drag updates by animation frame.

## Validation

Run from the repository root:

```
node --test frontend/tests/graph-import.test.js
python3 -m pytest tests/test_backend_graph_filters.py tests/test_graph_import_accuracy.py tests/test_customer_facing_series_graph.py -q
```

The Node tests exercise the actual editor functions and compare bulk/editor results. They cover reference changes, reversible options, decimals, missing values, narrow dips, overlay dragging, renderer consistency, all permissible-use modes, and dense rendering. The cross-language comparison requires the backend Python dependencies.

Synthetic checks include a 10,000-point chart option build and a headless ECharts render of six curves with 6,000 total points. These do not establish drag responsiveness on the client's browser or validate against their unavailable source CSV.

No migration or automatic rewriting of saved graphs is required.
