<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Internal Facing</title>
</svelte:head>

<div class="mb-3">
  <div class="col-12 col-xxl-8">
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Overview</p>
    <h1 class="h2 mb-2">Internal product data, records, and graph comparison in one place.</h1>
    <p class="text-body-secondary">
      Use the workspace to maintain product records, edit graph data, review key product details, and check visual outputs before they go customer-facing.
    </p>
  </div>
</div>

<div class="row g-3">
  <div class="col-12 col-lg-6">
    <div class="card shadow-sm h-100">
      <div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Hierarchy Workspace</p>
        <h2 class="h4">Editor</h2>
        <p>Work through product types, series, and products in one accordion-based editor. Manage templates, descriptions, grouped specifications, images, and asset generation from a single surface.</p>
        <button class="btn btn-primary align-self-start" type="button" on:click={() => goto('/editor')}>Open Editor</button>
      </div>
    </div>
  </div>

  <div class="col-12 col-lg-6">
    <div class="card shadow-sm h-100">
      <div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Read-Only Review</p>
        <h2 class="h4">Viewer</h2>
        <p>Review the same hierarchy in a tidier read-only surface, inspect images and grouped specifications, and trigger graph/PDF generation without dropping into edit mode.</p>
        <button class="btn btn-primary align-self-start" type="button" on:click={() => goto('/viewer')}>Open Viewer</button>
      </div>
    </div>
  </div>
</div>

<div class="row g-3 mt-0">
  <div class="col-12 col-lg-6">
    <div class="card shadow-sm h-100">
      <div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Account & Admin</p>
        <h2 class="h4">Setup</h2>
        <p>Manage your password and, for admins, user accounts and access to the internal application.</p>
        <button class="btn btn-primary align-self-start" type="button" on:click={() => goto('/setup')}>Open Setup</button>
      </div>
    </div>
  </div>

  <div class="col-12 col-lg-6">
    <div class="card shadow-sm h-100">
      <div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Visual Template Editing</p>
        <h2 class="h4">Template Builder</h2>
        <p>Open the PDF template files in a drag-and-drop builder, edit the template body visually, and save the HTML/CSS back into the controlled template library.</p>
        <button class="btn btn-primary align-self-start" type="button" on:click={() => goto('/template-builder')}>Open Template Builder</button>
      </div>
    </div>
  </div>
</div>
