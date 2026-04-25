import { f as fallback, e as escape_html, a as attr, c as slot, d as bind_props } from "./index2.js";
function ManagePageShell($$renderer, $$props) {
  let eyebrow = fallback($$props["eyebrow"], "");
  let title = fallback($$props["title"], "");
  let description = fallback($$props["description"], "");
  let backHref = fallback($$props["backHref"], "/editor");
  let backLabel = fallback($$props["backLabel"], "Back to Editor");
  $$renderer.push(`<div class="row justify-content-center"><div class="col-12 col-xxl-12"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div>`);
  if (eyebrow) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<p class="small text-uppercase text-body-secondary fw-semibold mb-1">${escape_html(eyebrow)}</p>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <h1 class="h3 mb-1">${escape_html(title)}</h1> `);
  if (description) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<p class="text-body-secondary mb-0">${escape_html(description)}</p>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div> <div class="d-flex flex-wrap gap-2"><a class="btn btn-outline-secondary"${attr("href", backHref)}>${escape_html(backLabel)}</a></div></div> <!--[-->`);
  slot($$renderer, $$props, "default", {});
  $$renderer.push(`<!--]--></div></div>`);
  bind_props($$props, { eyebrow, title, description, backHref, backLabel });
}
export {
  ManagePageShell as M
};
