import { s as store_get, h as head, d as ensure_array_like, e as escape_html, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { g as getProducts, a as getProductTypes, d as getChartTheme, t as theme, e as emptyFanForm, f as getRpmLines, h as getRpmPoints, i as getEfficiencyPoints, j as getProduct, G as GLOBAL_UNIT_OPTIONS } from "../../../chunks/api.js";
import "echarts";
import { b as buildFullChartOption, F as FULL_CHART_LINE_DEFINITIONS, R as RPM_BAND_FALLBACK_COLORS } from "../../../chunks/fullChart.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let products = [];
    let productTypes = [];
    let selectedProductId = null;
    let currentProduct = null;
    let rpmLines = [];
    let rpmPoints = [];
    let efficiencyPoints = [];
    let error = "";
    let successMessages = [];
    let productImages = [];
    let chartAddTarget = "";
    let originalRpmPointIds = [];
    let originalEfficiencyPointIds = [];
    Promise.resolve();
    function defaultGraphStyleForm() {
      return {
        band_graph_background_color: "#ffffff",
        band_graph_label_text_color: "#000000",
        band_graph_faded_opacity: 0.18,
        band_graph_permissible_label_color: "#000000"
      };
    }
    let graphStyleForm = defaultGraphStyleForm();
    let parameterGroups = [];
    let productForm = emptyFanForm();
    let rpmPointForm = { rpm_line_id: "", airflow: "", pressure: "" };
    function createParameterDraft(parameter = {}) {
      return {
        id: parameter.id ?? null,
        _pending_delete: parameter._pending_delete ?? false,
        parameter_name: parameter.parameter_name ?? "",
        value_type: parameter.value_string != null && parameter.value_string !== "" ? "string" : parameter.value_number != null ? "number" : "string",
        value_string: parameter.value_string ?? "",
        value_number: parameter.value_number ?? "",
        unit: parameter.unit ?? "",
        custom_unit: parameter.unit && !GLOBAL_UNIT_OPTIONS.includes(parameter.unit) ? parameter.unit : ""
      };
    }
    function clonePresetGroups(productTypeKey) {
      const productType = productTypes.find((item) => item.key === productTypeKey);
      if (!productType) return [];
      return (productType.parameter_group_presets ?? []).map((group) => ({
        id: null,
        group_name: group.group_name,
        parameters: (group.parameter_presets ?? []).map((parameter) => createParameterDraft({
          parameter_name: parameter.parameter_name,
          unit: parameter.preferred_unit ?? ""
        }))
      }));
    }
    function resetProductEditor(productTypeKey = "fan") {
      productForm = { ...emptyFanForm(), product_type_key: productTypeKey };
      graphStyleForm = defaultGraphStyleForm();
      parameterGroups = clonePresetGroups(productTypeKey);
    }
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
    function normalizeOptionalColor(value) {
      const normalized = String(value ?? "").trim();
      return normalized || "";
    }
    function applyRpmPointSort(points) {
      return points;
    }
    onDestroy(() => {
    });
    async function loadProducts() {
      try {
        products = await getProducts();
        if (products.length && !selectedProductId) selectedProductId = products[0].id;
      } catch (e) {
        error = e.message;
      }
    }
    async function loadProductTypes() {
      try {
        productTypes = await getProductTypes();
        if (!productForm.product_type_key && productTypes.length) {
          resetProductEditor(productTypes[0].key);
        } else if (!parameterGroups.length && productForm.product_type_key) {
          parameterGroups = clonePresetGroups(productForm.product_type_key);
        }
      } catch (e) {
        error = e.message;
      }
    }
    async function loadProductData() {
      if (!selectedProductId) return;
      try {
        const [
          nextRpmLines,
          nextRpmPoints,
          nextEfficiencyPoints,
          nextProduct
        ] = await Promise.all([
          getRpmLines(selectedProductId),
          getRpmPoints(selectedProductId),
          getEfficiencyPoints(selectedProductId),
          getProduct(selectedProductId)
        ]);
        rpmLines = nextRpmLines.map((line, index) => ({
          ...line,
          band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
        }));
        rpmPoints = applyRpmPointSort(nextRpmPoints);
        efficiencyPoints = nextEfficiencyPoints;
        originalRpmPointIds = nextRpmPoints.map((point) => point.id);
        originalEfficiencyPointIds = nextEfficiencyPoints.map((point) => point.id);
        currentProduct = nextProduct;
        const nextProductType = productTypes.find((item) => item.key === (nextProduct?.product_type_key || "fan")) || null;
        const overlayDefinitions = nextProductType?.supports_graph_overlays === false ? [] : FULL_CHART_LINE_DEFINITIONS;
        graphStyleForm = {
          band_graph_background_color: normalizeOptionalColor(nextProduct?.band_graph_background_color) || "#ffffff",
          band_graph_label_text_color: normalizeOptionalColor(nextProduct?.band_graph_label_text_color) || "#000000",
          band_graph_faded_opacity: nextProduct?.band_graph_faded_opacity != null && !Number.isNaN(Number(nextProduct.band_graph_faded_opacity)) ? Number(nextProduct.band_graph_faded_opacity) : 0.18,
          band_graph_permissible_label_color: normalizeOptionalColor(nextProduct?.band_graph_permissible_label_color) || normalizeOptionalColor(nextProduct?.band_graph_label_text_color) || "#000000"
        };
        productImages = currentProduct.product_images || [];
        const validTargets = /* @__PURE__ */ new Set([
          ...nextRpmLines.map((line) => `rpm:${line.id}`),
          ...overlayDefinitions.map((definition) => `efficiency:${definition.key}`)
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
    loadProducts();
    loadProductTypes();
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
        showRpmBandShading: productSupportsBandGraphStyle() ? productForm.show_rpm_band_shading ?? true : false,
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
    if (selectedProductId) {
      loadProductData();
    }
    {
      store_get($$store_subs ??= {}, "$theme", theme);
      buildMapChartOption();
    }
    head("13q5ji3", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Data entry — Internal Facing</title>`);
      });
    });
    if (successMessages.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="success-toast shadow-lg svelte-13q5ji3" role="status" aria-live="polite" aria-atomic="true"><div class="alert alert-success mb-0 success-toast-alert svelte-13q5ji3"><!--[-->`);
      const each_array = ensure_array_like(successMessages);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let message = each_array[$$index];
        $$renderer2.push(`<div>${escape_html(message)}</div>`);
      }
      $$renderer2.push(`<!--]--> <!---->`);
      {
        $$renderer2.push(`<div class="success-toast-progress svelte-13q5ji3"></div>`);
      }
      $$renderer2.push(`<!----></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Create &amp; Maintain</p> <h1>Data entry</h1> <p class="text-body-secondary">Manage product records, product images, graph lines, and all editable graph data from a single workspace.</p> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-danger mb-2">${escape_html(error)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm col-12 col-xl-8 mx-auto"><div class="card-body"><h2 class="h5">Get Started</h2> <p>What would you like to do?</p> <div class="d-flex flex-wrap gap-2"><button class="btn btn-primary">Create New Product</button> <button class="btn btn-outline-secondary">Edit Existing Product</button></div></div></div>`);
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
