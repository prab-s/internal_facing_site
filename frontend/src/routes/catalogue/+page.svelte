<script>
  import {
    getProducts,
    getProductTypes,
    getProductChartData,
    getProductEfficiencyCurvePoints,
  } from "$lib/api.js";
  import ECharts from "$lib/ECharts.svelte";
  import {
    DISCHARGE_TYPE_OPTIONS,
    MOUNTING_STYLE_OPTIONS,
    getChartTheme,
    theme,
  } from "$lib/config.js";

  let products = [];
  let productTypes = [];
  let filteredProducts = [];
  let productRanges = {};
  let search = "";
  let productTypeFilter = "";
  let mountingStyleFilter = "";
  let dischargeTypeFilter = "";
  let parameterDefinitions = [];
  let parameterFilterState = {};
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

  function parameterFilterKey(groupName, parameterName) {
    return `${groupName}:::${parameterName}`;
  }

  function formatParameterValue(parameter) {
    if (parameter.value_string) return parameter.value_string;
    if (parameter.value_number != null) {
      return `${parameter.value_number}${parameter.unit ? ` ${parameter.unit}` : ""}`;
    }
    return "—";
  }

  function buildParameterDefinitions(products) {
    const definitionMap = new Map();

    for (const product of products) {
      for (const group of product.parameter_groups ?? []) {
        for (const parameter of group.parameters ?? []) {
          const groupName = group.group_name ?? "";
          const parameterName = parameter.parameter_name ?? "";
          if (!groupName || !parameterName) continue;

          const key = parameterFilterKey(groupName, parameterName);
          const existing = definitionMap.get(key) ?? {
            key,
            group_name: groupName,
            parameter_name: parameterName,
            hasString: false,
            hasNumber: false,
            options: new Set(),
            min_number: null,
            max_number: null,
            units: new Set(),
          };

          if (parameter.value_string != null && parameter.value_string !== "") {
            existing.hasString = true;
            existing.options.add(parameter.value_string);
          }

          if (parameter.value_number != null && !Number.isNaN(Number(parameter.value_number))) {
            existing.hasNumber = true;
            const numericValue = Number(parameter.value_number);
            existing.min_number = existing.min_number == null ? numericValue : Math.min(existing.min_number, numericValue);
            existing.max_number = existing.max_number == null ? numericValue : Math.max(existing.max_number, numericValue);
            if (parameter.unit) existing.units.add(parameter.unit);
          }

          definitionMap.set(key, existing);
        }
      }
    }

    return [...definitionMap.values()]
      .map((definition) => ({
        ...definition,
        filter_kind: definition.hasString ? "string" : "number",
        options: [...definition.options].sort((a, b) => a.localeCompare(b)),
        units: [...definition.units].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.group_name.localeCompare(b.group_name) || a.parameter_name.localeCompare(b.parameter_name));
  }

  function syncParameterFilterState(definitions) {
    const nextState = {};

    for (const definition of definitions) {
      const existing = parameterFilterState[definition.key];
      nextState[definition.key] =
        definition.filter_kind === "string"
          ? {
              filter_kind: "string",
              value_string: existing?.value_string ?? "",
            }
          : {
              filter_kind: "number",
              min_number: existing?.min_number ?? definition.min_number,
              max_number: existing?.max_number ?? definition.max_number,
            };
    }

    parameterFilterState = nextState;
  }

  function groupedParameterDefinitions(definitions) {
    const groups = [];
    const byGroup = new Map();
    for (const definition of definitions) {
      if (!byGroup.has(definition.group_name)) {
        const group = { group_name: definition.group_name, parameters: [] };
        byGroup.set(definition.group_name, group);
        groups.push(group);
      }
      byGroup.get(definition.group_name).parameters.push(definition);
    }
    return groups;
  }

  function activeParameterFilters() {
    return parameterDefinitions
      .map((definition) => {
        const state = parameterFilterState[definition.key];
        if (!state) return null;
        if (definition.filter_kind === "string") {
          return state.value_string
            ? {
                group_name: definition.group_name,
                parameter_name: definition.parameter_name,
                value_string: state.value_string,
              }
            : null;
        }

        const hasMin = state.min_number != null && state.min_number !== "" && Number(state.min_number) > Number(definition.min_number);
        const hasMax = state.max_number != null && state.max_number !== "" && Number(state.max_number) < Number(definition.max_number);
        return hasMin || hasMax
          ? {
              group_name: definition.group_name,
              parameter_name: definition.parameter_name,
              min_number: hasMin ? Number(state.min_number) : null,
              max_number: hasMax ? Number(state.max_number) : null,
            }
          : null;
      })
      .filter(Boolean);
  }

  function productMatchesParameterFilters(product) {
    const filters = activeParameterFilters();
    if (!filters.length) return true;

    const parametersByKey = new Map();
    for (const group of product.parameter_groups ?? []) {
      for (const parameter of group.parameters ?? []) {
        parametersByKey.set(
          parameterFilterKey(group.group_name ?? "", parameter.parameter_name ?? ""),
          parameter,
        );
      }
    }

    return filters.every((filter) => {
      const parameter = parametersByKey.get(parameterFilterKey(filter.group_name, filter.parameter_name));
      if (!parameter) return false;
      if (filter.value_string != null) {
        return String(parameter.value_string ?? "") === String(filter.value_string);
      }

      const numericValue = parameter.value_number != null ? Number(parameter.value_number) : null;
      if (numericValue == null || Number.isNaN(numericValue)) return false;
      if (filter.min_number != null && numericValue < Number(filter.min_number)) return false;
      if (filter.max_number != null && numericValue > Number(filter.max_number)) return false;
      return true;
    });
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
  function productMatchesSelectedRanges(product) {
    const range = productRanges[product.id];
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

    // console.log(`\n\nChecking product ${product.model} (id ${product.id})`);
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
      if (productTypeFilter) params.product_type_key = productTypeFilter;
      if (mountingStyleFilter) params.mounting_style = mountingStyleFilter;
      if (dischargeTypeFilter) params.discharge_type = dischargeTypeFilter;
      products = await getProducts(params);
      parameterDefinitions = buildParameterDefinitions(products);
      syncParameterFilterState(parameterDefinitions);
      await loadProductRanges();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadProductTypes() {
    try {
      productTypes = await getProductTypes();
    } catch (e) {
      error = e.message;
    }
  }

  async function loadProductRanges() {
    productRanges = {};
    rpmRangeMin = rpmRangeMax = null;
    airflowRangeMin = airflowRangeMax = null;
    pressureRangeMin = pressureRangeMax = null;

    // Build each fan's full min/max envelope from its map points.
    // These stored envelopes are later used by the results-table filter.
    await Promise.all(
      products.map(async (product) => {
        try {
          const { rpmPoints } = await getProductChartData(product.id);
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
          productRanges[product.id] = range;

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
          // ignore failures for individual products
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
    if (filteredProducts.length && selectedIds.length) {
      const allowed = new Set(filteredProducts.map((f) => f.id));
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
        const product = products.find((f) => f.id === id);
        if (!product) continue;
        const points = await getProductEfficiencyCurvePoints(id);
        effRawData.push({ fan: product, points });
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
    productRanges;
    parameterFilterState;
    filteredProducts = products.length ? products.filter((product) => productMatchesSelectedRanges(product) && productMatchesParameterFilters(product)) : [];
  }

  loadFans();
  loadProductTypes();
</script>

<svelte:head>
  <title>Catalogue — Internal Facing</title>
</svelte:head>

<div class="mb-3">
  <div class="col-12 col-xxl-8">
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">
      Browse & Compare
    </p>
    <h1 class="h2 mb-2">Catalogue</h1>
    <p class="text-body-secondary">
      Search the library by product details and operating ranges, then compare
      graph data for the products you select.
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
            <label class="form-label" for="catalogue-product-type"
              >Product Type</label
            >
            <select
              class="form-select"
              id="catalogue-product-type"
              bind:value={productTypeFilter}
            >
              <option value="">All</option>
              {#each productTypes as productType}
                <option value={productType.key}>{productType.label}</option>
              {/each}
            </select>
          </div>
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

        {#if parameterDefinitions.length > 0}
          <div class="mt-3">
            <p class="small text-uppercase text-body-secondary fw-semibold mb-2">Specification Filters</p>
            <div class="vstack gap-3">
              {#each groupedParameterDefinitions(parameterDefinitions) as group}
                <div class="border rounded p-3">
                  <p class="fw-semibold mb-2">{group.group_name}</p>
                  <div class="row g-3">
                    {#each group.parameters as definition}
                      <div class="col-12">
                        <label class="form-label" for={`parameter-filter-${definition.key}`}>{definition.parameter_name}</label>
                        {#if definition.filter_kind === "string"}
                          <select
                            class="form-select"
                            id={`parameter-filter-${definition.key}`}
                            value={parameterFilterState[definition.key]?.value_string ?? ""}
                            on:change={(event) => {
                              parameterFilterState = {
                                ...parameterFilterState,
                                [definition.key]: {
                                  ...parameterFilterState[definition.key],
                                  value_string: event.currentTarget.value,
                                },
                              };
                            }}
                          >
                            <option value="">All</option>
                            {#each definition.options as option}
                              <option value={option}>{option}</option>
                            {/each}
                          </select>
                        {:else}
                          <div class="row g-2">
                            <div class="col-6">
                              <input
                                class="form-control"
                                type="number"
                                step="any"
                                min={definition.min_number}
                                max={definition.max_number}
                                placeholder="Min"
                                value={parameterFilterState[definition.key]?.min_number ?? ""}
                                on:input={(event) => {
                                  parameterFilterState = {
                                    ...parameterFilterState,
                                    [definition.key]: {
                                      ...parameterFilterState[definition.key],
                                      min_number: event.currentTarget.value === "" ? definition.min_number : Number(event.currentTarget.value),
                                    },
                                  };
                                }}
                              />
                            </div>
                            <div class="col-6">
                              <input
                                class="form-control"
                                type="number"
                                step="any"
                                min={definition.min_number}
                                max={definition.max_number}
                                placeholder="Max"
                                value={parameterFilterState[definition.key]?.max_number ?? ""}
                                on:input={(event) => {
                                  parameterFilterState = {
                                    ...parameterFilterState,
                                    [definition.key]: {
                                      ...parameterFilterState[definition.key],
                                      max_number: event.currentTarget.value === "" ? definition.max_number : Number(event.currentTarget.value),
                                    },
                                  };
                                }}
                              />
                            </div>
                            <div class="col-12">
                              <p class="small text-body-secondary mb-0">
                                Available range: {formatRange(definition.min_number, definition.max_number)}
                                {#if definition.units.length}
                                  {` ${definition.units.join(", ")}`}
                                {/if}
                              </p>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

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
            Select one or more products to compare their graph data below.
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
                <th>Type</th>
                <th>Graph</th>
                {#if showExtraColumns}
                  <th>Mounting Style</th>
                  <th>Discharge Type</th>
                  <th>Grouped Specs</th>
                  <th>RPM range</th>
                  <th>Airflow range</th>
                  <th>Pressure range</th>
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each filteredProducts as product}
                <tr>
                  <td>
                    <input
                      class="form-check-input"
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      on:change={() => toggleFan(product.id)}
                    />
                  </td>
                  <td style="width: 160px;">
                    {#if product.primary_product_image_url}
                      <img
                        class="img-fluid rounded border"
                        style="width: 140px; height: 100px; object-fit: cover;"
                        src={product.primary_product_image_url}
                        alt={product.model}
                      />
                    {:else}
                      <span class="text-body-secondary">No image</span>
                    {/if}
                  </td>
                  <td>{product.model}</td>
                  <td>{product.product_type_label || product.product_type_key || "—"}</td>
                  <td>
                    {#if product.graph_image_url}
                      <a href={product.graph_image_url} download>Download graph</a>
                    {:else}
                      <span class="text-body-secondary">No graph</span>
                    {/if}
                  </td>
                  {#if showExtraColumns}
                    <td>{product.mounting_style || "—"}</td>
                    <td>{product.discharge_type || "—"}</td>
                    <td>{product.parameter_groups?.length ? `${product.parameter_groups.length} groups` : "—"}</td>
                    <td
                      >{formatRange(
                        productRanges[product.id]?.rpmMin,
                        productRanges[product.id]?.rpmMax,
                      )}</td
                    >
                    <td
                      >{formatRange(
                        productRanges[product.id]?.airflowMin,
                        productRanges[product.id]?.airflowMax,
                      )}</td
                    >
                    <td
                      >{formatRange(
                        productRanges[product.id]?.pressureMin,
                        productRanges[product.id]?.pressureMax,
                      )}</td
                    >
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if filteredProducts.length > 0}
          <div class="row g-3 mt-2">
            {#each filteredProducts.slice(0, 6) as product}
              <div class="col-12 col-lg-6">
                <details class="catalogue-spec-card">
                  <summary class="catalogue-spec-summary">
                    <span class="catalogue-spec-title">{product.model} specifications</span>
                    <span class="catalogue-spec-meta">
                      {product.parameter_groups?.length ? `${product.parameter_groups.length} groups` : "Rich text only"}
                    </span>
                  </summary>
                  {#if product.description_html}
                    <div class="catalogue-richtext-block">
                      <p class="catalogue-section-label">Description</p>
                      <div class="catalogue-richtext-surface">{@html product.description_html}</div>
                    </div>
                  {/if}
                  {#if product.parameter_groups?.length}
                    <div class="catalogue-spec-groups">
                      {#each product.parameter_groups as group}
                        <section class="catalogue-spec-group">
                          <p class="catalogue-section-label">{group.group_name}</p>
                          <dl class="catalogue-spec-list">
                            {#each group.parameters as parameter}
                              <dt>{parameter.parameter_name}</dt>
                              <dd>
                                {#if parameter.value_string}
                                  {parameter.value_string}
                                {:else if parameter.value_number != null}
                                  {parameter.value_number}{parameter.unit ? ` ${parameter.unit}` : ""}
                                {:else}
                                  —
                                {/if}
                              </dd>
                            {/each}
                          </dl>
                        </section>
                      {/each}
                    </div>
                  {/if}
                </details>
              </div>
            {/each}
          </div>
        {/if}
        {#if filteredProducts.length === 0 && !loading}
          <p class="text-body-secondary">
            No products match the current filters. Try expanding the RPM/airflow/pressure
            range or adjusting your search.
          </p>
        {/if}
      </div>

      {#if selectedIds.length > 0}
        <div class="card shadow-sm p-3">
          <h2 class="h5">Efficiency comparison</h2>
          <p class="text-body-secondary">
            Compare graph lines for the selected products.
          </p>

          <div class="mt-3">
            <ECharts option={effChartOption} height="750px" />
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .catalogue-spec-card {
    border: 1px solid rgba(120, 130, 150, 0.2);
    border-radius: 1rem;
    background: color-mix(in srgb, var(--bs-body-bg) 92%, var(--bs-secondary-bg) 8%);
    padding: 1rem 1.05rem;
  }

  .catalogue-spec-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    list-style: none;
    font-weight: 600;
  }

  .catalogue-spec-summary::-webkit-details-marker {
    display: none;
  }

  .catalogue-spec-title {
    font-size: 1rem;
  }

  .catalogue-spec-meta {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--bs-secondary-color);
  }

  .catalogue-richtext-block,
  .catalogue-spec-groups {
    margin-top: 1rem;
  }

  .catalogue-richtext-surface,
  .catalogue-spec-group {
    border: 1px solid rgba(120, 130, 150, 0.16);
    border-radius: 0.9rem;
    background: color-mix(in srgb, var(--bs-body-bg) 96%, var(--bs-secondary-bg) 4%);
    padding: 0.85rem 0.95rem;
  }

  .catalogue-spec-groups {
    display: grid;
    gap: 0.85rem;
  }

  .catalogue-section-label {
    margin-bottom: 0.55rem;
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--bs-secondary-color);
  }

  .catalogue-spec-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 0.45rem 1rem;
    margin: 0;
  }

  .catalogue-spec-list dt,
  .catalogue-spec-list dd {
    margin: 0;
  }

  .catalogue-spec-list dt {
    color: var(--bs-emphasis-color);
    font-weight: 600;
  }

  .catalogue-spec-list dd {
    color: var(--bs-secondary-color);
  }

  @media (max-width: 575px) {
    .catalogue-spec-summary {
      align-items: flex-start;
      flex-direction: column;
    }

    .catalogue-spec-list {
      grid-template-columns: 1fr;
    }
  }
</style>
