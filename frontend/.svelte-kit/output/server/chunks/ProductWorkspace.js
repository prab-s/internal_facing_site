import { f as fallback, a as attr, e as escape_html, c as slot, d as bind_props, s as store_get, u as unsubscribe_stores, i as ensure_array_like, b as attr_class, j as attr_style } from "./index2.js";
import { o as onDestroy } from "./index-server.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
import { t as theme, e as emptyProductForm, g as getProduct, a as getRpmLines, b as getRpmPoints, c as getEfficiencyPoints, G as GLOBAL_UNIT_OPTIONS } from "./api.js";
import { F as FULL_CHART_LINE_DEFINITIONS, R as RPM_BAND_FALLBACK_COLORS, g as getChartTheme, b as buildFullChartOption, E as ECharts } from "./fullChart.js";
import { S as SeriesNamesBadgeList } from "./SeriesNamesBadgeList.js";
function AccordionCard($$renderer, $$props) {
  let title = fallback($$props["title"], "");
  let description = fallback($$props["description"], "");
  let startOpen = fallback($$props["startOpen"], true);
  let open = fallback($$props["open"], startOpen);
  $$renderer.push(`<div class="card shadow-sm accordion-card"><button type="button" class="accordion-card__toggle svelte-glzxw5"${attr("aria-expanded", open)}><div class="accordion-card__heading svelte-glzxw5"><h3 class="h6 mb-1">${escape_html(title)}</h3> `);
  if (description) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<p class="text-body-secondary mb-0">${escape_html(description)}</p>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div> <span class="accordion-card__indicator svelte-glzxw5" aria-hidden="true">${escape_html(open ? "Hide" : "Show")}</span></button> `);
  if (open) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="card-body pt-0"><!--[-->`);
    slot($$renderer, $$props, "default", {});
    $$renderer.push(`<!--]--></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div>`);
  bind_props($$props, { title, description, startOpen, open });
}
function ProductWorkspace($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let productTemplateOptions, currentProductTypeForForm;
    let initialMode = fallback($$props["initialMode"], "select");
    let initialProductId = fallback($$props["initialProductId"], "");
    let products = [];
    let productTypes = [];
    let seriesRecords = [];
    let templateRegistry = { product_templates: [] };
    let selectedProductId = null;
    let currentProduct = null;
    let rpmLines = [];
    let rpmPoints = [];
    let efficiencyPoints = [];
    let mapChartOption = {};
    let loading = false;
    let successMessages = [];
    let productImages = [];
    let chartAddTarget = "";
    let originalRpmPointIds = [];
    let originalEfficiencyPointIds = [];
    let nextTempPointId = -1;
    let nextTempRpmLineId = -1;
    let savingMapPoints = false;
    Promise.resolve();
    let refreshingTemplates = false;
    let editExistingProductTypeKey = "";
    let editExistingSeriesId = "";
    let mode = initialMode;
    let editingProductId = null;
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
    let createCoreDetailsOpen = true;
    let createProductAttributesOpen = true;
    let createGroupedSpecificationsOpen = true;
    let allAccordionsOpen = false;
    let specificationGroupOpenState = {};
    const SPECIFICATION_GROUP_TINTS = [
      {
        background: "rgba(237, 108, 2, 0.15)",
        border: "rgba(237, 108, 2, 0.8)",
        parameterBackgroundLight: "rgba(237, 108, 2, 0.08)",
        parameterBackgroundDark: "rgba(237, 108, 2, 0.18)"
      },
      {
        background: "rgba(2, 136, 209, 0.15)",
        border: "rgba(2, 136, 209, 0.8)",
        parameterBackgroundLight: "rgba(2, 136, 209, 0.08)",
        parameterBackgroundDark: "rgba(2, 136, 209, 0.18)"
      },
      {
        background: "rgba(46, 125, 50, 0.15)",
        border: "rgba(46, 125, 50, 0.8)",
        parameterBackgroundLight: "rgba(46, 125, 50, 0.08)",
        parameterBackgroundDark: "rgba(46, 125, 50, 0.18)"
      },
      {
        background: "rgba(123, 31, 162, 0.15)",
        border: "rgba(123, 31, 162, 0.8)",
        parameterBackgroundLight: "rgba(123, 31, 162, 0.08)",
        parameterBackgroundDark: "rgba(123, 31, 162, 0.18)"
      },
      {
        background: "rgba(93, 64, 55, 0.15)",
        border: "rgba(93, 64, 55, 0.8)",
        parameterBackgroundLight: "rgba(93, 64, 55, 0.08)",
        parameterBackgroundDark: "rgba(93, 64, 55, 0.18)"
      },
      {
        background: "rgba(198, 40, 40, 0.15)",
        border: "rgba(198, 40, 40, 0.8)",
        parameterBackgroundLight: "rgba(198, 40, 40, 0.08)",
        parameterBackgroundDark: "rgba(198, 40, 40, 0.18)"
      }
    ];
    let productForm = emptyProductForm();
    let rpmPointForm = { rpm_line_id: "", airflow: "", pressure: "" };
    function syncSpecificationGroupOpenState(groups, currentState) {
      const nextState = {};
      groups.forEach((_, index) => {
        nextState[index] = currentState[index] ?? true;
      });
      return nextState;
    }
    function productTypePresetTemplateId(productTypeKey, variant) {
      const productType = productTypes.find((item) => item.key === productTypeKey);
      if (variant === "printed") {
        return productType?.printed_product_template_id || productType?.product_template_id || "";
      }
      return productType?.online_product_template_id || productType?.product_template_id || "";
    }
    function resolveCreateTemplateId(productTypeKey, variant) {
      const preferredTemplateId = productTypePresetTemplateId(productTypeKey, variant);
      const availableTemplateIds = new Set(productTemplateOptions.map((template) => template.id));
      if (preferredTemplateId && availableTemplateIds.has(preferredTemplateId)) {
        return preferredTemplateId;
      }
      if (availableTemplateIds.has("product-default")) {
        return "product-default";
      }
      return preferredTemplateId || "";
    }
    function applyCreateTemplateDefault(productTypeKey) {
      productForm = {
        ...productForm,
        printed_template_id: resolveCreateTemplateId(productTypeKey, "printed"),
        online_template_id: resolveCreateTemplateId(productTypeKey, "online")
      };
    }
    function seriesForType(productTypeKey) {
      return seriesRecords.filter((series) => series.product_type_key === productTypeKey).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }
    function editableProductsForSelection(productTypeKey, seriesId) {
      return products.filter((product) => true).filter((product) => true).sort((a, b) => String(a.model || "").localeCompare(String(b.model || "")));
    }
    function normalizeLookupText(value) {
      return String(value ?? "").trim().toLowerCase();
    }
    function parameterValueHistory(groupName, parameterName, valueType) {
      const groupKey = normalizeLookupText(groupName);
      const parameterKey = normalizeLookupText(parameterName);
      const history = /* @__PURE__ */ new Map();
      for (const product of products) {
        for (const group of product.parameter_groups ?? []) {
          if (normalizeLookupText(group.group_name) !== groupKey) continue;
          for (const parameter of group.parameters ?? []) {
            if (normalizeLookupText(parameter.parameter_name) !== parameterKey) continue;
            if (valueType === "string") {
              const valueString = String(parameter.value_string ?? "").trim();
              if (!valueString) continue;
              const key2 = valueString.toLowerCase();
              const existing2 = history.get(key2) ?? { value_string: valueString, count: 0 };
              existing2.count += 1;
              history.set(key2, existing2);
              continue;
            }
            const valueNumber = parameter.value_number;
            if (valueNumber == null || Number.isNaN(Number(valueNumber))) continue;
            const unit = String(parameter.unit ?? "").trim();
            const key = `${Number(valueNumber)}|${unit.toLowerCase()}`;
            const existing = history.get(key) ?? { value_number: Number(valueNumber), unit, count: 0 };
            existing.count += 1;
            history.set(key, existing);
          }
        }
      }
      const values = [...history.values()];
      if (valueType === "string") {
        return values.sort((a, b) => b.count - a.count || a.value_string.localeCompare(b.value_string));
      }
      return values.sort((a, b) => b.count - a.count || a.value_number - b.value_number || a.unit.localeCompare(b.unit));
    }
    function parseOptionalNumber(value) {
      return value === "" || value == null ? null : parseFloat(value);
    }
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
    function createPresetRpmPointDraft(point = {}) {
      return {
        id: point.id ?? null,
        _pending_delete: point._pending_delete ?? false,
        airflow: point.airflow ?? "",
        pressure: point.pressure ?? ""
      };
    }
    function createPresetRpmLineDraft(line = {}) {
      return {
        id: line.id ?? null,
        _pending_delete: line._pending_delete ?? false,
        rpm: line.rpm ?? "",
        band_color: line.band_color ?? "",
        points: (line.point_presets ?? []).map((point) => createPresetRpmPointDraft(point))
      };
    }
    function createPresetEfficiencyPointDraft(point = {}) {
      return {
        id: point.id ?? null,
        _pending_delete: point._pending_delete ?? false,
        airflow: point.airflow ?? "",
        efficiency_centre: point.efficiency_centre ?? "",
        efficiency_lower_end: point.efficiency_lower_end ?? "",
        efficiency_higher_end: point.efficiency_higher_end ?? "",
        permissible_use: point.permissible_use ?? ""
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
          value_string: parameter.value_string ?? "",
          value_number: parameter.value_number ?? "",
          unit: parameter.preferred_unit ?? ""
        }))
      }));
    }
    function clonePresetRpmLines(productTypeKey) {
      const productType = productTypes.find((item) => item.key === productTypeKey);
      if (!productType) return [];
      return (productType.rpm_line_presets ?? []).map((line) => createPresetRpmLineDraft(line));
    }
    function clonePresetEfficiencyPoints(productTypeKey) {
      const productType = productTypes.find((item) => item.key === productTypeKey);
      if (!productType) return [];
      return (productType.efficiency_point_presets ?? []).map((point) => createPresetEfficiencyPointDraft(point));
    }
    function materializeCreateGraphPresets(productTypeKey) {
      const presetLines = clonePresetRpmLines(productTypeKey).map((line, index) => {
        const id = createTempRpmLineId();
        return {
          ...line,
          id,
          band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
        };
      });
      const presetPoints = applyRpmPointSort(presetLines.flatMap((line) => (line.points ?? []).filter((point) => !point?._pending_delete).map((point) => ({
        id: createTempPointId(),
        product_id: null,
        rpm_line_id: line.id,
        rpm: parseOptionalNumber(line.rpm),
        airflow: parseOptionalNumber(point.airflow),
        pressure: parseOptionalNumber(point.pressure)
      }))));
      const presetEfficiencyPoints = clonePresetEfficiencyPoints(productTypeKey).filter((point) => !point?._pending_delete).map((point) => ({ ...point, id: createTempPointId(), product_id: null }));
      return {
        rpmLines: presetLines,
        rpmPoints: presetPoints,
        efficiencyPoints: presetEfficiencyPoints
      };
    }
    function applyCreateTypePresets(productTypeKey) {
      parameterGroups = clonePresetGroups(productTypeKey);
      const graphPresets = materializeCreateGraphPresets(productTypeKey);
      rpmLines = graphPresets.rpmLines;
      rpmPoints = graphPresets.rpmPoints;
      efficiencyPoints = graphPresets.efficiencyPoints;
      specificationGroupOpenState = {};
    }
    function getCurrentProductType() {
      return productTypes.find((item) => item.key === productForm.product_type_key) || null;
    }
    function productSupportsGraph() {
      return getCurrentProductType()?.supports_graph ?? true;
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
    function graphLineValueLabel() {
      return getCurrentProductType()?.graph_line_value_label || "RPM";
    }
    function graphLineValueUnit() {
      return getCurrentProductType()?.graph_line_value_unit || graphLineValueLabel();
    }
    function graphXAxisLabel() {
      return getCurrentProductType()?.graph_x_axis_label || "Airflow";
    }
    function graphYAxisLabel() {
      return getCurrentProductType()?.graph_y_axis_label || "Pressure";
    }
    function formatGraphLineValue(value) {
      const unit = graphLineValueUnit();
      return `${value} ${unit}`;
    }
    function currentOverlayLineDefinitions() {
      return productSupportsGraphOverlays() ? FULL_CHART_LINE_DEFINITIONS : [];
    }
    function allSpecificationGroupsOpen() {
      return parameterGroups.length === 0 || parameterGroups.every((_, index) => specificationGroupOpenState[index] ?? true);
    }
    function specificationGroupBackgroundColor(groupIndex) {
      return SPECIFICATION_GROUP_TINTS[groupIndex % SPECIFICATION_GROUP_TINTS.length].background;
    }
    function specificationGroupBorderColor(groupIndex) {
      return SPECIFICATION_GROUP_TINTS[groupIndex % SPECIFICATION_GROUP_TINTS.length].border;
    }
    function specificationParameterCardStyle(groupIndex, pendingDelete = false) {
      if (pendingDelete) return "";
      const tint = SPECIFICATION_GROUP_TINTS[groupIndex % SPECIFICATION_GROUP_TINTS.length];
      const background = store_get($$store_subs ??= {}, "$theme", theme) === "dark" ? tint.parameterBackgroundDark : tint.parameterBackgroundLight;
      return `background-color: ${background}; border-color: ${tint.border};`;
    }
    function normalizeOptionalColor(value) {
      const normalized = String(value ?? "").trim();
      return normalized || "";
    }
    function createTempPointId() {
      const nextId = nextTempPointId;
      nextTempPointId -= 1;
      return nextId;
    }
    function createTempRpmLineId() {
      const nextId = nextTempRpmLineId;
      nextTempRpmLineId -= 1;
      return nextId;
    }
    function applyRpmPointSort(points) {
      return points;
    }
    function hydrateRpmPointsWithLineValues(points, lines) {
      const rpmByLineId = new Map((lines ?? []).map((line) => [Number(line?.id), Number(line?.rpm)]).filter(([, rpm]) => Number.isFinite(rpm)));
      return (points ?? []).map((point) => {
        const rpm = Number(point?.rpm);
        if (Number.isFinite(rpm)) {
          return point;
        }
        const lineRpm = rpmByLineId.get(Number(point?.rpm_line_id));
        return lineRpm == null ? point : { ...point, rpm: lineRpm };
      });
    }
    onDestroy(() => {
    });
    async function loadProductData() {
      if (!selectedProductId) return;
      try {
        const nextProduct = await getProduct(selectedProductId);
        currentProduct = nextProduct;
        const nextProductType = productTypes.find((item) => item.key === (nextProduct?.product_type_key || "fan")) || null;
        const overlayDefinitions = nextProductType?.supports_graph_overlays === false ? [] : FULL_CHART_LINE_DEFINITIONS;
        const [rpmLinesResult, rpmPointsResult, efficiencyPointsResult] = await Promise.allSettled([
          getRpmLines(selectedProductId),
          getRpmPoints(selectedProductId),
          getEfficiencyPoints(selectedProductId)
        ]);
        const nextRpmLines = rpmLinesResult.status === "fulfilled" ? rpmLinesResult.value : [];
        const nextRpmPoints = rpmPointsResult.status === "fulfilled" ? rpmPointsResult.value : [];
        const nextEfficiencyPoints = efficiencyPointsResult.status === "fulfilled" ? efficiencyPointsResult.value : [];
        rpmLines = nextRpmLines.map((line, index) => ({
          ...line,
          band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
        }));
        rpmPoints = applyRpmPointSort(hydrateRpmPointsWithLineValues(nextRpmPoints, rpmLines));
        efficiencyPoints = nextEfficiencyPoints;
        originalRpmPointIds = nextRpmPoints.map((point) => point.id);
        originalEfficiencyPointIds = nextEfficiencyPoints.map((point) => point.id);
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
        e.message;
      }
    }
    function buildMapChartOption() {
      const chartTheme = getChartTheme(store_get($$store_subs ??= {}, "$theme", theme));
      const overlayDefinitions = currentOverlayLineDefinitions();
      mapChartOption = buildFullChartOption({
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
    specificationGroupOpenState = syncSpecificationGroupOpenState(parameterGroups, specificationGroupOpenState);
    productTemplateOptions = templateRegistry.product_templates ?? [];
    if (initialProductId !== "" && Number(initialProductId) !== Number(selectedProductId)) {
      selectedProductId = Number(initialProductId);
      if (mode !== "create") {
        mode = "editExisting";
      }
    }
    if (mode === "create" && productForm.product_type_key && productTypes.length > 0 && templateRegistry) {
      applyCreateTypePresets(productForm.product_type_key);
      applyCreateTemplateDefault(productForm.product_type_key);
    }
    currentProductTypeForForm = getCurrentProductType();
    allAccordionsOpen = mode === "create" ? createCoreDetailsOpen && createProductAttributesOpen && createGroupedSpecificationsOpen && allSpecificationGroupsOpen() : false;
    if (selectedProductId) {
      loadProductData();
    }
    {
      store_get($$store_subs ??= {}, "$theme", theme);
      buildMapChartOption();
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (successMessages.length) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="success-toast shadow-lg svelte-py4xdp" role="status" aria-live="polite" aria-atomic="true"><div class="alert alert-success mb-0 success-toast-alert svelte-py4xdp"><!--[-->`);
        const each_array = ensure_array_like(successMessages);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let message = each_array[$$index];
          $$renderer3.push(`<div>${escape_html(message)}</div>`);
        }
        $$renderer3.push(`<!--]--> <!---->`);
        {
          $$renderer3.push(`<div class="success-toast-progress svelte-py4xdp"></div>`);
        }
        $$renderer3.push(`<!----></div></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (mode === "select") {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="card shadow-sm col-12 col-xl-8 mx-auto"><div class="card-body"><h2 class="h5">Editor Actions</h2> <p>Choose whether you want to create a new product or open an existing one for editing.</p> <div class="d-flex flex-wrap gap-2"><a class="btn btn-primary" href="/editor/create">Create New Product</a> <a class="btn btn-outline-secondary" href="/editor/edit">Edit Existing Product</a></div> <div class="mt-3"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingTemplates, true)}>${escape_html("Refresh template library")}</button></div></div></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (mode !== "select") {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="editor-action-bar shadow-sm rounded-3 mb-3 svelte-py4xdp"><div class="d-flex flex-wrap align-items-center justify-content-between gap-2"><div class="small text-body-secondary">`);
        if (mode === "create") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`Creating a new product`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`Editing an existing product`);
        }
        $$renderer3.push(`<!--]--></div> <div class="d-flex flex-wrap gap-2 align-items-center"><button class="btn btn-outline-secondary"${attr("disabled", savingMapPoints, true)}>${escape_html(allAccordionsOpen ? "Collapse All" : "Expand All")}</button> `);
        if (mode === "create") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<button class="btn btn-primary"${attr("disabled", loading, true)}>Save Product</button> <button class="btn btn-outline-secondary">Cancel</button>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (mode === "create") {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="card shadow-sm col-12 col-xxl-12 mx-auto"><div class="card-body"><h2 class="h5">Create New Product</h2> <div class="row g-3"><div class="col-12 col-lg-6">`);
        AccordionCard($$renderer3, {
          title: "Core details",
          description: "Set the base identity and content for the new product.",
          get open() {
            return createCoreDetailsOpen;
          },
          set open($$value) {
            createCoreDetailsOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="row g-3"><div class="col-12 col-md-6"><label class="form-label" for="create-model">Model</label> <input class="form-control" id="create-model" type="text"${attr("value", productForm.model)} placeholder="e.g. AF-120"/></div> <div class="col-12 col-md-6"><label class="form-label" for="create-product-type">Product type</label> `);
            $$renderer4.select(
              {
                class: "form-select",
                id: "create-product-type",
                value: productForm.product_type_key
              },
              ($$renderer5) => {
                $$renderer5.option({ value: "" }, ($$renderer6) => {
                  $$renderer6.push(`-- Choose option --`);
                });
                $$renderer5.push(`<!--[-->`);
                const each_array_1 = ensure_array_like(productTypes);
                for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                  let productType = each_array_1[$$index_1];
                  $$renderer5.option({ value: productType.key }, ($$renderer6) => {
                    $$renderer6.push(`${escape_html(productType.label)}`);
                  });
                }
                $$renderer5.push(`<!--]-->`);
              }
            );
            $$renderer4.push(`</div> `);
            if (currentProductTypeForForm) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="col-12">`);
              SeriesNamesBadgeList($$renderer4, {
                seriesNames: currentProductTypeForForm.series_names || [],
                title: `Series names for ${currentProductTypeForForm.label}`,
                emptyLabel: "This product type does not have any series yet."
              });
              $$renderer4.push(`<!----></div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
            }
            $$renderer4.push(`<!--]--> <div class="col-12 col-md-6"><label class="form-label" for="create-series">Series</label> `);
            $$renderer4.select(
              {
                class: "form-select",
                id: "create-series",
                value: productForm.series_id,
                disabled: !productForm.product_type_key
              },
              ($$renderer5) => {
                $$renderer5.option({ value: null }, ($$renderer6) => {
                  $$renderer6.push(`No series`);
                });
                $$renderer5.push(`<!--[-->`);
                const each_array_2 = ensure_array_like(seriesForType(productForm.product_type_key));
                for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
                  let series = each_array_2[$$index_2];
                  $$renderer5.option({ value: series.id }, ($$renderer6) => {
                    $$renderer6.push(`${escape_html(series.name)}`);
                  });
                }
                $$renderer5.push(`<!--]-->`);
              }
            );
            $$renderer4.push(`</div> <div class="col-12 col-md-6"><label class="form-label" for="create-printed-template">Printed PDF template</label> `);
            $$renderer4.select(
              {
                class: "form-select",
                id: "create-printed-template",
                value: productForm.printed_template_id
              },
              ($$renderer5) => {
                $$renderer5.option({ value: "" }, ($$renderer6) => {
                  $$renderer6.push(`-- Choose option --`);
                });
                $$renderer5.push(`<!--[-->`);
                const each_array_3 = ensure_array_like(productTemplateOptions);
                for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
                  let template = each_array_3[$$index_3];
                  $$renderer5.option({ value: template.id }, ($$renderer6) => {
                    $$renderer6.push(`${escape_html(template.label)}`);
                  });
                }
                $$renderer5.push(`<!--]-->`);
              }
            );
            $$renderer4.push(`</div> <div class="col-12 col-md-6"><label class="form-label" for="create-online-template">Online PDF template</label> `);
            $$renderer4.select(
              {
                class: "form-select",
                id: "create-online-template",
                value: productForm.online_template_id
              },
              ($$renderer5) => {
                $$renderer5.option({ value: "" }, ($$renderer6) => {
                  $$renderer6.push(`-- Choose option --`);
                });
                $$renderer5.push(`<!--[-->`);
                const each_array_4 = ensure_array_like(productTemplateOptions);
                for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
                  let template = each_array_4[$$index_4];
                  $$renderer5.option({ value: template.id }, ($$renderer6) => {
                    $$renderer6.push(`${escape_html(template.label)}`);
                  });
                }
                $$renderer5.push(`<!--]-->`);
              }
            );
            $$renderer4.push(`</div> <div class="col-12"><label class="form-label" for="create-description">Description1 (HTML)</label> <textarea class="form-control" id="create-description" rows="4">`);
            const $$body = escape_html(productForm.description1_html);
            if ($$body) {
              $$renderer4.push(`${$$body}`);
            }
            $$renderer4.push(`</textarea></div> <div class="col-12"><label class="form-label" for="create-features">Description2 (HTML)</label> <textarea class="form-control" id="create-features" rows="4">`);
            const $$body_1 = escape_html(productForm.description2_html);
            if ($$body_1) {
              $$renderer4.push(`${$$body_1}`);
            }
            $$renderer4.push(`</textarea></div></div>`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div> <div class="col-12 col-lg-6">`);
        AccordionCard($$renderer3, {
          title: "Product attributes",
          description: "Configure the product options and longer-form content.",
          get open() {
            return createProductAttributesOpen;
          },
          set open($$value) {
            createProductAttributesOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="row g-3">`);
            if (productSupportsBandGraphStyle()) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="col-12"><div class="form-check form-switch mt-2"><input class="form-check-input" id="create-show-rpm-band-shading" type="checkbox"${attr("checked", productForm.show_rpm_band_shading, true)}/> <label class="form-check-label" for="create-show-rpm-band-shading">Show band shading on generated product graphs</label></div></div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
            }
            $$renderer4.push(`<!--]--> <div class="col-12"><label class="form-label" for="create-specifications">Description3 (HTML)</label> <textarea class="form-control" id="create-specifications" rows="4">`);
            const $$body_2 = escape_html(productForm.description3_html);
            if ($$body_2) {
              $$renderer4.push(`${$$body_2}`);
            }
            $$renderer4.push(`</textarea></div> <div class="col-12"><label class="form-label" for="create-comments">Comments (HTML)</label> <textarea class="form-control" id="create-comments" rows="4">`);
            const $$body_3 = escape_html(productForm.comments_html);
            if ($$body_3) {
              $$renderer4.push(`${$$body_3}`);
            }
            $$renderer4.push(`</textarea></div></div>`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div></div> <div class="mt-3">`);
        AccordionCard($$renderer3, {
          title: "Grouped Specifications",
          description: "Organise ordered parameter groups for this product type.",
          get open() {
            return createGroupedSpecificationsOpen;
          },
          set open($$value) {
            createGroupedSpecificationsOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="d-flex flex-wrap justify-content-between align-items-center gap-2"><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm">${escape_html(parameterGroups.length > 0 && parameterGroups.every((_, index) => specificationGroupOpenState[index] ?? true) ? "Collapse All Groups" : "Expand All Groups")}</button> <button class="btn btn-outline-secondary btn-sm">Load Type Presets</button> <button class="btn btn-outline-primary btn-sm">Add Group</button></div></div> `);
            if (parameterGroups.length > 0) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="vstack gap-3 mt-3"><!--[-->`);
              const each_array_5 = ensure_array_like(parameterGroups);
              for (let groupIndex = 0, $$length = each_array_5.length; groupIndex < $$length; groupIndex++) {
                let group = each_array_5[groupIndex];
                $$renderer4.push(`<div${attr_class(
                  `border rounded p-3 ${group._pending_delete ? "bg-danger-subtle border-danger-subtle opacity-75" : ""}`,
                  "svelte-py4xdp"
                )}${attr_style(group._pending_delete ? "" : `background-color: ${specificationGroupBackgroundColor(groupIndex)}; border-color: ${specificationGroupBorderColor(groupIndex)};`)}><div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3"><button class="btn btn-link p-0 text-decoration-none text-reset fw-semibold spec-group-toggle svelte-py4xdp" type="button">${escape_html(specificationGroupOpenState[groupIndex] ?? true ? "Hide" : "Show")} ${escape_html(group.group_name || `Group ${groupIndex + 1}`)}</button> <div class="d-flex flex-wrap gap-2 align-items-center"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", groupIndex === 0, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", groupIndex === parameterGroups.length - 1, true)}>Down</button> <button${attr_class(`btn btn-sm ${group._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-py4xdp")}>${escape_html(group._pending_delete ? "Undo Delete" : "Delete Group")}</button> <button class="btn btn-outline-primary btn-sm"${attr("disabled", group._pending_delete, true)}>Add Parameter</button></div></div> `);
                if (group._pending_delete) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="small text-danger-emphasis mb-3">This group is marked for deletion. Save Product to apply the deletion.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--> `);
                if (specificationGroupOpenState[groupIndex] ?? true) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="vstack gap-3"><input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name"${attr("value", group.group_name)}/> <!--[-->`);
                  const each_array_6 = ensure_array_like(group.parameters);
                  for (let parameterIndex = 0, $$length2 = each_array_6.length; parameterIndex < $$length2; parameterIndex++) {
                    let parameter = each_array_6[parameterIndex];
                    $$renderer4.push(`<div${attr_class(
                      `border rounded p-3 ${parameter._pending_delete ? "border-danger-subtle bg-danger-subtle opacity-75" : ""}`,
                      "svelte-py4xdp"
                    )}${attr_style(specificationParameterCardStyle(groupIndex, parameter._pending_delete))}><div class="row g-3 align-items-end"><div class="col-12 col-lg-3"><label class="form-label"${attr("for", `create-group-${groupIndex}-parameter-${parameterIndex}-name`)}>Name</label> <input class="form-control"${attr("id", `create-group-${groupIndex}-parameter-${parameterIndex}-name`)} type="text"${attr("value", parameter.parameter_name)}/></div> <div class="col-12 col-lg-2"><label class="form-label"${attr("for", `create-group-${groupIndex}-parameter-${parameterIndex}-value-type`)}>Value type</label> `);
                    $$renderer4.select(
                      {
                        class: "form-select",
                        id: `create-group-${groupIndex}-parameter-${parameterIndex}-value-type`,
                        value: parameter.value_type
                      },
                      ($$renderer5) => {
                        $$renderer5.option({ value: "string" }, ($$renderer6) => {
                          $$renderer6.push(`Text`);
                        });
                        $$renderer5.option({ value: "number" }, ($$renderer6) => {
                          $$renderer6.push(`Number`);
                        });
                      }
                    );
                    $$renderer4.push(`</div> `);
                    if (parameter.value_type === "string") {
                      $$renderer4.push("<!--[0-->");
                      $$renderer4.push(`<div class="col-12 col-lg-5"><label class="form-label"${attr("for", `create-group-${groupIndex}-parameter-${parameterIndex}-text`)}>Text value</label> <input class="form-control"${attr("id", `create-group-${groupIndex}-parameter-${parameterIndex}-text`)} type="text"${attr("value", parameter.value_string)}/> `);
                      if (parameterValueHistory(group.group_name, parameter.parameter_name, "string").length > 0) {
                        $$renderer4.push("<!--[0-->");
                        $$renderer4.push(`<label class="form-label form-label-sm mt-2"${attr("for", `create-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`)}>Reuse previous value</label> <select class="form-select form-select-sm"${attr("id", `create-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`)}>`);
                        $$renderer4.option({ value: "" }, ($$renderer5) => {
                          $$renderer5.push(`Choose prior value`);
                        });
                        $$renderer4.push(`<!--[-->`);
                        const each_array_7 = ensure_array_like(parameterValueHistory(group.group_name, parameter.parameter_name, "string"));
                        for (let suggestionIndex = 0, $$length3 = each_array_7.length; suggestionIndex < $$length3; suggestionIndex++) {
                          let suggestion = each_array_7[suggestionIndex];
                          $$renderer4.option({ value: suggestionIndex }, ($$renderer5) => {
                            $$renderer5.push(`${escape_html(suggestion.value_string)} (${escape_html(suggestion.count)})`);
                          });
                        }
                        $$renderer4.push(`<!--]--></select>`);
                      } else {
                        $$renderer4.push("<!--[-1-->");
                      }
                      $$renderer4.push(`<!--]--></div>`);
                    } else {
                      $$renderer4.push("<!--[-1-->");
                      $$renderer4.push(`<div class="col-12 col-lg-3"><label class="form-label"${attr("for", `create-group-${groupIndex}-parameter-${parameterIndex}-number`)}>Numeric value</label> <input class="form-control"${attr("id", `create-group-${groupIndex}-parameter-${parameterIndex}-number`)} type="number" step="any"${attr("value", parameter.value_number)}/> `);
                      if (parameterValueHistory(group.group_name, parameter.parameter_name, "number").length > 0) {
                        $$renderer4.push("<!--[0-->");
                        $$renderer4.push(`<label class="form-label form-label-sm mt-2"${attr("for", `create-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`)}>Reuse previous value</label> <select class="form-select form-select-sm"${attr("id", `create-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`)}>`);
                        $$renderer4.option({ value: "" }, ($$renderer5) => {
                          $$renderer5.push(`Choose prior value`);
                        });
                        $$renderer4.push(`<!--[-->`);
                        const each_array_8 = ensure_array_like(parameterValueHistory(group.group_name, parameter.parameter_name, "number"));
                        for (let suggestionIndex = 0, $$length3 = each_array_8.length; suggestionIndex < $$length3; suggestionIndex++) {
                          let suggestion = each_array_8[suggestionIndex];
                          $$renderer4.option({ value: suggestionIndex }, ($$renderer5) => {
                            $$renderer5.push(`${escape_html(suggestion.value_number)}${escape_html(suggestion.unit ? ` ${suggestion.unit}` : "")} (${escape_html(suggestion.count)})`);
                          });
                        }
                        $$renderer4.push(`<!--]--></select>`);
                      } else {
                        $$renderer4.push("<!--[-1-->");
                      }
                      $$renderer4.push(`<!--]--></div> <div class="col-12 col-lg-3"><label class="form-label"${attr("for", `create-group-${groupIndex}-parameter-${parameterIndex}-unit`)}>Unit</label> `);
                      $$renderer4.select(
                        {
                          class: "form-select",
                          id: `create-group-${groupIndex}-parameter-${parameterIndex}-unit`,
                          value: parameter.unit
                        },
                        ($$renderer5) => {
                          $$renderer5.option({ value: "" }, ($$renderer6) => {
                            $$renderer6.push(`No unit`);
                          });
                          $$renderer5.push(`<!--[-->`);
                          const each_array_9 = ensure_array_like(GLOBAL_UNIT_OPTIONS);
                          for (let $$index_7 = 0, $$length3 = each_array_9.length; $$index_7 < $$length3; $$index_7++) {
                            let unitOption = each_array_9[$$index_7];
                            $$renderer5.option({ value: unitOption }, ($$renderer6) => {
                              $$renderer6.push(`${escape_html(unitOption)}`);
                            });
                          }
                          $$renderer5.push(`<!--]-->`);
                          $$renderer5.option({ value: "__custom__" }, ($$renderer6) => {
                            $$renderer6.push(`Custom…`);
                          });
                        }
                      );
                      $$renderer4.push(`</div> `);
                      if (parameter.unit === "__custom__") {
                        $$renderer4.push("<!--[0-->");
                        $$renderer4.push(`<div class="col-12 col-lg-2"><label class="form-label"${attr("for", `create-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`)}>Custom unit</label> <input class="form-control"${attr("id", `create-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`)} type="text"${attr("value", parameter.custom_unit)}/></div>`);
                      } else {
                        $$renderer4.push("<!--[-1-->");
                      }
                      $$renderer4.push(`<!--]-->`);
                    }
                    $$renderer4.push(`<!--]--> <div class="col-12 col-lg-2"><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", group._pending_delete || parameter._pending_delete || parameterIndex === 0, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", group._pending_delete || parameter._pending_delete || parameterIndex === group.parameters.length - 1, true)}>Down</button> <button${attr_class(`btn btn-sm ${parameter._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-py4xdp")}${attr("disabled", group._pending_delete, true)}>${escape_html(parameter._pending_delete ? "Undo Delete" : "Delete")}</button></div></div></div> `);
                    if (parameter._pending_delete) {
                      $$renderer4.push("<!--[0-->");
                      $$renderer4.push(`<p class="small text-danger-emphasis mt-3 mb-0">This parameter is marked for deletion. Save Product to apply the deletion.</p>`);
                    } else {
                      $$renderer4.push("<!--[-1-->");
                    }
                    $$renderer4.push(`<!--]--></div>`);
                  }
                  $$renderer4.push(`<!--]--></div>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--></div>`);
              }
              $$renderer4.push(`<!--]--></div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
              $$renderer4.push(`<p class="text-body-secondary mt-3 mb-0">No parameter groups yet. Load type presets or add a group manually.</p>`);
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div> `);
        if (productSupportsGraph() && (rpmLines.length > 0 || rpmPoints.length > 0 || efficiencyPoints.length > 0)) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="mt-3">`);
          AccordionCard($$renderer3, {
            title: "Preset Graph Preview",
            description: "Review the type preset graph data that will be created with this product.",
            children: ($$renderer4) => {
              $$renderer4.push(`<div class="vstack gap-3">`);
              if (rpmLines.length > 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">${escape_html(graphLineValueLabel())} lines</h6> <div class="table-responsive"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>${escape_html(graphLineValueLabel())}</th><th>Band colour</th></tr></thead><tbody><!--[-->`);
                const each_array_10 = ensure_array_like(rpmLines);
                for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
                  let line = each_array_10[$$index_10];
                  $$renderer4.push(`<tr><td>${escape_html(formatGraphLineValue(line.rpm))}</td><td><code>${escape_html(line.band_color || "None")}</code></td></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (rpmPoints.length > 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">${escape_html(graphLineValueLabel())} points</h6> <div class="table-responsive"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>${escape_html(graphLineValueLabel())}</th><th>${escape_html(graphXAxisLabel())}</th><th>${escape_html(graphYAxisLabel())}</th></tr></thead><tbody><!--[-->`);
                const each_array_11 = ensure_array_like(rpmPoints);
                for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
                  let p = each_array_11[$$index_11];
                  $$renderer4.push(`<tr><td>${escape_html(formatGraphLineValue(p.rpm))}</td><td>${escape_html(p.airflow)}</td><td>${escape_html(p.pressure)}</td></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (productSupportsGraphOverlays() && efficiencyPoints.length > 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">Efficiency / permissible points</h6> <div class="table-responsive"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>${escape_html(graphXAxisLabel())}</th><th>Efficiency Centre</th><th>Efficiency Lower End</th><th>Efficiency Higher End</th><th>Permissible Use</th></tr></thead><tbody><!--[-->`);
                const each_array_12 = ensure_array_like(efficiencyPoints);
                for (let $$index_12 = 0, $$length = each_array_12.length; $$index_12 < $$length; $$index_12++) {
                  let p = each_array_12[$$index_12];
                  $$renderer4.push(`<tr><td>${escape_html(p.airflow)}</td><td>${escape_html(p.efficiency_centre ?? "")}</td><td>${escape_html(p.efficiency_lower_end ?? "")}</td><td>${escape_html(p.efficiency_higher_end ?? "")}</td><td>${escape_html(p.permissible_use ?? "")}</td></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (rpmPoints.length > 0 || efficiencyPoints.length > 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">Preset graph preview</h6> `);
                ECharts($$renderer4, {
                  option: mapChartOption,
                  height: "500px",
                  onChartReady: (c) => {
                  }
                });
                $$renderer4.push(`<!----></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div>`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> <p class="text-body-secondary mt-3 mb-2">Save the product first, then you can upload product images and manage the generated graph file.</p></div></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (mode === "editExisting" && editingProductId === null) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="card shadow-sm col-12 col-xl-8 mx-auto"><div class="card-body"><h2 class="h5">Choose Existing Product</h2> <div class="row g-3"><div class="col-md-6 col-lg-4"><label class="form-label" for="edit-existing-product-type">Product type</label> `);
        $$renderer3.select(
          {
            class: "form-select",
            id: "edit-existing-product-type",
            value: editExistingProductTypeKey
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`— Select product type —`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array_13 = ensure_array_like(productTypes);
            for (let $$index_13 = 0, $$length = each_array_13.length; $$index_13 < $$length; $$index_13++) {
              let productType = each_array_13[$$index_13];
              $$renderer4.option({ value: productType.key }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(productType.label)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          }
        );
        $$renderer3.push(`</div> <div class="col-md-6 col-lg-4"><label class="form-label" for="edit-existing-series">Series (optional)</label> `);
        $$renderer3.select(
          {
            class: "form-select",
            id: "edit-existing-series",
            value: editExistingSeriesId,
            disabled: !editExistingProductTypeKey
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`All series`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array_14 = ensure_array_like(seriesForType(editExistingProductTypeKey));
            for (let $$index_14 = 0, $$length = each_array_14.length; $$index_14 < $$length; $$index_14++) {
              let series = each_array_14[$$index_14];
              $$renderer4.option({ value: series.id }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(series.name)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          }
        );
        $$renderer3.push(`</div> <div class="col-md-6 col-lg-4"><label class="form-label" for="edit-fan-select">Existing product</label> `);
        $$renderer3.select(
          {
            class: "form-select",
            id: "edit-fan-select",
            value: selectedProductId,
            disabled: !editExistingProductTypeKey
          },
          ($$renderer4) => {
            $$renderer4.option({ value: null }, ($$renderer5) => {
              $$renderer5.push(`— Select product —`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array_15 = ensure_array_like(editableProductsForSelection());
            for (let $$index_15 = 0, $$length = each_array_15.length; $$index_15 < $$length; $$index_15++) {
              let product = each_array_15[$$index_15];
              $$renderer4.option({ value: product.id }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(product.model)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          }
        );
        $$renderer3.push(`</div></div> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-outline-secondary">Cancel</button></div></div></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]-->`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    if ($$store_subs) unsubscribe_stores($$store_subs);
    bind_props($$props, { initialMode, initialProductId });
  });
}
export {
  ProductWorkspace as P
};
