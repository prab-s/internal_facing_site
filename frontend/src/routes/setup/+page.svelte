<script>
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { auth } from '$lib/auth.js';
  import { GLOBAL_UNIT_OPTIONS } from '$lib/config.js';
  import FileManager from '$lib/FileManager.svelte';
  import JobProgressPanel from '$lib/JobProgressPanel.svelte';
  import SetupLogConsole from '$lib/SetupLogConsole.svelte';
  import CustomerFacingDeviceConsole from '$lib/CustomerFacingDeviceConsole.svelte';
  import InternalFacingDeviceConsole from '$lib/InternalFacingDeviceConsole.svelte';
  import {
    changePassword,
    createUser,
    downloadMaintenanceJobFile,
    getTemplates,
    getMaintenanceJob,
    getRegenerationOverview,
    cancelMaintenanceJob,
    getProducts,
    getProductTypes,
    getUsers,
    getSeries,
    startDatabaseBackupBundleJob,
    startMediaBackupChunkJob,
    startDeleteAllGraphImagesJob,
    startRegenerateAllGraphImagesJob,
    startRegenerateAllProductPdfsJob,
    startRegenerateAllSeriesPdfsJob,
    startRegenerateAllProductTypePdfsJob,
    startRegenerateEverythingJob,
    startRefreshAllProductTypesPdfJob,
    startRefreshCustomerFacingCacheJob,
    startRestoreDataBackupBundleJob,
    startRestoreDatabaseBackupBundleJob,
    updateProductType,
    getQuoteRequestNotificationSettings,
    getSmtpSettings,
    updateQuoteRequestNotificationSettings,
    updateSmtpSettings,
    clearSmtpSettings,
    testSmtpSettings,
    updateUser,
    updateUserPassword,
    updateProductTypePresets
  } from '$lib/api.js';

  let users = [];
  let usersLoaded = false;
  let filteredUsers = [];
  let userFilter = '';
  let userError = '';
  let loadingUsers = false;
  let savingUser = false;

  let currentPassword = '';
  let newOwnPassword = '';
  let ownPasswordError = '';
  let savingOwnPassword = false;

  let newUsername = '';
  let newPassword = '';
  let newIsAdmin = false;
  let smtpTestRecipient = '';
  let sendingSmtpTest = false;
  let smtpTestError = '';
  let smtpTestResult = null;
  let smtpSettings = null;
  let smtpForm = { smtp_host: '', smtp_port: 587, smtp_username: '', smtp_password: '', smtp_use_tls: true, smtp_security: 'starttls', smtp_from_address: '' };
  let loadingSmtpSettings = false;
  let savingSmtpSettings = false;
  let clearingSmtpSettings = false;
  let smtpSettingsError = '';
  let smtpPasswordVisible = false;
  let quoteRequestRecipientEmails = '';
  let loadingQuoteRequestRecipients = false;
  let savingQuoteRequestRecipients = false;
  let quoteRequestRecipientsError = '';
  let maintenanceLoading = false;
  let maintenanceErrorToast = '';
  let maintenanceErrorToastTimeout = null;
  let liveLogsOpen = false;
  let customerDeviceLogsOpen = false;
  let internalDeviceLogsOpen = false;
  let dbBackupFile = null;
  let mediaBackupFiles = [];
  const mediaBackupChunks = [
    { id: 'uploaded-images', label: 'Uploaded images', description: 'Product and series images.' },
    { id: 'associated-documents', label: 'Associated documents', description: 'Documents attached to products, series, and product types.' },
    { id: 'generated-graphs', label: 'Generated graphs', description: 'Product and series graph images.' },
    { id: 'generated-pdfs', label: 'Generated PDFs', description: 'Product, series, and product type PDF files.' },
    { id: 'templates', label: 'Templates', description: 'Product, series, product type templates, and the template registry.' }
  ];
  let backupJobs = {};
  let backupLoading = {};
  let backupPollTimeouts = {};
  let maintenanceJob = null;
  let regenerationOverview = { active_job: null, latest_attempt_by_type: {}, last_completed_by_type: {} };
  let maintenanceCancelLoading = false;
  let maintenancePollTimeout = null;
  let pendingMaintenanceConfirmation = null;
  let products = [];
  let productsLoaded = false;
  let loadingProducts = false;
  let series = [];
  let seriesLoaded = false;
  let loadingSeries = false;
  let productTypes = [];
  let productTypesLoaded = false;
  let loadingProductTypes = false;
  let savingTypePresets = false;
  let typePresetError = '';
  let selectedProductTypeId = '';
  let presetGroups = [];
  let presetRpmLines = [];
  let presetEfficiencyPoints = [];
  let presetProductTemplateId = '';
  let presetSeriesTemplateId = '';
  let presetBandGraphStyle = {
    band_graph_background_color: '#ffffff',
    band_graph_label_text_color: '#000000',
    band_graph_faded_opacity: 0.18,
    band_graph_permissible_label_color: '#000000'
  };
  let templateRegistry = { product_templates: [], series_templates: [] };
  let successMessages = [];
  let successToastKey = 0;
  let successDismissTimeout = null;
  let isHttpOrigin = false;
  let seriesByIdMap = new Map();
  let productsByIdMap = new Map();
  const setupSections = [
    { id: 'account', label: 'Account', description: 'Your password and session details.', adminOnly: false },
    { id: 'users', label: 'Users', description: 'Manage internal user accounts.', adminOnly: true },
    { id: 'communications', label: 'Communications', description: 'SMTP and enquiry delivery.', adminOnly: true },
    { id: 'diagnostics', label: 'Diagnostics', description: 'Logs and device activity.', adminOnly: true },
    { id: 'maintenance', label: 'Maintenance', description: 'Customer refresh and generation.', adminOnly: true },
    { id: 'backups', label: 'Backups', description: 'Database and media backup tools.', adminOnly: true },
    { id: 'file-managers', label: 'File Managers', description: 'Manage media and templates.', adminOnly: true },
    { id: 'presets', label: 'Presets', description: 'Product type defaults.', adminOnly: true }
  ];
  let activeSection = 'account';
  let setupPopStateHandler = null;
  const MAINTENANCE_JOB_STORAGE_KEY = 'fan-graphs.active-maintenance-job';

  function normalizeSetupSection(value) {
    const section = String(value || '').toLowerCase();
    return setupSections.some((item) => item.id === section) ? section : 'account';
  }

  function setupSectionFromLocation() {
    if (!browser) return 'account';
    return normalizeSetupSection(new URLSearchParams(window.location.search).get('section'));
  }

  function selectSetupSection(section) {
    const nextSection = normalizeSetupSection(section);
    const selected = setupSections.find((item) => item.id === nextSection);
    if (selected?.adminOnly && !$auth.is_admin) return;
    activeSection = nextSection;
    if (browser) {
      goto(`/setup?section=${encodeURIComponent(nextSection)}`, { replaceState: true, keepFocus: true, noScroll: true });
    }
  }

  function clearSuccessToast() {
    successMessages = [];
    successToastKey += 1;
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
      successDismissTimeout = null;
    }
  }

  function clearMaintenanceErrorToast() {
    maintenanceErrorToast = '';
    if (maintenanceErrorToastTimeout) {
      clearTimeout(maintenanceErrorToastTimeout);
      maintenanceErrorToastTimeout = null;
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

  function addMaintenanceError(message) {
    if (!message) return;
    maintenanceErrorToast = message;
    if (maintenanceErrorToastTimeout) {
      clearTimeout(maintenanceErrorToastTimeout);
    }
    maintenanceErrorToastTimeout = setTimeout(() => {
      clearMaintenanceErrorToast();
    }, 8000);
  }

  onMount(() => {
    isHttpOrigin = browser && window.location.protocol === 'http:';
    activeSection = setupSectionFromLocation();
    setupPopStateHandler = () => (activeSection = setupSectionFromLocation());
    window.addEventListener('popstate', setupPopStateHandler);
    const session = get(auth);
    if (!session.is_admin && activeSection !== 'account') {
      activeSection = 'account';
      goto('/setup?section=account', { replaceState: true, keepFocus: true, noScroll: true });
    }
    if (session.authenticated) {
      loadUsers();
      loadProducts();
      loadSeries();
      loadProductTypes();
      loadTemplates();
      loadSmtpSettings();
      loadQuoteRequestNotificationSettings();
      restoreMaintenanceJob();
    }
  });

  onDestroy(() => {
    if (setupPopStateHandler) {
      window.removeEventListener('popstate', setupPopStateHandler);
    }
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
    }
    if (maintenanceErrorToastTimeout) {
      clearTimeout(maintenanceErrorToastTimeout);
    }
    if (maintenancePollTimeout) {
      clearTimeout(maintenancePollTimeout);
    }
    for (const timeout of Object.values(backupPollTimeouts)) {
      if (timeout) clearTimeout(timeout);
    }
  });

  $: if ($auth.authenticated && !usersLoaded && !loadingUsers) {
    loadUsers();
  }

  $: if ($auth.authenticated && !productTypesLoaded && !loadingProductTypes) {
    loadProductTypes();
  }

  $: if ($auth.authenticated && !productsLoaded && !loadingProducts) {
    loadProducts();
  }

  $: if ($auth.authenticated && !seriesLoaded && !loadingSeries) {
    loadSeries();
  }

  $: showCookieWarning = browser && isHttpOrigin && $auth.authenticated && $auth.cookie_secure;

  $: seriesByIdMap = new Map(series.map((item) => [String(item.id), item]));
  $: productsByIdMap = new Map(products.map((item) => [String(item.id), item]));

  function productTemplates() {
    return templateRegistry.product_templates ?? [];
  }

  function mediaFolderLabelResolver(entry) {
    if (!entry || entry.type !== 'directory') return '';
    const match = String(entry.name || '').match(/^(series|product)_(\d+)$/i);
    if (!match) return '';

    const kind = match[1].toLowerCase();
    const id = match[2];

    if (kind === 'series') {
      const seriesItem = seriesByIdMap.get(id);
      return seriesItem?.name ? `Series ${id} · ${seriesItem.name}` : `Series ${id}`;
    }

    const productItem = productsByIdMap.get(id);
    return productItem?.model ? `Product ${id} · ${productItem.model}` : `Product ${id}`;
  }

  function maintenanceJobTypeIncludes(...needles) {
    const jobType = String(maintenanceJob?.job_type || '');
    return needles.some((needle) => jobType.includes(needle));
  }

  function lastSuccessfulLabel(jobType) {
    const completedAt = regenerationOverview.last_completed_by_type?.[jobType]?.completed_at;
    if (!completedAt) return '';
    const date = new Date(completedAt);
    return Number.isNaN(date.getTime()) ? completedAt : date.toLocaleString();
  }

  function maintenanceJobFor(jobType) {
    if (maintenanceJob?.job_type === jobType) {
      return maintenanceJob;
    }
    if (regenerationOverview.active_job?.job_type === jobType) {
      return regenerationOverview.active_job;
    }
    return regenerationOverview.latest_attempt_by_type?.[jobType]
      || null;
  }

  function setRegenerationJob(job) {
    if (!job) return;
    maintenanceJob = job;
    regenerationOverview = {
      ...regenerationOverview,
      active_job: ['queued', 'running'].includes(job.status) ? job : null,
      latest_attempt_by_type: { ...regenerationOverview.latest_attempt_by_type, [job.job_type]: job },
      last_completed_by_type: job.status === 'completed'
        ? { ...regenerationOverview.last_completed_by_type, [job.job_type]: job }
        : regenerationOverview.last_completed_by_type
    };
  }

  function isPdfMaintenanceJob() {
    return maintenanceJobTypeIncludes(
      'product_pdfs',
      'series_pdfs',
      'product_type_pdfs',
      'product_pdf_',
      'series_pdf_',
      'product_type_pdf_',
      'refresh_all_product_types_pdf'
    );
  }

  function isGraphImageMaintenanceJob() {
    return maintenanceJobTypeIncludes('graph_images', 'graph_image_');
  }

  function isProductPdfMaintenanceJob() {
    return maintenanceJobTypeIncludes('product_pdfs', 'product_pdf_');
  }

  function isSeriesPdfMaintenanceJob() {
    return maintenanceJobTypeIncludes('series_pdfs', 'series_pdf_');
  }

  function isProductTypePdfMaintenanceJob() {
    return maintenanceJobTypeIncludes('product_type_pdfs', 'product_type_pdf_');
  }

  async function loadTemplates() {
    try {
      templateRegistry = await getTemplates();
    } catch (error) {
      typePresetError = error?.message || 'Unable to load templates.';
    }
  }

  async function loadProducts() {
    loadingProducts = true;
    try {
      products = await getProducts();
      productsLoaded = true;
    } catch (error) {
      maintenanceErrorToast = error?.message || 'Unable to load products.';
    } finally {
      loadingProducts = false;
    }
  }

  async function loadSeries() {
    loadingSeries = true;
    try {
      series = await getSeries();
      seriesLoaded = true;
    } catch (error) {
      maintenanceErrorToast = error?.message || 'Unable to load series.';
    } finally {
      loadingSeries = false;
    }
  }

  async function loadUsers() {
    loadingUsers = true;
    userError = '';
    try {
      users = await getUsers();
      usersLoaded = true;
    } catch (error) {
      userError = error?.message || 'Unable to load users.';
    } finally {
      loadingUsers = false;
    }
  }

  async function runSmtpTest(sendEmail = false) {
    sendingSmtpTest = true;
    smtpTestError = '';
    smtpTestResult = null;
    clearSuccessToast();
    try {
      const result = await testSmtpSettings(sendEmail ? { recipient_email: smtpTestRecipient } : {});
      smtpTestResult = result;
      if (result?.success) addSuccess(result.message);
      else smtpTestError = result?.message || 'SMTP test failed.';
    } catch (error) {
      smtpTestError = error?.message || 'Unable to test SMTP settings.';
    } finally {
      sendingSmtpTest = false;
    }
  }

  async function loadSmtpSettings() {
    loadingSmtpSettings = true;
    smtpSettingsError = '';
    try {
      smtpSettings = await getSmtpSettings();
      smtpForm = {
        smtp_host: smtpSettings.smtp_host || '',
        smtp_port: smtpSettings.smtp_port || 587,
        smtp_username: smtpSettings.smtp_username || '',
        smtp_password: '',
        smtp_use_tls: smtpSettings.smtp_use_tls ?? true,
        smtp_security: smtpSettings.smtp_security || (smtpSettings.smtp_use_tls ? 'starttls' : 'none'),
        smtp_from_address: smtpSettings.smtp_from_address || ''
      };
    } catch (error) {
      smtpSettingsError = error?.message || 'Unable to load SMTP settings.';
    } finally {
      loadingSmtpSettings = false;
    }
  }

  async function loadQuoteRequestNotificationSettings() {
    loadingQuoteRequestRecipients = true;
    quoteRequestRecipientsError = '';
    try {
      const settings = await getQuoteRequestNotificationSettings();
      quoteRequestRecipientEmails = (settings.quote_request_recipient_emails || []).join(', ');
    } catch (error) {
      quoteRequestRecipientsError = error?.message || 'Unable to load enquiry recipient settings.';
    } finally {
      loadingQuoteRequestRecipients = false;
    }
  }

  async function saveQuoteRequestNotificationSettings() {
    savingQuoteRequestRecipients = true;
    quoteRequestRecipientsError = '';
    clearSuccessToast();
    try {
      const quote_request_recipient_emails = quoteRequestRecipientEmails
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
      const settings = await updateQuoteRequestNotificationSettings({ quote_request_recipient_emails });
      quoteRequestRecipientEmails = (settings.quote_request_recipient_emails || []).join(', ');
      addSuccess('Enquiry recipients saved.');
    } catch (error) {
      quoteRequestRecipientsError = error?.message || 'Unable to save enquiry recipient settings.';
    } finally {
      savingQuoteRequestRecipients = false;
    }
  }

  async function saveSmtpSettings() {
    savingSmtpSettings = true;
    smtpSettingsError = '';
    clearSuccessToast();
    try {
      const payload = { ...smtpForm };
      if (!payload.smtp_password && smtpSettings?.password_configured) delete payload.smtp_password;
      smtpSettings = await updateSmtpSettings(payload);
      smtpForm = { ...smtpForm, smtp_password: '' };
      addSuccess('SMTP settings saved.');
    } catch (error) {
      smtpSettingsError = error?.message || 'Unable to save SMTP settings.';
    } finally {
      savingSmtpSettings = false;
    }
  }

  async function resetSmtpSettings() {
    if (!confirm('Clear the saved SMTP settings and use environment configuration instead?')) return;
    clearingSmtpSettings = true;
    smtpSettingsError = '';
    try {
      smtpSettings = await clearSmtpSettings();
      smtpForm = {
        smtp_host: smtpSettings.smtp_host || '',
        smtp_port: smtpSettings.smtp_port || 587,
        smtp_username: smtpSettings.smtp_username || '',
        smtp_password: '',
        smtp_use_tls: smtpSettings.smtp_use_tls ?? true,
        smtp_security: smtpSettings.smtp_security || (smtpSettings.smtp_use_tls ? 'starttls' : 'none'),
        smtp_from_address: smtpSettings.smtp_from_address || ''
      };
      addSuccess('Saved SMTP settings cleared.');
    } catch (error) {
      smtpSettingsError = error?.message || 'Unable to clear saved SMTP settings.';
    } finally {
      clearingSmtpSettings = false;
    }
  }

  function createPresetParameterDraft(parameter = {}) {
    const preferredUnit = parameter.preferred_unit ?? '';
    const isCustomUnit = preferredUnit !== '' && !GLOBAL_UNIT_OPTIONS.includes(preferredUnit);
    const valueString = parameter.value_string ?? '';
    const valueNumber = parameter.value_number ?? '';
    const valueType = parameter.value_type ??
      (valueString !== ''
        ? 'string'
        : valueNumber !== '' && valueNumber != null
          ? 'number'
          : preferredUnit !== ''
            ? 'number'
            : 'string');
    return {
      id: parameter.id ?? null,
      _pending_delete: false,
      parameter_name: parameter.parameter_name ?? '',
      preferred_unit: isCustomUnit ? '__custom__' : preferredUnit,
      value_type: valueType,
      value_string: valueString,
      value_number: valueNumber,
      custom_unit: isCustomUnit ? preferredUnit : ''
    };
  }

  function createPresetGroupDraft(group = {}) {
    return {
      id: group.id ?? null,
      _pending_delete: false,
      group_name: group.group_name ?? '',
      parameters: (group.parameter_presets ?? []).map((parameter) => createPresetParameterDraft(parameter))
    };
  }

  function createPresetRpmPointDraft(point = {}) {
    return {
      id: point.id ?? null,
      _pending_delete: false,
      airflow: point.airflow ?? '',
      pressure: point.pressure ?? ''
    };
  }

  function createPresetRpmLineDraft(line = {}) {
    return {
      id: line.id ?? null,
      _pending_delete: false,
      rpm: line.rpm ?? '',
      band_color: line.band_color ?? '',
      points: (line.point_presets ?? []).map((point) => createPresetRpmPointDraft(point))
    };
  }

  function createPresetEfficiencyPointDraft(point = {}) {
    return {
      id: point.id ?? null,
      _pending_delete: false,
      airflow: point.airflow ?? '',
      efficiency_centre: point.efficiency_centre ?? '',
      efficiency_lower_end: point.efficiency_lower_end ?? '',
      efficiency_higher_end: point.efficiency_higher_end ?? '',
      permissible_use: point.permissible_use ?? ''
    };
  }

  function clonePresetGroupsForType(productTypeId) {
    const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
    return (productType?.parameter_group_presets ?? []).map((group) => createPresetGroupDraft(group));
  }

  function clonePresetRpmLinesForType(productTypeId) {
    const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
    return (productType?.rpm_line_presets ?? []).map((line) => createPresetRpmLineDraft(line));
  }

  function clonePresetEfficiencyPointsForType(productTypeId) {
    const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
    return (productType?.efficiency_point_presets ?? []).map((point) => createPresetEfficiencyPointDraft(point));
  }

  function clonePresetProductTemplateIdForType(productTypeId) {
    const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
    return productType?.printed_product_template_id || productType?.product_template_id || productType?.online_product_template_id || '';
  }

  function clonePresetSeriesTemplateIdForType(productTypeId) {
    const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
    return productType?.series_template_id || '';
  }

  function clonePresetBandGraphStyleForType(productTypeId) {
    const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
    return {
      band_graph_background_color: productType?.band_graph_background_color ?? '#ffffff',
      band_graph_label_text_color: productType?.band_graph_label_text_color ?? '#000000',
      band_graph_faded_opacity:
        productType?.band_graph_faded_opacity ?? 0.18,
      band_graph_permissible_label_color: productType?.band_graph_permissible_label_color ?? '#000000'
    };
  }

  function clearPresetDrafts() {
    presetGroups = [];
    presetRpmLines = [];
    presetEfficiencyPoints = [];
    presetProductTemplateId = '';
    presetSeriesTemplateId = '';
    presetBandGraphStyle = clonePresetBandGraphStyleForType('');
  }

  function syncPresetDraftsForSelectedType(productTypeId = selectedProductTypeId) {
    if (!productTypeId) {
      clearPresetDrafts();
      return;
    }

    presetGroups = clonePresetGroupsForType(productTypeId);
    presetRpmLines = clonePresetRpmLinesForType(productTypeId);
    presetEfficiencyPoints = clonePresetEfficiencyPointsForType(productTypeId);
    presetProductTemplateId = clonePresetProductTemplateIdForType(productTypeId);
    presetSeriesTemplateId = clonePresetSeriesTemplateIdForType(productTypeId);
    presetBandGraphStyle = clonePresetBandGraphStyleForType(productTypeId);
  }

  async function loadProductTypes() {
    loadingProductTypes = true;
    typePresetError = '';
    try {
      productTypes = await getProductTypes();
      productTypesLoaded = true;
      const selectedStillExists = productTypes.some((item) => String(item.id) === String(selectedProductTypeId));
      if (!selectedStillExists) {
        selectedProductTypeId = '';
      }
      syncPresetDraftsForSelectedType();
    } catch (error) {
      typePresetError = error?.message || 'Unable to load product types.';
    } finally {
      loadingProductTypes = false;
    }
  }

  function selectProductType(productTypeId) {
    selectedProductTypeId = String(productTypeId || '');
  }

  $: if (productTypesLoaded) {
    if (selectedProductTypeId) {
      syncPresetDraftsForSelectedType(selectedProductTypeId);
    } else {
      clearPresetDrafts();
    }
  }

  function addPresetGroup() {
    presetGroups = [...presetGroups, createPresetGroupDraft()];
  }

  function addPresetRpmLine() {
    presetRpmLines = [...presetRpmLines, createPresetRpmLineDraft()];
  }

  function addPresetEfficiencyPoint() {
    presetEfficiencyPoints = [...presetEfficiencyPoints, createPresetEfficiencyPointDraft()];
  }

  function removePresetGroup(groupIndex) {
    presetGroups = presetGroups.map((group, index) =>
      index === groupIndex
        ? { ...group, _pending_delete: !group._pending_delete }
        : group
    );
  }

  function movePresetGroup(groupIndex, direction) {
    const nextIndex = groupIndex + direction;
    if (nextIndex < 0 || nextIndex >= presetGroups.length) return;
    const reordered = [...presetGroups];
    const [moved] = reordered.splice(groupIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    presetGroups = reordered;
  }

  function addPresetParameter(groupIndex) {
    presetGroups = presetGroups.map((group, index) =>
      index === groupIndex
        ? { ...group, parameters: [...group.parameters, createPresetParameterDraft()] }
        : group
    );
  }

  function removePresetParameter(groupIndex, parameterIndex) {
    presetGroups = presetGroups.map((group, index) =>
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

  function movePresetParameter(groupIndex, parameterIndex, direction) {
    presetGroups = presetGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      const nextIndex = parameterIndex + direction;
      if (nextIndex < 0 || nextIndex >= group.parameters.length) return group;
      const parameters = [...group.parameters];
      const [moved] = parameters.splice(parameterIndex, 1);
      parameters.splice(nextIndex, 0, moved);
      return { ...group, parameters };
    });
  }

  function removePresetRpmLine(lineIndex) {
    presetRpmLines = presetRpmLines.map((line, index) =>
      index === lineIndex
        ? { ...line, _pending_delete: !line._pending_delete }
        : line
    );
  }

  function movePresetRpmLine(lineIndex, direction) {
    const nextIndex = lineIndex + direction;
    if (nextIndex < 0 || nextIndex >= presetRpmLines.length) return;
    const reordered = [...presetRpmLines];
    const [moved] = reordered.splice(lineIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    presetRpmLines = reordered;
  }

  function addPresetRpmPoint(lineIndex) {
    presetRpmLines = presetRpmLines.map((line, index) =>
      index === lineIndex
        ? { ...line, points: [...line.points, createPresetRpmPointDraft()] }
        : line
    );
  }

  function removePresetRpmPoint(lineIndex, pointIndex) {
    presetRpmLines = presetRpmLines.map((line, index) =>
      index === lineIndex
        ? {
            ...line,
            points: line.points.map((point, innerIndex) =>
              innerIndex === pointIndex
                ? { ...point, _pending_delete: !point._pending_delete }
                : point
            )
          }
        : line
    );
  }

  function movePresetRpmPoint(lineIndex, pointIndex, direction) {
    presetRpmLines = presetRpmLines.map((line, index) => {
      if (index !== lineIndex) return line;
      const nextIndex = pointIndex + direction;
      if (nextIndex < 0 || nextIndex >= line.points.length) return line;
      const points = [...line.points];
      const [moved] = points.splice(pointIndex, 1);
      points.splice(nextIndex, 0, moved);
      return { ...line, points };
    });
  }

  function removePresetEfficiencyPoint(pointIndex) {
    presetEfficiencyPoints = presetEfficiencyPoints.map((point, index) =>
      index === pointIndex
        ? { ...point, _pending_delete: !point._pending_delete }
        : point
    );
  }

  function movePresetEfficiencyPoint(pointIndex, direction) {
    const nextIndex = pointIndex + direction;
    if (nextIndex < 0 || nextIndex >= presetEfficiencyPoints.length) return;
    const reordered = [...presetEfficiencyPoints];
    const [moved] = reordered.splice(pointIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    presetEfficiencyPoints = reordered;
  }

  function serializePresetGroups() {
    return presetGroups
      .filter((group) => !group._pending_delete)
      .map((group, groupIndex) => ({
        group_name: group.group_name.trim(),
        sort_order: groupIndex,
        parameters: group.parameters
          .filter((parameter) => !parameter._pending_delete)
          .map((parameter, parameterIndex) => ({
            parameter_name: parameter.parameter_name.trim(),
            value_type: parameter.value_type,
            preferred_unit:
              parameter.value_type === 'number'
                ? ((parameter.preferred_unit === '__custom__' ? parameter.custom_unit : parameter.preferred_unit) || '').trim() || null
                : null,
            value_string:
              parameter.value_type === 'string'
                ? parameter.value_string.trim() || null
                : null,
            value_number:
              parameter.value_type === 'number' && parameter.value_number !== '' && parameter.value_number != null
                ? Number(parameter.value_number)
                : null,
            sort_order: parameterIndex
          }))
      }));
  }

  function updatePresetParameterValueType(groupIndex, parameterIndex, valueType) {
    presetGroups = presetGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      const parameters = group.parameters.map((parameter, innerIndex) => {
        if (innerIndex !== parameterIndex) return parameter;
        return {
          ...parameter,
          value_type: valueType,
          value_string: valueType === 'string' ? parameter.value_string : '',
          value_number: valueType === 'number' ? parameter.value_number : '',
          preferred_unit: valueType === 'number' ? parameter.preferred_unit : '',
          custom_unit: valueType === 'number' ? parameter.custom_unit : ''
        };
      });
      return { ...group, parameters };
    });
  }

  function updatePresetParameterUnit(groupIndex, parameterIndex, unitValue) {
    presetGroups = presetGroups.map((group, index) => {
      if (index !== groupIndex) return group;
      const parameters = group.parameters.map((parameter, innerIndex) => {
        if (innerIndex !== parameterIndex) return parameter;
        return {
          ...parameter,
          preferred_unit: unitValue,
          custom_unit: unitValue === '__custom__' ? parameter.custom_unit : ''
        };
      });
      return { ...group, parameters };
    });
  }

  function serializePresetRpmLines() {
    return presetRpmLines
      .filter((line) => !line._pending_delete)
      .map((line, lineIndex) => ({
        rpm: line.rpm === '' || line.rpm == null ? null : Number(line.rpm),
        band_color: line.band_color.trim() || null,
        points: line.points
          .filter((point) => !point._pending_delete)
          .map((point, pointIndex) => ({
            airflow: point.airflow === '' || point.airflow == null ? null : Number(point.airflow),
            pressure: point.pressure === '' || point.pressure == null ? null : Number(point.pressure),
            sort_order: pointIndex
          }))
      }));
  }

  function serializePresetEfficiencyPoints() {
    return presetEfficiencyPoints
      .filter((point) => !point._pending_delete)
      .map((point, pointIndex) => ({
        airflow: point.airflow === '' || point.airflow == null ? null : Number(point.airflow),
        efficiency_centre:
          point.efficiency_centre === '' || point.efficiency_centre == null ? null : Number(point.efficiency_centre),
        efficiency_lower_end:
          point.efficiency_lower_end === '' || point.efficiency_lower_end == null ? null : Number(point.efficiency_lower_end),
        efficiency_higher_end:
          point.efficiency_higher_end === '' || point.efficiency_higher_end == null ? null : Number(point.efficiency_higher_end),
        permissible_use:
          point.permissible_use === '' || point.permissible_use == null ? null : Number(point.permissible_use),
        sort_order: pointIndex
      }));
  }

  async function savePresetGroups() {
    if (!selectedProductTypeId) {
      typePresetError = 'Choose a product type first.';
      return;
    }

    savingTypePresets = true;
    typePresetError = '';
    clearSuccessToast();
    try {
      await updateProductTypePresets(Number(selectedProductTypeId), {
        product_template_id: presetProductTemplateId || null,
        series_template_id: presetSeriesTemplateId || null,
        parameter_group_presets: serializePresetGroups(),
        rpm_line_presets: serializePresetRpmLines(),
        efficiency_point_presets: serializePresetEfficiencyPoints()
      });
      await updateProductType(Number(selectedProductTypeId), {
        band_graph_background_color: presetBandGraphStyle.band_graph_background_color || null,
        band_graph_label_text_color: presetBandGraphStyle.band_graph_label_text_color || null,
        band_graph_faded_opacity:
          presetBandGraphStyle.band_graph_faded_opacity === '' || presetBandGraphStyle.band_graph_faded_opacity == null
            ? null
            : Number(presetBandGraphStyle.band_graph_faded_opacity),
        band_graph_permissible_label_color: presetBandGraphStyle.band_graph_permissible_label_color || null
      });
      productTypes = await getProductTypes();
      presetGroups = clonePresetGroupsForType(selectedProductTypeId);
      presetRpmLines = clonePresetRpmLinesForType(selectedProductTypeId);
      presetEfficiencyPoints = clonePresetEfficiencyPointsForType(selectedProductTypeId);
      presetProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId);
      presetSeriesTemplateId = clonePresetSeriesTemplateIdForType(selectedProductTypeId);
      presetBandGraphStyle = clonePresetBandGraphStyleForType(selectedProductTypeId);
      addSuccess('Type presets updated.');
    } catch (error) {
      typePresetError = error?.message || 'Unable to save type presets.';
    } finally {
      savingTypePresets = false;
    }
  }

  async function submitNewUser() {
    savingUser = true;
    userError = '';
    clearSuccessToast();
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        is_admin: newIsAdmin
      });
      newUsername = '';
      newPassword = '';
      newIsAdmin = false;
      addSuccess('User created.');
      await loadUsers();
    } catch (error) {
      userError = error?.message || 'Unable to create user.';
    } finally {
      savingUser = false;
    }
  }

  async function toggleUserActive(user) {
    const actionLabel = user.is_active ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.username}?`)) {
      return;
    }
    savingUser = true;
    userError = '';
    clearSuccessToast();
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      addSuccess('User updated.');
      await loadUsers();
    } catch (error) {
      userError = error?.message || 'Unable to update user.';
    } finally {
      savingUser = false;
    }
  }

  async function toggleUserAdmin(user) {
    const actionLabel = user.is_admin ? 'remove admin access from' : 'grant admin access to';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.username}?`)) {
      return;
    }
    savingUser = true;
    userError = '';
    clearSuccessToast();
    try {
      await updateUser(user.id, { is_admin: !user.is_admin });
      addSuccess('User updated.');
      await loadUsers();
    } catch (error) {
      userError = error?.message || 'Unable to update user.';
    } finally {
      savingUser = false;
    }
  }

  async function resetUserPassword(user) {
    const password = window.prompt(`Enter a new password for ${user.username}`);
    if (!password) return;
    savingUser = true;
    userError = '';
    clearSuccessToast();
    try {
      await updateUserPassword(user.id, password);
      addSuccess(`Password updated for ${user.username}.`);
    } catch (error) {
      userError = error?.message || 'Unable to update password.';
    } finally {
      savingUser = false;
    }
  }

  async function submitOwnPasswordChange() {
    savingOwnPassword = true;
    ownPasswordError = '';
    clearSuccessToast();
    try {
      await changePassword(currentPassword, newOwnPassword);
      currentPassword = '';
      newOwnPassword = '';
      addSuccess('Password updated.');
    } catch (error) {
      ownPasswordError = error?.message || 'Unable to update password.';
    } finally {
      savingOwnPassword = false;
    }
  }

  async function pollMaintenanceJob(jobId, options = {}) {
    try {
      const job = await getMaintenanceJob(jobId);
      setRegenerationJob(job);

      if (job.status === 'completed') {
        maintenanceLoading = false;
        if (job.result_download_url && options.downloadOnComplete) {
          const { blob, filename } = await downloadMaintenanceJobFile(job.id);
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(downloadUrl);
        }
        addSuccess(job.result_message || options.successMessage || 'Maintenance task completed.');
        clearMaintenanceErrorToast();
        return;
      }

      if (job.status === 'failed') {
        maintenanceLoading = false;
        addMaintenanceError(job.error || options.errorMessage || 'Maintenance task failed.');
        return;
      }

      if (job.status === 'cancelled') {
        maintenanceLoading = false;
        addMaintenanceError('The regeneration was cancelled.');
        return;
      }

      maintenancePollTimeout = setTimeout(() => pollMaintenanceJob(jobId, options), 1500);
    } catch (error) {
      maintenanceLoading = false;
      if (error?.status === 404 && browser) {
        window.localStorage.removeItem(MAINTENANCE_JOB_STORAGE_KEY);
      }
      addMaintenanceError(error?.message || options.errorMessage || 'Unable to read maintenance job status.');
    }
  }

  async function restoreMaintenanceJob() {
    if (!browser) return;
    clearMaintenanceErrorToast();
    try {
      const overview = await getRegenerationOverview();
      regenerationOverview = overview;
      const activeJob = overview?.active_job;
      const latestJob = activeJob || Object.values(overview?.latest_attempt_by_type || {})[0];
      if (latestJob) {
        maintenanceJob = latestJob;
        maintenanceLoading = ['queued', 'running'].includes(latestJob.status);
        if (maintenanceLoading) {
          await pollMaintenanceJob(latestJob.id, { successMessage: 'Regeneration completed while this page was closed.' });
        }
      }
    } catch (error) {
      const savedJobId = window.localStorage.getItem(MAINTENANCE_JOB_STORAGE_KEY);
      if (savedJobId) {
        maintenanceLoading = true;
        await pollMaintenanceJob(savedJobId, { successMessage: 'Regeneration completed while this page was closed.' });
      } else {
        addMaintenanceError(error?.message || 'Unable to read regeneration status.');
      }
    } finally {
      if (!maintenanceLoading && maintenancePollTimeout) {
        clearTimeout(maintenancePollTimeout);
        maintenancePollTimeout = null;
      }
    }
  }

  async function runMaintenanceJob(starter, options = {}) {
    maintenanceLoading = true;
    clearMaintenanceErrorToast();
    maintenanceJob = null;
    clearSuccessToast();
    try {
      const job = await starter();
      setRegenerationJob(job);
      if (browser && job?.id) {
        window.localStorage.setItem(MAINTENANCE_JOB_STORAGE_KEY, job.id);
      }
      await pollMaintenanceJob(job.id, options);
    } catch (error) {
      addMaintenanceError(error?.message || options.errorMessage || 'Unable to run maintenance task.');
      maintenanceLoading = false;
    } finally {
      if (!maintenanceLoading && maintenancePollTimeout) {
        clearTimeout(maintenancePollTimeout);
        maintenancePollTimeout = null;
      }
    }
  }

  async function cancelCurrentMaintenanceJob(jobToCancel = maintenanceJob) {
    if (!jobToCancel?.id || !['queued', 'running'].includes(jobToCancel.status)) return;
    maintenanceCancelLoading = true;
    try {
      const job = await cancelMaintenanceJob(jobToCancel.id);
      setRegenerationJob(job);
      await pollMaintenanceJob(job.id);
    } catch (error) {
      addMaintenanceError(error?.message || 'Unable to cancel the regeneration.');
    } finally {
      maintenanceCancelLoading = false;
    }
  }

  function setBackupJob(key, job) {
    backupJobs = { ...backupJobs, [key]: job };
  }

  function setBackupLoading(key, value) {
    backupLoading = { ...backupLoading, [key]: value };
  }

  async function pollBackupJob(key, jobId, options = {}) {
    try {
      const job = await getMaintenanceJob(jobId);
      setBackupJob(key, job);

      if (job.status === 'completed') {
        setBackupLoading(key, false);
        if (job.result_download_url && options.downloadOnComplete) {
          const { blob, filename } = await downloadMaintenanceJobFile(job.id);
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(downloadUrl);
        }
        addSuccess(job.result_message || options.successMessage || 'Backup task completed.');
        clearMaintenanceErrorToast();
        return;
      }

      if (job.status === 'failed') {
        setBackupLoading(key, false);
        addMaintenanceError(job.error || options.errorMessage || 'Backup task failed.');
        return;
      }

      backupPollTimeouts = {
        ...backupPollTimeouts,
        [key]: setTimeout(() => pollBackupJob(key, jobId, options), 1500)
      };
    } catch (error) {
      setBackupLoading(key, false);
      addMaintenanceError(error?.message || options.errorMessage || 'Unable to read backup task status.');
    }
  }

  async function runBackupJob(key, starter, options = {}) {
    setBackupLoading(key, true);
    clearMaintenanceErrorToast();
    clearSuccessToast();
    try {
      const job = await starter();
      setBackupJob(key, job);
      await pollBackupJob(key, job.id, options);
    } catch (error) {
      setBackupLoading(key, false);
      addMaintenanceError(error?.message || options.errorMessage || 'Unable to run backup task.');
    }
  }

  function requestMaintenanceConfirmation(starter, options = {}) {
    pendingMaintenanceConfirmation = { starter, options };
  }

  async function confirmPendingMaintenance() {
    const pending = pendingMaintenanceConfirmation;
    pendingMaintenanceConfirmation = null;
    if (!pending) return;
    await runMaintenanceJob(pending.starter, { ...pending.options, confirmMessage: '' });
  }

  function cancelPendingMaintenance() {
    pendingMaintenanceConfirmation = null;
  }

  async function handleDatabaseBackupDownload() {
    await runBackupJob('database', startDatabaseBackupBundleJob, {
      successMessage: 'DB data backup created.',
      errorMessage: 'Unable to create DB data backup.',
      downloadOnComplete: true
    });
  }

  async function handleMediaBackupChunkDownload(chunk) {
    await runBackupJob(chunk.id, () => startMediaBackupChunkJob(chunk.id), {
      successMessage: `${chunk.label} backup created.`,
      errorMessage: `Unable to create ${chunk.label.toLowerCase()} backup.`,
      downloadOnComplete: true
    });
  }

  function handleDbBackupFileChange(event) {
    dbBackupFile = event.currentTarget?.files?.[0] || null;
  }

  function handleMediaBackupFileChange(event) {
    mediaBackupFiles = Array.from(event.currentTarget?.files || []);
  }

  async function handleDbBackupRestore() {
    if (!dbBackupFile) {
      addMaintenanceError('Choose a DB data ZIP file first.');
      clearSuccessToast();
      return;
    }

    const confirmed = window.confirm(
      'Restore this DB data backup? This will overwrite the current database with the uploaded backup.'
    );
    if (!confirmed) {
      return;
    }

    const fileToRestore = dbBackupFile;
    await runBackupJob('database-restore', () => startRestoreDatabaseBackupBundleJob(fileToRestore), {
      successMessage: 'DB data backup restored successfully.',
      errorMessage: 'Unable to restore DB data backup.'
    });
    if (!maintenanceErrorToast) {
      dbBackupFile = null;
      const input = document.getElementById('db-backup-restore-file');
      if (input) {
        input.value = '';
      }
    }
  }

  async function handleMediaBackupRestore() {
    if (!mediaBackupFiles.length) {
      addMaintenanceError('Choose one or more media data ZIP files first.');
      clearSuccessToast();
      return;
    }

    const confirmed = window.confirm(
      'Restore this media data backup? This will overwrite the current media and templates with the uploaded backup.'
    );
    if (!confirmed) {
      return;
    }

    await runBackupJob('media-restore', () => startRestoreDataBackupBundleJob(mediaBackupFiles), {
      successMessage: 'Media data backup restored successfully.',
      errorMessage: 'Unable to restore media data backup.'
    });
    if (!maintenanceErrorToast) {
      mediaBackupFiles = [];
      const input = document.getElementById('media-backup-restore-file');
      if (input) {
        input.value = '';
      }
    }
  }

  $: filteredUsers = users.filter((user) => {
    const needle = userFilter.trim().toLowerCase();
    if (!needle) return true;
    return user.username.toLowerCase().includes(needle);
  });
</script>

<svelte:head>
  <title>Setup - Internal Facing</title>
</svelte:head>

{#if showCookieWarning}
  <div class="alert alert-warning border-0 shadow-sm mb-3">
    <div class="fw-semibold mb-1">Session cookies are marked secure, but this app is being served over HTTP.</div>
    <div class="text-body-secondary mb-0">
      Logins can fail or disappear after reloads until the app is served over HTTPS, or <code>AUTH_COOKIE_SECURE</code> is disabled for local and SIT runs.
    </div>
  </div>
{/if}

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

{#if maintenanceErrorToast}
  <div class="error-toast shadow-lg" role="alert" aria-live="assertive" aria-atomic="true">
    <div class="alert alert-danger mb-0 error-toast-alert">
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div class="me-auto">{maintenanceErrorToast}</div>
        <button class="btn-close" type="button" aria-label="Dismiss error" on:click={clearMaintenanceErrorToast}></button>
      </div>
      {#key maintenanceErrorToast}
        <div class="error-toast-progress"></div>
      {/key}
    </div>
  </div>
{/if}

<div class="setup-hero card shadow-sm mb-4">
  <div class="card-body bg-body-secondary bg-opacity-10 p-4 p-lg-5">
    <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3">
      <div class="setup-hero-copy">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Setup</p>
        <h1 class="h2 mb-2">Account and application setup.</h1>
        <p class="text-body-secondary mb-0">
          Manage your own password here. Admins can also create and manage internal user accounts, inspect live logs,
          and run maintenance tasks from the same page.
        </p>
      </div>
      {#if $auth.is_admin}
        <div class="setup-hero-badge">
          <span class="badge text-bg-dark mb-2">Admin access</span>
          <p class="text-body-secondary mb-0">
            Debug logs are collapsed by default and only connect while the panel is open.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<div class="row g-4 align-items-start setup-shell">
  <aside class="col-12 col-xl-3">
    <div class="card shadow-sm setup-section-nav">
      <div class="card-body bg-body-secondary bg-opacity-10 p-2">
        <p class="small text-uppercase text-body-secondary fw-semibold px-3 pt-2 mb-2">Setup sections</p>
        <nav aria-label="Setup sections">
          {#each setupSections as section}
            {@const locked = section.adminOnly && !$auth.is_admin}
            <button
              class:active={activeSection === section.id}
              class:disabled={locked}
              class="setup-section-nav-item"
              type="button"
              on:click={() => selectSetupSection(section.id)}
              disabled={locked}
              aria-current={activeSection === section.id ? 'page' : undefined}
              title={locked ? 'Administrator access required' : section.description}
            >
              <span class="setup-section-nav-label">{section.label}</span>
              {#if locked}<span class="setup-section-nav-lock" aria-label="Administrator access required">🔒</span>{/if}
              <span class="setup-section-nav-description">{locked ? 'Admin access required' : section.description}</span>
            </button>
          {/each}
        </nav>
      </div>
    </div>
  </aside>

  <div class="col-12 col-xl-9 setup-section-content">
    <div class="row g-4 align-items-start">
  <div class={`col-12 ${activeSection === 'communications' ? 'col-xl-8' : 'col-xl-4'} d-flex flex-column gap-4`}>
    {#if activeSection === 'account'}
    <div class="card shadow-sm">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">My Account</p>
        <h2 class="h4">Change Password</h2>
        <p class="text-body-secondary">Signed in as {$auth.username}.</p>
        <p class="small text-body-secondary mb-0">
          Device IP: IPv4 {$auth.device_ip_v4 || $auth.client_ip_v4 || '—'} · IPv6 {$auth.device_ip_v6 || $auth.client_ip_v6 || '—'}
        </p>

        <form class="vstack gap-3" on:submit|preventDefault={submitOwnPasswordChange}>
          <div>
            <label class="form-label" for="current-password">Current Password</label>
            <input id="current-password" class="form-control" type="password" bind:value={currentPassword} />
          </div>
          <div>
            <label class="form-label" for="new-own-password">New Password</label>
            <input id="new-own-password" class="form-control" type="password" bind:value={newOwnPassword} />
          </div>
          {#if ownPasswordError}
            <div class="alert alert-danger py-2 mb-0">{ownPasswordError}</div>
          {/if}
          <button class="btn btn-primary align-self-start" type="submit" disabled={savingOwnPassword || !currentPassword || !newOwnPassword}>
            {savingOwnPassword ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
    {/if}

    {#if $auth.is_admin && activeSection === 'communications'}
      <div class="card shadow-sm mb-4">
        <div class="card-body bg-body-secondary bg-opacity-10">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Enquiries</p>
              <h2 class="h4">SMTP configuration</h2>
              <p class="text-body-secondary mb-0">Configure the application’s generic SMTP connection for outbound email.</p>
            </div>
            {#if smtpSettings}
              <span class={`badge ${smtpSettings.status === 'configured' ? 'text-bg-success' : 'text-bg-warning'}`}>
                {smtpSettings.status === 'configured' ? 'Configured' : 'Not configured'}
              </span>
            {/if}
          </div>

          {#if smtpSettings}
            <p class="small text-body-secondary mt-3 mb-3">
              Using {smtpSettings.source === 'saved' ? 'saved Setup page settings' : 'environment settings'}.
              {#if smtpSettings.password_configured} Password is saved securely.{/if}
            </p>
          {/if}

          <form class="border-bottom pb-4 mb-4" on:submit|preventDefault={saveQuoteRequestNotificationSettings}>
            <label class="form-label" for="quote-request-recipients">Enquiry notification recipients</label>
            <input
              id="quote-request-recipients"
              class="form-control"
              type="text"
              bind:value={quoteRequestRecipientEmails}
              placeholder="inquiries@example.com, colleague@example.com"
              disabled={loadingQuoteRequestRecipients || savingQuoteRequestRecipients}
            >
            <div class="form-text">Comma-separated addresses. Each submitted enquiry is sent to every address listed; customer replies go to the sender’s address.</div>
            {#if quoteRequestRecipientsError}
              <div class="alert alert-danger py-2 mt-3 mb-0">{quoteRequestRecipientsError}</div>
            {/if}
            <button class="btn btn-outline-primary mt-3" type="submit" disabled={loadingQuoteRequestRecipients || savingQuoteRequestRecipients}>
              {savingQuoteRequestRecipients ? 'Saving...' : 'Save Recipients'}
            </button>
          </form>

          <form class="row g-3 mt-1" on:submit|preventDefault={saveSmtpSettings}>
            <div class="col-12 col-lg-8">
              <label class="form-label" for="smtp-host">SMTP host</label>
              <input id="smtp-host" class="form-control" bind:value={smtpForm.smtp_host} placeholder="smtp.example.com" disabled={loadingSmtpSettings || savingSmtpSettings}>
            </div>
            <div class="col-12 col-lg-4">
              <label class="form-label" for="smtp-port">Port</label>
              <input id="smtp-port" class="form-control" type="number" min="1" max="65535" bind:value={smtpForm.smtp_port} disabled={loadingSmtpSettings || savingSmtpSettings}>
            </div>
            <div class="col-12 col-lg-6">
              <label class="form-label" for="smtp-username">Username</label>
              <input id="smtp-username" class="form-control" bind:value={smtpForm.smtp_username} disabled={loadingSmtpSettings || savingSmtpSettings}>
            </div>
            <div class="col-12 col-lg-6">
              <label class="form-label" for="smtp-password">Password</label>
              <div class="input-group">
                <input id="smtp-password" class="form-control" type={smtpPasswordVisible ? 'text' : 'password'} bind:value={smtpForm.smtp_password} placeholder={smtpSettings?.password_configured ? 'Enter a new password to replace it' : ''} autocomplete="new-password" disabled={loadingSmtpSettings || savingSmtpSettings}>
                <button class="btn btn-outline-secondary" type="button" on:click={() => (smtpPasswordVisible = !smtpPasswordVisible)} disabled={loadingSmtpSettings || savingSmtpSettings}>
                  {smtpPasswordVisible ? 'Hide' : 'Show'}
                </button>
              </div>
              <div class="form-text">Existing passwords are never displayed. The toggle only reveals what you type here.</div>
            </div>
            <div class="col-12 col-lg-6">
              <label class="form-label" for="smtp-from-address">From address</label>
              <input id="smtp-from-address" class="form-control" type="email" bind:value={smtpForm.smtp_from_address} placeholder="catalogue@example.com" disabled={loadingSmtpSettings || savingSmtpSettings}>
            </div>
            <div class="col-12 col-lg-6 d-flex align-items-end">
              <div>
                <label class="form-label" for="smtp-security">Connection security</label>
                <select id="smtp-security" class="form-select" bind:value={smtpForm.smtp_security} disabled={loadingSmtpSettings || savingSmtpSettings}>
                  <option value="starttls">STARTTLS (usually port 587)</option>
                  <option value="ssl">SSL/TLS (usually port 465)</option>
                  <option value="none">None (usually port 25)</option>
                </select>
              </div>
            </div>
            {#if smtpSettingsError}
              <div class="col-12"><div class="alert alert-danger py-2 mb-0">{smtpSettingsError}</div></div>
            {/if}
            <div class="col-12 d-flex flex-wrap gap-2">
              <button class="btn btn-primary" type="submit" disabled={loadingSmtpSettings || savingSmtpSettings || clearingSmtpSettings}>
                {savingSmtpSettings ? 'Saving...' : 'Save SMTP Settings'}
              </button>
              <button class="btn btn-outline-danger" type="button" on:click={resetSmtpSettings} disabled={loadingSmtpSettings || savingSmtpSettings || clearingSmtpSettings || smtpSettings?.source !== 'saved'}>
                {clearingSmtpSettings ? 'Clearing...' : 'Clear Saved Settings'}
              </button>
            </div>
          </form>

          <div class="border-top mt-4 pt-4">
            <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Diagnostics</p>
            <h3 class="h5">Test SMTP</h3>
            <p class="text-body-secondary mb-3">Save settings before testing. Test the connection first, then optionally send a real test email.</p>
            <div class="row g-3 align-items-end">
              <div class="col-12 col-lg-7">
                <label class="form-label" for="smtp-test-recipient">Test email recipient <span class="text-body-secondary">(optional)</span></label>
                <input id="smtp-test-recipient" class="form-control" type="email" bind:value={smtpTestRecipient} placeholder="recipient@example.com" disabled={sendingSmtpTest}>
              </div>
              <div class="col-12 col-lg-5 d-flex flex-wrap gap-2">
                <button class="btn btn-outline-primary" type="button" on:click={() => runSmtpTest()} disabled={sendingSmtpTest || loadingSmtpSettings || savingSmtpSettings || smtpSettings?.status !== 'configured'}>
                  {sendingSmtpTest ? 'Testing...' : 'Test Connection'}
                </button>
                <button class="btn btn-primary" type="button" on:click={() => runSmtpTest(true)} disabled={sendingSmtpTest || loadingSmtpSettings || savingSmtpSettings || smtpSettings?.status !== 'configured' || !smtpTestRecipient}>
                  {sendingSmtpTest ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>
            </div>
            {#if smtpTestError}
              <div class="alert alert-danger py-2 mt-3 mb-0" role="alert">
                <div>{smtpTestError}</div>
                {#if smtpTestResult?.detail}<div class="small mt-1">Provider detail: {smtpTestResult.detail}</div>{/if}
                {#if smtpTestResult?.correlation_id}<div class="small mt-1">Reference: {smtpTestResult.correlation_id}</div>{/if}
              </div>
            {:else if smtpTestResult}
              <div class="alert alert-success py-2 mt-3 mb-0" role="status">
                <div>{smtpTestResult.message}</div>
                <div class="small mt-1">Stage: {smtpTestResult.stage} · Reference: {smtpTestResult.correlation_id}</div>
              </div>
            {/if}
          </div>
        </div>
      </div>

    {/if}

    {#if $auth.is_admin && activeSection === 'users'}
      <div class="card shadow-sm">
        <div class="card-body bg-body-secondary bg-opacity-10">
          <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Access</p>
          <h2 class="h4">User Accounts</h2>
          <p class="text-body-secondary">Create and manage accounts for internal users.</p>

          <form class="vstack gap-3" on:submit|preventDefault={submitNewUser}>
            <div>
              <label class="form-label" for="new-user-username">Username</label>
              <input id="new-user-username" class="form-control" bind:value={newUsername} />
            </div>
            <div>
              <label class="form-label" for="new-user-password">Password</label>
              <input id="new-user-password" class="form-control" type="password" bind:value={newPassword} />
            </div>
            <div class="form-check">
              <input id="new-user-admin" class="form-check-input" type="checkbox" bind:checked={newIsAdmin} />
              <label class="form-check-label" for="new-user-admin">Admin access</label>
            </div>
            <button class="btn btn-primary align-self-start" type="submit" disabled={savingUser || !newUsername || !newPassword}>
              {savingUser ? 'Saving...' : 'Create User'}
            </button>
          </form>
        </div>
      </div>
      {/if}
  </div>

  <div class={`col-12 d-flex flex-column gap-4 ${activeSection === 'users' ? 'col-xl-8' : ''}`}>
    {#if $auth.is_admin && activeSection === 'users'}
    <div class="card shadow-sm">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <div class="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
          <div>
            <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Current Users</p>
            <h2 class="h4 mb-0">Accounts</h2>
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap justify-content-lg-end">
            <input
              class="form-control form-control-sm"
              type="search"
              placeholder="Filter users"
              bind:value={userFilter}
              style="max-width: 180px;"
            />
            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={loadUsers} disabled={loadingUsers}>
              {loadingUsers ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {#if userError}
          <div class="alert alert-danger py-2">{userError}</div>
        {/if}
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredUsers as user}
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-2 justify-content-start">
                      <span>{user.username}</span>
                      {#if user.username === $auth.username}
                        <span class="badge text-bg-primary">You</span>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <span class={`badge ${user.is_admin ? 'text-bg-dark' : 'text-bg-secondary'}`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span class={`badge ${user.is_active ? 'text-bg-success' : 'text-bg-warning'}`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td class="text-end">
                    <div class="d-flex justify-content-end gap-2 flex-wrap">
                      {#if $auth.is_admin}
                        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => toggleUserAdmin(user)} disabled={savingUser || user.username === $auth.username}>
                          {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => toggleUserActive(user)} disabled={savingUser || user.username === $auth.username}>
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => resetUserPassword(user)} disabled={savingUser}>
                          Reset Password
                        </button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
              {#if !filteredUsers.length}
                <tr>
                  <td colspan="4" class="text-body-secondary">No user accounts found.</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/if}

    {#if $auth.is_admin && activeSection === 'diagnostics'}
    <div class="card shadow-sm">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Debug</p>
            <h2 class="h4 mb-1">Live Logs</h2>
            <p class="text-body-secondary mb-0">
              Open a live terminal-style feed of the backend logs from this page.
            </p>
          </div>
          <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => (liveLogsOpen = !liveLogsOpen)}>
            {liveLogsOpen ? 'Hide Logs' : 'Show Logs'}
          </button>
        </div>

        {#if liveLogsOpen}
          <div class="mt-3">
            <SetupLogConsole />
          </div>
        {/if}
      </div>
    </div>

    <div class="card shadow-sm mt-4">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Debug</p>
            <h2 class="h4 mb-1">Customer-Facing Devices</h2>
            <p class="text-body-secondary mb-0">
              A deduped view of recent browser telemetry from the public site, grouped by unique device fingerprint.
            </p>
          </div>
          <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => (customerDeviceLogsOpen = !customerDeviceLogsOpen)}>
            {customerDeviceLogsOpen ? 'Hide Devices' : 'Show Devices'}
          </button>
        </div>

        {#if customerDeviceLogsOpen}
          <div class="mt-3">
            <CustomerFacingDeviceConsole />
          </div>
        {/if}
      </div>
    </div>

    <div class="card shadow-sm mt-4">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Debug</p>
            <h2 class="h4 mb-1">Internal-Facing Devices</h2>
            <p class="text-body-secondary mb-0">
              A deduped view of recent `public-access` logs from the internal app, grouped by unique device fingerprint.
            </p>
          </div>
          <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => (internalDeviceLogsOpen = !internalDeviceLogsOpen)}>
            {internalDeviceLogsOpen ? 'Hide Devices' : 'Show Devices'}
          </button>
        </div>

        {#if internalDeviceLogsOpen}
          <div class="mt-3">
            <InternalFacingDeviceConsole />
          </div>
        {/if}
      </div>
    </div>
  {/if}
  </div>
    </div>

{#if $auth.is_admin && ['maintenance', 'backups', 'file-managers', 'presets'].includes(activeSection)}
  <div class="mt-4">
    <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-3">
      <div>
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Administration</p>
        <h2 class="h3 mb-0">Operational Tools</h2>
      </div>
      <p class="text-body-secondary mb-0">
        Backup, restore, regeneration, file management, and preset editing live here.
      </p>
    </div>

      <div class="row g-4 mt-0">
        <div class="col-12">
          <div class="card shadow-sm h-100">
            <div class="card-body bg-body-secondary bg-opacity-10">
          <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Administration</p>
          <h2 class="h4">{activeSection === 'backups' ? 'Backups' : activeSection === 'file-managers' ? 'File Managers' : activeSection === 'presets' ? 'Presets' : 'Maintenance'}</h2>
          <p class="text-body-secondary">
            {activeSection === 'backups' ? 'Create and restore database and media backups.' : activeSection === 'file-managers' ? 'Manage deployment media and template files.' : activeSection === 'presets' ? 'Edit product type defaults used by the product editor.' : 'Run customer-facing refreshes and regenerate graphs and PDFs.'}
          </p>

          {#if maintenanceJob && !isPdfMaintenanceJob() && !isGraphImageMaintenanceJob() && maintenanceJob.job_type !== 'refresh_customer_facing_cache'}
            <JobProgressPanel job={maintenanceJob} label={`Maintenance job: ${maintenanceJob.job_type}`} />
          {/if}
          {#if activeSection === 'maintenance'}
          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Customer-Facing Refresh</h3>
                  <p class="mb-0 text-body-secondary">
                    Manually ask the public catalogue site to refresh its local cache so recent product, series, and product type edits appear sooner.
                  </p>
                </div>
                <button
                  class="btn btn-primary btn-sm"
                  type="button"
                  on:click={() =>
                    runMaintenanceJob(startRefreshCustomerFacingCacheJob, {
                      successMessage: 'Customer-facing catalogue refresh requested.'
                    })}
                  disabled={maintenanceLoading}
                >
                  Refresh Customer-Facing Site
                </button>
              </div>
              {#if maintenanceJob && maintenanceJob.job_type === 'refresh_customer_facing_cache'}
                <JobProgressPanel job={maintenanceJob} label="Customer-facing catalogue refresh" />
              {/if}
            </div>
          </div>
          {/if}
          {#if activeSection === 'backups'}
          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Backup DB Data</h3>
                  <p class="mb-2 text-body-secondary">
                    Download the PostgreSQL backup ZIP. This is the plug-and-play restore package for the app database.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={handleDatabaseBackupDownload}
                    disabled={backupLoading.database || backupLoading['database-restore']}
                  >
                    Download DB Data ZIP
                  </button>
                </div>
              </div>

              <div class="row g-2 align-items-end mt-1">
                <div class="col-12 col-lg">
                  <label class="form-label form-label-sm" for="db-backup-restore-file">Restore DB Data ZIP</label>
                  <input
                    id="db-backup-restore-file"
                    class="form-control form-control-sm"
                    type="file"
                    accept=".zip,application/zip"
                    on:change={handleDbBackupFileChange}
                    disabled={backupLoading.database || backupLoading['database-restore']}
                  />
                </div>
                <div class="col-12 col-lg-auto">
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    on:click={handleDbBackupRestore}
                    disabled={backupLoading.database || backupLoading['database-restore'] || !dbBackupFile}
                  >
                    Restore DB Data ZIP
                  </button>
                </div>
              </div>
              {#if backupJobs.database}
                <JobProgressPanel job={backupJobs.database} label="DB data backup" />
              {/if}
              {#if backupJobs['database-restore']}
                <JobProgressPanel job={backupJobs['database-restore']} label="DB data restore" />
              {/if}
            </div>
          </div>

          <div class="card border mb-3">
            <div class="card-body">
              <h3 class="h6 mb-1">Backup Media Data</h3>
              <p class="mb-3 text-body-secondary">
                Download the media-only backup as five smaller logical ZIP archives. Backups and temporary import files are excluded.
              </p>
              <div class="row g-3">
                {#each mediaBackupChunks as chunk}
                  <div class="col-12 col-lg-6">
                    <div class="card border h-100">
                      <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                          <div>
                            <h4 class="h6 mb-1">{chunk.label}</h4>
                            <p class="small text-body-secondary mb-3">{chunk.description}</p>
                          </div>
                          <button
                            class="btn btn-primary btn-sm flex-shrink-0"
                            type="button"
                            on:click={() => handleMediaBackupChunkDownload(chunk)}
                            disabled={backupLoading[chunk.id] || backupLoading['media-restore']}
                          >
                            Download ZIP
                          </button>
                        </div>
                        {#if backupJobs[chunk.id]}
                          <JobProgressPanel job={backupJobs[chunk.id]} label={`${chunk.label} backup`} />
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>

              <div class="row g-2 align-items-end mt-4">
                <div class="col-12 col-lg">
                  <label class="form-label form-label-sm" for="media-backup-restore-file">Restore Media Data ZIPs</label>
                  <input
                    id="media-backup-restore-file"
                    class="form-control form-control-sm"
                    type="file"
                    multiple
                    accept=".zip,application/zip"
                    on:change={handleMediaBackupFileChange}
                    disabled={backupLoading['media-restore']}
                  />
                  <div class="form-text">Select one or more logical media backup archives.</div>
                </div>
                <div class="col-12 col-lg-auto">
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    on:click={handleMediaBackupRestore}
                    disabled={backupLoading['media-restore'] || !mediaBackupFiles.length}
                  >
                    Restore Selected Media ZIPs
                  </button>
                </div>
              </div>
              {#if backupJobs['media-restore']}
                <JobProgressPanel job={backupJobs['media-restore']} label="Media data restore" />
              {/if}
            </div>
          </div>
          {/if}

          {#if activeSection === 'file-managers'}
          <div class="mb-3">
            <FileManager
              rootName="data"
              title="Media File Manager"
              description="Browse and manage media folders in the deployment volume. Open a folder to upload, create folders, rename, or delete items."
              entryLabelResolver={mediaFolderLabelResolver}
            />
          </div>

          <div class="mb-3">
            <FileManager
              rootName="templates"
              title="Template File Manager"
              description="Browse and manage template folders and files in the deployment volume. This covers the live template tree used for PDF generation."
            />
          </div>
          {/if}

          {#if activeSection === 'maintenance'}
          <div class="card border mb-3">
            <div class="card-body">
              <div class="mb-3">
                <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Generation</p>
                <h3 class="h5 mb-1">Graphs and PDFs</h3>
                <p class="mb-0 text-body-secondary">
                  Regenerate individual output groups, or run the complete graph and PDF generation workflow in one pass.
                </p>
                {#if maintenanceLoading && maintenanceJob}
                  <div class="small text-warning-emphasis mt-2">
                    A regeneration is currently running from the “{maintenanceJob.job_type}” card. All regeneration controls are disabled until it finishes.
                  </div>
                {/if}
              </div>

              <div class="card border mb-3">
                <div class="card-body bg-primary-subtle bg-opacity-25">
                  <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                    <div>
                      <h4 class="h6 mb-1">Regenerate Everything</h4>
                      <p class="mb-0 text-body-secondary">
                        Regenerate all product and series graph images, every PDF type, and the combined catalogue PDF in one long-running job.
                      </p>
                    </div>
                    <button
                      class="btn btn-primary btn-sm"
                      type="button"
                      on:click={() => requestMaintenanceConfirmation(startRegenerateEverythingJob, {
                        confirmMessage: 'Regenerate all graph images and PDFs? This may take a long time.',
                        successMessage: 'Everything regenerated.'
                      })}
                      disabled={maintenanceLoading || pendingMaintenanceConfirmation}
                    >
                      Regenerate Everything
                    </button>
                  </div>
                  {#if pendingMaintenanceConfirmation?.starter === startRegenerateEverythingJob}
                    <div class="alert alert-warning mt-3 mb-0 py-2">
                      <div class="small mb-2">Regenerate all graph images and PDFs? This may take a long time.</div>
                      <div class="d-flex gap-2">
                        <button class="btn btn-warning btn-sm" type="button" on:click={confirmPendingMaintenance}>
                          Confirm regeneration
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={cancelPendingMaintenance}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  {/if}
                  {#if maintenanceJob?.job_type === 'regenerate_everything'}
                    <JobProgressPanel job={maintenanceJob} label="Regenerate everything" showCancel={true} cancelLoading={maintenanceCancelLoading} onCancel={() => cancelCurrentMaintenanceJob(maintenanceJob)} />
                  {/if}
                  {#if lastSuccessfulLabel('regenerate_everything')}
                    <div class="small text-body-secondary mt-2">Last successful regeneration: {lastSuccessfulLabel('regenerate_everything')}</div>
                  {/if}
                </div>
              </div>

              <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Product Graph Images</h3>
                  <p class="mb-0 text-body-secondary">
                    Generate all product graph images in one pass, or clear them so they can be regenerated later.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenanceJob(startRegenerateAllGraphImagesJob, { successMessage: 'Graph images regenerated.' })}
                    disabled={maintenanceLoading}
                  >
                    Regenerate Product Graphs
                  </button>
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    on:click={() =>
                      requestMaintenanceConfirmation(startDeleteAllGraphImagesJob, {
                        confirmMessage: 'Delete all generated graph images and clear their saved paths?',
                        successMessage: 'Graph images cleared.'
                      })}
                    disabled={maintenanceLoading || pendingMaintenanceConfirmation}
                  >
                    Clear Graph Images
                  </button>
                </div>
              </div>
              {#if pendingMaintenanceConfirmation?.starter === startDeleteAllGraphImagesJob}
                <div class="alert alert-warning mt-3 mb-0 py-2">
                  <div class="small mb-2">Delete all generated graph images and clear their saved paths?</div>
                  <div class="d-flex gap-2">
                    <button class="btn btn-warning btn-sm" type="button" on:click={confirmPendingMaintenance}>
                      Confirm clearing
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" type="button" on:click={cancelPendingMaintenance}>
                      Cancel
                    </button>
                  </div>
                </div>
              {/if}
              {#if maintenanceJob?.job_type === 'regenerate_all_graph_images'}
                <JobProgressPanel job={maintenanceJob} label="Product Graph Images" showCancel={true} cancelLoading={maintenanceCancelLoading} onCancel={() => cancelCurrentMaintenanceJob(maintenanceJob)} />
              {/if}
              {#if lastSuccessfulLabel('regenerate_all_graph_images')}
                <div class="small text-body-secondary mt-2">Last successful regeneration: {lastSuccessfulLabel('regenerate_all_graph_images')}</div>
              {/if}
            </div>
          </div>

          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Product PDFs</h3>
                  <p class="mb-0 text-body-secondary">
                    Generate or re-generate all product PDFs in one pass using the current product templates and graph data.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenanceJob(startRegenerateAllProductPdfsJob, { successMessage: 'Product PDFs regenerated.' })}
                    disabled={maintenanceLoading}
                  >
                    Regenerate Product PDFs
                  </button>
                </div>
              </div>
              {#if maintenanceJob?.job_type === 'regenerate_all_product_pdfs'}
                <JobProgressPanel job={maintenanceJob} label="Product PDF regeneration" showCancel={true} cancelLoading={maintenanceCancelLoading} onCancel={() => cancelCurrentMaintenanceJob(maintenanceJob)} />
              {/if}
              {#if lastSuccessfulLabel('regenerate_all_product_pdfs')}
                <div class="small text-body-secondary mt-2">Last successful regeneration: {lastSuccessfulLabel('regenerate_all_product_pdfs')}</div>
              {/if}
            </div>
          </div>

          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Series PDFs</h3>
                  <p class="mb-0 text-body-secondary">
                    Generate or re-generate all series PDFs in one pass using the current series templates and linked product data.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenanceJob(startRegenerateAllSeriesPdfsJob, { successMessage: 'Series PDFs regenerated.' })}
                    disabled={maintenanceLoading}
                  >
                    Regenerate Series PDFs
                  </button>
                </div>
              </div>
              {#if maintenanceJob?.job_type === 'regenerate_all_series_pdfs'}
                <JobProgressPanel job={maintenanceJob} label="Series PDF regeneration" showCancel={true} cancelLoading={maintenanceCancelLoading} onCancel={() => cancelCurrentMaintenanceJob(maintenanceJob)} />
              {/if}
              {#if lastSuccessfulLabel('regenerate_all_series_pdfs')}
                <div class="small text-body-secondary mt-2">Last successful regeneration: {lastSuccessfulLabel('regenerate_all_series_pdfs')}</div>
              {/if}
            </div>
          </div>

          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Product Type PDFs</h3>
                  <p class="mb-0 text-body-secondary">
                    Generate or re-generate all product type PDFs in one pass using the current product type templates and series data.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenanceJob(startRegenerateAllProductTypePdfsJob, { successMessage: 'Product type PDFs regenerated.' })}
                    disabled={maintenanceLoading}
                  >
                    Regenerate Product Type PDFs
                  </button>
                </div>
              </div>
              {#if maintenanceJob?.job_type === 'regenerate_all_product_type_pdfs'}
                <JobProgressPanel job={maintenanceJob} label="Product Type PDF regeneration" showCancel={true} cancelLoading={maintenanceCancelLoading} onCancel={() => cancelCurrentMaintenanceJob(maintenanceJob)} />
              {/if}
              {#if lastSuccessfulLabel('regenerate_all_product_type_pdfs')}
                <div class="small text-body-secondary mt-2">Last successful regeneration: {lastSuccessfulLabel('regenerate_all_product_type_pdfs')}</div>
              {/if}
            </div>
          </div>

          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">All Product Types PDF</h3>
                  <p class="mb-0 text-body-secondary">
                    Build one combined catalogue with shared front matter and a contents page for each product type.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={() => runMaintenanceJob(startRefreshAllProductTypesPdfJob, { successMessage: 'Combined all-product-types PDF generated.' })}
                    disabled={maintenanceLoading}
                  >
                    Generate Combined PDF
                  </button>
                  <a class="btn btn-outline-secondary btn-sm" href="/api/public/media/all-product-types-pdf" target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                </div>
              </div>
              {#if maintenanceJob?.job_type === 'refresh_all_product_types_pdf'}
                <JobProgressPanel job={maintenanceJob} label="Combined catalogue PDF" showCancel={true} cancelLoading={maintenanceCancelLoading} onCancel={() => cancelCurrentMaintenanceJob(maintenanceJob)} />
              {/if}
              {#if lastSuccessfulLabel('refresh_all_product_types_pdf')}
                <div class="small text-body-secondary mt-2">Last successful regeneration: {lastSuccessfulLabel('refresh_all_product_types_pdf')}</div>
              {/if}
            </div>
          </div>

            </div>
          </div>

          {/if}
          {#if activeSection === 'presets'}
          <div class="card border">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-2">
                <div>
                  <h3 class="h6 mb-1">Type Presets</h3>
                  <p class="mb-0 text-body-secondary">
                    Edit the grouped specification presets, RPM line presets, and efficiency/permissible presets that
                    flow into the product editor.
                  </p>
                </div>
                <button class="btn btn-outline-secondary btn-sm" type="button" on:click={loadProductTypes} disabled={loadingProductTypes}>
                  {loadingProductTypes ? 'Refreshing...' : 'Reload types'}
                </button>
              </div>

              {#if typePresetError}
                <div class="alert alert-danger py-2">{typePresetError}</div>
              {/if}

              <div class="row g-3 align-items-end">
                <div class="col-12 col-md-6 col-lg-4">
                  <label class="form-label" for="type-preset-select">Product type</label>
                  <select class="form-select" id="type-preset-select" bind:value={selectedProductTypeId}>
                    <option value="">-- Choose option --</option>
                    {#each productTypes as productType}
                      <option value={productType.id}>{productType.label}</option>
                    {/each}
                  </select>
                </div>
                <div class="col-12 col-md-auto">
                  <button class="btn btn-outline-primary" type="button" on:click={addPresetGroup} disabled={!selectedProductTypeId}>
                    Add Group
                  </button>
                </div>
                <div class="col-12 col-md-auto">
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    on:click={() => {
                      presetGroups = clonePresetGroupsForType(selectedProductTypeId);
                      presetRpmLines = clonePresetRpmLinesForType(selectedProductTypeId);
                      presetEfficiencyPoints = clonePresetEfficiencyPointsForType(selectedProductTypeId);
                      presetProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId);
                      presetSeriesTemplateId = clonePresetSeriesTemplateIdForType(selectedProductTypeId);
                      presetBandGraphStyle = clonePresetBandGraphStyleForType(selectedProductTypeId);
                    }}
                    disabled={!selectedProductTypeId}
                  >
                    Reset from saved
                  </button>
                </div>
                <div class="col-12 col-md-auto">
                  <button class="btn btn-primary" type="button" on:click={savePresetGroups} disabled={savingTypePresets || !selectedProductTypeId}>
                    {savingTypePresets ? 'Saving...' : 'Save Presets'}
                  </button>
                </div>
              </div>

              {#if selectedProductTypeId}
                <div class="mt-3">
                  <div class="row g-3 align-items-end mb-4">
                    <div class="col-12 col-lg-6">
                      <label class="form-label" for="type-preset-product-template">Default product PDF template</label>
                      <select class="form-select" id="type-preset-product-template" bind:value={presetProductTemplateId}>
                        <option value="">-- Choose option --</option>
                        {#each productTemplates() as template}
                          <option value={template.id}>{template.label}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="col-12 col-lg-6">
                      <label class="form-label" for="type-preset-series-template">Default series PDF template</label>
                      <select class="form-select" id="type-preset-series-template" bind:value={presetSeriesTemplateId}>
                        <option value="">-- Choose option --</option>
                        {#each templateRegistry.series_templates ?? [] as template}
                          <option value={template.id}>{template.label}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="col-12">
                      <p class="text-body-secondary mb-0">Band graph style defaults</p>
                    </div>
                    <div class="col-12 col-md-4">
                      <label class="form-label" for="type-preset-band-graph-background">Background colour</label>
                      <div class="input-group">
                        <input class="form-control form-control-color" id="type-preset-band-graph-background" type="color" bind:value={presetBandGraphStyle.band_graph_background_color} />
                        <input class="form-control" type="text" bind:value={presetBandGraphStyle.band_graph_background_color} placeholder="#ffffff" />
                      </div>
                    </div>
                    <div class="col-12 col-md-4">
                      <label class="form-label" for="type-preset-band-graph-label">Label text colour</label>
                      <div class="input-group">
                        <input class="form-control form-control-color" id="type-preset-band-graph-label" type="color" bind:value={presetBandGraphStyle.band_graph_label_text_color} />
                        <input class="form-control" type="text" bind:value={presetBandGraphStyle.band_graph_label_text_color} placeholder="#000000" />
                      </div>
                    </div>
                    <div class="col-12 col-md-4">
                      <label class="form-label" for="type-preset-band-graph-permissible">Permissible label colour</label>
                      <div class="input-group">
                        <input class="form-control form-control-color" id="type-preset-band-graph-permissible" type="color" bind:value={presetBandGraphStyle.band_graph_permissible_label_color} />
                        <input class="form-control" type="text" bind:value={presetBandGraphStyle.band_graph_permissible_label_color} placeholder="#000000" />
                      </div>
                    </div>
                    <div class="col-12 col-md-4">
                      <label class="form-label" for="type-preset-band-graph-opacity">Faded area opacity</label>
                      <input class="form-control" id="type-preset-band-graph-opacity" type="number" min="0" max="1" step="0.01" bind:value={presetBandGraphStyle.band_graph_faded_opacity} />
                    </div>
                  </div>

                  {#if presetGroups.length}
                    <div class="vstack gap-3">
                      {#each presetGroups as group, groupIndex}
                        <div class={`border rounded p-3 ${group._pending_delete ? 'bg-danger-subtle border-danger-subtle opacity-75' : ''}`}>
                          <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
                            <input class="form-control" style="max-width: 22rem;" type="text" placeholder="Group name" bind:value={group.group_name} on:input={() => (presetGroups = [...presetGroups])} />
                            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetGroup(groupIndex, -1)} disabled={groupIndex === 0}>Up</button>
                            <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetGroup(groupIndex, 1)} disabled={groupIndex === presetGroups.length - 1}>Down</button>
                            <button class={`btn btn-sm ${group._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} type="button" on:click={() => removePresetGroup(groupIndex)}>
                              {group._pending_delete ? 'Undo Delete' : 'Delete Group'}
                            </button>
                            <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => addPresetParameter(groupIndex)} disabled={group._pending_delete}>
                              Add Parameter
                            </button>
                          </div>
                          {#if group._pending_delete}
                            <p class="small text-danger-emphasis mb-2">This group is marked for deletion. Save Presets to apply the deletion.</p>
                          {/if}
                          <div class="vstack gap-2">
                            {#each group.parameters as parameter, parameterIndex}
                              <div class={`border rounded p-3 bg-body-tertiary ${parameter._pending_delete ? 'border-danger-subtle bg-danger-subtle opacity-75' : ''}`}>
                                <div class="row g-3 align-items-end">
                                  <div class="col-12 col-lg-3">
                                    <label class="form-label" for={`type-preset-${groupIndex}-parameter-${parameterIndex}-name`}>Parameter name</label>
                                    <input class="form-control" id={`type-preset-${groupIndex}-parameter-${parameterIndex}-name`} type="text" bind:value={parameter.parameter_name} on:input={() => (presetGroups = [...presetGroups])} />
                                  </div>
                                  <div class="col-12 col-lg-2">
                                    <label class="form-label" for={`type-preset-${groupIndex}-parameter-${parameterIndex}-value-type`}>Value type</label>
                                    <select
                                      class="form-select"
                                      id={`type-preset-${groupIndex}-parameter-${parameterIndex}-value-type`}
                                      bind:value={parameter.value_type}
                                      on:change={(event) => updatePresetParameterValueType(groupIndex, parameterIndex, event.currentTarget.value)}
                                    >
                                      <option value="string">Text</option>
                                      <option value="number">Number</option>
                                    </select>
                                  </div>
                                  {#if parameter.value_type === 'string'}
                                    <div class="col-12 col-lg-5">
                                      <label class="form-label" for={`type-preset-${groupIndex}-parameter-${parameterIndex}-text`}>Text value</label>
                                      <input class="form-control" id={`type-preset-${groupIndex}-parameter-${parameterIndex}-text`} type="text" bind:value={parameter.value_string} on:input={() => (presetGroups = [...presetGroups])} />
                                    </div>
                                  {:else}
                                    <div class="col-12 col-lg-2">
                                      <label class="form-label" for={`type-preset-${groupIndex}-parameter-${parameterIndex}-number`}>Numeric value</label>
                                      <input class="form-control" id={`type-preset-${groupIndex}-parameter-${parameterIndex}-number`} type="number" step="any" bind:value={parameter.value_number} on:input={() => (presetGroups = [...presetGroups])} />
                                    </div>
                                    <div class="col-12 col-lg-3">
                                      <label class="form-label" for={`type-preset-${groupIndex}-parameter-${parameterIndex}-unit`}>Unit</label>
                                      <select
                                        class="form-select"
                                        id={`type-preset-${groupIndex}-parameter-${parameterIndex}-unit`}
                                        bind:value={parameter.preferred_unit}
                                        on:change={(event) => updatePresetParameterUnit(groupIndex, parameterIndex, event.currentTarget.value)}
                                      >
                                        <option value="">No unit</option>
                                        {#each GLOBAL_UNIT_OPTIONS as unitOption}
                                          <option value={unitOption}>{unitOption}</option>
                                        {/each}
                                        <option value="__custom__">Custom...</option>
                                      </select>
                                    </div>
                                    {#if parameter.preferred_unit === '__custom__'}
                                      <div class="col-12 col-lg-2">
                                        <label class="form-label" for={`type-preset-${groupIndex}-parameter-${parameterIndex}-custom-unit`}>Custom unit</label>
                                        <input class="form-control" id={`type-preset-${groupIndex}-parameter-${parameterIndex}-custom-unit`} type="text" bind:value={parameter.custom_unit} on:input={() => (presetGroups = [...presetGroups])} />
                                      </div>
                                    {/if}
                                  {/if}
                                  <div class="col-12 col-lg-2">
                                    <div class="d-flex flex-wrap gap-2">
                                      <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetParameter(groupIndex, parameterIndex, -1)} disabled={group._pending_delete || parameter._pending_delete || parameterIndex === 0}>Up</button>
                                      <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetParameter(groupIndex, parameterIndex, 1)} disabled={group._pending_delete || parameter._pending_delete || parameterIndex === group.parameters.length - 1}>Down</button>
                                      <button class={`btn btn-sm ${parameter._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} type="button" on:click={() => removePresetParameter(groupIndex, parameterIndex)} disabled={group._pending_delete}>
                                        {parameter._pending_delete ? 'Undo Delete' : 'Delete'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-body-secondary mb-0">No preset groups yet. Add a group to start defining the type preset.</p>
                  {/if}

                  <div class="mt-4">
                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                      <h4 class="h6 mb-0">RPM line presets</h4>
                      <div class="d-flex flex-wrap gap-2">
                        <button class="btn btn-outline-primary btn-sm" type="button" on:click={addPresetRpmLine}>Add RPM Line</button>
                        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => (presetRpmLines = clonePresetRpmLinesForType(selectedProductTypeId))}>Reset RPM lines</button>
                      </div>
                    </div>
                    {#if presetRpmLines.length}
                      <div class="vstack gap-3">
                        {#each presetRpmLines as line, lineIndex}
                          <div class={`border rounded p-3 ${line._pending_delete ? 'bg-danger-subtle border-danger-subtle opacity-75' : ''}`}>
                            <div class="row g-3 align-items-end">
                              <div class="col-12 col-md-3">
                                <label class="form-label" for={`type-preset-rpm-line-${lineIndex}-rpm`}>RPM</label>
                                <input class="form-control" id={`type-preset-rpm-line-${lineIndex}-rpm`} type="number" step="any" bind:value={line.rpm} on:input={() => (presetRpmLines = [...presetRpmLines])} />
                              </div>
                              <div class="col-12 col-md-5">
                                <label class="form-label" for={`type-preset-rpm-line-${lineIndex}-band-color`}>Band colour</label>
                                <div class="input-group">
                                  <input class="form-control form-control-color" id={`type-preset-rpm-line-${lineIndex}-band-color`} type="color" bind:value={line.band_color} on:input={() => (presetRpmLines = [...presetRpmLines])} />
                                  <input class="form-control" type="text" bind:value={line.band_color} placeholder="#5E86A7" on:input={() => (presetRpmLines = [...presetRpmLines])} />
                                </div>
                              </div>
                              <div class="col-12 col-md-4">
                                <div class="d-flex flex-wrap gap-2 justify-content-md-end">
                                  <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetRpmLine(lineIndex, -1)} disabled={lineIndex === 0}>Up</button>
                                  <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetRpmLine(lineIndex, 1)} disabled={lineIndex === presetRpmLines.length - 1}>Down</button>
                                  <button class={`btn btn-sm ${line._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} type="button" on:click={() => removePresetRpmLine(lineIndex)}>
                                    {line._pending_delete ? 'Undo Delete' : 'Delete'}
                                  </button>
                                  <button class="btn btn-outline-primary btn-sm" type="button" on:click={() => addPresetRpmPoint(lineIndex)} disabled={line._pending_delete}>Add Point</button>
                                </div>
                              </div>
                            </div>
                            {#if line._pending_delete}
                              <p class="small text-danger-emphasis mt-3 mb-0">This RPM line is marked for deletion. Save Presets to apply the deletion.</p>
                            {/if}
                            <div class="table-responsive mt-3">
                              <table class="table table-sm align-middle editable-table mb-0">
                                <thead>
                                  <tr>
                                    <th>Airflow</th>
                                    <th>Pressure</th>
                                    <th>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {#each line.points as point, pointIndex}
                                    <tr class={point._pending_delete ? 'table-danger' : ''}>
                                      <td><input class="form-control form-control-sm" type="number" step="any" bind:value={point.airflow} on:input={() => (presetRpmLines = [...presetRpmLines])} /></td>
                                      <td><input class="form-control form-control-sm" type="number" step="any" bind:value={point.pressure} on:input={() => (presetRpmLines = [...presetRpmLines])} /></td>
                                      <td>
                                        <div class="d-flex flex-wrap gap-2">
                                          <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetRpmPoint(lineIndex, pointIndex, -1)} disabled={pointIndex === 0 || line._pending_delete || point._pending_delete}>Up</button>
                                          <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetRpmPoint(lineIndex, pointIndex, 1)} disabled={pointIndex === line.points.length - 1 || line._pending_delete || point._pending_delete}>Down</button>
                                          <button class={`btn btn-sm ${point._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} type="button" on:click={() => removePresetRpmPoint(lineIndex, pointIndex)} disabled={line._pending_delete}>
                                            {point._pending_delete ? 'Undo Delete' : 'Delete'}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  {/each}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <p class="text-body-secondary mb-0">No RPM line presets yet. Add one to start defining the default graph.</p>
                    {/if}
                  </div>

                  <div class="mt-4">
                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                      <h4 class="h6 mb-0">Efficiency / permissible presets</h4>
                      <div class="d-flex flex-wrap gap-2">
                        <button class="btn btn-outline-primary btn-sm" type="button" on:click={addPresetEfficiencyPoint}>Add Point</button>
                        <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => (presetEfficiencyPoints = clonePresetEfficiencyPointsForType(selectedProductTypeId))}>Reset points</button>
                      </div>
                    </div>
                    {#if presetEfficiencyPoints.length}
                      <div class="table-responsive">
                        <table class="table table-sm align-middle editable-table mb-0">
                          <thead>
                            <tr>
                              <th>Airflow</th>
                              <th>Efficiency Centre</th>
                              <th>Efficiency Lower End</th>
                              <th>Efficiency Higher End</th>
                              <th>Permissible Use</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each presetEfficiencyPoints as point, pointIndex}
                              <tr class={point._pending_delete ? 'table-danger' : ''}>
                                <td><input class="form-control form-control-sm" type="number" step="any" bind:value={point.airflow} on:input={() => (presetEfficiencyPoints = [...presetEfficiencyPoints])} /></td>
                                <td><input class="form-control form-control-sm" type="number" step="any" bind:value={point.efficiency_centre} on:input={() => (presetEfficiencyPoints = [...presetEfficiencyPoints])} /></td>
                                <td><input class="form-control form-control-sm" type="number" step="any" bind:value={point.efficiency_lower_end} on:input={() => (presetEfficiencyPoints = [...presetEfficiencyPoints])} /></td>
                                <td><input class="form-control form-control-sm" type="number" step="any" bind:value={point.efficiency_higher_end} on:input={() => (presetEfficiencyPoints = [...presetEfficiencyPoints])} /></td>
                                <td><input class="form-control form-control-sm" type="number" step="any" bind:value={point.permissible_use} on:input={() => (presetEfficiencyPoints = [...presetEfficiencyPoints])} /></td>
                                <td>
                                  <div class="d-flex flex-wrap gap-2">
                                    <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetEfficiencyPoint(pointIndex, -1)} disabled={pointIndex === 0 || point._pending_delete}>Up</button>
                                    <button class="btn btn-outline-secondary btn-sm" type="button" on:click={() => movePresetEfficiencyPoint(pointIndex, 1)} disabled={pointIndex === presetEfficiencyPoints.length - 1 || point._pending_delete}>Down</button>
                                    <button class={`btn btn-sm ${point._pending_delete ? 'btn-outline-success' : 'btn-outline-danger'}`} type="button" on:click={() => removePresetEfficiencyPoint(pointIndex)}>
                                      {point._pending_delete ? 'Undo Delete' : 'Delete'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {:else}
                      <p class="text-body-secondary mb-0">No efficiency/permissible presets yet.</p>
                    {/if}
                  </div>
                </div>
              {:else}
                <p class="text-body-secondary mt-3 mb-0">Choose a product type to edit its presets.</p>
              {/if}
            </div>
          </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
  </div>
{/if}

  </div>
</div>

<style>
  .setup-hero {
    overflow: hidden;
    border-radius: 1.25rem;
  }

  .setup-hero-copy {
    max-width: 52rem;
  }

  .setup-hero-badge {
    max-width: 20rem;
  }

  .setup-section-nav {
    position: sticky;
    top: 1rem;
  }

  .setup-section-nav-item {
    display: grid;
    grid-template-columns: 1fr auto;
    width: 100%;
    padding: 0.8rem 0.9rem;
    border: 0;
    border-left: 0.25rem solid transparent;
    border-radius: 0.6rem;
    background: transparent;
    color: var(--bs-body-color);
    text-align: left;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .setup-section-nav-item:hover:not(:disabled) {
    background: var(--bs-secondary-bg);
  }

  .setup-section-nav-item.active {
    border-left-color: var(--bs-primary);
    background: var(--bs-primary-bg-subtle);
    color: var(--bs-primary-text-emphasis);
  }

  .setup-section-nav-item:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .setup-section-nav-label {
    font-weight: 600;
  }

  .setup-section-nav-lock {
    font-size: 0.8rem;
  }

  .setup-section-nav-description {
    grid-column: 1 / -1;
    margin-top: 0.15rem;
    color: var(--bs-secondary-color);
    font-size: 0.78rem;
    line-height: 1.3;
  }

  @media (max-width: 1199.98px) {
    .setup-section-nav {
      position: static;
    }

    .setup-section-nav nav {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.35rem;
    }
  }

  @media (max-width: 575.98px) {
    .setup-section-nav nav {
      grid-template-columns: 1fr;
    }
  }

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

  .error-toast {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    width: min(42rem, calc(100vw - 2rem));
    z-index: 1085;
    pointer-events: none;
  }

  .error-toast-alert {
    position: relative;
    overflow: hidden;
    padding-bottom: 1rem;
    pointer-events: auto;
  }

  .error-toast-progress {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 0.25rem;
    background: rgba(220, 53, 69, 0.55);
    transform-origin: left center;
    animation: error-toast-countdown 8s linear forwards;
  }

  @keyframes error-toast-countdown {
    from {
      transform: scaleX(1);
    }

    to {
      transform: scaleX(0);
    }
  }
</style>
