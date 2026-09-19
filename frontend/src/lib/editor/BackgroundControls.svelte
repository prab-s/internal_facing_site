<script>
  import { createEventDispatcher } from 'svelte';

  export let value = {};
  export let label = 'Background';
  export let compact = false;

  const dispatch = createEventDispatcher();
  const fallbackColor = '#ffffff';
  const fallbackGradientColor = '#732323';
  let open = false;

  function update(field, nextValue) {
    dispatch('change', { field, value: nextValue });
  }
</script>

{#if compact}
  <div class="background-toolbar-action">
    <button class="btn btn-sm btn-outline-secondary background-toolbar-button" type="button" aria-expanded={open} aria-haspopup="dialog" on:click|stopPropagation={() => (open = !open)}>
      <span class="background-toolbar-swatch" style={`background:${value.backgroundColor || 'linear-gradient(135deg,#fff,#732323)'}`} aria-hidden="true"></span>
      Background
    </button>
    {#if open}
      <div class="background-popover" role="dialog" tabindex="-1" aria-label={`${label} settings`} on:click|stopPropagation on:keydown|stopPropagation>
        <div class="background-controls__heading"><div><strong>{label}</strong><span>Colour, transparency and gradient</span></div><button class="btn-close" type="button" aria-label="Close background settings" on:click={() => (open = false)}></button></div>
        <div class="background-controls__grid"><div class="background-controls__field"><label for={`${label.replaceAll(' ', '-').toLowerCase()}-colour`}>Colour</label><div class="background-controls__colour-input"><input id={`${label.replaceAll(' ', '-').toLowerCase()}-colour`} class="form-control form-control-color" type="color" value={value.backgroundColor || fallbackColor} aria-label={`${label} colour`} on:input={(event) => update('backgroundColor', event.currentTarget.value)} /><input class="form-control form-control-sm" type="text" value={value.backgroundColor || ''} placeholder="#ffffff" aria-label={`${label} colour value`} on:input={(event) => update('backgroundColor', event.currentTarget.value)} /></div></div><div class="background-controls__field"><label for={`${label.replaceAll(' ', '-').toLowerCase()}-opacity`}>Opacity <output>{Math.round((value.backgroundOpacity ?? 1) * 100)}%</output></label><input id={`${label.replaceAll(' ', '-').toLowerCase()}-opacity`} class="form-control form-control-sm" type="number" min="0" max="100" step="5" value={Math.round((value.backgroundOpacity ?? 1) * 100)} aria-label={`${label} opacity percentage`} on:input={(event) => update('backgroundOpacity', Math.max(0, Math.min(100, Number(event.currentTarget.value))) / 100)} /></div></div>
        <label class="background-controls__toggle"><input class="form-check-input" type="checkbox" checked={value.gradientEnabled === true} on:change={(event) => update('gradientEnabled', event.currentTarget.checked)} /><span><strong>Use a gradient</strong><small>Blend into a second colour.</small></span></label>
        {#if value.gradientEnabled}<div class="background-controls__gradient"><div class="background-controls__field"><label for={`${label.replaceAll(' ', '-').toLowerCase()}-gradient-colour`}>Second colour</label><div class="background-controls__colour-input"><input id={`${label.replaceAll(' ', '-').toLowerCase()}-gradient-colour`} class="form-control form-control-color" type="color" value={value.gradientColor || fallbackGradientColor} aria-label={`${label} second colour`} on:input={(event) => update('gradientColor', event.currentTarget.value)} /><input class="form-control form-control-sm" type="text" value={value.gradientColor || ''} placeholder="#732323" aria-label={`${label} second colour value`} on:input={(event) => update('gradientColor', event.currentTarget.value)} /></div></div><div class="background-controls__field"><label for={`${label.replaceAll(' ', '-').toLowerCase()}-gradient-angle`}>Angle</label><input id={`${label.replaceAll(' ', '-').toLowerCase()}-gradient-angle`} class="form-control form-control-sm" type="number" min="0" max="360" value={value.gradientAngle || 90} on:input={(event) => update('gradientAngle', Number(event.currentTarget.value))} /></div></div>{/if}
      </div>
    {/if}
    <div class="background-metadata">
      <input class="form-control form-control-sm" value={value.badge || ''} placeholder="Optional badge" aria-label={`${label} badge`} on:input={(event) => update('badge', event.currentTarget.value)} />
      <input class="form-control form-control-sm" value={value.imageAlt || ''} placeholder="Image alt text" aria-label={`${label} image alt text`} on:input={(event) => update('imageAlt', event.currentTarget.value)} />
    </div>
  </div>
{:else}
<div class="background-controls">
  <div class="background-controls__heading">
    <div>
      <strong>{label}</strong>
      <span>Choose a solid colour or a gradient.</span>
    </div>
    {#if value.backgroundColor}<span class="background-controls__swatch" style={`background:${value.backgroundColor}`} aria-hidden="true"></span>{/if}
  </div>

  <div class="background-controls__grid">
    <div class="background-controls__field background-controls__field--colour">
      <label for={`${label.replaceAll(' ', '-').toLowerCase()}-colour`}>Colour</label>
      <div class="background-controls__colour-input">
        <input id={`${label.replaceAll(' ', '-').toLowerCase()}-colour`} class="form-control form-control-color" type="color" value={value.backgroundColor || fallbackColor} aria-label={`${label} colour`} on:input={(event) => update('backgroundColor', event.currentTarget.value)} />
        <input class="form-control form-control-sm" type="text" value={value.backgroundColor || ''} placeholder="#ffffff" aria-label={`${label} colour value`} on:input={(event) => update('backgroundColor', event.currentTarget.value)} />
      </div>
    </div>
    <div class="background-controls__field">
      <label for={`${label.replaceAll(' ', '-').toLowerCase()}-opacity`}>Opacity <output>{Math.round((value.backgroundOpacity ?? 1) * 100)}%</output></label>
      <input id={`${label.replaceAll(' ', '-').toLowerCase()}-opacity`} class="form-range" type="range" min="0" max="1" step="0.05" value={value.backgroundOpacity ?? 1} aria-label={`${label} opacity`} on:input={(event) => update('backgroundOpacity', Number(event.currentTarget.value))} />
    </div>
  </div>

  <label class="background-controls__toggle">
    <input class="form-check-input" type="checkbox" checked={value.gradientEnabled === true} on:change={(event) => update('gradientEnabled', event.currentTarget.checked)} />
    <span><strong>Use a gradient</strong><small>Blend this colour into a second colour.</small></span>
  </label>

  {#if value.gradientEnabled}
    <div class="background-controls__gradient">
      <div class="background-controls__field background-controls__field--colour">
        <label for={`${label.replaceAll(' ', '-').toLowerCase()}-gradient-colour`}>Second colour</label>
        <div class="background-controls__colour-input">
          <input id={`${label.replaceAll(' ', '-').toLowerCase()}-gradient-colour`} class="form-control form-control-color" type="color" value={value.gradientColor || fallbackGradientColor} aria-label={`${label} second colour`} on:input={(event) => update('gradientColor', event.currentTarget.value)} />
          <input class="form-control form-control-sm" type="text" value={value.gradientColor || ''} placeholder="#732323" aria-label={`${label} second colour value`} on:input={(event) => update('gradientColor', event.currentTarget.value)} />
        </div>
      </div>
      <div class="background-controls__field">
        <label for={`${label.replaceAll(' ', '-').toLowerCase()}-gradient-angle`}>Angle <output>{value.gradientAngle || 90}°</output></label>
        <input id={`${label.replaceAll(' ', '-').toLowerCase()}-gradient-angle`} class="form-control form-control-sm" type="number" min="0" max="360" value={value.gradientAngle || 90} on:input={(event) => update('gradientAngle', Number(event.currentTarget.value))} />
      </div>
    </div>
  {/if}
</div>
{/if}

<style>
  .background-controls { background:var(--app-surface-soft); border:1px solid var(--app-border); border-radius:.55rem; color:var(--app-text); display:grid; gap:.7rem; margin-bottom:.9rem; padding:.8rem; }
  .background-toolbar-action { display:inline-flex; position:relative; }
  .background-toolbar-button { align-items:center; display:inline-flex; gap:.35rem; white-space:nowrap; }
  .background-toolbar-swatch { border:1px solid currentColor; border-radius:50%; display:inline-block; height:.75rem; width:.75rem; }
  .background-metadata { display:grid; gap:.35rem; margin-top:.4rem; }
  .background-popover { background:var(--app-surface); border:1px solid var(--app-border); border-radius:.55rem; box-shadow:0 .6rem 1.5rem rgba(0,0,0,.25); color:var(--app-text); display:grid; gap:.7rem; left:0; min-width:20rem; padding:.8rem; position:absolute; top:calc(100% + .4rem); z-index:20; }
  .background-popover .background-controls__heading { margin-bottom:.1rem; }
  .background-controls__heading { align-items:center; display:flex; justify-content:space-between; gap:.75rem; }
  .background-controls__heading strong { display:block; font-size:.78rem; }
  .background-controls__heading span:not(.background-controls__swatch) { color:var(--app-muted); display:block; font-size:.68rem; margin-top:.15rem; }
  .background-controls__swatch { border:1px solid var(--app-border); border-radius:.3rem; flex:0 0 2rem; height:2rem; width:2rem; }
  .background-controls__grid,.background-controls__gradient { display:grid; gap:.7rem; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); }
  .background-controls__field { min-width:0; }
  .background-controls__field label { align-items:center; color:var(--app-muted); display:flex; font-size:.68rem; justify-content:space-between; margin-bottom:.25rem; }
  .background-controls__field output { color:var(--app-text); font-weight:700; }
  .background-controls__colour-input { align-items:center; display:grid; gap:.4rem; grid-template-columns:2.3rem minmax(0,1fr); }
  .background-controls__colour-input .form-control-color { height:2rem; padding:.15rem; width:2.3rem; }
  .background-controls__toggle { align-items:center; display:flex; gap:.5rem; margin:0; }
  .background-controls__toggle span { display:grid; gap:.1rem; }
  .background-controls__toggle strong { font-size:.72rem; }
  .background-controls__toggle small { color:var(--app-muted); font-size:.65rem; }
  @media (max-width:600px) { .background-controls__grid,.background-controls__gradient { grid-template-columns:1fr; } }
</style>
