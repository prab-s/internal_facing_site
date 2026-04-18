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
      Use the workspace to maintain product records, edit graph data, browse the catalogue, and review generated product graphs.
    </p>
  </div>
</div>

<div class="row g-3">
  <div class="col-12 col-lg-3">
    <div class="card shadow-sm h-100">
      <div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Create & Edit</p>
        <h2 class="h4">Data Entry</h2>
        <p>Build product records, upload product images, manage graph lines, and edit performance points on tables and charts.</p>
        <button class="btn btn-primary align-self-start" type="button" on:click={() => goto('/entry')}>Open Data Entry</button>
      </div>
    </div>
  </div>

  <div class="col-12 col-lg-3">
    <div class="card shadow-sm h-100">
      <div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Search & Compare</p>
        <h2 class="h4">Catalogue</h2>
        <p>Filter the library by product attributes and operating ranges, then compare graph data across selected products.</p>
        <button class="btn btn-primary align-self-start" type="button" on:click={() => goto('/catalogue')}>Open Catalogue</button>
      </div>
    </div>
  </div>

  <div class="col-12 col-lg-3">
    <div class="card shadow-sm h-100">
      <div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Visual Review</p>
        <h2 class="h4">Graph View</h2>
        <p>Inspect line and overlay data for a single graph-capable product in a dedicated graph view.</p>
        <button class="btn btn-primary align-self-start" type="button" on:click={() => goto('/map')}>Open Graph View</button>
      </div>
    </div>
  </div>

  <div class="col-12 col-lg-3">
    <div class="card shadow-sm h-100">
      <div class="card-body d-flex flex-column gap-2 bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Account & Admin</p>
        <h2 class="h4">Setup</h2>
        <p>Manage your password and, for admins, user accounts and access to the internal application.</p>
        <button class="btn btn-primary align-self-start" type="button" on:click={() => goto('/setup')}>Open Setup</button>
      </div>
    </div>
  </div>
</div>
