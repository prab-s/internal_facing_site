<script>
  import { onDestroy, onMount } from 'svelte';
  import { formatMaintenanceDuration, maintenanceJobElapsedMs, maintenanceJobProgressPercent } from '$lib/maintenanceJobs.js';

  export let job = null;
  export let label = 'Generating PDF';

  let now = Date.now();
  let lastProgressSignature = '';
  let lastProgressChangeAt = Date.now();
  let heartbeat = null;

  $: progressPercent = maintenanceJobProgressPercent(job);
  $: isRunning = job?.status === 'running';
  $: isCompleted = job?.status === 'completed';
  $: isFailed = job?.status === 'failed';
  $: elapsedMs = maintenanceJobElapsedMs(job, now);

  function progressSignature(nextJob) {
    return [
      nextJob?.status ?? '',
      nextJob?.progress_message ?? '',
      nextJob?.progress_current ?? '',
      nextJob?.progress_total ?? '',
      nextJob?.progress_percent ?? ''
    ].join('|');
  }

  $: if (job) {
    const nextSignature = progressSignature(job);
    if (nextSignature !== lastProgressSignature) {
      lastProgressSignature = nextSignature;
      lastProgressChangeAt = Date.now();
    }
  }

  $: staleForMs = isRunning ? now - lastProgressChangeAt : 0;
  $: showsStalled = isRunning && staleForMs >= 15000;
  $: startedLabel = formatMaintenanceDuration(elapsedMs);
  $: staleLabel = formatMaintenanceDuration(staleForMs);

  onMount(() => {
    heartbeat = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (heartbeat) {
      clearInterval(heartbeat);
    }
  });
</script>

{#if job}
  <div class="mt-3 rounded border bg-body-secondary bg-opacity-10 p-3" aria-live="polite">
    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
      <div class="fw-semibold">{label}</div>
      <span class={`badge ${isCompleted ? 'text-bg-success' : isFailed ? 'text-bg-danger' : 'text-bg-secondary'}`}>
        {job.status}
      </span>
    </div>
    {#if job.progress_message}
      <div class="small text-body-secondary mb-2">{job.progress_message}</div>
    {/if}
    {#if isCompleted && job.result_message}
      <div class="small text-success-emphasis mb-2">{job.result_message}</div>
    {/if}
    {#if isFailed && job.error}
      <div class="small text-danger-emphasis fw-semibold mb-2">Failure reason: {job.error}</div>
    {/if}
    <div
      class="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={progressPercent ?? undefined}
    >
      <div
        class={`progress-bar ${progressPercent == null && isRunning ? 'progress-bar-striped progress-bar-animated' : ''}`}
        style={`width: ${progressPercent ?? (isCompleted ? 100 : 100)}%`}
      >
        {#if progressPercent != null}
          {progressPercent.toFixed(0)}%
        {:else if isRunning}
          Working...
        {/if}
      </div>
    </div>
    {#if job.progress_current != null && job.progress_total != null}
      <div class="small text-body-secondary mt-2">
        Step {job.progress_current} of {job.progress_total}
      </div>
    {/if}
    {#if isRunning && startedLabel}
      <div class="small text-body-secondary mt-1">Running for {startedLabel}</div>
    {/if}
    {#if isCompleted && startedLabel}
      <div class="small text-body-secondary mt-1">Completed in {startedLabel}</div>
    {/if}
    {#if isRunning && progressPercent == null && !showsStalled}
      <div class="small text-body-secondary mt-1">Still working on this step, please wait...</div>
    {/if}
    {#if showsStalled}
      <div class="small text-warning-emphasis mt-2">
        No progress change for {staleLabel}. The job is still running, but it has not reported a new step yet.
      </div>
    {/if}
  </div>
{/if}
