import { s as store_get, h as head, u as unsubscribe_stores, e as escape_html } from "../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { g as getFans, c as getChartTheme, t as theme, d as getRpmLines, e as getRpmPoints, f as getEfficiencyPoints, h as getFan, i as emptyFanForm } from "../../../chunks/api.js";
import "echarts";
import { b as buildFullChartOption, R as RPM_BAND_FALLBACK_COLORS, F as FULL_CHART_LINE_DEFINITIONS } from "../../../chunks/fullChart.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let fans = [];
    let selectedFanId = null;
    let currentFan = null;
    let rpmLines = [];
    let rpmPoints = [];
    let efficiencyPoints = [];
    let error = "";
    let productImages = [];
    let chartAddTarget = "";
    let originalRpmPointIds = [];
    let originalEfficiencyPointIds = [];
    Promise.resolve();
    function defaultGraphStyleForm() {
      return {
        band_graph_background_color: "#ffffff",
        band_graph_label_text_color: "#000000"
      };
    }
    let graphStyleForm = defaultGraphStyleForm();
    let fanForm = emptyFanForm();
    let rpmPointForm = { rpm_line_id: "", airflow: "", pressure: "" };
    function normalizeOptionalColor(value) {
      const normalized = String(value ?? "").trim();
      return normalized || "";
    }
    function applyRpmPointSort(points) {
      return points;
    }
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
        const [nextRpmLines, nextRpmPoints, nextEfficiencyPoints, nextFan] = await Promise.all([
          getRpmLines(selectedFanId),
          getRpmPoints(selectedFanId),
          getEfficiencyPoints(selectedFanId),
          getFan(selectedFanId)
        ]);
        rpmLines = nextRpmLines.map((line, index) => ({
          ...line,
          band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
        }));
        rpmPoints = applyRpmPointSort(nextRpmPoints);
        efficiencyPoints = nextEfficiencyPoints;
        originalRpmPointIds = nextRpmPoints.map((point) => point.id);
        originalEfficiencyPointIds = nextEfficiencyPoints.map((point) => point.id);
        currentFan = nextFan;
        graphStyleForm = {
          band_graph_background_color: normalizeOptionalColor(nextFan?.band_graph_background_color) || "#ffffff",
          band_graph_label_text_color: normalizeOptionalColor(nextFan?.band_graph_label_text_color) || "#000000"
        };
        productImages = currentFan.product_images || [];
        const validTargets = /* @__PURE__ */ new Set([
          ...nextRpmLines.map((line) => `rpm:${line.id}`),
          ...FULL_CHART_LINE_DEFINITIONS.map((definition) => `efficiency:${definition.key}`)
        ]);
        if (!chartAddTarget || !validTargets.has(chartAddTarget)) {
          chartAddTarget = "off";
        }
        if (!rpmPointForm.rpm_line_id && nextRpmLines.length) {
          rpmPointForm = { ...rpmPointForm, rpm_line_id: String(nextRpmLines[0].id) };
        }
      } catch (e) {
        error = e.message;
      }
    }
    loadFans();
    function buildMapChartOption() {
      const chartTheme = getChartTheme(store_get($$store_subs ??= {}, "$theme", theme));
      buildFullChartOption({
        rpmLines,
        rpmPoints,
        efficiencyPoints,
        chartTheme,
        title: "Map points (drag points to edit)",
        includeDragHandles: true,
        showRpmBandShading: fanForm.show_rpm_band_shading,
        flowAxisMaxOverride: null,
        pressureAxisMaxOverride: null,
        graphStyle: graphStyleForm,
        tooltip: {
          trigger: "item",
          formatter: (params) => {
            const rawValue = Array.isArray(params.value) ? params.value : params.value?.value;
            const [airflow, second] = rawValue || [];
            const matchingDefinition = FULL_CHART_LINE_DEFINITIONS.find((definition) => definition.label === params.seriesName);
            if (matchingDefinition) {
              return `${matchingDefinition.tooltipLabel}: ${second}<br/>airflow: ${airflow}`;
            }
            return `${params.seriesName}<br/>airflow: ${airflow}<br/>pressure: ${second}`;
          }
        }
      });
    }
    if (selectedFanId) {
      loadPoints();
    }
    {
      store_get($$store_subs ??= {}, "$theme", theme);
      buildMapChartOption();
    }
    head("13q5ji3", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Data entry — Fan Graphs</title>`);
      });
    });
    $$renderer2.push(`<div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Create &amp; Maintain</p> <h1>Data entry</h1> <p class="text-body-secondary">Manage fan records, product images, RPM lines, and all editable map data from a single workspace.</p> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-danger mb-2">${escape_html(error)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm col-12 col-xl-8 mx-auto"><div class="card-body"><h2 class="h5">Get Started</h2> <p>What would you like to do?</p> <div class="d-flex flex-wrap gap-2"><button class="btn btn-primary">Create New Fan</button> <button class="btn btn-outline-secondary">Edit Existing Fan</button></div></div></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
