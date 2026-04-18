<script>
  import 'bootstrap/dist/css/bootstrap.min.css';
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.js';
  import { initTheme, theme, toggleTheme } from '$lib/config.js';

  let username = '';
  let password = '';

  onMount(() => {
    initTheme();
    auth.refresh();
  });

  function isActive(path) {
    if (path === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(path);
  }

  async function submitLogin() {
    const ok = await auth.login(username, password);
    if (ok) {
      username = '';
      password = '';
    }
  }
</script>

<div class="app-shell">
  {#if !$auth.ready}
    <main class="app-frame py-5">
      <div class="d-flex justify-content-center">
        <div class="card shadow-sm" style="max-width: 420px; width: 100%;">
          <div class="card-body p-4 text-center">
            <h1 class="h4 mb-2">Internal Facing</h1>
            <p class="text-body-secondary mb-0">Checking your session...</p>
          </div>
        </div>
      </div>
    </main>
  {:else if !$auth.authenticated}
    <main class="app-frame py-5">
      <div class="d-flex justify-content-center">
        <div class="card shadow-sm" style="max-width: 420px; width: 100%;">
          <div class="card-body p-4">
            <div class="text-center mb-4">
              <h1 class="h4 mb-2">Internal Facing</h1>
              <p class="text-body-secondary mb-0">Enter the application password to continue.</p>
            </div>

            <form on:submit|preventDefault={submitLogin} class="vstack gap-3">
              <div>
                <label class="form-label" for="app-username">Username</label>
                <input
                  id="app-username"
                  class="form-control"
                  type="text"
                  bind:value={username}
                  autocomplete="username"
                />
              </div>

              <div>
                <label class="form-label" for="app-password">Password</label>
                <input
                  id="app-password"
                  class="form-control"
                  type="password"
                  bind:value={password}
                  autocomplete="current-password"
                />
              </div>

              {#if $auth.error}
                <div class="alert alert-danger py-2 mb-0">{$auth.error}</div>
              {/if}

              <div class="d-flex justify-content-between align-items-center gap-2">
                <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => toggleTheme($theme)}>
                  {$theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                </button>
                <button class="btn btn-primary" type="submit" disabled={$auth.busy || !username || !password}>
                  {$auth.busy ? 'Signing In...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  {:else}
    <header class="topbar navbar navbar-expand-lg">
      <div class="container-fluid app-frame px-0 d-flex align-items-center gap-3 flex-wrap justify-content-center">
        <div class="topbar-brand navbar-brand mb-0 text-center text-lg-start">
          <div>
            <p class="small text-uppercase text-body-secondary fw-semibold mb-1"><strong>Internal Facing</strong></p>
          </div>
          <span class="small text-body-secondary">{#if isActive('/entry')}Data Entry{:else if isActive('/catalogue')}Catalogue{:else if isActive('/map')}Graph View{:else if isActive('/setup')}Setup{:else}Overview{/if}</span>
        </div>

        <nav class="nav nav-underline justify-content-center mx-auto" aria-label="Primary">
          <a class={`nav-link ${isActive('/') ? 'active text-body fw-medium' : 'text-body-secondary'}`} href="/">Home</a>
          <a class={`nav-link ${isActive('/entry') ? 'active text-body fw-medium' : 'text-body-secondary'}`} href="/entry">Data Entry</a>
          <a class={`nav-link ${isActive('/catalogue') ? 'active text-body fw-medium' : 'text-body-secondary'}`} href="/catalogue">Catalogue</a>
          <a class={`nav-link ${isActive('/map') ? 'active text-body fw-medium' : 'text-body-secondary'}`} href="/map">Graph View</a>
          <a class={`nav-link ${isActive('/setup') ? 'active text-body fw-medium' : 'text-body-secondary'}`} href="/setup">Setup</a>
        </nav>

        <div class="d-flex align-items-center gap-2">
          <span class="small text-body-secondary d-none d-lg-inline">Signed in as {$auth.username}</span>
          <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => toggleTheme($theme)}>
            {$theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => auth.logout()}>
            Sign Out
          </button>
        </div>
      </div>
    </header>

    <main class="app-frame py-3">
      <slot />
    </main>
  {/if}
</div>
