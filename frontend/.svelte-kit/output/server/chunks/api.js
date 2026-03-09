const API_BASE = "http://localhost:8001";
function url(path) {
  return `${API_BASE}${path}`;
}
async function getFans(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await fetch(url("/api/fans" + (sp ? "?" + sp : "")));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function getFan(id) {
  const r = await fetch(url(`/api/fans/${id}`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function getMapPoints(fanId) {
  const r = await fetch(url(`/api/fans/${fanId}/map-points`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export {
  getMapPoints as a,
  getFan as b,
  getFans as g
};
