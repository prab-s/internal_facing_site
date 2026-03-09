<script>
  import { onMount } from 'svelte';
  import {
    getFans,
    getFan,
    createFan,
    updateFan,
    getMapPoints,
    createMapPoint,
    updateMapPoint,
    deleteMapPoint,
    importMapPointsCsv
  } from '$lib/api.js';
  import ECharts from '$lib/ECharts.svelte';

  let fans = [];
  let selectedFanId = null;
  let currentFan = null;
  let mapPoints = [];
  let mapChartOption = {};
  let loading = false;
  let error = '';
  let success = '';

  let chartInstance = null;
  let draggingPoint = null;
  
  // Mode: 'select' (initial), 'create', or 'editExisting'
  let mode = 'select';
  let editingFanId = null;

  // Form state: new/edit fan
  let fanForm = { manufacturer: '', model: '', notes: '', diameter_mm: '', max_rpm: '' };

  // Map point form (single)
  let mapForm = { rpm: '', flow: '', pressure: '', efficiency: '' };
  let mapCsv = '';
  let mapCsvError = '';

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
      mapPoints = await getMapPoints(selectedFanId);
      currentFan = await getFan(selectedFanId);
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
        await updateFan(editingFanId, body);
        success = 'Fan updated.';
      } else {
        const created = await createFan(body);
        success = 'Fan created.';
        selectedFanId = created.id;
        fans = await getFans();
      }
      fanForm = { manufacturer: '', model: '', notes: '', diameter_mm: '', max_rpm: '' };
      editingFanId = null;
      mode = 'select';
      loadPoints();
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
      diameter_mm: fan.diameter_mm ?? '',
      max_rpm: fan.max_rpm ?? ''
    };
  }

  async function addMapPoint() {
    const rpm = parseFloat(mapForm.rpm);
    const flow = parseFloat(mapForm.flow);
    const pressure = parseFloat(mapForm.pressure);
    if (isNaN(rpm) || isNaN(flow) || isNaN(pressure)) {
      error = 'RPM, flow and pressure must be numbers.';
      return;
    }
    if (!selectedFanId) {
      error = 'Select a fan first.';
      return;
    }
    error = '';
    try {
      await createMapPoint(selectedFanId, {
        rpm,
        flow,
        pressure,
        efficiency: mapForm.efficiency ? parseFloat(mapForm.efficiency) : null
      });
      mapForm = { rpm: '', flow: '', pressure: '', efficiency: '' };
      mapPoints = await getMapPoints(selectedFanId);
      success = 'Map point added.';
    } catch (e) {
      error = e.message;
    }
  }

  async function doMapCsvImport() {
    mapCsvError = '';
    if (!selectedFanId) {
      mapCsvError = 'Select a fan first.';
      return;
    }
    if (!mapCsv.trim()) {
      mapCsvError = 'Paste CSV data first. Format: rpm, flow, pressure [, efficiency]';
      return;
    }
    try {
      const created = await importMapPointsCsv(selectedFanId, mapCsv);
      mapPoints = await getMapPoints(selectedFanId);
      success = `Imported ${created.length} map point(s).`;
      mapCsv = '';
    } catch (e) {
      mapCsvError = e.message;
    }
  }

  function buildMapCsv(points) {
    const header = ['rpm', 'flow', 'pressure', 'efficiency'];
    const rows = points.map((p) => [p.rpm ?? '', p.flow ?? '', p.pressure ?? '', p.efficiency ?? ''].join(','));
    return [header.join(','), ...rows].join('\n');
  }

  function exportMapCsv() {
    if (!mapPoints.length) {
      error = 'No map points to export.';
      return;
    }
    const csv = buildMapCsv(mapPoints);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = currentFan
      ? `${currentFan.manufacturer}-${currentFan.model}-map.csv`.replace(/\s+/g, '_')
      : 'map-points.csv';
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildMapChartOption() {
    // Group points by RPM so each RPM gets its own series.
    const byRpm = {};
    for (const p of mapPoints) {
      const key = String(p.rpm ?? '');
      if (!byRpm[key]) byRpm[key] = [];
      byRpm[key].push({
        value: [p.flow ?? 0, p.pressure ?? 0],
        id: p.id,
        rpm: p.rpm
      });
    }

    const rpms = Object.keys(byRpm)
      .filter((k) => k !== '')
      .map((r) => Number(r))
      .filter((r) => !Number.isNaN(r))
      .sort((a, b) => a - b);

    const series = [];
    for (const [idx, rpm] of rpms.entries()) {
      const pts = byRpm[String(rpm)] ?? [];
      const hasMultiplePoints = pts.length > 1;

      // Use separate data arrays for line vs scatter so dragging only affects the draggable series
      const lineData = pts.map((p) => [p.value[0], p.value[1]]);
      const scatterData = pts.map((p) => ({ value: [p.value[0], p.value[1]], id: p.id, rpm: p.rpm }));

      // Line series (visual only)
      series.push({
        name: `${rpm} rpm`,
        type: 'line',
        smooth: hasMultiplePoints,
        showSymbol: false,
        data: lineData,
        lineStyle: { width: hasMultiplePoints ? 2 : 0 },
        emphasis: { focus: 'series' },
        z: idx * 2
      });

      // Draggable points series (hidden from legend)
      series.push({
        name: `${rpm} rpm`,
        type: 'scatter',
        data: scatterData,
        symbol: 'circle',
        symbolSize: 10, // adjust to preference (smaller = tighter touching)
        draggable: true,
        showInLegend: false,
        emphasis: {
          focus: 'series',
          scale: true,
          scaleSize: 1.2,
          itemStyle: { borderColor: '#fff', borderWidth: 2 }
        },
        z: idx * 2 + 1
      });
    }

    const effPts = mapPoints
      .filter((p) => p.efficiency != null)
      .map((p) => [p.flow ?? 0, p.efficiency ?? 0])
      .sort((a, b) => a[0] - b[0]);

    if (effPts.length) {
      // Efficiency line (visual) — use straight segments to avoid misleading smoothing.
      series.push({
        name: 'Efficiency',
        type: 'line',
        smooth: false,
        data: effPts,
        showSymbol: false,
        yAxisIndex: 1,
        itemStyle: { color: '#f7768e' },
        lineStyle: { width: 2 },
        z: 999
      });

      // Draggable points for efficiency
      const effData = mapPoints
        .filter((p) => p.efficiency != null)
        .map((p) => ({ value: [p.flow ?? 0, p.efficiency ?? 0], id: p.id }));

      series.push({
        name: 'Efficiency',
        type: 'scatter',
        data: effData,
        draggable: true,
        showInLegend: false,
        itemStyle: { color: '#f7768e' },
        symbolSize: 10, // adjust to preference
        emphasis: {
          focus: 'series',
          scale: true,
          scaleSize: 1.2,
          itemStyle: { borderColor: '#fff', borderWidth: 2 }
        },
        yAxisIndex: 1,
        z: 1000
      });
    }

    mapChartOption = {
      backgroundColor: '#1a1b26',
      title: {
        text: 'Map points (drag points to edit)',
        left: 'center',
        textStyle: { color: '#c0caf5' }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const name = params.seriesName;
          const [flow, second] = params.value;

          if (name === 'Efficiency') {
            // Efficiency series values are [flow, efficiency]
            return `Efficiency: ${second}%<br/>flow: ${flow}`;
          }

          // RPM series values are [flow, pressure]
          return `${name}<br/>flow: ${flow}<br/>pressure: ${second}`;
        }
      },
      legend: {
        bottom: 0,
        type: 'scroll',
        textStyle: { color: '#c0caf5' }
      },
      xAxis: {
        type: 'value',
        name: 'Flow',
        nameTextStyle: { color: '#c0caf5' },
        axisLabel: { color: '#c0caf5' }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Pressure',
          nameTextStyle: { color: '#c0caf5' },
          axisLabel: { color: '#c0caf5' }
        },
        {
          type: 'value',
          name: 'Efficiency (%)',
          nameTextStyle: { color: '#c0caf5' },
          axisLabel: { color: '#c0caf5' },
          min: 0,
          max: 100
        }
      ],
      series
    };

  }

  function handleMapChartDragEnd(params) {
    const data = params.data;
    const value = params.value || (data && data.value);
    const id = data?.id;
    if (!id || !value || !Array.isArray(value)) return;

    const [x, y] = value;
    const flow = Math.round(x);
    const target = mapPoints.find((p) => p.id === id);
    if (!target) return;

    const isEfficiency = params.seriesName === 'Efficiency';
    const updated = {
      ...target,
      flow,
      ...(isEfficiency ? { efficiency: Math.round(y) } : { pressure: Math.round(y) })
    };

    mapPoints = mapPoints.map((p) => (p.id === id ? updated : p));
  }

  let chartDragAttached = false;

  function setupChartDrag() {
    if (chartDragAttached || !chartInstance) return;
    chartDragAttached = true;

    const zr = chartInstance.getZr();
    if (!zr) return;

    function getEventXY(evt) {
      const dom = evt.event || evt;
      return { x: dom.offsetX ?? dom.clientX, y: dom.offsetY ?? dom.clientY };
    }

    function pickClosestPoint({ x, y }) {
      const threshold = 14;
      let best = null;
      let bestDist = Infinity;

      for (const p of mapPoints) {
        if (p.flow == null || p.pressure == null) continue;
        const pressurePixel = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.flow, p.pressure]);
        const dx = pressurePixel[0] - x;
        const dy = pressurePixel[1] - y;
        const d = Math.hypot(dx, dy);
        if (d < bestDist && d <= threshold) {
          bestDist = d;
          best = { id: p.id, isEfficiency: false };
        }

        if (p.efficiency != null) {
          const efficiencyPixel = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex: 1 }, [p.flow, p.efficiency]);
          const dx2 = efficiencyPixel[0] - x;
          const dy2 = efficiencyPixel[1] - y;
          const d2 = Math.hypot(dx2, dy2);
          if (d2 < bestDist && d2 <= threshold) {
            bestDist = d2;
            best = { id: p.id, isEfficiency: true };
          }
        }
      }

      return best;
    }

    function updateDraggedPoint(point, pixel) {
      if (!point) return;
      const axisIndex = point.isEfficiency ? 1 : 0;
      const [flow, value] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: axisIndex }, [pixel.x, pixel.y]);
      const updated = {
        ...mapPoints.find((p) => p.id === point.id),
        flow: Math.round(flow),
        ...(point.isEfficiency ? { efficiency: Math.round(value) } : { pressure: Math.round(value) })
      };
      mapPoints = mapPoints.map((p) => (p.id === point.id ? updated : p));
    }

    zr.on('mousedown', (evt) => {
      const mouse = getEventXY(evt);
      const found = pickClosestPoint(mouse);
      if (found) {
        draggingPoint = found;
      }
    });

    zr.on('mousemove', (evt) => {
      if (!draggingPoint) return;
      const mouse = getEventXY(evt);
      updateDraggedPoint(draggingPoint, mouse);
    });

    zr.on('mouseup', () => {
      if (draggingPoint) {
        draggingPoint = null;
      }
    });
  }

  $: if (mapPoints) {
    buildMapChartOption();
  }

  async function updateMapPointLocal(point) {
    try {
      await updateMapPoint(selectedFanId, point.id, {
        rpm: parseFloat(point.rpm),
        flow: parseFloat(point.flow),
        pressure: parseFloat(point.pressure),
        efficiency: point.efficiency ? parseFloat(point.efficiency) : null
      });
      success = 'Map point updated.';
    } catch (e) {
      error = e.message;
    }
  }

  async function saveMapPoints() {
    error = '';
    success = '';
    try {
      for (const p of mapPoints) {
        await updateMapPoint(selectedFanId, p.id, {
          rpm: parseFloat(p.rpm),
          flow: parseFloat(p.flow),
          pressure: parseFloat(p.pressure),
          efficiency: p.efficiency ? parseFloat(p.efficiency) : null
        });
      }
      success = 'All map points saved.';
    } catch (e) {
      error = e.message;
    }
  }

  async function deleteMapPointLocal(point) {
    try {
      await deleteMapPoint(selectedFanId, point.id);
      mapPoints = await getMapPoints(selectedFanId);
      success = 'Map point deleted.';
    } catch (e) {
      error = e.message;
    }
  }
</script>

<svelte:head>
  <title>Data entry — Fan Graphs</title>
</svelte:head>

<div class="card">
  <h1>Data entry</h1>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  {#if success}
    <p class="success">{success}</p>
  {/if}
</div>

{#if mode === 'select'}
  <div class="card">
    <h2>Get Started</h2>
    <p>What would you like to do?</p>
    <div class="button-group">
      <button on:click={() => { mode = 'create'; fanForm = { manufacturer: '', model: '', notes: '', diameter_mm: '', max_rpm: '' }; }}>
        Create New Fan
      </button>
      <button on:click={() => { mode = 'editExisting'; }}>
        Edit Existing Fan
      </button>
    </div>
  </div>
{/if}

{#if mode === 'create'}
  <div class="card">
    <h2>Create New Fan</h2>
    <div class="form-group">
      <label>Manufacturer</label>
      <input type="text" bind:value={fanForm.manufacturer} placeholder="e.g. Acme" />
    </div>
    <div class="form-group">
      <label>Model</label>
      <input type="text" bind:value={fanForm.model} placeholder="e.g. AF-120" />
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <textarea bind:value={fanForm.notes} rows="2"></textarea>
    </div>
    <div class="form-group">
      <label>Diameter (mm, optional)</label>
      <input type="number" step="any" bind:value={fanForm.diameter_mm} />
    </div>
    <div class="form-group">
      <label>Max RPM (optional)</label>
      <input type="number" step="any" bind:value={fanForm.max_rpm} />
    </div>
    <div class="form-group button-group">
      <button on:click={saveFan} disabled={loading}>Save Fan</button>
      <button class="secondary" on:click={() => { mode = 'select'; fanForm = { manufacturer: '', model: '', notes: '', diameter_mm: '', max_rpm: '' }; }}>Cancel</button>
    </div>
  </div>
{/if}

{#if mode === 'editExisting' && editingFanId === null}
  <div class="card">
    <h2>Select Fan to Edit</h2>
    <div class="form-group">
      <label>Select a fan</label>
      <select bind:value={selectedFanId}>
        <option value={null}>— Select —</option>
        {#each fans as fan}
          <option value={fan.id}>{fan.manufacturer} {fan.model}</option>
        {/each}
      </select>
    </div>
    <div class="form-group button-group">
      <button
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
      <button class="secondary" on:click={() => { mode = 'select'; selectedFanId = null; }}>Cancel</button>
    </div>
  </div>
{/if}

{#if mode === 'editExisting' && editingFanId !== null}
  <div class="card">
    <h2>Edit Fan: {fanForm.manufacturer} {fanForm.model}</h2>
    <div class="form-group">
      <label>Manufacturer</label>
      <input type="text" bind:value={fanForm.manufacturer} />
    </div>
    <div class="form-group">
      <label>Model</label>
      <input type="text" bind:value={fanForm.model} />
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <textarea bind:value={fanForm.notes} rows="2"></textarea>
    </div>
    <div class="form-group">
      <label>Diameter (mm, optional)</label>
      <input type="number" step="any" bind:value={fanForm.diameter_mm} />
    </div>
    <div class="form-group">
      <label>Max RPM (optional)</label>
      <input type="number" step="any" bind:value={fanForm.max_rpm} />
    </div>

    <h3>Map Points</h3>
    <p class="muted">CSV format: rpm, flow, pressure, efficiency. One row per point.</p>
    <textarea bind:value={mapCsv} placeholder="e.g.&#10;1000, 0.5, 120&#10;1000, 1.0, 100&#10;1500, 0.5, 180" rows="4" style="width:100%; font-family:monospace"></textarea>
    {#if mapCsvError}
      <p class="error">{mapCsvError}</p>
    {/if}
    <div class="button-group" style="margin-top: 0.5rem;">
      <button on:click={doMapCsvImport}>Import map CSV</button>
      <button class="secondary" on:click={exportMapCsv} disabled={mapPoints.length === 0}>Export map CSV</button>
    </div>

    <h3>Add Single Map Point</h3>
    <div class="grid-2">
      <div class="form-group">
        <label>RPM</label>
        <input type="number" step="any" bind:value={mapForm.rpm} />
      </div>
      <div class="form-group">
        <label>Flow</label>
        <input type="number" step="any" bind:value={mapForm.flow} />
      </div>
      <div class="form-group">
        <label>Pressure</label>
        <input type="number" step="any" bind:value={mapForm.pressure} />
      </div>
      <div class="form-group">
        <label>Efficiency (optional)</label>
        <input type="number" step="any" bind:value={mapForm.efficiency} />
      </div>
    </div>
    <button on:click={addMapPoint}>Add Map Point</button>

    <h3>Existing Map Points</h3>
    <table class="editable-table">
      <thead>
        <tr><th>RPM</th><th>Flow</th><th>Pressure</th><th>Efficiency</th><th>Actions</th></tr>
      </thead>
      <tbody>
        {#each mapPoints as p}
          <tr>
            <td><input type="number" step="any" bind:value={p.rpm} on:input={() => (mapPoints = [...mapPoints])} /></td>
            <td><input type="number" step="any" bind:value={p.flow} on:input={() => (mapPoints = [...mapPoints])} /></td>
            <td><input type="number" step="any" bind:value={p.pressure} on:input={() => (mapPoints = [...mapPoints])} /></td>
            <td><input type="number" step="any" bind:value={p.efficiency} on:input={() => (mapPoints = [...mapPoints])} /></td>
            <td><button class="delete-btn" on:click={() => deleteMapPointLocal(p)}>Delete</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if mapPoints.length === 0}
      <p class="muted">No map points yet. Add single points or import CSV above.</p>
    {/if}

    {#if mapPoints.length > 0}
      <div class="card">
        <h3>Map points chart</h3>
        <p class="muted">Drag points vertically to update pressure, horizontally to update flow.</p>
        <ECharts
          option={mapChartOption}
          height="750px"
          on={{ dragend: handleMapChartDragEnd }}
          onChartReady={(c) => { chartInstance = c; setupChartDrag(); }}
        />
      </div>
    {/if}

    <div class="form-group button-group">
      <button on:click={saveFan} disabled={loading}>Save Fan Details</button>
      {#if mapPoints.length > 0}
        <button on:click={saveMapPoints}>Save Map Points</button>
      {/if}
      <button class="secondary" on:click={() => { mode = 'select'; editingFanId = null; selectedFanId = null; fanForm = { manufacturer: '', model: '', notes: '', diameter_mm: '', max_rpm: '' }; }}>Done</button>
    </div>
  </div>
{/if}
