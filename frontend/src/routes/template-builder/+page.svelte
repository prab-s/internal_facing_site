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
    const bodyInner = body ? body.innerHTML : htmlContent;
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

  function rebuildTemplateHtml() {
    if (!editor) return loadedTemplate?.html_content ?? '';
    const bodyHtml = editor.getHtml();
    if (!headPrefix && !bodySuffix) return bodyHtml;
    return `${headPrefix}\n${bodyHtml}\n${bodySuffix}`;
  }

  async function loadRegistry() {
    templates = await getTemplates();
  }

  async function ensureEditor() {
    if (editor || !editorHost) return;
    grapesModule = grapesModule ?? (await import('grapesjs')).default;
    editor = grapesModule.init({
      container: editorHost,
      height: '78vh',
      storageManager: false,
      fromElement: false,
      selectorManager: { componentFirst: true },
      blockManager: {
        appendTo: '#gjs-blocks',
        blocks: [
          { id: 'section', label: 'Section', content: '<section class="template-section"><h2>Section</h2><p>Content</p></section>' },
          { id: 'two-col', label: 'Two Columns', content: '<div class="row"><div class="col"><p>Left</p></div><div class="col"><p>Right</p></div></div>' },
          { id: 'image', label: 'Image', content: '<img src="{{product.primary_product_image_url}}" alt="Template image" />' },
          { id: 'spec-table', label: 'Specs Table', content: '<div>{{product.grouped_specs_table}}</div>' },
          { id: 'product-graph', label: 'Product Graph', content: '<div>{{product.graph_image_tag}}</div>' },
          { id: 'series-graph', label: 'Series Graph', content: '<div>{{series.graph_image_tag}}</div>' },
          { id: 'product-pdf-title', label: 'Product Title', content: '<h1>{{product.model}}</h1>' },
          { id: 'series-title', label: 'Series Title', content: '<h1>{{series.name}}</h1>' }
        ]
      }
    });
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
      const parsed = extractEditableSections(files.html_content);
      headPrefix = parsed.headPrefix;
      bodySuffix = parsed.bodySuffix;
      editor.setComponents(parsed.bodyHtml);
      editor.setStyle(files.css_content || '');
      statusMessage = `Loaded ${files.label}.`;
    } catch (error) {
      loadError = error?.message || 'Unable to load template.';
    } finally {
      loading = false;
    }
  }

  async function saveTemplate() {
    if (!editor || !loadedTemplate) return;
    saving = true;
    loadError = '';
    statusMessage = '';
    try {
      const body = {
        html_content: rebuildTemplateHtml(),
        css_content: editor.getCss()
      };
      loadedTemplate = await updateTemplateFiles(templateType, templateId, body);
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
    return () => editor?.destroy();
  });
</script>

<svelte:head>
  <title>Template Builder | Internal Facing</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
  <div>
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Visual Templates</p>
    <h1 class="h3 mb-1">Template Builder</h1>
    <p class="text-body-secondary mb-0">Use GrapesJS to visually edit the HTML body of product and series PDF templates, while preserving the full file wrapper and saving CSS alongside it.</p>
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
              <dd class="col-8">Visual body editing with full wrapper preserved</dd>
            </dl>
            <hr />
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
    <div class="card shadow-sm">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-12 col-xl-3">
            <div class="border rounded p-2 bg-body-tertiary">
              <div class="small text-uppercase text-body-secondary fw-semibold mb-2">Blocks</div>
              <div id="gjs-blocks" class="template-blocks"></div>
            </div>
          </div>
          <div class="col-12 col-xl-9">
            <div bind:this={editorHost} class="template-editor-host border rounded overflow-hidden"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .template-editor-host {
    min-height: 78vh;
    background: var(--bs-body-bg);
  }

  .template-blocks :global(.gjs-block) {
    width: 100%;
    min-height: auto;
    margin-bottom: 0.5rem;
    padding: 0.75rem;
    box-shadow: none;
  }

  .template-blocks :global(.gjs-one-bg) {
    background: var(--bs-body-bg);
  }

  .template-blocks :global(.gjs-four-color-h:hover) {
    color: inherit;
  }
</style>
