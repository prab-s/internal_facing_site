<script>
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { auth } from '$lib/auth.js';
  import { GLOBAL_UNIT_OPTIONS } from '$lib/config.js';
  import {
    changePassword,
    createUser,
    downloadMaintenanceJobFile,
    getTemplates,
    getMaintenanceJob,
    getProductTypes,
    getUsers,
    startBackupBundleJob,
    startDeleteAllGraphImagesJob,
    startRegenerateAllGraphImagesJob,
    startRegenerateAllProductPdfsJob,
    startRestoreBackupBundleJob,
    updateProductType,
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
  let maintenanceLoading = false;
  let maintenanceError = '';
  let backupFile = null;
  let maintenanceJob = null;
  let maintenancePollTimeout = null;
  let productTypes = [];
  let productTypesLoaded = false;
  let loadingProductTypes = false;
  let savingTypePresets = false;
  let typePresetError = '';
  let selectedProductTypeId = '';
  let presetGroups = [];
  let presetRpmLines = [];
  let presetEfficiencyPoints = [];
  let presetPrintedProductTemplateId = '';
  let presetOnlineProductTemplateId = '';
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

  $: maintenanceProgressPercent =
    maintenanceJob?.progress_percent != null
      ? Math.max(0, Math.min(100, Number(maintenanceJob.progress_percent)))
      : null;

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

  onMount(() => {
    const session = get(auth);
    if (session.authenticated) {
      loadUsers();
      loadProductTypes();
      loadTemplates();
    }
  });

  onDestroy(() => {
    if (successDismissTimeout) {
      clearTimeout(successDismissTimeout);
    }
    if (maintenancePollTimeout) {
      clearTimeout(maintenancePollTimeout);
    }
  });

  $: if ($auth.authenticated && !usersLoaded && !loadingUsers) {
    loadUsers();
  }

  $: if ($auth.authenticated && !productTypesLoaded && !loadingProductTypes) {
    loadProductTypes();
  }

  function productTemplates() {
    return templateRegistry.product_templates ?? [];
  }

  async function loadTemplates() {
    try {
      templateRegistry = await getTemplates();
    } catch (error) {
      typePresetError = error?.message || 'Unable to load templates.';
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

  function createPresetParameterDraft(parameter = {}) {
    const preferredUnit = parameter.preferred_unit ?? '';
    const valueString = parameter.value_string ?? '';
    const valueNumber = parameter.value_number ?? '';
    const valueType = valueString !== '' ? 'string' : valueNumber !== '' && valueNumber != null ? 'number' : 'string';
    return {
      id: parameter.id ?? null,
      _pending_delete: false,
      parameter_name: parameter.parameter_name ?? '',
      preferred_unit: preferredUnit,
      value_type: valueType,
      value_string: valueString,
      value_number: valueNumber,
      custom_unit: preferredUnit && !GLOBAL_UNIT_OPTIONS.includes(preferredUnit) ? preferredUnit : ''
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

  function clonePresetProductTemplateIdForType(productTypeId, variant) {
    const productType = productTypes.find((item) => String(item.id) === String(productTypeId));
    if (variant === 'printed') {
      return productType?.printed_product_template_id || productType?.product_template_id || '';
    }
    return productType?.online_product_template_id || productType?.product_template_id || '';
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

  async function loadProductTypes() {
    loadingProductTypes = true;
    typePresetError = '';
    try {
      productTypes = await getProductTypes();
      productTypesLoaded = true;
      const selectedStillExists = productTypes.some((item) => String(item.id) === String(selectedProductTypeId));
      if (!selectedStillExists) {
        selectedProductTypeId = '';
        presetGroups = [];
        presetRpmLines = [];
        presetEfficiencyPoints = [];
        presetPrintedProductTemplateId = '';
        presetOnlineProductTemplateId = '';
        presetBandGraphStyle = clonePresetBandGraphStyleForType('');
      } else {
        presetGroups = clonePresetGroupsForType(selectedProductTypeId);
        presetRpmLines = clonePresetRpmLinesForType(selectedProductTypeId);
        presetEfficiencyPoints = clonePresetEfficiencyPointsForType(selectedProductTypeId);
        presetPrintedProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, 'printed');
        presetOnlineProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, 'online');
        presetBandGraphStyle = clonePresetBandGraphStyleForType(selectedProductTypeId);
      }
    } catch (error) {
      typePresetError = error?.message || 'Unable to load product types.';
    } finally {
      loadingProductTypes = false;
    }
  }

  function selectProductType(productTypeId) {
    selectedProductTypeId = String(productTypeId || '');
    presetGroups = clonePresetGroupsForType(selectedProductTypeId);
    presetRpmLines = clonePresetRpmLinesForType(selectedProductTypeId);
    presetEfficiencyPoints = clonePresetEfficiencyPointsForType(selectedProductTypeId);
    presetPrintedProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, 'printed');
    presetOnlineProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, 'online');
    presetBandGraphStyle = clonePresetBandGraphStyleForType(selectedProductTypeId);
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
        printed_product_template_id: presetPrintedProductTemplateId || null,
        online_product_template_id: presetOnlineProductTemplateId || null,
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
      presetPrintedProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, 'printed');
      presetOnlineProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, 'online');
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
      maintenanceJob = job;

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
        return;
      }

      if (job.status === 'failed') {
        maintenanceLoading = false;
        maintenanceError = job.error || options.errorMessage || 'Maintenance task failed.';
        return;
      }

      maintenancePollTimeout = setTimeout(() => pollMaintenanceJob(jobId, options), 1500);
    } catch (error) {
      maintenanceLoading = false;
      maintenanceError = error?.message || options.errorMessage || 'Unable to read maintenance job status.';
    }
  }

  async function runMaintenanceJob(starter, options = {}) {
    if (options.confirmMessage && !window.confirm(options.confirmMessage)) {
      return;
    }

    maintenanceLoading = true;
    maintenanceError = '';
    maintenanceJob = null;
    clearSuccessToast();
    try {
      const job = await starter();
      maintenanceJob = job;
      await pollMaintenanceJob(job.id, options);
    } catch (error) {
      maintenanceError = error?.message || options.errorMessage || 'Unable to run maintenance task.';
      maintenanceLoading = false;
    } finally {
      if (!maintenanceLoading && maintenancePollTimeout) {
        clearTimeout(maintenancePollTimeout);
        maintenancePollTimeout = null;
      }
    }
  }

  async function handleBackupDownload() {
    await runMaintenanceJob(startBackupBundleJob, {
      successMessage: 'Backup bundle created.',
      errorMessage: 'Unable to create backup bundle.',
      downloadOnComplete: true
    });
  }

  function handleBackupFileChange(event) {
    backupFile = event.currentTarget?.files?.[0] || null;
  }

  async function handleBackupRestore() {
    if (!backupFile) {
      maintenanceError = 'Choose a backup ZIP file first.';
      clearSuccessToast();
      return;
    }

    const confirmed = window.confirm(
      'Restore this backup bundle? This will overwrite the current database and WordPress content with the uploaded backup.'
    );
    if (!confirmed) {
      return;
    }

    const fileToRestore = backupFile;
    await runMaintenanceJob(() => startRestoreBackupBundleJob(fileToRestore), {
      successMessage: 'Backup bundle restored successfully.',
      errorMessage: 'Unable to restore backup bundle.'
    });
    if (!maintenanceError) {
      backupFile = null;
      const input = document.getElementById('backup-restore-file');
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

<div class="mb-3">
  <div class="col-12 col-xxl-8">
    <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Setup</p>
    <h1 class="h2 mb-2">Account and application setup.</h1>
    <p class="text-body-secondary">
      Manage your own password here. Admins can also create and manage internal user accounts.
    </p>
  </div>
</div>

<div class="row g-3">
  <div class="col-12 col-xl-5">
    <div class="card shadow-sm h-100">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <p class="small text-uppercase text-body-secondary fw-semibold mb-1">My Account</p>
        <h2 class="h4">Change Password</h2>
        <p class="text-body-secondary">Signed in as {$auth.username}.</p>

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
  </div>

  <div class="col-12 col-xl-7">
    <div class="card shadow-sm h-100">
      <div class="card-body bg-body-secondary bg-opacity-10">
        <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
          <div>
            <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Current Users</p>
            <h2 class="h4 mb-0">Accounts</h2>
          </div>
          <div class="d-flex align-items-center gap-2">
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
  </div>
</div>

{#if $auth.is_admin}
  <div class="row g-3 mt-1">
    <div class="col-12 col-xl-5">
      <div class="card shadow-sm h-100">
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
    </div>

    <div class="col-12 col-xl-7">
      <div class="card shadow-sm h-100">
        <div class="card-body bg-body-secondary bg-opacity-10">
          <p class="small text-uppercase text-body-secondary fw-semibold mb-1">Maintenance</p>
          <h2 class="h4">Operational Tools</h2>
          <p class="text-body-secondary">
            Run special admin-only tasks that are otherwise only exposed through the API.
          </p>

          {#if maintenanceError}
            <div class="alert alert-danger py-2">{maintenanceError}</div>
          {/if}
          {#if maintenanceJob}
            <div class="alert alert-secondary py-2">
              <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
                <div class="fw-semibold">Maintenance job: {maintenanceJob.job_type}</div>
                <span class={`badge ${maintenanceJob.status === 'completed' ? 'text-bg-success' : maintenanceJob.status === 'failed' ? 'text-bg-danger' : 'text-bg-secondary'}`}>
                  {maintenanceJob.status}
                </span>
              </div>
              {#if maintenanceJob.progress_message}
                <div class="small mb-2">{maintenanceJob.progress_message}</div>
              {/if}
              <div
                class="progress"
                role="progressbar"
                aria-label="Maintenance progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={maintenanceProgressPercent ?? undefined}
              >
                <div
                  class={`progress-bar ${maintenanceProgressPercent == null && maintenanceJob.status === 'running' ? 'progress-bar-striped progress-bar-animated' : ''}`}
                  style={`width: ${maintenanceProgressPercent ?? (maintenanceJob.status === 'completed' ? 100 : 100)}%`}
                >
                  {#if maintenanceProgressPercent != null}
                    {maintenanceProgressPercent.toFixed(0)}%
                  {:else if maintenanceJob.status === 'running'}
                    Working...
                  {/if}
                </div>
              </div>
              {#if maintenanceJob.progress_current != null && maintenanceJob.progress_total != null}
                <div class="small text-body-secondary mt-2">
                  Step {maintenanceJob.progress_current} of {maintenanceJob.progress_total}
                </div>
              {/if}
            </div>
          {/if}
          <div class="card border mb-3">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h3 class="h6 mb-1">Backups</h3>
                  <p class="mb-2 text-body-secondary">
                    Download a full backup ZIP of the deployed data, or restore one here. The backup bundle includes
                    the app database and media, plus the WordPress database and `wp-content`.
                  </p>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button
                    class="btn btn-primary btn-sm"
                    type="button"
                    on:click={handleBackupDownload}
                    disabled={maintenanceLoading}
                  >
                    Download Backup ZIP
                  </button>
                </div>
              </div>

              <div class="row g-2 align-items-end mt-1">
                <div class="col-12 col-lg">
                  <label class="form-label form-label-sm" for="backup-restore-file">Restore Backup ZIP</label>
                  <input
                    id="backup-restore-file"
                    class="form-control form-control-sm"
                    type="file"
                    accept=".zip,application/zip"
                    on:change={handleBackupFileChange}
                    disabled={maintenanceLoading}
                  />
                </div>
                <div class="col-12 col-lg-auto">
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    on:click={handleBackupRestore}
                    disabled={maintenanceLoading || !backupFile}
                  >
                    Restore Backup ZIP
                  </button>
                </div>
              </div>
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
                    Generate Product Graphs
                  </button>
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    on:click={() =>
                      runMaintenanceJob(startDeleteAllGraphImagesJob, {
                        confirmMessage: 'Delete all generated graph images and clear their saved paths?',
                        successMessage: 'Graph images cleared.'
                      })}
                    disabled={maintenanceLoading}
                  >
                    Clear Graph Images
                  </button>
                </div>
              </div>
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
            </div>
          </div>

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
                  <select class="form-select" id="type-preset-select" bind:value={selectedProductTypeId} on:change={(event) => selectProductType(event.currentTarget.value)}>
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
                      presetPrintedProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, 'printed');
                      presetOnlineProductTemplateId = clonePresetProductTemplateIdForType(selectedProductTypeId, 'online');
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
                      <label class="form-label" for="type-preset-printed-product-template">Default printed PDF template</label>
                      <select class="form-select" id="type-preset-printed-product-template" bind:value={presetPrintedProductTemplateId}>
                        <option value="">-- Choose option --</option>
                        {#each productTemplates() as template}
                          <option value={template.id}>{template.label}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="col-12 col-lg-6">
                      <label class="form-label" for="type-preset-online-product-template">Default online PDF template</label>
                      <select class="form-select" id="type-preset-online-product-template" bind:value={presetOnlineProductTemplateId}>
                        <option value="">-- Choose option --</option>
                        {#each productTemplates() as template}
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
                                      <select class="form-select" id={`type-preset-${groupIndex}-parameter-${parameterIndex}-unit`} bind:value={parameter.preferred_unit} on:change={() => (presetGroups = [...presetGroups])}>
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
                                  <input class="form-control" type="text" bind:value={line.band_color} placeholder="#0066e3" on:input={() => (presetRpmLines = [...presetRpmLines])} />
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
        </div>
      </div>
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
