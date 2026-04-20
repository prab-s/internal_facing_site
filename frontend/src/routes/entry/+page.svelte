<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    const search = window.location.search || '';
    goto(`/editor${search}`, { replaceState: true });
  });
</script>

<svelte:head>
  <title>Redirecting — Internal Facing</title>
</svelte:head>

<div class="py-4 text-body-secondary">Redirecting to Editor…</div>
