import { s as store_get, h as head, c as attr_class, b as attr, d as ensure_array_like, e as escape_html, u as unsubscribe_stores, i as bind_props } from "../../../../../chunks/index2.js";
import { o as onDestroy } from "../../../../../chunks/index-server.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import { f as fallback } from "../../../../../chunks/equality.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import { B as getProductChartData, y as getSeries, n as getSeriesById, C as getProductTypePdfContext, c as getProduct } from "../../../../../chunks/api.js";
import { E as ECharts, g as getChartTheme, b as buildFullChartOption } from "../../../../../chunks/fullChart.js";
import { t as theme } from "../../../../../chunks/config.js";
import { a as getDescriptionSections } from "../../../../../chunks/descriptionSections.js";
import { J as JobProgressPanel } from "../../../../../chunks/JobProgressPanel.js";
import { S as SeriesNamesBadgeList, f as fanAcousticVariant } from "../../../../../chunks/fanAcoustic.js";
import { A as AssociatedDocumentsPanel } from "../../../../../chunks/AssociatedDocumentsPanel.js";
import { h as html } from "../../../../../chunks/html.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let selectedSeriesPerformanceTableHtml, selectedProductTypeRecord, selectedProductTypeContextMissingSeries, selectedProductTypeContextWarning;
    let data = fallback($$props["data"], () => ({}), true);
    let productTypes = [];
    let templateRegistry = {
      product_templates: [],
      series_templates: [],
      product_type_templates: []
    };
    let selectedProductId = normalizeViewerId(data?.product);
    let rpmLines = [];
    let rpmPoints = [];
    let efficiencyPoints = [];
    let chartOption = {};
    let loadingChart = false;
    let error = "";
    let search = "";
    let productTypeFilter = "";
    let seriesFilter = "";
    let filteredProducts = [];
    let seriesOptions = [];
    let selectedProduct = null;
    let productDescriptionSections = [];
    function normalizeViewerTab(value) {
      return value === "series" || value === "product-type" ? value : "product";
    }
    function normalizeViewerId(value) {
      if (value == null || value === "") return null;
      const numeric = Number(value);
      return Number.isNaN(numeric) ? null : numeric;
    }
    function normalizeViewerStringId(value) {
      if (value == null) return "";
      const stringValue = String(value);
      return stringValue === "null" || stringValue === "undefined" ? "" : stringValue;
    }
    let activeViewerTab = normalizeViewerTab(data?.tab);
    let selectedProductTypeId = normalizeViewerStringId(data?.product_type_id || data?.product_type);
    let selectedProductTypeContext = data?.product_type_context || null;
    let productPdfPreviewRevision = 0;
    let productTypePdfPreviewRevision = 0;
    let seriesPdfPreviewRevision = 0;
    let seriesTabProductTypeFilter = normalizeViewerStringId(data?.series_product_type_key);
    let seriesTabSeriesId = normalizeViewerStringId(data?.series);
    let seriesTabOptions = [];
    let selectedSeriesRecord = null;
    let selectedSeriesGraphRecord = null;
    let seriesDescriptionSections = [];
    let seriesChartOption = {};
    let loadingSeriesGraph = false;
    let productTypeContextRequestToken = 0;
    let seriesGraphRequestToken = 0;
    let productRequestToken = 0;
    let chartRequestToken = 0;
    let seriesTabOptionsRequestToken = 0;
    let previousSelectedSeriesId = null;
    let previousSelectedProductTypeId = "";
    let previousActiveViewerTab = activeViewerTab;
    let refreshingProductGraphId = null;
    let refreshingProductPdfJob = null;
    let refreshingProductTypePdfJob = null;
    let refreshingSeriesGraphId = null;
    let refreshingSeriesPdfJob = null;
    function internalPerformanceTableHtml(value) {
      return String(value || "").replace(/href=(['"])\/products?\/(\d+)(?:-[^"']*)?\1/g, (_match, quote, productId) => `href=${quote}/viewer/product/${productId}${quote}`);
    }
    function productEditorUrl(productId) {
      return productId != null && productId !== "" ? `/editor/edit/${encodeURIComponent(String(productId))}` : "/editor/edit";
    }
    function seriesEditorUrl(seriesId) {
      return seriesId != null && seriesId !== "" ? `/editor/series/edit/${encodeURIComponent(String(seriesId))}` : "/editor/series/edit";
    }
    function productTypeEditorUrl(productTypeId) {
      return productTypeId != null && productTypeId !== "" ? `/editor/product-types/edit/${encodeURIComponent(String(productTypeId))}` : "/editor/product-types/edit";
    }
    function getCurrentProductType() {
      return productTypes.find((item) => item.key === selectedProduct?.product_type_key) || null;
    }
    function templateCollection(templateType) {
      if (templateType === "series") return templateRegistry.series_templates ?? [];
      if (templateType === "product_type") return templateRegistry.product_type_templates ?? [];
      return templateRegistry.product_templates ?? [];
    }
    function templateLabel(templateType, templateId, fallbackId) {
      const selectedId = templateId || fallbackId;
      const match = templateCollection(templateType).find((item) => item.id === selectedId);
      if (match?.label) return match.label;
      if (selectedId) return selectedId;
      return "Default";
    }
    function productPdfTemplateLabel(product) {
      return templateLabel("product", product?.printed_template_id, product?.template_id || product?.online_template_id || "product-default");
    }
    function productTypePdfTemplateLabel(productType) {
      return templateLabel("product_type", productType?.product_type_template_id, "product_type-default");
    }
    function seriesPdfTemplateLabel(series) {
      return templateLabel("series", series?.printed_template_id, series?.template_id || series?.online_template_id || "series-default");
    }
    function productTypePdfPreviewUrl(productType) {
      if (!productType?.product_type_pdf_url) return "";
      const separator = productType.product_type_pdf_url.includes("?") ? "&" : "?";
      return `${productType.product_type_pdf_url}${separator}security=pdf-frame-2-${productTypePdfPreviewRevision}`;
    }
    function versionedPdfPreviewUrl(baseUrl, revision) {
      if (!baseUrl) return "";
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}security=pdf-frame-2-${revision}`;
    }
    function productPdfPreviewUrl(product) {
      const baseUrl = product?.product_printed_pdf_url || product?.product_pdf_url;
      return versionedPdfPreviewUrl(baseUrl, productPdfPreviewRevision);
    }
    function seriesPdfPreviewUrl(series) {
      const baseUrl = series?.series_printed_pdf_url || series?.series_pdf_url;
      return versionedPdfPreviewUrl(baseUrl, seriesPdfPreviewRevision);
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
    function supportsGraphOverlays() {
      return getCurrentProductType()?.supports_graph_overlays ?? true;
    }
    function supportsBandGraphStyle() {
      return getCurrentProductType()?.supports_band_graph_style ?? true;
    }
    function graphHeading() {
      const productType = getCurrentProductType();
      if (!productType) return "Product graph";
      if (productType.graph_kind === "silencer_loss") return "Volume flow vs pressure loss";
      if (productType.graph_kind === "fan_map") return "Airflow vs pressure";
      return `${productType.label} graph`;
    }
    function formatParameterValue(parameter) {
      if (parameter.value_string) return parameter.value_string;
      if (parameter.value_number != null) {
        return `${parameter.value_number}${parameter.unit ? ` ${parameter.unit}` : ""}`;
      }
      return "—";
    }
    function formatNumericValue(value) {
      if (value == null || value === "") return "—";
      const numeric = Number(value);
      return Number.isNaN(numeric) ? String(value) : `${numeric}`;
    }
    function productHasFanAcousticTable(product) {
      return product?.product_type_key === "fan";
    }
    function currentFanAcousticVariant(product) {
      return fanAcousticVariant(product?.fan_acoustic_table, product?.parameter_groups);
    }
    function flattenSeriesGraphPayload(seriesGraphPayload) {
      const rpmLines2 = Array.isArray(seriesGraphPayload?.rpmLines) ? seriesGraphPayload.rpmLines : [];
      const rpmPoints2 = [];
      for (const line of rpmLines2) {
        const rpmLineId = line?.id != null ? line.id : rpmPoints2.length + 1;
        const rpmValue = line?.rpm != null ? line.rpm : rpmLineId;
        const points = Array.isArray(line?.points) ? line.points : [];
        points.forEach((point, pointIndex) => {
          rpmPoints2.push({
            id: point?.id ?? `${rpmLineId}-${pointIndex}`,
            airflow: point?.airflow,
            pressure: point?.pressure,
            rpm_line_id: rpmLineId,
            rpm: rpmValue
          });
        });
      }
      return { rpmLines: rpmLines2, rpmPoints: rpmPoints2 };
    }
    function buildChartOptions() {
      const currentProduct = selectedProduct;
      const chartTheme = getChartTheme(store_get($$store_subs ??= {}, "$theme", theme));
      const productTypeName = String(currentProduct?.product_type_label || currentProduct?.product_type_key || "").trim();
      const seriesName = String(currentProduct?.series_name || "").trim();
      const productName = String(currentProduct?.model || "Product Graph").trim();
      const titleParts = [];
      if (productTypeName) titleParts.push(productTypeName);
      const productSegment = `${seriesName ? `${seriesName} - ` : ""}${productName}`.trim();
      const chartTitle = `${titleParts.join(" | ")}${titleParts.length ? " | " : ""}${productSegment} performance graph`.trim();
      chartOption = buildFullChartOption({
        rpmLines,
        rpmPoints,
        efficiencyPoints,
        chartTheme,
        title: chartTitle || (currentProduct ? currentProduct.model : "Product Graph"),
        graphConfig: getCurrentGraphConfig(),
        graphMode: "product",
        permissibleUseMode: currentProduct?.permissible_use_mode || "both",
        clipRpmAreaToPermissibleUse: true,
        showRpmBandShading: supportsBandGraphStyle() ? currentProduct?.show_rpm_band_shading ?? true : false,
        showSecondaryAxis: supportsGraphOverlays(),
        adaptGraphBackgroundToTheme: true,
        graphStyle: currentProduct ? {
          band_graph_background_color: currentProduct.band_graph_background_color,
          band_graph_label_text_color: currentProduct.band_graph_label_text_color,
          band_graph_faded_opacity: currentProduct.band_graph_faded_opacity,
          band_graph_permissible_label_color: currentProduct.band_graph_permissible_label_color
        } : null
      });
    }
    function buildSeriesChartOptions() {
      const seriesGraphPayload = selectedSeriesGraphRecord?.series_graph_payload;
      if (!seriesGraphPayload?.hasGraphData) {
        seriesChartOption = {};
        return;
      }
      const rpmLines2 = Array.isArray(seriesGraphPayload.rpmLines) ? seriesGraphPayload.rpmLines : [];
      const rpmPoints2 = Array.isArray(seriesGraphPayload.rpmPoints) && seriesGraphPayload.rpmPoints.length ? seriesGraphPayload.rpmPoints : flattenSeriesGraphPayload(seriesGraphPayload).rpmPoints;
      const chartTheme = getChartTheme(store_get($$store_subs ??= {}, "$theme", theme));
      const seriesName = String(selectedSeriesGraphRecord?.name || "Series Graph").trim();
      const title = String(seriesGraphPayload.graphTitle || seriesGraphPayload.title || `${seriesName} performance graph`).trim();
      seriesChartOption = buildFullChartOption({
        rpmLines: rpmLines2,
        rpmPoints: rpmPoints2,
        efficiencyPoints: Array.isArray(seriesGraphPayload.efficiencyPoints) ? seriesGraphPayload.efficiencyPoints : [],
        chartTheme,
        title,
        graphConfig: seriesGraphPayload.graphConfig,
        graphMode: "series",
        showRpmBandShading: Boolean(seriesGraphPayload.showRpmBandShading),
        graphStyle: seriesGraphPayload.graphStyle ?? null,
        adaptGraphBackgroundToTheme: true
      });
    }
    async function loadChartData() {
      const requestToken = ++chartRequestToken;
      if (!selectedProductId) {
        rpmLines = [];
        rpmPoints = [];
        efficiencyPoints = [];
        chartOption = {};
        return;
      }
      loadingChart = true;
      error = "";
      try {
        const chartData = await getProductChartData(selectedProductId);
        if (requestToken !== chartRequestToken) return;
        rpmLines = chartData.rpmLines;
        rpmPoints = chartData.rpmPoints;
        efficiencyPoints = chartData.efficiencyPoints;
        buildChartOptions();
      } catch (e) {
        if (requestToken !== chartRequestToken) return;
        error = e.message;
      } finally {
        if (requestToken === chartRequestToken) loadingChart = false;
      }
    }
    async function loadSeriesTabOptions() {
      const requestToken = ++seriesTabOptionsRequestToken;
      try {
        seriesTabOptions = await getSeries(seriesTabProductTypeFilter ? { product_type_key: seriesTabProductTypeFilter } : {});
        if (requestToken !== seriesTabOptionsRequestToken) return;
      } catch {
        if (requestToken !== seriesTabOptionsRequestToken) return;
        seriesTabOptions = [];
      } finally {
      }
      if (seriesTabSeriesId && !seriesTabOptions.some((series) => Number(series.id) === Number(seriesTabSeriesId))) {
        error = "Series not found.";
        seriesTabSeriesId = "";
      }
    }
    async function loadSelectedSeriesGraph() {
      const selectedSeriesId = selectedSeriesRecord?.id != null ? Number(selectedSeriesRecord.id) : null;
      const requestToken = ++seriesGraphRequestToken;
      if (!selectedSeriesId) {
        selectedSeriesGraphRecord = null;
        seriesChartOption = {};
        loadingSeriesGraph = false;
        return;
      }
      loadingSeriesGraph = true;
      try {
        const seriesDetail = await getSeriesById(selectedSeriesId);
        if (requestToken !== seriesGraphRequestToken) return;
        selectedSeriesGraphRecord = seriesDetail;
        buildSeriesChartOptions();
      } catch {
        if (requestToken !== seriesGraphRequestToken) return;
        selectedSeriesGraphRecord = null;
        seriesChartOption = {};
      } finally {
        if (requestToken === seriesGraphRequestToken) {
          loadingSeriesGraph = false;
        }
      }
    }
    async function loadProductTypeContext(productTypeId = selectedProductTypeRecord?.id) {
      const requestToken = ++productTypeContextRequestToken;
      if (!productTypeId) {
        selectedProductTypeContext = null;
        return;
      }
      try {
        const context = await getProductTypePdfContext(productTypeId);
        if (requestToken === productTypeContextRequestToken) {
          selectedProductTypeContext = context;
        }
      } catch {
        if (requestToken === productTypeContextRequestToken) {
          selectedProductTypeContext = null;
        }
      }
    }
    async function loadSelectedProduct() {
      const requestToken = ++productRequestToken;
      if (!selectedProductId) {
        selectedProduct = null;
        rpmLines = [];
        rpmPoints = [];
        efficiencyPoints = [];
        chartOption = {};
        return;
      }
      selectedProduct = null;
      rpmLines = [];
      rpmPoints = [];
      efficiencyPoints = [];
      chartOption = {};
      error = "";
      try {
        const product = await getProduct(selectedProductId);
        if (requestToken !== productRequestToken) return;
        selectedProduct = product;
      } catch (e) {
        if (requestToken !== productRequestToken) return;
        error = e.message;
        selectedProduct = null;
      }
    }
    let previousSelectedProductId = null;
    let previousSeriesTabProductTypeFilter = "";
    onDestroy(() => {
    });
    {
      JSON.stringify({ search, productTypeFilter, seriesFilter });
    }
    productDescriptionSections = getDescriptionSections(selectedProduct || {});
    if (seriesTabProductTypeFilter !== previousSeriesTabProductTypeFilter) {
      previousSeriesTabProductTypeFilter = seriesTabProductTypeFilter;
      if (seriesTabProductTypeFilter) {
        loadSeriesTabOptions();
      }
    }
    selectedSeriesRecord = seriesTabOptions.find((series) => Number(series.id) === Number(seriesTabSeriesId)) || null;
    seriesDescriptionSections = getDescriptionSections(selectedSeriesRecord || {});
    if (String(selectedSeriesRecord?.id || "") !== String(previousSelectedSeriesId || "")) {
      previousSelectedSeriesId = selectedSeriesRecord?.id ?? null;
      selectedSeriesGraphRecord = null;
      seriesChartOption = {};
      loadSelectedSeriesGraph();
    }
    selectedSeriesPerformanceTableHtml = internalPerformanceTableHtml(selectedSeriesGraphRecord?.performance_table_html);
    if (store_get($$store_subs ??= {}, "$theme", theme), productTypes) {
      buildChartOptions();
    }
    if (selectedProductId !== previousSelectedProductId) {
      previousSelectedProductId = selectedProductId;
      loadSelectedProduct();
      loadChartData();
    }
    if (productTypes.length > 0 && selectedProductTypeId) {
      const normalizedProductType = productTypes.find((productType) => String(productType.id) === String(selectedProductTypeId) || String(productType.key) === String(selectedProductTypeId));
      if (normalizedProductType && String(selectedProductTypeId) !== String(normalizedProductType.id)) {
        selectedProductTypeId = String(normalizedProductType.id);
      }
    }
    selectedProductTypeRecord = productTypes.find((productType) => String(productType.id) === String(selectedProductTypeId) || String(productType.key) === String(selectedProductTypeId)) || null;
    if (String(selectedProductTypeId || "") !== String(previousSelectedProductTypeId || "")) {
      const hadPreviousProductType = Boolean(previousSelectedProductTypeId);
      previousSelectedProductTypeId = selectedProductTypeId || "";
      if (hadPreviousProductType) {
        selectedProductTypeContext = null;
      }
      if (selectedProductTypeId && activeViewerTab === "product-type" && !selectedProductTypeContext) {
        loadProductTypeContext(selectedProductTypeId);
      }
    }
    if (activeViewerTab !== previousActiveViewerTab) {
      previousActiveViewerTab = activeViewerTab;
      if (activeViewerTab === "product-type" && selectedProductTypeId && !selectedProductTypeContext) {
        loadProductTypeContext(selectedProductTypeId);
      }
    }
    selectedProductTypeContextMissingSeries = selectedProductTypeContext?.series?.filter((series) => Number(series.page_count || 0) === 0) || [];
    selectedProductTypeContextWarning = selectedProductTypeContextMissingSeries.length ? "One or more linked series PDF files are missing or not generated yet, so this PDF context is incomplete." : "";
    if (selectedSeriesGraphRecord && store_get($$store_subs ??= {}, "$theme", theme)) {
      buildSeriesChartOptions();
    } else if (!selectedSeriesGraphRecord) {
      seriesChartOption = {};
    }
    head("36khdd", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Viewer — Internal Facing</title>`);
      });
    });
    $$renderer2.push(`<div class="page-stack svelte-36khdd"><div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Review &amp; Generate</p> <h1>Viewer</h1> <p class="text-body-secondary mb-0">Filter products, select a record, and review all of its information, images, graph output, PDF output, and series data.</p></div></div> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="alert alert-danger mb-0">${escape_html(error)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <ul class="nav nav-tabs viewer-tabs svelte-36khdd"><li class="nav-item"><button${attr_class("nav-link svelte-36khdd", void 0, { "active": activeViewerTab === "product" })} type="button">Product</button></li> <li class="nav-item"><button${attr_class("nav-link svelte-36khdd", void 0, { "active": activeViewerTab === "series" })} type="button">Series</button></li> <li class="nav-item"><button${attr_class("nav-link svelte-36khdd", void 0, { "active": activeViewerTab === "product-type" })} type="button">Product Types</button></li></ul> `);
    if (activeViewerTab === "product") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="row g-3 align-items-start"><div class="col-12 col-xxl-4"><div class="vstack gap-3 viewer-sidebar"><div class="card shadow-sm"><div class="card-body"><div class="row g-3 align-items-end"><div class="col-12"><label class="form-label" for="viewer-search">Search</label> <input class="form-control" id="viewer-search"${attr("value", search)} placeholder="Model, series, mounting, discharge"/></div> <div class="col-12"><label class="form-label" for="viewer-product-type">Product type</label> `);
      $$renderer2.select(
        {
          class: "form-select",
          id: "viewer-product-type",
          value: productTypeFilter
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`All types`);
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
      $$renderer2.push(`</div> <div class="col-12"><label class="form-label" for="viewer-series">Series</label> `);
      $$renderer2.select(
        {
          class: "form-select",
          id: "viewer-series",
          value: seriesFilter
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`-- Choose option --`);
          });
          $$renderer3.push(`<!--[-->`);
          const each_array_1 = ensure_array_like(seriesOptions);
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let series = each_array_1[$$index_1];
            $$renderer3.option({ value: series.id ?? series.name }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(series.name)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(`</div> <div class="col-12 d-grid"><button class="btn btn-outline-secondary">Clear</button></div></div></div></div> <div class="card shadow-sm"><div class="card-body"><div class="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap"><div><h2 class="h5 mb-1">Products</h2> <p class="text-body-secondary mb-0">Choose a product to load its information.</p></div> `);
      {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="small text-body-secondary">Loading…</span>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="table-responsive"><table class="table table-sm align-middle viewer-list-table mb-0 svelte-36khdd"><thead><tr><th class="svelte-36khdd">Model</th><th class="svelte-36khdd">Type</th><th class="svelte-36khdd">Series</th></tr></thead><tbody class="svelte-36khdd"><!--[-->`);
        const each_array_2 = ensure_array_like(filteredProducts);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let product = each_array_2[$$index_2];
          $$renderer2.push(`<tr${attr_class("svelte-36khdd", void 0, {
            "selected-row": Number(product.id) === Number(selectedProductId)
          })}><td class="svelte-36khdd"><button class="btn btn-link p-0 text-start text-decoration-none fw-semibold viewer-select-button svelte-36khdd" type="button">${escape_html(product.model)}</button></td><td class="svelte-36khdd">${escape_html(product.product_type_label || product.product_type_key)}</td><td class="svelte-36khdd">${escape_html(product.series_name || "—")}</td></tr>`);
        }
        $$renderer2.push(`<!--]--></tbody></table></div>`);
      }
      $$renderer2.push(`<!--]--></div></div></div></div> <div class="col-12 col-xxl-8"><div class="vstack gap-3">`);
      if (selectedProduct) {
        $$renderer2.push("<!--[0-->");
        const currentProduct = selectedProduct;
        $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><div class="d-flex flex-wrap align-items-start gap-2"><div class="me-auto"><h2 class="h4 mb-1">${escape_html(currentProduct.model)}</h2> <div class="text-body-secondary">${escape_html(currentProduct.product_type_label || currentProduct.product_type_key)} `);
        if (currentProduct.series_name) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`· ${escape_html(currentProduct.series_name)}`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingProductGraphId === currentProduct.id, true)}>${escape_html(refreshingProductGraphId === currentProduct.id ? "Generating Graph..." : "Generate Graph")}</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingProductPdfJob?.status === "running", true)}>${escape_html("Generate PDF")}</button> <a class="btn btn-outline-primary btn-sm"${attr("href", productEditorUrl(currentProduct.id))}>Open in Editor</a> `);
        if (currentProduct.graph_image_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", currentProduct.graph_image_url)} target="_blank" rel="noreferrer">Open Graph</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (currentProduct.product_printed_pdf_url || currentProduct.product_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", currentProduct.product_printed_pdf_url || currentProduct.product_pdf_url)} target="_blank" rel="noreferrer">Open PDF</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> `);
        JobProgressPanel($$renderer2, {
          job: refreshingProductPdfJob,
          label: "Product PDF generation"
        });
        $$renderer2.push(`<!----> <div class="row g-3 mt-1"><div class="col-12 col-md-3"><div class="viewer-metric svelte-36khdd"><div class="viewer-metric-label svelte-36khdd">Product Type</div> <div>${escape_html(currentProduct.product_type_label || currentProduct.product_type_key || "—")}</div></div></div> <div class="col-12 col-md-3"><div class="viewer-metric svelte-36khdd"><div class="viewer-metric-label svelte-36khdd">Series</div> <div>${escape_html(currentProduct.series_name || "—")}</div></div></div> <div class="col-12 col-md-3"><div class="viewer-metric svelte-36khdd"><div class="viewer-metric-label svelte-36khdd">Printed PDF template</div> <div>${escape_html(productPdfTemplateLabel(currentProduct))}</div></div></div></div></div></div> <div class="row g-3"><!--[-->`);
        const each_array_3 = ensure_array_like(productDescriptionSections);
        for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
          let section = each_array_3[$$index_3];
          $$renderer2.push(`<div class="col-12 col-lg-6"><div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">${escape_html(section.title)}</h3> <div class="viewer-html svelte-36khdd">${html(section.html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div></div></div>`);
        }
        $$renderer2.push(`<!--]--></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Grouped Specifications</h3> `);
        if ((currentProduct.parameter_groups?.length ?? 0) > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="vstack gap-3 mt-3"><!--[-->`);
          const each_array_4 = ensure_array_like(currentProduct.parameter_groups);
          for (let $$index_5 = 0, $$length = each_array_4.length; $$index_5 < $$length; $$index_5++) {
            let group = each_array_4[$$index_5];
            $$renderer2.push(`<div class="border rounded p-3"><div class="fw-semibold mb-2">${escape_html(group.group_name)}</div> <div class="table-responsive"><table class="table table-sm mb-0 spec-group-table svelte-36khdd"><tbody class="svelte-36khdd"><!--[-->`);
            const each_array_5 = ensure_array_like(group.parameters);
            for (let $$index_4 = 0, $$length2 = each_array_5.length; $$index_4 < $$length2; $$index_4++) {
              let parameter = each_array_5[$$index_4];
              $$renderer2.push(`<tr class="svelte-36khdd"><th style="width: 40%" class="svelte-36khdd">${escape_html(parameter.parameter_name)}</th><td class="svelte-36khdd">${escape_html(formatParameterValue(parameter))}</td></tr>`);
            }
            $$renderer2.push(`<!--]--></tbody></table></div></div>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No grouped specifications for this product yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div> `);
        if (productHasFanAcousticTable(currentProduct)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><h3 class="h5">Fan Acoustic Table</h3> <p class="text-body-secondary mb-3">Rows track the current RPM graph rows. Octave-band columns appear in the configured order.</p> <div class="table-responsive fan-acoustic-viewer-table-wrap svelte-36khdd"><table class="table table-sm align-middle fan-acoustic-viewer-table mb-0 svelte-36khdd"><colgroup><col style="width: 7.5rem"/><col style="width: 8.5rem"/><col style="width: 7.5rem"/><col style="width: 7.5rem"/><col style="width: 10.5rem"/><!--[-->`);
          const each_array_6 = ensure_array_like(currentProduct.fan_acoustic_table.sound_power_columns);
          for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
            each_array_6[$$index_6];
            $$renderer2.push(`<col style="width: 4.75rem"/>`);
          }
          $$renderer2.push(`<!--]--></colgroup><thead><tr><th rowspan="2" class="svelte-36khdd">Speed (rpm)</th><th rowspan="2" class="svelte-36khdd">Peak Pressure (Pa)</th><th rowspan="2" class="svelte-36khdd">Peak Power (kW)</th><th rowspan="2" class="svelte-36khdd">${escape_html(currentFanAcousticVariant(currentProduct) === "1ph" ? "Running Voltage" : "Running Frequency")}</th><th rowspan="2" class="svelte-36khdd">Sound Pressure Level dB @ 3 meters</th><th${attr("colspan", currentProduct.fan_acoustic_table.sound_power_columns?.length ?? 0)} class="text-center svelte-36khdd">Sound Power Level SWL dB re 1pw</th></tr><tr><!--[-->`);
          const each_array_7 = ensure_array_like(currentProduct.fan_acoustic_table.sound_power_columns);
          for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
            let column = each_array_7[$$index_7];
            $$renderer2.push(`<th class="svelte-36khdd">${escape_html(column)}</th>`);
          }
          $$renderer2.push(`<!--]--></tr></thead><tbody>`);
          if ((currentProduct.fan_acoustic_table.rows?.length ?? 0) > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<!--[-->`);
            const each_array_8 = ensure_array_like(currentProduct.fan_acoustic_table.rows);
            for (let $$index_9 = 0, $$length = each_array_8.length; $$index_9 < $$length; $$index_9++) {
              let row = each_array_8[$$index_9];
              $$renderer2.push(`<tr><td class="svelte-36khdd">${escape_html(formatNumericValue(row.speed_rpm))}</td><td class="svelte-36khdd">${escape_html(formatNumericValue(row.peak_pressure_pa))}</td><td class="svelte-36khdd">${escape_html(formatNumericValue(row.peak_power_kw))}</td><td class="svelte-36khdd">${escape_html(formatNumericValue(currentFanAcousticVariant(currentProduct) === "1ph" ? row.running_voltage_v : row.running_frequency_hz))}</td><td class="svelte-36khdd">${escape_html(formatNumericValue(row.sound_pressure_db_3m))}</td><!--[-->`);
              const each_array_9 = ensure_array_like(currentProduct.fan_acoustic_table.sound_power_columns);
              for (let $$index_8 = 0, $$length2 = each_array_9.length; $$index_8 < $$length2; $$index_8++) {
                let column = each_array_9[$$index_8];
                $$renderer2.push(`<td class="svelte-36khdd">${escape_html(formatNumericValue(row.sound_power_levels?.[column]))}</td>`);
              }
              $$renderer2.push(`<!--]--></tr>`);
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<tr><td${attr("colspan", 5 + (currentProduct.fan_acoustic_table.sound_power_columns?.length ?? 0))} class="text-body-secondary svelte-36khdd">No fan acoustic rows yet.</td></tr>`);
          }
          $$renderer2.push(`<!--]--></tbody></table></div></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Product Images</h3> `);
        if ((currentProduct.product_images?.length ?? 0) > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="image-grid mt-3 svelte-36khdd"><!--[-->`);
          const each_array_10 = ensure_array_like(currentProduct.product_images);
          for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
            let image = each_array_10[$$index_10];
            $$renderer2.push(`<figure class="image-card svelte-36khdd"><img${attr("src", image.url)}${attr("alt", currentProduct.model)} class="svelte-36khdd"/></figure>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No product images yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">${escape_html(graphHeading())}</h3> `);
        if (loadingChart) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">Loading graph data…</p>`);
        } else if (rpmPoints.length === 0 && efficiencyPoints.length === 0) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No graph points for this product yet.</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="mt-3">`);
          ECharts($$renderer2, { option: chartOption, height: "700px" });
          $$renderer2.push(`<!----></div>`);
        }
        $$renderer2.push(`<!--]--></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Product PDF</h3> `);
        if (currentProduct.product_printed_pdf_url || currentProduct.product_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="vstack gap-3 mt-3"><div class="ratio ratio-16x9"><iframe${attr("src", productPdfPreviewUrl(currentProduct))}${attr("title", `${currentProduct.model} PDF preview`)} class="svelte-36khdd"></iframe></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No product PDF generated yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div> `);
        if (currentProduct?.id) {
          $$renderer2.push("<!--[0-->");
          AssociatedDocumentsPanel($$renderer2, {
            ownerType: "product",
            ownerId: currentProduct.id,
            editable: false
          });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><p class="text-body-secondary mb-0">Select a product to review its details, graph, images, and PDF.</p></div></div>`);
      }
      $$renderer2.push(`<!--]--></div></div></div>`);
    } else if (activeViewerTab === "product-type") {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="row g-3 align-items-start"><div class="col-12 col-xxl-4"><div class="card shadow-sm"><div class="card-body"><label class="form-label" for="viewer-product-type-select">Product type</label> `);
      $$renderer2.select(
        {
          class: "form-select",
          id: "viewer-product-type-select",
          value: selectedProductTypeId
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`-- Choose option --`);
          });
          $$renderer3.push(`<!--[-->`);
          const each_array_11 = ensure_array_like(productTypes);
          for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
            let productType = each_array_11[$$index_11];
            $$renderer3.option({ value: String(productType.id) }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(productType.label)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(` <div class="d-grid gap-2 mt-3"><button class="btn btn-outline-secondary" type="button"${attr("disabled", !selectedProductTypeRecord || refreshingProductTypePdfJob?.status === "running", true)}>${escape_html("Generate Product Type PDF")}</button> `);
      if (selectedProductTypeRecord) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-body-secondary">Template: ${escape_html(productTypePdfTemplateLabel(selectedProductTypeRecord))}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      JobProgressPanel($$renderer2, {
        job: refreshingProductTypePdfJob,
        label: "Product type PDF generation"
      });
      $$renderer2.push(`<!----> `);
      if (selectedProductTypeRecord?.product_type_pdf_url) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a class="btn btn-outline-primary"${attr("href", selectedProductTypeRecord.product_type_pdf_url)} target="_blank" rel="noreferrer">Open Product Type PDF</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (selectedProductTypeRecord) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a class="btn btn-outline-secondary"${attr("href", productTypeEditorUrl(selectedProductTypeRecord.id))}>Open in Editor</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div></div></div> <div class="col-12 col-xxl-8">`);
      if (selectedProductTypeRecord) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="vstack gap-3"><div class="card shadow-sm"><div class="card-body"><div class="d-flex flex-wrap align-items-start gap-2"><div class="me-auto"><h2 class="h4 mb-1">${escape_html(selectedProductTypeRecord.label)}</h2> <div class="text-body-secondary">${escape_html(selectedProductTypeRecord.key)}</div></div></div> <div class="row g-3 mt-1"><div class="col-12 col-md-4"><div class="viewer-metric svelte-36khdd"><div class="viewer-metric-label svelte-36khdd">Series</div> <div>${escape_html(selectedProductTypeRecord.series_names?.length || 0)}</div></div></div> <div class="col-12 col-md-4"><div class="viewer-metric svelte-36khdd"><div class="viewer-metric-label svelte-36khdd">PDF</div> <div>${escape_html(selectedProductTypeRecord.product_type_pdf_url ? "Available" : "Not generated yet")}</div></div></div> <div class="col-12 col-md-4"><div class="viewer-metric svelte-36khdd"><div class="viewer-metric-label svelte-36khdd">Product type PDF template</div> <div>${escape_html(productTypePdfTemplateLabel(selectedProductTypeRecord))}</div></div></div></div> <div class="mt-3">`);
        SeriesNamesBadgeList($$renderer2, {
          seriesNames: selectedProductTypeRecord.series_names || [],
          title: `Series names for ${selectedProductTypeRecord.label}`,
          emptyLabel: "This product type has no linked series yet."
        });
        $$renderer2.push(`<!----></div></div></div> `);
        if (selectedProductTypeRecord?.id) {
          $$renderer2.push("<!--[0-->");
          AssociatedDocumentsPanel($$renderer2, {
            ownerType: "product_type",
            ownerId: selectedProductTypeRecord.id,
            editable: false
          });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="card shadow-sm"><div class="card-body"><div class="d-flex flex-wrap align-items-start gap-2"><div class="me-auto"><h3 class="h5 mb-1">Generated PDF</h3> <div class="small text-body-secondary">Inline preview of the latest generated PDF.</div></div> `);
        if (selectedProductTypeRecord?.product_type_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", selectedProductTypeRecord.product_type_pdf_url)} target="_blank" rel="noreferrer">Open PDF</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> `);
        if (selectedProductTypeRecord?.product_type_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="ratio ratio-16x9 mt-3"><iframe${attr("src", productTypePdfPreviewUrl(selectedProductTypeRecord))}${attr("title", `${selectedProductTypeRecord.label} PDF preview`)} class="svelte-36khdd"></iframe></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0 mt-3">No generated PDF available yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5 mb-3">PDF context</h3> `);
        if (selectedProductTypeContext) {
          $$renderer2.push("<!--[0-->");
          if (selectedProductTypeContextWarning) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="alert alert-warning"><div class="fw-semibold">Incomplete PDF context</div> <div>${escape_html(selectedProductTypeContextWarning)}</div> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-warning btn-sm" type="button">Review missing series</button></div> `);
            if (selectedProductTypeContextMissingSeries.length) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<div class="mt-2">Missing series:
                          ${escape_html(selectedProductTypeContextMissingSeries.map((series) => series.name).join(", "))}</div>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="small text-body-secondary mb-3">Intro pages: ${escape_html(selectedProductTypeContext.intro_page_count)} · Total pages: ${escape_html(selectedProductTypeContext.page_count)}</div> <div class="vstack gap-3"><!--[-->`);
          const each_array_12 = ensure_array_like(selectedProductTypeContext.series);
          for (let $$index_12 = 0, $$length = each_array_12.length; $$index_12 < $$length; $$index_12++) {
            let series = each_array_12[$$index_12];
            $$renderer2.push(`<div class="border rounded p-3"><div class="d-flex justify-content-between gap-2 flex-wrap"><div class="fw-semibold">${escape_html(series.name)}</div> <div class="small text-body-secondary">Pages ${escape_html(series.page_start)} to ${escape_html(series.page_end)}</div></div> `);
            if (Number(series.page_count || 0) === 0) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<div class="small text-warning-emphasis mt-1">Series PDF is missing or not generated yet.</div>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--> <div class="small text-body-secondary mb-2">${escape_html(series.product_count)} products</div> `);
            SeriesNamesBadgeList($$renderer2, {
              seriesNames: series.products?.map((product) => product.model) || [],
              title: "Products",
              emptyLabel: "No products in this series yet."
            });
            $$renderer2.push(`<!----></div>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No PDF context available yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><p class="text-body-secondary mb-0">Select a product type to inspect its PDF data and generation state.</p></div></div>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="vstack gap-3"><div class="card shadow-sm"><div class="card-body"><div class="row g-3 align-items-end"><div class="col-12 col-md-6 col-lg-3"><label class="form-label" for="viewer-series-tab-type">Product type</label> `);
      $$renderer2.select(
        {
          class: "form-select",
          id: "viewer-series-tab-type",
          value: seriesTabProductTypeFilter
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`-- Choose option --`);
          });
          $$renderer3.push(`<!--[-->`);
          const each_array_13 = ensure_array_like(productTypes);
          for (let $$index_13 = 0, $$length = each_array_13.length; $$index_13 < $$length; $$index_13++) {
            let productType = each_array_13[$$index_13];
            $$renderer3.option({ value: productType.key }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(productType.label)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(`</div> <div class="col-12 col-md-6 col-lg-3"><label class="form-label" for="viewer-series-tab-series">Series</label> `);
      $$renderer2.select(
        {
          class: "form-select",
          id: "viewer-series-tab-series",
          value: seriesTabSeriesId,
          disabled: !seriesTabProductTypeFilter
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`-- Choose option --`);
          });
          $$renderer3.push(`<!--[-->`);
          const each_array_14 = ensure_array_like(seriesTabOptions);
          for (let $$index_14 = 0, $$length = each_array_14.length; $$index_14 < $$length; $$index_14++) {
            let series = each_array_14[$$index_14];
            $$renderer3.option({ value: series.id }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(series.name)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(`</div></div></div></div> `);
      if (selectedSeriesRecord) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><h3 class="h5">Series Data</h3> <div class="text-body-secondary small mb-3">${escape_html(selectedSeriesRecord.name)} · ${escape_html(selectedSeriesRecord.product_count)} products</div> <div class="d-flex flex-wrap align-items-start gap-2 mb-3"><div class="me-auto"></div> <a class="btn btn-outline-primary btn-sm"${attr("href", seriesEditorUrl(selectedSeriesRecord.id))}>Open in Editor</a> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingSeriesGraphId === selectedSeriesRecord.id, true)}>${escape_html(refreshingSeriesGraphId === selectedSeriesRecord.id ? "Generating Graph..." : "Generate Series Graph")}</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingSeriesPdfJob?.status === "running", true)}>${escape_html("Generate Series PDF")}</button> `);
        if (selectedSeriesRecord.series_printed_pdf_url || selectedSeriesRecord.series_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", selectedSeriesRecord.series_printed_pdf_url || selectedSeriesRecord.series_pdf_url)} target="_blank" rel="noreferrer">Open PDF</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> `);
        JobProgressPanel($$renderer2, { job: refreshingSeriesPdfJob, label: "Series PDF generation" });
        $$renderer2.push(`<!----> <div class="row g-3 mb-3"><div class="col-12 col-md-4"><div class="viewer-metric svelte-36khdd"><div class="viewer-metric-label svelte-36khdd">Series PDF template</div> <div>${escape_html(seriesPdfTemplateLabel(selectedSeriesRecord))}</div></div></div> <div class="col-12 col-md-8"><div class="viewer-metric svelte-36khdd"><div class="viewer-metric-label svelte-36khdd">Contents page description</div> <div class="viewer-html svelte-36khdd">${html(selectedSeriesGraphRecord?.contents_description || selectedSeriesRecord.contents_description || '<span class="text-body-secondary">Not provided.</span>')}</div></div></div></div> <div class="card series-graph-card shadow-sm mb-3 svelte-36khdd"><div class="card-body"><div class="d-flex flex-wrap align-items-center gap-2 mb-2"><h4 class="h6 mb-0">Series Graph</h4> <div class="ms-auto">`);
        if (selectedSeriesRecord.series_graph_image_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", selectedSeriesRecord.series_graph_image_url)} target="_blank" rel="noreferrer">Open Series Graph</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div> `);
        if (loadingSeriesGraph) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">Loading live series graph...</p>`);
        } else if (Object.keys(seriesChartOption).length > 0) {
          $$renderer2.push("<!--[1-->");
          ECharts($$renderer2, { option: seriesChartOption, height: "700px" });
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No series graph data is available yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div> `);
        if (selectedSeriesPerformanceTableHtml) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="card shadow-sm series-performance-card mb-3 svelte-36khdd"><div class="card-body"><div class="d-flex flex-wrap align-items-center gap-2 mb-3"><div><h4 class="h6 mb-1">Performance Table</h4> <div class="small text-body-secondary">Model variants, key specification columns, and performance ranges for this series.</div></div></div> <div class="performance-table-host svelte-36khdd">${html(selectedSeriesPerformanceTableHtml)}</div></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="row g-3"><!--[-->`);
        const each_array_15 = ensure_array_like(seriesDescriptionSections);
        for (let $$index_15 = 0, $$length = each_array_15.length; $$index_15 < $$length; $$index_15++) {
          let section = each_array_15[$$index_15];
          $$renderer2.push(`<div class="col-12 col-lg-6"><h4 class="h6">${escape_html(section.title)}</h4> <div class="viewer-html svelte-36khdd">${html(section.html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div>`);
        }
        $$renderer2.push(`<!--]--></div></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Series Images</h3> `);
        if ((selectedSeriesRecord.series_images?.length ?? 0) > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="image-grid mt-3 svelte-36khdd"><!--[-->`);
          const each_array_16 = ensure_array_like(selectedSeriesRecord.series_images);
          for (let $$index_16 = 0, $$length = each_array_16.length; $$index_16 < $$length; $$index_16++) {
            let image = each_array_16[$$index_16];
            $$renderer2.push(`<figure class="image-card svelte-36khdd"><img${attr("src", image.url)}${attr("alt", selectedSeriesRecord.name)} class="svelte-36khdd"/></figure>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No series images yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Series PDF</h3> `);
        if (selectedSeriesRecord.series_printed_pdf_url || selectedSeriesRecord.series_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="vstack gap-3 mt-3"><div class="ratio ratio-16x9"><iframe${attr("src", seriesPdfPreviewUrl(selectedSeriesRecord))}${attr("title", `${selectedSeriesRecord.name} PDF preview`)} class="svelte-36khdd"></iframe></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No series PDF generated yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div> `);
        if (selectedSeriesRecord?.id) {
          $$renderer2.push("<!--[0-->");
          AssociatedDocumentsPanel($$renderer2, {
            ownerType: "series",
            ownerId: selectedSeriesRecord.id,
            editable: false
          });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><h3 class="h5">Series Data</h3> <p class="text-body-secondary mb-0">Select a series to review its details and PDF.</p></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
