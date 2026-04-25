<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
  import ProductTypeWorkspace from '$lib/editor/ProductTypeWorkspace.svelte';
</script>

<svelte:head>
  <title>Edit Product Type — Editor</title>
</svelte:head>

<ManagePageShell
  eyebrow="Manage product types"
  title="Edit Product Type"
  description="Open an existing product type and update its definition."
  backHref="/editor"
  backLabel="Back to Editor"
>
  <ProductTypeWorkspace initialMode="edit" />
</ManagePageShell>
