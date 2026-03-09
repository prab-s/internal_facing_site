import { c as create_ssr_component, d as add_attribute, e as escape, f as each, v as validate_component } from "../../../chunks/ssr.js";
import { g as getFans, a as getMapPoints } from "../../../chunks/api.js";
import { E as ECharts } from "../../../chunks/ECharts.js";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let fans = [];
  let filteredFans = [];
  let fanRanges = {};
  let search = "";
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
  async function loadFans() {
    loading = true;
    error = "";
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
    await Promise.all(fans.map(async (fan) => {
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
      const filtered = points.filter((p) => p.efficiency != null).filter((p) => {
        const rpm = Number(p.rpm);
        const press = Number(p.pressure);
        return rpm >= Number(rpmFilterMin) && rpm <= Number(rpmFilterMax) && press >= Number(pressureFilterMin) && press <= Number(pressureFilterMax);
      });
      if (!filtered.length) continue;
      series.push({
        name: `${fan.manufacturer} ${fan.model}`,
        type: "line",
        smooth: true,
        data: filtered.map((p) => [p.flow, p.efficiency]).sort((a, b) => a[0] - b[0]),
        symbol: "circle",
        symbolSize: 6
      });
    }
    effChartOption = series.length ? {
      backgroundColor: "#1a1b26",
      title: {
        text: "Efficiency comparison (filtered)",
        left: "center",
        textStyle: { color: "#c0caf5" }
      },
      tooltip: { trigger: "axis" },
      legend: {
        bottom: 0,
        type: "scroll",
        textStyle: {
          color: "#c0caf5",
          fontWeight: "bold",
          fontSize: 16
        }
      },
      grid: {
        left: "12%",
        right: "8%",
        top: "15%",
        bottom: "22%"
      },
      xAxis: {
        type: "value",
        name: "Flow",
        nameTextStyle: { color: "#c0caf5" },
        axisLabel: { color: "#c0caf5" }
      },
      yAxis: {
        type: "value",
        name: "Efficiency (%)",
        nameTextStyle: { color: "#c0caf5" },
        axisLabel: { color: "#c0caf5" }
      },
      series
    } : {};
  }
  loadFans();
  {
    if (fans.length) {
      filteredFans = fans.filter((fan) => {
        const range = fanRanges[fan.id];
        if (!range || rpmFilterMin == null || pressureFilterMin == null) return true;
        return range.rpmMax >= rpmFilterMin && range.rpmMin <= rpmFilterMax && range.pressureMax >= pressureFilterMin && range.pressureMin <= pressureFilterMax;
      });
    }
  }
  {
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
  }
  {
    if (effRawData.length) {
      buildEfficiencyChartOption();
    }
  }
  return `${$$result.head += `<!-- HEAD_svelte-1mihcxq_START -->${$$result.title = `<title>Catalogue — Fan Graphs</title>`, ""}<!-- HEAD_svelte-1mihcxq_END -->`, ""} <div class="card" data-svelte-h="svelte-ii7np1"><h1>Catalogue</h1></div> <div class="card"><h2 data-svelte-h="svelte-5seguc">Filter</h2> <div class="form-group"><label data-svelte-h="svelte-167ptli">Search (manufacturer or model)</label> <input type="text" placeholder="e.g. Acme or AF-120"${add_attribute("value", search, 0)}></div> ${rpmRangeMin != null && pressureRangeMin != null ? `<div class="grid-2"><div><label>RPM range: ${escape(Math.round(Number(rpmFilterMin)))} – ${escape(Math.round(Number(rpmFilterMax)))}</label> <input type="range"${add_attribute("min", rpmRangeMin, 0)}${add_attribute("max", rpmRangeMax, 0)} step="10"${add_attribute("value", rpmFilterMin, 0)}> <input type="range"${add_attribute("min", rpmRangeMin, 0)}${add_attribute("max", rpmRangeMax, 0)} step="10"${add_attribute("value", rpmFilterMax, 0)}></div> <div><label>Pressure range: ${escape(Math.round(Number(pressureFilterMin)))} – ${escape(Math.round(Number(pressureFilterMax)))}</label> <input type="range"${add_attribute("min", pressureRangeMin, 0)}${add_attribute("max", pressureRangeMax, 0)} step="5"${add_attribute("value", pressureFilterMin, 0)}> <input type="range"${add_attribute("min", pressureRangeMin, 0)}${add_attribute("max", pressureRangeMax, 0)} step="5"${add_attribute("value", pressureFilterMax, 0)}></div></div>` : ``} <button ${loading ? "disabled" : ""}>Search</button></div> ${error ? `<p class="error">${escape(error)}</p>` : ``} <div class="card"><h2 data-svelte-h="svelte-s6ksa4">Results</h2> <div class="results-header"><p data-svelte-h="svelte-1ozfav6">Select one or more fans to compare their efficiency curves below.</p> <button class="button">extra ${escape(">")}</button></div> <table><thead><tr><th data-svelte-h="svelte-1gtlf5y">Select</th> <th data-svelte-h="svelte-1on9yxf">Manufacturer</th> <th data-svelte-h="svelte-5oxuep">Model</th> <th data-svelte-h="svelte-dpb67d">Notes</th> ${``}</tr></thead> <tbody>${each(filteredFans, (fan) => {
    return `<tr><td><input type="checkbox" ${selectedIds.includes(fan.id) ? "checked" : ""}></td> <td>${escape(fan.manufacturer)}</td> <td>${escape(fan.model)}</td> <td>${escape(fan.notes || "—")}</td> ${``} </tr>`;
  })}</tbody></table> ${filteredFans.length === 0 && !loading ? `<p class="muted" data-svelte-h="svelte-1g6buka">No fans match the current filters. Try expanding the RPM/pressure range or adjusting your search.</p>` : ``}</div> ${selectedIds.length > 0 ? `<div class="card"><h2 data-svelte-h="svelte-1n2xpog">Efficiency comparison</h2> <p class="muted" data-svelte-h="svelte-1w7i904">Compare efficiency lines for the selected fans.</p> <div class="chart-container">${validate_component(ECharts, "ECharts").$$render($$result, { option: effChartOption, height: "750px" }, {}, {})}</div></div>` : ``}`;
});
export {
  Page as default
};
