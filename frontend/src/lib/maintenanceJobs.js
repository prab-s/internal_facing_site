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
