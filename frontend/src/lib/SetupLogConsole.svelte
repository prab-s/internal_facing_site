<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { getSetupLogsStreamUrl } from '$lib/api.js';

  const MAX_LINES = 250;

  let stream = null;
  let streamStatus = 'connecting';
  let streamError = '';
  let lines = [];
  let scroller = null;
  let stickToBottom = true;

  function scrollToBottom() {
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }

  async function appendLine(entry) {
    lines = [...lines, entry].slice(-MAX_LINES);
    if (stickToBottom) {
      await tick();
      scrollToBottom();
    }
  }

  function handleScroll() {
    if (!scroller) return;
    const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    stickToBottom = gap < 32;
  }

  function levelClass(level) {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'error' || normalized === 'critical') return 'text-danger';
    if (normalized === 'warning' || normalized === 'warn') return 'text-warning';
    if (normalized === 'debug') return 'text-info';
    return 'text-body-secondary';
  }

  onMount(() => {
    streamStatus = 'connecting';
    streamError = '';
    stream = new EventSource(getSetupLogsStreamUrl());

    stream.addEventListener('log', async (event) => {
      const payload = JSON.parse(event.data);
      streamStatus = 'live';
      streamError = '';
      await appendLine(payload);
    });

    stream.onopen = () => {
      streamStatus = 'live';
      streamError = '';
    };

    stream.onerror = () => {
      if (stream?.readyState === EventSource.CLOSED) {
        streamStatus = 'closed';
        streamError = 'The log stream was closed.';
        return;
      }
      streamStatus = 'reconnecting';
    };
  });

  onDestroy(() => {
    if (stream) {
      stream.close();
      stream = null;
    }
  });
</script>

<div class="setup-log-console text-light">
  <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
    <div>
      <p class="small text-uppercase text-light-emphasis fw-semibold mb-1">Live Logs</p>
      <h2 class="h5 mb-0">Site terminal output</h2>
    </div>
    <span class={`badge ${streamStatus === 'live' ? 'text-bg-success' : streamStatus === 'reconnecting' ? 'text-bg-warning' : 'text-bg-secondary'}`}>
      {streamStatus}
    </span>
  </div>

  <p class="text-light-emphasis small mb-2">
    {#if streamStatus === 'live'}
      Connected while this panel is open.
    {:else if streamStatus === 'reconnecting'}
      Reconnecting...
    {:else if streamStatus === 'closed'}
      Disconnected.
    {:else}
      Connecting...
    {/if}
  </p>

  {#if streamError}
    <div class="alert alert-warning py-2 mb-3">{streamError}</div>
  {/if}

  <div class="terminal-surface" bind:this={scroller} on:scroll={handleScroll}>
    {#if lines.length}
      {#each lines as line (line.id)}
        <div class="terminal-line">
          <span class={`terminal-level ${levelClass(line.level)}`}>[{line.level}]</span>
          <span class="terminal-timestamp">{line.timestamp}</span>
          <span class="terminal-message">{line.message}</span>
        </div>
      {/each}
    {:else}
      <div class="terminal-line terminal-line--empty text-light-emphasis">
        No log entries yet. Open the page and wait for activity.
      </div>
    {/if}
  </div>
</div>

<style>
  .setup-log-console {
    background: linear-gradient(180deg, rgba(17, 24, 39, 0.98), rgba(10, 14, 23, 0.98));
    border-radius: 0.75rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .terminal-surface {
    max-height: 28rem;
    overflow: auto;
    padding: 0.75rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: radial-gradient(circle at top, rgba(59, 130, 246, 0.08), transparent 40%), #05070b;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .terminal-line {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 0.65rem;
    align-items: start;
    padding: 0.1rem 0;
    word-break: break-word;
  }

  .terminal-line--empty {
    display: block;
    padding: 0.5rem 0;
  }

  .terminal-level {
    font-weight: 700;
  }

  .terminal-timestamp {
    color: rgba(226, 232, 240, 0.72);
    white-space: nowrap;
  }

  .terminal-message {
    color: #f8fafc;
  }
</style>
