<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
  import ProductWorkspace from '$lib/editor/ProductWorkspace.svelte';
</script>

<svelte:head>
  <title>Create Product — Editor</title>
</svelte:head>

<ManagePageShell
  eyebrow="Manage product"
  title="Create Product"
  description="Create a new product record, then add media and graph data."
  backHref="/editor"
  backLabel="Back to Editor"
>
  <ProductWorkspace initialMode="create" />
</ManagePageShell>
