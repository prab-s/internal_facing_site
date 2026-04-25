import { h as head } from "../../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../../chunks/ManagePageShell.js";
import { P as ProductTypeWorkspace } from "../../../../../chunks/ProductTypeWorkspace.js";
function _page($$renderer) {
  head("g2swnd", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Edit Product Type — Editor</title>`);
    });
  });
  ManagePageShell($$renderer, {
    eyebrow: "Manage product types",
    title: "Edit Product Type",
    description: "Open an existing product type and update its definition.",
    backHref: "/editor",
    backLabel: "Back to Editor",
    children: ($$renderer2) => {
      ProductTypeWorkspace($$renderer2, { initialMode: "edit" });
    },
    $$slots: { default: true }
  });
}
export {
  _page as default
};
