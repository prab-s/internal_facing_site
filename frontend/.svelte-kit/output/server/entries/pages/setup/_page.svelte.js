import { s as store_get, h as head, i as ensure_array_like, e as escape_html, a as attr, b as attr_class, u as unsubscribe_stores, ac as clsx } from "../../../chunks/index2.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import { a as auth } from "../../../chunks/auth.js";
import { G as GLOBAL_UNIT_OPTIONS } from "../../../chunks/config.js";
import { g as getUsers, a as getProductTypes } from "../../../chunks/api.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let users = [];
    let usersLoaded = false;
    let filteredUsers = [];
    let userFilter = "";
    let userError = "";
    let loadingUsers = false;
    let savingUser = false;
    let currentPassword = "";
    let newOwnPassword = "";
    let newUsername = "";
    let newPassword = "";
    let newIsAdmin = false;
    let maintenanceLoading = false;
    let productTypes = [];
    let productTypesLoaded = false;
    let loadingProductTypes = false;
    let typePresetError = "";
    let selectedProductTypeId = "";
    let presetGroups = [];
    let presetRpmLines = [];
    let presetEfficiencyPoints = [];
    let presetPrintedProductTemplateId = "";
    let presetOnlineProductTemplateId = "";
    let presetBandGraphStyle = {
      band_graph_background_color: "#ffffff",
      band_graph_label_text_color: "#000000",
      band_graph_faded_opacity: 0.18,
      band_graph_permissible_label_color: "#000000"
    };
    let templateRegistry = { product_templates: [] };
    let successMessages = [];
    onDestroy(() => {
    });
    function productTemplates() {
      return templateRegistry.product_templates ?? [];
    }
    async function loadUsers() {
      loadingUsers = true;
      userError = "";
      try {
        users = await getUsers();
        usersLoaded = true;
      } catch (error) {
        userError = error?.message || "Unable to load users.";
      } finally {
        loadingUsers = false;
      }
    }
    function createPresetParameterDraft(parameter = {}) {
      const preferredUnit = parameter.preferred_unit ?? "";
      const valueString = parameter.value_string ?? "";
      const valueNumber = parameter.value_number ?? "";
      const valueType = valueString !== "" ? "string" : valueNumber !== "" && valueNumber != null ? "number" : "string";
      return {
        id: parameter.id ?? null,
        _pending_delete: false,
        parameter_name: parameter.parameter_name ?? "",
        preferred_unit: preferredUnit,
        value_type: valueType,
        value_string: valueString,
        value_number: valueNumber,
        custom_unit: preferredUnit && !GLOBAL_UNIT_OPTIONS.includes(preferredUnit) ? preferredUnit : ""
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
    function clonePresetProductTemplateIdForType(productTypeId, variant) {
      const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
      if (variant === "printed") {
        return productType?.printed_product_template_id || productType?.product_template_id || "";
      }
      return productType?.online_product_template_id || productType?.product_template_id || "";
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
    async function loadProductTypes() {
      loadingProductTypes = true;
      typePresetError = "";
      try {
        productTypes = await getProductTypes();
        productTypesLoaded = true;
        const selectedStillExists = productTypes.some((item) => String(item.id) === String(selectedProductTypeId));
        if (!selectedStillExists) {
          selectedProductTypeId = "";
          presetGroups = [];
          presetRpmLines = [];
          presetEfficiencyPoints = [];
          presetPrintedProductTemplateId = "";
          presetOnlineProductTemplateId = "";
          presetBandGraphStyle = clonePresetBandGraphStyleForType("");
        } else {
          presetGroups = clonePresetGroupsForType(selectedProductTypeId);
          presetRpmLines = clonePresetRpmLinesForType(selectedProductTypeId);
          presetEfficiencyPoints = clonePresetEfficiencyPointsForType(selectedProductTypeId);
          presetPrintedProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, "printed");
          presetOnlineProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, "online");
          presetBandGraphStyle = clonePresetBandGraphStyleForType(selectedProductTypeId);
        }
      } catch (error) {
        typePresetError = error?.message || "Unable to load product types.";
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
    filteredUsers = users.filter((user) => {
      const needle = userFilter.trim().toLowerCase();
      if (!needle) return true;
      return user.username.toLowerCase().includes(needle);
    });
    head("g40i6i", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Setup - Internal Facing</title>`);
      });
    });
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
    $$renderer2.push(`<!--]--> <div class="mb-3"><div class="col-12 col-xxl-8"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Setup</p> <h1 class="h2 mb-2">Account and application setup.</h1> <p class="text-body-secondary">Manage your own password here. Admins can also create and manage internal user accounts.</p></div></div> <div class="row g-3"><div class="col-12 col-xl-5"><div class="card shadow-sm h-100"><div class="card-body bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">My Account</p> <h2 class="h4">Change Password</h2> <p class="text-body-secondary">Signed in as ${escape_html(store_get($$store_subs ??= {}, "$auth", auth).username)}.</p> <form class="vstack gap-3"><div><label class="form-label" for="current-password">Current Password</label> <input id="current-password" class="form-control" type="password"${attr("value", currentPassword)}/></div> <div><label class="form-label" for="new-own-password">New Password</label> <input id="new-own-password" class="form-control" type="password"${attr("value", newOwnPassword)}/></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="btn btn-primary align-self-start" type="submit"${attr("disabled", !currentPassword, true)}>${escape_html("Update Password")}</button></form></div></div></div> <div class="col-12 col-xl-7"><div class="card shadow-sm h-100"><div class="card-body bg-body-secondary bg-opacity-10"><div class="d-flex justify-content-between align-items-center gap-2 mb-3"><div><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Current Users</p> <h2 class="h4 mb-0">Accounts</h2></div> <div class="d-flex align-items-center gap-2"><input class="form-control form-control-sm" type="search" placeholder="Filter users"${attr("value", userFilter)} style="max-width: 180px;"/> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", loadingUsers, true)}>${escape_html(loadingUsers ? "Refreshing..." : "Refresh")}</button></div></div> `);
    if (userError) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="alert alert-danger py-2">${escape_html(userError)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Username</th><th>Role</th><th>Status</th><th class="text-end">Actions</th></tr></thead><tbody><!--[-->`);
    const each_array_1 = ensure_array_like(filteredUsers);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let user = each_array_1[$$index_1];
      $$renderer2.push(`<tr><td><div class="d-flex align-items-center gap-2 justify-content-start"><span>${escape_html(user.username)}</span> `);
      if (user.username === store_get($$store_subs ??= {}, "$auth", auth).username) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="badge text-bg-primary">You</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></td><td><span${attr_class(`badge ${user.is_admin ? "text-bg-dark" : "text-bg-secondary"}`, "svelte-g40i6i")}>${escape_html(user.is_admin ? "Admin" : "User")}</span></td><td><span${attr_class(`badge ${user.is_active ? "text-bg-success" : "text-bg-warning"}`, "svelte-g40i6i")}>${escape_html(user.is_active ? "Active" : "Disabled")}</span></td><td class="text-end"><div class="d-flex justify-content-end gap-2 flex-wrap">`);
      if (store_get($$store_subs ??= {}, "$auth", auth).is_admin) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", user.username === store_get($$store_subs ??= {}, "$auth", auth).username, true)}>${escape_html(user.is_admin ? "Remove Admin" : "Make Admin")}</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", user.username === store_get($$store_subs ??= {}, "$auth", auth).username, true)}>${escape_html(user.is_active ? "Disable" : "Enable")}</button> <button class="btn btn-outline-primary btn-sm" type="button"${attr("disabled", savingUser, true)}>Reset Password</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></td></tr>`);
    }
    $$renderer2.push(`<!--]-->`);
    if (!filteredUsers.length) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<tr><td colspan="4" class="text-body-secondary">No user accounts found.</td></tr>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></tbody></table></div></div></div></div></div> `);
    if (store_get($$store_subs ??= {}, "$auth", auth).is_admin) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="row g-3 mt-1"><div class="col-12 col-xl-5"><div class="card shadow-sm h-100"><div class="card-body bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Access</p> <h2 class="h4">User Accounts</h2> <p class="text-body-secondary">Create and manage accounts for internal users.</p> <form class="vstack gap-3"><div><label class="form-label" for="new-user-username">Username</label> <input id="new-user-username" class="form-control"${attr("value", newUsername)}/></div> <div><label class="form-label" for="new-user-password">Password</label> <input id="new-user-password" class="form-control" type="password"${attr("value", newPassword)}/></div> <div class="form-check"><input id="new-user-admin" class="form-check-input" type="checkbox"${attr("checked", newIsAdmin, true)}/> <label class="form-check-label" for="new-user-admin">Admin access</label></div> <button class="btn btn-primary align-self-start" type="submit"${attr("disabled", !newUsername, true)}>${escape_html("Create User")}</button></form></div></div></div> <div class="col-12 col-xl-7"><div class="card shadow-sm h-100"><div class="card-body bg-body-secondary bg-opacity-10"><p class="small text-uppercase text-body-secondary fw-semibold mb-1">Maintenance</p> <h2 class="h4">Operational Tools</h2> <p class="text-body-secondary">Run special admin-only tasks that are otherwise only exposed through the API.</p> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="card border mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><h3 class="h6 mb-1">Backups</h3> <p class="mb-2 text-body-secondary">Download a full backup ZIP of the deployed data, or restore one here. The backup bundle includes
                    the app database and media, plus the WordPress database and \`wp-content\`.</p></div> <div class="d-flex gap-2 flex-wrap"><button class="btn btn-primary btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>Download Backup ZIP</button></div></div> <div class="row g-2 align-items-end mt-1"><div class="col-12 col-lg"><label class="form-label form-label-sm" for="backup-restore-file">Restore Backup ZIP</label> <input id="backup-restore-file" class="form-control form-control-sm" type="file" accept=".zip,application/zip"${attr("disabled", maintenanceLoading, true)}/></div> <div class="col-12 col-lg-auto"><button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", true, true)}>Restore Backup ZIP</button></div></div></div></div> <div class="card border mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><h3 class="h6 mb-1">Product Graph Images</h3> <p class="mb-0 text-body-secondary">Generate all product graph images in one pass, or clear them so they can be regenerated later.</p></div> <div class="d-flex gap-2 flex-wrap"><button class="btn btn-primary btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>Generate Product Graphs</button> <button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>Clear Graph Images</button></div></div></div></div> <div class="card border mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><h3 class="h6 mb-1">Product PDFs</h3> <p class="mb-0 text-body-secondary">Generate or re-generate all product PDFs in one pass using the current product templates and graph data.</p></div> <div class="d-flex gap-2 flex-wrap"><button class="btn btn-primary btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>Regenerate Product PDFs</button></div></div></div></div> <div class="card border"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2"><div><h3 class="h6 mb-1">Type Presets</h3> <p class="mb-0 text-body-secondary">Edit the grouped specification presets, RPM line presets, and efficiency/permissible presets that
                    flow into the product editor.</p></div> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", loadingProductTypes, true)}>${escape_html(loadingProductTypes ? "Refreshing..." : "Reload types")}</button></div> `);
      if (typePresetError) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="alert alert-danger py-2">${escape_html(typePresetError)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="row g-3 align-items-end"><div class="col-12 col-md-6 col-lg-4"><label class="form-label" for="type-preset-select">Product type</label> `);
      $$renderer2.select(
        {
          class: "form-select",
          id: "type-preset-select",
          value: selectedProductTypeId
        },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`-- Choose option --`);
          });
          $$renderer3.push(`<!--[-->`);
          const each_array_2 = ensure_array_like(productTypes);
          for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
            let productType = each_array_2[$$index_2];
            $$renderer3.option({ value: productType.id }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(productType.label)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      );
      $$renderer2.push(`</div> <div class="col-12 col-md-auto"><button class="btn btn-outline-primary" type="button"${attr("disabled", !selectedProductTypeId, true)}>Add Group</button></div> <div class="col-12 col-md-auto"><button class="btn btn-outline-secondary" type="button"${attr("disabled", !selectedProductTypeId, true)}>Reset from saved</button></div> <div class="col-12 col-md-auto"><button class="btn btn-primary" type="button"${attr("disabled", !selectedProductTypeId, true)}>${escape_html("Save Presets")}</button></div></div> `);
      if (selectedProductTypeId) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="mt-3"><div class="row g-3 align-items-end mb-4"><div class="col-12 col-lg-6"><label class="form-label" for="type-preset-printed-product-template">Default printed PDF template</label> `);
        $$renderer2.select(
          {
            class: "form-select",
            id: "type-preset-printed-product-template",
            value: presetPrintedProductTemplateId
          },
          ($$renderer3) => {
            $$renderer3.option({ value: "" }, ($$renderer4) => {
              $$renderer4.push(`-- Choose option --`);
            });
            $$renderer3.push(`<!--[-->`);
            const each_array_3 = ensure_array_like(productTemplates());
            for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
              let template = each_array_3[$$index_3];
              $$renderer3.option({ value: template.id }, ($$renderer4) => {
                $$renderer4.push(`${escape_html(template.label)}`);
              });
            }
            $$renderer3.push(`<!--]-->`);
          }
        );
        $$renderer2.push(`</div> <div class="col-12 col-lg-6"><label class="form-label" for="type-preset-online-product-template">Default online PDF template</label> `);
        $$renderer2.select(
          {
            class: "form-select",
            id: "type-preset-online-product-template",
            value: presetOnlineProductTemplateId
          },
          ($$renderer3) => {
            $$renderer3.option({ value: "" }, ($$renderer4) => {
              $$renderer4.push(`-- Choose option --`);
            });
            $$renderer3.push(`<!--[-->`);
            const each_array_4 = ensure_array_like(productTemplates());
            for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
              let template = each_array_4[$$index_4];
              $$renderer3.option({ value: template.id }, ($$renderer4) => {
                $$renderer4.push(`${escape_html(template.label)}`);
              });
            }
            $$renderer3.push(`<!--]-->`);
          }
        );
        $$renderer2.push(`</div> <div class="col-12"><p class="text-body-secondary mb-0">Band graph style defaults</p></div> <div class="col-12 col-md-4"><label class="form-label" for="type-preset-band-graph-background">Background colour</label> <div class="input-group"><input class="form-control form-control-color" id="type-preset-band-graph-background" type="color"${attr("value", presetBandGraphStyle.band_graph_background_color)}/> <input class="form-control" type="text"${attr("value", presetBandGraphStyle.band_graph_background_color)} placeholder="#ffffff"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="type-preset-band-graph-label">Label text colour</label> <div class="input-group"><input class="form-control form-control-color" id="type-preset-band-graph-label" type="color"${attr("value", presetBandGraphStyle.band_graph_label_text_color)}/> <input class="form-control" type="text"${attr("value", presetBandGraphStyle.band_graph_label_text_color)} placeholder="#000000"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="type-preset-band-graph-permissible">Permissible label colour</label> <div class="input-group"><input class="form-control form-control-color" id="type-preset-band-graph-permissible" type="color"${attr("value", presetBandGraphStyle.band_graph_permissible_label_color)}/> <input class="form-control" type="text"${attr("value", presetBandGraphStyle.band_graph_permissible_label_color)} placeholder="#000000"/></div></div> <div class="col-12 col-md-4"><label class="form-label" for="type-preset-band-graph-opacity">Faded area opacity</label> <input class="form-control" id="type-preset-band-graph-opacity" type="number" min="0" max="1" step="0.01"${attr("value", presetBandGraphStyle.band_graph_faded_opacity)}/></div></div> `);
        if (presetGroups.length) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="vstack gap-3"><!--[-->`);
          const each_array_5 = ensure_array_like(presetGroups);
          for (let groupIndex = 0, $$length = each_array_5.length; groupIndex < $$length; groupIndex++) {
            let group = each_array_5[groupIndex];
            $$renderer2.push(`<div${attr_class(
              `border rounded p-3 ${group._pending_delete ? "bg-danger-subtle border-danger-subtle opacity-75" : ""}`,
              "svelte-g40i6i"
            )}><div class="d-flex flex-wrap gap-2 align-items-center mb-3"><input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name"${attr("value", group.group_name)}/> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", groupIndex === 0, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", groupIndex === presetGroups.length - 1, true)}>Down</button> <button${attr_class(`btn btn-sm ${group._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-g40i6i")} type="button">${escape_html(group._pending_delete ? "Undo Delete" : "Delete Group")}</button> <button class="btn btn-outline-primary btn-sm" type="button"${attr("disabled", group._pending_delete, true)}>Add Parameter</button></div> `);
            if (group._pending_delete) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<p class="small text-danger-emphasis mb-2">This group is marked for deletion. Save Presets to apply the deletion.</p>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--> <div class="vstack gap-2"><!--[-->`);
            const each_array_6 = ensure_array_like(group.parameters);
            for (let parameterIndex = 0, $$length2 = each_array_6.length; parameterIndex < $$length2; parameterIndex++) {
              let parameter = each_array_6[parameterIndex];
              $$renderer2.push(`<div${attr_class(
                `border rounded p-3 bg-body-tertiary ${parameter._pending_delete ? "border-danger-subtle bg-danger-subtle opacity-75" : ""}`,
                "svelte-g40i6i"
              )}><div class="row g-3 align-items-end"><div class="col-12 col-lg-3"><label class="form-label"${attr("for", `type-preset-${groupIndex}-parameter-${parameterIndex}-name`)}>Parameter name</label> <input class="form-control"${attr("id", `type-preset-${groupIndex}-parameter-${parameterIndex}-name`)} type="text"${attr("value", parameter.parameter_name)}/></div> <div class="col-12 col-lg-2"><label class="form-label"${attr("for", `type-preset-${groupIndex}-parameter-${parameterIndex}-value-type`)}>Value type</label> `);
              $$renderer2.select(
                {
                  class: "form-select",
                  id: `type-preset-${groupIndex}-parameter-${parameterIndex}-value-type`,
                  value: parameter.value_type
                },
                ($$renderer3) => {
                  $$renderer3.option({ value: "string" }, ($$renderer4) => {
                    $$renderer4.push(`Text`);
                  });
                  $$renderer3.option({ value: "number" }, ($$renderer4) => {
                    $$renderer4.push(`Number`);
                  });
                }
              );
              $$renderer2.push(`</div> `);
              if (parameter.value_type === "string") {
                $$renderer2.push("<!--[0-->");
                $$renderer2.push(`<div class="col-12 col-lg-5"><label class="form-label"${attr("for", `type-preset-${groupIndex}-parameter-${parameterIndex}-text`)}>Text value</label> <input class="form-control"${attr("id", `type-preset-${groupIndex}-parameter-${parameterIndex}-text`)} type="text"${attr("value", parameter.value_string)}/></div>`);
              } else {
                $$renderer2.push("<!--[-1-->");
                $$renderer2.push(`<div class="col-12 col-lg-2"><label class="form-label"${attr("for", `type-preset-${groupIndex}-parameter-${parameterIndex}-number`)}>Numeric value</label> <input class="form-control"${attr("id", `type-preset-${groupIndex}-parameter-${parameterIndex}-number`)} type="number" step="any"${attr("value", parameter.value_number)}/></div> <div class="col-12 col-lg-3"><label class="form-label"${attr("for", `type-preset-${groupIndex}-parameter-${parameterIndex}-unit`)}>Unit</label> `);
                $$renderer2.select(
                  {
                    class: "form-select",
                    id: `type-preset-${groupIndex}-parameter-${parameterIndex}-unit`,
                    value: parameter.preferred_unit
                  },
                  ($$renderer3) => {
                    $$renderer3.option({ value: "" }, ($$renderer4) => {
                      $$renderer4.push(`No unit`);
                    });
                    $$renderer3.push(`<!--[-->`);
                    const each_array_7 = ensure_array_like(GLOBAL_UNIT_OPTIONS);
                    for (let $$index_5 = 0, $$length3 = each_array_7.length; $$index_5 < $$length3; $$index_5++) {
                      let unitOption = each_array_7[$$index_5];
                      $$renderer3.option({ value: unitOption }, ($$renderer4) => {
                        $$renderer4.push(`${escape_html(unitOption)}`);
                      });
                    }
                    $$renderer3.push(`<!--]-->`);
                    $$renderer3.option({ value: "__custom__" }, ($$renderer4) => {
                      $$renderer4.push(`Custom...`);
                    });
                  }
                );
                $$renderer2.push(`</div> `);
                if (parameter.preferred_unit === "__custom__") {
                  $$renderer2.push("<!--[0-->");
                  $$renderer2.push(`<div class="col-12 col-lg-2"><label class="form-label"${attr("for", `type-preset-${groupIndex}-parameter-${parameterIndex}-custom-unit`)}>Custom unit</label> <input class="form-control"${attr("id", `type-preset-${groupIndex}-parameter-${parameterIndex}-custom-unit`)} type="text"${attr("value", parameter.custom_unit)}/></div>`);
                } else {
                  $$renderer2.push("<!--[-1-->");
                }
                $$renderer2.push(`<!--]-->`);
              }
              $$renderer2.push(`<!--]--> <div class="col-12 col-lg-2"><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", group._pending_delete || parameter._pending_delete || parameterIndex === 0, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", group._pending_delete || parameter._pending_delete || parameterIndex === group.parameters.length - 1, true)}>Down</button> <button${attr_class(`btn btn-sm ${parameter._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-g40i6i")} type="button"${attr("disabled", group._pending_delete, true)}>${escape_html(parameter._pending_delete ? "Undo Delete" : "Delete")}</button></div></div></div></div>`);
            }
            $$renderer2.push(`<!--]--></div></div>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No preset groups yet. Add a group to start defining the type preset.</p>`);
        }
        $$renderer2.push(`<!--]--> <div class="mt-4"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><h4 class="h6 mb-0">RPM line presets</h4> <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-primary btn-sm" type="button">Add RPM Line</button> <button class="btn btn-outline-secondary btn-sm" type="button">Reset RPM lines</button></div></div> `);
        if (presetRpmLines.length) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="vstack gap-3"><!--[-->`);
          const each_array_8 = ensure_array_like(presetRpmLines);
          for (let lineIndex = 0, $$length = each_array_8.length; lineIndex < $$length; lineIndex++) {
            let line = each_array_8[lineIndex];
            $$renderer2.push(`<div${attr_class(
              `border rounded p-3 ${line._pending_delete ? "bg-danger-subtle border-danger-subtle opacity-75" : ""}`,
              "svelte-g40i6i"
            )}><div class="row g-3 align-items-end"><div class="col-12 col-md-3"><label class="form-label"${attr("for", `type-preset-rpm-line-${lineIndex}-rpm`)}>RPM</label> <input class="form-control"${attr("id", `type-preset-rpm-line-${lineIndex}-rpm`)} type="number" step="any"${attr("value", line.rpm)}/></div> <div class="col-12 col-md-5"><label class="form-label"${attr("for", `type-preset-rpm-line-${lineIndex}-band-color`)}>Band colour</label> <div class="input-group"><input class="form-control form-control-color"${attr("id", `type-preset-rpm-line-${lineIndex}-band-color`)} type="color"${attr("value", line.band_color)}/> <input class="form-control" type="text"${attr("value", line.band_color)} placeholder="#0066e3"/></div></div> <div class="col-12 col-md-4"><div class="d-flex flex-wrap gap-2 justify-content-md-end"><button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", lineIndex === 0, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", lineIndex === presetRpmLines.length - 1, true)}>Down</button> <button${attr_class(`btn btn-sm ${line._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-g40i6i")} type="button">${escape_html(line._pending_delete ? "Undo Delete" : "Delete")}</button> <button class="btn btn-outline-primary btn-sm" type="button"${attr("disabled", line._pending_delete, true)}>Add Point</button></div></div></div> `);
            if (line._pending_delete) {
              $$renderer2.push("<!--[0-->");
              $$renderer2.push(`<p class="small text-danger-emphasis mt-3 mb-0">This RPM line is marked for deletion. Save Presets to apply the deletion.</p>`);
            } else {
              $$renderer2.push("<!--[-1-->");
            }
            $$renderer2.push(`<!--]--> <div class="table-responsive mt-3"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>Airflow</th><th>Pressure</th><th>Actions</th></tr></thead><tbody><!--[-->`);
            const each_array_9 = ensure_array_like(line.points);
            for (let pointIndex = 0, $$length2 = each_array_9.length; pointIndex < $$length2; pointIndex++) {
              let point = each_array_9[pointIndex];
              $$renderer2.push(`<tr${attr_class(clsx(point._pending_delete ? "table-danger" : ""))}><td><input class="form-control form-control-sm" type="number" step="any"${attr("value", point.airflow)}/></td><td><input class="form-control form-control-sm" type="number" step="any"${attr("value", point.pressure)}/></td><td><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", pointIndex === 0 || line._pending_delete || point._pending_delete, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", pointIndex === line.points.length - 1 || line._pending_delete || point._pending_delete, true)}>Down</button> <button${attr_class(`btn btn-sm ${point._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-g40i6i")} type="button"${attr("disabled", line._pending_delete, true)}>${escape_html(point._pending_delete ? "Undo Delete" : "Delete")}</button></div></td></tr>`);
            }
            $$renderer2.push(`<!--]--></tbody></table></div></div>`);
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No RPM line presets yet. Add one to start defining the default graph.</p>`);
        }
        $$renderer2.push(`<!--]--></div> <div class="mt-4"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><h4 class="h6 mb-0">Efficiency / permissible presets</h4> <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-primary btn-sm" type="button">Add Point</button> <button class="btn btn-outline-secondary btn-sm" type="button">Reset points</button></div></div> `);
        if (presetEfficiencyPoints.length) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="table-responsive"><table class="table table-sm align-middle editable-table mb-0"><thead><tr><th>Airflow</th><th>Efficiency Centre</th><th>Efficiency Lower End</th><th>Efficiency Higher End</th><th>Permissible Use</th><th>Actions</th></tr></thead><tbody><!--[-->`);
          const each_array_10 = ensure_array_like(presetEfficiencyPoints);
          for (let pointIndex = 0, $$length = each_array_10.length; pointIndex < $$length; pointIndex++) {
            let point = each_array_10[pointIndex];
            $$renderer2.push(`<tr${attr_class(clsx(point._pending_delete ? "table-danger" : ""))}><td><input class="form-control form-control-sm" type="number" step="any"${attr("value", point.airflow)}/></td><td><input class="form-control form-control-sm" type="number" step="any"${attr("value", point.efficiency_centre)}/></td><td><input class="form-control form-control-sm" type="number" step="any"${attr("value", point.efficiency_lower_end)}/></td><td><input class="form-control form-control-sm" type="number" step="any"${attr("value", point.efficiency_higher_end)}/></td><td><input class="form-control form-control-sm" type="number" step="any"${attr("value", point.permissible_use)}/></td><td><div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", pointIndex === 0 || point._pending_delete, true)}>Up</button> <button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", pointIndex === presetEfficiencyPoints.length - 1 || point._pending_delete, true)}>Down</button> <button${attr_class(`btn btn-sm ${point._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`, "svelte-g40i6i")} type="button">${escape_html(point._pending_delete ? "Undo Delete" : "Delete")}</button></div></td></tr>`);
          }
          $$renderer2.push(`<!--]--></tbody></table></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<p class="text-body-secondary mb-0">No efficiency/permissible presets yet.</p>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<p class="text-body-secondary mt-3 mb-0">Choose a product type to edit its presets.</p>`);
      }
      $$renderer2.push(`<!--]--></div></div></div></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
