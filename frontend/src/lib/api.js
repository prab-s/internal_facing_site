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

export async function getFans(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch('/fans' + (sp ? '?' + sp : ''));
  return r.json();
}

export async function getFan(id) {
  const r = await apiFetch(`/fans/${id}`);
  return r.json();
}

export async function createFan(body) {
  const r = await apiFetch('/fans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateFan(id, body) {
  const r = await apiFetch(`/fans/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteFan(id) {
  const r = await apiFetch(`/fans/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function getRpmLines(fanId) {
  const r = await apiFetch(`/fans/${fanId}/rpm-lines`);
  return r.json();
}

export async function createRpmLine(fanId, body) {
  const r = await apiFetch(`/fans/${fanId}/rpm-lines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateRpmLine(fanId, lineId, body) {
  const r = await apiFetch(`/fans/${fanId}/rpm-lines/${lineId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteRpmLine(fanId, lineId) {
  const r = await apiFetch(`/fans/${fanId}/rpm-lines/${lineId}`, { method: 'DELETE' });
  return r.json();
}

export async function getRpmPoints(fanId) {
  const r = await apiFetch(`/fans/${fanId}/rpm-points`);
  return r.json();
}

export async function createRpmPoint(fanId, body, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/fans/${fanId}/rpm-points${sp.toString() ? `?${sp}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateRpmPoint(fanId, pointId, body, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/fans/${fanId}/rpm-points/${pointId}${sp.toString() ? `?${sp}` : ''}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteRpmPoint(fanId, pointId, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/fans/${fanId}/rpm-points/${pointId}${sp.toString() ? `?${sp}` : ''}`, { method: 'DELETE' });
  return r.json();
}

export async function getEfficiencyPoints(fanId) {
  const r = await apiFetch(`/fans/${fanId}/efficiency-points`);
  return r.json();
}

export async function createEfficiencyPoint(fanId, body, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/fans/${fanId}/efficiency-points${sp.toString() ? `?${sp}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateEfficiencyPoint(fanId, pointId, body, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/fans/${fanId}/efficiency-points/${pointId}${sp.toString() ? `?${sp}` : ''}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function deleteEfficiencyPoint(fanId, pointId, options = {}) {
  const sp = new URLSearchParams();
  if (options.regenerateGraph === false) sp.set('regenerate_graph', 'false');
  const r = await apiFetch(`/fans/${fanId}/efficiency-points/${pointId}${sp.toString() ? `?${sp}` : ''}`, { method: 'DELETE' });
  return r.json();
}

export async function refreshGraphImage(fanId) {
  const r = await apiFetch(`/fans/${fanId}/graph-image/refresh`, {
    method: 'POST'
  });
  return r.json();
}

export async function getFanChartData(fanId) {
  const [rpmLines, rpmPoints, efficiencyPoints] = await Promise.all([
    getRpmLines(fanId),
    getRpmPoints(fanId),
    getEfficiencyPoints(fanId)
  ]);
  return { rpmLines, rpmPoints, efficiencyPoints };
}

export async function getEfficiencyCurvePoints(fanId) {
  const points = await getEfficiencyPoints(fanId);
  return points.filter((point) => point.efficiency_centre != null);
}

export async function importEfficiencyPointsCsv() {
  throw new Error('CSV import has not been migrated to the split point model yet.');
}

export async function importMapPointsCsv() {
  throw new Error('CSV import has not been migrated to the split point model yet.');
}

export async function getMapPoints(fanId) {
  const { rpmPoints, efficiencyPoints } = await getFanChartData(fanId);
  return [...rpmPoints, ...efficiencyPoints];
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

export async function importRpmPointsCsv(fanId, csvText) {
  const r = await apiFetch(`/fans/${fanId}/map-points/import-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv: csvText })
  });
  return r.json();
}

export async function uploadProductImages(fanId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const r = await apiFetch(`/fans/${fanId}/product-images`, {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function reorderProductImages(fanId, imageIds) {
  const r = await apiFetch(`/fans/${fanId}/product-images/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_ids: imageIds })
  });
  return r.json();
}

export async function deleteProductImage(fanId, imageId) {
  const r = await apiFetch(`/fans/${fanId}/product-images/${imageId}`, {
    method: 'DELETE'
  });
  return r.json();
}

export async function getDatabaseMirrorStatus() {
  const r = await apiFetch('/maintenance/databases/mirror-status');
  return r.json();
}

export async function resyncPostgresMirror() {
  const r = await apiFetch('/maintenance/databases/resync-postgres', {
    method: 'POST'
  });
  return r.json();
}

export async function regenerateAllGraphImages() {
  const r = await apiFetch('/maintenance/graph-images/regenerate-all', {
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

export async function downloadBackupBundle() {
  const r = await apiFetch('/maintenance/backups/download');
  const blob = await r.blob();
  const disposition = r.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob,
    filename: filenameMatch?.[1] || 'fan_graphs_backup.zip'
  };
}

export async function restoreBackupBundle(file) {
  const formData = new FormData();
  formData.append('file', file);
  const r = await apiFetch('/maintenance/backups/restore', {
    method: 'POST',
    body: formData
  });
  return r.json();
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
