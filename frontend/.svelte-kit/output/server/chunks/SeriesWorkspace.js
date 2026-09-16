import { b as attr, d as ensure_array_like, e as escape_html, i as bind_props, h as head } from "./index2.js";
import { f as fallback } from "./equality.js";
import { g as goto } from "./client.js";
import { i as getSeriesById, j as deleteSeriesImage, k as reorderSeriesImages, l as uploadSeriesImages } from "./api.js";
import { c as createDescriptionSectionDrafts, g as getDescriptionFieldCount, M as MAX_DESCRIPTION_SECTIONS } from "./descriptionSections.js";
import { A as AssociatedDocumentsPanel } from "./AssociatedDocumentsPanel.js";
import { R as RichTextEditor } from "./RichTextEditor.js";
function SeriesMediaPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let seriesForm = $$props["seriesForm"];
    let seriesImages = fallback($$props["seriesImages"], () => [], true);
    let pendingImageFiles = fallback($$props["pendingImageFiles"], () => [], true);
    let uploadImages = fallback($$props["uploadImages"], () => {
    });
    let moveSeriesImage = fallback($$props["moveSeriesImage"], () => {
    });
    let removeSeriesImage = fallback($$props["removeSeriesImage"], () => {
    });
    $$renderer2.push(`<div class="vstack gap-3">`);
    if (seriesForm?.id) {
      $$renderer2.push("<!--[0-->");
      AssociatedDocumentsPanel($$renderer2, { ownerType: "series", ownerId: seriesForm.id });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="card shadow-sm h-100"><div class="card-body"><h3 class="h6">Series images</h3> <p class="text-body-secondary">Upload multiple images, reorder them, and the first two become the primary and secondary series images.</p> <div class="mb-3"><label class="form-label" for="edit-series-images">Select image files</label> <input class="form-control" id="edit-series-images" type="file" accept="image/*" multiple=""/></div> <div class="d-flex flex-wrap gap-2"><button class="btn btn-primary"${attr("disabled", pendingImageFiles.length === 0, true)}>Upload Selected Images</button></div> `);
    if (seriesImages.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="row g-3 mt-1"><!--[-->`);
      const each_array = ensure_array_like(seriesImages);
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        let image = each_array[index];
        $$renderer2.push(`<div class="col-12 col-sm-6"><div class="card shadow-sm h-100"><div class="card-body"><img class="img-fluid rounded border mb-2" style="width: 100%; height: 150px; object-fit: cover;"${attr("src", image.url)}${attr("alt", `${seriesForm.name} series image ${index + 1}`)}/> <p class="text-body-secondary">${escape_html(index === 0 ? "Primary image" : index === 1 ? "Secondary image" : `Image ${index + 1}`)}</p> <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm"${attr("disabled", index === 0, true)}>Move Up</button> <button class="btn btn-outline-secondary btn-sm"${attr("disabled", index === seriesImages.length - 1, true)}>Move Down</button> <button class="btn btn-danger btn-sm">Delete</button></div></div></div></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="text-body-secondary mt-3 mb-0">No series images uploaded yet.</p>`);
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
    bind_props($$props, {
      seriesForm,
      seriesImages,
      pendingImageFiles,
      uploadImages,
      moveSeriesImage,
      removeSeriesImage
    });
  });
}
function SeriesWorkspace($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let filteredSeriesRecords;
    let initialMode = fallback($$props["initialMode"], "create");
    let initialSeriesId = fallback($$props["initialSeriesId"], "");
    let productTypes = [];
    let seriesRecords = [];
    let templateRegistry = { series_templates: [] };
    let selectedSeriesId = "";
    let seriesProductTypeFilter = "";
    let saving = false;
    let error = "";
    let success = "";
    let mode = initialMode;
    let seriesImages = [];
    let pendingImageFiles = [];
    let appliedInitialSeriesId = null;
    let appliedSeriesEditorUrlId = "";
    let hydratedSeriesId = "";
    let seriesHydrating = false;
    let seriesHydrationError = "";
    let seriesDescriptionSections = createDescriptionSectionDrafts();
    getDescriptionFieldCount();
    function resetDraft(series = null) {
      return {
        id: series?.id ?? null,
        name: series?.name ?? "",
        product_type_key: series?.product_type_key ?? "",
        contents_description: series?.contents_description ?? "",
        printed_template_id: series?.printed_template_id || series?.template_id || "",
        online_template_id: series?.online_template_id || series?.template_id || ""
      };
    }
    let seriesDraft = resetDraft();
    function hydrateSelectedSeries(seriesId = selectedSeriesId) {
      const normalizedSeriesId = seriesId == null || seriesId === "" ? "" : String(seriesId);
      if (!normalizedSeriesId) {
        hydratedSeriesId = "";
        if (seriesDraft.id) {
          seriesDraft = resetDraft();
          seriesImages = [];
        }
        return;
      }
      const selected = seriesRecords.find((item) => String(item.id) === normalizedSeriesId);
      if (!selected) {
        return;
      }
      if (hydratedSeriesId === normalizedSeriesId && String(seriesDraft.id || "") === normalizedSeriesId) {
        return;
      }
      hydratedSeriesId = normalizedSeriesId;
      seriesHydrationError = "";
      resetSeriesDescriptionSections(selected);
      seriesDraft = resetDraft(selected);
      seriesImages = selected.series_images || [];
      if (!seriesProductTypeFilter) {
        seriesProductTypeFilter = selected.product_type_key || "";
      }
      seriesHydrating = true;
      getSeriesById(normalizedSeriesId).then((detail) => {
        if (String(selectedSeriesId) !== normalizedSeriesId) return;
        resetSeriesDescriptionSections(detail);
        seriesDraft = resetDraft(detail);
        seriesImages = detail.series_images || [];
      }).catch((detailError) => {
        if (String(selectedSeriesId) !== normalizedSeriesId) return;
        seriesHydrationError = detailError?.message || "Unable to load the complete series record.";
      }).finally(() => {
        if (String(selectedSeriesId) === normalizedSeriesId) {
          seriesHydrating = false;
        }
      });
    }
    function syncSeriesEditorUrl(seriesId) {
      if (typeof window === "undefined") return;
      const nextSeriesId = seriesId == null || seriesId === "" ? "" : String(seriesId);
      const nextUrl = nextSeriesId ? `/editor/series/edit/${encodeURIComponent(nextSeriesId)}` : "/editor/series/edit";
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` === nextUrl) return;
      void goto(nextUrl, {});
    }
    function resetSeriesDescriptionSections(series = null) {
      const nextSections = createDescriptionSectionDrafts(series || {});
      seriesDescriptionSections = nextSections.map((section) => ({ ...section, html: section.html || "" }));
      Math.max(getDescriptionFieldCount(series || {}), seriesDescriptionSections.length);
    }
    function seriesViewerUrl(seriesId = seriesDraft.id) {
      const nextSeriesId = seriesId == null || seriesId === "" ? "" : String(seriesId);
      return nextSeriesId ? `/viewer/series/${encodeURIComponent(nextSeriesId)}` : "/viewer/series";
    }
    async function uploadImages() {
      if (!seriesDraft.id) {
        error = "Save the series before uploading series images.";
        return;
      }
      if (!pendingImageFiles.length) {
        return;
      }
      error = "";
      success = "";
      saving = true;
      try {
        seriesImages = await uploadSeriesImages(seriesDraft.id, pendingImageFiles);
        pendingImageFiles = [];
        success = "Series images uploaded.";
      } catch (e) {
        error = e.message;
      } finally {
        saving = false;
      }
    }
    async function moveSeriesImage(index, direction) {
      if (!seriesDraft.id) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= seriesImages.length) return;
      const reordered = [...seriesImages];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      seriesImages = await reorderSeriesImages(seriesDraft.id, reordered.map((image) => image.id));
    }
    async function removeSeriesImage(image) {
      if (!seriesDraft.id) return;
      if (!window.confirm("Delete this series image?")) return;
      seriesImages = await deleteSeriesImage(seriesDraft.id, image.id);
    }
    filteredSeriesRecords = seriesProductTypeFilter ? seriesRecords.filter((item) => String(item.product_type_key || "") === String(seriesProductTypeFilter)) : seriesRecords;
    {
      const nextInitialSeriesId = initialSeriesId !== "" && initialSeriesId != null ? String(initialSeriesId) : "";
      if (nextInitialSeriesId !== appliedInitialSeriesId) {
        appliedInitialSeriesId = nextInitialSeriesId;
        selectedSeriesId = nextInitialSeriesId;
        pendingImageFiles = [];
        if (nextInitialSeriesId) {
          if (mode !== "create") {
            mode = "edit";
          }
          hydrateSelectedSeries(nextInitialSeriesId);
        } else if (mode !== "create" || seriesDraft.id) {
          seriesDraft = resetDraft();
          seriesImages = [];
          hydratedSeriesId = "";
          resetSeriesDescriptionSections();
        }
      }
    }
    if (mode === "edit" && String(selectedSeriesId) !== String(appliedSeriesEditorUrlId)) {
      appliedSeriesEditorUrlId = String(selectedSeriesId || "");
      syncSeriesEditorUrl(selectedSeriesId);
    }
    if (mode === "edit" && selectedSeriesId) {
      hydrateSelectedSeries();
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("plxnsv", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Series — Editor</title>`);
        });
      });
      $$renderer3.push(`<div class="row justify-content-center"><div class="col-12 col-xxl-12">`);
      if (error) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="alert alert-danger">${escape_html(error)}</div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (success) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="alert alert-success">${escape_html(success)}</div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <div class="card shadow-sm"><div class="card-body">`);
      if (mode === "edit") {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="series-picker-panel border rounded-3 p-3 mb-3"><div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-2 mb-3"><div><h3 class="h6 mb-1">Choose series</h3> <p class="text-body-secondary small mb-0">Use the filter to narrow the list, then pick the series you want to edit.
                  The series' own product type is still edited in the form below.</p></div></div> <div class="row g-3"><div class="col-12 col-md-4"><label class="form-label" for="series-product-type-filter">Filter by product type</label> `);
        $$renderer3.select(
          {
            class: "form-select",
            id: "series-product-type-filter",
            value: seriesProductTypeFilter
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`All product types`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array = ensure_array_like(productTypes);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let productType = each_array[$$index];
              $$renderer4.option({ value: productType.key }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(productType.label)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          }
        );
        $$renderer3.push(`</div> <div class="col-12 col-md-8"><label class="form-label" for="series-select">Select series</label> `);
        $$renderer3.select(
          {
            class: "form-select",
            id: "series-select",
            value: selectedSeriesId
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`-- Choose option --`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(filteredSeriesRecords);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let series = each_array_1[$$index_1];
              $$renderer4.option({ value: series.id }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(series.name)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          }
        );
        $$renderer3.push(`</div></div></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <div class="row g-3"><div class="col-12 col-md-6"><label class="form-label" for="series-name">Series name</label> <input class="form-control" id="series-name"${attr("value", seriesDraft.name)}/></div> <div class="col-12 col-md-6"><label class="form-label" for="series-type">Product type</label> `);
      $$renderer3.select(
        {
          class: "form-select",
          id: "series-type",
          value: seriesDraft.product_type_key
        },
        ($$renderer4) => {
          $$renderer4.option({ value: "" }, ($$renderer5) => {
            $$renderer5.push(`-- Choose option --`);
          });
          $$renderer4.push(`<!--[-->`);
          const each_array_2 = ensure_array_like(productTypes);
          for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
            let productType = each_array_2[$$index_2];
            $$renderer4.option({ value: productType.key }, ($$renderer5) => {
              $$renderer5.push(`${escape_html(productType.label)}`);
            });
          }
          $$renderer4.push(`<!--]-->`);
        }
      );
      $$renderer3.push(`</div> <div class="col-12 col-md-6"><label class="form-label" for="series-printed-template">Printed PDF template</label> `);
      $$renderer3.select(
        {
          class: "form-select",
          id: "series-printed-template",
          value: seriesDraft.printed_template_id
        },
        ($$renderer4) => {
          $$renderer4.option({ value: "" }, ($$renderer5) => {
            $$renderer5.push(`No template`);
          });
          $$renderer4.push(`<!--[-->`);
          const each_array_3 = ensure_array_like(templateRegistry.series_templates ?? []);
          for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
            let template = each_array_3[$$index_3];
            $$renderer4.option({ value: template.id }, ($$renderer5) => {
              $$renderer5.push(`${escape_html(template.label)}`);
            });
          }
          $$renderer4.push(`<!--]-->`);
        }
      );
      $$renderer3.push(`</div> <div class="col-12"><label class="form-label" for="series-contents-description">Contents page description</label> <!---->`);
      {
        RichTextEditor($$renderer3, {
          id: "series-contents-description",
          rows: 3,
          get value() {
            return seriesDraft.contents_description;
          },
          set value($$value) {
            seriesDraft.contents_description = $$value;
            $$settled = false;
          }
        });
      }
      $$renderer3.push(`<!----> <div class="form-text">Rich-text description used only on the product type PDF contents page.</div></div> <div class="col-12"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><div><div class="form-label mb-0">Description sections</div> <div class="form-text">Add or remove HTML blocks as this series needs. Maximum 10 description sections.</div></div> <button class="btn btn-outline-primary btn-sm" type="button"${attr("disabled", seriesDescriptionSections.length >= MAX_DESCRIPTION_SECTIONS, true)}>Add section</button></div> <div class="vstack gap-3"><!--[-->`);
      const each_array_4 = ensure_array_like(seriesDescriptionSections);
      for (let sectionIndex = 0, $$length = each_array_4.length; sectionIndex < $$length; sectionIndex++) {
        let section = each_array_4[sectionIndex];
        $$renderer3.push(`<!---->`);
        {
          $$renderer3.push(`<div class="border rounded p-3 bg-body-tertiary"><div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><label class="form-label mb-0"${attr("for", `series-description-${sectionIndex + 1}`)}>${escape_html(section.title)}</label> <button class="btn btn-outline-danger btn-sm" type="button"${attr("disabled", seriesDescriptionSections.length === 1, true)}>Remove</button></div> `);
          RichTextEditor($$renderer3, {
            id: `series-description-${sectionIndex + 1}`,
            rows: 3,
            get value() {
              return seriesDescriptionSections[sectionIndex].html;
            },
            set value($$value) {
              seriesDescriptionSections[sectionIndex].html = $$value;
              $$settled = false;
            }
          });
          $$renderer3.push(`<!----></div>`);
        }
        $$renderer3.push(`<!---->`);
      }
      $$renderer3.push(`<!--]--></div></div></div> <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary"${attr("disabled", saving || seriesHydrating || Boolean(seriesHydrationError), true)}>${escape_html(saving ? "Saving..." : seriesHydrating ? "Loading Series..." : "Save Series")}</button> `);
      if (seriesDraft.id) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<a class="btn btn-outline-primary"${attr("href", seriesViewerUrl(seriesDraft.id))}>View in Viewer</a>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (mode === "edit" && seriesDraft.id) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<button class="btn btn-outline-primary"${attr("disabled", saving, true)}>Duplicate Series</button> <button class="btn btn-outline-danger"${attr("disabled", saving, true)}>Delete Series</button>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <button class="btn btn-outline-secondary">Cancel</button></div> `);
      if (seriesHydrationError) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="alert alert-danger mt-3 mb-0">${escape_html(seriesHydrationError)}. The series cannot be saved until all description fields have loaded.</div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (mode === "edit" && seriesDraft.id) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="mt-3">`);
        SeriesMediaPanel($$renderer3, {
          seriesForm: seriesDraft,
          seriesImages,
          uploadImages,
          moveSeriesImage,
          removeSeriesImage,
          get pendingImageFiles() {
            return pendingImageFiles;
          },
          set pendingImageFiles($$value) {
            pendingImageFiles = $$value;
            $$settled = false;
          }
        });
        $$renderer3.push(`<!----></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div></div></div></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { initialMode, initialSeriesId });
  });
}
export {
  SeriesWorkspace as S
};
