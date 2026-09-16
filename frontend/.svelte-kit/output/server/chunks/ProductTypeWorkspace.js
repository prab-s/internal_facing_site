import { h as head, d as ensure_array_like, e as escape_html, b as attr, i as bind_props } from "./index2.js";
import { o as onDestroy } from "./index-server.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import { f as fallback } from "./equality.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
import { J as JobProgressPanel } from "./JobProgressPanel.js";
import { A as AssociatedDocumentsPanel } from "./AssociatedDocumentsPanel.js";
function ProductTypeWorkspace($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let selectedProductType, orderedPdfSeries;
    let initialMode = fallback($$props["initialMode"], "create");
    let initialProductTypeId = fallback($$props["initialProductTypeId"], "");
    let productTypes = [];
    let templateRegistry = {
      product_type_templates: []
    };
    let selectedProductTypeId = "";
    let saving = false;
    let refreshingPdfJob = null;
    let mode = initialMode;
    let hydratedProductTypeId = "";
    let appliedInitialProductTypeId = "";
    function productTypeViewerUrl(productTypeId = selectedProductType?.id) {
      const nextProductTypeId = productTypeId == null || productTypeId === "" ? "" : String(productTypeId);
      return nextProductTypeId ? `/viewer/product-type/${encodeURIComponent(nextProductTypeId)}` : "/viewer/product-type";
    }
    function resetDraft(productType = null) {
      return {
        id: productType?.id ?? null,
        key: productType?.key ?? "",
        label: productType?.label ?? "",
        supports_graph: productType?.supports_graph ?? false,
        graph_kind: productType?.graph_kind ?? "",
        supports_graph_overlays: productType?.supports_graph_overlays ?? false,
        supports_band_graph_style: productType?.supports_band_graph_style ?? false,
        graph_line_value_label: productType?.graph_line_value_label ?? "",
        graph_line_value_unit: productType?.graph_line_value_unit ?? "",
        graph_x_axis_label: productType?.graph_x_axis_label ?? "",
        graph_x_axis_unit: productType?.graph_x_axis_unit ?? "",
        graph_y_axis_label: productType?.graph_y_axis_label ?? "",
        graph_y_axis_unit: productType?.graph_y_axis_unit ?? "",
        product_type_template_id: productType?.product_type_template_id ?? "",
        product_type_pdf_series_order: Array.isArray(productType?.product_type_pdf_series_order) ? [...productType.product_type_pdf_series_order] : [],
        contents_icon_url: productType?.contents_icon_url ?? "",
        band_graph_background_color: productType?.band_graph_background_color ?? "#ffffff",
        band_graph_label_text_color: productType?.band_graph_label_text_color ?? "#000000",
        band_graph_faded_opacity: productType?.band_graph_faded_opacity ?? 0.18,
        band_graph_permissible_label_color: productType?.band_graph_permissible_label_color ?? "#000000"
      };
    }
    let productTypeDraft = resetDraft();
    function calculateOrderedSeriesForPdf(productType, configuredOrder) {
      const series = [...productType?.series || []].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), void 0, { sensitivity: "base" }));
      const byId = new Map(series.map((item) => [String(item.id), item]));
      const order = Array.isArray(configuredOrder) ? configuredOrder : [];
      const explicit = order.map((id) => byId.get(String(id))).filter((item, index, items) => item && items.findIndex((candidate) => candidate.id === item.id) === index);
      const explicitIds = new Set(explicit.map((item) => String(item.id)));
      return [
        ...explicit,
        ...series.filter((item) => !explicitIds.has(String(item.id)))
      ];
    }
    function hydrateSelectedProductType(productTypeId = selectedProductTypeId) {
      const normalizedProductTypeId = productTypeId == null || productTypeId === "" ? "" : String(productTypeId);
      if (!normalizedProductTypeId) {
        hydratedProductTypeId = "";
        if (productTypeDraft.id) {
          productTypeDraft = resetDraft();
        }
        return;
      }
      const selected = productTypes.find((item) => String(item.id) === normalizedProductTypeId);
      if (!selected) {
        return;
      }
      if (hydratedProductTypeId === normalizedProductTypeId && String(productTypeDraft.id || "") === normalizedProductTypeId) {
        return;
      }
      hydratedProductTypeId = normalizedProductTypeId;
      productTypeDraft = resetDraft(selected);
    }
    onDestroy(() => {
    });
    {
      const nextInitialProductTypeId = initialProductTypeId !== "" && initialProductTypeId != null ? String(initialProductTypeId) : "";
      if (nextInitialProductTypeId !== appliedInitialProductTypeId) {
        appliedInitialProductTypeId = nextInitialProductTypeId;
        if (nextInitialProductTypeId) {
          selectedProductTypeId = nextInitialProductTypeId;
          if (mode !== "create") {
            mode = "edit";
          }
        } else if (mode !== "create" || selectedProductTypeId) {
          selectedProductTypeId = "";
          productTypeDraft = resetDraft();
          hydratedProductTypeId = "";
          mode = "edit";
        }
      }
    }
    selectedProductType = productTypes.find((item) => String(item.id) === String(selectedProductTypeId)) || null;
    orderedPdfSeries = calculateOrderedSeriesForPdf(selectedProductType, productTypeDraft.product_type_pdf_series_order);
    if (mode === "edit" && selectedProductTypeId) {
      hydrateSelectedProductType();
    }
    head("1b6bpt1", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Product Types — Editor</title>`);
      });
    });
    $$renderer2.push(`<div class="row justify-content-center"><div class="col-12 col-xxl-12">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="card shadow-sm"><div class="card-body">`);
    if (mode === "edit") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="row g-3 mb-3"><div class="col-12 col-md-6"><label class="form-label" for="product-type-select">Select product type</label> `);
      $$renderer2.select(
        {
          class: "form-select",
          id: "product-type-select",
          value: selectedProductTypeId
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`-- Choose option --`);
          });
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(productTypes);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let productType = each_array[$$index];
            $$renderer3.option({ value: productType.id }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(productType.label)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(`</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="row g-3"><div class="col-12 col-md-6"><label class="form-label" for="product-type-label">Label</label> <input class="form-control" id="product-type-label"${attr("value", productTypeDraft.label)}/></div> <div class="col-12 col-md-6"><label class="form-label" for="product-type-key">Key</label> <input class="form-control" id="product-type-key"${attr("value", productTypeDraft.key)} placeholder="auto from label if blank"/></div> <div class="col-12 col-md-4"><div class="form-check form-switch mt-4"><input class="form-check-input" id="product-type-supports-graph" type="checkbox"${attr("checked", productTypeDraft.supports_graph, true)}/> <label class="form-check-label" for="product-type-supports-graph">Supports graph</label></div></div> <div class="col-12 col-md-4"><div class="form-check form-switch mt-4"><input class="form-check-input" id="product-type-overlays" type="checkbox"${attr("checked", productTypeDraft.supports_graph_overlays, true)}/> <label class="form-check-label" for="product-type-overlays">Supports overlays</label></div></div> <div class="col-12 col-md-4"><div class="form-check form-switch mt-4"><input class="form-check-input" id="product-type-band" type="checkbox"${attr("checked", productTypeDraft.supports_band_graph_style, true)}/> <label class="form-check-label" for="product-type-band">Supports band graph style</label></div></div> <div class="col-12 col-md-6"><label class="form-label" for="product-type-template">Product type PDF template</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "product-type-template",
        value: productTypeDraft.product_type_template_id
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Use default template`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(templateRegistry.product_type_templates ?? []);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let template = each_array_1[$$index_1];
          $$renderer3.option({ value: template.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(template.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <div class="col-12 col-md-6"><label class="form-label" for="product-type-contents-icon">Contents icon URL</label> <input class="form-control" id="product-type-contents-icon"${attr("value", productTypeDraft.contents_icon_url)} placeholder="https://... or data:image/svg+xml,..."/></div> <div class="col-12"><hr class="my-2"/> <p class="text-body-secondary mb-0">Band graph style defaults</p></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-band-graph-background">Background colour</label> <div class="input-group"><input class="form-control form-control-color" id="product-type-band-graph-background" type="color"${attr("value", productTypeDraft.band_graph_background_color)}/> <input class="form-control" type="text"${attr("value", productTypeDraft.band_graph_background_color)} placeholder="#ffffff"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-band-graph-label">Label text colour</label> <div class="input-group"><input class="form-control form-control-color" id="product-type-band-graph-label" type="color"${attr("value", productTypeDraft.band_graph_label_text_color)}/> <input class="form-control" type="text"${attr("value", productTypeDraft.band_graph_label_text_color)} placeholder="#000000"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-band-graph-permissible">Permissible label colour</label> <div class="input-group"><input class="form-control form-control-color" id="product-type-band-graph-permissible" type="color"${attr("value", productTypeDraft.band_graph_permissible_label_color)}/> <input class="form-control" type="text"${attr("value", productTypeDraft.band_graph_permissible_label_color)} placeholder="#000000"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-band-graph-opacity">Faded area opacity</label> <input class="form-control" id="product-type-band-graph-opacity" type="number" min="0" max="1" step="0.01"${attr("value", productTypeDraft.band_graph_faded_opacity)}/></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-graph-kind">Graph kind</label> <input class="form-control" id="product-type-graph-kind"${attr("value", productTypeDraft.graph_kind)} placeholder="e.g. fan_map"/></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-line-label">Line value label</label> <input class="form-control" id="product-type-line-label"${attr("value", productTypeDraft.graph_line_value_label)}/></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-line-unit">Line value unit</label> <input class="form-control" id="product-type-line-unit"${attr("value", productTypeDraft.graph_line_value_unit)}/></div> <div class="col-12 col-md-3"><label class="form-label" for="product-type-x-label">X axis label</label> <input class="form-control" id="product-type-x-label"${attr("value", productTypeDraft.graph_x_axis_label)}/></div> <div class="col-12 col-md-3"><label class="form-label" for="product-type-x-unit">X axis unit</label> <input class="form-control" id="product-type-x-unit"${attr("value", productTypeDraft.graph_x_axis_unit)}/></div> <div class="col-12 col-md-3"><label class="form-label" for="product-type-y-label">Y axis label</label> <input class="form-control" id="product-type-y-label"${attr("value", productTypeDraft.graph_y_axis_label)}/></div> <div class="col-12 col-md-3"><label class="form-label" for="product-type-y-unit">Y axis unit</label> <input class="form-control" id="product-type-y-unit"${attr("value", productTypeDraft.graph_y_axis_unit)}/></div></div> `);
    if (selectedProductType) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-4"><div class="card shadow-sm"><div class="card-body"><h3 class="h6 mb-2">Series order for Product Type PDFs</h3> <p class="text-body-secondary small">Move selected series to the front in the order shown. Any series not explicitly moved remains alphabetical.</p> `);
      if (orderedPdfSeries.length) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<ol class="list-group list-group-numbered"><!--[-->`);
        const each_array_2 = ensure_array_like(orderedPdfSeries);
        for (let index = 0, $$length = each_array_2.length; index < $$length; index++) {
          let series = each_array_2[index];
          $$renderer2.push(`<li class="list-group-item d-flex align-items-center justify-content-between gap-2"><span>${escape_html(series.name)}</span> <span class="d-flex gap-1"><button class="btn btn-outline-secondary btn-sm" type="button"${attr("aria-label", `Move ${series.name} up`)}${attr("disabled", index === 0, true)}>↑</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("aria-label", `Move ${series.name} down`)}${attr("disabled", index === orderedPdfSeries.length - 1, true)}>↓</button></span></li>`);
        }
        $$renderer2.push(`<!--]--></ol>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<p class="text-body-secondary mb-0">This product type does not have any series yet.</p>`);
      }
      $$renderer2.push(`<!--]--></div></div></div> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", refreshingPdfJob?.status === "running", true)}>${escape_html("Generate Product Type PDF")}</button> `);
      JobProgressPanel($$renderer2, { job: refreshingPdfJob, label: "Product type PDF generation" });
      $$renderer2.push(`<!----> `);
      if (selectedProductType.product_type_pdf_url) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<a class="btn btn-outline-primary btn-sm"${attr("href", selectedProductType.product_type_pdf_url)} target="_blank" rel="noreferrer">Open Product Type PDF</a>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <a class="btn btn-outline-primary btn-sm"${attr("href", productTypeViewerUrl(selectedProductType.id))}>View in Viewer</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary"${attr("disabled", saving, true)}>${escape_html("Save Product Type")}</button> `);
    if (productTypeDraft.id) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="btn btn-outline-primary" type="button"${attr("disabled", saving, true)}>Duplicate Product Type</button> <button class="btn btn-outline-danger" type="button"${attr("disabled", saving, true)}>Delete Product Type</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="btn btn-outline-secondary">Cancel</button></div> `);
    if (productTypeDraft.id) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-3">`);
      AssociatedDocumentsPanel($$renderer2, { ownerType: "product_type", ownerId: productTypeDraft.id });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div></div>`);
    bind_props($$props, { initialMode, initialProductTypeId });
  });
}
export {
  ProductTypeWorkspace as P
};
