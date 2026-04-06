<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { auth } from '$lib/auth.js';
  import { changePassword, createUser, getUsers, updateUser, updateUserPassword } from '$lib/api.js';

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

  onMount(() => {
    const session = get(auth);
    if (session.authenticated) {
      loadUsers();
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
  </div>
{/if}
