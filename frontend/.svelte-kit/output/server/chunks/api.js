import { w as writable } from "./index.js";
const API_BASE = "/api";
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
    notes: "",
    mounting_style: "",
    discharge_type: "",
    show_rpm_band_shading: true,
    band_graph_background_color: "#ffffff",
    band_graph_label_text_color: "#000000",
    diameter_mm: "",
    max_rpm: ""
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
async function getFans(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await apiFetch("/fans" + (sp ? "?" + sp : ""));
  return r.json();
}
async function getFan(id) {
  const r = await apiFetch(`/fans/${id}`);
  return r.json();
}
async function getRpmLines(fanId) {
  const r = await apiFetch(`/fans/${fanId}/rpm-lines`);
  return r.json();
}
async function getRpmPoints(fanId) {
  const r = await apiFetch(`/fans/${fanId}/rpm-points`);
  return r.json();
}
async function getEfficiencyPoints(fanId) {
  const r = await apiFetch(`/fans/${fanId}/efficiency-points`);
  return r.json();
}
async function getFanChartData(fanId) {
  const [rpmLines, rpmPoints, efficiencyPoints] = await Promise.all([
    getRpmLines(fanId),
    getRpmPoints(fanId),
    getEfficiencyPoints(fanId)
  ]);
  return { rpmLines, rpmPoints, efficiencyPoints };
}
async function getEfficiencyCurvePoints(fanId) {
  const points = await getEfficiencyPoints(fanId);
  return points.filter((point) => point.efficiency_centre != null);
}
async function getDatabaseMirrorStatus() {
  const r = await apiFetch("/maintenance/databases/mirror-status");
  return r.json();
}
async function getUsers() {
  const r = await apiFetch("/users");
  return r.json();
}
export {
  DISCHARGE_TYPE_OPTIONS as D,
  MOUNTING_STYLE_OPTIONS as M,
  getFanChartData as a,
  getEfficiencyCurvePoints as b,
  getChartTheme as c,
  getRpmLines as d,
  getRpmPoints as e,
  getEfficiencyPoints as f,
  getFans as g,
  getFan as h,
  emptyFanForm as i,
  getUsers as j,
  getDatabaseMirrorStatus as k,
  logout as l,
  login as m,
  getAuthSession as n,
  theme as t
};
