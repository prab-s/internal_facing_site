import { API_BASE } from '$lib/config.js';

function url(path) {
  return `${API_BASE}${path}`;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(url(path), {
    credentials: 'include',
    ...options
  });

  if (!response.ok) {
    const error = new Error(await response.text());
    error.status = response.status;
    throw error;
  }

  return response;
}

export async function health() {
  const r = await apiFetch('/health');
  return r.json();
}

export async function getAuthSession() {
  const r = await apiFetch('/auth/session');
  return r.json();
}

export async function login(username, password) {
  const r = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return r.json();
}

export async function logout() {
  const r = await apiFetch('/auth/logout', {
    method: 'POST'
  });
  return r.json();
}

export async function changePassword(currentPassword, newPassword) {
  const r = await apiFetch('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  });
  return r.json();
}

export async function getProducts(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch('/products' + (sp ? '?' + sp : ''));
  return r.json();
}

export async function getProductTypes() {
  const r = await apiFetch('/product-types');
  return r.json();
}

export async function createProductType(body) {
  const r = await apiFetch('/product-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateProductType(id, body) {
  const r = await apiFetch(`/product-types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateProductTypePresets(id, body) {
  const r = await apiFetch(`/product-types/${id}/parameter-group-presets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateProductTypeParameterGroupPresets(id, body) {
  return updateProductTypePresets(id, body);
}

export async function getProductTypePdfContext(id) {
  const r = await apiFetch(`/product-types/${id}/pdf-context`);
  return r.json();
}

export async function refreshProductTypePdf(id) {
  const r = await apiFetch(`/product-types/${id}/pdf/refresh`, {
    method: 'POST'
  });
  return r.json();
}

export async function getTemplates() {
  const r = await apiFetch('/templates');
  return r.json();
}

export async function refreshTemplates() {
  const r = await apiFetch('/templates/refresh', {
    method: 'POST'
  });
  return r.json();
}

export async function createTemplate(body) {
  const r = await apiFetch('/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteTemplate(templateType, templateId) {
  const r = await apiFetch(`/templates/${templateType}/${encodeURIComponent(templateId)}`, {
    method: 'DELETE'
  });
  return r.json();
}

export async function getTemplateFiles(templateType, templateId) {
  const r = await apiFetch(`/templates/${templateType}/${encodeURIComponent(templateId)}/files`);
  return r.json();
}

export async function updateTemplateFiles(templateType, templateId, body) {
  const r = await apiFetch(`/templates/${templateType}/${encodeURIComponent(templateId)}/files`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function getSeries(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch('/series' + (sp ? '?' + sp : ''));
  return r.json();
}

export async function createSeries(body) {
  const r = await apiFetch('/series', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateSeries(id, body) {
  const r = await apiFetch(`/series/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteSeries(id) {
  const r = await apiFetch(`/series/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function refreshSeriesGraphImage(id) {
  const r = await apiFetch(`/series/${id}/graph-image/refresh`, {
    method: 'POST'
  });
  return r.json();
}

export async function refreshSeriesPdf(id) {
  const r = await apiFetch(`/series/${id}/pdf/refresh`, {
    method: 'POST'
  });
  return r.json();
}

export async function getProduct(id) {
  const r = await apiFetch(`/products/${id}`);
  return r.json();
}

export async function createProduct(body) {
  const r = await apiFetch('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateProduct(id, body) {
  const r = await apiFetch(`/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteProduct(id) {
  const r = await apiFetch(`/products/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function getRpmLines(productId) {
  const r = await apiFetch(`/products/${productId}/rpm-lines`);
  return r.json();
}

export async function createRpmLine(productId, body) {
  const r = await apiFetch(`/products/${productId}/rpm-lines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateRpmLine(productId, lineId, body) {
  const r = await apiFetch(`/products/${productId}/rpm-lines/${lineId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteRpmLine(productId, lineId) {
  const r = await apiFetch(`/products/${productId}/rpm-lines/${lineId}`, { method: 'DELETE' });
  return r.json();
}

export async function getRpmPoints(productId) {
  const r = await apiFetch(`/products/${productId}/rpm-points`);
  return r.json();
}

export async function createRpmPoint(productId, body, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/products/${productId}/rpm-points${sp.toString() ? `?${sp}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateRpmPoint(productId, pointId, body, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/products/${productId}/rpm-points/${pointId}${sp.toString() ? `?${sp}` : ''}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteRpmPoint(productId, pointId, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/products/${productId}/rpm-points/${pointId}${sp.toString() ? `?${sp}` : ''}`, { method: 'DELETE' });
  return r.json();
}

export async function getEfficiencyPoints(productId) {
  const r = await apiFetch(`/products/${productId}/efficiency-points`);
  return r.json();
}

export async function createEfficiencyPoint(productId, body, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/products/${productId}/efficiency-points${sp.toString() ? `?${sp}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateEfficiencyPoint(productId, pointId, body, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/products/${productId}/efficiency-points/${pointId}${sp.toString() ? `?${sp}` : ''}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteEfficiencyPoint(productId, pointId, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/products/${productId}/efficiency-points/${pointId}${sp.toString() ? `?${sp}` : ''}`, { method: 'DELETE' });
  return r.json();
}

export async function refreshGraphImage(productId) {
  const r = await apiFetch(`/products/${productId}/graph-image/refresh`, {
    method: 'POST'
  });
  return r.json();
}

export async function refreshProductPdf(productId) {
  const r = await apiFetch(`/products/${productId}/pdf/refresh`, {
    method: 'POST'
  });
  return r.json();
}

export async function getProductChartData(productId) {
  const [rpmLines, rpmPoints, efficiencyPoints] = await Promise.all([
    getRpmLines(productId),
    getRpmPoints(productId),
    getEfficiencyPoints(productId)
  ]);
  return { rpmLines, rpmPoints, efficiencyPoints };
}

export async function getProductEfficiencyCurvePoints(productId) {
  const points = await getEfficiencyPoints(productId);
  return points.filter((point) => point.efficiency_centre != null);
}

export async function importEfficiencyPointsCsv() {
  throw new Error('CSV import has not been migrated to the split point model yet.');
}

export async function importMapPointsCsv() {
  throw new Error('CSV import has not been migrated to the split point model yet.');
}

export async function getMapPoints(productId) {
  const { rpmPoints, efficiencyPoints } = await getProductChartData(productId);
  return [...rpmPoints, ...efficiencyPoints];
}

export async function getFans(params = {}) {
  return getProducts(params);
}

export async function getFan(id) {
  return getProduct(id);
}

export async function createFan(body) {
  return createProduct(body);
}

export async function updateFan(id, body) {
  return updateProduct(id, body);
}

export async function deleteFan(id) {
  return deleteProduct(id);
}

export async function getFanChartData(productId) {
  return getProductChartData(productId);
}

export async function getEfficiencyCurvePoints(productId) {
  return getProductEfficiencyCurvePoints(productId);
}

export async function createMapPoint() {
  throw new Error('Use createRpmPoint or createEfficiencyPoint with the split point model.');
}

export async function updateMapPoint() {
  throw new Error('Use updateRpmPoint or updateEfficiencyPoint with the split point model.');
}

export async function deleteMapPoint() {
  throw new Error('Use deleteRpmPoint or deleteEfficiencyPoint with the split point model.');
}

export async function importRpmPointsCsv() {
  throw new Error('CSV import has not been migrated to the split point model yet.');
}

export async function uploadProductImages(productId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const r = await apiFetch(`/products/${productId}/product-images`, {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function reorderProductImages(productId, imageIds) {
  const r = await apiFetch(`/products/${productId}/product-images/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_ids: imageIds })
  });
  return r.json();
}

export async function deleteProductImage(productId, imageId) {
  const r = await apiFetch(`/products/${productId}/product-images/${imageId}`, {
    method: 'DELETE'
  });
  return r.json();
}

export async function regenerateAllGraphImages() {
  const r = await apiFetch('/maintenance/graph-images/regenerate-all', {
    method: 'POST'
  });
  return r.json();
}

export async function startRegenerateAllGraphImagesJob() {
  const r = await apiFetch('/maintenance/jobs/graph-images/regenerate-all', {
    method: 'POST'
  });
  return r.json();
}

export async function regenerateAllProductPdfs() {
  const r = await apiFetch('/maintenance/product-pdfs/regenerate-all', {
    method: 'POST'
  });
  return r.json();
}

export async function startRegenerateAllProductPdfsJob() {
  const r = await apiFetch('/maintenance/jobs/product-pdfs/regenerate-all', {
    method: 'POST'
  });
  return r.json();
}

export async function deleteAllGraphImages() {
  const r = await apiFetch('/maintenance/graph-images', {
    method: 'DELETE'
  });
  return r.json();
}

export async function startDeleteAllGraphImagesJob() {
  const r = await apiFetch('/maintenance/jobs/graph-images/clear', {
    method: 'POST'
  });
  return r.json();
}

export async function downloadDatabaseBackupBundle() {
  const r = await apiFetch('/maintenance/backups/database/download');
  const blob = await r.blob();
  const disposition = r.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob,
    filename: filenameMatch?.[1] || 'internal_facing_db_data_backup.zip'
  };
}

export async function startDatabaseBackupBundleJob() {
  const r = await apiFetch('/maintenance/jobs/backups/database/create', {
    method: 'POST'
  });
  return r.json();
}

export async function downloadDataBackupBundle() {
  const r = await apiFetch('/maintenance/media/download');
  const blob = await r.blob();
  const disposition = r.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob,
    filename: filenameMatch?.[1] || 'internal_facing_media_data_backup.zip'
  };
}

export async function startDataBackupBundleJob() {
  const r = await apiFetch('/maintenance/jobs/media/create', {
    method: 'POST'
  });
  return r.json();
}

export async function downloadBackupBundle() {
  return downloadDatabaseBackupBundle();
}

export async function startBackupBundleJob() {
  return startDatabaseBackupBundleJob();
}

export async function restoreDatabaseBackupBundle(file) {
  const formData = new FormData();
  formData.append('file', file);
  const r = await apiFetch('/maintenance/backups/db/restore', {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function startRestoreDatabaseBackupBundleJob(file) {
  const formData = new FormData();
  formData.append('file', file);
  const r = await apiFetch('/maintenance/jobs/backups/db/restore', {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function restoreDataBackupBundle(file) {
  const formData = new FormData();
  formData.append('file', file);
  const r = await apiFetch('/maintenance/backups/media/restore', {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function startRestoreDataBackupBundleJob(file) {
  const formData = new FormData();
  formData.append('file', file);
  const r = await apiFetch('/maintenance/jobs/backups/media/restore', {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function restoreBackupBundle(file) {
  return restoreDatabaseBackupBundle(file);
}

export async function startRestoreBackupBundleJob(file) {
  return startRestoreDatabaseBackupBundleJob(file);
}

export async function listFileManagerEntries(rootName, path = '') {
  const sp = new URLSearchParams();
  if (path) sp.set('path', path);
  const r = await apiFetch(`/file-manager/${rootName}` + (sp.toString() ? `?${sp.toString()}` : ''));
  return r.json();
}

export async function downloadFileManagerEntry(rootName, path) {
  const sp = new URLSearchParams({ path });
  const r = await apiFetch(`/file-manager/${rootName}/download?${sp.toString()}`);
  const blob = await r.blob();
  const disposition = r.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob,
    filename: filenameMatch?.[1] || path.split('/').pop() || 'download.bin'
  };
}

export async function createFileManagerFolder(rootName, path, folderName) {
  const sp = new URLSearchParams();
  if (path) sp.set('path', path);
  const r = await apiFetch(`/file-manager/${rootName}/folders` + (sp.toString() ? `?${sp.toString()}` : ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_name: folderName })
  });
  return r.json();
}

export async function uploadFileManagerEntries(rootName, path, files, replaceExisting = false) {
  const sp = new URLSearchParams();
  if (path) sp.set('path', path);
  if (replaceExisting) sp.set('replace_existing', 'true');
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const r = await apiFetch(`/file-manager/${rootName}/upload` + (sp.toString() ? `?${sp.toString()}` : ''), {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function renameFileManagerEntry(rootName, path, newName) {
  const sp = new URLSearchParams({ path });
  const r = await apiFetch(`/file-manager/${rootName}/rename?${sp.toString()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: newName })
  });
  return r.json();
}

export async function deleteFileManagerEntry(rootName, path, recursive = true) {
  const sp = new URLSearchParams({ path });
  const r = await apiFetch(`/file-manager/${rootName}?${sp.toString()}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recursive })
  });
  return r.json();
}

export async function getMaintenanceJob(jobId) {
  const r = await apiFetch(`/maintenance/jobs/${jobId}`);
  return r.json();
}

export async function downloadMaintenanceJobFile(jobId) {
  const r = await apiFetch(`/maintenance/jobs/${jobId}/download`);
  const blob = await r.blob();
  const disposition = r.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  return {
    blob,
    filename: filenameMatch?.[1] || 'internal_facing_backup.zip'
  };
}

export async function getUsers() {
  const r = await apiFetch('/users');
  return r.json();
}

export async function createUser(body) {
  const r = await apiFetch('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateUser(userId, body) {
  const r = await apiFetch(`/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateUserPassword(userId, password) {
  const r = await apiFetch(`/users/${userId}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  return r.json();
}
