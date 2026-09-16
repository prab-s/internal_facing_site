<script>
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { createProductType, deleteProductType, duplicateProductType, getProductTypes, getTemplates, startRefreshProductTypePdfJob, updateProductType } from '$lib/api.js';
  import JobProgressPanel from '$lib/JobProgressPanel.svelte';
  import AssociatedDocumentsPanel from '$lib/editor/AssociatedDocumentsPanel.svelte';
  import { runMaintenanceJob } from '$lib/maintenanceJobs.js';

  export let initialMode = 'create';
  export let initialProductTypeId = '';

  let productTypes = [];
  let templateRegistry = { product_templates: [], series_templates: [], product_type_templates: [] };
  let selectedProductTypeId = '';
  let saving = false;
  let refreshingPdfJob = null;
  let error = '';
  let success = '';
  let mode = initialMode;
  let destroyed = false;
  let hydratedProductTypeId = '';
  let appliedInitialProductTypeId = '';

  function syncProductTypeEditorUrl(productTypeId) {
    if (typeof window === 'undefined') return;
    const nextProductTypeId = productTypeId == null || productTypeId === '' ? '' : String(productTypeId);
    const nextUrl = nextProductTypeId ? `/editor/product-types/edit/${encodeURIComponent(nextProductTypeId)}` : '/editor/product-types/edit';
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` === nextUrl) return;
    void goto(nextUrl, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function productTypeViewerUrl(productTypeId = selectedProductType?.id) {
    const nextProductTypeId = productTypeId == null || productTypeId === '' ? '' : String(productTypeId);
    return nextProductTypeId ? `/viewer/product-type/${encodeURIComponent(nextProductTypeId)}` : '/viewer/product-type';
  }

  function describeDeleteImpact(productType) {
    const seriesCount = Number(productType?.series_count || 0);
    const productCount = Number(productType?.product_count || 0);
    const details = [];

    if (seriesCount > 0) {
      details.push(`${seriesCount} ${seriesCount === 1 ? 'series' : 'series'} will be deleted`);
    }

    if (productCount > 0) {
      details.push(`${productCount} ${productCount === 1 ? 'product' : 'products'} will be unassigned from this type`);
    }

    if (!details.length) {
      return 'This product type has no linked series or products.';
    }

    return details.join(' and ') + '.';
  }

  function resetDraft(productType = null) {
    return {
      id: productType?.id ?? null,
      key: productType?.key ?? '',
      label: productType?.label ?? '',
      supports_graph: productType?.supports_graph ?? false,
      graph_kind: productType?.graph_kind ?? '',
      supports_graph_overlays: productType?.supports_graph_overlays ?? false,
      supports_band_graph_style: productType?.supports_band_graph_style ?? false,
      graph_line_value_label: productType?.graph_line_value_label ?? '',
      graph_line_value_unit: productType?.graph_line_value_unit ?? '',
      graph_x_axis_label: productType?.graph_x_axis_label ?? '',
      graph_x_axis_unit: productType?.graph_x_axis_unit ?? '',
      graph_y_axis_label: productType?.graph_y_axis_label ?? '',
      graph_y_axis_unit: productType?.graph_y_axis_unit ?? '',
      product_type_template_id: productType?.product_type_template_id ?? '',
      product_type_pdf_series_order: Array.isArray(productType?.product_type_pdf_series_order)
        ? [...productType.product_type_pdf_series_order]
        : [],
      contents_icon_url: productType?.contents_icon_url ?? '',
      band_graph_background_color: productType?.band_graph_background_color ?? '#ffffff',
      band_graph_label_text_color: productType?.band_graph_label_text_color ?? '#000000',
      band_graph_faded_opacity:
        productType?.band_graph_faded_opacity ?? 0.18,
      band_graph_permissible_label_color: productType?.band_graph_permissible_label_color ?? '#000000'
    };
  }

  let productTypeDraft = resetDraft();

  $: selectedProductType = productTypes.find((item) => String(item.id) === String(selectedProductTypeId)) || null;

  function calculateOrderedSeriesForPdf(productType, configuredOrder) {
    const series = [...(productType?.series || [])].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
    );
    const byId = new Map(series.map((item) => [String(item.id), item]));
    const order = Array.isArray(configuredOrder) ? configuredOrder : [];
    const explicit = order
      .map((id) => byId.get(String(id)))
      .filter((item, index, items) => item && items.findIndex((candidate) => candidate.id === item.id) === index);
    const explicitIds = new Set(explicit.map((item) => String(item.id)));
    return [...explicit, ...series.filter((item) => !explicitIds.has(String(item.id)))];
  }

  $: orderedPdfSeries = calculateOrderedSeriesForPdf(
    selectedProductType,
    productTypeDraft.product_type_pdf_series_order
  );

  function moveSeriesInPdfOrder(index, direction) {
    const ordered = orderedPdfSeries;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const nextOrder = ordered.map((item) => item.id);
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
    productTypeDraft = { ...productTypeDraft, product_type_pdf_series_order: nextOrder };
  }

  function hydrateSelectedProductType(productTypeId = selectedProductTypeId) {
    const normalizedProductTypeId = productTypeId == null || productTypeId === '' ? '' : String(productTypeId);
    if (!normalizedProductTypeId) {
      hydratedProductTypeId = '';
      if (productTypeDraft.id) {
        productTypeDraft = resetDraft();
      }
      return;
    }

    const selected = productTypes.find((item) => String(item.id) === normalizedProductTypeId);
    if (!selected) {
      return;
    }

    if (hydratedProductTypeId === normalizedProductTypeId && String(productTypeDraft.id || '') === normalizedProductTypeId) {
      return;
    }

    hydratedProductTypeId = normalizedProductTypeId;
    productTypeDraft = resetDraft(selected);
  }

  function startCreate() {
    mode = 'create';
    selectedProductTypeId = '';
    productTypeDraft = resetDraft();
    hydratedProductTypeId = '';
    error = '';
    success = '';
  }

  function startEdit() {
    mode = 'edit';
    selectedProductTypeId = '';
    productTypeDraft = resetDraft();
    hydratedProductTypeId = '';
    error = '';
    success = '';
  }

  function cancelEditing() {
    mode = initialMode;
    selectedProductTypeId = '';
    productTypeDraft = resetDraft();
    hydratedProductTypeId = '';
    syncProductTypeEditorUrl('');
    error = '';
    success = '';
  }

  async function loadProductTypes() {
    try {
      [productTypes, templateRegistry] = await Promise.all([getProductTypes(), getTemplates()]);
      if (mode === 'edit' && selectedProductTypeId) {
        const selected = productTypes.find((item) => String(item.id) === String(selectedProductTypeId));
        if (selected) hydrateSelectedProductType();
        else error = 'Product type not found.';
      }
    } catch (e) {
      error = e.message;
    }
  }

  function selectProductTypeFromUrl() {
    if (typeof window === 'undefined') return;
    const pathMatch = window.location.pathname.match(/^\/editor\/product-types\/edit\/([^/]+)$/);
    if (pathMatch?.[1]) {
      selectedProductTypeId = decodeURIComponent(pathMatch[1]);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('product_type');
    if (requestedId) {
      selectedProductTypeId = requestedId;
    }
  }

  $: {
    const nextInitialProductTypeId =
      initialProductTypeId !== '' && initialProductTypeId != null
        ? String(initialProductTypeId)
        : '';
    if (nextInitialProductTypeId !== appliedInitialProductTypeId) {
      appliedInitialProductTypeId = nextInitialProductTypeId;
      if (nextInitialProductTypeId) {
        selectedProductTypeId = nextInitialProductTypeId;
        if (mode !== 'create') {
          mode = 'edit';
        }
      } else if (mode !== 'create' || selectedProductTypeId) {
        selectedProductTypeId = '';
        productTypeDraft = resetDraft();
        hydratedProductTypeId = '';
        mode = 'edit';
      }
    }
  }

  $: if (mode === 'edit' && selectedProductTypeId) {
    hydrateSelectedProductType();
  }

  async function saveProductType() {
    error = '';
    success = '';
    saving = true;
    try {
      const body = {
        key: productTypeDraft.key || null,
        label: productTypeDraft.label,
        supports_graph: !!productTypeDraft.supports_graph,
        graph_kind: productTypeDraft.graph_kind || null,
        supports_graph_overlays: !!productTypeDraft.supports_graph_overlays,
        supports_band_graph_style: !!productTypeDraft.supports_band_graph_style,
        graph_line_value_label: productTypeDraft.graph_line_value_label || null,
        graph_line_value_unit: productTypeDraft.graph_line_value_unit || null,
        graph_x_axis_label: productTypeDraft.graph_x_axis_label || null,
        graph_x_axis_unit: productTypeDraft.graph_x_axis_unit || null,
        graph_y_axis_label: productTypeDraft.graph_y_axis_label || null,
        graph_y_axis_unit: productTypeDraft.graph_y_axis_unit || null,
        product_type_template_id: productTypeDraft.product_type_template_id || null,
        product_type_pdf_series_order: productTypeDraft.product_type_pdf_series_order || [],
        contents_icon_url: productTypeDraft.contents_icon_url || null,
        band_graph_background_color: productTypeDraft.band_graph_background_color || null,
        band_graph_label_text_color: productTypeDraft.band_graph_label_text_color || null,
        band_graph_faded_opacity:
          productTypeDraft.band_graph_faded_opacity === '' || productTypeDraft.band_graph_faded_opacity == null
            ? null
            : Number(productTypeDraft.band_graph_faded_opacity),
        band_graph_permissible_label_color: productTypeDraft.band_graph_permissible_label_color || null
      };

      if (mode === 'edit' && !productTypeDraft.id) {
        error = 'Choose a product type first.';
        return;
      }

      if (productTypeDraft.id) {
        await updateProductType(productTypeDraft.id, body);
        success = 'Product type updated.';
      } else {
        const created = await createProductType(body);
        productTypeDraft = resetDraft(created);
        selectedProductTypeId = created?.id ?? '';
        mode = 'edit';
        success = 'Product type created.';
      }

      await loadProductTypes();
      if (productTypeDraft.id) {
        selectedProductTypeId = productTypeDraft.id;
        mode = 'edit';
        syncProductTypeEditorUrl(productTypeDraft.id);
        hydrateSelectedProductType(productTypeDraft.id);
      }
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function deleteCurrentProductType() {
    if (!productTypeDraft.id) return;
    const confirmed = window.confirm(
      `Delete product type "${productTypeDraft.label || productTypeDraft.key || productTypeDraft.id}"? This cannot be undone.\n\n${describeDeleteImpact(selectedProductType || productTypeDraft)}`
    );
    if (!confirmed) return;

    error = '';
    success = '';
    saving = true;
    try {
      await deleteProductType(productTypeDraft.id);
      await loadProductTypes();
      mode = initialMode;
      selectedProductTypeId = '';
      productTypeDraft = resetDraft();
      hydratedProductTypeId = '';
      syncProductTypeEditorUrl('');
      success = 'Product type deleted.';
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function duplicateCurrentProductType() {
    if (!productTypeDraft.id) return;
    error = '';
    success = '';
    saving = true;
    try {
      const copied = await duplicateProductType(productTypeDraft.id);
      await loadProductTypes();
      selectedProductTypeId = copied.id;
      mode = 'edit';
      syncProductTypeEditorUrl(copied.id);
      hydrateSelectedProductType(copied.id);
      success = 'Product type duplicated. Rename the copy and save your changes.';
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function generateProductTypePdf() {
    if (!selectedProductType?.id) return;
    refreshingPdfJob = null;
    error = '';
    success = '';
    try {
      const job = await runMaintenanceJob(
        () => startRefreshProductTypePdfJob(selectedProductType.id),
        {
          isCancelled: () => destroyed,
          onUpdate: (nextJob) => {
            refreshingPdfJob = nextJob;
          }
        }
      );
      refreshingPdfJob = job;
      await loadProductTypes();
      success = 'Product type PDF generated.';
    } catch (e) {
      error = e.message;
    } finally {
      if (!destroyed) {
        refreshingPdfJob = null;
      }
    }
  }

  onMount(async () => {
    selectProductTypeFromUrl();
    await loadProductTypes();
  });

  onDestroy(() => {
    destroyed = true;
  });
</script>

<svelte:head>
  <title>Product Types — Editor</title>
</svelte:head>

<div class="row justify-content-center">
  <div class="col-12 col-xxl-12">
    {#if error}
      <div class="alert alert-danger">{error}</div>
    {/if}
    {#if success}
      <div class="alert alert-success">{success}</div>
    {/if}

    <div class="card shadow-sm">
      <div class="card-body">
        {#if mode === 'edit'}
          <div class="row g-3 mb-3">
            <div class="col-12 col-md-6">
              <label class="form-label" for="product-type-select">Select product type</label>
              <select
                class="form-select"
                id="product-type-select"
                bind:value={selectedProductTypeId}
                on:change={(event) => {
                  mode = 'edit';
                  hydrateSelectedProductType(event.currentTarget.value);
                  syncProductTypeEditorUrl(event.currentTarget.value);
                }}
              >
                <option value="">-- Choose option --</option>
                {#each productTypes as productType}
                  <option value={productType.id}>{productType.label}</option>
                {/each}
              </select>
            </div>
          </div>
        {/if}

        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label" for="product-type-label">Label</label>
            <input class="form-control" id="product-type-label" bind:value={productTypeDraft.label} />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="product-type-key">Key</label>
            <input class="form-control" id="product-type-key" bind:value={productTypeDraft.key} placeholder="auto from label if blank" />
          </div>
          <div class="col-12 col-md-4">
            <div class="form-check form-switch mt-4">
              <input class="form-check-input" id="product-type-supports-graph" type="checkbox" bind:checked={productTypeDraft.supports_graph} />
              <label class="form-check-label" for="product-type-supports-graph">Supports graph</label>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="form-check form-switch mt-4">
              <input class="form-check-input" id="product-type-overlays" type="checkbox" bind:checked={productTypeDraft.supports_graph_overlays} />
              <label class="form-check-label" for="product-type-overlays">Supports overlays</label>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="form-check form-switch mt-4">
              <input class="form-check-input" id="product-type-band" type="checkbox" bind:checked={productTypeDraft.supports_band_graph_style} />
              <label class="form-check-label" for="product-type-band">Supports band graph style</label>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="product-type-template">Product type PDF template</label>
            <select class="form-select" id="product-type-template" bind:value={productTypeDraft.product_type_template_id}>
              <option value="">Use default template</option>
              {#each templateRegistry.product_type_templates ?? [] as template}
                <option value={template.id}>{template.label}</option>
              {/each}
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="product-type-contents-icon">Contents icon URL</label>
            <input class="form-control" id="product-type-contents-icon" bind:value={productTypeDraft.contents_icon_url} placeholder="https://... or data:image/svg+xml,..."/>
          </div>
          <div class="col-12">
            <hr class="my-2" />
            <p class="text-body-secondary mb-0">Band graph style defaults</p>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="product-type-band-graph-background">Background colour</label>
            <div class="input-group">
              <input class="form-control form-control-color" id="product-type-band-graph-background" type="color" bind:value={productTypeDraft.band_graph_background_color} />
              <input class="form-control" type="text" bind:value={productTypeDraft.band_graph_background_color} placeholder="#ffffff" />
            </div>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="product-type-band-graph-label">Label text colour</label>
            <div class="input-group">
              <input class="form-control form-control-color" id="product-type-band-graph-label" type="color" bind:value={productTypeDraft.band_graph_label_text_color} />
              <input class="form-control" type="text" bind:value={productTypeDraft.band_graph_label_text_color} placeholder="#000000" />
            </div>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="product-type-band-graph-permissible">Permissible label colour</label>
            <div class="input-group">
              <input class="form-control form-control-color" id="product-type-band-graph-permissible" type="color" bind:value={productTypeDraft.band_graph_permissible_label_color} />
              <input class="form-control" type="text" bind:value={productTypeDraft.band_graph_permissible_label_color} placeholder="#000000" />
            </div>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="product-type-band-graph-opacity">Faded area opacity</label>
            <input class="form-control" id="product-type-band-graph-opacity" type="number" min="0" max="1" step="0.01" bind:value={productTypeDraft.band_graph_faded_opacity} />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="product-type-graph-kind">Graph kind</label>
            <input class="form-control" id="product-type-graph-kind" bind:value={productTypeDraft.graph_kind} placeholder="e.g. fan_map" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="product-type-line-label">Line value label</label>
            <input class="form-control" id="product-type-line-label" bind:value={productTypeDraft.graph_line_value_label} />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="product-type-line-unit">Line value unit</label>
            <input class="form-control" id="product-type-line-unit" bind:value={productTypeDraft.graph_line_value_unit} />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label" for="product-type-x-label">X axis label</label>
            <input class="form-control" id="product-type-x-label" bind:value={productTypeDraft.graph_x_axis_label} />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label" for="product-type-x-unit">X axis unit</label>
            <input class="form-control" id="product-type-x-unit" bind:value={productTypeDraft.graph_x_axis_unit} />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label" for="product-type-y-label">Y axis label</label>
            <input class="form-control" id="product-type-y-label" bind:value={productTypeDraft.graph_y_axis_label} />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label" for="product-type-y-unit">Y axis unit</label>
            <input class="form-control" id="product-type-y-unit" bind:value={productTypeDraft.graph_y_axis_unit} />
          </div>
        </div>

        {#if selectedProductType}
          <div class="mt-4">
            <div class="card shadow-sm">
              <div class="card-body">
                <h3 class="h6 mb-2">Series order for Product Type PDFs</h3>
                <p class="text-body-secondary small">Move selected series to the front in the order shown. Any series not explicitly moved remains alphabetical.</p>
                {#if orderedPdfSeries.length}
                  <ol class="list-group list-group-numbered">
                    {#each orderedPdfSeries as series, index (series.id)}
                      <li class="list-group-item d-flex align-items-center justify-content-between gap-2">
                        <span>{series.name}</span>
                        <span class="d-flex gap-1">
                          <button class="btn btn-outline-secondary btn-sm" type="button" aria-label={`Move ${series.name} up`} on:click={() => moveSeriesInPdfOrder(index, -1)} disabled={index === 0}>↑</button>
                          <button class="btn btn-outline-secondary btn-sm" type="button" aria-label={`Move ${series.name} down`} on:click={() => moveSeriesInPdfOrder(index, 1)} disabled={index === orderedPdfSeries.length - 1}>↓</button>
                        </span>
                      </li>
                    {/each}
                  </ol>
                {:else}
                  <p class="text-body-secondary mb-0">This product type does not have any series yet.</p>
                {/if}
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-3">
            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={generateProductTypePdf} disabled={refreshingPdfJob?.status === 'running'}>
              {refreshingPdfJob?.status === 'running' ? 'Generating...' : 'Generate Product Type PDF'}
            </button>
            <JobProgressPanel job={refreshingPdfJob} label="Product type PDF generation" />
            {#if selectedProductType.product_type_pdf_url}
              <a class="btn btn-outline-primary btn-sm" href={selectedProductType.product_type_pdf_url} target="_blank" rel="noreferrer">
                Open Product Type PDF
              </a>
            {/if}
            <a class="btn btn-outline-primary btn-sm" href={productTypeViewerUrl(selectedProductType.id)}>
              View in Viewer
            </a>
          </div>
        {/if}

        <div class="d-flex flex-wrap gap-2 mt-3">
          <button class="btn btn-primary" on:click={saveProductType} disabled={saving}>{saving ? 'Saving...' : 'Save Product Type'}</button>
          {#if productTypeDraft.id}
            <button class="btn btn-outline-primary" type="button" on:click={duplicateCurrentProductType} disabled={saving}>
              Duplicate Product Type
            </button>
            <button class="btn btn-outline-danger" type="button" on:click={deleteCurrentProductType} disabled={saving}>
              Delete Product Type
            </button>
          {/if}
          <button class="btn btn-outline-secondary" on:click={cancelEditing}>Cancel</button>
        </div>
        {#if productTypeDraft.id}
          <div class="mt-3">
            <AssociatedDocumentsPanel ownerType="product_type" ownerId={productTypeDraft.id} />
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
