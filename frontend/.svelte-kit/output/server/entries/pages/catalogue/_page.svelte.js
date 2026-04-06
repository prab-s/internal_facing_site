import { s as store_get, h as head, a as attr, d as ensure_array_like, e as escape_html, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { g as getFans, a as getFanChartData, b as getEfficiencyCurvePoints, c as getChartTheme, t as theme, M as MOUNTING_STYLE_OPTIONS, D as DISCHARGE_TYPE_OPTIONS } from "../../../chunks/api.js";
import { E as ECharts } from "../../../chunks/ECharts.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let fans = [];
    let filteredFans = [];
    let fanRanges = {};
    let search = "";
    let mountingStyleFilter = "";
    let dischargeTypeFilter = "";
    let selectedIds = [];
    let effRawData = [];
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
    let error = "";
    function fanMatchesSelectedRanges(fan) {
      const range = fanRanges[fan.id];
      if (!range || rpmFilterMin == null || pressureFilterMin == null) return true;
      const rpmOverlaps = rpmFilterMin <= range.rpmMin && rpmFilterMax >= range.rpmMax;
      const pressureOverlaps = pressureFilterMin <= range.pressureMin && pressureFilterMax >= range.pressureMax;
      return rpmOverlaps && pressureOverlaps;
    }
    async function loadFans() {
      loading = true;
      error = "";
      try {
        const params = {};
        if (search) ;
        if (mountingStyleFilter) ;
        if (dischargeTypeFilter) ;
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
      pressureRangeMin = pressureRangeMax = null;
      await Promise.all(fans.map(async (fan) => {
        try {
          const { rpmPoints } = await getFanChartData(fan.id);
          const rpms = rpmPoints.map((p) => Number(p.rpm)).filter((v) => v != null && !Number.isNaN(v));
          const pressures = rpmPoints.map((p) => Number(p.pressure)).filter((v) => v != null && !Number.isNaN(v));
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
          name: `${fan.manufacturer} ${fan.model}`,
          type: "line",
          smooth: true,
          data: filtered.map((p) => [p.flow, p.efficiency_centre]).sort((a, b) => a[0] - b[0]),
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
          name: "Flow",
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
    {
      filteredFans = fans.length ? fans.filter(fanMatchesSelectedRanges) : [];
    }
    {
      if (filteredFans.length && selectedIds.length) {
        const allowed = new Set(filteredFans.map((f) => f.id));
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
        $$renderer4.push(`<title>Catalogue — Fan Graphs</title>`);
      });
    });
    $$renderer2.push(`<div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Browse &amp; Compare</p> <h1 class="h2 mb-2">Catalogue</h1> <p class="text-body-secondary">Search the library by product details and operating ranges, then compare
      efficiency curves for the fans you select.</p></div></div> <div class="row g-3"><div class="col-12 col-xl-3"><div class="vstack gap-3"><div class="card shadow-sm p-3"><h2 class="h5">Filters</h2> <div class="mb-3"><label class="form-label" for="catalogue-search">Search (manufacturer or model)</label> <input class="form-control" id="catalogue-search" type="text"${attr("value", search)} placeholder="e.g. Acme or AF-120"/></div> <div class="row g-3"><div class="col-12 col-md-6 col-xl-12"><label class="form-label" for="catalogue-mounting-style">Mounting Style</label> `);
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
        const each_array = ensure_array_like(MOUNTING_STYLE_OPTIONS);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let option = each_array[$$index];
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
        const each_array_1 = ensure_array_like(DISCHARGE_TYPE_OPTIONS);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let option = each_array_1[$$index_1];
          $$renderer3.option({ value: option }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(option)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div></div> `);
    if (rpmRangeMin != null && pressureRangeMin != null) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="row g-3 mt-1"><div class="col-12"><div class="border rounded p-3"><div class="d-flex justify-content-between align-items-center mb-2"><span class="fw-semibold">RPM range</span> <span class="fw-semibold">${escape_html(Math.round(Number(rpmFilterMin)))} - ${escape_html(Math.round(Number(rpmFilterMax)))}</span></div> <div class="row g-2"><div class="col-6"><label class="form-label" for="rpm-filter-min">Min RPM</label> <input id="rpm-filter-min" class="form-control" type="number" step="10"${attr("min", rpmRangeMin)}${attr("max", rpmRangeMax)}${attr("value", rpmFilterMin)}/></div> <div class="col-6"><label class="form-label" for="rpm-filter-max">Max RPM</label> <input id="rpm-filter-max" class="form-control" type="number" step="10"${attr("min", rpmRangeMin)}${attr("max", rpmRangeMax)}${attr("value", rpmFilterMax)}/></div> <div class="col-12"><p class="small text-body-secondary mb-0">Available range: ${escape_html(Math.round(Number(rpmRangeMin)))} to ${escape_html(Math.round(Number(rpmRangeMax)))}</p></div></div></div></div> <div class="col-12"><div class="border rounded p-3"><div class="d-flex justify-content-between align-items-center mb-2"><span class="fw-semibold">Pressure range</span> <span class="fw-semibold">${escape_html(Math.round(Number(pressureFilterMin)))} - ${escape_html(Math.round(Number(pressureFilterMax)))}</span></div> <div class="row g-2"><div class="col-6"><label class="form-label" for="pressure-filter-min">Min Pressure</label> <input id="pressure-filter-min" class="form-control" type="number" step="5"${attr("min", pressureRangeMin)}${attr("max", pressureRangeMax)}${attr("value", pressureFilterMin)}/></div> <div class="col-6"><label class="form-label" for="pressure-filter-max">Max Pressure</label> <input id="pressure-filter-max" class="form-control" type="number" step="5"${attr("min", pressureRangeMin)}${attr("max", pressureRangeMax)}${attr("value", pressureFilterMax)}/></div> <div class="col-12"><p class="small text-body-secondary mb-0">Available range: ${escape_html(Math.round(Number(pressureRangeMin)))} to ${escape_html(Math.round(Number(pressureRangeMax)))}</p></div></div></div></div></div>`);
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
    $$renderer2.push(`<!--]--></div></div> <div class="col-12 col-xl-9"><div class="vstack gap-3"><div class="card shadow-sm p-3"><h2 class="h5">Results</h2> <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3"><p class="mb-0">Select one or more fans to compare their efficiency curves below.</p> <button class="btn btn-outline-secondary btn-sm">extra ${escape_html(">")}</button></div> <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Select</th><th>Image</th><th>Manufacturer</th><th>Model</th><th>Notes</th><th>Graph</th>`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></tr></thead><tbody><!--[-->`);
    const each_array_2 = ensure_array_like(filteredFans);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let fan = each_array_2[$$index_2];
      $$renderer2.push(`<tr><td><input class="form-check-input" type="checkbox"${attr("checked", selectedIds.includes(fan.id), true)}/></td><td style="width: 160px;">`);
      if (fan.primary_product_image_url) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<img class="img-fluid rounded border" style="width: 140px; height: 100px; object-fit: cover;"${attr("src", fan.primary_product_image_url)}${attr("alt", `${fan.manufacturer} ${fan.model}`)}/>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="text-body-secondary">No image</span>`);
      }
      $$renderer2.push(`<!--]--></td><td>${escape_html(fan.manufacturer)}</td><td>${escape_html(fan.model)}</td><td>${escape_html(fan.notes || "—")}</td><td>`);
      if (fan.graph_image_url) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a${attr("href", fan.graph_image_url)} download="">Download graph</a>`);
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
    if (filteredFans.length === 0 && !loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-body-secondary">No fans match the current filters. Try expanding the RPM/pressure
            range or adjusting your search.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (selectedIds.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm p-3"><h2 class="h5">Efficiency comparison</h2> <p class="text-body-secondary">Compare efficiency lines for the selected fans.</p> <div class="mt-3">`);
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
