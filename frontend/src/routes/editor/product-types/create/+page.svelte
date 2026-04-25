<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
  import ProductTypeWorkspace from '$lib/editor/ProductTypeWorkspace.svelte';
</script>

<svelte:head>
  <title>Create Product Type — Editor</title>
</svelte:head>

<ManagePageShell
  eyebrow="Manage product types"
  title="Create Product Type"
  description="Create a new product type record, then use it across products and series."
  backHref="/editor"
  backLabel="Back to Editor"
>
  <ProductTypeWorkspace initialMode="create" />
</ManagePageShell>
