<script>
  import {
    getFans,
    getFanChartData,
    getEfficiencyCurvePoints,
  } from "$lib/api.js";
  import ECharts from "$lib/ECharts.svelte";
  import {
    DISCHARGE_TYPE_OPTIONS,
    MOUNTING_STYLE_OPTIONS,
    getChartTheme,
    theme,
  } from "$lib/config.js";

  let fans = [];
  let filteredFans = [];
  let fanRanges = {};
  let search = "";
  let mountingStyleFilter = "";
  let dischargeTypeFilter = "";
  let selectedIds = [];
  let showExtraColumns = false;

  // Efficiency comparison (airflow vs efficiency centre from map points)
  let effRawData = []; // [{ fan, points }]
  let effChartOption = {};
  let rpmRangeMin = null;
  let rpmRangeMax = null;
  let rpmFilterMin = null;
  let rpmFilterMax = null;
  let airflowRangeMin = null;
  let airflowRangeMax = null;
  let airflowFilterMin = null;
  let airflowFilterMax = null;
  let pressureRangeMin = null;
  let pressureRangeMax = null;
  let pressureFilterMin = null;
  let pressureFilterMax = null;

  let loading = false;
  let error = "";

  // Display helper only: turns a numeric min/max pair into the text shown in the UI.
  function formatRange(min, max) {
    if (min == null || max == null) return "—";
    return `${Math.round(min)} - ${Math.round(max)}`;
  }

  function setRangeFilter(kind, edge, nextValue) {
    const normalizedValue = nextValue === "" || nextValue == null ? null : Number(nextValue);

    if (kind === "rpm") {
      if (edge === "min") {
        rpmFilterMin =
          normalizedValue == null
            ? rpmRangeMin
            : Math.min(normalizedValue, Number(rpmFilterMax));
      } else {
        rpmFilterMax =
          normalizedValue == null
            ? rpmRangeMax
            : Math.max(normalizedValue, Number(rpmFilterMin));
      }
      return;
    }

    if (kind === "airflow") {
      if (edge === "min") {
        airflowFilterMin =
          normalizedValue == null
            ? airflowRangeMin
            : Math.min(normalizedValue, Number(airflowFilterMax));
      } else {
        airflowFilterMax =
          normalizedValue == null
            ? airflowRangeMax
            : Math.max(normalizedValue, Number(airflowFilterMin));
      }
      return;
    }

    if (kind === "pressure") {
      if (edge === "min") {
        pressureFilterMin =
          normalizedValue == null
            ? pressureRangeMin
            : Math.min(normalizedValue, Number(pressureFilterMax));
      } else {
        pressureFilterMax =
          normalizedValue == null
            ? pressureRangeMax
            : Math.max(normalizedValue, Number(pressureFilterMin));
      }
      return;
    }
  }

  // Results-table filtering helper.
  // This uses FULL-CONTAINMENT logic:
  // a fan is kept only when the selected RPM band fully contains that fan's RPM range,
  // the selected airflow band fully contains that fan's airflow range,
  // and the selected pressure band fully contains that fan's pressure range.
  function fanMatchesSelectedRanges(fan) {
    const range = fanRanges[fan.id];
    if (!range || rpmFilterMin == null || airflowFilterMin == null || pressureFilterMin == null)
      return true;

    const rpmOverlaps =
      rpmFilterMin <= range.rpmMin && rpmFilterMax >= range.rpmMax;

    const airflowOverlaps =
      airflowFilterMin <= range.airflowMin &&
      airflowFilterMax >= range.airflowMax;

    const pressureOverlaps =
      pressureFilterMin <= range.pressureMin &&
      pressureFilterMax >= range.pressureMax;

    // console.log(`\n\nChecking fan ${fan.model} (id ${fan.id})`);
    // console.log(`rpmOverlaps: ${rpmOverlaps}, pressureOverlaps: ${pressureOverlaps}\n\n`);
    // console.log(`range rpmMin: ${range.rpmMin}, rpmMax: ${range.rpmMax}`);
    // console.log(`range pressureMin: ${range.pressureMin}, pressureMax: ${range.pressureMax}\n\n`);
    // console.log(`filter rpmMin: ${rpmFilterMin}, rpmMax: ${rpmFilterMax}`);
    // console.log(`filter pressureMin: ${pressureFilterMin}, pressureMax: ${pressureFilterMax}\n---\n`);
    return rpmOverlaps && airflowOverlaps && pressureOverlaps;
  }

  async function loadFans() {
    loading = true;
    error = "";
    try {
      const params = {};
      if (search) params.search = search;
      if (mountingStyleFilter) params.mounting_style = mountingStyleFilter;
      if (dischargeTypeFilter) params.discharge_type = dischargeTypeFilter;
      fans = await getFans(params);
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
    airflowRangeMin = airflowRangeMax = null;
    pressureRangeMin = pressureRangeMax = null;

    // Build each fan's full min/max envelope from its map points.
    // These stored envelopes are later used by the results-table filter.
    await Promise.all(
      fans.map(async (fan) => {
        try {
          const { rpmPoints } = await getFanChartData(fan.id);
          const rpms = rpmPoints
            .map((p) => Number(p.rpm))
            .filter((v) => v != null && !Number.isNaN(v));
          const airflows = rpmPoints
            .map((p) => Number(p.airflow))
            .filter((v) => v != null && !Number.isNaN(v));
          const pressures = rpmPoints
            .map((p) => Number(p.pressure))
            .filter((v) => v != null && !Number.isNaN(v));
          const range = {
            rpmMin: rpms.length ? Math.min(...rpms) : null,
            rpmMax: rpms.length ? Math.max(...rpms) : null,
            airflowMin: airflows.length ? Math.min(...airflows) : null,
            airflowMax: airflows.length ? Math.max(...airflows) : null,
            pressureMin: pressures.length ? Math.min(...pressures) : null,
            pressureMax: pressures.length ? Math.max(...pressures) : null,
          };
          fanRanges[fan.id] = range;

          if (range.rpmMin != null) {
            rpmRangeMin =
              rpmRangeMin == null
                ? range.rpmMin
                : Math.min(rpmRangeMin, range.rpmMin);
            rpmRangeMax =
              rpmRangeMax == null
                ? range.rpmMax
                : Math.max(rpmRangeMax, range.rpmMax);
          }
          if (range.airflowMin != null) {
            airflowRangeMin =
              airflowRangeMin == null
                ? range.airflowMin
                : Math.min(airflowRangeMin, range.airflowMin);
            airflowRangeMax =
              airflowRangeMax == null
                ? range.airflowMax
                : Math.max(airflowRangeMax, range.airflowMax);
          }
          if (range.pressureMin != null) {
            pressureRangeMin =
              pressureRangeMin == null
                ? range.pressureMin
                : Math.min(pressureRangeMin, range.pressureMin);
            pressureRangeMax =
              pressureRangeMax == null
                ? range.pressureMax
                : Math.max(pressureRangeMax, range.pressureMax);
          }
        } catch (e) {
          // ignore failures for individual fans
        }
      }),
    );

    if (rpmRangeMin != null) {
      rpmFilterMin = rpmRangeMin;
      rpmFilterMax = rpmRangeMax;
    }
    if (airflowRangeMin != null) {
      airflowFilterMin = airflowRangeMin;
      airflowFilterMax = airflowRangeMax;
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
      return;
    }
    effRawData = [];
    try {
      for (const id of selectedIds) {
        const fan = fans.find((f) => f.id === id);
        if (!fan) continue;
        const points = await getEfficiencyCurvePoints(id);
        effRawData.push({ fan, points });
      }
      buildEfficiencyChartOption();
    } catch (e) {
      error = e.message;
    }
  }

  function buildEfficiencyChartOption() {
    const chartTheme = getChartTheme($theme);
    if (
      !effRawData.length ||
      rpmFilterMin == null ||
      pressureFilterMin == null
    ) {
      effChartOption = {};
      return;
    }
    const series = [];
    for (const { fan, points } of effRawData) {
      const filtered = points.filter((p) => p.efficiency_centre != null);
      if (!filtered.length) continue;
      series.push({
        name: fan.model,
        type: "line",
        smooth: true,
        data: filtered
          .map((p) => [p.airflow, p.efficiency_centre])
          .sort((a, b) => a[0] - b[0]),
        symbol: "circle",
        symbolSize: 6,
      });
    }
    effChartOption = series.length
      ? {
          backgroundColor: chartTheme.background,
          title: {
            text: "Efficiency comparison (filtered)",
            left: "center",
            textStyle: { color: chartTheme.text },
          },
          tooltip: { trigger: "axis" },
          legend: {
            bottom: 0,
            type: "scroll",
            textStyle: {
              color: chartTheme.text,
              fontWeight: "bold",
              fontSize: 16,
            },
          },
          grid: { left: "12%", right: "8%", top: "15%", bottom: "22%" },
          xAxis: {
            type: "value",
            name: "Airflow (L/s)",
            nameLocation: "middle",
            nameGap: 30,
            nameTextStyle: { color: chartTheme.text },
            axisLabel: { color: chartTheme.text },
            splitLine: { lineStyle: { color: chartTheme.grid } },
          },
          yAxis: {
            type: "value",
            name: "Efficiency (%)",
            nameTextStyle: { color: chartTheme.text },
            axisLabel: { color: chartTheme.text },
            splitLine: { lineStyle: { color: chartTheme.grid } },
          },
          series,
        }
      : {};
  }

  // Rebuild efficiency chart when filters or theme change.
  $: if (
    (effRawData.length,
    $theme,
    rpmFilterMin,
    rpmFilterMax,
    airflowFilterMin,
    airflowFilterMax,
    pressureFilterMin,
    pressureFilterMax)
  ) {
    buildEfficiencyChartOption();
  }

  // Results-table filtering.
  // This decides which FANS appear in the table.
  // If you want to change the filtering behaviour, this is the main block to edit.
  $: {
    rpmFilterMin;
    rpmFilterMax;
    airflowFilterMin;
    airflowFilterMax;
    pressureFilterMin;
    pressureFilterMax;
    fanRanges;
    filteredFans = fans.length ? fans.filter(fanMatchesSelectedRanges) : [];
  }

  loadFans();
</script>

<svelte:head>
  <title>Catalogue — Fan Graphs</title>
</svelte:head>

<div class="mb-3">
  <div class="col-12 col-xxl-8">
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">
      Browse & Compare
    </p>
    <h1 class="h2 mb-2">Catalogue</h1>
    <p class="text-body-secondary">
      Search the library by product details and operating ranges, then compare
      efficiency curves for the fans you select.
    </p>
  </div>
</div>

<div class="row g-3">
  <div class="col-12 col-xl-3">
    <div class="vstack gap-3">
      <div class="card shadow-sm p-3">
        <h2 class="h5">Filters</h2>
        <div class="mb-3">
          <label class="form-label" for="catalogue-search"
            >Search (model)</label
          >
          <input
            class="form-control"
            id="catalogue-search"
            type="text"
            bind:value={search}
            placeholder="e.g. AF-120"
          />
        </div>
        <div class="row g-3">
          <div class="col-12 col-md-6 col-xl-12">
            <label class="form-label" for="catalogue-mounting-style"
              >Mounting Style</label
            >
            <select
              class="form-select"
              id="catalogue-mounting-style"
              bind:value={mountingStyleFilter}
            >
              <option value="">All</option>
              {#each MOUNTING_STYLE_OPTIONS as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </div>
          <div class="col-12 col-md-6 col-xl-12">
            <label class="form-label" for="catalogue-discharge-type"
              >Discharge Type</label
            >
            <select
              class="form-select"
              id="catalogue-discharge-type"
              bind:value={dischargeTypeFilter}
            >
              <option value="">All</option>
              {#each DISCHARGE_TYPE_OPTIONS as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </div>
        </div>

        {#if rpmRangeMin != null && airflowRangeMin != null && pressureRangeMin != null}
          <div class="row g-3 mt-1">
            <div class="col-12">
              <div class="border rounded p-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="fw-semibold">RPM range</span>
                  <span class="fw-semibold">
                    {Math.round(Number(rpmFilterMin))} - {Math.round(Number(rpmFilterMax))}
                  </span>
                </div>
                <div class="row g-2">
                  <div class="col-6">
                    <label class="form-label" for="rpm-filter-min">Min RPM</label>
                    <input
                      id="rpm-filter-min"
                      class="form-control"
                      type="number"
                      step="10"
                      min={rpmRangeMin}
                      max={rpmRangeMax}
                      value={rpmFilterMin}
                      on:input={(event) => setRangeFilter("rpm", "min", event.currentTarget.value)}
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label" for="rpm-filter-max">Max RPM</label>
                    <input
                      id="rpm-filter-max"
                      class="form-control"
                      type="number"
                      step="10"
                      min={rpmRangeMin}
                      max={rpmRangeMax}
                      value={rpmFilterMax}
                      on:input={(event) => setRangeFilter("rpm", "max", event.currentTarget.value)}
                    />
                  </div>
                  <div class="col-12">
                    <p class="small text-body-secondary mb-0">
                      Available range: {Math.round(Number(rpmRangeMin))} to {Math.round(Number(rpmRangeMax))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-12">
              <div class="border rounded p-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="fw-semibold">Airflow range</span>
                  <span class="fw-semibold">
                    {Math.round(Number(airflowFilterMin))} - {Math.round(Number(airflowFilterMax))}
                  </span>
                </div>
                <div class="row g-2">
                  <div class="col-6">
                    <label class="form-label" for="airflow-filter-min">Min Airflow</label>
                    <input
                      id="airflow-filter-min"
                      class="form-control"
                      type="number"
                      step="5"
                      min={airflowRangeMin}
                      max={airflowRangeMax}
                      value={airflowFilterMin}
                      on:input={(event) => setRangeFilter("airflow", "min", event.currentTarget.value)}
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label" for="airflow-filter-max">Max Airflow</label>
                    <input
                      id="airflow-filter-max"
                      class="form-control"
                      type="number"
                      step="5"
                      min={airflowRangeMin}
                      max={airflowRangeMax}
                      value={airflowFilterMax}
                      on:input={(event) => setRangeFilter("airflow", "max", event.currentTarget.value)}
                    />
                  </div>
                  <div class="col-12">
                    <p class="small text-body-secondary mb-0">
                      Available range: {Math.round(Number(airflowRangeMin))} to {Math.round(Number(airflowRangeMax))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-12">
              <div class="border rounded p-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="fw-semibold">Pressure range</span>
                  <span class="fw-semibold">
                    {Math.round(Number(pressureFilterMin))} - {Math.round(Number(pressureFilterMax))}
                  </span>
                </div>
                <div class="row g-2">
                  <div class="col-6">
                    <label class="form-label" for="pressure-filter-min">Min Pressure</label>
                    <input
                      id="pressure-filter-min"
                      class="form-control"
                      type="number"
                      step="5"
                      min={pressureRangeMin}
                      max={pressureRangeMax}
                      value={pressureFilterMin}
                      on:input={(event) => setRangeFilter("pressure", "min", event.currentTarget.value)}
                    />
                  </div>
                  <div class="col-6">
                    <label class="form-label" for="pressure-filter-max">Max Pressure</label>
                    <input
                      id="pressure-filter-max"
                      class="form-control"
                      type="number"
                      step="5"
                      min={pressureRangeMin}
                      max={pressureRangeMax}
                      value={pressureFilterMax}
                      on:input={(event) => setRangeFilter("pressure", "max", event.currentTarget.value)}
                    />
                  </div>
                  <div class="col-12">
                    <p class="small text-body-secondary mb-0">
                      Available range: {Math.round(Number(pressureRangeMin))} to {Math.round(Number(pressureRangeMax))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <button
          class="btn btn-primary mt-3"
          on:click={loadFans}
          disabled={loading}>Search</button
        >
      </div>

      {#if error}
        <div class="card shadow-sm p-3">
          <p class="text-danger mb-0">{error}</p>
        </div>
      {/if}
    </div>
  </div>

  <div class="col-12 col-xl-9">
    <div class="vstack gap-3">
      <div class="card shadow-sm p-3">
        <h2 class="h5">Results</h2>
        <div
          class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3"
        >
          <p class="mb-0">
            Select one or more fans to compare their efficiency curves below.
          </p>
          <button
            class="btn btn-outline-secondary btn-sm"
            on:click={() => (showExtraColumns = !showExtraColumns)}
          >
            extra {showExtraColumns ? "<" : ">"}
          </button>
        </div>

        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Select</th>
                <th>Image</th>
                <th>Model</th>
                <th>Notes</th>
                <th>Graph</th>
                {#if showExtraColumns}
                  <th>Mounting Style</th>
                  <th>Discharge Type</th>
                  <th>RPM range</th>
                  <th>Airflow range</th>
                  <th>Pressure range</th>
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each filteredFans as fan}
                <tr>
                  <td>
                    <input
                      class="form-check-input"
                      type="checkbox"
                      checked={selectedIds.includes(fan.id)}
                      on:change={() => toggleFan(fan.id)}
                    />
                  </td>
                  <td style="width: 160px;">
                    {#if fan.primary_product_image_url}
                      <img
                        class="img-fluid rounded border"
                        style="width: 140px; height: 100px; object-fit: cover;"
                        src={fan.primary_product_image_url}
                        alt={fan.model}
                      />
                    {:else}
                      <span class="text-body-secondary">No image</span>
                    {/if}
                  </td>
                  <td>{fan.model}</td>
                  <td>{fan.notes || "—"}</td>
                  <td>
                    {#if fan.graph_image_url}
                      <a href={fan.graph_image_url} download>Download graph</a>
                    {:else}
                      <span class="text-body-secondary">No graph</span>
                    {/if}
                  </td>
                  {#if showExtraColumns}
                    <td>{fan.mounting_style || "—"}</td>
                    <td>{fan.discharge_type || "—"}</td>
                    <td
                      >{formatRange(
                        fanRanges[fan.id]?.rpmMin,
                        fanRanges[fan.id]?.rpmMax,
                      )}</td
                    >
                    <td
                      >{formatRange(
                        fanRanges[fan.id]?.airflowMin,
                        fanRanges[fan.id]?.airflowMax,
                      )}</td
                    >
                    <td
                      >{formatRange(
                        fanRanges[fan.id]?.pressureMin,
                        fanRanges[fan.id]?.pressureMax,
                      )}</td
                    >
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if filteredFans.length === 0 && !loading}
          <p class="text-body-secondary">
            No fans match the current filters. Try expanding the RPM/airflow/pressure
            range or adjusting your search.
          </p>
        {/if}
      </div>

      {#if selectedIds.length > 0}
        <div class="card shadow-sm p-3">
          <h2 class="h5">Efficiency comparison</h2>
          <p class="text-body-secondary">
            Compare efficiency lines for the selected fans.
          </p>

          <div class="mt-3">
            <ECharts option={effChartOption} height="750px" />
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
