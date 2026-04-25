<script>
  import { onMount } from 'svelte';
  import 'grapesjs/dist/css/grapes.min.css';
  import {
    createTemplate,
    deleteTemplate,
    getTemplateFiles,
    getTemplates,
    refreshTemplates,
    updateTemplateFiles
  } from '$lib/api.js';

  let grapesModule = null;
  let editorHost;
  let editor = null;
  let templates = { product_templates: [], series_templates: [] };
  let templateType = '';
  let templateId = '';
  let loadedTemplate = null;
  let headPrefix = '';
  let bodySuffix = '';
  let rawHtmlContent = '';
  let rawCssContent = '';
  let loadError = '';
  let statusMessage = '';
  let loading = false;
  let saving = false;
  let refreshing = false;
  let creating = false;
  let deleting = false;
  let createLabel = '';
  let createType = '';
  let createSourceId = '';
  let blocksResizeCleanup = null;

  function templateCollection(type) {
    return type === 'series' ? templates.series_templates ?? [] : templates.product_templates ?? [];
  }

  $: availableTemplates = templateCollection(templateType);
  $: createSourceTemplates = templateCollection(createType);

  function extractEditableSections(htmlContent) {
    if (typeof window === 'undefined') {
      return { headPrefix: '', bodyHtml: htmlContent, bodySuffix: '' };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const body = doc.body;
    let bodyInner = body ? body.innerHTML : htmlContent;
    bodyInner = bodyInner.replace(/<\/?body\b[^>]*>/gi, '').trim();
    const bodyMatch = htmlContent.match(/<body\b[^>]*>/i);
    const closingIndex = htmlContent.search(/<\/body>/i);

    if (!bodyMatch || closingIndex === -1) {
      return { headPrefix: '', bodyHtml: bodyInner, bodySuffix: '' };
    }

    const prefixEnd = bodyMatch.index + bodyMatch[0].length;
    return {
      headPrefix: htmlContent.slice(0, prefixEnd),
      bodyHtml: bodyInner,
      bodySuffix: htmlContent.slice(closingIndex)
    };
  }

  function applyTemplatePreviewSubstitutions(htmlContent, templateKind) {
    const imagePlaceholder =
      'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
          <rect width="100%" height="100%" fill="#e9ecef"/>
          <rect x="24" y="24" width="912" height="492" rx="18" fill="#f8f9fa" stroke="#ced4da" stroke-width="4"/>
          <text x="50%" y="50%" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#6c757d">
            ${templateKind === 'series' ? 'Series asset preview' : 'Product asset preview'}
          </text>
        </svg>`
      );

    return htmlContent
      .replaceAll('{{product.primary_product_image_url}}', imagePlaceholder)
      .replaceAll('{{product.graph_image_url}}', imagePlaceholder)
      .replaceAll('{{series.graph_image_url}}', imagePlaceholder);
  }

  function rebuildTemplateHtmlFromSource() {
    const source = rawHtmlContent || loadedTemplate?.html_content || '';
    const parsed = extractEditableSections(source);
    if (!parsed.headPrefix && !parsed.bodySuffix) return parsed.bodyHtml;
    return `${parsed.headPrefix}\n${parsed.bodyHtml}\n${parsed.bodySuffix}`;
  }

  function refreshPreviewFromSource() {
    if (!editor) return;
    const parsed = extractEditableSections(rawHtmlContent || '');
    headPrefix = parsed.headPrefix;
    bodySuffix = parsed.bodySuffix;
    editor.setComponents(applyTemplatePreviewSubstitutions(parsed.bodyHtml, templateType));
    editor.setStyle(rawCssContent || '');
  }

  function setupBlocksResizer(blocksContainer) {
    if (!blocksContainer) return;

    blocksResizeCleanup?.();
    blocksContainer.style.position = 'relative';
    const editorRoot = editorHost;

    const handle = document.createElement('div');
    handle.className = 'template-blocks-resizer';
    blocksContainer.appendChild(handle);

    const minWidth = 280;
    const maxWidth = 560;
    const initialWidth = blocksContainer.getBoundingClientRect().width || 352;
    editorRoot?.style.setProperty('--gjs-left-width', `${initialWidth}px`);
    blocksContainer.style.width = `${initialWidth}px`;

    const onPointerDown = (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = blocksContainer.getBoundingClientRect().width;

      const onPointerMove = (moveEvent) => {
        const nextWidth = Math.min(maxWidth, Math.max(minWidth, startWidth - (moveEvent.clientX - startX)));
        blocksContainer.style.width = `${nextWidth}px`;
        editorRoot?.style.setProperty('--gjs-left-width', `${nextWidth}px`);
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };

    handle.addEventListener('pointerdown', onPointerDown);

    blocksResizeCleanup = () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.remove();
    };
  }

  async function loadRegistry() {
    templates = await getTemplates();
  }

  async function ensureEditor() {
    if (editor || !editorHost) return;
    grapesModule = grapesModule ?? (await import('grapesjs')).default;
    const starterBlocks = [
      {
        id: 'text',
        label: 'Text',
        category: 'Basics',
        content: '<div class="template-text">Double-click to edit this text.</div>'
      },
      {
        id: 'heading',
        label: 'Heading',
        category: 'Basics',
        content: '<h2>Heading</h2>'
      },
      {
        id: 'button',
        label: 'Button',
        category: 'Basics',
        content: '<a class="btn btn-primary" href="#">Button</a>'
      },
      {
        id: 'quote',
        label: 'Quote',
        category: 'Basics',
        content: '<blockquote class="blockquote mb-0"><p>Write a memorable quote.</p></blockquote>'
      },
      {
        id: 'divider',
        label: 'Divider',
        category: 'Basics',
        content: '<hr />'
      },
      {
        id: 'section',
        label: 'Section',
        category: 'Layout',
        content: '<section class="template-section"><h2>Section</h2><p>Content</p></section>'
      },
      {
        id: 'two-col',
        label: 'Two Columns',
        category: 'Layout',
        content:
          '<div style="display:flex; gap:1rem; align-items:stretch; flex-wrap:wrap;"><div style="flex:1 1 0; min-width:0;"><p>Left</p></div><div style="flex:1 1 0; min-width:0;"><p>Right</p></div></div>'
      },
      {
        id: 'three-col',
        label: 'Three Columns',
        category: 'Layout',
        content:
          '<div style="display:flex; gap:1rem; align-items:stretch; flex-wrap:wrap;"><div style="flex:1 1 0; min-width:0;"><p>Left</p></div><div style="flex:1 1 0; min-width:0;"><p>Center</p></div><div style="flex:1 1 0; min-width:0;"><p>Right</p></div></div>'
      },
      {
        id: 'image-text',
        label: 'Image + Text',
        category: 'Layout',
        content:
          '<div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap;"><div style="flex:1 1 18rem; min-width:0;"><img src="{{product.primary_product_image_url}}" alt="Template image" style="max-width:100%; height:auto;" /></div><div style="flex:1 1 18rem; min-width:0;"><h2>Heading</h2><p>Describe the product or series here.</p></div></div>'
      },
      {
        id: 'text-media',
        label: 'Text + Media',
        category: 'Layout',
        content:
          '<div style="display:flex; gap:1rem; align-items:flex-start; flex-wrap:wrap;"><div style="flex:1 1 20rem; min-width:0;"><h2>Heading</h2><p>Write supporting content here.</p></div><div style="flex:1 1 16rem; min-width:0;"><img src="{{product.primary_product_image_url}}" alt="Template image" style="max-width:100%; height:auto;" /></div></div>'
      },
      {
        id: 'image',
        label: 'Image',
        category: 'Media',
        content: '<img src="{{product.primary_product_image_url}}" alt="Template image" />'
      },
      {
        id: 'video',
        label: 'Video',
        category: 'Media',
        content: '<video controls><source src="" type="video/mp4" /></video>'
      },
      {
        id: 'map',
        label: 'Map',
        category: 'Media',
        content:
          '<iframe title="Map" src="https://www.google.com/maps?q=New%20Zealand&output=embed" width="600" height="400" loading="lazy"></iframe>'
      },
      {
        id: 'link',
        label: 'Link',
        category: 'Basics',
        content: '<a href="#">Read more</a>'
      },
      {
        id: 'form',
        label: 'Form',
        category: 'Forms',
        content:
          '<form><div class="mb-3"><label class="form-label">Email</label><input type="email" class="form-control" placeholder="name@example.com" /></div><button class="btn btn-primary" type="submit">Submit</button></form>'
      },
      { id: 'spec-table', label: 'Specs Table', category: 'Data', content: '<div>{{product.grouped_specs_table}}</div>' },
      { id: 'product-graph', label: 'Product Graph', category: 'Data', content: '<div>{{product.graph_image_tag}}</div>' },
      { id: 'series-graph', label: 'Series Graph', category: 'Data', content: '<div>{{series.graph_image_tag}}</div>' },
      { id: 'product-pdf-title', label: 'Product Title', category: 'Data', content: '<h1>{{product.model}}</h1>' },
      { id: 'series-title', label: 'Series Title', category: 'Data', content: '<h1>{{series.name}}</h1>' }
    ];
    editor = grapesModule.init({
      container: editorHost,
      height: '78vh',
      storageManager: false,
      fromElement: false,
      selectorManager: { componentFirst: true },
      blockManager: { blocks: starterBlocks }
    });
    editor.runCommand('open-blocks');
    setupBlocksResizer(editor.Blocks.getContainer());
  }

  async function loadTemplate() {
    if (!templateId) return;
    loading = true;
    loadError = '';
    statusMessage = '';
    try {
      await ensureEditor();
      const files = await getTemplateFiles(templateType, templateId);
      loadedTemplate = files;
      rawHtmlContent = files.html_content || '';
      rawCssContent = files.css_content || '';
      refreshPreviewFromSource();
      statusMessage = `Loaded ${files.label}.`;
    } catch (error) {
      loadError = error?.message || 'Unable to load template.';
    } finally {
      loading = false;
    }
  }

  async function saveTemplate() {
    if (!loadedTemplate) return;
    saving = true;
    loadError = '';
    statusMessage = '';
    try {
      const body = {
        html_content: rebuildTemplateHtmlFromSource(),
        css_content: rawCssContent
      };
      loadedTemplate = await updateTemplateFiles(templateType, templateId, body);
      rawHtmlContent = loadedTemplate.html_content || '';
      rawCssContent = loadedTemplate.css_content || '';
      refreshPreviewFromSource();
      statusMessage = `Saved ${loadedTemplate.label}.`;
    } catch (error) {
      loadError = error?.message || 'Unable to save template.';
    } finally {
      saving = false;
    }
  }

  async function handleRefreshRegistry() {
    refreshing = true;
    loadError = '';
    statusMessage = '';
    try {
      templates = await refreshTemplates();
      if (!templateCollection(templateType).some((item) => item.id === templateId)) {
        templateId = '';
      }
      statusMessage = 'Template library refreshed from disk.';
    } catch (error) {
      loadError = error?.message || 'Unable to refresh template library.';
    } finally {
      refreshing = false;
    }
  }

  async function handleCreateTemplate() {
    if (!createLabel.trim()) return;
    creating = true;
    loadError = '';
    statusMessage = '';
    try {
      templates = await createTemplate({
        template_type: createType,
        label: createLabel.trim(),
        source_template_id: createSourceId || undefined
      });
      templateType = createType;
      templateId = templateCollection(createType).at(-1)?.id ?? '';
      createLabel = '';
      statusMessage = 'Template created.';
      await loadTemplate();
    } catch (error) {
      loadError = error?.message || 'Unable to create template.';
    } finally {
      creating = false;
    }
  }

  async function handleDeleteTemplate() {
    if (!templateId) return;
    if (!window.confirm(`Delete template "${templateId}"?`)) return;
    deleting = true;
    loadError = '';
    statusMessage = '';
    try {
      templates = await deleteTemplate(templateType, templateId);
      editor?.setComponents('');
      editor?.setStyle('');
      loadedTemplate = null;
      rawHtmlContent = '';
      rawCssContent = '';
      templateId = '';
      statusMessage = 'Template deleted.';
      if (templateId) {
        await loadTemplate();
      }
    } catch (error) {
      loadError = error?.message || 'Unable to delete template.';
    } finally {
      deleting = false;
    }
  }

  onMount(async () => {
    await loadRegistry();
    await ensureEditor();
    return () => {
      blocksResizeCleanup?.();
      blocksResizeCleanup = null;
      editor?.destroy();
    };
  });
</script>

<svelte:head>
  <title>Template Builder | Internal Facing</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
  <div>
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Visual Templates</p>
    <h1 class="h3 mb-1">Template Builder</h1>
    <p class="text-body-secondary mb-0">Edit the real HTML/CSS source safely, and use GrapesJS as a live preview sandbox for the template body.</p>
  </div>
  <div class="d-flex gap-2 flex-wrap">
    <button class="btn btn-outline-secondary" type="button" on:click={handleRefreshRegistry} disabled={refreshing}>
      {refreshing ? 'Refreshing...' : 'Refresh template library'}
    </button>
    <button class="btn btn-primary" type="button" on:click={saveTemplate} disabled={saving || !loadedTemplate}>
      {saving ? 'Saving...' : 'Save template'}
    </button>
  </div>
</div>

{#if loadError}
  <div class="alert alert-danger">{loadError}</div>
{/if}
{#if statusMessage}
  <div class="alert alert-success">{statusMessage}</div>
{/if}

<div class="row g-3">
  <div class="col-12 col-xxl-3">
    <div class="vstack gap-3">
      <div class="card shadow-sm">
        <div class="card-body">
          <h2 class="h5 mb-3">Open Template</h2>
          <div class="vstack gap-3">
            <div>
              <label class="form-label" for="template-type">Template type</label>
              <select
                id="template-type"
                class="form-select"
                bind:value={templateType}
                on:change={() => {
                  templateId = '';
                  loadedTemplate = null;
                  statusMessage = '';
                  loadError = '';
                }}
              >
                <option value="">-- Choose option --</option>
                <option value="product">Product</option>
                <option value="series">Series</option>
              </select>
            </div>
            <div>
              <label class="form-label" for="template-id">Template</label>
              <select id="template-id" class="form-select" bind:value={templateId} disabled={!templateType}>
                <option value="">-- Choose option --</option>
                {#each availableTemplates as entry}
                  <option value={entry.id}>{entry.label}</option>
                {/each}
              </select>
            </div>
            <button class="btn btn-outline-primary" type="button" on:click={loadTemplate} disabled={loading || !templateId}>
              {loading ? 'Loading...' : 'Load template'}
            </button>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h2 class="h5 mb-3">Create Template</h2>
          <div class="vstack gap-3">
            <div>
              <label class="form-label" for="create-type">Template type</label>
              <select id="create-type" class="form-select" bind:value={createType} on:change={() => { createSourceId = ''; }}>
                <option value="">-- Choose option --</option>
                <option value="product">Product</option>
                <option value="series">Series</option>
              </select>
            </div>
            <div>
              <label class="form-label" for="create-label">Label</label>
              <input id="create-label" class="form-control" bind:value={createLabel} placeholder="Compact product template" />
            </div>
            <div>
              <label class="form-label" for="create-source">Clone existing</label>
              <select id="create-source" class="form-select" bind:value={createSourceId} disabled={!createType}>
                <option value="">Blank scaffold</option>
                {#each createSourceTemplates as entry}
                  <option value={entry.id}>{entry.label}</option>
                {/each}
              </select>
            </div>
            <button class="btn btn-outline-primary" type="button" on:click={handleCreateTemplate} disabled={creating || !createLabel.trim() || !createType}>
              {creating ? 'Creating...' : 'Create template'}
            </button>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h2 class="h5 mb-3">Template Info</h2>
          {#if loadedTemplate}
            <dl class="row small mb-0">
              <dt class="col-4">HTML</dt>
              <dd class="col-8 text-break">{loadedTemplate.html_path}</dd>
              <dt class="col-4">CSS</dt>
              <dd class="col-8 text-break">{loadedTemplate.css_path || 'template.css'}</dd>
              <dt class="col-4">Mode</dt>
              <dd class="col-8">Source-first save, visual preview only</dd>
            </dl>
            <hr />
            <button class="btn btn-outline-secondary btn-sm me-2" type="button" on:click={refreshPreviewFromSource}>
              Refresh visual preview
            </button>
            <button class="btn btn-outline-danger btn-sm" type="button" on:click={handleDeleteTemplate} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete template'}
            </button>
          {:else}
            <p class="text-body-secondary mb-0">Load a template to inspect its file paths and edit it.</p>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="col-12 col-xxl-9">
    <div class="card shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h2 class="h5 mb-1">Source Editors</h2>
            <p class="text-body-secondary mb-0">These fields are the real saved template source. Save here to preserve your handcrafted layout.</p>
          </div>
          <button class="btn btn-outline-secondary btn-sm" type="button" on:click={refreshPreviewFromSource} disabled={!loadedTemplate}>
            Refresh visual preview
          </button>
        </div>
        <div class="row g-3">
          <div class="col-12 col-xl-7">
            <label class="form-label" for="template-html-source">HTML</label>
            <textarea
              id="template-html-source"
              class="form-control font-monospace"
              rows="22"
              bind:value={rawHtmlContent}
              spellcheck="false"
              disabled={!loadedTemplate}
            ></textarea>
          </div>
          <div class="col-12 col-xl-5">
            <label class="form-label" for="template-css-source">CSS</label>
            <textarea
              id="template-css-source"
              class="form-control font-monospace"
              rows="22"
              bind:value={rawCssContent}
              spellcheck="false"
              disabled={!loadedTemplate}
            ></textarea>
          </div>
        </div>
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h2 class="h5 mb-1">Visual Preview Sandbox</h2>
            <p class="text-body-secondary mb-0">Drag-and-drop here to experiment, but use the source editors above for the final saved version.</p>
          </div>
        </div>
        <div bind:this={editorHost} class="template-editor-host border rounded overflow-hidden"></div>
      </div>
    </div>
  </div>
</div>

<style>
  .template-editor-host {
    min-height: 78vh;
    background: var(--bs-body-bg);
  }

  .template-editor-host :global(.gjs-pn-panel) {
    background: #1f2937;
    color: #f9fafb;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .template-editor-host :global(.gjs-pn-panels) {
    background: linear-gradient(180deg, #111827 0%, #1f2937 100%);
    color: #f9fafb;
  }

  .template-editor-host :global(.gjs-blocks-c) {
    min-width: 280px;
    max-width: 560px;
    width: 22rem;
    background: #f8fafc;
    border-left: 1px solid rgba(15, 23, 42, 0.12);
    box-sizing: border-box;
  }

  .template-editor-host :global(.template-blocks-resizer) {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 10px;
    cursor: ew-resize;
    background: linear-gradient(90deg, rgba(15, 23, 42, 0.16), transparent);
    z-index: 2;
  }

  .template-editor-host :global(.template-blocks-resizer:hover) {
    background: linear-gradient(90deg, rgba(37, 99, 235, 0.35), transparent);
  }

  .template-editor-host :global(.gjs-title) {
    background: #e2e8f0;
    color: #0f172a;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .template-editor-host :global(.gjs-title:hover) {
    color: #0f172a;
  }

  .template-editor-host :global(.gjs-category-open .gjs-title) {
    color: #0f172a;
  }

  .template-editor-host :global(.gjs-pn-btn) {
    color: #e5e7eb;
  }

  .template-editor-host :global(.gjs-pn-btn:hover),
  .template-editor-host :global(.gjs-pn-btn.gjs-pn-active) {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.12);
  }

  .template-editor-host :global(.gjs-block) {
    border: 1px solid rgba(15, 23, 42, 0.14);
    border-radius: 0.5rem;
    background: #ffffff;
    color: #0f172a;
    cursor: grab;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease,
      background-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .template-editor-host :global(.gjs-block:hover) {
    border-color: rgba(37, 99, 235, 0.35);
    background: #eff6ff;
    box-shadow: 0 0.35rem 0.85rem rgba(37, 99, 235, 0.12);
    transform: translateY(-1px);
  }

  .template-editor-host :global(.gjs-block:active) {
    cursor: grabbing;
    transform: translateY(0);
  }

  .template-editor-host :global(.gjs-block-label) {
    color: #0f172a;
    font-weight: 600;
    opacity: 1;
  }

  .template-editor-host :global(.gjs-blocks-c .gjs-category-title) {
    color: #0f172a;
    background: #dbe4f0;
    border-bottom: 1px solid rgba(15, 23, 42, 0.12);
  }

  .template-editor-host :global(.gjs-blocks-c .gjs-category-title:hover) {
    color: #0f172a;
  }

  .template-editor-host :global(.gjs-block svg),
  .template-editor-host :global(.gjs-block img) {
    max-width: 100%;
  }
</style>
