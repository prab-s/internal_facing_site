const form = document.querySelector("#finder-form");
const results = document.querySelector("#finder-results");
const seriesFilterHost = document.querySelector("#series-filter");
const mainFiltersHost = document.querySelector("#main-filters");
const advancedFiltersHost = document.querySelector("#advanced-filters");
const advancedToggle = document.querySelector("#advanced-toggle");
const themeToggle = document.querySelector("#theme-toggle");
const productTypeSelect = form?.querySelector('[name="product_type_key"]') || null;

let advancedOpen = false;
let filterMetadata = { groups: [] };
let activeRefreshToken = 0;
const themeStorageKey = "customerFacingTheme";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getPreferredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (storedTheme === "dark" || storedTheme === "light") {
      return storedTheme;
    }
  } catch (_error) {
    // Ignore localStorage errors and fall back to a light default.
  }

  return "light";
}

function updateThemeToggle(theme) {
  if (!themeToggle) return;

  const isDark = theme === "dark";
  const icon = themeToggle.querySelector(".theme-toggle-icon");
  const label = themeToggle.querySelector(".theme-toggle-label");

  document.documentElement.dataset.bsTheme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));

  if (icon) {
    icon.textContent = isDark ? "☀" : "☾";
  }

  if (label) {
    label.textContent = isDark ? "Light mode" : "Dark mode";
  }
}

function setTheme(theme, persist = true) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  updateThemeToggle(nextTheme);

  if (!persist) return;

  try {
    window.localStorage.setItem(themeStorageKey, nextTheme);
  } catch (_error) {
    // Ignore storage errors; the theme still applies for the current session.
  }
}

function getSelectedProductType() {
  if (!form) return null;
  const selectedKey = productTypeSelect?.value || "";
  return selectedKey;
}

function getGroupOrder(groupName) {
  return (groupName || "").trim().toLowerCase() === "main" ? 0 : 1;
}

function groupParameters(group) {
  const grouped = new Map();

  for (const parameter of group?.parameters || []) {
    const key = parameter.parameter_name || "";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(parameter);
  }

  return Array.from(grouped.entries()).map(([parameterName, parameters]) => ({ parameterName, parameters }));
}

function buildSelectField(groupName, parameterName, label, values, metadata = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "mb-3";
  wrapper.dataset.groupName = groupName;
  wrapper.dataset.parameterName = parameterName;
  wrapper.dataset.filterKind = metadata.kind || "select";

  const placeholder = metadata.placeholder || "-- select option --";
  const options = values.length > 0
    ? values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")
    : '<option value="" disabled>No options available</option>';

  wrapper.innerHTML = `
    <label class="form-label">${escapeHtml(label)}</label>
    <select class="form-select finder-filter-input">
      <option value="">${escapeHtml(placeholder)}</option>
      ${options}
    </select>
  `;

  return wrapper;
}

function buildSeriesField(seriesOptions) {
  const wrapper = document.createElement("div");
  wrapper.className = "mb-3";
  wrapper.dataset.groupName = "";
  wrapper.dataset.parameterName = "series_id";
  wrapper.dataset.filterKind = "series";

  const options = (seriesOptions || [])
    .map((series) => `<option value="${escapeHtml(series.id)}">${escapeHtml(series.name)}${series.product_count ? ` (${series.product_count})` : ""}</option>`)
    .join("");

  wrapper.innerHTML = `
    <label class="form-label">Series</label>
    <select class="form-select finder-filter-series">
      <option value="">-- select option --</option>
      ${options || '<option value="" disabled>No series available</option>'}
    </select>
  `;

  return wrapper;
}

function buildRangeField(groupName, parameterName, label, unit) {
  const wrapper = document.createElement("div");
  wrapper.className = "mb-3";
  wrapper.dataset.groupName = groupName;
  wrapper.dataset.parameterName = parameterName;
  wrapper.dataset.filterKind = "range";

  const minLabel = unit ? `Minimum (${escapeHtml(unit)})` : "Minimum";
  const maxLabel = unit ? `Maximum (${escapeHtml(unit)})` : "Maximum";

  wrapper.innerHTML = `
    <label class="form-label">${escapeHtml(label)}${unit ? ` <span class="text-muted">(${escapeHtml(unit)})</span>` : ""}</label>
    <div class="row g-2">
      <div class="col-6">
        <select class="form-select finder-filter-min">
          <option value="">${escapeHtml(minLabel)}</option>
        </select>
      </div>
      <div class="col-6">
        <select class="form-select finder-filter-max">
          <option value="">${escapeHtml(maxLabel)}</option>
        </select>
      </div>
    </div>
  `;

  return wrapper;
}

function buildField(groupName, parameterName, parameters) {
  const label = parameterName;
  const stringValues = Array.from(
    new Set(
      parameters
        .flatMap((parameter) => parameter.string_values || [])
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
  const numericValues = Array.from(
    new Set(
      parameters.flatMap((parameter) => parameter.numeric_values || []).map((value) => Number(value)),
    ),
  ).sort((a, b) => a - b);
  const unit = parameters.find((parameter) => (parameter.unit || "").trim())?.unit?.trim() || "";
  const sortedNumericValues = numericValues.map((value) => String(value));

  if (numericValues.length > 0 && stringValues.length === 0) {
    const field = buildRangeField(groupName, parameterName, label, unit);
    const minSelect = field.querySelector(".finder-filter-min");
    const maxSelect = field.querySelector(".finder-filter-max");

    for (const value of sortedNumericValues) {
      const minOption = document.createElement("option");
      minOption.value = value;
      minOption.textContent = value;
      minSelect?.appendChild(minOption);

      const maxOption = document.createElement("option");
      maxOption.value = value;
      maxOption.textContent = value;
      maxSelect?.appendChild(maxOption);
    }

    return field;
  }

  if (stringValues.length > 0) {
    return buildSelectField(groupName, parameterName, label, stringValues, {
      placeholder: "-- select option --",
    });
  }

  return buildSelectField(groupName, parameterName, label, [], {
    placeholder: "-- select option --",
  });
}

function buildGroupSection(group, isAdvanced = false) {
  const section = document.createElement("section");
  section.className = isAdvanced ? "finder-group-card card shadow-sm border-0 mb-3" : "finder-group-card mb-3";
  section.dataset.groupName = group.group_name || "";

  const fields = groupParameters(group).map(({ parameterName, parameters }) =>
    buildField(group.group_name || "", parameterName, parameters),
  );

  const groupedFields = fields.length
    ? fields.map((field) => field.outerHTML).join("")
    : '<p class="text-muted small mb-0">No parameters available.</p>';

  section.innerHTML = `
    <div class="${isAdvanced ? "card-body" : ""}">
      <h3 class="h6 mb-3">${escapeHtml(group.group_name || "Filters")}</h3>
      ${groupedFields}
    </div>
  `;

  return section;
}

function getSelectedProductTypeData() {
  const productType = productTypeSelect?.value || "";
  const groups = filterMetadata?.groups || [];
  const mainGroup = groups.find((group) => (group.group_name || "").trim().toLowerCase() === "main");
  const advancedGroups = groups.filter((group) => (group.group_name || "").trim().toLowerCase() !== "main");

  return { productType, mainGroup, advancedGroups, series: filterMetadata?.series || [] };
}

function captureFilterState() {
  const state = {};

  if (!form) return state;

  for (const group of Array.from(form.querySelectorAll("[data-group-name][data-parameter-name]"))) {
    const groupName = group.dataset.groupName || "";
    const parameterName = group.dataset.parameterName || "";
    const kind = group.dataset.filterKind || "";
    const key = `${groupName}::${parameterName}::${kind}`;

    if (kind === "select") {
      state[key] = group.querySelector("select")?.value || "";
      continue;
    }

    if (kind === "range") {
      state[key] = {
        min: group.querySelector(".finder-filter-min")?.value || "",
        max: group.querySelector(".finder-filter-max")?.value || "",
      };
      continue;
    }

    if (kind === "series") {
      state[key] = group.querySelector("select")?.value || "";
    }
  }

  return state;
}

function restoreFilterState(state) {
  if (!form) return;

  for (const group of Array.from(form.querySelectorAll("[data-group-name][data-parameter-name]"))) {
    const groupName = group.dataset.groupName || "";
    const parameterName = group.dataset.parameterName || "";
    const kind = group.dataset.filterKind || "";
    const key = `${groupName}::${parameterName}::${kind}`;
    const saved = state[key];

    if (kind === "select" && typeof saved === "string") {
      const select = group.querySelector("select");
      if (select) select.value = saved;
      continue;
    }

    if (kind === "range" && saved && typeof saved === "object") {
      const minSelect = group.querySelector(".finder-filter-min");
      const maxSelect = group.querySelector(".finder-filter-max");
      if (minSelect) minSelect.value = saved.min || "";
      if (maxSelect) maxSelect.value = saved.max || "";
      continue;
    }

    if (kind === "series" && typeof saved === "string") {
      const select = group.querySelector("select");
      if (select) select.value = saved;
    }
  }
}

function renderFilterControls() {
  if (!seriesFilterHost || !mainFiltersHost || !advancedFiltersHost || !advancedToggle) return;

  const { productType, mainGroup, advancedGroups, series } = getSelectedProductTypeData();

  seriesFilterHost.innerHTML = "";
  mainFiltersHost.innerHTML = "";
  advancedFiltersHost.innerHTML = "";

  if (!productType) {
    advancedToggle.classList.add("d-none");
    advancedOpen = false;
    advancedFiltersHost.classList.add("d-none");
    seriesFilterHost.classList.add("d-none");
    mainFiltersHost.innerHTML = `
      <p class="text-muted small mb-0">
        Select a product type to reveal context-specific filters.
      </p>
    `;
    return;
  }

  seriesFilterHost.classList.remove("d-none");
  seriesFilterHost.appendChild(buildSeriesField(series));

  if (mainGroup) {
    const mainSection = buildGroupSection(mainGroup, false);
    mainFiltersHost.appendChild(mainSection);
  } else {
    mainFiltersHost.innerHTML = '<p class="text-muted small mb-0">No main filters available for this product type.</p>';
  }

  if (advancedGroups.length > 0) {
    advancedToggle.classList.remove("d-none");
    advancedToggle.textContent = advancedOpen ? "Hide advanced" : "Advanced";
    advancedFiltersHost.classList.toggle("d-none", !advancedOpen);

    for (const group of advancedGroups) {
      advancedFiltersHost.appendChild(buildGroupSection(group, true));
    }
  } else {
    advancedToggle.classList.add("d-none");
    advancedOpen = false;
    advancedFiltersHost.classList.add("d-none");
  }
}

function serializeParameterFilters() {
  if (!form) return [];

  const groups = Array.from(form.querySelectorAll("[data-group-name][data-parameter-name]"));
  const filters = [];

  for (const group of groups) {
    const groupName = group.dataset.groupName || "";
    const parameterName = group.dataset.parameterName || "";
    const kind = group.dataset.filterKind || "";

    if (kind === "select") {
      const input = group.querySelector("select");
      const value = input?.value?.trim() || "";
      if (value) {
        filters.push({ group_name: groupName, parameter_name: parameterName, value_string: value });
      }
      continue;
    }

    if (kind === "range") {
      const minValue = group.querySelector(".finder-filter-min")?.value?.trim() || "";
      const maxValue = group.querySelector(".finder-filter-max")?.value?.trim() || "";
      if (minValue || maxValue) {
        const item = { group_name: groupName, parameter_name: parameterName };
        if (minValue) item.min_number = Number(minValue);
        if (maxValue) item.max_number = Number(maxValue);
        filters.push(item);
      }
      continue;
    }

    const input = group.querySelector("input");
    const value = input?.value?.trim() || "";
    if (value) {
      filters.push({ group_name: groupName, parameter_name: parameterName, value_string: value });
    }
  }

  return filters;
}

function getSeriesId() {
  return form?.querySelector(".finder-filter-series")?.value?.trim() || "";
}

setTheme(document.documentElement.dataset.bsTheme || getPreferredTheme(), false);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.dataset.bsTheme === "dark" ? "dark" : "light";
    setTheme(currentTheme === "dark" ? "light" : "dark");
  });
}

async function updateResults() {
  if (!form || !results) return;

  const params = new URLSearchParams();
  const productType = form.querySelector('[name="product_type_key"]')?.value || "";
  const search = form.querySelector('[name="search"]')?.value || "";
  const seriesId = getSeriesId();
  const parameterFilters = serializeParameterFilters();

  if (productType) params.set("product_type_key", productType);
  if (search) params.set("search", search);
  if (seriesId) params.set("series_id", seriesId);
  if (parameterFilters.length > 0) {
    params.set("parameter_filters", JSON.stringify(parameterFilters));
  }

  const previousHtml = results.innerHTML;

  try {
    const response = await fetch(`/finder/results?${params.toString()}`);
    const html = await response.text();

    if (!response.ok) {
      throw new Error("Finder request failed");
    }

    results.innerHTML = html;
  } catch (_error) {
    results.innerHTML = `
      <div class="alert alert-warning border">
        The finder could not refresh right now. Please try again.
      </div>
    `;
    window.setTimeout(() => {
      if (results.innerHTML.includes("The finder could not refresh right now.")) {
        results.innerHTML = previousHtml;
      }
    }, 2500);
  }
}

async function refreshMetadataAndResults({ resetDependentFilters = false } = {}) {
  if (!form) return;

  const currentType = productTypeSelect?.value || "";
  const search = form.querySelector('[name="search"]')?.value || "";
  const seriesId = resetDependentFilters ? "" : getSeriesId();

  if (!currentType) {
    filterMetadata = { series: [], groups: [] };
    renderFilterControls();
    await updateResults();
    return;
  }

  const requestToken = ++activeRefreshToken;
  const preservedState = resetDependentFilters ? {} : captureFilterState();

  try {
    const params = new URLSearchParams();
    params.set("product_type_key", currentType);
    if (search) params.set("search", search);
    if (seriesId) params.set("series_id", seriesId);
    const parameterFilters = resetDependentFilters ? [] : serializeParameterFilters();
    if (parameterFilters.length > 0) {
      params.set("parameter_filters", JSON.stringify(parameterFilters));
    }

    const response = await fetch(`/finder/metadata?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Metadata request failed");
    }

    const metadata = await response.json();
    if (requestToken !== activeRefreshToken) return;

    filterMetadata = metadata || { series: [], groups: [] };
    renderFilterControls();
    restoreFilterState(preservedState);
    await updateResults();
  } catch (_error) {
    if (requestToken !== activeRefreshToken) return;
    filterMetadata = { series: [], groups: [] };
    renderFilterControls();
    await updateResults();
  }
}

if (form) {
  if (productTypeSelect) {
    productTypeSelect.addEventListener("change", () => {
      advancedOpen = false;
      refreshMetadataAndResults({ resetDependentFilters: true });
    });
  }

  if (advancedToggle) {
    advancedToggle.addEventListener("click", () => {
      advancedOpen = !advancedOpen;
      renderFilterControls();
      refreshMetadataAndResults();
    });
  }

  form.addEventListener("change", (event) => {
    if (event.target === productTypeSelect) {
      return;
    }
    refreshMetadataAndResults();
  });
  form.addEventListener("input", (event) => {
    const target = event.target;
    const targetName = target && target.getAttribute ? target.getAttribute("name") : "";
    clearTimeout(window.finderTimer);
    window.finderTimer = setTimeout(() => {
      if (targetName === "search" || targetName === "product_type_key" || targetName === "series_id") {
        if ((productTypeSelect?.value || "") !== "") {
          refreshMetadataAndResults();
        } else {
          updateResults();
        }
      } else {
        updateResults();
      }
    }, 250);
  });

  refreshMetadataAndResults();
}
