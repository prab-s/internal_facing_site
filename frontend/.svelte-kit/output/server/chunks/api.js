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
const MOUNTING_STYLE_OPTIONS = [
  "roof mounted",
  "inline"
];
const DISCHARGE_TYPE_OPTIONS = [
  "vertical discharge",
  "side discharge"
];
function emptyFanForm() {
  return {
    model: "",
    product_type_key: "fan",
    mounting_style: "",
    discharge_type: "",
    description_html: "",
    features_html: "",
    specifications_html: "",
    comments_html: "",
    show_rpm_band_shading: true,
    band_graph_background_color: "#ffffff",
    band_graph_label_text_color: "#000000"
  };
}
const theme = writable("light");
function getChartTheme(currentTheme) {
  if (currentTheme === "light") {
    return {
      background: "#ffffff",
      text: "#1e293b",
      grid: "#d7dde8",
      accent: "#2563eb",
      efficiency: "#15803d",
      permissible: "#dc2626",
      neutralLine: "#6b7280"
    };
  }
  return {
    background: "#1a1b26",
    text: "#c0caf5",
    grid: "#3b4261",
    accent: "#7aa2f7",
    efficiency: "#4ade80",
    permissible: "#f87171",
    neutralLine: "#9ca3af"
  };
}
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
async function getProductEfficiencyCurvePoints(productId) {
  const points = await getEfficiencyPoints(productId);
  return points.filter((point) => point.efficiency_centre != null);
}
async function getUsers() {
  const r = await apiFetch("/users");
  return r.json();
}
export {
  DISCHARGE_TYPE_OPTIONS as D,
  GLOBAL_UNIT_OPTIONS as G,
  MOUNTING_STYLE_OPTIONS as M,
  getProductTypes as a,
  getProductChartData as b,
  getProductEfficiencyCurvePoints as c,
  getChartTheme as d,
  emptyFanForm as e,
  getRpmLines as f,
  getProducts as g,
  getRpmPoints as h,
  getEfficiencyPoints as i,
  getProduct as j,
  getUsers as k,
  logout as l,
  login as m,
  getAuthSession as n,
  theme as t
};
