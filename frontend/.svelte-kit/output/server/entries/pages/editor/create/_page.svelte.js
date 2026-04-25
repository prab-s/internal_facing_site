import { h as head } from "../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../chunks/ManagePageShell.js";
import { P as ProductWorkspace } from "../../../../chunks/ProductWorkspace.js";
function _page($$renderer) {
  head("1xo6my1", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Create Product — Editor</title>`);
    });
  });
  ManagePageShell($$renderer, {
    eyebrow: "Manage product",
    title: "Create Product",
    description: "Create a new product record, then add media and graph data.",
    backHref: "/editor",
    backLabel: "Back to Editor",
    children: ($$renderer2) => {
      ProductWorkspace($$renderer2, { initialMode: "create" });
    },
    $$slots: { default: true }
  });
}
export {
  _page as default
};
