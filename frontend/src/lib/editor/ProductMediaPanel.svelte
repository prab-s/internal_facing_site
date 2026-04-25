<script>
  export let productForm;
  export let productImages = [];
  export let pendingImageFiles = [];
  export let currentProduct = null;
  export let refreshingProductPdfId = null;
  export let refreshingProductGraphId = null;
  export let selectedProductId = null;
  export let graphStyleForm;
  export let showBandGraphStyle = true;
  export let graphLineValueLabel = () => 'RPM';
  export let uploadImages = () => {};
  export let moveProductImage = () => {};
  export let removeProductImage = () => {};
  export let generateProductGraph = () => {};
  export let generateProductPdf = () => {};
  export let saveBandGraphStyle = () => {};
</script>

<div class="vstack gap-3">
  <div class="card shadow-sm h-100">
    <div class="card-body">
      <h3 class="h6">Product images</h3>
      <p class="text-body-secondary">Upload multiple images, reorder them, and the first image becomes the primary catalogue thumbnail.</p>
      <div class="mb-3">
        <label class="form-label" for="edit-product-images">Select image files</label>
        <input
          class="form-control"
          id="edit-product-images"
          type="file"
          accept="image/*"
          multiple
          on:change={(event) => {
            pendingImageFiles = Array.from(event.currentTarget.files || []);
          }}
        />
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-primary" on:click={uploadImages} disabled={pendingImageFiles.length === 0}>Upload Selected Images</button>
      </div>
      {#if productImages.length > 0}
        <div class="row g-3 mt-1">
          {#each productImages as image, index}
            <div class="col-12 col-sm-6">
              <div class="card shadow-sm h-100">
                <div class="card-body">
                  <img
                    class="img-fluid rounded border mb-2"
                    style="width: 100%; height: 150px; object-fit: cover;"
                    src={image.url}
                    alt={`${productForm.model} product image ${index + 1}`}
                  />
                  <p class="text-body-secondary">{index === 0 ? 'Primary image' : `Image ${index + 1}`}</p>
                  <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-outline-secondary btn-sm" on:click={() => moveProductImage(index, -1)} disabled={index === 0}>Move Up</button>
                    <button class="btn btn-outline-secondary btn-sm" on:click={() => moveProductImage(index, 1)} disabled={index === productImages.length - 1}>Move Down</button>
                    <button class="btn btn-danger btn-sm" on:click={() => removeProductImage(image)}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-body-secondary mt-3 mb-0">No product images uploaded yet.</p>
      {/if}
    </div>
  </div>

  <div class="card shadow-sm h-100">
    <div class="card-body">
      <h3 class="h6">Generated Assets</h3>
      <p class="text-body-secondary">Generate and download the current graph plus printed and online PDFs for this product.</p>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-secondary" on:click={generateProductGraph} disabled={refreshingProductGraphId === selectedProductId || !selectedProductId}>
          {refreshingProductGraphId === selectedProductId ? 'Generating Graph...' : 'Generate Product Graph'}
        </button>
        {#if currentProduct?.graph_image_url}
          <a href={currentProduct.graph_image_url} download class="btn btn-outline-secondary">Download Current Graph</a>
        {/if}
        <button class="btn btn-outline-secondary" on:click={generateProductPdf} disabled={refreshingProductPdfId === selectedProductId || !selectedProductId}>
          {refreshingProductPdfId === selectedProductId ? 'Generating PDFs...' : 'Generate Product PDFs'}
        </button>
        {#if currentProduct?.product_printed_pdf_url}
          <a href={currentProduct.product_printed_pdf_url} download class="btn btn-outline-secondary">Download Printed PDF</a>
        {/if}
        {#if currentProduct?.product_online_pdf_url}
          <a href={currentProduct.product_online_pdf_url} download class="btn btn-outline-secondary">Download Online PDF</a>
        {:else if currentProduct?.product_pdf_url}
          <a href={currentProduct.product_pdf_url} download class="btn btn-outline-secondary">Download Existing PDF</a>
        {/if}
      </div>
    </div>
  </div>

  {#if showBandGraphStyle}
    <div class="card shadow-sm h-100">
      <div class="card-body">
        <h3 class="h6">Band graph style</h3>
        <p class="text-body-secondary">These colours apply to the banded graph style, including generated graph images.</p>
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label" for="band-graph-label-color">{graphLineValueLabel()} label text colour</label>
            <div class="input-group">
              <input class="form-control form-control-color" id="band-graph-label-color" type="color" bind:value={graphStyleForm.band_graph_label_text_color} />
              <input class="form-control" type="text" bind:value={graphStyleForm.band_graph_label_text_color} placeholder="#000000" />
            </div>
          </div>
          <div class="col-12">
            <label class="form-label" for="band-graph-background-color">Graph background colour</label>
            <div class="input-group">
              <input class="form-control form-control-color" id="band-graph-background-color" type="color" bind:value={graphStyleForm.band_graph_background_color} />
              <input class="form-control" type="text" bind:value={graphStyleForm.band_graph_background_color} placeholder="#ffffff" />
            </div>
          </div>
          <div class="col-12">
            <label class="form-label" for="band-graph-faded-opacity">Faded area opacity</label>
            <div class="input-group">
              <input
                class="form-range"
                id="band-graph-faded-opacity"
                type="range"
                min="0"
                max="1"
                step="0.01"
                bind:value={graphStyleForm.band_graph_faded_opacity}
              />
              <input class="form-control" type="number" min="0" max="1" step="0.01" bind:value={graphStyleForm.band_graph_faded_opacity} />
            </div>
          </div>
          <div class="col-12">
            <label class="form-label" for="band-graph-permissible-label-color">Permissible use label colour</label>
            <div class="input-group">
              <input class="form-control form-control-color" id="band-graph-permissible-label-color" type="color" bind:value={graphStyleForm.band_graph_permissible_label_color} />
              <input class="form-control" type="text" bind:value={graphStyleForm.band_graph_permissible_label_color} placeholder="#000000" />
            </div>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 mt-3">
          <button class="btn btn-outline-primary" on:click={saveBandGraphStyle}>Save Band Graph Style</button>
        </div>
      </div>
    </div>
  {/if}
</div>
