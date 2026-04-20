<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import {
    getProducts,
    getProduct,
    getProductTypes,
    createProductType,
    getSeries,
    createSeries,
    updateSeries,
    getTemplates,
    createProduct,
    updateProduct,
    updateProductType,
    getRpmLines,
    createRpmLine,
    updateRpmLine,
    deleteRpmLine,
    getRpmPoints,
    createRpmPoint,
    updateRpmPoint,
    deleteRpmPoint,
    getEfficiencyPoints,
    createEfficiencyPoint,
    updateEfficiencyPoint,
    deleteEfficiencyPoint,
    refreshGraphImage,
    refreshProductPdf,
    uploadProductImages,
    reorderProductImages,
    deleteProductImage
  } from '$lib/api.js';
  import ECharts from '$lib/ECharts.svelte';
  import {
    DISCHARGE_TYPE_OPTIONS,
    GLOBAL_UNIT_OPTIONS,
    MOUNTING_STYLE_OPTIONS,
    emptyProductForm,
    getChartTheme,
    theme
  } from '$lib/config.js';
  import { buildFullChartOption, FULL_CHART_LINE_DEFINITIONS, RPM_BAND_FALLBACK_COLORS } from '$lib/fullChart.js';

  let products = [];
  let productTypes = [];
  let seriesRecords = [];
  let templateRegistry = { product_templates: [], series_templates: [] };
  let selectedProductId = null;
  let currentProduct = null;
  let rpmLines = [];
  let rpmPoints = [];
  let efficiencyPoints = [];
  let mapChartOption = {};
  let loading = false;
  let savingProductDetails = false;
  let error = '';
  let successMessages = [];
  let successToastKey = 0;
  let productImages = [];
  let pendingImageFiles = [];
  let rpmPointSort = { column: null, direction: 'asc' };
  let chartAddTarget = '';
  let newRpmLineValue = '';
  let newRpmLineBandColor = RPM_BAND_FALLBACK_COLORS[0];
  let originalRpmPointIds = [];
  let originalEfficiencyPointIds = [];
  let nextTempPointId = -1;
  let savingMapPoints = false;
  let mapPointSaveProgress = {
    completed: 0,
    total: 0,
    label: ''
  };
  let mapPointSaveCompleted = 0;
  let mapPointSaveProgressMessage = '';
  let mapPointSaveRenderChain = Promise.resolve();
  let successDismissTimeout = null;
  let refreshingTemplates = false;
  let refreshingProductPdfId = null;
  let refreshingProductGraphId = null;
  let savingProductType = false;
  let savingSeriesRecord = false;
  let managementMode = '';
  let selectedManageProductTypeId = '';
  let selectedManageSeriesId = '';
  let editExistingProductTypeKey = '';
  let editExistingSeriesId = '';

  let productTypeDraft = {
    id: null,
    key: '',
    label: '',
    supports_graph: false,
    graph_kind: '',
    supports_graph_overlays: false,
    supports_band_graph_style: false,
    graph_line_value_label: '',
    graph_line_value_unit: '',
    graph_x_axis_label: '',
    graph_x_axis_unit: '',
    graph_y_axis_label: '',
    graph_y_axis_unit: ''
  };

  let seriesDraft = {
    id: null,
    name: '',
    product_type_key: '',
    template_id: '',
    description1_html: '',
    description2_html: '',
    description3_html: '',
    comments_html: ''
  };

  let chartInstance = null;
  let draggingPoint = null;
  let dragAxisLock = null;
  
  // Mode: 'select' (initial), 'create', or 'editExisting'
  let mode = 'select';
  let editingProductId = null;
  function defaultGraphStyleForm() {
    return {
      band_graph_background_color: '#ffffff',
      band_graph_label_text_color: '#000000',
      band_graph_faded_opacity: 0.18,
      band_graph_permissible_label_color: '#000000'
    };
  }
  let graphStyleForm = defaultGraphStyleForm();
  let parameterGroups = [];

  // Form state: new/edit fan
  let productForm = emptyProductForm();

  // Map point form (single)
  let rpmPointForm = {
    rpm_line_id: '',
    airflow: '',
    pressure: ''
  };
  let efficiencyPointForm = {
    airflow: '',
    efficiency_centre: '',
    efficiency_lower_end: '',
    efficiency_higher_end: '',
    permissible_use: ''
  };
  let rpmCsv = '';
  let rpmCsvError = '';
  let efficiencyCsv = '';
  let efficiencyCsvError = '';

  function productTemplates() {
    return templateRegistry.product_templates ?? [];
  }

  function resetProductTypeDraft(productType = null) {
    productTypeDraft = {
      id: productType?.id ?? null,
      key: productType?.key ?? '',
      label: productType?.label ?? '',
      supports_graph: productType?.supports_graph ?? false,
      graph_kind: productType?.graph_kind ?? '',
      supports_graph_overlays: productType?.supports_graph_overlays ?? false,
      supports_band_graph_style: productType?.supports_band_graph_style ?? false,
      graph_line_value_label: productType?.graph_line_value_label ?? '',
      graph_line_value_unit: productType?.graph_line_value_unit ?? '',
      graph_x_axis_label: productType?.graph_x_axis_label ?? '',
      graph_x_axis_unit: productType?.graph_x_axis_unit ?? '',
      graph_y_axis_label: productType?.graph_y_axis_label ?? '',
      graph_y_axis_unit: productType?.graph_y_axis_unit ?? ''
    };
  }

  function resetSeriesDraft(series = null) {
    seriesDraft = {
      id: series?.id ?? null,
      name: series?.name ?? '',
      product_type_key: series?.product_type_key ?? '',
      template_id: series?.template_id ?? '',
      description1_html: series?.description1_html ?? '',
      description2_html: series?.description2_html ?? '',
      description3_html: series?.description3_html ?? '',
      comments_html: series?.comments_html ?? ''
    };
  }

  function seriesForType(productTypeKey) {
    return seriesRecords
      .filter((series) => series.product_type_key === productTypeKey)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  function editableProductsForType(productTypeKey) {
    return products
      .filter((product) => !productTypeKey || product.product_type_key === productTypeKey)
      .sort((a, b) => String(a.model || '').localeCompare(String(b.model || '')));
  }

  function editableProductsForSelection(productTypeKey, seriesId) {
    return products
      .filter((product) => !productTypeKey || product.product_type_key === productTypeKey)
      .filter((product) => !seriesId || Number(product.series_id) === Number(seriesId))
      .sort((a, b) => String(a.model || '').localeCompare(String(b.model || '')));
  }

  function parseOptionalNumber(value) {
    return value === '' || value == null ? null : parseFloat(value);
  }

  function createParameterDraft(parameter = {}) {
    return {
      id: parameter.id ?? null,
      _pending_delete: parameter._pending_delete ?? false,
      parameter_name: parameter.parameter_name ?? '',
      value_type:
        parameter.value_string != null && parameter.value_string !== ''
          ? 'string'
          : parameter.value_number != null
            ? 'number'
            : 'string',
      value_string: parameter.value_string ?? '',
      value_number: parameter.value_number ?? '',
      unit: parameter.unit ?? '',
      custom_unit: parameter.unit && !GLOBAL_UNIT_OPTIONS.includes(parameter.unit) ? parameter.unit : ''
    };
  }

  function createGroupDraft(group = {}) {
    return {
      id: group.id ?? null,
      _pending_delete: group._pending_delete ?? false,
      group_name: group.group_name ?? '',
      parameters: (group.parameters ?? []).map((parameter) => createParameterDraft(parameter))
    };
  }

  function clonePresetGroups(productTypeKey) {
    const productType = productTypes.find((item) => item.key === productTypeKey);
    if (!productType) return [];
    return (productType.parameter_group_presets ?? []).map((group) => ({
      id: null,
      group_name: group.group_name,
      parameters: (group.parameter_presets ?? []).map((parameter) =>
        createParameterDraft({
          parameter_name: parameter.parameter_name,
          unit: parameter.preferred_unit ?? ''
        })
      )
    }));
  }

  function resetProductEditor(productTypeKey = '') {
    productForm = {
      ...emptyProductForm(),
      product_type_key: productTypeKey,
      template_id: productTemplates()[0]?.id || '',
      series_id: null
    };
    graphStyleForm = defaultGraphStyleForm();
    parameterGroups = clonePresetGroups(productTypeKey);
  }

  function getCurrentProductType() {
    return productTypes.find((item) => item.key === productForm.product_type_key) || null;
  }

  function productSupportsGraph() {
    return getCurrentProductType()?.supports_graph ?? true;
  }

  function productSupportsGraphOverlays() {
    return getCurrentProductType()?.supports_graph_overlays ?? true;
  }

  function productSupportsBandGraphStyle() {
    return getCurrentProductType()?.supports_band_graph_style ?? true;
  }

  function productGraphKindLabel() {
    const graphKind = getCurrentProductType()?.graph_kind;
    if (graphKind === 'silencer_loss') return 'silencer pressure-loss graph';
    if (graphKind === 'fan_map') return 'fan graph';
    return 'product graph';
  }

  function getCurrentGraphConfig() {
    const productType = getCurrentProductType();
    return productType
      ? {
          graph_kind: productType.graph_kind,
          supports_graph_overlays: productType.supports_graph_overlays,
          supports_band_graph_style: productType.supports_band_graph_style,
          graph_line_value_label: productType.graph_line_value_label,
          graph_line_value_unit: productType.graph_line_value_unit,
          graph_x_axis_label: productType.graph_x_axis_label,
          graph_x_axis_unit: productType.graph_x_axis_unit,
          graph_y_axis_label: productType.graph_y_axis_label,
          graph_y_axis_unit: productType.graph_y_axis_unit
        }
      : null;
  }

  function graphLineValueLabel() {
    return getCurrentProductType()?.graph_line_value_label || 'RPM';
  }

  function graphLineValueUnit() {
    return getCurrentProductType()?.graph_line_value_unit || graphLineValueLabel();
  }

  function graphXAxisLabel() {
    return getCurrentProductType()?.graph_x_axis_label || 'Airflow';
  }

  function graphXAxisUnit() {
    return getCurrentProductType()?.graph_x_axis_unit || 'L/s';
  }

  function graphYAxisLabel() {
    return getCurrentProductType()?.graph_y_axis_label || 'Pressure';
  }

  function graphYAxisUnit() {
    return getCurrentProductType()?.graph_y_axis_unit || 'Pa';
  }

  function formatGraphLineValue(value) {
    const unit = graphLineValueUnit();
    return unit ? `${value} ${unit}` : `${value}`;
  }

  function currentOverlayLineDefinitions() {
    return productSupportsGraphOverlays() ? FULL_CHART_LINE_DEFINITIONS : [];
  }

  function usePresetGroupsForSelectedType() {
    parameterGroups = clonePresetGroups(productForm.product_type_key);
  }

  function changeProductType(nextKey) {
    productForm = { ...productForm, product_type_key: nextKey, series_id: null };
    parameterGroups = clonePresetGroups(nextKey);
  }

  function addParameterGroup() {
    parameterGroups = [...parameterGroups, createGroupDraft({ group_name: '', parameters: [] })];
  }

  function removeParameterGroup(groupIndex) {
    parameterGroups = parameterGroups.map((group, index) =>
      index === groupIndex
        ? { ...group, _pending_delete: !group._pending_delete }
        : group
    );
  }

  function moveParameterGroup(groupIndex, direction) {
    const nextIndex = groupIndex + direction;
    if (nextIndex < 0 || nextIndex >= parameterGroups.length) return;
    const reordered = [...parameterGroups];
    const [moved] = reordered.splice(groupIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    parameterGroups = reordered;
  }

  function addParameter(groupIndex) {
    parameterGroups = parameterGroups.map((group, index) =>
      index === groupIndex
        ? { ...group, parameters: [...group.parameters, createParameterDraft()] }
        : group
    );
  }

  function removeParameter(groupIndex, parameterIndex) {
    parameterGroups = parameterGroups.map((group, index) =>
      index === groupIndex
        ? {
            ...group,
            parameters: group.parameters.map((parameter, innerIndex) =>
              innerIndex === parameterIndex
                ? { ...parameter, _pending_delete: !parameter._pending_delete }
                : parameter
            )
          }
        : group
    );
  }

  function moveParameter(groupIndex, parameterIndex, direction) {
    parameterGroups = parameterGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      const nextIndex = parameterIndex + direction;
      if (nextIndex < 0 || nextIndex >= group.parameters.length) return group;
      const parameters = [...group.parameters];
      const [moved] = parameters.splice(parameterIndex, 1);
      parameters.splice(nextIndex, 0, moved);
      return { ...group, parameters };
    });
  }

  function updateParameterValueType(groupIndex, parameterIndex, valueType) {
    parameterGroups = parameterGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      const parameters = group.parameters.map((parameter, innerIndex) => {
        if (innerIndex !== parameterIndex) return parameter;
        return {
          ...parameter,
          value_type: valueType,
          value_string: valueType === 'string' ? parameter.value_string : '',
          value_number: valueType === 'number' ? parameter.value_number : '',
          unit: valueType === 'number' ? parameter.unit : '',
          custom_unit: valueType === 'number' ? parameter.custom_unit : ''
        };
      });
      return { ...group, parameters };
    });
  }

  function serializeParameterGroups() {
    return parameterGroups
      .filter((group) => !group._pending_delete)
      .map((group, groupIndex) => ({
        group_name: group.group_name.trim(),
        sort_order: groupIndex,
        parameters: group.parameters
          .filter((parameter) => !parameter._pending_delete)
          .map((parameter, parameterIndex) => {
            const unitValue =
              parameter.value_type === 'number'
                ? (parameter.unit === '__custom__' ? parameter.custom_unit : parameter.unit) || null
                : null;
            return {
              parameter_name: parameter.parameter_name.trim(),
              sort_order: parameterIndex,
              value_string:
                parameter.value_type === 'string'
                  ? parameter.value_string.trim() || null
                  : null,
              value_number:
                parameter.value_type === 'number' && parameter.value_number !== '' && parameter.value_number != null
                  ? Number(parameter.value_number)
                  : null,
              unit: unitValue && String(unitValue).trim() ? String(unitValue).trim() : null
            };
          })
      }));
  }

  function normalizeOptionalColor(value) {
    const normalized = String(value ?? '').trim();
    return normalized || '';
  }

  function clearSuccessToast() {
    successMessages = [];
    successToastKey += 1;
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
      successDismissTimeout = null;
    }
  }

  function addSuccess(message) {
    if (!message) return;
    successMessages = [...successMessages, message];
    successToastKey += 1;
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
    }
    successDismissTimeout = setTimeout(() => {
      successMessages = [];
      successDismissTimeout = null;
    }, 3000);
  }

  function createTempPointId() {
    const nextId = nextTempPointId;
    nextTempPointId -= 1;
    return nextId;
  }

  function isPersistedPointId(id) {
    return typeof id === 'number' && id > 0;
  }

  function resetMapPointSaveProgress() {
    mapPointSaveCompleted = 0;
    mapPointSaveProgressMessage = '';
    mapPointSaveRenderChain = Promise.resolve();
    mapPointSaveProgress = {
      completed: 0,
      total: 0,
      label: ''
    };
  }

  async function waitForProgressPaint() {
    await tick();
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function beginMapPointSave(total) {
    savingMapPoints = true;
    mapPointSaveCompleted = 0;
    mapPointSaveProgress = {
      completed: 0,
      total,
      label: total ? 'Preparing changes...' : 'No changes to save.'
    };
    mapPointSaveProgressMessage = total ? 'Saving map points: 0 / ' + total + ' - Preparing changes...' : '';
    await waitForProgressPaint();
  }

  async function advanceMapPointSave(label) {
    mapPointSaveCompleted = Math.min(mapPointSaveCompleted + 1, mapPointSaveProgress.total);
    const nextCompleted = mapPointSaveCompleted;
    const nextTotal = mapPointSaveProgress.total;
    const nextLabel = label;

    mapPointSaveRenderChain = mapPointSaveRenderChain.then(async () => {
      mapPointSaveProgress = {
        ...mapPointSaveProgress,
        completed: nextCompleted,
        label: nextLabel
      };
      mapPointSaveProgressMessage = `Saving map points: ${nextCompleted} / ${nextTotal}${nextLabel ? ` - ${nextLabel}` : ''}`;
      await waitForProgressPaint();
    });

    await mapPointSaveRenderChain;
  }

  async function processBatchedOperations(operations, concurrency = 12) {
    if (!operations.length) return;

    let nextIndex = 0;

    async function worker() {
      while (nextIndex < operations.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const operation = operations[currentIndex];
        await operation.run();
        await advanceMapPointSave(operation.label);
      }
    }

    const workerCount = Math.min(concurrency, operations.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  function finishMapPointSave() {
    savingMapPoints = false;
  }

  function compareMapPointValues(a, b, column, direction) {
    const aValue = parseOptionalNumber(a?.[column]);
    const bValue = parseOptionalNumber(b?.[column]);
    const aNumber = aValue ?? Number.NEGATIVE_INFINITY;
    const bNumber = bValue ?? Number.NEGATIVE_INFINITY;
    return direction === 'asc' ? aNumber - bNumber : bNumber - aNumber;
  }

  function applyRpmPointSort(points) {
    if (!rpmPointSort.column) return points;
    return [...points].sort((a, b) => compareMapPointValues(a, b, rpmPointSort.column, rpmPointSort.direction));
  }

  function toggleRpmPointSort(column) {
    if (rpmPointSort.column === column) {
      rpmPointSort = {
        column,
        direction: rpmPointSort.direction === 'asc' ? 'desc' : 'asc'
      };
    } else {
      rpmPointSort = { column, direction: 'asc' };
    }
    rpmPoints = applyRpmPointSort(rpmPoints);
  }

  function sortIndicator(column) {
    if (rpmPointSort.column !== column) return 'Sort';
    return rpmPointSort.direction === 'asc' ? 'Asc' : 'Desc';
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvRows(text) {
    return text
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split(',').map((cell) => cell.trim()));
  }

  function buildRpmPointsCsv() {
    const header = ['rpm', 'airflow', 'pressure'];
    const rows = rpmPoints.map((point) => [point.rpm ?? '', point.airflow ?? '', point.pressure ?? ''].join(','));
    return [header.join(','), ...rows].join('\n');
  }

  function buildEfficiencyPointsCsv() {
    const header = ['airflow', 'efficiency_centre', 'efficiency_lower_end', 'efficiency_higher_end', 'permissible_use'];
    const rows = efficiencyPoints.map((point) =>
      [
        point.airflow ?? '',
        point.efficiency_centre ?? '',
        point.efficiency_lower_end ?? '',
        point.efficiency_higher_end ?? '',
        point.permissible_use ?? ''
      ].join(',')
    );
    return [header.join(','), ...rows].join('\n');
  }

  onMount(() => {
    function handleBeforeUnload(event) {
      if (!savingMapPoints) return;
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  onDestroy(() => {
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
    }
  });

  beforeNavigate((navigation) => {
    if (!savingMapPoints) return;
    navigation.cancel();
    window.alert('Map points are still being saved. Please wait until the save finishes before leaving this page.');
  });

  function exportRpmPointsCsv() {
    if (!rpmPoints.length) {
      error = 'No graph points to export.';
      return;
    }
    const base = currentProduct ? `${currentProduct.model}`.replace(/\s+/g, '_') : 'product';
    downloadCsv(buildRpmPointsCsv(), `${base}-rpm-points.csv`);
  }

  function exportEfficiencyPointsCsv() {
    if (!efficiencyPoints.length) {
      error = 'No efficiency/permissible points to export.';
      return;
    }
    const base = currentProduct ? `${currentProduct.model}`.replace(/\s+/g, '_') : 'product';
    downloadCsv(buildEfficiencyPointsCsv(), `${base}-efficiency-points.csv`);
  }

  async function importRpmPointsFromCsv() {
    rpmCsvError = '';
    if (!selectedProductId) {
      rpmCsvError = 'Select a product first.';
      return;
    }
    const rows = parseCsvRows(rpmCsv);
    if (!rows.length) {
      rpmCsvError = 'Paste RPM CSV data first. Format: rpm, airflow, pressure';
      return;
    }

    try {
      const existingLines = new Map(rpmLines.map((line) => [Number(line.rpm), line]));
      for (const row of rows) {
        if (row[0]?.toLowerCase() === 'rpm') continue;
        const rpm = parseFloat(row[0]);
        const airflow = parseFloat(row[1]);
        const pressure = parseFloat(row[2]);
        if (isNaN(rpm) || isNaN(airflow) || isNaN(pressure)) continue;

        let line = existingLines.get(rpm);
        if (!line) {
          line = await createRpmLine(selectedProductId, { rpm });
          existingLines.set(rpm, line);
        }

        await createRpmPoint(selectedProductId, {
          rpm_line_id: line.id,
          airflow,
          pressure
        });
      }
      rpmCsv = '';
      await loadProductData();
      addSuccess(`${graphLineValueLabel()} CSV imported.`);
    } catch (e) {
      rpmCsvError = e.message;
    }
  }

  async function importEfficiencyPointsFromCsv() {
    efficiencyCsvError = '';
    if (!selectedProductId) {
      efficiencyCsvError = 'Select a product first.';
      return;
    }
    const rows = parseCsvRows(efficiencyCsv);
    if (!rows.length) {
      efficiencyCsvError = 'Paste efficiency CSV data first. Format: airflow, efficiency_centre, efficiency_lower_end, efficiency_higher_end, permissible_use';
      return;
    }

    try {
      for (const row of rows) {
        if (row[0]?.toLowerCase() === 'airflow') continue;
        const airflow = parseFloat(row[0]);
        if (isNaN(airflow)) continue;
        await createEfficiencyPoint(selectedProductId, {
          airflow,
          efficiency_centre: parseOptionalNumber(row[1]),
          efficiency_lower_end: parseOptionalNumber(row[2]),
          efficiency_higher_end: parseOptionalNumber(row[3]),
          permissible_use: parseOptionalNumber(row[4])
        });
      }
      efficiencyCsv = '';
      await loadProductData();
      addSuccess('Efficiency/permissible CSV imported.');
    } catch (e) {
      efficiencyCsvError = e.message;
    }
  }

  async function loadProducts() {
    try {
      products = await getProducts();
      if (products.length && !selectedProductId) selectedProductId = products[0].id;
    } catch (e) {
      error = e.message;
    }
  }

  async function loadProductTypes() {
    try {
      productTypes = await getProductTypes();
      if (!parameterGroups.length && productForm.product_type_key) {
        parameterGroups = clonePresetGroups(productForm.product_type_key);
      }
    } catch (e) {
      error = e.message;
    }
  }

  async function loadSeries() {
    try {
      seriesRecords = await getSeries();
    } catch (e) {
      error = e.message;
    }
  }

  async function loadTemplates() {
    try {
      templateRegistry = await getTemplates();
      if (!productForm.template_id) {
        productForm = {
          ...productForm,
          template_id: productTemplates()[0]?.id || 'product-default'
        };
      }
    } catch (e) {
      error = e.message;
    }
  }

  function startCreateProductType() {
    managementMode = 'create-product-type';
    selectedManageProductTypeId = '';
    resetProductTypeDraft();
  }

  function startEditProductType() {
    managementMode = 'edit-product-type';
    selectedManageProductTypeId = '';
    resetProductTypeDraft();
  }

  function startCreateSeries() {
    managementMode = 'create-series';
    selectedManageSeriesId = '';
    resetSeriesDraft();
  }

  function startEditSeries() {
    managementMode = 'edit-series';
    selectedManageSeriesId = '';
    resetSeriesDraft();
  }

  function cancelManagement() {
    managementMode = '';
    selectedManageProductTypeId = '';
    selectedManageSeriesId = '';
  }

  async function saveManagedProductType() {
    error = '';
    savingProductType = true;
    try {
      const body = {
        key: productTypeDraft.key || null,
        label: productTypeDraft.label,
        supports_graph: !!productTypeDraft.supports_graph,
        graph_kind: productTypeDraft.graph_kind || null,
        supports_graph_overlays: !!productTypeDraft.supports_graph_overlays,
        supports_band_graph_style: !!productTypeDraft.supports_band_graph_style,
        graph_line_value_label: productTypeDraft.graph_line_value_label || null,
        graph_line_value_unit: productTypeDraft.graph_line_value_unit || null,
        graph_x_axis_label: productTypeDraft.graph_x_axis_label || null,
        graph_x_axis_unit: productTypeDraft.graph_x_axis_unit || null,
        graph_y_axis_label: productTypeDraft.graph_y_axis_label || null,
        graph_y_axis_unit: productTypeDraft.graph_y_axis_unit || null
      };
      if (managementMode === 'edit-product-type' && !selectedManageProductTypeId) {
        error = 'Choose a product type first.';
        return;
      }
      if (productTypeDraft.id) {
        await updateProductType(productTypeDraft.id, body);
        addSuccess('Product type updated.');
      } else {
        await createProductType(body);
        addSuccess('Product type created.');
      }
      await loadProductTypes();
      cancelManagement();
    } catch (e) {
      error = e.message;
    } finally {
      savingProductType = false;
    }
  }

  async function saveManagedSeries() {
    error = '';
    savingSeriesRecord = true;
    try {
      const body = {
        name: seriesDraft.name,
        product_type_key: seriesDraft.product_type_key,
        template_id: seriesDraft.template_id || null,
        description1_html: seriesDraft.description1_html || null,
        description2_html: seriesDraft.description2_html || null,
        description3_html: seriesDraft.description3_html || null,
        comments_html: seriesDraft.comments_html || null
      };
      if (managementMode === 'edit-series' && !selectedManageSeriesId) {
        error = 'Choose a series first.';
        return;
      }
      if (!body.product_type_key) {
        error = 'Choose a product type for the series.';
        return;
      }
      if (seriesDraft.id) {
        await updateSeries(seriesDraft.id, body);
        addSuccess('Series updated.');
      } else {
        await createSeries(body);
        addSuccess('Series created.');
      }
      await loadSeries();
      cancelManagement();
    } catch (e) {
      error = e.message;
    } finally {
      savingSeriesRecord = false;
    }
  }

  async function loadProductData() {
    if (!selectedProductId) return;
    try {
      const [nextRpmLines, nextRpmPoints, nextEfficiencyPoints, nextProduct] = await Promise.all([
        getRpmLines(selectedProductId),
        getRpmPoints(selectedProductId),
        getEfficiencyPoints(selectedProductId),
        getProduct(selectedProductId)
      ]);
      rpmLines = nextRpmLines.map((line, index) => ({
        ...line,
        band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
      }));
      rpmPoints = applyRpmPointSort(nextRpmPoints);
      efficiencyPoints = nextEfficiencyPoints;
      originalRpmPointIds = nextRpmPoints.map((point) => point.id);
      originalEfficiencyPointIds = nextEfficiencyPoints.map((point) => point.id);
      currentProduct = nextProduct;
      const nextProductType = productTypes.find((item) => item.key === (nextProduct?.product_type_key || 'fan')) || null;
      const overlayDefinitions = nextProductType?.supports_graph_overlays === false ? [] : FULL_CHART_LINE_DEFINITIONS;
      graphStyleForm = {
        band_graph_background_color: normalizeOptionalColor(nextProduct?.band_graph_background_color) || '#ffffff',
        band_graph_label_text_color: normalizeOptionalColor(nextProduct?.band_graph_label_text_color) || '#000000',
        band_graph_faded_opacity:
          nextProduct?.band_graph_faded_opacity != null && !Number.isNaN(Number(nextProduct.band_graph_faded_opacity))
            ? Number(nextProduct.band_graph_faded_opacity)
            : 0.18,
        band_graph_permissible_label_color:
          normalizeOptionalColor(nextProduct?.band_graph_permissible_label_color) ||
          normalizeOptionalColor(nextProduct?.band_graph_label_text_color) ||
          '#000000'
      };
      productImages = currentProduct.product_images || [];
      const validTargets = new Set([
        ...nextRpmLines.map((line) => `rpm:${line.id}`),
        ...overlayDefinitions.map((definition) => `efficiency:${definition.key}`)
      ]);
      if (!chartAddTarget || !validTargets.has(chartAddTarget)) {
        chartAddTarget = 'off';
      }
      if (!rpmPointForm.rpm_line_id && nextRpmLines.length) {
        rpmPointForm = { ...rpmPointForm, rpm_line_id: String(nextRpmLines[0].id) };
      }
    } catch (e) {
      error = e.message;
    }
  }

  $: if (selectedProductId) {
    loadProductData();
  }

  onMount(async () => {
    await Promise.all([loadProducts(), loadProductTypes(), loadSeries(), loadTemplates()]);
  });

  async function saveProduct() {
    error = '';
    clearSuccessToast();
      const body = {
        model: productForm.model.trim(),
      product_type_key: productForm.product_type_key || null,
      series_id: productForm.series_id ? Number(productForm.series_id) : null,
      template_id: productForm.template_id || null,
      mounting_style: productForm.mounting_style || null,
      discharge_type: productForm.discharge_type || null,
      description1_html: productForm.description1_html.trim() || null,
      description2_html: productForm.description2_html.trim() || null,
      description3_html: productForm.description3_html.trim() || null,
      comments_html: productForm.comments_html.trim() || null,
      show_rpm_band_shading: !!productForm.show_rpm_band_shading,
      band_graph_background_color: normalizeOptionalColor(graphStyleForm.band_graph_background_color) || null,
      band_graph_label_text_color: normalizeOptionalColor(graphStyleForm.band_graph_label_text_color) || null,
      band_graph_faded_opacity:
        graphStyleForm.band_graph_faded_opacity === '' || graphStyleForm.band_graph_faded_opacity == null
          ? null
          : Number(graphStyleForm.band_graph_faded_opacity),
      band_graph_permissible_label_color:
        normalizeOptionalColor(graphStyleForm.band_graph_permissible_label_color) || null,
      parameter_groups: serializeParameterGroups()
    };
    if (!body.model) {
      error = 'Model is required.';
      return;
    }
    if (!body.product_type_key) {
      error = 'Choose a product type.';
      return;
    }
    loading = true;
    savingProductDetails = true;
    try {
      if (editingProductId) {
        currentProduct = await updateProduct(editingProductId, body);
        addSuccess('Product updated.');
      } else {
        const created = await createProduct(body);
        currentProduct = created;
        addSuccess('Product created. You can now upload product images and add graph data.');
        selectedProductId = created.id;
        editingProductId = created.id;
        mode = 'editExisting';
      }
      products = await getProducts();
      await loadProductData();
      if (currentProduct) editProduct(currentProduct);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      savingProductDetails = false;
    }
  }

  function editProduct(product) {
    editingProductId = product.id;
    productForm = {
      model: product.model,
      product_type_key: product.product_type_key || 'fan',
      series_id: product.series_id ?? null,
      template_id: product.template_id || productTemplates()[0]?.id || 'product-default',
      mounting_style: product.mounting_style || '',
      discharge_type: product.discharge_type || '',
      description1_html: product.description1_html || '',
      description2_html: product.description2_html || '',
      description3_html: product.description3_html || '',
      comments_html: product.comments_html || '',
      show_rpm_band_shading: product.show_rpm_band_shading ?? true
    };
    graphStyleForm = {
      band_graph_background_color: normalizeOptionalColor(product.band_graph_background_color) || '#ffffff',
      band_graph_label_text_color: normalizeOptionalColor(product.band_graph_label_text_color) || '#000000',
      band_graph_faded_opacity:
        product.band_graph_faded_opacity != null && !Number.isNaN(Number(product.band_graph_faded_opacity))
          ? Number(product.band_graph_faded_opacity)
          : 0.18,
      band_graph_permissible_label_color:
        normalizeOptionalColor(product.band_graph_permissible_label_color) ||
        normalizeOptionalColor(product.band_graph_label_text_color) ||
        '#000000'
    };
    parameterGroups = (product.parameter_groups ?? []).map((group) => createGroupDraft(group));
  }

  async function addRpmLine() {
    const rpm = parseFloat(newRpmLineValue);
    if (isNaN(rpm) || !selectedProductId) {
      error = `Enter a numeric ${graphLineValueLabel()} value and select a graph-capable product first.`;
      return;
    }
    try {
      const created = await createRpmLine(selectedProductId, {
        rpm,
        band_color: normalizeOptionalColor(newRpmLineBandColor) || null
      });
      newRpmLineValue = '';
      newRpmLineBandColor = '';
      await loadProductData();
      chartAddTarget = `rpm:${created.id}`;
      addSuccess(`${graphLineValueLabel()} line added.`);
    } catch (e) {
      error = e.message;
    }
  }

  async function removeRpmLine(line) {
    const confirmed = window.confirm(`Delete the ${formatGraphLineValue(line.rpm)} line? This will also remove its graph points.`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteRpmLine(selectedProductId, line.id);
      await loadProductData();
      addSuccess(`${graphLineValueLabel()} line deleted.`);
    } catch (e) {
      error = e.message;
    }
  }

  async function saveRpmLineStyle(line) {
    try {
      await updateRpmLine(selectedProductId, line.id, {
        rpm: Number(line.rpm),
        band_color: normalizeOptionalColor(line.band_color) || null
      });
      await loadProductData();
      addSuccess(`${formatGraphLineValue(line.rpm)} styling updated.`);
    } catch (e) {
      error = e.message;
    }
  }

  async function saveBandGraphStyle() {
    if (!selectedProductId) {
      error = 'Select a product first.';
      return;
    }

    try {
      const saved = await updateProduct(selectedProductId, {
        band_graph_background_color: normalizeOptionalColor(graphStyleForm.band_graph_background_color) || null,
        band_graph_label_text_color: normalizeOptionalColor(graphStyleForm.band_graph_label_text_color) || null,
        band_graph_faded_opacity:
          graphStyleForm.band_graph_faded_opacity === '' || graphStyleForm.band_graph_faded_opacity == null
            ? null
            : Number(graphStyleForm.band_graph_faded_opacity),
        band_graph_permissible_label_color:
          normalizeOptionalColor(graphStyleForm.band_graph_permissible_label_color) || null
      });
      graphStyleForm = {
        band_graph_background_color: normalizeOptionalColor(saved?.band_graph_background_color),
        band_graph_label_text_color: normalizeOptionalColor(saved?.band_graph_label_text_color),
        band_graph_faded_opacity:
          saved?.band_graph_faded_opacity != null && !Number.isNaN(Number(saved.band_graph_faded_opacity))
            ? Number(saved.band_graph_faded_opacity)
            : 0.18,
        band_graph_permissible_label_color:
          normalizeOptionalColor(saved?.band_graph_permissible_label_color) ||
          normalizeOptionalColor(saved?.band_graph_label_text_color) ||
          '#000000'
      };
      currentProduct = saved;
      products = await getProducts();
      addSuccess('Band graph style updated for this product.');
    } catch (e) {
      error = e.message;
    }
  }

  async function addRpmPointFromForm() {
    const rpm_line_id = Number(rpmPointForm.rpm_line_id);
    const airflow = parseFloat(rpmPointForm.airflow);
    const pressure = parseFloat(rpmPointForm.pressure);
    if (!selectedProductId || !rpm_line_id || isNaN(airflow) || isNaN(pressure)) {
      error = `Select a ${graphLineValueLabel()} line and enter numeric ${graphXAxisLabel().toLowerCase()} and ${graphYAxisLabel().toLowerCase()} values.`;
      return;
    }
    rpmPoints = applyRpmPointSort([
      ...rpmPoints,
      {
        id: createTempPointId(),
        product_id: selectedProductId,
        rpm_line_id,
        rpm: rpmLines.find((line) => line.id === rpm_line_id)?.rpm ?? null,
        airflow,
        pressure
      }
    ]);
    rpmPointForm = { rpm_line_id: rpmPointForm.rpm_line_id, airflow: '', pressure: '' };
    addSuccess('Graph point added locally. Save map points to persist it.');
  }

  async function addEfficiencyPointFromForm() {
    const airflow = parseFloat(efficiencyPointForm.airflow);
    if (!selectedProductId || isNaN(airflow)) {
      error = 'Enter a numeric airflow value for the efficiency point.';
      return;
    }
    efficiencyPoints = [
      ...efficiencyPoints,
      {
        id: createTempPointId(),
        product_id: selectedProductId,
        airflow,
        efficiency_centre: parseOptionalNumber(efficiencyPointForm.efficiency_centre),
        efficiency_lower_end: parseOptionalNumber(efficiencyPointForm.efficiency_lower_end),
        efficiency_higher_end: parseOptionalNumber(efficiencyPointForm.efficiency_higher_end),
        permissible_use: parseOptionalNumber(efficiencyPointForm.permissible_use)
      }
    ];
    efficiencyPointForm = {
      airflow: '',
      efficiency_centre: '',
      efficiency_lower_end: '',
      efficiency_higher_end: '',
      permissible_use: ''
    };
    addSuccess('Efficiency/permissible point added locally. Save map points to persist it.');
  }

  async function uploadImages() {
    if (!selectedProductId) {
      error = 'Save the product before uploading product images.';
      return;
    }
    if (!pendingImageFiles.length) {
      error = 'Choose one or more image files first.';
      return;
    }
    try {
      productImages = await uploadProductImages(selectedProductId, pendingImageFiles);
      pendingImageFiles = [];
      await loadProductData();
      products = await getProducts();
      addSuccess('Product images uploaded.');
    } catch (e) {
      error = e.message;
    }
  }

  async function refreshTemplateLibrary() {
    refreshingTemplates = true;
    error = '';
    try {
      await loadTemplates();
      addSuccess('Template library refreshed.');
    } catch (e) {
      error = e.message;
    } finally {
      refreshingTemplates = false;
    }
  }

  async function generateProductPdf() {
    if (!selectedProductId) {
      error = 'Select a product first.';
      return;
    }
    refreshingProductPdfId = selectedProductId;
    try {
      await refreshProductPdf(selectedProductId);
      await loadProductData();
      products = await getProducts();
      addSuccess('Product PDF generated.');
    } catch (e) {
      error = e.message;
    } finally {
      refreshingProductPdfId = null;
    }
  }

  async function generateProductGraph() {
    if (!selectedProductId) {
      error = 'Select a product first.';
      return;
    }
    refreshingProductGraphId = selectedProductId;
    try {
      await refreshGraphImage(selectedProductId);
      await loadProductData();
      products = await getProducts();
      addSuccess('Product graph generated.');
    } catch (e) {
      error = e.message;
    } finally {
      refreshingProductGraphId = null;
    }
  }

  async function moveProductImage(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= productImages.length) return;
    const reordered = [...productImages];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      productImages = await reorderProductImages(selectedProductId, reordered.map((image) => image.id));
      await loadProductData();
      products = await getProducts();
      addSuccess('Product image order updated.');
    } catch (e) {
      error = e.message;
    }
  }

  async function removeProductImage(image) {
    try {
      await deleteProductImage(selectedProductId, image.id);
      await loadProductData();
      products = await getProducts();
      addSuccess('Product image deleted.');
    } catch (e) {
      error = e.message;
    }
  }

  function buildMapChartOption() {
    const chartTheme = getChartTheme($theme);
    const overlayDefinitions = currentOverlayLineDefinitions();
    mapChartOption = buildFullChartOption({
      rpmLines,
      rpmPoints,
      efficiencyPoints,
      chartTheme,
      title: `${graphXAxisLabel()} vs ${graphYAxisLabel()} (drag points to edit)`,
      graphConfig: getCurrentGraphConfig(),
      includeDragHandles: true,
      showRpmBandShading: productSupportsBandGraphStyle() ? (productForm.show_rpm_band_shading ?? true) : false,
      showSecondaryAxis: productSupportsGraphOverlays(),
      flowAxisMaxOverride: dragAxisLock?.flowMax ?? null,
      pressureAxisMaxOverride: dragAxisLock?.pressureMax ?? null,
      adaptGraphBackgroundToTheme: true,
      graphStyle: graphStyleForm,
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const rawValue = Array.isArray(params.value) ? params.value : params.value?.value;
          const [airflow, second] = rawValue || [];
          const matchingDefinition = overlayDefinitions.find((definition) => definition.label === params.seriesName);

          if (matchingDefinition) {
            return `${matchingDefinition.tooltipLabel}: ${second}<br/>${graphXAxisLabel().toLowerCase()}: ${airflow}`;
          }

          return `${params.seriesName}<br/>${graphXAxisLabel().toLowerCase()}: ${airflow}<br/>${graphYAxisLabel().toLowerCase()}: ${second}`;
        }
      }
    });
  }

  function handleMapChartDragEnd(params) {
    const data = params.data;
    const value = params.value || (data && data.value);
    const id = data?.id;
    if (!id || !value || !Array.isArray(value)) return;

    const [x, y] = value;
    const airflow = Math.round(x);
    const target = data?.pointType === 'efficiency'
      ? efficiencyPoints.find((p) => p.id === id)
      : rpmPoints.find((p) => p.id === id);
    if (!target) return;

    if (data?.pointType === 'efficiency') {
      const overlayDefinition = currentOverlayLineDefinitions().find((definition) => definition.label === params.seriesName);
      const lineKey = overlayDefinition?.key ?? null;
      const updated = {
        ...target,
        airflow,
        ...(lineKey ? { [lineKey]: Math.round(y) } : {})
      };
      efficiencyPoints = efficiencyPoints.map((p) => (p.id === id ? updated : p));
      return;
    }

    const updated = { ...target, airflow, pressure: Math.round(y) };
    rpmPoints = rpmPoints.map((p) => (p.id === id ? updated : p));
  }

  let chartDragAttached = false;

  function setupChartDrag() {
    if (chartDragAttached || !chartInstance) return;
    chartDragAttached = true;

    const zr = chartInstance.getZr();
    if (!zr) return;
    let dragMoved = false;
    let suppressNextClick = false;

    function getEventXY(evt) {
      const dom = evt.event || evt;
      return { x: dom.offsetX ?? dom.clientX, y: dom.offsetY ?? dom.clientY };
    }

    function lockCurrentAxisExtents() {
      const currentOption = chartInstance?.getOption?.();
      const xAxis = Array.isArray(currentOption?.xAxis) ? currentOption.xAxis[0] : currentOption?.xAxis;
      const yAxis = Array.isArray(currentOption?.yAxis) ? currentOption.yAxis[0] : currentOption?.yAxis;
      dragAxisLock = {
        flowMax: Array.isArray(xAxis?.max) ? xAxis.max[0] : xAxis?.max ?? null,
        pressureMax: Array.isArray(yAxis?.max) ? yAxis.max[0] : yAxis?.max ?? null
      };
    }

    function pickClosestPoint({ x, y }) {
      const threshold = 14;
      let best = null;
      let bestDist = Infinity;

      for (const p of rpmPoints) {
        if (p.airflow == null || p.pressure == null) continue;
        const pressurePixel = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [p.airflow, p.pressure]);
        const dx = pressurePixel[0] - x;
        const dy = pressurePixel[1] - y;
        const d = Math.hypot(dx, dy);
        if (d < bestDist && d <= threshold) {
          bestDist = d;
          best = { id: p.id, pointType: 'rpm' };
        }
      }

      for (const p of efficiencyPoints) {
        for (const definition of currentOverlayLineDefinitions()) {
          if (p[definition.key] == null) continue;
          const overlayPixel = chartInstance.convertToPixel(
            { xAxisIndex: 0, yAxisIndex: 1 },
            [p.airflow, p[definition.key]]
          );
          const dx2 = overlayPixel[0] - x;
          const dy2 = overlayPixel[1] - y;
          const d2 = Math.hypot(dx2, dy2);
          if (d2 < bestDist && d2 <= threshold) {
            bestDist = d2;
            best = { id: p.id, pointType: 'efficiency', lineKey: definition.key };
          }
        }
      }

      return best;
    }

    function updateDraggedPoint(point, pixel) {
      if (!point) return;
      const axisIndex = point.pointType === 'efficiency' ? 1 : 0;
      const [airflow, value] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: axisIndex }, [pixel.x, pixel.y]);
      if (point.pointType === 'efficiency') {
        const updated = {
          ...efficiencyPoints.find((p) => p.id === point.id),
          airflow: Math.round(airflow),
          ...(point.lineKey ? { [point.lineKey]: Math.round(value) } : {})
        };
        efficiencyPoints = efficiencyPoints.map((p) => (p.id === point.id ? updated : p));
        return;
      }
      const updated = {
        ...rpmPoints.find((p) => p.id === point.id),
        airflow: Math.round(airflow),
        pressure: Math.round(value)
      };
      rpmPoints = rpmPoints.map((p) => (p.id === point.id ? updated : p));
    }

    async function handleChartClick(evt) {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (dragMoved) {
        dragMoved = false;
        return;
      }
      const dom = evt.event || evt;
      if (!selectedProductId) return;
      const { x, y } = getEventXY(evt);

      if (!chartAddTarget || chartAddTarget === 'off') return;

      if (chartAddTarget.startsWith('rpm:')) {
        const rpm_line_id = Number(chartAddTarget.split(':')[1]);
        const [airflow, pressure] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [x, y]);
        rpmPoints = applyRpmPointSort([
          ...rpmPoints,
          {
            id: createTempPointId(),
            product_id: selectedProductId,
            rpm_line_id,
            rpm: rpmLines.find((line) => line.id === rpm_line_id)?.rpm ?? null,
            airflow: Math.round(airflow),
            pressure: Math.round(pressure)
          }
        ]);
        addSuccess('Point added locally from chart. Save map points to persist it.');
        return;
      }

      if (chartAddTarget.startsWith('efficiency:')) {
        const lineKey = chartAddTarget.split(':')[1];
        const [airflow, value] = chartInstance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 1 }, [x, y]);
        efficiencyPoints = [
          ...efficiencyPoints,
          {
            id: createTempPointId(),
            product_id: selectedProductId,
            airflow: Math.round(airflow),
            efficiency_centre: lineKey === 'efficiency_centre' ? Math.round(value) : null,
            efficiency_lower_end: lineKey === 'efficiency_lower_end' ? Math.round(value) : null,
            efficiency_higher_end: lineKey === 'efficiency_higher_end' ? Math.round(value) : null,
            permissible_use: lineKey === 'permissible_use' ? Math.round(value) : null
          }
        ];
        addSuccess('Point added locally from chart. Save map points to persist it.');
      }
    }

    zr.on('mousedown', (evt) => {
      const dom = evt.event || evt;
      const mouse = getEventXY(evt);
      const found = pickClosestPoint(mouse);

      if (dom.shiftKey && (dom.button ?? 0) === 0) {
        if (!chartAddTarget || chartAddTarget === 'off') return;
        if (!found) return;

        if (found.pointType === 'efficiency') {
          efficiencyPoints = efficiencyPoints.filter((point) => point.id !== found.id);
        } else {
          rpmPoints = rpmPoints.filter((point) => point.id !== found.id);
        }

        suppressNextClick = true;
        dragMoved = false;
        draggingPoint = null;
        addSuccess('Point deleted locally from chart. Save map points to persist it.');
        return;
      }

      if (dom.shiftKey) return;
      if (found) {
        lockCurrentAxisExtents();
        draggingPoint = found;
        dragMoved = false;
      }
    });

    zr.on('mousemove', (evt) => {
      if (!draggingPoint) return;
      dragMoved = true;
      const mouse = getEventXY(evt);
      updateDraggedPoint(draggingPoint, mouse);
    });

    zr.on('mouseup', () => {
      if (draggingPoint) {
        draggingPoint = null;
        dragAxisLock = null;
      }
    });
    zr.on('click', handleChartClick);
  }

  $: {
    rpmLines;
    rpmPoints;
    efficiencyPoints;
    productForm;
    graphStyleForm;
    $theme;
    dragAxisLock;
    buildMapChartOption();
  }

  async function updateRpmPointLocal(point) {
    try {
      await updateRpmPoint(selectedProductId, point.id, {
        rpm_line_id: Number(point.rpm_line_id),
        airflow: parseFloat(point.airflow),
        pressure: parseFloat(point.pressure)
      });
      await loadProductData();
      addSuccess('Graph point updated.');
    } catch (e) {
      error = e.message;
    }
  }

  async function updateEfficiencyPointLocal(point) {
    try {
      await updateEfficiencyPoint(selectedProductId, point.id, {
        airflow: parseFloat(point.airflow),
        efficiency_centre: parseOptionalNumber(point.efficiency_centre),
        efficiency_lower_end: parseOptionalNumber(point.efficiency_lower_end),
        efficiency_higher_end: parseOptionalNumber(point.efficiency_higher_end),
        permissible_use: parseOptionalNumber(point.permissible_use)
      });
      await loadProductData();
      addSuccess('Efficiency/permissible point updated.');
    } catch (e) {
      error = e.message;
    }
  }

  async function saveMapPoints() {
    error = '';
    clearSuccessToast();
    if (savingMapPoints) return;
    try {
      const currentRpmIds = new Set(rpmPoints.filter((point) => isPersistedPointId(point.id)).map((point) => point.id));
      const currentEfficiencyIds = new Set(
        efficiencyPoints.filter((point) => isPersistedPointId(point.id)).map((point) => point.id)
      );
      const rpmDeletes = originalRpmPointIds.filter((pointId) => !currentRpmIds.has(pointId));
      const efficiencyDeletes = originalEfficiencyPointIds.filter((pointId) => !currentEfficiencyIds.has(pointId));
      const totalOperations =
        rpmDeletes.length +
        rpmPoints.length +
        efficiencyDeletes.length +
        efficiencyPoints.length +
        1;

      const rpmDeleteOperations = rpmDeletes.map((pointId) => ({
        label: `Deleted graph point ${pointId}`,
        run: () => deleteRpmPoint(selectedProductId, pointId, { regenerateGraph: false })
      }));

      const rpmSaveOperations = rpmPoints.map((p) => ({
        label: isPersistedPointId(p.id) ? `Updated graph point ${p.id}` : 'Created new graph point',
        run: () =>
          isPersistedPointId(p.id)
            ? updateRpmPoint(
                selectedProductId,
                p.id,
                {
                  rpm_line_id: Number(p.rpm_line_id),
                  airflow: parseFloat(p.airflow),
                  pressure: parseFloat(p.pressure)
                },
                { regenerateGraph: false }
              )
            : createRpmPoint(
                selectedProductId,
                {
                  rpm_line_id: Number(p.rpm_line_id),
                  airflow: parseFloat(p.airflow),
                  pressure: parseFloat(p.pressure)
                },
                { regenerateGraph: false }
              )
      }));

      const efficiencyDeleteOperations = efficiencyDeletes.map((pointId) => ({
        label: `Deleted efficiency point ${pointId}`,
        run: () => deleteEfficiencyPoint(selectedProductId, pointId, { regenerateGraph: false })
      }));

      const efficiencySaveOperations = efficiencyPoints.map((p) => ({
        label: isPersistedPointId(p.id) ? `Updated efficiency point ${p.id}` : 'Created new efficiency point',
        run: () =>
          isPersistedPointId(p.id)
            ? updateEfficiencyPoint(
                selectedProductId,
                p.id,
                {
                  airflow: parseFloat(p.airflow),
                  efficiency_centre: parseOptionalNumber(p.efficiency_centre),
                  efficiency_lower_end: parseOptionalNumber(p.efficiency_lower_end),
                  efficiency_higher_end: parseOptionalNumber(p.efficiency_higher_end),
                  permissible_use: parseOptionalNumber(p.permissible_use)
                },
                { regenerateGraph: false }
              )
            : createEfficiencyPoint(
                selectedProductId,
                {
                  airflow: parseFloat(p.airflow),
                  efficiency_centre: parseOptionalNumber(p.efficiency_centre),
                  efficiency_lower_end: parseOptionalNumber(p.efficiency_lower_end),
                  efficiency_higher_end: parseOptionalNumber(p.efficiency_higher_end),
                  permissible_use: parseOptionalNumber(p.permissible_use)
                },
                { regenerateGraph: false }
              )
      }));
      const pointOperations = [
        ...rpmDeleteOperations,
        ...rpmSaveOperations,
        ...efficiencyDeleteOperations,
        ...efficiencySaveOperations
      ];

      await beginMapPointSave(totalOperations);

      await processBatchedOperations(pointOperations);

      await refreshGraphImage(selectedProductId);
      await advanceMapPointSave('Regenerated graph image');
      await loadProductData();
      addSuccess('All map points saved.');
    } catch (e) {
      error = e.message;
    } finally {
      finishMapPointSave();
    }
  }

  async function deleteRpmPointLocal(point) {
    rpmPoints = rpmPoints.filter((item) => item.id !== point.id);
    addSuccess('Graph point deleted locally. Save map points to persist it.');
  }

  async function deleteEfficiencyPointLocal(point) {
    efficiencyPoints = efficiencyPoints.filter((item) => item.id !== point.id);
    addSuccess('Efficiency/permissible point deleted locally. Save map points to persist it.');
  }
</script>

<svelte:head>
  <title>Editor — Internal Facing</title>
</svelte:head>

{#if successMessages.length}
  <div class="success-toast shadow-lg" role="status" aria-live="polite" aria-atomic="true">
    <div class="alert alert-success mb-0 success-toast-alert">
      {#each successMessages as message}
        <div>{message}</div>
      {/each}
      {#key successToastKey}
        <div class="success-toast-progress"></div>
      {/key}
    </div>
  </div>
{/if}

<style>
  .success-toast {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    width: min(42rem, calc(100vw - 2rem));
    z-index: 1080;
    pointer-events: none;
  }

  .success-toast-alert {
    position: relative;
    overflow: hidden;
    padding-bottom: 1rem;
  }

  .success-toast-progress {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 0.25rem;
    background: rgba(25, 135, 84, 0.55);
    transform-origin: left center;
    animation: success-toast-countdown 3s linear forwards;
  }

  @keyframes success-toast-countdown {
    from {
      transform: scaleX(1);
    }

    to {
      transform: scaleX(0);
    }
  }
</style>

<div class="mb-3">
  <div class="col-12 col-xxl-8">
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Create & Maintain</p>
    <h1>Editor</h1>
    <p class="text-body-secondary">
      Manage product records, product images, graph lines, and all editable graph data from a single workspace.
    </p>
    {#if error}
      <p class="text-danger mb-2">{error}</p>
    {/if}
    <button class="btn btn-outline-secondary btn-sm" on:click={refreshTemplateLibrary} disabled={refreshingTemplates}>
      {refreshingTemplates ? 'Refreshing templates...' : 'Refresh template library'}
    </button>
  </div>
</div>

<div class="card shadow-sm col-12 col-xxl-10 mx-auto mb-3">
  <div class="card-body">
    <h2 class="h5">Library Management</h2>
    <p class="text-body-secondary mb-3">
      Use these shortcuts to manage product types and series records without leaving the editor.
    </p>
    <div class="d-flex flex-wrap gap-2">
      <button class="btn btn-outline-primary" on:click={startCreateProductType}>Create new product type</button>
      <button class="btn btn-outline-primary" on:click={startEditProductType} disabled={productTypes.length === 0}>Edit existing product type</button>
      <button class="btn btn-outline-primary" on:click={startCreateSeries}>Create new series</button>
      <button class="btn btn-outline-primary" on:click={startEditSeries} disabled={seriesRecords.length === 0}>Edit existing series</button>
    </div>

    {#if managementMode === 'create-product-type' || managementMode === 'edit-product-type'}
      <div class="border rounded p-3 mt-3 bg-body-tertiary">
        <h3 class="h6">{managementMode === 'create-product-type' ? 'Create Product Type' : 'Edit Product Type'}</h3>
        {#if managementMode === 'edit-product-type'}
          <div class="mb-3 col-md-6">
            <label class="form-label" for="manage-product-type-select">Select product type</label>
            <select
              class="form-select"
              id="manage-product-type-select"
              bind:value={selectedManageProductTypeId}
              on:change={(event) => resetProductTypeDraft(productTypes.find((item) => String(item.id) === event.currentTarget.value))}
            >
              <option value="">-- Choose option --</option>
              {#each productTypes as productType}
                <option value={productType.id}>{productType.label}</option>
              {/each}
            </select>
          </div>
        {/if}
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label" for="manage-product-type-label">Label</label>
            <input class="form-control" id="manage-product-type-label" bind:value={productTypeDraft.label} />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="manage-product-type-key">Key</label>
            <input class="form-control" id="manage-product-type-key" bind:value={productTypeDraft.key} placeholder="auto from label if blank" />
          </div>
          <div class="col-12 col-md-4">
            <div class="form-check form-switch mt-4">
              <input class="form-check-input" id="manage-product-type-supports-graph" type="checkbox" bind:checked={productTypeDraft.supports_graph} />
              <label class="form-check-label" for="manage-product-type-supports-graph">Supports graph</label>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="form-check form-switch mt-4">
              <input class="form-check-input" id="manage-product-type-overlays" type="checkbox" bind:checked={productTypeDraft.supports_graph_overlays} />
              <label class="form-check-label" for="manage-product-type-overlays">Supports overlays</label>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="form-check form-switch mt-4">
              <input class="form-check-input" id="manage-product-type-band" type="checkbox" bind:checked={productTypeDraft.supports_band_graph_style} />
              <label class="form-check-label" for="manage-product-type-band">Supports band graph style</label>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="manage-product-type-graph-kind">Graph kind</label>
            <input class="form-control" id="manage-product-type-graph-kind" bind:value={productTypeDraft.graph_kind} placeholder="e.g. fan_map" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="manage-product-type-line-label">Line value label</label>
            <input class="form-control" id="manage-product-type-line-label" bind:value={productTypeDraft.graph_line_value_label} />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label" for="manage-product-type-line-unit">Line value unit</label>
            <input class="form-control" id="manage-product-type-line-unit" bind:value={productTypeDraft.graph_line_value_unit} />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label" for="manage-product-type-x-label">X axis label</label>
            <input class="form-control" id="manage-product-type-x-label" bind:value={productTypeDraft.graph_x_axis_label} />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label" for="manage-product-type-x-unit">X axis unit</label>
            <input class="form-control" id="manage-product-type-x-unit" bind:value={productTypeDraft.graph_x_axis_unit} />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label" for="manage-product-type-y-label">Y axis label</label>
            <input class="form-control" id="manage-product-type-y-label" bind:value={productTypeDraft.graph_y_axis_label} />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label" for="manage-product-type-y-unit">Y axis unit</label>
            <input class="form-control" id="manage-product-type-y-unit" bind:value={productTypeDraft.graph_y_axis_unit} />
          </div>
        </div>
        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-primary" on:click={saveManagedProductType} disabled={savingProductType}>
            {savingProductType ? 'Saving...' : 'Save Product Type'}
          </button>
          <button class="btn btn-outline-secondary" on:click={cancelManagement}>Cancel</button>
        </div>
      </div>
    {/if}

    {#if managementMode === 'create-series' || managementMode === 'edit-series'}
      <div class="border rounded p-3 mt-3 bg-body-tertiary">
        <h3 class="h6">{managementMode === 'create-series' ? 'Create Series' : 'Edit Series'}</h3>
        {#if managementMode === 'edit-series'}
          <div class="mb-3 col-md-6">
            <label class="form-label" for="manage-series-select">Select series</label>
            <select
              class="form-select"
              id="manage-series-select"
              bind:value={selectedManageSeriesId}
              on:change={(event) => resetSeriesDraft(seriesRecords.find((item) => String(item.id) === event.currentTarget.value))}
            >
              <option value="">-- Choose option --</option>
              {#each seriesRecords as series}
                <option value={series.id}>{series.name}</option>
              {/each}
            </select>
          </div>
        {/if}
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label" for="manage-series-name">Series name</label>
            <input class="form-control" id="manage-series-name" bind:value={seriesDraft.name} />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="manage-series-type">Product type</label>
            <select class="form-select" id="manage-series-type" bind:value={seriesDraft.product_type_key}>
              <option value="">-- Choose option --</option>
              {#each productTypes as productType}
                <option value={productType.key}>{productType.label}</option>
              {/each}
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="manage-series-template">Series PDF template</label>
            <select class="form-select" id="manage-series-template" bind:value={seriesDraft.template_id}>
              <option value="">No template</option>
              {#each templateRegistry.series_templates ?? [] as template}
                <option value={template.id}>{template.label}</option>
              {/each}
            </select>
          </div>
          <div class="col-12">
            <label class="form-label" for="manage-series-description1">Description1 (HTML)</label>
            <textarea class="form-control" id="manage-series-description1" rows="3" bind:value={seriesDraft.description1_html}></textarea>
          </div>
          <div class="col-12 col-lg-6">
            <label class="form-label" for="manage-series-description2">Description2 (HTML)</label>
            <textarea class="form-control" id="manage-series-description2" rows="3" bind:value={seriesDraft.description2_html}></textarea>
          </div>
          <div class="col-12 col-lg-6">
            <label class="form-label" for="manage-series-description3">Description3 (HTML)</label>
            <textarea class="form-control" id="manage-series-description3" rows="3" bind:value={seriesDraft.description3_html}></textarea>
          </div>
          <div class="col-12">
            <label class="form-label" for="manage-series-comments">Comments (HTML)</label>
            <textarea class="form-control" id="manage-series-comments" rows="3" bind:value={seriesDraft.comments_html}></textarea>
          </div>
        </div>
        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-primary" on:click={saveManagedSeries} disabled={savingSeriesRecord}>
            {savingSeriesRecord ? 'Saving...' : 'Save Series'}
          </button>
          <button class="btn btn-outline-secondary" on:click={cancelManagement}>Cancel</button>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if mode === 'select'}
  <div class="card shadow-sm col-12 col-xl-8 mx-auto">
    <div class="card-body">
    <h2 class="h5">Editor Actions</h2>
    <p>Choose whether you want to create a new product or open an existing one for editing.</p>
    <div class="d-flex flex-wrap gap-2">
      <button class="btn btn-primary" on:click={() => { mode = 'create'; resetProductEditor(''); }}>
        Create New Product
      </button>
      <button class="btn btn-outline-secondary" on:click={() => { mode = 'editExisting'; editExistingProductTypeKey = ''; editExistingSeriesId = ''; selectedProductId = null; currentProduct = null; }}>
        Edit Existing Product
      </button>
    </div>
    </div>
  </div>
{/if}

{#if mode === 'create'}
  <div class="card shadow-sm col-12 col-xxl-10 mx-auto">
    <div class="card-body">
    <h2 class="h5">Create New Product</h2>
    <div class="row g-3">
      <div class="col-12 col-lg-6">
      <div class="card shadow-sm h-100">
        <div class="card-body">
        <h3 class="h6">Core details</h3>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-model">Model</label>
            <input class="form-control" id="create-model" type="text" bind:value={productForm.model} placeholder="e.g. AF-120" />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-product-type">Product type</label>
            <select class="form-select" id="create-product-type" bind:value={productForm.product_type_key} on:change={(event) => changeProductType(event.currentTarget.value)}>
              <option value="">-- Choose option --</option>
              {#each productTypes as productType}
                <option value={productType.key}>{productType.label}</option>
              {/each}
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-series">Series</label>
            <select class="form-select" id="create-series" bind:value={productForm.series_id} disabled={!productForm.product_type_key}>
              <option value={null}>No series</option>
              {#each seriesForType(productForm.product_type_key) as series}
                <option value={series.id}>{series.name}</option>
              {/each}
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-template">Product PDF template</label>
            <select class="form-select" id="create-template" bind:value={productForm.template_id}>
              {#each productTemplates() as template}
                <option value={template.id}>{template.label}</option>
              {/each}
            </select>
          </div>
          <div class="col-12">
            <label class="form-label" for="create-description">Description1 (HTML)</label>
            <textarea class="form-control" id="create-description" rows="4" bind:value={productForm.description1_html}></textarea>
          </div>
          <div class="col-12">
            <label class="form-label" for="create-features">Description2 (HTML)</label>
            <textarea class="form-control" id="create-features" rows="4" bind:value={productForm.description2_html}></textarea>
          </div>
        </div>
        </div>
      </div>
      </div>

      <div class="col-12 col-lg-6">
      <div class="card shadow-sm h-100">
        <div class="card-body">
        <h3 class="h6">Product attributes</h3>
        <div class="row g-3">
          {#if productForm.product_type_key === 'fan'}
            <div class="col-12 col-md-6">
              <label class="form-label" for="create-mounting-style">Mounting Style (optional)</label>
              <select class="form-select" id="create-mounting-style" bind:value={productForm.mounting_style}>
                <option value="">Any / unset</option>
                {#each MOUNTING_STYLE_OPTIONS as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="create-discharge-type">Discharge Type (optional)</label>
              <select class="form-select" id="create-discharge-type" bind:value={productForm.discharge_type}>
                <option value="">Any / unset</option>
                {#each DISCHARGE_TYPE_OPTIONS as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>
          {/if}
          {#if productSupportsBandGraphStyle()}
            <div class="col-12">
              <div class="form-check form-switch mt-2">
                <input class="form-check-input" id="create-show-rpm-band-shading" type="checkbox" bind:checked={productForm.show_rpm_band_shading} />
                <label class="form-check-label" for="create-show-rpm-band-shading">Show band shading on generated product graphs</label>
              </div>
            </div>
          {/if}
          <div class="col-12">
            <label class="form-label" for="create-specifications">Description3 (HTML)</label>
            <textarea class="form-control" id="create-specifications" rows="4" bind:value={productForm.description3_html}></textarea>
          </div>
          <div class="col-12">
            <label class="form-label" for="create-comments">Comments (HTML)</label>
            <textarea class="form-control" id="create-comments" rows="4" bind:value={productForm.comments_html}></textarea>
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>
    <div class="card shadow-sm mt-3">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h3 class="h6 mb-1">Grouped Specifications</h3>
            <p class="text-body-secondary mb-0">Organise ordered parameter groups for this product type.</p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-outline-secondary btn-sm" on:click={usePresetGroupsForSelectedType}>Load Type Presets</button>
            <button class="btn btn-outline-primary btn-sm" on:click={addParameterGroup}>Add Group</button>
          </div>
        </div>
        {#if parameterGroups.length > 0}
          <div class="vstack gap-3 mt-3">
            {#each parameterGroups as group, groupIndex}
              <div class={`border rounded p-3 ${group._pending_delete ? 'bg-danger-subtle border-danger-subtle opacity-75' : ''}`}>
                <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
                  <input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name" bind:value={group.group_name} on:input={() => (parameterGroups = [...parameterGroups])} />
                  <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameterGroup(groupIndex, -1)} disabled={groupIndex === 0}>Up</button>
                  <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameterGroup(groupIndex, 1)} disabled={groupIndex === parameterGroups.length - 1}>Down</button>
                  <button class={`btn btn-sm ${group._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} on:click={() => removeParameterGroup(groupIndex)}>
                    {group._pending_delete ? 'Undo Delete' : 'Delete Group'}
                  </button>
                  <button class="btn btn-outline-primary btn-sm" on:click={() => addParameter(groupIndex)} disabled={group._pending_delete}>Add Parameter</button>
                </div>
                {#if group._pending_delete}
                  <p class="small text-danger-emphasis mb-3">This group is marked for deletion. Save Product to apply the deletion.</p>
                {/if}
                <div class="vstack gap-3">
                  {#each group.parameters as parameter, parameterIndex}
                    <div class={`border rounded p-3 bg-body-tertiary ${parameter._pending_delete ? 'border-danger-subtle bg-danger-subtle opacity-75' : ''}`}>
                      <div class="row g-3 align-items-end">
                        <div class="col-12 col-lg-3">
                          <label class="form-label" for={`create-group-${groupIndex}-parameter-${parameterIndex}-name`}>Name</label>
                          <input class="form-control" id={`create-group-${groupIndex}-parameter-${parameterIndex}-name`} type="text" bind:value={parameter.parameter_name} on:input={() => (parameterGroups = [...parameterGroups])} />
                        </div>
                        <div class="col-12 col-lg-2">
                          <label class="form-label" for={`create-group-${groupIndex}-parameter-${parameterIndex}-value-type`}>Value type</label>
                          <select class="form-select" id={`create-group-${groupIndex}-parameter-${parameterIndex}-value-type`} bind:value={parameter.value_type} on:change={(event) => updateParameterValueType(groupIndex, parameterIndex, event.currentTarget.value)}>
                            <option value="string">Text</option>
                            <option value="number">Number</option>
                          </select>
                        </div>
                        {#if parameter.value_type === 'string'}
                          <div class="col-12 col-lg-5">
                            <label class="form-label" for={`create-group-${groupIndex}-parameter-${parameterIndex}-text`}>Text value</label>
                            <input class="form-control" id={`create-group-${groupIndex}-parameter-${parameterIndex}-text`} type="text" bind:value={parameter.value_string} on:input={() => (parameterGroups = [...parameterGroups])} />
                          </div>
                        {:else}
                          <div class="col-12 col-lg-3">
                            <label class="form-label" for={`create-group-${groupIndex}-parameter-${parameterIndex}-number`}>Numeric value</label>
                            <input class="form-control" id={`create-group-${groupIndex}-parameter-${parameterIndex}-number`} type="number" step="any" bind:value={parameter.value_number} on:input={() => (parameterGroups = [...parameterGroups])} />
                          </div>
                          <div class="col-12 col-lg-3">
                            <label class="form-label" for={`create-group-${groupIndex}-parameter-${parameterIndex}-unit`}>Unit</label>
                            <select class="form-select" id={`create-group-${groupIndex}-parameter-${parameterIndex}-unit`} bind:value={parameter.unit} on:change={() => (parameterGroups = [...parameterGroups])}>
                              <option value="">No unit</option>
                              {#each GLOBAL_UNIT_OPTIONS as unitOption}
                                <option value={unitOption}>{unitOption}</option>
                              {/each}
                              <option value="__custom__">Custom…</option>
                            </select>
                          </div>
                          {#if parameter.unit === '__custom__'}
                            <div class="col-12 col-lg-2">
                              <label class="form-label" for={`create-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`}>Custom unit</label>
                              <input class="form-control" id={`create-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`} type="text" bind:value={parameter.custom_unit} on:input={() => (parameterGroups = [...parameterGroups])} />
                            </div>
                          {/if}
                        {/if}
                        <div class="col-12 col-lg-2">
                          <div class="d-flex flex-wrap gap-2">
                            <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameter(groupIndex, parameterIndex, -1)} disabled={group._pending_delete || parameter._pending_delete || parameterIndex === 0}>Up</button>
                            <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameter(groupIndex, parameterIndex, 1)} disabled={group._pending_delete || parameter._pending_delete || parameterIndex === group.parameters.length - 1}>Down</button>
                            <button class={`btn btn-sm ${parameter._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} on:click={() => removeParameter(groupIndex, parameterIndex)} disabled={group._pending_delete}>
                              {parameter._pending_delete ? 'Undo Delete' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                      {#if parameter._pending_delete}
                        <p class="small text-danger-emphasis mt-3 mb-0">This parameter is marked for deletion. Save Product to apply the deletion.</p>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-body-secondary mt-3 mb-0">No parameter groups yet. Load type presets or add a group manually.</p>
        {/if}
      </div>
    </div>
    <p class="text-body-secondary mt-3 mb-2">Save the product first, then you can upload product images and manage the generated graph file.</p>
    <div class="d-flex flex-wrap gap-2">
      <button class="btn btn-primary" on:click={saveProduct} disabled={loading}>Save Product</button>
      <button class="btn btn-outline-secondary" on:click={() => { mode = 'select'; resetProductEditor(''); productImages = []; pendingImageFiles = []; currentProduct = null; selectedProductId = null; }}>Cancel</button>
    </div>
    </div>
  </div>
{/if}

{#if mode === 'editExisting' && editingProductId === null}
  <div class="card shadow-sm col-12 col-xl-8 mx-auto">
    <div class="card-body">
    <h2 class="h5">Choose Existing Product</h2>
    <div class="row g-3">
      <div class="col-md-6 col-lg-4">
        <label class="form-label" for="edit-existing-product-type">Product type</label>
        <select
          class="form-select"
          id="edit-existing-product-type"
          bind:value={editExistingProductTypeKey}
          on:change={() => {
            editExistingSeriesId = '';
            selectedProductId = null;
            currentProduct = null;
          }}
        >
          <option value="">— Select product type —</option>
          {#each productTypes as productType}
            <option value={productType.key}>{productType.label}</option>
          {/each}
        </select>
      </div>
      <div class="col-md-6 col-lg-4">
        <label class="form-label" for="edit-existing-series">Series (optional)</label>
        <select
          class="form-select"
          id="edit-existing-series"
          bind:value={editExistingSeriesId}
          disabled={!editExistingProductTypeKey}
          on:change={() => {
            selectedProductId = null;
            currentProduct = null;
          }}
        >
          <option value="">All series</option>
          {#each seriesForType(editExistingProductTypeKey) as series}
            <option value={series.id}>{series.name}</option>
          {/each}
        </select>
      </div>
      <div class="col-md-6 col-lg-4">
        <label class="form-label" for="edit-fan-select">Existing product</label>
        <select class="form-select" id="edit-fan-select" bind:value={selectedProductId} disabled={!editExistingProductTypeKey}>
          <option value={null}>— Select product —</option>
          {#each editableProductsForSelection(editExistingProductTypeKey, editExistingSeriesId) as product}
            <option value={product.id}>{product.model}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="d-flex flex-wrap gap-2">
      <button
        class="btn btn-primary"
        on:click={() => {
          if (currentProduct) {
            editProduct(currentProduct);
            editingProductId = currentProduct.id;
          }
        }}
        disabled={!editExistingProductTypeKey || !selectedProductId}
      >
        Edit Selected Product
      </button>
      <button class="btn btn-outline-secondary" on:click={() => { mode = 'select'; editExistingProductTypeKey = ''; editExistingSeriesId = ''; selectedProductId = null; resetProductEditor(''); productImages = []; pendingImageFiles = []; currentProduct = null; }}>Cancel</button>
    </div>
    </div>
  </div>
{/if}

{#if mode === 'editExisting' && editingProductId !== null}
  <div class="card shadow-sm">
    <div class="card-body">
    <h2 class="h5">Edit Product: {productForm.model}</h2>
    <div class="row g-3">
      <div class="col-12 col-xxl-6">
      <div class="vstack gap-3">
        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">Product details</h3>
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-model">Model</label>
              <input class="form-control" id="edit-model" type="text" bind:value={productForm.model} />
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-product-type">Product type</label>
              <select class="form-select" id="edit-product-type" bind:value={productForm.product_type_key} on:change={(event) => changeProductType(event.currentTarget.value)}>
                <option value="">-- Choose option --</option>
                {#each productTypes as productType}
                  <option value={productType.key}>{productType.label}</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-series">Series</label>
              <select class="form-select" id="edit-series" bind:value={productForm.series_id} disabled={!productForm.product_type_key}>
                <option value={null}>No series</option>
                {#each seriesForType(productForm.product_type_key) as series}
                  <option value={series.id}>{series.name}</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-template">Product PDF template</label>
              <select class="form-select" id="edit-template" bind:value={productForm.template_id}>
                {#each productTemplates() as template}
                  <option value={template.id}>{template.label}</option>
                {/each}
              </select>
            </div>
            {#if productForm.product_type_key === 'fan'}
              <div class="col-12 col-md-6">
                <label class="form-label" for="edit-mounting-style">Mounting Style (optional)</label>
                <select class="form-select" id="edit-mounting-style" bind:value={productForm.mounting_style}>
                  <option value="">Any / unset</option>
                  {#each MOUNTING_STYLE_OPTIONS as option}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label" for="edit-discharge-type">Discharge Type (optional)</label>
                <select class="form-select" id="edit-discharge-type" bind:value={productForm.discharge_type}>
                  <option value="">Any / unset</option>
                  {#each DISCHARGE_TYPE_OPTIONS as option}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              </div>
            {/if}
            <div class="col-12">
              <label class="form-label" for="edit-description">Description1 (HTML)</label>
              <textarea class="form-control" id="edit-description" rows="4" bind:value={productForm.description1_html}></textarea>
            </div>
            <div class="col-12">
              <label class="form-label" for="edit-features">Description2 (HTML)</label>
              <textarea class="form-control" id="edit-features" rows="4" bind:value={productForm.description2_html}></textarea>
            </div>
            <div class="col-12">
              <label class="form-label" for="edit-specifications">Description3 (HTML)</label>
              <textarea class="form-control" id="edit-specifications" rows="4" bind:value={productForm.description3_html}></textarea>
            </div>
            <div class="col-12">
              <label class="form-label" for="edit-comments">Comments (HTML)</label>
              <textarea class="form-control" id="edit-comments" rows="4" bind:value={productForm.comments_html}></textarea>
            </div>
            {#if productSupportsBandGraphStyle()}
              <div class="col-12">
                <div class="form-check form-switch mt-2">
                  <input class="form-check-input" id="edit-show-rpm-band-shading" type="checkbox" bind:checked={productForm.show_rpm_band_shading} />
                  <label class="form-check-label" for="edit-show-rpm-band-shading">Show band shading on product graphs and generated graph images</label>
                </div>
              </div>
            {/if}
          </div>
          </div>
        </div>

        <div class="card shadow-sm h-100">
          <div class="card-body">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h3 class="h6 mb-1">Grouped Specifications</h3>
              <p class="text-body-secondary mb-0">These are ordered exactly as they will appear elsewhere.</p>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-secondary btn-sm" on:click={usePresetGroupsForSelectedType}>Load Type Presets</button>
              <button class="btn btn-outline-primary btn-sm" on:click={addParameterGroup}>Add Group</button>
            </div>
          </div>
          {#if parameterGroups.length > 0}
            <div class="vstack gap-3 mt-3">
              {#each parameterGroups as group, groupIndex}
                <div class={`border rounded p-3 ${group._pending_delete ? 'bg-danger-subtle border-danger-subtle opacity-75' : ''}`}>
                  <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
                    <input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name" bind:value={group.group_name} on:input={() => (parameterGroups = [...parameterGroups])} />
                    <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameterGroup(groupIndex, -1)} disabled={groupIndex === 0}>Up</button>
                    <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameterGroup(groupIndex, 1)} disabled={groupIndex === parameterGroups.length - 1}>Down</button>
                    <button class={`btn btn-sm ${group._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} on:click={() => removeParameterGroup(groupIndex)}>
                      {group._pending_delete ? 'Undo Delete' : 'Delete Group'}
                    </button>
                    <button class="btn btn-outline-primary btn-sm" on:click={() => addParameter(groupIndex)} disabled={group._pending_delete}>Add Parameter</button>
                  </div>
                  {#if group._pending_delete}
                    <p class="small text-danger-emphasis mb-3">This group is marked for deletion. Save Product to apply the deletion.</p>
                  {/if}
                  <div class="vstack gap-3">
                    {#each group.parameters as parameter, parameterIndex}
                      <div class={`border rounded p-3 bg-body-tertiary ${parameter._pending_delete ? 'border-danger-subtle bg-danger-subtle opacity-75' : ''}`}>
                        <div class="row g-3 align-items-end">
                          <div class="col-12 col-lg-3">
                            <label class="form-label" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-name`}>Name</label>
                            <input class="form-control" id={`edit-group-${groupIndex}-parameter-${parameterIndex}-name`} type="text" bind:value={parameter.parameter_name} on:input={() => (parameterGroups = [...parameterGroups])} />
                          </div>
                          <div class="col-12 col-lg-2">
                            <label class="form-label" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-value-type`}>Value type</label>
                            <select class="form-select" id={`edit-group-${groupIndex}-parameter-${parameterIndex}-value-type`} bind:value={parameter.value_type} on:change={(event) => updateParameterValueType(groupIndex, parameterIndex, event.currentTarget.value)}>
                              <option value="string">Text</option>
                              <option value="number">Number</option>
                            </select>
                          </div>
                          {#if parameter.value_type === 'string'}
                            <div class="col-12 col-lg-5">
                              <label class="form-label" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-text`}>Text value</label>
                              <input class="form-control" id={`edit-group-${groupIndex}-parameter-${parameterIndex}-text`} type="text" bind:value={parameter.value_string} on:input={() => (parameterGroups = [...parameterGroups])} />
                            </div>
                          {:else}
                            <div class="col-12 col-lg-3">
                              <label class="form-label" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-number`}>Numeric value</label>
                              <input class="form-control" id={`edit-group-${groupIndex}-parameter-${parameterIndex}-number`} type="number" step="any" bind:value={parameter.value_number} on:input={() => (parameterGroups = [...parameterGroups])} />
                            </div>
                            <div class="col-12 col-lg-3">
                              <label class="form-label" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-unit`}>Unit</label>
                              <select class="form-select" id={`edit-group-${groupIndex}-parameter-${parameterIndex}-unit`} bind:value={parameter.unit} on:change={() => (parameterGroups = [...parameterGroups])}>
                                <option value="">No unit</option>
                                {#each GLOBAL_UNIT_OPTIONS as unitOption}
                                  <option value={unitOption}>{unitOption}</option>
                                {/each}
                                <option value="__custom__">Custom…</option>
                              </select>
                            </div>
                            {#if parameter.unit === '__custom__'}
                              <div class="col-12 col-lg-2">
                                <label class="form-label" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`}>Custom unit</label>
                                <input class="form-control" id={`edit-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`} type="text" bind:value={parameter.custom_unit} on:input={() => (parameterGroups = [...parameterGroups])} />
                              </div>
                            {/if}
                          {/if}
                          <div class="col-12 col-lg-2">
                            <div class="d-flex flex-wrap gap-2">
                              <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameter(groupIndex, parameterIndex, -1)} disabled={group._pending_delete || parameter._pending_delete || parameterIndex === 0}>Up</button>
                              <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameter(groupIndex, parameterIndex, 1)} disabled={group._pending_delete || parameter._pending_delete || parameterIndex === group.parameters.length - 1}>Down</button>
                              <button class={`btn btn-sm ${parameter._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} on:click={() => removeParameter(groupIndex, parameterIndex)} disabled={group._pending_delete}>
                                {parameter._pending_delete ? 'Undo Delete' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                        {#if parameter._pending_delete}
                          <p class="small text-danger-emphasis mt-3 mb-0">This parameter is marked for deletion. Save Product to apply the deletion.</p>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-body-secondary mt-3 mb-0">No parameter groups yet. Load type presets or add a group manually.</p>
          {/if}
          </div>
        </div>

      </div>
      </div>

      <div class="col-12 col-xxl-6">
      <div class="vstack gap-3">
        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">Product images</h3>
          <p class="text-body-secondary">Upload multiple images, reorder them, and the first image becomes the primary catalogue thumbnail.</p>
          <div class="mb-3">
              <label class="form-label" for="edit-product-images">Select image files</label>
              <input
                class="form-control"
                id="edit-product-images"
                type="file"
                accept="image/*"
                multiple
                on:change={(event) => { pendingImageFiles = Array.from(event.currentTarget.files || []); }}
              />
          </div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-primary" on:click={uploadImages} disabled={pendingImageFiles.length === 0}>Upload Selected Images</button>
          </div>
          {#if productImages.length > 0}
            <div class="row g-3 mt-1">
              {#each productImages as image, index}
                <div class="col-12 col-sm-6">
                <div class="card shadow-sm h-100">
                  <div class="card-body">
                  <img
                    class="img-fluid rounded border mb-2"
                    style="width: 100%; height: 150px; object-fit: cover;"
                    src={image.url}
                    alt={`${productForm.model} product image ${index + 1}`}
                  />
                  <p class="text-body-secondary">{index === 0 ? 'Primary image' : `Image ${index + 1}`}</p>
                  <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-outline-secondary btn-sm" on:click={() => moveProductImage(index, -1)} disabled={index === 0}>Move Up</button>
                    <button class="btn btn-outline-secondary btn-sm" on:click={() => moveProductImage(index, 1)} disabled={index === productImages.length - 1}>Move Down</button>
                    <button class="btn btn-danger btn-sm" on:click={() => removeProductImage(image)}>Delete</button>
                  </div>
                  </div>
                </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-body-secondary mt-3 mb-0">No product images uploaded yet.</p>
          {/if}
          </div>
        </div>

        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">Generated Assets</h3>
          <p class="text-body-secondary">Generate and download the current graph and PDF for this product.</p>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-outline-secondary" on:click={generateProductGraph} disabled={refreshingProductGraphId === selectedProductId || !selectedProductId}>
              {refreshingProductGraphId === selectedProductId ? 'Generating Graph...' : 'Generate Product Graph'}
            </button>
            {#if currentProduct?.graph_image_url}
              <a href={currentProduct.graph_image_url} download class="btn btn-outline-secondary">Download Current Graph</a>
            {/if}
            <button class="btn btn-outline-secondary" on:click={generateProductPdf} disabled={refreshingProductPdfId === selectedProductId || !selectedProductId}>
              {refreshingProductPdfId === selectedProductId ? 'Generating PDF...' : 'Generate Product PDF'}
            </button>
            {#if currentProduct?.product_pdf_url}
              <a href={currentProduct.product_pdf_url} download class="btn btn-outline-secondary">Download Current PDF</a>
            {/if}
          </div>
          </div>
        </div>

        {#if productSupportsBandGraphStyle()}
        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">Band graph style</h3>
          <p class="text-body-secondary">These colours apply to the banded graph style, including generated graph images.</p>
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label" for="band-graph-label-color">{graphLineValueLabel()} label text colour</label>
              <div class="input-group">
                <input class="form-control form-control-color" id="band-graph-label-color" type="color" bind:value={graphStyleForm.band_graph_label_text_color} on:input={() => (graphStyleForm = { ...graphStyleForm })} />
                <input class="form-control" type="text" bind:value={graphStyleForm.band_graph_label_text_color} placeholder="#000000" on:input={() => (graphStyleForm = { ...graphStyleForm })} />
              </div>
            </div>
            <div class="col-12">
              <label class="form-label" for="band-graph-background-color">Graph background colour</label>
              <div class="input-group">
                <input class="form-control form-control-color" id="band-graph-background-color" type="color" bind:value={graphStyleForm.band_graph_background_color} on:input={() => (graphStyleForm = { ...graphStyleForm })} />
                <input class="form-control" type="text" bind:value={graphStyleForm.band_graph_background_color} placeholder="#ffffff" on:input={() => (graphStyleForm = { ...graphStyleForm })} />
              </div>
            </div>
            <div class="col-12">
              <label class="form-label" for="band-graph-faded-opacity">Faded area opacity</label>
              <div class="input-group">
                <input
                  class="form-range"
                  id="band-graph-faded-opacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={graphStyleForm.band_graph_faded_opacity}
                />
                <input
                  class="form-control"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  bind:value={graphStyleForm.band_graph_faded_opacity}
                  on:input={() => (graphStyleForm = { ...graphStyleForm })}
                />
              </div>
            </div>
            <div class="col-12">
              <label class="form-label" for="band-graph-permissible-label-color">Permissible use label colour</label>
              <div class="input-group">
                <input class="form-control form-control-color" id="band-graph-permissible-label-color" type="color" bind:value={graphStyleForm.band_graph_permissible_label_color} on:input={() => (graphStyleForm = { ...graphStyleForm })} />
                <input class="form-control" type="text" bind:value={graphStyleForm.band_graph_permissible_label_color} placeholder="#000000" on:input={() => (graphStyleForm = { ...graphStyleForm })} />
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-3">
            <button class="btn btn-outline-primary" on:click={saveBandGraphStyle}>Save Band Graph Style</button>
          </div>
          </div>
        </div>

        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">{graphLineValueLabel()} line management</h3>
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-4">
              <label class="form-label" for="new-rpm-line">New {graphLineValueLabel()} line</label>
              <input class="form-control" id="new-rpm-line" type="number" step="any" bind:value={newRpmLineValue} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="new-rpm-line-band-color">Band colour</label>
              <div class="input-group">
                <input class="form-control form-control-color" id="new-rpm-line-band-color" type="color" bind:value={newRpmLineBandColor} />
                <input class="form-control" type="text" bind:value={newRpmLineBandColor} placeholder="#60a5fa" />
              </div>
            </div>
            <div class="col-12 col-md-4">
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-primary" on:click={addRpmLine}>Add {graphLineValueLabel()} Line</button>
              </div>
            </div>
          </div>
          {#if rpmLines.length > 0}
            <div class="vstack gap-2 mt-3">
              {#each rpmLines as line}
                <div class="border rounded p-2">
                  <div class="row g-2 align-items-end">
                    <div class="col-12 col-md-3">
                      <label class="form-label form-label-sm" for={`rpm-line-value-${line.id}`}>{graphLineValueLabel()}</label>
                      <input class="form-control form-control-sm" id={`rpm-line-value-${line.id}`} type="number" step="any" bind:value={line.rpm} on:input={() => (rpmLines = [...rpmLines])} />
                    </div>
                    <div class="col-12 col-md-5">
                      <label class="form-label form-label-sm" for={`rpm-line-band-color-${line.id}`}>Band colour</label>
                      <div class="input-group input-group-sm">
                        <input class="form-control form-control-color" id={`rpm-line-band-color-${line.id}`} type="color" bind:value={line.band_color} on:input={() => (rpmLines = [...rpmLines])} />
                        <input class="form-control" type="text" bind:value={line.band_color} placeholder="#60a5fa" on:input={() => (rpmLines = [...rpmLines])} />
                      </div>
                    </div>
                    <div class="col-12 col-md-4">
                      <div class="d-flex flex-wrap gap-2">
                        <button class="btn btn-outline-primary btn-sm" on:click={() => saveRpmLineStyle(line)}>Save</button>
                        <button class="btn btn-outline-secondary btn-sm" on:click={() => removeRpmLine(line)}>Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-body-secondary mt-3 mb-0">No {graphLineValueLabel().toLowerCase()} lines yet.</p>
          {/if}
          </div>
        </div>
        {/if}

        {#if productSupportsGraph()}
        <div class="card shadow-sm h-100">
          <div class="card-body">
          <h3 class="h6">Graph point input</h3>
          <p class="text-body-secondary">Use the forms below for quick manual point entry, or the CSV tools further down for bulk changes.</p>
          <div class="row g-3 align-items-end">
            <div class="col-12 col-md-4">
              <label class="form-label" for="rpm-point-line">{graphLineValueLabel()} line</label>
              <select class="form-select" id="rpm-point-line" bind:value={rpmPointForm.rpm_line_id}>
                <option value="">Select {graphLineValueLabel()} line</option>
                {#each rpmLines as line}
                  <option value={line.id}>{formatGraphLineValue(line.rpm)}</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label" for="rpm-point-airflow">{graphXAxisLabel()}</label>
              <input class="form-control" id="rpm-point-airflow" type="number" step="any" bind:value={rpmPointForm.airflow} />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label" for="rpm-point-pressure">{graphYAxisLabel()}</label>
              <input class="form-control" id="rpm-point-pressure" type="number" step="any" bind:value={rpmPointForm.pressure} />
            </div>
            <div class="col-12 col-md-2">
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-primary" on:click={addRpmPointFromForm} disabled={rpmLines.length === 0}>Add Graph Point</button>
              </div>
            </div>
          </div>

          {#if productSupportsGraphOverlays()}
          <hr class="my-4" />

          <div class="row g-3 align-items-end mt-1">
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-airflow">{graphXAxisLabel()}</label>
              <input class="form-control" id="efficiency-point-airflow" type="number" step="any" bind:value={efficiencyPointForm.airflow} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-centre">Efficiency Centre</label>
              <input class="form-control" id="efficiency-point-centre" type="number" step="any" bind:value={efficiencyPointForm.efficiency_centre} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-lower">Efficiency Lower End</label>
              <input class="form-control" id="efficiency-point-lower" type="number" step="any" bind:value={efficiencyPointForm.efficiency_lower_end} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-higher">Efficiency Higher End</label>
              <input class="form-control" id="efficiency-point-higher" type="number" step="any" bind:value={efficiencyPointForm.efficiency_higher_end} />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label" for="efficiency-point-permissible">Permissible Use</label>
              <input class="form-control" id="efficiency-point-permissible" type="number" step="any" bind:value={efficiencyPointForm.permissible_use} />
            </div>
            <div class="col-12 col-md-4">
              <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-primary" on:click={addEfficiencyPointFromForm}>Add Efficiency / Permissible Point</button>
              </div>
            </div>
          </div>
          {/if}
          </div>
        </div>
        {/if}
      </div>
      </div>
    </div>

    {#if productSupportsGraph()}
    <div class="row g-3 mt-1">
      {#if productSupportsGraphOverlays()}
      <div class="col-12 col-xl-6">
      <div class="card shadow-sm h-100">
        <div class="card-body">
        <h3 class="h6">{graphLineValueLabel()} CSV</h3>
    <p class="text-body-secondary">CSV format: {graphLineValueLabel().toLowerCase()}, airflow, pressure</p>
    <textarea class="form-control" bind:value={rpmCsv} placeholder="e.g.&#10;1000, 0.5, 120&#10;1500, 0.8, 180" rows="4" style="font-family:monospace"></textarea>
    {#if rpmCsvError}
      <p class="text-danger mb-0">{rpmCsvError}</p>
    {/if}
    <div class="d-flex flex-wrap gap-2 mt-2">
      <button class="btn btn-primary" on:click={importRpmPointsFromCsv}>Import {graphLineValueLabel()} CSV</button>
      <button class="btn btn-outline-secondary" on:click={exportRpmPointsCsv} disabled={rpmPoints.length === 0}>Export {graphLineValueLabel()} CSV</button>
    </div>
        </div>
      </div>
      </div>

      <div class="col-12 col-xl-6">
      <div class="card shadow-sm h-100">
        <div class="card-body">
        <h3 class="h6">Efficiency / permissible CSV</h3>
        <p class="text-body-secondary">CSV format: airflow, efficiency_centre, efficiency_lower_end, efficiency_higher_end, permissible_use</p>
        <textarea class="form-control" bind:value={efficiencyCsv} placeholder="e.g.&#10;0.5, 55, 48, 62, 58" rows="4" style="font-family:monospace"></textarea>
        {#if efficiencyCsvError}
          <p class="text-danger mb-0">{efficiencyCsvError}</p>
        {/if}
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button class="btn btn-primary" on:click={importEfficiencyPointsFromCsv}>Import Efficiency CSV</button>
          <button class="btn btn-outline-secondary" on:click={exportEfficiencyPointsCsv} disabled={efficiencyPoints.length === 0}>Export Efficiency CSV</button>
        </div>
      </div>
      </div>
      </div>
      {/if}
    </div>
    {/if}

    {#if productSupportsGraph()}
    <h3 class="h6 mt-3">{graphLineValueLabel()} Points</h3>
    <div class="table-responsive">
    <table class="table table-sm align-middle editable-table mb-0">
      <thead>
        <tr>
          <th>{graphLineValueLabel()}</th>
          <th>
            <button type="button" class="btn btn-outline-secondary btn-sm" on:click={() => toggleRpmPointSort('airflow')}>
              {graphXAxisLabel()} ({sortIndicator('airflow')})
            </button>
          </th>
          <th>
            <button type="button" class="btn btn-outline-secondary btn-sm" on:click={() => toggleRpmPointSort('pressure')}>
              {graphYAxisLabel()} ({sortIndicator('pressure')})
            </button>
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each rpmPoints as p}
          <tr>
            <td>{formatGraphLineValue(p.rpm)}</td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.airflow} on:input={() => (rpmPoints = [...rpmPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.pressure} on:input={() => (rpmPoints = [...rpmPoints])} /></td>
            <td><button class="btn btn-danger btn-sm" on:click={() => deleteRpmPointLocal(p)}>Delete</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
    {#if rpmPoints.length === 0}
      <p class="text-body-secondary">No graph points yet.</p>
    {/if}

    {#if productSupportsGraphOverlays()}
    <h3 class="h6 mt-3">Efficiency / Permissible Points</h3>
    <div class="table-responsive">
    <table class="table table-sm align-middle editable-table mb-0">
      <thead>
        <tr>
          <th>{graphXAxisLabel()}</th>
          <th>Efficiency Centre</th>
          <th>Efficiency Lower End</th>
          <th>Efficiency Higher End</th>
          <th>Permissible Use</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each efficiencyPoints as p}
          <tr>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.airflow} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.efficiency_centre} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.efficiency_lower_end} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.efficiency_higher_end} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><input class="form-control form-control-sm" style="min-width: 90px;" type="number" step="any" bind:value={p.permissible_use} on:input={() => (efficiencyPoints = [...efficiencyPoints])} /></td>
            <td><button class="btn btn-danger btn-sm" on:click={() => deleteEfficiencyPointLocal(p)}>Delete</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
    {#if efficiencyPoints.length === 0}
      <p class="text-body-secondary">No efficiency/permissible points yet.</p>
    {/if}
    {/if}

    {#if rpmPoints.length > 0 || efficiencyPoints.length > 0}
      <div class="card shadow-sm p-3">
        <h3 class="h6">Map points chart</h3>
        <div class="row g-3">
          <div class="col-12 col-md-6 col-lg-2">
            <label class="form-label" for="chart-add-target">Line to add points on</label>
            <select class="form-select" id="chart-add-target" bind:value={chartAddTarget}>
              <option value="off">-Off-</option>
              {#each rpmLines as line}
                <option value={`rpm:${line.id}`}>{formatGraphLineValue(line.rpm)} line</option>
              {/each}
              {#each currentOverlayLineDefinitions() as definition}
                <option value={`efficiency:${definition.key}`}>{definition.label}</option>
              {/each}
            </select>
          </div>
        </div>
        <p class="text-body-secondary">Drag existing points to edit them. Set the dropdown above to a line when you want chart clicks to add points. Set it to -Off- to disable point adding. Hold either Shift key while left clicking a point to delete it.</p>
        <ECharts
          option={mapChartOption}
          height="750px"
          on={{ dragend: handleMapChartDragEnd }}
          onChartReady={(c) => { chartInstance = c; setupChartDrag(); }}
        />
      </div>
    {/if}
    {/if}

    <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
      <button class="btn btn-primary" on:click={saveProduct} disabled={loading || savingProductDetails || savingMapPoints}>
        {savingProductDetails ? 'Saving Product Details...' : 'Save Product Details'}
      </button>
      {#if rpmPoints.length > 0 || efficiencyPoints.length > 0}
        <button class="btn btn-primary" on:click={saveMapPoints} disabled={savingMapPoints}>
          {savingMapPoints ? 'Saving Map Points...' : 'Save Map Points'}
        </button>
      {/if}
      <button
        class="btn btn-outline-secondary"
        disabled={savingMapPoints || savingProductDetails}
        on:click={() => { mode = 'select'; editingProductId = null; selectedProductId = null; resetProductEditor(''); productImages = []; pendingImageFiles = []; currentProduct = null; }}
      >
        Done
      </button>
      {#if savingMapPoints}
        <span class="text-body-secondary">{mapPointSaveProgressMessage}</span>
      {:else if savingProductDetails}
        <span class="text-body-secondary">Saving product details...</span>
      {/if}
    </div>
    </div>
  </div>
{/if}
