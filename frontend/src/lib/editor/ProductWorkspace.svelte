<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
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
    deleteProduct,
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
  import AccordionCard from '$lib/editor/AccordionCard.svelte';
  import ProductMediaPanel from '$lib/editor/ProductMediaPanel.svelte';
  import {
    GLOBAL_UNIT_OPTIONS,
    emptyProductForm,
    getChartTheme,
    theme
  } from '$lib/config.js';
  import { buildFullChartOption, FULL_CHART_LINE_DEFINITIONS, RPM_BAND_FALLBACK_COLORS } from '$lib/fullChart.js';

  export let initialMode = 'select';

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
  let nextTempRpmLineId = -1;
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
  let createTemplateSelectionSource = {
    printed: 'auto',
    online: 'auto'
  };

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
    printed_template_id: '',
    online_template_id: '',
    description1_html: '',
    description2_html: '',
    description3_html: '',
    comments_html: ''
  };

  let chartInstance = null;
  let draggingPoint = null;
  let dragAxisLock = null;
  let loadingExistingProduct = false;
  
  // Mode: 'select' (initial), 'create', or 'editExisting'
  let mode = initialMode;
  let editingProductId = null;
  function defaultGraphStyleForm() {
    return {
      band_graph_background_color: '#ffffff',
      band_graph_label_text_color: '#000000',
      band_graph_faded_opacity: 0.18,
      band_graph_permissible_label_color: '#000000'
    };
  }
  let createBandGraphStyleInitialized = false;
  let graphStyleForm = defaultGraphStyleForm();
  let parameterGroups = [];
  let createCoreDetailsOpen = true;
  let createProductAttributesOpen = true;
  let createGroupedSpecificationsOpen = true;
  let editProductDetailsOpen = true;
  let editGroupedSpecificationsOpen = true;
  let editMediaAssetsOpen = true;
  let editLineManagementOpen = true;
  let editGraphDataOpen = true;
  let allAccordionsOpen = false;
  let specificationGroupOpenState = {};
  const SPECIFICATION_GROUP_TINTS = [
    {
      background: 'rgba(237, 108, 2, 0.15)',
      border: 'rgba(237, 108, 2, 0.8)',
      parameterBackgroundLight: 'rgba(237, 108, 2, 0.08)',
      parameterBackgroundDark: 'rgba(237, 108, 2, 0.18)'
    },
    {
      background: 'rgba(2, 136, 209, 0.15)',
      border: 'rgba(2, 136, 209, 0.8)',
      parameterBackgroundLight: 'rgba(2, 136, 209, 0.08)',
      parameterBackgroundDark: 'rgba(2, 136, 209, 0.18)'
    },
    {
      background: 'rgba(46, 125, 50, 0.15)',
      border: 'rgba(46, 125, 50, 0.8)',
      parameterBackgroundLight: 'rgba(46, 125, 50, 0.08)',
      parameterBackgroundDark: 'rgba(46, 125, 50, 0.18)'
    },
    {
      background: 'rgba(123, 31, 162, 0.15)',
      border: 'rgba(123, 31, 162, 0.8)',
      parameterBackgroundLight: 'rgba(123, 31, 162, 0.08)',
      parameterBackgroundDark: 'rgba(123, 31, 162, 0.18)'
    },
    {
      background: 'rgba(93, 64, 55, 0.15)',
      border: 'rgba(93, 64, 55, 0.8)',
      parameterBackgroundLight: 'rgba(93, 64, 55, 0.08)',
      parameterBackgroundDark: 'rgba(93, 64, 55, 0.18)'
    },
    {
      background: 'rgba(198, 40, 40, 0.15)',
      border: 'rgba(198, 40, 40, 0.8)',
      parameterBackgroundLight: 'rgba(198, 40, 40, 0.08)',
      parameterBackgroundDark: 'rgba(198, 40, 40, 0.18)'
    }
  ];

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
  let graphCsvError = '';
  let graphCsvFileName = '';
  let graphCsvInput = null;

  function syncSpecificationGroupOpenState(groups, currentState) {
    const nextState = {};
    groups.forEach((_, index) => {
      nextState[index] = currentState[index] ?? true;
    });
    return nextState;
  }

  $: specificationGroupOpenState = syncSpecificationGroupOpenState(parameterGroups, specificationGroupOpenState);
  $: productTemplateOptions = templateRegistry.product_templates ?? [];
  $: if (mode === 'create' && productForm.product_type_key && productTypes.length > 0 && templateRegistry) {
    applyCreateTypePresets(productForm.product_type_key);
    applyCreateTemplateDefault(productForm.product_type_key);
  }

  function productTypePresetTemplateId(productTypeKey, variant) {
    const productType = productTypes.find((item) => item.key === productTypeKey);
    if (variant === 'printed') {
      return productType?.printed_product_template_id || productType?.product_template_id || '';
    }
    return productType?.online_product_template_id || productType?.product_template_id || '';
  }

  function productTypeBandGraphStyleDefaults(productTypeKey) {
    const productType = productTypes.find((item) => item.key === productTypeKey);
    return {
      band_graph_background_color: normalizeOptionalColor(productType?.band_graph_background_color) || '#ffffff',
      band_graph_label_text_color: normalizeOptionalColor(productType?.band_graph_label_text_color) || '#000000',
      band_graph_faded_opacity:
        productType?.band_graph_faded_opacity != null && !Number.isNaN(Number(productType.band_graph_faded_opacity))
          ? Number(productType.band_graph_faded_opacity)
          : 0.18,
      band_graph_permissible_label_color:
        normalizeOptionalColor(productType?.band_graph_permissible_label_color) || '#000000'
    };
  }

  function resolveCreateTemplateId(productTypeKey, variant) {
    const preferredTemplateId = productTypePresetTemplateId(productTypeKey, variant);
    const availableTemplateIds = new Set(productTemplateOptions.map((template) => template.id));
    if (preferredTemplateId && availableTemplateIds.has(preferredTemplateId)) {
      return preferredTemplateId;
    }
    if (availableTemplateIds.has('product-default')) {
      return 'product-default';
    }
    return preferredTemplateId || '';
  }

  function applyCreateTemplateDefault(productTypeKey) {
    productForm = {
      ...productForm,
      printed_template_id:
        createTemplateSelectionSource.printed === 'manual'
          ? productForm.printed_template_id
          : resolveCreateTemplateId(productTypeKey, 'printed'),
      online_template_id:
        createTemplateSelectionSource.online === 'manual'
          ? productForm.online_template_id
          : resolveCreateTemplateId(productTypeKey, 'online')
    };
  }

  function applyCreateBandGraphStyleDefaults(productTypeKey, markInitialized = true) {
    graphStyleForm = {
      ...graphStyleForm,
      ...productTypeBandGraphStyleDefaults(productTypeKey)
    };
    if (markInitialized) {
      createBandGraphStyleInitialized = true;
    }
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
      printed_template_id: series?.printed_template_id || series?.template_id || '',
      online_template_id: series?.online_template_id || series?.template_id || '',
      description1_html: series?.description1_html ?? '',
      description2_html: series?.description2_html ?? '',
      description3_html: series?.description3_html ?? '',
      comments_html: series?.description4_html ?? series?.comments_html ?? ''
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

  function normalizeLookupText(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function parameterValueHistory(groupName, parameterName, valueType) {
    const groupKey = normalizeLookupText(groupName);
    const parameterKey = normalizeLookupText(parameterName);
    const history = new Map();

    for (const product of products) {
      if (editingProductId && Number(product.id) === Number(editingProductId)) continue;

      for (const group of product.parameter_groups ?? []) {
        if (normalizeLookupText(group.group_name) !== groupKey) continue;

        for (const parameter of group.parameters ?? []) {
          if (normalizeLookupText(parameter.parameter_name) !== parameterKey) continue;

          if (valueType === 'string') {
            const valueString = String(parameter.value_string ?? '').trim();
            if (!valueString) continue;
            const key = valueString.toLowerCase();
            const existing = history.get(key) ?? {
              value_string: valueString,
              count: 0
            };
            existing.count += 1;
            history.set(key, existing);
            continue;
          }

          const valueNumber = parameter.value_number;
          if (valueNumber == null || Number.isNaN(Number(valueNumber))) continue;
          const unit = String(parameter.unit ?? '').trim();
          const key = `${Number(valueNumber)}|${unit.toLowerCase()}`;
          const existing = history.get(key) ?? {
            value_number: Number(valueNumber),
            unit,
            count: 0
          };
          existing.count += 1;
          history.set(key, existing);
        }
      }
    }

    const values = [...history.values()];
    if (valueType === 'string') {
      return values.sort((a, b) => b.count - a.count || a.value_string.localeCompare(b.value_string));
    }

    return values.sort((a, b) => b.count - a.count || a.value_number - b.value_number || a.unit.localeCompare(b.unit));
  }

  function applyParameterHistorySuggestion(groupIndex, parameterIndex, suggestion, valueType) {
    parameterGroups = parameterGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      const parameters = group.parameters.map((parameter, innerIndex) => {
        if (innerIndex !== parameterIndex) return parameter;
        if (valueType === 'string') {
          return {
            ...parameter,
            value_type: 'string',
            value_string: suggestion.value_string ?? '',
            value_number: '',
            unit: '',
            custom_unit: ''
          };
        }
        return {
          ...parameter,
          value_type: 'number',
          value_number: suggestion.value_number ?? '',
          value_string: '',
          unit: suggestion.unit || '',
          custom_unit: suggestion.unit && !GLOBAL_UNIT_OPTIONS.includes(suggestion.unit) ? suggestion.unit : ''
        };
      });
      return { ...group, parameters };
    });
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

  function createPresetRpmPointDraft(point = {}) {
    return {
      id: point.id ?? null,
      _pending_delete: point._pending_delete ?? false,
      airflow: point.airflow ?? '',
      pressure: point.pressure ?? ''
    };
  }

  function createPresetRpmLineDraft(line = {}) {
    return {
      id: line.id ?? null,
      _pending_delete: line._pending_delete ?? false,
      rpm: line.rpm ?? '',
      band_color: line.band_color ?? '',
      points: (line.point_presets ?? []).map((point) => createPresetRpmPointDraft(point))
    };
  }

  function createPresetEfficiencyPointDraft(point = {}) {
    return {
      id: point.id ?? null,
      _pending_delete: point._pending_delete ?? false,
      airflow: point.airflow ?? '',
      efficiency_centre: point.efficiency_centre ?? '',
      efficiency_lower_end: point.efficiency_lower_end ?? '',
      efficiency_higher_end: point.efficiency_higher_end ?? '',
      permissible_use: point.permissible_use ?? ''
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
          value_string: parameter.value_string ?? '',
          value_number: parameter.value_number ?? '',
          unit: parameter.preferred_unit ?? ''
        })
      )
    }));
  }

  function clonePresetRpmLines(productTypeKey) {
    const productType = productTypes.find((item) => item.key === productTypeKey);
    if (!productType) return [];
    return (productType.rpm_line_presets ?? []).map((line) => createPresetRpmLineDraft(line));
  }

  function clonePresetEfficiencyPoints(productTypeKey) {
    const productType = productTypes.find((item) => item.key === productTypeKey);
    if (!productType) return [];
    return (productType.efficiency_point_presets ?? []).map((point) => createPresetEfficiencyPointDraft(point));
  }

  function materializeCreateGraphPresets(productTypeKey) {
    const presetLines = clonePresetRpmLines(productTypeKey).map((line, index) => {
      const id = createTempRpmLineId();
      return {
        ...line,
        id,
        band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
      };
    });

    const presetPoints = applyRpmPointSort(
      presetLines.flatMap((line) =>
        (line.points ?? [])
          .filter((point) => !point?._pending_delete)
          .map((point) => ({
            id: createTempPointId(),
            product_id: null,
            rpm_line_id: line.id,
            rpm: parseOptionalNumber(line.rpm),
            airflow: parseOptionalNumber(point.airflow),
            pressure: parseOptionalNumber(point.pressure)
          }))
      )
    );

    const presetEfficiencyPoints = clonePresetEfficiencyPoints(productTypeKey)
      .filter((point) => !point?._pending_delete)
      .map((point) => ({
        ...point,
        id: createTempPointId(),
        product_id: null
      }));

    return {
      rpmLines: presetLines,
      rpmPoints: presetPoints,
      efficiencyPoints: presetEfficiencyPoints
    };
  }

  function applyCreateTypePresets(productTypeKey) {
    parameterGroups = clonePresetGroups(productTypeKey);
    const graphPresets = materializeCreateGraphPresets(productTypeKey);
    rpmLines = graphPresets.rpmLines;
    rpmPoints = graphPresets.rpmPoints;
    efficiencyPoints = graphPresets.efficiencyPoints;
    specificationGroupOpenState = {};
  }

  function resetProductEditor(productTypeKey = '') {
    createTemplateSelectionSource = {
      printed: 'auto',
      online: 'auto'
    };
    createBandGraphStyleInitialized = false;
    productForm = {
      ...emptyProductForm(),
      product_type_key: productTypeKey,
      printed_template_id: '',
      online_template_id: '',
      series_id: null
    };
    graphStyleForm = defaultGraphStyleForm();
    if (mode === 'create') {
      applyCreateTypePresets(productTypeKey);
      applyCreateTemplateDefault(productTypeKey);
      applyCreateBandGraphStyleDefaults(productTypeKey, productTypes.length > 0);
    } else {
      parameterGroups = clonePresetGroups(productTypeKey);
      rpmLines = [];
      rpmPoints = [];
      efficiencyPoints = [];
      specificationGroupOpenState = {};
    }
    createCoreDetailsOpen = true;
    createProductAttributesOpen = true;
    createGroupedSpecificationsOpen = true;
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
    applyCreateTypePresets(productForm.product_type_key);
  }

  function changeProductType(nextKey) {
    if (mode === 'create') {
      createTemplateSelectionSource = {
        printed: 'auto',
        online: 'auto'
      };
    }
    productForm = {
      ...productForm,
      product_type_key: nextKey,
      series_id: null,
      printed_template_id: mode === 'create' ? resolveCreateTemplateId(nextKey, 'printed') : productForm.printed_template_id,
      online_template_id: mode === 'create' ? resolveCreateTemplateId(nextKey, 'online') : productForm.online_template_id
    };
    if (mode === 'create') {
      applyCreateTypePresets(nextKey);
      applyCreateTemplateDefault(nextKey);
      applyCreateBandGraphStyleDefaults(nextKey, true);
    } else {
      parameterGroups = clonePresetGroups(nextKey);
      specificationGroupOpenState = {};
    }
  }

  function serializeCreateRpmLines() {
    return rpmLines
      .filter((line) => !line._pending_delete)
      .map((line) => ({
        rpm: parseOptionalNumber(line.rpm),
        band_color: normalizeOptionalColor(line.band_color) || null,
        points: rpmPoints
          .filter((point) => Number(point.rpm_line_id) === Number(line.id))
          .map((point) => ({
            airflow: parseOptionalNumber(point.airflow),
            pressure: parseOptionalNumber(point.pressure)
          }))
      }));
  }

  function serializeCreateEfficiencyPoints() {
    return efficiencyPoints
      .filter((point) => !point._pending_delete)
      .map((point) => ({
        airflow: parseOptionalNumber(point.airflow),
        efficiency_centre: parseOptionalNumber(point.efficiency_centre),
        efficiency_lower_end: parseOptionalNumber(point.efficiency_lower_end),
        efficiency_higher_end: parseOptionalNumber(point.efficiency_higher_end),
        permissible_use: parseOptionalNumber(point.permissible_use)
      }));
  }

  function addParameterGroup() {
    parameterGroups = [...parameterGroups, createGroupDraft({ group_name: '', parameters: [] })];
    specificationGroupOpenState = {
      ...specificationGroupOpenState,
      [parameterGroups.length]: true
    };
  }

  function toggleSpecificationGroup(groupIndex) {
    specificationGroupOpenState = {
      ...specificationGroupOpenState,
      [groupIndex]: !(specificationGroupOpenState[groupIndex] ?? true)
    };
  }

  function setAllSpecificationGroups(nextOpen) {
    specificationGroupOpenState = Object.fromEntries(
      parameterGroups.map((_, index) => [index, nextOpen])
    );
  }

  function toggleAllSpecificationGroups() {
    const allOpen =
      parameterGroups.length > 0 &&
      parameterGroups.every((_, index) => specificationGroupOpenState[index] ?? true);
    setAllSpecificationGroups(!allOpen);
  }

  function allSpecificationGroupsOpen() {
    return parameterGroups.length === 0 || parameterGroups.every((_, index) => specificationGroupOpenState[index] ?? true);
  }

  function specificationGroupBackgroundColor(groupIndex) {
    return SPECIFICATION_GROUP_TINTS[groupIndex % SPECIFICATION_GROUP_TINTS.length].background;
  }

  function specificationGroupBorderColor(groupIndex) {
    return SPECIFICATION_GROUP_TINTS[groupIndex % SPECIFICATION_GROUP_TINTS.length].border;
  }

  function specificationParameterCardStyle(groupIndex, pendingDelete = false) {
    if (pendingDelete) return '';
    const tint = SPECIFICATION_GROUP_TINTS[groupIndex % SPECIFICATION_GROUP_TINTS.length];
    const background = $theme === 'dark' ? tint.parameterBackgroundDark : tint.parameterBackgroundLight;
    return `background-color: ${background}; border-color: ${tint.border};`;
  }

  $: allAccordionsOpen =
    mode === 'create'
      ? createCoreDetailsOpen &&
        createProductAttributesOpen &&
        createGroupedSpecificationsOpen &&
        allSpecificationGroupsOpen()
      : mode === 'editExisting' && editingProductId !== null
        ? editProductDetailsOpen &&
          editGroupedSpecificationsOpen &&
          editMediaAssetsOpen &&
          editLineManagementOpen &&
          (!productSupportsGraph() || editGraphDataOpen) &&
          allSpecificationGroupsOpen()
        : false;

  function setAllAccordions(nextOpen) {
    if (mode === 'create') {
      createCoreDetailsOpen = nextOpen;
      createProductAttributesOpen = nextOpen;
      createGroupedSpecificationsOpen = nextOpen;
    }
    if (mode === 'editExisting' && editingProductId !== null) {
      editProductDetailsOpen = nextOpen;
      editGroupedSpecificationsOpen = nextOpen;
      editMediaAssetsOpen = nextOpen;
      editLineManagementOpen = nextOpen;
      editGraphDataOpen = nextOpen;
    }
    setAllSpecificationGroups(nextOpen);
  }

  function toggleAllAccordions() {
    setAllAccordions(!allAccordionsOpen);
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

  function createTempRpmLineId() {
    const nextId = nextTempRpmLineId;
    nextTempRpmLineId -= 1;
    return nextId;
  }

  function isPersistedPointId(id) {
    return typeof id === 'number' && id > 0;
  }

  function isPersistedRpmLineId(id) {
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

  function hydrateRpmPointsWithLineValues(points, lines) {
    const rpmByLineId = new Map(
      (lines ?? [])
        .map((line) => [Number(line?.id), Number(line?.rpm)])
        .filter(([, rpm]) => Number.isFinite(rpm))
    );

    return (points ?? []).map((point) => {
      const rpm = Number(point?.rpm);
      if (Number.isFinite(rpm)) {
        return point;
      }

      const lineRpm = rpmByLineId.get(Number(point?.rpm_line_id));
      return lineRpm == null ? point : { ...point, rpm: lineRpm };
    });
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

  function formatGraphCsvLineToken(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value ?? '').trim().toLowerCase();
    }
    return `${numericValue}`.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
  }

  function graphCsvPressureColumnName(value) {
    return `pressure_${formatGraphCsvLineToken(value)}rpm`;
  }

  function parseGraphCsvLineToken(header) {
    const match = String(header ?? '').trim().toLowerCase().match(/^pressure_(.+?)(?:rpm)?$/);
    if (!match) return null;
    const rpm = parseFloat(match[1]);
    return Number.isFinite(rpm) ? rpm : null;
  }

  function parseGraphCsvNumber(value, columnName) {
    if (value === '' || value == null) return null;
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Column "${columnName}" contains a non-numeric value: "${value}".`);
    }
    return parsed;
  }

  function buildGraphCsv() {
    const pressureColumns = [...new Map(
      [...rpmLines, ...rpmPoints]
        .map((item) => {
          const rpm = Number(item?.rpm);
          if (!Number.isFinite(rpm)) return null;
          return [formatGraphCsvLineToken(rpm), rpm];
        })
        .filter(Boolean)
    ).values()].sort((a, b) => a - b);

    const rowsByAirflow = new Map();

    function ensureRow(airflow) {
      if (!rowsByAirflow.has(airflow)) {
        rowsByAirflow.set(airflow, { airflow_l_s: airflow });
      }
      return rowsByAirflow.get(airflow);
    }

    for (const point of rpmPoints) {
      const airflow = Number(point?.airflow);
      const rpm = Number(point?.rpm);
      const pressure = Number(point?.pressure);
      if (!Number.isFinite(airflow) || !Number.isFinite(rpm) || !Number.isFinite(pressure)) continue;
      ensureRow(airflow)[graphCsvPressureColumnName(rpm)] = pressure;
    }

    for (const point of efficiencyPoints) {
      const airflow = Number(point?.airflow);
      if (!Number.isFinite(airflow)) continue;
      const row = ensureRow(airflow);
      row.efficiency_centre = point?.efficiency_centre ?? '';
      row.efficiency_lower_end = point?.efficiency_lower_end ?? '';
      row.efficiency_higher_end = point?.efficiency_higher_end ?? '';
      row.permissible_use = point?.permissible_use ?? '';
    }

    const header = ['airflow_l_s', ...pressureColumns.map((rpm) => graphCsvPressureColumnName(rpm))];
    if (productSupportsGraphOverlays()) {
      header.push('efficiency_centre', 'efficiency_lower_end', 'efficiency_higher_end', 'permissible_use');
    }

    const rows = [...rowsByAirflow.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => header.map((column) => row[column] ?? '').join(','));

    return [header.join(','), ...rows].join('\n');
  }

  function graphCsvPlaceholder() {
    if (productSupportsGraphOverlays()) {
      return `Example columns: airflow_l_s, pressure_650rpm, pressure_813rpm, efficiency_centre, permissible_use`;
    }
    return `Example columns: airflow_l_s, pressure_650rpm, pressure_813rpm`;
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

  function exportGraphCsv() {
    if (!rpmPoints.length && !efficiencyPoints.length) {
      error = 'No graph points to export.';
      return;
    }
    const base = currentProduct ? `${currentProduct.model}`.replace(/\s+/g, '_') : 'product';
    downloadCsv(buildGraphCsv(), `${base}-graph-data.csv`);
  }

  function buildImportedGraphState(rows) {
      const [headerRow, ...dataRows] = rows;
      const normalizedHeaders = headerRow.map((header) => String(header ?? '').trim());
      const airflowHeader = normalizedHeaders[0]?.toLowerCase();
      if (airflowHeader !== 'airflow_l_s' && airflowHeader !== 'airflow') {
        throw new Error('The first column must be "airflow_l_s".');
      }

      const pressureColumns = [];
      const overlayColumns = new Set(['efficiency_centre', 'efficiency_lower_end', 'efficiency_higher_end', 'permissible_use']);
      for (let index = 1; index < normalizedHeaders.length; index += 1) {
        const header = normalizedHeaders[index];
        const normalizedHeader = header.toLowerCase();
        if (!normalizedHeader) continue;

        if (overlayColumns.has(normalizedHeader)) {
          if (!productSupportsGraphOverlays()) {
            throw new Error(`Column "${header}" is only supported for products with graph overlay lines.`);
          }
          continue;
        }

        if (normalizedHeader.startsWith('system_')) {
          throw new Error(`Column "${header}" is not supported yet because system curve storage has not been added to this project.`);
        }

        if (normalizedHeader.startsWith('efficiency_')) {
          throw new Error(`Column "${header}" is not supported yet because efficiency data is currently stored as shared overlay lines, not per-${graphLineValueLabel().toLowerCase()} curves.`);
        }

        const rpm = parseGraphCsvLineToken(normalizedHeader);
        if (rpm == null) {
          throw new Error(`Column "${header}" is not recognised. Use "pressure_<value>rpm" columns plus the supported overlay columns.`);
        }
        pressureColumns.push({ index, header, rpm });
      }

      const existingLines = new Map(
        rpmLines
          .map((line) => {
            const rpm = Number(line?.rpm);
            if (!Number.isFinite(rpm)) return null;
            return [formatGraphCsvLineToken(rpm), line];
          })
          .filter(Boolean)
      );

      let previousAirflow = null;
      const seenAirflows = new Set();
      const nextRpmPoints = [];
      const nextEfficiencyPoints = [];
      const importedLineKeys = new Set();

      for (const [rowIndex, row] of dataRows.entries()) {
        const airflow = parseGraphCsvNumber(row[0], normalizedHeaders[0]);
        if (airflow == null) {
          throw new Error(`Row ${rowIndex + 2} is missing an airflow_l_s value.`);
        }
        if (seenAirflows.has(airflow)) {
          throw new Error(`Duplicate airflow_l_s value found: ${airflow}.`);
        }
        if (previousAirflow != null && airflow <= previousAirflow) {
          throw new Error(`airflow_l_s must increase strictly row by row. Row ${rowIndex + 2} is out of order.`);
        }

        seenAirflows.add(airflow);
        previousAirflow = airflow;

        for (const column of pressureColumns) {
          const pressure = parseGraphCsvNumber(row[column.index], column.header);
          if (pressure == null) continue;

          const lineKey = formatGraphCsvLineToken(column.rpm);
          let line = existingLines.get(lineKey);
          if (!line) {
            line = {
              id: createTempRpmLineId(),
              product_id: selectedProductId,
              rpm: column.rpm,
              band_color: RPM_BAND_FALLBACK_COLORS[existingLines.size % RPM_BAND_FALLBACK_COLORS.length]
            };
            existingLines.set(lineKey, line);
          }
          importedLineKeys.add(lineKey);

          nextRpmPoints.push({
            id: createTempPointId(),
            product_id: selectedProductId,
            rpm_line_id: line.id,
            rpm: line.rpm,
            airflow,
            pressure
          });
        }

        if (productSupportsGraphOverlays()) {
          const efficiencyPoint = {
            id: createTempPointId(),
            product_id: selectedProductId,
            airflow,
            efficiency_centre: null,
            efficiency_lower_end: null,
            efficiency_higher_end: null,
            permissible_use: null
          };

          let hasOverlayValue = false;
          for (let index = 1; index < normalizedHeaders.length; index += 1) {
            const normalizedHeader = normalizedHeaders[index]?.toLowerCase();
            if (!overlayColumns.has(normalizedHeader)) continue;
            const value = parseGraphCsvNumber(row[index], normalizedHeaders[index]);
            efficiencyPoint[normalizedHeader] = value;
            if (value != null) hasOverlayValue = true;
          }

          if (hasOverlayValue) {
            nextEfficiencyPoints.push(efficiencyPoint);
          }
        }
      }

      const nextRpmLines = rpmLines.map((line, index) => ({
        ...line,
        band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
      }));

      for (const column of pressureColumns) {
        const lineKey = formatGraphCsvLineToken(column.rpm);
        if (importedLineKeys.has(lineKey) || existingLines.has(lineKey)) {
          const line = existingLines.get(lineKey);
          if (!nextRpmLines.some((existing) => Number(existing.id) === Number(line.id))) {
            nextRpmLines.push(line);
          }
        }
      }

      return {
        rpmLines: nextRpmLines.sort((a, b) => Number(a.rpm) - Number(b.rpm)),
        rpmPoints: applyRpmPointSort(nextRpmPoints),
        efficiencyPoints: nextEfficiencyPoints
      };
  }

  async function applyImportedGraphCsvText(text, fileName = 'graph-data.csv') {
    graphCsvError = '';
    if (!selectedProductId) {
      graphCsvError = 'Select a product first.';
      return;
    }

    const rows = parseCsvRows(text);
    if (rows.length < 2) {
      graphCsvError = 'Choose a graph CSV file with a header row and at least one data row.';
      return;
    }

    try {
      const imported = buildImportedGraphState(rows);
      rpmLines = imported.rpmLines;
      rpmPoints = imported.rpmPoints;
      efficiencyPoints = imported.efficiencyPoints;
      graphCsvFileName = fileName;
      const validTargets = new Set([
        ...rpmLines.map((line) => `rpm:${line.id}`),
        ...currentOverlayLineDefinitions().map((definition) => `efficiency:${definition.key}`)
      ]);
      if (!chartAddTarget || !validTargets.has(chartAddTarget)) {
        chartAddTarget = rpmLines.length ? `rpm:${rpmLines[0].id}` : 'off';
      }
      if (rpmLines.length) {
        rpmPointForm = { ...rpmPointForm, rpm_line_id: String(rpmLines[0].id) };
      }
      addSuccess(`Loaded graph CSV from ${fileName}. Review the tables and chart, then press Save Map Points to commit it.`);
    } catch (e) {
      graphCsvError = e.message;
    }
  }

  async function handleGraphCsvFileChange(event) {
    graphCsvError = '';
    const file = event.currentTarget?.files?.[0];
    if (!file) {
      graphCsvFileName = '';
      return;
    }

    try {
      const text = await file.text();
      await applyImportedGraphCsvText(text, file.name);
    } catch (e) {
      graphCsvError = e.message || 'Unable to read the selected CSV file.';
    }
  }

  function clearGraphCsvSelection() {
    graphCsvError = '';
    graphCsvFileName = '';
    if (graphCsvInput) {
      graphCsvInput.value = '';
    }
  }

  async function loadProducts() {
    try {
      products = await getProducts();
      if (mode !== 'create' && products.length && !selectedProductId) selectedProductId = products[0].id;
    } catch (e) {
      error = e.message;
    }
  }

  async function loadProductTypes() {
    try {
      productTypes = await getProductTypes();
      if (mode === 'create' && !createBandGraphStyleInitialized && productForm.product_type_key) {
        applyCreateBandGraphStyleDefaults(productForm.product_type_key);
      }
      if (mode !== 'create' && !parameterGroups.length && productForm.product_type_key) {
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
      if (mode !== 'create') {
        const availableTemplateIds = new Set(productTemplateOptions.map((template) => template.id));
        productForm = {
          ...productForm,
          printed_template_id:
            productForm.printed_template_id && !availableTemplateIds.has(productForm.printed_template_id)
              ? ''
              : productForm.printed_template_id || resolveCreateTemplateId(productForm.product_type_key, 'printed'),
          online_template_id:
            productForm.online_template_id && !availableTemplateIds.has(productForm.online_template_id)
              ? ''
              : productForm.online_template_id || resolveCreateTemplateId(productForm.product_type_key, 'online')
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
        printed_template_id: seriesDraft.printed_template_id || null,
        online_template_id: seriesDraft.online_template_id || null,
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
      const nextProduct = await getProduct(selectedProductId);
      currentProduct = nextProduct;
      const nextProductType = productTypes.find((item) => item.key === (nextProduct?.product_type_key || 'fan')) || null;
      const overlayDefinitions = nextProductType?.supports_graph_overlays === false ? [] : FULL_CHART_LINE_DEFINITIONS;
      const [rpmLinesResult, rpmPointsResult, efficiencyPointsResult] = await Promise.allSettled([
        getRpmLines(selectedProductId),
        getRpmPoints(selectedProductId),
        getEfficiencyPoints(selectedProductId)
      ]);
      const nextRpmLines = rpmLinesResult.status === 'fulfilled' ? rpmLinesResult.value : [];
      const nextRpmPoints = rpmPointsResult.status === 'fulfilled' ? rpmPointsResult.value : [];
      const nextEfficiencyPoints = efficiencyPointsResult.status === 'fulfilled' ? efficiencyPointsResult.value : [];
      rpmLines = nextRpmLines.map((line, index) => ({
        ...line,
        band_color: normalizeOptionalColor(line.band_color) || RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
      }));
      rpmPoints = applyRpmPointSort(hydrateRpmPointsWithLineValues(nextRpmPoints, rpmLines));
      efficiencyPoints = nextEfficiencyPoints;
      originalRpmPointIds = nextRpmPoints.map((point) => point.id);
      originalEfficiencyPointIds = nextEfficiencyPoints.map((point) => point.id);
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

  async function openSelectedExistingProduct(productId = selectedProductId) {
    const nextProductId = productId == null || productId === '' ? null : Number(productId);
    if (!nextProductId) return;
    const selectedProduct = products.find((product) => Number(product.id) === nextProductId) || null;
    if (selectedProduct) {
      editProduct(selectedProduct);
    }
    selectedProductId = nextProductId;
    editingProductId = nextProductId;
    loadingExistingProduct = true;
    try {
      await loadProductData();
      if (currentProduct) {
        editProduct(currentProduct);
        editingProductId = currentProduct.id;
      } else {
        editingProductId = null;
      }
    } finally {
      loadingExistingProduct = false;
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
      printed_template_id: productForm.printed_template_id || null,
      online_template_id: productForm.online_template_id || null,
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
    if (mode === 'create') {
      body.rpm_lines = serializeCreateRpmLines();
      body.efficiency_points = serializeCreateEfficiencyPoints();
    }
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
      printed_template_id: product.printed_template_id || product.template_id || '',
      online_template_id: product.online_template_id || product.template_id || '',
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
    editProductDetailsOpen = true;
    editGroupedSpecificationsOpen = true;
    editMediaAssetsOpen = true;
    editLineManagementOpen = true;
    editGraphDataOpen = true;
    specificationGroupOpenState = {};
  }

  function returnToEditorHome() {
    goto('/editor');
  }

  async function deleteCurrentProduct() {
    if (!editingProductId) return;
    const confirmed = window.confirm(`Delete product "${productForm.model || currentProduct?.model || editingProductId}"? This cannot be undone.`);
    if (!confirmed) return;

    error = '';
    clearSuccessToast();

    try {
      await deleteProduct(editingProductId);
      await loadProducts();
      selectedProductId = null;
      editingProductId = null;
      currentProduct = null;
      productImages = [];
      pendingImageFiles = [];
      editExistingProductTypeKey = '';
      editExistingSeriesId = '';
      resetProductEditor('');
      mode = 'editExisting';
      addSuccess('Product deleted.');
    } catch (e) {
      error = e.message;
    }
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
    if (!isPersistedRpmLineId(line.id)) {
      rpmLines = rpmLines.filter((item) => item.id !== line.id);
      rpmPoints = applyRpmPointSort(rpmPoints.filter((point) => point.rpm_line_id !== line.id));
      if (chartAddTarget === `rpm:${line.id}`) {
        chartAddTarget = 'off';
      }
      addSuccess(`${graphLineValueLabel()} line removed locally. Save map points to persist the point changes.`);
      return;
    }

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
    if (!isPersistedRpmLineId(line.id)) {
      rpmLines = rpmLines.map((item) =>
        item.id === line.id
          ? {
              ...item,
              rpm: Number(line.rpm),
              band_color: normalizeOptionalColor(line.band_color) || null
            }
          : item
      );
      rpmPoints = applyRpmPointSort(
        rpmPoints.map((point) =>
          point.rpm_line_id === line.id
            ? { ...point, rpm: Number(line.rpm) }
            : point
        )
      );
      addSuccess(`${formatGraphLineValue(line.rpm)} styling updated locally. Save map points to persist new points on this line.`);
      return;
    }

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
      addSuccess('Printed and online product PDFs generated.');
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
      const tempRpmLines = rpmLines.filter((line) => !isPersistedRpmLineId(line.id));
      const lineCreationOperations = tempRpmLines.map((line) => ({
        label: `Created ${formatGraphLineValue(line.rpm)} line`,
        run: async () => {
          const created = await createRpmLine(
            selectedProductId,
            {
              rpm: Number(line.rpm),
              band_color: normalizeOptionalColor(line.band_color) || null
            }
          );

          rpmLines = rpmLines.map((item) => (item.id === line.id ? created : item));
          rpmPoints = applyRpmPointSort(
            rpmPoints.map((point) =>
              point.rpm_line_id === line.id
                ? {
                    ...point,
                    rpm_line_id: created.id,
                    rpm: created.rpm
                  }
                : point
            )
          );
        }
      }));

      const currentRpmIds = new Set(rpmPoints.filter((point) => isPersistedPointId(point.id)).map((point) => point.id));
      const currentEfficiencyIds = new Set(
        efficiencyPoints.filter((point) => isPersistedPointId(point.id)).map((point) => point.id)
      );
      const rpmDeletes = originalRpmPointIds.filter((pointId) => !currentRpmIds.has(pointId));
      const efficiencyDeletes = originalEfficiencyPointIds.filter((pointId) => !currentEfficiencyIds.has(pointId));
      const totalOperations =
        lineCreationOperations.length +
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
        ...lineCreationOperations,
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
    top: 5.75rem;
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

  .editor-action-bar {
    position: sticky;
    top: 4.75rem;
    z-index: 1030;
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, var(--bs-body-bg) 92%, var(--bs-secondary-bg) 8%);
    border: 1px solid var(--bs-border-color);
    backdrop-filter: blur(8px);
  }

  .spec-group-toggle {
    font-size: 0.95rem;
  }
</style>

{#if mode === 'select'}
  <div class="card shadow-sm col-12 col-xl-8 mx-auto">
    <div class="card-body">
    <h2 class="h5">Editor Actions</h2>
    <p>Choose whether you want to create a new product or open an existing one for editing.</p>
    <div class="d-flex flex-wrap gap-2">
      <a class="btn btn-primary" href="/editor/create">Create New Product</a>
      <a class="btn btn-outline-secondary" href="/editor/edit">Edit Existing Product</a>
    </div>
    <div class="mt-3">
      <button class="btn btn-outline-secondary btn-sm" on:click={refreshTemplateLibrary} disabled={refreshingTemplates}>
        {refreshingTemplates ? 'Refreshing templates...' : 'Refresh template library'}
      </button>
    </div>
    </div>
  </div>
{/if}

{#if mode !== 'select'}
  <div class="editor-action-bar shadow-sm rounded-3 mb-3">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
      <div class="small text-body-secondary">
        {#if mode === 'create'}
          Creating a new product
        {:else}
          Editing an existing product
        {/if}
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <button class="btn btn-outline-secondary" on:click={toggleAllAccordions} disabled={loading || savingProductDetails || savingMapPoints}>
          {allAccordionsOpen ? 'Collapse All' : 'Expand All'}
        </button>
        {#if mode === 'create'}
          <button class="btn btn-primary" on:click={saveProduct} disabled={loading}>Save Product</button>
          <button class="btn btn-outline-secondary" on:click={() => { mode = 'select'; resetProductEditor(''); productImages = []; pendingImageFiles = []; currentProduct = null; selectedProductId = null; }}>
            Cancel
          </button>
        {:else if editingProductId !== null}
          <button class="btn btn-primary" on:click={saveProduct} disabled={loading || savingProductDetails || savingMapPoints}>
            {savingProductDetails ? 'Saving Product Details...' : 'Save Product Details'}
          </button>
          {#if rpmPoints.length > 0 || efficiencyPoints.length > 0}
            <button class="btn btn-primary" on:click={saveMapPoints} disabled={savingMapPoints}>
              {savingMapPoints ? 'Saving Map Points...' : 'Save Map Points'}
            </button>
          {/if}
          <button
            class="btn btn-outline-danger"
            on:click={deleteCurrentProduct}
            disabled={savingMapPoints || savingProductDetails}
          >
            Delete Product
          </button>
          <button
            class="btn btn-outline-secondary"
            disabled={savingMapPoints || savingProductDetails}
            on:click={returnToEditorHome}
          >
            Done
          </button>
        {/if}
      </div>
      {#if mode === 'editExisting' && editingProductId !== null}
        <div class="small text-body-secondary w-100 text-end">
          {#if savingMapPoints}
            {mapPointSaveProgressMessage}
          {:else if savingProductDetails}
            Saving product details...
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if mode === 'create'}
  <div class="card shadow-sm col-12 col-xxl-12 mx-auto">
    <div class="card-body">
    <h2 class="h5">Create New Product</h2>
    <div class="row g-3">
      <div class="col-12 col-lg-6">
      <AccordionCard title="Core details" description="Set the base identity and content for the new product." bind:open={createCoreDetailsOpen}>
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
            <label class="form-label" for="create-printed-template">Printed PDF template</label>
            <select
              class="form-select"
              id="create-printed-template"
              bind:value={productForm.printed_template_id}
              on:change={() => {
                createTemplateSelectionSource = { ...createTemplateSelectionSource, printed: 'manual' };
              }}
            >
              <option value="">-- Choose option --</option>
              {#each productTemplateOptions as template}
                <option value={template.id}>{template.label}</option>
              {/each}
            </select>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label" for="create-online-template">Online PDF template</label>
            <select
              class="form-select"
              id="create-online-template"
              bind:value={productForm.online_template_id}
              on:change={() => {
                createTemplateSelectionSource = { ...createTemplateSelectionSource, online: 'manual' };
              }}
            >
              <option value="">-- Choose option --</option>
              {#each productTemplateOptions as template}
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
      </AccordionCard>
      </div>

      <div class="col-12 col-lg-6">
      <AccordionCard title="Product attributes" description="Configure the product options and longer-form content." bind:open={createProductAttributesOpen}>
        <div class="row g-3">
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
      </AccordionCard>
      </div>
    </div>
    <div class="mt-3">
      <AccordionCard title="Grouped Specifications" description="Organise ordered parameter groups for this product type." bind:open={createGroupedSpecificationsOpen}>
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-outline-secondary btn-sm" on:click={toggleAllSpecificationGroups}>
              {parameterGroups.length > 0 && parameterGroups.every((_, index) => specificationGroupOpenState[index] ?? true) ? 'Collapse All Groups' : 'Expand All Groups'}
            </button>
            <button class="btn btn-outline-secondary btn-sm" on:click={usePresetGroupsForSelectedType}>Load Type Presets</button>
            <button class="btn btn-outline-primary btn-sm" on:click={addParameterGroup}>Add Group</button>
          </div>
        </div>
        {#if parameterGroups.length > 0}
          <div class="vstack gap-3 mt-3">
            {#each parameterGroups as group, groupIndex}
              <div
                class={`border rounded p-3 ${group._pending_delete ? 'bg-danger-subtle border-danger-subtle opacity-75' : ''}`}
                style={group._pending_delete ? '' : `background-color: ${specificationGroupBackgroundColor(groupIndex)}; border-color: ${specificationGroupBorderColor(groupIndex)};`}
              >
                <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3">
                  <button class="btn btn-link p-0 text-decoration-none text-reset fw-semibold spec-group-toggle" type="button" on:click={() => toggleSpecificationGroup(groupIndex)}>
                    {(specificationGroupOpenState[groupIndex] ?? true) ? 'Hide' : 'Show'} {group.group_name || `Group ${groupIndex + 1}`}
                  </button>
                  <div class="d-flex flex-wrap gap-2 align-items-center">
                  <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameterGroup(groupIndex, -1)} disabled={groupIndex === 0}>Up</button>
                  <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameterGroup(groupIndex, 1)} disabled={groupIndex === parameterGroups.length - 1}>Down</button>
                  <button class={`btn btn-sm ${group._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} on:click={() => removeParameterGroup(groupIndex)}>
                    {group._pending_delete ? 'Undo Delete' : 'Delete Group'}
                  </button>
                  <button class="btn btn-outline-primary btn-sm" on:click={() => addParameter(groupIndex)} disabled={group._pending_delete}>Add Parameter</button>
                  </div>
                </div>
                {#if group._pending_delete}
                  <p class="small text-danger-emphasis mb-3">This group is marked for deletion. Save Product to apply the deletion.</p>
                {/if}
                {#if specificationGroupOpenState[groupIndex] ?? true}
                <div class="vstack gap-3">
                  <input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name" bind:value={group.group_name} on:input={() => (parameterGroups = [...parameterGroups])} />
                  {#each group.parameters as parameter, parameterIndex}
                    <div
                      class={`border rounded p-3 ${parameter._pending_delete ? 'border-danger-subtle bg-danger-subtle opacity-75' : ''}`}
                      style={specificationParameterCardStyle(groupIndex, parameter._pending_delete)}
                    >
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
                              {#if parameterValueHistory(group.group_name, parameter.parameter_name, 'string').length > 0}
                                <label class="form-label form-label-sm mt-2" for={`create-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`}>Reuse previous value</label>
                                <select
                                  class="form-select form-select-sm"
                                  id={`create-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`}
                                  on:change={(event) => {
                                    const suggestion = parameterValueHistory(group.group_name, parameter.parameter_name, 'string')[Number(event.currentTarget.value)];
                                    if (suggestion) {
                                      applyParameterHistorySuggestion(groupIndex, parameterIndex, suggestion, 'string');
                                    }
                                    event.currentTarget.value = '';
                                  }}
                                >
                                  <option value="">Choose prior value</option>
                                  {#each parameterValueHistory(group.group_name, parameter.parameter_name, 'string') as suggestion, suggestionIndex}
                                    <option value={suggestionIndex}>{suggestion.value_string} ({suggestion.count})</option>
                                  {/each}
                                </select>
                              {/if}
                            </div>
                          {:else}
                            <div class="col-12 col-lg-3">
                              <label class="form-label" for={`create-group-${groupIndex}-parameter-${parameterIndex}-number`}>Numeric value</label>
                              <input class="form-control" id={`create-group-${groupIndex}-parameter-${parameterIndex}-number`} type="number" step="any" bind:value={parameter.value_number} on:input={() => (parameterGroups = [...parameterGroups])} />
                              {#if parameterValueHistory(group.group_name, parameter.parameter_name, 'number').length > 0}
                                <label class="form-label form-label-sm mt-2" for={`create-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`}>Reuse previous value</label>
                                <select
                                  class="form-select form-select-sm"
                                  id={`create-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`}
                                  on:change={(event) => {
                                    const suggestion = parameterValueHistory(group.group_name, parameter.parameter_name, 'number')[Number(event.currentTarget.value)];
                                    if (suggestion) {
                                      applyParameterHistorySuggestion(groupIndex, parameterIndex, suggestion, 'number');
                                    }
                                    event.currentTarget.value = '';
                                  }}
                                >
                                  <option value="">Choose prior value</option>
                                  {#each parameterValueHistory(group.group_name, parameter.parameter_name, 'number') as suggestion, suggestionIndex}
                                    <option value={suggestionIndex}>{suggestion.value_number}{suggestion.unit ? ` ${suggestion.unit}` : ''} ({suggestion.count})</option>
                                  {/each}
                                </select>
                              {/if}
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
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-body-secondary mt-3 mb-0">No parameter groups yet. Load type presets or add a group manually.</p>
        {/if}
      </AccordionCard>
    </div>
    {#if productSupportsGraph() && (rpmLines.length > 0 || rpmPoints.length > 0 || efficiencyPoints.length > 0)}
      <div class="mt-3">
        <AccordionCard title="Preset Graph Preview" description="Review the type preset graph data that will be created with this product.">
          <div class="vstack gap-3">
            {#if rpmLines.length > 0}
              <div class="card shadow-sm">
                <div class="card-body">
                  <h6 class="card-title mb-3">{graphLineValueLabel()} lines</h6>
                  <div class="table-responsive">
                    <table class="table table-sm align-middle editable-table mb-0">
                      <thead>
                        <tr>
                          <th>{graphLineValueLabel()}</th>
                          <th>Band colour</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each rpmLines as line}
                          <tr>
                            <td>{formatGraphLineValue(line.rpm)}</td>
                            <td><code>{line.band_color || 'None'}</code></td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            {/if}

            {#if rpmPoints.length > 0}
              <div class="card shadow-sm">
                <div class="card-body">
                  <h6 class="card-title mb-3">{graphLineValueLabel()} points</h6>
                  <div class="table-responsive">
                    <table class="table table-sm align-middle editable-table mb-0">
                      <thead>
                        <tr>
                          <th>{graphLineValueLabel()}</th>
                          <th>{graphXAxisLabel()}</th>
                          <th>{graphYAxisLabel()}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each rpmPoints as p}
                          <tr>
                            <td>{formatGraphLineValue(p.rpm)}</td>
                            <td>{p.airflow}</td>
                            <td>{p.pressure}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            {/if}

            {#if productSupportsGraphOverlays() && efficiencyPoints.length > 0}
              <div class="card shadow-sm">
                <div class="card-body">
                  <h6 class="card-title mb-3">Efficiency / permissible points</h6>
                  <div class="table-responsive">
                    <table class="table table-sm align-middle editable-table mb-0">
                      <thead>
                        <tr>
                          <th>{graphXAxisLabel()}</th>
                          <th>Efficiency Centre</th>
                          <th>Efficiency Lower End</th>
                          <th>Efficiency Higher End</th>
                          <th>Permissible Use</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each efficiencyPoints as p}
                          <tr>
                            <td>{p.airflow}</td>
                            <td>{p.efficiency_centre ?? ''}</td>
                            <td>{p.efficiency_lower_end ?? ''}</td>
                            <td>{p.efficiency_higher_end ?? ''}</td>
                            <td>{p.permissible_use ?? ''}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            {/if}

            {#if rpmPoints.length > 0 || efficiencyPoints.length > 0}
              <div class="card shadow-sm">
                <div class="card-body">
                  <h6 class="card-title mb-3">Preset graph preview</h6>
                  <ECharts option={mapChartOption} height="500px" onChartReady={(c) => { chartInstance = c; }} />
                </div>
              </div>
            {/if}
          </div>
        </AccordionCard>
      </div>
    {/if}
    <p class="text-body-secondary mt-3 mb-2">Save the product first, then you can upload product images and manage the generated graph file.</p>
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
            editingProductId = null;
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
            editingProductId = null;
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
        <select
          class="form-select"
          id="edit-fan-select"
          bind:value={selectedProductId}
          disabled={!editExistingProductTypeKey}
          on:change={(event) => openSelectedExistingProduct(event.currentTarget.value)}
        >
          <option value={null}>— Select product —</option>
          {#each editableProductsForSelection(editExistingProductTypeKey, editExistingSeriesId) as product}
            <option value={product.id}>{product.model}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="d-flex flex-wrap gap-2 mt-3">
      <button class="btn btn-outline-secondary" on:click={() => { mode = 'select'; editExistingProductTypeKey = ''; editExistingSeriesId = ''; selectedProductId = null; resetProductEditor(''); productImages = []; pendingImageFiles = []; currentProduct = null; editingProductId = null; }}>
        Cancel
      </button>
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
        <AccordionCard title="Product details" description="Edit the main product fields and descriptive content." bind:open={editProductDetailsOpen}>
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
              <label class="form-label" for="edit-printed-template">Printed PDF template</label>
              <select class="form-select" id="edit-printed-template" bind:value={productForm.printed_template_id}>
                <option value="">-- Choose option --</option>
                {#each productTemplateOptions as template}
                  <option value={template.id}>{template.label}</option>
                {/each}
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label" for="edit-online-template">Online PDF template</label>
              <select class="form-select" id="edit-online-template" bind:value={productForm.online_template_id}>
                <option value="">-- Choose option --</option>
                {#each productTemplateOptions as template}
                  <option value={template.id}>{template.label}</option>
                {/each}
              </select>
            </div>
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
        </AccordionCard>

        <AccordionCard title="Grouped Specifications" description="Manage the ordered specification groups shown across the site." bind:open={editGroupedSpecificationsOpen}>
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <p class="text-body-secondary mb-0">These are ordered exactly as they will appear elsewhere.</p>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-secondary btn-sm" on:click={toggleAllSpecificationGroups}>
                {parameterGroups.length > 0 && parameterGroups.every((_, index) => specificationGroupOpenState[index] ?? true) ? 'Collapse All Groups' : 'Expand All Groups'}
              </button>
              <button class="btn btn-outline-secondary btn-sm" on:click={usePresetGroupsForSelectedType}>Load Type Presets</button>
              <button class="btn btn-outline-primary btn-sm" on:click={addParameterGroup}>Add Group</button>
            </div>
          </div>
          {#if parameterGroups.length > 0}
            <div class="vstack gap-3 mt-3">
              {#each parameterGroups as group, groupIndex}
                <div
                  class={`border rounded p-3 ${group._pending_delete ? 'bg-danger-subtle border-danger-subtle opacity-75' : ''}`}
                  style={group._pending_delete ? '' : `background-color: ${specificationGroupBackgroundColor(groupIndex)}; border-color: ${specificationGroupBorderColor(groupIndex)};`}
                >
                  <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3">
                    <button class="btn btn-link p-0 text-decoration-none text-reset fw-semibold spec-group-toggle" type="button" on:click={() => toggleSpecificationGroup(groupIndex)}>
                      {(specificationGroupOpenState[groupIndex] ?? true) ? 'Hide' : 'Show'} {group.group_name || `Group ${groupIndex + 1}`}
                    </button>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                    <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameterGroup(groupIndex, -1)} disabled={groupIndex === 0}>Up</button>
                    <button class="btn btn-outline-secondary btn-sm" on:click={() => moveParameterGroup(groupIndex, 1)} disabled={groupIndex === parameterGroups.length - 1}>Down</button>
                    <button class={`btn btn-sm ${group._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} on:click={() => removeParameterGroup(groupIndex)}>
                      {group._pending_delete ? 'Undo Delete' : 'Delete Group'}
                    </button>
                    <button class="btn btn-outline-primary btn-sm" on:click={() => addParameter(groupIndex)} disabled={group._pending_delete}>Add Parameter</button>
                    </div>
                  </div>
                  {#if group._pending_delete}
                    <p class="small text-danger-emphasis mb-3">This group is marked for deletion. Save Product to apply the deletion.</p>
                  {/if}
                  {#if specificationGroupOpenState[groupIndex] ?? true}
                  <div class="vstack gap-3">
                    <input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name" bind:value={group.group_name} on:input={() => (parameterGroups = [...parameterGroups])} />
                    {#each group.parameters as parameter, parameterIndex}
                      <div
                        class={`border rounded p-3 ${parameter._pending_delete ? 'border-danger-subtle bg-danger-subtle opacity-75' : ''}`}
                        style={specificationParameterCardStyle(groupIndex, parameter._pending_delete)}
                      >
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
                              {#if parameterValueHistory(group.group_name, parameter.parameter_name, 'string').length > 0}
                                <label class="form-label form-label-sm mt-2" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`}>Reuse previous value</label>
                                <select
                                  class="form-select form-select-sm"
                                  id={`edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`}
                                  on:change={(event) => {
                                    const suggestion = parameterValueHistory(group.group_name, parameter.parameter_name, 'string')[Number(event.currentTarget.value)];
                                    if (suggestion) {
                                      applyParameterHistorySuggestion(groupIndex, parameterIndex, suggestion, 'string');
                                    }
                                    event.currentTarget.value = '';
                                  }}
                                >
                                  <option value="">Choose prior value</option>
                                  {#each parameterValueHistory(group.group_name, parameter.parameter_name, 'string') as suggestion, suggestionIndex}
                                    <option value={suggestionIndex}>{suggestion.value_string} ({suggestion.count})</option>
                                  {/each}
                                </select>
                              {/if}
                            </div>
                          {:else}
                            <div class="col-12 col-lg-3">
                              <label class="form-label" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-number`}>Numeric value</label>
                              <input class="form-control" id={`edit-group-${groupIndex}-parameter-${parameterIndex}-number`} type="number" step="any" bind:value={parameter.value_number} on:input={() => (parameterGroups = [...parameterGroups])} />
                              {#if parameterValueHistory(group.group_name, parameter.parameter_name, 'number').length > 0}
                                <label class="form-label form-label-sm mt-2" for={`edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`}>Reuse previous value</label>
                                <select
                                  class="form-select form-select-sm"
                                  id={`edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`}
                                  on:change={(event) => {
                                    const suggestion = parameterValueHistory(group.group_name, parameter.parameter_name, 'number')[Number(event.currentTarget.value)];
                                    if (suggestion) {
                                      applyParameterHistorySuggestion(groupIndex, parameterIndex, suggestion, 'number');
                                    }
                                    event.currentTarget.value = '';
                                  }}
                                >
                                  <option value="">Choose prior value</option>
                                  {#each parameterValueHistory(group.group_name, parameter.parameter_name, 'number') as suggestion, suggestionIndex}
                                    <option value={suggestionIndex}>{suggestion.value_number}{suggestion.unit ? ` ${suggestion.unit}` : ''} ({suggestion.count})</option>
                                  {/each}
                                </select>
                              {/if}
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
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-body-secondary mt-3 mb-0">No parameter groups yet. Load type presets or add a group manually.</p>
          {/if}
        </AccordionCard>

      </div>
      </div>

      <div class="col-12 col-xxl-6">
        <div class="vstack gap-3">
          <AccordionCard title="Media and generated assets" description="Manage product images, exports, and band-graph styling." bind:open={editMediaAssetsOpen}>
            <ProductMediaPanel
              bind:pendingImageFiles
              {productForm}
              {productImages}
              {currentProduct}
              {refreshingProductPdfId}
              {refreshingProductGraphId}
              {selectedProductId}
              {graphStyleForm}
              showBandGraphStyle={productSupportsBandGraphStyle()}
              graphLineValueLabel={graphLineValueLabel}
              {uploadImages}
              {moveProductImage}
              {removeProductImage}
              {generateProductGraph}
              {generateProductPdf}
              {saveBandGraphStyle}
            />
          </AccordionCard>

        <AccordionCard title={`${graphLineValueLabel()} line management`} description="Add, reorder, and style the main graph lines." bind:open={editLineManagementOpen}>
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
        </AccordionCard>

        {#if productSupportsGraph()}
          <AccordionCard title="Graph data" description="Import, edit, and drag graph points for this product." bind:open={editGraphDataOpen}>
          <div class="vstack gap-3">
            <div class="card shadow-sm">
              <div class="card-body">
                <h3 class="h6 mb-2">Graph CSV</h3>
                <p class="text-body-secondary mb-2">
                  Use one wide CSV per graph. Required first column: <code>airflow_l_s</code>. Supported dynamic columns: <code>pressure_650rpm</code>, <code>pressure_813rpm</code>, etc.
                  {#if productSupportsGraphOverlays()}
                    Overlay columns also supported: <code>efficiency_centre</code>, <code>efficiency_lower_end</code>, <code>efficiency_higher_end</code>, <code>permissible_use</code>.
                  {/if}
                </p>
                <label class="form-label" for="graph-csv-file">Import Graph CSV file</label>
                <input
                  bind:this={graphCsvInput}
                  class="form-control"
                  id="graph-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  on:change={handleGraphCsvFileChange}
                />
                <p class="text-body-secondary small mt-2 mb-0">{graphCsvPlaceholder()}</p>
                {#if graphCsvFileName}
                  <p class="small mb-0 mt-2">Loaded file: <strong>{graphCsvFileName}</strong></p>
                {/if}
                {#if graphCsvError}
                  <p class="text-danger mb-0 mt-2">{graphCsvError}</p>
                {/if}
                <div class="d-flex flex-wrap gap-2 mt-3">
                  <button class="btn btn-outline-secondary" on:click={clearGraphCsvSelection}>Clear File Selection</button>
                  <button class="btn btn-outline-secondary" on:click={exportGraphCsv} disabled={rpmPoints.length === 0 && efficiencyPoints.length === 0}>Export Graph CSV</button>
                </div>
                <p class="small text-body-secondary mt-3 mb-0">Selecting a CSV overwrites the graph data shown on this page immediately. Review the tables and chart, then press <strong>Save Map Points</strong> to commit the imported changes to the database.</p>
              </div>
            </div>

            <div class="card shadow-sm">
              <div class="card-body">
                <h6 class="card-title mb-3">{graphLineValueLabel()} points</h6>
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
                  <p class="text-body-secondary mb-0">No graph points yet.</p>
                {/if}
              </div>
            </div>

            {#if productSupportsGraphOverlays()}
              <div class="card shadow-sm">
                <div class="card-body">
                  <h6 class="card-title mb-3">Efficiency / permissible points</h6>
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
                    <p class="text-body-secondary mb-0">No efficiency/permissible points yet.</p>
                  {/if}
                </div>
              </div>
            {/if}

            {#if rpmPoints.length > 0 || efficiencyPoints.length > 0}
              <div class="card shadow-sm">
                <div class="card-body">
                  <h6 class="card-title mb-3">Map points chart</h6>
                  <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                      <label class="form-label mb-0" for="chart-add-target">Line to add points on</label>
                      <select class="form-select w-auto" id="chart-add-target" bind:value={chartAddTarget}>
                        <option value="off">-Off-</option>
                        {#each rpmLines as line}
                          <option value={`rpm:${line.id}`}>{formatGraphLineValue(line.rpm)} line</option>
                        {/each}
                        {#each currentOverlayLineDefinitions() as definition}
                          <option value={`efficiency:${definition.key}`}>{definition.label}</option>
                        {/each}
                      </select>
                  </div>
                  <p class="text-body-secondary">Drag existing points to edit them. Set the dropdown above to a line when you want chart clicks to add points. Set it to -Off- to disable point adding. Hold either Shift key while left clicking a point to delete it.</p>
                  <ECharts
                    option={mapChartOption}
                    height="750px"
                    on={{ dragend: handleMapChartDragEnd }}
                    onChartReady={(c) => { chartInstance = c; setupChartDrag(); }}
                  />
                </div>
              </div>
            {/if}
          </div>
          </AccordionCard>
        {/if}
      </div>
    </div>
  </div>
</div>
</div>
{/if}
