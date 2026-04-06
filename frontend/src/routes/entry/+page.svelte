<script>
  import { onMount, tick } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import {
    getFans,
    getFan,
    createFan,
    updateFan,
    getRpmLines,
    createRpmLine,
    deleteRpmLine,
    getRpmPoints,
    createRpmPoint,
    updateRpmPoint,
    deleteRpmPoint,
    getEfficiencyPoints,
    createEfficiencyPoint,
    updateEfficiencyPoint,
    deleteEfficiencyPoint,
    refreshGraphImage,
    uploadProductImages,
    reorderProductImages,
    deleteProductImage
  } from '$lib/api.js';
  import ECharts from '$lib/ECharts.svelte';
  import {
    DISCHARGE_TYPE_OPTIONS,
    MOUNTING_STYLE_OPTIONS,
    emptyFanForm,
    getChartTheme,
    theme
  } from '$lib/config.js';
  import { buildFullChartOption, FULL_CHART_LINE_DEFINITIONS } from '$lib/fullChart.js';

  let fans = [];
  let selectedFanId = null;
  let currentFan = null;
  let rpmLines = [];
  let rpmPoints = [];
  let efficiencyPoints = [];
  let mapChartOption = {};
  let loading = false;
  let error = '';
  let success = '';
  let productImages = [];
  let pendingImageFiles = [];
  let rpmPointSort = { column: null, direction: 'asc' };
  let chartAddTarget = '';
  let newRpmLineValue = '';
  let originalRpmPointIds = [];
  let originalEfficiencyPointIds = [];
  let nextTempPointId = -1;
  let savingMapPoints = false;
  let mapPointSaveProgress = {
    completed: 0,
    total: 0,
    label: ''
  };
  let mapPointSaveCompleted = 0;
  let mapPointSaveProgressMessage = '';
  let mapPointSaveRenderChain = Promise.resolve();

  let chartInstance = null;
  let draggingPoint = null;
  let dragAxisLock = null;
  
  // Mode: 'select' (initial), 'create', or 'editExisting'
  let mode = 'select';
  let editingFanId = null;

  // Form state: new/edit fan
  let fanForm = emptyFanForm();

  // Map point form (single)
  let rpmPointForm = {
    rpm_line_id: '',
    flow: '',
    pressure: ''
  };
  let efficiencyPointForm = {
    flow: '',
    efficiency_centre: '',
    efficiency_lower_end: '',
    efficiency_higher_end: '',
    permissible_use: ''
  };
  let rpmCsv = '';
  let rpmCsvError = '';
  let efficiencyCsv = '';
  let efficiencyCsvError = '';

  function parseOptionalNumber(value) {
    return value === '' || value == null ? null : parseFloat(value);
  }

  function createTempPointId() {
    const nextId = nextTempPointId;
    nextTempPointId -= 1;
    return nextId;
  }

  function isPersistedPointId(id) {
    return typeof id === 'number' && id > 0;
  }

  function resetMapPointSaveProgress() {
    mapPointSaveCompleted = 0;
    mapPointSaveProgressMessage = '';
    mapPointSaveRenderChain = Promise.resolve();
    mapPointSaveProgress = {
      completed: 0,
      total: 0,
      label: ''
    };
  }

  async function waitForProgressPaint() {
    await tick();
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function beginMapPointSave(total) {
    savingMapPoints = true;
    mapPointSaveCompleted = 0;
    mapPointSaveProgress = {
      completed: 0,
      total,
      label: total ? 'Preparing changes...' : 'No changes to save.'
    };
    mapPointSaveProgressMessage = total ? 'Saving map points: 0 / ' + total + ' - Preparing changes...' : '';
    await waitForProgressPaint();
  }

  async function advanceMapPointSave(label) {
    mapPointSaveCompleted = Math.min(mapPointSaveCompleted + 1, mapPointSaveProgress.total);
    const nextCompleted = mapPointSaveCompleted;
    const nextTotal = mapPointSaveProgress.total;
    const nextLabel = label;

    mapPointSaveRenderChain = mapPointSaveRenderChain.then(async () => {
      mapPointSaveProgress = {
        ...mapPointSaveProgress,
        completed: nextCompleted,
        label: nextLabel
      };
      mapPointSaveProgressMessage = `Saving map points: ${nextCompleted} / ${nextTotal}${nextLabel ? ` - ${nextLabel}` : ''}`;
      await waitForProgressPaint();
    });

    await mapPointSaveRenderChain;
  }

  async function processBatchedOperations(operations, concurrency = 12) {
    if (!operations.length) return;

    let nextIndex = 0;

    async function worker() {
      while (nextIndex < operations.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const operation = operations[currentIndex];
        await operation.run();
        await advanceMapPointSave(operation.label);
      }
    }

    const workerCount = Math.min(concurrency, operations.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  function finishMapPointSave() {
    savingMapPoints = false;
  }

  function compareMapPointValues(a, b, column, direction) {
    const aValue = parseOptionalNumber(a?.[column]);
    const bValue = parseOptionalNumber(b?.[column]);
    const aNumber = aValue ?? Number.NEGATIVE_INFINITY;
    const bNumber = bValue ?? Number.NEGATIVE_INFINITY;
    return direction === 'asc' ? aNumber - bNumber : bNumber - aNumber;
  }

  function applyRpmPointSort(points) {
    if (!rpmPointSort.column) return points;
    return [...points].sort((a, b) => compareMapPointValues(a, b, rpmPointSort.column, rpmPointSort.direction));
  }

  function toggleRpmPointSort(column) {
    if (rpmPointSort.column === column) {
      rpmPointSort = {
        column,
        direction: rpmPointSort.direction === 'asc' ? 'desc' : 'asc'
      };
    } else {
      rpmPointSort = { column, direction: 'asc' };
    }
    rpmPoints = applyRpmPointSort(rpmPoints);
  }

  function sortIndicator(column) {
    if (rpmPointSort.column !== column) return 'Sort';
    return rpmPointSort.direction === 'asc' ? 'Asc' : 'Desc';
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvRows(text) {
    return text
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split(',').map((cell) => cell.trim()));
  }

  function buildRpmPointsCsv() {
    const header = ['rpm', 'flow', 'pressure'];
    const rows = rpmPoints.map((point) => [point.rpm ?? '', point.flow ?? '', point.pressure ?? ''].join(','));
    return [header.join(','), ...rows].join('\n');
  }

  function buildEfficiencyPointsCsv() {
    const header = ['flow', 'efficiency_centre', 'efficiency_lower_end', 'efficiency_higher_end', 'permissible_use'];
    const rows = efficiencyPoints.map((point) =>
      [
        point.flow ?? '',
        point.efficiency_centre ?? '',
        point.efficiency_lower_end ?? '',
        point.efficiency_higher_end ?? '',
        point.permissible_use ?? ''
      ].join(',')
    );
    return [header.join(','), ...rows].join('\n');
  }

  onMount(() => {
    function handleBeforeUnload(event) {
      if (!savingMapPoints) return;
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  beforeNavigate((navigation) => {
    if (!savingMapPoints) return;
    navigation.cancel();
    window.alert('Map points are still being saved. Please wait until the save finishes before leaving this page.');
  });

  function exportRpmPointsCsv() {
    if (!rpmPoints.length) {
      error = 'No RPM points to export.';
      return;
    }
    const base = currentFan ? `${currentFan.manufacturer}-${currentFan.model}`.replace(/\s+/g, '_') : 'fan';
    downloadCsv(buildRpmPointsCsv(), `${base}-rpm-points.csv`);
  }

  function exportEfficiencyPointsCsv() {
    if (!efficiencyPoints.length) {
      error = 'No efficiency/permissible points to export.';
      return;
    }
    const base = currentFan ? `${currentFan.manufacturer}-${currentFan.model}`.replace(/\s+/g, '_') : 'fan';
    downloadCsv(buildEfficiencyPointsCsv(), `${base}-efficiency-points.csv`);
  }

  async function importRpmPointsFromCsv() {
    rpmCsvError = '';
    if (!selectedFanId) {
      rpmCsvError = 'Select a fan first.';
      return;
    }
    const rows = parseCsvRows(rpmCsv);
    if (!rows.length) {
      rpmCsvError = 'Paste RPM CSV data first. Format: rpm, flow, pressure';
      return;
    }

    try {
      const existingLines = new Map(rpmLines.map((line) => [Number(line.rpm), line]));
      for (const row of rows) {
        if (row[0]?.toLowerCase() === 'rpm') continue;
        const rpm = parseFloat(row[0]);
        const flow = parseFloat(row[1]);
        const pressure = parseFloat(row[2]);
        if (isNaN(rpm) || isNaN(flow) || isNaN(pressure)) continue;

        let line = existingLines.get(rpm);
        if (!line) {
          line = await createRpmLine(selectedFanId, { rpm });
          existingLines.set(rpm, line);
        }

        await createRpmPoint(selectedFanId, {
          rpm_line_id: line.id,
          flow,
          pressure
        });
      }
      rpmCsv = '';
      await loadPoints();
      success = 'RPM CSV imported.';
    } catch (e) {
      rpmCsvError = e.message;
    }
  }

  async function importEfficiencyPointsFromCsv() {
    efficiencyCsvError = '';
    if (!selectedFanId) {
      efficiencyCsvError = 'Select a fan first.';
      return;
    }
    const rows = parseCsvRows(efficiencyCsv);
    if (!rows.length) {
      efficiencyCsvError = 'Paste efficiency CSV data first. Format: flow, efficiency_centre, efficiency_lower_end, efficiency_higher_end, permissible_use';
      return;
    }

    try {
      for (const row of rows) {
        if (row[0]?.toLowerCase() === 'flow') continue;
        const flow = parseFloat(row[0]);
        if (isNaN(flow)) continue;
        await createEfficiencyPoint(selectedFanId, {
          flow,
          efficiency_centre: parseOptionalNumber(row[1]),
          efficiency_lower_end: parseOptionalNumber(row[2]),
          efficiency_higher_end: parseOptionalNumber(row[3]),
          permissible_use: parseOptionalNumber(row[4])
        });
      }
      efficiencyCsv = '';
      await loadPoints();
      success = 'Efficiency/permissible CSV imported.';
    } catch (e) {
      efficiencyCsvError = e.message;
    }
  }

  async function loadFans() {
    try {
      fans = await getFans();
      if (fans.length && !selectedFanId) selectedFanId = fans[0].id;
    } catch (e) {
      error = e.message;
    }
  }

  async function loadPoints() {
    if (!selectedFanId) return;
    try {
      const [nextRpmLines, nextRpmPoints, nextEfficiencyPoints, nextFan] = await Promise.all([
        getRpmLines(selectedFanId),
        getRpmPoints(selectedFanId),
        getEfficiencyPoints(selectedFanId),
        getFan(selectedFanId)
      ]);
      rpmLines = nextRpmLines;
      rpmPoints = applyRpmPointSort(nextRpmPoints);
      efficiencyPoints = nextEfficiencyPoints;
      originalRpmPointIds = nextRpmPoints.map((point) => point.id);
      originalEfficiencyPointIds = nextEfficiencyPoints.map((point) => point.id);
      currentFan = nextFan;
      productImages = currentFan.product_images || [];
      const validTargets = new Set([
        ...nextRpmLines.map((line) => `rpm:${line.id}`),
        ...FULL_CHART_LINE_DEFINITIONS.map((definition) => `efficiency:${definition.key}`)
      ]);
      if (!chartAddTarget || !validTargets.has(chartAddTarget)) {
        chartAddTarget = 'off';
      }
      if (!rpmPointForm.rpm_line_id && nextRpmLines.length) {
        rpmPointForm = { ...rpmPointForm, rpm_line_id: String(nextRpmLines[0].id) };
      }
    } catch (e) {
      error = e.message;
    }
  }

  $: if (selectedFanId) {
    loadPoints();
  }

  loadFans();

  async function saveFan() {
    error = '';
    success = '';
    const body = {
      manufacturer: fanForm.manufacturer.trim(),
      model: fanForm.model.trim(),
      notes: fanForm.notes.trim() || null,
      mounting_style: fanForm.mounting_style || null,
      discharge_type: fanForm.discharge_type || null,
      show_rpm_band_shading: !!fanForm.show_rpm_band_shading,
      diameter_mm: fanForm.diameter_mm ? parseFloat(fanForm.diameter_mm) : null,
      max_rpm: fanForm.max_rpm ? parseFloat(fanForm.max_rpm) : null
    };
    if (!body.manufacturer || !body.model) {
      error = 'Manufacturer and model are required.';
      return;
    }
    loading = true;
    try {
      if (editingFanId) {
        currentFan = await updateFan(editingFanId, body);
        success = 'Fan updated.';
      } else {
        const created = await createFan(body);
        currentFan = created;
        success = 'Fan created. You can now upload product images and add map points.';
        selectedFanId = created.id;
        editingFanId = created.id;
        mode = 'editExisting';
      }
      fans = await getFans();
      await loadPoints();
      if (currentFan) editFan(currentFan);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function editFan(fan) {
    editingFanId = fan.id;
    fanForm = {
      manufacturer: fan.manufacturer,
      model: fan.model,
      notes: fan.notes || '',
      mounting_style: fan.mounting_style || '',
      discharge_type: fan.discharge_type || '',
      show_rpm_band_shading: fan.show_rpm_band_shading ?? true,
      diameter_mm: fan.diameter_mm ?? '',
      max_rpm: fan.max_rpm ?? ''
    };
  }

  async function addRpmLine() {
    const rpm = parseFloat(newRpmLineValue);
    if (isNaN(rpm) || !selectedFanId) {
      error = 'Enter a numeric RPM value and select a fan first.';
      return;
    }
    try {
      const created = await createRpmLine(selectedFanId, { rpm });
      newRpmLineValue = '';
      await loadPoints();
      chartAddTarget = `rpm:${created.id}`;
      success = 'RPM line added.';
    } catch (e) {
      error = e.message;
    }
  }

  async function removeRpmLine(line) {
    try {
      await deleteRpmLine(selectedFanId, line.id);
      await loadPoints();
      success = 'RPM line deleted.';
    } catch (e) {
      error = e.message;
    }
  }

  async function addRpmPointFromForm() {
    const rpm_line_id = Number(rpmPointForm.rpm_line_id);
    const flow = parseFloat(rpmPointForm.flow);
    const pressure = parseFloat(rpmPointForm.pressure);
    if (!selectedFanId || !rpm_line_id || isNaN(flow) || isNaN(pressure)) {
      error = 'Select an RPM line and enter numeric flow and pressure values.';
      return;
    }
    rpmPoints = applyRpmPointSort([
      ...rpmPoints,
      {
        id: createTempPointId(),
        fan_id: selectedFanId,
        rpm_line_id,
        rpm: rpmLines.find((line) => line.id === rpm_line_id)?.rpm ?? null,
        flow,
        pressure
      }
    ]);
    rpmPointForm = { rpm_line_id: rpmPointForm.rpm_line_id, flow: '', pressure: '' };
    success = 'RPM point added locally. Save map points to persist it.';
  }

  async function addEfficiencyPointFromForm() {
    const flow = parseFloat(efficiencyPointForm.flow);
    if (!selectedFanId || isNaN(flow)) {
      error = 'Enter a numeric flow value for the efficiency point.';
      return;
    }
    efficiencyPoints = [
      ...efficiencyPoints,
      {
        id: createTempPointId(),
        fan_id: selectedFanId,
        flow,
        efficiency_centre: parseOptionalNumber(efficiencyPointForm.efficiency_centre),
        efficiency_lower_end: parseOptionalNumber(efficiencyPointForm.efficiency_lower_end),
        efficiency_higher_end: parseOptionalNumber(efficiencyPointForm.efficiency_higher_end),
        permissible_use: parseOptionalNumber(efficiencyPointForm.permissible_use)
      }
    ];
    efficiencyPointForm = {
      flow: '',
      efficiency_centre: '',
      efficiency_lower_end: '',
      efficiency_higher_end: '',
      permissible_use: ''
    };
    success = 'Efficiency/permissible point added locally. Save map points to persist it.';
  }

  async function uploadImages() {
    if (!selectedFanId) {
      error = 'Save the fan before uploading product images.';
      return;
    }
    if (!pendingImageFiles.length) {
      error = 'Choose one or more image files first.';
      return;
    }
    try {
      productImages = await uploadProductImages(selectedFanId, pendingImageFiles);
      pendingImageFiles = [];
      await loadPoints();
      fans = await getFans();
      success = 'Product images uploaded.';
    } catch (e) {
      error = e.message;
    }
  }

  async function moveProductImage(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= productImages.length) return;
    const reordered = [...productImages];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      productImages = await reorderProductImages(selectedFanId, reordered.map((image) => image.id));
      await loadPoints();
      fans = await getFans();
      success = 'Product image order updated.';
    } catch (e) {
      error = e.message;
    }
  }

  async function removeProductImage(image) {
    try {
      await deleteProductImage(selectedFanId, image.id);
      await loadPoints();
      fans = await getFans();
      success = 'Product image deleted.';
    } catch (e) {
      error = e.message;
    }
  }

  function buildMapChartOption() {
    const chartTheme = getChartTheme($theme);
    mapChartOption = buildFullChartOption({
      rpmLines,
      rpmPoints,
      efficiencyPoints,
      chartTheme,
      title: 'Map points (drag points to edit)',
      includeDragHandles: true,
      showRpmBandShading: fanForm.show_rpm_band_shading ?? true,
      flowAxisMaxOverride: dragAxisLock?.flowMax ?? null,
      pressureAxisMaxOverride: dragAxisLock?.pressureMax ?? null,
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const rawValue = Array.isArray(params.value) ? params.value : params.value?.value;
          const [flow, second] = rawValue || [];
          const matchingDefinition = FULL_CHART_LINE_DEFINITIONS.find((definition) => definition.label === params.seriesName);

          if (matchingDefinition) {
            return `${matchingDefinition.tooltipLabel}: ${second}<br/>flow: ${flow}`;
          }

          return `${params.seriesName}<br/>flow: ${flow}<br/>pressure: ${second}`;
        }
      }
    });
  }

  function handleMapChartDragEnd(params) {
    const data = params.data;
    const value = params.value || (data && data.value);
    const id = data?.id;
    if (!id || !value || !Array.isArray(value)) return;

    const [x, y] = value;
    const flow = Math.round(x);
    const target = data?.pointType === 'efficiency'
      ? efficiencyPoints.find((p) => p.id === id)
      : rpmPoints.find((p) => p.id === id);
    if (!target) return;

    if (data?.pointType === 'efficiency') {
      const overlayDefinition = FULL_CHART_LINE_DEFINITIONS.find((definition) => definition.label === params.seriesName);
      const lineKey = overlayDefinition?.key ?? null;
      const updated = {
        ...target,
        flow,
        ...(lineKey ? { [lineKey]: Math.round(y) } : {})
      };
      efficiencyPoints = efficiencyPoints.map((p) => (p.id === id ? updated : p));
      return;
    }

    const updated = { ...target, flow, pressure: Math.round(y) };
    rpmPoints = rpmPoints.map((p) => (p.id === id ? updated : p));
  }

  let chartDragAttached = false;

  function setupChartDrag() {
    if (chartDragAttached || !chartInstance) return;
    chartDragAttached = true;

    const zr = chartInstance.getZr();
    if (!zr) return;
    let dragMoved = false;
    let suppressNextClick = false;

    function getEventXY(evt) {
      const dom = evt.event || evt;
      return { x: dom.offsetX ?? dom.clientX, y: dom.offsetY ?? dom.clientY };
    }

    function lockCurrentAxisExtents() {
      const currentOption = chartInstance?.getOption?.();
      const xAxis = Array.isArray(currentOption?.xAxis) ? currentOption.xAxis[0] : currentOption?.xAxis;
      const yAxis = Array.isArray(currentOption?.yAxis) ? currentOption.yAxis[0] : currentOption?.yAxis;
      dragAxisLock = {
        flowMax: Array.isArray(xAxis?.max) ? xAxis.max[0] : xAxis?.max ?? null,
        pressureMax: Array.isArray(yAxis?.max) ? yAxis.max[0] : yAxis?.max ?? null
      };
    }

    function pickClosestPoint({ x, y }) {
      const threshold = 14;
      let best = null;
      let bestDist = Infinity;

      for (const p of rpmPoints) {
        if (p.flow == null || p.pressure == null) continue;
        const pressurePixel = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.flow, p.pressure]);
        const dx = pressurePixel[0] - x;
        const dy = pressurePixel[1] - y;
        const d = Math.hypot(dx, dy);
        if (d < bestDist && d <= threshold) {
          bestDist = d;
          best = { id: p.id, pointType: 'rpm' };
        }
      }

      for (const p of efficiencyPoints) {
        for (const definition of FULL_CHART_LINE_DEFINITIONS) {
          if (p[definition.key] == null) continue;
          const overlayPixel = chartInstance.convertToPixel(
            { xAxisIndex: 0, yAxisIndex: 1 },
            [p.flow, p[definition.key]]
          );
          const dx2 = overlayPixel[0] - x;
          const dy2 = overlayPixel[1] - y;
          const d2 = Math.hypot(dx2, dy2);
          if (d2 < bestDist && d2 <= threshold) {
            bestDist = d2;
            best = { id: p.id, pointType: 'efficiency', lineKey: definition.key };
          }
        }
      }

      return best;
    }

    function updateDraggedPoint(point, pixel) {
      if (!point) return;
      const axisIndex = point.pointType === 'efficiency' ? 1 : 0;
      const [flow, value] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: axisIndex }, [pixel.x, pixel.y]);
      if (point.pointType === 'efficiency') {
        const updated = {
          ...efficiencyPoints.find((p) => p.id === point.id),
          flow: Math.round(flow),
          ...(point.lineKey ? { [point.lineKey]: Math.round(value) } : {})
        };
        efficiencyPoints = efficiencyPoints.map((p) => (p.id === point.id ? updated : p));
        return;
      }
      const updated = {
        ...rpmPoints.find((p) => p.id === point.id),
        flow: Math.round(flow),
        pressure: Math.round(value)
      };
      rpmPoints = rpmPoints.map((p) => (p.id === point.id ? updated : p));
    }

    async function handleChartClick(evt) {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      const dom = evt.event || evt;
      if (!selectedFanId) return;
      const { x, y } = getEventXY(evt);

      if (!chartAddTarget || chartAddTarget === 'off') return;

      if (chartAddTarget.startsWith('rpm:')) {
        const rpm_line_id = Number(chartAddTarget.split(':')[1]);
        const [flow, pressure] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [x, y]);
        rpmPoints = applyRpmPointSort([
          ...rpmPoints,
          {
            id: createTempPointId(),
            fan_id: selectedFanId,
            rpm_line_id,
            rpm: rpmLines.find((line) => line.id === rpm_line_id)?.rpm ?? null,
            flow: Math.round(flow),
            pressure: Math.round(pressure)
          }
        ]);
        success = 'Point added locally from chart. Save map points to persist it.';
        return;
      }

      if (chartAddTarget.startsWith('efficiency:')) {
        const lineKey = chartAddTarget.split(':')[1];
        const [flow, value] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 1 }, [x, y]);
        efficiencyPoints = [
          ...efficiencyPoints,
          {
            id: createTempPointId(),
            fan_id: selectedFanId,
            flow: Math.round(flow),
            efficiency_centre: lineKey === 'efficiency_centre' ? Math.round(value) : null,
            efficiency_lower_end: lineKey === 'efficiency_lower_end' ? Math.round(value) : null,
            efficiency_higher_end: lineKey === 'efficiency_higher_end' ? Math.round(value) : null,
            permissible_use: lineKey === 'permissible_use' ? Math.round(value) : null
          }
        ];
        success = 'Point added locally from chart. Save map points to persist it.';
      }
    }

    zr.on('mousedown', (evt) => {
      const dom = evt.event || evt;
      const mouse = getEventXY(evt);
      const found = pickClosestPoint(mouse);

      if (dom.shiftKey && (dom.button ?? 0) === 0) {
        if (!chartAddTarget || chartAddTarget === 'off') return;
        if (!found) return;

        if (found.pointType === 'efficiency') {
          efficiencyPoints = efficiencyPoints.filter((point) => point.id !== found.id);
        } else {
          rpmPoints = rpmPoints.filter((point) => point.id !== found.id);
        }

        suppressNextClick = true;
        dragMoved = false;
        draggingPoint = null;
        success = 'Point deleted locally from chart. Save map points to persist it.';
        return;
      }

      if (dom.shiftKey) return;
      if (found) {
        lockCurrentAxisExtents();
        draggingPoint = found;
        dragMoved = false;
      }
    });

    zr.on('mousemove', (evt) => {
      if (!draggingPoint) return;
      dragMoved = true;
      const mouse = getEventXY(evt);
      updateDraggedPoint(draggingPoint, mouse);
    });

    zr.on('mouseup', () => {
      if (draggingPoint) {
        draggingPoint = null;
        dragAxisLock = null;
      }
    });
    zr.on('click', handleChartClick);
  }

  $: {
    rpmLines;
    rpmPoints;
    efficiencyPoints;
    $theme;
    dragAxisLock;
    buildMapChartOption();
  }

  async function updateRpmPointLocal(point) {
    try {
      await updateRpmPoint(selectedFanId, point.id, {
        rpm_line_id: Number(point.rpm_line_id),
        flow: parseFloat(point.flow),
        pressure: parseFloat(point.pressure)
      });
      await loadPoints();
      success = 'RPM point updated.';
    } catch (e) {
      error = e.message;
    }
  }

  async function updateEfficiencyPointLocal(point) {
    try {
      await updateEfficiencyPoint(selectedFanId, point.id, {
        flow: parseFloat(point.flow),
        efficiency_centre: parseOptionalNumber(point.efficiency_centre),
        efficiency_lower_end: parseOptionalNumber(point.efficiency_lower_end),
        efficiency_higher_end: parseOptionalNumber(point.efficiency_higher_end),
        permissible_use: parseOptionalNumber(point.permissible_use)
      });
      await loadPoints();
      success = 'Efficiency/permissible point updated.';
    } catch (e) {
      error = e.message;
    }
  }

  async function saveMapPoints() {
    error = '';
    success = '';
    if (savingMapPoints) return;
    try {
      const currentRpmIds = new Set(rpmPoints.filter((point) => isPersistedPointId(point.id)).map((point) => point.id));
      const currentEfficiencyIds = new Set(
        efficiencyPoints.filter((point) => isPersistedPointId(point.id)).map((point) => point.id)
      );
      const rpmDeletes = originalRpmPointIds.filter((pointId) => !currentRpmIds.has(pointId));
      const efficiencyDeletes = originalEfficiencyPointIds.filter((pointId) => !currentEfficiencyIds.has(pointId));
      const totalOperations =
        rpmDeletes.length +
        rpmPoints.length +
        efficiencyDeletes.length +
        efficiencyPoints.length +
        1;

      const rpmDeleteOperations = rpmDeletes.map((pointId) => ({
        label: `Deleted RPM point ${pointId}`,
        run: () => deleteRpmPoint(selectedFanId, pointId, { regenerateGraph: false })
      }));

      const rpmSaveOperations = rpmPoints.map((p) => ({
        label: isPersistedPointId(p.id) ? `Updated RPM point ${p.id}` : 'Created new RPM point',
        run: () =>
          isPersistedPointId(p.id)
            ? updateRpmPoint(
                selectedFanId,
                p.id,
                {
                  rpm_line_id: Number(p.rpm_line_id),
                  flow: parseFloat(p.flow),
                  pressure: parseFloat(p.pressure)
                },
                { regenerateGraph: false }
              )
            : createRpmPoint(
                selectedFanId,
                {
                  rpm_line_id: Number(p.rpm_line_id),
                  flow: parseFloat(p.flow),
                  pressure: parseFloat(p.pressure)
                },
                { regenerateGraph: false }
              )
      }));

      const efficiencyDeleteOperations = efficiencyDeletes.map((pointId) => ({
        label: `Deleted efficiency point ${pointId}`,
        run: () => deleteEfficiencyPoint(selectedFanId, pointId, { regenerateGraph: false })
      }));

      const efficiencySaveOperations = efficiencyPoints.map((p) => ({
        label: isPersistedPointId(p.id) ? `Updated efficiency point ${p.id}` : 'Created new efficiency point',
        run: () =>
          isPersistedPointId(p.id)
            ? updateEfficiencyPoint(
                selectedFanId,
                p.id,
                {
                  flow: parseFloat(p.flow),
                  efficiency_centre: parseOptionalNumber(p.efficiency_centre),
                  efficiency_lower_end: parseOptionalNumber(p.efficiency_lower_end),
                  efficiency_higher_end: parseOptionalNumber(p.efficiency_higher_end),
                  permissible_use: parseOptionalNumber(p.permissible_use)
                },
                { regenerateGraph: false }
              )
            : createEfficiencyPoint(
                selectedFanId,
                {
                  flow: parseFloat(p.flow),
                  efficiency_centre: parseOptionalNumber(p.efficiency_centre),
                  efficiency_lower_end: parseOptionalNumber(p.efficiency_lower_end),
                  efficiency_higher_end: parseOptionalNumber(p.efficiency_higher_end),
                  permissible_use: parseOptionalNumber(p.permissible_use)
                },
                { regenerateGraph: false }
              )
      }));
      const pointOperations = [
        ...rpmDeleteOperations,
        ...rpmSaveOperations,
        ...efficiencyDeleteOperations,
        ...efficiencySaveOperations
      ];

      await beginMapPointSave(totalOperations);

      await processBatchedOperations(pointOperations);

      await refreshGraphImage(selectedFanId);
      await advanceMapPointSave('Regenerated graph image');
      await loadPoints();
      success = 'All map points saved.';
    } catch (e) {
      error = e.message;
    } finally {
      finishMapPointSave();
    }
  }

  async function deleteRpmPointLocal(point) {
    rpmPoints = rpmPoints.filter((item) => item.id !== point.id);
    success = 'RPM point deleted locally. Save map points to persist it.';
  }

  async function deleteEfficiencyPointLocal(point) {
    efficiencyPoints = efficiencyPoints.filter((item) => item.id !== point.id);
    success = 'Efficiency/permissible point deleted locally. Save map points to persist it.';
  }
</script>

<svelte:head>
  <title>Data entry — Fan Graphs</title>
</svelte:head>

<div class="mb-3">
  <div class="col-12 col-xxl-8">
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Create & Maintain</p>
    <h1>Data entry</h1>
    <p class="text-body-secondary">
      Manage fan records, product images, RPM lines, and all editable map data from a single workspace.
    </p>
    {#if error}
      <p class="text-danger mb-2">{error}</p>
    {/if}
    {#if success}
      <p class="text-success mb-0">{success}</p>
    {/if}
  </div>
</div>

{#if mode === 'select'}
  <div class="card shadow-sm col-12 col-xl-8 mx-auto">
    <div class="card-body">
    <h2 class="h5">Get Started</h2>
    <p>What would you like to do?</p>
    <div class="d-flex flex-wrap gap-2">
      <button class="btn btn-primary" on:click={() => { mode = 'create'; fanForm = emptyFanForm(); }}>
        Create New Fan
      </button>
      <button class="btn btn-outline-secondary" on:click={() => { mode = 'editExisting'; }}>
        Edit Existing Fan
      </button>
    </div>
    </div>
  </div>
{/if}

{#if mode === 'create'}
  <div class="card shadow-sm col-12 col-xxl-10 mx-auto">
    <div class="card-body">
    <h2 class="h5">Create New Fan</h2>
    <div class="row g-3">
      <div class="col-12 col-lg-6">
      <div class="card shadow-sm h-100">
        <div class="card-body">
        <h3 class="h6">Core details</h3>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-manufacturer">Manufacturer</label>
            <input class="form-control" id="create-manufacturer" type="text" bind:value={fanForm.manufacturer} placeholder="e.g. Acme" />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-model">Model</label>
            <input class="form-control" id="create-model" type="text" bind:value={fanForm.model} placeholder="e.g. AF-120" />
          </div>
          <div class="col-12">
            <label class="form-label" for="create-notes">Notes (optional)</label>
            <textarea class="form-control" id="create-notes" bind:value={fanForm.notes} rows="2"></textarea>
          </div>
        </div>
        </div>
      </div>
      </div>

      <div class="col-12 col-lg-6">
      <div class="card shadow-sm h-100">
        <div class="card-body">
        <h3 class="h6">Product attributes</h3>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-mounting-style">Mounting Style (optional)</label>
            <select class="form-select" id="create-mounting-style" bind:value={fanForm.mounting_style}>
              <option value="">Any / unset</option>
              {#each MOUNTING_STYLE_OPTIONS as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-discharge-type">Discharge Type (optional)</label>
            <select class="form-select" id="create-discharge-type" bind:value={fanForm.discharge_type}>
              <option value="">Any / unset</option>
              {#each DISCHARGE_TYPE_OPTIONS as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-diameter">Diameter (mm, optional)</label>
            <input class="form-control" id="create-diameter" type="number" step="any" bind:value={fanForm.diameter_mm} />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-max-rpm">Max RPM (optional)</label>
            <input class="form-control" id="create-max-rpm" type="number" step="any" bind:value={fanForm.max_rpm} />
          </div>
          <div class="col-12">
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" id="create-show-rpm-band-shading" type="checkbox" bind:checked={fanForm.show_rpm_band_shading} />
              <label class="form-check-label" for="create-show-rpm-band-shading">Show RPM band shading on fan maps and graph images</label>
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>
    <p class="text-body-secondary mt-3 mb-2">Save the fan first, then you can upload product images and manage the generated graph file.</p>
    <div class="d-flex flex-wrap gap-2">
      <button class="btn btn-primary" on:click={saveFan} disabled={loading}>Save Fan</button>
      <button class="btn btn-outline-secondary" on:click={() => { mode = 'select'; fanForm = emptyFanForm(); }}>Cancel</button>
    </div>
    </div>
  </div>
{/if}

{#if mode === 'editExisting' && editingFanId === null}
  <div class="card shadow-sm col-12 col-xl-8 mx-auto">
    <div class="card-body">
    <h2 class="h5">Select Fan to Edit</h2>
    <div class="mb-3 col-md-6 col-lg-4">
      <label class="form-label" for="edit-fan-select">Select a fan</label>
      <select class="form-select" id="edit-fan-select" bind:value={selectedFanId}>
        <option value={null}>— Select —</option>
        {#each fans as fan}
          <option value={fan.id}>{fan.manufacturer} {fan.model}</option>
        {/each}
      </select>
    </div>
    <div class="d-flex flex-wrap gap-2">
      <button
        class="btn btn-primary"
        on:click={() => {
          if (currentFan) {
            editFan(currentFan);
            editingFanId = currentFan.id;
          }
        }}
        disabled={!selectedFanId}
      >
        Edit Selected Fan
      </button>
      <button class="btn btn-outline-secondary" on:click={() => { mode = 'select'; selectedFanId = null; }}>Cancel</button>
    </div>
    </div>
  </div>
{/if}

{#if mode === 'editExisting' && editingFanId !== null}
  <div class="card shadow-sm">
    <div class="card-body">
    <h2 class="h5">Edit Fan: {fanForm.manufacturer} {fanForm.model}</h2>
    <div class="row g-3">
      <div class="col-12 col-xxl-6">
      <div class="vstack gap-3">
        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">Fan details</h3>
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-manufacturer">Manufacturer</label>
              <input class="form-control" id="edit-manufacturer" type="text" bind:value={fanForm.manufacturer} />
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-model">Model</label>
              <input class="form-control" id="edit-model" type="text" bind:value={fanForm.model} />
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-mounting-style">Mounting Style (optional)</label>
              <select class="form-select" id="edit-mounting-style" bind:value={fanForm.mounting_style}>
                <option value="">Any / unset</option>
                {#each MOUNTING_STYLE_OPTIONS as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-discharge-type">Discharge Type (optional)</label>
              <select class="form-select" id="edit-discharge-type" bind:value={fanForm.discharge_type}>
                <option value="">Any / unset</option>
                {#each DISCHARGE_TYPE_OPTIONS as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-diameter">Diameter (mm, optional)</label>
              <input class="form-control" id="edit-diameter" type="number" step="any" bind:value={fanForm.diameter_mm} />
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-max-rpm">Max RPM (optional)</label>
              <input class="form-control" id="edit-max-rpm" type="number" step="any" bind:value={fanForm.max_rpm} />
            </div>
            <div class="col-12">
              <div class="form-check form-switch mt-2">
                <input class="form-check-input" id="edit-show-rpm-band-shading" type="checkbox" bind:checked={fanForm.show_rpm_band_shading} />
                <label class="form-check-label" for="edit-show-rpm-band-shading">Show RPM band shading on fan maps and graph images</label>
              </div>
            </div>
            <div class="col-12">
              <label class="form-label" for="edit-notes">Notes (optional)</label>
              <textarea class="form-control" id="edit-notes" bind:value={fanForm.notes} rows="2"></textarea>
            </div>
          </div>
          </div>
        </div>

        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">Product images</h3>
          <p class="text-body-secondary">Upload multiple images, reorder them, and the first image becomes the primary catalogue thumbnail.</p>
          <div class="mb-3">
              <label class="form-label" for="edit-product-images">Select image files</label>
              <input
                class="form-control"
                id="edit-product-images"
                type="file"
                accept="image/*"
                multiple
                on:change={(event) => { pendingImageFiles = Array.from(event.currentTarget.files || []); }}
              />
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-primary" on:click={uploadImages} disabled={pendingImageFiles.length === 0}>Upload Selected Images</button>
            {#if currentFan?.graph_image_url}
              <a href={currentFan.graph_image_url} download class="btn btn-outline-secondary">Download Current Graph</a>
            {/if}
          </div>
          </div>
        </div>
      </div>
      </div>

      <div class="col-12 col-xxl-6">
      <div class="vstack gap-3">
        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">RPM line management</h3>
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-8">
              <label class="form-label" for="new-rpm-line">New RPM line</label>
              <input class="form-control" id="new-rpm-line" type="number" step="any" bind:value={newRpmLineValue} />
            </div>
            <div class="col-12 col-md-4">
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-primary" on:click={addRpmLine}>Add RPM Line</button>
              </div>
            </div>
          </div>
          {#if rpmLines.length > 0}
            <div class="d-flex flex-wrap gap-2 mt-3">
              {#each rpmLines as line}
                <button class="btn btn-outline-secondary" on:click={() => removeRpmLine(line)}>Delete {line.rpm} RPM</button>
              {/each}
            </div>
          {:else}
            <p class="text-body-secondary mt-3 mb-0">No RPM lines yet.</p>
          {/if}
          </div>
        </div>

        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">Map point input</h3>
          <p class="text-body-secondary">Use the forms below for quick manual point entry, or the CSV tools further down for bulk changes.</p>
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-4">
              <label class="form-label" for="rpm-point-line">RPM line</label>
              <select class="form-select" id="rpm-point-line" bind:value={rpmPointForm.rpm_line_id}>
                <option value="">Select RPM line</option>
                {#each rpmLines as line}
                  <option value={line.id}>{line.rpm} RPM</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label" for="rpm-point-flow">Flow</label>
              <input class="form-control" id="rpm-point-flow" type="number" step="any" bind:value={rpmPointForm.flow} />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label" for="rpm-point-pressure">Pressure</label>
              <input class="form-control" id="rpm-point-pressure" type="number" step="any" bind:value={rpmPointForm.pressure} />
            </div>
            <div class="col-12 col-md-2">
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-primary" on:click={addRpmPointFromForm} disabled={rpmLines.length === 0}>Add RPM Point</button>
              </div>
            </div>
          </div>

          <hr class="my-4" />

          <div class="row g-3 align-items-end mt-1">
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-flow">Flow</label>
              <input class="form-control" id="efficiency-point-flow" type="number" step="any" bind:value={efficiencyPointForm.flow} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-centre">Efficiency Centre</label>
              <input class="form-control" id="efficiency-point-centre" type="number" step="any" bind:value={efficiencyPointForm.efficiency_centre} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-lower">Efficiency Lower End</label>
              <input class="form-control" id="efficiency-point-lower" type="number" step="any" bind:value={efficiencyPointForm.efficiency_lower_end} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-higher">Efficiency Higher End</label>
              <input class="form-control" id="efficiency-point-higher" type="number" step="any" bind:value={efficiencyPointForm.efficiency_higher_end} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-permissible">Permissible Use</label>
              <input class="form-control" id="efficiency-point-permissible" type="number" step="any" bind:value={efficiencyPointForm.permissible_use} />
            </div>
            <div class="col-12 col-md-4">
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-primary" on:click={addEfficiencyPointFromForm}>Add Efficiency / Permissible Point</button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    {#if productImages.length > 0}
      <div class="row g-3 mt-1">
        {#each productImages as image, index}
          <div class="col-12 col-sm-6 col-lg-4 col-xxl-3">
          <div class="card shadow-sm h-100">
            <div class="card-body">
            <img
              class="img-fluid rounded border mb-2"
              style="width: 100%; height: 150px; object-fit: cover;"
              src={image.url}
              alt={`${fanForm.manufacturer} ${fanForm.model} product image ${index + 1}`}
            />
            <p class="text-body-secondary">{index === 0 ? 'Primary image' : `Image ${index + 1}`}</p>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-secondary btn-sm" on:click={() => moveProductImage(index, -1)} disabled={index === 0}>Move Up</button>
              <button class="btn btn-outline-secondary btn-sm" on:click={() => moveProductImage(index, 1)} disabled={index === productImages.length - 1}>Move Down</button>
              <button class="btn btn-danger btn-sm" on:click={() => removeProductImage(image)}>Delete</button>
            </div>
            </div>
          </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-body-secondary">No product images uploaded yet.</p>
    {/if}

    <div class="row g-3 mt-1">
      <div class="col-12 col-xl-6">
      <div class="card shadow-sm h-100">
        <div class="card-body">
        <h3 class="h6">RPM CSV</h3>
    <p class="text-body-secondary">CSV format: rpm, flow, pressure</p>
    <textarea class="form-control" bind:value={rpmCsv} placeholder="e.g.&#10;1000, 0.5, 120&#10;1500, 0.8, 180" rows="4" style="font-family:monospace"></textarea>
    {#if rpmCsvError}
      <p class="text-danger mb-0">{rpmCsvError}</p>
    {/if}
    <div class="d-flex flex-wrap gap-2 mt-2">
      <button class="btn btn-primary" on:click={importRpmPointsFromCsv}>Import RPM CSV</button>
      <button class="btn btn-outline-secondary" on:click={exportRpmPointsCsv} disabled={rpmPoints.length === 0}>Export RPM CSV</button>
    </div>
        </div>
      </div>
      </div>

      <div class="col-12 col-xl-6">
      <div class="card shadow-sm h-100">
        <div class="card-body">
        <h3 class="h6">Efficiency / permissible CSV</h3>
        <p class="text-body-secondary">CSV format: flow, efficiency_centre, efficiency_lower_end, efficiency_higher_end, permissible_use</p>
        <textarea class="form-control" bind:value={efficiencyCsv} placeholder="e.g.&#10;0.5, 55, 48, 62, 58" rows="4" style="font-family:monospace"></textarea>
        {#if efficiencyCsvError}
          <p class="text-danger mb-0">{efficiencyCsvError}</p>
        {/if}
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button class="btn btn-primary" on:click={importEfficiencyPointsFromCsv}>Import Efficiency CSV</button>
          <button class="btn btn-outline-secondary" on:click={exportEfficiencyPointsCsv} disabled={efficiencyPoints.length === 0}>Export Efficiency CSV</button>
        </div>
      </div>
      </div>
      </div>
    </div>

    <h3 class="h6 mt-3">RPM Points</h3>
    <div class="table-responsive">
    <table class="table table-sm align-middle editable-table mb-0">
      <thead>
        <tr>
          <th>RPM</th>
          <th>
            <button type="button" class="btn btn-outline-secondary btn-sm" on:click={() => toggleRpmPointSort('flow')}>
              Flow ({sortIndicator('flow')})
            </button>
          </th>
          <th>
            <button type="button" class="btn btn-outline-secondary btn-sm" on:click={() => toggleRpmPointSort('pressure')}>
              Pressure ({sortIndicator('pressure')})
            </button>
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each rpmPoints as p}
          <tr>
            <td>{p.rpm}</td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.flow} on:input={() => (rpmPoints = [...rpmPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.pressure} on:input={() => (rpmPoints = [...rpmPoints])} /></td>
            <td><button class="btn btn-danger btn-sm" on:click={() => deleteRpmPointLocal(p)}>Delete</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
    {#if rpmPoints.length === 0}
      <p class="text-body-secondary">No RPM points yet.</p>
    {/if}

    <h3 class="h6 mt-3">Efficiency / Permissible Points</h3>
    <div class="table-responsive">
    <table class="table table-sm align-middle editable-table mb-0">
      <thead>
        <tr>
          <th>Flow</th>
          <th>Efficiency Centre</th>
          <th>Efficiency Lower End</th>
          <th>Efficiency Higher End</th>
          <th>Permissible Use</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each efficiencyPoints as p}
          <tr>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.flow} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.efficiency_centre} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.efficiency_lower_end} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.efficiency_higher_end} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.permissible_use} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><button class="btn btn-danger btn-sm" on:click={() => deleteEfficiencyPointLocal(p)}>Delete</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
    {#if efficiencyPoints.length === 0}
      <p class="text-body-secondary">No efficiency/permissible points yet.</p>
    {/if}

    {#if rpmPoints.length > 0 || efficiencyPoints.length > 0}
      <div class="card shadow-sm p-3">
        <h3 class="h6">Map points chart</h3>
        <div class="row g-3">
          <div class="col-12 col-md-6 col-lg-2">
            <label class="form-label" for="chart-add-target">Line to add points on</label>
            <select class="form-select" id="chart-add-target" bind:value={chartAddTarget}>
              <option value="off">-Off-</option>
              {#each rpmLines as line}
                <option value={`rpm:${line.id}`}>{line.rpm} RPM line</option>
              {/each}
              {#each FULL_CHART_LINE_DEFINITIONS as definition}
                <option value={`efficiency:${definition.key}`}>{definition.label}</option>
              {/each}
            </select>
          </div>
        </div>
        <p class="text-body-secondary">Drag existing points to edit them. Set the dropdown above to a line when you want chart clicks to add points. Set it to -Off- to disable point adding. Hold either Shift key while left clicking a point to delete it.</p>
        <ECharts
          option={mapChartOption}
          height="750px"
          on={{ dragend: handleMapChartDragEnd }}
          onChartReady={(c) => { chartInstance = c; setupChartDrag(); }}
        />
      </div>
    {/if}

    <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
      <button class="btn btn-primary" on:click={saveFan} disabled={loading || savingMapPoints}>Save Fan Details</button>
      {#if rpmPoints.length > 0 || efficiencyPoints.length > 0}
        <button class="btn btn-primary" on:click={saveMapPoints} disabled={savingMapPoints}>
          {savingMapPoints ? 'Saving Map Points...' : 'Save Map Points'}
        </button>
      {/if}
      <button
        class="btn btn-outline-secondary"
        disabled={savingMapPoints}
        on:click={() => { mode = 'select'; editingFanId = null; selectedFanId = null; fanForm = emptyFanForm(); productImages = []; pendingImageFiles = []; currentFan = null; }}
      >
        Done
      </button>
      {#if savingMapPoints}
        <span class="text-body-secondary">{mapPointSaveProgressMessage}</span>
      {/if}
    </div>
    </div>
  </div>
{/if}
