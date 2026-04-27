<script>
  import { onMount } from 'svelte';
  import { createProductType, getProductTypes, refreshProductTypePdf, updateProductType } from '$lib/api.js';
  import SeriesNamesBadgeList from '$lib/editor/SeriesNamesBadgeList.svelte';

  export let initialMode = 'create';

  let productTypes = [];
  let selectedProductTypeId = '';
  let saving = false;
  let refreshingPdfId = null;
  let error = '';
  let success = '';
  let mode = initialMode;

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
      band_graph_background_color: productType?.band_graph_background_color ?? '#ffffff',
      band_graph_label_text_color: productType?.band_graph_label_text_color ?? '#000000',
      band_graph_faded_opacity:
        productType?.band_graph_faded_opacity ?? 0.18,
      band_graph_permissible_label_color: productType?.band_graph_permissible_label_color ?? '#000000'
    };
  }

  let productTypeDraft = resetDraft();

  $: selectedProductType = productTypes.find((item) => String(item.id) === String(selectedProductTypeId)) || null;

  function startCreate() {
    mode = 'create';
    selectedProductTypeId = '';
    productTypeDraft = resetDraft();
    error = '';
    success = '';
  }

  function startEdit() {
    mode = 'edit';
    selectedProductTypeId = '';
    productTypeDraft = resetDraft();
    error = '';
    success = '';
  }

  function cancelEditing() {
    mode = initialMode;
    selectedProductTypeId = '';
    productTypeDraft = resetDraft();
    error = '';
    success = '';
  }

  async function loadProductTypes() {
    try {
      productTypes = await getProductTypes();
    } catch (e) {
      error = e.message;
    }
  }

  function selectProductTypeFromUrl() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('product_type');
    if (requestedId) {
      selectedProductTypeId = requestedId;
    }
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
        await createProductType(body);
        success = 'Product type created.';
      }

      await loadProductTypes();
      cancelEditing();
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function generateProductTypePdf() {
    if (!selectedProductType?.id) return;
    refreshingPdfId = selectedProductType.id;
    error = '';
    success = '';
    try {
      await refreshProductTypePdf(selectedProductType.id);
      await loadProductTypes();
      success = 'Product type PDF generated.';
    } catch (e) {
      error = e.message;
    } finally {
      refreshingPdfId = null;
    }
  }

  onMount(async () => {
    selectProductTypeFromUrl();
    await loadProductTypes();
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
                  const selected = productTypes.find((item) => String(item.id) === event.currentTarget.value);
                  productTypeDraft = resetDraft(selected);
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
            <SeriesNamesBadgeList
              seriesNames={selectedProductType.series_names || []}
              title={`Series names for ${selectedProductType.label}`}
              emptyLabel="This product type does not have any series yet."
            />
          </div>
          <div class="d-flex flex-wrap gap-2 mt-3">
            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={generateProductTypePdf} disabled={refreshingPdfId === selectedProductType.id}>
              {refreshingPdfId === selectedProductType.id ? 'Generating...' : 'Generate Product Type PDF'}
            </button>
            {#if selectedProductType.product_type_pdf_url}
              <a class="btn btn-outline-primary btn-sm" href={selectedProductType.product_type_pdf_url} target="_blank" rel="noreferrer">
                Open Product Type PDF
              </a>
            {/if}
          </div>
        {/if}

        <div class="d-flex flex-wrap gap-2 mt-3">
          <button class="btn btn-primary" on:click={saveProductType} disabled={saving}>{saving ? 'Saving...' : 'Save Product Type'}</button>
          <button class="btn btn-outline-secondary" on:click={cancelEditing}>Cancel</button>
        </div>
      </div>
    </div>
  </div>
</div>
