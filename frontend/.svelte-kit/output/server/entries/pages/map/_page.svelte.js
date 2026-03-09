import { c as create_ssr_component, d as add_attribute, f as each, e as escape, v as validate_component } from "../../../chunks/ssr.js";
import { g as getFans, a as getMapPoints } from "../../../chunks/api.js";
import { E as ECharts } from "../../../chunks/ECharts.js";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let fans = [];
  let selectedFanId = null;
  let mapPoints = [];
  let chartOption = {};
  let hasEfficiency = false;
  let loading = false;
  let error = "";
  let chartInstance = null;
  let showCursorTooltip = false;
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
    return { trigger: "axis" };
  }
  function buildChartOptions() {
    const byRpm = {};
    for (const p of mapPoints) {
      const key = String(p.rpm);
      if (!byRpm[key]) byRpm[key] = [];
      byRpm[key].push([p.flow, p.pressure]);
    }
    for (const k of Object.keys(byRpm)) {
      byRpm[k].sort((a, b) => a[0] - b[0]);
    }
    const rpms = Object.keys(byRpm).map((r) => Number(r)).filter((r) => !Number.isNaN(r)).sort((a, b) => a - b);
    const series = rpms.map((rpm, idx) => {
      const pts = byRpm[String(rpm)] ?? [];
      const hasMultiplePoints = pts.length > 1;
      const z = rpms.length - idx;
      return {
        name: `${rpm} rpm`,
        type: "line",
        smooth: hasMultiplePoints,
        data: pts,
        showSymbol: !hasMultiplePoints,
        // Show symbols for single points
        symbolSize: hasMultiplePoints ? 0 : 8,
        // Larger symbols for single points
        lineStyle: {
          width: hasMultiplePoints ? 1 : 0
          // Hide line for single points
        },
        areaStyle: hasMultiplePoints ? { opacity: 0.48 } : void 0,
        // Only show area for bands
        emphasis: { focus: "series" },
        z
      };
    });
    const effPts = mapPoints.filter((p) => p.efficiency != null).map((p) => [p.flow, p.efficiency]).sort((a, b) => a[0] - b[0]);
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
        z: 999
      });
    }
    chartOption = {
      backgroundColor: "#1a1b26",
      title: {
        text: "Fan map: Flow vs pressure by RPM",
        left: "center",
        textStyle: { color: "#c0caf5" }
      },
      tooltip: getTooltipOption(),
      legend: {
        bottom: 0,
        type: "scroll",
        textStyle: { color: "#c0caf5" }
      },
      grid: {
        left: "12%",
        right: "8%",
        top: "15%",
        bottom: "20%"
      },
      xAxis: {
        type: "value",
        name: "Flow",
        nameTextStyle: { color: "#c0caf5" },
        axisLabel: { color: "#c0caf5" }
      },
      yAxis: [
        {
          type: "value",
          name: "Pressure",
          nameTextStyle: { color: "#c0caf5" },
          axisLabel: { color: "#c0caf5" }
        },
        {
          type: "value",
          name: "Efficiency (%)",
          nameTextStyle: { color: "#c0caf5" },
          axisLabel: { color: "#c0caf5" },
          min: 0,
          max: 100
        }
      ],
      series
    };
  }
  loadFans();
  function setupCursorTooltip() {
    if (!chartInstance || cursorTooltipAttached) return;
    const zr = chartInstance.getZr();
    if (!zr) return;
    cursorTooltipAttached = true;
    zr.on("mousemove", (evt) => {
      return;
    });
    zr.on("mouseout", () => {
      return;
    });
  }
  {
    if (selectedFanId) {
      loadMap();
    }
  }
  {
    if (chartInstance) {
      chartInstance.setOption({ tooltip: getTooltipOption() });
    }
  }
  return `${$$result.head += `<!-- HEAD_svelte-1qnouqk_START -->${$$result.title = `<title>Fan map — Fan Graphs</title>`, ""}<!-- HEAD_svelte-1qnouqk_END -->`, ""} <div class="card" data-svelte-h="svelte-16lbihf"><h1>Fan map</h1></div> <div class="card"><label data-svelte-h="svelte-z4yiwn">Select fan</label> <select ${loading ? "disabled" : ""}><option${add_attribute("value", null, 0)} data-svelte-h="svelte-1hxxng1">— Select —</option>${each(fans, (fan) => {
    return `<option${add_attribute("value", fan.id, 0)}>${escape(fan.manufacturer)} ${escape(fan.model)}</option>`;
  })}</select></div> ${error ? `<p class="error">${escape(error)}</p>` : ``} ${selectedFanId ? `<div class="card"><h2 data-svelte-h="svelte-sqw1c4">Flow vs pressure (RPM bands)</h2> <p class="muted" data-svelte-h="svelte-1iy5gd7">Each shaded band is one RPM level. Efficiency is shown as a line if
      available. TODO: units could be standardised (e.g. m³/s, Pa) in backend.</p> <div class="chart-container"><label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;"><input type="checkbox"${add_attribute("checked", showCursorTooltip, 1)}>
        Show tooltip at mouse position (instead of nearest point)</label> ${validate_component(ECharts, "ECharts").$$render(
    $$result,
    {
      option: chartOption,
      height: "750px",
      onChartReady: (c) => {
        chartInstance = c;
        setupCursorTooltip();
      }
    },
    {},
    {}
  )}</div></div> ${selectedFanId && mapPoints.length === 0 && !loading ? `<p class="muted" data-svelte-h="svelte-1wm4v67">No map points for this fan. Add map points on the Data entry page.</p>` : ``}` : ``}`;
});
export {
  Page as default
};
