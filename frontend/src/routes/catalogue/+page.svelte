<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/viewer', { replaceState: true });
  });
</script>

<svelte:head>
  <title>Redirecting — Internal Facing</title>
</svelte:head>

<div class="py-4 text-body-secondary">Redirecting to Viewer…</div>
