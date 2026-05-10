<script>
  import { onMount } from 'svelte';
  import 'grapesjs/dist/css/grapes.min.css';
  import {
    createTemplate,
    deleteTemplate,
    getTemplateFiles,
    getProductTypePdfContext,
    getProductTypes,
    getTemplates,
    refreshTemplates,
    updateTemplateFiles,
    uploadTemplateAsset
  } from '$lib/api.js';
  import SeriesNamesBadgeList from '$lib/editor/SeriesNamesBadgeList.svelte';
  import { buildTemplateBlocks } from '$lib/template-builder/blocks.js';
  import SourceEditor from '$lib/template-builder/SourceEditor.svelte';
  import { installAdvancedGradientControls } from '$lib/template-builder/advancedGradient.js';
  import { installHtmlAttributeControls } from '$lib/template-builder/htmlAttributes.js';
  import {
    formatCssSource,
    formatHtmlSource,
    renderPreviewHtmlSource,
    restorePreviewHtmlSource,
    safeJoinText,
    stripTemplateStylesheetLinks,
    splitTemplateDocument
  } from '$lib/template-builder/source.js';

  let grapesModule = null;
  let presetWebpageModule = null;
  let blocksBasicModule = null;
  let pluginExportModule = null;

  let editorHost;
  let editor = null;
  let templates = { product_templates: [], series_templates: [], product_type_templates: [] };
  let productTypes = [];
  let templateType = '';
  let templateId = '';
  let previewProductTypeKey = '';
  let previewProductTypeContext = null;
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
  let sidebarResizeCleanup = null;
  let sidebarPane;
  let sidebarResizer;
  let htmlSyncTimeout = null;
  let cssSyncTimeout = null;
  const canvasCssStyleId = 'template-builder-v2-canvas-css';
  const sidebarMinWidth = 300;
  const sidebarMaxWidth = 520;
  let sidebarWidth = 360;
  let syncingHtmlFromSource = false;
  let syncingHtmlFromEditor = false;
  let syncingCssFromSource = false;
  let syncingCssFromEditor = false;
  let lastAutoLoadedTemplateKey = '';
  let sidebarResizeActive = false;
  let suppressCssPullUntil = 0;

  function templateCollection(type) {
    if (type === 'series') return templates.series_templates ?? [];
    if (type === 'product_type') return templates.product_type_templates ?? [];
    return templates.product_templates ?? [];
  }

  $: availableTemplates = templateCollection(templateType);
  $: createSourceTemplates = templateCollection(createType);
  $: previewProductType = productTypes.find((item) => item.key === previewProductTypeKey) || null;
  $: if (templateType && templateId) {
    const selectedTemplateKey = `${templateType}:${templateId}`;
    if (selectedTemplateKey !== lastAutoLoadedTemplateKey) {
      lastAutoLoadedTemplateKey = selectedTemplateKey;
      void loadTemplate();
    }
  } else {
    lastAutoLoadedTemplateKey = '';
  }

  function createPreviewPlaceholder(label) {
    return (
      'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
          <rect width="100%" height="100%" fill="#e9ecef"/>
          <rect x="24" y="24" width="912" height="492" rx="18" fill="#f8f9fa" stroke="#ced4da" stroke-width="4"/>
          <text x="50%" y="50%" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#6c757d">
            ${label}
          </text>
        </svg>`
      )
    );
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  const seriesPreviewColors = ['#21406f', '#4f7cac', '#7f8c8d', '#b5651d', '#9b3d5a', '#2f7a54'];

  function previewSeriesColor(index) {
    return seriesPreviewColors[index % seriesPreviewColors.length];
  }

  function createPreviewTable(title, rows) {
    return `
      <div class="preview-data-block">
        <div class="preview-data-block__title">${escapeHtml(title)}</div>
        <table class="preview-data-table">
          <tbody>
            ${rows
              .map(
                ([label, value]) => `
                  <tr>
                    <th>${escapeHtml(label)}</th>
                    <td>${value}</td>
                  </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function createPreviewList(items) {
    return `
      <ul class="preview-data-list">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    `;
  }

  function createPreviewSpecsHtml(title) {
    return `
      <div class="preview-specs">
        <div class="preview-specs__title">${escapeHtml(title)}</div>
        ${createPreviewTable('Specifications', [
          ['Airflow', '1,250 m3/h'],
          ['Pressure', '190 Pa'],
          ['Power', '380 W']
        ])}
      </div>
    `;
  }

  function buildPreviewTokenMap() {
    const previewSeriesNames = previewProductType?.series_names?.length ? previewProductType.series_names : ['Series A', 'Series B'];
    const previewSeriesGroups = previewProductTypeContext?.series?.length ? previewProductTypeContext.series : [];
    return {
      '{{product.model}}': 'Sample Model 3000',
      '{{product.product_type_label}}': previewProductType?.label || 'Sample Product Type',
      '{{product.series_name}}': previewSeriesNames[0] || 'Sample Series',
      '{{product.primary_product_image_url}}': createPreviewPlaceholder('Product image preview'),
      '{{product.graph_image_url}}': createPreviewPlaceholder('Product graph preview'),
      '{{series.graph_image_url}}': createPreviewPlaceholder('Series graph preview'),
      '{{product.grouped_specs_impeller_html}}': createPreviewSpecsHtml('Impeller'),
      '{{product.grouped_specs_motor_html}}': createPreviewSpecsHtml('Motor'),
      '{{product.grouped_specs_fan_html}}': createPreviewSpecsHtml('Fan'),
      '{{product.description1_html}}': '<p>Sample product description block. This is where the product overview appears.</p>',
      '{{product.description2_html}}': '<p>Sample product feature block. Add supporting product details here.</p>',
      '{{product.description3_html}}': '<p>Sample product specification block. Additional product detail appears here.</p>',
      '{{product.comments_html}}': '<p>Sample product comments appear here.</p>',
      '{{product.features_html}}': createPreviewList(['Key feature one', 'Key feature two', 'Key feature three']),
      '{{product.specifications_html}}': createPreviewTable('Specifications', [
        ['Duty', 'Continuous'],
        ['Voltage', '415V'],
        ['Frequency', '50Hz']
      ]),
      '{{product.description_html}}': '<p>Sample product description block. This is where the product overview appears.</p>',
      '{{product.description}}': '<p>Sample product description. This space is used for the main product summary and key selling points.</p>',
      '{{product.applications}}':
        createPreviewList([
          'Commercial ventilation',
          'Industrial process air',
          'General purpose exhaust'
        ]),
      '{{product.grouped_specs_table}}': createPreviewTable('Grouped Specs', [
        ['Model', 'Sample Model 3000'],
        ['Frame', 'Cast aluminum'],
        ['Finish', 'Powder coated']
      ]),
      '{{product.fan_map_points_table}}': createPreviewTable('Fan Map Points', [
        ['Point A', '1,250 m3/h'],
        ['Point B', '1,100 m3/h'],
        ['Point C', '980 m3/h']
      ]),
      '{{product.image_gallery}}': `
        <div class="preview-gallery">
          <img src="${createPreviewPlaceholder('Gallery image preview')}" alt="Gallery image preview" />
          <img src="${createPreviewPlaceholder('Gallery image preview')}" alt="Gallery image preview" />
        </div>
      `,
      '{{product.graph_image_tag}}': `<img src="${createPreviewPlaceholder('Product graph preview')}" alt="Product graph preview" />`,
      '{{series.name}}': previewSeriesNames[0] || 'Sample Series',
      '{{series.description1_html}}': '<p>Sample series description shown in the editor preview.</p>',
      '{{series.description2_html}}': '<p>Additional series description preview text.</p>',
      '{{series.description3_html}}': '<p>Further series description preview text.</p>',
      '{{series.graph_image_tag}}': `<img src="${createPreviewPlaceholder('Series graph preview')}" alt="Series graph preview" />`,
      '{{product_type.label}}': previewProductType?.label || 'Product Type',
      '{{product_type.key}}': previewProductType?.key || 'product-type',
      '{{product_type.contents_icon_url}}': createPreviewPlaceholder('Contents icon preview'),
      '{{product_type.series_names}}': safeJoinText(previewSeriesNames),
      '{{product_type.series_names_html}}': renderSeriesNamesPreview(previewSeriesNames),
      '{{product_type.series_legend_html}}': renderSeriesLegendPreview(previewSeriesNames),
      '{{product_type.series_groups_html}}': renderSeriesGroupsPreview(previewSeriesGroups),
      '{{product_type.contents_html}}': renderSeriesGroupsPreview(previewSeriesGroups),
      '{{product_type.series_groups}}': previewSeriesGroups.length
        ? previewSeriesGroups.map((series) => `<div>${escapeHtml(series.name || 'Series')}</div>`).join('')
        : '<div>Series group preview</div>'
    };
  }

  function createPreviewTokenResolver() {
    const previewTokenMap = buildPreviewTokenMap();

    return (token, context = 'text') => {
      const tokenValue = previewTokenMap[token];
      if (tokenValue == null || tokenValue === '') {
        if (token.startsWith('{%') || token.startsWith('{#')) return '';
        return context === 'attr' ? '' : 'No data available';
      }
      return tokenValue;
    };
  }

  function renderSeriesNamesPreview(seriesNames) {
    if (!seriesNames?.length) {
      return '<p class="placeholder">No series are linked to this product type yet.</p>';
    }

    return `<ul class="series-names">${seriesNames
      .map((seriesName) => `<li class="series-names__item"><span class="series-names__name">${escapeHtml(seriesName)}</span></li>`)
      .join('')}</ul>`;
  }

  function renderSeriesLegendPreview(seriesNames) {
    if (!seriesNames?.length) {
      return '<p class="placeholder">No series are linked to this product type yet.</p>';
    }

    return `<ul class="series-legend">${seriesNames
      .map(
        (seriesName, index) => `
              <li class="series-legend__item">
                <span class="series-legend__swatch" style="background:${previewSeriesColor(index)};"></span>
                <div class="series-legend__text">
              <div class="series-legend__name">${escapeHtml(seriesName)}</div>
              <div class="series-legend__meta">Preview series</div>
            </div>
          </li>`
      )
      .join('')}</ul>`;
  }

  function renderSeriesGroupsPreview(seriesGroups) {
    if (!seriesGroups?.length) {
      return '<p class="placeholder">Product type contents preview</p>';
    }

    return `<section class="series-tile-grid">${seriesGroups
      .map(
        (series) => `
          <article class="series-tile" style="--series-accent: ${escapeHtml(series.series_tab_color || previewSeriesColor(Number(series.id) || 0))};">
            <div class="series-tile__badge">${escapeHtml(series.name)}</div>
            <div class="series-tile__image-wrap">
              ${
                series.first_product_image_uri
                  ? `<img class="series-tile__image" src="${escapeHtml(series.first_product_image_uri)}" alt="${escapeHtml(series.name)}" />`
                  : '<div class="series-tile__placeholder">No image</div>'
              }
            </div>
            <div class="series-tile__description">
              ${series.series_description_html || '<p class="placeholder">No description provided.</p>'}
            </div>
          </article>`
      )
      .join('')}</section>`;
  }

  function prepareBodyForEditor(bodyHtml) {
    const resolvePreviewToken = createPreviewTokenResolver();
    const previewApplied = stripTemplateStylesheetLinks(
      renderPreviewHtmlSource(bodyHtml, resolvePreviewToken)
    );
    return previewApplied;
  }

  function restoreBodyFromEditor(editorHtml) {
    return restorePreviewHtmlSource(editorHtml);
  }

  function rebuildTemplateHtmlFromSource() {
    const parsed = splitTemplateDocument(rawHtmlContent);
    if (!parsed.headPrefix && !parsed.bodySuffix) return parsed.bodyHtml;
    return `${parsed.headPrefix}\n${parsed.bodyHtml}\n${parsed.bodySuffix}`;
  }

  function formatSourceEditors() {
    rawHtmlContent = formatHtmlSource(rawHtmlContent);
    rawCssContent = formatCssSource(rawCssContent);
    refreshPreviewFromSource();
    syncCanvasCssIntoFrame();
  }

  function refreshPreviewFromSource() {
    if (!editor) return;
    pushHtmlSourceToEditor();
    pushCssSourceToEditor();
  }

  function getEditorHtmlContent() {
    if (!editor) return '';
    const parsed = splitTemplateDocument(rawHtmlContent);
    const bodyHtml = restoreBodyFromEditor(editor.getHtml());
    return parsed.headPrefix || parsed.bodySuffix ? `${parsed.headPrefix}\n${bodyHtml}\n${parsed.bodySuffix}` : bodyHtml;
  }

  function getEditorCssContent() {
    return editor?.getCss({ keepUnusedStyles: true, avoidProtected: false }) || '';
  }

  function pushHtmlSourceToEditor() {
    if (!editor || syncingHtmlFromEditor) return;
    syncingHtmlFromSource = true;
    try {
      const parsed = splitTemplateDocument(rawHtmlContent);
      headPrefix = parsed.headPrefix;
      bodySuffix = parsed.bodySuffix;
      editor.setComponents(prepareBodyForEditor(parsed.bodyHtml));
    } finally {
      syncingHtmlFromSource = false;
    }
  }

  function pullHtmlFromEditor() {
    if (!editor || syncingHtmlFromSource) return;
    syncingHtmlFromEditor = true;
    try {
      rawHtmlContent = getEditorHtmlContent();
      const parsed = splitTemplateDocument(rawHtmlContent);
      headPrefix = parsed.headPrefix;
      bodySuffix = parsed.bodySuffix;
    } finally {
      syncingHtmlFromEditor = false;
    }
  }

  function scheduleHtmlPullFromEditor() {
    if (!editor || syncingHtmlFromSource) return;
    window.clearTimeout(htmlSyncTimeout);
    htmlSyncTimeout = window.setTimeout(() => {
      pullHtmlFromEditor();
    }, 120);
  }

  function pushCssSourceToEditor() {
    if (!editor || syncingCssFromEditor) return;
    syncingCssFromSource = true;
    suppressCssPullUntil = Date.now() + 750;
    try {
      editor.setStyle(rawCssContent || '');
      syncCanvasCssIntoFrame();
    } finally {
      syncingCssFromSource = false;
    }
  }

  function pullCssFromEditor() {
    if (!editor || syncingCssFromSource) return;
    if (Date.now() < suppressCssPullUntil) return;
    syncingCssFromEditor = true;
    try {
      rawCssContent = getEditorCssContent();
    } finally {
      syncingCssFromEditor = false;
    }
  }

  function scheduleCssPullFromEditor() {
    if (!editor || syncingCssFromSource) return;
    if (Date.now() < suppressCssPullUntil) return;
    window.clearTimeout(cssSyncTimeout);
    cssSyncTimeout = window.setTimeout(() => {
      pullCssFromEditor();
    }, 120);
  }

  function syncCanvasCssIntoFrame() {
    if (!editor) return;
    const doc = editor.Canvas.getDocument();
    if (!doc?.head) return;

    let styleEl = doc.getElementById(canvasCssStyleId);
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = canvasCssStyleId;
      doc.head.appendChild(styleEl);
    }

    styleEl.textContent = rawCssContent || '';
  }

  function handleCssSourceInput(event) {
    rawCssContent = event.currentTarget.value;
    pushCssSourceToEditor();
    syncCanvasCssIntoFrame();
  }

  function handleHtmlSourceInput(event) {
    rawHtmlContent = event.currentTarget.value;
    pushHtmlSourceToEditor();
  }

  function buildTemplateHtmlForSave() {
    if (editor) {
      return {
        html_content: formatHtmlSource(getEditorHtmlContent()),
        css_content: formatCssSource(getEditorCssContent())
      };
    }

    return {
      html_content: formatHtmlSource(rebuildTemplateHtmlFromSource()),
      css_content: formatCssSource(rawCssContent)
    };
  }

  function startSidebarResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarPane?.getBoundingClientRect().width || sidebarWidth;
    const handleElement = event.currentTarget;

    sidebarResizeActive = true;
    handleElement?.setPointerCapture?.(event.pointerId);

    const onPointerMove = (moveEvent) => {
      const nextWidth = Math.min(
        sidebarMaxWidth,
        Math.max(sidebarMinWidth, startWidth + (moveEvent.clientX - startX))
      );
      sidebarWidth = nextWidth;
    };

    const onPointerUp = () => {
      sidebarResizeActive = false;
      handleElement?.releasePointerCapture?.(event.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }

  function handleSidebarResizeKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -16 : 16;
    sidebarWidth = Math.min(sidebarMaxWidth, Math.max(sidebarMinWidth, sidebarWidth + delta));
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
    const [registry, types] = await Promise.all([
      getTemplates(),
      getProductTypes().catch(() => [])
    ]);
    templates = registry;
    productTypes = types;
    if (!previewProductTypeKey && productTypes.length > 0) {
      previewProductTypeKey = productTypes[0].key;
      await loadPreviewProductTypeContext(previewProductTypeKey);
    }
  }

  async function loadPreviewProductTypeContext(key = previewProductTypeKey) {
    const selectedProductType = productTypes.find((item) => item.key === key) || null;
    if (!selectedProductType) {
      previewProductTypeContext = null;
      return;
    }

    try {
      previewProductTypeContext = await getProductTypePdfContext(selectedProductType.id);
    } catch {
      previewProductTypeContext = null;
    }
  }

  async function ensureEditor() {
    if (editor || !editorHost) return;

    if (!grapesModule) {
      [grapesModule, presetWebpageModule, blocksBasicModule, pluginExportModule] = await Promise.all([
        import('grapesjs').then((mod) => mod.default),
        import('grapesjs-preset-webpage').then((mod) => mod.default),
        import('grapesjs-blocks-basic').then((mod) => mod.default),
        import('grapesjs-plugin-export').then((mod) => mod.default)
      ]);
    }

    editor = grapesModule.init({
      container: editorHost,
      height: '78vh',
      storageManager: false,
      fromElement: false,
      selectorManager: { componentFirst: true },
      blockManager: { blocks: buildTemplateBlocks() },
      plugins: [presetWebpageModule, blocksBasicModule, pluginExportModule]
    });

    editor.on('component:add', scheduleHtmlPullFromEditor);
    editor.on('component:remove', scheduleHtmlPullFromEditor);
    editor.on('component:update', scheduleHtmlPullFromEditor);
    editor.on('component:styleUpdate', scheduleHtmlPullFromEditor);
    editor.on('component:resize:update', scheduleHtmlPullFromEditor);
    editor.on('component:resize:end', scheduleHtmlPullFromEditor);
    editor.on('component:styleUpdate', scheduleCssPullFromEditor);
    editor.on('style:property:update', scheduleCssPullFromEditor);
    editor.on('style:sector:update', scheduleCssPullFromEditor);
    editor.on('canvas:frame:load', syncCanvasCssIntoFrame);
    installAdvancedGradientControls(editor);
    installHtmlAttributeControls(editor, {
      uploadImageAsset: uploadSelectedImageAsset
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
      rawHtmlContent = formatHtmlSource(files.html_content || '');
      rawCssContent = formatCssSource(files.css_content || '');
      refreshPreviewFromSource();
      syncCanvasCssIntoFrame();
      statusMessage = `Loaded ${files.label}.`;
    } catch (error) {
      loadError = error?.message || 'Unable to load template.';
    } finally {
      loading = false;
    }
  }

  async function uploadSelectedImageAsset(file, dataUrl) {
    if (!loadedTemplate || !templateType || !templateId) {
      return null;
    }

    const response = await uploadTemplateAsset(templateType, templateId, {
      filename: file.name,
      data_url: dataUrl
    });

    return response?.file_url || null;
  }

  async function saveTemplate() {
    if (!loadedTemplate) return;
    saving = true;
    loadError = '';
    statusMessage = '';
    try {
      const body = buildTemplateHtmlForSave();
      loadedTemplate = await updateTemplateFiles(templateType, templateId, body);
      rawHtmlContent = formatHtmlSource(loadedTemplate.html_content || '');
      rawCssContent = formatCssSource(loadedTemplate.css_content || '');
      refreshPreviewFromSource();
      syncCanvasCssIntoFrame();
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
      if ((createType === 'product' || createType === 'product_type') && !previewProductTypeKey && productTypes.length > 0) {
        previewProductTypeKey = productTypes[0].key;
      }
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
      window.clearTimeout(htmlSyncTimeout);
      window.clearTimeout(cssSyncTimeout);
      editor?.destroy();
    };
  });
</script>

<svelte:head>
  <title>Template Builder V2 | Internal Facing</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
  <div>
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Visual Templates</p>
    <h1 class="h3 mb-1">Template Builder V2</h1>
    <p class="text-body-secondary mb-0">Experimental builder with safer Jinja handling, stronger GrapesJS defaults, and the same template-loading workflow.</p>
  </div>
  <div class="d-flex gap-2 flex-wrap">
    <a class="btn btn-outline-secondary" href="/template-builder">Open legacy builder</a>
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

<div class="template-builder-v2-shell" style={`--sidebar-width: ${sidebarWidth}px;`}>
  <aside class="template-builder-v2-sidebar" bind:this={sidebarPane}>
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
                <option value="product_type">Product Type</option>
              </select>
            </div>
            <div>
              <label class="form-label" for="template-id">Template</label>
              <select
                id="template-id"
                class="form-select"
                bind:value={templateId}
                disabled={!templateType}
              >
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
                <option value="product_type">Product Type</option>
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
              <dt class="col-4">Resolved CSS</dt>
              <dd class="col-8 text-break">{loadedTemplate.css_path || 'template.css'}</dd>
              <dt class="col-4">Mode</dt>
              <dd class="col-8">Source editors stay visible, and sandbox edits are included on save</dd>
            </dl>
            <div class="small text-body-secondary mt-2">
              The builder looks for the stylesheet beside the template HTML first, then falls back to the registry path.
            </div>
            <hr />
            <button class="btn btn-outline-secondary btn-sm me-2" type="button" on:click={refreshPreviewFromSource}>
              Refresh visual preview
            </button>
            <button class="btn btn-outline-secondary btn-sm me-2" type="button" on:click={formatSourceEditors} disabled={!loadedTemplate}>
              Format source
            </button>
            <button class="btn btn-outline-danger btn-sm" type="button" on:click={handleDeleteTemplate} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete template'}
            </button>
          {:else}
            <p class="text-body-secondary mb-0">Load a template to inspect its file paths and edit it.</p>
          {/if}
        </div>
      </div>

      {#if (templateType === 'product' || templateType === 'product_type') && productTypes.length > 0}
        <div class="card shadow-sm">
          <div class="card-body">
            <h2 class="h5 mb-3">Preview data context</h2>
            <label class="form-label" for="preview-product-type">Product type</label>
            <select
              id="preview-product-type"
              class="form-select mb-3"
              bind:value={previewProductTypeKey}
              on:change={() => loadPreviewProductTypeContext(previewProductTypeKey)}
            >
              {#each productTypes as productType}
                <option value={productType.key}>{productType.label}</option>
              {/each}
            </select>

            {#if previewProductType}
              <SeriesNamesBadgeList
                seriesNames={previewProductType.series_names || []}
                title={`Series names for ${previewProductType.label}`}
                emptyLabel="This product type does not have any series yet."
              />
              {#if templateType === 'product_type' && previewProductTypeContext}
                <div class="mt-3">
                  <div class="small text-body-secondary mb-2">Product type PDF context</div>
                  <div class="border rounded p-3 bg-body-tertiary small">
                    <div>Intro pages: {previewProductTypeContext.intro_page_count}</div>
                    <div>Total pages: {previewProductTypeContext.page_count}</div>
                    <div class="mt-2">Series groups and page ranges are available from the context endpoint.</div>
                  </div>
                </div>
              {/if}
            {:else}
              <p class="text-body-secondary mb-0">Choose a product type to inspect its linked series names.</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </aside>

  <button
    type="button"
    class={`template-builder-v2-divider ${sidebarResizeActive ? 'is-dragging' : ''}`}
    bind:this={sidebarResizer}
    aria-label="Resize sidebar"
    on:pointerdown={startSidebarResize}
    on:keydown={handleSidebarResizeKeydown}
  ></button>

  <section class="template-builder-v2-main">
    <div class="card shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h2 class="h5 mb-1">Source Editors</h2>
            <p class="text-body-secondary mb-0">These fields show the saved template source. Sandbox edits are folded back into this source when you click Save.</p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={refreshPreviewFromSource} disabled={!loadedTemplate}>
              Refresh visual preview
            </button>
            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={formatSourceEditors} disabled={!loadedTemplate}>
              Format source
            </button>
          </div>
        </div>
        <div class="row g-3">
          <div class="col-12 col-xl-7">
            <SourceEditor
              label="HTML"
              language="html"
              editable={!!loadedTemplate}
              value={rawHtmlContent}
              onChange={(nextValue) => {
                rawHtmlContent = nextValue;
                handleHtmlSourceInput({ currentTarget: { value: nextValue } });
              }}
            />
          </div>
          <div class="col-12 col-xl-5">
            <SourceEditor
              label="CSS"
              language="css"
              editable={!!loadedTemplate}
              value={rawCssContent}
              onChange={(nextValue) => {
                rawCssContent = nextValue;
                handleCssSourceInput({ currentTarget: { value: nextValue } });
              }}
            />
          </div>
        </div>
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h2 class="h5 mb-1">Visual Preview Sandbox</h2>
            <p class="text-body-secondary mb-0">Drag-and-drop here to experiment. Save captures the current sandbox HTML and CSS, then writes them back into the source editors.</p>
          </div>
        </div>
        <div bind:this={editorHost} class="template-editor-host border rounded overflow-hidden"></div>
      </div>
    </div>
  </section>
</div>

<style>
  .template-builder-v2-shell {
    display: grid;
    grid-template-columns: minmax(300px, var(--sidebar-width)) 10px minmax(0, 1fr);
    align-items: start;
    gap: 1rem;
  }

  .template-builder-v2-sidebar {
    min-width: 300px;
    position: sticky;
    top: 1rem;
    max-height: calc(100vh - 2rem);
    overflow: auto;
    padding-right: 0.25rem;
  }

  .template-builder-v2-divider {
    width: 10px;
    padding: 0;
    border: 0;
    cursor: ew-resize;
    align-self: stretch;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(37, 99, 235, 0.22), rgba(15, 23, 42, 0.08));
    transition: background-color 0.15s ease;
    touch-action: none;
    user-select: none;
    pointer-events: auto;
    position: relative;
    z-index: 3;
    appearance: none;
  }

  .template-builder-v2-divider:hover {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(37, 99, 235, 0.38), rgba(15, 23, 42, 0.12));
  }

  .template-builder-v2-divider.is-dragging {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.16), rgba(37, 99, 235, 0.5), rgba(15, 23, 42, 0.16));
  }

  .template-builder-v2-main {
    min-width: 0;
  }

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

  .template-builder-v2-main :global(.source-editor-shell) {
    height: 100%;
  }

  .template-builder-v2-main :global(.source-editor-host) {
    min-height: 34rem;
  }

  @media (max-width: 1200px) {
    .template-builder-v2-shell {
      grid-template-columns: 1fr;
    }

    .template-builder-v2-sidebar {
      position: static;
      max-height: none;
      padding-right: 0;
    }

    .template-builder-v2-divider {
      display: none;
    }
  }
</style>
