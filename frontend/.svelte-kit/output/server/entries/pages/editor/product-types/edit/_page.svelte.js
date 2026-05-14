import { f as fallback, h as head, d as bind_props } from "../../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../../chunks/ManagePageShell.js";
import { P as ProductTypeWorkspace } from "../../../../../chunks/ProductTypeWorkspace.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = fallback($$props["data"], () => ({}), true);
    head("g2swnd", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Edit Product Type — Editor</title>`);
      });
    });
    ManagePageShell($$renderer2, {
      eyebrow: "Manage product types",
      title: "Edit Product Type",
      description: "Open an existing product type and update its definition.",
      backHref: "/editor",
      backLabel: "Back to Editor",
      children: ($$renderer3) => {
        ProductTypeWorkspace($$renderer3, {
          initialMode: "edit",
          initialProductTypeId: data.product_type ?? ""
        });
      },
      $$slots: { default: true }
    });
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
