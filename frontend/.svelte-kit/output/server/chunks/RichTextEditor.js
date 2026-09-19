import { b as attr, e as escape_html, a as slot, c as attr_class, i as bind_props } from "./index2.js";
import { f as fallback } from "./equality.js";
function RichTextEditor($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let value = fallback($$props["value"], "");
    let id = fallback($$props["id"], "");
    let rows = fallback($$props["rows"], 4);
    let formattingOpen = false;
    (value.match(/<(p|div|h[1-6]|li|blockquote)\b/gi) || []).length;
    (value.match(/<br\s*\/?\s*>/gi) || []).length;
    $$renderer2.push(`<div class="rich-text-editor"><div class="rich-text-editor__toolbar svelte-1s8pqmd" role="toolbar" aria-label="Text formatting"><div class="btn-group btn-group-sm" role="group" aria-label="Text style"><button class="btn btn-outline-secondary" type="button" title="Bold" aria-label="Bold"><strong>B</strong></button> <button class="btn btn-outline-secondary" type="button" title="Italic" aria-label="Italic"><em>I</em></button> <button class="btn btn-outline-secondary" type="button" title="Underline" aria-label="Underline"><u>U</u></button> <button class="btn btn-outline-secondary" type="button" title="Strikethrough" aria-label="Strikethrough">S̶</button></div> <div class="btn-group btn-group-sm" role="group" aria-label="Paragraph formatting"><button class="btn btn-outline-secondary" type="button" title="Bulleted list" aria-label="Bulleted list">•</button></div> <button class="btn btn-sm btn-outline-secondary" type="button" title="Add link" aria-label="Add link">Link</button> <button class="btn btn-sm btn-outline-secondary" type="button"${attr("aria-expanded", formattingOpen)}>${escape_html("Format text")}</button> <!--[-->`);
    slot($$renderer2, $$props, "toolbar-end", {});
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div${attr_class("form-control rich-text-editor__surface svelte-1s8pqmd", void 0, { "rich-text-editor__surface--short": rows <= 3 })}${attr("id", id)} contenteditable="true" role="textbox" aria-multiline="true" aria-label="Rich text"></div></div>`);
    bind_props($$props, { value, id, rows });
  });
}
export {
  RichTextEditor as R
};
