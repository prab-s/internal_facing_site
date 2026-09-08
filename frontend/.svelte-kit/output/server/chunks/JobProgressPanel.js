import { e as escape_html, c as attr_class, b as attr, f as attr_style, i as bind_props } from "./index2.js";
import { o as onDestroy } from "./index-server.js";
import { p as getMaintenanceJob } from "./api.js";
import { f as fallback } from "./equality.js";
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function maintenanceJobProgressPercent(job) {
  if (job?.status === "completed") return 100;
  if (job?.progress_percent == null) return null;
  const percent = Number(job.progress_percent);
  if (Number.isNaN(percent)) return null;
  return Math.max(0, Math.min(100, percent));
}
function maintenanceJobElapsedMs(job, now = Date.now()) {
  const startedAt = job?.started_at ? Date.parse(job.started_at) : NaN;
  const completedAt = job?.completed_at ? Date.parse(job.completed_at) : NaN;
  if (!Number.isNaN(startedAt)) {
    if (job?.status === "completed" && !Number.isNaN(completedAt)) {
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
function formatMaintenanceDuration(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return "";
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1e3));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
async function runMaintenanceJob(starter, options = {}) {
  const {
    pollIntervalMs = 1200,
    onUpdate = null,
    isCancelled = () => false
  } = options;
  let job = await starter();
  onUpdate?.(job);
  while (!isCancelled()) {
    if (job.status === "completed") {
      return job;
    }
    if (job.status === "failed") {
      const error = new Error(job.error || "Maintenance job failed.");
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
function JobProgressPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let progressPercent, isRunning, isCompleted, isFailed, isPdfRenderHeartbeat, elapsedMs, staleForMs, showsStalled, startedLabel, staleLabel;
    let job = fallback($$props["job"], null);
    let label = fallback($$props["label"], "Generating PDF");
    let showCancel = fallback($$props["showCancel"], false);
    let cancelLoading = fallback($$props["cancelLoading"], false);
    let onCancel = fallback($$props["onCancel"], null);
    let now = Date.now();
    let lastProgressSignature = "";
    let lastProgressChangeAt = Date.now();
    let heartbeat = null;
    function progressSignature(nextJob) {
      return [
        nextJob?.status ?? "",
        nextJob?.progress_message ?? "",
        nextJob?.progress_current ?? "",
        nextJob?.progress_total ?? "",
        nextJob?.progress_percent ?? ""
      ].join("|");
    }
    onDestroy(() => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    });
    progressPercent = maintenanceJobProgressPercent(job);
    isRunning = ["queued", "running"].includes(job?.status);
    isCompleted = job?.status === "completed";
    isFailed = job?.status === "failed";
    isPdfRenderHeartbeat = isRunning && /^Rendering PDF in Chromium \(/.test(job?.progress_message ?? "");
    {
      if (isRunning && !heartbeat) {
        heartbeat = setInterval(
          () => {
            now = Date.now();
          },
          1e3
        );
      } else if (!isRunning && heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    }
    elapsedMs = maintenanceJobElapsedMs(job, now);
    if (job) {
      const nextSignature = progressSignature(job);
      if (nextSignature !== lastProgressSignature) {
        lastProgressSignature = nextSignature;
        lastProgressChangeAt = Date.now();
      }
    }
    staleForMs = isRunning ? now - lastProgressChangeAt : 0;
    showsStalled = isRunning && staleForMs >= 15e3;
    startedLabel = formatMaintenanceDuration(elapsedMs);
    staleLabel = formatMaintenanceDuration(staleForMs);
    if (job) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-3 rounded border bg-body-secondary bg-opacity-10 p-3" aria-live="polite"><div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2"><div class="fw-semibold">${escape_html(label)}</div> <div class="d-flex align-items-center gap-2"><span${attr_class(`badge ${isCompleted ? "text-bg-success" : isFailed || job.status === "cancelled" ? "text-bg-danger" : "text-bg-secondary"}`)}>${escape_html(job.status)}</span> `);
      if (showCancel && isRunning) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", cancelLoading, true)}>${escape_html(cancelLoading ? "Cancelling..." : "Cancel")}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> `);
      if (job.progress_message) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-body-secondary mb-2">${escape_html(job.progress_message)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isCompleted && job.result_message) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-success-emphasis mb-2">${escape_html(job.result_message)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isFailed && job.error) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-danger-emphasis fw-semibold mb-2">Failure reason: ${escape_html(job.error)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (job.status === "cancelled") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-danger-emphasis fw-semibold mb-2">This regeneration attempt was cancelled.</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="progress" role="progressbar"${attr("aria-label", label)} aria-valuemin="0" aria-valuemax="100"${attr("aria-valuenow", progressPercent ?? void 0)}><div${attr_class(`progress-bar ${isRunning && (progressPercent == null || isPdfRenderHeartbeat) ? "progress-bar-striped progress-bar-animated" : ""}`)}${attr_style(`width: ${(isCompleted ? 100 : progressPercent) ?? 100}%`)}>`);
      if (isCompleted || progressPercent != null) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`${escape_html((isCompleted ? 100 : progressPercent).toFixed(0))}%`);
      } else if (isRunning) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`Working...`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> `);
      if (job.progress_current != null && job.progress_total != null) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-body-secondary mt-2">Step ${escape_html(job.progress_current)} of ${escape_html(job.progress_total)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isPdfRenderHeartbeat) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-primary-emphasis mt-2">Active PDF render; the percentage will advance when Chromium completes this phase.</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isRunning && startedLabel) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-body-secondary mt-1">Running for ${escape_html(startedLabel)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isCompleted && startedLabel) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-body-secondary mt-1">Completed in ${escape_html(startedLabel)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isRunning && progressPercent == null && !showsStalled) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-body-secondary mt-1">Still working on this step, please wait...</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (showsStalled) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-warning-emphasis mt-2">No progress change for ${escape_html(staleLabel)}. The job is still running, but it has not reported a new step yet.</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { job, label, showCancel, cancelLoading, onCancel });
  });
}
export {
  JobProgressPanel as J,
  runMaintenanceJob as r
};
