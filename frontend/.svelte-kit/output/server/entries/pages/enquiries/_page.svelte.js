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
        $$renderer3.push(`<!--]--> <div class="card shadow-sm"><div class="card-body p-0"><div class="table-responsive"><table class="table align-middle mb-0"><thead class="table-light"><tr><th scope="col">Received</th><th scope="col">Customer</th><th scope="col">Context</th><th scope="col">Path</th><th scope="col">Verification</th><th scope="col">Email</th><th scope="col" class="text-end">Actions</th></tr></thead><tbody>`);
        if (filteredRecords.length) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(filteredRecords);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let record = each_array[$$index];
            $$renderer3.push(`<tr><td class="text-nowrap">${escape_html(formatDate(record.created_at))}</td><td><div class="fw-semibold">${escape_html(record.name)}</div> <div class="small text-body-secondary">${escape_html(record.company || "No company provided")}</div> <div class="small"><a${attr("href", `mailto:${record.email}`)}>${escape_html(record.email)}</a></div> `);
            if (record.phone) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small text-body-secondary">${escape_html(record.phone)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></td><td><div class="fw-semibold">${escape_html(record.page_card_title || record.page_title || "Unknown page")}</div> <div class="small text-body-secondary">${escape_html(record.page_card_summary || record.page_summary || "No summary provided")}</div> `);
            if (record.context_json?.product?.model) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small">Product: ${escape_html(record.context_json.product.model)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (record.context_json?.series?.name) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small">Series: ${escape_html(record.context_json.series.name)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (record.context_json?.product_type?.label) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small">Type: ${escape_html(record.context_json.product_type.label)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (record.context_json?.enquiry_workflow?.performance_target?.airflow != null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small">Airflow target: ${escape_html(record.context_json.enquiry_workflow.performance_target.airflow)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (record.context_json?.enquiry_workflow?.performance_target?.pressure != null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small">Pressure target: ${escape_html(record.context_json.enquiry_workflow.performance_target.pressure)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></td><td><div class="mb-2"><label class="form-label small text-body-secondary mb-1"${attr("for", `quote-status-${record.id}`)}>Status</label> `);
            $$renderer3.select(
              {
                id: `quote-status-${record.id}`,
                class: "form-select form-select-sm",
                value: record.status,
                disabled: savingId === record.id
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
              }
            );
            $$renderer3.push(`</div> <div${attr_class(`badge ${getRequestPathMeta(record.request_type).badge} mb-2`)}>${escape_html(getRequestPathMeta(record.request_type).label)}</div> <div class="small text-body-secondary">${escape_html(getRequestPathMeta(record.request_type).description)}</div> `);
            if (record.page_url) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small text-body-secondary text-break">${escape_html(record.page_url)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> <div class="small text-body-secondary">Attributes: ${escape_html((record.attributes || []).join(", ") || "None")}</div> <details class="mt-2"><summary class="small">Details</summary> <div class="small text-body-secondary mt-2" style="white-space: pre-wrap;">${escape_html(record.short_notes || "No short notes")}</div> <div class="small mt-2" style="white-space: pre-wrap;">${escape_html(record.details || "No extended notes")}</div></details></td><td><div${attr_class(`badge ${record.verification_status === "passed" ? "text-bg-success" : record.verification_status === "not_configured" ? "text-bg-secondary" : "text-bg-warning"}`)}>${escape_html(record.verification_status)}</div> <div class="small text-body-secondary mt-1">${escape_html(record.verification_provider)}</div> `);
            if (record.client_ip) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small text-body-secondary">${escape_html(record.client_ip)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></td><td><div${attr_class(`badge ${record.email_status === "sent" ? "text-bg-success" : record.email_status === "failed" ? "text-bg-danger" : "text-bg-secondary"}`)}>${escape_html(record.email_status)}</div> `);
            if (record.email_error) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small text-danger mt-1">${escape_html(record.email_error)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> <div class="small text-body-secondary mt-2">Customer acknowledgement</div> <div${attr_class(`badge ${record.acknowledgement_email_status === "sent" ? "text-bg-success" : record.acknowledgement_email_status === "failed" ? "text-bg-danger" : "text-bg-secondary"}`)}>${escape_html(record.acknowledgement_email_status || "not sent")}</div> `);
            if (record.acknowledgement_email_error) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="small text-danger mt-1">${escape_html(record.acknowledgement_email_error)}</div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></td><td class="text-end"><button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", deletingId === record.id, true)}>${escape_html(deletingId === record.id ? "Deleting..." : "Delete")}</button></td></tr>`);
          }
          $$renderer3.push(`<!--]-->`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<tr><td colspan="7" class="text-center text-body-secondary py-5">No enquiry records match the current filters.</td></tr>`);
        }
        $$renderer3.push(`<!--]--></tbody></table></div></div></div>`);
      },
      $$slots: { default: true }
    });
    bind_props($$props, { data });
  });
}
export {
  _page as default
};
