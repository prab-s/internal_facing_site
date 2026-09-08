(function () {
  const finderStorageKey = "customerFacingFinderState";
  const eventName = "customer-facing-performance-target-change";

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function readQuery() {
    try { return new URLSearchParams(window.localStorage.getItem(finderStorageKey) || ""); }
    catch (_error) { return new URLSearchParams(); }
  }

  function readFilters(params) {
    try {
      const filters = JSON.parse(params.get("parameter_filters") || "[]");
      return Array.isArray(filters) ? filters : [];
    } catch (_error) { return []; }
  }

  function findTarget(filters, name) {
    const item = filters.find((filter) =>
      String(filter?.group_name || "").toLowerCase() === "__graph__" &&
      String(filter?.parameter_name || "").toLowerCase() === name
    );
    return item ? finiteNumber(item.min_number ?? item.max_number) : null;
  }

  function read() {
    const filters = readFilters(readQuery());
    return { airflow: findTarget(filters, "airflow"), pressure: findTarget(filters, "pressure") };
  }

  function write(next) {
    const current = read();
    const nextAirflow = finiteNumber(next?.airflow);
    const nextPressure = finiteNumber(next?.pressure);
    if (current.airflow === nextAirflow && current.pressure === nextPressure) return;
    const params = readQuery();
    const filters = readFilters(params).filter((filter) => {
      const group = String(filter?.group_name || "").toLowerCase();
      const name = String(filter?.parameter_name || "").toLowerCase();
      return !(group === "__graph__" && (name === "airflow" || name === "pressure"));
    });
    for (const [name, value] of [["Airflow", nextAirflow], ["Pressure", nextPressure]]) {
      const number = finiteNumber(value);
      if (number == null) continue;
      filters.push({ group_name: "__graph__", parameter_name: name, min_number: number, max_number: number });
    }
    if (filters.length) params.set("parameter_filters", JSON.stringify(filters));
    else params.delete("parameter_filters");
    try {
      const query = params.toString();
      if (query) window.localStorage.setItem(finderStorageKey, query);
      else window.localStorage.removeItem(finderStorageKey);
    } catch (_error) {}
    window.dispatchEvent(new CustomEvent(eventName, { detail: read() }));
  }

  window.CustomerFacingPerformanceTarget = { eventName, read, write };
})();
