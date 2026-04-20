import { s as store_get, h as head, d as ensure_array_like, e as escape_html, a as attr, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { t as theme, e as emptyProductForm } from "../../../chunks/config.js";
import "echarts";
import { g as getChartTheme, b as buildFullChartOption, F as FULL_CHART_LINE_DEFINITIONS } from "../../../chunks/fullChart.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let productTypes = [];
    let seriesRecords = [];
    let rpmLines = [];
    let rpmPoints = [];
    let efficiencyPoints = [];
    let successMessages = [];
    Promise.resolve();
    let refreshingTemplates = false;
    function defaultGraphStyleForm() {
      return {
        band_graph_background_color: "#ffffff",
        band_graph_label_text_color: "#000000",
        band_graph_faded_opacity: 0.18,
        band_graph_permissible_label_color: "#000000"
      };
    }
    let graphStyleForm = defaultGraphStyleForm();
    let productForm = emptyProductForm();
    function getCurrentProductType() {
      return productTypes.find((item) => item.key === productForm.product_type_key) || null;
    }
    function productSupportsGraphOverlays() {
      return getCurrentProductType()?.supports_graph_overlays ?? true;
    }
    function productSupportsBandGraphStyle() {
      return getCurrentProductType()?.supports_band_graph_style ?? true;
    }
    function getCurrentGraphConfig() {
      const productType = getCurrentProductType();
      return productType ? {
        graph_kind: productType.graph_kind,
        supports_graph_overlays: productType.supports_graph_overlays,
        supports_band_graph_style: productType.supports_band_graph_style,
        graph_line_value_label: productType.graph_line_value_label,
        graph_line_value_unit: productType.graph_line_value_unit,
        graph_x_axis_label: productType.graph_x_axis_label,
        graph_x_axis_unit: productType.graph_x_axis_unit,
        graph_y_axis_label: productType.graph_y_axis_label,
        graph_y_axis_unit: productType.graph_y_axis_unit
      } : null;
    }
    function graphXAxisLabel() {
      return getCurrentProductType()?.graph_x_axis_label || "Airflow";
    }
    function graphYAxisLabel() {
      return getCurrentProductType()?.graph_y_axis_label || "Pressure";
    }
    function currentOverlayLineDefinitions() {
      return productSupportsGraphOverlays() ? FULL_CHART_LINE_DEFINITIONS : [];
    }
    onDestroy(() => {
    });
    function buildMapChartOption() {
      const chartTheme = getChartTheme(store_get($$store_subs ??= {}, "$theme", theme));
      const overlayDefinitions = currentOverlayLineDefinitions();
      buildFullChartOption({
        rpmLines,
        rpmPoints,
        efficiencyPoints,
        chartTheme,
        title: `${graphXAxisLabel()} vs ${graphYAxisLabel()} (drag points to edit)`,
        graphConfig: getCurrentGraphConfig(),
        includeDragHandles: true,
        showRpmBandShading: productSupportsBandGraphStyle() ? productForm.show_rpm_band_shading : false,
        showSecondaryAxis: productSupportsGraphOverlays(),
        flowAxisMaxOverride: null,
        pressureAxisMaxOverride: null,
        adaptGraphBackgroundToTheme: true,
        graphStyle: graphStyleForm,
        tooltip: {
          trigger: "item",
          formatter: (params) => {
            const rawValue = Array.isArray(params.value) ? params.value : params.value?.value;
            const [airflow, second] = rawValue || [];
            const matchingDefinition = overlayDefinitions.find((definition) => definition.label === params.seriesName);
            if (matchingDefinition) {
              return `${matchingDefinition.tooltipLabel}: ${second}<br/>${graphXAxisLabel().toLowerCase()}: ${airflow}`;
            }
            return `${params.seriesName}<br/>${graphXAxisLabel().toLowerCase()}: ${airflow}<br/>${graphYAxisLabel().toLowerCase()}: ${second}`;
          }
        }
      });
    }
    {
      store_get($$store_subs ??= {}, "$theme", theme);
      buildMapChartOption();
    }
    head("mb2odu", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Editor — Internal Facing</title>`);
      });
    });
    if (successMessages.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="success-toast shadow-lg svelte-mb2odu" role="status" aria-live="polite" aria-atomic="true"><div class="alert alert-success mb-0 success-toast-alert svelte-mb2odu"><!--[-->`);
      const each_array = ensure_array_like(successMessages);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let message = each_array[$$index];
        $$renderer2.push(`<div>${escape_html(message)}</div>`);
      }
      $$renderer2.push(`<!--]--> <!---->`);
      {
        $$renderer2.push(`<div class="success-toast-progress svelte-mb2odu"></div>`);
      }
      $$renderer2.push(`<!----></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Create &amp; Maintain</p> <h1>Editor</h1> <p class="text-body-secondary">Manage product records, product images, graph lines, and all editable graph data from a single workspace.</p> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingTemplates, true)}>${escape_html("Refresh template library")}</button></div></div> <div class="card shadow-sm col-12 col-xxl-10 mx-auto mb-3"><div class="card-body"><h2 class="h5">Library Management</h2> <p class="text-body-secondary mb-3">Use these shortcuts to manage product types and series records without leaving the editor.</p> <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-primary">Create new product type</button> <button class="btn btn-outline-primary"${attr("disabled", productTypes.length === 0, true)}>Edit existing product type</button> <button class="btn btn-outline-primary">Create new series</button> <button class="btn btn-outline-primary"${attr("disabled", seriesRecords.length === 0, true)}>Edit existing series</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm col-12 col-xl-8 mx-auto"><div class="card-body"><h2 class="h5">Editor Actions</h2> <p>Choose whether you want to create a new product or open an existing one for editing.</p> <div class="d-flex flex-wrap gap-2"><button class="btn btn-primary">Create New Product</button> <button class="btn btn-outline-secondary">Edit Existing Product</button></div></div></div>`);
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
