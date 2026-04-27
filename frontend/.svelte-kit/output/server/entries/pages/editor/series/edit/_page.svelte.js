import { h as head, s as store_get, u as unsubscribe_stores } from "../../../../../chunks/index2.js";
import { p as page } from "../../../../../chunks/stores.js";
import { M as ManagePageShell } from "../../../../../chunks/ManagePageShell.js";
import { S as SeriesWorkspace } from "../../../../../chunks/SeriesWorkspace.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
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
        SeriesWorkspace($$renderer3, {
          initialMode: "edit",
          initialSeriesId: store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("series") ?? ""
        });
      },
      $$slots: { default: true }
    });
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
