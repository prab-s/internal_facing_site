<script>
  import { createEventDispatcher } from 'svelte';

  export let value = null;
  export let label = 'Action';
  export let compact = false;

  const dispatch = createEventDispatcher();
  const actionTypes = [
    { value: 'none', label: 'No action' },
    { value: 'page', label: 'Open CMS page' },
    { value: 'modal', label: 'Open modal' },
    { value: 'external_url', label: 'Open external URL' },
    { value: 'email', label: 'Email address' },
    { value: 'event', label: 'Dispatch event' }
  ];

  $: action = { type: 'none', ...(value || {}) };

  function update(field, nextValue) {
    const next = { ...action, [field]: nextValue };
    if (field === 'type') {
      if (nextValue === 'modal') next.target = 'quoteRequestModal';
      else if (nextValue === 'page') next.target = '/contact';
      else if (nextValue === 'email') next.target = 'mailto:';
      else if (nextValue === 'event') next.target = 'open-enquiry';
      else if (nextValue === 'none') delete next.target;
      else if (nextValue === 'external_url') next.target = 'https://';
    }
    dispatch('change', { ...next });
  }

  function updateContextField(field, checked) {
    update('contextFields', { airflow: action.contextFields?.airflow !== false, pressure: action.contextFields?.pressure !== false, [field]: checked });
  }
</script>

<div class:action-editor-compact={compact} class="action-editor">
  <label class="form-label" for={`${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-type`}>{label}</label>
  <select id={`${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-type`} class="form-select form-select-sm" value={action.type} on:change={(event) => update('type', event.currentTarget.value)}>
    {#each actionTypes as type}<option value={type.value}>{type.label}</option>{/each}
  </select>
  {#if action.type === 'page'}
    <input class="form-control form-control-sm mt-2" value={action.target || ''} placeholder="/page-slug" aria-label={`${label} page path`} on:input={(event) => update('target', event.currentTarget.value)} />
  {:else if action.type === 'modal'}
    <select class="form-select form-select-sm mt-2" value={action.target || 'quoteRequestModal'} aria-label={`${label} modal`} on:change={(event) => update('target', event.currentTarget.value)}><option value="quoteRequestModal">Enquiries modal</option></select>
    <select class="form-select form-select-sm mt-2" value={action.defaultType || ''} aria-label={`${label} enquiry type`} on:change={(event) => update('defaultType', event.currentTarget.value)}><option value="">Default enquiry type</option><option value="standard">Quote this item</option><option value="tailored">Tailored product</option><option value="unsure">Help me choose</option></select>
    <div class="action-context-fields mt-2"><span class="small text-body-secondary">Pass through to enquiry</span><label><input type="checkbox" checked={action.contextFields?.airflow !== false} on:change={(event) => updateContextField('airflow', event.currentTarget.checked)} /> Airflow</label><label><input type="checkbox" checked={action.contextFields?.pressure !== false} on:change={(event) => updateContextField('pressure', event.currentTarget.checked)} /> Pressure</label></div>
  {:else if action.type === 'external_url' || action.type === 'email' || action.type === 'event'}
    <input class="form-control form-control-sm mt-2" value={action.target || ''} placeholder={action.type === 'event' ? 'event-name' : action.type === 'email' ? 'mailto:team@example.com' : 'https://example.com'} aria-label={`${label} target`} on:input={(event) => update('target', event.currentTarget.value)} />
  {/if}
</div>

<style>
  .action-editor { margin-top: .7rem; }
  .action-editor-compact { margin-top: .45rem; }
  .action-editor .form-label { font-size: .72rem; margin-bottom: .25rem; }
  .action-context-fields { display:flex; align-items:center; flex-wrap:wrap; gap:.65rem; font-size:.72rem; }
  .action-context-fields label { align-items:center; display:flex; gap:.25rem; }
</style>
