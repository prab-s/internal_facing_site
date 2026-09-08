import { getChartTheme } from './chartTheme.js';
import { buildFullChartOption } from './fullChart.js';
import { filterSeriesGraphPayload, seriesGraphFilterRanges } from './seriesGraphFilters.js';

const PUBLIC_BROWSER_GRAPH_RENDER_OPTIONS = {
  labelTextScale: 0.8,
  permissibleLabelOffset: { x: 0, y: 0 },
  grid: {
    left: '10%',
    right: '8%',
    top: '12%',
    bottom: '12%'
  }
};

const CURSOR_GRAPHIC_ID = 'cursor-point-marker';

function normalizeOption(_chart, nextOption) {
  return nextOption;
}

function optionHasCursorGraphic(nextOption) {
  return Boolean(
    nextOption &&
      typeof nextOption === 'object' &&
      Array.isArray(nextOption.graphic) &&
      nextOption.graphic.some((element) => String(element?.id ?? '') === CURSOR_GRAPHIC_ID)
  );
}

function flattenRpmPoints(rpmLines) {
  return (rpmLines || []).flatMap((line) =>
    (line.points || []).map((point) => ({
      id: point.id,
      airflow: point.airflow,
      pressure: point.pressure,
      rpm: line.rpm,
      rpm_line_id: line.id
    }))
  );
}

export function buildPublicProductGraphOption(payload, themeName) {
  const rpmLines = Array.isArray(payload?.rpmLines) ? payload.rpmLines : [];
  const efficiencyPoints = Array.isArray(payload?.efficiencyPoints) ? payload.efficiencyPoints : [];
  const rpmPoints = Array.isArray(payload?.rpmPoints) && payload.rpmPoints.length
    ? payload.rpmPoints
    : flattenRpmPoints(rpmLines);
  const chartTheme = getChartTheme(themeName);
  const graphMode = String(payload?.graphMode || '').trim().toLowerCase();
  const showRpmBandShading =
    graphMode === 'series'
      ? false
      : graphMode === 'product'
        ? true
        : payload?.showRpmBandShading !== false;

  return buildFullChartOption({
    rpmLines,
    rpmPoints,
    efficiencyPoints,
    chartTheme,
    title: String(payload?.graphTitle || payload?.productModel || 'Performance graph').trim(),
    graphConfig: payload?.graphConfig || null,
    graphMode,
    permissibleUseMode: payload?.permissibleUseMode || 'both',
    showRpmBandShading,
    clipRpmAreaToPermissibleUse: true,
    graphStyle: payload?.graphStyle ?? payload?.graphConfig ?? null,
    adaptGraphBackgroundToTheme: true,
    colorRpmLinesByBand: true,
    targetPoint: payload?.targetPoint || null,
    ...PUBLIC_BROWSER_GRAPH_RENDER_OPTIONS
  });
}

function attachPublicHoverTracking(chart, baseOption) {
  const zr = chart?.getZr?.();
  if (!zr) return;
  let cursorGraphicFrame = null;
  let pendingCursorGraphicCoords = null;
  let pendingCursorGraphicVisible = false;

  const buildCursorGraphicUpdate = (coords, visible) => {
    const graphic = Array.isArray(baseOption?.graphic) ? baseOption.graphic : null;
    if (!graphic) return null;
    if (!Array.isArray(coords)) return null;

    const [x, y] = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, coords);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    let changed = false;
    const nextGraphic = graphic.map((element) => {
      if (String(element?.id ?? '') !== CURSOR_GRAPHIC_ID) return element;
      changed = true;
      return {
        ...element,
        x,
        y: y + 2,
        invisible: !visible
      };
    });

    return changed ? { graphic: nextGraphic } : null;
  };

  const scheduleCursorGraphicUpdate = (coords, visible) => {
    if (!optionHasCursorGraphic(baseOption)) return;
    pendingCursorGraphicCoords = coords;
    pendingCursorGraphicVisible = visible;
    if (cursorGraphicFrame !== null) return;

    cursorGraphicFrame = window.requestAnimationFrame(() => {
      cursorGraphicFrame = null;
      const update = buildCursorGraphicUpdate(pendingCursorGraphicCoords, pendingCursorGraphicVisible);
      if (update) {
        chart.setOption(normalizeOption(chart, update), { notMerge: false, lazyUpdate: true });
      }
    });
  };

  const updateHoverCoords = (event) => {
    const x = Number(event?.offsetX);
    const y = Number(event?.offsetY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const coords = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [x, y]);
    if (Array.isArray(coords)) {
      window.__ECHARTS_HOVER_COORDS__ = { x: coords[0], y: coords[1] };
      scheduleCursorGraphicUpdate([coords[0], coords[1]], true);
      return;
    }

    if (coords && typeof coords === 'object') {
      const hoverCoords = {
        x: coords.x ?? coords[0],
        y: coords.y ?? coords[1]
      };
      window.__ECHARTS_HOVER_COORDS__ = hoverCoords;
      scheduleCursorGraphicUpdate([hoverCoords.x, hoverCoords.y], true);
    }
  };

  const clearHoverCoords = () => {
    window.__ECHARTS_HOVER_COORDS__ = null;
    scheduleCursorGraphicUpdate(null, false);
  };

  zr.on('mousemove', updateHoverCoords);
  zr.on('globalout', clearHoverCoords);
}

function raiseSolidLinesAboveDashedLines(option) {
  const series = Array.isArray(option?.series) ? option.series : [];
  for (const entry of series) {
    if (!entry || entry.type !== 'line') continue;
    const lineType = String(entry?.lineStyle?.type || '').trim().toLowerCase();
    const currentZ = Number.isFinite(Number(entry.z)) ? Number(entry.z) : 0;
    if (lineType === 'dashed') {
      entry.z = currentZ - 20;
    } else {
      entry.z = currentZ + 20;
    }
  }
}

export function renderPublicProductGraph({ host, payload, echarts, themeName }) {
  if (!host || !payload || !echarts) return null;

  const option = buildPublicProductGraphOption(payload, themeName);
  raiseSolidLinesAboveDashedLines(option);
  option.animation = false;
  option.grid = {
    ...(option.grid || {}),
    ...(PUBLIC_BROWSER_GRAPH_RENDER_OPTIONS.grid || {})
  };

  const chart = echarts.init(host, null, { renderer: 'canvas' });
  chart.setOption(normalizeOption(chart, option), { notMerge: true, lazyUpdate: false });
  window.__CUSTOMER_FACING_GRAPH_CHART__ = chart;
  attachPublicHoverTracking(chart, option);
  return chart;
}

function mountGraphWithControls({ host, payload, echarts, themeName }) {
  const controls = document.querySelector('[data-series-graph-controls]');
  if (!controls) return renderPublicProductGraph({ host, payload, echarts, themeName });

  const modeSelect = controls.querySelector('[data-series-line-mode]');
  const airflowSelect = controls.querySelector('[data-series-airflow]');
  const pressureSelect = controls.querySelector('[data-series-pressure]');
  const clearButton = controls.querySelector('[data-series-clear-filters]');
  const status = controls.querySelector('[data-series-filter-status]');
  const ranges = seriesGraphFilterRanges(payload);
  const storedTarget = window.CustomerFacingPerformanceTarget?.read?.() || {};
  if (airflowSelect && storedTarget.airflow != null) airflowSelect.value = storedTarget.airflow;
  if (pressureSelect && storedTarget.pressure != null) pressureSelect.value = storedTarget.pressure;
  if (airflowSelect) airflowSelect.placeholder = `${ranges.airflow.min ?? ''}–${ranges.airflow.max ?? ''}`;
  if (pressureSelect) pressureSelect.placeholder = `${ranges.pressure.min ?? ''}–${ranges.pressure.max ?? ''}`;

  let chart = null;
  const update = () => {
    const airflow = airflowSelect?.value || '';
    const pressure = pressureSelect?.value || '';
    const filteredPayload = String(payload.graphMode || '').toLowerCase() === 'series'
      ? filterSeriesGraphPayload(payload, modeSelect?.value || 'both', airflow, pressure)
      : { ...payload };
    filteredPayload.targetPoint = airflow !== '' && pressure !== ''
      ? { airflow: Number(airflow), pressure: Number(pressure) }
      : null;
    window.CustomerFacingPerformanceTarget?.write?.({
      airflow: airflow === '' ? null : Number(airflow),
      pressure: pressure === '' ? null : Number(pressure)
    });
    if (chart) chart.dispose();
    window.__CUSTOMER_FACING_GRAPH_CHART__ = null;
    host.replaceChildren();
    chart = filteredPayload?.rpmLines?.length
      ? renderPublicProductGraph({ host, payload: filteredPayload, echarts, themeName })
      : null;
    if (status) {
      status.textContent = chart
        ? `${filteredPayload.rpmLines.length} matching line${filteredPayload.rpmLines.length === 1 ? '' : 's'}`
        : 'No graph lines match the selected filters.';
    }
  };

  modeSelect?.addEventListener('change', update);
  airflowSelect?.addEventListener('input', update);
  pressureSelect?.addEventListener('input', update);
  clearButton?.addEventListener('click', () => {
    if (airflowSelect) airflowSelect.value = '';
    if (pressureSelect) pressureSelect.value = '';
    window.CustomerFacingPerformanceTarget?.write?.({ airflow: null, pressure: null });
    update();
  });
  window.addEventListener(window.CustomerFacingPerformanceTarget?.eventName || 'customer-facing-performance-target-change', (event) => {
    const target = event.detail || {};
    const nextAirflow = target.airflow ?? '';
    const nextPressure = target.pressure ?? '';
    const changed = airflowSelect?.value !== String(nextAirflow) || pressureSelect?.value !== String(nextPressure);
    if (airflowSelect && document.activeElement !== airflowSelect) airflowSelect.value = nextAirflow;
    if (pressureSelect && document.activeElement !== pressureSelect) pressureSelect.value = nextPressure;
    if (changed) update();
  });
  update();
}

function bootstrapPublicProductGraph() {
  const host = document.querySelector('[data-product-graph-host]');
  const payload = window.__PRODUCT_GRAPH_DATA__ || null;
  if (!host || !payload || !window.echarts) return;

  const themeName = document.documentElement.dataset.bsTheme === 'dark' ? 'dark' : 'light';
  if (document.querySelector('[data-series-graph-controls]')) {
    mountGraphWithControls({ host, payload, echarts: window.echarts, themeName });
  } else {
    const target = window.CustomerFacingPerformanceTarget?.read?.() || {};
    renderPublicProductGraph({
      host,
      payload: { ...payload, targetPoint: target.airflow != null && target.pressure != null ? target : null },
      echarts: window.echarts,
      themeName
    });
  }
}

bootstrapPublicProductGraph();
