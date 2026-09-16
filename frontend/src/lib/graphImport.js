// Keep original points, endpoints and the largest remaining interpolation errors.
export function simplifyCurve(points, axisKey = 'airflow', valueKey = 'pressure', count = 5) {
  if (!Number.isInteger(count) || count < 2) throw new Error('Points per curve must be a whole number of at least 2.');
  const sorted = points.filter(p => p[axisKey] != null && p[valueKey] != null &&
    Number.isFinite(Number(p[axisKey])) && Number.isFinite(Number(p[valueKey])))
    .slice().sort((a, b) => Number(a[axisKey]) - Number(b[axisKey]));
  if (sorted.length <= count) return sorted;
  const selected = [0, sorted.length - 1];
  while (selected.length < count) {
    let best = -1, error = -1;
    for (let segment = 1; segment < selected.length; segment++) {
      const left = selected[segment - 1], right = selected[segment];
      const x0 = Number(sorted[left][axisKey]), x1 = Number(sorted[right][axisKey]);
      const y0 = Number(sorted[left][valueKey]), y1 = Number(sorted[right][valueKey]);
      for (let i = left + 1; i < right; i++) {
        const t = x1 === x0 ? 0 : (Number(sorted[i][axisKey]) - x0) / (x1 - x0);
        const deviation = Math.abs(Number(sorted[i][valueKey]) - (y0 + t * (y1 - y0)));
        if (deviation > error) { error = deviation; best = i; }
      }
    }
    if (best < 0) break;
    selected.push(best);
    selected.sort((a, b) => a - b);
  }
  return selected.map(i => sorted[i]);
}

// Capture edits only when options change; avoid cloning dense graphs on every drag.
export function createGraphReference() {
  let reference = null, preview = '';
  const copy = value => JSON.parse(JSON.stringify(value));
  return {
    reset(state) { reference = copy(state); preview = JSON.stringify(state); },
    source(current) {
      if (!reference || JSON.stringify(current) !== preview) reference = copy(current);
      return copy(reference);
    },
    displayed(state) { preview = JSON.stringify(state); }
  };
}

export function moveOverlayPoint(points, id, key, airflow, value, createId) {
  const original = points.find(point => point.id === id);
  if (!original || !key) return points;
  const otherKeys = ['efficiency_centre', 'efficiency_lower_end', 'efficiency_higher_end', 'permissible_use']
    .filter(other => other !== key);
  const updated = { ...original, airflow, [key]: value };
  const shared = otherKeys.some(other => original[other] != null);
  if (shared && Number(airflow) !== Number(original.airflow)) {
    const retained = { ...original, id: createId(), [key]: null };
    for (const other of otherKeys) updated[other] = null;
    return [...points.map(point => point.id === id ? updated : point), retained];
  }
  return points.map(point => point.id === id ? updated : point);
}
