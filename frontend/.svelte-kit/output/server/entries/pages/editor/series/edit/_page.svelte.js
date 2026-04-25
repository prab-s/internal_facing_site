import { h as head } from "../../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../../chunks/ManagePageShell.js";
import { S as SeriesWorkspace } from "../../../../../chunks/SeriesWorkspace.js";
function _page($$renderer) {
  head("1jzodvh", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Edit Series — Editor</title>`);
    });
  });
  ManagePageShell($$renderer, {
    eyebrow: "Manage series",
    title: "Edit Series",
    description: "Open an existing series and update its details.",
    backHref: "/editor",
    backLabel: "Back to Editor",
    children: ($$renderer2) => {
      SeriesWorkspace($$renderer2, { initialMode: "edit" });
    },
    $$slots: { default: true }
  });
}
export {
  _page as default
};
