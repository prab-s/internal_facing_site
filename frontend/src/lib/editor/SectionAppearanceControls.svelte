<script>
  import { createEventDispatcher } from 'svelte';
  import ActionEditor from './ActionEditor.svelte';

  export let value = {};
  const dispatch = createEventDispatcher();
  const set = (field, event) => dispatch('change', { field, value: event.currentTarget.value });
  const toggle = (field, event) => dispatch('change', { field, value: event.currentTarget.checked });
  const action = (field, event) => dispatch('change', { field, value: event.detail });

  $: isCardGrid = value.type === 'cards';
  $: isCarousel = value.type === 'carousel';
  $: isAccordion = value.type === 'accordion';
  $: sectionImageEnabled = value.type === 'image-text' && (value.showImage === true || Boolean(value.image && value.showImage !== false));
  $: cardImagesEnabled = (isCardGrid || isCarousel) && (value.showCardImages === true || Boolean((value.cards || []).some((card) => card.image) && value.showCardImages !== false));
  $: canHaveImageSettings = sectionImageEnabled || cardImagesEnabled;
  $: hasActions = value.type === 'cta' || Boolean(value.actionLabel || value.secondaryActionLabel || value.action || value.secondaryAction);

  function updateCards(event) {
    try { dispatch('change', { field: 'cards', value: JSON.parse(event.currentTarget.value) }); } catch (_error) {}
  }
</script>

<div class="appearance-controls">
  <section>
    <h3>Layout and surface</h3>
    <div class="control-grid">
      <label>Section width<select class="form-select form-select-sm" value={value.width || 'auto'} on:change={(event) => set('width', event)}><option value="auto">Auto</option><option value="full">Full</option><option value="half">Half</option><option value="third">Third</option></select></label>
      <label>Style<select class="form-select form-select-sm" value={value.surface || 'card'} on:change={(event) => set('surface', event)}><option value="card">Card</option><option value="plain">Plain</option></select></label>
      <label>Tone<select class="form-select form-select-sm" value={value.tone || 'default'} on:change={(event) => set('tone', event)}><option value="default">Default</option><option value="soft">Soft</option><option value="dark">Dark</option><option value="brand">Brand</option></select></label>
      <label>Spacing<select class="form-select form-select-sm" value={value.spacing || 'md'} on:change={(event) => set('spacing', event)}><option value="none">None</option><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>
      <label>Text alignment<select class="form-select form-select-sm" value={value.textAlign || 'start'} on:change={(event) => set('textAlign', event)}><option value="start">Left</option><option value="center">Centre</option><option value="end">Right</option></select></label>
      <label>Heading size<select class="form-select form-select-sm" value={value.headingSize || 'normal'} on:change={(event) => set('headingSize', event)}><option value="normal">Normal</option><option value="display">Display</option></select></label>
      <label>Corner radius<select class="form-select form-select-sm" value={value.radius || 'lg'} on:change={(event) => set('radius', event)}><option value="none">None</option><option value="sm">Small</option><option value="lg">Large</option></select></label>
      <label>Shadow<select class="form-select form-select-sm" value={value.shadow || 'none'} on:change={(event) => set('shadow', event)}><option value="none">None</option><option value="sm">Small</option><option value="lg">Large</option></select></label>
    </div>
    <label class="toggle"><input type="checkbox" checked={value.border === true} on:change={(event) => toggle('border', event)} /> Show border</label>
  </section>

  {#if isCardGrid}
    <section>
      <h3>Card grid</h3>
      <div class="control-grid">
        <label>Tablet columns<select class="form-select form-select-sm" value={value.tabletColumns || 2} on:change={(event) => set('tabletColumns', event)}><option value="1">One</option><option value="2">Two</option><option value="3">Three</option><option value="4">Four</option></select></label>
        <label>Card style<select class="form-select form-select-sm" value={value.cardStyle || 'raised'} on:change={(event) => set('cardStyle', event)}><option value="raised">Raised</option><option value="outline">Outline</option><option value="minimal">Minimal</option></select></label>
      </div>
    </section>
  {/if}

  {#if isCardGrid || isCarousel}
    <section>
      <h3>Card images</h3>
      <label class="toggle"><input type="checkbox" checked={cardImagesEnabled} on:change={(event) => toggle('showCardImages', event)} /> Show images in {isCarousel ? 'slides' : 'cards'}</label>
      {#if !cardImagesEnabled}<p class="hint">Turn this on to add an image URL to each {isCarousel ? 'slide' : 'card'}.</p>{/if}
    </section>
  {/if}

  {#if value.type === 'image-text'}
    <section>
      <h3>Section image</h3>
      <label class="toggle"><input type="checkbox" checked={sectionImageEnabled} on:change={(event) => toggle('showImage', event)} /> Include an image alongside the text</label>
      {#if !sectionImageEnabled}<p class="hint">Turn this on to add and position an image. Your text-only section will remain unchanged until then.</p>{/if}
    </section>
  {/if}

  {#if canHaveImageSettings}
    <section>
      <h3>{sectionImageEnabled ? 'Image display' : 'Card images'}</h3>
      <div class="control-grid">
        <label>Image fit<select class="form-select form-select-sm" value={value.imageFit || 'cover'} on:change={(event) => set('imageFit', event)}><option value="cover">Crop to fill</option><option value="contain">Fit whole image</option></select></label>
        <label>Image ratio<select class="form-select form-select-sm" value={value.imageRatio || 'square'} on:change={(event) => set('imageRatio', event)}><option value="wide">Wide</option><option value="square">Square</option><option value="portrait">Portrait</option></select></label>
        {#if sectionImageEnabled}<label>Image position<select class="form-select form-select-sm" value={value.imagePosition || 'right'} on:change={(event) => set('imagePosition', event)}><option value="left">Left</option><option value="right">Right</option></select></label>{/if}
      </div>
      {#if sectionImageEnabled}
        <label>Image alt text<input class="form-control form-control-sm" value={value.imageAlt || ''} on:input={(event) => set('imageAlt', event)} /></label>
        <label>Image caption<input class="form-control form-control-sm" value={value.imageCaption || ''} on:input={(event) => set('imageCaption', event)} /></label>
      {/if}
    </section>
  {:else if isCardGrid || isCarousel}
    <p class="hint">Add an image in the content editor to reveal its display settings.</p>
  {/if}

  {#if isAccordion}
    <section>
      <h3>Accordion behaviour</h3>
      <label class="toggle"><input type="checkbox" checked={value.openFirst === true} on:change={(event) => toggle('openFirst', event)} /> Open the first item initially</label>
      <label class="toggle"><input type="checkbox" checked={value.alwaysOpen === true} on:change={(event) => toggle('alwaysOpen', event)} /> Keep one item open</label>
      <label>Items (JSON)<textarea class="form-control form-control-sm" rows="5" value={JSON.stringify(value.cards || [], null, 2)} on:change={updateCards}></textarea></label>
    </section>
  {/if}

  {#if hasActions}
    <section>
      <h3>Secondary action</h3>
      <label>Secondary button style<select class="form-select form-select-sm" value={value.secondaryButtonVariant || 'outline-secondary'} on:change={(event) => set('secondaryButtonVariant', event)}><option value="primary">Primary</option><option value="outline-secondary">Outline</option><option value="light">Light</option><option value="outline-light">Light outline</option></select></label>
      <label>Button size<select class="form-select form-select-sm" value={value.buttonSize || 'lg'} on:change={(event) => set('buttonSize', event)}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>
      <label>Secondary button label<input class="form-control form-control-sm" value={value.secondaryActionLabel || ''} on:input={(event) => set('secondaryActionLabel', event)} /></label>
      <div class="action-field"><ActionEditor label="Secondary button action" compact value={value.secondaryAction || { type: 'none' }} on:change={(event) => action('secondaryAction', event)} /></div>
    </section>
  {/if}
</div>

<style>
  .appearance-controls { display:grid; gap:1rem; }
  section { border-top:1px solid var(--bs-border-color); padding-top:.85rem; }
  section:first-child { border-top:0; padding-top:0; }
  h3 { font-size:.72rem; font-weight:700; letter-spacing:.05em; margin:0 0 .6rem; text-transform:uppercase; }
  label { color:var(--app-muted); display:grid; font-size:.72rem; gap:.2rem; margin:0 0 .5rem; }
  .control-grid { display:grid; gap:.5rem; grid-template-columns:repeat(2,minmax(0,1fr)); }
  label.toggle { align-items:center; display:flex; }
  .toggle input { margin:0 .4rem 0 0; }
  .action-field { min-width:0; }
  .hint { color:var(--app-muted); font-size:.78rem; margin:0; }
  @media (max-width:1100px) { .control-grid { grid-template-columns:1fr; } }
</style>
