<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
  import SeriesWorkspace from '$lib/editor/SeriesWorkspace.svelte';
</script>

<svelte:head>
  <title>Edit Series — Editor</title>
</svelte:head>

<ManagePageShell
  eyebrow="Manage series"
  title="Edit Series"
  description="Open an existing series and update its details."
  backHref="/editor"
  backLabel="Back to Editor"
>
  <SeriesWorkspace initialMode="edit" />
</ManagePageShell>
