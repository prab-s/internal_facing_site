import { s as store_get, h as head, d as ensure_array_like, e as escape_html, c as attr_class, b as attr, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { b as browser } from "../../../chunks/false.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { a as auth } from "../../../chunks/auth.js";
import { G as GLOBAL_UNIT_OPTIONS } from "../../../chunks/config.js";
import { g as getProducts, y as getSeries, z as getUsers, A as getProductTypes } from "../../../chunks/api.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let showCookieWarning;
    let users = [];
    let usersLoaded = false;
    let userFilter = "";
    let loadingUsers = false;
    let currentPassword = "";
    let newOwnPassword = "";
    let maintenanceErrorToast = "";
    let backupPollTimeouts = {};
    let products = [];
    let productsLoaded = false;
    let loadingProducts = false;
    let series = [];
    let seriesLoaded = false;
    let loadingSeries = false;
    let productTypes = [];
    let productTypesLoaded = false;
    let loadingProductTypes = false;
    let selectedProductTypeId = "";
    let successMessages = [];
    const setupSections = [
      {
        id: "account",
        label: "Account",
        description: "Your password and session details.",
        adminOnly: false
      },
      {
        id: "users",
        label: "Users",
        description: "Manage internal user accounts.",
        adminOnly: true
      },
      {
        id: "communications",
        label: "Communications",
        description: "SMTP and enquiry delivery.",
        adminOnly: true
      },
      {
        id: "diagnostics",
        label: "Diagnostics",
        description: "Logs and device activity.",
        adminOnly: true
      },
      {
        id: "maintenance",
        label: "Maintenance",
        description: "Customer refresh and generation.",
        adminOnly: true
      },
      {
        id: "backups",
        label: "Backups",
        description: "Database and media backup tools.",
        adminOnly: true
      },
      {
        id: "file-managers",
        label: "File Managers",
        description: "Manage media and templates.",
        adminOnly: true
      },
      {
        id: "presets",
        label: "Presets",
        description: "Product type defaults.",
        adminOnly: true
      }
    ];
    let activeSection = "account";
    onDestroy(() => {
      for (const timeout of Object.values(backupPollTimeouts)) {
        if (timeout) clearTimeout(timeout);
      }
    });
    async function loadProducts() {
      loadingProducts = true;
      try {
        products = await getProducts();
        productsLoaded = true;
      } catch (error) {
        maintenanceErrorToast = error?.message || "Unable to load products.";
      } finally {
        loadingProducts = false;
      }
    }
    async function loadSeries() {
      loadingSeries = true;
      try {
        series = await getSeries();
        seriesLoaded = true;
      } catch (error) {
        maintenanceErrorToast = error?.message || "Unable to load series.";
      } finally {
        loadingSeries = false;
      }
    }
    async function loadUsers() {
      loadingUsers = true;
      try {
        users = await getUsers();
        usersLoaded = true;
      } catch (error) {
        error?.message || "Unable to load users.";
      } finally {
        loadingUsers = false;
      }
    }
    function createPresetParameterDraft(parameter = {}) {
      const preferredUnit = parameter.preferred_unit ?? "";
      const isCustomUnit = preferredUnit !== "" && !GLOBAL_UNIT_OPTIONS.includes(preferredUnit);
      const valueString = parameter.value_string ?? "";
      const valueNumber = parameter.value_number ?? "";
      const valueType = parameter.value_type ?? (valueString !== "" ? "string" : valueNumber !== "" && valueNumber != null ? "number" : preferredUnit !== "" ? "number" : "string");
      return {
        id: parameter.id ?? null,
        _pending_delete: false,
        parameter_name: parameter.parameter_name ?? "",
        preferred_unit: isCustomUnit ? "__custom__" : preferredUnit,
        value_type: valueType,
        value_string: valueString,
        value_number: valueNumber,
        custom_unit: isCustomUnit ? preferredUnit : ""
      };
    }
    function createPresetGroupDraft(group = {}) {
      return {
        id: group.id ?? null,
        _pending_delete: false,
        group_name: group.group_name ?? "",
        parameters: (group.parameter_presets ?? []).map((parameter) => createPresetParameterDraft(parameter))
      };
    }
    function createPresetRpmPointDraft(point = {}) {
      return {
        id: point.id ?? null,
        _pending_delete: false,
        airflow: point.airflow ?? "",
        pressure: point.pressure ?? ""
      };
    }
    function createPresetRpmLineDraft(line = {}) {
      return {
        id: line.id ?? null,
        _pending_delete: false,
        rpm: line.rpm ?? "",
        band_color: line.band_color ?? "",
        points: (line.point_presets ?? []).map((point) => createPresetRpmPointDraft(point))
      };
    }
    function createPresetEfficiencyPointDraft(point = {}) {
      return {
        id: point.id ?? null,
        _pending_delete: false,
        airflow: point.airflow ?? "",
        efficiency_centre: point.efficiency_centre ?? "",
        efficiency_lower_end: point.efficiency_lower_end ?? "",
        efficiency_higher_end: point.efficiency_higher_end ?? "",
        permissible_use: point.permissible_use ?? ""
      };
    }
    function clonePresetGroupsForType(productTypeId) {
      const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
      return (productType?.parameter_group_presets ?? []).map((group) => createPresetGroupDraft(group));
    }
    function clonePresetRpmLinesForType(productTypeId) {
      const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
      return (productType?.rpm_line_presets ?? []).map((line) => createPresetRpmLineDraft(line));
    }
    function clonePresetEfficiencyPointsForType(productTypeId) {
      const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
      return (productType?.efficiency_point_presets ?? []).map((point) => createPresetEfficiencyPointDraft(point));
    }
    function clonePresetProductTemplateIdForType(productTypeId) {
      const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
      return productType?.printed_product_template_id || productType?.product_template_id || productType?.online_product_template_id || "";
    }
    function clonePresetSeriesTemplateIdForType(productTypeId) {
      const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
      return productType?.series_template_id || "";
    }
    function clonePresetBandGraphStyleForType(productTypeId) {
      const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
      return {
        band_graph_background_color: productType?.band_graph_background_color ?? "#ffffff",
        band_graph_label_text_color: productType?.band_graph_label_text_color ?? "#000000",
        band_graph_faded_opacity: productType?.band_graph_faded_opacity ?? 0.18,
        band_graph_permissible_label_color: productType?.band_graph_permissible_label_color ?? "#000000"
      };
    }
    function clearPresetDrafts() {
      clonePresetBandGraphStyleForType("");
    }
    function syncPresetDraftsForSelectedType(productTypeId = selectedProductTypeId) {
      if (!productTypeId) {
        clearPresetDrafts();
        return;
      }
      clonePresetGroupsForType(productTypeId);
      clonePresetRpmLinesForType(productTypeId);
      clonePresetEfficiencyPointsForType(productTypeId);
      clonePresetProductTemplateIdForType(productTypeId);
      clonePresetSeriesTemplateIdForType(productTypeId);
      clonePresetBandGraphStyleForType(productTypeId);
    }
    async function loadProductTypes() {
      loadingProductTypes = true;
      try {
        productTypes = await getProductTypes();
        productTypesLoaded = true;
        const selectedStillExists = productTypes.some((item) => String(item.id) === String(selectedProductTypeId));
        if (!selectedStillExists) {
          selectedProductTypeId = "";
        }
        syncPresetDraftsForSelectedType();
      } catch (error) {
        error?.message || "Unable to load product types.";
      } finally {
        loadingProductTypes = false;
      }
    }
    if (store_get($$store_subs ??= {}, "$auth", auth).authenticated && !usersLoaded && !loadingUsers) {
      loadUsers();
    }
    if (store_get($$store_subs ??= {}, "$auth", auth).authenticated && !productTypesLoaded && !loadingProductTypes) {
      loadProductTypes();
    }
    if (store_get($$store_subs ??= {}, "$auth", auth).authenticated && !productsLoaded && !loadingProducts) {
      loadProducts();
    }
    if (store_get($$store_subs ??= {}, "$auth", auth).authenticated && !seriesLoaded && !loadingSeries) {
      loadSeries();
    }
    showCookieWarning = browser;
    new Map(series.map((item) => [String(item.id), item]));
    new Map(products.map((item) => [String(item.id), item]));
    if (productTypesLoaded) {
      if (selectedProductTypeId) {
        syncPresetDraftsForSelectedType(selectedProductTypeId);
      } else {
        clearPresetDrafts();
      }
    }
    users.filter((user) => {
      const needle = userFilter.trim().toLowerCase();
      if (!needle) return true;
      return user.username.toLowerCase().includes(needle);
    });
    head("g40i6i", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Setup - Internal Facing</title>`);
      });
    });
    if (showCookieWarning) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="alert alert-warning border-0 shadow-sm mb-3"><div class="fw-semibold mb-1">Session cookies are marked secure, but this app is being served over HTTP.</div> <div class="text-body-secondary mb-0">Logins can fail or disappear after reloads until the app is served over HTTPS, or <code>AUTH_COOKIE_SECURE</code> is disabled for local and SIT runs.</div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (successMessages.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="success-toast shadow-lg svelte-g40i6i" role="status" aria-live="polite" aria-atomic="true"><div class="alert alert-success mb-0 success-toast-alert svelte-g40i6i"><!--[-->`);
      const each_array = ensure_array_like(successMessages);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let message = each_array[$$index];
        $$renderer2.push(`<div>${escape_html(message)}</div>`);
      }
      $$renderer2.push(`<!--]--> <!---->`);
      {
        $$renderer2.push(`<div class="success-toast-progress svelte-g40i6i"></div>`);
      }
      $$renderer2.push(`<!----></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (maintenanceErrorToast) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="error-toast shadow-lg svelte-g40i6i" role="alert" aria-live="assertive" aria-atomic="true"><div class="alert alert-danger mb-0 error-toast-alert svelte-g40i6i"><div class="d-flex justify-content-between align-items-start gap-3"><div class="me-auto">${escape_html(maintenanceErrorToast)}</div> <button class="btn-close" type="button" aria-label="Dismiss error"></button></div> <!---->`);
      {
        $$renderer2.push(`<div class="error-toast-progress svelte-g40i6i"></div>`);
      }
      $$renderer2.push(`<!----></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="setup-hero card shadow-sm mb-4 svelte-g40i6i"><div class="card-body bg-body-secondary bg-opacity-10 p-4 p-lg-5"><div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3"><div class="setup-hero-copy svelte-g40i6i"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Setup</p> <h1 class="h2 mb-2">Account and application setup.</h1> <p class="text-body-secondary mb-0">Manage your own password here. Admins can also create and manage internal user accounts, inspect live logs,
          and run maintenance tasks from the same page.</p></div> `);
    if (store_get($$store_subs ??= {}, "$auth", auth).is_admin) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="setup-hero-badge svelte-g40i6i"><span class="badge text-bg-dark mb-2">Admin access</span> <p class="text-body-secondary mb-0">Debug logs are collapsed by default and only connect while the panel is open.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></div> <div class="row g-4 align-items-start setup-shell"><aside class="col-12 col-xl-3"><div class="card shadow-sm setup-section-nav svelte-g40i6i"><div class="card-body bg-body-secondary bg-opacity-10 p-2"><p class="small text-uppercase text-body-secondary fw-semibold px-3 pt-2 mb-2">Setup sections</p> <nav aria-label="Setup sections" class="svelte-g40i6i"><!--[-->`);
    const each_array_1 = ensure_array_like(setupSections);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let section = each_array_1[$$index_1];
      const locked = section.adminOnly && !store_get($$store_subs ??= {}, "$auth", auth).is_admin;
      $$renderer2.push(`<button${attr_class("setup-section-nav-item svelte-g40i6i", void 0, { "active": activeSection === section.id, "disabled": locked })} type="button"${attr("disabled", locked, true)}${attr("aria-current", activeSection === section.id ? "page" : void 0)}${attr("title", locked ? "Administrator access required" : section.description)}><span class="setup-section-nav-label svelte-g40i6i">${escape_html(section.label)}</span> `);
      if (locked) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="setup-section-nav-lock svelte-g40i6i" aria-label="Administrator access required">🔒</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <span class="setup-section-nav-description svelte-g40i6i">${escape_html(locked ? "Admin access required" : section.description)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></nav></div></div></aside> <div class="col-12 col-xl-9 setup-section-content"><div class="row g-4 align-items-start"><div${attr_class(`col-12 ${"col-xl-4"} d-flex flex-column gap-4`, "svelte-g40i6i")}>`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card shadow-sm"><div class="card-body bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">My Account</p> <h2 class="h4">Change Password</h2> <p class="text-body-secondary">Signed in as ${escape_html(store_get($$store_subs ??= {}, "$auth", auth).username)}.</p> <p class="small text-body-secondary mb-0">Device IP: IPv4 ${escape_html(store_get($$store_subs ??= {}, "$auth", auth).device_ip_v4 || store_get($$store_subs ??= {}, "$auth", auth).client_ip_v4 || "—")} · IPv6 ${escape_html(store_get($$store_subs ??= {}, "$auth", auth).device_ip_v6 || store_get($$store_subs ??= {}, "$auth", auth).client_ip_v6 || "—")}</p> <form class="vstack gap-3"><div><label class="form-label" for="current-password">Current Password</label> <input id="current-password" class="form-control" type="password"${attr("value", currentPassword)}/></div> <div><label class="form-label" for="new-own-password">New Password</label> <input id="new-own-password" class="form-control" type="password"${attr("value", newOwnPassword)}/></div> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button class="btn btn-primary align-self-start" type="submit"${attr("disabled", !currentPassword, true)}>${escape_html("Update Password")}</button></form></div></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (store_get($$store_subs ??= {}, "$auth", auth).is_admin && activeSection === "communications") ;
    else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (store_get($$store_subs ??= {}, "$auth", auth).is_admin && activeSection === "users") ;
    else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div${attr_class(`col-12 d-flex flex-column gap-4 ${""}`, "svelte-g40i6i")}>`);
    if (store_get($$store_subs ??= {}, "$auth", auth).is_admin && activeSection === "users") ;
    else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (store_get($$store_subs ??= {}, "$auth", auth).is_admin && activeSection === "diagnostics") ;
    else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> `);
    if (store_get($$store_subs ??= {}, "$auth", auth).is_admin && ["maintenance", "backups", "file-managers", "presets"].includes(activeSection)) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-4"><div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-3"><div><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Administration</p> <h2 class="h3 mb-0">Operational Tools</h2></div> <p class="text-body-secondary mb-0">Backup, restore, regeneration, file management, and preset editing live here.</p></div> <div class="row g-4 mt-0"><div class="col-12"><div class="card shadow-sm h-100"><div class="card-body bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Administration</p> <h2 class="h4">${escape_html("Maintenance")}</h2> <p class="text-body-secondary">${escape_html("Run customer-facing refreshes and regenerate graphs and PDFs.")}</p> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
