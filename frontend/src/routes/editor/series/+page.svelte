<script>
  import ManagePageShell from '$lib/editor/ManagePageShell.svelte';
</script>

<svelte:head>
  <title>Series — Editor</title>
</svelte:head>

<ManagePageShell
  eyebrow="Manage series"
  title="Series"
  description="Choose whether to create a new series or edit an existing one."
>
  <div class="card shadow-sm">
    <div class="card-body d-flex flex-wrap gap-2">
      <a class="btn btn-primary" href="/editor/series/create">Create new series</a>
      <a class="btn btn-outline-primary" href="/editor/series/edit">Edit existing series</a>
    </div>
  </div>
</ManagePageShell>
