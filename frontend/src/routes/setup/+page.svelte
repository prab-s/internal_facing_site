<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { auth } from '$lib/auth.js';
  import {
    changePassword,
    createUser,
    deleteAllGraphImages,
    downloadBackupBundle,
    getDatabaseMirrorStatus,
    getUsers,
    regenerateAllGraphImages,
    restoreBackupBundle,
    resyncPostgresMirror,
    updateUser,
    updateUserPassword
  } from '$lib/api.js';

  let users = [];
  let usersLoaded = false;
  let filteredUsers = [];
  let userFilter = '';
  let userError = '';
  let userSuccess = '';
  let loadingUsers = false;
  let savingUser = false;

  let currentPassword = '';
  let newOwnPassword = '';
  let ownPasswordError = '';
  let ownPasswordSuccess = '';
  let savingOwnPassword = false;

  let newUsername = '';
  let newPassword = '';
  let newIsAdmin = false;
  let maintenanceLoading = false;
  let maintenanceError = '';
  let maintenanceSuccess = '';
  let mirrorStatus = null;
  let backupFile = null;

  onMount(() => {
    const session = get(auth);
    if (session.authenticated) {
      loadUsers();
      if (session.is_admin) {
        loadMirrorStatus();
      }
    }
  });

  $: if ($auth.authenticated && !usersLoaded && !loadingUsers) {
    loadUsers();
  }

  $: if ($auth.authenticated && $auth.is_admin && mirrorStatus == null && !maintenanceLoading) {
    loadMirrorStatus();
  }

  async function loadUsers() {
    loadingUsers = true;
    userError = '';
    try {
      users = await getUsers();
      usersLoaded = true;
    } catch (error) {
      userError = error?.message || 'Unable to load users.';
    } finally {
      loadingUsers = false;
    }
  }

  async function submitNewUser() {
    savingUser = true;
    userError = '';
    userSuccess = '';
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        is_admin: newIsAdmin
      });
      newUsername = '';
      newPassword = '';
      newIsAdmin = false;
      userSuccess = 'User created.';
      await loadUsers();
    } catch (error) {
      userError = error?.message || 'Unable to create user.';
    } finally {
      savingUser = false;
    }
  }

  async function toggleUserActive(user) {
    const actionLabel = user.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.username}?`)) {
      return;
    }
    savingUser = true;
    userError = '';
    userSuccess = '';
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      userSuccess = 'User updated.';
      await loadUsers();
    } catch (error) {
      userError = error?.message || 'Unable to update user.';
    } finally {
      savingUser = false;
    }
  }

  async function toggleUserAdmin(user) {
    const actionLabel = user.is_admin ? 'remove admin access from' : 'grant admin access to';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.username}?`)) {
      return;
    }
    savingUser = true;
    userError = '';
    userSuccess = '';
    try {
      await updateUser(user.id, { is_admin: !user.is_admin });
      userSuccess = 'User updated.';
      await loadUsers();
    } catch (error) {
      userError = error?.message || 'Unable to update user.';
    } finally {
      savingUser = false;
    }
  }

  async function resetUserPassword(user) {
    const password = window.prompt(`Enter a new password for ${user.username}`);
    if (!password) return;
    savingUser = true;
    userError = '';
    userSuccess = '';
    try {
      await updateUserPassword(user.id, password);
      userSuccess = `Password updated for ${user.username}.`;
    } catch (error) {
      userError = error?.message || 'Unable to update password.';
    } finally {
      savingUser = false;
    }
  }

  async function submitOwnPasswordChange() {
    savingOwnPassword = true;
    ownPasswordError = '';
    ownPasswordSuccess = '';
    try {
      await changePassword(currentPassword, newOwnPassword);
      currentPassword = '';
      newOwnPassword = '';
      ownPasswordSuccess = 'Password updated.';
    } catch (error) {
      ownPasswordError = error?.message || 'Unable to update password.';
    } finally {
      savingOwnPassword = false;
    }
  }

  async function loadMirrorStatus() {
    maintenanceLoading = true;
    maintenanceError = '';
    try {
      mirrorStatus = await getDatabaseMirrorStatus();
    } catch (error) {
      maintenanceError = error?.message || 'Unable to load maintenance status.';
    } finally {
      maintenanceLoading = false;
    }
  }

  async function runMaintenance(action, options = {}) {
    if (options.confirmMessage && !window.confirm(options.confirmMessage)) {
      return;
    }

    maintenanceLoading = true;
    maintenanceError = '';
    maintenanceSuccess = '';
    try {
      const result = await action();
      if (result?.mirror_enabled !== undefined) {
        mirrorStatus = result;
      } else {
        await loadMirrorStatus();
      }
      maintenanceSuccess = result?.message || options.successMessage || 'Maintenance task completed.';
    } catch (error) {
      maintenanceError = error?.message || options.errorMessage || 'Unable to run maintenance task.';
    } finally {
      maintenanceLoading = false;
    }
  }

  async function handleBackupDownload() {
    maintenanceLoading = true;
    maintenanceError = '';
    maintenanceSuccess = '';
    try {
      const { blob, filename } = await downloadBackupBundle();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      maintenanceSuccess = `Backup bundle downloaded as ${filename}.`;
    } catch (error) {
      maintenanceError = error?.message || 'Unable to download backup bundle.';
    } finally {
      maintenanceLoading = false;
    }
  }

  function handleBackupFileChange(event) {
    backupFile = event.currentTarget?.files?.[0] || null;
  }

  async function handleBackupRestore() {
    if (!backupFile) {
      maintenanceError = 'Choose a backup ZIP file first.';
      maintenanceSuccess = '';
      return;
    }

    const confirmed = window.confirm(
      'Restore this backup bundle? This will overwrite the current database and WordPress content with the uploaded backup.'
    );
    if (!confirmed) {
      return;
    }

    maintenanceLoading = true;
    maintenanceError = '';
    maintenanceSuccess = '';
    try {
      const result = await restoreBackupBundle(backupFile);
      backupFile = null;
      const input = document.getElementById('backup-restore-file');
      if (input) {
        input.value = '';
      }
      await loadMirrorStatus();
      maintenanceSuccess = result?.message || 'Backup bundle restored successfully.';
    } catch (error) {
      maintenanceError = error?.message || 'Unable to restore backup bundle.';
    } finally {
      maintenanceLoading = false;
    }
  }

  $: filteredUsers = users.filter((user) => {
    const needle = userFilter.trim().toLowerCase();
    if (!needle) return true;
    return user.username.toLowerCase().includes(needle);
  });
</script>

<svelte:head>
  <title>Setup - Fan Graphs</title>
</svelte:head>

<div class="mb-3">
  <div class="col-12 col-xxl-8">
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Setup</p>
    <h1 class="h2 mb-2">Account and application setup.</h1>
    <p class="text-body-secondary">
      Manage your own password here. Admins can also create and manage internal user accounts.
    </p>
  </div>
</div>

<div class="row g-3">
  <div class="col-12 col-xl-5">
    <div class="card shadow-sm h-100">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">My Account</p>
        <h2 class="h4">Change Password</h2>
        <p class="text-body-secondary">Signed in as {$auth.username}.</p>

        <form class="vstack gap-3" on:submit|preventDefault={submitOwnPasswordChange}>
          <div>
            <label class="form-label" for="current-password">Current Password</label>
            <input id="current-password" class="form-control" type="password" bind:value={currentPassword} />
          </div>
          <div>
            <label class="form-label" for="new-own-password">New Password</label>
            <input id="new-own-password" class="form-control" type="password" bind:value={newOwnPassword} />
          </div>
          {#if ownPasswordError}
            <div class="alert alert-danger py-2 mb-0">{ownPasswordError}</div>
          {/if}
          {#if ownPasswordSuccess}
            <div class="alert alert-success py-2 mb-0">{ownPasswordSuccess}</div>
          {/if}
          <button class="btn btn-primary align-self-start" type="submit" disabled={savingOwnPassword || !currentPassword || !newOwnPassword}>
            {savingOwnPassword ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  </div>

  <div class="col-12 col-xl-7">
    <div class="card shadow-sm h-100">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
          <div>
            <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Current Users</p>
            <h2 class="h4 mb-0">Accounts</h2>
          </div>
          <div class="d-flex align-items-center gap-2">
            <input
              class="form-control form-control-sm"
              type="search"
              placeholder="Filter users"
              bind:value={userFilter}
              style="max-width: 180px;"
            />
            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={loadUsers} disabled={loadingUsers}>
              {loadingUsers ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {#if userError}
          <div class="alert alert-danger py-2">{userError}</div>
        {/if}
        {#if userSuccess}
          <div class="alert alert-success py-2">{userSuccess}</div>
        {/if}

        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredUsers as user}
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-2 justify-content-start">
                      <span>{user.username}</span>
                      {#if user.username === $auth.username}
                        <span class="badge text-bg-primary">You</span>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <span class={`badge ${user.is_admin ? 'text-bg-dark' : 'text-bg-secondary'}`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span class={`badge ${user.is_active ? 'text-bg-success' : 'text-bg-warning'}`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td class="text-end">
                    <div class="d-flex justify-content-end gap-2 flex-wrap">
                      {#if $auth.is_admin}
                        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => toggleUserAdmin(user)} disabled={savingUser || user.username === $auth.username}>
                          {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => toggleUserActive(user)} disabled={savingUser || user.username === $auth.username}>
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => resetUserPassword(user)} disabled={savingUser}>
                          Reset Password
                        </button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
              {#if !filteredUsers.length}
                <tr>
                  <td colspan="4" class="text-body-secondary">No user accounts found.</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

{#if $auth.is_admin}
  <div class="row g-3 mt-1">
    <div class="col-12 col-xl-5">
      <div class="card shadow-sm h-100">
        <div class="card-body bg-body-secondary bg-opacity-10">
          <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Access</p>
          <h2 class="h4">User Accounts</h2>
          <p class="text-body-secondary">Create and manage accounts for internal users.</p>

          <form class="vstack gap-3" on:submit|preventDefault={submitNewUser}>
            <div>
              <label class="form-label" for="new-user-username">Username</label>
              <input id="new-user-username" class="form-control" bind:value={newUsername} />
            </div>
            <div>
              <label class="form-label" for="new-user-password">Password</label>
              <input id="new-user-password" class="form-control" type="password" bind:value={newPassword} />
            </div>
            <div class="form-check">
              <input id="new-user-admin" class="form-check-input" type="checkbox" bind:checked={newIsAdmin} />
              <label class="form-check-label" for="new-user-admin">Admin access</label>
            </div>
            <button class="btn btn-primary align-self-start" type="submit" disabled={savingUser || !newUsername || !newPassword}>
              {savingUser ? 'Saving...' : 'Create User'}
            </button>
          </form>
        </div>
      </div>
    </div>

    <div class="col-12 col-xl-7">
      <div class="card shadow-sm h-100">
        <div class="card-body bg-body-secondary bg-opacity-10">
          <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Maintenance</p>
          <h2 class="h4">Operational Tools</h2>
          <p class="text-body-secondary">
            Run special admin-only tasks that are otherwise only exposed through the API.
          </p>

          {#if maintenanceError}
            <div class="alert alert-danger py-2">{maintenanceError}</div>
          {/if}
          {#if maintenanceSuccess}
            <div class="alert alert-success py-2">{maintenanceSuccess}</div>
          {/if}

          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Postgres Mirror</h3>
                  <p class="mb-2 text-body-secondary">
                    The Postgres mirror is the PostgreSQL copy of the fan data. It is mainly there for the deployed
                    environment, backups, and future migration away from the original source database. Refresh Status
                    checks whether the mirror is enabled and compares record counts. Resync Postgres Mirror copies the
                    current source data back into PostgreSQL.
                  </p>
                  {#if mirrorStatus}
                    <p class="mb-1 text-body-secondary">{mirrorStatus.message}</p>
                    <p class="mb-0 small text-body-secondary">
                      Mirror enabled: {mirrorStatus.mirror_enabled ? 'Yes' : 'No'}
                    </p>
                  {:else}
                    <p class="mb-0 text-body-secondary">
                      {maintenanceLoading ? 'Loading status...' : 'Status not loaded yet.'}
                    </p>
                  {/if}
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button class="btn btn-outline-secondary btn-sm" type="button" on:click={loadMirrorStatus} disabled={maintenanceLoading}>
                    {maintenanceLoading ? 'Loading...' : 'Refresh Status'}
                  </button>
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenance(resyncPostgresMirror, { successMessage: 'Postgres mirror resynced.' })}
                    disabled={maintenanceLoading}
                  >
                    Resync Postgres Mirror
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Backups</h3>
                  <p class="mb-2 text-body-secondary">
                    Download a full backup ZIP of the deployed data, or restore one here. The backup bundle includes
                    the app database and media, plus the WordPress database and `wp-content`.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={handleBackupDownload}
                    disabled={maintenanceLoading}
                  >
                    Download Backup ZIP
                  </button>
                </div>
              </div>

              <div class="row g-2 align-items-end mt-1">
                <div class="col-12 col-lg">
                  <label class="form-label form-label-sm" for="backup-restore-file">Restore Backup ZIP</label>
                  <input
                    id="backup-restore-file"
                    class="form-control form-control-sm"
                    type="file"
                    accept=".zip,application/zip"
                    on:change={handleBackupFileChange}
                    disabled={maintenanceLoading}
                  />
                </div>
                <div class="col-12 col-lg-auto">
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    on:click={handleBackupRestore}
                    disabled={maintenanceLoading || !backupFile}
                  >
                    Restore Backup ZIP
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="card border">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Graph Images</h3>
                  <p class="mb-0 text-body-secondary">
                    Rebuild all generated graph images, or clear them so they can be regenerated later.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenance(regenerateAllGraphImages, { successMessage: 'Graph images regenerated.' })}
                    disabled={maintenanceLoading}
                  >
                    Regenerate Graph Images
                  </button>
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    on:click={() =>
                      runMaintenance(deleteAllGraphImages, {
                        confirmMessage: 'Delete all generated graph images and clear their saved paths?',
                        successMessage: 'Graph images cleared.'
                      })}
                    disabled={maintenanceLoading}
                  >
                    Clear Graph Images
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
