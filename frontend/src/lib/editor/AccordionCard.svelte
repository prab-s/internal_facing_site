<script>
  export let title = '';
  export let description = '';
  export let startOpen = true;
  export let open = startOpen;
</script>

<div class="card shadow-sm accordion-card">
  <button
    type="button"
    class="accordion-card__toggle"
    aria-expanded={open}
    on:click={() => {
      open = !open;
    }}
  >
    <div class="accordion-card__heading">
      <h3 class="h6 mb-1">{title}</h3>
      {#if description}
        <p class="text-body-secondary mb-0">{description}</p>
      {/if}
    </div>
    <span class="accordion-card__indicator" aria-hidden="true">{open ? 'Hide' : 'Show'}</span>
  </button>

  {#if open}
    <div class="card-body pt-0">
      <slot />
    </div>
  {/if}
</div>

<style>
  .accordion-card__toggle {
    width: 100%;
    padding: 1rem;
    border: 0;
    background: transparent;
    color: inherit;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    text-align: left;
  }

  .accordion-card__toggle:hover {
    background: color-mix(in srgb, var(--bs-body-bg) 88%, var(--bs-secondary-bg) 12%);
  }

  .accordion-card__toggle:focus-visible {
    outline: 2px solid var(--bs-primary);
    outline-offset: -2px;
  }

  .accordion-card__heading {
    min-width: 0;
  }

  .accordion-card__indicator {
    flex-shrink: 0;
    font-size: 0.875rem;
    color: var(--bs-secondary-color);
  }
</style>
