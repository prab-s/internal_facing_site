import { s as store_get, h as head, a as attr, d as ensure_array_like, e as escape_html, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { g as getProducts, a as getProductTypes, b as getProductChartData, c as getProductEfficiencyCurvePoints, d as getChartTheme, t as theme, M as MOUNTING_STYLE_OPTIONS, D as DISCHARGE_TYPE_OPTIONS } from "../../../chunks/api.js";
import { E as ECharts } from "../../../chunks/ECharts.js";
function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
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
    let effRawData = [];
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
    function formatRange(min, max) {
      if (min == null || max == null) return "—";
      return `${Math.round(min)} - ${Math.round(max)}`;
    }
    function parameterFilterKey(groupName, parameterName) {
      return `${groupName}:::${parameterName}`;
    }
    function buildParameterDefinitions(products2) {
      const definitionMap = /* @__PURE__ */ new Map();
      for (const product of products2) {
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
              options: /* @__PURE__ */ new Set(),
              min_number: null,
              max_number: null,
              units: /* @__PURE__ */ new Set()
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
      return [...definitionMap.values()].map((definition) => ({
        ...definition,
        filter_kind: definition.hasString ? "string" : "number",
        options: [...definition.options].sort((a, b) => a.localeCompare(b)),
        units: [...definition.units].sort((a, b) => a.localeCompare(b))
      })).sort((a, b) => a.group_name.localeCompare(b.group_name) || a.parameter_name.localeCompare(b.parameter_name));
    }
    function syncParameterFilterState(definitions) {
      const nextState = {};
      for (const definition of definitions) {
        const existing = parameterFilterState[definition.key];
        nextState[definition.key] = definition.filter_kind === "string" ? {
          filter_kind: "string",
          value_string: existing?.value_string ?? ""
        } : {
          filter_kind: "number",
          min_number: existing?.min_number ?? definition.min_number,
          max_number: existing?.max_number ?? definition.max_number
        };
      }
      parameterFilterState = nextState;
    }
    function groupedParameterDefinitions(definitions) {
      const groups = [];
      const byGroup = /* @__PURE__ */ new Map();
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
      return parameterDefinitions.map((definition) => {
        const state = parameterFilterState[definition.key];
        if (!state) return null;
        if (definition.filter_kind === "string") {
          return state.value_string ? {
            group_name: definition.group_name,
            parameter_name: definition.parameter_name,
            value_string: state.value_string
          } : null;
        }
        const hasMin = state.min_number != null && state.min_number !== "" && Number(state.min_number) > Number(definition.min_number);
        const hasMax = state.max_number != null && state.max_number !== "" && Number(state.max_number) < Number(definition.max_number);
        return hasMin || hasMax ? {
          group_name: definition.group_name,
          parameter_name: definition.parameter_name,
          min_number: hasMin ? Number(state.min_number) : null,
          max_number: hasMax ? Number(state.max_number) : null
        } : null;
      }).filter(Boolean);
    }
    function productMatchesParameterFilters(product) {
      const filters = activeParameterFilters();
      if (!filters.length) return true;
      const parametersByKey = /* @__PURE__ */ new Map();
      for (const group of product.parameter_groups ?? []) {
        for (const parameter of group.parameters ?? []) {
          parametersByKey.set(parameterFilterKey(group.group_name ?? "", parameter.parameter_name ?? ""), parameter);
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
    function productMatchesSelectedRanges(product) {
      const range = productRanges[product.id];
      if (!range || rpmFilterMin == null || airflowFilterMin == null || pressureFilterMin == null) return true;
      const rpmOverlaps = rpmFilterMin <= range.rpmMin && rpmFilterMax >= range.rpmMax;
      const airflowOverlaps = airflowFilterMin <= range.airflowMin && airflowFilterMax >= range.airflowMax;
      const pressureOverlaps = pressureFilterMin <= range.pressureMin && pressureFilterMax >= range.pressureMax;
      return rpmOverlaps && airflowOverlaps && pressureOverlaps;
    }
    async function loadFans() {
      loading = true;
      error = "";
      try {
        const params = {};
        if (search) ;
        if (productTypeFilter) ;
        if (mountingStyleFilter) ;
        if (dischargeTypeFilter) ;
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
      await Promise.all(products.map(async (product) => {
        try {
          const { rpmPoints } = await getProductChartData(product.id);
          const rpms = rpmPoints.map((p) => Number(p.rpm)).filter((v) => v != null && !Number.isNaN(v));
          const airflows = rpmPoints.map((p) => Number(p.airflow)).filter((v) => v != null && !Number.isNaN(v));
          const pressures = rpmPoints.map((p) => Number(p.pressure)).filter((v) => v != null && !Number.isNaN(v));
          const range = {
            rpmMin: rpms.length ? Math.min(...rpms) : null,
            rpmMax: rpms.length ? Math.max(...rpms) : null,
            airflowMin: airflows.length ? Math.min(...airflows) : null,
            airflowMax: airflows.length ? Math.max(...airflows) : null,
            pressureMin: pressures.length ? Math.min(...pressures) : null,
            pressureMax: pressures.length ? Math.max(...pressures) : null
          };
          productRanges[product.id] = range;
          if (range.rpmMin != null) {
            rpmRangeMin = rpmRangeMin == null ? range.rpmMin : Math.min(rpmRangeMin, range.rpmMin);
            rpmRangeMax = rpmRangeMax == null ? range.rpmMax : Math.max(rpmRangeMax, range.rpmMax);
          }
          if (range.airflowMin != null) {
            airflowRangeMin = airflowRangeMin == null ? range.airflowMin : Math.min(airflowRangeMin, range.airflowMin);
            airflowRangeMax = airflowRangeMax == null ? range.airflowMax : Math.max(airflowRangeMax, range.airflowMax);
          }
          if (range.pressureMin != null) {
            pressureRangeMin = pressureRangeMin == null ? range.pressureMin : Math.min(pressureRangeMin, range.pressureMin);
            pressureRangeMax = pressureRangeMax == null ? range.pressureMax : Math.max(pressureRangeMax, range.pressureMax);
          }
        } catch (e) {
        }
      }));
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
      const chartTheme = getChartTheme(store_get($$store_subs ??= {}, "$theme", theme));
      if (!effRawData.length || rpmFilterMin == null || pressureFilterMin == null) {
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
          data: filtered.map((p) => [p.airflow, p.efficiency_centre]).sort((a, b) => a[0] - b[0]),
          symbol: "circle",
          symbolSize: 6
        });
      }
      effChartOption = series.length ? {
        backgroundColor: chartTheme.background,
        title: {
          text: "Efficiency comparison (filtered)",
          left: "center",
          textStyle: { color: chartTheme.text }
        },
        tooltip: { trigger: "axis" },
        legend: {
          bottom: 0,
          type: "scroll",
          textStyle: { color: chartTheme.text, fontWeight: "bold", fontSize: 16 }
        },
        grid: { left: "12%", right: "8%", top: "15%", bottom: "22%" },
        xAxis: {
          type: "value",
          name: "Airflow (L/s)",
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: { color: chartTheme.text },
          axisLabel: { color: chartTheme.text },
          splitLine: { lineStyle: { color: chartTheme.grid } }
        },
        yAxis: {
          type: "value",
          name: "Efficiency (%)",
          nameTextStyle: { color: chartTheme.text },
          axisLabel: { color: chartTheme.text },
          splitLine: { lineStyle: { color: chartTheme.grid } }
        },
        series
      } : {};
    }
    loadFans();
    loadProductTypes();
    {
      filteredProducts = products.length ? products.filter((product) => productMatchesSelectedRanges(product) && productMatchesParameterFilters(product)) : [];
    }
    {
      if (filteredProducts.length && selectedIds.length) {
        const allowed = new Set(filteredProducts.map((f) => f.id));
        const filteredSelection = selectedIds.filter((id) => allowed.has(id));
        if (filteredSelection.length !== selectedIds.length) {
          selectedIds = filteredSelection;
          loadEfficiencyForSelected();
        }
      }
    }
    if (effRawData.length, store_get($$store_subs ??= {}, "$theme", theme), pressureFilterMax) {
      buildEfficiencyChartOption();
    }
    head("1ddf6ke", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Catalogue — Internal Facing</title>`);
      });
    });
    $$renderer2.push(`<div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Browse &amp; Compare</p> <h1 class="h2 mb-2">Catalogue</h1> <p class="text-body-secondary">Search the library by product details and operating ranges, then compare
      graph data for the products you select.</p></div></div> <div class="row g-3"><div class="col-12 col-xl-3"><div class="vstack gap-3"><div class="card shadow-sm p-3"><h2 class="h5">Filters</h2> <div class="mb-3"><label class="form-label" for="catalogue-search">Search (model)</label> <input class="form-control" id="catalogue-search" type="text"${attr("value", search)} placeholder="e.g. AF-120"/></div> <div class="row g-3"><div class="col-12 col-md-6 col-xl-12"><label class="form-label" for="catalogue-product-type">Product Type</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "catalogue-product-type",
        value: productTypeFilter
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`All`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(productTypes);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let productType = each_array[$$index];
          $$renderer3.option({ value: productType.key }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(productType.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <div class="col-12 col-md-6 col-xl-12"><label class="form-label" for="catalogue-mounting-style">Mounting Style</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "catalogue-mounting-style",
        value: mountingStyleFilter
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`All`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(MOUNTING_STYLE_OPTIONS);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let option = each_array_1[$$index_1];
          $$renderer3.option({ value: option }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(option)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <div class="col-12 col-md-6 col-xl-12"><label class="form-label" for="catalogue-discharge-type">Discharge Type</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "catalogue-discharge-type",
        value: dischargeTypeFilter
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`All`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_2 = ensure_array_like(DISCHARGE_TYPE_OPTIONS);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let option = each_array_2[$$index_2];
          $$renderer3.option({ value: option }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(option)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div></div> `);
    if (parameterDefinitions.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-3"><p class="small text-uppercase text-body-secondary fw-semibold mb-2">Specification Filters</p> <div class="vstack gap-3"><!--[-->`);
      const each_array_3 = ensure_array_like(groupedParameterDefinitions(parameterDefinitions));
      for (let $$index_5 = 0, $$length = each_array_3.length; $$index_5 < $$length; $$index_5++) {
        let group = each_array_3[$$index_5];
        $$renderer2.push(`<div class="border rounded p-3"><p class="fw-semibold mb-2">${escape_html(group.group_name)}</p> <div class="row g-3"><!--[-->`);
        const each_array_4 = ensure_array_like(group.parameters);
        for (let $$index_4 = 0, $$length2 = each_array_4.length; $$index_4 < $$length2; $$index_4++) {
          let definition = each_array_4[$$index_4];
          $$renderer2.push(`<div class="col-12"><label class="form-label"${attr("for", `parameter-filter-${definition.key}`)}>${escape_html(definition.parameter_name)}</label> `);
          if (definition.filter_kind === "string") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.select(
              {
                class: "form-select",
                id: `parameter-filter-${definition.key}`,
                value: parameterFilterState[definition.key]?.value_string ?? ""
              },
              ($$renderer3) => {
                $$renderer3.option({ value: "" }, ($$renderer4) => {
                  $$renderer4.push(`All`);
                });
                $$renderer3.push(`<!--[-->`);
                const each_array_5 = ensure_array_like(definition.options);
                for (let $$index_3 = 0, $$length3 = each_array_5.length; $$index_3 < $$length3; $$index_3++) {
                  let option = each_array_5[$$index_3];
                  $$renderer3.option({ value: option }, ($$renderer4) => {
                    $$renderer4.push(`${escape_html(option)}`);
                  });
                }
                $$renderer3.push(`<!--]-->`);
              }
            );
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<div class="row g-2"><div class="col-6"><input class="form-control" type="number" step="any"${attr("min", definition.min_number)}${attr("max", definition.max_number)} placeholder="Min"${attr("value", parameterFilterState[definition.key]?.min_number ?? "")}/></div> <div class="col-6"><input class="form-control" type="number" step="any"${attr("min", definition.min_number)}${attr("max", definition.max_number)} placeholder="Max"${attr("value", parameterFilterState[definition.key]?.max_number ?? "")}/></div> <div class="col-12"><p class="small text-body-secondary mb-0">Available range: ${escape_html(formatRange(definition.min_number, definition.max_number))} `);
            if (definition.units.length) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`${escape_html(` ${definition.units.join(", ")}`)}`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></p></div></div>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (rpmRangeMin != null && airflowRangeMin != null && pressureRangeMin != null) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="row g-3 mt-1"><div class="col-12"><div class="border rounded p-3"><div class="d-flex justify-content-between align-items-center mb-2"><span class="fw-semibold">RPM range</span> <span class="fw-semibold">${escape_html(Math.round(Number(rpmFilterMin)))} - ${escape_html(Math.round(Number(rpmFilterMax)))}</span></div> <div class="row g-2"><div class="col-6"><label class="form-label" for="rpm-filter-min">Min RPM</label> <input id="rpm-filter-min" class="form-control" type="number" step="10"${attr("min", rpmRangeMin)}${attr("max", rpmRangeMax)}${attr("value", rpmFilterMin)}/></div> <div class="col-6"><label class="form-label" for="rpm-filter-max">Max RPM</label> <input id="rpm-filter-max" class="form-control" type="number" step="10"${attr("min", rpmRangeMin)}${attr("max", rpmRangeMax)}${attr("value", rpmFilterMax)}/></div> <div class="col-12"><p class="small text-body-secondary mb-0">Available range: ${escape_html(Math.round(Number(rpmRangeMin)))} to ${escape_html(Math.round(Number(rpmRangeMax)))}</p></div></div></div></div> <div class="col-12"><div class="border rounded p-3"><div class="d-flex justify-content-between align-items-center mb-2"><span class="fw-semibold">Airflow range</span> <span class="fw-semibold">${escape_html(Math.round(Number(airflowFilterMin)))} - ${escape_html(Math.round(Number(airflowFilterMax)))}</span></div> <div class="row g-2"><div class="col-6"><label class="form-label" for="airflow-filter-min">Min Airflow</label> <input id="airflow-filter-min" class="form-control" type="number" step="5"${attr("min", airflowRangeMin)}${attr("max", airflowRangeMax)}${attr("value", airflowFilterMin)}/></div> <div class="col-6"><label class="form-label" for="airflow-filter-max">Max Airflow</label> <input id="airflow-filter-max" class="form-control" type="number" step="5"${attr("min", airflowRangeMin)}${attr("max", airflowRangeMax)}${attr("value", airflowFilterMax)}/></div> <div class="col-12"><p class="small text-body-secondary mb-0">Available range: ${escape_html(Math.round(Number(airflowRangeMin)))} to ${escape_html(Math.round(Number(airflowRangeMax)))}</p></div></div></div></div> <div class="col-12"><div class="border rounded p-3"><div class="d-flex justify-content-between align-items-center mb-2"><span class="fw-semibold">Pressure range</span> <span class="fw-semibold">${escape_html(Math.round(Number(pressureFilterMin)))} - ${escape_html(Math.round(Number(pressureFilterMax)))}</span></div> <div class="row g-2"><div class="col-6"><label class="form-label" for="pressure-filter-min">Min Pressure</label> <input id="pressure-filter-min" class="form-control" type="number" step="5"${attr("min", pressureRangeMin)}${attr("max", pressureRangeMax)}${attr("value", pressureFilterMin)}/></div> <div class="col-6"><label class="form-label" for="pressure-filter-max">Max Pressure</label> <input id="pressure-filter-max" class="form-control" type="number" step="5"${attr("min", pressureRangeMin)}${attr("max", pressureRangeMax)}${attr("value", pressureFilterMax)}/></div> <div class="col-12"><p class="small text-body-secondary mb-0">Available range: ${escape_html(Math.round(Number(pressureRangeMin)))} to ${escape_html(Math.round(Number(pressureRangeMax)))}</p></div></div></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="btn btn-primary mt-3"${attr("disabled", loading, true)}>Search</button></div> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm p-3"><p class="text-danger mb-0">${escape_html(error)}</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="col-12 col-xl-9"><div class="vstack gap-3"><div class="card shadow-sm p-3"><h2 class="h5">Results</h2> <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3"><p class="mb-0">Select one or more products to compare their graph data below.</p> <button class="btn btn-outline-secondary btn-sm">extra ${escape_html(">")}</button></div> <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Select</th><th>Image</th><th>Model</th><th>Type</th><th>Graph</th>`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></tr></thead><tbody><!--[-->`);
    const each_array_6 = ensure_array_like(filteredProducts);
    for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
      let product = each_array_6[$$index_6];
      $$renderer2.push(`<tr><td><input class="form-check-input" type="checkbox"${attr("checked", selectedIds.includes(product.id), true)}/></td><td style="width: 160px;">`);
      if (product.primary_product_image_url) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<img class="img-fluid rounded border" style="width: 140px; height: 100px; object-fit: cover;"${attr("src", product.primary_product_image_url)}${attr("alt", product.model)}/>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="text-body-secondary">No image</span>`);
      }
      $$renderer2.push(`<!--]--></td><td>${escape_html(product.model)}</td><td>${escape_html(product.product_type_label || product.product_type_key || "—")}</td><td>`);
      if (product.graph_image_url) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a${attr("href", product.graph_image_url)} download="">Download graph</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="text-body-secondary">No graph</span>`);
      }
      $$renderer2.push(`<!--]--></td>`);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table></div> `);
    if (filteredProducts.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="row g-3 mt-2"><!--[-->`);
      const each_array_7 = ensure_array_like(filteredProducts.slice(0, 6));
      for (let $$index_9 = 0, $$length = each_array_7.length; $$index_9 < $$length; $$index_9++) {
        let product = each_array_7[$$index_9];
        $$renderer2.push(`<div class="col-12 col-lg-6"><details class="catalogue-spec-card svelte-1ddf6ke"><summary class="catalogue-spec-summary svelte-1ddf6ke"><span class="catalogue-spec-title svelte-1ddf6ke">${escape_html(product.model)} specifications</span> <span class="catalogue-spec-meta svelte-1ddf6ke">${escape_html(product.parameter_groups?.length ? `${product.parameter_groups.length} groups` : "Rich text only")}</span></summary> `);
        if (product.description_html) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="catalogue-richtext-block svelte-1ddf6ke"><p class="catalogue-section-label svelte-1ddf6ke">Description</p> <div class="catalogue-richtext-surface svelte-1ddf6ke">${html(product.description_html)}</div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (product.parameter_groups?.length) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="catalogue-spec-groups svelte-1ddf6ke"><!--[-->`);
          const each_array_8 = ensure_array_like(product.parameter_groups);
          for (let $$index_8 = 0, $$length2 = each_array_8.length; $$index_8 < $$length2; $$index_8++) {
            let group = each_array_8[$$index_8];
            $$renderer2.push(`<section class="catalogue-spec-group svelte-1ddf6ke"><p class="catalogue-section-label svelte-1ddf6ke">${escape_html(group.group_name)}</p> <dl class="catalogue-spec-list svelte-1ddf6ke"><!--[-->`);
            const each_array_9 = ensure_array_like(group.parameters);
            for (let $$index_7 = 0, $$length3 = each_array_9.length; $$index_7 < $$length3; $$index_7++) {
              let parameter = each_array_9[$$index_7];
              $$renderer2.push(`<dt class="svelte-1ddf6ke">${escape_html(parameter.parameter_name)}</dt> <dd class="svelte-1ddf6ke">`);
              if (parameter.value_string) {
                $$renderer2.push("<!--[0-->");
                $$renderer2.push(`${escape_html(parameter.value_string)}`);
              } else if (parameter.value_number != null) {
                $$renderer2.push("<!--[1-->");
                $$renderer2.push(`${escape_html(parameter.value_number)}${escape_html(parameter.unit ? ` ${parameter.unit}` : "")}`);
              } else {
                $$renderer2.push("<!--[-1-->");
                $$renderer2.push(`—`);
              }
              $$renderer2.push(`<!--]--></dd>`);
            }
            $$renderer2.push(`<!--]--></dl></section>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></details></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (filteredProducts.length === 0 && !loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-body-secondary">No products match the current filters. Try expanding the RPM/airflow/pressure
            range or adjusting your search.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (selectedIds.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm p-3"><h2 class="h5">Efficiency comparison</h2> <p class="text-body-secondary">Compare graph lines for the selected products.</p> <div class="mt-3">`);
      ECharts($$renderer2, { option: effChartOption, height: "750px" });
      $$renderer2.push(`<!----></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
