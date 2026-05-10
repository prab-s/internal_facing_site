import { f as fallback, e as escape_html, d as bind_props, h as head, a as attr, j as attr_style, i as ensure_array_like, b as attr_class } from "../../../chunks/index2.js";
/* empty css                         */
import { Compartment } from "@codemirror/state";
import { MatchDecorator, Decoration, ViewPlugin, EditorView } from "@codemirror/view";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { o as onDestroy } from "../../../chunks/index-server.js";
function SourceEditor($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let value = fallback($$props["value"], "");
    let language = fallback($$props["language"], "html");
    let editable = fallback($$props["editable"], true);
    let label = fallback($$props["label"], "");
    let onChange = fallback($$props["onChange"], () => {
    });
    let editorView = null;
    let lastValue = value;
    const editableCompartment = new Compartment();
    const languageCompartment = new Compartment();
    const jinjaTokenMatcher = /(\{\{[\s\S]*?\}\}|\{%-?[\s\S]*?-?%\}|\{#.*?#\})/g;
    const jinjaDecorator = new MatchDecorator({
      regexp: jinjaTokenMatcher,
      decoration: (match) => {
        const token = match[0];
        let tokenClass = "cm-jinja-token";
        if (token.startsWith("{{")) tokenClass += " cm-jinja-expression";
        else if (token.startsWith("{#")) tokenClass += " cm-jinja-comment";
        else tokenClass += " cm-jinja-block";
        return Decoration.mark({ class: tokenClass });
      }
    });
    ViewPlugin.fromClass(
      class {
        constructor(view) {
          this.decorations = jinjaDecorator.createDeco(view);
        }
        update(update) {
          this.decorations = jinjaDecorator.updateDeco(update, this.decorations);
        }
      },
      { decorations: (instance) => instance.decorations }
    );
    function languageExtension(nextLanguage) {
      if (nextLanguage === "css") return css();
      return html({
        autoCloseTags: true,
        matchClosingTags: true,
        selfClosingTags: true
      });
    }
    function syncExternalValue(nextValue) {
      const normalized = nextValue ?? "";
      if (!normalized) {
        lastValue = "";
        editorView?.destroy();
        editorView = null;
        return;
      }
      if (!editorView) {
        lastValue = normalized;
        return;
      }
      if (normalized === lastValue) return;
      lastValue = normalized;
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: normalized }
      });
    }
    function syncEditorOptions(nextLanguage, nextEditable) {
      if (!editorView) return;
      editorView.dispatch({
        effects: [
          editableCompartment.reconfigure(EditorView.editable.of(nextEditable)),
          languageCompartment.reconfigure(languageExtension(nextLanguage))
        ]
      });
    }
    onDestroy(() => {
      editorView?.destroy();
      editorView = null;
    });
    syncExternalValue(value);
    syncEditorOptions(language, editable);
    $$renderer2.push(`<div class="source-editor-shell svelte-y7mxxg">`);
    if (label) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="source-editor-label svelte-y7mxxg">${escape_html(label)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="source-editor-host svelte-y7mxxg">`);
    if (!value) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="source-editor-placeholder svelte-y7mxxg">Load a template to edit ${escape_html(label || "source")}.</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="source-editor-canvas svelte-y7mxxg"></div></div></div>`);
    bind_props($$props, { value, language, editable, label, onChange });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let availableTemplates, createSourceTemplates;
    let templates = {
      product_templates: []
    };
    let productTypes = [];
    let templateType = "";
    let templateId = "";
    let previewProductTypeKey = "";
    let rawHtmlContent = "";
    let rawCssContent = "";
    let refreshing = false;
    let createLabel = "";
    let createType = "";
    let createSourceId = "";
    let sidebarWidth = 360;
    function templateCollection(type) {
      return templates.product_templates ?? [];
    }
    function handleCssSourceInput(event) {
      rawCssContent = event.currentTarget.value;
    }
    function handleHtmlSourceInput(event) {
      rawHtmlContent = event.currentTarget.value;
    }
    availableTemplates = templateCollection();
    createSourceTemplates = templateCollection();
    productTypes.find((item) => item.key === previewProductTypeKey) || null;
    head("1curero", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Template Builder V2 | Internal Facing</title>`);
      });
    });
    $$renderer2.push(`<div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3"><div><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Visual Templates</p> <h1 class="h3 mb-1">Template Builder V2</h1> <p class="text-body-secondary mb-0">Experimental builder with safer Jinja handling, stronger GrapesJS defaults, and the same template-loading workflow.</p></div> <div class="d-flex gap-2 flex-wrap"><a class="btn btn-outline-secondary" href="/template-builder">Open legacy builder</a> <button class="btn btn-outline-secondary" type="button"${attr("disabled", refreshing, true)}>${escape_html("Refresh template library")}</button> <button class="btn btn-primary" type="button"${attr("disabled", true, true)}>${escape_html("Save template")}</button></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="template-builder-v2-shell svelte-1curero"${attr_style(`--sidebar-width: ${sidebarWidth}px;`)}><aside class="template-builder-v2-sidebar svelte-1curero"><div class="vstack gap-3"><div class="card shadow-sm"><div class="card-body"><h2 class="h5 mb-3">Open Template</h2> <div class="vstack gap-3"><div><label class="form-label" for="template-type">Template type</label> `);
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
        $$renderer3.option({ value: "product_type" }, ($$renderer4) => {
          $$renderer4.push(`Product Type`);
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
      $$renderer3.option({ value: "product_type" }, ($$renderer4) => {
        $$renderer4.push(`Product Type`);
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
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></aside> <button type="button"${attr_class(`template-builder-v2-divider ${""}`, "svelte-1curero")} aria-label="Resize sidebar"></button> <section class="template-builder-v2-main svelte-1curero"><div class="card shadow-sm mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h2 class="h5 mb-1">Source Editors</h2> <p class="text-body-secondary mb-0">These fields show the saved template source. Sandbox edits are folded back into this source when you click Save.</p></div> <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", true, true)}>Refresh visual preview</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", true, true)}>Format source</button></div></div> <div class="row g-3"><div class="col-12 col-xl-7">`);
    SourceEditor($$renderer2, {
      label: "HTML",
      language: "html",
      editable: false,
      value: rawHtmlContent,
      onChange: (nextValue) => {
        rawHtmlContent = nextValue;
        handleHtmlSourceInput({ currentTarget: { value: nextValue } });
      }
    });
    $$renderer2.push(`<!----></div> <div class="col-12 col-xl-5">`);
    SourceEditor($$renderer2, {
      label: "CSS",
      language: "css",
      editable: false,
      value: rawCssContent,
      onChange: (nextValue) => {
        rawCssContent = nextValue;
        handleCssSourceInput({ currentTarget: { value: nextValue } });
      }
    });
    $$renderer2.push(`<!----></div></div></div></div> <div class="card shadow-sm"><div class="card-body"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h2 class="h5 mb-1">Visual Preview Sandbox</h2> <p class="text-body-secondary mb-0">Drag-and-drop here to experiment. Save captures the current sandbox HTML and CSS, then writes them back into the source editors.</p></div></div> <div class="template-editor-host border rounded overflow-hidden svelte-1curero"></div></div></div></section></div>`);
  });
}
export {
  _page as default
};
