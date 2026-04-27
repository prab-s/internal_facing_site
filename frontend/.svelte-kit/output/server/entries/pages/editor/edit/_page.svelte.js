import { h as head, s as store_get, u as unsubscribe_stores } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import { M as ManagePageShell } from "../../../../chunks/ManagePageShell.js";
import { P as ProductWorkspace } from "../../../../chunks/ProductWorkspace.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
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
          initialProductId: store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("product") ?? ""
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
