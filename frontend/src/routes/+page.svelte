<script>
  import { goto } from '$app/navigation';
</script>

<svelte:head>
  <title>Fan Graphs</title>
</svelte:head>

<div class="card">
  <h1>Fan Graphs</h1>
  <p>Compare fan performance curves and view fan maps. Use the navigation above.</p>
  <ul>
    <li>
      <button type="button" on:click={() => goto('/entry')}>Data entry</button>
      — Create fans and add performance data points (including bulk CSV import).
    </li>
    <li>
      <button type="button" on:click={() => goto('/catalogue')}>Catalogue</button>
      — Filter fans and overlay multiple performance curves for comparison.
    </li>
    <li>
      <button type="button" on:click={() => goto('/map')}>Fan map</button>
      — View flow vs pressure and efficiency for a single fan.
    </li>
  </ul>
</div>
