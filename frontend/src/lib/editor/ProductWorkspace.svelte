<script>
  import { onDestroy, onMount, tick } from "svelte";
  import { beforeNavigate, goto } from "$app/navigation";
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
    duplicateProduct,
    updateProduct,
    replaceProductGraphData,
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
    startRefreshProductPdfJob,
    parseGraphDataUpload,
    uploadProductImages,
    reorderProductImages,
    deleteProductImage,
  } from "$lib/api.js";
  import { simplifyCurve, createGraphReference, moveOverlayPoint } from "$lib/graphImport.js";
  import ECharts from "$lib/ECharts.svelte";
  import { buildSmoothedCurveSamples } from "$lib/fullChart.js";
  import GraphPointPagination from "$lib/editor/GraphPointPagination.svelte";
  import AccordionCard from "$lib/editor/AccordionCard.svelte";
  import ProductMediaPanel from "$lib/editor/ProductMediaPanel.svelte";
  import RichTextEditor from "$lib/editor/RichTextEditor.svelte";
  import SeriesNamesBadgeList from "$lib/editor/SeriesNamesBadgeList.svelte";
  import { runMaintenanceJob } from "$lib/maintenanceJobs.js";
  import {
    FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS,
    GLOBAL_UNIT_OPTIONS,
    PERMISSIBLE_USE_MODE_OPTIONS,
    emptyProductForm,
    getChartTheme,
    theme,
  } from "$lib/config.js";
  import {
    createDescriptionFieldPayload,
    createDescriptionSectionDrafts,
    getDescriptionFieldCount,
    renumberDescriptionSections,
    MAX_DESCRIPTION_SECTIONS,
  } from "$lib/descriptionSections.js";
  import {
    buildFullChartOption,
    FULL_CHART_LINE_DEFINITIONS,
    RPM_BAND_FALLBACK_COLORS,
  } from "$lib/fullChart.js";
  import {
    FAN_ACOUSTIC_VARIANT_MODES,
    fanAcousticVariant,
  } from "$lib/fanAcoustic.js";

  export let initialMode = "select";
  export let initialProductId = "";
  export let initialSeriesId = "";
  export let initialSelectionOnly = false;

  let products = [];
  let productTypes = [];
  let seriesRecords = [];
  let templateRegistry = { product_templates: [], series_templates: [] };
  let selectedProductId = null;
  let currentProduct = null;
  let rpmLines = [];
  let rpmPoints = [];
  let rpmPointPage = 0;
  let efficiencyPointPage = 0;
  let graphDragFrame = null;
  let pendingGraphDrag = null;
  let efficiencyPoints = [];
  let efficiencyLineDataLoaded = false;
  let hasBothEfficiencyLines = true;
  let originalRpmLineSnapshots = new Map();
  let originalRpmPointSnapshots = new Map();
  let mapChartOption = {};
  let loading = false;
  let savingProductDetails = false;
  let error = "";
  let successMessages = [];
  let successToastKey = 0;
  let productImages = [];
  let pendingImageFiles = [];
  let rpmPointSort = { column: null, direction: "asc" };
  let chartAddTarget = "";
  let newRpmLineValue = "";
  let newRpmLineBandColor = RPM_BAND_FALLBACK_COLORS[0];
  let originalRpmPointIds = [];
  let originalEfficiencyPointIds = [];
  let nextTempPointId = -1;
  let nextTempRpmLineId = -1;
  let savingMapPoints = false;
  let mapPointSaveProgress = {
    completed: 0,
    total: 0,
    label: "",
  };
  let mapPointSaveCompleted = 0;
  let mapPointSaveProgressMessage = "";
  let mapPointSaveRenderChain = Promise.resolve();
  let successDismissTimeout = null;
  let refreshingTemplates = false;
  let refreshingProductPdfJob = null;
  let refreshingProductGraphId = null;
  let savingProductType = false;
  let savingSeriesRecord = false;
  let managementMode = "";
  let selectedManageProductTypeId = "";
  let selectedManageSeriesId = "";
  let editExistingProductTypeKey = "";
  let editExistingSeriesId = "";
  let createTemplateSelectionSource = {
    printed: "auto",
    online: "auto",
  };

  let productTypeDraft = {
    id: null,
    key: "",
    label: "",
    supports_graph: false,
    graph_kind: "",
    supports_graph_overlays: false,
    supports_band_graph_style: false,
    graph_line_value_label: "",
    graph_line_value_unit: "",
    graph_x_axis_label: "",
    graph_x_axis_unit: "",
    graph_y_axis_label: "",
    graph_y_axis_unit: "",
  };

  let seriesDraft = {
    id: null,
    name: "",
    product_type_key: "",
    printed_template_id: "",
    online_template_id: "",
  };
  let seriesDescriptionSections = createDescriptionSectionDrafts();
  let seriesDescriptionFieldCount = getDescriptionFieldCount();

  let chartInstance = null;
  let draggingPoint = null;
  let dragAxisLock = null;
  let loadingExistingProduct = false;
  let destroyed = false;
  let appliedInitialProductId = '';

  // Mode: 'select' (initial), 'create', or 'editExisting'
  let mode = initialMode;
  let editingProductId = null;
  function defaultGraphStyleForm() {
    return {
      band_graph_background_color: "#ffffff",
      band_graph_label_text_color: "#000000",
      band_graph_faded_opacity: 0.18,
      band_graph_permissible_label_color: "#000000",
    };
  }
  let createBandGraphStyleInitialized = false;
  let graphStyleForm = defaultGraphStyleForm();
  let parameterGroups = [];
  let createCoreDetailsOpen = true;
  let createProductAttributesOpen = true;
  let createGroupedSpecificationsOpen = true;
  let createFanAcousticTableOpen = true;
  let editProductDetailsOpen = true;
  let editGroupedSpecificationsOpen = true;
  let editFanAcousticTableOpen = true;
  let editMediaAssetsOpen = true;
  let editLineManagementOpen = true;
  let editGraphDataOpen = true;
  let allAccordionsOpen = false;
  let specificationGroupOpenState = {};
  const SPECIFICATION_GROUP_BASE_COLORS = [
    "#ed6c02",
    "#0288d1",
    "#2e7d32",
    "#7b1fa2",
    "#5d4037",
    "#c62828",
  ];

  function specificationGroupTint(groupIndex) {
    const baseColor =
      SPECIFICATION_GROUP_BASE_COLORS[
        groupIndex % SPECIFICATION_GROUP_BASE_COLORS.length
      ];
    const isDark = $theme === "dark";
    return {
      background: `color-mix(in srgb, ${baseColor} ${isDark ? 18 : 14}%, var(--bs-body-bg))`,
      border: `color-mix(in srgb, ${baseColor} ${isDark ? 82 : 74}%, var(--bs-border-color))`,
      parameterBackgroundLight: `color-mix(in srgb, ${baseColor} ${isDark ? 12 : 8}%, var(--bs-body-bg))`,
      parameterBackgroundDark: `color-mix(in srgb, ${baseColor} ${isDark ? 22 : 16}%, var(--bs-body-bg))`,
    };
  }

  // Form state: new/edit fan
  let productForm = emptyProductForm();
  let productDescriptionSections = createDescriptionSectionDrafts();
  let productDescriptionFieldCount = getDescriptionFieldCount();
  let fanAcousticTable = createFanAcousticTableDraft();

  // Map point form (single)
  let rpmPointForm = {
    rpm_line_id: "",
    airflow: "",
    pressure: "",
  };
  let efficiencyPointForm = {
    airflow: "",
    efficiency_centre: "",
    efficiency_lower_end: "",
    efficiency_higher_end: "",
    permissible_use: "",
  };
  let graphCsvError = "";
  let graphCsvFileName = "";
  let graphCsvInput = null;
  let graphCsvDownsampleImportedCurves = false;
  let graphCsvAutoScaleOverlays = false;
  let graphReference = createGraphReference();
  let graphCsvDownsamplePointCount = 5;
  let graphCsvUseLowerEfficiencyLine = false;
  let editorUseLowerEfficiencyLine = false;
  let graphCsvImportSource = {
    rows: [],
    fileName: "",
    productId: null,
  };
  let graphCsvImportSignature = "";
  let graphCsvPreview = null;
  let fanAcousticCsvError = "";
  let fanAcousticCsvFileName = "";
  let fanAcousticCsvInput = null;
  let efficiencyScaleFactors = {
    efficiency_centre: "1",
    efficiency_lower_end: "1",
    efficiency_higher_end: "1",
    permissible_use: "1",
  };

  function syncSpecificationGroupOpenState(groups, currentState) {
    const nextState = {};
    groups.forEach((_, index) => {
      nextState[index] = currentState[index] ?? true;
    });
    return nextState;
  }

  $: specificationGroupOpenState = syncSpecificationGroupOpenState(
    parameterGroups,
    specificationGroupOpenState,
  );
  $: productTemplateOptions = templateRegistry.product_templates ?? [];
  $: graphOptionsKey = JSON.stringify([selectedProductId, graphCsvDownsampleImportedCurves,
    graphCsvDownsamplePointCount, graphCsvAutoScaleOverlays, graphCsvUseLowerEfficiencyLine,
    productForm.permissible_use_mode || "both"]);
  $: if (graphOptionsKey !== graphCsvImportSignature) applyGraphOptions(graphOptionsKey);
  $: graphCsvPreview = buildGraphCsvPreview(
    graphCsvImportSource.rows,
    graphCsvImportSource.fileName || "graph-data.csv",
  );
  $: if (
    mode === "create" &&
    productForm.product_type_key &&
    productTypes.length > 0 &&
    templateRegistry
  ) {
    applyCreateTypePresets(productForm.product_type_key);
    applyCreateTemplateDefault(productForm.product_type_key);
  }

  function productTypePresetTemplateId(productTypeKey, variant) {
    const productType = productTypes.find(
      (item) => item.key === productTypeKey,
    );
    if (variant === "printed") {
      return (
        productType?.printed_product_template_id ||
        productType?.product_template_id ||
        ""
      );
    }
    return (
      productType?.online_product_template_id ||
      productType?.product_template_id ||
      ""
    );
  }

  function productTypeBandGraphStyleDefaults(productTypeKey) {
    const productType = productTypes.find(
      (item) => item.key === productTypeKey,
    );
    return {
      band_graph_background_color:
        normalizeOptionalColor(productType?.band_graph_background_color) ||
        "#ffffff",
      band_graph_label_text_color:
        normalizeOptionalColor(productType?.band_graph_label_text_color) ||
        "#000000",
      band_graph_faded_opacity:
        productType?.band_graph_faded_opacity != null &&
        !Number.isNaN(Number(productType.band_graph_faded_opacity))
          ? Number(productType.band_graph_faded_opacity)
          : 0.18,
      band_graph_permissible_label_color:
        normalizeOptionalColor(
          productType?.band_graph_permissible_label_color,
        ) || "#000000",
    };
  }

  function resolveCreateTemplateId(productTypeKey, variant) {
    const preferredTemplateId = productTypePresetTemplateId(
      productTypeKey,
      variant,
    );
    const availableTemplateIds = new Set(
      productTemplateOptions.map((template) => template.id),
    );
    if (preferredTemplateId && availableTemplateIds.has(preferredTemplateId)) {
      return preferredTemplateId;
    }
    if (availableTemplateIds.has("product-default")) {
      return "product-default";
    }
    return preferredTemplateId || "";
  }

  function applyCreateTemplateDefault(productTypeKey) {
    productForm = {
      ...productForm,
      printed_template_id:
        createTemplateSelectionSource.printed === "manual"
          ? productForm.printed_template_id
          : resolveCreateTemplateId(productTypeKey, "printed"),
      online_template_id:
        createTemplateSelectionSource.online === "manual"
          ? productForm.online_template_id
          : resolveCreateTemplateId(productTypeKey, "online"),
    };
  }

  function applyCreateBandGraphStyleDefaults(
    productTypeKey,
    markInitialized = true,
  ) {
    graphStyleForm = {
      ...graphStyleForm,
      ...productTypeBandGraphStyleDefaults(productTypeKey),
    };
    if (markInitialized) {
      createBandGraphStyleInitialized = true;
    }
  }

  function resetProductTypeDraft(productType = null) {
    productTypeDraft = {
      id: productType?.id ?? null,
      key: productType?.key ?? "",
      label: productType?.label ?? "",
      supports_graph: productType?.supports_graph ?? false,
      graph_kind: productType?.graph_kind ?? "",
      supports_graph_overlays: productType?.supports_graph_overlays ?? false,
      supports_band_graph_style:
        productType?.supports_band_graph_style ?? false,
      graph_line_value_label: productType?.graph_line_value_label ?? "",
      graph_line_value_unit: productType?.graph_line_value_unit ?? "",
      graph_x_axis_label: productType?.graph_x_axis_label ?? "",
      graph_x_axis_unit: productType?.graph_x_axis_unit ?? "",
      graph_y_axis_label: productType?.graph_y_axis_label ?? "",
      graph_y_axis_unit: productType?.graph_y_axis_unit ?? "",
    };
  }

  function resetSeriesDraft(series = null) {
    seriesDescriptionSections = createDescriptionSectionDrafts(series || {});
    seriesDescriptionFieldCount = Math.max(
      getDescriptionFieldCount(series || {}),
      seriesDescriptionSections.length,
    );
    seriesDraft = {
      id: series?.id ?? null,
      name: series?.name ?? "",
      product_type_key: series?.product_type_key ?? "",
      printed_template_id:
        series?.printed_template_id || series?.template_id || "",
      online_template_id:
        series?.online_template_id || series?.template_id || "",
    };
  }

  function syncEditExistingFiltersFromProduct(product = currentProduct) {
    if (!product) return;
    editExistingProductTypeKey = product.product_type_key || "";
    const matchingSeries = seriesRecords.find(
      (series) =>
        (product.series_id != null &&
          Number(series.id) === Number(product.series_id)) ||
        (product.series_name &&
          String(series.name).trim() === String(product.series_name).trim()),
    );
    editExistingSeriesId = product.series_id != null
      ? Number(product.series_id)
      : matchingSeries
        ? matchingSeries.id
        : "";
  }

  function seriesForType(productTypeKey) {
    return seriesRecords
      .filter(
        (series) =>
          series.product_type_key === productTypeKey ||
          String(series.id) === String(editExistingSeriesId),
      )
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }

  function editableProductsForType(productTypeKey) {
    return products
      .filter(
        (product) =>
          !productTypeKey || product.product_type_key === productTypeKey,
      )
      .sort((a, b) =>
        String(a.model || "").localeCompare(String(b.model || "")),
      );
  }

  function editableProductsForSelection(productTypeKey, seriesId) {
    return products
      .filter(
        (product) =>
          !productTypeKey || product.product_type_key === productTypeKey,
      )
      .filter(
        (product) =>
          !seriesId || Number(product.series_id) === Number(seriesId),
      )
      .sort((a, b) =>
        String(a.model || "").localeCompare(String(b.model || "")),
      );
  }

  function normalizeLookupText(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }

  function parameterValueHistory(groupName, parameterName, valueType) {
    const groupKey = normalizeLookupText(groupName);
    const parameterKey = normalizeLookupText(parameterName);
    const history = new Map();

    for (const product of products) {
      if (editingProductId && Number(product.id) === Number(editingProductId))
        continue;

      for (const group of product.parameter_groups ?? []) {
        if (normalizeLookupText(group.group_name) !== groupKey) continue;

        for (const parameter of group.parameters ?? []) {
          if (normalizeLookupText(parameter.parameter_name) !== parameterKey)
            continue;

          if (valueType === "string") {
            const valueString = String(parameter.value_string ?? "").trim();
            if (!valueString) continue;
            const key = valueString.toLowerCase();
            const existing = history.get(key) ?? {
              value_string: valueString,
              count: 0,
            };
            existing.count += 1;
            history.set(key, existing);
            continue;
          }

          const valueNumber = parameter.value_number;
          if (valueNumber == null || Number.isNaN(Number(valueNumber)))
            continue;
          const unit = String(parameter.unit ?? "").trim();
          const key = `${Number(valueNumber)}|${unit.toLowerCase()}`;
          const existing = history.get(key) ?? {
            value_number: Number(valueNumber),
            unit,
            count: 0,
          };
          existing.count += 1;
          history.set(key, existing);
        }
      }
    }

    const values = [...history.values()];
    if (valueType === "string") {
      return values.sort(
        (a, b) =>
          b.count - a.count || a.value_string.localeCompare(b.value_string),
      );
    }

    return values.sort(
      (a, b) =>
        b.count - a.count ||
        a.value_number - b.value_number ||
        a.unit.localeCompare(b.unit),
    );
  }

  function applyParameterHistorySuggestion(
    groupIndex,
    parameterIndex,
    suggestion,
    valueType,
  ) {
    parameterGroups = parameterGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      const parameters = group.parameters.map((parameter, innerIndex) => {
        if (innerIndex !== parameterIndex) return parameter;
        if (valueType === "string") {
          return {
            ...parameter,
            value_type: "string",
            value_string: suggestion.value_string ?? "",
            value_number: "",
            unit: "",
            custom_unit: "",
          };
        }
        return {
          ...parameter,
          value_type: "number",
          value_number: suggestion.value_number ?? "",
          value_string: "",
          unit:
            suggestion.unit && !GLOBAL_UNIT_OPTIONS.includes(suggestion.unit)
              ? "__custom__"
              : suggestion.unit || "",
          custom_unit:
            suggestion.unit && !GLOBAL_UNIT_OPTIONS.includes(suggestion.unit)
              ? suggestion.unit
              : "",
        };
      });
      return { ...group, parameters };
    });
  }

  function parseOptionalNumber(value) {
    return value === "" || value == null ? null : parseFloat(value);
  }

  function parseOptionalInteger(value) {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed);
  }

  function sanitizeIntegerInputValue(value) {
    if (value === "" || value == null) return "";
    const text = String(value).trim();
    const numeric = Number(text.replace(/,/g, "."));
    if (Number.isFinite(numeric)) {
      return String(Math.round(numeric));
    }
    return text.replace(/[^\d]/g, "");
  }

  function handleIntegerInputKeydown(event) {
    const allowedKeys = new Set([
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Enter",
      "Escape",
    ]);
    if (allowedKeys.has(event.key)) return;
    if (event.ctrlKey || event.metaKey) return;
    if (/^\d$/.test(event.key)) return;
    event.preventDefault();
  }

  function parseScaleFactor(value) {
    if (value === "" || value == null) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isBlankEditorNumericValue(value) {
    return value === "" || value == null;
  }

  function isValidEditorNumericValue(value) {
    if (isBlankEditorNumericValue(value)) return true;
    return Number.isFinite(Number(value));
  }

  function isValidEditorIntegerValue(value) {
    if (isBlankEditorNumericValue(value)) return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && Math.round(parsed) === parsed;
  }

  function editorNumericInputClass(value) {
    return isValidEditorNumericValue(value) ? "" : "is-invalid";
  }

  function normalizeGraphLineDraft(line = {}) {
    return {
      ...line,
      rpm: parseOptionalInteger(line.rpm),
    };
  }

  function snapshotGraphLine(line = {}) {
    return {
      rpm: parseOptionalInteger(line.rpm),
      band_color: normalizeOptionalColor(line.band_color) || null,
    };
  }

  function normalizeGraphPointDraft(point = {}) {
    return {
      ...point,
      rpm: parseOptionalInteger(point.rpm),
      airflow: parseOptionalNumber(point.airflow),
      pressure: parseOptionalNumber(point.pressure),
    };
  }

  function resolveRpmLineIdForPoint(point) {
    const numericLineId = Number(point?.rpm_line_id);
    if (Number.isFinite(numericLineId) && isPersistedRpmLineId(numericLineId)) {
      return numericLineId;
    }

    const pointRpm = parseOptionalInteger(point?.rpm);
    if (pointRpm != null) {
      const currentLine = rpmLines.find(
        (line) => Number(line?.rpm) === Number(pointRpm),
      );
      if (currentLine && isPersistedRpmLineId(currentLine.id)) {
        return currentLine.id;
      }
    }

    return numericLineId;
  }

  function normalizeGraphEfficiencyPointDraft(point = {}) {
    return {
      ...point,
      airflow: parseOptionalNumber(point.airflow),
      efficiency_centre: parseOptionalNumber(point.efficiency_centre),
      efficiency_lower_end: parseOptionalNumber(point.efficiency_lower_end),
      efficiency_higher_end: parseOptionalNumber(point.efficiency_higher_end),
      permissible_use: parseOptionalNumber(point.permissible_use),
    };
  }

  function applyEfficiencyScaleFactor(field, factor) {
    const parsedFactor = parseScaleFactor(factor);
    if (parsedFactor == null) {
      throw new Error(
        `Enter a valid scaling factor for ${field.replaceAll("_", " ")}.`,
      );
    }

    efficiencyPoints = efficiencyPoints.map((point) => {
      if (isBlankEditorNumericValue(point?.[field])) {
        return point;
      }
      const currentValue = Number(point?.[field]);
      if (!Number.isFinite(currentValue)) return point;
      return {
        ...point,
        [field]: Math.round(currentValue * parsedFactor),
      };
    });

    addSuccess(`Scaled ${field.replaceAll("_", " ")} values locally.`);
  }

  function generateMissingPermissibleUseLocally() {
    const sourceField = editorUseLowerEfficiencyLine
      ? "efficiency_lower_end"
      : "efficiency_higher_end";
    let generatedCount = 0;
    efficiencyPoints = efficiencyPoints.map((point) => {
      if (!isBlankEditorNumericValue(point?.permissible_use)) return point;
      const sourceValue = Number(point?.[sourceField]);
      if (!Number.isFinite(sourceValue)) return point;
      generatedCount += 1;
      return { ...point, permissible_use: Math.round(sourceValue) };
    });
    addSuccess(
      generatedCount
        ? `Generated ${generatedCount} missing permissible-use value${generatedCount === 1 ? "" : "s"} locally. Save Changes to persist them.`
        : "No missing permissible-use values could be generated from the selected efficiency line.",
    );
  }

  function scaleEfficiencyLinesToHighestRpm() {
    if (!efficiencyPoints.length) {
      addSuccess("There are no efficiency/permissible points to scale.");
      return;
    }

    const scaledPoints = applyLineByLineOverlayScaling(
      efficiencyPoints,
      rpmLines,
      rpmPoints,
    );

    const changed = scaledPoints.some((point, index) =>
      [
        "efficiency_centre",
        "efficiency_lower_end",
        "efficiency_higher_end",
        "permissible_use",
      ].some((field) => point?.[field] !== efficiencyPoints[index]?.[field]),
    );

    efficiencyPoints = scaledPoints;
    addSuccess(
      changed
        ? "Efficiency/permissible lines scaled to the highest RPM line locally. Save Changes to persist them."
        : "Efficiency/permissible lines could not be scaled with the current graph data.",
    );
  }

  function swapEfficiencyLineFields(firstField, secondField, firstLabel, secondLabel) {
    efficiencyPoints = efficiencyPoints.map((point) => ({
      ...point,
      [firstField]: point?.[secondField] ?? null,
      [secondField]: point?.[firstField] ?? null,
    }));
    addSuccess(`${firstLabel} and ${secondLabel} lines switched locally.`);
  }

  function collectEditorNumericValidationErrors() {
    const errors = [];

    if (!isValidEditorNumericValue(graphStyleForm.band_graph_faded_opacity)) {
      errors.push("Band graph faded opacity must be numeric.");
    }

    const checkPointRow = (rowLabel, point, fields) => {
      for (const [fieldLabel, value] of fields) {
        if (!isValidEditorNumericValue(value)) {
          errors.push(`${rowLabel} ${fieldLabel} must be numeric.`);
        }
      }
    };

    const checkRows = (rows, rowLabelPrefix, fieldsForRow) => {
      rows.forEach((row, index) => {
        const rowLabel = `${rowLabelPrefix} row ${index + 1}`;
        fieldsForRow(rowLabel, row, index);
      });
    };

    checkRows(
      rpmLines.filter((line) => !line?._pending_delete),
      "Graph line",
      (rowLabel, line) => {
        if (!isValidEditorIntegerValue(line.rpm)) {
          errors.push(`${rowLabel} RPM must be a whole number.`);
        }
      },
    );

    checkRows(
      rpmPoints.filter((point) => !point?._pending_delete),
      "Graph point",
      (rowLabel, point) => {
        checkPointRow(rowLabel, point, [
          ["Airflow", point.airflow],
          ["Pressure", point.pressure],
        ]);
        if (
          !isValidEditorIntegerValue(point.airflow) ||
          !isValidEditorIntegerValue(point.pressure)
        ) {
          errors.push(
            `${rowLabel} airflow and pressure must be whole numbers.`,
          );
        }
      },
    );

    checkRows(
      efficiencyPoints.filter((point) => !point?._pending_delete),
      "Efficiency point",
      (rowLabel, point) => {
        checkPointRow(rowLabel, point, [
          ["Airflow", point.airflow],
          ["Efficiency centre", point.efficiency_centre],
          ["Efficiency lower end", point.efficiency_lower_end],
          ["Efficiency higher end", point.efficiency_higher_end],
          ["Permissible use", point.permissible_use],
        ]);
        if (
          !isValidEditorIntegerValue(point.airflow) ||
          !isValidEditorIntegerValue(point.efficiency_centre) ||
          !isValidEditorIntegerValue(point.efficiency_lower_end) ||
          !isValidEditorIntegerValue(point.efficiency_higher_end) ||
          !isValidEditorIntegerValue(point.permissible_use)
        ) {
          errors.push(`${rowLabel} values must be whole numbers.`);
        }
      },
    );

    if (isFanAcousticTableVisible() && fanAcousticTable) {
      fanAcousticTable.rows.forEach((row, index) => {
        const rowLabel = `Fan acoustic table row ${index + 1}`;
        checkPointRow(rowLabel, row, [
          ["Speed (rpm)", row.speed_rpm],
          ["Peak Pressure (Pa)", row.peak_pressure_pa],
          ["Peak Power (kW)", row.peak_power_kw],
          ["Running Frequency", row.running_frequency_hz],
          ["Running Voltage (V)", row.running_voltage_v],
          ["Sound Pressure Level dB @ 3 meters", row.sound_pressure_db_3m],
        ]);
        for (const column of fanAcousticTable.sound_power_columns ?? []) {
          if (!isValidEditorNumericValue(row.sound_power_levels?.[column])) {
            errors.push(`${rowLabel} ${column} must be numeric.`);
          }
        }
      });
    }

    return errors;
  }

  function createParameterDraft(parameter = {}) {
    const unitValue = parameter.unit ?? "";
    const isCustomUnit =
      unitValue !== "" && !GLOBAL_UNIT_OPTIONS.includes(unitValue);
    return {
      id: parameter.id ?? null,
      _pending_delete: parameter._pending_delete ?? false,
      parameter_name: parameter.parameter_name ?? "",
      value_type:
        parameter.value_type ??
        (parameter.value_string != null && parameter.value_string !== ""
          ? "string"
          : parameter.value_number != null
            ? "number"
            : unitValue !== ""
              ? "number"
              : "string"),
      value_string: parameter.value_string ?? "",
      value_number: parameter.value_number ?? "",
      unit: isCustomUnit ? "__custom__" : unitValue,
      custom_unit: isCustomUnit ? unitValue : "",
    };
  }

  function createGroupDraft(group = {}) {
    return {
      id: group.id ?? null,
      _pending_delete: group._pending_delete ?? false,
      group_name: group.group_name ?? "",
      parameters: (group.parameters ?? []).map((parameter) =>
        createParameterDraft(parameter),
      ),
    };
  }

  function createPresetRpmPointDraft(point = {}) {
    return {
      id: point.id ?? null,
      _pending_delete: point._pending_delete ?? false,
      airflow: point.airflow ?? "",
      pressure: point.pressure ?? "",
    };
  }

  function createPresetRpmLineDraft(line = {}) {
    return {
      id: line.id ?? null,
      _pending_delete: line._pending_delete ?? false,
      rpm: line.rpm ?? "",
      band_color: line.band_color ?? "",
      points: (line.point_presets ?? []).map((point) =>
        createPresetRpmPointDraft(point),
      ),
    };
  }

  function createPresetEfficiencyPointDraft(point = {}) {
    return {
      id: point.id ?? null,
      _pending_delete: point._pending_delete ?? false,
      airflow: point.airflow ?? "",
      efficiency_centre: point.efficiency_centre ?? "",
      efficiency_lower_end: point.efficiency_lower_end ?? "",
      efficiency_higher_end: point.efficiency_higher_end ?? "",
      permissible_use: point.permissible_use ?? "",
    };
  }

  function normalizeFanAcousticColumns(columns) {
    const normalized = [];
    const seen = new Set();
    for (const column of columns ?? []) {
      const label = String(column ?? "").trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      normalized.push(label);
    }
    return normalized.length
      ? normalized
      : [...FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS];
  }

  function createFanAcousticRowDraft(
    row = {},
    columns = FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS,
  ) {
    const soundPowerLevels =
      row.sound_power_levels && typeof row.sound_power_levels === "object"
        ? row.sound_power_levels
        : {};
    return {
      speed_rpm: row.speed_rpm ?? "",
      peak_pressure_pa: row.peak_pressure_pa ?? "",
      peak_power_kw: row.peak_power_kw ?? "",
      running_frequency_hz: row.running_frequency_hz ?? "",
      running_voltage_v: row.running_voltage_v ?? "",
      sound_pressure_db_3m: row.sound_pressure_db_3m ?? "",
      sound_power_levels: Object.fromEntries(
        columns.map((column) => [column, soundPowerLevels[column] ?? ""]),
      ),
    };
  }

  function createFanAcousticTableDraft(table = {}, rpmLineSource = []) {
    const sound_power_columns = normalizeFanAcousticColumns(
      table.sound_power_columns ?? FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS,
    );
    const sourceRows = Array.isArray(table.rows) ? table.rows : [];
    const rowCount = rpmLineSource.length || sourceRows.length;
    const rows = Array.from({ length: rowCount }, (_, index) => {
      const sourceRow = sourceRows[index] ?? {};
      const rowDraft = createFanAcousticRowDraft(
        sourceRow,
        sound_power_columns,
      );
      const line = rpmLineSource[index];
      if (line && line.rpm != null && line.rpm !== "") {
        rowDraft.speed_rpm = line.rpm;
      }
      return rowDraft;
    });

    return {
      variant_mode: ["default", "override_1ph", "override_3ph"].includes(table.variant_mode)
        ? table.variant_mode
        : "default",
      sound_power_columns,
      rows,
    };
  }

  function syncFanAcousticTableWithRpmLines(rpmLineSource = rpmLines) {
    if (productForm.product_type_key !== "fan") {
      fanAcousticTable = null;
      return;
    }
    fanAcousticTable = createFanAcousticTableDraft(
      fanAcousticTable || {},
      rpmLineSource,
    );
  }

  function isFanAcousticTableVisible() {
    return productForm.product_type_key === "fan";
  }

  $: editorFanAcousticVariant = fanAcousticVariant(
    fanAcousticTable,
    parameterGroups,
  );
  $: editorFanAcousticRunningColumnLabel =
    editorFanAcousticVariant === "1ph"
      ? "Running Voltage (V)"
      : "Running Frequency (Hz)";

  function handleFanAcousticVariantChange(event) {
    fanAcousticTable = {
      ...fanAcousticTable,
      variant_mode: event.currentTarget.value,
    };
  }

  function handleParameterStringInput(groupIndex, parameterIndex, event) {
    const value = event.currentTarget.value;
    parameterGroups = parameterGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      return {
        ...group,
        parameters: group.parameters.map((parameter, innerIndex) =>
          innerIndex === parameterIndex
            ? { ...parameter, value_string: value }
            : parameter,
        ),
      };
    });
  }

  function addFanAcousticColumn() {
    if (!fanAcousticTable) {
      fanAcousticTable = createFanAcousticTableDraft();
    }
    const label = window.prompt("Sound power column label", "");
    const nextLabel = String(label ?? "").trim();
    if (!nextLabel || fanAcousticTable.sound_power_columns.includes(nextLabel))
      return;
    fanAcousticTable = {
      ...fanAcousticTable,
      sound_power_columns: [...fanAcousticTable.sound_power_columns, nextLabel],
      rows: fanAcousticTable.rows.map((row) => ({
        ...row,
        sound_power_levels: {
          ...(row.sound_power_levels || {}),
          [nextLabel]: "",
        },
      })),
    };
  }

  function renameFanAcousticColumn(columnIndex) {
    if (!fanAcousticTable) return;
    const currentLabel = fanAcousticTable.sound_power_columns[columnIndex];
    if (!currentLabel) return;
    const nextLabel = String(
      window.prompt("Rename sound power column", currentLabel) ?? "",
    ).trim();
    if (
      !nextLabel ||
      nextLabel === currentLabel ||
      fanAcousticTable.sound_power_columns.includes(nextLabel)
    )
      return;
    fanAcousticTable = {
      ...fanAcousticTable,
      sound_power_columns: fanAcousticTable.sound_power_columns.map(
        (label, index) => (index === columnIndex ? nextLabel : label),
      ),
      rows: fanAcousticTable.rows.map((row) => {
        const nextLevels = { ...(row.sound_power_levels || {}) };
        nextLevels[nextLabel] = nextLevels[currentLabel] ?? "";
        delete nextLevels[currentLabel];
        return { ...row, sound_power_levels: nextLevels };
      }),
    };
  }

  function removeFanAcousticColumn(columnIndex) {
    if (!fanAcousticTable) return;
    const column = fanAcousticTable.sound_power_columns[columnIndex];
    if (!column) return;
    if (!window.confirm(`Remove sound power column "${column}"?`)) return;
    fanAcousticTable = {
      ...fanAcousticTable,
      sound_power_columns: fanAcousticTable.sound_power_columns.filter(
        (_, index) => index !== columnIndex,
      ),
      rows: fanAcousticTable.rows.map((row) => {
        const nextLevels = { ...(row.sound_power_levels || {}) };
        delete nextLevels[column];
        return { ...row, sound_power_levels: nextLevels };
      }),
    };
  }

  function serializeFanAcousticTable() {
    if (!isFanAcousticTableVisible() || !fanAcousticTable) {
      return null;
    }
    const sound_power_columns = normalizeFanAcousticColumns(
      fanAcousticTable.sound_power_columns,
    );
    return {
      variant_mode: ["default", "override_1ph", "override_3ph"].includes(fanAcousticTable.variant_mode)
        ? fanAcousticTable.variant_mode
        : "default",
      sound_power_columns,
      rows: fanAcousticTable.rows.map((row) => ({
        speed_rpm: parseOptionalNumber(row.speed_rpm),
        peak_pressure_pa: parseOptionalNumber(row.peak_pressure_pa),
        peak_power_kw: parseOptionalNumber(row.peak_power_kw),
        running_frequency_hz: parseOptionalNumber(row.running_frequency_hz),
        running_voltage_v: parseOptionalNumber(row.running_voltage_v),
        sound_pressure_db_3m: parseOptionalNumber(row.sound_pressure_db_3m),
        sound_power_levels: Object.fromEntries(
          sound_power_columns.map((column) => [
            column,
            parseOptionalNumber(row.sound_power_levels?.[column]),
          ]),
        ),
      })),
    };
  }

  function clonePresetGroups(productTypeKey) {
    const productType = productTypes.find(
      (item) => item.key === productTypeKey,
    );
    if (!productType) return [];
    return (productType.parameter_group_presets ?? []).map((group) => ({
      id: null,
      group_name: group.group_name,
      parameters: (group.parameter_presets ?? []).map((parameter) =>
        createParameterDraft({
          parameter_name: parameter.parameter_name,
          value_type: parameter.value_type,
          value_string: parameter.value_string ?? "",
          value_number: parameter.value_number ?? "",
          unit: parameter.preferred_unit ?? "",
        }),
      ),
    }));
  }

  function clonePresetRpmLines(productTypeKey) {
    const productType = productTypes.find(
      (item) => item.key === productTypeKey,
    );
    if (!productType) return [];
    return (productType.rpm_line_presets ?? []).map((line) =>
      createPresetRpmLineDraft(line),
    );
  }

  function clonePresetEfficiencyPoints(productTypeKey) {
    const productType = productTypes.find(
      (item) => item.key === productTypeKey,
    );
    if (!productType) return [];
    return (productType.efficiency_point_presets ?? []).map((point) =>
      createPresetEfficiencyPointDraft(point),
    );
  }

  function materializeCreateGraphPresets(productTypeKey) {
    const presetLines = clonePresetRpmLines(productTypeKey).map(
      (line, index) => {
        const id = createTempRpmLineId();
        return {
          ...line,
          id,
          band_color:
            normalizeOptionalColor(line.band_color) ||
            RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length],
        };
      },
    );

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
            pressure: parseOptionalNumber(point.pressure),
          })),
      ),
    );

    const presetEfficiencyPoints = clonePresetEfficiencyPoints(productTypeKey)
      .filter((point) => !point?._pending_delete)
      .map((point) => ({
        ...point,
        id: createTempPointId(),
        product_id: null,
      }));

    return {
      rpmLines: presetLines,
      rpmPoints: presetPoints,
      efficiencyPoints: presetEfficiencyPoints,
    };
  }

  function applyCreateTypePresets(productTypeKey) {
    parameterGroups = clonePresetGroups(productTypeKey);
    const graphPresets = materializeCreateGraphPresets(productTypeKey);
    rpmLines = graphPresets.rpmLines;
    rpmPoints = graphPresets.rpmPoints;
    efficiencyPoints = graphPresets.efficiencyPoints;
    fanAcousticTable =
      productTypeKey === "fan"
        ? createFanAcousticTableDraft({}, graphPresets.rpmLines)
        : null;
    specificationGroupOpenState = {};
  }

  function resetProductDescriptionSections(record = null) {
    const nextSections = createDescriptionSectionDrafts(record || {});
    productDescriptionSections = nextSections.map((section) => ({
      ...section,
      html: section.html || "",
    }));
    productDescriptionFieldCount = Math.max(
      getDescriptionFieldCount(record || {}),
      productDescriptionSections.length,
    );
  }

  function addProductDescriptionSection() {
    if (productDescriptionSections.length >= MAX_DESCRIPTION_SECTIONS) return;
    productDescriptionSections = renumberDescriptionSections([
      ...productDescriptionSections,
      {
        key: "",
        title: "",
        html: "",
      },
    ]);
  }

  function removeProductDescriptionSection(index) {
    const nextSections = productDescriptionSections.filter(
      (_, sectionIndex) => sectionIndex !== index,
    );
    productDescriptionSections = renumberDescriptionSections(
      nextSections.length > 0
        ? nextSections
        : [{ key: "", title: "", html: "" }],
    );
  }

  function resetProductEditor(productTypeKey = "") {
    createTemplateSelectionSource = {
      printed: "auto",
      online: "auto",
    };
    createBandGraphStyleInitialized = false;
    productForm = {
      ...emptyProductForm(),
      product_type_key: productTypeKey,
      printed_template_id: "",
      online_template_id: "",
      series_id: null,
    };
    resetProductDescriptionSections();
    graphStyleForm = defaultGraphStyleForm();
    if (mode === "create") {
      applyCreateTypePresets(productTypeKey);
      applyCreateTemplateDefault(productTypeKey);
      applyCreateBandGraphStyleDefaults(
        productTypeKey,
        productTypes.length > 0,
      );
    } else {
      parameterGroups = clonePresetGroups(productTypeKey);
      rpmLines = [];
      rpmPoints = [];
      efficiencyPoints = [];
      fanAcousticTable =
        productTypeKey === "fan" ? createFanAcousticTableDraft({}, []) : null;
      specificationGroupOpenState = {};
    }
    createCoreDetailsOpen = true;
    createProductAttributesOpen = true;
    createGroupedSpecificationsOpen = true;
    createFanAcousticTableOpen = true;
    fanAcousticCsvError = "";
    fanAcousticCsvFileName = "";
    if (fanAcousticCsvInput) {
      fanAcousticCsvInput.value = "";
    }
  }

  function getCurrentProductType() {
    return (
      productTypes.find((item) => item.key === productForm.product_type_key) ||
      null
    );
  }

  $: currentProductTypeForForm = getCurrentProductType();

  function productSupportsGraph() {
    return getCurrentProductType()?.supports_graph ?? true;
  }

  function productSupportsGraphOverlays() {
    return getCurrentProductType()?.supports_graph_overlays ?? true;
  }

  function productSupportsBandGraphStyle() {
    return getCurrentProductType()?.supports_band_graph_style ?? true;
  }

  function hasEfficiencyLineValues(field) {
    const points = [
      ...(efficiencyPoints ?? []),
      ...(currentProduct?.efficiency_points ?? []),
    ];
    return points.some((point) => {
      const value = point?.[field];
      return value !== "" && value != null && Number.isFinite(Number(value));
    });
  }

  function permissibleUseModeDisabled(modeValue) {
    return modeValue === "both" && efficiencyLineDataLoaded && !hasBothEfficiencyLines;
  }

  function permissibleUseModeHelp(modeValue) {
    return modeValue === "both" && permissibleUseModeDisabled(modeValue)
      ? "Both efficiency lines are required for this mode."
      : "";
  }

  function productGraphKindLabel() {
    const graphKind = getCurrentProductType()?.graph_kind;
    if (graphKind === "silencer_loss") return "attenuator pressure-loss graph";
    if (graphKind === "fan_map") return "fan graph";
    return "product graph";
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
          graph_y_axis_unit: productType.graph_y_axis_unit,
        }
      : null;
  }

  function graphLineValueLabel() {
    return getCurrentProductType()?.graph_line_value_label || "RPM";
  }

  function graphLineValueUnit() {
    return (
      getCurrentProductType()?.graph_line_value_unit || graphLineValueLabel()
    );
  }

  function graphXAxisLabel() {
    return getCurrentProductType()?.graph_x_axis_label || "Airflow";
  }

  function graphXAxisUnit() {
    return getCurrentProductType()?.graph_x_axis_unit || "L/s";
  }

  function graphYAxisLabel() {
    return getCurrentProductType()?.graph_y_axis_label || "Pressure";
  }

  function graphYAxisUnit() {
    return getCurrentProductType()?.graph_y_axis_unit || "Pa";
  }

  function formatGraphLineValue(value) {
    const unit = graphLineValueUnit();
    return unit ? `${value} ${unit}` : `${value}`;
  }

  function currentOverlayLineDefinitions() {
    return productSupportsGraphOverlays() ? FULL_CHART_LINE_DEFINITIONS : [];
  }

  function loadSpecificationPresetsForSelectedType() {
    parameterGroups = clonePresetGroups(productForm.product_type_key);
    specificationGroupOpenState = {};
  }

  function changeProductType(nextKey) {
    if (mode === "create") {
      createTemplateSelectionSource = {
        printed: "auto",
        online: "auto",
      };
    }
    productForm = {
      ...productForm,
      product_type_key: nextKey,
      series_id: null,
      printed_template_id:
        mode === "create"
          ? resolveCreateTemplateId(nextKey, "printed")
          : productForm.printed_template_id,
      online_template_id:
        mode === "create"
          ? resolveCreateTemplateId(nextKey, "online")
          : productForm.online_template_id,
    };
    if (mode === "create") {
      applyCreateTypePresets(nextKey);
      applyCreateTemplateDefault(nextKey);
      applyCreateBandGraphStyleDefaults(nextKey, true);
    } else {
      parameterGroups = clonePresetGroups(nextKey);
      fanAcousticTable =
        nextKey === "fan"
          ? createFanAcousticTableDraft(fanAcousticTable || {}, rpmLines)
          : null;
      if (nextKey !== "fan") {
        fanAcousticCsvError = "";
        fanAcousticCsvFileName = "";
        if (fanAcousticCsvInput) {
          fanAcousticCsvInput.value = "";
        }
      }
      specificationGroupOpenState = {};
    }
  }

  function serializeCreateRpmLines() {
    return rpmLines
      .filter((line) => !line._pending_delete)
      .map((line) => ({
        rpm: parseOptionalInteger(line.rpm),
        band_color: normalizeOptionalColor(line.band_color) || null,
        points: rpmPoints
          .filter((point) => Number(point.rpm_line_id) === Number(line.id))
          .map((point) => ({
            airflow: parseOptionalNumber(point.airflow),
            pressure: parseOptionalNumber(point.pressure),
          })),
      }));
  }

  function serializeGraphLinesForReplace() {
    return rpmLines
      .filter((line) => !line._pending_delete)
      .map((line) => ({
        rpm: parseOptionalInteger(line.rpm),
        band_color: normalizeOptionalColor(line.band_color) || null,
        points: rpmPoints
          .filter(
            (point) =>
              Number(point.rpm_line_id) === Number(line.id) &&
              !point._pending_delete,
          )
          .map((point) => ({
            airflow: parseOptionalNumber(point.airflow),
            pressure: parseOptionalNumber(point.pressure),
          })),
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
        permissible_use: parseOptionalNumber(point.permissible_use),
      }));
  }

  function serializeEfficiencyPointsForReplace() {
    return efficiencyPoints
      .filter((point) => !point._pending_delete)
      .map((point) => ({
        airflow: parseOptionalNumber(point.airflow),
        efficiency_centre: parseOptionalNumber(point.efficiency_centre),
        efficiency_lower_end: parseOptionalNumber(point.efficiency_lower_end),
        efficiency_higher_end: parseOptionalNumber(point.efficiency_higher_end),
        permissible_use: parseOptionalNumber(point.permissible_use),
      }));
  }

  function addParameterGroup() {
    parameterGroups = [
      ...parameterGroups,
      createGroupDraft({ group_name: "", parameters: [] }),
    ];
    specificationGroupOpenState = {
      ...specificationGroupOpenState,
      [parameterGroups.length]: true,
    };
  }

  function toggleSpecificationGroup(groupIndex) {
    specificationGroupOpenState = {
      ...specificationGroupOpenState,
      [groupIndex]: !(specificationGroupOpenState[groupIndex] ?? true),
    };
  }

  function setAllSpecificationGroups(nextOpen) {
    specificationGroupOpenState = Object.fromEntries(
      parameterGroups.map((_, index) => [index, nextOpen]),
    );
  }

  function toggleAllSpecificationGroups() {
    const allOpen =
      parameterGroups.length > 0 &&
      parameterGroups.every(
        (_, index) => specificationGroupOpenState[index] ?? true,
      );
    setAllSpecificationGroups(!allOpen);
  }

  function allSpecificationGroupsOpen() {
    return (
      parameterGroups.length === 0 ||
      parameterGroups.every(
        (_, index) => specificationGroupOpenState[index] ?? true,
      )
    );
  }

  function specificationGroupBackgroundColor(groupIndex) {
    return specificationGroupTint(groupIndex).background;
  }

  function specificationGroupBorderColor(groupIndex) {
    return specificationGroupTint(groupIndex).border;
  }

  function specificationParameterCardStyle(groupIndex, pendingDelete = false) {
    if (pendingDelete) return "";
    const tint = specificationGroupTint(groupIndex);
    const background =
      $theme === "dark"
        ? tint.parameterBackgroundDark
        : tint.parameterBackgroundLight;
    return `background-color: ${background}; border-color: ${tint.border};`;
  }

  $: allAccordionsOpen =
    mode === "create"
      ? createCoreDetailsOpen &&
        createProductAttributesOpen &&
        createGroupedSpecificationsOpen &&
        (!isFanAcousticTableVisible() || createFanAcousticTableOpen) &&
        allSpecificationGroupsOpen()
      : mode === "editExisting" && editingProductId !== null
        ? editProductDetailsOpen &&
          editGroupedSpecificationsOpen &&
          (!isFanAcousticTableVisible() || editFanAcousticTableOpen) &&
          editMediaAssetsOpen &&
          editLineManagementOpen &&
          (!productSupportsGraph() || editGraphDataOpen) &&
          allSpecificationGroupsOpen()
        : false;

  function setAllAccordions(nextOpen) {
    if (mode === "create") {
      createCoreDetailsOpen = nextOpen;
      createProductAttributesOpen = nextOpen;
      createGroupedSpecificationsOpen = nextOpen;
      createFanAcousticTableOpen = nextOpen;
    }
    if (mode === "editExisting" && editingProductId !== null) {
      editProductDetailsOpen = nextOpen;
      editGroupedSpecificationsOpen = nextOpen;
      editFanAcousticTableOpen = nextOpen;
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
        : group,
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
        ? {
            ...group,
            parameters: [...group.parameters, createParameterDraft()],
          }
        : group,
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
                : parameter,
            ),
          }
        : group,
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
          value_string: valueType === "string" ? parameter.value_string : "",
          value_number: valueType === "number" ? parameter.value_number : "",
          unit: valueType === "number" ? parameter.unit : "",
          custom_unit: valueType === "number" ? parameter.custom_unit : "",
        };
      });
      return { ...group, parameters };
    });
  }

  function updateParameterUnit(groupIndex, parameterIndex, unitValue) {
    parameterGroups = parameterGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      const parameters = group.parameters.map((parameter, innerIndex) => {
        if (innerIndex !== parameterIndex) return parameter;
        return {
          ...parameter,
          unit: unitValue,
          custom_unit: unitValue === "__custom__" ? parameter.custom_unit : "",
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
              parameter.value_type === "number"
                ? (parameter.unit === "__custom__"
                    ? parameter.custom_unit
                    : parameter.unit) || null
                : null;
            return {
              parameter_name: parameter.parameter_name.trim(),
              sort_order: parameterIndex,
              value_string:
                parameter.value_type === "string"
                  ? parameter.value_string.trim() || null
                  : null,
              value_number:
                parameter.value_type === "number" &&
                parameter.value_number !== "" &&
                parameter.value_number != null
                  ? Number(parameter.value_number)
                  : null,
              unit:
                unitValue && String(unitValue).trim()
                  ? String(unitValue).trim()
                  : null,
            };
          }),
      }));
  }

  function normalizeOptionalColor(value) {
    const normalized = String(value ?? "").trim();
    return normalized || "";
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
    return typeof id === "number" && id > 0;
  }

  function isPersistedRpmLineId(id) {
    return typeof id === "number" && id > 0;
  }

  function resetMapPointSaveProgress() {
    mapPointSaveCompleted = 0;
    mapPointSaveProgressMessage = "";
    mapPointSaveRenderChain = Promise.resolve();
    mapPointSaveProgress = {
      completed: 0,
      total: 0,
      label: "",
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
      label: total ? "Preparing changes..." : "No changes to save.",
    };
    mapPointSaveProgressMessage = total
      ? "Saving map points: 0 / " + total + " - Preparing changes..."
      : "";
    await waitForProgressPaint();
  }

  async function advanceMapPointSave(label) {
    mapPointSaveCompleted = Math.min(
      mapPointSaveCompleted + 1,
      mapPointSaveProgress.total,
    );
    const nextCompleted = mapPointSaveCompleted;
    const nextTotal = mapPointSaveProgress.total;
    const nextLabel = label;

    mapPointSaveRenderChain = mapPointSaveRenderChain.then(async () => {
      mapPointSaveProgress = {
        ...mapPointSaveProgress,
        completed: nextCompleted,
        label: nextLabel,
      };
      mapPointSaveProgressMessage = `Saving map points: ${nextCompleted} / ${nextTotal}${nextLabel ? ` - ${nextLabel}` : ""}`;
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

  function isGraphCsvImportSave() {
    return (
      graphCsvImportSource.rows.length &&
      graphCsvImportSource.productId === selectedProductId
    );
  }

  function compareMapPointValues(a, b, column, direction) {
    const aValue = parseOptionalNumber(a?.[column]);
    const bValue = parseOptionalNumber(b?.[column]);
    const aNumber = aValue ?? Number.NEGATIVE_INFINITY;
    const bNumber = bValue ?? Number.NEGATIVE_INFINITY;
    return direction === "asc" ? aNumber - bNumber : bNumber - aNumber;
  }

  function applyRpmPointSort(points) {
    if (!rpmPointSort.column) return points;
    return [...points].sort((a, b) =>
      compareMapPointValues(a, b, rpmPointSort.column, rpmPointSort.direction),
    );
  }

  function hydrateRpmPointsWithLineValues(points, lines) {
    const rpmByLineId = new Map(
      (lines ?? [])
        .map((line) => [Number(line?.id), Number(line?.rpm)])
        .filter(([, rpm]) => Number.isFinite(rpm)),
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
        direction: rpmPointSort.direction === "asc" ? "desc" : "asc",
      };
    } else {
      rpmPointSort = { column, direction: "asc" };
    }
    rpmPoints = applyRpmPointSort(rpmPoints);
  }

  function sortIndicator(column) {
    if (rpmPointSort.column !== column) return "Sort";
    return rpmPointSort.direction === "asc" ? "Asc" : "Desc";
  }

  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
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
      .map((row) => row.split(",").map((cell) => cell.trim()));
  }

  function normalizeGraphCsvCell(value) {
    return String(value ?? "").trim() === "#N/A" ? "" : value;
  }

  function normalizeGraphCsvHeader(header) {
    const trimmedHeader = String(header ?? "").trim();
    if (!trimmedHeader) return trimmedHeader;

    const lowerHeader = trimmedHeader.toLowerCase();
    if (lowerHeader === "airflow (l/s)") {
      return "airflow_l_s";
    }
    if (lowerHeader === "green system") {
      return "efficiency_centre";
    }
    if (lowerHeader === "upper red curve") {
      return "efficiency_higher_end";
    }
    if (lowerHeader === "lower red curve") {
      return "efficiency_lower_end";
    }
    if (lowerHeader === "red high") {
      return "efficiency_higher_end";
    }
    if (lowerHeader === "red low") {
      return "efficiency_lower_end";
    }
    if (lowerHeader === "grey curve") {
      return "permissible_use";
    }
    if (
      lowerHeader.startsWith("efficiency_") ||
      lowerHeader === "permissible_use" ||
      lowerHeader.startsWith("system_")
    ) {
      return trimmedHeader;
    }

    if (lowerHeader.includes("rpm")) {
      const compactHeader = trimmedHeader.replace(/\s+/g, "");
      return lowerHeader.startsWith("pressure_")
        ? compactHeader
        : `pressure_${compactHeader}`;
    }

    return trimmedHeader;
  }

  function normalizeGraphCsvRows(rows) {
    return rows.map((row, rowIndex) =>
      row.map((cell, cellIndex) =>
        rowIndex === 0
          ? normalizeGraphCsvHeader(cell)
          : normalizeGraphCsvCell(cell),
      ),
    );
  }

  function buildGraphCsvPreview(rows, fileName) {
    if (!Array.isArray(rows) || !rows.length) return null;

    const normalizedRows = normalizeGraphCsvRows(rows);
    const replacedNaNCount = rows
      .slice(1)
      .reduce(
        (count, row) =>
          count +
          row.reduce(
            (rowCount, cell) =>
              rowCount + (String(cell ?? "").trim() === "#N/A" ? 1 : 0),
            0,
          ),
        0,
      );
    const headerPairs = rows[0].map((originalHeader, index) => ({
      original: String(originalHeader ?? "").trim(),
      normalized: String(normalizedRows[0]?.[index] ?? "").trim(),
    }));

    return {
      fileName,
      rowCount: Math.max(rows.length - 1, 0),
      replacedNaNCount,
      headerPairs,
      changedHeaders: headerPairs.filter(
        (pair) => pair.original !== pair.normalized,
      ),
    };
  }

  function formatGraphCsvLineToken(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value ?? "")
        .trim()
        .toLowerCase();
    }
    return `${numericValue}`
      .replace(/\.0+$/, "")
      .replace(/(\.\d*?[1-9])0+$/, "$1");
  }

  function graphCsvPressureColumnName(value) {
    return `pressure_${formatGraphCsvLineToken(value)}rpm`;
  }

  function parseGraphCsvLineToken(header) {
    const match = String(header ?? "")
      .trim()
      .toLowerCase()
      .match(/^pressure_(.+?)(?:rpm)?$/);
    if (!match) return null;
    const rpm = Math.round(parseFloat(match[1]));
    return Number.isFinite(rpm) ? rpm : null;
  }

  function parseGraphCsvNumber(value, columnName) {
    if (value == null || String(value).trim() === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(
        `Column "${columnName}" contains a non-numeric value: "${value}".`,
      );
    }
    return parsed;
  }

  function parseGraphCsvInteger(value, columnName) {
    const parsed = parseGraphCsvNumber(value, columnName);
    return parsed == null ? null : Math.round(parsed);
  }

  function normalizeGraphCsvDownsampleCount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error("The downsample count must be a whole number.");
    }
    const count = parsed;
    if (!Number.isInteger(count) || count < 2) {
      throw new Error("The downsample count must be a whole number of at least 2.");
    }
    return count;
  }

  function interpolateGraphCsvValue(points, axisValue) {
    if (!points.length) return null;
    if (points.length === 1) return points[0].value;

    if (axisValue <= points[0].axis) return points[0].value;
    if (axisValue >= points[points.length - 1].axis)
      return points[points.length - 1].value;

    for (let index = 0; index < points.length - 1; index += 1) {
      const left = points[index];
      const right = points[index + 1];
      if (axisValue < left.axis || axisValue > right.axis) continue;
      const span = right.axis - left.axis;
      if (span === 0) return right.value;
      const ratio = (axisValue - left.axis) / span;
      return left.value + (right.value - left.value) * ratio;
    }

    return points[points.length - 1].value;
  }

  function buildInterpolatedGraphCsvSeries(
    points,
    axisKey = "airflow",
    valueKey = "pressure",
    step = 1,
  ) {
    const numericPoints = (points ?? [])
      .map((point) => ({
        point,
        axis: Number(point?.[axisKey]),
        value: Number(point?.[valueKey]),
      }))
      .filter(
        ({ axis, value }) => Number.isFinite(axis) && Number.isFinite(value),
      )
      .sort((a, b) => a.axis - b.axis);

    if (!numericPoints.length) {
      return [];
    }

    if (numericPoints.length === 1) {
      const singlePoint = numericPoints[0].point;
      return [
        {
          ...singlePoint,
          [axisKey]: Math.round(numericPoints[0].axis),
          [valueKey]: Math.round(numericPoints[0].value),
        },
      ];
    }

    const numericStep = Number(step);
    const safeStep =
      Number.isFinite(numericStep) && numericStep > 0 ? numericStep : 1;
    const minAxis = numericPoints[0].axis;
    const maxAxis = numericPoints[numericPoints.length - 1].axis;
    const sampledPoints = [];

    for (let axis = minAxis; axis <= maxAxis; axis += safeStep) {
      const interpolatedValue = interpolateGraphCsvValue(numericPoints, axis);
      if (!Number.isFinite(interpolatedValue)) {
        continue;
      }
      sampledPoints.push({
        ...numericPoints[0].point,
        [axisKey]: Math.round(axis * 1000) / 1000,
        [valueKey]: Math.round(interpolatedValue),
      });
    }

    const lastSample = sampledPoints[sampledPoints.length - 1];
    if (
      lastSample &&
      Number(lastSample[axisKey]) !== Math.round(maxAxis * 1000) / 1000
    ) {
      const interpolatedValue = interpolateGraphCsvValue(numericPoints, maxAxis);
      if (!Number.isFinite(interpolatedValue)) {
        return sampledPoints;
      }
      sampledPoints.push({
        ...numericPoints[0].point,
        [axisKey]: Math.round(maxAxis * 1000) / 1000,
        [valueKey]: Math.round(interpolatedValue),
      });
    }

    return sampledPoints;
  }

  function buildHighResolutionHighestRpmLine(
    rpmLinesToCheck,
    rpmPointsToCheck,
    step = 1,
  ) {
    const highestRpmLine = [...(rpmLinesToCheck ?? [])]
      .map((line) => ({
        id: Number(line?.id),
        rpm: Number(line?.rpm),
      }))
      .filter(({ id, rpm }) => Number.isFinite(id) && Number.isFinite(rpm))
      .sort((a, b) => b.rpm - a.rpm)[0];

    if (!highestRpmLine) return [];

    const highestRpmLinePoints = (rpmPointsToCheck ?? [])
      .filter(
        (point) => Number(point?.rpm_line_id) === Number(highestRpmLine.id),
      )
      .map((point) => ({
        airflow: Number(point?.airflow),
        pressure: Number(point?.pressure),
      }))
      .filter(
        ({ airflow, pressure }) =>
          Number.isFinite(airflow) && Number.isFinite(pressure),
      )
      .sort((a, b) => a.airflow - b.airflow);

    return buildInterpolatedGraphCsvSeries(
      highestRpmLinePoints,
      "airflow",
      "pressure",
      step,
    );
  }

  function pressureAtAirflow(linePoints, airflow) {
    const numericAirflow = Number(airflow);
    if (!Number.isFinite(numericAirflow)) return null;

    const chartPoints = (linePoints ?? [])
      .map((point) => ({
        axis: Number(point?.airflow),
        value: Number(point?.pressure),
      }))
      .filter(
        ({ axis, value }) => Number.isFinite(axis) && Number.isFinite(value),
      )
      .sort((a, b) => a.axis - b.axis);

    if (!chartPoints.length) return null;
    return interpolateGraphCsvValue(
      buildSmoothedCurveSamples(chartPoints.map(p => [p.axis, p.value]))
        .map(([axis, value]) => ({ axis, value })), numericAirflow);
  }

  function solveOverlayScaleFactorForPolyline(terminalPoint, linePoints) {
    const terminalAirflow = Number(terminalPoint?.airflow);
    const terminalValue = Number(terminalPoint?.value);
    if (
      !Number.isFinite(terminalAirflow) ||
      !Number.isFinite(terminalValue) ||
      terminalAirflow <= 0 ||
      terminalValue <= 0
    ) {
      return null;
    }

    const chartPoints = (linePoints ?? [])
      .map((point) => ({
        axis: Number(point?.airflow),
        value: Number(point?.pressure),
      }))
      .filter(
        ({ axis, value }) => Number.isFinite(axis) && Number.isFinite(value),
      )
      .sort((a, b) => a.axis - b.axis);

    if (chartPoints.length < 2) return null;

    const candidates = [];
    for (let index = 0; index < chartPoints.length - 1; index += 1) {
      const left = chartPoints[index];
      const right = chartPoints[index + 1];
      if (right.axis <= left.axis) continue;

      const slope = (right.value - left.value) / (right.axis - left.axis);
      const denominator = terminalValue - slope * terminalAirflow;
      if (Math.abs(denominator) < 1e-12) continue;

      const scaleFactor = (left.value - slope * left.axis) / denominator;
      if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) continue;

      const scaledAirflow = terminalAirflow * scaleFactor;
      if (scaledAirflow < left.axis - 1e-9 || scaledAirflow > right.axis + 1e-9) {
        continue;
      }

      const targetPressure = pressureAtAirflow(linePoints, scaledAirflow);
      if (!Number.isFinite(targetPressure)) continue;

      const residual = Math.abs(targetPressure - terminalValue * scaleFactor);
      candidates.push({
        residual,
        distanceFromOne: Math.abs(scaleFactor - 1),
        scaleFactor,
      });
    }

    if (!candidates.length) return null;
    candidates.sort(
      (left, right) =>
        left.residual - right.residual ||
        left.distanceFromOne - right.distanceFromOne ||
        left.scaleFactor - right.scaleFactor,
    );
    return candidates[0].scaleFactor;
  }

  function distanceToPolyline(point, linePoints) {
    const numericPoint = {
      airflow: Number(point?.airflow),
      pressure: Number(point?.pressure),
    };

    if (
      !Number.isFinite(numericPoint.airflow) ||
      !Number.isFinite(numericPoint.pressure)
    ) {
      return Number.POSITIVE_INFINITY;
    }

    const numericLinePoints = (linePoints ?? [])
      .map((linePoint) => ({
        airflow: Number(linePoint?.airflow),
        pressure: Number(linePoint?.pressure),
      }))
      .filter(
        ({ airflow, pressure }) =>
          Number.isFinite(airflow) && Number.isFinite(pressure),
      )
      .sort((a, b) => a.airflow - b.airflow);

    if (!numericLinePoints.length) {
      return Number.POSITIVE_INFINITY;
    }

    if (numericLinePoints.length === 1) {
      const onlyPoint = numericLinePoints[0];
      return Math.hypot(
        numericPoint.airflow - onlyPoint.airflow,
        numericPoint.pressure - onlyPoint.pressure,
      );
    }

    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < numericLinePoints.length - 1; index += 1) {
      const left = numericLinePoints[index];
      const right = numericLinePoints[index + 1];
      const deltaAirflow = right.airflow - left.airflow;
      const deltaPressure = right.pressure - left.pressure;
      const segmentLengthSquared =
        deltaAirflow * deltaAirflow + deltaPressure * deltaPressure;

      let projectionRatio = 0;
      if (segmentLengthSquared > 0) {
        projectionRatio =
          ((numericPoint.airflow - left.airflow) * deltaAirflow +
            (numericPoint.pressure - left.pressure) * deltaPressure) /
          segmentLengthSquared;
      }

      const clampedRatio = Math.min(1, Math.max(0, projectionRatio));
      const projectedAirflow = left.airflow + deltaAirflow * clampedRatio;
      const projectedPressure = left.pressure + deltaPressure * clampedRatio;
      const distance = Math.hypot(
        numericPoint.airflow - projectedAirflow,
        numericPoint.pressure - projectedPressure,
      );

      if (distance < bestDistance) {
        bestDistance = distance;
      }
    }

    return bestDistance;
  }

  function getChartSpaceAxisExtents(linePoints) {
    const currentOption = chartInstance?.getOption?.();
    const xAxis = Array.isArray(currentOption?.xAxis)
      ? currentOption.xAxis[0]
      : currentOption?.xAxis;
    const yAxis = Array.isArray(currentOption?.yAxis)
      ? currentOption.yAxis
      : [];

    const fallbackFlowMax = Math.max(
      1,
      ...(linePoints ?? []).map((point) => Number(point?.airflow)).filter(Number.isFinite),
    );
    const fallbackPressureMax = Math.max(
      1,
      ...(linePoints ?? []).map((point) => Number(point?.pressure)).filter(Number.isFinite),
    );

    const flowMax = Number.isFinite(Number(xAxis?.max))
      ? Number(xAxis.max)
      : fallbackFlowMax;
    const pressureMax = Number.isFinite(Number(yAxis?.[0]?.max))
      ? Number(yAxis[0].max)
      : fallbackPressureMax;
    const overlayMax = pressureMax;

    return {
      flowMax: flowMax > 0 ? flowMax : fallbackFlowMax,
      pressureMax: pressureMax > 0 ? pressureMax : fallbackPressureMax,
      overlayMax: overlayMax > 0 ? overlayMax : 100,
    };
  }

  function toChartSpacePoint(point, axisIndex, axisExtents) {
    const airflow = Number(point?.airflow);
    const rawValue =
      point?.pressure ?? point?.value ?? point?.y ?? point?.efficiency ?? null;
    const value = Number(rawValue);

    if (!Number.isFinite(airflow) || !Number.isFinite(value)) {
      return null;
    }

    if (chartInstance?.convertToPixel) {
      const pixel = chartInstance.convertToPixel(
        { xAxisIndex: 0, yAxisIndex: axisIndex },
        [airflow, value],
      );
      if (
        Array.isArray(pixel) &&
        Number.isFinite(Number(pixel?.[0])) &&
        Number.isFinite(Number(pixel?.[1]))
      ) {
        return { x: Number(pixel[0]), y: Number(pixel[1]) };
      }
    }

    const axisMax = axisIndex === 1 ? axisExtents.overlayMax : axisExtents.pressureMax;
    return {
      x: airflow / axisExtents.flowMax,
      y: value / axisMax,
    };
  }

  function chartSpaceDistanceToPolyline(
    point,
    linePoints,
    pointAxisIndex,
    lineAxisIndex,
    axisExtents,
  ) {
    const chartPoint = toChartSpacePoint(point, pointAxisIndex, axisExtents);
    if (!chartPoint) return Number.POSITIVE_INFINITY;

    const chartLinePoints = (linePoints ?? [])
      .map((linePoint) => toChartSpacePoint(linePoint, lineAxisIndex, axisExtents))
      .filter(Boolean);

    if (!chartLinePoints.length) {
      return Number.POSITIVE_INFINITY;
    }

    if (chartLinePoints.length === 1) {
      return Math.hypot(
        chartPoint.x - chartLinePoints[0].x,
        chartPoint.y - chartLinePoints[0].y,
      );
    }

    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < chartLinePoints.length - 1; index += 1) {
      const left = chartLinePoints[index];
      const right = chartLinePoints[index + 1];
      const deltaX = right.x - left.x;
      const deltaY = right.y - left.y;
      const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;

      let projectionRatio = 0;
      if (segmentLengthSquared > 0) {
        projectionRatio =
          ((chartPoint.x - left.x) * deltaX + (chartPoint.y - left.y) * deltaY) /
          segmentLengthSquared;
      }

      const clampedRatio = Math.min(1, Math.max(0, projectionRatio));
      const projectedX = left.x + deltaX * clampedRatio;
      const projectedY = left.y + deltaY * clampedRatio;
      const distance = Math.hypot(chartPoint.x - projectedX, chartPoint.y - projectedY);

      if (distance < bestDistance) {
        bestDistance = distance;
      }
    }

    return bestDistance;
  }

  function downsampleGraphCsvSeries(points, axisKey = "airflow", valueKey = "pressure", targetCount = 5) {
    return simplifyCurve(points, axisKey, valueKey, targetCount);
  }

  function downsampleGraphCsvOverlayPoints(points, valueKeys, targetCount = 5) {
    const mergedPoints = new Map();

    for (const valueKey of valueKeys) {
      const seriesPoints = (points ?? []).filter(
        (point) => point?.[valueKey] != null,
      );
      const sampledPoints = downsampleGraphCsvSeries(
        seriesPoints,
        "airflow",
        valueKey,
        targetCount,
        0,
      );
      const peakPoint = seriesPoints.reduce((best, current) => {
        const currentAirflow = Number(current?.airflow);
        const currentValue = Number(current?.[valueKey]);
        if (
          !Number.isFinite(currentAirflow) ||
          !Number.isFinite(currentValue)
        ) {
          return best;
        }
        if (!best) return current;
        const bestValue = Number(best?.[valueKey]);
        if (!Number.isFinite(bestValue) || currentValue > bestValue) {
          return current;
        }
        return best;
      }, null);
      if (
        peakPoint &&
        !sampledPoints.some(
          (sampledPoint) =>
            Number(sampledPoint?.airflow) === Number(peakPoint?.airflow),
        )
      ) {
        sampledPoints.push({ ...peakPoint });
      }
      for (const sampledPoint of sampledPoints) {
        const airflow = Number(sampledPoint?.airflow);
        const value = Number(sampledPoint?.[valueKey]);
        if (!Number.isFinite(airflow) || !Number.isFinite(value)) continue;

        const mergeKey = `${airflow}`;
        if (!mergedPoints.has(mergeKey)) {
          mergedPoints.set(mergeKey, {
            id: createTempPointId(),
            product_id: selectedProductId,
            airflow,
            efficiency_centre: null,
            efficiency_lower_end: null,
            efficiency_higher_end: null,
            permissible_use: null,
          });
        }

        mergedPoints.get(mergeKey)[valueKey] = value;
      }
    }

    return [...mergedPoints.values()].sort(
      (a, b) => Number(a.airflow) - Number(b.airflow),
    );
  }

  function normaliseGraphPoint(point, axisKey = "airflow", valueKey = "pressure") {
    const axis = Number(point?.[axisKey]);
    const value = Number(point?.[valueKey]);
    if (!Number.isFinite(axis) || !Number.isFinite(value)) return null;
    return { axis, value };
  }

  function normalisedGraphSeries(points, axisKey = "airflow", valueKey = "pressure") {
    return (points ?? [])
      .map((point) => normaliseGraphPoint(point, axisKey, valueKey))
      .filter(Boolean)
      .sort((a, b) => a.axis - b.axis);
  }

  function closestRpmLineErrorAtScaledTerminal({
    rpmLinePoints,
    terminalPoint,
    scaleFactor,
  }) {
    const scaledPoint = {
      airflow: terminalPoint.airflow * scaleFactor,
      pressure: terminalPoint.value * scaleFactor,
    };
    const targetDistance = distanceToPolyline(scaledPoint, rpmLinePoints);

    if (!Number.isFinite(targetDistance)) {
      return Number.POSITIVE_INFINITY;
    }

    return targetDistance;
  }

  function refineOverlayScaleFactorRecursively({
    rpmLinePoints,
    terminalPoint,
    currentScaleFactor,
    stepFactor,
    remainingDepth = 14,
    tolerance = 0.5,
  }) {
    if (
      !Number.isFinite(currentScaleFactor) ||
      !Number.isFinite(stepFactor) ||
      stepFactor <= 0 ||
      !terminalPoint
    ) {
      return null;
    }

    const currentError = closestRpmLineErrorAtScaledTerminal({
      rpmLinePoints,
      terminalPoint,
      scaleFactor: currentScaleFactor,
    });

    if (currentError <= tolerance || remainingDepth <= 0) {
      return currentScaleFactor;
    }

    const smallerScaleFactor = Math.max(0.01, currentScaleFactor - stepFactor);
    const largerScaleFactor = currentScaleFactor + stepFactor;

    const smallerError = closestRpmLineErrorAtScaledTerminal({
      rpmLinePoints,
      terminalPoint,
      scaleFactor: smallerScaleFactor,
    });
    const largerError = closestRpmLineErrorAtScaledTerminal({
      rpmLinePoints,
      terminalPoint,
      scaleFactor: largerScaleFactor,
    });

    let nextScaleFactor = currentScaleFactor;
    let nextError = currentError;

    if (smallerError < nextError) {
      nextScaleFactor = smallerScaleFactor;
      nextError = smallerError;
    }
    if (largerError < nextError) {
      nextScaleFactor = largerScaleFactor;
      nextError = largerError;
    }

    return refineOverlayScaleFactorRecursively({
      rpmLinePoints,
      terminalPoint,
      currentScaleFactor: nextScaleFactor,
      stepFactor: stepFactor / 2,
      remainingDepth: remainingDepth - 1,
      tolerance,
    });
  }

  function estimateOverlayScaleFactorBounds(terminalPoint, rpmLinePoints) {
    const rpmSeries = normalisedGraphSeries(rpmLinePoints, "airflow", "pressure");
    if (!terminalPoint || !rpmSeries.length) {
      return { minScale: 0.1, maxScale: 3 };
    }

    const maxRpmAirflow = rpmSeries[rpmSeries.length - 1].axis;
    const maxRpmPressure = Math.max(...rpmSeries.map((point) => point.value));
    const airflowLimit =
      terminalPoint.airflow > 0 ? maxRpmAirflow / terminalPoint.airflow : 3;
    const pressureLimit =
      terminalPoint.value > 0 ? maxRpmPressure / terminalPoint.value : 3;
    const maxScale = Math.max(
      0.2,
      Math.min(5, Math.max(airflowLimit, pressureLimit) * 1.1),
    );

    return { minScale: 0.05, maxScale };
  }

  function findBestOverlayScaleFactor({
    terminalPoint,
    rpmLinePoints,
    coarseSamples = 240,
    recursiveDepth = 14,
    tolerance = 0.5,
  }) {
    if (!terminalPoint || !rpmLinePoints?.length) return null;

    const exactScaleFactor = solveOverlayScaleFactorForPolyline(
      terminalPoint,
      rpmLinePoints,
    );
    if (Number.isFinite(exactScaleFactor)) {
      return Math.max(0.01, exactScaleFactor);
    }

    const { minScale, maxScale } = estimateOverlayScaleFactorBounds(
      terminalPoint,
      rpmLinePoints,
    );

    let bestScaleFactor = 1;
    let bestError = Number.POSITIVE_INFINITY;

    for (let index = 0; index < coarseSamples; index += 1) {
      const ratio = coarseSamples === 1 ? 0 : index / (coarseSamples - 1);
      const scaleFactor = minScale + (maxScale - minScale) * ratio;
      const error = closestRpmLineErrorAtScaledTerminal({
        rpmLinePoints,
        terminalPoint,
        scaleFactor,
      });

      if (error < bestError) {
        bestError = error;
        bestScaleFactor = scaleFactor;
      }
    }

    if (!Number.isFinite(bestError)) return null;

    const coarseStep =
      coarseSamples > 1 ? (maxScale - minScale) / (coarseSamples - 1) : 0.1;

    return refineOverlayScaleFactorRecursively({
      rpmLinePoints,
      terminalPoint,
      currentScaleFactor: bestScaleFactor,
      stepFactor: coarseStep,
      remainingDepth: recursiveDepth,
      tolerance,
    });
  }

  function applyLineByLineOverlayScaling(
    points,
    rpmLinesToCheck,
    rpmPointsToCheck,
  ) {
    const validPointsByLineId = new Map();
    for (const point of rpmPointsToCheck ?? []) {
      const lineId = Number(point?.rpm_line_id);
      const airflow = Number(point?.airflow);
      const pressure = Number(point?.pressure);
      if (
        !Number.isFinite(lineId) ||
        !Number.isFinite(airflow) ||
        !Number.isFinite(pressure)
      ) {
        continue;
      }
      if (!validPointsByLineId.has(lineId)) validPointsByLineId.set(lineId, []);
      validPointsByLineId.get(lineId).push({ airflow, pressure });
    }

    // A line entry may exist without a drawable curve, for example after a
    // product is duplicated. Never let that empty entry block alignment to
    // the highest RPM curve that actually exists on the graph.
    const highestRpmLine = [...(rpmLinesToCheck ?? [])]
      .map((line) => ({
        id: Number(line?.id),
        rpm: Number(line?.rpm),
      }))
      .filter(
        ({ id, rpm }) =>
          Number.isFinite(id) &&
          Number.isFinite(rpm) &&
          (validPointsByLineId.get(id)?.length ?? 0) >= 2,
      )
      .sort((a, b) => b.rpm - a.rpm)[0];

    const highResolutionRpmLinePoints = highestRpmLine
      ? [...validPointsByLineId.get(highestRpmLine.id)].sort(
          (a, b) => a.airflow - b.airflow,
        )
      : [];

    const overlayKeys = [
      "efficiency_centre",
      "efficiency_lower_end",
      "efficiency_higher_end",
      "permissible_use",
    ];

    const nextPoints = (points ?? []).map((point) => ({ ...point }));

    if (highResolutionRpmLinePoints.length < 2) {
      return nextPoints;
    }

  function findBestScaleFactor(terminalPoint) {
      const terminalAirflow = Number(terminalPoint?.airflow);
      const terminalValue = Number(terminalPoint?.value);
      if (
        !Number.isFinite(terminalAirflow) ||
        !Number.isFinite(terminalValue) ||
        terminalAirflow <= 0 ||
        terminalValue <= 0
      ) {
        return null;
      }

      const targetPressure = pressureAtAirflow(
        highResolutionRpmLinePoints,
        terminalAirflow,
      );
      if (!Number.isFinite(targetPressure)) {
        return null;
      }

      const scaleFactor = targetPressure / terminalValue;
      if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
        return null;
      }

      return Math.max(0.01, scaleFactor);
    }

    for (const overlayKey of overlayKeys) {
      const overlayLinePoints = nextPoints
        .map((point) => {
          const rawAirflow = point?.airflow;
          const rawValue = point?.[overlayKey];

          if (rawAirflow === "" || rawAirflow == null) return null;
          if (rawValue === "" || rawValue == null) return null;

          const airflow = Number(rawAirflow);
          const value = Number(rawValue);

          if (!Number.isFinite(airflow) || !Number.isFinite(value)) return null;

          return { airflow, value, point };
        })
        .filter(Boolean)
        .sort((a, b) => a.airflow - b.airflow);

      if (!overlayLinePoints.length) continue;

      const scaleSourcePoint = overlayLinePoints.reduce((best, current) => {
        if (!best) return current;
        if (current.value > best.value) return current;
        if (current.value < best.value) return best;
        return current.airflow > best.airflow ? current : best;
      }, null);
      const scaleFactor = findBestScaleFactor(scaleSourcePoint);
      if (!Number.isFinite(scaleFactor)) continue;

      for (const point of nextPoints) {
        const rawValue = point?.[overlayKey];
        if (rawValue === "" || rawValue == null) continue;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) continue;
        point[overlayKey] = value * scaleFactor;
      }
    }

    return nextPoints;
  }

  function buildGraphCsv() {
    const pressureColumns = [
      ...new Map(
        [...rpmLines, ...rpmPoints]
          .map((item) => {
            const rpm = Number(item?.rpm);
            if (!Number.isFinite(rpm)) return null;
            return [formatGraphCsvLineToken(rpm), rpm];
          })
          .filter(Boolean),
      ).values(),
    ].sort((a, b) => a - b);

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
      if (
        !Number.isFinite(airflow) ||
        !Number.isFinite(rpm) ||
        !Number.isFinite(pressure)
      )
        continue;
      ensureRow(airflow)[graphCsvPressureColumnName(rpm)] = pressure;
    }

    for (const point of efficiencyPoints) {
      const airflow = Number(point?.airflow);
      if (!Number.isFinite(airflow)) continue;
      const row = ensureRow(airflow);
      for (const key of ["efficiency_centre", "efficiency_lower_end", "efficiency_higher_end", "permissible_use"]) {
        if (point[key] != null && point[key] !== "") row[key] = point[key];
      }
    }

    const header = [
      "airflow_l_s",
      ...pressureColumns.map((rpm) => graphCsvPressureColumnName(rpm)),
    ];
    if (productSupportsGraphOverlays()) {
      header.push(
        "efficiency_centre",
        "efficiency_lower_end",
        "efficiency_higher_end",
        "permissible_use",
      );
    }

    const rows = [...rowsByAirflow.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => header.map((column) => row[column] ?? "").join(","));

    return [header.join(","), ...rows].join("\n");
  }

  function graphCsvPlaceholder() {
    if (productSupportsGraphOverlays()) {
      return `Example columns: airflow_l_s, pressure_650rpm, pressure_813rpm, efficiency_centre, permissible_use`;
    }
    return `Example columns: airflow_l_s, pressure_650rpm, pressure_813rpm`;
  }

  function formatFanAcousticCsvValue(value) {
    if (value === "" || value == null) return "";
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return String(value).trim();
    }
    return `${numericValue}`
      .replace(/\.0+$/, "")
      .replace(/(\.\d*?[1-9])0+$/, "$1");
  }

  function buildFanAcousticCsv() {
    const sourceTable =
      fanAcousticTable || createFanAcousticTableDraft({}, rpmLines);
    const soundPowerColumns = normalizeFanAcousticColumns(
      sourceTable.sound_power_columns ??
        FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS,
    );
    const header = [
      "speed_rpm",
      "peak_pressure_pa",
      "peak_power_kw",
      "running_frequency_hz",
      "sound_pressure_db_3m",
      ...soundPowerColumns,
    ];

    const rows = (sourceTable.rows ?? []).map((row) =>
      [
        row.speed_rpm,
        row.peak_pressure_pa,
        row.peak_power_kw,
        row.running_frequency_hz,
        row.sound_pressure_db_3m,
        ...soundPowerColumns.map((column) => row.sound_power_levels?.[column]),
      ]
        .map(formatFanAcousticCsvValue)
        .join(","),
    );

    return [header.join(","), ...rows].join("\n");
  }

  function fanAcousticCsvPlaceholder() {
    return `Example columns: speed_rpm, peak_pressure_pa, peak_power_kw, running_frequency_hz, sound_pressure_db_3m, 63, 125, 250`;
  }

  function buildImportedFanAcousticState(rows) {
    const [headerRow, ...dataRows] = rows;
    const normalizedHeaders = headerRow.map((header) =>
      String(header ?? "").trim(),
    );
    const requiredHeaders = [
      "speed_rpm",
      "peak_pressure_pa",
      "peak_power_kw",
      "running_frequency_hz",
      "sound_pressure_db_3m",
    ];

    for (let index = 0; index < requiredHeaders.length; index += 1) {
      if (
        (normalizedHeaders[index] ?? "").toLowerCase() !==
        requiredHeaders[index]
      ) {
        throw new Error(
          `The acoustic CSV must start with "${requiredHeaders[index]}" and follow the fixed column order.`,
        );
      }
    }

    const soundPowerColumns = normalizedHeaders
      .slice(requiredHeaders.length)
      .filter(Boolean);
    const importedRows = dataRows.map((row, rowIndex) => {
      if (row.length < requiredHeaders.length) {
        throw new Error(
          `Row ${rowIndex + 2} is missing one or more required acoustic values.`,
        );
      }
      const rowData = {
        speed_rpm: parseGraphCsvNumber(row[0], normalizedHeaders[0]),
        peak_pressure_pa: parseGraphCsvNumber(row[1], normalizedHeaders[1]),
        peak_power_kw: parseGraphCsvNumber(row[2], normalizedHeaders[2]),
        running_frequency_hz: parseGraphCsvNumber(row[3], normalizedHeaders[3]),
        sound_pressure_db_3m: parseGraphCsvNumber(row[4], normalizedHeaders[4]),
        sound_power_levels: {},
      };

      soundPowerColumns.forEach((column, columnOffset) => {
        const value = row[requiredHeaders.length + columnOffset];
        rowData.sound_power_levels[column] = parseGraphCsvNumber(value, column);
      });
      return rowData;
    });

    return createFanAcousticTableDraft(
      {
        sound_power_columns: soundPowerColumns.length
          ? soundPowerColumns
          : FAN_ACOUSTIC_DEFAULT_SOUND_POWER_COLUMNS,
        rows: importedRows,
      },
      rpmLines,
    );
  }

  async function applyImportedFanAcousticCsvText(
    text,
    fileName = "fan-acoustic-data.csv",
  ) {
    fanAcousticCsvError = "";
    if (!isFanAcousticTableVisible()) {
      fanAcousticCsvError = "Select a fan product first.";
      return;
    }

    const rows = parseCsvRows(text);
    if (rows.length < 2) {
      fanAcousticCsvError =
        "Choose a fan acoustic CSV file with a header row and at least one data row.";
      return;
    }

    try {
      fanAcousticTable = buildImportedFanAcousticState(rows);
      fanAcousticCsvFileName = fileName;
      addSuccess(
        `Loaded fan acoustic CSV from ${fileName}. Review the table, then save the product.`,
      );
    } catch (e) {
      fanAcousticCsvError = e.message;
    }
  }

  async function handleFanAcousticCsvFileChange(event) {
    fanAcousticCsvError = "";
    const file = event.currentTarget?.files?.[0];
    if (!file) {
      fanAcousticCsvFileName = "";
      return;
    }

    try {
      const text = await file.text();
      await applyImportedFanAcousticCsvText(text, file.name);
    } catch (e) {
      fanAcousticCsvError =
        e.message || "Unable to read the selected acoustic CSV file.";
    }
  }

  function clearFanAcousticCsvSelection() {
    fanAcousticCsvError = "";
    fanAcousticCsvFileName = "";
    if (fanAcousticCsvInput) {
      fanAcousticCsvInput.value = "";
    }
  }

  function exportFanAcousticCsv() {
    if (!isFanAcousticTableVisible()) {
      error = "Select a fan product first.";
      return;
    }
    const base = currentProduct
      ? `${currentProduct.model}`.replace(/\s+/g, "_")
      : "product";
    downloadCsv(buildFanAcousticCsv(), `${base}-fan-acoustic-data.csv`);
  }

  onMount(() => {
    function handleBeforeUnload(event) {
      if (!savingMapPoints) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  });

  onDestroy(() => {
    destroyed = true;
    if (graphDragFrame != null) cancelAnimationFrame(graphDragFrame);
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
    }
  });

  beforeNavigate((navigation) => {
    if (!savingMapPoints) return;
    navigation.cancel();
    window.alert(
      "Map points are still being saved. Please wait until the save finishes before leaving this page.",
    );
  });

  function exportGraphCsv() {
    if (!rpmPoints.length && !efficiencyPoints.length) {
      error = "No graph points to export.";
      return;
    }
    const base = currentProduct
      ? `${currentProduct.model}`.replace(/\s+/g, "_")
      : "product";
    downloadCsv(buildGraphCsv(), `${base}-graph-data.csv`);
  }

  function buildImportedGraphState(
    rows,
    {
      downsampleImportedCurves = false,
      downsamplePointCount = 5,
      permissibleUseSourceKey = "efficiency_higher_end",
      permissibleUseMode = productForm.permissible_use_mode || "both",
    } = {},
  ) {
    const [headerRow, ...dataRows] = rows;
    const normalizedHeaders = headerRow.map((header) =>
      String(header ?? "").trim(),
    );
    const airflowHeader = normalizedHeaders[0]?.toLowerCase();
    if (airflowHeader !== "airflow_l_s" && airflowHeader !== "airflow") {
      throw new Error('The first column must be "airflow_l_s".');
    }

    const pressureColumns = [];
    const overlayColumns = new Set([
      "efficiency_centre",
      "efficiency_lower_end",
      "efficiency_higher_end",
      "permissible_use",
    ]);
    for (let index = 1; index < normalizedHeaders.length; index += 1) {
      const header = normalizedHeaders[index];
      const normalizedHeader = header.toLowerCase();
      if (!normalizedHeader) continue;

      if (overlayColumns.has(normalizedHeader)) {
        if (!productSupportsGraphOverlays()) {
          throw new Error(
            `Column "${header}" is only supported for products with graph overlay lines.`,
          );
        }
        continue;
      }

      if (normalizedHeader.startsWith("system_")) {
        throw new Error(
          `Column "${header}" is not supported yet because system curve storage has not been added to this project.`,
        );
      }

      if (normalizedHeader.startsWith("efficiency_")) {
        throw new Error(
          `Column "${header}" is not supported yet because efficiency data is currently stored as shared overlay lines, not per-${graphLineValueLabel().toLowerCase()} curves.`,
        );
      }

      const rpm = parseGraphCsvLineToken(normalizedHeader);
      if (rpm == null) {
        throw new Error(
          `Column "${header}" is not recognised. Use "pressure_<value>rpm" columns plus the supported overlay columns.`,
        );
      }
      pressureColumns.push({ index, header, rpm });
    }

    const nextRpmLines = pressureColumns.map((column, index) => {
      const existingLine = (rpmLines ?? []).find(
        (line) => Number(line?.rpm) === Number(column.rpm),
      );
      return {
        id: createTempRpmLineId(),
        product_id: selectedProductId,
        rpm: column.rpm,
        band_color:
          normalizeOptionalColor(existingLine?.band_color) ||
          RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length],
      };
    });
    const nextRpmLineByKey = new Map(
      nextRpmLines.map((line) => [formatGraphCsvLineToken(line.rpm), line]),
    );

    let previousAirflow = null;
    const seenAirflows = new Set();
    const nextRpmPoints = [];
    const nextEfficiencyPoints = [];

    for (const [rowIndex, row] of dataRows.entries()) {
      const roundedAirflow = parseGraphCsvNumber(row[0], normalizedHeaders[0]);
      if (roundedAirflow == null) {
        throw new Error(`Row ${rowIndex + 2} is missing an airflow_l_s value.`);
      }
      if (seenAirflows.has(roundedAirflow)) {
        throw new Error(
          `Duplicate airflow_l_s value found: ${roundedAirflow}.`,
        );
      }
      if (previousAirflow != null && roundedAirflow <= previousAirflow) {
        throw new Error(
          `airflow_l_s must increase strictly row by row. Row ${rowIndex + 2} is out of order.`,
        );
      }

      seenAirflows.add(roundedAirflow);
      previousAirflow = roundedAirflow;

      for (const column of pressureColumns) {
        const pressure = parseGraphCsvNumber(row[column.index], column.header);
        if (pressure == null) continue;
        const roundedPressure = parseGraphCsvNumber(
          row[column.index],
          column.header,
        );

        const lineKey = formatGraphCsvLineToken(column.rpm);
        const line = nextRpmLineByKey.get(lineKey);

        nextRpmPoints.push({
          id: createTempPointId(),
          product_id: selectedProductId,
          rpm_line_id: line.id,
          rpm: line.rpm,
          airflow: roundedAirflow,
          pressure: roundedPressure,
        });
      }

      if (productSupportsGraphOverlays()) {
        const efficiencyPoint = {
          id: createTempPointId(),
          product_id: selectedProductId,
          airflow: roundedAirflow,
          efficiency_centre: null,
          efficiency_lower_end: null,
          efficiency_higher_end: null,
          permissible_use: null,
        };

        let hasOverlayValue = false;
        for (let index = 1; index < normalizedHeaders.length; index += 1) {
          const normalizedHeader = normalizedHeaders[index]?.toLowerCase();
          if (!overlayColumns.has(normalizedHeader)) continue;
          const value = parseGraphCsvNumber(
            row[index],
            normalizedHeaders[index],
          );
          efficiencyPoint[normalizedHeader] = value;
          if (value != null) hasOverlayValue = true;
        }

        if (hasOverlayValue) {
          nextEfficiencyPoints.push(efficiencyPoint);
        }
      }
    }

    if (
      permissibleUseMode === "dedicated" &&
      (permissibleUseSourceKey === "efficiency_higher_end" ||
        permissibleUseSourceKey === "efficiency_lower_end")
    ) {
      for (const point of nextEfficiencyPoints) {
        if (point.permissible_use != null && point.permissible_use !== "") continue;
        const sourceValue = point?.[permissibleUseSourceKey];
        if (sourceValue == null || sourceValue === "") continue;
        point.permissible_use = sourceValue;
      }
    }

    const scaledEfficiencyPoints = nextEfficiencyPoints;

    const nextRpmPointsByLineId = new Map();
    for (const point of nextRpmPoints) {
      const lineId = Number(point?.rpm_line_id);
      if (!Number.isFinite(lineId)) continue;
      if (!nextRpmPointsByLineId.has(lineId)) {
        nextRpmPointsByLineId.set(lineId, []);
      }
      nextRpmPointsByLineId.get(lineId).push(point);
    }

    const adjustedRpmPoints = downsampleImportedCurves
      ? [...nextRpmPointsByLineId.values()].flatMap((linePoints) =>
          downsampleGraphCsvSeries(
            linePoints,
            "airflow",
            "pressure",
            downsamplePointCount,
          ),
        )
      : nextRpmPoints;
    const adjustedEfficiencyPoints = downsampleImportedCurves
      ? downsampleGraphCsvOverlayPoints(
          scaledEfficiencyPoints,
          [
            "efficiency_centre",
            "efficiency_lower_end",
            "efficiency_higher_end",
            "permissible_use",
          ],
          downsamplePointCount,
        )
      : scaledEfficiencyPoints;
    const importedOverlayPoints = adjustedEfficiencyPoints.map((point) => ({
      ...point,
      airflow: parseOptionalNumber(point.airflow),
      efficiency_centre: parseOptionalNumber(point.efficiency_centre),
      efficiency_lower_end: parseOptionalNumber(point.efficiency_lower_end),
      efficiency_higher_end: parseOptionalNumber(point.efficiency_higher_end),
      permissible_use: parseOptionalNumber(point.permissible_use),
    }));
    const finalEfficiencyPoints = importedOverlayPoints;

    return {
      rpmLines: nextRpmLines.sort((a, b) => Number(a.rpm) - Number(b.rpm)),
      rpmPoints: applyRpmPointSort(adjustedRpmPoints),
      efficiencyPoints: finalEfficiencyPoints,
    };
  }

  function currentGraphState() {
    return { rpmLines, rpmPoints, efficiencyPoints };
  }

  function applyGraphOptions(signature) {
    graphCsvImportSignature = signature;
    try {
      const count = graphCsvDownsampleImportedCurves
        ? normalizeGraphCsvDownsampleCount(graphCsvDownsamplePointCount) : 5;
      const source = graphReference.source(currentGraphState());
      let overlays = source.efficiencyPoints;
      if (productForm.permissible_use_mode === "dedicated") {
        const key = graphCsvUseLowerEfficiencyLine ? "efficiency_lower_end" : "efficiency_higher_end";
        overlays = overlays.map(p => ({ ...p, permissible_use: p.permissible_use ?? p[key] }));
      }
      let points = source.rpmPoints;
      if (graphCsvDownsampleImportedCurves) {
        const groups = new Map();
        for (const point of points) {
          const key = point.rpm_line_id;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(point);
        }
        points = [...groups.values()].flatMap(group => simplifyCurve(group, "airflow", "pressure", count));
      }
      if (graphCsvAutoScaleOverlays) {
        overlays = applyLineByLineOverlayScaling(overlays, source.rpmLines, points);
      }
      if (graphCsvDownsampleImportedCurves) {
        overlays = downsampleGraphCsvOverlayPoints(overlays,
          ["efficiency_centre", "efficiency_lower_end", "efficiency_higher_end", "permissible_use"], count);
      }
      rpmPoints = applyRpmPointSort(points);
      efficiencyPoints = overlays;
      graphReference.displayed(currentGraphState());
      graphCsvError = "";
    } catch (e) { graphCsvError = e.message; }
  }

  function setGraphCsvImportSource(rows, fileName) {
    graphCsvImportSource = {
      rows,
      fileName,
      productId: selectedProductId,
    };
    graphCsvImportSignature = "";
  }

  function clearGraphCsvImportSource() {
    graphCsvImportSource = {
      rows: [],
      fileName: "",
      productId: null,
    };
    graphCsvImportSignature = "";
  }

  function applyImportedGraphCsvSource({
    rows,
    fileName = "graph-data.csv",
    showSuccess = true,
    rememberSource = true,
  } = {}) {
    graphCsvError = "";
    if (!selectedProductId) {
      graphCsvError = "Select a product first.";
      return;
    }

    const inputRows = Array.isArray(rows) ? rows : [];
    if (inputRows.length < 2) {
      graphCsvError =
        "Choose a graph data file with a header row and at least one data row.";
      return;
    }

    try {
      const cleanedRows = normalizeGraphCsvRows(inputRows);
      if (rememberSource) {
        setGraphCsvImportSource(inputRows, fileName);
      }
      const downsampleImportedCurves = !!graphCsvDownsampleImportedCurves;
      const downsamplePointCount = downsampleImportedCurves
        ? normalizeGraphCsvDownsampleCount(graphCsvDownsamplePointCount)
        : null;
      const imported = buildImportedGraphState(cleanedRows, {
        downsampleImportedCurves: false,
        permissibleUseMode: "both",
      });
      rpmLines = imported.rpmLines;
      rpmPoints = imported.rpmPoints;
      efficiencyPoints = imported.efficiencyPoints;
      graphReference.reset(currentGraphState());
      applyGraphOptions(graphOptionsKey);
      syncFanAcousticTableWithRpmLines(rpmLines);
      graphCsvFileName = fileName;
      const validTargets = new Set([
        ...rpmLines.map((line) => `rpm:${line.id}`),
        ...currentOverlayLineDefinitions().map(
          (definition) => `efficiency:${definition.key}`,
        ),
      ]);
      if (!chartAddTarget || !validTargets.has(chartAddTarget)) {
        chartAddTarget = rpmLines.length ? `rpm:${rpmLines[0].id}` : "off";
      }
      if (rpmLines.length) {
        rpmPointForm = { ...rpmPointForm, rpm_line_id: String(rpmLines[0].id) };
      }
      if (showSuccess) {
        addSuccess(
          `${`Loaded graph data from ${fileName}`}${
            downsampleImportedCurves
              ? `, downsampled each imported curve to ${downsamplePointCount} representative point${downsamplePointCount === 1 ? "" : "s"}`
              : ""
          }. Review the tables and chart, then press Save Changes to commit it.`,
        );
      }
    } catch (e) {
      graphCsvError = e.message;
    }
  }

  async function handleGraphCsvFileChange(event) {
    graphCsvError = "";
    const file = event.currentTarget?.files?.[0];
    if (!file) {
      graphCsvFileName = "";
      clearGraphCsvImportSource();
      return;
    }

    try {
      const parsed = await parseGraphDataUpload(file);
      applyImportedGraphCsvSource({
        rows: parsed.rows,
        fileName: parsed.file_name || file.name,
        showSuccess: true,
        rememberSource: true,
      });
      if (graphCsvInput) {
        graphCsvInput.value = "";
      }
    } catch (e) {
      graphCsvError = e.message || "Unable to read the selected graph data file.";
    }
  }

  function clearGraphCsvSelection() {
    graphCsvError = "";
    graphCsvFileName = "";
    clearGraphCsvImportSource();
    if (graphCsvInput) {
      graphCsvInput.value = "";
    }
  }

  async function loadProducts() {
    try {
      products = await getProducts();
    } catch (e) {
      error = e.message;
    }
  }

  async function loadProductTypes() {
    try {
      productTypes = await getProductTypes();
      if (
        mode === "create" &&
        !createBandGraphStyleInitialized &&
        productForm.product_type_key
      ) {
        applyCreateBandGraphStyleDefaults(productForm.product_type_key);
      }
      if (
        mode !== "create" &&
        !parameterGroups.length &&
        productForm.product_type_key
      ) {
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
      if (mode !== "create") {
        const availableTemplateIds = new Set(
          productTemplateOptions.map((template) => template.id),
        );
        productForm = {
          ...productForm,
          printed_template_id:
            productForm.printed_template_id &&
            !availableTemplateIds.has(productForm.printed_template_id)
              ? ""
              : productForm.printed_template_id ||
                resolveCreateTemplateId(
                  productForm.product_type_key,
                  "printed",
                ),
          online_template_id:
            productForm.online_template_id &&
            !availableTemplateIds.has(productForm.online_template_id)
              ? ""
              : productForm.online_template_id ||
                resolveCreateTemplateId(productForm.product_type_key, "online"),
        };
      }
    } catch (e) {
      error = e.message;
    }
  }

  function startCreateProductType() {
    managementMode = "create-product-type";
    selectedManageProductTypeId = "";
    resetProductTypeDraft();
  }

  function startEditProductType() {
    managementMode = "edit-product-type";
    selectedManageProductTypeId = "";
    resetProductTypeDraft();
  }

  function startCreateSeries() {
    managementMode = "create-series";
    selectedManageSeriesId = "";
    resetSeriesDraft();
  }

  function startEditSeries() {
    managementMode = "edit-series";
    selectedManageSeriesId = "";
    resetSeriesDraft();
  }

  function cancelManagement() {
    managementMode = "";
    selectedManageProductTypeId = "";
    selectedManageSeriesId = "";
  }

  async function saveManagedProductType() {
    error = "";
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
        graph_y_axis_unit: productTypeDraft.graph_y_axis_unit || null,
      };
      if (
        managementMode === "edit-product-type" &&
        !selectedManageProductTypeId
      ) {
        error = "Choose a product type first.";
        return;
      }
      if (productTypeDraft.id) {
        await updateProductType(productTypeDraft.id, body);
        addSuccess("Product type updated.");
      } else {
        const created = await createProductType(body);
        resetProductTypeDraft(created);
        selectedManageProductTypeId = created?.id ?? "";
        managementMode = "edit-product-type";
        addSuccess("Product type created.");
      }
      await loadProductTypes();
    } catch (e) {
      error = e.message;
    } finally {
      savingProductType = false;
    }
  }

  async function saveManagedSeries() {
    error = "";
    savingSeriesRecord = true;
    try {
      const body = {
        name: seriesDraft.name,
        product_type_key: seriesDraft.product_type_key,
        printed_template_id: seriesDraft.printed_template_id || null,
        online_template_id: seriesDraft.online_template_id || null,
        description_sections: seriesDescriptionSections.map((section) => ({
          key: section.key,
          title: section.title,
          html: section.html,
        })),
        ...createDescriptionFieldPayload(
          seriesDescriptionSections,
          seriesDescriptionFieldCount,
        ),
      };
      if (managementMode === "edit-series" && !selectedManageSeriesId) {
        error = "Choose a series first.";
        return;
      }
      if (!body.product_type_key) {
        error = "Choose a product type for the series.";
        return;
      }
      if (seriesDraft.id) {
        await updateSeries(seriesDraft.id, body);
        addSuccess("Series updated.");
      } else {
        const created = await createSeries(body);
        resetSeriesDraft(created);
        selectedManageSeriesId = created?.id ?? "";
        managementMode = "edit-series";
        addSuccess("Series created.");
      }
      await loadSeries();
    } catch (e) {
      error = e.message;
    } finally {
      savingSeriesRecord = false;
    }
  }

  async function loadProductData() {
    if (!selectedProductId) return;
    efficiencyLineDataLoaded = false;
    try {
      if (
        graphCsvImportSource.productId != null &&
        graphCsvImportSource.productId !== selectedProductId
      ) {
        clearGraphCsvImportSource();
        graphCsvFileName = "";
      }
      const nextProduct = await getProduct(selectedProductId);
      currentProduct = nextProduct;
      const nextProductType =
        productTypes.find(
          (item) => item.key === (nextProduct?.product_type_key || "fan"),
        ) || null;
      const overlayDefinitions =
        nextProductType?.supports_graph_overlays === false
          ? []
          : FULL_CHART_LINE_DEFINITIONS;
      const [rpmLinesResult, rpmPointsResult, efficiencyPointsResult] =
        await Promise.allSettled([
          getRpmLines(selectedProductId),
          getRpmPoints(selectedProductId),
          getEfficiencyPoints(selectedProductId),
        ]);
      const nextRpmLines =
        rpmLinesResult.status === "fulfilled" ? rpmLinesResult.value : [];
      const nextRpmPoints =
        rpmPointsResult.status === "fulfilled" ? rpmPointsResult.value : [];
      const nextEfficiencyPoints =
        efficiencyPointsResult.status === "fulfilled"
          ? efficiencyPointsResult.value
          : [];
      rpmLines = nextRpmLines.map((line, index) =>
        normalizeGraphLineDraft({
          ...line,
          band_color:
            normalizeOptionalColor(line.band_color) ||
            RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length],
        }),
      );
      originalRpmLineSnapshots = new Map(
        nextRpmLines.map((line) => [Number(line.id), snapshotGraphLine(line)]),
      );
      originalRpmPointSnapshots = new Map(
        nextRpmPoints.map((point) => [
          Number(point.id),
          Number(point.rpm_line_id),
        ]),
      );
      rpmPoints = applyRpmPointSort(
        hydrateRpmPointsWithLineValues(nextRpmPoints, rpmLines).map((point) =>
          normalizeGraphPointDraft(point),
        ),
      );
      efficiencyPoints = nextEfficiencyPoints.map((point) =>
        normalizeGraphEfficiencyPointDraft(point),
      );
      graphReference.reset(currentGraphState());
      hasBothEfficiencyLines =
        nextEfficiencyPoints.some((point) => point?.efficiency_higher_end !== "" && point?.efficiency_higher_end != null) &&
        nextEfficiencyPoints.some((point) => point?.efficiency_lower_end !== "" && point?.efficiency_lower_end != null);
      efficiencyLineDataLoaded = true;
      originalRpmPointIds = nextRpmPoints.map((point) => point.id);
      originalEfficiencyPointIds = nextEfficiencyPoints.map(
        (point) => point.id,
      );
      fanAcousticTable =
        nextProductType?.key === "fan"
          ? createFanAcousticTableDraft(
              nextProduct?.fan_acoustic_table || {},
              nextRpmLines,
            )
          : null;
      graphStyleForm = {
        band_graph_background_color:
          normalizeOptionalColor(nextProduct?.band_graph_background_color) ||
          "#ffffff",
        band_graph_label_text_color:
          normalizeOptionalColor(nextProduct?.band_graph_label_text_color) ||
          "#000000",
        band_graph_faded_opacity:
          nextProduct?.band_graph_faded_opacity != null &&
          !Number.isNaN(Number(nextProduct.band_graph_faded_opacity))
            ? Number(nextProduct.band_graph_faded_opacity)
            : 0.18,
        band_graph_permissible_label_color:
          normalizeOptionalColor(
            nextProduct?.band_graph_permissible_label_color,
          ) ||
          normalizeOptionalColor(nextProduct?.band_graph_label_text_color) ||
          "#000000",
      };
      productImages = currentProduct.product_images || [];
      const validTargets = new Set([
        ...nextRpmLines.map((line) => `rpm:${line.id}`),
        ...overlayDefinitions.map(
          (definition) => `efficiency:${definition.key}`,
        ),
      ]);
      if (!chartAddTarget || !validTargets.has(chartAddTarget)) {
        chartAddTarget = "off";
      }
      if (!rpmPointForm.rpm_line_id && nextRpmLines.length) {
        rpmPointForm = {
          ...rpmPointForm,
          rpm_line_id: String(nextRpmLines[0].id),
        };
      }
    } catch (e) {
      error = e.message;
    }
  }

  async function openSelectedExistingProduct(productId = selectedProductId) {
    const nextProductId =
      productId == null || productId === "" ? null : Number(productId);
    if (!nextProductId) return;
    const selectedProduct =
      products.find((product) => Number(product.id) === nextProductId) || null;
    if (selectedProduct) {
      editProduct(selectedProduct);
      syncEditExistingFiltersFromProduct(selectedProduct);
    }
    selectedProductId = nextProductId;
    editingProductId = nextProductId;
    syncProductEditorUrl(nextProductId);
    loadingExistingProduct = true;
    try {
      await loadProductData();
      if (currentProduct) {
        editProduct(currentProduct);
        editingProductId = currentProduct.id;
        syncEditExistingFiltersFromProduct(currentProduct);
      } else {
        editingProductId = null;
      }
    } finally {
      loadingExistingProduct = false;
    }
  }

  function syncProductEditorUrl(productId) {
    if (typeof window === "undefined") return;
    const nextProductId =
      productId == null || productId === "" ? "" : String(productId);
    const nextUrl = nextProductId
      ? `/editor/edit/${encodeURIComponent(nextProductId)}`
      : "/editor/edit";
    if (
      `${window.location.pathname}${window.location.search}${window.location.hash}` ===
      nextUrl
    )
      return;
    void goto(nextUrl, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function productViewerUrl(productId = selectedProductId) {
    const nextProductId =
      productId == null || productId === "" ? "" : String(productId);
    return nextProductId
      ? `/viewer/product/${encodeURIComponent(nextProductId)}`
      : "/viewer/product";
  }

  $: {
    const nextInitialProductId =
      initialProductId !== "" && initialProductId != null
        ? String(initialProductId)
        : "";
    if (nextInitialProductId !== appliedInitialProductId) {
      appliedInitialProductId = nextInitialProductId;
      if (nextInitialProductId) {
        selectedProductId = Number(nextInitialProductId);
        if (mode !== "create") {
          mode = "editExisting";
        }
      } else if (mode !== "create" || selectedProductId !== null) {
        selectedProductId = null;
        editingProductId = null;
        currentProduct = null;
        resetProductEditor("");
        mode = "editExisting";
      }
    }
  }

  onMount(async () => {
    // Establish the route selection immediately so the editor shell can render
    // while metadata and the heavier graph requests load in the background.
    if (selectedProductId && !initialSelectionOnly) {
      editingProductId = selectedProductId;
      mode = "editExisting";
      void openSelectedExistingProduct(selectedProductId);
    }

    const metadataPromise = Promise.all([
      loadProducts(),
      loadProductTypes(),
      loadSeries(),
      loadTemplates(),
    ]);

    if (selectedProductId && initialSelectionOnly) {
      // This return-to-selection flow waits for metadata so both dropdowns
      // can be restored from the product that was just edited.
      await metadataPromise;
      const selectedProduct = products.find(
        (product) => Number(product.id) === Number(selectedProductId),
      );
      if (selectedProduct) {
        syncEditExistingFiltersFromProduct(selectedProduct);
      }
      try {
        const selectedProductDetail = await getProduct(selectedProductId);
        syncEditExistingFiltersFromProduct(selectedProductDetail);
      } catch (e) {
        // The list response is still sufficient to restore the selection if
        // the detail request is unavailable.
      }
      if (initialSeriesId) {
        editExistingSeriesId = Number(initialSeriesId);
      }
    }
  });

  async function saveProduct({
    showSuccess = true,
    reloadAfterSave = true,
    saveMapData = mode !== "create",
  } = {}) {
    error = "";
    clearSuccessToast();
    const validationErrors = collectEditorNumericValidationErrors();
    if (validationErrors.length > 0) {
      error = `Please correct the numeric values before saving: ${validationErrors.slice(0, 8).join("; ")}${validationErrors.length > 8 ? "; ..." : ""}`;
      return;
    }
    const body = {
      model: productForm.model.trim(),
      product_type_key: productForm.product_type_key || null,
      series_id: productForm.series_id ? Number(productForm.series_id) : null,
      printed_template_id: productForm.printed_template_id || null,
      online_template_id: productForm.online_template_id || null,
      description_sections: productDescriptionSections.map((section) => ({
        key: section.key,
        title: section.title,
        html: section.html,
      })),
      description_field_count: productDescriptionSections.length,
      ...createDescriptionFieldPayload(
        productDescriptionSections,
        productDescriptionFieldCount,
      ),
      show_rpm_band_shading: !!productForm.show_rpm_band_shading,
      permissible_use_mode: productForm.permissible_use_mode || "both",
      band_graph_background_color:
        normalizeOptionalColor(graphStyleForm.band_graph_background_color) ||
        null,
      band_graph_label_text_color:
        normalizeOptionalColor(graphStyleForm.band_graph_label_text_color) ||
        null,
      band_graph_faded_opacity:
        graphStyleForm.band_graph_faded_opacity === "" ||
        graphStyleForm.band_graph_faded_opacity == null
          ? null
          : Number(graphStyleForm.band_graph_faded_opacity),
      band_graph_permissible_label_color:
        normalizeOptionalColor(
          graphStyleForm.band_graph_permissible_label_color,
        ) || null,
      parameter_groups: serializeParameterGroups(),
      fan_acoustic_table: serializeFanAcousticTable(),
    };
    if (mode === "create") {
      body.rpm_lines = serializeCreateRpmLines();
      body.efficiency_points = serializeCreateEfficiencyPoints();
    }
    if (!body.model) {
      error = "Model is required.";
      return;
    }
    if (!body.product_type_key) {
      error = "Choose a product type.";
      return;
    }
    loading = true;
    savingProductDetails = true;
    try {
      if (editingProductId) {
        // Save graph changes before the product details. Replacing graph data
        // recreates RPM lines, so saving the acoustic table first can leave it
        // out of sync with the new lines and discard the edited values.
        if (saveMapData) {
          await saveMapPoints({
            showSuccess: false,
            clearMessages: false,
            reloadAfterSave: false,
          });
        }
        currentProduct = await updateProduct(editingProductId, body);
        products = await getProducts();
        if (!saveMapData && showSuccess) {
          addSuccess("Product updated.");
        }
      } else {
        const created = await createProduct(body);
        currentProduct = created;
        if (showSuccess) {
          addSuccess(
            "Product created. You can now upload product images and add graph data.",
          );
        }
        selectedProductId = created.id;
        editingProductId = created.id;
        mode = "editExisting";
      }
      if (mode !== "create" && editingProductId && saveMapData) {
        await loadProductData();
        if (showSuccess) {
          addSuccess("All changes saved.");
        }
      } else if (reloadAfterSave) {
        await loadProductData();
        if (currentProduct) editProduct(currentProduct);
      }
    } catch (e) {
      error =
        e.status === 422
          ? `Please correct the highlighted values before saving: ${e.message}`
          : e.message;
    } finally {
      loading = false;
      savingProductDetails = false;
    }
  }

  function editProduct(product) {
    editingProductId = product.id;
    resetProductDescriptionSections(product);
    productForm = {
      model: product.model,
      product_type_key: product.product_type_key || "fan",
      series_id: product.series_id ?? null,
      printed_template_id:
        product.printed_template_id || product.template_id || "",
      online_template_id:
        product.online_template_id || product.template_id || "",
      show_rpm_band_shading: product.show_rpm_band_shading ?? true,
      permissible_use_mode: product.permissible_use_mode || "both",
    };
    fanAcousticTable =
      product.product_type_key === "fan"
        ? createFanAcousticTableDraft(
            product.fan_acoustic_table || {},
            rpmLines,
          )
        : null;
    graphStyleForm = {
      band_graph_background_color:
        normalizeOptionalColor(product.band_graph_background_color) ||
        "#ffffff",
      band_graph_label_text_color:
        normalizeOptionalColor(product.band_graph_label_text_color) ||
        "#000000",
      band_graph_faded_opacity:
        product.band_graph_faded_opacity != null &&
        !Number.isNaN(Number(product.band_graph_faded_opacity))
          ? Number(product.band_graph_faded_opacity)
          : 0.18,
      band_graph_permissible_label_color:
        normalizeOptionalColor(product.band_graph_permissible_label_color) ||
        normalizeOptionalColor(product.band_graph_label_text_color) ||
        "#000000",
    };
    parameterGroups = (product.parameter_groups ?? []).map((group) =>
      createGroupDraft(group),
    );
    syncEditExistingFiltersFromProduct(product);
    editProductDetailsOpen = true;
    editGroupedSpecificationsOpen = true;
    editFanAcousticTableOpen = true;
    editMediaAssetsOpen = true;
    editLineManagementOpen = true;
    editGraphDataOpen = true;
    specificationGroupOpenState = {};
  }

  function returnToEditorHome() {
    const productId = editingProductId ?? selectedProductId;
    if (productId) {
      const seriesId =
        currentProduct?.series_id ?? productForm.series_id ?? "";
      const seriesQuery = seriesId
        ? `&series=${encodeURIComponent(String(seriesId))}`
        : "";
      goto(
        `/editor/edit?product=${encodeURIComponent(String(productId))}${seriesQuery}&selectionOnly=1`,
      );
      return;
    }
    goto("/editor/edit");
  }

  async function deleteCurrentProduct() {
    if (!editingProductId) return;
    const confirmed = window.confirm(
      `Delete product "${productForm.model || currentProduct?.model || editingProductId}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    error = "";
    clearSuccessToast();

    try {
      await deleteProduct(editingProductId);
      await loadProducts();
      selectedProductId = null;
      editingProductId = null;
      currentProduct = null;
      productImages = [];
      pendingImageFiles = [];
      editExistingProductTypeKey = "";
      editExistingSeriesId = "";
      resetProductEditor("");
      mode = "editExisting";
      syncProductEditorUrl("");
      addSuccess("Product deleted.");
    } catch (e) {
      error = e.message;
    }
  }

  async function duplicateCurrentProduct() {
    if (!editingProductId) return;
    error = "";
    clearSuccessToast();
    try {
      const copied = await duplicateProduct(editingProductId);
      await loadProducts();
      selectedProductId = copied.id;
      editingProductId = copied.id;
      syncProductEditorUrl(copied.id);
      await loadProductData();
      if (currentProduct) editProduct(currentProduct);
      addSuccess("Product duplicated. Rename the copy and save your changes.");
    } catch (e) {
      error = e.message;
    }
  }

  async function addRpmLine() {
    const rpm = parseOptionalInteger(newRpmLineValue);
    if (rpm == null || !selectedProductId) {
      error = `Enter a whole-number ${graphLineValueLabel()} value and select a graph-capable product first.`;
      return;
    }
    try {
      const created = await createRpmLine(selectedProductId, {
        rpm,
        band_color: normalizeOptionalColor(newRpmLineBandColor) || null,
      });
      newRpmLineValue = "";
      newRpmLineBandColor = "";
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
      rpmPoints = applyRpmPointSort(
        rpmPoints.filter((point) => point.rpm_line_id !== line.id),
      );
      syncFanAcousticTableWithRpmLines(rpmLines);
      if (chartAddTarget === `rpm:${line.id}`) {
        chartAddTarget = "off";
      }
      addSuccess(
        `${graphLineValueLabel()} line removed locally. Save Changes to persist the point changes.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete the ${formatGraphLineValue(line.rpm)} line? This will also remove its graph points.`,
    );
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
              rpm: parseOptionalInteger(line.rpm),
              band_color: normalizeOptionalColor(line.band_color) || null,
            }
          : item,
      );
      syncFanAcousticTableWithRpmLines(rpmLines);
      rpmPoints = applyRpmPointSort(
        rpmPoints.map((point) =>
          point.rpm_line_id === line.id
            ? { ...point, rpm: Number(line.rpm) }
            : point,
        ),
      );
      addSuccess(
        `${formatGraphLineValue(line.rpm)} styling updated locally. Save Changes to persist new points on this line.`,
      );
      return;
    }

    try {
      await updateRpmLine(selectedProductId, line.id, {
        rpm: parseOptionalInteger(line.rpm),
        band_color: normalizeOptionalColor(line.band_color) || null,
      });
      await loadProductData();
      addSuccess(`${formatGraphLineValue(line.rpm)} styling updated.`);
    } catch (e) {
      error = e.message;
    }
  }

  async function saveBandGraphStyle() {
    if (!selectedProductId) {
      error = "Select a product first.";
      return;
    }

    try {
      const saved = await updateProduct(selectedProductId, {
        band_graph_background_color:
          normalizeOptionalColor(graphStyleForm.band_graph_background_color) ||
          null,
        band_graph_label_text_color:
          normalizeOptionalColor(graphStyleForm.band_graph_label_text_color) ||
          null,
        band_graph_faded_opacity:
          graphStyleForm.band_graph_faded_opacity === "" ||
          graphStyleForm.band_graph_faded_opacity == null
            ? null
            : Number(graphStyleForm.band_graph_faded_opacity),
        band_graph_permissible_label_color:
          normalizeOptionalColor(
            graphStyleForm.band_graph_permissible_label_color,
          ) || null,
      });
      graphStyleForm = {
        band_graph_background_color: normalizeOptionalColor(
          saved?.band_graph_background_color,
        ),
        band_graph_label_text_color: normalizeOptionalColor(
          saved?.band_graph_label_text_color,
        ),
        band_graph_faded_opacity:
          saved?.band_graph_faded_opacity != null &&
          !Number.isNaN(Number(saved.band_graph_faded_opacity))
            ? Number(saved.band_graph_faded_opacity)
            : 0.18,
        band_graph_permissible_label_color:
          normalizeOptionalColor(saved?.band_graph_permissible_label_color) ||
          normalizeOptionalColor(saved?.band_graph_label_text_color) ||
          "#000000",
      };
      currentProduct = saved;
      products = await getProducts();
      addSuccess("Band graph style updated for this product.");
    } catch (e) {
      error = e.message;
    }
  }

  async function addRpmPointFromForm() {
    const rpm_line_id = Number(rpmPointForm.rpm_line_id);
    const airflow = parseOptionalInteger(rpmPointForm.airflow);
    const pressure = parseOptionalInteger(rpmPointForm.pressure);
    if (
      !selectedProductId ||
      !rpm_line_id ||
      airflow == null ||
      pressure == null
    ) {
      error = `Select a ${graphLineValueLabel()} line and enter whole-number ${graphXAxisLabel().toLowerCase()} and ${graphYAxisLabel().toLowerCase()} values.`;
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
        pressure,
      },
    ]);
    rpmPointForm = {
      rpm_line_id: rpmPointForm.rpm_line_id,
      airflow: "",
      pressure: "",
    };
    addSuccess("Graph point added locally. Save Changes to persist it.");
  }

  async function addEfficiencyPointFromForm() {
    const airflow = parseOptionalInteger(efficiencyPointForm.airflow);
    if (!selectedProductId || airflow == null) {
      error = "Enter a whole-number airflow value for the efficiency point.";
      return;
    }
    efficiencyPoints = [
      ...efficiencyPoints,
      {
        id: createTempPointId(),
        product_id: selectedProductId,
        airflow,
        efficiency_centre: parseOptionalInteger(
          efficiencyPointForm.efficiency_centre,
        ),
        efficiency_lower_end: parseOptionalInteger(
          efficiencyPointForm.efficiency_lower_end,
        ),
        efficiency_higher_end: parseOptionalInteger(
          efficiencyPointForm.efficiency_higher_end,
        ),
        permissible_use: parseOptionalInteger(
          efficiencyPointForm.permissible_use,
        ),
      },
    ];
    efficiencyPointForm = {
      airflow: "",
      efficiency_centre: "",
      efficiency_lower_end: "",
      efficiency_higher_end: "",
      permissible_use: "",
    };
    addSuccess(
      "Efficiency/permissible point added locally. Save Changes to persist it.",
    );
  }

  async function uploadImages() {
    if (!selectedProductId) {
      error = "Save the product before uploading product images.";
      return;
    }
    if (!pendingImageFiles.length) {
      error = "Choose one or more image files first.";
      return;
    }
    try {
      productImages = await uploadProductImages(
        selectedProductId,
        pendingImageFiles,
      );
      pendingImageFiles = [];
      await loadProductData();
      products = await getProducts();
      addSuccess("Product images uploaded.");
    } catch (e) {
      error = e.message;
    }
  }

  async function refreshTemplateLibrary() {
    refreshingTemplates = true;
    error = "";
    try {
      await loadTemplates();
      addSuccess("Template library refreshed.");
    } catch (e) {
      error = e.message;
    } finally {
      refreshingTemplates = false;
    }
  }

  async function generateProductPdf() {
    if (!selectedProductId) {
      error = "Select a product first.";
      return;
    }
    refreshingProductPdfJob = null;
    const productLabel =
      currentProduct?.model || `product ${selectedProductId}`;
    try {
      const job = await runMaintenanceJob(
        () => startRefreshProductPdfJob(selectedProductId),
        {
          isCancelled: () => destroyed,
          onUpdate: (nextJob) => {
            refreshingProductPdfJob = nextJob;
          },
        },
      );
      refreshingProductPdfJob = job;
      await loadProductData();
      products = await getProducts();
      addSuccess(`Printed product PDF generated for ${productLabel}.`);
    } catch (e) {
      error = e.message;
    } finally {
      if (!destroyed) {
        refreshingProductPdfJob = null;
      }
    }
  }

  async function generateProductGraph() {
    if (!selectedProductId) {
      error = "Select a product first.";
      return;
    }
    refreshingProductGraphId = selectedProductId;
    try {
      await refreshGraphImage(selectedProductId);
      await loadProductData();
      products = await getProducts();
      addSuccess("Product graph generated.");
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
      productImages = await reorderProductImages(
        selectedProductId,
        reordered.map((image) => image.id),
      );
      await loadProductData();
      products = await getProducts();
      addSuccess("Product image order updated.");
    } catch (e) {
      error = e.message;
    }
  }

  async function removeProductImage(image) {
    try {
      await deleteProductImage(selectedProductId, image.id);
      await loadProductData();
      products = await getProducts();
      addSuccess("Product image deleted.");
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
      graphMode: "product",
      permissibleUseMode: productForm.permissible_use_mode || "both",
      includeDragHandles: true,
      clipRpmAreaToPermissibleUse: true,
      showRpmBandShading: productSupportsBandGraphStyle()
        ? (productForm.show_rpm_band_shading ?? true)
        : false,
      showSecondaryAxis: productSupportsGraphOverlays(),
      flowAxisMaxOverride: dragAxisLock?.flowMax ?? null,
      pressureAxisMaxOverride: dragAxisLock?.pressureMax ?? null,
      adaptGraphBackgroundToTheme: true,
      graphStyle: graphStyleForm,
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          const rawValue = Array.isArray(params.value)
            ? params.value
            : params.value?.value;
          const [airflow, second] = rawValue || [];
          const formattedAirflow = Number.isFinite(Number(airflow))
            ? String(Math.round(Number(airflow)))
            : "";
          const formattedSecond = Number.isFinite(Number(second))
            ? String(Math.round(Number(second)))
            : "";
          const matchingDefinition = overlayDefinitions.find(
            (definition) => definition.label === params.seriesName,
          );

          if (matchingDefinition) {
            return `${matchingDefinition.tooltipLabel}: ${formattedSecond}<br/>${graphXAxisLabel().toLowerCase()}: ${formattedAirflow}`;
          }

          return `${params.seriesName}<br/>${graphXAxisLabel().toLowerCase()}: ${formattedAirflow}<br/>${graphYAxisLabel().toLowerCase()}: ${formattedSecond}`;
        },
      },
    });
  }

  function handleMapChartDragEnd(params) {
    const data = params.data;
    const value = params.value || (data && data.value);
    const id = data?.id;
    if (!id || !value || !Array.isArray(value)) return;

    const [x, y] = value;
    const airflow = Math.round(x);
    const target =
      data?.pointType === "efficiency"
        ? efficiencyPoints.find((p) => p.id === id)
        : rpmPoints.find((p) => p.id === id);
    if (!target) return;

    if (data?.pointType === "efficiency") {
      const overlayDefinition = currentOverlayLineDefinitions().find(
        (definition) => definition.label === params.seriesName,
      );
      const lineKey = overlayDefinition?.key ?? null;
      efficiencyPoints = moveOverlayPoint(efficiencyPoints, id, lineKey,
        airflow, Math.round(y), createTempPointId);
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
      const xAxis = Array.isArray(currentOption?.xAxis)
        ? currentOption.xAxis[0]
        : currentOption?.xAxis;
      const yAxis = Array.isArray(currentOption?.yAxis)
        ? currentOption.yAxis[0]
        : currentOption?.yAxis;
      dragAxisLock = {
        flowMax: Array.isArray(xAxis?.max)
          ? xAxis.max[0]
          : (xAxis?.max ?? null),
        pressureMax: Array.isArray(yAxis?.max)
          ? yAxis.max[0]
          : (yAxis?.max ?? null),
      };
    }

    function pickClosestPoint({ x, y }) {
      const threshold = 14;
      let best = null;
      let bestDist = Infinity;

      for (const p of rpmPoints) {
        if (p.airflow == null || p.pressure == null) continue;
        const pressurePixel = chartInstance.convertToPixel(
          { xAxisIndex: 0, yAxisIndex: 0 },
          [p.airflow, p.pressure],
        );
        const dx = pressurePixel[0] - x;
        const dy = pressurePixel[1] - y;
        const d = Math.hypot(dx, dy);
        if (d < bestDist && d <= threshold) {
          bestDist = d;
          best = { id: p.id, pointType: "rpm" };
        }
      }

      for (const p of efficiencyPoints) {
        for (const definition of currentOverlayLineDefinitions()) {
          if (p[definition.key] == null) continue;
          const overlayPixel = chartInstance.convertToPixel(
            { xAxisIndex: 0, yAxisIndex: 0 },
            [p.airflow, p[definition.key]],
          );
          const dx2 = overlayPixel[0] - x;
          const dy2 = overlayPixel[1] - y;
          const d2 = Math.hypot(dx2, dy2);
          if (d2 < bestDist && d2 <= threshold) {
            bestDist = d2;
            best = {
              id: p.id,
              pointType: "efficiency",
              lineKey: definition.key,
            };
          }
        }
      }

      return best;
    }

    function updateDraggedPoint(point, pixel) {
      if (!point) return;
      const [airflow, value] = chartInstance.convertFromPixel(
        // Efficiency/permissible overlays use the same pressure axis as RPM
        // points. The chart has a single y-axis, so both point types must use
        // yAxisIndex 0 here.
        { xAxisIndex: 0, yAxisIndex: 0 },
        [pixel.x, pixel.y],
      );
      if (point.pointType === "efficiency") {
        efficiencyPoints = moveOverlayPoint(efficiencyPoints, point.id, point.lineKey,
          Math.round(airflow), Math.round(value), createTempPointId);
        return;
      }
      const updated = {
        ...rpmPoints.find((p) => p.id === point.id),
        airflow: Math.round(airflow),
        pressure: Math.round(value),
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

      if (!chartAddTarget || chartAddTarget === "off") return;

      if (chartAddTarget.startsWith("rpm:")) {
        const rpm_line_id = Number(chartAddTarget.split(":")[1]);
        const [airflow, pressure] = chartInstance.convertFromPixel(
          { xAxisIndex: 0, yAxisIndex: 0 },
          [x, y],
        );
        rpmPoints = applyRpmPointSort([
          ...rpmPoints,
          {
            id: createTempPointId(),
            product_id: selectedProductId,
            rpm_line_id,
            rpm: rpmLines.find((line) => line.id === rpm_line_id)?.rpm ?? null,
            airflow: Math.round(airflow),
            pressure: Math.round(pressure),
          },
        ]);
        addSuccess(
          "Point added locally from chart. Save Changes to persist it.",
        );
        return;
      }

      if (chartAddTarget.startsWith("efficiency:")) {
        const lineKey = chartAddTarget.split(":")[1];
        const [airflow, value] = chartInstance.convertFromPixel(
          { xAxisIndex: 0, yAxisIndex: 0 },
          [x, y],
        );
        efficiencyPoints = [
          ...efficiencyPoints,
          {
            id: createTempPointId(),
            product_id: selectedProductId,
            airflow: Math.round(airflow),
            efficiency_centre:
              lineKey === "efficiency_centre" ? Math.round(value) : null,
            efficiency_lower_end:
              lineKey === "efficiency_lower_end" ? Math.round(value) : null,
            efficiency_higher_end:
              lineKey === "efficiency_higher_end" ? Math.round(value) : null,
            permissible_use:
              lineKey === "permissible_use" ? Math.round(value) : null,
          },
        ];
        addSuccess(
          "Point added locally from chart. Save Changes to persist it.",
        );
      }
    }

    zr.on("mousedown", (evt) => {
      const dom = evt.event || evt;
      const mouse = getEventXY(evt);
      const found = pickClosestPoint(mouse);

      if (dom.shiftKey && (dom.button ?? 0) === 0) {
        if (!chartAddTarget || chartAddTarget === "off") return;
        if (!found) return;

        if (found.pointType === "efficiency") {
          efficiencyPoints = efficiencyPoints.filter(
            (point) => point.id !== found.id,
          );
        } else {
          rpmPoints = rpmPoints.filter((point) => point.id !== found.id);
        }

        suppressNextClick = true;
        dragMoved = false;
        draggingPoint = null;
        addSuccess(
          "Point deleted locally from chart. Save Changes to persist it.",
        );
        return;
      }

      if (dom.shiftKey) return;
      if (found) {
        lockCurrentAxisExtents();
        draggingPoint = found;
        dragMoved = false;
      }
    });

    zr.on("mousemove", (evt) => {
      if (!draggingPoint) return;
      dragMoved = true;
      const mouse = getEventXY(evt);
      pendingGraphDrag = { point: draggingPoint, mouse };
      if (graphDragFrame == null) graphDragFrame = requestAnimationFrame(() => {
        graphDragFrame = null;
        if (pendingGraphDrag && !destroyed) updateDraggedPoint(pendingGraphDrag.point, pendingGraphDrag.mouse);
        pendingGraphDrag = null;
      });
    });

    zr.on("mouseup", () => {
      if (graphDragFrame != null) cancelAnimationFrame(graphDragFrame);
      graphDragFrame = null;
      if (pendingGraphDrag) updateDraggedPoint(pendingGraphDrag.point, pendingGraphDrag.mouse);
      pendingGraphDrag = null;
      if (draggingPoint) {
        draggingPoint = null;
        dragAxisLock = null;
      }
    });
    zr.on("click", handleChartClick);
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
        rpm_line_id: resolveRpmLineIdForPoint(point),
        airflow: parseOptionalNumber(point.airflow),
        pressure: parseOptionalNumber(point.pressure),
      });
      await loadProductData();
      addSuccess("Graph point updated.");
    } catch (e) {
      error = e.message;
    }
  }

  async function updateEfficiencyPointLocal(point) {
    try {
      await updateEfficiencyPoint(selectedProductId, point.id, {
        airflow: parseOptionalNumber(point.airflow),
        efficiency_centre: parseOptionalNumber(point.efficiency_centre),
        efficiency_lower_end: parseOptionalNumber(point.efficiency_lower_end),
        efficiency_higher_end: parseOptionalNumber(point.efficiency_higher_end),
        permissible_use: parseOptionalNumber(point.permissible_use),
      });
      await loadProductData();
      addSuccess("Efficiency/permissible point updated.");
    } catch (e) {
      error = e.message;
    }
  }

  async function saveMapPoints({
    showSuccess = true,
    clearMessages = true,
    reloadAfterSave = true,
  } = {}) {
    error = "";
    if (clearMessages) {
      clearSuccessToast();
    }
    if (savingMapPoints) return;
    try {
      const saveLabel = isGraphCsvImportSave()
        ? "Replacing imported graph data..."
        : "Saving graph changes...";
      await beginMapPointSave(2);
      mapPointSaveProgress = {
        ...mapPointSaveProgress,
        label: saveLabel,
      };
      mapPointSaveProgressMessage = `Saving map points: 0 / 2 - ${saveLabel}`;
      await waitForProgressPaint();
      await replaceProductGraphData(selectedProductId, {
        rpm_lines: serializeGraphLinesForReplace(),
        efficiency_points: serializeEfficiencyPointsForReplace(),
      });
      await advanceMapPointSave(
        isGraphCsvImportSave()
          ? "Imported graph data replaced"
          : "Graph data replaced",
      );
      await refreshGraphImage(selectedProductId);
      await advanceMapPointSave("Regenerated graph image");
      if (reloadAfterSave) {
        await loadProductData();
      }
      if (showSuccess) {
        addSuccess(
          isGraphCsvImportSave()
            ? "Imported graph data replaced and graph image regenerated."
            : "All map points saved.",
        );
      }
    } catch (e) {
      error = e.message;
    } finally {
      finishMapPointSave();
    }
  }

  async function deleteRpmPointLocal(point) {
    rpmPoints = rpmPoints.filter((item) => item.id !== point.id);
    addSuccess("Graph point deleted locally. Save Changes to persist it.");
  }

  async function deleteEfficiencyPointLocal(point) {
    efficiencyPoints = efficiencyPoints.filter((item) => item.id !== point.id);
    addSuccess(
      "Efficiency/permissible point deleted locally. Save Changes to persist it.",
    );
  }
</script>

{#if successMessages.length}
  <div
    class="success-toast shadow-lg"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
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

{#if mode === "select"}
  <div class="card shadow-sm col-12 col-xl-8 mx-auto">
    <div class="card-body">
      <h2 class="h5">Editor Actions</h2>
      <p>
        Choose whether you want to create a new product or open an existing one
        for editing.
      </p>
      <div class="d-flex flex-wrap gap-2">
        <a class="btn btn-primary" href="/editor/create">Create New Product</a>
        <a class="btn btn-outline-secondary" href="/editor/edit"
          >Edit Existing Product</a
        >
      </div>
      <div class="mt-3">
        <button
          class="btn btn-outline-secondary btn-sm"
          on:click={refreshTemplateLibrary}
          disabled={refreshingTemplates}
        >
          {refreshingTemplates
            ? "Refreshing templates..."
            : "Refresh template library"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if mode !== "select"}
  <div class="editor-action-bar shadow-sm rounded-3 mb-3">
    <div
      class="d-flex flex-wrap align-items-center justify-content-between gap-2"
    >
      <div class="small text-body-secondary">
        {#if mode === "create"}
          Creating a new product
        {:else}
          Editing an existing product
        {/if}
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <button
          class="btn btn-outline-secondary"
          on:click={toggleAllAccordions}
          disabled={loading || savingProductDetails || savingMapPoints}
        >
          {allAccordionsOpen ? "Collapse All" : "Expand All"}
        </button>
        {#if mode === "create"}
          <button
            class="btn btn-primary"
            on:click={saveProduct}
            disabled={loading}
            >{savingProductDetails
              ? "Saving Product..."
              : "Save Product"}</button
          >
          <button
            class="btn btn-outline-secondary"
            on:click={() => {
              mode = "select";
              resetProductEditor("");
              productImages = [];
              pendingImageFiles = [];
              currentProduct = null;
              selectedProductId = null;
              syncProductEditorUrl("");
            }}
          >
            Cancel
          </button>
        {:else if editingProductId !== null}
          <button
            class="btn btn-primary"
            on:click={saveProduct}
            disabled={loading || savingProductDetails || savingMapPoints}
          >
            {savingProductDetails
              ? "Saving Product Details..."
              : savingMapPoints
                ? mapPointSaveProgressMessage || "Saving Map Points..."
                : "Save Changes"}
          </button>
          <a
            class="btn btn-outline-primary"
            href={productViewerUrl(editingProductId)}
            target="_self"
          >
            View in Viewer
          </a>
          <button
            class="btn btn-outline-primary"
            on:click={duplicateCurrentProduct}
            disabled={savingMapPoints || savingProductDetails}
          >
            Duplicate Product
          </button>
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
      {#if mode === "editExisting" && editingProductId !== null}
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

{#if mode === "create"}
  <div class="card shadow-sm col-12 col-xxl-12 mx-auto">
    <div class="card-body">
      <h2 class="h5">Create New Product</h2>
      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <AccordionCard
            title="Core details"
            description="Set the base identity and content for the new product."
            bind:open={createCoreDetailsOpen}
          >
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label" for="create-model">Model</label>
                <input
                  class="form-control"
                  id="create-model"
                  type="text"
                  bind:value={productForm.model}
                  placeholder="e.g. AF-120"
                />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label" for="create-product-type"
                  >Product type</label
                >
                <select
                  class="form-select"
                  id="create-product-type"
                  bind:value={productForm.product_type_key}
                  on:change={(event) =>
                    changeProductType(event.currentTarget.value)}
                >
                  <option value="">-- Choose option --</option>
                  {#each productTypes as productType}
                    <option value={productType.key}>{productType.label}</option>
                  {/each}
                </select>
              </div>
              {#if currentProductTypeForForm}
                <div class="col-12">
                  <SeriesNamesBadgeList
                    seriesNames={currentProductTypeForForm.series_names || []}
                    title={`Series names for ${currentProductTypeForForm.label}`}
                    emptyLabel="This product type does not have any series yet."
                  />
                </div>
              {/if}
              <div class="col-12 col-md-6">
                <label class="form-label" for="create-series">Series</label>
                <select
                  class="form-select"
                  id="create-series"
                  bind:value={productForm.series_id}
                  disabled={!productForm.product_type_key}
                >
                  <option value={null}>No series</option>
                  {#each seriesForType(productForm.product_type_key) as series}
                    <option value={series.id}>{series.name}</option>
                  {/each}
                </select>
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label" for="create-printed-template"
                  >Printed PDF template</label
                >
                <select
                  class="form-select"
                  id="create-printed-template"
                  bind:value={productForm.printed_template_id}
                  on:change={() => {
                    createTemplateSelectionSource = {
                      ...createTemplateSelectionSource,
                      printed: "manual",
                    };
                  }}
                >
                  <option value="">-- Choose option --</option>
                  {#each productTemplateOptions as template}
                    <option value={template.id}>{template.label}</option>
                  {/each}
                </select>
              </div>
            </div>
          </AccordionCard>
        </div>

        <div class="col-12 col-lg-6">
          <AccordionCard
            title="Product attributes"
            description="Configure the product options and longer-form content."
            bind:open={createProductAttributesOpen}
          >
            <div class="row g-3">
              {#if productSupportsBandGraphStyle()}
                <div class="col-12">
                  <div class="form-check form-switch mt-2">
                    <input
                      class="form-check-input"
                      id="create-show-rpm-band-shading"
                      type="checkbox"
                      bind:checked={productForm.show_rpm_band_shading}
                    />
                    <label
                      class="form-check-label"
                      for="create-show-rpm-band-shading"
                      >Show band shading on generated product graphs</label
                    >
                  </div>
                </div>
                {#if productSupportsGraphOverlays()}
                  <div class="col-12">
                    <label class="form-label" for="create-permissible-use-mode">Permissible-use shading mode</label>
                    <select class="form-select" id="create-permissible-use-mode" bind:value={productForm.permissible_use_mode}>
                      {#each PERMISSIBLE_USE_MODE_OPTIONS as option}
                        <option value={option.value} disabled={permissibleUseModeDisabled(option.value)}>{option.label}</option>
                      {/each}
                    </select>
                    {#if permissibleUseModeHelp(productForm.permissible_use_mode)}
                      <div class="form-text text-warning">{permissibleUseModeHelp(productForm.permissible_use_mode)}</div>
                    {/if}
                  </div>
                {/if}
              {/if}
              <div class="col-12">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                  <div>
                    <div class="form-label mb-0">Description sections</div>
                    <div class="form-text">Add or remove HTML blocks as this product needs. Maximum 10 description sections.</div>
                  </div>
                  <button class="btn btn-outline-primary btn-sm" type="button" on:click={addProductDescriptionSection} disabled={productDescriptionSections.length >= MAX_DESCRIPTION_SECTIONS}>
                    Add section
                  </button>
                </div>
                <div class="vstack gap-3">
                  {#each productDescriptionSections as section, sectionIndex}
                    <div class="border rounded p-3 bg-body-tertiary">
                      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                        <label class="form-label mb-0" for={`create-description-${sectionIndex + 1}`}>{section.title}</label>
                        <button class="btn btn-outline-danger btn-sm" type="button" on:click={() => removeProductDescriptionSection(sectionIndex)} disabled={productDescriptionSections.length === 1}>
                          Remove
                        </button>
                      </div>
                      <RichTextEditor
                        id={`create-description-${sectionIndex + 1}`}
                        rows={4}
                        bind:value={productDescriptionSections[sectionIndex].html}
                      />
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </AccordionCard>
        </div>
      </div>
      <div class="mt-3">
        <AccordionCard
          title="Grouped Specifications"
          description="Organise ordered parameter groups for this product type."
          bind:open={createGroupedSpecificationsOpen}
        >
          <div
            class="d-flex flex-wrap justify-content-between align-items-center gap-2"
          >
            <div class="d-flex flex-wrap gap-2">
              <button
                class="btn btn-outline-secondary btn-sm"
                on:click={toggleAllSpecificationGroups}
              >
                {parameterGroups.length > 0 &&
                parameterGroups.every(
                  (_, index) => specificationGroupOpenState[index] ?? true,
                )
                  ? "Collapse All Groups"
                  : "Expand All Groups"}
              </button>
              <button
                class="btn btn-outline-secondary btn-sm"
                on:click={loadSpecificationPresetsForSelectedType}
                >Load Specification Presets</button
              >
              <button
                class="btn btn-outline-primary btn-sm"
                on:click={addParameterGroup}>Add Group</button
              >
            </div>
          </div>
          {#if parameterGroups.length > 0}
            <div class="vstack gap-3 mt-3">
              {#each parameterGroups as group, groupIndex}
                <div
                  class={`border rounded p-3 ${group._pending_delete ? "bg-danger-subtle border-danger-subtle opacity-75" : ""}`}
                  style={group._pending_delete
                    ? ""
                    : `background-color: ${specificationGroupBackgroundColor(groupIndex)}; border-color: ${specificationGroupBorderColor(groupIndex)};`}
                >
                  <div
                    class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3"
                  >
                    <button
                      class="btn btn-link p-0 text-decoration-none text-reset fw-semibold spec-group-toggle"
                      type="button"
                      on:click={() => toggleSpecificationGroup(groupIndex)}
                    >
                      {(specificationGroupOpenState[groupIndex] ?? true)
                        ? "Hide"
                        : "Show"}
                      {group.group_name || `Group ${groupIndex + 1}`}
                    </button>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        on:click={() => moveParameterGroup(groupIndex, -1)}
                        disabled={groupIndex === 0}>Up</button
                      >
                      <button
                        class="btn btn-outline-secondary btn-sm"
                        on:click={() => moveParameterGroup(groupIndex, 1)}
                        disabled={groupIndex === parameterGroups.length - 1}
                        >Down</button
                      >
                      <button
                        class={`btn btn-sm ${group._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`}
                        on:click={() => removeParameterGroup(groupIndex)}
                      >
                        {group._pending_delete ? "Undo Delete" : "Delete Group"}
                      </button>
                      <button
                        class="btn btn-outline-primary btn-sm"
                        on:click={() => addParameter(groupIndex)}
                        disabled={group._pending_delete}>Add Parameter</button
                      >
                    </div>
                  </div>
                  {#if group._pending_delete}
                    <p class="small text-danger-emphasis mb-3">
                      This group is marked for deletion. Save Changes to apply
                      the deletion.
                    </p>
                  {/if}
                  {#if specificationGroupOpenState[groupIndex] ?? true}
                    <div class="vstack gap-3">
                      <input
                        class="form-control"
                        style="max-width: 22rem;"
                        type="text"
                        placeholder="Group name"
                        bind:value={group.group_name}
                        on:input={() =>
                          (parameterGroups = [...parameterGroups])}
                      />
                      {#each group.parameters as parameter, parameterIndex}
                        <div
                          class={`border rounded p-3 ${parameter._pending_delete ? "border-danger-subtle bg-danger-subtle opacity-75" : ""}`}
                          style={specificationParameterCardStyle(
                            groupIndex,
                            parameter._pending_delete,
                          )}
                        >
                          <div class="row g-3 align-items-end">
                            <div class="col-12 col-lg-3">
                              <label
                                class="form-label"
                                for={`create-group-${groupIndex}-parameter-${parameterIndex}-name`}
                                >Name</label
                              >
                              <input
                                class="form-control"
                                id={`create-group-${groupIndex}-parameter-${parameterIndex}-name`}
                                type="text"
                                bind:value={parameter.parameter_name}
                                on:input={() =>
                                  (parameterGroups = [...parameterGroups])}
                              />
                            </div>
                            <div class="col-12 col-lg-2">
                              <label
                                class="form-label"
                                for={`create-group-${groupIndex}-parameter-${parameterIndex}-value-type`}
                                >Value type</label
                              >
                              <select
                                class="form-select"
                                id={`create-group-${groupIndex}-parameter-${parameterIndex}-value-type`}
                                bind:value={parameter.value_type}
                                on:change={(event) =>
                                  updateParameterValueType(
                                    groupIndex,
                                    parameterIndex,
                                    event.currentTarget.value,
                                  )}
                              >
                                <option value="string">Text</option>
                                <option value="number">Number</option>
                              </select>
                            </div>
                            {#if parameter.value_type === "string"}
                              <div class="col-12 col-lg-5">
                                <label
                                  class="form-label"
                                  for={`create-group-${groupIndex}-parameter-${parameterIndex}-text`}
                                  >Text value</label
                                >
                                <input
                                  class="form-control"
                                  id={`create-group-${groupIndex}-parameter-${parameterIndex}-text`}
                                  type="text"
                                  bind:value={parameter.value_string}
                                  on:input={(event) =>
                                    handleParameterStringInput(
                                      groupIndex,
                                      parameterIndex,
                                      event,
                                    )}
                                />
                                {#if parameterValueHistory(group.group_name, parameter.parameter_name, "string").length > 0}
                                  <label
                                    class="form-label form-label-sm mt-2"
                                    for={`create-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`}
                                    >Reuse previous value</label
                                  >
                                  <select
                                    class="form-select form-select-sm"
                                    id={`create-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`}
                                    on:change={(event) => {
                                      const suggestion = parameterValueHistory(
                                        group.group_name,
                                        parameter.parameter_name,
                                        "string",
                                      )[Number(event.currentTarget.value)];
                                      if (suggestion) {
                                        applyParameterHistorySuggestion(
                                          groupIndex,
                                          parameterIndex,
                                          suggestion,
                                          "string",
                                        );
                                      }
                                      event.currentTarget.value = "";
                                    }}
                                  >
                                    <option value="">Choose prior value</option>
                                    {#each parameterValueHistory(group.group_name, parameter.parameter_name, "string") as suggestion, suggestionIndex}
                                      <option value={suggestionIndex}
                                        >{suggestion.value_string} ({suggestion.count})</option
                                      >
                                    {/each}
                                  </select>
                                {/if}
                              </div>
                            {:else}
                              <div class="col-12 col-lg-3">
                                <label
                                  class="form-label"
                                  for={`create-group-${groupIndex}-parameter-${parameterIndex}-number`}
                                  >Numeric value</label
                                >
                                <input
                                  class="form-control"
                                  id={`create-group-${groupIndex}-parameter-${parameterIndex}-number`}
                                  type="number"
                                  step="any"
                                  bind:value={parameter.value_number}
                                  on:input={() =>
                                    (parameterGroups = [...parameterGroups])}
                                />
                                {#if parameterValueHistory(group.group_name, parameter.parameter_name, "number").length > 0}
                                  <label
                                    class="form-label form-label-sm mt-2"
                                    for={`create-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`}
                                    >Reuse previous value</label
                                  >
                                  <select
                                    class="form-select form-select-sm"
                                    id={`create-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`}
                                    on:change={(event) => {
                                      const suggestion = parameterValueHistory(
                                        group.group_name,
                                        parameter.parameter_name,
                                        "number",
                                      )[Number(event.currentTarget.value)];
                                      if (suggestion) {
                                        applyParameterHistorySuggestion(
                                          groupIndex,
                                          parameterIndex,
                                          suggestion,
                                          "number",
                                        );
                                      }
                                      event.currentTarget.value = "";
                                    }}
                                  >
                                    <option value="">Choose prior value</option>
                                    {#each parameterValueHistory(group.group_name, parameter.parameter_name, "number") as suggestion, suggestionIndex}
                                      <option value={suggestionIndex}
                                        >{suggestion.value_number}{suggestion.unit
                                          ? ` ${suggestion.unit}`
                                          : ""} ({suggestion.count})</option
                                      >
                                    {/each}
                                  </select>
                                {/if}
                              </div>
                              <div class="col-12 col-lg-3">
                                <label
                                  class="form-label"
                                  for={`create-group-${groupIndex}-parameter-${parameterIndex}-unit`}
                                  >Unit</label
                                >
                                <select
                                  class="form-select"
                                  id={`create-group-${groupIndex}-parameter-${parameterIndex}-unit`}
                                  bind:value={parameter.unit}
                                  on:change={(event) =>
                                    updateParameterUnit(
                                      groupIndex,
                                      parameterIndex,
                                      event.currentTarget.value,
                                    )}
                                >
                                  <option value="">No unit</option>
                                  {#each GLOBAL_UNIT_OPTIONS as unitOption}
                                    <option value={unitOption}
                                      >{unitOption}</option
                                    >
                                  {/each}
                                  <option value="__custom__">Custom…</option>
                                </select>
                              </div>
                              {#if parameter.unit === "__custom__"}
                                <div class="col-12 col-lg-2">
                                  <label
                                    class="form-label"
                                    for={`create-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`}
                                    >Custom unit</label
                                  >
                                  <input
                                    class="form-control"
                                    id={`create-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`}
                                    type="text"
                                    bind:value={parameter.custom_unit}
                                    on:input={() =>
                                      (parameterGroups = [...parameterGroups])}
                                  />
                                </div>
                              {/if}
                            {/if}
                            <div class="col-12 col-lg-2">
                              <div class="d-flex flex-wrap gap-2">
                                <button
                                  class="btn btn-outline-secondary btn-sm"
                                  on:click={() =>
                                    moveParameter(
                                      groupIndex,
                                      parameterIndex,
                                      -1,
                                    )}
                                  disabled={group._pending_delete ||
                                    parameter._pending_delete ||
                                    parameterIndex === 0}>Up</button
                                >
                                <button
                                  class="btn btn-outline-secondary btn-sm"
                                  on:click={() =>
                                    moveParameter(
                                      groupIndex,
                                      parameterIndex,
                                      1,
                                    )}
                                  disabled={group._pending_delete ||
                                    parameter._pending_delete ||
                                    parameterIndex ===
                                      group.parameters.length - 1}>Down</button
                                >
                                <button
                                  class={`btn btn-sm ${parameter._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`}
                                  on:click={() =>
                                    removeParameter(groupIndex, parameterIndex)}
                                  disabled={group._pending_delete}
                                >
                                  {parameter._pending_delete
                                    ? "Undo Delete"
                                    : "Delete"}
                                </button>
                              </div>
                            </div>
                          </div>
                          {#if parameter._pending_delete}
                            <p class="small text-danger-emphasis mt-3 mb-0">
                              This parameter is marked for deletion. Save
                              Changes to apply the deletion.
                            </p>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-body-secondary mt-3 mb-0">
              No parameter groups yet. Load type presets or add a group
              manually.
            </p>
          {/if}
        </AccordionCard>

        {#if isFanAcousticTableVisible()}
          <AccordionCard
            title="Fan Acoustic Table"
            description="Rows stay aligned to the current RPM graph rows. Sound power columns can be added, removed, and renamed."
            bind:open={createFanAcousticTableOpen}
          >
            {#if fanAcousticTable}
              <div
                class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"
              >
                <div class="mb-3">
                  <label class="form-label mb-1" for="create-fan-acoustic-variant">Acoustic table variant</label>
                  <select id="create-fan-acoustic-variant" class="form-select form-select-sm" value={fanAcousticTable.variant_mode} on:change={handleFanAcousticVariantChange}>
                    {#each FAN_ACOUSTIC_VARIANT_MODES as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                  <p class="form-text mb-0">When set to Default, this is driven by the Motor → Power Supply specification. Single-phase supplies show Running Voltage; all other or unrecognised values show Running Frequency.</p>
                </div>
                <p class="text-body-secondary mb-0">
                  The speed column is read-only and follows the fan graph line
                  order.
                </p>
                <div class="d-flex flex-wrap gap-2">
                  <input
                    class="form-control form-control-sm fan-acoustic-csv-input"
                    bind:this={fanAcousticCsvInput}
                    type="file"
                    accept=".csv,text/csv"
                    on:change={handleFanAcousticCsvFileChange}
                  />
                  <button
                    class="btn btn-outline-secondary btn-sm"
                    type="button"
                    on:click={clearFanAcousticCsvSelection}>Clear CSV</button
                  >
                  <button
                    class="btn btn-outline-secondary btn-sm"
                    type="button"
                    on:click={exportFanAcousticCsv}
                    disabled={!fanAcousticTable && rpmLines.length === 0}
                    >Export CSV</button
                  >
                  <button
                    class="btn btn-outline-secondary btn-sm"
                    type="button"
                    on:click={addFanAcousticColumn}>Add Column</button
                  >
                </div>
              </div>
              {#if fanAcousticCsvFileName}
                <p class="small mb-2">
                  Loaded file: <strong>{fanAcousticCsvFileName}</strong>
                </p>
              {/if}
              {#if fanAcousticCsvError}
                <p class="text-danger mb-2">{fanAcousticCsvError}</p>
              {/if}
              <div class="table-responsive fan-acoustic-table-wrap">
                <table
                  class="table table-sm align-middle editable-table fan-acoustic-table mb-0"
                >
                  <thead>
                    <tr>
                      <th>Speed (rpm)</th>
                      <th>Peak Pressure (Pa)</th>
                      <th>Peak Power (kW)</th>
                      <th>{editorFanAcousticRunningColumnLabel}</th>
                      <th>Sound Pressure Level dB @ 3 meters</th>
                      {#each fanAcousticTable.sound_power_columns as column, columnIndex}
                        <th>
                          <div class="d-grid gap-1">
                            <input
                              class="form-control form-control-sm"
                              type="text"
                              bind:value={
                                fanAcousticTable.sound_power_columns[
                                  columnIndex
                                ]
                              }
                              on:input={() =>
                                (fanAcousticTable = { ...fanAcousticTable })}
                            />
                            <button
                              class="btn btn-outline-secondary btn-sm"
                              type="button"
                              on:click={() =>
                                renameFanAcousticColumn(columnIndex)}
                              >Rename</button
                            >
                            <button
                              class="btn btn-outline-danger btn-sm"
                              type="button"
                              on:click={() =>
                                removeFanAcousticColumn(columnIndex)}
                              disabled={fanAcousticTable.sound_power_columns
                                .length <= 1}>Delete</button
                            >
                          </div>
                        </th>
                      {/each}
                    </tr>
                  </thead>
                  <tbody>
                    {#each fanAcousticTable.rows as row, rowIndex}
                      <tr>
                        <td
                          ><input
                            class={`form-control form-control-sm ${editorNumericInputClass(row.speed_rpm)}`}
                            type="number"
                            step="any"
                            bind:value={row.speed_rpm}
                            disabled
                          /></td
                        >
                        <td
                          ><input
                            class={`form-control form-control-sm ${editorNumericInputClass(row.peak_pressure_pa)}`}
                            type="number"
                            step="any"
                            bind:value={row.peak_pressure_pa}
                            on:input={() =>
                              (fanAcousticTable = { ...fanAcousticTable })}
                          /></td
                        >
                        <td
                          ><input
                            class={`form-control form-control-sm ${editorNumericInputClass(row.peak_power_kw)}`}
                            type="number"
                            step="any"
                            bind:value={row.peak_power_kw}
                            on:input={() =>
                              (fanAcousticTable = { ...fanAcousticTable })}
                          /></td
                        >
                        <td>
                          {#if editorFanAcousticVariant === "1ph"}
                            <input class={`form-control form-control-sm ${editorNumericInputClass(row.running_voltage_v)}`} type="number"
                                      step="any" bind:value={row.running_voltage_v} on:input={() => (fanAcousticTable = { ...fanAcousticTable })} />
                          {:else}
                            <input class={`form-control form-control-sm ${editorNumericInputClass(row.running_frequency_hz)}`} type="number"
                                      step="any" bind:value={row.running_frequency_hz} on:input={() => (fanAcousticTable = { ...fanAcousticTable })} />
                          {/if}
                        </td>
                        <td
                          ><input
                            class={`form-control form-control-sm ${editorNumericInputClass(row.sound_pressure_db_3m)}`}
                            type="number"
                            step="any"
                            bind:value={row.sound_pressure_db_3m}
                            on:input={() =>
                              (fanAcousticTable = { ...fanAcousticTable })}
                          /></td
                        >
                        {#each fanAcousticTable.sound_power_columns as column}
                          <td
                            ><input
                              class={`form-control form-control-sm ${editorNumericInputClass(row.sound_power_levels[column])}`}
                              type="number"
                              step="any"
                              bind:value={row.sound_power_levels[column]}
                              on:input={() =>
                                (fanAcousticTable = { ...fanAcousticTable })}
                            /></td
                          >
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              {#if fanAcousticTable.rows.length === 0}
                <p class="text-body-secondary mt-3 mb-0">
                  Save or load RPM lines first so the acoustic table can align
                  itself.
                </p>
              {/if}
            {/if}
          </AccordionCard>
        {/if}
      </div>
      {#if productSupportsGraph() && (rpmLines.length > 0 || rpmPoints.length > 0 || efficiencyPoints.length > 0)}
        <div class="mt-3">
          <AccordionCard
            title="Preset Graph Preview"
            description="Review the type preset graph data that will be created with this product."
          >
            <div class="vstack gap-3">
              {#if rpmLines.length > 0}
                <div class="card shadow-sm">
                  <div class="card-body">
                    <h6 class="card-title mb-3">
                      {graphLineValueLabel()} lines
                    </h6>
                    <div class="table-responsive">
                      <table
                        class="table table-sm align-middle editable-table mb-0"
                      >
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
                              <td><code>{line.band_color || "None"}</code></td>
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
                    <h6 class="card-title mb-3">
                      {graphLineValueLabel()} points
                    </h6>
                    <GraphPointPagination total={rpmPoints.length} bind:page={rpmPointPage} />
                    <div class="table-responsive">
                      <table
                        class="table table-sm align-middle editable-table mb-0"
                      >
                        <thead>
                          <tr>
                            <th>{graphLineValueLabel()}</th>
                            <th>{graphXAxisLabel()}</th>
                            <th>{graphYAxisLabel()}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each rpmPoints.slice(rpmPointPage * 100, (rpmPointPage + 1) * 100) as p}
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
                    <h6 class="card-title mb-3">
                      Efficiency / permissible points
                    </h6>
                    <GraphPointPagination total={efficiencyPoints.length} bind:page={efficiencyPointPage} />
                    <div class="table-responsive">
                      <table
                        class="table table-sm align-middle editable-table mb-0"
                      >
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
                          {#each efficiencyPoints.slice(efficiencyPointPage * 100, (efficiencyPointPage + 1) * 100) as p}
                            <tr>
                              <td>{p.airflow}</td>
                              <td>{p.efficiency_centre ?? ""}</td>
                              <td>{p.efficiency_lower_end ?? ""}</td>
                              <td>{p.efficiency_higher_end ?? ""}</td>
                              <td>{p.permissible_use ?? ""}</td>
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
                    <ECharts
                      option={mapChartOption}
                      height="500px"
                      onChartReady={(c) => {
                        chartInstance = c;
                      }}
                    />
                  </div>
                </div>
              {/if}
            </div>
          </AccordionCard>
        </div>
      {/if}
      <p class="text-body-secondary mt-3 mb-2">
        Save the product first, then you can upload product images and manage
        the generated graph file.
      </p>
    </div>
  </div>
{/if}

{#if mode === "editExisting" && editingProductId === null}
  <div class="card shadow-sm col-12 col-xl-8 mx-auto">
    <div class="card-body">
      <h2 class="h5">Choose Existing Product</h2>
      <div class="row g-3">
        <div class="col-md-6 col-lg-4">
          <label class="form-label" for="edit-existing-product-type"
            >Product type</label
          >
          <select
            class="form-select"
            id="edit-existing-product-type"
            bind:value={editExistingProductTypeKey}
            on:change={() => {
              editExistingSeriesId = "";
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
          <label class="form-label" for="edit-existing-series"
            >Series (optional)</label
          >
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
          <label class="form-label" for="edit-fan-select"
            >Existing product</label
          >
          <select
            class="form-select"
            id="edit-fan-select"
            bind:value={selectedProductId}
            disabled={!editExistingProductTypeKey}
            on:change={(event) =>
              openSelectedExistingProduct(event.currentTarget.value)}
          >
            <option value={null}>— Select product —</option>
            {#each editableProductsForSelection(editExistingProductTypeKey, editExistingSeriesId) as product}
              <option value={product.id}>{product.model}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button
          class="btn btn-outline-secondary"
          on:click={() => {
            mode = "select";
            editExistingProductTypeKey = "";
            editExistingSeriesId = "";
            selectedProductId = null;
            resetProductEditor("");
            productImages = [];
            pendingImageFiles = [];
            currentProduct = null;
            editingProductId = null;
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

{#if mode === "editExisting" && editingProductId !== null}
  <div class="card shadow-sm">
    <div class="card-body">
      <h2 class="h5">Edit Product: {productForm.model}</h2>
      <div class="row g-3">
        <div class="col-12 col-xxl-6">
          <div class="vstack gap-3">
            <AccordionCard
              title="Product details"
              description="Edit the main product fields and descriptive content."
              bind:open={editProductDetailsOpen}
            >
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <label class="form-label" for="edit-model">Model</label>
                  <input
                    class="form-control"
                    id="edit-model"
                    type="text"
                    bind:value={productForm.model}
                  />
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label" for="edit-product-type"
                    >Product type</label
                  >
                  <select
                    class="form-select"
                    id="edit-product-type"
                    bind:value={productForm.product_type_key}
                    on:change={(event) =>
                      changeProductType(event.currentTarget.value)}
                  >
                    <option value="">-- Choose option --</option>
                    {#each productTypes as productType}
                      <option value={productType.key}
                        >{productType.label}</option
                      >
                    {/each}
                  </select>
                </div>
                {#if currentProductTypeForForm}
                  <div class="col-12">
                    <SeriesNamesBadgeList
                      seriesNames={currentProductTypeForForm.series_names || []}
                      title={`Series names for ${currentProductTypeForForm.label}`}
                      emptyLabel="This product type does not have any series yet."
                    />
                  </div>
                {/if}
                <div class="col-12 col-md-6">
                  <label class="form-label" for="edit-series">Series</label>
                  <select
                    class="form-select"
                    id="edit-series"
                    bind:value={productForm.series_id}
                    disabled={!productForm.product_type_key}
                  >
                    <option value={null}>No series</option>
                    {#each seriesForType(productForm.product_type_key) as series}
                      <option value={series.id}>{series.name}</option>
                    {/each}
                  </select>
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label" for="edit-printed-template"
                    >Printed PDF template</label
                  >
                  <select
                    class="form-select"
                    id="edit-printed-template"
                    bind:value={productForm.printed_template_id}
                  >
                    <option value="">-- Choose option --</option>
                    {#each productTemplateOptions as template}
                      <option value={template.id}>{template.label}</option>
                    {/each}
                  </select>
                </div>
                <div class="col-12">
                  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                    <div>
                      <div class="form-label mb-0">Description sections</div>
                        <div class="form-text">Add or remove HTML blocks as this product needs. Maximum 10 description sections.</div>
                    </div>
                    <button class="btn btn-outline-primary btn-sm" type="button" on:click={addProductDescriptionSection} disabled={productDescriptionSections.length >= MAX_DESCRIPTION_SECTIONS}>
                      Add section
                    </button>
                  </div>
                  <div class="vstack gap-3">
                    {#each productDescriptionSections as section, sectionIndex}
                      <div class="border rounded p-3 bg-body-tertiary">
                        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                          <label class="form-label mb-0" for={`edit-description-${sectionIndex + 1}`}>{section.title}</label>
                          <button class="btn btn-outline-danger btn-sm" type="button" on:click={() => removeProductDescriptionSection(sectionIndex)} disabled={productDescriptionSections.length === 1}>
                            Remove
                          </button>
                        </div>
                        <RichTextEditor
                          id={`edit-description-${sectionIndex + 1}`}
                          rows={4}
                          bind:value={productDescriptionSections[sectionIndex].html}
                        />
                      </div>
                    {/each}
                  </div>
                </div>
                {#if productSupportsBandGraphStyle()}
                  <div class="col-12">
                    <div class="form-check form-switch mt-2">
                      <input
                        class="form-check-input"
                        id="edit-show-rpm-band-shading"
                        type="checkbox"
                        bind:checked={productForm.show_rpm_band_shading}
                      />
                      <label
                        class="form-check-label"
                        for="edit-show-rpm-band-shading"
                        >Show band shading on product graphs and generated graph
                        images</label
                      >
                    </div>
                  </div>
                {/if}
              </div>
            </AccordionCard>

            <AccordionCard
              title="Grouped Specifications"
              description="Manage the ordered specification groups shown across the site."
              bind:open={editGroupedSpecificationsOpen}
            >
              <div
                class="d-flex flex-wrap justify-content-between align-items-center gap-2"
              >
                <div>
                  <p class="text-body-secondary mb-0">
                    These are ordered exactly as they will appear elsewhere.
                  </p>
                </div>
                <div class="d-flex flex-wrap gap-2">
                  <button
                    class="btn btn-outline-secondary btn-sm"
                    on:click={toggleAllSpecificationGroups}
                  >
                    {parameterGroups.length > 0 &&
                    parameterGroups.every(
                      (_, index) => specificationGroupOpenState[index] ?? true,
                    )
                      ? "Collapse All Groups"
                      : "Expand All Groups"}
                  </button>
                  <button
                    class="btn btn-outline-secondary btn-sm"
                    on:click={loadSpecificationPresetsForSelectedType}
                    >Load Specification Presets</button
                  >
                  <button
                    class="btn btn-outline-primary btn-sm"
                    on:click={addParameterGroup}>Add Group</button
                  >
                </div>
              </div>
              {#if parameterGroups.length > 0}
                <div class="vstack gap-3 mt-3">
                  {#each parameterGroups as group, groupIndex}
                    <div
                      class={`border rounded p-3 ${group._pending_delete ? "bg-danger-subtle border-danger-subtle opacity-75" : ""}`}
                      style={group._pending_delete
                        ? ""
                        : `background-color: ${specificationGroupBackgroundColor(groupIndex)}; border-color: ${specificationGroupBorderColor(groupIndex)};`}
                    >
                      <div
                        class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3"
                      >
                        <button
                          class="btn btn-link p-0 text-decoration-none text-reset fw-semibold spec-group-toggle"
                          type="button"
                          on:click={() => toggleSpecificationGroup(groupIndex)}
                        >
                          {(specificationGroupOpenState[groupIndex] ?? true)
                            ? "Hide"
                            : "Show"}
                          {group.group_name || `Group ${groupIndex + 1}`}
                        </button>
                        <div class="d-flex flex-wrap gap-2 align-items-center">
                          <button
                            class="btn btn-outline-secondary btn-sm"
                            on:click={() => moveParameterGroup(groupIndex, -1)}
                            disabled={groupIndex === 0}>Up</button
                          >
                          <button
                            class="btn btn-outline-secondary btn-sm"
                            on:click={() => moveParameterGroup(groupIndex, 1)}
                            disabled={groupIndex === parameterGroups.length - 1}
                            >Down</button
                          >
                          <button
                            class={`btn btn-sm ${group._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`}
                            on:click={() => removeParameterGroup(groupIndex)}
                          >
                            {group._pending_delete
                              ? "Undo Delete"
                              : "Delete Group"}
                          </button>
                          <button
                            class="btn btn-outline-primary btn-sm"
                            on:click={() => addParameter(groupIndex)}
                            disabled={group._pending_delete}
                            >Add Parameter</button
                          >
                        </div>
                      </div>
                      {#if group._pending_delete}
                        <p class="small text-danger-emphasis mb-3">
                          This group is marked for deletion. Save Changes to
                          apply the deletion.
                        </p>
                      {/if}
                      {#if specificationGroupOpenState[groupIndex] ?? true}
                        <div class="vstack gap-3">
                          <input
                            class="form-control"
                            style="max-width: 22rem;"
                            type="text"
                            placeholder="Group name"
                            bind:value={group.group_name}
                            on:input={() =>
                              (parameterGroups = [...parameterGroups])}
                          />
                          {#each group.parameters as parameter, parameterIndex}
                            <div
                              class={`border rounded p-3 ${parameter._pending_delete ? "border-danger-subtle bg-danger-subtle opacity-75" : ""}`}
                              style={specificationParameterCardStyle(
                                groupIndex,
                                parameter._pending_delete,
                              )}
                            >
                              <div class="row g-3 align-items-end">
                                <div class="col-12 col-lg-3">
                                  <label
                                    class="form-label"
                                    for={`edit-group-${groupIndex}-parameter-${parameterIndex}-name`}
                                    >Name</label
                                  >
                                  <input
                                    class="form-control"
                                    id={`edit-group-${groupIndex}-parameter-${parameterIndex}-name`}
                                    type="text"
                                    bind:value={parameter.parameter_name}
                                    on:input={() =>
                                      (parameterGroups = [...parameterGroups])}
                                  />
                                </div>
                                <div class="col-12 col-lg-2">
                                  <label
                                    class="form-label"
                                    for={`edit-group-${groupIndex}-parameter-${parameterIndex}-value-type`}
                                    >Value type</label
                                  >
                                  <select
                                    class="form-select"
                                    id={`edit-group-${groupIndex}-parameter-${parameterIndex}-value-type`}
                                    bind:value={parameter.value_type}
                                    on:change={(event) =>
                                      updateParameterValueType(
                                        groupIndex,
                                        parameterIndex,
                                        event.currentTarget.value,
                                      )}
                                  >
                                    <option value="string">Text</option>
                                    <option value="number">Number</option>
                                  </select>
                                </div>
                                {#if parameter.value_type === "string"}
                                  <div class="col-12 col-lg-5">
                                    <label
                                      class="form-label"
                                      for={`edit-group-${groupIndex}-parameter-${parameterIndex}-text`}
                                      >Text value</label
                                    >
                                    <input
                                      class="form-control"
                                      id={`edit-group-${groupIndex}-parameter-${parameterIndex}-text`}
                                      type="text"
                                      bind:value={parameter.value_string}
                                      on:input={(event) =>
                                        handleParameterStringInput(
                                          groupIndex,
                                          parameterIndex,
                                          event,
                                        )}
                                    />
                                    {#if parameterValueHistory(group.group_name, parameter.parameter_name, "string").length > 0}
                                      <label
                                        class="form-label form-label-sm mt-2"
                                        for={`edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`}
                                        >Reuse previous value</label
                                      >
                                      <select
                                        class="form-select form-select-sm"
                                        id={`edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-text`}
                                        on:change={(event) => {
                                          const suggestion =
                                            parameterValueHistory(
                                              group.group_name,
                                              parameter.parameter_name,
                                              "string",
                                            )[
                                              Number(event.currentTarget.value)
                                            ];
                                          if (suggestion) {
                                            applyParameterHistorySuggestion(
                                              groupIndex,
                                              parameterIndex,
                                              suggestion,
                                              "string",
                                            );
                                          }
                                          event.currentTarget.value = "";
                                        }}
                                      >
                                        <option value=""
                                          >Choose prior value</option
                                        >
                                        {#each parameterValueHistory(group.group_name, parameter.parameter_name, "string") as suggestion, suggestionIndex}
                                          <option value={suggestionIndex}
                                            >{suggestion.value_string} ({suggestion.count})</option
                                          >
                                        {/each}
                                      </select>
                                    {/if}
                                  </div>
                                {:else}
                                  <div class="col-12 col-lg-3">
                                    <label
                                      class="form-label"
                                      for={`edit-group-${groupIndex}-parameter-${parameterIndex}-number`}
                                      >Numeric value</label
                                    >
                                    <input
                                      class="form-control"
                                      id={`edit-group-${groupIndex}-parameter-${parameterIndex}-number`}
                                      type="number"
                                      step="any"
                                      bind:value={parameter.value_number}
                                      on:input={() =>
                                        (parameterGroups = [
                                          ...parameterGroups,
                                        ])}
                                    />
                                    {#if parameterValueHistory(group.group_name, parameter.parameter_name, "number").length > 0}
                                      <label
                                        class="form-label form-label-sm mt-2"
                                        for={`edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`}
                                        >Reuse previous value</label
                                      >
                                      <select
                                        class="form-select form-select-sm"
                                        id={`edit-group-${groupIndex}-parameter-${parameterIndex}-reuse-number`}
                                        on:change={(event) => {
                                          const suggestion =
                                            parameterValueHistory(
                                              group.group_name,
                                              parameter.parameter_name,
                                              "number",
                                            )[
                                              Number(event.currentTarget.value)
                                            ];
                                          if (suggestion) {
                                            applyParameterHistorySuggestion(
                                              groupIndex,
                                              parameterIndex,
                                              suggestion,
                                              "number",
                                            );
                                          }
                                          event.currentTarget.value = "";
                                        }}
                                      >
                                        <option value=""
                                          >Choose prior value</option
                                        >
                                        {#each parameterValueHistory(group.group_name, parameter.parameter_name, "number") as suggestion, suggestionIndex}
                                          <option value={suggestionIndex}
                                            >{suggestion.value_number}{suggestion.unit
                                              ? ` ${suggestion.unit}`
                                              : ""} ({suggestion.count})</option
                                          >
                                        {/each}
                                      </select>
                                    {/if}
                                  </div>
                                  <div class="col-12 col-lg-3">
                                    <label
                                      class="form-label"
                                      for={`edit-group-${groupIndex}-parameter-${parameterIndex}-unit`}
                                      >Unit</label
                                    >
                                    <select
                                      class="form-select"
                                      id={`edit-group-${groupIndex}-parameter-${parameterIndex}-unit`}
                                      bind:value={parameter.unit}
                                      on:change={(event) =>
                                        updateParameterUnit(
                                          groupIndex,
                                          parameterIndex,
                                          event.currentTarget.value,
                                        )}
                                    >
                                      <option value="">No unit</option>
                                      {#each GLOBAL_UNIT_OPTIONS as unitOption}
                                        <option value={unitOption}
                                          >{unitOption}</option
                                        >
                                      {/each}
                                      <option value="__custom__">Custom…</option
                                      >
                                    </select>
                                  </div>
                                  {#if parameter.unit === "__custom__"}
                                    <div class="col-12 col-lg-2">
                                      <label
                                        class="form-label"
                                        for={`edit-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`}
                                        >Custom unit</label
                                      >
                                      <input
                                        class="form-control"
                                        id={`edit-group-${groupIndex}-parameter-${parameterIndex}-custom-unit`}
                                        type="text"
                                        bind:value={parameter.custom_unit}
                                        on:input={() =>
                                          (parameterGroups = [
                                            ...parameterGroups,
                                          ])}
                                      />
                                    </div>
                                  {/if}
                                {/if}
                                <div class="col-12 col-lg-2">
                                  <div class="d-flex flex-wrap gap-2">
                                    <button
                                      class="btn btn-outline-secondary btn-sm"
                                      on:click={() =>
                                        moveParameter(
                                          groupIndex,
                                          parameterIndex,
                                          -1,
                                        )}
                                      disabled={group._pending_delete ||
                                        parameter._pending_delete ||
                                        parameterIndex === 0}>Up</button
                                    >
                                    <button
                                      class="btn btn-outline-secondary btn-sm"
                                      on:click={() =>
                                        moveParameter(
                                          groupIndex,
                                          parameterIndex,
                                          1,
                                        )}
                                      disabled={group._pending_delete ||
                                        parameter._pending_delete ||
                                        parameterIndex ===
                                          group.parameters.length - 1}
                                      >Down</button
                                    >
                                    <button
                                      class={`btn btn-sm ${parameter._pending_delete ? "btn-outline-success" : "btn-outline-danger"}`}
                                      on:click={() =>
                                        removeParameter(
                                          groupIndex,
                                          parameterIndex,
                                        )}
                                      disabled={group._pending_delete}
                                    >
                                      {parameter._pending_delete
                                        ? "Undo Delete"
                                        : "Delete"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {#if parameter._pending_delete}
                                <p class="small text-danger-emphasis mt-3 mb-0">
                                  This parameter is marked for deletion. Save
                                  Changes to apply the deletion.
                                </p>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-body-secondary mt-3 mb-0">
                  No parameter groups yet. Load type presets or add a group
                  manually.
                </p>
              {/if}
            </AccordionCard>
          </div>
        </div>

        <div class="col-12 col-xxl-6">
          <div class="vstack gap-3">
            <AccordionCard
              title="Media and generated assets"
              description="Manage product images, exports, and band-graph styling."
              bind:open={editMediaAssetsOpen}
            >
              <ProductMediaPanel
                bind:pendingImageFiles
                {productForm}
                {productImages}
                {currentProduct}
                productPdfJob={refreshingProductPdfJob}
                {refreshingProductGraphId}
                {selectedProductId}
                {graphStyleForm}
                showBandGraphStyle={productSupportsBandGraphStyle()}
                {graphLineValueLabel}
                {uploadImages}
                {moveProductImage}
                {removeProductImage}
                {generateProductGraph}
                {generateProductPdf}
                {saveBandGraphStyle}
              />
            </AccordionCard>

            <AccordionCard
              title={`${graphLineValueLabel()} line management`}
              description="Add, reorder, and style the main graph lines."
              bind:open={editLineManagementOpen}
            >
              <div class="row g-3 align-items-end">
                <div class="col-12 col-md-4">
                  <label class="form-label" for="new-rpm-line"
                    >New {graphLineValueLabel()} line</label
                  >
                  <input
                    class="form-control"
                    id="new-rpm-line"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    bind:value={newRpmLineValue}
                    on:keydown={handleIntegerInputKeydown}
                    on:input={(event) =>
                      (newRpmLineValue = sanitizeIntegerInputValue(
                        event.currentTarget.value,
                      ))}
                  />
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label" for="new-rpm-line-band-color"
                    >Band colour</label
                  >
                  <div class="input-group">
                    <input
                      class="form-control form-control-color"
                      id="new-rpm-line-band-color"
                      type="color"
                      bind:value={newRpmLineBandColor}
                    />
                    <input
                      class="form-control"
                      type="text"
                      bind:value={newRpmLineBandColor}
                      placeholder="#60a5fa"
                    />
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-primary" on:click={addRpmLine}
                      >Add {graphLineValueLabel()} Line</button
                    >
                  </div>
                </div>
              </div>
              {#if rpmLines.length > 0}
                <div class="vstack gap-2 mt-3">
                  {#each rpmLines as line}
                    <div class="border rounded p-2">
                      <div class="row g-2 align-items-end">
                        <div class="col-12 col-md-3">
                          <label
                            class="form-label form-label-sm"
                            for={`rpm-line-value-${line.id}`}
                            >{graphLineValueLabel()}</label
                          >
                          <input
                            class="form-control form-control-sm"
                            id={`rpm-line-value-${line.id}`}
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            bind:value={line.rpm}
                            on:keydown={handleIntegerInputKeydown}
                            on:input={(event) => {
                              line.rpm = sanitizeIntegerInputValue(
                                event.currentTarget.value,
                              );
                              rpmLines = [...rpmLines];
                            }}
                          />
                        </div>
                        <div class="col-12 col-md-5">
                          <label
                            class="form-label form-label-sm"
                            for={`rpm-line-band-color-${line.id}`}
                            >Band colour</label
                          >
                          <div class="input-group input-group-sm">
                            <input
                              class="form-control form-control-color"
                              id={`rpm-line-band-color-${line.id}`}
                              type="color"
                              bind:value={line.band_color}
                              on:input={() => (rpmLines = [...rpmLines])}
                            />
                            <input
                              class="form-control"
                              type="text"
                              bind:value={line.band_color}
                              placeholder="#60a5fa"
                              on:input={() => (rpmLines = [...rpmLines])}
                            />
                          </div>
                        </div>
                        <div class="col-12 col-md-4">
                          <div class="d-flex flex-wrap gap-2">
                            <button
                              class="btn btn-outline-primary btn-sm"
                              on:click={() => saveRpmLineStyle(line)}
                              >Save</button
                            >
                            <button
                              class="btn btn-outline-secondary btn-sm"
                              on:click={() => removeRpmLine(line)}
                              >Delete</button
                            >
                          </div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-body-secondary mt-3 mb-0">
                  No {graphLineValueLabel().toLowerCase()} lines yet.
                </p>
              {/if}
            </AccordionCard>

            {#if productSupportsGraph()}
              <AccordionCard
                title="Graph data"
                description="Import, edit, and drag graph points for this product."
                bind:open={editGraphDataOpen}
              >
                <div class="vstack gap-3">
                  {#if productSupportsGraphOverlays()}
                    <div class="card shadow-sm">
                      <div class="card-body">
                        <label class="form-label" for="edit-permissible-use-mode">Permissible-use shading mode</label>
                        <select class="form-select" id="edit-permissible-use-mode" bind:value={productForm.permissible_use_mode}>
                          {#each PERMISSIBLE_USE_MODE_OPTIONS as option}
                            <option value={option.value} disabled={permissibleUseModeDisabled(option.value)}>{option.label}</option>
                          {/each}
                        </select>
                        {#if permissibleUseModeHelp(productForm.permissible_use_mode)}
                          <div class="form-text text-warning">{permissibleUseModeHelp(productForm.permissible_use_mode)}</div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                  <div class="card shadow-sm">
                    <div class="card-body">
                      <h3 class="h6 mb-2">Graph Data</h3>
                      <p class="text-body-secondary mb-2">
                        Use one wide CSV or XLSX workbook per graph. Required
                        first column: <code>airflow_l_s</code>. Supported
                        dynamic columns:
                        <code>pressure_650rpm</code>,
                        <code>pressure_813rpm</code>, etc.
                        {#if productSupportsGraphOverlays()}
                          Overlay columns also supported: <code
                            >efficiency_centre</code
                          >, <code>efficiency_lower_end</code>,
                          <code>efficiency_higher_end</code>,
                          <code>permissible_use</code>.
                        {/if}
                      </p>
                      <label class="form-label" for="graph-csv-file"
                        >Import Graph CSV or XLSX file</label
                      >
                      <div class="d-flex flex-wrap align-items-end gap-3 mb-2">
                        <div class="form-check form-switch mb-0">
                          <input
                            class="form-check-input"
                            id="graph-csv-downsample-enabled"
                            type="checkbox"
                            bind:checked={graphCsvDownsampleImportedCurves}
                          />
                          <label
                            class="form-check-label"
                            for="graph-csv-downsample-enabled"
                          >
                            Downsample imported curves
                          </label>
                        </div>
                        {#if productSupportsGraphOverlays()}
                          <div class="form-check form-switch">
                            <input id="graph-auto-scale" class="form-check-input" type="checkbox" bind:checked={graphCsvAutoScaleOverlays} />
                            <label for="graph-auto-scale" class="form-check-label">Align efficiency and permissible-use lines to highest RPM curve</label>
                          </div>
                        {/if}
                        {#if productSupportsGraphOverlays() && productForm.permissible_use_mode === "dedicated"}
                          <div class="form-check form-switch mb-0">
                            <input
                              class="form-check-input"
                              id="graph-csv-permissible-source-lower"
                              type="checkbox"
                              bind:checked={graphCsvUseLowerEfficiencyLine}
                            />
                            <label
                              class="form-check-label"
                              for="graph-csv-permissible-source-lower"
                            >
                              Generate missing permissible use from lower efficiency line
                            </label>
                          </div>
                        {/if}
                        <div>
                          <label
                            class="form-label form-label-sm mb-1"
                            for="graph-csv-downsample-count"
                            >Points per curve</label
                          >
                          <input
                            class="form-control form-control-sm"
                            id="graph-csv-downsample-count"
                            type="number"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            min="2"
                            step="1"
                            bind:value={graphCsvDownsamplePointCount}
                            disabled={!graphCsvDownsampleImportedCurves}
                            on:keydown={handleIntegerInputKeydown}
                            on:input={(event) =>
                              (graphCsvDownsamplePointCount =
                                sanitizeIntegerInputValue(
                                  event.currentTarget.value,
                                ))}
                            style="width: 7rem;"
                          />
                        </div>
                      </div>
                      <p class="text-body-secondary small mb-2">
                        {#if graphCsvDownsampleImportedCurves}
                          Simplification keeps endpoints and prioritises bends. Changes appear immediately; manual edits become the reference for later option changes.
                        {:else}
                          Reference points are shown without simplification. Changes appear immediately; save when the preview is ready.
                        {/if}
                      </p>
                      {#if productSupportsGraphOverlays() && productForm.permissible_use_mode === "dedicated"}
                        <p class="text-body-secondary small mb-2">
                          Missing permissible-use values are copied from the
                          {graphCsvUseLowerEfficiencyLine ? " lower" : " upper"}
                          efficiency line. Uploaded permissible-use values are preserved.
                        </p>
                      {/if}
                      {#if productSupportsGraphOverlays()}
                        <p class="text-body-secondary small mb-2">
                          Automatic alignment changes efficiency and permissible-use pressure values. Leave it off to preserve supplied values.
                        </p>
                      {/if}
                      <input
                        bind:this={graphCsvInput}
                        class="form-control"
                        id="graph-csv-file"
                        type="file"
                        accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                        on:change={handleGraphCsvFileChange}
                      />
                      {#if graphCsvPreview}
                        <div class="border rounded-3 bg-body-tertiary p-3 mt-3">
                          <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-2">
                            <div>
                              <h4 class="h6 mb-1">Import preview</h4>
                              <p class="text-body-secondary small mb-0">
                                {graphCsvPreview.fileName} · {graphCsvPreview.rowCount}
                                data row{graphCsvPreview.rowCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            {#if graphCsvPreview.changedHeaders.length}
                              <span class="badge text-bg-warning">Headers normalized</span>
                            {:else}
                              <span class="badge text-bg-secondary">No header changes</span>
                            {/if}
                          </div>
                          <p class="text-body-secondary small mb-2">
                            <code>#N/A</code> replacements:
                            {graphCsvPreview.replacedNaNCount}
                          </p>
                          <div class="small overflow-auto">
                            <table class="table table-sm table-borderless align-middle mb-0">
                              <thead>
                                <tr>
                                  <th scope="col" class="text-body-secondary">Original</th>
                                  <th scope="col" class="text-body-secondary">Normalized</th>
                                </tr>
                              </thead>
                              <tbody>
                                {#each graphCsvPreview.headerPairs as pair}
                                  <tr>
                                    <td><code>{pair.original || " "}</code></td>
                                    <td><code>{pair.normalized || " "}</code></td>
                                  </tr>
                                {/each}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      {/if}
                      <p class="text-body-secondary small mt-2 mb-0">
                        {graphCsvPlaceholder()}
                      </p>
                      {#if graphCsvFileName}
                        <p class="small mb-0 mt-2">
                          Loaded file: <strong>{graphCsvFileName}</strong>
                        </p>
                      {/if}
                      {#if graphCsvError}
                        <p class="text-danger mb-0 mt-2">{graphCsvError}</p>
                      {/if}
                      <div class="d-flex flex-wrap gap-2 mt-3">
                        <button
                          class="btn btn-outline-secondary"
                          on:click={clearGraphCsvSelection}
                          >Clear File Selection</button
                        >
                        <button
                          class="btn btn-outline-secondary"
                          on:click={exportGraphCsv}
                          disabled={rpmPoints.length === 0 &&
                            efficiencyPoints.length === 0}
                          >Export Graph CSV</button
                        >
                      </div>
                      <p class="small text-body-secondary mt-3 mb-0">
                        Selecting a CSV overwrites the graph data shown on this
                        page immediately. Review the tables and chart, then
                        press <strong>Save Changes</strong> to commit the imported
                        changes to the database.
                      </p>
                    </div>
                  </div>

                  <div class="card shadow-sm">
                    <div class="card-body">
                      <h6 class="card-title mb-3">
                        {graphLineValueLabel()} points
                      </h6>
                      <GraphPointPagination total={rpmPoints.length} bind:page={rpmPointPage} />
                    <div class="table-responsive">
                        <table
                          class="table table-sm align-middle editable-table mb-0"
                        >
                          <thead>
                            <tr>
                              <th>{graphLineValueLabel()}</th>
                              <th>
                                <button
                                  type="button"
                                  class="btn btn-outline-secondary btn-sm"
                                  on:click={() => toggleRpmPointSort("airflow")}
                                >
                                  {graphXAxisLabel()} ({sortIndicator(
                                    "airflow",
                                  )})
                                </button>
                              </th>
                              <th>
                                <button
                                  type="button"
                                  class="btn btn-outline-secondary btn-sm"
                                  on:click={() =>
                                    toggleRpmPointSort("pressure")}
                                >
                                  {graphYAxisLabel()} ({sortIndicator(
                                    "pressure",
                                  )})
                                </button>
                              </th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each rpmPoints.slice(rpmPointPage * 100, (rpmPointPage + 1) * 100) as p}
                              <tr>
                                <td>{formatGraphLineValue(p.rpm)}</td>
                                <td
                                  ><input
                                    class={`form-control form-control-sm ${editorNumericInputClass(p.airflow)}`}
                                    style="min-width: 90px;"
                                    type="number"
                                      step="any"
                                    inputmode="decimal"

                                    bind:value={p.airflow}

                                    on:input={(event) => {
                                      p.airflow = event.currentTarget.value;
                                      rpmPoints = [...rpmPoints];
                                    }}
                                  /></td
                                >
                                <td
                                  ><input
                                    class={`form-control form-control-sm ${editorNumericInputClass(p.pressure)}`}
                                    style="min-width: 90px;"
                                    type="number"
                                      step="any"
                                    inputmode="decimal"

                                    bind:value={p.pressure}

                                    on:input={(event) => {
                                      p.pressure = event.currentTarget.value;
                                      rpmPoints = [...rpmPoints];
                                    }}
                                  /></td
                                >
                                <td
                                  ><button
                                    class="btn btn-danger btn-sm"
                                    on:click={() => deleteRpmPointLocal(p)}
                                    >Delete</button
                                  ></td
                                >
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                      {#if rpmPoints.length === 0}
                        <p class="text-body-secondary mb-0">
                          No graph points yet.
                        </p>
                      {/if}
                    </div>
                  </div>

                  {#if productSupportsGraphOverlays()}
                    <div class="card shadow-sm">
                      <div class="card-body">
                        <h6 class="card-title mb-3">
                          Efficiency / permissible points
                        </h6>
                        {#if productForm.permissible_use_mode === "dedicated"}
                          <div class="d-flex flex-wrap align-items-end gap-2 mb-3">
                            <div class="form-check form-switch mb-1">
                              <input
                                class="form-check-input"
                                id="editor-permissible-source-lower"
                                type="checkbox"
                                bind:checked={editorUseLowerEfficiencyLine}
                              />
                              <label class="form-check-label" for="editor-permissible-source-lower">
                                Generate missing permissible use from lower efficiency line
                              </label>
                            </div>
                            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={generateMissingPermissibleUseLocally}>
                              Generate missing permissible use
                            </button>
                          </div>
                        {/if}
                        <div class="row g-2 mb-3">
                          <div class="col-12 col-md-3">
                            <label
                              class="form-label form-label-sm"
                              for="scale-efficiency-centre"
                              >Centre scale factor</label
                            >
                            <div class="input-group input-group-sm">
                              <input
                                class="form-control"
                                id="scale-efficiency-centre"
                                type="number"
                                step="any"
                                bind:value={
                                  efficiencyScaleFactors.efficiency_centre
                                }
                              />
                              <button
                                class="btn btn-outline-secondary"
                                type="button"
                                on:click={() =>
                                  applyEfficiencyScaleFactor(
                                    "efficiency_centre",
                                    efficiencyScaleFactors.efficiency_centre,
                                  )}>Apply</button
                              >
                            </div>
                          </div>
                          <div class="col-12 col-md-3">
                            <label
                              class="form-label form-label-sm"
                              for="scale-efficiency-lower"
                              >Lower scale factor</label
                            >
                            <div class="input-group input-group-sm">
                              <input
                                class="form-control"
                                id="scale-efficiency-lower"
                                type="number"
                                step="any"
                                bind:value={
                                  efficiencyScaleFactors.efficiency_lower_end
                                }
                              />
                              <button
                                class="btn btn-outline-secondary"
                                type="button"
                                on:click={() =>
                                  applyEfficiencyScaleFactor(
                                    "efficiency_lower_end",
                                    efficiencyScaleFactors.efficiency_lower_end,
                                  )}>Apply</button
                              >
                            </div>
                          </div>
                          <div class="col-12 col-md-3">
                            <label
                              class="form-label form-label-sm"
                              for="scale-efficiency-higher"
                              >Higher scale factor</label
                            >
                            <div class="input-group input-group-sm">
                              <input
                                class="form-control"
                                id="scale-efficiency-higher"
                                type="number"
                                step="any"
                                bind:value={
                                  efficiencyScaleFactors.efficiency_higher_end
                                }
                              />
                              <button
                                class="btn btn-outline-secondary"
                                type="button"
                                on:click={() =>
                                  applyEfficiencyScaleFactor(
                                    "efficiency_higher_end",
                                    efficiencyScaleFactors.efficiency_higher_end,
                                  )}>Apply</button
                              >
                            </div>
                          </div>
                          <div class="col-12 col-md-3">
                            <label
                              class="form-label form-label-sm"
                              for="scale-permissible-use"
                              >Permissible scale factor</label
                            >
                            <div class="input-group input-group-sm">
                              <input
                                class="form-control"
                                id="scale-permissible-use"
                                type="number"
                                step="any"
                                bind:value={
                                  efficiencyScaleFactors.permissible_use
                                }
                              />
                              <button
                                class="btn btn-outline-secondary"
                                type="button"
                                on:click={() =>
                                  applyEfficiencyScaleFactor(
                                    "permissible_use",
                                    efficiencyScaleFactors.permissible_use,
                                  )}>Apply</button
                              >
                            </div>
                          </div>
                        </div>
                        <p class="text-body-secondary small mb-3">
                          These scale the current draft values for each overlay
                          column and round the result back to whole numbers.
                        </p>
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                          <button
                            class="btn btn-outline-primary btn-sm"
                            type="button"
                            on:click={scaleEfficiencyLinesToHighestRpm}
                            disabled={!rpmLines.length || !rpmPoints.length || !efficiencyPoints.length}
                          >Scale lines to highest RPM</button>
                          <span class="small text-body-secondary">
                            Aligns each overlay line with the highest RPM curve at its peak airflow.
                          </span>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                          <span class="small text-body-secondary me-1">
                            Switch efficiency lines:
                          </span>
                          <button
                            class="btn btn-outline-secondary btn-sm"
                            type="button"
                            on:click={() =>
                              swapEfficiencyLineFields(
                                "efficiency_centre",
                                "efficiency_lower_end",
                                "Centre",
                                "Lower End",
                              )}
                          >Centre ↔ Lower End</button>
                          <button
                            class="btn btn-outline-secondary btn-sm"
                            type="button"
                            on:click={() =>
                              swapEfficiencyLineFields(
                                "efficiency_centre",
                                "efficiency_higher_end",
                                "Centre",
                                "Higher End",
                              )}
                          >Centre ↔ Higher End</button>
                          <button
                            class="btn btn-outline-secondary btn-sm"
                            type="button"
                            on:click={() =>
                              swapEfficiencyLineFields(
                                "efficiency_lower_end",
                                "efficiency_higher_end",
                                "Lower End",
                                "Higher End",
                              )}
                          >Lower End ↔ Higher End</button>
                        </div>
                        <GraphPointPagination total={efficiencyPoints.length} bind:page={efficiencyPointPage} />
                    <div class="table-responsive">
                          <table
                            class="table table-sm align-middle editable-table mb-0"
                          >
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
                              {#each efficiencyPoints.slice(efficiencyPointPage * 100, (efficiencyPointPage + 1) * 100) as p}
                                <tr>
                                  <td
                                    ><input
                                      class={`form-control form-control-sm ${editorNumericInputClass(p.airflow)}`}
                                      style="min-width: 90px;"
                                      type="number"
                                      step="any"
                                      inputmode="decimal"

                                      bind:value={p.airflow}

                                      on:input={(event) => {
                                        p.airflow = event.currentTarget.value;
                                        efficiencyPoints = [
                                          ...efficiencyPoints,
                                        ];
                                      }}
                                    /></td
                                  >
                                  <td
                                    ><input
                                      class={`form-control form-control-sm ${editorNumericInputClass(p.efficiency_centre)}`}
                                      style="min-width: 90px;"
                                      type="number"
                                      step="any"
                                      inputmode="decimal"

                                      bind:value={p.efficiency_centre}

                                      on:input={(event) => {
                                        p.efficiency_centre = event.currentTarget.value;
                                        efficiencyPoints = [
                                          ...efficiencyPoints,
                                        ];
                                      }}
                                    /></td
                                  >
                                  <td
                                    ><input
                                      class={`form-control form-control-sm ${editorNumericInputClass(p.efficiency_lower_end)}`}
                                      style="min-width: 90px;"
                                      type="number"
                                      step="any"
                                      inputmode="decimal"

                                      bind:value={p.efficiency_lower_end}

                                      on:input={(event) => {
                                        p.efficiency_lower_end = event.currentTarget.value;
                                        efficiencyPoints = [
                                          ...efficiencyPoints,
                                        ];
                                      }}
                                    /></td
                                  >
                                  <td
                                    ><input
                                      class={`form-control form-control-sm ${editorNumericInputClass(p.efficiency_higher_end)}`}
                                      style="min-width: 90px;"
                                      type="number"
                                      step="any"
                                      inputmode="decimal"

                                      bind:value={p.efficiency_higher_end}

                                      on:input={(event) => {
                                        p.efficiency_higher_end = event.currentTarget.value;
                                        efficiencyPoints = [
                                          ...efficiencyPoints,
                                        ];
                                      }}
                                    /></td
                                  >
                                  <td
                                    ><input
                                      class={`form-control form-control-sm ${editorNumericInputClass(p.permissible_use)}`}
                                      style="min-width: 90px;"
                                      type="number"
                                      step="any"
                                      inputmode="decimal"

                                      bind:value={p.permissible_use}

                                      on:input={(event) => {
                                        p.permissible_use = event.currentTarget.value;
                                        efficiencyPoints = [
                                          ...efficiencyPoints,
                                        ];
                                      }}
                                    /></td
                                  >
                                  <td
                                    ><button
                                      class="btn btn-danger btn-sm"
                                      on:click={() =>
                                        deleteEfficiencyPointLocal(p)}
                                      >Delete</button
                                    ></td
                                  >
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                        {#if efficiencyPoints.length === 0}
                          <p class="text-body-secondary mb-0">
                            No efficiency/permissible points yet.
                          </p>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  {#if rpmPoints.length > 0 || efficiencyPoints.length > 0}
                    <div class="card shadow-sm">
                      <div class="card-body">
                        <h6 class="card-title mb-3">Map points chart</h6>
                        <div
                          class="d-flex flex-wrap align-items-center gap-2 mb-3"
                        >
                          <label class="form-label mb-0" for="chart-add-target"
                            >Line to add points on</label
                          >
                          <select
                            class="form-select w-auto"
                            id="chart-add-target"
                            bind:value={chartAddTarget}
                          >
                            <option value="off">-Off-</option>
                            {#each rpmLines as line}
                              <option value={`rpm:${line.id}`}
                                >{formatGraphLineValue(line.rpm)} line</option
                              >
                            {/each}
                            {#each currentOverlayLineDefinitions() as definition}
                              <option value={`efficiency:${definition.key}`}
                                >{definition.label}</option
                              >
                            {/each}
                          </select>
                        </div>
                        <p class="text-body-secondary">
                          Drag existing points to edit them. Set the dropdown
                          above to a line when you want chart clicks to add
                          points. Set it to -Off- to disable point adding. Hold
                          either Shift key while left clicking a point to delete
                          it.
                        </p>
                        <ECharts
                          option={mapChartOption}
                          height="750px"
                          on={{ dragend: handleMapChartDragEnd }}
                          onChartReady={(c) => {
                            chartInstance = c;
                            setupChartDrag();
                          }}
                        />
                      </div>
                    </div>
                  {/if}
                </div>
              </AccordionCard>
            {/if}
          </div>
        </div>
        {#if isFanAcousticTableVisible()}
          <div class="mt-3">
            <AccordionCard
              title="Fan Acoustic Table"
              description="Rows stay aligned to the current RPM graph rows. Sound power columns can be added, removed, and renamed."
            bind:open={editFanAcousticTableOpen}
          >
            {#if fanAcousticTable}
              <div
                class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"
              >
                <div class="mb-3">
                  <label class="form-label mb-1" for="edit-fan-acoustic-variant">Acoustic table variant</label>
                  <select id="edit-fan-acoustic-variant" class="form-select form-select-sm" value={fanAcousticTable.variant_mode} on:change={handleFanAcousticVariantChange}>
                    {#each FAN_ACOUSTIC_VARIANT_MODES as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                  <p class="form-text mb-0">When set to Default, this is driven by the Motor → Power Supply specification. Single-phase supplies show Running Voltage; all other or unrecognised values show Running Frequency.</p>
                </div>
                <p class="text-body-secondary mb-0">
                    The speed column is read-only and follows the fan graph line
                    order.
                  </p>
                  <div class="d-flex flex-wrap gap-2">
                    <input
                      class="form-control form-control-sm fan-acoustic-csv-input"
                      bind:this={fanAcousticCsvInput}
                      type="file"
                      accept=".csv,text/csv"
                      on:change={handleFanAcousticCsvFileChange}
                    />
                    <button
                      class="btn btn-outline-secondary btn-sm"
                      type="button"
                      on:click={clearFanAcousticCsvSelection}>Clear CSV</button
                    >
                    <button
                      class="btn btn-outline-secondary btn-sm"
                      type="button"
                      on:click={exportFanAcousticCsv}
                      disabled={!fanAcousticTable && rpmLines.length === 0}
                      >Export CSV</button
                    >
                    <button
                      class="btn btn-outline-secondary btn-sm"
                      type="button"
                      on:click={addFanAcousticColumn}>Add Column</button
                    >
                  </div>
                </div>
                {#if fanAcousticCsvFileName}
                  <p class="small mb-2">
                    Loaded file: <strong>{fanAcousticCsvFileName}</strong>
                  </p>
                {/if}
                {#if fanAcousticCsvError}
                  <p class="text-danger mb-2">{fanAcousticCsvError}</p>
                {/if}
                <div class="table-responsive fan-acoustic-table-wrap">
                  <table
                    class="table table-sm align-middle editable-table fan-acoustic-table mb-0"
                  >
                    <thead>
                      <tr>
                        <th>Speed (rpm)</th>
                        <th>Peak Pressure (Pa)</th>
                        <th>Peak Power (kW)</th>
                        <th>{editorFanAcousticRunningColumnLabel}</th>
                        <th>Sound Pressure Level dB @ 3 meters</th>
                        {#each fanAcousticTable.sound_power_columns as column, columnIndex}
                          <th>
                            <div class="d-grid gap-1">
                              <input
                                class="form-control form-control-sm"
                                type="text"
                                bind:value={
                                  fanAcousticTable.sound_power_columns[
                                    columnIndex
                                  ]
                                }
                                on:input={() =>
                                  (fanAcousticTable = { ...fanAcousticTable })}
                              />
                              <button
                                class="btn btn-outline-secondary btn-sm"
                                type="button"
                                on:click={() =>
                                  renameFanAcousticColumn(columnIndex)}
                                >Rename</button
                              >
                              <button
                                class="btn btn-outline-danger btn-sm"
                                type="button"
                                on:click={() =>
                                  removeFanAcousticColumn(columnIndex)}
                                disabled={fanAcousticTable.sound_power_columns
                                  .length <= 1}>Delete</button
                              >
                            </div>
                          </th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody>
                      {#each fanAcousticTable.rows as row, rowIndex}
                        <tr>
                          <td
                            ><input
                              class={`form-control form-control-sm ${editorNumericInputClass(row.speed_rpm)}`}
                              type="number"
                              step="any"
                              bind:value={row.speed_rpm}
                              disabled
                            /></td
                          >
                          <td
                            ><input
                              class={`form-control form-control-sm ${editorNumericInputClass(row.peak_pressure_pa)}`}
                              type="number"
                              step="any"
                              bind:value={row.peak_pressure_pa}
                              on:input={() =>
                                (fanAcousticTable = { ...fanAcousticTable })}
                            /></td
                          >
                          <td
                            ><input
                              class={`form-control form-control-sm ${editorNumericInputClass(row.peak_power_kw)}`}
                              type="number"
                              step="any"
                              bind:value={row.peak_power_kw}
                              on:input={() =>
                                (fanAcousticTable = { ...fanAcousticTable })}
                            /></td
                          >
                        <td>
                          {#if editorFanAcousticVariant === "1ph"}
                            <input class={`form-control form-control-sm ${editorNumericInputClass(row.running_voltage_v)}`} type="number"
                                      step="any" bind:value={row.running_voltage_v} on:input={() => (fanAcousticTable = { ...fanAcousticTable })} />
                          {:else}
                            <input class={`form-control form-control-sm ${editorNumericInputClass(row.running_frequency_hz)}`} type="number"
                                      step="any" bind:value={row.running_frequency_hz} on:input={() => (fanAcousticTable = { ...fanAcousticTable })} />
                          {/if}
                        </td>
                          <td
                            ><input
                              class={`form-control form-control-sm ${editorNumericInputClass(row.sound_pressure_db_3m)}`}
                              type="number"
                              step="any"
                              bind:value={row.sound_pressure_db_3m}
                              on:input={() =>
                                (fanAcousticTable = { ...fanAcousticTable })}
                            /></td
                          >
                          {#each fanAcousticTable.sound_power_columns as column}
                            <td
                              ><input
                                class={`form-control form-control-sm ${editorNumericInputClass(row.sound_power_levels[column])}`}
                                type="number"
                                step="any"
                                bind:value={row.sound_power_levels[column]}
                                on:input={() =>
                                  (fanAcousticTable = { ...fanAcousticTable })}
                              /></td
                            >
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
                {#if fanAcousticTable.rows.length === 0}
                  <p class="text-body-secondary mt-3 mb-0">
                    Load or create RPM lines first so the acoustic table can
                    align itself.
                  </p>
                {/if}
              {/if}
            </AccordionCard>
          </div>
        {/if}
      </div>
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
    background: color-mix(
      in srgb,
      var(--bs-body-bg) 92%,
      var(--bs-secondary-bg) 8%
    );
    border: 1px solid var(--bs-border-color);
    backdrop-filter: blur(8px);
  }

  .spec-group-toggle {
    font-size: 0.95rem;
  }
</style>
