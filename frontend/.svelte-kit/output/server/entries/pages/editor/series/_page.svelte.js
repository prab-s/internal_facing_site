import { h as head } from "../../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../../chunks/ManagePageShell.js";
function _page($$renderer) {
  head("frnk9o", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Series — Editor</title>`);
    });
  });
  ManagePageShell($$renderer, {
    eyebrow: "Manage series",
    title: "Series",
    description: "Choose whether to create a new series or edit an existing one.",
    children: ($$renderer2) => {
      $$renderer2.push(`<div class="card shadow-sm"><div class="card-body d-flex flex-wrap gap-2"><a class="btn btn-primary" href="/editor/series/create">Create new series</a> <a class="btn btn-outline-primary" href="/editor/series/edit">Edit existing series</a></div></div>`);
    },
    $$slots: { default: true }
  });
}
export {
  _page as default
};
