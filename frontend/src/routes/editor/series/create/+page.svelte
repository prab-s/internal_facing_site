<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
  import SeriesWorkspace from '$lib/editor/SeriesWorkspace.svelte';
</script>

<svelte:head>
  <title>Create Series — Editor</title>
</svelte:head>

<ManagePageShell
  eyebrow="Manage series"
  title="Create Series"
  description="Create a new series record, then assign it to products."
  backHref="/editor"
  backLabel="Back to Editor"
>
  <SeriesWorkspace initialMode="create" />
</ManagePageShell>
