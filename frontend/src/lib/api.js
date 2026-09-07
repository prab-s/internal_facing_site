import { API_BASE } from '$lib/config.js';

function url(path) {
  return `${API_BASE}${path}`;
}

let csrfToken = '';

async function ensureCsrfToken(fetchImpl, force = false) {
  if (csrfToken && !force) return;
  const response = await fetchImpl(url('/auth/session'), { credentials: 'include' });
  if (response.ok) {
    const payload = await response.json();
    csrfToken = payload?.csrf_token || '';
  }
}

async function apiFetch(path, options = {}, fetchImpl = fetch) {
  const method = String(options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && !path.endsWith('/auth/session')) {
    await ensureCsrfToken(fetchImpl);
  }
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (csrfToken && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    headers.set('X-CSRF-Token', csrfToken);
  }
  let response = await fetchImpl(url(path), {
    ...options,
    credentials: 'include',
    headers
  });

  // A browser can retain this module state after the server-side session has
  // expired or been cleared in another tab. Refresh the token and retry once;
  // the CSRF dependency rejects the request before any endpoint side effect.
  if (response.status === 403 && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    let detail = '';
    try {
      detail = (await response.clone().json())?.detail || '';
    } catch {
      detail = '';
    }
    if (detail === 'CSRF validation failed.') {
      csrfToken = '';
      await ensureCsrfToken(fetchImpl, true);
      if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
      response = await fetchImpl(url(path), {
        ...options,
        credentials: 'include',
        headers
      });
    }
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const fallbackMessage = 'The request could not be completed. Please try again.';
    let message = '';
    if (contentType.includes('application/json')) {
      try {
        const payload = JSON.parse(rawText);
        if (typeof payload?.detail === 'string') {
          message = payload.detail;
        } else if (Array.isArray(payload?.detail)) {
          message = payload.detail
            .map((item) => {
              const location = Array.isArray(item?.loc) ? item.loc.filter(Boolean).join('.') : '';
              const prefix = location ? `${location}: ` : '';
              return `${prefix}${item?.msg || 'Invalid value'}`;
            })
            .join('; ');
        } else if (typeof payload?.message === 'string') {
          message = payload.message;
        }
      } catch {
        message = '';
      }
    } else if (!contentType.includes('text/html')) {
      message = rawText;
    }
    message = String(message || fallbackMessage).trim();
    // Proxies and framework error handlers may return a full HTML document.
    // Keep markup and potentially huge response bodies out of UI error alerts.
    if (/<\/?[a-z][^>]*>/i.test(message)) message = fallbackMessage;
    const error = new Error(message.slice(0, 500));
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
  const payload = await r.json();
  csrfToken = payload?.csrf_token || csrfToken;
  return payload;
}

export async function login(username, password) {
  // Login may be the first request after an expired or externally-cleared
  // session, so never send a token belonging to the previous session.
  csrfToken = '';
  const r = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const payload = await r.json();
  csrfToken = payload?.csrf_token || csrfToken;
  return payload;
}

export async function logout() {
  const r = await apiFetch('/auth/logout', {
    method: 'POST'
  });
  const payload = await r.json();
  csrfToken = payload?.csrf_token || '';
  return payload;
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

export async function getProductSelectorOptions(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch('/products/selector' + (sp ? '?' + sp : ''));
  return r.json();
}

export async function applyBulkAction(body) {
  const r = await apiFetch('/bulk-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
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

export async function deleteProductType(id) {
  const r = await apiFetch(`/product-types/${id}`, {
    method: 'DELETE'
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

export async function startRefreshProductTypePdfJob(id) {
  const r = await apiFetch(`/maintenance/jobs/product-types/${id}/pdf/refresh`, {
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

export async function uploadTemplateAsset(templateType, templateId, body) {
  const r = await apiFetch(`/templates/${templateType}/${encodeURIComponent(templateId)}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function getCmsPages() {
  const r = await apiFetch('/cms/pages');
  return r.json();
}

export async function getCmsNavigation() {
  const r = await apiFetch('/cms/navigation');
  return r.json();
}

export async function updateCmsNavigation(items) {
  const r = await apiFetch('/cms/navigation', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  return r.json();
}

export async function updateCmsPage(slug, body) {
  const r = await apiFetch(`/cms/pages/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function createCmsPage(body) {
  const r = await apiFetch('/cms/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

export async function publishCmsPage(slug) {
  const r = await apiFetch(`/cms/pages/${encodeURIComponent(slug)}/publish`, { method: 'POST' });
  return r.json();
}

export async function deleteCmsPage(slug) {
  if (slug === 'enquiries-modal') {
    throw new Error('The Enquiries modal is protected and cannot be deleted.');
  }
  const r = await apiFetch(`/cms/pages/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  return r.json();
}

export async function getCmsAssets() {
  const r = await apiFetch('/cms/assets');
  return r.json();
}

export async function uploadCmsAsset(file) {
  const formData = new FormData();
  formData.append('file', file);
  const r = await apiFetch('/cms/assets', { method: 'POST', body: formData });
  return r.json();
}

export async function deleteCmsAsset(fileName) {
  const r = await apiFetch(`/cms/assets/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
  return r.json();
}

export async function getSeries(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch('/series' + (sp ? '?' + sp : ''));
  return r.json();
}

export async function getQuoteRequests(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch('/quote-requests' + (sp ? `?${sp}` : ''));
  return r.json();
}

export async function deleteQuoteRequest(id) {
  const r = await apiFetch(`/quote-requests/${encodeURIComponent(String(id))}`, {
    method: 'DELETE'
  });
  return r.json();
}

export async function sendQuoteRequestEmailTest(body) {
  const r = await apiFetch('/settings/quote-request-email-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function getSmtpSettings() {
  const r = await apiFetch('/settings/smtp');
  return r.json();
}

export async function updateSmtpSettings(body) {
  const r = await apiFetch('/settings/smtp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function clearSmtpSettings() {
  const r = await apiFetch('/settings/smtp', { method: 'DELETE' });
  return r.json();
}

export async function testSmtpSettings(body = {}) {
  const r = await apiFetch('/settings/smtp/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

export async function updateQuoteRequestStatus(id, status) {
  const r = await apiFetch(`/quote-requests/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return r.json();
}

export async function getSeriesById(id) {
  const r = await apiFetch(`/series/${encodeURIComponent(String(id))}`);
  return r.json();
}

export async function getPublicSeries(seriesIdentifier, fetchImpl = fetch) {
  const r = await apiFetch(`/public/series/${encodeURIComponent(seriesIdentifier)}`, {}, fetchImpl);
  return r.json();
}

export async function getPublicProductTypes(fetchImpl = fetch) {
  const r = await apiFetch('/public/product-types', {}, fetchImpl);
  return r.json();
}

export async function getPublicProducts(params = {}, fetchImpl = fetch) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch('/public/products' + (sp ? `?${sp}` : ''), {}, fetchImpl);
  return r.json();
}

export async function getPublicProduct(productIdentifier, fetchImpl = fetch) {
  const r = await apiFetch(`/public/products/${encodeURIComponent(productIdentifier)}`, {}, fetchImpl);
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

export async function getSeriesImages(seriesId) {
  const r = await apiFetch(`/series/${seriesId}/series-images`);
  return r.json();
}

export async function uploadSeriesImages(seriesId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const r = await apiFetch(`/series/${seriesId}/series-images`, {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function reorderSeriesImages(seriesId, imageIds) {
  const r = await apiFetch(`/series/${seriesId}/series-images/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_ids: imageIds })
  });
  return r.json();
}

export async function deleteSeriesImage(seriesId, imageId) {
  const r = await apiFetch(`/series/${seriesId}/series-images/${imageId}`, {
    method: 'DELETE'
  });
  return r.json();
}

function associatedDocumentsPath(ownerType, ownerId, documentId = '') {
  const collection = {
    product: 'products',
    product_type: 'product-types',
    series: 'series'
  }[ownerType] || ownerType;
  return `/${collection}/${ownerId}/documents${documentId ? `/${documentId}` : ''}`;
}

export async function getAssociatedDocuments(ownerType, ownerId) {
  const r = await apiFetch(associatedDocumentsPath(ownerType, ownerId));
  return r.json();
}

export async function uploadAssociatedDocuments(ownerType, ownerId, files) {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  const r = await apiFetch(associatedDocumentsPath(ownerType, ownerId), {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function deleteAssociatedDocument(ownerType, ownerId, documentId) {
  const r = await apiFetch(associatedDocumentsPath(ownerType, ownerId, documentId), {
    method: 'DELETE'
  });
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

export async function startRefreshSeriesPdfJob(id) {
  const r = await apiFetch(`/maintenance/jobs/series/${id}/pdf/refresh`, {
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

export async function replaceProductGraphData(productId, body) {
  const r = await apiFetch(`/products/${productId}/graph-data`, {
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

export async function startRefreshProductPdfJob(productId) {
  const r = await apiFetch(`/maintenance/jobs/products/${productId}/pdf/refresh`, {
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

export async function startRegenerateAllSeriesPdfsJob() {
  const r = await apiFetch('/maintenance/jobs/series-pdfs/regenerate-all', {
    method: 'POST'
  });
  return r.json();
}

export async function startRegenerateAllProductTypePdfsJob() {
  const r = await apiFetch('/maintenance/jobs/product-type-pdfs/regenerate-all', {
    method: 'POST'
  });
  return r.json();
}

export async function startRegenerateEverythingJob() {
  const r = await apiFetch('/maintenance/jobs/regenerate-everything', {
    method: 'POST'
  });
  return r.json();
}

export async function startRefreshAllProductTypesPdfJob() {
  const r = await apiFetch('/maintenance/jobs/all-product-types-pdf/refresh', {
    method: 'POST'
  });
  return r.json();
}

export async function startRefreshCustomerFacingCacheJob() {
  const r = await apiFetch('/maintenance/jobs/customer-facing-cache/refresh', {
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

export async function startMediaBackupChunkJob(chunkId) {
  const r = await apiFetch(`/maintenance/jobs/media/${encodeURIComponent(chunkId)}/create`, {
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

export async function startRestoreDataBackupBundleJob(files) {
  const formData = new FormData();
  const selectedFiles = Array.isArray(files) ? files : [files];
  for (const file of selectedFiles) {
    formData.append('files', file);
  }
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

export async function getFileManagerEntryContent(rootName, path) {
  const sp = new URLSearchParams({ path });
  const r = await apiFetch(`/file-manager/${rootName}/content?${sp.toString()}`);
  return r.json();
}

export async function updateFileManagerEntryContent(rootName, path, content) {
  const sp = new URLSearchParams({ path });
  const r = await apiFetch(`/file-manager/${rootName}/content?${sp.toString()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  return r.json();
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

export async function runBulkImport(
  files,
  {
    dryRun = false,
    downsampleImportedCurves = true,
    downsamplePointCount = 5
  } = {}
) {
  const sp = new URLSearchParams();
  if (dryRun) sp.set('dry_run', 'true');
  if (downsampleImportedCurves) sp.set('downsample_imported_curves', 'true');
  if (downsamplePointCount != null) sp.set('downsample_point_count', String(downsamplePointCount));
  const formData = new FormData();
  for (const file of files) {
    const relativeName = file?.webkitRelativePath || file?.name || 'upload.bin';
    formData.append('files', file, relativeName);
  }
  const r = await apiFetch(`/bulk-import${sp.toString() ? `?${sp.toString()}` : ''}`, {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function runBulkWorkbookImport(
  files,
  {
    dryRun = false,
    downsampleImportedCurves = true,
    downsamplePointCount = 5,
    manifestJson = null
  } = {}
) {
  const sp = new URLSearchParams();
  if (dryRun) sp.set('dry_run', 'true');
  if (downsampleImportedCurves) sp.set('downsample_imported_curves', 'true');
  if (downsamplePointCount != null) sp.set('downsample_point_count', String(downsamplePointCount));
  const formData = new FormData();
  if (manifestJson) {
    formData.append('manifest_json', typeof manifestJson === 'string' ? manifestJson : JSON.stringify(manifestJson));
  }
  for (const file of files) {
    const relativeName = file?.webkitRelativePath || file?.name || 'upload.bin';
    formData.append('files', file, relativeName);
  }
  const r = await apiFetch(`/bulk-import${sp.toString() ? `?${sp.toString()}` : ''}`, {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function parseGraphDataUpload(file) {
  const formData = new FormData();
  formData.append('file', file, file?.name || 'graph-data.csv');
  const r = await apiFetch('/graph-data/parse', {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function uploadBulkProductImages(productId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file, file?.name || 'image.png');
  }
  const r = await apiFetch(`/products/${productId}/product-images/bulk`, {
    method: 'POST',
    body: formData
  });
  return r.json();
}

export async function uploadBulkSeriesImages(seriesId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file, file?.name || 'image.png');
  }
  const r = await apiFetch(`/series/${seriesId}/series-images/bulk`, {
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

export async function getRegenerationOverview() {
  const r = await apiFetch('/maintenance/regeneration/overview');
  return r.json();
}

export async function cancelMaintenanceJob(jobId) {
  const r = await apiFetch(`/maintenance/jobs/${jobId}/cancel`, { method: 'POST' });
  return r.json();
}

export function getSetupLogsStreamUrl(afterId = 0) {
  const sp = new URLSearchParams();
  if (afterId) sp.set('after_id', String(afterId));
  return `${API_BASE}/setup/logs/stream${sp.toString() ? `?${sp.toString()}` : ''}`;
}

export async function getCustomerFacingLogsRecent(limit = 200, publicOnly = true) {
  const sp = new URLSearchParams({
    limit: String(limit),
    public_only: publicOnly ? 'true' : 'false'
  });
  const r = await apiFetch(`/customer-facing/logs/recent?${sp.toString()}`);
  return r.json();
}

export async function getPublicAccessLogsRecent(limit = 200, site = 'internal', routeGroup = '') {
  const sp = new URLSearchParams({ limit: String(limit) });
  if (site) sp.set('site', site);
  if (routeGroup) sp.set('route_group', routeGroup);
  const r = await apiFetch(`/public-access/logs/recent?${sp.toString()}`);
  return r.json();
}

export async function getInternalDeviceActivityRecent(limit = 2000, since = '') {
  const sp = new URLSearchParams({ limit: String(limit) });
  if (since) sp.set('since', since);
  const r = await apiFetch(`/internal-device-activity/recent?${sp.toString()}`);
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
