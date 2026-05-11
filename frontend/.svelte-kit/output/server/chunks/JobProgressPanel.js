import { f as fallback, e as escape_html, b as attr_class, a as attr, j as attr_style, d as bind_props } from "./index2.js";
import { o as onDestroy } from "./index-server.js";
function maintenanceJobProgressPercent(job) {
  if (job?.progress_percent == null) return null;
  const percent = Number(job.progress_percent);
  if (Number.isNaN(percent)) return null;
  return Math.max(0, Math.min(100, percent));
}
function JobProgressPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let progressPercent, isRunning, isCompleted, isFailed, staleForMs, showsStalled;
    let job = fallback($$props["job"], null);
    let label = fallback($$props["label"], "Generating PDF");
    let now = Date.now();
    let lastProgressSignature = "";
    let lastProgressChangeAt = Date.now();
    function progressSignature(nextJob) {
      return [
        nextJob?.status ?? "",
        nextJob?.progress_message ?? "",
        nextJob?.progress_current ?? "",
        nextJob?.progress_total ?? "",
        nextJob?.progress_percent ?? ""
      ].join("|");
    }
    function formatElapsed(ms) {
      const seconds = Math.max(0, Math.floor(ms / 1e3));
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      return `${minutes}m ${remainder}s`;
    }
    onDestroy(() => {
    });
    progressPercent = maintenanceJobProgressPercent(job);
    isRunning = job?.status === "running";
    isCompleted = job?.status === "completed";
    isFailed = job?.status === "failed";
    if (job) {
      const nextSignature = progressSignature(job);
      if (nextSignature !== lastProgressSignature) {
        lastProgressSignature = nextSignature;
        lastProgressChangeAt = Date.now();
      }
    }
    staleForMs = isRunning ? now - lastProgressChangeAt : 0;
    showsStalled = isRunning && staleForMs >= 15e3;
    if (job) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-3 rounded border bg-body-secondary bg-opacity-10 p-3"><div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2"><div class="fw-semibold">${escape_html(label)}</div> <span${attr_class(`badge ${isCompleted ? "text-bg-success" : isFailed ? "text-bg-danger" : "text-bg-secondary"}`)}>${escape_html(job.status)}</span></div> `);
      if (job.progress_message) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-body-secondary mb-2">${escape_html(job.progress_message)}</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="progress" role="progressbar"${attr("aria-label", label)} aria-valuemin="0" aria-valuemax="100"${attr("aria-valuenow", progressPercent ?? void 0)}><div${attr_class(`progress-bar ${progressPercent == null && isRunning ? "progress-bar-striped progress-bar-animated" : ""}`)}${attr_style(`width: ${progressPercent ?? (isCompleted ? 100 : 100)}%`)}>`);
      if (progressPercent != null) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`${escape_html(progressPercent.toFixed(0))}%`);
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
      if (showsStalled) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="small text-warning-emphasis mt-2">No progress change for ${escape_html(formatElapsed(staleForMs))}. The job is still running, but it has not reported a new step yet.</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { job, label });
  });
}
export {
  JobProgressPanel as J
};
