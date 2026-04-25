import { h as head } from "../../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../../chunks/ManagePageShell.js";
import { S as SeriesWorkspace } from "../../../../../chunks/SeriesWorkspace.js";
function _page($$renderer) {
  head("h89js1", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Create Series — Editor</title>`);
    });
  });
  ManagePageShell($$renderer, {
    eyebrow: "Manage series",
    title: "Create Series",
    description: "Create a new series record, then assign it to products.",
    backHref: "/editor",
    backLabel: "Back to Editor",
    children: ($$renderer2) => {
      SeriesWorkspace($$renderer2, { initialMode: "create" });
    },
    $$slots: { default: true }
  });
}
export {
  _page as default
};
