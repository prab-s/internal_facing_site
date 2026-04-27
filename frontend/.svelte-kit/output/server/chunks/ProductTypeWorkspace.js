import { f as fallback, h as head, i as ensure_array_like, e as escape_html, a as attr, d as bind_props } from "./index2.js";
import { S as SeriesNamesBadgeList } from "./SeriesNamesBadgeList.js";
function ProductTypeWorkspace($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let selectedProductType;
    let initialMode = fallback($$props["initialMode"], "create");
    let productTypes = [];
    let selectedProductTypeId = "";
    let saving = false;
    let mode = initialMode;
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
        band_graph_background_color: productType?.band_graph_background_color ?? "#ffffff",
        band_graph_label_text_color: productType?.band_graph_label_text_color ?? "#000000",
        band_graph_faded_opacity: productType?.band_graph_faded_opacity ?? 0.18,
        band_graph_permissible_label_color: productType?.band_graph_permissible_label_color ?? "#000000"
      };
    }
    let productTypeDraft = resetDraft();
    selectedProductType = productTypes.find((item) => String(item.id) === String(selectedProductTypeId)) || null;
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
    $$renderer2.push(`<!--]--> <div class="row g-3"><div class="col-12 col-md-6"><label class="form-label" for="product-type-label">Label</label> <input class="form-control" id="product-type-label"${attr("value", productTypeDraft.label)}/></div> <div class="col-12 col-md-6"><label class="form-label" for="product-type-key">Key</label> <input class="form-control" id="product-type-key"${attr("value", productTypeDraft.key)} placeholder="auto from label if blank"/></div> <div class="col-12 col-md-4"><div class="form-check form-switch mt-4"><input class="form-check-input" id="product-type-supports-graph" type="checkbox"${attr("checked", productTypeDraft.supports_graph, true)}/> <label class="form-check-label" for="product-type-supports-graph">Supports graph</label></div></div> <div class="col-12 col-md-4"><div class="form-check form-switch mt-4"><input class="form-check-input" id="product-type-overlays" type="checkbox"${attr("checked", productTypeDraft.supports_graph_overlays, true)}/> <label class="form-check-label" for="product-type-overlays">Supports overlays</label></div></div> <div class="col-12 col-md-4"><div class="form-check form-switch mt-4"><input class="form-check-input" id="product-type-band" type="checkbox"${attr("checked", productTypeDraft.supports_band_graph_style, true)}/> <label class="form-check-label" for="product-type-band">Supports band graph style</label></div></div> <div class="col-12"><hr class="my-2"/> <p class="text-body-secondary mb-0">Band graph style defaults</p></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-band-graph-background">Background colour</label> <div class="input-group"><input class="form-control form-control-color" id="product-type-band-graph-background" type="color"${attr("value", productTypeDraft.band_graph_background_color)}/> <input class="form-control" type="text"${attr("value", productTypeDraft.band_graph_background_color)} placeholder="#ffffff"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-band-graph-label">Label text colour</label> <div class="input-group"><input class="form-control form-control-color" id="product-type-band-graph-label" type="color"${attr("value", productTypeDraft.band_graph_label_text_color)}/> <input class="form-control" type="text"${attr("value", productTypeDraft.band_graph_label_text_color)} placeholder="#000000"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-band-graph-permissible">Permissible label colour</label> <div class="input-group"><input class="form-control form-control-color" id="product-type-band-graph-permissible" type="color"${attr("value", productTypeDraft.band_graph_permissible_label_color)}/> <input class="form-control" type="text"${attr("value", productTypeDraft.band_graph_permissible_label_color)} placeholder="#000000"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-band-graph-opacity">Faded area opacity</label> <input class="form-control" id="product-type-band-graph-opacity" type="number" min="0" max="1" step="0.01"${attr("value", productTypeDraft.band_graph_faded_opacity)}/></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-graph-kind">Graph kind</label> <input class="form-control" id="product-type-graph-kind"${attr("value", productTypeDraft.graph_kind)} placeholder="e.g. fan_map"/></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-line-label">Line value label</label> <input class="form-control" id="product-type-line-label"${attr("value", productTypeDraft.graph_line_value_label)}/></div> <div class="col-12 col-md-4"><label class="form-label" for="product-type-line-unit">Line value unit</label> <input class="form-control" id="product-type-line-unit"${attr("value", productTypeDraft.graph_line_value_unit)}/></div> <div class="col-12 col-md-3"><label class="form-label" for="product-type-x-label">X axis label</label> <input class="form-control" id="product-type-x-label"${attr("value", productTypeDraft.graph_x_axis_label)}/></div> <div class="col-12 col-md-3"><label class="form-label" for="product-type-x-unit">X axis unit</label> <input class="form-control" id="product-type-x-unit"${attr("value", productTypeDraft.graph_x_axis_unit)}/></div> <div class="col-12 col-md-3"><label class="form-label" for="product-type-y-label">Y axis label</label> <input class="form-control" id="product-type-y-label"${attr("value", productTypeDraft.graph_y_axis_label)}/></div> <div class="col-12 col-md-3"><label class="form-label" for="product-type-y-unit">Y axis unit</label> <input class="form-control" id="product-type-y-unit"${attr("value", productTypeDraft.graph_y_axis_unit)}/></div></div> `);
    if (selectedProductType) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-4">`);
      SeriesNamesBadgeList($$renderer2, {
        seriesNames: selectedProductType.series_names || [],
        title: `Series names for ${selectedProductType.label}`,
        emptyLabel: "This product type does not have any series yet."
      });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary"${attr("disabled", saving, true)}>${escape_html("Save Product Type")}</button> <button class="btn btn-outline-secondary">Cancel</button></div></div></div></div></div>`);
    bind_props($$props, { initialMode });
  });
}
export {
  ProductTypeWorkspace as P
};
