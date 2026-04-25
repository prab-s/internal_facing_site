import { h as head } from "../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../chunks/ManagePageShell.js";
function _page($$renderer) {
  head("1bsqd4a", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Product Types — Editor</title>`);
    });
  });
  ManagePageShell($$renderer, {
    eyebrow: "Manage product types",
    title: "Product Types",
    description: "Choose whether to create a new product type or edit an existing one.",
    children: ($$renderer2) => {
      $$renderer2.push(`<div class="card shadow-sm"><div class="card-body d-flex flex-wrap gap-2"><a class="btn btn-primary" href="/editor/product-types/create">Create new product type</a> <a class="btn btn-outline-primary" href="/editor/product-types/edit">Edit existing product type</a></div></div>`);
    },
    $$slots: { default: true }
  });
}
export {
  _page as default
};
