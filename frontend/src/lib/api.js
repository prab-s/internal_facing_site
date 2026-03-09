import { API_BASE } from '$lib/config.js';

function url(path) {
  return `${API_BASE}${path}`;
}

export async function health() {
  const r = await fetch(url('/api/health'));
  return r.json();
}

export async function getFans(params = {}) {
  const sp = new URLSearchParams(params).toString();
  const r = await fetch(url('/api/fans' + (sp ? '?' + sp : '')));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getFan(id) {
  const r = await fetch(url(`/api/fans/${id}`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createFan(body) {
  const r = await fetch(url('/api/fans'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateFan(id, body) {
  const r = await fetch(url(`/api/fans/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteFan(id) {
  const r = await fetch(url(`/api/fans/${id}`), { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getMapPoints(fanId) {
  const r = await fetch(url(`/api/fans/${fanId}/map-points`));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createMapPoint(fanId, body) {
  const r = await fetch(url(`/api/fans/${fanId}/map-points`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateMapPoint(fanId, pointId, body) {
  const r = await fetch(url(`/api/fans/${fanId}/map-points/${pointId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteMapPoint(fanId, pointId) {
  const r = await fetch(url(`/api/fans/${fanId}/map-points/${pointId}`), { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function importMapPointsCsv(fanId, csvText) {
  const r = await fetch(url(`/api/fans/${fanId}/map-points/import-csv`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv: csvText })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
