import { A as API_BASE } from "./config.js";
function url(path) {
  return `${API_BASE}${path}`;
}
let csrfToken = "";
async function ensureCsrfToken(fetchImpl, force = false) {
  if (csrfToken && !force) return;
  const response = await fetchImpl(url("/auth/session"), { credentials: "include" });
  if (response.ok) {
    const payload = await response.json();
    csrfToken = payload?.csrf_token || "";
  }
}
async function apiFetch(path, options = {}, fetchImpl = fetch) {
  const method = String(options.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !path.endsWith("/auth/session")) {
    await ensureCsrfToken(fetchImpl);
  }
  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (csrfToken && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    headers.set("X-CSRF-Token", csrfToken);
  }
  let response = await fetchImpl(url(path), {
    ...options,
    credentials: "include",
    headers
  });
  if (response.status === 403 && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    let detail = "";
    try {
      detail = (await response.clone().json())?.detail || "";
    } catch {
      detail = "";
    }
    if (detail === "CSRF validation failed.") {
      csrfToken = "";
      await ensureCsrfToken(fetchImpl, true);
      if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
      response = await fetchImpl(url(path), {
        ...options,
        credentials: "include",
        headers
      });
    }
  }
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    const fallbackMessage = "The request could not be completed. Please try again.";
    let message = "";
    if (contentType.includes("application/json")) {
      try {
        const payload = JSON.parse(rawText);
        if (typeof payload?.detail === "string") {
          message = payload.detail;
        } else if (Array.isArray(payload?.detail)) {
          message = payload.detail.map((item) => {
            const location = Array.isArray(item?.loc) ? item.loc.filter(Boolean).join(".") : "";
            const prefix = location ? `${location}: ` : "";
            return `${prefix}${item?.msg || "Invalid value"}`;
          }).join("; ");
        } else if (typeof payload?.message === "string") {
          message = payload.message;
        }
      } catch {
        message = "";
      }
    } else if (!contentType.includes("text/html")) {
      message = rawText;
    }
    message = String(message || fallbackMessage).trim();
    if (/<\/?[a-z][^>]*>/i.test(message)) message = fallbackMessage;
    const error = new Error(message.slice(0, 500));
    error.status = response.status;
    throw error;
  }
  return response;
}
async function getAuthSession() {
  const r = await apiFetch("/auth/session");
  const payload = await r.json();
  csrfToken = payload?.csrf_token || csrfToken;
  return payload;
}
async function login(username, password) {
  csrfToken = "";
  const r = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const payload = await r.json();
  csrfToken = payload?.csrf_token || csrfToken;
  return payload;
}
async function logout() {
  const r = await apiFetch("/auth/logout", {
    method: "POST"
  });
  const payload = await r.json();
  csrfToken = payload?.csrf_token || "";
  return payload;
}
async function getProducts(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch("/products" + (sp ? "?" + sp : ""));
  return r.json();
}
async function getProductTypes() {
  const r = await apiFetch("/product-types");
  return r.json();
}
async function getProductTypePdfContext(id) {
  const r = await apiFetch(`/product-types/${id}/pdf-context`);
  return r.json();
}
async function getSeries(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch("/series" + (sp ? "?" + sp : ""));
  return r.json();
}
async function getSeriesById(id) {
  const r = await apiFetch(`/series/${encodeURIComponent(String(id))}`);
  return r.json();
}
async function getPublicSeries(seriesIdentifier, fetchImpl = fetch) {
  const r = await apiFetch(`/public/series/${encodeURIComponent(seriesIdentifier)}`, {}, fetchImpl);
  return r.json();
}
async function getPublicProductTypes(fetchImpl = fetch) {
  const r = await apiFetch("/public/product-types", {}, fetchImpl);
  return r.json();
}
async function getPublicProducts(params = {}, fetchImpl = fetch) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch("/public/products" + (sp ? `?${sp}` : ""), {}, fetchImpl);
  return r.json();
}
async function getPublicProduct(productIdentifier, fetchImpl = fetch) {
  const r = await apiFetch(`/public/products/${encodeURIComponent(productIdentifier)}`, {}, fetchImpl);
  return r.json();
}
async function uploadSeriesImages(seriesId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const r = await apiFetch(`/series/${seriesId}/series-images`, {
    method: "POST",
    body: formData
  });
  return r.json();
}
async function reorderSeriesImages(seriesId, imageIds) {
  const r = await apiFetch(`/series/${seriesId}/series-images/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_ids: imageIds })
  });
  return r.json();
}
async function deleteSeriesImage(seriesId, imageId) {
  const r = await apiFetch(`/series/${seriesId}/series-images/${imageId}`, {
    method: "DELETE"
  });
  return r.json();
}
function associatedDocumentsPath(ownerType, ownerId, documentId = "") {
  const collection = {
    product: "products",
    product_type: "product-types",
    series: "series"
  }[ownerType] || ownerType;
  return `/${collection}/${ownerId}/documents${documentId ? `/${documentId}` : ""}`;
}
async function getAssociatedDocuments(ownerType, ownerId) {
  const r = await apiFetch(associatedDocumentsPath(ownerType, ownerId));
  return r.json();
}
async function getProduct(id) {
  const r = await apiFetch(`/products/${id}`);
  return r.json();
}
async function updateProduct(id, body) {
  const r = await apiFetch(`/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}
async function getRpmLines(productId) {
  const r = await apiFetch(`/products/${productId}/rpm-lines`);
  return r.json();
}
async function getRpmPoints(productId) {
  const r = await apiFetch(`/products/${productId}/rpm-points`);
  return r.json();
}
async function getEfficiencyPoints(productId) {
  const r = await apiFetch(`/products/${productId}/efficiency-points`);
  return r.json();
}
async function refreshGraphImage(productId) {
  const r = await apiFetch(`/products/${productId}/graph-image/refresh`, {
    method: "POST"
  });
  return r.json();
}
async function startRefreshProductPdfJob(productId) {
  const r = await apiFetch(`/maintenance/jobs/products/${productId}/pdf/refresh`, {
    method: "POST"
  });
  return r.json();
}
async function getProductChartData(productId) {
  const [rpmLines, rpmPoints, efficiencyPoints] = await Promise.all([
    getRpmLines(productId),
    getRpmPoints(productId),
    getEfficiencyPoints(productId)
  ]);
  return { rpmLines, rpmPoints, efficiencyPoints };
}
async function uploadProductImages(productId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const r = await apiFetch(`/products/${productId}/product-images`, {
    method: "POST",
    body: formData
  });
  return r.json();
}
async function reorderProductImages(productId, imageIds) {
  const r = await apiFetch(`/products/${productId}/product-images/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_ids: imageIds })
  });
  return r.json();
}
async function deleteProductImage(productId, imageId) {
  const r = await apiFetch(`/products/${productId}/product-images/${imageId}`, {
    method: "DELETE"
  });
  return r.json();
}
async function getMaintenanceJob(jobId) {
  const r = await apiFetch(`/maintenance/jobs/${jobId}`);
  return r.json();
}
async function getUsers() {
  const r = await apiFetch("/users");
  return r.json();
}
export {
  getProductTypes as A,
  getProductChartData as B,
  getProductTypePdfContext as C,
  reorderProductImages as a,
  uploadProductImages as b,
  getProduct as c,
  deleteProductImage as d,
  getRpmLines as e,
  getRpmPoints as f,
  getProducts as g,
  getEfficiencyPoints as h,
  login as i,
  getAuthSession as j,
  getMaintenanceJob as k,
  logout as l,
  getAssociatedDocuments as m,
  getSeriesById as n,
  deleteSeriesImage as o,
  reorderSeriesImages as p,
  uploadSeriesImages as q,
  refreshGraphImage as r,
  startRefreshProductPdfJob as s,
  getPublicProductTypes as t,
  updateProduct as u,
  getPublicProducts as v,
  getPublicProduct as w,
  getPublicSeries as x,
  getSeries as y,
  getUsers as z
};
