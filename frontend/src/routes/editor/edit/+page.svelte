<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
  import ProductWorkspace from '$lib/editor/ProductWorkspace.svelte';

  export let data = {};
</script>

<svelte:head>
  <title>Edit Product — Editor</title>
</svelte:head>

<ManagePageShell
  eyebrow="Manage product"
  title="Edit Product"
  description="Open an existing product and update its details, media, and graph data."
  backHref="/editor"
  backLabel="Back to Editor"
>
  <ProductWorkspace
    initialMode="editExisting"
    initialProductId={data.product ?? ''}
  />
</ManagePageShell>
