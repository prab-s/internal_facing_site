<script>
  import { createEventDispatcher } from 'svelte';
  export let value = {};
  const dispatch = createEventDispatcher();
  const set = (field, event) => dispatch('change', { field, value: event.currentTarget.value });
</script>

<div class="appearance-controls">
  <label>Style<select class="form-select form-select-sm" value={value.surface || 'card'} on:change={(event) => set('surface', event)}><option value="card">Card</option><option value="plain">Plain</option></select></label>
  <label>Tone<select class="form-select form-select-sm" value={value.tone || 'default'} on:change={(event) => set('tone', event)}><option value="default">Default</option><option value="soft">Soft</option><option value="dark">Dark</option><option value="brand">Brand</option></select></label>
  <label>Spacing<select class="form-select form-select-sm" value={value.spacing || 'md'} on:change={(event) => set('spacing', event)}><option value="none">None</option><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>
  <label>Text align<select class="form-select form-select-sm" value={value.textAlign || 'start'} on:change={(event) => set('textAlign', event)}><option value="start">Left</option><option value="center">Centre</option><option value="end">Right</option></select></label>
  <label>Button style<select class="form-select form-select-sm" value={value.buttonVariant || 'primary'} on:change={(event) => set('buttonVariant', event)}><option value="primary">Primary</option><option value="outline-secondary">Outline</option><option value="light">Light</option><option value="outline-light">Light outline</option></select></label>
</div>

<style>
  .appearance-controls { display:grid; gap:.5rem; grid-template-columns:repeat(5,minmax(0,1fr)); }
  label { color:var(--app-muted); display:grid; font-size:.68rem; gap:.2rem; }
  @media (max-width:900px) { .appearance-controls { grid-template-columns:repeat(2,minmax(0,1fr)); } }
</style>
