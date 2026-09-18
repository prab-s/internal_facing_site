import { b as attr, e as escape_html, i as bind_props, a as slot, d as ensure_array_like, s as store_get, u as unsubscribe_stores, c as attr_class, f as attr_style } from "./index2.js";
import { o as onDestroy } from "./index-server.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import { f as fallback } from "./equality.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
import { u as updateProduct, g as getProducts, s as startRefreshProductPdfJob, r as refreshGraphImage, d as deleteProductImage, a as reorderProductImages, b as uploadProductImages, c as getProduct, e as getRpmLines, f as getRpmPoints, h as getEfficiencyPoints } from "./api.js";
import { g as getChartTheme, b as buildFullChartOption, E as ECharts, R as RPM_BAND_FALLBACK_COLORS, F as FULL_CHART_LINE_DEFINITIONS, a as buildSmoothedCurveSamples } from "./fullChart.js";
import { J as JobProgressPanel, r as runMaintenanceJob } from "./JobProgressPanel.js";
import { A as AssociatedDocumentsPanel } from "./AssociatedDocumentsPanel.js";
import { R as RichTextEditor } from "./RichTextEditor.js";
import { f as fanAcousticVariant, S as SeriesNamesBadgeList, F as FAN_ACOUSTIC_VARIANT_MODES } from "./fanAcoustic.js";
import { F as FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS, t as theme, e as emptyProductForm, P as PERMISSIBLE_USE_MODE_OPTIONS, G as GLOBAL_UNIT_OPTIONS } from "./config.js";
import { c as createDescriptionSectionDrafts, g as getDescriptionFieldCount, M as MAX_DESCRIPTION_SECTIONS } from "./descriptionSections.js";
function simplifyCurve(points, axisKey = "airflow", valueKey = "pressure", count = 5) {
  if (!Number.isInteger(count) || count < 2) throw new Error("Points per curve must be a whole number of at least 2.");
  const sorted = points.filter((p) => p[axisKey] != null && p[valueKey] != null && Number.isFinite(Number(p[axisKey])) && Number.isFinite(Number(p[valueKey]))).slice().sort((a, b) => Number(a[axisKey]) - Number(b[axisKey]));
  if (sorted.length <= count) return sorted;
  const selected = [0, sorted.length - 1];
  while (selected.length < count) {
    let best = -1, error = -1;
    for (let segment = 1; segment < selected.length; segment++) {
      const left = selected[segment - 1], right = selected[segment];
      const x0 = Number(sorted[left][axisKey]), x1 = Number(sorted[right][axisKey]);
      const y0 = Number(sorted[left][valueKey]), y1 = Number(sorted[right][valueKey]);
      for (let i = left + 1; i < right; i++) {
        const t = x1 === x0 ? 0 : (Number(sorted[i][axisKey]) - x0) / (x1 - x0);
        const deviation = Math.abs(Number(sorted[i][valueKey]) - (y0 + t * (y1 - y0)));
        if (deviation > error) {
          error = deviation;
          best = i;
        }
      }
    }
    if (best < 0) break;
    selected.push(best);
    selected.sort((a, b) => a - b);
  }
  return selected.map((i) => sorted[i]);
}
function createGraphReference() {
  let reference = null, preview = "";
  const copy = (value) => JSON.parse(JSON.stringify(value));
  return {
    reset(state) {
      reference = copy(state);
      preview = JSON.stringify(state);
    },
    source(current) {
      if (!reference || JSON.stringify(current) !== preview) reference = copy(current);
      return copy(reference);
    },
    displayed(state) {
      preview = JSON.stringify(state);
    }
  };
}
function moveOverlayPoint(points, id, key, airflow, value, createId) {
  const original = points.find((point) => point.id === id);
  if (!original || !key) return points;
  const otherKeys = ["efficiency_centre", "efficiency_lower_end", "efficiency_higher_end", "permissible_use"].filter((other) => other !== key);
  const updated = { ...original, airflow, [key]: value };
  const shared = otherKeys.some((other) => original[other] != null);
  if (shared && Number(airflow) !== Number(original.airflow)) {
    const retained = { ...original, id: createId(), [key]: null };
    for (const other of otherKeys) updated[other] = null;
    return [...points.map((point) => point.id === id ? updated : point), retained];
  }
  return points.map((point) => point.id === id ? updated : point);
}
function GraphPointPagination($$renderer, $$props) {
  let pages;
  let total = fallback($$props["total"], 0);
  let page = fallback($$props["page"], 0);
  let size = fallback($$props["size"], 100);
  pages = Math.max(1, Math.ceil(total / size));
  if (page >= pages) page = pages - 1;
  if (total > size) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="d-flex align-items-center gap-2 mb-2"><button type="button" class="btn btn-outline-secondary btn-sm"${attr("disabled", page === 0, true)}>Previous points</button> <span class="small">${escape_html(page * size + 1)}–${escape_html(Math.min(total, (page + 1) * size))} of ${escape_html(total)}</span> <button type="button" class="btn btn-outline-secondary btn-sm"${attr("disabled", page >= pages - 1, true)}>Next points</button></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]-->`);
  bind_props($$props, { total, page, size });
}
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
function ProductMediaPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let productForm = $$props["productForm"];
    let productImages = fallback($$props["productImages"], () => [], true);
    let pendingImageFiles = fallback($$props["pendingImageFiles"], () => [], true);
    let currentProduct = fallback($$props["currentProduct"], null);
    let productPdfJob = fallback($$props["productPdfJob"], null);
    let refreshingProductGraphId = fallback($$props["refreshingProductGraphId"], null);
    let selectedProductId = fallback($$props["selectedProductId"], null);
    let graphStyleForm = $$props["graphStyleForm"];
    let showBandGraphStyle = fallback($$props["showBandGraphStyle"], true);
    let graphLineValueLabel = fallback($$props["graphLineValueLabel"], () => "RPM");
    let uploadImages = fallback($$props["uploadImages"], () => {
    });
    let moveProductImage = fallback($$props["moveProductImage"], () => {
    });
    let removeProductImage = fallback($$props["removeProductImage"], () => {
    });
    let generateProductGraph = fallback($$props["generateProductGraph"], () => {
    });
    let generateProductPdf = fallback($$props["generateProductPdf"], () => {
    });
    let saveBandGraphStyle = fallback($$props["saveBandGraphStyle"], () => {
    });
    $$renderer2.push(`<div class="vstack gap-3">`);
    if (selectedProductId) {
      $$renderer2.push("<!--[0-->");
      AssociatedDocumentsPanel($$renderer2, { ownerType: "product", ownerId: selectedProductId });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">Product images</h3> <p class="text-body-secondary">Upload multiple images, reorder them, and the first image becomes the primary catalogue thumbnail.</p> <div class="mb-3"><label class="form-label" for="edit-product-images">Select image files</label> <input class="form-control" id="edit-product-images" type="file" accept="image/*" multiple=""/></div> <div class="d-flex flex-wrap gap-2"><button class="btn btn-primary"${attr("disabled", pendingImageFiles.length === 0, true)}>Upload Selected Images</button></div> `);
    if (productImages.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="row g-3 mt-1"><!--[-->`);
      const each_array = ensure_array_like(productImages);
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        let image = each_array[index];
        $$renderer2.push(`<div class="col-12 col-sm-6"><div class="card shadow-sm h-100"><div class="card-body"><img class="img-fluid rounded border mb-2" style="width: 100%; height: 150px; object-fit: cover;"${attr("src", image.url)}${attr("alt", `${productForm.model} product image ${index + 1}`)}/> <p class="text-body-secondary">${escape_html(index === 0 ? "Primary image" : `Image ${index + 1}`)}</p> <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", index === 0, true)}>Move Up</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", index === productImages.length - 1, true)}>Move Down</button> <button class="btn btn-danger btn-sm">Delete</button></div></div></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="text-body-secondary mt-3 mb-0">No product images uploaded yet.</p>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">Generated Assets</h3> <p class="text-body-secondary">Generate and download the current graph and printed PDF for this product.</p> <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary"${attr("disabled", refreshingProductGraphId === selectedProductId || !selectedProductId, true)}>${escape_html(refreshingProductGraphId === selectedProductId ? "Generating Graph..." : "Generate Product Graph")}</button> `);
    if (currentProduct?.graph_image_url) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a${attr("href", currentProduct.graph_image_url)} download="" class="btn btn-outline-secondary">Download Current Graph</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="btn btn-outline-secondary"${attr("disabled", productPdfJob?.status === "running" || !selectedProductId, true)}>${escape_html(productPdfJob?.status === "running" ? "Generating PDF..." : "Generate Product PDF")}</button> `);
    if (currentProduct?.product_printed_pdf_url || currentProduct?.product_pdf_url) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a${attr("href", currentProduct.product_printed_pdf_url || currentProduct.product_pdf_url)} download="" class="btn btn-outline-secondary">Download PDF</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    JobProgressPanel($$renderer2, { job: productPdfJob, label: "Product PDF generation" });
    $$renderer2.push(`<!----></div></div> `);
    if (showBandGraphStyle) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">Band graph style</h3> <p class="text-body-secondary">These colours apply to the banded graph style, including generated graph images.</p> <div class="row g-3"><div class="col-12"><label class="form-label" for="band-graph-label-color">${escape_html(graphLineValueLabel())} label text colour</label> <div class="input-group"><input class="form-control form-control-color" id="band-graph-label-color" type="color"${attr("value", graphStyleForm.band_graph_label_text_color)}/> <input class="form-control" type="text"${attr("value", graphStyleForm.band_graph_label_text_color)} placeholder="#000000"/></div></div> <div class="col-12"><label class="form-label" for="band-graph-background-color">Graph background colour</label> <div class="input-group"><input class="form-control form-control-color" id="band-graph-background-color" type="color"${attr("value", graphStyleForm.band_graph_background_color)}/> <input class="form-control" type="text"${attr("value", graphStyleForm.band_graph_background_color)} placeholder="#ffffff"/></div></div> <div class="col-12"><label class="form-label" for="band-graph-faded-opacity">Faded area opacity</label> <div class="input-group"><input class="form-range" id="band-graph-faded-opacity" type="range" min="0" max="1" step="0.01"${attr("value", graphStyleForm.band_graph_faded_opacity)}/> <input class="form-control" type="number" min="0" max="1" step="0.01"${attr("value", graphStyleForm.band_graph_faded_opacity)}/></div></div> <div class="col-12"><label class="form-label" for="band-graph-permissible-label-color">Permissible use label colour</label> <div class="input-group"><input class="form-control form-control-color" id="band-graph-permissible-label-color" type="color"${attr("value", graphStyleForm.band_graph_permissible_label_color)}/> <input class="form-control" type="text"${attr("value", graphStyleForm.band_graph_permissible_label_color)} placeholder="#000000"/></div></div></div> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-outline-primary">Save Band Graph Style</button></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, {
      productForm,
      productImages,
      pendingImageFiles,
      currentProduct,
      productPdfJob,
      refreshingProductGraphId,
      selectedProductId,
      graphStyleForm,
      showBandGraphStyle,
      graphLineValueLabel,
      uploadImages,
      moveProductImage,
      removeProductImage,
      generateProductGraph,
      generateProductPdf,
      saveBandGraphStyle
    });
  });
}
function ProductWorkspace($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let productTemplateOptions, graphOptionsKey, editorFanAcousticVariant, editorFanAcousticRunningColumnLabel, currentProductTypeForForm;
    let initialMode = fallback($$props["initialMode"], "select");
    let initialProductId = fallback($$props["initialProductId"], "");
    let initialSeriesId = fallback($$props["initialSeriesId"], "");
    let initialSelectionOnly = fallback($$props["initialSelectionOnly"], false);
    let products = [];
    let productTypes = [];
    let seriesRecords = [];
    let templateRegistry = { product_templates: [] };
    let selectedProductId = null;
    let currentProduct = null;
    let rpmLines = [];
    let rpmPoints = [];
    let rpmPointPage = 0;
    let efficiencyPointPage = 0;
    let graphDragFrame = null;
    let pendingGraphDrag = null;
    let efficiencyPoints = [];
    let efficiencyLineDataLoaded = false;
    let hasBothEfficiencyLines = true;
    let originalRpmLineSnapshots = /* @__PURE__ */ new Map();
    let originalRpmPointSnapshots = /* @__PURE__ */ new Map();
    let mapChartOption = {};
    let loading = false;
    let savingProductDetails = false;
    let successMessages = [];
    let productImages = [];
    let pendingImageFiles = [];
    let rpmPointSort = { column: null };
    let chartAddTarget = "";
    let newRpmLineValue = "";
    let newRpmLineBandColor = RPM_BAND_FALLBACK_COLORS[0];
    let originalRpmPointIds = [];
    let originalEfficiencyPointIds = [];
    let nextTempPointId = -1;
    let nextTempRpmLineId = -1;
    let savingMapPoints = false;
    Promise.resolve();
    let successDismissTimeout = null;
    let refreshingTemplates = false;
    let refreshingProductPdfJob = null;
    let refreshingProductGraphId = null;
    let editExistingProductTypeKey = "";
    let editExistingSeriesId = "";
    let createTemplateSelectionSource = { printed: "auto", online: "auto" };
    createDescriptionSectionDrafts();
    getDescriptionFieldCount();
    let chartInstance = null;
    let draggingPoint = null;
    let dragAxisLock = null;
    let destroyed = false;
    let appliedInitialProductId = "";
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
    let createFanAcousticTableOpen = true;
    let editProductDetailsOpen = true;
    let editGroupedSpecificationsOpen = true;
    let editFanAcousticTableOpen = true;
    let editMediaAssetsOpen = true;
    let editLineManagementOpen = true;
    let editGraphDataOpen = true;
    let allAccordionsOpen = false;
    let specificationGroupOpenState = {};
    const SPECIFICATION_GROUP_BASE_COLORS = [
      "#ed6c02",
      "#0288d1",
      "#2e7d32",
      "#7b1fa2",
      "#5d4037",
      "#c62828"
    ];
    function specificationGroupTint(groupIndex) {
      const baseColor = SPECIFICATION_GROUP_BASE_COLORS[groupIndex % SPECIFICATION_GROUP_BASE_COLORS.length];
      const isDark = store_get($$store_subs ??= {}, "$theme", theme) === "dark";
      return {
        background: `color-mix(in srgb, ${baseColor} ${isDark ? 18 : 14}%, var(--bs-body-bg))`,
        border: `color-mix(in srgb, ${baseColor} ${isDark ? 82 : 74}%, var(--bs-border-color))`,
        parameterBackgroundLight: `color-mix(in srgb, ${baseColor} ${isDark ? 12 : 8}%, var(--bs-body-bg))`,
        parameterBackgroundDark: `color-mix(in srgb, ${baseColor} ${isDark ? 22 : 16}%, var(--bs-body-bg))`
      };
    }
    let productForm = emptyProductForm();
    let productDescriptionSections = createDescriptionSectionDrafts();
    getDescriptionFieldCount();
    let fanAcousticTable = createFanAcousticTableDraft();
    let rpmPointForm = { rpm_line_id: "", airflow: "", pressure: "" };
    let graphCsvError = "";
    let graphCsvFileName = "";
    let graphCsvDownsampleImportedCurves = false;
    let graphCsvAutoScaleOverlays = false;
    let graphReference = createGraphReference();
    let graphCsvDownsamplePointCount = 5;
    let graphCsvUseLowerEfficiencyLine = false;
    let editorUseLowerEfficiencyLine = false;
    let graphCsvImportSource = { rows: [], fileName: "", productId: null };
    let graphCsvImportSignature = "";
    let graphCsvPreview = null;
    let fanAcousticCsvError = "";
    let fanAcousticCsvFileName = "";
    let efficiencyScaleFactors = {
      efficiency_centre: "1",
      efficiency_lower_end: "1",
      efficiency_higher_end: "1",
      permissible_use: "1"
    };
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
    function productTypeBandGraphStyleDefaults(productTypeKey) {
      const productType = productTypes.find((item) => item.key === productTypeKey);
      return {
        band_graph_background_color: normalizeOptionalColor(productType?.band_graph_background_color) || "#ffffff",
        band_graph_label_text_color: normalizeOptionalColor(productType?.band_graph_label_text_color) || "#000000",
        band_graph_faded_opacity: productType?.band_graph_faded_opacity != null && !Number.isNaN(Number(productType.band_graph_faded_opacity)) ? Number(productType.band_graph_faded_opacity) : 0.18,
        band_graph_permissible_label_color: normalizeOptionalColor(productType?.band_graph_permissible_label_color) || "#000000"
      };
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
        printed_template_id: createTemplateSelectionSource.printed === "manual" ? productForm.printed_template_id : resolveCreateTemplateId(productTypeKey, "printed"),
        online_template_id: createTemplateSelectionSource.online === "manual" ? productForm.online_template_id : resolveCreateTemplateId(productTypeKey, "online")
      };
    }
    function applyCreateBandGraphStyleDefaults(productTypeKey, markInitialized = true) {
      graphStyleForm = {
        ...graphStyleForm,
        ...productTypeBandGraphStyleDefaults(productTypeKey)
      };
    }
    function seriesForType(productTypeKey) {
      return seriesRecords.filter((series) => series.product_type_key === productTypeKey || String(series.id) === String(editExistingSeriesId)).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
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
        if (editingProductId && Number(product.id) === Number(editingProductId)) continue;
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
    function parseOptionalInteger(value) {
      if (value === "" || value == null) return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      return Math.round(parsed);
    }
    function isBlankEditorNumericValue(value) {
      return value === "" || value == null;
    }
    function isValidEditorNumericValue(value) {
      if (isBlankEditorNumericValue(value)) return true;
      return Number.isFinite(Number(value));
    }
    function editorNumericInputClass(value) {
      return isValidEditorNumericValue(value) ? "" : "is-invalid";
    }
    function normalizeGraphLineDraft(line = {}) {
      return { ...line, rpm: parseOptionalInteger(line.rpm) };
    }
    function snapshotGraphLine(line = {}) {
      return {
        rpm: parseOptionalInteger(line.rpm),
        band_color: normalizeOptionalColor(line.band_color) || null
      };
    }
    function normalizeGraphPointDraft(point = {}) {
      return {
        ...point,
        rpm: parseOptionalInteger(point.rpm),
        airflow: parseOptionalNumber(point.airflow),
        pressure: parseOptionalNumber(point.pressure)
      };
    }
    function normalizeGraphEfficiencyPointDraft(point = {}) {
      return {
        ...point,
        airflow: parseOptionalNumber(point.airflow),
        efficiency_centre: parseOptionalNumber(point.efficiency_centre),
        efficiency_lower_end: parseOptionalNumber(point.efficiency_lower_end),
        efficiency_higher_end: parseOptionalNumber(point.efficiency_higher_end),
        permissible_use: parseOptionalNumber(point.permissible_use)
      };
    }
    function createParameterDraft(parameter = {}) {
      const unitValue = parameter.unit ?? "";
      const isCustomUnit = unitValue !== "" && !GLOBAL_UNIT_OPTIONS.includes(unitValue);
      return {
        id: parameter.id ?? null,
        _pending_delete: parameter._pending_delete ?? false,
        parameter_name: parameter.parameter_name ?? "",
        value_type: parameter.value_type ?? (parameter.value_string != null && parameter.value_string !== "" ? "string" : parameter.value_number != null ? "number" : unitValue !== "" ? "number" : "string"),
        value_string: parameter.value_string ?? "",
        value_number: parameter.value_number ?? "",
        unit: isCustomUnit ? "__custom__" : unitValue,
        custom_unit: isCustomUnit ? unitValue : ""
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
    function normalizeFanAcousticColumns(columns) {
      const normalized = [];
      const seen = /* @__PURE__ */ new Set();
      for (const column of columns ?? []) {
        const label = String(column ?? "").trim();
        if (!label || seen.has(label)) continue;
        seen.add(label);
        normalized.push(label);
      }
      return normalized.length ? normalized : [...FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS];
    }
    function createFanAcousticRowDraft(row = {}, columns = FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS) {
      const soundPowerLevels = row.sound_power_levels && typeof row.sound_power_levels === "object" ? row.sound_power_levels : {};
      return {
        speed_rpm: row.speed_rpm ?? "",
        peak_pressure_pa: row.peak_pressure_pa ?? "",
        peak_power_kw: row.peak_power_kw ?? "",
        running_frequency_hz: row.running_frequency_hz ?? "",
        running_voltage_v: row.running_voltage_v ?? "",
        sound_pressure_db_3m: row.sound_pressure_db_3m ?? "",
        sound_power_levels: Object.fromEntries(columns.map((column) => [column, soundPowerLevels[column] ?? ""]))
      };
    }
    function createFanAcousticTableDraft(table = {}, rpmLineSource = []) {
      const sound_power_columns = normalizeFanAcousticColumns(table.sound_power_columns ?? FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS);
      const sourceRows = Array.isArray(table.rows) ? table.rows : [];
      const rowCount = rpmLineSource.length || sourceRows.length;
      const rows = Array.from({ length: rowCount }, (_, index) => {
        const sourceRow = sourceRows[index] ?? {};
        const rowDraft = createFanAcousticRowDraft(sourceRow, sound_power_columns);
        const line = rpmLineSource[index];
        if (line && line.rpm != null && line.rpm !== "") {
          rowDraft.speed_rpm = line.rpm;
        }
        return rowDraft;
      });
      return {
        variant_mode: ["default", "override_1ph", "override_3ph"].includes(table.variant_mode) ? table.variant_mode : "default",
        sound_power_columns,
        rows
      };
    }
    function isFanAcousticTableVisible() {
      return productForm.product_type_key === "fan";
    }
    function clonePresetGroups(productTypeKey) {
      const productType = productTypes.find((item) => item.key === productTypeKey);
      if (!productType) return [];
      return (productType.parameter_group_presets ?? []).map((group) => ({
        id: null,
        group_name: group.group_name,
        parameters: (group.parameter_presets ?? []).map((parameter) => createParameterDraft({
          parameter_name: parameter.parameter_name,
          value_type: parameter.value_type,
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
      fanAcousticTable = productTypeKey === "fan" ? createFanAcousticTableDraft({}, graphPresets.rpmLines) : null;
      specificationGroupOpenState = {};
    }
    function resetProductDescriptionSections(record = null) {
      const nextSections = createDescriptionSectionDrafts(record || {});
      productDescriptionSections = nextSections.map((section) => ({ ...section, html: section.html || "" }));
      Math.max(getDescriptionFieldCount(record || {}), productDescriptionSections.length);
    }
    function resetProductEditor(productTypeKey = "") {
      createTemplateSelectionSource = { printed: "auto", online: "auto" };
      productForm = {
        ...emptyProductForm(),
        product_type_key: productTypeKey,
        printed_template_id: "",
        online_template_id: "",
        series_id: null
      };
      resetProductDescriptionSections();
      graphStyleForm = defaultGraphStyleForm();
      if (mode === "create") {
        applyCreateTypePresets(productTypeKey);
        applyCreateTemplateDefault(productTypeKey);
        applyCreateBandGraphStyleDefaults(productTypeKey, productTypes.length > 0);
      } else {
        parameterGroups = clonePresetGroups(productTypeKey);
        rpmLines = [];
        rpmPoints = [];
        efficiencyPoints = [];
        fanAcousticTable = productTypeKey === "fan" ? createFanAcousticTableDraft({}, []) : null;
        specificationGroupOpenState = {};
      }
      createCoreDetailsOpen = true;
      createProductAttributesOpen = true;
      createGroupedSpecificationsOpen = true;
      createFanAcousticTableOpen = true;
      fanAcousticCsvError = "";
      fanAcousticCsvFileName = "";
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
    function permissibleUseModeDisabled(modeValue) {
      return modeValue === "both" && efficiencyLineDataLoaded && !hasBothEfficiencyLines;
    }
    function permissibleUseModeHelp(modeValue) {
      return modeValue === "both" && permissibleUseModeDisabled(modeValue) ? "Both efficiency lines are required for this mode." : "";
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
      return specificationGroupTint(groupIndex).background;
    }
    function specificationGroupBorderColor(groupIndex) {
      return specificationGroupTint(groupIndex).border;
    }
    function specificationParameterCardStyle(groupIndex, pendingDelete = false) {
      if (pendingDelete) return "";
      const tint = specificationGroupTint(groupIndex);
      const background = store_get($$store_subs ??= {}, "$theme", theme) === "dark" ? tint.parameterBackgroundDark : tint.parameterBackgroundLight;
      return `background-color: ${background}; border-color: ${tint.border};`;
    }
    function normalizeOptionalColor(value) {
      const normalized = String(value ?? "").trim();
      return normalized || "";
    }
    function addSuccess(message) {
      if (!message) return;
      successMessages = [...successMessages, message];
      if (successDismissTimeout) {
        clearTimeout(successDismissTimeout);
      }
      successDismissTimeout = setTimeout(
        () => {
          successMessages = [];
          successDismissTimeout = null;
        },
        3e3
      );
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
    function sortIndicator(column) {
      if (rpmPointSort.column !== column) return "Sort";
      return "Asc";
    }
    function normalizeGraphCsvCell(value) {
      return String(value ?? "").trim() === "#N/A" ? "" : value;
    }
    function normalizeGraphCsvHeader(header) {
      const trimmedHeader = String(header ?? "").trim();
      if (!trimmedHeader) return trimmedHeader;
      const lowerHeader = trimmedHeader.toLowerCase();
      if (lowerHeader === "airflow (l/s)") {
        return "airflow_l_s";
      }
      if (lowerHeader === "green system") {
        return "efficiency_centre";
      }
      if (lowerHeader === "upper red curve") {
        return "efficiency_higher_end";
      }
      if (lowerHeader === "lower red curve") {
        return "efficiency_lower_end";
      }
      if (lowerHeader === "red high") {
        return "efficiency_higher_end";
      }
      if (lowerHeader === "red low") {
        return "efficiency_lower_end";
      }
      if (lowerHeader === "grey curve") {
        return "permissible_use";
      }
      if (lowerHeader.startsWith("efficiency_") || lowerHeader === "permissible_use" || lowerHeader.startsWith("system_")) {
        return trimmedHeader;
      }
      if (lowerHeader.includes("rpm")) {
        const compactHeader = trimmedHeader.replace(/\s+/g, "");
        return lowerHeader.startsWith("pressure_") ? compactHeader : `pressure_${compactHeader}`;
      }
      return trimmedHeader;
    }
    function normalizeGraphCsvRows(rows) {
      return rows.map((row, rowIndex) => row.map((cell, cellIndex) => rowIndex === 0 ? normalizeGraphCsvHeader(cell) : normalizeGraphCsvCell(cell)));
    }
    function buildGraphCsvPreview(rows, fileName) {
      if (!Array.isArray(rows) || !rows.length) return null;
      const normalizedRows = normalizeGraphCsvRows(rows);
      const replacedNaNCount = rows.slice(1).reduce((count, row) => count + row.reduce((rowCount, cell) => rowCount + (String(cell ?? "").trim() === "#N/A" ? 1 : 0), 0), 0);
      const headerPairs = rows[0].map((originalHeader, index) => ({
        original: String(originalHeader ?? "").trim(),
        normalized: String(normalizedRows[0]?.[index] ?? "").trim()
      }));
      return {
        fileName,
        rowCount: Math.max(rows.length - 1, 0),
        replacedNaNCount,
        headerPairs,
        changedHeaders: headerPairs.filter((pair) => pair.original !== pair.normalized)
      };
    }
    function normalizeGraphCsvDownsampleCount(value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error("The downsample count must be a whole number.");
      }
      const count = parsed;
      if (!Number.isInteger(count) || count < 2) {
        throw new Error("The downsample count must be a whole number of at least 2.");
      }
      return count;
    }
    function interpolateGraphCsvValue(points, axisValue) {
      if (!points.length) return null;
      if (points.length === 1) return points[0].value;
      if (axisValue <= points[0].axis) return points[0].value;
      if (axisValue >= points[points.length - 1].axis) return points[points.length - 1].value;
      for (let index = 0; index < points.length - 1; index += 1) {
        const left = points[index];
        const right = points[index + 1];
        if (axisValue < left.axis || axisValue > right.axis) continue;
        const span = right.axis - left.axis;
        if (span === 0) return right.value;
        const ratio = (axisValue - left.axis) / span;
        return left.value + (right.value - left.value) * ratio;
      }
      return points[points.length - 1].value;
    }
    function pressureAtAirflow(linePoints, airflow) {
      const numericAirflow = Number(airflow);
      if (!Number.isFinite(numericAirflow)) return null;
      const chartPoints = (linePoints ?? []).map((point) => ({ axis: Number(point?.airflow), value: Number(point?.pressure) })).filter(({ axis, value }) => Number.isFinite(axis) && Number.isFinite(value)).sort((a, b) => a.axis - b.axis);
      if (!chartPoints.length) return null;
      return interpolateGraphCsvValue(buildSmoothedCurveSamples(chartPoints.map((p) => [p.axis, p.value])).map(([axis, value]) => ({ axis, value })), numericAirflow);
    }
    function downsampleGraphCsvSeries(points, axisKey = "airflow", valueKey = "pressure", targetCount = 5) {
      return simplifyCurve(points, axisKey, valueKey, targetCount);
    }
    function downsampleGraphCsvOverlayPoints(points, valueKeys, targetCount = 5) {
      const mergedPoints = /* @__PURE__ */ new Map();
      for (const valueKey of valueKeys) {
        const seriesPoints = (points ?? []).filter((point) => point?.[valueKey] != null);
        const sampledPoints = downsampleGraphCsvSeries(seriesPoints, "airflow", valueKey, targetCount);
        const peakPoint = seriesPoints.reduce(
          (best, current) => {
            const currentAirflow = Number(current?.airflow);
            const currentValue = Number(current?.[valueKey]);
            if (!Number.isFinite(currentAirflow) || !Number.isFinite(currentValue)) {
              return best;
            }
            if (!best) return current;
            const bestValue = Number(best?.[valueKey]);
            if (!Number.isFinite(bestValue) || currentValue > bestValue) {
              return current;
            }
            return best;
          },
          null
        );
        if (peakPoint && !sampledPoints.some((sampledPoint) => Number(sampledPoint?.airflow) === Number(peakPoint?.airflow))) {
          sampledPoints.push({ ...peakPoint });
        }
        for (const sampledPoint of sampledPoints) {
          const airflow = Number(sampledPoint?.airflow);
          const value = Number(sampledPoint?.[valueKey]);
          if (!Number.isFinite(airflow) || !Number.isFinite(value)) continue;
          const mergeKey = `${airflow}`;
          if (!mergedPoints.has(mergeKey)) {
            mergedPoints.set(mergeKey, {
              id: createTempPointId(),
              product_id: selectedProductId,
              airflow,
              efficiency_centre: null,
              efficiency_lower_end: null,
              efficiency_higher_end: null,
              permissible_use: null
            });
          }
          mergedPoints.get(mergeKey)[valueKey] = value;
        }
      }
      return [...mergedPoints.values()].sort((a, b) => Number(a.airflow) - Number(b.airflow));
    }
    function applyLineByLineOverlayScaling(points, rpmLinesToCheck, rpmPointsToCheck) {
      const validPointsByLineId = /* @__PURE__ */ new Map();
      for (const point of rpmPointsToCheck ?? []) {
        const lineId = Number(point?.rpm_line_id);
        const airflow = Number(point?.airflow);
        const pressure = Number(point?.pressure);
        if (!Number.isFinite(lineId) || !Number.isFinite(airflow) || !Number.isFinite(pressure)) {
          continue;
        }
        if (!validPointsByLineId.has(lineId)) validPointsByLineId.set(lineId, []);
        validPointsByLineId.get(lineId).push({ airflow, pressure });
      }
      const highestRpmLine = [...rpmLinesToCheck ?? []].map((line) => ({ id: Number(line?.id), rpm: Number(line?.rpm) })).filter(({ id, rpm }) => Number.isFinite(id) && Number.isFinite(rpm) && (validPointsByLineId.get(id)?.length ?? 0) >= 2).sort((a, b) => b.rpm - a.rpm)[0];
      const highResolutionRpmLinePoints = highestRpmLine ? [...validPointsByLineId.get(highestRpmLine.id)].sort((a, b) => a.airflow - b.airflow) : [];
      const overlayKeys = [
        "efficiency_centre",
        "efficiency_lower_end",
        "efficiency_higher_end",
        "permissible_use"
      ];
      const nextPoints = (points ?? []).map((point) => ({ ...point }));
      if (highResolutionRpmLinePoints.length < 2) {
        return nextPoints;
      }
      function findBestScaleFactor(terminalPoint) {
        const terminalAirflow = Number(terminalPoint?.airflow);
        const terminalValue = Number(terminalPoint?.value);
        if (!Number.isFinite(terminalAirflow) || !Number.isFinite(terminalValue) || terminalAirflow <= 0 || terminalValue <= 0) {
          return null;
        }
        const targetPressure = pressureAtAirflow(highResolutionRpmLinePoints, terminalAirflow);
        if (!Number.isFinite(targetPressure)) {
          return null;
        }
        const scaleFactor = targetPressure / terminalValue;
        if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
          return null;
        }
        return Math.max(0.01, scaleFactor);
      }
      for (const overlayKey of overlayKeys) {
        const overlayLinePoints = nextPoints.map((point) => {
          const rawAirflow = point?.airflow;
          const rawValue = point?.[overlayKey];
          if (rawAirflow === "" || rawAirflow == null) return null;
          if (rawValue === "" || rawValue == null) return null;
          const airflow = Number(rawAirflow);
          const value = Number(rawValue);
          if (!Number.isFinite(airflow) || !Number.isFinite(value)) return null;
          return { airflow, value, point };
        }).filter(Boolean).sort((a, b) => a.airflow - b.airflow);
        if (!overlayLinePoints.length) continue;
        const scaleSourcePoint = overlayLinePoints.reduce(
          (best, current) => {
            if (!best) return current;
            if (current.value > best.value) return current;
            if (current.value < best.value) return best;
            return current.airflow > best.airflow ? current : best;
          },
          null
        );
        const scaleFactor = findBestScaleFactor(scaleSourcePoint);
        if (!Number.isFinite(scaleFactor)) continue;
        for (const point of nextPoints) {
          const rawValue = point?.[overlayKey];
          if (rawValue === "" || rawValue == null) continue;
          const value = Number(rawValue);
          if (!Number.isFinite(value)) continue;
          point[overlayKey] = value * scaleFactor;
        }
      }
      return nextPoints;
    }
    function graphCsvPlaceholder() {
      if (productSupportsGraphOverlays()) {
        return `Example columns: airflow_l_s, pressure_650rpm, pressure_813rpm, efficiency_centre, permissible_use`;
      }
      return `Example columns: airflow_l_s, pressure_650rpm, pressure_813rpm`;
    }
    onDestroy(() => {
      destroyed = true;
      if (graphDragFrame != null) cancelAnimationFrame(graphDragFrame);
      if (successDismissTimeout) {
        clearTimeout(successDismissTimeout);
      }
    });
    function currentGraphState() {
      return { rpmLines, rpmPoints, efficiencyPoints };
    }
    function applyGraphOptions(signature) {
      graphCsvImportSignature = signature;
      try {
        const count = graphCsvDownsampleImportedCurves ? normalizeGraphCsvDownsampleCount(graphCsvDownsamplePointCount) : 5;
        const source = graphReference.source(currentGraphState());
        let overlays = source.efficiencyPoints;
        if (productForm.permissible_use_mode === "dedicated") {
          const key = graphCsvUseLowerEfficiencyLine ? "efficiency_lower_end" : "efficiency_higher_end";
          overlays = overlays.map((p) => ({ ...p, permissible_use: p.permissible_use ?? p[key] }));
        }
        let points = source.rpmPoints;
        if (graphCsvDownsampleImportedCurves) ;
        if (graphCsvAutoScaleOverlays) ;
        if (graphCsvDownsampleImportedCurves) ;
        rpmPoints = applyRpmPointSort(points);
        efficiencyPoints = overlays;
        graphReference.displayed(currentGraphState());
        graphCsvError = "";
      } catch (e) {
        graphCsvError = e.message;
      }
    }
    function clearGraphCsvImportSource() {
      graphCsvImportSource = { rows: [], fileName: "", productId: null };
      graphCsvImportSignature = "";
    }
    async function loadProductData() {
      if (!selectedProductId) return;
      efficiencyLineDataLoaded = false;
      try {
        if (graphCsvImportSource.productId != null && graphCsvImportSource.productId !== selectedProductId) {
          clearGraphCsvImportSource();
          graphCsvFileName = "";
        }
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
        rpmLines = nextRpmLines.map((line, index) => normalizeGraphLineDraft({
          ...line,
          band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
        }));
        originalRpmLineSnapshots = new Map(nextRpmLines.map((line) => [Number(line.id), snapshotGraphLine(line)]));
        originalRpmPointSnapshots = new Map(nextRpmPoints.map((point) => [Number(point.id), Number(point.rpm_line_id)]));
        rpmPoints = applyRpmPointSort(hydrateRpmPointsWithLineValues(nextRpmPoints, rpmLines).map((point) => normalizeGraphPointDraft(point)));
        efficiencyPoints = nextEfficiencyPoints.map((point) => normalizeGraphEfficiencyPointDraft(point));
        graphReference.reset(currentGraphState());
        hasBothEfficiencyLines = nextEfficiencyPoints.some((point) => point?.efficiency_higher_end !== "" && point?.efficiency_higher_end != null) && nextEfficiencyPoints.some((point) => point?.efficiency_lower_end !== "" && point?.efficiency_lower_end != null);
        efficiencyLineDataLoaded = true;
        originalRpmPointIds = nextRpmPoints.map((point) => point.id);
        originalEfficiencyPointIds = nextEfficiencyPoints.map((point) => point.id);
        fanAcousticTable = nextProductType?.key === "fan" ? createFanAcousticTableDraft(nextProduct?.fan_acoustic_table || {}, nextRpmLines) : null;
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
    function productViewerUrl(productId = selectedProductId) {
      const nextProductId = productId == null || productId === "" ? "" : String(productId);
      return nextProductId ? `/viewer/product/${encodeURIComponent(nextProductId)}` : "/viewer/product";
    }
    async function saveBandGraphStyle() {
      if (!selectedProductId) {
        return;
      }
      try {
        const saved = await updateProduct(selectedProductId, {
          band_graph_background_color: normalizeOptionalColor(graphStyleForm.band_graph_background_color) || null,
          band_graph_label_text_color: normalizeOptionalColor(graphStyleForm.band_graph_label_text_color) || null,
          band_graph_faded_opacity: graphStyleForm.band_graph_faded_opacity === "" || graphStyleForm.band_graph_faded_opacity == null ? null : Number(graphStyleForm.band_graph_faded_opacity),
          band_graph_permissible_label_color: normalizeOptionalColor(graphStyleForm.band_graph_permissible_label_color) || null
        });
        graphStyleForm = {
          band_graph_background_color: normalizeOptionalColor(saved?.band_graph_background_color),
          band_graph_label_text_color: normalizeOptionalColor(saved?.band_graph_label_text_color),
          band_graph_faded_opacity: saved?.band_graph_faded_opacity != null && !Number.isNaN(Number(saved.band_graph_faded_opacity)) ? Number(saved.band_graph_faded_opacity) : 0.18,
          band_graph_permissible_label_color: normalizeOptionalColor(saved?.band_graph_permissible_label_color) || normalizeOptionalColor(saved?.band_graph_label_text_color) || "#000000"
        };
        currentProduct = saved;
        products = await getProducts();
        addSuccess("Band graph style updated for this product.");
      } catch (e) {
        e.message;
      }
    }
    async function uploadImages() {
      if (!selectedProductId) {
        return;
      }
      if (!pendingImageFiles.length) {
        return;
      }
      try {
        productImages = await uploadProductImages(selectedProductId, pendingImageFiles);
        pendingImageFiles = [];
        await loadProductData();
        products = await getProducts();
        addSuccess("Product images uploaded.");
      } catch (e) {
        e.message;
      }
    }
    async function generateProductPdf() {
      if (!selectedProductId) {
        return;
      }
      refreshingProductPdfJob = null;
      const productLabel = currentProduct?.model || `product ${selectedProductId}`;
      try {
        const job = await runMaintenanceJob(() => startRefreshProductPdfJob(selectedProductId), {
          isCancelled: () => destroyed,
          onUpdate: (nextJob) => {
            refreshingProductPdfJob = nextJob;
          }
        });
        refreshingProductPdfJob = job;
        await loadProductData();
        products = await getProducts();
        addSuccess(`Printed product PDF generated for ${productLabel}.`);
      } catch (e) {
        e.message;
      } finally {
        if (!destroyed) {
          refreshingProductPdfJob = null;
        }
      }
    }
    async function generateProductGraph() {
      if (!selectedProductId) {
        return;
      }
      refreshingProductGraphId = selectedProductId;
      try {
        await refreshGraphImage(selectedProductId);
        await loadProductData();
        products = await getProducts();
        addSuccess("Product graph generated.");
      } catch (e) {
        e.message;
      } finally {
        refreshingProductGraphId = null;
      }
    }
    async function moveProductImage(index, direction) {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= productImages.length) return;
      const reordered = [...productImages];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      try {
        productImages = await reorderProductImages(selectedProductId, reordered.map((image) => image.id));
        await loadProductData();
        products = await getProducts();
        addSuccess("Product image order updated.");
      } catch (e) {
        e.message;
      }
    }
    async function removeProductImage(image) {
      try {
        await deleteProductImage(selectedProductId, image.id);
        await loadProductData();
        products = await getProducts();
        addSuccess("Product image deleted.");
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
        graphMode: "product",
        permissibleUseMode: productForm.permissible_use_mode || "both",
        includeDragHandles: true,
        clipRpmAreaToPermissibleUse: true,
        showRpmBandShading: productSupportsBandGraphStyle() ? productForm.show_rpm_band_shading ?? true : false,
        showSecondaryAxis: productSupportsGraphOverlays(),
        flowAxisMaxOverride: dragAxisLock?.flowMax ?? null,
        pressureAxisMaxOverride: dragAxisLock?.pressureMax ?? null,
        adaptGraphBackgroundToTheme: true,
        graphStyle: graphStyleForm,
        tooltip: {
          trigger: "item",
          formatter: (params) => {
            const rawValue = Array.isArray(params.value) ? params.value : params.value?.value;
            const [airflow, second] = rawValue || [];
            const formattedAirflow = Number.isFinite(Number(airflow)) ? String(Math.round(Number(airflow))) : "";
            const formattedSecond = Number.isFinite(Number(second)) ? String(Math.round(Number(second))) : "";
            const matchingDefinition = overlayDefinitions.find((definition) => definition.label === params.seriesName);
            if (matchingDefinition) {
              return `${matchingDefinition.tooltipLabel}: ${formattedSecond}<br/>${graphXAxisLabel().toLowerCase()}: ${formattedAirflow}`;
            }
            return `${params.seriesName}<br/>${graphXAxisLabel().toLowerCase()}: ${formattedAirflow}<br/>${graphYAxisLabel().toLowerCase()}: ${formattedSecond}`;
          }
        }
      });
    }
    function handleMapChartDragEnd(params) {
      const data = params.data;
      const value = params.value || data && data.value;
      const id = data?.id;
      if (!id || !value || !Array.isArray(value)) return;
      const [x, y] = value;
      const airflow = Math.round(x);
      const target = data?.pointType === "efficiency" ? efficiencyPoints.find((p) => p.id === id) : rpmPoints.find((p) => p.id === id);
      if (!target) return;
      if (data?.pointType === "efficiency") {
        const overlayDefinition = currentOverlayLineDefinitions().find((definition) => definition.label === params.seriesName);
        const lineKey = overlayDefinition?.key ?? null;
        efficiencyPoints = moveOverlayPoint(efficiencyPoints, id, lineKey, airflow, Math.round(y), createTempPointId);
        return;
      }
      const updated = { ...target, airflow, pressure: Math.round(y) };
      rpmPoints = rpmPoints.map((p) => p.id === id ? updated : p);
    }
    let chartDragAttached = false;
    function setupChartDrag() {
      if (chartDragAttached || !chartInstance) return;
      chartDragAttached = true;
      const zr = chartInstance.getZr();
      if (!zr) return;
      let dragMoved = false;
      let suppressNextClick = false;
      function getEventXY(evt) {
        const dom = evt.event || evt;
        return { x: dom.offsetX ?? dom.clientX, y: dom.offsetY ?? dom.clientY };
      }
      function lockCurrentAxisExtents() {
        const currentOption = chartInstance?.getOption?.();
        const xAxis = Array.isArray(currentOption?.xAxis) ? currentOption.xAxis[0] : currentOption?.xAxis;
        const yAxis = Array.isArray(currentOption?.yAxis) ? currentOption.yAxis[0] : currentOption?.yAxis;
        dragAxisLock = {
          flowMax: Array.isArray(xAxis?.max) ? xAxis.max[0] : xAxis?.max ?? null,
          pressureMax: Array.isArray(yAxis?.max) ? yAxis.max[0] : yAxis?.max ?? null
        };
      }
      function pickClosestPoint({ x, y }) {
        const threshold = 14;
        let best = null;
        let bestDist = Infinity;
        for (const p of rpmPoints) {
          if (p.airflow == null || p.pressure == null) continue;
          const pressurePixel = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.airflow, p.pressure]);
          const dx = pressurePixel[0] - x;
          const dy = pressurePixel[1] - y;
          const d = Math.hypot(dx, dy);
          if (d < bestDist && d <= threshold) {
            bestDist = d;
            best = { id: p.id, pointType: "rpm" };
          }
        }
        for (const p of efficiencyPoints) {
          for (const definition of currentOverlayLineDefinitions()) {
            if (p[definition.key] == null) continue;
            const overlayPixel = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.airflow, p[definition.key]]);
            const dx2 = overlayPixel[0] - x;
            const dy2 = overlayPixel[1] - y;
            const d2 = Math.hypot(dx2, dy2);
            if (d2 < bestDist && d2 <= threshold) {
              bestDist = d2;
              best = { id: p.id, pointType: "efficiency", lineKey: definition.key };
            }
          }
        }
        return best;
      }
      function updateDraggedPoint(point, pixel) {
        if (!point) return;
        const [airflow, value] = chartInstance.convertFromPixel(
          // Efficiency/permissible overlays use the same pressure axis as RPM
          // points. The chart has a single y-axis, so both point types must use
          // yAxisIndex 0 here.
          { xAxisIndex: 0, yAxisIndex: 0 },
          [pixel.x, pixel.y]
        );
        if (point.pointType === "efficiency") {
          efficiencyPoints = moveOverlayPoint(efficiencyPoints, point.id, point.lineKey, Math.round(airflow), Math.round(value), createTempPointId);
          return;
        }
        const updated = {
          ...rpmPoints.find((p) => p.id === point.id),
          airflow: Math.round(airflow),
          pressure: Math.round(value)
        };
        rpmPoints = rpmPoints.map((p) => p.id === point.id ? updated : p);
      }
      async function handleChartClick(evt) {
        if (suppressNextClick) {
          suppressNextClick = false;
          return;
        }
        if (dragMoved) {
          dragMoved = false;
          return;
        }
        evt.event || evt;
        if (!selectedProductId) return;
        const { x, y } = getEventXY(evt);
        if (!chartAddTarget || chartAddTarget === "off") return;
        if (chartAddTarget.startsWith("rpm:")) {
          const rpm_line_id = Number(chartAddTarget.split(":")[1]);
          const [airflow, pressure] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [x, y]);
          rpmPoints = applyRpmPointSort([
            ...rpmPoints,
            {
              id: createTempPointId(),
              product_id: selectedProductId,
              rpm_line_id,
              rpm: rpmLines.find((line) => line.id === rpm_line_id)?.rpm ?? null,
              airflow: Math.round(airflow),
              pressure: Math.round(pressure)
            }
          ]);
          addSuccess("Point added locally from chart. Save Changes to persist it.");
          return;
        }
        if (chartAddTarget.startsWith("efficiency:")) {
          const lineKey = chartAddTarget.split(":")[1];
          const [airflow, value] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [x, y]);
          efficiencyPoints = [
            ...efficiencyPoints,
            {
              id: createTempPointId(),
              product_id: selectedProductId,
              airflow: Math.round(airflow),
              efficiency_centre: lineKey === "efficiency_centre" ? Math.round(value) : null,
              efficiency_lower_end: lineKey === "efficiency_lower_end" ? Math.round(value) : null,
              efficiency_higher_end: lineKey === "efficiency_higher_end" ? Math.round(value) : null,
              permissible_use: lineKey === "permissible_use" ? Math.round(value) : null
            }
          ];
          addSuccess("Point added locally from chart. Save Changes to persist it.");
        }
      }
      zr.on("mousedown", (evt) => {
        const dom = evt.event || evt;
        const mouse = getEventXY(evt);
        const found = pickClosestPoint(mouse);
        if (dom.shiftKey && (dom.button ?? 0) === 0) {
          if (!chartAddTarget || chartAddTarget === "off") return;
          if (!found) return;
          if (found.pointType === "efficiency") {
            efficiencyPoints = efficiencyPoints.filter((point) => point.id !== found.id);
          } else {
            rpmPoints = rpmPoints.filter((point) => point.id !== found.id);
          }
          suppressNextClick = true;
          dragMoved = false;
          draggingPoint = null;
          addSuccess("Point deleted locally from chart. Save Changes to persist it.");
          return;
        }
        if (dom.shiftKey) return;
        if (found) {
          lockCurrentAxisExtents();
          draggingPoint = found;
          dragMoved = false;
        }
      });
      zr.on("mousemove", (evt) => {
        if (!draggingPoint) return;
        dragMoved = true;
        const mouse = getEventXY(evt);
        pendingGraphDrag = { point: draggingPoint, mouse };
        if (graphDragFrame == null) graphDragFrame = requestAnimationFrame(() => {
          graphDragFrame = null;
          if (pendingGraphDrag && !destroyed) updateDraggedPoint(pendingGraphDrag.point, pendingGraphDrag.mouse);
          pendingGraphDrag = null;
        });
      });
      zr.on("mouseup", () => {
        if (graphDragFrame != null) cancelAnimationFrame(graphDragFrame);
        graphDragFrame = null;
        if (pendingGraphDrag) updateDraggedPoint(pendingGraphDrag.point, pendingGraphDrag.mouse);
        pendingGraphDrag = null;
        if (draggingPoint) {
          draggingPoint = null;
          dragAxisLock = null;
        }
      });
      zr.on("click", handleChartClick);
    }
    specificationGroupOpenState = syncSpecificationGroupOpenState(parameterGroups, specificationGroupOpenState);
    productTemplateOptions = templateRegistry.product_templates ?? [];
    {
      const nextInitialProductId = initialProductId !== "" && initialProductId != null ? String(initialProductId) : "";
      if (nextInitialProductId !== appliedInitialProductId) {
        appliedInitialProductId = nextInitialProductId;
        if (nextInitialProductId) {
          selectedProductId = Number(nextInitialProductId);
          if (mode !== "create") {
            mode = "editExisting";
          }
        } else if (mode !== "create" || selectedProductId !== null) {
          selectedProductId = null;
          editingProductId = null;
          currentProduct = null;
          resetProductEditor("");
          mode = "editExisting";
        }
      }
    }
    graphOptionsKey = JSON.stringify([
      selectedProductId,
      graphCsvDownsampleImportedCurves,
      graphCsvDownsamplePointCount,
      graphCsvAutoScaleOverlays,
      graphCsvUseLowerEfficiencyLine,
      productForm.permissible_use_mode || "both"
    ]);
    if (graphOptionsKey !== graphCsvImportSignature) applyGraphOptions(graphOptionsKey);
    graphCsvPreview = buildGraphCsvPreview(graphCsvImportSource.rows, graphCsvImportSource.fileName || "graph-data.csv");
    if (mode === "create" && productForm.product_type_key && productTypes.length > 0 && templateRegistry) {
      applyCreateTypePresets(productForm.product_type_key);
      applyCreateTemplateDefault(productForm.product_type_key);
    }
    editorFanAcousticVariant = fanAcousticVariant(fanAcousticTable, parameterGroups);
    editorFanAcousticRunningColumnLabel = editorFanAcousticVariant === "1ph" ? "Running Voltage (V)" : "Running Frequency (Hz)";
    currentProductTypeForForm = getCurrentProductType();
    allAccordionsOpen = mode === "create" ? createCoreDetailsOpen && createProductAttributesOpen && createGroupedSpecificationsOpen && (!isFanAcousticTableVisible() || createFanAcousticTableOpen) && allSpecificationGroupsOpen() : mode === "editExisting" && editingProductId !== null ? editProductDetailsOpen && editGroupedSpecificationsOpen && (!isFanAcousticTableVisible() || editFanAcousticTableOpen) && editMediaAssetsOpen && editLineManagementOpen && (!productSupportsGraph() || editGraphDataOpen) && allSpecificationGroupsOpen() : false;
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
        $$renderer3.push(`<div class="card shadow-sm col-12 col-xl-8 mx-auto"><div class="card-body"><h2 class="h5">Editor Actions</h2> <p>Choose whether you want to create a new product or open an existing one
        for editing.</p> <div class="d-flex flex-wrap gap-2"><a class="btn btn-primary" href="/editor/create">Create New Product</a> <a class="btn btn-outline-secondary" href="/editor/edit">Edit Existing Product</a></div> <div class="mt-3"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingTemplates, true)}>${escape_html("Refresh template library")}</button></div></div></div>`);
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
          $$renderer3.push(`<button class="btn btn-primary"${attr("disabled", loading, true)}>${escape_html("Save Product")}</button> <button class="btn btn-outline-secondary">Cancel</button>`);
        } else if (editingProductId !== null) {
          $$renderer3.push("<!--[1-->");
          $$renderer3.push(`<button class="btn btn-primary"${attr("disabled", savingMapPoints, true)}>${escape_html("Save Changes")}</button> <a class="btn btn-outline-primary"${attr("href", productViewerUrl(editingProductId))} target="_self">View in Viewer</a> <button class="btn btn-outline-primary"${attr("disabled", savingProductDetails, true)}>Duplicate Product</button> <button class="btn btn-outline-danger"${attr("disabled", savingProductDetails, true)}>Delete Product</button> <button class="btn btn-outline-secondary"${attr("disabled", savingProductDetails, true)}>Done</button>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div> `);
        if (mode === "editExisting" && editingProductId !== null) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="small text-body-secondary w-100 text-end">`);
          {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        } else {
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
            $$renderer4.push(`</div></div>`);
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
              $$renderer4.push(`<div class="col-12"><div class="form-check form-switch mt-2"><input class="form-check-input" id="create-show-rpm-band-shading" type="checkbox"${attr("checked", productForm.show_rpm_band_shading, true)}/> <label class="form-check-label" for="create-show-rpm-band-shading">Show band shading on generated product graphs</label></div></div> `);
              if (productSupportsGraphOverlays()) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="col-12"><label class="form-label" for="create-permissible-use-mode">Permissible-use shading mode</label> `);
                $$renderer4.select(
                  {
                    class: "form-select",
                    id: "create-permissible-use-mode",
                    value: productForm.permissible_use_mode
                  },
                  ($$renderer5) => {
                    $$renderer5.push(`<!--[-->`);
                    const each_array_4 = ensure_array_like(PERMISSIBLE_USE_MODE_OPTIONS);
                    for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
                      let option = each_array_4[$$index_4];
                      $$renderer5.option(
                        {
                          value: option.value,
                          disabled: permissibleUseModeDisabled(option.value)
                        },
                        ($$renderer6) => {
                          $$renderer6.push(`${escape_html(option.label)}`);
                        }
                      );
                    }
                    $$renderer5.push(`<!--]-->`);
                  }
                );
                $$renderer4.push(` `);
                if (permissibleUseModeHelp(productForm.permissible_use_mode)) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="form-text text-warning">${escape_html(permissibleUseModeHelp(productForm.permissible_use_mode))}</div>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]-->`);
            } else {
              $$renderer4.push("<!--[-1-->");
            }
            $$renderer4.push(`<!--]--> <div class="col-12"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><div><div class="form-label mb-0">Description sections</div> <div class="form-text">Add or remove HTML blocks as this product needs. Maximum 10 description sections.</div></div> <button class="btn btn-outline-primary btn-sm" type="button"${attr("disabled", productDescriptionSections.length >= MAX_DESCRIPTION_SECTIONS, true)}>Add section</button></div> <div class="vstack gap-3"><!--[-->`);
            const each_array_5 = ensure_array_like(productDescriptionSections);
            for (let sectionIndex = 0, $$length = each_array_5.length; sectionIndex < $$length; sectionIndex++) {
              let section = each_array_5[sectionIndex];
              $$renderer4.push(`<div class="border rounded p-3 bg-body-tertiary"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><label class="form-label mb-0"${attr("for", `create-description-${sectionIndex + 1}`)}>${escape_html(section.title)}</label> <button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", productDescriptionSections.length === 1, true)}>Remove</button></div> `);
              RichTextEditor($$renderer4, {
                id: `create-description-${sectionIndex + 1}`,
                rows: 4,
                get value() {
                  return productDescriptionSections[sectionIndex].html;
                },
                set value($$value) {
                  productDescriptionSections[sectionIndex].html = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----></div>`);
            }
            $$renderer4.push(`<!--]--></div></div></div>`);
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
            $$renderer4.push(`<div class="d-flex flex-wrap justify-content-between align-items-center gap-2"><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm">${escape_html(parameterGroups.length > 0 && parameterGroups.every((_, index) => specificationGroupOpenState[index] ?? true) ? "Collapse All Groups" : "Expand All Groups")}</button> <button class="btn btn-outline-secondary btn-sm">Load Specification Presets</button> <button class="btn btn-outline-primary btn-sm">Add Group</button></div></div> `);
            if (parameterGroups.length > 0) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="vstack gap-3 mt-3"><!--[-->`);
              const each_array_6 = ensure_array_like(parameterGroups);
              for (let groupIndex = 0, $$length = each_array_6.length; groupIndex < $$length; groupIndex++) {
                let group = each_array_6[groupIndex];
                $$renderer4.push(`<div${attr_class(
                  `border rounded p-3 ${group._pending_delete ? "bg-danger-subtle border-danger-subtle opacity-75" : ""}`,
                  "svelte-py4xdp"
                )}${attr_style(group._pending_delete ? "" : `background-color: ${specificationGroupBackgroundColor(groupIndex)}; border-color: ${specificationGroupBorderColor(groupIndex)};`)}><div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3"><button class="btn btn-link p-0 text-decoration-none text-reset fw-semibold spec-group-toggle svelte-py4xdp" type="button">${escape_html(specificationGroupOpenState[groupIndex] ?? true ? "Hide" : "Show")}
                      ${escape_html(group.group_name || `Group ${groupIndex + 1}`)}</button> <div class="d-flex flex-wrap gap-2 align-items-center"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", groupIndex === 0, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", groupIndex === parameterGroups.length - 1, true)}>Down</button> <button${attr_class(`btn btn-sm ${group._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-py4xdp")}>${escape_html(group._pending_delete ? "Undo Delete" : "Delete Group")}</button> <button class="btn btn-outline-primary btn-sm"${attr("disabled", group._pending_delete, true)}>Add Parameter</button></div></div> `);
                if (group._pending_delete) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="small text-danger-emphasis mb-3">This group is marked for deletion. Save Changes to apply
                      the deletion.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--> `);
                if (specificationGroupOpenState[groupIndex] ?? true) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="vstack gap-3"><input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name"${attr("value", group.group_name)}/> <!--[-->`);
                  const each_array_7 = ensure_array_like(group.parameters);
                  for (let parameterIndex = 0, $$length2 = each_array_7.length; parameterIndex < $$length2; parameterIndex++) {
                    let parameter = each_array_7[parameterIndex];
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
                        const each_array_8 = ensure_array_like(parameterValueHistory(group.group_name, parameter.parameter_name, "string"));
                        for (let suggestionIndex = 0, $$length3 = each_array_8.length; suggestionIndex < $$length3; suggestionIndex++) {
                          let suggestion = each_array_8[suggestionIndex];
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
                        const each_array_9 = ensure_array_like(parameterValueHistory(group.group_name, parameter.parameter_name, "number"));
                        for (let suggestionIndex = 0, $$length3 = each_array_9.length; suggestionIndex < $$length3; suggestionIndex++) {
                          let suggestion = each_array_9[suggestionIndex];
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
                          const each_array_10 = ensure_array_like(GLOBAL_UNIT_OPTIONS);
                          for (let $$index_8 = 0, $$length3 = each_array_10.length; $$index_8 < $$length3; $$index_8++) {
                            let unitOption = each_array_10[$$index_8];
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
                      $$renderer4.push(`<p class="small text-danger-emphasis mt-3 mb-0">This parameter is marked for deletion. Save
                              Changes to apply the deletion.</p>`);
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
              $$renderer4.push(`<p class="text-body-secondary mt-3 mb-0">No parameter groups yet. Load type presets or add a group
              manually.</p>`);
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        if (isFanAcousticTableVisible()) {
          $$renderer3.push("<!--[0-->");
          AccordionCard($$renderer3, {
            title: "Fan Acoustic Table",
            description: "Rows stay aligned to the current RPM graph rows. Sound power columns can be added, removed, and renamed.",
            get open() {
              return createFanAcousticTableOpen;
            },
            set open($$value) {
              createFanAcousticTableOpen = $$value;
              $$settled = false;
            },
            children: ($$renderer4) => {
              if (fanAcousticTable) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div class="mb-3"><label class="form-label mb-1" for="create-fan-acoustic-variant">Acoustic table variant</label> `);
                $$renderer4.select(
                  {
                    id: "create-fan-acoustic-variant",
                    class: "form-select form-select-sm",
                    value: fanAcousticTable.variant_mode
                  },
                  ($$renderer5) => {
                    $$renderer5.push(`<!--[-->`);
                    const each_array_11 = ensure_array_like(FAN_ACOUSTIC_VARIANT_MODES);
                    for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
                      let option = each_array_11[$$index_11];
                      $$renderer5.option({ value: option.value }, ($$renderer6) => {
                        $$renderer6.push(`${escape_html(option.label)}`);
                      });
                    }
                    $$renderer5.push(`<!--]-->`);
                  }
                );
                $$renderer4.push(` <p class="form-text mb-0">When set to Default, this is driven by the Motor → Power Supply specification. Single-phase supplies show Running Voltage; all other or unrecognised values show Running Frequency.</p></div> <p class="text-body-secondary mb-0">The speed column is read-only and follows the fan graph line
                  order.</p> <div class="d-flex flex-wrap gap-2"><input class="form-control form-control-sm fan-acoustic-csv-input" type="file" accept=".csv,text/csv"/> <button class="btn btn-outline-secondary btn-sm" type="button">Clear CSV</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", !fanAcousticTable && rpmLines.length === 0, true)}>Export CSV</button> <button class="btn btn-outline-secondary btn-sm" type="button">Add Column</button></div></div> `);
                if (fanAcousticCsvFileName) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="small mb-2">Loaded file: <strong>${escape_html(fanAcousticCsvFileName)}</strong></p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--> `);
                if (fanAcousticCsvError) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-danger mb-2">${escape_html(fanAcousticCsvError)}</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--> <div class="table-responsive fan-acoustic-table-wrap"><table class="table table-sm align-middle editable-table fan-acoustic-table mb-0"><thead><tr><th>Speed (rpm)</th><th>Peak Pressure (Pa)</th><th>Peak Power (kW)</th><th>${escape_html(editorFanAcousticRunningColumnLabel)}</th><th>Sound Pressure Level dB @ 3 meters</th><!--[-->`);
                const each_array_12 = ensure_array_like(fanAcousticTable.sound_power_columns);
                for (let columnIndex = 0, $$length = each_array_12.length; columnIndex < $$length; columnIndex++) {
                  each_array_12[columnIndex];
                  $$renderer4.push(`<th><div class="d-grid gap-1"><input class="form-control form-control-sm" type="text"${attr("value", fanAcousticTable.sound_power_columns[columnIndex])}/> <button class="btn btn-outline-secondary btn-sm" type="button">Rename</button> <button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", fanAcousticTable.sound_power_columns.length <= 1, true)}>Delete</button></div></th>`);
                }
                $$renderer4.push(`<!--]--></tr></thead><tbody><!--[-->`);
                const each_array_13 = ensure_array_like(fanAcousticTable.rows);
                for (let rowIndex = 0, $$length = each_array_13.length; rowIndex < $$length; rowIndex++) {
                  let row = each_array_13[rowIndex];
                  $$renderer4.push(`<tr><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.speed_rpm)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.speed_rpm)} disabled=""/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.peak_pressure_pa)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.peak_pressure_pa)}/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.peak_power_kw)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.peak_power_kw)}/></td><td>`);
                  if (editorFanAcousticVariant === "1ph") {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.running_voltage_v)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.running_voltage_v)}/>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                    $$renderer4.push(`<input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.running_frequency_hz)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.running_frequency_hz)}/>`);
                  }
                  $$renderer4.push(`<!--]--></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.sound_pressure_db_3m)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.sound_pressure_db_3m)}/></td><!--[-->`);
                  const each_array_14 = ensure_array_like(fanAcousticTable.sound_power_columns);
                  for (let $$index_13 = 0, $$length2 = each_array_14.length; $$index_13 < $$length2; $$index_13++) {
                    let column = each_array_14[$$index_13];
                    $$renderer4.push(`<td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.sound_power_levels[column])}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.sound_power_levels[column])}/></td>`);
                  }
                  $$renderer4.push(`<!--]--></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div> `);
                if (fanAcousticTable.rows.length === 0) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-body-secondary mt-3 mb-0">Save or load RPM lines first so the acoustic table can align
                  itself.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]-->`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]-->`);
            },
            $$slots: { default: true }
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div> `);
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
                const each_array_15 = ensure_array_like(rpmLines);
                for (let $$index_15 = 0, $$length = each_array_15.length; $$index_15 < $$length; $$index_15++) {
                  let line = each_array_15[$$index_15];
                  $$renderer4.push(`<tr><td>${escape_html(formatGraphLineValue(line.rpm))}</td><td><code>${escape_html(line.band_color || "None")}</code></td></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (rpmPoints.length > 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">${escape_html(graphLineValueLabel())} points</h6> `);
                GraphPointPagination($$renderer4, {
                  total: rpmPoints.length,
                  get page() {
                    return rpmPointPage;
                  },
                  set page($$value) {
                    rpmPointPage = $$value;
                    $$settled = false;
                  }
                });
                $$renderer4.push(`<!----> <div class="table-responsive"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>${escape_html(graphLineValueLabel())}</th><th>${escape_html(graphXAxisLabel())}</th><th>${escape_html(graphYAxisLabel())}</th></tr></thead><tbody><!--[-->`);
                const each_array_16 = ensure_array_like(rpmPoints.slice(rpmPointPage * 100, (rpmPointPage + 1) * 100));
                for (let $$index_16 = 0, $$length = each_array_16.length; $$index_16 < $$length; $$index_16++) {
                  let p = each_array_16[$$index_16];
                  $$renderer4.push(`<tr><td>${escape_html(formatGraphLineValue(p.rpm))}</td><td>${escape_html(p.airflow)}</td><td>${escape_html(p.pressure)}</td></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (productSupportsGraphOverlays() && efficiencyPoints.length > 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">Efficiency / permissible points</h6> `);
                GraphPointPagination($$renderer4, {
                  total: efficiencyPoints.length,
                  get page() {
                    return efficiencyPointPage;
                  },
                  set page($$value) {
                    efficiencyPointPage = $$value;
                    $$settled = false;
                  }
                });
                $$renderer4.push(`<!----> <div class="table-responsive"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>${escape_html(graphXAxisLabel())}</th><th>Efficiency Centre</th><th>Efficiency Lower End</th><th>Efficiency Higher End</th><th>Permissible Use</th></tr></thead><tbody><!--[-->`);
                const each_array_17 = ensure_array_like(efficiencyPoints.slice(efficiencyPointPage * 100, (efficiencyPointPage + 1) * 100));
                for (let $$index_17 = 0, $$length = each_array_17.length; $$index_17 < $$length; $$index_17++) {
                  let p = each_array_17[$$index_17];
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
                    chartInstance = c;
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
        $$renderer3.push(`<!--]--> <p class="text-body-secondary mt-3 mb-2">Save the product first, then you can upload product images and manage
        the generated graph file.</p></div></div>`);
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
            const each_array_18 = ensure_array_like(productTypes);
            for (let $$index_18 = 0, $$length = each_array_18.length; $$index_18 < $$length; $$index_18++) {
              let productType = each_array_18[$$index_18];
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
            const each_array_19 = ensure_array_like(seriesForType(editExistingProductTypeKey));
            for (let $$index_19 = 0, $$length = each_array_19.length; $$index_19 < $$length; $$index_19++) {
              let series = each_array_19[$$index_19];
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
            const each_array_20 = ensure_array_like(editableProductsForSelection());
            for (let $$index_20 = 0, $$length = each_array_20.length; $$index_20 < $$length; $$index_20++) {
              let product = each_array_20[$$index_20];
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
      if (mode === "editExisting" && editingProductId !== null) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="card shadow-sm"><div class="card-body"><h2 class="h5">Edit Product: ${escape_html(productForm.model)}</h2> <div class="row g-3"><div class="col-12 col-xxl-6"><div class="vstack gap-3">`);
        AccordionCard($$renderer3, {
          title: "Product details",
          description: "Edit the main product fields and descriptive content.",
          get open() {
            return editProductDetailsOpen;
          },
          set open($$value) {
            editProductDetailsOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="row g-3"><div class="col-12 col-md-6"><label class="form-label" for="edit-model">Model</label> <input class="form-control" id="edit-model" type="text"${attr("value", productForm.model)}/></div> <div class="col-12 col-md-6"><label class="form-label" for="edit-product-type">Product type</label> `);
            $$renderer4.select(
              {
                class: "form-select",
                id: "edit-product-type",
                value: productForm.product_type_key
              },
              ($$renderer5) => {
                $$renderer5.option({ value: "" }, ($$renderer6) => {
                  $$renderer6.push(`-- Choose option --`);
                });
                $$renderer5.push(`<!--[-->`);
                const each_array_21 = ensure_array_like(productTypes);
                for (let $$index_21 = 0, $$length = each_array_21.length; $$index_21 < $$length; $$index_21++) {
                  let productType = each_array_21[$$index_21];
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
            $$renderer4.push(`<!--]--> <div class="col-12 col-md-6"><label class="form-label" for="edit-series">Series</label> `);
            $$renderer4.select(
              {
                class: "form-select",
                id: "edit-series",
                value: productForm.series_id,
                disabled: !productForm.product_type_key
              },
              ($$renderer5) => {
                $$renderer5.option({ value: null }, ($$renderer6) => {
                  $$renderer6.push(`No series`);
                });
                $$renderer5.push(`<!--[-->`);
                const each_array_22 = ensure_array_like(seriesForType(productForm.product_type_key));
                for (let $$index_22 = 0, $$length = each_array_22.length; $$index_22 < $$length; $$index_22++) {
                  let series = each_array_22[$$index_22];
                  $$renderer5.option({ value: series.id }, ($$renderer6) => {
                    $$renderer6.push(`${escape_html(series.name)}`);
                  });
                }
                $$renderer5.push(`<!--]-->`);
              }
            );
            $$renderer4.push(`</div> <div class="col-12 col-md-6"><label class="form-label" for="edit-printed-template">Printed PDF template</label> `);
            $$renderer4.select(
              {
                class: "form-select",
                id: "edit-printed-template",
                value: productForm.printed_template_id
              },
              ($$renderer5) => {
                $$renderer5.option({ value: "" }, ($$renderer6) => {
                  $$renderer6.push(`-- Choose option --`);
                });
                $$renderer5.push(`<!--[-->`);
                const each_array_23 = ensure_array_like(productTemplateOptions);
                for (let $$index_23 = 0, $$length = each_array_23.length; $$index_23 < $$length; $$index_23++) {
                  let template = each_array_23[$$index_23];
                  $$renderer5.option({ value: template.id }, ($$renderer6) => {
                    $$renderer6.push(`${escape_html(template.label)}`);
                  });
                }
                $$renderer5.push(`<!--]-->`);
              }
            );
            $$renderer4.push(`</div> <div class="col-12"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><div><div class="form-label mb-0">Description sections</div> <div class="form-text">Add or remove HTML blocks as this product needs. Maximum 10 description sections.</div></div> <button class="btn btn-outline-primary btn-sm" type="button"${attr("disabled", productDescriptionSections.length >= MAX_DESCRIPTION_SECTIONS, true)}>Add section</button></div> <div class="vstack gap-3"><!--[-->`);
            const each_array_24 = ensure_array_like(productDescriptionSections);
            for (let sectionIndex = 0, $$length = each_array_24.length; sectionIndex < $$length; sectionIndex++) {
              let section = each_array_24[sectionIndex];
              $$renderer4.push(`<div class="border rounded p-3 bg-body-tertiary"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><label class="form-label mb-0"${attr("for", `edit-description-${sectionIndex + 1}`)}>${escape_html(section.title)}</label> <button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", productDescriptionSections.length === 1, true)}>Remove</button></div> `);
              RichTextEditor($$renderer4, {
                id: `edit-description-${sectionIndex + 1}`,
                rows: 4,
                get value() {
                  return productDescriptionSections[sectionIndex].html;
                },
                set value($$value) {
                  productDescriptionSections[sectionIndex].html = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----></div>`);
            }
            $$renderer4.push(`<!--]--></div></div> `);
            if (productSupportsBandGraphStyle()) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="col-12"><div class="form-check form-switch mt-2"><input class="form-check-input" id="edit-show-rpm-band-shading" type="checkbox"${attr("checked", productForm.show_rpm_band_shading, true)}/> <label class="form-check-label" for="edit-show-rpm-band-shading">Show band shading on product graphs and generated graph
                        images</label></div></div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
            }
            $$renderer4.push(`<!--]--></div>`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        AccordionCard($$renderer3, {
          title: "Grouped Specifications",
          description: "Manage the ordered specification groups shown across the site.",
          get open() {
            return editGroupedSpecificationsOpen;
          },
          set open($$value) {
            editGroupedSpecificationsOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="d-flex flex-wrap justify-content-between align-items-center gap-2"><div><p class="text-body-secondary mb-0">These are ordered exactly as they will appear elsewhere.</p></div> <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm">${escape_html(parameterGroups.length > 0 && parameterGroups.every((_, index) => specificationGroupOpenState[index] ?? true) ? "Collapse All Groups" : "Expand All Groups")}</button> <button class="btn btn-outline-secondary btn-sm">Load Specification Presets</button> <button class="btn btn-outline-primary btn-sm">Add Group</button></div></div> `);
            if (parameterGroups.length > 0) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="vstack gap-3 mt-3"><!--[-->`);
              const each_array_25 = ensure_array_like(parameterGroups);
              for (let groupIndex = 0, $$length = each_array_25.length; groupIndex < $$length; groupIndex++) {
                let group = each_array_25[groupIndex];
                $$renderer4.push(`<div${attr_class(
                  `border rounded p-3 ${group._pending_delete ? "bg-danger-subtle border-danger-subtle opacity-75" : ""}`,
                  "svelte-py4xdp"
                )}${attr_style(group._pending_delete ? "" : `background-color: ${specificationGroupBackgroundColor(groupIndex)}; border-color: ${specificationGroupBorderColor(groupIndex)};`)}><div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3"><button class="btn btn-link p-0 text-decoration-none text-reset fw-semibold spec-group-toggle svelte-py4xdp" type="button">${escape_html(specificationGroupOpenState[groupIndex] ?? true ? "Hide" : "Show")}
                          ${escape_html(group.group_name || `Group ${groupIndex + 1}`)}</button> <div class="d-flex flex-wrap gap-2 align-items-center"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", groupIndex === 0, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", groupIndex === parameterGroups.length - 1, true)}>Down</button> <button${attr_class(`btn btn-sm ${group._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-py4xdp")}>${escape_html(group._pending_delete ? "Undo Delete" : "Delete Group")}</button> <button class="btn btn-outline-primary btn-sm"${attr("disabled", group._pending_delete, true)}>Add Parameter</button></div></div> `);
                if (group._pending_delete) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="small text-danger-emphasis mb-3">This group is marked for deletion. Save Changes to
                          apply the deletion.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--> `);
                if (specificationGroupOpenState[groupIndex] ?? true) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="vstack gap-3"><input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name"${attr("value", group.group_name)}/> <!--[-->`);
                  const each_array_26 = ensure_array_like(group.parameters);
                  for (let parameterIndex = 0, $$length2 = each_array_26.length; parameterIndex < $$length2; parameterIndex++) {
                    let parameter = each_array_26[parameterIndex];
                    $$renderer4.push(`<div${attr_class(
                      `border rounded p-3 ${parameter._pending_delete ? "border-danger-subtle bg-danger-subtle opacity-75" : ""}`,
                      "svelte-py4xdp"
                    )}${attr_style(specificationParameterCardStyle(groupIndex, parameter._pending_delete))}><div class="row g-3 align-items-end"><div class="col-12 col-lg-3"><label class="form-label"${attr("for", `edit-group-${groupIndex}-parameter-${parameterIndex}-name`)}>Name</label> <input class="form-control"${attr("id", `edit-group-${groupIndex}-parameter-${parameterIndex}-name`)} type="text"${attr("value", parameter.parameter_name)}/></div> <div class="col-12 col-lg-2"><label class="form-label"${attr("for", `edit-group-${groupIndex}-parameter-${parameterIndex}-value-type`)}>Value type</label> `);
                    $$renderer4.select(
                      {
                        class: "form-select",
                        id: `edit-group-${groupIndex}-parameter-${parameterIndex}-value-type`,
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
                      $$renderer4.push(`<div class="col-12 col-lg-5"><label class="form-label"${attr("for", `edit-group-${groupIndex}-parameter-${parameterIndex}-text`)}>Text value</label> <input class="form-control"${attr("id", `edit-group-${groupIndex}-parameter-${parameterIndex}-text`)} type="text"${attr("value", parameter.value_string)}/> `);
                      if (parameterValueHistory(group.group_name, parameter.parameter_name, "string").length > 0) {
                        $$renderer4.push("<!--[0-->");
                        $$renderer4.push(`<label class="form-label form-label-sm mt-2"${attr("for", `edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`)}>Reuse previous value</label> <select class="form-select form-select-sm"${attr("id", `edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`)}>`);
                        $$renderer4.option({ value: "" }, ($$renderer5) => {
                          $$renderer5.push(`Choose prior value`);
                        });
                        $$renderer4.push(`<!--[-->`);
                        const each_array_27 = ensure_array_like(parameterValueHistory(group.group_name, parameter.parameter_name, "string"));
                        for (let suggestionIndex = 0, $$length3 = each_array_27.length; suggestionIndex < $$length3; suggestionIndex++) {
                          let suggestion = each_array_27[suggestionIndex];
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
                      $$renderer4.push(`<div class="col-12 col-lg-3"><label class="form-label"${attr("for", `edit-group-${groupIndex}-parameter-${parameterIndex}-number`)}>Numeric value</label> <input class="form-control"${attr("id", `edit-group-${groupIndex}-parameter-${parameterIndex}-number`)} type="number" step="any"${attr("value", parameter.value_number)}/> `);
                      if (parameterValueHistory(group.group_name, parameter.parameter_name, "number").length > 0) {
                        $$renderer4.push("<!--[0-->");
                        $$renderer4.push(`<label class="form-label form-label-sm mt-2"${attr("for", `edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`)}>Reuse previous value</label> <select class="form-select form-select-sm"${attr("id", `edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`)}>`);
                        $$renderer4.option({ value: "" }, ($$renderer5) => {
                          $$renderer5.push(`Choose prior value`);
                        });
                        $$renderer4.push(`<!--[-->`);
                        const each_array_28 = ensure_array_like(parameterValueHistory(group.group_name, parameter.parameter_name, "number"));
                        for (let suggestionIndex = 0, $$length3 = each_array_28.length; suggestionIndex < $$length3; suggestionIndex++) {
                          let suggestion = each_array_28[suggestionIndex];
                          $$renderer4.option({ value: suggestionIndex }, ($$renderer5) => {
                            $$renderer5.push(`${escape_html(suggestion.value_number)}${escape_html(suggestion.unit ? ` ${suggestion.unit}` : "")} (${escape_html(suggestion.count)})`);
                          });
                        }
                        $$renderer4.push(`<!--]--></select>`);
                      } else {
                        $$renderer4.push("<!--[-1-->");
                      }
                      $$renderer4.push(`<!--]--></div> <div class="col-12 col-lg-3"><label class="form-label"${attr("for", `edit-group-${groupIndex}-parameter-${parameterIndex}-unit`)}>Unit</label> `);
                      $$renderer4.select(
                        {
                          class: "form-select",
                          id: `edit-group-${groupIndex}-parameter-${parameterIndex}-unit`,
                          value: parameter.unit
                        },
                        ($$renderer5) => {
                          $$renderer5.option({ value: "" }, ($$renderer6) => {
                            $$renderer6.push(`No unit`);
                          });
                          $$renderer5.push(`<!--[-->`);
                          const each_array_29 = ensure_array_like(GLOBAL_UNIT_OPTIONS);
                          for (let $$index_27 = 0, $$length3 = each_array_29.length; $$index_27 < $$length3; $$index_27++) {
                            let unitOption = each_array_29[$$index_27];
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
                        $$renderer4.push(`<div class="col-12 col-lg-2"><label class="form-label"${attr("for", `edit-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`)}>Custom unit</label> <input class="form-control"${attr("id", `edit-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`)} type="text"${attr("value", parameter.custom_unit)}/></div>`);
                      } else {
                        $$renderer4.push("<!--[-1-->");
                      }
                      $$renderer4.push(`<!--]-->`);
                    }
                    $$renderer4.push(`<!--]--> <div class="col-12 col-lg-2"><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", group._pending_delete || parameter._pending_delete || parameterIndex === 0, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", group._pending_delete || parameter._pending_delete || parameterIndex === group.parameters.length - 1, true)}>Down</button> <button${attr_class(`btn btn-sm ${parameter._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-py4xdp")}${attr("disabled", group._pending_delete, true)}>${escape_html(parameter._pending_delete ? "Undo Delete" : "Delete")}</button></div></div></div> `);
                    if (parameter._pending_delete) {
                      $$renderer4.push("<!--[0-->");
                      $$renderer4.push(`<p class="small text-danger-emphasis mt-3 mb-0">This parameter is marked for deletion. Save
                                  Changes to apply the deletion.</p>`);
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
              $$renderer4.push(`<p class="text-body-secondary mt-3 mb-0">No parameter groups yet. Load type presets or add a group
                  manually.</p>`);
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div></div> <div class="col-12 col-xxl-6"><div class="vstack gap-3">`);
        AccordionCard($$renderer3, {
          title: "Media and generated assets",
          description: "Manage product images, exports, and band-graph styling.",
          get open() {
            return editMediaAssetsOpen;
          },
          set open($$value) {
            editMediaAssetsOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            ProductMediaPanel($$renderer4, {
              productForm,
              productImages,
              currentProduct,
              productPdfJob: refreshingProductPdfJob,
              refreshingProductGraphId,
              selectedProductId,
              graphStyleForm,
              showBandGraphStyle: productSupportsBandGraphStyle(),
              graphLineValueLabel,
              uploadImages,
              moveProductImage,
              removeProductImage,
              generateProductGraph,
              generateProductPdf,
              saveBandGraphStyle,
              get pendingImageFiles() {
                return pendingImageFiles;
              },
              set pendingImageFiles($$value) {
                pendingImageFiles = $$value;
                $$settled = false;
              }
            });
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        AccordionCard($$renderer3, {
          title: `${graphLineValueLabel()} line management`,
          description: "Add, reorder, and style the main graph lines.",
          get open() {
            return editLineManagementOpen;
          },
          set open($$value) {
            editLineManagementOpen = $$value;
            $$settled = false;
          },
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="row g-3 align-items-end"><div class="col-12 col-md-4"><label class="form-label" for="new-rpm-line">New ${escape_html(graphLineValueLabel())} line</label> <input class="form-control" id="new-rpm-line" type="text" inputmode="numeric" pattern="[0-9]*"${attr("value", newRpmLineValue)}/></div> <div class="col-12 col-md-4"><label class="form-label" for="new-rpm-line-band-color">Band colour</label> <div class="input-group"><input class="form-control form-control-color" id="new-rpm-line-band-color" type="color"${attr("value", newRpmLineBandColor)}/> <input class="form-control" type="text"${attr("value", newRpmLineBandColor)} placeholder="#60a5fa"/></div></div> <div class="col-12 col-md-4"><div class="d-flex flex-wrap gap-2"><button class="btn btn-primary">Add ${escape_html(graphLineValueLabel())} Line</button></div></div></div> `);
            if (rpmLines.length > 0) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="vstack gap-2 mt-3"><!--[-->`);
              const each_array_30 = ensure_array_like(rpmLines);
              for (let $$index_30 = 0, $$length = each_array_30.length; $$index_30 < $$length; $$index_30++) {
                let line = each_array_30[$$index_30];
                $$renderer4.push(`<div class="border rounded p-2"><div class="row g-2 align-items-end"><div class="col-12 col-md-3"><label class="form-label form-label-sm"${attr("for", `rpm-line-value-${line.id}`)}>${escape_html(graphLineValueLabel())}</label> <input class="form-control form-control-sm"${attr("id", `rpm-line-value-${line.id}`)} type="text" inputmode="numeric" pattern="[0-9]*"${attr("value", line.rpm)}/></div> <div class="col-12 col-md-5"><label class="form-label form-label-sm"${attr("for", `rpm-line-band-color-${line.id}`)}>Band colour</label> <div class="input-group input-group-sm"><input class="form-control form-control-color"${attr("id", `rpm-line-band-color-${line.id}`)} type="color"${attr("value", line.band_color)}/> <input class="form-control" type="text"${attr("value", line.band_color)} placeholder="#60a5fa"/></div></div> <div class="col-12 col-md-4"><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-primary btn-sm">Save</button> <button class="btn btn-outline-secondary btn-sm">Delete</button></div></div></div></div>`);
              }
              $$renderer4.push(`<!--]--></div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
              $$renderer4.push(`<p class="text-body-secondary mt-3 mb-0">No ${escape_html(graphLineValueLabel().toLowerCase())} lines yet.</p>`);
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        if (productSupportsGraph()) {
          $$renderer3.push("<!--[0-->");
          AccordionCard($$renderer3, {
            title: "Graph data",
            description: "Import, edit, and drag graph points for this product.",
            get open() {
              return editGraphDataOpen;
            },
            set open($$value) {
              editGraphDataOpen = $$value;
              $$settled = false;
            },
            children: ($$renderer4) => {
              $$renderer4.push(`<div class="vstack gap-3">`);
              if (productSupportsGraphOverlays()) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><label class="form-label" for="edit-permissible-use-mode">Permissible-use shading mode</label> `);
                $$renderer4.select(
                  {
                    class: "form-select",
                    id: "edit-permissible-use-mode",
                    value: productForm.permissible_use_mode
                  },
                  ($$renderer5) => {
                    $$renderer5.push(`<!--[-->`);
                    const each_array_31 = ensure_array_like(PERMISSIBLE_USE_MODE_OPTIONS);
                    for (let $$index_31 = 0, $$length = each_array_31.length; $$index_31 < $$length; $$index_31++) {
                      let option = each_array_31[$$index_31];
                      $$renderer5.option(
                        {
                          value: option.value,
                          disabled: permissibleUseModeDisabled(option.value)
                        },
                        ($$renderer6) => {
                          $$renderer6.push(`${escape_html(option.label)}`);
                        }
                      );
                    }
                    $$renderer5.push(`<!--]-->`);
                  }
                );
                $$renderer4.push(` `);
                if (permissibleUseModeHelp(productForm.permissible_use_mode)) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="form-text text-warning">${escape_html(permissibleUseModeHelp(productForm.permissible_use_mode))}</div>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> <div class="card shadow-sm"><div class="card-body"><h3 class="h6 mb-2">Graph Data</h3> <p class="text-body-secondary mb-2">Use one wide CSV or XLSX workbook per graph. Required
                        first column: <code>airflow_l_s</code>. Supported
                        dynamic columns: <code>pressure_650rpm</code>, <code>pressure_813rpm</code>, etc. `);
              if (productSupportsGraphOverlays()) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`Overlay columns also supported: <code>efficiency_centre</code>, <code>efficiency_lower_end</code>, <code>efficiency_higher_end</code>, <code>permissible_use</code>.`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></p> <label class="form-label" for="graph-csv-file">Import Graph CSV or XLSX file</label> <div class="d-flex flex-wrap align-items-end gap-3 mb-2"><div class="form-check form-switch mb-0"><input class="form-check-input" id="graph-csv-downsample-enabled" type="checkbox"${attr("checked", graphCsvDownsampleImportedCurves, true)}/> <label class="form-check-label" for="graph-csv-downsample-enabled">Downsample imported curves</label></div> `);
              if (productSupportsGraphOverlays()) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="form-check form-switch"><input id="graph-auto-scale" class="form-check-input" type="checkbox"${attr("checked", graphCsvAutoScaleOverlays, true)}/> <label for="graph-auto-scale" class="form-check-label">Align efficiency and permissible-use lines to highest RPM curve</label></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (productSupportsGraphOverlays() && productForm.permissible_use_mode === "dedicated") {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="form-check form-switch mb-0"><input class="form-check-input" id="graph-csv-permissible-source-lower" type="checkbox"${attr("checked", graphCsvUseLowerEfficiencyLine, true)}/> <label class="form-check-label" for="graph-csv-permissible-source-lower">Generate missing permissible use from lower efficiency line</label></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> <div><label class="form-label form-label-sm mb-1" for="graph-csv-downsample-count">Points per curve</label> <input class="form-control form-control-sm" id="graph-csv-downsample-count" type="number" inputmode="numeric" pattern="[0-9]*" min="2" step="1"${attr("value", graphCsvDownsamplePointCount)}${attr("disabled", !graphCsvDownsampleImportedCurves, true)} style="width: 7rem;"/></div></div> <p class="text-body-secondary small mb-2">`);
              {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`Reference points are shown without simplification. Changes appear immediately; save when the preview is ready.`);
              }
              $$renderer4.push(`<!--]--></p> `);
              if (productSupportsGraphOverlays() && productForm.permissible_use_mode === "dedicated") {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-body-secondary small mb-2">Missing permissible-use values are copied from the
                          ${escape_html(" upper")}
                          efficiency line. Uploaded permissible-use values are preserved.</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (productSupportsGraphOverlays()) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-body-secondary small mb-2">Automatic alignment changes efficiency and permissible-use pressure values. Leave it off to preserve supplied values.</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> <input class="form-control" id="graph-csv-file" type="file" accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"/> `);
              if (graphCsvPreview) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="border rounded-3 bg-body-tertiary p-3 mt-3"><div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2"><div><h4 class="h6 mb-1">Import preview</h4> <p class="text-body-secondary small mb-0">${escape_html(graphCsvPreview.fileName)} · ${escape_html(graphCsvPreview.rowCount)}
                                data row${escape_html(graphCsvPreview.rowCount === 1 ? "" : "s")}</p></div> `);
                if (graphCsvPreview.changedHeaders.length) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<span class="badge text-bg-warning">Headers normalized</span>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                  $$renderer4.push(`<span class="badge text-bg-secondary">No header changes</span>`);
                }
                $$renderer4.push(`<!--]--></div> <p class="text-body-secondary small mb-2"><code>#N/A</code> replacements:
                            ${escape_html(graphCsvPreview.replacedNaNCount)}</p> <div class="small overflow-auto"><table class="table table-sm table-borderless align-middle mb-0"><thead><tr><th scope="col" class="text-body-secondary">Original</th><th scope="col" class="text-body-secondary">Normalized</th></tr></thead><tbody><!--[-->`);
                const each_array_32 = ensure_array_like(graphCsvPreview.headerPairs);
                for (let $$index_32 = 0, $$length = each_array_32.length; $$index_32 < $$length; $$index_32++) {
                  let pair = each_array_32[$$index_32];
                  $$renderer4.push(`<tr><td><code>${escape_html(pair.original || " ")}</code></td><td><code>${escape_html(pair.normalized || " ")}</code></td></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> <p class="text-body-secondary small mt-2 mb-0">${escape_html(graphCsvPlaceholder())}</p> `);
              if (graphCsvFileName) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="small mb-0 mt-2">Loaded file: <strong>${escape_html(graphCsvFileName)}</strong></p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (graphCsvError) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-danger mb-0 mt-2">${escape_html(graphCsvError)}</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-outline-secondary">Clear File Selection</button> <button class="btn btn-outline-secondary"${attr("disabled", rpmPoints.length === 0 && efficiencyPoints.length === 0, true)}>Export Graph CSV</button></div> <p class="small text-body-secondary mt-3 mb-0">Selecting a CSV overwrites the graph data shown on this
                        page immediately. Review the tables and chart, then
                        press <strong>Save Changes</strong> to commit the imported
                        changes to the database.</p></div></div> <div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">${escape_html(graphLineValueLabel())} points</h6> `);
              GraphPointPagination($$renderer4, {
                total: rpmPoints.length,
                get page() {
                  return rpmPointPage;
                },
                set page($$value) {
                  rpmPointPage = $$value;
                  $$settled = false;
                }
              });
              $$renderer4.push(`<!----> <div class="table-responsive"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>${escape_html(graphLineValueLabel())}</th><th><button type="button" class="btn btn-outline-secondary btn-sm">${escape_html(graphXAxisLabel())} (${escape_html(sortIndicator("airflow"))})</button></th><th><button type="button" class="btn btn-outline-secondary btn-sm">${escape_html(graphYAxisLabel())} (${escape_html(sortIndicator("pressure"))})</button></th><th>Actions</th></tr></thead><tbody><!--[-->`);
              const each_array_33 = ensure_array_like(rpmPoints.slice(rpmPointPage * 100, (rpmPointPage + 1) * 100));
              for (let $$index_33 = 0, $$length = each_array_33.length; $$index_33 < $$length; $$index_33++) {
                let p = each_array_33[$$index_33];
                $$renderer4.push(`<tr><td>${escape_html(formatGraphLineValue(p.rpm))}</td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(p.airflow)}`, "svelte-py4xdp")} style="min-width: 90px;" type="number" step="any" inputmode="decimal"${attr("value", p.airflow)}/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(p.pressure)}`, "svelte-py4xdp")} style="min-width: 90px;" type="number" step="any" inputmode="decimal"${attr("value", p.pressure)}/></td><td><button class="btn btn-danger btn-sm">Delete</button></td></tr>`);
              }
              $$renderer4.push(`<!--]--></tbody></table></div> `);
              if (rpmPoints.length === 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="text-body-secondary mb-0">No graph points yet.</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div></div> `);
              if (productSupportsGraphOverlays()) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">Efficiency / permissible points</h6> `);
                if (productForm.permissible_use_mode === "dedicated") {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="d-flex flex-wrap align-items-end gap-2 mb-3"><div class="form-check form-switch mb-1"><input class="form-check-input" id="editor-permissible-source-lower" type="checkbox"${attr("checked", editorUseLowerEfficiencyLine, true)}/> <label class="form-check-label" for="editor-permissible-source-lower">Generate missing permissible use from lower efficiency line</label></div> <button class="btn btn-outline-secondary btn-sm" type="button">Generate missing permissible use</button></div>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--> <div class="row g-2 mb-3"><div class="col-12 col-md-3"><label class="form-label form-label-sm" for="scale-efficiency-centre">Centre scale factor</label> <div class="input-group input-group-sm"><input class="form-control" id="scale-efficiency-centre" type="number" step="any"${attr("value", efficiencyScaleFactors.efficiency_centre)}/> <button class="btn btn-outline-secondary" type="button">Apply</button></div></div> <div class="col-12 col-md-3"><label class="form-label form-label-sm" for="scale-efficiency-lower">Lower scale factor</label> <div class="input-group input-group-sm"><input class="form-control" id="scale-efficiency-lower" type="number" step="any"${attr("value", efficiencyScaleFactors.efficiency_lower_end)}/> <button class="btn btn-outline-secondary" type="button">Apply</button></div></div> <div class="col-12 col-md-3"><label class="form-label form-label-sm" for="scale-efficiency-higher">Higher scale factor</label> <div class="input-group input-group-sm"><input class="form-control" id="scale-efficiency-higher" type="number" step="any"${attr("value", efficiencyScaleFactors.efficiency_higher_end)}/> <button class="btn btn-outline-secondary" type="button">Apply</button></div></div> <div class="col-12 col-md-3"><label class="form-label form-label-sm" for="scale-permissible-use">Permissible scale factor</label> <div class="input-group input-group-sm"><input class="form-control" id="scale-permissible-use" type="number" step="any"${attr("value", efficiencyScaleFactors.permissible_use)}/> <button class="btn btn-outline-secondary" type="button">Apply</button></div></div></div> <p class="text-body-secondary small mb-3">These scale the current draft values for each overlay
                          column and round the result back to whole numbers.</p> <div class="d-flex flex-wrap align-items-center gap-2 mb-3"><button class="btn btn-outline-primary btn-sm" type="button"${attr("disabled", !rpmLines.length || !rpmPoints.length || !efficiencyPoints.length, true)}>Scale lines to highest RPM</button> <span class="small text-body-secondary">Aligns each overlay line with the highest RPM curve at its peak airflow.</span></div> <div class="d-flex flex-wrap align-items-center gap-2 mb-3"><span class="small text-body-secondary me-1">Switch efficiency lines:</span> <button class="btn btn-outline-secondary btn-sm" type="button">Centre ↔ Lower End</button> <button class="btn btn-outline-secondary btn-sm" type="button">Centre ↔ Higher End</button> <button class="btn btn-outline-secondary btn-sm" type="button">Lower End ↔ Higher End</button></div> `);
                GraphPointPagination($$renderer4, {
                  total: efficiencyPoints.length,
                  get page() {
                    return efficiencyPointPage;
                  },
                  set page($$value) {
                    efficiencyPointPage = $$value;
                    $$settled = false;
                  }
                });
                $$renderer4.push(`<!----> <div class="table-responsive"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>${escape_html(graphXAxisLabel())}</th><th>Efficiency Centre</th><th>Efficiency Lower End</th><th>Efficiency Higher End</th><th>Permissible Use</th><th>Actions</th></tr></thead><tbody><!--[-->`);
                const each_array_34 = ensure_array_like(efficiencyPoints.slice(efficiencyPointPage * 100, (efficiencyPointPage + 1) * 100));
                for (let $$index_34 = 0, $$length = each_array_34.length; $$index_34 < $$length; $$index_34++) {
                  let p = each_array_34[$$index_34];
                  $$renderer4.push(`<tr><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(p.airflow)}`, "svelte-py4xdp")} style="min-width: 90px;" type="number" step="any" inputmode="decimal"${attr("value", p.airflow)}/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(p.efficiency_centre)}`, "svelte-py4xdp")} style="min-width: 90px;" type="number" step="any" inputmode="decimal"${attr("value", p.efficiency_centre)}/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(p.efficiency_lower_end)}`, "svelte-py4xdp")} style="min-width: 90px;" type="number" step="any" inputmode="decimal"${attr("value", p.efficiency_lower_end)}/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(p.efficiency_higher_end)}`, "svelte-py4xdp")} style="min-width: 90px;" type="number" step="any" inputmode="decimal"${attr("value", p.efficiency_higher_end)}/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(p.permissible_use)}`, "svelte-py4xdp")} style="min-width: 90px;" type="number" step="any" inputmode="decimal"${attr("value", p.permissible_use)}/></td><td><button class="btn btn-danger btn-sm">Delete</button></td></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div> `);
                if (efficiencyPoints.length === 0) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-body-secondary mb-0">No efficiency/permissible points yet.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--></div></div>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--> `);
              if (rpmPoints.length > 0 || efficiencyPoints.length > 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="card shadow-sm"><div class="card-body"><h6 class="card-title mb-3">Map points chart</h6> <div class="d-flex flex-wrap align-items-center gap-2 mb-3"><label class="form-label mb-0" for="chart-add-target">Line to add points on</label> `);
                $$renderer4.select(
                  {
                    class: "form-select w-auto",
                    id: "chart-add-target",
                    value: chartAddTarget
                  },
                  ($$renderer5) => {
                    $$renderer5.option({ value: "off" }, ($$renderer6) => {
                      $$renderer6.push(`-Off-`);
                    });
                    $$renderer5.push(`<!--[-->`);
                    const each_array_35 = ensure_array_like(rpmLines);
                    for (let $$index_35 = 0, $$length = each_array_35.length; $$index_35 < $$length; $$index_35++) {
                      let line = each_array_35[$$index_35];
                      $$renderer5.option({ value: `rpm:${line.id}` }, ($$renderer6) => {
                        $$renderer6.push(`${escape_html(formatGraphLineValue(line.rpm))} line`);
                      });
                    }
                    $$renderer5.push(`<!--]--><!--[-->`);
                    const each_array_36 = ensure_array_like(currentOverlayLineDefinitions());
                    for (let $$index_36 = 0, $$length = each_array_36.length; $$index_36 < $$length; $$index_36++) {
                      let definition = each_array_36[$$index_36];
                      $$renderer5.option({ value: `efficiency:${definition.key}` }, ($$renderer6) => {
                        $$renderer6.push(`${escape_html(definition.label)}`);
                      });
                    }
                    $$renderer5.push(`<!--]-->`);
                  }
                );
                $$renderer4.push(`</div> <p class="text-body-secondary">Drag existing points to edit them. Set the dropdown
                          above to a line when you want chart clicks to add
                          points. Set it to -Off- to disable point adding. Hold
                          either Shift key while left clicking a point to delete
                          it.</p> `);
                ECharts($$renderer4, {
                  option: mapChartOption,
                  height: "750px",
                  on: { dragend: handleMapChartDragEnd },
                  onChartReady: (c) => {
                    chartInstance = c;
                    setupChartDrag();
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
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div></div> `);
        if (isFanAcousticTableVisible()) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="mt-3">`);
          AccordionCard($$renderer3, {
            title: "Fan Acoustic Table",
            description: "Rows stay aligned to the current RPM graph rows. Sound power columns can be added, removed, and renamed.",
            get open() {
              return editFanAcousticTableOpen;
            },
            set open($$value) {
              editFanAcousticTableOpen = $$value;
              $$settled = false;
            },
            children: ($$renderer4) => {
              if (fanAcousticTable) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div class="mb-3"><label class="form-label mb-1" for="edit-fan-acoustic-variant">Acoustic table variant</label> `);
                $$renderer4.select(
                  {
                    id: "edit-fan-acoustic-variant",
                    class: "form-select form-select-sm",
                    value: fanAcousticTable.variant_mode
                  },
                  ($$renderer5) => {
                    $$renderer5.push(`<!--[-->`);
                    const each_array_37 = ensure_array_like(FAN_ACOUSTIC_VARIANT_MODES);
                    for (let $$index_37 = 0, $$length = each_array_37.length; $$index_37 < $$length; $$index_37++) {
                      let option = each_array_37[$$index_37];
                      $$renderer5.option({ value: option.value }, ($$renderer6) => {
                        $$renderer6.push(`${escape_html(option.label)}`);
                      });
                    }
                    $$renderer5.push(`<!--]-->`);
                  }
                );
                $$renderer4.push(` <p class="form-text mb-0">When set to Default, this is driven by the Motor → Power Supply specification. Single-phase supplies show Running Voltage; all other or unrecognised values show Running Frequency.</p></div> <p class="text-body-secondary mb-0">The speed column is read-only and follows the fan graph line
                    order.</p> <div class="d-flex flex-wrap gap-2"><input class="form-control form-control-sm fan-acoustic-csv-input" type="file" accept=".csv,text/csv"/> <button class="btn btn-outline-secondary btn-sm" type="button">Clear CSV</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", !fanAcousticTable && rpmLines.length === 0, true)}>Export CSV</button> <button class="btn btn-outline-secondary btn-sm" type="button">Add Column</button></div></div> `);
                if (fanAcousticCsvFileName) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="small mb-2">Loaded file: <strong>${escape_html(fanAcousticCsvFileName)}</strong></p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--> `);
                if (fanAcousticCsvError) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-danger mb-2">${escape_html(fanAcousticCsvError)}</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--> <div class="table-responsive fan-acoustic-table-wrap"><table class="table table-sm align-middle editable-table fan-acoustic-table mb-0"><thead><tr><th>Speed (rpm)</th><th>Peak Pressure (Pa)</th><th>Peak Power (kW)</th><th>${escape_html(editorFanAcousticRunningColumnLabel)}</th><th>Sound Pressure Level dB @ 3 meters</th><!--[-->`);
                const each_array_38 = ensure_array_like(fanAcousticTable.sound_power_columns);
                for (let columnIndex = 0, $$length = each_array_38.length; columnIndex < $$length; columnIndex++) {
                  each_array_38[columnIndex];
                  $$renderer4.push(`<th><div class="d-grid gap-1"><input class="form-control form-control-sm" type="text"${attr("value", fanAcousticTable.sound_power_columns[columnIndex])}/> <button class="btn btn-outline-secondary btn-sm" type="button">Rename</button> <button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", fanAcousticTable.sound_power_columns.length <= 1, true)}>Delete</button></div></th>`);
                }
                $$renderer4.push(`<!--]--></tr></thead><tbody><!--[-->`);
                const each_array_39 = ensure_array_like(fanAcousticTable.rows);
                for (let rowIndex = 0, $$length = each_array_39.length; rowIndex < $$length; rowIndex++) {
                  let row = each_array_39[rowIndex];
                  $$renderer4.push(`<tr><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.speed_rpm)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.speed_rpm)} disabled=""/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.peak_pressure_pa)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.peak_pressure_pa)}/></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.peak_power_kw)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.peak_power_kw)}/></td><td>`);
                  if (editorFanAcousticVariant === "1ph") {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.running_voltage_v)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.running_voltage_v)}/>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                    $$renderer4.push(`<input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.running_frequency_hz)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.running_frequency_hz)}/>`);
                  }
                  $$renderer4.push(`<!--]--></td><td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.sound_pressure_db_3m)}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.sound_pressure_db_3m)}/></td><!--[-->`);
                  const each_array_40 = ensure_array_like(fanAcousticTable.sound_power_columns);
                  for (let $$index_39 = 0, $$length2 = each_array_40.length; $$index_39 < $$length2; $$index_39++) {
                    let column = each_array_40[$$index_39];
                    $$renderer4.push(`<td><input${attr_class(`form-control form-control-sm ${editorNumericInputClass(row.sound_power_levels[column])}`, "svelte-py4xdp")} type="number" step="any"${attr("value", row.sound_power_levels[column])}/></td>`);
                  }
                  $$renderer4.push(`<!--]--></tr>`);
                }
                $$renderer4.push(`<!--]--></tbody></table></div> `);
                if (fanAcousticTable.rows.length === 0) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-body-secondary mt-3 mb-0">Load or create RPM lines first so the acoustic table can
                    align itself.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]-->`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]-->`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div></div></div>`);
      } else {
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
    bind_props($$props, {
      initialMode,
      initialProductId,
      initialSeriesId,
      initialSelectionOnly
    });
  });
}
export {
  ProductWorkspace as P
};
