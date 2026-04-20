<script>
  import { onMount } from 'svelte';
  import {
    getProductChartData,
    getProduct,
    getProducts,
    getProductTypes,
    getSeries,
    refreshGraphImage,
    refreshProductPdf,
    refreshSeriesGraphImage,
    refreshSeriesPdf
  } from '$lib/api.js';
  import ECharts from '$lib/ECharts.svelte';
  import { getChartTheme, theme } from '$lib/config.js';
  import { buildFullChartOption } from '$lib/fullChart.js';

  let products = [];
  let productTypes = [];
  let seriesRecords = [];
  let selectedProductId = null;
  let rpmLines = [];
  let rpmPoints = [];
  let efficiencyPoints = [];
  let chartOption = {};
  let loadingList = true;
  let loadingChart = false;
  let error = '';
  let success = '';

  let search = '';
  let productTypeFilter = '';
  let seriesFilter = '';
  let filteredProducts = [];
  let seriesOptions = [];
  let selectedProduct = null;
  let activeViewerTab = 'product';
  let seriesTabProductTypeFilter = '';
  let seriesTabSeriesId = '';
  let seriesTabOptions = [];
  let selectedSeriesRecord = null;

  let refreshingProductGraphId = null;
  let refreshingProductPdfId = null;
  let refreshingSeriesGraphId = null;
  let refreshingSeriesPdfId = null;

  function getCurrentProductType() {
    return productTypes.find((item) => item.key === selectedProduct?.product_type_key) || null;
  }

  function getCurrentGraphConfig() {
    const productType = getCurrentProductType();
    return productType
      ? {
          graph_kind: productType.graph_kind,
          supports_graph_overlays: productType.supports_graph_overlays,
          supports_band_graph_style: productType.supports_band_graph_style,
          graph_line_value_label: productType.graph_line_value_label,
          graph_line_value_unit: productType.graph_line_value_unit,
          graph_x_axis_label: productType.graph_x_axis_label,
          graph_x_axis_unit: productType.graph_x_axis_unit,
          graph_y_axis_label: productType.graph_y_axis_label,
          graph_y_axis_unit: productType.graph_y_axis_unit
        }
      : null;
  }

  function supportsGraphOverlays() {
    return getCurrentProductType()?.supports_graph_overlays ?? true;
  }

  function supportsBandGraphStyle() {
    return getCurrentProductType()?.supports_band_graph_style ?? true;
  }

  function graphHeading() {
    const productType = getCurrentProductType();
    if (!productType) return 'Product graph';
    if (productType.graph_kind === 'silencer_loss') return 'Volume flow vs pressure loss';
    if (productType.graph_kind === 'fan_map') return 'Airflow vs pressure';
    return `${productType.label} graph`;
  }

  function buildProductSeriesOptions() {
    const options = new Map();

    for (const series of seriesRecords) {
      if (productTypeFilter && series.product_type_key !== productTypeFilter) continue;
      options.set(String(series.id ?? series.name), series);
    }

    for (const product of products) {
      if (!product.series_name && !product.series_id) continue;
      if (productTypeFilter && product.product_type_key !== productTypeFilter) continue;

      const key = String(product.series_id ?? product.series_name);
      if (!options.has(key)) {
        options.set(key, {
          id: product.series_id ?? null,
          name: product.series_name || 'Unnamed series',
          product_type_key: product.product_type_key
        });
      }
    }

    return [...options.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  function formatParameterValue(parameter) {
    if (parameter.value_string) return parameter.value_string;
    if (parameter.value_number != null) {
      return `${parameter.value_number}${parameter.unit ? ` ${parameter.unit}` : ''}`;
    }
    return '—';
  }

  function buildChartOptions() {
    const currentProduct = selectedProduct;
    const chartTheme = getChartTheme($theme);
    chartOption = buildFullChartOption({
      rpmLines,
      rpmPoints,
      efficiencyPoints,
      chartTheme,
      title: currentProduct ? currentProduct.model : 'Product Graph',
      graphConfig: getCurrentGraphConfig(),
      clipRpmAreaToPermissibleUse: true,
      showRpmBandShading: supportsBandGraphStyle() ? (currentProduct?.show_rpm_band_shading ?? true) : false,
      showSecondaryAxis: supportsGraphOverlays(),
      adaptGraphBackgroundToTheme: true,
      graphStyle: currentProduct
        ? {
            band_graph_background_color: currentProduct.band_graph_background_color,
            band_graph_label_text_color: currentProduct.band_graph_label_text_color,
            band_graph_faded_opacity: currentProduct.band_graph_faded_opacity,
            band_graph_permissible_label_color: currentProduct.band_graph_permissible_label_color
          }
        : null
    });
  }

  async function loadEverything() {
    loadingList = true;
    error = '';
    try {
      products = await getProducts();
      try {
        productTypes = await getProductTypes();
      } catch {
        productTypes = [];
      }
      try {
        seriesRecords = await getSeries();
      } catch {
        seriesRecords = [];
      }
      if (!selectedProductId) {
        selectedProductId = products[0]?.id != null ? Number(products[0].id) : null;
      }
    } catch (e) {
      error = e.message;
    } finally {
      loadingList = false;
    }
  }

  async function loadChartData() {
    if (!selectedProductId) {
      rpmLines = [];
      rpmPoints = [];
      efficiencyPoints = [];
      chartOption = {};
      return;
    }

    loadingChart = true;
    error = '';
    try {
      const chartData = await getProductChartData(selectedProductId);
      rpmLines = chartData.rpmLines;
      rpmPoints = chartData.rpmPoints;
      efficiencyPoints = chartData.efficiencyPoints;
      buildChartOptions();
    } catch (e) {
      error = e.message;
    } finally {
      loadingChart = false;
    }
  }

  async function regenerateProductGraph(product) {
    refreshingProductGraphId = product.id;
    error = '';
    success = '';
    try {
      await refreshGraphImage(product.id);
      await loadEverything();
      if (Number(selectedProductId) === Number(product.id)) {
        await loadChartData();
      }
      success = `Generated graph for ${product.model}.`;
    } catch (e) {
      error = e.message;
    } finally {
      refreshingProductGraphId = null;
    }
  }

  async function regenerateProductPdf(product) {
    refreshingProductPdfId = product.id;
    error = '';
    success = '';
    try {
      await refreshProductPdf(product.id);
      await loadEverything();
      success = `Generated PDF for ${product.model}.`;
    } catch (e) {
      error = e.message;
    } finally {
      refreshingProductPdfId = null;
    }
  }

  async function regenerateSeriesGraph(series) {
    refreshingSeriesGraphId = series.id;
    error = '';
    success = '';
    try {
      await refreshSeriesGraphImage(series.id);
      await loadEverything();
      success = `Generated series graph for ${series.name}.`;
    } catch (e) {
      error = e.message;
    } finally {
      refreshingSeriesGraphId = null;
    }
  }

  async function regenerateSeriesPdfAsset(series) {
    refreshingSeriesPdfId = series.id;
    error = '';
    success = '';
    try {
      await refreshSeriesPdf(series.id);
      await loadEverything();
      success = `Generated series PDF for ${series.name}.`;
    } catch (e) {
      error = e.message;
    } finally {
      refreshingSeriesPdfId = null;
    }
  }

  function clearFilters() {
    search = '';
    productTypeFilter = '';
    seriesFilter = '';
  }

  function selectProduct(product) {
    selectedProductId = product?.id != null ? Number(product.id) : null;
  }

  async function loadSeriesOptions() {
    try {
      const explicitSeries = await getSeries(productTypeFilter ? { product_type_key: productTypeFilter } : {});
      seriesRecords = explicitSeries;
    } catch {
      seriesRecords = [];
    }
    seriesOptions = buildProductSeriesOptions();
    if (
      seriesFilter &&
      !seriesOptions.some(
        (series) =>
          Number(series.id) === Number(seriesFilter) ||
          String(series.name || '') === String(seriesFilter)
      )
    ) {
      seriesFilter = '';
    }
  }

  async function loadSeriesTabOptions() {
    try {
      seriesTabOptions = await getSeries(
        seriesTabProductTypeFilter ? { product_type_key: seriesTabProductTypeFilter } : {}
      );
    } catch {
      seriesTabOptions = [];
    }

    if (
      seriesTabSeriesId &&
      !seriesTabOptions.some((series) => Number(series.id) === Number(seriesTabSeriesId))
    ) {
      seriesTabSeriesId = '';
    }

  }

  async function loadFilteredProducts() {
    loadingList = true;
    error = '';
    try {
      const params = {};
      if (search) params.search = search;
      if (productTypeFilter) params.product_type_key = productTypeFilter;
      if (seriesFilter && !Number.isNaN(Number(seriesFilter))) {
        params.series_id = String(seriesFilter);
      }
      products = await getProducts(params);
      filteredProducts = [...products].sort((a, b) => {
        const typeCompare = String(a.product_type_label || '').localeCompare(String(b.product_type_label || ''));
        if (typeCompare !== 0) return typeCompare;
        const seriesCompare = String(a.series_name || '').localeCompare(String(b.series_name || ''));
        if (seriesCompare !== 0) return seriesCompare;
        return String(a.model || '').localeCompare(String(b.model || ''));
      });

      if (selectedProductId && !filteredProducts.some((product) => Number(product.id) === Number(selectedProductId))) {
        selectedProductId = filteredProducts[0]?.id != null ? Number(filteredProducts[0].id) : null;
      }
      if (!selectedProductId && filteredProducts.length) {
        selectedProductId = Number(filteredProducts[0].id);
      }
    } catch (e) {
      error = e.message;
      products = [];
      filteredProducts = [];
    } finally {
      loadingList = false;
    }
  }

  async function loadSelectedProduct() {
    if (!selectedProductId) {
      selectedProduct = null;
      rpmLines = [];
      rpmPoints = [];
      efficiencyPoints = [];
      chartOption = {};
      return;
    }
    error = '';
    try {
      selectedProduct = await getProduct(selectedProductId);
    } catch (e) {
      error = e.message;
      selectedProduct = null;
    }
  }

  $: if (selectedProduct, $theme, productTypes) {
    buildChartOptions();
  }

  let previousProductTypeFilter = '';
  let previousFilterKey = '';
  let previousSelectedProductId = null;
  let previousSeriesTabProductTypeFilter = '';

  $: if (productTypeFilter !== previousProductTypeFilter) {
    previousProductTypeFilter = productTypeFilter;
    seriesFilter = '';
    loadSeriesOptions();
  }

  $: if (seriesTabProductTypeFilter !== previousSeriesTabProductTypeFilter) {
    previousSeriesTabProductTypeFilter = seriesTabProductTypeFilter;
    seriesTabSeriesId = '';
    loadSeriesTabOptions();
  }

  $: {
    const filterKey = JSON.stringify({
      search,
      productTypeFilter,
      seriesFilter
    });
    if (filterKey !== previousFilterKey) {
      previousFilterKey = filterKey;
      loadFilteredProducts();
    }
  }

  $: if (selectedProductId !== previousSelectedProductId) {
    previousSelectedProductId = selectedProductId;
    loadSelectedProduct();
    loadChartData();
  }

  $: selectedSeriesRecord =
    seriesTabOptions.find((series) => Number(series.id) === Number(seriesTabSeriesId)) || null;

  onMount(async () => {
    await loadEverything();
    await loadSeriesOptions();
    await loadSeriesTabOptions();
    await loadFilteredProducts();
  });
</script>

<svelte:head>
  <title>Viewer — Internal Facing</title>
</svelte:head>

<div class="page-stack">
  <div class="mb-3">
    <div class="col-12 col-xxl-8">
      <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Review & Generate</p>
      <h1>Viewer</h1>
      <p class="text-body-secondary mb-0">
        Filter products, select a record, and review all of its information, images, graph output, PDF output, and series data.
      </p>
    </div>
  </div>

  {#if error}
    <div class="alert alert-danger mb-0">{error}</div>
  {/if}

  {#if success}
    <div class="alert alert-success mb-0">{success}</div>
  {/if}

  <ul class="nav nav-tabs">
    <li class="nav-item">
      <button
        class:active={activeViewerTab === 'product'}
        class="nav-link"
        type="button"
        on:click={() => (activeViewerTab = 'product')}
      >
        Product
      </button>
    </li>
    <li class="nav-item">
      <button
        class:active={activeViewerTab === 'series'}
        class="nav-link"
        type="button"
        on:click={() => (activeViewerTab = 'series')}
      >
        Series
      </button>
    </li>
  </ul>

  {#if activeViewerTab === 'product'}
    <div class="row g-3 align-items-start">
      <div class="col-12 col-xxl-4">
        <div class="vstack gap-3 viewer-sidebar">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="row g-3 align-items-end">
                <div class="col-12">
                  <label class="form-label" for="viewer-search">Search</label>
                  <input class="form-control" id="viewer-search" bind:value={search} placeholder="Model, series, mounting, discharge" />
                </div>
                <div class="col-12">
                  <label class="form-label" for="viewer-product-type">Product type</label>
                  <select class="form-select" id="viewer-product-type" bind:value={productTypeFilter}>
                    <option value="">All types</option>
                    {#each productTypes as productType}
                      <option value={productType.key}>{productType.label}</option>
                    {/each}
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label" for="viewer-series">Series</label>
                  <select class="form-select" id="viewer-series" bind:value={seriesFilter}>
                <option value="">-- Choose option --</option>
                {#each seriesOptions as series}
                  <option value={series.id ?? series.name}>{series.name}</option>
                {/each}
                  </select>
                </div>
                <div class="col-12 d-grid">
                  <button class="btn btn-outline-secondary" on:click={clearFilters}>Clear</button>
                </div>
              </div>
            </div>
          </div>

          <div class="card shadow-sm">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
                <div>
                  <h2 class="h5 mb-1">Products</h2>
                  <p class="text-body-secondary mb-0">Choose a product to load its information.</p>
                </div>
                {#if loadingList}
                  <span class="small text-body-secondary">Loading…</span>
                {/if}
              </div>

              {#if !loadingList && filteredProducts.length === 0}
                <p class="text-body-secondary mb-0">No products match the current filters.</p>
              {:else}
                <div class="table-responsive">
                  <table class="table table-sm align-middle viewer-list-table mb-0">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Series</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each filteredProducts as product}
                        <tr class:selected-row={Number(product.id) === Number(selectedProductId)} on:click={() => selectProduct(product)}>
                          <td>
                            <button class="btn btn-link p-0 text-start text-decoration-none fw-semibold viewer-select-button" type="button" on:click|stopPropagation={() => selectProduct(product)}>
                              {product.model}
                            </button>
                          </td>
                          <td>{product.product_type_label || product.product_type_key}</td>
                          <td>{product.series_name || '—'}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <div class="col-12 col-xxl-8">
        <div class="vstack gap-3">
      {#if selectedProduct}
      {@const currentProduct = selectedProduct}
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-start gap-2">
            <div class="me-auto">
              <h2 class="h4 mb-1">{currentProduct.model}</h2>
              <div class="text-body-secondary">
                {currentProduct.product_type_label || currentProduct.product_type_key}
                {#if currentProduct.series_name} · {currentProduct.series_name}{/if}
              </div>
            </div>
            <button class="btn btn-outline-secondary btn-sm" on:click={() => regenerateProductGraph(currentProduct)} disabled={refreshingProductGraphId === currentProduct.id}>
              {refreshingProductGraphId === currentProduct.id ? 'Generating Graph...' : 'Generate Graph'}
            </button>
            <button class="btn btn-outline-secondary btn-sm" on:click={() => regenerateProductPdf(currentProduct)} disabled={refreshingProductPdfId === currentProduct.id}>
              {refreshingProductPdfId === currentProduct.id ? 'Generating PDF...' : 'Generate PDF'}
            </button>
            {#if currentProduct.graph_image_url}
              <a class="btn btn-outline-secondary btn-sm" href={currentProduct.graph_image_url} target="_blank" rel="noreferrer">Open Graph</a>
            {/if}
            {#if currentProduct.product_pdf_url}
              <a class="btn btn-outline-secondary btn-sm" href={currentProduct.product_pdf_url} target="_blank" rel="noreferrer">Open PDF</a>
            {/if}
          </div>

          <div class="row g-3 mt-1">
            <div class="col-12 col-md-3">
              <div class="viewer-metric">
                <div class="viewer-metric-label">Product Type</div>
                <div>{currentProduct.product_type_label || currentProduct.product_type_key || '—'}</div>
              </div>
            </div>
            <div class="col-12 col-md-3">
              <div class="viewer-metric">
                <div class="viewer-metric-label">Series</div>
                <div>{currentProduct.series_name || '—'}</div>
              </div>
            </div>
            <div class="col-12 col-md-3">
              <div class="viewer-metric">
                <div class="viewer-metric-label">Mounting</div>
                <div>{currentProduct.mounting_style || '—'}</div>
              </div>
            </div>
            <div class="col-12 col-md-3">
              <div class="viewer-metric">
                <div class="viewer-metric-label">Discharge</div>
                <div>{currentProduct.discharge_type || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <div class="card shadow-sm h-100">
            <div class="card-body">
              <h3 class="h6">Description1</h3>
              <div class="viewer-html">{@html currentProduct.description1_html || '<p class="text-body-secondary mb-0">Not provided.</p>'}</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card shadow-sm h-100">
            <div class="card-body">
              <h3 class="h6">Description2</h3>
              <div class="viewer-html">{@html currentProduct.description2_html || '<p class="text-body-secondary mb-0">Not provided.</p>'}</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card shadow-sm h-100">
            <div class="card-body">
              <h3 class="h6">Description3</h3>
              <div class="viewer-html">{@html currentProduct.description3_html || '<p class="text-body-secondary mb-0">Not provided.</p>'}</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card shadow-sm h-100">
            <div class="card-body">
              <h3 class="h6">Comments</h3>
              <div class="viewer-html">{@html currentProduct.comments_html || '<p class="text-body-secondary mb-0">Not provided.</p>'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h3 class="h5">Grouped Specifications</h3>
          {#if (currentProduct.parameter_groups?.length ?? 0) > 0}
            <div class="vstack gap-3 mt-3">
              {#each currentProduct.parameter_groups as group}
                <div class="border rounded p-3">
                  <div class="fw-semibold mb-2">{group.group_name}</div>
                  <div class="table-responsive">
                    <table class="table table-sm mb-0">
                      <tbody>
                        {#each group.parameters as parameter}
                          <tr>
                            <th style="width: 40%">{parameter.parameter_name}</th>
                            <td>{formatParameterValue(parameter)}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-body-secondary mb-0">No grouped specifications for this product yet.</p>
          {/if}
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h3 class="h5">Product Images</h3>
          {#if (currentProduct.product_images?.length ?? 0) > 0}
            <div class="image-grid mt-3">
              {#each currentProduct.product_images as image}
                <figure class="image-card">
                  <img src={image.url} alt={currentProduct.model} />
                </figure>
              {/each}
            </div>
          {:else}
            <p class="text-body-secondary mb-0">No product images yet.</p>
          {/if}
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h3 class="h5">{graphHeading()}</h3>
          {#if loadingChart}
            <p class="text-body-secondary mb-0">Loading graph data…</p>
          {:else if rpmPoints.length === 0 && efficiencyPoints.length === 0}
            <p class="text-body-secondary mb-0">No graph points for this product yet.</p>
          {:else}
            <div class="mt-3">
              <ECharts option={chartOption} height="700px" />
            </div>
          {/if}
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h3 class="h5">Product PDF</h3>
          {#if currentProduct.product_pdf_url}
            <div class="ratio ratio-16x9 mt-3">
              <iframe src={currentProduct.product_pdf_url} title={`${currentProduct.model} PDF preview`}></iframe>
            </div>
          {:else}
            <p class="text-body-secondary mb-0">No product PDF generated yet.</p>
          {/if}
          </div>
        </div>
      {:else}
        <div class="card shadow-sm">
          <div class="card-body">
            <p class="text-body-secondary mb-0">Select a product to review its details, graph, images, and PDF.</p>
          </div>
        </div>
      {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="vstack gap-3">
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-6 col-lg-3">
              <label class="form-label" for="viewer-series-tab-type">Product type</label>
              <select class="form-select" id="viewer-series-tab-type" bind:value={seriesTabProductTypeFilter}>
                <option value="">-- Choose option --</option>
                {#each productTypes as productType}
                  <option value={productType.key}>{productType.label}</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-6 col-lg-3">
              <label class="form-label" for="viewer-series-tab-series">Series</label>
              <select class="form-select" id="viewer-series-tab-series" bind:value={seriesTabSeriesId} disabled={!seriesTabProductTypeFilter}>
                <option value="">-- Choose option --</option>
                {#each seriesTabOptions as series}
                  <option value={series.id}>{series.name}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
      </div>

      {#if selectedSeriesRecord}
        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="h5">Series Data</h3>
            <div class="text-body-secondary small mb-3">{selectedSeriesRecord.name} · {selectedSeriesRecord.product_count} products</div>
            <div class="d-flex flex-wrap align-items-start gap-2 mb-3">
              <div class="me-auto"></div>
              <button class="btn btn-outline-secondary btn-sm" on:click={() => regenerateSeriesGraph(selectedSeriesRecord)} disabled={refreshingSeriesGraphId === selectedSeriesRecord.id}>
                {refreshingSeriesGraphId === selectedSeriesRecord.id ? 'Generating Graph...' : 'Generate Series Graph'}
              </button>
              <button class="btn btn-outline-secondary btn-sm" on:click={() => regenerateSeriesPdfAsset(selectedSeriesRecord)} disabled={refreshingSeriesPdfId === selectedSeriesRecord.id}>
                {refreshingSeriesPdfId === selectedSeriesRecord.id ? 'Generating PDF...' : 'Generate Series PDF'}
              </button>
              {#if selectedSeriesRecord.series_graph_image_url}
                <a class="btn btn-outline-secondary btn-sm" href={selectedSeriesRecord.series_graph_image_url} target="_blank" rel="noreferrer">Open Series Graph</a>
              {/if}
              {#if selectedSeriesRecord.series_pdf_url}
                <a class="btn btn-outline-secondary btn-sm" href={selectedSeriesRecord.series_pdf_url} target="_blank" rel="noreferrer">Open Series PDF</a>
              {/if}
            </div>

            <div class="row g-3">
              <div class="col-12 col-lg-6">
                <h4 class="h6">Description1</h4>
                <div class="viewer-html">{@html selectedSeriesRecord.description1_html || '<p class="text-body-secondary mb-0">Not provided.</p>'}</div>
              </div>
              <div class="col-12 col-lg-6">
                <h4 class="h6">Description2</h4>
                <div class="viewer-html">{@html selectedSeriesRecord.description2_html || '<p class="text-body-secondary mb-0">Not provided.</p>'}</div>
              </div>
              <div class="col-12 col-lg-6">
                <h4 class="h6">Description3</h4>
                <div class="viewer-html">{@html selectedSeriesRecord.description3_html || '<p class="text-body-secondary mb-0">Not provided.</p>'}</div>
              </div>
              <div class="col-12 col-lg-6">
                <h4 class="h6">Comments</h4>
                <div class="viewer-html">{@html selectedSeriesRecord.comments_html || '<p class="text-body-secondary mb-0">Not provided.</p>'}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="h5">Series PDF</h3>
            {#if selectedSeriesRecord.series_pdf_url}
              <div class="ratio ratio-16x9 mt-3">
                <iframe src={selectedSeriesRecord.series_pdf_url} title={`${selectedSeriesRecord.name} PDF preview`}></iframe>
              </div>
            {:else}
              <p class="text-body-secondary mb-0">No series PDF generated yet.</p>
            {/if}
          </div>
        </div>
      {:else}
        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="h5">Series Data</h3>
            <p class="text-body-secondary mb-0">Select a series to review its details and PDF.</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page-stack {
    display: grid;
    gap: 1rem;
  }

  .viewer-metric {
    border: 1px solid rgba(120, 130, 150, 0.16);
    border-radius: 0.85rem;
    padding: 0.9rem 1rem;
    background: color-mix(in srgb, var(--bs-body-bg) 96%, var(--bs-secondary-bg) 4%);
  }

  .viewer-metric-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bs-secondary-color);
  }

  .viewer-list-table tbody tr {
    cursor: pointer;
  }

  .selected-row {
    background: color-mix(in srgb, var(--bs-primary) 22%, var(--bs-body-bg) 78%);
  }

  .viewer-list-table tbody tr.selected-row td {
    background: transparent;
  }

  .viewer-select-button {
    color: inherit;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .image-card {
    margin: 0;
    border: 1px solid rgba(120, 130, 150, 0.16);
    border-radius: 0.75rem;
    padding: 0.5rem;
    background: color-mix(in srgb, var(--bs-body-bg) 94%, var(--bs-secondary-bg) 6%);
  }

  .image-card img {
    width: 100%;
    height: 160px;
    object-fit: contain;
    display: block;
  }

  .viewer-html :global(:first-child) {
    margin-top: 0;
  }

  .viewer-html :global(:last-child) {
    margin-bottom: 0;
  }

</style>
