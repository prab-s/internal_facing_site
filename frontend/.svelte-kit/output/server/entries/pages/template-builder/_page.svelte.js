import { h as head, a as attr, e as escape_html, i as ensure_array_like } from "../../../chunks/index2.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let availableTemplates, createSourceTemplates;
    let templates = { product_templates: [], series_templates: [] };
    let templateType = "";
    let templateId = "";
    let rawHtmlContent = "";
    let rawCssContent = "";
    let refreshing = false;
    let createLabel = "";
    let createType = "";
    let createSourceId = "";
    function templateCollection(type) {
      return type === "series" ? templates.series_templates ?? [] : templates.product_templates ?? [];
    }
    availableTemplates = templateCollection(templateType);
    createSourceTemplates = templateCollection(createType);
    head("yl845", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Template Builder | Internal Facing</title>`);
      });
    });
    $$renderer2.push(`<div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3"><div><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Visual Templates</p> <h1 class="h3 mb-1">Template Builder</h1> <p class="text-body-secondary mb-0">Edit the real HTML/CSS source safely, and use GrapesJS as a live preview sandbox for the template body.</p></div> <div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-secondary" type="button"${attr("disabled", refreshing, true)}>${escape_html("Refresh template library")}</button> <button class="btn btn-primary" type="button"${attr("disabled", true, true)}>${escape_html("Save template")}</button></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="row g-3"><div class="col-12 col-xxl-3"><div class="vstack gap-3"><div class="card shadow-sm"><div class="card-body"><h2 class="h5 mb-3">Open Template</h2> <div class="vstack gap-3"><div><label class="form-label" for="template-type">Template type</label> `);
    $$renderer2.select(
      {
        id: "template-type",
        class: "form-select",
        value: templateType
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`-- Choose option --`);
        });
        $$renderer3.option({ value: "product" }, ($$renderer4) => {
          $$renderer4.push(`Product`);
        });
        $$renderer3.option({ value: "series" }, ($$renderer4) => {
          $$renderer4.push(`Series`);
        });
      }
    );
    $$renderer2.push(`</div> <div><label class="form-label" for="template-id">Template</label> `);
    $$renderer2.select(
      {
        id: "template-id",
        class: "form-select",
        value: templateId,
        disabled: !templateType
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`-- Choose option --`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(availableTemplates);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let entry = each_array[$$index];
          $$renderer3.option({ value: entry.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(entry.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <button class="btn btn-outline-primary" type="button"${attr("disabled", !templateId, true)}>${escape_html("Load template")}</button></div></div></div> <div class="card shadow-sm"><div class="card-body"><h2 class="h5 mb-3">Create Template</h2> <div class="vstack gap-3"><div><label class="form-label" for="create-type">Template type</label> `);
    $$renderer2.select({ id: "create-type", class: "form-select", value: createType }, ($$renderer3) => {
      $$renderer3.option({ value: "" }, ($$renderer4) => {
        $$renderer4.push(`-- Choose option --`);
      });
      $$renderer3.option({ value: "product" }, ($$renderer4) => {
        $$renderer4.push(`Product`);
      });
      $$renderer3.option({ value: "series" }, ($$renderer4) => {
        $$renderer4.push(`Series`);
      });
    });
    $$renderer2.push(`</div> <div><label class="form-label" for="create-label">Label</label> <input id="create-label" class="form-control"${attr("value", createLabel)} placeholder="Compact product template"/></div> <div><label class="form-label" for="create-source">Clone existing</label> `);
    $$renderer2.select(
      {
        id: "create-source",
        class: "form-select",
        value: createSourceId,
        disabled: !createType
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Blank scaffold`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(createSourceTemplates);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let entry = each_array_1[$$index_1];
          $$renderer3.option({ value: entry.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(entry.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(`</div> <button class="btn btn-outline-primary" type="button"${attr("disabled", !createLabel.trim() || !createType, true)}>${escape_html("Create template")}</button></div></div></div> <div class="card shadow-sm"><div class="card-body"><h2 class="h5 mb-3">Template Info</h2> `);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="text-body-secondary mb-0">Load a template to inspect its file paths and edit it.</p>`);
    }
    $$renderer2.push(`<!--]--></div></div></div></div> <div class="col-12 col-xxl-9"><div class="card shadow-sm mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h2 class="h5 mb-1">Source Editors</h2> <p class="text-body-secondary mb-0">These fields are the real saved template source. Save here to preserve your handcrafted layout.</p></div> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", true, true)}>Refresh visual preview</button></div> <div class="row g-3"><div class="col-12 col-xl-7"><label class="form-label" for="template-html-source">HTML</label> <textarea id="template-html-source" class="form-control font-monospace" rows="22" spellcheck="false"${attr("disabled", true, true)}>`);
    const $$body = escape_html(rawHtmlContent);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div> <div class="col-12 col-xl-5"><label class="form-label" for="template-css-source">CSS</label> <textarea id="template-css-source" class="form-control font-monospace" rows="22" spellcheck="false"${attr("disabled", true, true)}>`);
    const $$body_1 = escape_html(rawCssContent);
    if ($$body_1) {
      $$renderer2.push(`${$$body_1}`);
    }
    $$renderer2.push(`</textarea></div></div></div></div> <div class="card shadow-sm"><div class="card-body"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h2 class="h5 mb-1">Visual Preview Sandbox</h2> <p class="text-body-secondary mb-0">Drag-and-drop here to experiment, but use the source editors above for the final saved version.</p></div></div> <div class="template-editor-host border rounded overflow-hidden svelte-yl845"></div></div></div></div></div>`);
  });
}
export {
  _page as default
};
