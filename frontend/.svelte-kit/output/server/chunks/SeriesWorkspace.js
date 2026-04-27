import { f as fallback, h as head, i as ensure_array_like, e as escape_html, a as attr, d as bind_props } from "./index2.js";
function SeriesWorkspace($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let initialMode = fallback($$props["initialMode"], "create");
    let initialSeriesId = fallback($$props["initialSeriesId"], "");
    let productTypes = [];
    let seriesRecords = [];
    let templateRegistry = { series_templates: [] };
    let selectedSeriesId = "";
    let saving = false;
    let mode = initialMode;
    function resetDraft(series = null) {
      return {
        id: series?.id ?? null,
        name: series?.name ?? "",
        product_type_key: series?.product_type_key ?? "",
        printed_template_id: series?.printed_template_id || series?.template_id || "",
        online_template_id: series?.online_template_id || series?.template_id || "",
        description1_html: series?.description1_html ?? "",
        description2_html: series?.description2_html ?? "",
        description3_html: series?.description3_html ?? "",
        comments_html: series?.description4_html ?? series?.comments_html ?? ""
      };
    }
    let seriesDraft = resetDraft();
    if (initialSeriesId !== "" && String(selectedSeriesId) !== String(initialSeriesId)) {
      selectedSeriesId = String(initialSeriesId);
      if (mode !== "create") {
        mode = "edit";
      }
    }
    head("plxnsv", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Series — Editor</title>`);
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
      $$renderer2.push(`<div class="row g-3 mb-3"><div class="col-12 col-md-6"><label class="form-label" for="series-select">Select series</label> `);
      $$renderer2.select(
        {
          class: "form-select",
          id: "series-select",
          value: selectedSeriesId
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`-- Choose option --`);
          });
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(seriesRecords);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let series = each_array[$$index];
            $$renderer3.option({ value: series.id }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(series.name)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(`</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="row g-3"><div class="col-12 col-md-6"><label class="form-label" for="series-name">Series name</label> <input class="form-control" id="series-name"${attr("value", seriesDraft.name)}/></div> <div class="col-12 col-md-6"><label class="form-label" for="series-type">Product type</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "series-type",
        value: seriesDraft.product_type_key
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`-- Choose option --`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(productTypes);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let productType = each_array_1[$$index_1];
          $$renderer3.option({ value: productType.key }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(productType.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <div class="col-12 col-md-6"><label class="form-label" for="series-printed-template">Printed PDF template</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "series-printed-template",
        value: seriesDraft.printed_template_id
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`No template`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_2 = ensure_array_like(templateRegistry.series_templates ?? []);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let template = each_array_2[$$index_2];
          $$renderer3.option({ value: template.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(template.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <div class="col-12 col-md-6"><label class="form-label" for="series-online-template">Online PDF template</label> `);
    $$renderer2.select(
      {
        class: "form-select",
        id: "series-online-template",
        value: seriesDraft.online_template_id
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`No template`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_3 = ensure_array_like(templateRegistry.series_templates ?? []);
        for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
          let template = each_array_3[$$index_3];
          $$renderer3.option({ value: template.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(template.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <div class="col-12"><label class="form-label" for="series-description1">Description1 (HTML)</label> <textarea class="form-control" id="series-description1" rows="3">`);
    const $$body = escape_html(seriesDraft.description1_html);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div> <div class="col-12 col-lg-6"><label class="form-label" for="series-description2">Description2 (HTML)</label> <textarea class="form-control" id="series-description2" rows="3">`);
    const $$body_1 = escape_html(seriesDraft.description2_html);
    if ($$body_1) {
      $$renderer2.push(`${$$body_1}`);
    }
    $$renderer2.push(`</textarea></div> <div class="col-12 col-lg-6"><label class="form-label" for="series-description3">Description3 (HTML)</label> <textarea class="form-control" id="series-description3" rows="3">`);
    const $$body_2 = escape_html(seriesDraft.description3_html);
    if ($$body_2) {
      $$renderer2.push(`${$$body_2}`);
    }
    $$renderer2.push(`</textarea></div> <div class="col-12"><label class="form-label" for="series-comments">Comments (HTML)</label> <textarea class="form-control" id="series-comments" rows="3">`);
    const $$body_3 = escape_html(seriesDraft.comments_html);
    if ($$body_3) {
      $$renderer2.push(`${$$body_3}`);
    }
    $$renderer2.push(`</textarea></div></div> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary"${attr("disabled", saving, true)}>${escape_html("Save Series")}</button> `);
    if (mode === "edit" && seriesDraft.id) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="btn btn-outline-danger"${attr("disabled", saving, true)}>Delete Series</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="btn btn-outline-secondary">Cancel</button></div></div></div></div></div>`);
    bind_props($$props, { initialMode, initialSeriesId });
  });
}
export {
  SeriesWorkspace as S
};
