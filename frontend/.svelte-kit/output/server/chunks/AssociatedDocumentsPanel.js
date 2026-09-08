import { e as escape_html, b as attr, d as ensure_array_like, i as bind_props } from "./index2.js";
import { q as getAssociatedDocuments } from "./api.js";
import { f as fallback } from "./equality.js";
function AssociatedDocumentsPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let ownerType = $$props["ownerType"];
    let ownerId = $$props["ownerId"];
    let editable = fallback($$props["editable"], true);
    let title = fallback($$props["title"], "Associated documents");
    let documents = [];
    let pendingFiles = [];
    let loading = false;
    let saving = false;
    let error = "";
    async function loadDocuments() {
      if (!ownerId) {
        documents = [];
        return;
      }
      loading = true;
      error = "";
      try {
        documents = await getAssociatedDocuments(ownerType, ownerId);
      } catch (e) {
        error = e.message || "Unable to load associated documents.";
      } finally {
        loading = false;
      }
    }
    if (ownerType && ownerId) loadDocuments();
    $$renderer2.push(`<div class="card shadow-sm"><div class="card-body"><h3 class="h6">${escape_html(title)}</h3> `);
    if (editable) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-body-secondary">Upload PDFs and other supporting files such as wiring diagrams.</p> <input class="form-control mb-2" type="file" multiple=""/> <button class="btn btn-primary btn-sm" type="button"${attr("disabled", !ownerId || pendingFiles.length === 0, true)}>${escape_html("Upload documents")}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="alert alert-danger mt-3 mb-0">${escape_html(error)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-body-secondary mt-3 mb-0">Loading documents...</p>`);
    } else if (documents.length > 0) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="list-group mt-3"><!--[-->`);
      const each_array = ensure_array_like(documents);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let document = each_array[$$index];
        $$renderer2.push(`<div class="list-group-item d-flex align-items-center gap-2"><a class="text-decoration-none flex-grow-1"${attr("href", document.download_url)} target="_blank" rel="noreferrer"><span class="fw-semibold d-block">${escape_html(document.original_file_name)}</span> <span class="small text-body-secondary">Open or download</span></a> `);
        if (editable) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", saving, true)}>Delete</button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="text-body-secondary mt-3 mb-0">No associated documents yet.</p>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
    bind_props($$props, { ownerType, ownerId, editable, title });
  });
}
export {
  AssociatedDocumentsPanel as A
};
