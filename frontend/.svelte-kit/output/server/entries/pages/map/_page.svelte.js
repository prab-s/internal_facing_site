import { s as store_get, h as head, d as ensure_array_like, e as escape_html, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { g as getProducts, a as getProductTypes, d as getChartTheme, t as theme, b as getProductChartData, j as getProduct } from "../../../chunks/api.js";
import { E as ECharts } from "../../../chunks/ECharts.js";
import { b as buildFullChartOption } from "../../../chunks/fullChart.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let products = [];
    let productTypes = [];
    let selectedProductId = null;
    let rpmLines = [];
    let rpmPoints = [];
    let efficiencyPoints = [];
    let currentProduct = null;
    let chartOption = {};
    let loading = false;
    let error = "";
    function getCurrentProductType() {
      return productTypes.find((item) => item.key === currentProduct?.product_type_key) || null;
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
    function readingGuideText() {
      const productType = getCurrentProductType();
      if (!productType) {
        return "Review the currently selected product's graph data.";
      }
      if (productType.graph_kind === "silencer_loss") {
        return "Diameter lines show how pressure loss changes across volume flow for this silencer.";
      }
      return "RPM levels are shown as shaded bands. Efficiency centre appears in green, efficiency lower and higher end in red, and permissible use in grey.";
    }
    async function loadProducts() {
      try {
        products = await getProducts();
        if (products.length && !selectedProductId) selectedProductId = products[0].id;
      } catch (e) {
        error = e.message;
      }
    }
    async function loadMap() {
      if (!selectedProductId) return;
      loading = true;
      error = "";
      try {
        const [chartData, fan] = await Promise.all([
          getProductChartData(selectedProductId),
          getProduct(selectedProductId)
        ]);
        ({ rpmLines, rpmPoints, efficiencyPoints } = chartData);
        currentProduct = fan;
        buildChartOptions();
      } catch (e) {
        error = e.message;
      } finally {
        loading = false;
      }
    }
    async function loadProductTypeDefinitions() {
      try {
        productTypes = await getProductTypes();
      } catch (e) {
        error = e.message;
      }
    }
    function buildChartOptions() {
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
    loadProducts();
    loadProductTypeDefinitions();
    if (selectedProductId) {
      loadMap();
    }
    if (store_get($$store_subs ??= {}, "$theme", theme), productTypes) {
      buildChartOptions();
    }
    head("w85nl5", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Graph view — Internal Facing</title>`);
      });
    });
    $$renderer2.push(`<div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Single Product View</p> <h1 class="h2 mb-2">Graph view</h1> <p class="text-body-secondary">Review one graph-capable product’s line and overlay data in a dedicated graph view.</p></div></div> <div class="row g-3"><div class="col-12 col-xl-3"><div class="vstack gap-3"><div class="card shadow-sm p-3"><h2 class="h5">Select product</h2> <label class="form-label" for="map-fan-select">Product record</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "map-fan-select",
        value: selectedProductId,
        disabled: loading
      },
      ($$renderer3) => {
        $$renderer3.option({ value: null }, ($$renderer4) => {
          $$renderer4.push(`— Select —`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(products);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let product = each_array[$$index];
          $$renderer3.option({ value: product.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(product.model)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm p-3"><p class="text-danger mb-0">${escape_html(error)}</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="card shadow-sm p-3"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Reading Guide</p> <p class="text-body-secondary mb-0">${escape_html(readingGuideText())}</p></div></div></div> <div class="col-12 col-xl-9"><div class="vstack gap-3">`);
    if (selectedProductId) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm p-3"><h2 class="h5">${escape_html(graphHeading())}</h2> <div class="mt-3">`);
      ECharts($$renderer2, { option: chartOption, height: "750px" });
      $$renderer2.push(`<!----></div></div> `);
      if (selectedProductId && rpmPoints.length === 0 && efficiencyPoints.length === 0 && !loading) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="card shadow-sm p-3"><p class="text-body-secondary mb-0">No graph points for this product. Add graph data on the Data entry page.</p></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
