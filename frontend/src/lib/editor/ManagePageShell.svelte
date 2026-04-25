<script>
  export let eyebrow = '';
  export let title = '';
  export let description = '';
  export let backHref = '/editor';
  export let backLabel = 'Back to Editor';
</script>

<div class="row justify-content-center">
  <div class="col-12 col-xxl-12">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        {#if eyebrow}
          <p class="small text-uppercase text-body-secondary fw-semibold mb-1">{eyebrow}</p>
        {/if}
        <h1 class="h3 mb-1">{title}</h1>
        {#if description}
          <p class="text-body-secondary mb-0">{description}</p>
        {/if}
      </div>
      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-outline-secondary" href={backHref}>{backLabel}</a>
      </div>
    </div>

    <slot />
  </div>
</div>
