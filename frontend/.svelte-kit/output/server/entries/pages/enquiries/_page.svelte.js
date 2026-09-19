import { h as head, i as bind_props, e as escape_html, b as attr, d as ensure_array_like, c as attr_class } from "../../../chunks/index2.js";
import { M as ManagePageShell } from "../../../chunks/ManagePageShell.js";
import { f as fallback } from "../../../chunks/equality.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let records, filteredRecords, totals;
    let data = fallback($$props["data"], () => ({}), true);
    let statusFilter = "all";
    let requestTypeFilter = "all";
    let searchQuery = "";
    let savingId = null;
    let deletingId = null;
    const requestPathMeta = {
      standard: {
        label: "Enquire about this item",
        badge: "text-bg-success",
        description: "Selected item"
      },
      tailored: {
        label: "Tailored product",
        badge: "text-bg-warning",
        description: "Custom specification"
      },
      unsure: {
        label: "Not sure yet",
        badge: "text-bg-info",
        description: "General enquiry"
      }
    };
    function formatDate(value) {
      if (!value) return "—";
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
    }
    function getRequestPathMeta(value) {
      return requestPathMeta[value] || {
        label: value || "Unknown",
        badge: "text-bg-secondary",
        description: "Unmapped path"
      };
    }
    function helperDetailLabel(key) {
      return {
        thing: "Looking for",
        room_size: "Room or space size",
        three_phase: "Three-phase power",
        constraints: "Constraints or preferences"
      }[key] || key.replaceAll("_", " ");
    }
    function filterRecords(records2) {
      const needle = searchQuery.trim().toLowerCase();
      return (records2 || []).filter((record) => {
        if (needle) {
          const haystack = [
            record.name,
            record.company,
            record.email,
            record.phone,
            record.page_card_title,
            record.page_title,
            record.page_type,
            record.request_type,
            record.status,
            record.email_status,
            record.acknowledgement_email_status,
            record.verification_status,
            record.page_url,
            record.short_notes,
            record.details,
            JSON.stringify(record.context_json?.enquiry_workflow || {})
          ].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      });
    }
    records = Array.isArray(data.quoteRequests) ? data.quoteRequests : [];
    filteredRecords = filterRecords(records);
    totals = {
      all: records.length,
      sent: records.filter((record) => record.email_status === "sent").length,
      failed: records.filter((record) => record.email_status === "failed").length,
      verified: records.filter((record) => record.verification_status === "passed").length
    };
    head("1i9pvdi", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Enquiries — Internal Facing</title>`);
      });
    });
    ManagePageShell($$renderer2, {
      eyebrow: "Customer enquiries",
      title: "Enquiries",
      description: "Review enquiry requests captured from the public site, including verification and email delivery status.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="row g-3 mb-4"><div class="col-12 col-md-3"><div class="card shadow-sm h-100"><div class="card-body"><div class="small text-body-secondary text-uppercase fw-semibold mb-1">Total</div> <div class="h3 mb-0">${escape_html(totals.all)}</div></div></div></div> <div class="col-12 col-md-3"><div class="card shadow-sm h-100"><div class="card-body"><div class="small text-body-secondary text-uppercase fw-semibold mb-1">Email sent</div> <div class="h3 mb-0">${escape_html(totals.sent)}</div></div></div></div> <div class="col-12 col-md-3"><div class="card shadow-sm h-100"><div class="card-body"><div class="small text-body-secondary text-uppercase fw-semibold mb-1">Email failed</div> <div class="h3 mb-0">${escape_html(totals.failed)}</div></div></div></div> <div class="col-12 col-md-3"><div class="card shadow-sm h-100"><div class="card-body"><div class="small text-body-secondary text-uppercase fw-semibold mb-1">Verified</div> <div class="h3 mb-0">${escape_html(totals.verified)}</div></div></div></div></div> <div class="card shadow-sm mb-4"><div class="card-body"><div class="row g-3 align-items-end"><div class="col-md-6"><label class="form-label" for="quote-request-search">Search</label> <input id="quote-request-search" class="form-control" type="search"${attr("value", searchQuery)} placeholder="Name, email, product, page, note..."/></div> <div class="col-md-3"><label class="form-label" for="quote-request-status">Workflow status</label> `);
        $$renderer3.select(
          {
            id: "quote-request-status",
            class: "form-select",
            value: statusFilter
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "all" }, ($$renderer5) => {
              $$renderer5.push(`All statuses`);
            });
            $$renderer4.option({ value: "new" }, ($$renderer5) => {
              $$renderer5.push(`New`);
            });
            $$renderer4.option({ value: "quoted" }, ($$renderer5) => {
              $$renderer5.push(`Quoted`);
            });
            $$renderer4.option({ value: "closed" }, ($$renderer5) => {
              $$renderer5.push(`Closed`);
            });
          }
        );
        $$renderer3.push(`</div> <div class="col-md-3"><label class="form-label" for="quote-request-type">Request path</label> `);
        $$renderer3.select(
          {
            id: "quote-request-type",
            class: "form-select",
            value: requestTypeFilter
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "all" }, ($$renderer5) => {
              $$renderer5.push(`All request types`);
            });
            $$renderer4.option({ value: "standard" }, ($$renderer5) => {
              $$renderer5.push(`Enquire about this item`);
            });
            $$renderer4.option({ value: "tailored" }, ($$renderer5) => {
              $$renderer5.push(`Tailored product`);
            });
            $$renderer4.option({ value: "unsure" }, ($$renderer5) => {
              $$renderer5.push(`Not sure yet`);
            });
          }
        );
        $$renderer3.push(`</div></div></div></div> `);
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> <div class="enquiries-results"><div class="d-flex justify-content-between align-items-center mb-3 px-1"><div class="fw-semibold">${escape_html(filteredRecords.length)} ${escape_html(filteredRecords.length === 1 ? "enquiry" : "enquiries")}</div> <div class="small text-body-secondary">Newest first</div></div> `);
        if (filteredRecords.length) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(filteredRecords);
          for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
            let record = each_array[$$index_2];
            $$renderer3.push(`<article class="card shadow-sm enquiry-card mb-3"><div class="card-body p-4"><div class="d-flex flex-wrap gap-2 justify-content-between align-items-start mb-3"><div><div class="small text-body-secondary">Received ${escape_html(formatDate(record.created_at))}</div> <h2 class="h5 mb-1">${escape_html(record.name)}</h2> <div class="text-body-secondary">${escape_html(record.company || "No company provided")}</div></div> <div class="d-flex align-items-center gap-2"><span${attr_class(`badge ${getRequestPathMeta(record.request_type).badge}`, "svelte-1i9pvdi")}>${escape_html(getRequestPathMeta(record.request_type).label)}</span> `);
            $$renderer3.select(
              {
                class: "form-select form-select-sm enquiry-card__status",
                value: record.status,
                disabled: savingId === record.id,
                "aria-label": "Enquiry status"
              },
              ($$renderer4) => {
                $$renderer4.option({ value: "new" }, ($$renderer5) => {
                  $$renderer5.push(`New`);
                });
                $$renderer4.option({ value: "quoted" }, ($$renderer5) => {
                  $$renderer5.push(`Quoted`);
                });
                $$renderer4.option({ value: "closed" }, ($$renderer5) => {
                  $$renderer5.push(`Closed`);
                });
              },
              "svelte-1i9pvdi"
            );
            $$renderer3.push(`</div></div> <div class="enquiry-card__grid svelte-1i9pvdi"><section><div class="enquiry-card__label svelte-1i9pvdi">Contact</div><a${attr("href", `mailto:${record.email}`)}>${escape_html(record.email)}</a>`);
            if (record.phone) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div>${escape_html(record.phone)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></section> <section><div class="enquiry-card__label svelte-1i9pvdi">Catalogue context</div><div class="fw-semibold">${escape_html(record.page_card_title || record.page_title || "Unknown page")}</div>`);
            if (record.context_json?.product?.model) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small text-body-secondary">Product: ${escape_html(record.context_json.product.model)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
            if (record.context_json?.series?.name) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small text-body-secondary">Series: ${escape_html(record.context_json.series.name)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></section> <section><div class="enquiry-card__label svelte-1i9pvdi">Delivery</div><div>Team email <span${attr_class(
              `badge ${record.email_status === "sent" ? "text-bg-success" : record.email_status === "failed" ? "text-bg-danger" : "text-bg-secondary"}`,
              "svelte-1i9pvdi"
            )}>${escape_html(record.email_status)}</span></div><div class="mt-1">Customer copy <span${attr_class(
              `badge ${record.acknowledgement_email_status === "sent" ? "text-bg-success" : record.acknowledgement_email_status === "failed" ? "text-bg-danger" : "text-bg-secondary"}`,
              "svelte-1i9pvdi"
            )}>${escape_html(record.acknowledgement_email_status || "not sent")}</span></div></section></div> <details class="mt-3"><summary>View enquiry details</summary><div class="enquiry-card__details mt-3 svelte-1i9pvdi"><div><strong>Selected stream:</strong> ${escape_html(getRequestPathMeta(record.request_type).label)}</div><div><strong>Selected attributes:</strong> ${escape_html((record.attributes || []).join(", ") || "None")}</div>`);
            if (record.context_json?.enquiry_workflow?.performance_target?.airflow != null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div>Airflow target: ${escape_html(record.context_json.enquiry_workflow.performance_target.airflow)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
            if (record.context_json?.enquiry_workflow?.performance_target?.pressure != null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div>Pressure target: ${escape_html(record.context_json.enquiry_workflow.performance_target.pressure)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--><!--[-->`);
            const each_array_1 = ensure_array_like(Object.values(record.context_json?.tailored_requirements || {}));
            for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
              let requirement = each_array_1[$$index];
              $$renderer3.push(`<div>${escape_html(requirement.label)}: ${escape_html(requirement.value)}</div>`);
            }
            $$renderer3.push(`<!--]--><!--[-->`);
            const each_array_2 = ensure_array_like(Object.entries(record.context_json?.help_me_choose || {}));
            for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
              let [key, value] = each_array_2[$$index_1];
              $$renderer3.push(`<div>${escape_html(helperDetailLabel(key))}: ${escape_html(value)}</div>`);
            }
            $$renderer3.push(`<!--]-->`);
            if (record.graph_image_url) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<figure class="enquiry-card__graph svelte-1i9pvdi"><figcaption class="enquiry-card__label svelte-1i9pvdi">Submitted performance graph</figcaption><img${attr("src", record.graph_image_url)} alt="Submitted performance graph with selected duty point" class="svelte-1i9pvdi"/></figure>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--><div class="enquiry-card__notes svelte-1i9pvdi"><strong class="svelte-1i9pvdi">Additional notes</strong><div style="white-space:pre-wrap">${escape_html(record.short_notes || record.details || "No notes provided")}</div></div></div></details> <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top"><span${attr_class(`badge ${record.verification_status === "passed" ? "text-bg-success" : "text-bg-secondary"}`, "svelte-1i9pvdi")}>Verification: ${escape_html(record.verification_status)}</span><button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", deletingId === record.id, true)}>${escape_html(deletingId === record.id ? "Deleting..." : "Delete")}</button></div></div></article>`);
          }
          $$renderer3.push(`<!--]-->`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="card shadow-sm"><div class="card-body text-center text-body-secondary py-5">No enquiry records match the current filters.</div></div>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      },
      $$slots: { default: true }
    });
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
