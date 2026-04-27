import { s as store_get, a as attr, e as escape_html, b as attr_class, c as slot, u as unsubscribe_stores } from "../../chunks/index2.js";
import { p as page } from "../../chunks/stores.js";
import { a as auth } from "../../chunks/auth.js";
import { t as theme } from "../../chunks/api.js";
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let username = "";
    let password = "";
    function isActive(path) {
      if (path === "/") return store_get($$store_subs ??= {}, "$page", page).url.pathname === "/";
      return store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith(path);
    }
    $$renderer2.push(`<div class="app-shell">`);
    if (!store_get($$store_subs ??= {}, "$auth", auth).ready) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<main class="app-frame py-5"><div class="d-flex justify-content-center"><div class="card shadow-sm" style="max-width: 420px; width: 100%;"><div class="card-body p-4 text-center"><h1 class="h4 mb-2">Internal Facing</h1> <p class="text-body-secondary mb-0">Checking your session...</p></div></div></div></main>`);
    } else if (!store_get($$store_subs ??= {}, "$auth", auth).authenticated) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<main class="app-frame py-5"><div class="d-flex justify-content-center"><div class="card shadow-sm" style="max-width: 420px; width: 100%;"><div class="card-body p-4"><div class="text-center mb-4"><h1 class="h4 mb-2">Internal Facing</h1> <p class="text-body-secondary mb-0">Enter the application password to continue.</p></div> <form class="vstack gap-3"><div><label class="form-label" for="app-username">Username</label> <input id="app-username" class="form-control" type="text"${attr("value", username)} autocomplete="username"/></div> <div><label class="form-label" for="app-password">Password</label> <input id="app-password" class="form-control" type="password"${attr("value", password)} autocomplete="current-password"/></div> `);
      if (store_get($$store_subs ??= {}, "$auth", auth).error) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="alert alert-danger py-2 mb-0">${escape_html(store_get($$store_subs ??= {}, "$auth", auth).error)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="d-flex justify-content-between align-items-center gap-2"><button class="btn btn-outline-primary btn-sm" type="button">${escape_html(store_get($$store_subs ??= {}, "$theme", theme) === "dark" ? "Switch to Light" : "Switch to Dark")}</button> <button class="btn btn-primary" type="submit"${attr("disabled", store_get($$store_subs ??= {}, "$auth", auth).busy || !username, true)}>${escape_html(store_get($$store_subs ??= {}, "$auth", auth).busy ? "Signing In..." : "Sign In")}</button></div></form></div></div></div></main>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<header class="topbar navbar navbar-expand-lg"><div class="container-fluid app-frame px-0 d-flex align-items-center gap-3 flex-wrap justify-content-center"><div class="topbar-brand navbar-brand mb-0 text-center text-lg-start"><div><p class="small text-uppercase text-body-secondary fw-semibold mb-1"><strong>Internal Facing</strong></p></div> <span class="small text-body-secondary">`);
      if (isActive("/editor")) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`Editor`);
      } else if (isActive("/viewer")) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`Viewer`);
      } else if (isActive("/template-builder")) {
        $$renderer2.push("<!--[2-->");
        $$renderer2.push(`Template Builder`);
      } else if (isActive("/setup")) {
        $$renderer2.push("<!--[3-->");
        $$renderer2.push(`Setup`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`Overview`);
      }
      $$renderer2.push(`<!--]--></span></div> <nav class="nav nav-underline justify-content-center mx-auto" aria-label="Primary"><a${attr_class(`nav-link ${isActive("/") ? "active text-body fw-medium" : "text-body-secondary"}`)} href="/">Home</a> <a${attr_class(`nav-link ${isActive("/editor") ? "active text-body fw-medium" : "text-body-secondary"}`)} href="/editor">Editor</a> <a${attr_class(`nav-link ${isActive("/viewer") ? "active text-body fw-medium" : "text-body-secondary"}`)} href="/viewer">Viewer</a> <a${attr_class(`nav-link ${isActive("/template-builder") ? "active text-body fw-medium" : "text-body-secondary"}`)} href="/template-builder">Template Builder</a> <a${attr_class(`nav-link ${isActive("/setup") ? "active text-body fw-medium" : "text-body-secondary"}`)} href="/setup">Setup</a></nav> <div class="d-flex align-items-center gap-2"><span class="small text-body-secondary d-none d-lg-inline">Signed in as ${escape_html(store_get($$store_subs ??= {}, "$auth", auth).username)}</span> <button class="btn btn-outline-primary btn-sm" type="button">${escape_html(store_get($$store_subs ??= {}, "$theme", theme) === "dark" ? "Switch to Light" : "Switch to Dark")}</button> <button class="btn btn-outline-secondary btn-sm" type="button">Sign Out</button></div></div></header> <main class="app-frame py-3"><!--[-->`);
      slot($$renderer2, $$props, "default", {});
      $$renderer2.push(`<!--]--></main>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
