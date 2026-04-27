import { w as writable } from "./index.js";
const API_BASE = "/api";
const GLOBAL_UNIT_OPTIONS = [
  "A",
  "Hz",
  "kg",
  "kW",
  "L/s",
  "m3/h",
  "mm",
  "Pa",
  "RPM",
  "V",
  "°C"
];
function emptyProductForm() {
  return {
    model: "",
    product_type_key: "fan",
    series_id: null,
    series_name: "",
    printed_template_id: "",
    online_template_id: "",
    description1_html: "",
    description2_html: "",
    description3_html: "",
    comments_html: "",
    show_rpm_band_shading: true,
    band_graph_background_color: "#ffffff",
    band_graph_label_text_color: "#000000"
  };
}
const theme = writable("light");
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
  GLOBAL_UNIT_OPTIONS as G,
  getRpmLines as a,
  getRpmPoints as b,
  getEfficiencyPoints as c,
  getUsers as d,
  emptyProductForm as e,
  getProductTypes as f,
  getProduct as g,
  login as h,
  getAuthSession as i,
  getProducts as j,
  getProductChartData as k,
  logout as l,
  theme as t
};
