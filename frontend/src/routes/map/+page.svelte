<script>
  import { getFans, getFan, getFanChartData } from "$lib/api.js";
  import ECharts from "$lib/ECharts.svelte";
  import { getChartTheme, theme } from "$lib/config.js";
  import { buildFullChartOption } from "$lib/fullChart.js";

  let fans = [];
  let selectedFanId = null;
  let rpmLines = [];
  let rpmPoints = [];
  let efficiencyPoints = [];
  let currentFan = null;
  let chartOption = {};
  let loading = false;
  let error = "";

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
      const [chartData, fan] = await Promise.all([
        getFanChartData(selectedFanId),
        getFan(selectedFanId)
      ]);
      ({ rpmLines, rpmPoints, efficiencyPoints } = chartData);
      currentFan = fan;
      buildChartOptions();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function buildChartOptions() {
    const chartTheme = getChartTheme($theme);
    chartOption = buildFullChartOption({
      rpmLines,
      rpmPoints,
      efficiencyPoints,
      chartTheme,
      title: currentFan ? `${currentFan.manufacturer} ${currentFan.model}` : 'Fan Map',
      clipRpmAreaToPermissibleUse: true,
      showRpmBandShading: currentFan?.show_rpm_band_shading ?? true,
      showSecondaryAxis: false
    });
  }
  
  
  $: if (selectedFanId) {
    loadMap();
  }
  
  $: if (selectedFanId, $theme) {
    buildChartOptions();
  }

  loadFans();
</script>

<svelte:head>
  <title>Fan map — Fan Graphs</title>
</svelte:head>

<div class="mb-3">
  <div class="col-12 col-xxl-8">
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Single Fan View</p>
    <h1 class="h2 mb-2">Fan map</h1>
    <p class="text-body-secondary">
      Review one fan’s flow vs pressure map with RPM bands and efficiency or permissible overlays.
    </p>
  </div>
</div>

<div class="row g-3">
  <div class="col-12 col-xl-3">
  <div class="vstack gap-3">
    <div class="card shadow-sm p-3">
      <h2 class="h5">Select fan</h2>
      <label class="form-label" for="map-fan-select">Fan record</label>
      <select class="form-select" id="map-fan-select" bind:value={selectedFanId} disabled={loading}>
        <option value={null}>— Select —</option>
        {#each fans as fan}
          <option value={fan.id}>{fan.manufacturer} {fan.model}</option>
        {/each}
      </select>
    </div>

    {#if error}
      <div class="card shadow-sm p-3">
        <p class="text-danger mb-0">{error}</p>
      </div>
    {/if}

    <div class="card shadow-sm p-3">
      <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Reading Guide</p>
      <p class="text-body-secondary mb-0">
        RPM levels are shown as shaded bands. Efficiency centre appears in green,
        efficiency lower and higher end in red, and permissible use in grey.
      </p>
    </div>
  </div>
  </div>

  <div class="col-12 col-xl-9">
  <div class="vstack gap-3">
    {#if selectedFanId}
      <div class="card shadow-sm p-3">
        <h2 class="h5">Flow vs pressure (RPM bands)</h2>
        <div class="mt-3">
          <ECharts
            option={chartOption}
            height="750px"
          />
        </div>
      </div>

      {#if selectedFanId && rpmPoints.length === 0 && efficiencyPoints.length === 0 && !loading}
        <div class="card shadow-sm p-3">
          <p class="text-body-secondary mb-0">
            No map points for this fan. Add map points on the Data entry page.
          </p>
        </div>
      {/if}
    {/if}
  </div>
  </div>
</div>
