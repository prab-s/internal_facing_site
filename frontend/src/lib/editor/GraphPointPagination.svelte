<script>
  export let total = 0;
  export let page = 0;
  export let size = 100;
  $: pages = Math.max(1, Math.ceil(total / size));
  $: if (page >= pages) page = pages - 1;
</script>

{#if total > size}
  <div class="d-flex align-items-center gap-2 mb-2">
    <button type="button" class="btn btn-outline-secondary btn-sm" disabled={page === 0} on:click={() => page -= 1}>Previous points</button>
    <span class="small">{page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}</span>
    <button type="button" class="btn btn-outline-secondary btn-sm" disabled={page >= pages - 1} on:click={() => page += 1}>Next points</button>
  </div>
{/if}
