import { s as store_get, h as head, d as ensure_array_like, e as escape_html, a as attr, b as attr_class, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import { a as auth } from "../../../chunks/auth.js";
import { j as getUsers, k as getDatabaseMirrorStatus } from "../../../chunks/api.js";
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
    let maintenanceError = "";
    let mirrorStatus = null;
    let successMessages = [];
    function clearSuccessToast() {
      successMessages = [];
    }
    onDestroy(() => {
    });
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
    async function loadMirrorStatus() {
      maintenanceLoading = true;
      maintenanceError = "";
      clearSuccessToast();
      try {
        mirrorStatus = await getDatabaseMirrorStatus();
      } catch (error) {
        maintenanceError = error?.message || "Unable to load maintenance status.";
      } finally {
        maintenanceLoading = false;
      }
    }
    if (store_get($$store_subs ??= {}, "$auth", auth).authenticated && !usersLoaded && !loadingUsers) {
      loadUsers();
    }
    if (store_get($$store_subs ??= {}, "$auth", auth).authenticated && store_get($$store_subs ??= {}, "$auth", auth).is_admin && mirrorStatus == null && !maintenanceLoading) {
      loadMirrorStatus();
    }
    filteredUsers = users.filter((user) => {
      const needle = userFilter.trim().toLowerCase();
      if (!needle) return true;
      return user.username.toLowerCase().includes(needle);
    });
    head("g40i6i", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Setup - Fan Graphs</title>`);
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
      if (maintenanceError) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="alert alert-danger py-2">${escape_html(maintenanceError)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="card border mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><h3 class="h6 mb-1">Postgres Mirror</h3> <p class="mb-2 text-body-secondary">The Postgres mirror is the PostgreSQL copy of the fan data. It is mainly there for the deployed
                    environment, backups, and future migration away from the original source database. Refresh Status
                    checks whether the mirror is enabled and compares record counts. Resync Postgres Mirror copies the
                    current source data back into PostgreSQL.</p> `);
      if (mirrorStatus) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="mb-1 text-body-secondary">${escape_html(mirrorStatus.message)}</p> <p class="mb-0 small text-body-secondary">Mirror enabled: ${escape_html(mirrorStatus.mirror_enabled ? "Yes" : "No")}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<p class="mb-0 text-body-secondary">${escape_html(maintenanceLoading ? "Loading status..." : "Status not loaded yet.")}</p>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-secondary btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>${escape_html(maintenanceLoading ? "Loading..." : "Refresh Status")}</button> <button class="btn btn-primary btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>Resync Postgres Mirror</button></div></div></div></div> <div class="card border mb-3"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><h3 class="h6 mb-1">Backups</h3> <p class="mb-2 text-body-secondary">Download a full backup ZIP of the deployed data, or restore one here. The backup bundle includes
                    the app database and media, plus the WordPress database and \`wp-content\`.</p></div> <div class="d-flex gap-2 flex-wrap"><button class="btn btn-primary btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>Download Backup ZIP</button></div></div> <div class="row g-2 align-items-end mt-1"><div class="col-12 col-lg"><label class="form-label form-label-sm" for="backup-restore-file">Restore Backup ZIP</label> <input id="backup-restore-file" class="form-control form-control-sm" type="file" accept=".zip,application/zip"${attr("disabled", maintenanceLoading, true)}/></div> <div class="col-12 col-lg-auto"><button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", maintenanceLoading || true, true)}>Restore Backup ZIP</button></div></div></div></div> <div class="card border"><div class="card-body"><div class="d-flex justify-content-between align-items-start gap-3 flex-wrap"><div><h3 class="h6 mb-1">Graph Images</h3> <p class="mb-0 text-body-secondary">Rebuild all generated graph images, or clear them so they can be regenerated later.</p></div> <div class="d-flex gap-2 flex-wrap"><button class="btn btn-primary btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>Regenerate Graph Images</button> <button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", maintenanceLoading, true)}>Clear Graph Images</button></div></div></div></div></div></div></div></div>`);
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
