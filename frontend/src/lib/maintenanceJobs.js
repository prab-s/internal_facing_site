import { getMaintenanceJob } from '$lib/api.js';

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function maintenanceJobProgressPercent(job) {
  if (job?.progress_percent == null) return null;
  const percent = Number(job.progress_percent);
  if (Number.isNaN(percent)) return null;
  return Math.max(0, Math.min(100, percent));
}

export function maintenanceJobElapsedMs(job, now = Date.now()) {
  const startedAt = job?.started_at ? Date.parse(job.started_at) : NaN;
  const completedAt = job?.completed_at ? Date.parse(job.completed_at) : NaN;
  if (!Number.isNaN(startedAt)) {
    if (job?.status === 'completed' && !Number.isNaN(completedAt)) {
      return Math.max(0, completedAt - startedAt);
    }
    return Math.max(0, now - startedAt);
  }
  const createdAt = job?.created_at ? Date.parse(job.created_at) : NaN;
  if (!Number.isNaN(createdAt)) {
    return Math.max(0, now - createdAt);
  }
  return null;
}

export function formatMaintenanceDuration(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return '';
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export async function runMaintenanceJob(starter, options = {}) {
  const {
    pollIntervalMs = 1200,
    onUpdate = null,
    isCancelled = () => false
  } = options;

  let job = await starter();
  onUpdate?.(job);

  while (!isCancelled()) {
    if (job.status === 'completed') {
      return job;
    }

    if (job.status === 'failed') {
      const error = new Error(job.error || 'Maintenance job failed.');
      error.job = job;
      throw error;
    }

    await delay(pollIntervalMs);
    if (isCancelled()) {
      return job;
    }

    job = await getMaintenanceJob(job.id);
    onUpdate?.(job);
  }

  return job;
}
