import { A as API_BASE } from "./config.js";
function url(path) {
  return `${API_BASE}${path}`;
}
async function apiFetch(path, options = {}) {
  const response = await fetch(url(path), {
    credentials: "include",
    ...options
  });
  if (!response.ok) {
    const error = new Error(await response.text());
    error.status = response.status;
    throw error;
  }
  return response;
}
async function getAuthSession() {
  const r = await apiFetch("/auth/session");
  return r.json();
}
async function login(username, password) {
  const r = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  return r.json();
}
async function logout() {
  const r = await apiFetch("/auth/logout", {
    method: "POST"
  });
  return r.json();
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
async function getProduct(id) {
  const r = await apiFetch(`/products/${id}`);
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
async function getProductChartData(productId) {
  const [rpmLines, rpmPoints, efficiencyPoints] = await Promise.all([
    getRpmLines(productId),
    getRpmPoints(productId),
    getEfficiencyPoints(productId)
  ]);
  return { rpmLines, rpmPoints, efficiencyPoints };
}
async function getUsers() {
  const r = await apiFetch("/users");
  return r.json();
}
export {
  getProductTypes as a,
  login as b,
  getAuthSession as c,
  getProductTypePdfContext as d,
  getProducts as e,
  getProduct as f,
  getUsers as g,
  getProductChartData as h,
  logout as l
};
