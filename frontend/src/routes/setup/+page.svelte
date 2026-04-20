<script>
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { auth } from '$lib/auth.js';
  import {
    changePassword,
    createUser,
    downloadMaintenanceJobFile,
    getMaintenanceJob,
    getUsers,
    startBackupBundleJob,
    startDeleteAllGraphImagesJob,
    startRegenerateAllGraphImagesJob,
    startRegenerateAllProductPdfsJob,
    startRestoreBackupBundleJob,
    updateUser,
    updateUserPassword
  } from '$lib/api.js';

  let users = [];
  let usersLoaded = false;
  let filteredUsers = [];
  let userFilter = '';
  let userError = '';
  let loadingUsers = false;
  let savingUser = false;

  let currentPassword = '';
  let newOwnPassword = '';
  let ownPasswordError = '';
  let savingOwnPassword = false;

  let newUsername = '';
  let newPassword = '';
  let newIsAdmin = false;
  let maintenanceLoading = false;
  let maintenanceError = '';
  let backupFile = null;
  let maintenanceJob = null;
  let maintenancePollTimeout = null;
  let successMessages = [];
  let successToastKey = 0;
  let successDismissTimeout = null;

  $: maintenanceProgressPercent =
    maintenanceJob?.progress_percent != null
      ? Math.max(0, Math.min(100, Number(maintenanceJob.progress_percent)))
      : null;

  function clearSuccessToast() {
    successMessages = [];
    successToastKey += 1;
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
      successDismissTimeout = null;
    }
  }

  function addSuccess(message) {
    if (!message) return;
    successMessages = [...successMessages, message];
    successToastKey += 1;
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
    }
    successDismissTimeout = setTimeout(() => {
      successMessages = [];
      successDismissTimeout = null;
    }, 3000);
  }

  onMount(() => {
    const session = get(auth);
    if (session.authenticated) {
      loadUsers();
    }
  });

  onDestroy(() => {
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
    }
    if (maintenancePollTimeout) {
      clearTimeout(maintenancePollTimeout);
    }
  });

  $: if ($auth.authenticated && !usersLoaded && !loadingUsers) {
    loadUsers();
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
    clearSuccessToast();
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        is_admin: newIsAdmin
      });
      newUsername = '';
      newPassword = '';
      newIsAdmin = false;
      addSuccess('User created.');
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
    clearSuccessToast();
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      addSuccess('User updated.');
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
    clearSuccessToast();
    try {
      await updateUser(user.id, { is_admin: !user.is_admin });
      addSuccess('User updated.');
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
    clearSuccessToast();
    try {
      await updateUserPassword(user.id, password);
      addSuccess(`Password updated for ${user.username}.`);
    } catch (error) {
      userError = error?.message || 'Unable to update password.';
    } finally {
      savingUser = false;
    }
  }

  async function submitOwnPasswordChange() {
    savingOwnPassword = true;
    ownPasswordError = '';
    clearSuccessToast();
    try {
      await changePassword(currentPassword, newOwnPassword);
      currentPassword = '';
      newOwnPassword = '';
      addSuccess('Password updated.');
    } catch (error) {
      ownPasswordError = error?.message || 'Unable to update password.';
    } finally {
      savingOwnPassword = false;
    }
  }

  async function pollMaintenanceJob(jobId, options = {}) {
    try {
      const job = await getMaintenanceJob(jobId);
      maintenanceJob = job;

      if (job.status === 'completed') {
        maintenanceLoading = false;
        if (job.result_download_url && options.downloadOnComplete) {
          const { blob, filename } = await downloadMaintenanceJobFile(job.id);
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(downloadUrl);
        }
        addSuccess(job.result_message || options.successMessage || 'Maintenance task completed.');
        return;
      }

      if (job.status === 'failed') {
        maintenanceLoading = false;
        maintenanceError = job.error || options.errorMessage || 'Maintenance task failed.';
        return;
      }

      maintenancePollTimeout = setTimeout(() => pollMaintenanceJob(jobId, options), 1500);
    } catch (error) {
      maintenanceLoading = false;
      maintenanceError = error?.message || options.errorMessage || 'Unable to read maintenance job status.';
    }
  }

  async function runMaintenanceJob(starter, options = {}) {
    if (options.confirmMessage && !window.confirm(options.confirmMessage)) {
      return;
    }

    maintenanceLoading = true;
    maintenanceError = '';
    maintenanceJob = null;
    clearSuccessToast();
    try {
      const job = await starter();
      maintenanceJob = job;
      await pollMaintenanceJob(job.id, options);
    } catch (error) {
      maintenanceError = error?.message || options.errorMessage || 'Unable to run maintenance task.';
      maintenanceLoading = false;
    } finally {
      if (!maintenanceLoading && maintenancePollTimeout) {
        clearTimeout(maintenancePollTimeout);
        maintenancePollTimeout = null;
      }
    }
  }

  async function handleBackupDownload() {
    await runMaintenanceJob(startBackupBundleJob, {
      successMessage: 'Backup bundle created.',
      errorMessage: 'Unable to create backup bundle.',
      downloadOnComplete: true
    });
  }

  function handleBackupFileChange(event) {
    backupFile = event.currentTarget?.files?.[0] || null;
  }

  async function handleBackupRestore() {
    if (!backupFile) {
      maintenanceError = 'Choose a backup ZIP file first.';
      clearSuccessToast();
      return;
    }

    const confirmed = window.confirm(
      'Restore this backup bundle? This will overwrite the current database and WordPress content with the uploaded backup.'
    );
    if (!confirmed) {
      return;
    }

    const fileToRestore = backupFile;
    await runMaintenanceJob(() => startRestoreBackupBundleJob(fileToRestore), {
      successMessage: 'Backup bundle restored successfully.',
      errorMessage: 'Unable to restore backup bundle.'
    });
    if (!maintenanceError) {
      backupFile = null;
      const input = document.getElementById('backup-restore-file');
      if (input) {
        input.value = '';
      }
    }
  }

  $: filteredUsers = users.filter((user) => {
    const needle = userFilter.trim().toLowerCase();
    if (!needle) return true;
    return user.username.toLowerCase().includes(needle);
  });
</script>

<svelte:head>
  <title>Setup - Internal Facing</title>
</svelte:head>

{#if successMessages.length}
  <div class="success-toast shadow-lg" role="status" aria-live="polite" aria-atomic="true">
    <div class="alert alert-success mb-0 success-toast-alert">
      {#each successMessages as message}
        <div>{message}</div>
      {/each}
      {#key successToastKey}
        <div class="success-toast-progress"></div>
      {/key}
    </div>
  </div>
{/if}

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
          {#if maintenanceJob}
            <div class="alert alert-secondary py-2">
              <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
                <div class="fw-semibold">Maintenance job: {maintenanceJob.job_type}</div>
                <span class={`badge ${maintenanceJob.status === 'completed' ? 'text-bg-success' : maintenanceJob.status === 'failed' ? 'text-bg-danger' : 'text-bg-secondary'}`}>
                  {maintenanceJob.status}
                </span>
              </div>
              {#if maintenanceJob.progress_message}
                <div class="small mb-2">{maintenanceJob.progress_message}</div>
              {/if}
              <div
                class="progress"
                role="progressbar"
                aria-label="Maintenance progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={maintenanceProgressPercent ?? undefined}
              >
                <div
                  class={`progress-bar ${maintenanceProgressPercent == null && maintenanceJob.status === 'running' ? 'progress-bar-striped progress-bar-animated' : ''}`}
                  style={`width: ${maintenanceProgressPercent ?? (maintenanceJob.status === 'completed' ? 100 : 100)}%`}
                >
                  {#if maintenanceProgressPercent != null}
                    {maintenanceProgressPercent.toFixed(0)}%
                  {:else if maintenanceJob.status === 'running'}
                    Working...
                  {/if}
                </div>
              </div>
              {#if maintenanceJob.progress_current != null && maintenanceJob.progress_total != null}
                <div class="small text-body-secondary mt-2">
                  Step {maintenanceJob.progress_current} of {maintenanceJob.progress_total}
                </div>
              {/if}
            </div>
          {/if}
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
                  <h3 class="h6 mb-1">Product Graph Images</h3>
                  <p class="mb-0 text-body-secondary">
                    Generate all product graph images in one pass, or clear them so they can be regenerated later.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenanceJob(startRegenerateAllGraphImagesJob, { successMessage: 'Graph images regenerated.' })}
                    disabled={maintenanceLoading}
                  >
                    Generate Product Graphs
                  </button>
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    on:click={() =>
                      runMaintenanceJob(startDeleteAllGraphImagesJob, {
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

          <div class="card border">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Product PDFs</h3>
                  <p class="mb-0 text-body-secondary">
                    Generate or re-generate all product PDFs in one pass using the current product templates and graph data.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenanceJob(startRegenerateAllProductPdfsJob, { successMessage: 'Product PDFs regenerated.' })}
                    disabled={maintenanceLoading}
                  >
                    Regenerate Product PDFs
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

<style>
  .success-toast {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    width: min(42rem, calc(100vw - 2rem));
    z-index: 1080;
    pointer-events: none;
  }

  .success-toast-alert {
    position: relative;
    overflow: hidden;
    padding-bottom: 1rem;
  }

  .success-toast-progress {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 0.25rem;
    background: rgba(25, 135, 84, 0.55);
    transform-origin: left center;
    animation: success-toast-countdown 3s linear forwards;
  }

  @keyframes success-toast-countdown {
    from {
      transform: scaleX(1);
    }

    to {
      transform: scaleX(0);
    }
  }
</style>
