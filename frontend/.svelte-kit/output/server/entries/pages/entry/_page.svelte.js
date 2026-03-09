import { c as create_ssr_component, e as escape } from "../../../chunks/ssr.js";
import { g as getFans, a as getMapPoints, b as getFan } from "../../../chunks/api.js";
import "echarts";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let fans = [];
  let selectedFanId = null;
  let currentFan = null;
  let mapPoints = [];
  let error = "";
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
  loadFans();
  function buildMapChartOption() {
    const byRpm = {};
    for (const p of mapPoints) {
      const key = String(p.rpm ?? "");
      if (!byRpm[key]) byRpm[key] = [];
      byRpm[key].push({
        value: [p.flow ?? 0, p.pressure ?? 0],
        id: p.id,
        rpm: p.rpm
      });
    }
    const rpms = Object.keys(byRpm).filter((k) => k !== "").map((r) => Number(r)).filter((r) => !Number.isNaN(r)).sort((a, b) => a - b);
    const series = [];
    for (const [idx, rpm] of rpms.entries()) {
      const pts = byRpm[String(rpm)] ?? [];
      const hasMultiplePoints = pts.length > 1;
      const lineData = pts.map((p) => [p.value[0], p.value[1]]);
      const scatterData = pts.map((p) => ({
        value: [p.value[0], p.value[1]],
        id: p.id,
        rpm: p.rpm
      }));
      series.push({
        name: `${rpm} rpm`,
        type: "line",
        smooth: hasMultiplePoints,
        showSymbol: false,
        data: lineData,
        lineStyle: { width: hasMultiplePoints ? 2 : 0 },
        emphasis: { focus: "series" },
        z: idx * 2
      });
      series.push({
        name: `${rpm} rpm`,
        type: "scatter",
        data: scatterData,
        symbol: "circle",
        symbolSize: 10,
        // adjust to preference (smaller = tighter touching)
        draggable: true,
        showInLegend: false,
        emphasis: {
          focus: "series",
          scale: true,
          scaleSize: 1.2,
          itemStyle: { borderColor: "#fff", borderWidth: 2 }
        },
        z: idx * 2 + 1
      });
    }
    const effPts = mapPoints.filter((p) => p.efficiency != null).map((p) => [p.flow ?? 0, p.efficiency ?? 0]).sort((a, b) => a[0] - b[0]);
    if (effPts.length) {
      series.push({
        name: "Efficiency",
        type: "line",
        smooth: false,
        data: effPts,
        showSymbol: false,
        yAxisIndex: 1,
        itemStyle: { color: "#f7768e" },
        lineStyle: { width: 2 },
        z: 999
      });
      const effData = mapPoints.filter((p) => p.efficiency != null).map((p) => ({
        value: [p.flow ?? 0, p.efficiency ?? 0],
        id: p.id
      }));
      series.push({
        name: "Efficiency",
        type: "scatter",
        data: effData,
        draggable: true,
        showInLegend: false,
        itemStyle: { color: "#f7768e" },
        symbolSize: 10,
        // adjust to preference
        emphasis: {
          focus: "series",
          scale: true,
          scaleSize: 1.2,
          itemStyle: { borderColor: "#fff", borderWidth: 2 }
        },
        yAxisIndex: 1,
        z: 1e3
      });
    }
  }
  {
    if (selectedFanId) {
      loadPoints();
    }
  }
  {
    if (mapPoints) {
      buildMapChartOption();
    }
  }
  return `${$$result.head += `<!-- HEAD_svelte-1ugrfdb_START -->${$$result.title = `<title>Data entry — Fan Graphs</title>`, ""}<!-- HEAD_svelte-1ugrfdb_END -->`, ""} <div class="card"><h1 data-svelte-h="svelte-p31554">Data entry</h1> ${error ? `<p class="error">${escape(error)}</p>` : ``} ${``}</div> ${`<div class="card"><h2 data-svelte-h="svelte-nu7tb1">Get Started</h2> <p data-svelte-h="svelte-1flk6rq">What would you like to do?</p> <div class="button-group"><button data-svelte-h="svelte-1feh26i">Create New Fan</button> <button data-svelte-h="svelte-1s9ii8">Edit Existing Fan</button></div></div>`} ${``} ${``} ${``}`;
});
export {
  Page as default
};
