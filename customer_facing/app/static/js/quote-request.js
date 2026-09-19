const quoteRequestContext = window.__QUOTE_REQUEST_CONTEXT__ || {};
const quoteRequestConfig = window.__QUOTE_REQUEST_CONFIG__ || { endpointUrl: "/api/quote-requests" };
const quoteRequestWorkflow = window.__QUOTE_REQUEST_WORKFLOW__ || {};
const quoteRequestModal = document.getElementById("quoteRequestModal");
const quoteRequestForm = quoteRequestModal?.querySelector("[data-quote-request-form]") || null;
const quoteRequestStatus = quoteRequestModal?.querySelector("[data-quote-request-status]") || null;
const quoteRequestSubmit = quoteRequestModal?.querySelector("[data-quote-request-submit]") || null;
const quoteRequestAttributesNode = quoteRequestModal?.querySelector("[data-quote-request-attributes-section]") || null;
const quoteRequestHelperNode = quoteRequestModal?.querySelector("[data-quote-request-helper]") || null;
const quoteRequestTailoredNode = quoteRequestModal?.querySelector("[data-quote-request-tailored-fields]") || null;
const quoteRequestConfirmation = quoteRequestModal?.querySelector("[data-quote-request-confirmation]") || null;
const quoteRequestConfirmationSummary = quoteRequestModal?.querySelector("[data-quote-request-confirmation-summary]") || null;
const quoteRequestConfirmationOk = quoteRequestModal?.querySelector("[data-quote-request-confirmation-ok]") || null;
const quoteRequestCancel = quoteRequestModal?.querySelector('.modal-footer [data-bs-dismiss="modal"]') || null;
const quoteRequestBody = quoteRequestModal?.querySelector(".modal-body") || null;

// CMS actions are declarative: the CMS never stores executable JavaScript.
// Consumers can listen for these events, while the built-in enquiry event has
// a useful default behaviour for the customer-facing site.
document.addEventListener("click", (event) => {
  const trigger = event.target instanceof Element ? event.target.closest("[data-cms-event]") : null;
  if (!trigger) return;
  const eventName = trigger.getAttribute("data-cms-event");
  if (!eventName) return;
  window.dispatchEvent(new CustomEvent(eventName, { detail: { trigger } }));
  if (eventName === "open-enquiry" && quoteRequestModal && window.bootstrap?.Modal) {
    event.preventDefault();
    window.bootstrap.Modal.getOrCreateInstance(quoteRequestModal).show();
  }
});
const defaultSubmitLabel = quoteRequestSubmit?.textContent || "Send enquiry";
const suggestedAttributeLabels = {
  airflow: "Airflow",
  pressure: "Pressure",
  power: "Power",
  efficiency: "Efficiency",
  noise: "Noise",
  size: "Size",
  temperature: "Temperature",
  mounting: "Mounting",
};
const tailoredRequirementDefinitions = {
  airflow_max: { attribute: "airflow", label: "Maximum airflow" },
  pressure_max: { attribute: "pressure", label: "Maximum pressure" },
  power_limit: { attribute: "power", label: "Maximum power" },
  efficiency_max: { attribute: "efficiency", label: "Efficiency requirement" },
  noise_max: { attribute: "noise", label: "Maximum noise" },
  size_max: { attribute: "size", label: "Maximum dimensions" },
  temperature_max: { attribute: "temperature", label: "Maximum operating temperature" },
  mounting_requirement: { attribute: "mounting", label: "Mounting requirement" },
};

let submitInFlight = false;
let successCloseTimer = null;
let activeDefaultRequestType = "";
let activeContextFields = null;
let cachedGraphImageDataUrl = "";
let graphCaptureTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function text(value) {
  return String(value ?? "").trim();
}

function cssEscape(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function getCheckedValues(name) {
  if (!quoteRequestForm) return [];
  return Array.from(quoteRequestForm.querySelectorAll(`[name="${name}"]:checked`))
    .map((input) => text(input.value))
    .filter(Boolean);
}

function getCheckedRadioValue(name) {
  if (!quoteRequestForm) return "";
  return text(quoteRequestForm.querySelector(`[name="${name}"]:checked`)?.value);
}

function getFieldValue(name) {
  if (!quoteRequestForm) return "";
  const field = quoteRequestForm.elements.namedItem(name);
  if (!field || !("value" in field)) return "";
  return text(field.value);
}

function getPerformanceTarget() {
  return window.CustomerFacingPerformanceTarget?.read?.() || { airflow: null, pressure: null };
}

function getConfiguredContextFields() {
  const configured = activeContextFields || quoteRequestWorkflow.contextFields || {};
  return {
    airflow: configured.airflow !== false,
    pressure: configured.pressure !== false,
  };
}

function getFinderPerformanceValues() {
  const values = { airflow: null, pressure: null, power: null, efficiency: null, noise: null, size: null, temperature: null, mounting: null };
  try {
    const raw = new URLSearchParams(window.location.search).get("parameter_filters");
    const filters = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(filters)) return values;
    for (const filter of filters) {
      const name = String(filter.parameter_name || "").toLowerCase();
      if (Object.hasOwn(values, name)) {
        values[name] = filter.max_number ?? filter.min_number ?? filter.value_string ?? null;
      }
    }
  } catch (_error) {}
  return values;
}

function buildWorkflowContext() {
  const fields = getConfiguredContextFields();
  const requestType = getCheckedRadioValue("request_type");
  const selectedAttributes = new Set(getCheckedValues("attributes"));
  const liveTarget = getPerformanceTarget();
  const finderTarget = getFinderPerformanceValues();
  const performanceTarget = {};
  for (const field of ["airflow", "pressure"]) {
    if (!fields[field]) continue;
    if (requestType === "tailored" && !selectedAttributes.has(field)) continue;
    const value = liveTarget[field] ?? finderTarget[field];
    if (value !== null && value !== undefined && String(value).trim() !== "") performanceTarget[field] = value;
  }
  return { context_fields: fields, performance_target: performanceTarget };
}

function hydratePerformanceTargetFields() {
  if (!quoteRequestForm) return;
  if (getCheckedRadioValue("request_type") !== "tailored") return;
  const liveTarget = getPerformanceTarget();
  const finderTarget = getFinderPerformanceValues();
  const selected = new Set(getCheckedValues("attributes"));
  for (const [attribute, name] of [["airflow", "airflow_max"], ["pressure", "pressure_max"], ["power", "power_limit"], ["efficiency", "efficiency_max"], ["noise", "noise_max"], ["size", "size_max"], ["temperature", "temperature_max"], ["mounting", "mounting_requirement"]]) {
    if (!selected.has(attribute)) continue;
    const value = liveTarget[attribute] ?? finderTarget[attribute];
    const field = quoteRequestForm.elements.namedItem(name);
    if (field && value != null && !field.value) field.value = value;
  }
}

function getGraphImageDataUrl() {
  const chart = window.__CUSTOMER_FACING_GRAPH_CHART__;
  if (!chart || typeof chart.getDataURL !== "function") return "";
  try {
    return chart.getDataURL({ type: "png", pixelRatio: 2, excludeComponents: ["toolbox"] }) || "";
  } catch (_error) {
    return "";
  }
}

function prepareGraphImage() {
  if (getCheckedRadioValue("request_type") !== "standard") return;
  if (graphCaptureTimer) window.clearTimeout(graphCaptureTimer);
  cachedGraphImageDataUrl = "";
  // Let Bootstrap finish drawing the modal before asking ECharts to encode its
  // canvas. The resulting PNG stays only in page memory until submit or close.
  graphCaptureTimer = window.setTimeout(() => {
    graphCaptureTimer = null;
    cachedGraphImageDataUrl = getGraphImageDataUrl();
  }, 100);
}

function discardPreparedGraphImage() {
  if (graphCaptureTimer) window.clearTimeout(graphCaptureTimer);
  graphCaptureTimer = null;
  cachedGraphImageDataUrl = "";
}

function setStatus(kind, message) {
  if (!quoteRequestStatus) return;
  const normalizedKind = kind === "success" ? "success" : kind === "warning" ? "warning" : kind === "info" ? "info" : "danger";
  quoteRequestStatus.classList.remove("d-none", "alert-success", "alert-danger", "alert-warning", "alert-info");
  quoteRequestStatus.classList.add(`alert-${normalizedKind}`);
  quoteRequestStatus.textContent = message;
}

function clearStatus() {
  if (!quoteRequestStatus) return;
  quoteRequestStatus.textContent = "";
  quoteRequestStatus.classList.add("d-none");
  quoteRequestStatus.classList.remove("alert-success", "alert-danger", "alert-warning", "alert-info");
}

function responseErrorMessage(response, parsed, rawText) {
  const fallback = "We could not send your enquiry right now. Please try again.";
  const contentType = response?.headers?.get("content-type")?.toLowerCase() || "";
  const candidate = typeof parsed?.detail === "string"
    ? parsed.detail
    : typeof parsed?.message === "string"
      ? parsed.message
      : contentType.includes("text/plain")
        ? rawText
        : "";
  const message = text(candidate);

  // Reverse proxies and framework error pages can return a complete HTML
  // document. Never expose that response body in the customer-facing alert.
  if (!message || /<\/?[a-z][^>]*>/i.test(message)) return fallback;
  return message.slice(0, 500);
}

function setSubmitting(isSubmitting) {
  submitInFlight = isSubmitting;
  if (quoteRequestSubmit) {
    quoteRequestSubmit.disabled = isSubmitting;
    quoteRequestSubmit.textContent = isSubmitting ? "Sending..." : defaultSubmitLabel;
  }
  if (quoteRequestForm) {
    quoteRequestForm.setAttribute("aria-busy", isSubmitting ? "true" : "false");
  }
}

function getContextParts() {
  const parts = [];
  if (quoteRequestContext.product?.model) {
    parts.push(`Product: ${quoteRequestContext.product.model}`);
  }
  if (quoteRequestContext.series?.name) {
    parts.push(`Series: ${quoteRequestContext.series.name}`);
  }
  if (quoteRequestContext.productType?.label) {
    parts.push(`Product type: ${quoteRequestContext.productType.label}`);
  }
  if (!parts.length && quoteRequestContext.pageTitle) {
    parts.push(text(quoteRequestContext.pageTitle));
  }
  return parts;
}

function buildContextChips() {
  const chips = [];
  if (quoteRequestContext.productType?.label) {
    chips.push(quoteRequestContext.productType.label);
  }
  if (quoteRequestContext.series?.name) {
    chips.push(quoteRequestContext.series.name);
  }
  if (quoteRequestContext.product?.model) {
    chips.push(quoteRequestContext.product.model);
  }
  return chips;
}

function populateContext() {
  if (!quoteRequestModal) return;

  const titleNode = quoteRequestModal.querySelector("[data-quote-request-context-title]");
  const summaryNode = quoteRequestModal.querySelector("[data-quote-request-context-summary]");
  const chipsNode = quoteRequestModal.querySelector("[data-quote-request-context-chips]");
  const suggestionsNode = quoteRequestModal.querySelector("[data-quote-request-suggestions]");

  if (titleNode) {
    titleNode.textContent = quoteRequestContext.pageCardTitle || quoteRequestContext.primaryLabel || quoteRequestContext.pageTitle || "Current page";
  }

  if (summaryNode) {
    summaryNode.textContent = quoteRequestContext.pageCardSummary || quoteRequestContext.pageSummary || "Tell us what you need and we will help shape the right quote.";
  }

  if (chipsNode) {
    const chips = buildContextChips();
    chipsNode.innerHTML = chips.length
      ? chips.map((chip) => `<span class="quote-request-chip">${escapeHtml(chip)}</span>`).join("")
      : '<span class="quote-request-chip quote-request-chip--muted">General enquiry</span>';
  }

  if (suggestionsNode) {
    const suggestions = Array.isArray(quoteRequestContext.suggestedAttributes) ? quoteRequestContext.suggestedAttributes : [];
    suggestionsNode.innerHTML = suggestions.length
      ? `<div class="quote-request-suggestions__label">Suggested for this page</div>${suggestions.map((attribute) => `<button type="button" class="quote-request-suggestion-chip" data-quote-request-suggestion="${escapeHtml(attribute)}">${escapeHtml(suggestedAttributeLabels[attribute] || attribute)}</button>`).join("")}`
      : '<div class="quote-request-suggestions__empty text-muted small">No family-specific suggestions available.</div>';
  }
}

function buildRequestPathMessage(requestType) {
  return {
    standard: "Quote this item",
    tailored: "Tailored enquiry",
    unsure: "Help me choose",
  }[requestType] || "Enquiry";
}

function applySuggestedAttributes() {
  if (!quoteRequestForm) return;
  if (getCheckedRadioValue("request_type") !== "tailored") return;
  const suggestions = Array.isArray(quoteRequestContext.suggestedAttributes) ? quoteRequestContext.suggestedAttributes : [];
  if (!suggestions.length) return;

  for (const suggestion of suggestions) {
    const checkbox = quoteRequestForm.querySelector(`[name="attributes"][value="${cssEscape(suggestion)}"]`);
    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = true;
    }
  }
}

function syncAttributeCardState() {
  if (!quoteRequestForm) return;
  for (const card of quoteRequestForm.querySelectorAll(".quote-request-attribute-card")) {
    if (!(card instanceof HTMLElement)) continue;
    const input = card.querySelector(".quote-request-attribute-card__input");
    const isSelected = input instanceof HTMLInputElement && input.checked;
    card.classList.toggle("is-selected", isSelected);
  }
}

function syncOptionCardState() {
  if (!quoteRequestForm) return;
  const selectedValue = getCheckedRadioValue("request_type");
  for (const card of quoteRequestForm.querySelectorAll(".quote-request-option-card")) {
    if (!(card instanceof HTMLElement)) continue;
    const input = card.querySelector(".quote-request-option-card__input");
    const isSelected = input instanceof HTMLInputElement && input.value === selectedValue;
    card.classList.toggle("is-selected", isSelected);
  }
}

function syncSuggestionState() {
  if (!quoteRequestForm) return;
  for (const suggestion of quoteRequestForm.querySelectorAll("[data-quote-request-suggestion]")) {
    if (!(suggestion instanceof HTMLElement)) continue;
    const attribute = suggestion.dataset.quoteRequestSuggestion || "";
    const checkbox = quoteRequestForm.querySelector(`[name="attributes"][value="${cssEscape(attribute)}"]`);
    suggestion.classList.toggle("is-active", checkbox instanceof HTMLInputElement && checkbox.checked);
  }
}

function setRequestType(value) {
  if (!quoteRequestForm) return;
  const normalizedValue = ["standard", "tailored", "unsure"].includes(value) ? value : "";
  if (!normalizedValue) return;
  const radio = quoteRequestForm.querySelector(`[name="request_type"][value="${cssEscape(normalizedValue)}"]`);
  if (radio instanceof HTMLInputElement) {
    radio.checked = true;
  }
}

function syncRequestPathDetails() {
  if (!quoteRequestForm) return;
  const requestType = getCheckedRadioValue("request_type");
  const isTailored = requestType === "tailored";
  const isHelper = requestType === "unsure";
  quoteRequestForm.classList.toggle("quote-request-form--tailored", isTailored);
  quoteRequestForm.classList.toggle("quote-request-form--helper", isHelper);
  if (quoteRequestAttributesNode instanceof HTMLElement) {
    quoteRequestAttributesNode.classList.toggle("d-none", !isTailored);
  }
  if (quoteRequestTailoredNode instanceof HTMLElement) {
    quoteRequestTailoredNode.classList.toggle("d-none", !isTailored);
  }
  if (quoteRequestHelperNode instanceof HTMLElement) {
    quoteRequestHelperNode.classList.toggle("d-none", !isHelper);
  }
  if (requestType !== "tailored") {
    for (const checkbox of quoteRequestForm.querySelectorAll('[name="attributes"]')) {
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = false;
      }
    }
  }
  syncOptionCardState();
  syncAttributeCardState();
  syncSuggestionState();
  syncTailoredRequirementFields();
  hydratePerformanceTargetFields();
  if (requestType === "tailored") discardPreparedGraphImage();
  if (requestType === "standard" && quoteRequestModal?.classList.contains("show") && !cachedGraphImageDataUrl) prepareGraphImage();
}

function syncTailoredRequirementFields() {
  if (!quoteRequestForm) return;
  const selected = new Set(getCheckedValues("attributes"));
  const isTailored = getCheckedRadioValue("request_type") === "tailored";
  for (const node of quoteRequestForm.querySelectorAll("[data-tailored-requirement]")) {
    const attribute = node.getAttribute("data-tailored-requirement");
    const visible = isTailored && selected.has(attribute);
    node.classList.toggle("d-none", !visible);
    for (const input of node.querySelectorAll("input, select, textarea")) {
      input.disabled = !visible;
      input.required = visible;
    }
  }
}

function buildTailoredRequirements() {
  if (getCheckedRadioValue("request_type") !== "tailored") return {};
  return Object.fromEntries(Object.entries(tailoredRequirementDefinitions)
    .map(([name, definition]) => [name, { label: definition.label, value: getFieldValue(name) }])
    .filter(([, requirement]) => requirement.value));
}

function buildPayload() {
  const requestType = getCheckedRadioValue("request_type");
  const payload = {
    name: getFieldValue("name"),
    company: getFieldValue("company"),
    email: getFieldValue("email"),
    phone: getFieldValue("phone"),
    request_type: requestType,
    attributes: getCheckedValues("attributes"),
    airflow_min: "",
    airflow_max: getFieldValue("airflow_max"),
    pressure_min: "",
    pressure_max: getFieldValue("pressure_max"),
    short_notes: getFieldValue("short_notes"),
    details: "",
    helper_thing: getFieldValue("helper_thing"),
    helper_room_size: getFieldValue("helper_room_size"),
    helper_three_phase: getFieldValue("helper_three_phase"),
    helper_constraints: getFieldValue("helper_constraints"),
    website: getFieldValue("website"),
    page_type: quoteRequestContext.pageType || "",
    page_title: quoteRequestContext.pageTitle || "",
    page_summary: quoteRequestContext.pageSummary || "",
    page_card_title: quoteRequestContext.pageCardTitle || quoteRequestContext.primaryLabel || quoteRequestContext.pageTitle || "",
    page_card_summary: quoteRequestContext.pageCardSummary || quoteRequestContext.pageSummary || "",
    page_url: quoteRequestContext.pageUrl || window.location.href,
    product_type: quoteRequestContext.productType || null,
    series: quoteRequestContext.series || null,
    product: quoteRequestContext.product || null,
    page_context: { enquiry_workflow: buildWorkflowContext(), tailored_requirements: buildTailoredRequirements() },
  };
  payload.request_type_label = buildRequestPathMessage(requestType);
  return payload;
}

async function uploadGraphImageAfterSave(record, requestType) {
  if (requestType !== "standard") return;
  if (!record?.id || !record?.graph_upload_token) return;
  const graphImageDataUrl = cachedGraphImageDataUrl || getGraphImageDataUrl();
  if (!graphImageDataUrl) return;
  try {
    await fetch(`${quoteRequestConfig.endpointUrl || "/api/quote-requests"}/${record.id}/graph-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ upload_token: record.graph_upload_token, graph_image_data_url: graphImageDataUrl }),
    });
  } catch (_error) {
    // The enquiry remains saved and emailed even if its optional screenshot fails.
  }
}

function confirmationRows(payload) {
  const target = payload.page_context?.enquiry_workflow?.performance_target || {};
  const tailoredRequirements = Object.values(payload.page_context?.tailored_requirements || {});
  const helperDetails = [
    ["Looking for", payload.helper_thing], ["Room or space size", payload.helper_room_size],
    ["Three-phase power", payload.helper_three_phase], ["Constraints or preferences", payload.helper_constraints],
  ];
  const currentObject = buildContextChips().join(" · ");
  const rows = [
    ["Enquiry", payload.request_type_label],
    ["Current item", currentObject],
    ["Name", payload.name],
    ["Email", payload.email],
    ["Company", payload.company],
    ["Phone", payload.phone],
    ["Airflow", target.airflow],
    ["Pressure", target.pressure],
    ...tailoredRequirements.map((requirement) => [requirement.label, requirement.value]),
    ...helperDetails,
    ["Notes", payload.short_notes],
  ].filter(([, value]) => text(value));
  return rows.map(([label, value]) => `<div class="quote-request-confirmation__row${label === "Notes" ? " quote-request-confirmation__row--notes" : ""}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join("");
}

function showConfirmation(payload) {
  if (!quoteRequestModal || !quoteRequestConfirmation) return;
  if (quoteRequestConfirmationSummary) quoteRequestConfirmationSummary.innerHTML = confirmationRows(payload);
  for (const child of quoteRequestBody?.children || []) {
    if (child !== quoteRequestConfirmation) child.classList.add("d-none", "quote-request-submission-hidden");
  }
  quoteRequestConfirmation.classList.remove("d-none");
  quoteRequestSubmit?.classList.add("d-none");
  quoteRequestCancel?.classList.add("d-none");
  quoteRequestConfirmationOk?.classList.remove("d-none");
  quoteRequestConfirmationOk?.focus();
}

function hideConfirmation() {
  if (!quoteRequestModal || !quoteRequestConfirmation) return;
  quoteRequestConfirmation.classList.add("d-none");
  for (const child of quoteRequestBody?.children || []) {
    if (child.classList.contains("quote-request-submission-hidden")) {
      child.classList.remove("d-none", "quote-request-submission-hidden");
    }
  }
  quoteRequestSubmit?.classList.remove("d-none");
  quoteRequestCancel?.classList.remove("d-none");
  quoteRequestConfirmationOk?.classList.add("d-none");
}

async function submitQuoteRequest(event) {
  event.preventDefault();
  if (!quoteRequestForm || submitInFlight) return;

  clearStatus();
  const payload = buildPayload();
  setSubmitting(true);

  try {
    const response = await fetch(quoteRequestConfig.endpointUrl || "/api/quote-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch (_error) {
      parsed = null;
    }

    if (!response.ok) {
      throw new Error(responseErrorMessage(response, parsed, rawText));
    }

    showConfirmation(payload);
    window.setTimeout(() => { void uploadGraphImageAfterSave(parsed, payload.request_type); }, 0);
    quoteRequestForm.reset();
    syncRequestPathDetails();
  } catch (error) {
    setStatus("danger", error instanceof Error ? error.message : "We could not send your enquiry right now.");
  } finally {
    setSubmitting(false);
  }
}

function wireQuoteRequestModal() {
  if (!quoteRequestModal || !quoteRequestForm) return;

  populateContext();
  applySuggestedAttributes();
  syncRequestPathDetails();

  quoteRequestModal.addEventListener("show.bs.modal", (event) => {
    hideConfirmation();
    clearStatus();
    const trigger = event?.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
    activeDefaultRequestType = trigger?.dataset.quoteRequestDefaultType || "";
    activeContextFields = null;
    if (trigger?.dataset.quoteRequestContextFields) {
      try {
        const parsed = JSON.parse(trigger.dataset.quoteRequestContextFields);
        if (parsed && typeof parsed === "object") activeContextFields = parsed;
      } catch (_error) {}
    }
    if (activeDefaultRequestType) {
      setRequestType(activeDefaultRequestType);
    }
    populateContext();
    hydratePerformanceTargetFields();
    applySuggestedAttributes();
    syncRequestPathDetails();
  });

  quoteRequestModal.addEventListener("shown.bs.modal", () => {
    prepareGraphImage();
    const helperField = activeDefaultRequestType === "unsure"
      ? quoteRequestForm.querySelector('[name="helper_thing"]')
      : null;
    const targetField = helperField instanceof HTMLElement
      ? helperField
      : quoteRequestForm.querySelector('[name="name"]');
    if (targetField instanceof HTMLElement) {
      targetField.focus();
    }
  });

  quoteRequestConfirmationOk?.addEventListener("click", () => {
    window.bootstrap?.Modal.getOrCreateInstance(quoteRequestModal).hide();
  });

  quoteRequestModal.addEventListener("hidden.bs.modal", () => {
    hideConfirmation();
    clearStatus();
    if (!submitInFlight) discardPreparedGraphImage();
  });

  quoteRequestModal.addEventListener("hidden.bs.modal", () => {
    if (successCloseTimer) {
      window.clearTimeout(successCloseTimer);
      successCloseTimer = null;
    }
    activeDefaultRequestType = "";
    activeContextFields = null;
    quoteRequestForm.reset();
    clearStatus();
    populateContext();
    applySuggestedAttributes();
    syncRequestPathDetails();
  });

  quoteRequestForm.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.name === "request_type") {
      syncRequestPathDetails();
      return;
    }
    if (event.target instanceof HTMLInputElement && event.target.name === "attributes") {
      syncAttributeCardState();
      syncSuggestionState();
      syncTailoredRequirementFields();
    }
  });

  quoteRequestForm.addEventListener("click", (event) => {
    const suggestion = event.target instanceof HTMLElement ? event.target.closest("[data-quote-request-suggestion]") : null;
    if (!suggestion || !(suggestion instanceof HTMLElement)) return;
    const attribute = suggestion.dataset.quoteRequestSuggestion || "";
    if (!attribute) return;
    const checkbox = quoteRequestForm.querySelector(`[name="attributes"][value="${cssEscape(attribute)}"]`);
    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = !checkbox.checked;
    }
    syncSuggestionState();
  });

  quoteRequestForm.addEventListener("submit", submitQuoteRequest);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireQuoteRequestModal);
} else {
  wireQuoteRequestModal();
}
