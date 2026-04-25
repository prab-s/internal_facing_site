import { h as head } from "../../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../../chunks/ManagePageShell.js";
import { P as ProductTypeWorkspace } from "../../../../../chunks/ProductTypeWorkspace.js";
function _page($$renderer) {
  head("1am4871", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Create Product Type — Editor</title>`);
    });
  });
  ManagePageShell($$renderer, {
    eyebrow: "Manage product types",
    title: "Create Product Type",
    description: "Create a new product type record, then use it across products and series.",
    backHref: "/editor",
    backLabel: "Back to Editor",
    children: ($$renderer2) => {
      ProductTypeWorkspace($$renderer2, { initialMode: "create" });
    },
    $$slots: { default: true }
  });
}
export {
  _page as default
};
