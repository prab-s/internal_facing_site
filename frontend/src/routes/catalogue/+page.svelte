<script>
  import { getFans, getMapPoints } from '$lib/api.js';
  import ECharts from '$lib/ECharts.svelte';

  let fans = [];
  let filteredFans = [];
  let fanRanges = {};
  let search = '';
  let selectedIds = [];
  let showExtraColumns = false;

  // Efficiency comparison (flow vs efficiency from map points)
  let effRawData = []; // [{ fan, points }]
  let effChartOption = {};
  let rpmRangeMin = null;
  let rpmRangeMax = null;
  let rpmFilterMin = null;
  let rpmFilterMax = null;
  let pressureRangeMin = null;
  let pressureRangeMax = null;
  let pressureFilterMin = null;
  let pressureFilterMax = null;

  let loading = false;
  let error = '';

  function formatRange(min, max) {
    if (min == null || max == null) return '—';
    return `${Math.round(min)} – ${Math.round(max)}`;
  }

  async function loadFans() {
    loading = true;
    error = '';
    try {
      fans = await getFans(search ? { search } : {});
      await loadFanRanges();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadFanRanges() {
    fanRanges = {};
    rpmRangeMin = rpmRangeMax = null;
    pressureRangeMin = pressureRangeMax = null;

    // Fetch map points for each fan to determine range bounds
    await Promise.all(
      fans.map(async (fan) => {
        try {
          const points = await getMapPoints(fan.id);
          const rpms = points.map((p) => Number(p.rpm)).filter((v) => v != null && !Number.isNaN(v));
          const pressures = points.map((p) => Number(p.pressure)).filter((v) => v != null && !Number.isNaN(v));
          const range = {
            rpmMin: rpms.length ? Math.min(...rpms) : null,
            rpmMax: rpms.length ? Math.max(...rpms) : null,
            pressureMin: pressures.length ? Math.min(...pressures) : null,
            pressureMax: pressures.length ? Math.max(...pressures) : null
          };
          fanRanges[fan.id] = range;

          if (range.rpmMin != null) {
            rpmRangeMin = rpmRangeMin == null ? range.rpmMin : Math.min(rpmRangeMin, range.rpmMin);
            rpmRangeMax = rpmRangeMax == null ? range.rpmMax : Math.max(rpmRangeMax, range.rpmMax);
          }
          if (range.pressureMin != null) {
            pressureRangeMin =
              pressureRangeMin == null ? range.pressureMin : Math.min(pressureRangeMin, range.pressureMin);
            pressureRangeMax =
              pressureRangeMax == null ? range.pressureMax : Math.max(pressureRangeMax, range.pressureMax);
          }
        } catch (e) {
          // ignore failures for individual fans
        }
      })
    );

    if (rpmRangeMin != null) {
      rpmFilterMin = rpmRangeMin;
      rpmFilterMax = rpmRangeMax;
    }
    if (pressureRangeMin != null) {
      pressureFilterMin = pressureRangeMin;
      pressureFilterMax = pressureRangeMax;
    }
  }

  function toggleFan(id) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((x) => x !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
    loadEfficiencyForSelected();
  }

  // Keep selection aligned with the currently filtered fan list
  $: {
    if (filteredFans.length && selectedIds.length) {
      const allowed = new Set(filteredFans.map((f) => f.id));
      const filteredSelection = selectedIds.filter((id) => allowed.has(id));
      if (filteredSelection.length !== selectedIds.length) {
        selectedIds = filteredSelection;
        loadEfficiencyForSelected();
      }
    }
  }


  async function loadEfficiencyForSelected() {
    if (selectedIds.length === 0) {
      effRawData = [];
      effChartOption = {};
      rpmRangeMin = rpmRangeMax = rpmFilterMin = rpmFilterMax = null;
      pressureRangeMin = pressureRangeMax = pressureFilterMin = pressureFilterMax = null;
      return;
    }
    effRawData = [];
    let all = [];
    try {
      for (const id of selectedIds) {
        const fan = fans.find((f) => f.id === id);
        if (!fan) continue;
        const points = await getMapPoints(id);
        effRawData.push({ fan, points });
        all = all.concat(points);
      }
      if (all.length) {
        const rpms = all.map((p) => p.rpm).filter((v) => v != null && !Number.isNaN(v));
        const pressures = all.map((p) => p.pressure).filter((v) => v != null && !Number.isNaN(v));
        if (rpms.length) {
          rpmRangeMin = Math.min(...rpms);
          rpmRangeMax = Math.max(...rpms);
          rpmFilterMin = rpmRangeMin;
          rpmFilterMax = rpmRangeMax;
        }
        if (pressures.length) {
          pressureRangeMin = Math.min(...pressures);
          pressureRangeMax = Math.max(...pressures);
          pressureFilterMin = pressureRangeMin;
          pressureFilterMax = pressureRangeMax;
        }
      }
      buildEfficiencyChartOption();
    } catch (e) {
      error = e.message;
    }
  }

  function buildEfficiencyChartOption() {
    if (!effRawData.length || rpmFilterMin == null || pressureFilterMin == null) {
      effChartOption = {};
      return;
    }
    const series = [];
    for (const { fan, points } of effRawData) {
      const filtered = points
        .filter((p) => p.efficiency != null)
        .filter((p) => {
          const rpm = Number(p.rpm);
          const press = Number(p.pressure);
          return (
            rpm >= Number(rpmFilterMin) &&
            rpm <= Number(rpmFilterMax) &&
            press >= Number(pressureFilterMin) &&
            press <= Number(pressureFilterMax)
          );
        });
      if (!filtered.length) continue;
      series.push({
        name: `${fan.manufacturer} ${fan.model}`,
        type: 'line',
        smooth: true,
        data: filtered.map((p) => [p.flow, p.efficiency]).sort((a, b) => a[0] - b[0]),
        symbol: 'circle',
        symbolSize: 6
      });
    }
    effChartOption = series.length
      ? {
          backgroundColor: '#1a1b26',
          title: {
            text: 'Efficiency comparison (filtered)',
            left: 'center',
            textStyle: { color: '#c0caf5' }
          },
          tooltip: { trigger: 'axis' },
          legend: { bottom: 0, type: 'scroll', textStyle: { color: '#c0caf5', fontWeight: 'bold', fontSize: 16 } },
          grid: { left: '12%', right: '8%', top: '15%', bottom: '22%' },
          xAxis: {
            type: 'value',
            name: 'Flow',
            nameTextStyle: { color: '#c0caf5' },
            axisLabel: { color: '#c0caf5' }
          },
          yAxis: {
            type: 'value',
            name: 'Efficiency (%)',
            nameTextStyle: { color: '#c0caf5' },
            axisLabel: { color: '#c0caf5' }
          },
          series
        }
      : {};
  }

  // Rebuild efficiency chart when filters change
  $: if (effRawData.length) {
    buildEfficiencyChartOption();
  }


  // Filter fans based on the selected RPM/pressure ranges
  $: if (fans.length) {
    filteredFans = fans.filter((fan) => {
      const range = fanRanges[fan.id];
      if (!range || rpmFilterMin == null || pressureFilterMin == null) return true;
      return (
        range.rpmMax >= rpmFilterMin &&
        range.rpmMin <= rpmFilterMax &&
        range.pressureMax >= pressureFilterMin &&
        range.pressureMin <= pressureFilterMax
      );
    });
  }

  loadFans();
</script>

<svelte:head>
  <title>Catalogue — Fan Graphs</title>
</svelte:head>

<div class="card">
  <h1>Catalogue</h1>
</div>

<div class="card">
  <h2>Filter</h2>
  <div class="form-group">
    <label>Search (manufacturer or model)</label>
    <input type="text" bind:value={search} placeholder="e.g. Acme or AF-120" />
  </div>

  {#if rpmRangeMin != null && pressureRangeMin != null}
    <div class="grid-2">
      <div>
        <label>
          RPM range: {Math.round(Number(rpmFilterMin))} – {Math.round(Number(rpmFilterMax))}
        </label>
        <input
          type="range"
          min={rpmRangeMin}
          max={rpmRangeMax}
          step="10"
          bind:value={rpmFilterMin}
        />
        <input
          type="range"
          min={rpmRangeMin}
          max={rpmRangeMax}
          step="10"
          bind:value={rpmFilterMax}
        />
      </div>
      <div>
        <label>
          Pressure range: {Math.round(Number(pressureFilterMin))} – {Math.round(Number(pressureFilterMax))}
        </label>
        <input
          type="range"
          min={pressureRangeMin}
          max={pressureRangeMax}
          step="5"
          bind:value={pressureFilterMin}
        />
        <input
          type="range"
          min={pressureRangeMin}
          max={pressureRangeMax}
          step="5"
          bind:value={pressureFilterMax}
        />
      </div>
    </div>
  {/if}

  <button on:click={loadFans} disabled={loading}>Search</button>
</div>

{#if error}
  <p class="error">{error}</p>
{/if}

<div class="card">
  <h2>Results</h2>
  <div class="results-header">
    <p>Select one or more fans to compare their efficiency curves below.</p>
    <button class="button" on:click={() => (showExtraColumns = !showExtraColumns)}>
      extra {showExtraColumns ? '<' : '>'}
    </button>
  </div>

  <table>
    <thead>
      <tr>
        <th>Select</th>
        <th>Manufacturer</th>
        <th>Model</th>
        <th>Notes</th>
        {#if showExtraColumns}
          <th>RPM range</th>
          <th>Pressure range</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each filteredFans as fan}
        <tr>
          <td>
            <input type="checkbox" checked={selectedIds.includes(fan.id)} on:change={() => toggleFan(fan.id)} />
          </td>
          <td>{fan.manufacturer}</td>
          <td>{fan.model}</td>
          <td>{fan.notes || '—'}</td>
          {#if showExtraColumns}
            <td>{formatRange(fanRanges[fan.id]?.rpmMin, fanRanges[fan.id]?.rpmMax)}</td>
            <td>{formatRange(fanRanges[fan.id]?.pressureMin, fanRanges[fan.id]?.pressureMax)}</td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
  {#if filteredFans.length === 0 && !loading}
    <p class="muted">No fans match the current filters. Try expanding the RPM/pressure range or adjusting your search.</p>
  {/if}
</div>

{#if selectedIds.length > 0}
  <div class="card">
    <h2>Efficiency comparison</h2>
    <p class="muted">
      Compare efficiency lines for the selected fans.
    </p>

    <div class="chart-container">
      <ECharts option={effChartOption} height="750px" />
    </div>
  </div>
{/if}