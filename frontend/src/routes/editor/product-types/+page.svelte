<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
</script>

<svelte:head>
  <title>Product Types — Editor</title>
</svelte:head>

<ManagePageShell
  eyebrow="Manage product types"
  title="Product Types"
  description="Choose whether to create a new product type or edit an existing one."
>
  <div class="card shadow-sm">
    <div class="card-body d-flex flex-wrap gap-2">
      <a class="btn btn-primary" href="/editor/product-types/create">Create new product type</a>
      <a class="btn btn-outline-primary" href="/editor/product-types/edit">Edit existing product type</a>
    </div>
  </div>
</ManagePageShell>
