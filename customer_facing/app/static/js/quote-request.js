const quoteRequestContext = window.__QUOTE_REQUEST_CONTEXT__ || {};
const quoteRequestConfig = window.__QUOTE_REQUEST_CONFIG__ || { endpointUrl: "/api/quote-requests" };
const quoteRequestModal = document.getElementById("quoteRequestModal");
const quoteRequestForm = quoteRequestModal?.querySelector("[data-quote-request-form]") || null;
const quoteRequestStatus = quoteRequestModal?.querySelector("[data-quote-request-status]") || null;
const quoteRequestSubmit = quoteRequestModal?.querySelector("[data-quote-request-submit]") || null;
const quoteRequestAttributesNode = quoteRequestModal?.querySelector("[data-quote-request-attributes-section]") || null;
const quoteRequestHelperNode = quoteRequestModal?.querySelector("[data-quote-request-helper]") || null;
const quoteRequestTailoredNode = quoteRequestModal?.querySelector("[data-quote-request-tailored-fields]") || null;

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

let submitInFlight = false;
let successCloseTimer = null;
let activeDefaultRequestType = "";

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

function hydratePerformanceTargetFields() {
  if (!quoteRequestForm) return;
  const target = getPerformanceTarget();
  for (const [name, value] of [["airflow_min", target.airflow], ["airflow_max", target.airflow], ["pressure_min", target.pressure], ["pressure_max", target.pressure]]) {
    const field = quoteRequestForm.elements.namedItem(name);
    if (field && value != null) field.value = value;
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
  if (quoteRequestContext.pageType) {
    chips.push(quoteRequestContext.pageType.replaceAll("-", " "));
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
    airflow_min: getFieldValue("airflow_min"),
    airflow_max: getFieldValue("airflow_max"),
    pressure_min: getFieldValue("pressure_min"),
    pressure_max: getFieldValue("pressure_max"),
    power_limit: getFieldValue("power_limit"),
    short_notes: getFieldValue("short_notes"),
    details: getFieldValue("details"),
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
    graph_image_data_url: getGraphImageDataUrl(),
  };
  payload.request_type_label = buildRequestPathMessage(requestType);
  return payload;
}

async function submitQuoteRequest(event) {
  event.preventDefault();
  if (!quoteRequestForm || submitInFlight) return;

  clearStatus();
  setSubmitting(true);

  try {
    const response = await fetch(quoteRequestConfig.endpointUrl || "/api/quote-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(buildPayload()),
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

    setStatus("success", parsed?.message || "Thanks, your enquiry has been sent.");
    quoteRequestForm.reset();
    syncRequestPathDetails();

    if (successCloseTimer) {
      window.clearTimeout(successCloseTimer);
    }
    if (quoteRequestModal && window.bootstrap?.Modal) {
      const modal = window.bootstrap.Modal.getOrCreateInstance(quoteRequestModal);
      successCloseTimer = window.setTimeout(() => {
        modal.hide();
      }, 1200);
    }
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
    clearStatus();
    activeDefaultRequestType = event?.relatedTarget instanceof HTMLElement
      ? event.relatedTarget.dataset.quoteRequestDefaultType || ""
      : "";
    if (activeDefaultRequestType) {
      setRequestType(activeDefaultRequestType);
    }
    populateContext();
    hydratePerformanceTargetFields();
    applySuggestedAttributes();
    syncRequestPathDetails();
  });

  quoteRequestModal.addEventListener("shown.bs.modal", () => {
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

  quoteRequestModal.addEventListener("hidden.bs.modal", () => {
    if (successCloseTimer) {
      window.clearTimeout(successCloseTimer);
      successCloseTimer = null;
    }
    activeDefaultRequestType = "";
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
