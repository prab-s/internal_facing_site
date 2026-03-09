<script>
  import { getFans, getMapPoints } from "$lib/api.js";
  import ECharts from "$lib/ECharts.svelte";

  let fans = [];
  let selectedFanId = null;
  let mapPoints = [];
  let chartOption = {};
  let hasEfficiency = false;
  let loading = false;
  let error = "";

  let chartInstance = null;
  let showCursorTooltip = false;
  let lastMousePixel = null;
  let cursorTooltipAttached = false;

  async function loadFans() {
    try {
      fans = await getFans();
      if (fans.length && !selectedFanId) selectedFanId = fans[0].id;
    } catch (e) {
      error = e.message;
    }
  }

  async function loadMap() {
    if (!selectedFanId) return;
    loading = true;
    error = "";
    try {
      mapPoints = await getMapPoints(selectedFanId);
      buildChartOptions();
      setupCursorTooltip();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function getTooltipOption() {
    if (!showCursorTooltip) return { trigger: 'axis' };

    return {
      trigger: 'none',
      formatter: () => {
        if (!chartInstance || !lastMousePixel) return '';
        const [flow, pressure] = chartInstance.convertFromPixel(
          { xAxisIndex: 0, yAxisIndex: 0 },
          [lastMousePixel.x, lastMousePixel.y]
        );
        return `flow: ${flow.toFixed(2)}<br/>pressure: ${pressure.toFixed(2)}`;
      },
    };
  }

  function buildChartOptions() {
    // Group by RPM: each RPM becomes a shaded band (area) for flow vs pressure.
    const byRpm = {};
    for (const p of mapPoints) {
      const key = String(p.rpm);
      if (!byRpm[key]) byRpm[key] = [];
      byRpm[key].push([p.flow, p.pressure]);
    }
    for (const k of Object.keys(byRpm)) {
      byRpm[k].sort((a, b) => a[0] - b[0]);
    }

    const rpms = Object.keys(byRpm)
      .map((r) => Number(r))
      .filter((r) => !Number.isNaN(r))
      .sort((a, b) => a - b);

    const series = rpms.map((rpm, idx) => {
      const pts = byRpm[String(rpm)] ?? [];
      const hasMultiplePoints = pts.length > 1;
      const z = rpms.length - idx; // lower RPM bands render on top
      return {
        name: `${rpm} rpm`,
        type: "line",
        smooth: hasMultiplePoints,
        data: pts,
        showSymbol: !hasMultiplePoints, // Show symbols for single points
        symbolSize: hasMultiplePoints ? 0 : 8, // Larger symbols for single points
        lineStyle: { 
          width: hasMultiplePoints ? 1 : 0 // Hide line for single points
        },
        areaStyle: hasMultiplePoints ? { opacity: 0.48 } : undefined, // Only show area for bands
        emphasis: { focus: "series" },
        z,
      };
    });

    // Efficiency overlay (optional): a single line across all efficiency points.
    // If you later want a true "efficiency ridge", we'd compute an envelope.
    const effPts = mapPoints
      .filter((p) => p.efficiency != null)
      .map((p) => [p.flow, p.efficiency])
      .sort((a, b) => a[0] - b[0]);

    hasEfficiency = effPts.length > 0;
    if (hasEfficiency) {
      series.push({
        name: "Efficiency",
        type: "line",
        smooth: true,
        data: effPts,
        showSymbol: true,
        symbolSize: 4,
        yAxisIndex: 1,
        lineStyle: { width: 3 },
        itemStyle: { color: "#f7768e" },
        z: 999,
      });
    }

    chartOption = {
      backgroundColor: '#1a1b26',
      title: {
        text: "Fan map: Flow vs pressure by RPM",
        left: "center",
        textStyle: { color: "#c0caf5" },
      },
      tooltip: getTooltipOption(),
      legend: { bottom: 0, type: "scroll", textStyle: { color: "#c0caf5" } },
      grid: { left: "12%", right: "8%", top: "15%", bottom: "20%" },
      xAxis: {
        type: "value",
        name: "Flow",
        nameTextStyle: { color: "#c0caf5" },
        axisLabel: { color: "#c0caf5" },
      },
      yAxis: [
        {
          type: "value",
          name: "Pressure",
          nameTextStyle: { color: "#c0caf5" },
          axisLabel: { color: "#c0caf5" },
        },
        {
          type: "value",
          name: "Efficiency (%)",
          nameTextStyle: { color: "#c0caf5" },
          axisLabel: { color: "#c0caf5" },
          min: 0,
          max: 100,
        },
      ],
      series,
    };
  }

  $: if (selectedFanId) {
    loadMap();
  }

  // Keep tooltip mode in sync when toggled.
  $: if (chartInstance) {
    chartInstance.setOption({ tooltip: getTooltipOption() });
  }

  loadFans();

  function setupCursorTooltip() {
    if (!chartInstance || cursorTooltipAttached) return;

    const zr = chartInstance.getZr();
    if (!zr) return;

    cursorTooltipAttached = true;

    zr.on('mousemove', (evt) => {
      if (!showCursorTooltip) return;
      const dom = evt.event || evt;
      lastMousePixel = { x: dom.offsetX ?? dom.clientX, y: dom.offsetY ?? dom.clientY };
      chartInstance.dispatchAction({
        type: 'showTip',
        x: lastMousePixel.x,
        y: lastMousePixel.y,
      });
    });

    zr.on('mouseout', () => {
      if (!showCursorTooltip) return;
      chartInstance.dispatchAction({ type: 'hideTip' });
    });
  }
</script>

<svelte:head>
  <title>Fan map — Fan Graphs</title>
</svelte:head>

<div class="card">
  <h1>Fan map</h1>
</div>

<div class="card">
  <label>Select fan</label>
  <select bind:value={selectedFanId} disabled={loading}>
    <option value={null}>— Select —</option>
    {#each fans as fan}
      <option value={fan.id}>{fan.manufacturer} {fan.model}</option>
    {/each}
  </select>
</div>

{#if error}
  <p class="error">{error}</p>
{/if}

{#if selectedFanId}
  <div class="card">
    <h2>Flow vs pressure (RPM bands)</h2>
    <p class="muted">
      Each shaded band is one RPM level. Efficiency is shown as a line if
      available. TODO: units could be standardised (e.g. m³/s, Pa) in backend.
    </p>
    <div class="chart-container">
      <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
        <input type="checkbox" bind:checked={showCursorTooltip} on:change={setupCursorTooltip} />
        Show tooltip at mouse position (instead of nearest point)
      </label>
      <ECharts
        option={chartOption}
        height="750px"
        onChartReady={(c) => {
          chartInstance = c;
          setupCursorTooltip();
        }}
      />
    </div>
  </div>

  {#if selectedFanId && mapPoints.length === 0 && !loading}
    <p class="muted">
      No map points for this fan. Add map points on the Data entry page.
    </p>
  {/if}
{/if}
