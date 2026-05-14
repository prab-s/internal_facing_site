import { f as fallback, s as store_get, h as head, b as attr_class, a as attr, i as ensure_array_like, e as escape_html, u as unsubscribe_stores, d as bind_props } from "../../../chunks/index2.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import { d as getProductChartData, e as getProductTypePdfContext, f as getProducts, h as getProduct } from "../../../chunks/api.js";
import { g as getChartTheme, b as buildFullChartOption, E as ECharts } from "../../../chunks/fullChart.js";
import { t as theme } from "../../../chunks/config.js";
import { J as JobProgressPanel } from "../../../chunks/JobProgressPanel.js";
import { S as SeriesNamesBadgeList } from "../../../chunks/SeriesNamesBadgeList.js";
function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let selectedProductTypeRecord;
    let data = fallback($$props["data"], () => ({}), true);
    let products = [];
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
    let loadingList = true;
    let loadingChart = false;
    let error = "";
    let search = "";
    let productTypeFilter = "";
    let seriesFilter = "";
    let filteredProducts = [];
    let seriesOptions = [];
    let selectedProduct = null;
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
    let selectedProductTypeId = normalizeViewerStringId(data?.product_type);
    let selectedProductTypeContext = null;
    let seriesTabProductTypeFilter = "";
    let seriesTabSeriesId = normalizeViewerStringId(data?.series);
    let seriesTabOptions = [];
    let selectedSeriesRecord = null;
    let refreshingProductGraphId = null;
    let refreshingProductPdfJob = null;
    let refreshingProductTypePdfJob = null;
    let refreshingSeriesGraphId = null;
    let refreshingSeriesPdfJob = null;
    function productEditorUrl(productId) {
      const params = new URLSearchParams();
      if (productId != null && productId !== "") {
        params.set("product", String(productId));
      }
      const search2 = params.toString();
      return `/editor/edit${search2 ? `?${search2}` : ""}`;
    }
    function seriesEditorUrl(seriesId) {
      const params = new URLSearchParams();
      if (seriesId != null && seriesId !== "") {
        params.set("series", String(seriesId));
      }
      const search2 = params.toString();
      return `/editor/series/edit${search2 ? `?${search2}` : ""}`;
    }
    function productTypeEditorUrl(productTypeId) {
      const params = new URLSearchParams();
      if (productTypeId != null && productTypeId !== "") {
        params.set("product_type", String(productTypeId));
      }
      const search2 = params.toString();
      return `/editor/product-types/edit${search2 ? `?${search2}` : ""}`;
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
    function productPdfTemplateLabels(product) {
      return {
        printed: templateLabel("product", product?.printed_template_id, product?.template_id || "product-default"),
        online: templateLabel("product", product?.online_template_id, product?.template_id || "product-default")
      };
    }
    function seriesPdfTemplateLabels(series) {
      return {
        printed: templateLabel("series", series?.printed_template_id, series?.template_id || "series-default"),
        online: templateLabel("series", series?.online_template_id, series?.template_id || "series-default")
      };
    }
    function productTypePdfTemplateLabel(productType) {
      return templateLabel("product_type", productType?.product_type_template_id, "product_type-default");
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
    function buildChartOptions() {
      const currentProduct = selectedProduct;
      const chartTheme = getChartTheme(store_get($$store_subs ??= {}, "$theme", theme));
      chartOption = buildFullChartOption({
        rpmLines,
        rpmPoints,
        efficiencyPoints,
        chartTheme,
        title: currentProduct ? currentProduct.model : "Product Graph",
        graphConfig: getCurrentGraphConfig(),
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
    async function loadChartData() {
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
        rpmLines = chartData.rpmLines;
        rpmPoints = chartData.rpmPoints;
        efficiencyPoints = chartData.efficiencyPoints;
        buildChartOptions();
      } catch (e) {
        error = e.message;
      } finally {
        loadingChart = false;
      }
    }
    async function loadProductTypeContext() {
      if (!selectedProductTypeId) {
        selectedProductTypeContext = null;
        return;
      }
      try {
        selectedProductTypeContext = await getProductTypePdfContext(selectedProductTypeId);
      } catch {
        selectedProductTypeContext = null;
      }
    }
    async function loadFilteredProducts() {
      loadingList = true;
      error = "";
      try {
        const params = {};
        if (search) ;
        if (productTypeFilter) ;
        if (seriesFilter && !Number.isNaN(Number(seriesFilter))) ;
        products = await getProducts(params);
        filteredProducts = [...products].sort((a, b) => {
          const typeCompare = String(a.product_type_label || "").localeCompare(String(b.product_type_label || ""));
          if (typeCompare !== 0) return typeCompare;
          const seriesCompare = String(a.series_name || "").localeCompare(String(b.series_name || ""));
          if (seriesCompare !== 0) return seriesCompare;
          return String(a.model || "").localeCompare(String(b.model || ""));
        });
        if (selectedProductId && !filteredProducts.some((product) => Number(product.id) === Number(selectedProductId))) {
          selectedProductId = filteredProducts[0]?.id != null ? Number(filteredProducts[0].id) : null;
        }
        if (!selectedProductId && filteredProducts.length && activeViewerTab === "product") {
          selectedProductId = Number(filteredProducts[0].id);
        }
      } catch (e) {
        error = e.message;
        products = [];
        filteredProducts = [];
      } finally {
        loadingList = false;
      }
    }
    async function loadSelectedProduct() {
      if (!selectedProductId) {
        selectedProduct = null;
        rpmLines = [];
        rpmPoints = [];
        efficiencyPoints = [];
        chartOption = {};
        return;
      }
      error = "";
      try {
        selectedProduct = await getProduct(selectedProductId);
      } catch (e) {
        error = e.message;
        selectedProduct = null;
      }
    }
    let previousFilterKey = "";
    let previousSelectedProductId = null;
    onDestroy(() => {
    });
    if (store_get($$store_subs ??= {}, "$theme", theme), productTypes) {
      buildChartOptions();
    }
    {
      const filterKey = JSON.stringify({ search, productTypeFilter, seriesFilter });
      if (filterKey !== previousFilterKey) {
        previousFilterKey = filterKey;
        loadFilteredProducts();
      }
    }
    if (selectedProductId !== previousSelectedProductId) {
      previousSelectedProductId = selectedProductId;
      loadSelectedProduct();
      loadChartData();
    }
    selectedSeriesRecord = seriesTabOptions.find((series) => Number(series.id) === Number(seriesTabSeriesId)) || null;
    selectedProductTypeRecord = productTypes.find((productType) => Number(productType.id) === Number(selectedProductTypeId)) || null;
    if (selectedProductTypeId) {
      loadProductTypeContext();
    }
    head("1470g8z", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Viewer — Internal Facing</title>`);
      });
    });
    $$renderer2.push(`<div class="page-stack svelte-1470g8z"><div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Review &amp; Generate</p> <h1>Viewer</h1> <p class="text-body-secondary mb-0">Filter products, select a record, and review all of its information, images, graph output, PDF output, and series data.</p></div></div> `);
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
    $$renderer2.push(`<!--]--> <ul class="nav nav-tabs"><li class="nav-item"><button${attr_class("nav-link", void 0, { "active": activeViewerTab === "product" })} type="button">Product</button></li> <li class="nav-item"><button${attr_class("nav-link", void 0, { "active": activeViewerTab === "series" })} type="button">Series</button></li> <li class="nav-item"><button${attr_class("nav-link", void 0, { "active": activeViewerTab === "product-type" })} type="button">Product Types</button></li></ul> `);
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
      if (loadingList) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="small text-body-secondary">Loading…</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (!loadingList && filteredProducts.length === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-body-secondary mb-0">No products match the current filters.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="table-responsive"><table class="table table-sm align-middle viewer-list-table mb-0 svelte-1470g8z"><thead><tr><th>Model</th><th>Type</th><th>Series</th></tr></thead><tbody class="svelte-1470g8z"><!--[-->`);
        const each_array_2 = ensure_array_like(filteredProducts);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let product = each_array_2[$$index_2];
          $$renderer2.push(`<tr${attr_class("svelte-1470g8z", void 0, {
            "selected-row": Number(product.id) === Number(selectedProductId)
          })}><td class="svelte-1470g8z"><button class="btn btn-link p-0 text-start text-decoration-none fw-semibold viewer-select-button svelte-1470g8z" type="button">${escape_html(product.model)}</button></td><td class="svelte-1470g8z">${escape_html(product.product_type_label || product.product_type_key)}</td><td class="svelte-1470g8z">${escape_html(product.series_name || "—")}</td></tr>`);
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
        $$renderer2.push(`<!--]--></div></div> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingProductGraphId === currentProduct.id, true)}>${escape_html(refreshingProductGraphId === currentProduct.id ? "Generating Graph..." : "Generate Graph")}</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingProductPdfJob?.status === "running", true)}>${escape_html("Generate PDFs")}</button> <a class="btn btn-outline-primary btn-sm"${attr("href", productEditorUrl(currentProduct.id))}>Open in Editor</a> `);
        if (currentProduct.graph_image_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", currentProduct.graph_image_url)} target="_blank" rel="noreferrer">Open Graph</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (currentProduct.product_printed_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", currentProduct.product_printed_pdf_url)} target="_blank" rel="noreferrer">Open Printed PDF</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (currentProduct.product_online_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", currentProduct.product_online_pdf_url)} target="_blank" rel="noreferrer">Open Online PDF</a>`);
        } else if (currentProduct.product_pdf_url) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", currentProduct.product_pdf_url)} target="_blank" rel="noreferrer">Open Existing PDF</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <div class="small text-body-secondary mt-2">Printed template: ${escape_html(productPdfTemplateLabels(currentProduct).printed)} · Online template: ${escape_html(productPdfTemplateLabels(currentProduct).online)}</div> `);
        JobProgressPanel($$renderer2, {
          job: refreshingProductPdfJob,
          label: "Product PDF generation"
        });
        $$renderer2.push(`<!----> <div class="row g-3 mt-1"><div class="col-12 col-md-3"><div class="viewer-metric svelte-1470g8z"><div class="viewer-metric-label svelte-1470g8z">Product Type</div> <div>${escape_html(currentProduct.product_type_label || currentProduct.product_type_key || "—")}</div></div></div> <div class="col-12 col-md-3"><div class="viewer-metric svelte-1470g8z"><div class="viewer-metric-label svelte-1470g8z">Series</div> <div>${escape_html(currentProduct.series_name || "—")}</div></div></div></div> `);
        if (getCurrentProductType()) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="mt-3">`);
          SeriesNamesBadgeList($$renderer2, {
            seriesNames: getCurrentProductType()?.series_names || [],
            title: `Series names for ${getCurrentProductType()?.label || "this product type"}`,
            emptyLabel: "This product type has no linked series yet."
          });
          $$renderer2.push(`<!----></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div></div> <div class="row g-3"><div class="col-12 col-lg-6"><div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">Description1</h3> <div class="viewer-html svelte-1470g8z">${html(currentProduct.description1_html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div></div></div> <div class="col-12 col-lg-6"><div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">Description2</h3> <div class="viewer-html svelte-1470g8z">${html(currentProduct.description2_html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div></div></div> <div class="col-12 col-lg-6"><div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">Description3</h3> <div class="viewer-html svelte-1470g8z">${html(currentProduct.description3_html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div></div></div> <div class="col-12 col-lg-6"><div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">Comments</h3> <div class="viewer-html svelte-1470g8z">${html(currentProduct.comments_html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div></div></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Grouped Specifications</h3> `);
        if ((currentProduct.parameter_groups?.length ?? 0) > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="vstack gap-3 mt-3"><!--[-->`);
          const each_array_3 = ensure_array_like(currentProduct.parameter_groups);
          for (let $$index_4 = 0, $$length = each_array_3.length; $$index_4 < $$length; $$index_4++) {
            let group = each_array_3[$$index_4];
            $$renderer2.push(`<div class="border rounded p-3"><div class="fw-semibold mb-2">${escape_html(group.group_name)}</div> <div class="table-responsive"><table class="table table-sm mb-0"><tbody><!--[-->`);
            const each_array_4 = ensure_array_like(group.parameters);
            for (let $$index_3 = 0, $$length2 = each_array_4.length; $$index_3 < $$length2; $$index_3++) {
              let parameter = each_array_4[$$index_3];
              $$renderer2.push(`<tr><th style="width: 40%">${escape_html(parameter.parameter_name)}</th><td>${escape_html(formatParameterValue(parameter))}</td></tr>`);
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
          $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><h3 class="h5">Fan Acoustic Table</h3> <p class="text-body-secondary mb-3">Rows track the current RPM graph rows. Octave-band columns appear in the configured order.</p> <div class="table-responsive fan-acoustic-viewer-table-wrap"><table class="table table-sm align-middle fan-acoustic-viewer-table mb-0 svelte-1470g8z"><colgroup><col style="width: 7.5rem"/><col style="width: 8.5rem"/><col style="width: 7.5rem"/><col style="width: 7.5rem"/><col style="width: 10.5rem"/><!--[-->`);
          const each_array_5 = ensure_array_like(currentProduct.fan_acoustic_table.sound_power_columns);
          for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
            each_array_5[$$index_5];
            $$renderer2.push(`<col style="width: 4.75rem"/>`);
          }
          $$renderer2.push(`<!--]--></colgroup><thead><tr><th rowspan="2" class="svelte-1470g8z">Speed (rpm)</th><th rowspan="2" class="svelte-1470g8z">Peak Pressure (Pa)</th><th rowspan="2" class="svelte-1470g8z">Peak Power (kW)</th><th rowspan="2" class="svelte-1470g8z">Running Frequency</th><th rowspan="2" class="svelte-1470g8z">Sound Pressure Level dB @ 3 meters</th><th${attr("colspan", currentProduct.fan_acoustic_table.sound_power_columns?.length ?? 0)} class="text-center svelte-1470g8z">Sound Power Level SWL dB re 1pw</th></tr><tr><!--[-->`);
          const each_array_6 = ensure_array_like(currentProduct.fan_acoustic_table.sound_power_columns);
          for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
            let column = each_array_6[$$index_6];
            $$renderer2.push(`<th class="svelte-1470g8z">${escape_html(column)}</th>`);
          }
          $$renderer2.push(`<!--]--></tr></thead><tbody>`);
          if ((currentProduct.fan_acoustic_table.rows?.length ?? 0) > 0) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<!--[-->`);
            const each_array_7 = ensure_array_like(currentProduct.fan_acoustic_table.rows);
            for (let $$index_8 = 0, $$length = each_array_7.length; $$index_8 < $$length; $$index_8++) {
              let row = each_array_7[$$index_8];
              $$renderer2.push(`<tr><td class="svelte-1470g8z">${escape_html(formatNumericValue(row.speed_rpm))}</td><td class="svelte-1470g8z">${escape_html(formatNumericValue(row.peak_pressure_pa))}</td><td class="svelte-1470g8z">${escape_html(formatNumericValue(row.peak_power_kw))}</td><td class="svelte-1470g8z">${escape_html(formatNumericValue(row.running_frequency_hz))}</td><td class="svelte-1470g8z">${escape_html(formatNumericValue(row.sound_pressure_db_3m))}</td><!--[-->`);
              const each_array_8 = ensure_array_like(currentProduct.fan_acoustic_table.sound_power_columns);
              for (let $$index_7 = 0, $$length2 = each_array_8.length; $$index_7 < $$length2; $$index_7++) {
                let column = each_array_8[$$index_7];
                $$renderer2.push(`<td class="svelte-1470g8z">${escape_html(formatNumericValue(row.sound_power_levels?.[column]))}</td>`);
              }
              $$renderer2.push(`<!--]--></tr>`);
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<tr><td${attr("colspan", 5 + (currentProduct.fan_acoustic_table.sound_power_columns?.length ?? 0))} class="text-body-secondary svelte-1470g8z">No fan acoustic rows yet.</td></tr>`);
          }
          $$renderer2.push(`<!--]--></tbody></table></div></div></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Product Images</h3> `);
        if ((currentProduct.product_images?.length ?? 0) > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="image-grid mt-3 svelte-1470g8z"><!--[-->`);
          const each_array_9 = ensure_array_like(currentProduct.product_images);
          for (let $$index_9 = 0, $$length = each_array_9.length; $$index_9 < $$length; $$index_9++) {
            let image = each_array_9[$$index_9];
            $$renderer2.push(`<figure class="image-card svelte-1470g8z"><img${attr("src", image.url)}${attr("alt", currentProduct.model)} class="svelte-1470g8z"/></figure>`);
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
        $$renderer2.push(`<!--]--></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Product PDFs</h3> `);
        if (currentProduct.product_printed_pdf_url || currentProduct.product_online_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="vstack gap-3 mt-3">`);
          if (currentProduct.product_printed_pdf_url) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div><div class="small text-body-secondary mb-2">Printed</div> <div class="ratio ratio-16x9"><iframe${attr("src", currentProduct.product_printed_pdf_url)}${attr("title", `${currentProduct.model} printed PDF preview`)}></iframe></div></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (currentProduct.product_online_pdf_url) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div><div class="small text-body-secondary mb-2">Online</div> <div class="ratio ratio-16x9"><iframe${attr("src", currentProduct.product_online_pdf_url)}${attr("title", `${currentProduct.model} online PDF preview`)}></iframe></div></div>`);
          } else if (currentProduct.product_pdf_url) {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`<div><div class="small text-body-secondary mb-2">Existing</div> <div class="ratio ratio-16x9"><iframe${attr("src", currentProduct.product_pdf_url)}${attr("title", `${currentProduct.model} PDF preview`)}></iframe></div></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No product PDFs generated yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
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
          const each_array_10 = ensure_array_like(productTypes);
          for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
            let productType = each_array_10[$$index_10];
            $$renderer3.option({ value: productType.id }, ($$renderer4) => {
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
        $$renderer2.push(`<div class="vstack gap-3"><div class="card shadow-sm"><div class="card-body"><div class="d-flex flex-wrap align-items-start gap-2"><div class="me-auto"><h2 class="h4 mb-1">${escape_html(selectedProductTypeRecord.label)}</h2> <div class="text-body-secondary">${escape_html(selectedProductTypeRecord.key)}</div></div></div> <div class="row g-3 mt-1"><div class="col-12 col-md-4"><div class="viewer-metric svelte-1470g8z"><div class="viewer-metric-label svelte-1470g8z">Series</div> <div>${escape_html(selectedProductTypeRecord.series_names?.length || 0)}</div></div></div> <div class="col-12 col-md-4"><div class="viewer-metric svelte-1470g8z"><div class="viewer-metric-label svelte-1470g8z">PDF</div> <div>${escape_html(selectedProductTypeRecord.product_type_pdf_url ? "Available" : "Not generated yet")}</div></div></div></div> <div class="mt-3">`);
        SeriesNamesBadgeList($$renderer2, {
          seriesNames: selectedProductTypeRecord.series_names || [],
          title: `Series names for ${selectedProductTypeRecord.label}`,
          emptyLabel: "This product type has no linked series yet."
        });
        $$renderer2.push(`<!----></div></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5 mb-3">PDF context</h3> `);
        if (selectedProductTypeContext) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="small text-body-secondary mb-3">Intro pages: ${escape_html(selectedProductTypeContext.intro_page_count)} · Total pages: ${escape_html(selectedProductTypeContext.page_count)}</div> <div class="vstack gap-3"><!--[-->`);
          const each_array_11 = ensure_array_like(selectedProductTypeContext.series);
          for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
            let series = each_array_11[$$index_11];
            $$renderer2.push(`<div class="border rounded p-3"><div class="d-flex justify-content-between gap-2 flex-wrap"><div class="fw-semibold">${escape_html(series.name)}</div> <div class="small text-body-secondary">Pages ${escape_html(series.page_start)} to ${escape_html(series.page_end)}</div></div> <div class="small text-body-secondary mb-2">${escape_html(series.product_count)} products</div> `);
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
          const each_array_12 = ensure_array_like(productTypes);
          for (let $$index_12 = 0, $$length = each_array_12.length; $$index_12 < $$length; $$index_12++) {
            let productType = each_array_12[$$index_12];
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
          const each_array_13 = ensure_array_like(seriesTabOptions);
          for (let $$index_13 = 0, $$length = each_array_13.length; $$index_13 < $$length; $$index_13++) {
            let series = each_array_13[$$index_13];
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
        $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><h3 class="h5">Series Data</h3> <div class="text-body-secondary small mb-3">${escape_html(selectedSeriesRecord.name)} · ${escape_html(selectedSeriesRecord.product_count)} products</div> <div class="d-flex flex-wrap align-items-start gap-2 mb-3"><div class="me-auto"></div> <a class="btn btn-outline-primary btn-sm"${attr("href", seriesEditorUrl(selectedSeriesRecord.id))}>Open in Editor</a> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingSeriesGraphId === selectedSeriesRecord.id, true)}>${escape_html(refreshingSeriesGraphId === selectedSeriesRecord.id ? "Generating Graph..." : "Generate Series Graph")}</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", refreshingSeriesPdfJob?.status === "running", true)}>${escape_html("Generate Series PDFs")}</button> `);
        if (selectedSeriesRecord.series_graph_image_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", selectedSeriesRecord.series_graph_image_url)} target="_blank" rel="noreferrer">Open Series Graph</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (selectedSeriesRecord.series_printed_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", selectedSeriesRecord.series_printed_pdf_url)} target="_blank" rel="noreferrer">Open Printed PDF</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (selectedSeriesRecord.series_online_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", selectedSeriesRecord.series_online_pdf_url)} target="_blank" rel="noreferrer">Open Online PDF</a>`);
        } else if (selectedSeriesRecord.series_pdf_url) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<a class="btn btn-outline-secondary btn-sm"${attr("href", selectedSeriesRecord.series_pdf_url)} target="_blank" rel="noreferrer">Open Existing PDF</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <div class="small text-body-secondary mb-3">Printed template: ${escape_html(seriesPdfTemplateLabels(selectedSeriesRecord).printed)} · Online template: ${escape_html(seriesPdfTemplateLabels(selectedSeriesRecord).online)}</div> `);
        JobProgressPanel($$renderer2, { job: refreshingSeriesPdfJob, label: "Series PDF generation" });
        $$renderer2.push(`<!----> <div class="row g-3"><div class="col-12 col-lg-6"><h4 class="h6">Description1</h4> <div class="viewer-html svelte-1470g8z">${html(selectedSeriesRecord.description1_html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div> <div class="col-12 col-lg-6"><h4 class="h6">Description2</h4> <div class="viewer-html svelte-1470g8z">${html(selectedSeriesRecord.description2_html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div> <div class="col-12 col-lg-6"><h4 class="h6">Description3</h4> <div class="viewer-html svelte-1470g8z">${html(selectedSeriesRecord.description3_html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div> <div class="col-12 col-lg-6"><h4 class="h6">Description4</h4> <div class="viewer-html svelte-1470g8z">${html(selectedSeriesRecord.description4_html || '<p class="text-body-secondary mb-0">Not provided.</p>')}</div></div></div></div></div> <div class="card shadow-sm"><div class="card-body"><h3 class="h5">Series PDFs</h3> `);
        if (selectedSeriesRecord.series_printed_pdf_url || selectedSeriesRecord.series_online_pdf_url) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="vstack gap-3 mt-3">`);
          if (selectedSeriesRecord.series_printed_pdf_url) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div><div class="small text-body-secondary mb-2">Printed</div> <div class="ratio ratio-16x9"><iframe${attr("src", selectedSeriesRecord.series_printed_pdf_url)}${attr("title", `${selectedSeriesRecord.name} printed PDF preview`)}></iframe></div></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (selectedSeriesRecord.series_online_pdf_url) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div><div class="small text-body-secondary mb-2">Online</div> <div class="ratio ratio-16x9"><iframe${attr("src", selectedSeriesRecord.series_online_pdf_url)}${attr("title", `${selectedSeriesRecord.name} online PDF preview`)}></iframe></div></div>`);
          } else if (selectedSeriesRecord.series_pdf_url) {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`<div><div class="small text-body-secondary mb-2">Existing</div> <div class="ratio ratio-16x9"><iframe${attr("src", selectedSeriesRecord.series_pdf_url)}${attr("title", `${selectedSeriesRecord.name} PDF preview`)}></iframe></div></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No series PDFs generated yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
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
