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
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    let message = rawText;
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
        message = rawText;
      }
    }
    const error = new Error(message);
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
  getProductChartData as d,
  getProductTypePdfContext as e,
  getProducts as f,
  getUsers as g,
  getProduct as h,
  logout as l
};
