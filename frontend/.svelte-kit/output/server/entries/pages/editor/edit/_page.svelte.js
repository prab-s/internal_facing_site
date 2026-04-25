import { h as head } from "../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../chunks/ManagePageShell.js";
import { P as ProductWorkspace } from "../../../../chunks/ProductWorkspace.js";
function _page($$renderer) {
  head("1hurdwl", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Edit Product — Editor</title>`);
    });
  });
  ManagePageShell($$renderer, {
    eyebrow: "Manage product",
    title: "Edit Product",
    description: "Open an existing product and update its details, media, and graph data.",
    backHref: "/editor",
    backLabel: "Back to Editor",
    children: ($$renderer2) => {
      ProductWorkspace($$renderer2, { initialMode: "editExisting" });
    },
    $$slots: { default: true }
  });
}
export {
  _page as default
};
