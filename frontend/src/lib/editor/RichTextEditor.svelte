<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let value = '';
  export let id = '';
  export let rows = 4;

  let editor;
  let color = '#732323';
  let lastHtml = '';
  let savedRange;
  let formattingOpen = false;
  let showHtml = false;
  const dispatch = createEventDispatcher();

  const fontOptions = [
    { value: 'Arial', label: 'Arial' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Tahoma', label: 'Tahoma' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Verdana', label: 'Verdana' }
  ];

  function syncEditor() {
    if (!editor) return;
    const nextHtml = value || '';
    if (nextHtml !== lastHtml) {
      editor.innerHTML = nextHtml;
      lastHtml = nextHtml;
    }
  }

  function updateValue() {
    if (!editor) return;
    value = editor.innerHTML;
    lastHtml = value;
    dispatch('value', value);
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor?.contains(selection.anchorNode)) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    if (!savedRange || !editor) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
  }

  function command(name, commandValue = null) {
    editor?.focus();
    document.execCommand(name, false, commandValue);
    updateValue();
  }

  function applyInlineStyle(property, value) {
    editor?.focus();
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !editor?.contains(selection.anchorNode)) return;
    const span = document.createElement('span');
    span.style[property] = value;
    span.appendChild(selection.getRangeAt(0).extractContents());
    selection.getRangeAt(0).insertNode(span);
    updateValue();
  }

  function createLink() {
    editor?.focus();
    restoreSelection();
    const url = window.prompt('Link URL');
    if (url) command('createLink', url);
  }

  function insertImage() {
    editor?.focus();
    restoreSelection();
    const url = window.prompt('Image URL');
    if (url) command('insertImage', url);
  }

  function chooseColor(event) {
    color = event.currentTarget.value;
    editor?.focus();
    restoreSelection();
    command('foreColor', color);
  }

  function chooseFont(event) {
    const font = event.currentTarget.value;
    if (!font) return;
    editor?.focus();
    restoreSelection();
    command('fontName', font);
    event.currentTarget.value = '';
  }

  function removeHardBreaks() {
    const nextValue = (value || '').replace(/<br\s*\/?>(\r?\n)?/gi, ' ');
    if (nextValue === value) return;
    value = nextValue;
    lastHtml = nextValue;
    if (editor) editor.innerHTML = nextValue;
    dispatch('value', nextValue);
  }

  onMount(syncEditor);

  $: syncEditor();
  $: paragraphCount = (value.match(/<(p|div|h[1-6]|li|blockquote)\b/gi) || []).length;
  $: hardBreakCount = (value.match(/<br\s*\/?\s*>/gi) || []).length;
</script>

<div class="rich-text-editor">
  <div class="rich-text-editor__toolbar" role="toolbar" aria-label="Text formatting">
    <div class="btn-group btn-group-sm" role="group" aria-label="Text style">
      <button class="btn btn-outline-secondary" type="button" title="Bold" aria-label="Bold" on:mousedown|preventDefault={() => command('bold')}><strong>B</strong></button>
      <button class="btn btn-outline-secondary" type="button" title="Italic" aria-label="Italic" on:mousedown|preventDefault={() => command('italic')}><em>I</em></button>
      <button class="btn btn-outline-secondary" type="button" title="Underline" aria-label="Underline" on:mousedown|preventDefault={() => command('underline')}><u>U</u></button>
      <button class="btn btn-outline-secondary" type="button" title="Strikethrough" aria-label="Strikethrough" on:mousedown|preventDefault={() => command('strikeThrough')}>S̶</button>
    </div>
    <div class="btn-group btn-group-sm" role="group" aria-label="Paragraph formatting">
      <button class="btn btn-outline-secondary" type="button" title="Bulleted list" aria-label="Bulleted list" on:mousedown|preventDefault={() => command('insertUnorderedList')}>•</button>
    </div>
    <button class="btn btn-sm btn-outline-secondary" type="button" title="Add link" aria-label="Add link" on:mousedown|preventDefault={createLink}>Link</button>
    <button class="btn btn-sm btn-outline-secondary" type="button" aria-expanded={formattingOpen} on:click={() => (formattingOpen = !formattingOpen)}>{formattingOpen ? 'Hide formatting' : 'Format text'}</button>
    <slot name="toolbar-end"></slot>
  </div>
  {#if formattingOpen}
    <div class="rich-text-editor__format-panel" aria-label="More text formatting">
      <select class="form-select form-select-sm rich-text-editor__font" aria-label="Font" on:mousedown={saveSelection} on:change={chooseFont}>
        <option value="">Font</option>{#each fontOptions as font}<option value={font.value} style={`font-family: ${font.value}`}>{font.label}</option>{/each}
      </select>
      <select class="form-select form-select-sm rich-text-editor__format" aria-label="Text style" on:change={(event) => { if (event.currentTarget.value) command('formatBlock', event.currentTarget.value); event.currentTarget.value = ''; }}>
        <option value="">Style</option><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="h4">Heading 4</option>
      </select>
      <select class="form-select form-select-sm rich-text-editor__compact" aria-label="Font size" on:change={(event) => { if (event.currentTarget.value) applyInlineStyle('fontSize', event.currentTarget.value); event.currentTarget.value = ''; }}><option value="">Size</option><option value="0.75rem">Small</option><option value="1rem">Normal</option><option value="1.25rem">Large</option><option value="1.75rem">Display</option></select>
      <select class="form-select form-select-sm rich-text-editor__compact" aria-label="Line spacing" on:change={(event) => { if (event.currentTarget.value) applyInlineStyle('lineHeight', event.currentTarget.value); event.currentTarget.value = ''; }}><option value="">Spacing</option><option value="1">Tight</option><option value="1.5">Normal</option><option value="2">Loose</option></select>
      <div class="btn-group btn-group-sm" role="group" aria-label="More paragraph formatting"><button class="btn btn-outline-secondary" type="button" title="Decrease indent" on:mousedown|preventDefault={() => command('outdent')}>⇤</button><button class="btn btn-outline-secondary" type="button" title="Increase indent" on:mousedown|preventDefault={() => command('indent')}>⇥</button><button class="btn btn-outline-secondary" type="button" title="Numbered list" on:mousedown|preventDefault={() => command('insertOrderedList')}>1.</button></div>
      <button class="btn btn-sm btn-outline-secondary" type="button" on:mousedown|preventDefault={insertImage}>Image</button>
      <label class="btn btn-sm btn-outline-secondary mb-0" title="Text colour"><span aria-hidden="true">A</span><input class="rich-text-editor__color" type="color" bind:value={color} on:mousedown={saveSelection} on:change={chooseColor} /></label>
      <button class="btn btn-sm btn-outline-secondary" type="button" on:mousedown|preventDefault={() => command('removeFormat')}>Clear formatting</button>
      {#if hardBreakCount}<button class="btn btn-sm btn-outline-secondary" type="button" on:click={removeHardBreaks}>Remove hard breaks</button>{/if}
      <div class="rich-text-editor__structure">{paragraphCount || 1} paragraph{paragraphCount === 1 ? '' : 's'} · {hardBreakCount} hard line break{hardBreakCount === 1 ? '' : 's'}<span>Soft wrapping changes with card width and is not saved.</span><button class="btn btn-link btn-sm p-0" type="button" on:click={() => (showHtml = !showHtml)}>{showHtml ? 'Hide HTML' : 'Show HTML'}</button></div>
      {#if showHtml}<textarea class="form-control form-control-sm rich-text-editor__html" rows="4" readonly value={value}></textarea>{/if}
    </div>
  {/if}
  <div
    class="form-control rich-text-editor__surface"
    class:rich-text-editor__surface--short={rows <= 3}
    id={id}
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    aria-label="Rich text"
    bind:this={editor}
    on:input={updateValue}
    on:blur={updateValue}
  ></div>
</div>

<style>
  .rich-text-editor__surface {
    min-height: 8rem;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .rich-text-editor__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .rich-text-editor__format-panel {
    align-items: center;
    background: var(--bs-tertiary-bg);
    border: 1px solid var(--bs-border-color);
    border-radius: 0.375rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: -0.1rem 0 0.5rem;
    padding: 0.5rem;
  }

  .rich-text-editor__structure {
    color: var(--bs-secondary-color);
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    font-size: 0.75rem;
    gap: 0.35rem;
    margin-top: 0.15rem;
  }

  .rich-text-editor__structure span { flex-basis: 100%; }
  .rich-text-editor__html { flex-basis: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

  .rich-text-editor__toolbar :global(.btn-group) {
    display: flex;
    flex-wrap: wrap;
  }

  .rich-text-editor__toolbar :global(.btn),
  .rich-text-editor__toolbar :global(.form-select),
  .rich-text-editor__toolbar :global(label.btn) {
    flex: 0 0 auto;
  }

  .rich-text-editor__font {
    width: 9.5rem;
  }

  .rich-text-editor__format { width: 8rem; }
  .rich-text-editor__compact { width: 6.3rem; }

  .rich-text-editor__surface--short {
    min-height: 6rem;
  }

  .rich-text-editor__surface :global(p:first-child) {
    margin-top: 0;
  }

  .rich-text-editor__surface :global(p:last-child) {
    margin-bottom: 0;
  }

  .rich-text-editor__color {
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border: 0;
    vertical-align: middle;
  }
</style>
