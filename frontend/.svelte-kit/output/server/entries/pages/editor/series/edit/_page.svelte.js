import { f as fallback, h as head, d as bind_props } from "../../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../../chunks/ManagePageShell.js";
import { S as SeriesWorkspace } from "../../../../../chunks/SeriesWorkspace.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let data = fallback($$props["data"], () => ({}), true);
    head("1jzodvh", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Edit Series — Editor</title>`);
      });
    });
    ManagePageShell($$renderer2, {
      eyebrow: "Manage series",
      title: "Edit Series",
      description: "Open an existing series and update its details.",
      backHref: "/editor",
      backLabel: "Back to Editor",
      children: ($$renderer3) => {
        SeriesWorkspace($$renderer3, { initialMode: "edit", initialSeriesId: data.series ?? "" });
      },
      $$slots: { default: true }
    });
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
