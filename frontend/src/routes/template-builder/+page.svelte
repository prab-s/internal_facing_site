<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    void goto('/template-builder-v2', { replaceState: true });
  });
</script>

<svelte:head>
  <title>Template Builder | Internal Facing</title>
</svelte:head>

<div class="alert alert-info">
  Redirecting to the Template Builder V2 experience.
</div>
