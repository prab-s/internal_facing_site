<script>
  import { onDestroy, onMount } from 'svelte';
  import { getInternalDeviceActivityRecent } from '$lib/api.js';

  const MAX_ENTRIES = 2000;
  const REFRESH_INTERVAL_MS = 30000;

  let loading = false;
  let error = '';
  let rawEntries = [];
  let groups = [];
  let refreshTimer = null;
  let lastUpdatedAt = '';
  let timeWindow = '24h';
  let deviceFilter = 'all';
  let routeFilter = 'all';
  let searchQuery = '';
  let expandedUsers = new Set();
  let expandedDevices = new Set();

  function parseTimestamp(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatTimestamp(value) {
    const parsed = parseTimestamp(value);
    return parsed ? parsed.toLocaleString() : String(value || '—');
  }

  function normalizeDeviceType(value, userAgent = '') {
    const candidate = String(value || '').trim().toLowerCase();
    if (candidate.includes('mobile')) return 'mobile';
    if (candidate.includes('tablet') || candidate.includes('ipad')) return 'tablet';
    if (candidate.includes('desktop')) return 'desktop';
    const ua = String(userAgent || '').toLowerCase();
    if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet';
    if (ua.includes('mobile')) return 'mobile';
    return ua ? 'desktop' : '';
  }

  function summarizeEntry(entry) {
    const payload = entry?.payload || {};
    const telemetry = payload.telemetry || {};
    const userAgent = payload.user_agent || telemetry.user_agent || '';
    return {
      ...entry,
      timestamp: entry.occurred_at || entry.timestamp,
      username: entry.username || payload.username || '',
      route_group: entry.route_group || payload.route_group || payload.page_route_group || 'other',
      path: payload.path || telemetry.page_url || '',
      method: payload.method || '—',
      status: payload.status ?? '—',
      duration_ms: payload.duration_ms ?? '—',
      referer: payload.referer || telemetry.referrer || '',
      user_agent: userAgent,
      device_type: normalizeDeviceType(payload.device_type || telemetry.device_type, userAgent) || '—',
      platform: telemetry.platform || payload.sec_ch_ua_platform || '—',
      screen: telemetry.screen_width && telemetry.screen_height ? `${telemetry.screen_width}x${telemetry.screen_height}` : '—',
      viewport: telemetry.viewport_width && telemetry.viewport_height ? `${telemetry.viewport_width}x${telemetry.viewport_height}` : '—',
      event: entry.event || payload.event || 'request'
    };
  }

  function isWithinWindow(entry, currentTimeWindow = timeWindow) {
    const timestamp = parseTimestamp(entry.timestamp);
    if (!timestamp) return false;
    const ageMs = Date.now() - timestamp.getTime();
    if (currentTimeWindow === '24h') return ageMs <= 24 * 60 * 60 * 1000;
    if (currentTimeWindow === '7d') return ageMs <= 7 * 24 * 60 * 60 * 1000;
    return true;
  }

  function matchesFilters(entry, currentTimeWindow = timeWindow, currentDeviceFilter = deviceFilter, currentRouteFilter = routeFilter, currentSearchQuery = searchQuery) {
    if (!isWithinWindow(entry, currentTimeWindow)) return false;
    if (currentDeviceFilter !== 'all' && entry.device_type !== currentDeviceFilter) return false;
    if (currentRouteFilter !== 'all' && entry.route_group !== currentRouteFilter) return false;
    const needle = currentSearchQuery.trim().toLowerCase();
    if (!needle) return true;
    return [entry.username, entry.path, entry.method, entry.user_agent, entry.platform, entry.route_group, entry.event]
      .filter(Boolean).join(' ').toLowerCase().includes(needle);
  }

  function buildGroups(entries, currentTimeWindow, currentDeviceFilter, currentRouteFilter, currentSearchQuery) {
    const users = new Map();
    for (const rawEntry of entries) {
      const entry = summarizeEntry(rawEntry);
      if (!entry.username || !matchesFilters(entry, currentTimeWindow, currentDeviceFilter, currentRouteFilter, currentSearchQuery)) continue;
      const userKey = entry.username;
      const deviceKey = `${userKey}:${rawEntry.device_fingerprint || entry.user_agent}`;
      let user = users.get(userKey);
      if (!user) {
        user = { key: userKey, username: userKey, eventCount: 0, latestAt: 0, devices: new Map() };
        users.set(userKey, user);
      }
      const seenAt = parseTimestamp(entry.timestamp)?.getTime() || 0;
      user.eventCount += 1;
      user.latestAt = Math.max(user.latestAt, seenAt);
      let device = user.devices.get(deviceKey);
      if (!device) {
        device = { key: deviceKey, eventCount: 0, latestAt: 0, latest: entry, events: [] };
        user.devices.set(deviceKey, device);
      }
      device.eventCount += 1;
      device.latestAt = Math.max(device.latestAt, seenAt);
      if (seenAt >= device.latestAt) device.latest = entry;
      if (device.events.length < 25) device.events.push(entry);
    }
    return Array.from(users.values()).map((user) => ({
      ...user,
      devices: Array.from(user.devices.values()).sort((a, b) => b.latestAt - a.latestAt)
    })).sort((a, b) => b.latestAt - a.latestAt);
  }

  $: groups = buildGroups(rawEntries, timeWindow, deviceFilter, routeFilter, searchQuery);
  $: visibleUserCount = groups.length;
  $: visibleDeviceCount = groups.reduce((total, group) => total + group.devices.length, 0);
  $: totalEventCount = rawEntries.length;

  function toggleUser(key) {
    expandedUsers = new Set(expandedUsers);
    expandedUsers.has(key) ? expandedUsers.delete(key) : expandedUsers.add(key);
  }

  function toggleDevice(key) {
    expandedDevices = new Set(expandedDevices);
    expandedDevices.has(key) ? expandedDevices.delete(key) : expandedDevices.add(key);
  }

  async function loadLogs() {
    loading = true;
    error = '';
    try {
      rawEntries = await getInternalDeviceActivityRecent(MAX_ENTRIES);
      lastUpdatedAt = new Date().toLocaleString();
    } catch (err) {
      error = err?.message || 'Unable to load internal device activity.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadLogs();
    refreshTimer = setInterval(() => void loadLogs(), REFRESH_INTERVAL_MS);
  });

  onDestroy(() => clearInterval(refreshTimer));
</script>

<div class="internal-device-console">
  <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
    <div>
      <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Internal Facing</p>
      <h2 class="h5 mb-0">Activity by User</h2>
      <div class="small text-body-secondary mt-1">
        {visibleUserCount} user{visibleUserCount === 1 ? '' : 's'} · {visibleDeviceCount} device{visibleDeviceCount === 1 ? '' : 's'}
        from {totalEventCount} stored event{totalEventCount === 1 ? '' : 's'}
      </div>
    </div>
    <div class="text-end">
      <div class={`badge ${loading ? 'text-bg-secondary' : 'text-bg-success'}`}>{loading ? 'loading' : 'ready'}</div>
      {#if lastUpdatedAt}<div class="small text-body-secondary mt-1">Updated {lastUpdatedAt}</div>{/if}
    </div>
  </div>

  <p class="text-body-secondary small mb-2">Persistent internal activity, grouped by signed-in user and then device.</p>

  <div class="filters d-flex flex-wrap gap-2 mb-3">
    <label class="form-label small text-body-secondary mb-0 flex-grow-1" style="min-width: 220px;">Search
      <input bind:value={searchQuery} class="form-control form-control-sm mt-1" type="search" placeholder="User, path, user agent..." />
    </label>
    <label class="form-label small text-body-secondary mb-0">Time window
      <select bind:value={timeWindow} class="form-select form-select-sm mt-1"><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="all">All stored</option></select>
    </label>
    <label class="form-label small text-body-secondary mb-0">Device type
      <select bind:value={deviceFilter} class="form-select form-select-sm mt-1"><option value="all">All devices</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option><option value="tablet">Tablet</option></select>
    </label>
    <label class="form-label small text-body-secondary mb-0">Route group
      <select bind:value={routeFilter} class="form-select form-select-sm mt-1"><option value="all">All routes</option><option value="internal-api">Internal API</option><option value="internal-browser-telemetry">Internal telemetry</option><option value="other">Other</option></select>
    </label>
  </div>

  {#if error}<div class="alert alert-warning py-2 mb-3">{error}</div>{/if}

  {#if groups.length}
    <div class="table-responsive"><table class="table table-sm align-middle mb-0">
      <thead><tr><th style="width: 2rem;"></th><th>User</th><th>Last Seen</th><th>Devices</th><th>Events</th></tr></thead>
      <tbody>
        {#each groups as group (group.key)}
          <tr class="user-row" on:click={() => toggleUser(group.key)}>
            <td>{expandedUsers.has(group.key) ? '▾' : '▸'}</td><td class="fw-semibold">{group.username}</td><td>{formatTimestamp(new Date(group.latestAt).toISOString())}</td><td>{group.devices.length}</td><td>{group.eventCount}</td>
          </tr>
          {#if expandedUsers.has(group.key)}
            {#each group.devices as device (device.key)}
              <tr class="device-row" on:click={() => toggleDevice(device.key)}>
                <td></td><td class="ps-4">{expandedDevices.has(device.key) ? '▾' : '▸'} {device.latest.device_type} <span class="text-body-secondary">{device.latest.platform}</span></td><td>{formatTimestamp(device.latest.timestamp)}</td><td>1</td><td>{device.eventCount}</td>
              </tr>
              {#if expandedDevices.has(device.key)}
                <tr><td></td><td colspan="4" class="ps-5">
                  <div class="small mb-2"><strong>User agent:</strong> {device.latest.user_agent || '—'}<br /><strong>Screen:</strong> {device.latest.screen} · <strong>Viewport:</strong> {device.latest.viewport}</div>
                  <div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Time</th><th>Event</th><th>Route</th><th>Request</th></tr></thead><tbody>
                    {#each device.events as event}<tr><td>{formatTimestamp(event.timestamp)}</td><td>{event.event}</td><td>{event.route_group}</td><td class="text-break">{event.method} {event.path || '—'}</td></tr>{/each}
                  </tbody></table></div>
                </td></tr>
              {/if}
            {/each}
          {/if}
        {/each}
      </tbody>
    </table></div>
  {:else}<div class="text-body-secondary">No internal activity matches the current filters yet.</div>{/if}
</div>

<style>
  .internal-device-console { color: var(--bs-body-color); }
  .user-row, .device-row { cursor: pointer; }
  .user-row:hover, .device-row:hover { background: var(--bs-tertiary-bg); }
  .device-row { background: color-mix(in srgb, var(--bs-tertiary-bg) 45%, transparent); }
</style>
