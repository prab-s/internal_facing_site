import { f as fallback, h as head, d as bind_props } from "../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../chunks/ManagePageShell.js";
import { P as ProductWorkspace } from "../../../../chunks/ProductWorkspace.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = fallback($$props["data"], () => ({}), true);
    head("1hurdwl", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Edit Product — Editor</title>`);
      });
    });
    ManagePageShell($$renderer2, {
      eyebrow: "Manage product",
      title: "Edit Product",
      description: "Open an existing product and update its details, media, and graph data.",
      backHref: "/editor",
      backLabel: "Back to Editor",
      children: ($$renderer3) => {
        ProductWorkspace($$renderer3, {
          initialMode: "editExisting",
          initialProductId: data.product ?? ""
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
