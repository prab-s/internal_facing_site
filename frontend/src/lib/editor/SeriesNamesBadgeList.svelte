<script>
  export let seriesNames = [];
  export let title = 'Series names';
  export let emptyLabel = 'No series names available.';
</script>

<div class="card shadow-sm">
  <div class="card-body">
    <h3 class="h6 mb-3">{title}</h3>

    {#if seriesNames?.length}
      <div class="d-flex flex-wrap gap-2">
        {#each seriesNames as seriesName}
          <span class="badge text-bg-light border">{seriesName}</span>
        {/each}
      </div>
    {:else}
      <p class="text-body-secondary mb-0">{emptyLabel}</p>
    {/if}
  </div>
</div>
