const LIGHT_CHART_THEME = {
  background: "#ffffff",
  text: "#1e293b",
  grid: "#d7dde8",
  accent: "#2563eb",
  efficiency: "#15803d",
  permissible: "#dc2626",
  neutralLine: "#ffffff",
  fontFamily: "DejaVu Sans, Liberation Sans, Arial, sans-serif"
};
const DARK_CHART_THEME = {
  background: "#1a1b26",
  text: "#c0caf5",
  grid: "#3b4261",
  accent: "#7aa2f7",
  efficiency: "#4ade80",
  permissible: "#f87171",
  neutralLine: "#ffffff",
  fontFamily: "DejaVu Sans, Liberation Sans, Arial, sans-serif"
};
function getChartTheme(currentTheme) {
  return currentTheme === "light" ? LIGHT_CHART_THEME : DARK_CHART_THEME;
}
const RPM_BAND_FALLBACK_COLORS = ["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa", "#22d3ee"];
const CHART_STYLE = {
  rpmLineColor: "#0000ff",
  rpmBandFadedOpacity: 0.18,
  axisNameFontSize: 20,
  axisNameFontWeight: "600",
  axisLabelFontSize: 18,
  axisLabelFontWeight: "500",
  titleFontSize: 32,
  dragHandleFontSize: 20,
  permissibleLabelFontSize: 18
};
const FULL_CHART_LINE_DEFINITIONS = [
  {
    key: "efficiency_centre",
    label: "Efficiency Centre",
    colorKey: "efficiency",
    tooltipLabel: "Efficiency centre",
    lineWidth: 1
  },
  {
    key: "efficiency_lower_end",
    label: "Efficiency Lower End",
    colorKey: "permissible",
    tooltipLabel: "Efficiency lower end",
    lineWidth: 1
  },
  {
    key: "efficiency_higher_end",
    label: "Efficiency Higher End",
    colorKey: "permissible",
    tooltipLabel: "Efficiency higher end",
    lineWidth: 1
  },
  {
    key: "permissible_use",
    label: "Permissible Use",
    colorKey: "neutralLine",
    tooltipLabel: "Permissible use",
    lineWidth: 5
  }
];
const FLOW_EPSILON = 1e-6;
const AXIS_NAME_FONT_SIZE = CHART_STYLE.axisNameFontSize;
const AXIS_NAME_FONT_WEIGHT = CHART_STYLE.axisNameFontWeight;
const AXIS_LABEL_FONT_SIZE = CHART_STYLE.axisLabelFontSize;
const AXIS_LABEL_FONT_WEIGHT = CHART_STYLE.axisLabelFontWeight;
const DEFAULT_GRAPH_CONFIG = {
  graph_kind: "fan_map",
  supports_graph_overlays: true,
  supports_band_graph_style: true,
  graph_line_value_label: "RPM",
  graph_line_value_unit: "RPM",
  graph_x_axis_label: "Airflow",
  graph_x_axis_unit: "L/s",
  graph_y_axis_label: "Pressure",
  graph_y_axis_unit: "Pa"
};
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
function formatNumericValue(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
}
function normalizeOptionalColor(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}
function hexToRgb(color) {
  const normalized = normalizeOptionalColor(color);
  if (!normalized || !normalized.startsWith("#")) return null;
  const hex = normalized.slice(1);
  if (hex.length !== 3 && hex.length !== 6) return null;
  const expanded = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  const numeric = Number.parseInt(expanded, 16);
  if (Number.isNaN(numeric)) return null;
  return {
    r: numeric >> 16 & 255,
    g: numeric >> 8 & 255,
    b: numeric & 255
  };
}
function rgbToHex({ r, g, b }) {
  const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function invertHexColor(color) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return rgbToHex({
    r: 255 - rgb.r,
    g: 255 - rgb.g,
    b: 255 - rgb.b
  });
}
function isDarkColor(color) {
  const rgb = hexToRgb(color);
  if (!rgb) return false;
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.5;
}
function normalizeOpacity(value, fallback = CHART_STYLE.rpmBandFadedOpacity) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return fallback;
  return clamp(numeric, 0, 1);
}
function formatAxisLabel(label, unit) {
  return unit ? `${label} (${unit})` : label;
}
function resolveGraphConfig(graphConfig = null) {
  return {
    ...DEFAULT_GRAPH_CONFIG,
    ...graphConfig ?? {}
  };
}
function formatGraphLineValue(value, graphConfig, line = null) {
  const explicitLabel = String(line?.display_label ?? "").trim();
  if (explicitLabel) return explicitLabel;
  const numericText = formatNumericValue(value);
  const unit = String(graphConfig?.graph_line_value_unit ?? "").trim();
  return unit ? `${numericText} ${unit}` : numericText;
}
function resolveBandColor(line, index) {
  return normalizeOptionalColor(line?.band_color) ?? RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length];
}
function normalizeFlowValues(values) {
  return [...values].filter((value) => value != null && !Number.isNaN(value)).sort((a, b) => a - b).filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > FLOW_EPSILON);
}
function interpolateYAtX(lineData, x) {
  if (!lineData.length) return null;
  if (x < lineData[0][0] || x > lineData[lineData.length - 1][0]) return null;
  for (let index = 0; index < lineData.length; index += 1) {
    const [currentX, currentY] = lineData[index];
    if (currentX === x) return currentY;
    if (index === lineData.length - 1) return currentY;
    const [nextX, nextY] = lineData[index + 1];
    if (x > currentX && x < nextX) {
      if (nextX === currentX) return currentY;
      const ratio = (x - currentX) / (nextX - currentX);
      return currentY + (nextY - currentY) * ratio;
    }
  }
  return null;
}
function buildSmoothedCurveSamples(lineData, samplesPerSegment = 14) {
  if (lineData.length <= 2) return lineData.slice();
  const xs = lineData.map(([x]) => x);
  const ys = lineData.map(([, y]) => y);
  const deltas = [];
  for (let index = 0; index < xs.length - 1; index += 1) {
    const dx = xs[index + 1] - xs[index];
    if (dx <= 0) continue;
    deltas.push((ys[index + 1] - ys[index]) / dx);
  }
  if (deltas.length !== xs.length - 1) return lineData.slice();
  const tangents = new Array(xs.length).fill(0);
  tangents[0] = deltas[0];
  tangents[tangents.length - 1] = deltas[deltas.length - 1];
  for (let index = 1; index < xs.length - 1; index += 1) {
    const previousDelta = deltas[index - 1];
    const nextDelta = deltas[index];
    if (previousDelta === 0 || nextDelta === 0 || previousDelta * nextDelta <= 0) {
      tangents[index] = 0;
      continue;
    }
    tangents[index] = (previousDelta + nextDelta) / 2;
  }
  for (let index = 0; index < deltas.length; index += 1) {
    const delta = deltas[index];
    if (delta === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const alpha = tangents[index] / delta;
    const beta = tangents[index + 1] / delta;
    const distance = alpha * alpha + beta * beta;
    if (distance > 9) {
      const scale = 3 / Math.sqrt(distance);
      tangents[index] = scale * alpha * delta;
      tangents[index + 1] = scale * beta * delta;
    }
  }
  const smoothed = [];
  for (let index = 0; index < xs.length - 1; index += 1) {
    const x0 = xs[index];
    const x1 = xs[index + 1];
    const y0 = ys[index];
    const y1 = ys[index + 1];
    const dx = x1 - x0;
    const m0 = tangents[index];
    const m1 = tangents[index + 1];
    if (index === 0) {
      smoothed.push([x0, y0]);
    }
    for (let step = 1; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      const x = x0 + dx * t;
      const y = h00 * y0 + h10 * dx * m0 + h01 * y1 + h11 * dx * m1;
      const boundedY = clamp(y, Math.min(y0, y1), Math.max(y0, y1));
      smoothed.push([x, boundedY]);
    }
    smoothed.push([x1, y1]);
  }
  return smoothed;
}
function buildFullChartTooltipFormatter(graphConfig, lineDefinitions) {
  const xAxisName = graphConfig?.graph_x_axis_label ?? DEFAULT_GRAPH_CONFIG.graph_x_axis_label;
  const yAxisName = graphConfig?.graph_y_axis_label ?? DEFAULT_GRAPH_CONFIG.graph_y_axis_label;
  const tooltipLabelBySeriesName = Object.fromEntries(
    (lineDefinitions ?? []).map((definition) => [definition.label, definition.tooltipLabel])
  );
  return (params) => {
    const items = Array.isArray(params) ? params : [params];
    const visibleItems = items.filter((item) => {
      const name = String(item.seriesName ?? "");
      return !name.endsWith(" band") && !name.endsWith(" band faded") && !name.endsWith(" area");
    });
    if (!visibleItems.length) return "";
    const flowValue = visibleItems.find((item) => Array.isArray(item.value))?.value?.[0] ?? visibleItems[0]?.axisValue;
    const lines = [`${xAxisName}: ${formatNumericValue(flowValue)}`];
    for (const item of visibleItems) {
      const name = String(item.seriesName ?? "");
      const marker = item.marker ?? "";
      const pointValue = Array.isArray(item.value) ? item.value[1] : item.value;
      const overlayLabel = tooltipLabelBySeriesName[name];
      lines.push(`${overlayLabel ?? yAxisName}: ${formatNumericValue(pointValue)}`);
      lines.push(`${marker}${name}`);
    }
    return lines.join("<br/>");
  };
}
function collectUniqueSortedFlows(rpmCurveEntries, permissibleBoundaryData, extraFlows = []) {
  const values = /* @__PURE__ */ new Set();
  for (const [, lineData] of rpmCurveEntries) {
    for (const [airflow] of lineData) {
      values.add(airflow);
    }
  }
  for (const [airflow] of permissibleBoundaryData) {
    values.add(airflow);
  }
  for (const airflow of extraFlows) {
    values.add(airflow);
  }
  return Array.from(values).sort((a, b) => a - b);
}
function findCurveBoundaryCrossings(lineData, permissibleBoundaryData) {
  if (lineData.length < 2 || permissibleBoundaryData.length < 2) return [];
  const rawFlows = collectUniqueSortedFlows([[0, lineData]], permissibleBoundaryData);
  const intersections = [];
  for (let index = 0; index < rawFlows.length - 1; index += 1) {
    const leftFlow = rawFlows[index];
    const rightFlow = rawFlows[index + 1];
    const curveLeft = interpolateYAtX(lineData, leftFlow);
    const curveRight = interpolateYAtX(lineData, rightFlow);
    const boundaryLeft = interpolateYAtX(permissibleBoundaryData, leftFlow);
    const boundaryRight = interpolateYAtX(permissibleBoundaryData, rightFlow);
    if (curveLeft == null || curveRight == null || boundaryLeft == null || boundaryRight == null) {
      continue;
    }
    const diffLeft = curveLeft - boundaryLeft;
    const diffRight = curveRight - boundaryRight;
    if (diffLeft === 0) intersections.push(leftFlow);
    if (diffRight === 0) intersections.push(rightFlow);
    if (diffLeft * diffRight < 0) {
      const ratio = diffLeft / (diffLeft - diffRight);
      intersections.push(leftFlow + (rightFlow - leftFlow) * ratio);
    }
  }
  return normalizeFlowValues(intersections);
}
function findBoundaryLevelCrossings(boundaryData, level) {
  if (boundaryData.length < 2) return [];
  const intersections = [];
  for (let index = 0; index < boundaryData.length - 1; index += 1) {
    const [leftFlow, leftValue] = boundaryData[index];
    const [rightFlow, rightValue] = boundaryData[index + 1];
    const diffLeft = leftValue - level;
    const diffRight = rightValue - level;
    if (diffLeft === 0) intersections.push(leftFlow);
    if (diffRight === 0) intersections.push(rightFlow);
    if (diffLeft * diffRight < 0) {
      const ratio = diffLeft / (diffLeft - diffRight);
      intersections.push(leftFlow + (rightFlow - leftFlow) * ratio);
    }
  }
  return normalizeFlowValues(intersections);
}
function getLowerBoundaryActivationFlow(lowerLineData, permissibleBoundaryData) {
  if (!permissibleBoundaryData.length) return null;
  if (!lowerLineData?.length) {
    return findBoundaryLevelCrossings(permissibleBoundaryData, 0)[0] ?? permissibleBoundaryData[0][0];
  }
  const lowerStartFlow = lowerLineData[0][0];
  const lowerEndFlow = lowerLineData[lowerLineData.length - 1][0];
  const lowerBoundaryCrossings = findCurveBoundaryCrossings(
    lowerLineData,
    permissibleBoundaryData
  ).filter((airflow) => airflow >= lowerStartFlow && airflow <= lowerEndFlow).sort((a, b) => a - b);
  return lowerBoundaryCrossings[0] ?? lowerStartFlow;
}
function buildBoundarySegmentPoints(boundaryData, startFlow, endFlow) {
  if (!boundaryData.length || startFlow == null || endFlow == null || startFlow === endFlow) {
    return [];
  }
  const minimumFlow = Math.min(startFlow, endFlow);
  const maximumFlow = Math.max(startFlow, endFlow);
  const segmentFlows = /* @__PURE__ */ new Set([startFlow, endFlow]);
  for (const [airflow] of boundaryData) {
    if (airflow > minimumFlow && airflow < maximumFlow) {
      segmentFlows.add(airflow);
    }
  }
  return normalizeFlowValues(Array.from(segmentFlows)).map((airflow) => [airflow, interpolateYAtX(boundaryData, airflow)]).filter(([, value]) => value != null);
}
function buildBandSampleFlows(rpmCurveEntries, permissibleBoundaryData) {
  if (!permissibleBoundaryData.length) {
    return collectUniqueSortedFlows(rpmCurveEntries, permissibleBoundaryData);
  }
  const intersectionFlows = rpmCurveEntries.flatMap(
    ([, lineData]) => findCurveBoundaryCrossings(lineData, permissibleBoundaryData)
  );
  const boundaryToAxisCrossings = findBoundaryLevelCrossings(permissibleBoundaryData, 0);
  return collectUniqueSortedFlows(
    rpmCurveEntries,
    permissibleBoundaryData,
    [...intersectionFlows, ...boundaryToAxisCrossings]
  );
}
function buildBandTopValues(lineData, flows, permissibleBoundaryData, clipRpmAreaToPermissibleUse, maximumVisibleFlow = null, allowPermissibleFallbackBeforeLineStart = false) {
  if (!flows.length) return [];
  const minimumVisibleFlow = permissibleBoundaryData.length ? permissibleBoundaryData[0][0] : null;
  const lineStartFlow = lineData.length ? lineData[0][0] : null;
  const lineEndFlow = lineData.length ? lineData[lineData.length - 1][0] : null;
  return flows.map((airflow) => {
    const pressure = interpolateYAtX(lineData, airflow);
    if (!clipRpmAreaToPermissibleUse) return pressure;
    if (minimumVisibleFlow == null || maximumVisibleFlow == null) return null;
    if (airflow < minimumVisibleFlow || airflow > maximumVisibleFlow) return null;
    const permissibleBoundaryPressure = interpolateYAtX(permissibleBoundaryData, airflow);
    if (pressure == null) {
      if (allowPermissibleFallbackBeforeLineStart && permissibleBoundaryPressure != null && lineStartFlow != null && airflow < lineStartFlow) {
        return permissibleBoundaryPressure;
      }
      return null;
    }
    if (lineEndFlow != null && airflow > lineEndFlow) return pressure;
    return permissibleBoundaryPressure == null ? pressure : Math.min(pressure, permissibleBoundaryPressure);
  });
}
function buildBandLowerBoundaryValues(lowerLineData, flows, permissibleBoundaryData, clipRpmAreaToPermissibleUse, maximumVisibleFlow = null) {
  if (!flows.length) return [];
  if (!lowerLineData?.length) {
    if (!clipRpmAreaToPermissibleUse) return flows.map(() => 0);
    const minimumVisibleFlow2 = permissibleBoundaryData.length ? permissibleBoundaryData[0][0] : null;
    const activationFlow2 = getLowerBoundaryActivationFlow(lowerLineData, permissibleBoundaryData) ?? minimumVisibleFlow2;
    return flows.map(
      (airflow) => minimumVisibleFlow2 != null && maximumVisibleFlow != null && airflow >= minimumVisibleFlow2 && airflow <= maximumVisibleFlow ? airflow < activationFlow2 ? interpolateYAtX(permissibleBoundaryData, airflow) : 0 : null
    );
  }
  const lowerStartFlow = lowerLineData[0][0];
  const lowerEndFlow = lowerLineData[lowerLineData.length - 1][0];
  const minimumVisibleFlow = permissibleBoundaryData.length ? permissibleBoundaryData[0][0] : null;
  const activationFlow = getLowerBoundaryActivationFlow(lowerLineData, permissibleBoundaryData) ?? lowerStartFlow;
  return flows.map((airflow) => {
    if (!clipRpmAreaToPermissibleUse) {
      const lowerPressure2 = interpolateYAtX(lowerLineData, airflow);
      return lowerPressure2 ?? 0;
    }
    if (minimumVisibleFlow == null || maximumVisibleFlow == null) return null;
    if (airflow < minimumVisibleFlow || airflow > maximumVisibleFlow) return null;
    const permissibleBoundaryPressure = interpolateYAtX(permissibleBoundaryData, airflow);
    if (airflow < activationFlow) return permissibleBoundaryPressure;
    if (airflow > lowerEndFlow) return 0;
    const lowerPressure = interpolateYAtX(lowerLineData, airflow);
    return lowerPressure ?? 0;
  });
}
function interpolateBetweenSamples(leftFlow, rightFlow, leftValue, rightValue, ratio) {
  return [leftFlow + (rightFlow - leftFlow) * ratio, leftValue + (rightValue - leftValue) * ratio];
}
function buildBandPolygonsBetweenCurves(flows, upperCurve, lowerCurve) {
  const polygons = [];
  let topPoints = [];
  let bottomPoints = [];
  function pushCurrentPolygon() {
    if (topPoints.length >= 2 && bottomPoints.length >= 2) {
      polygons.push({
        topPoints: [...topPoints],
        bottomPoints: [...bottomPoints]
      });
    }
    topPoints = [];
    bottomPoints = [];
  }
  function appendPoint(airflow, upperValue, lowerValue) {
    topPoints.push([airflow, upperValue]);
    bottomPoints.push([airflow, lowerValue]);
  }
  for (let index = 0; index < flows.length - 1; index += 1) {
    const leftFlow = flows[index];
    const rightFlow = flows[index + 1];
    const upperLeft = upperCurve[index];
    const upperRight = upperCurve[index + 1];
    const lowerLeft = lowerCurve[index];
    const lowerRight = lowerCurve[index + 1];
    const leftVisible = upperLeft != null && lowerLeft != null && upperLeft >= lowerLeft;
    const rightVisible = upperRight != null && lowerRight != null && upperRight >= lowerRight;
    if (!leftVisible && !rightVisible) {
      pushCurrentPolygon();
      continue;
    }
    if (leftVisible && topPoints.length === 0) {
      appendPoint(leftFlow, upperLeft, lowerLeft);
    }
    const leftDiff = upperLeft != null && lowerLeft != null ? upperLeft - lowerLeft : null;
    const rightDiff = upperRight != null && lowerRight != null ? upperRight - lowerRight : null;
    if (!leftVisible && rightVisible) {
      if (leftDiff != null && rightDiff != null && leftDiff !== rightDiff) {
        const ratio = leftDiff / (leftDiff - rightDiff);
        const [transitionFlow, transitionUpper] = interpolateBetweenSamples(
          leftFlow,
          rightFlow,
          upperLeft,
          upperRight,
          ratio
        );
        const [, transitionLower] = interpolateBetweenSamples(
          leftFlow,
          rightFlow,
          lowerLeft,
          lowerRight,
          ratio
        );
        appendPoint(transitionFlow, transitionUpper, transitionLower);
      }
      appendPoint(rightFlow, upperRight, lowerRight);
      continue;
    }
    if (leftVisible && !rightVisible) {
      if (leftDiff != null && rightDiff != null && leftDiff !== rightDiff) {
        const ratio = leftDiff / (leftDiff - rightDiff);
        const [transitionFlow, transitionUpper] = interpolateBetweenSamples(
          leftFlow,
          rightFlow,
          upperLeft,
          upperRight,
          ratio
        );
        const [, transitionLower] = interpolateBetweenSamples(
          leftFlow,
          rightFlow,
          lowerLeft,
          lowerRight,
          ratio
        );
        appendPoint(transitionFlow, transitionUpper, transitionLower);
      }
      pushCurrentPolygon();
      continue;
    }
    if (leftVisible && rightVisible) {
      appendPoint(rightFlow, upperRight, lowerRight);
    }
  }
  pushCurrentPolygon();
  return polygons;
}
function attachLeftBoundarySegment(polygon, permissibleBoundaryData, upperStartFlow, lowerStartFlow) {
  if (!polygon || !permissibleBoundaryData.length || upperStartFlow == null || lowerStartFlow == null || lowerStartFlow <= upperStartFlow) {
    return polygon;
  }
  const boundarySegment = buildBoundarySegmentPoints(
    permissibleBoundaryData,
    upperStartFlow,
    lowerStartFlow
  );
  if (!boundarySegment.length) return polygon;
  return {
    ...polygon,
    leftBoundaryPoints: boundarySegment.slice().reverse()
  };
}
function trimBottomBoundaryStart(polygon, startFlow) {
  if (!polygon || startFlow == null) return polygon;
  const originalPoints = polygon.bottomPoints ?? [];
  if (!originalPoints.length) return polygon;
  const trimmedPoints = [];
  for (let index = 0; index < originalPoints.length; index += 1) {
    const point = originalPoints[index];
    const [airflow, value] = point;
    if (airflow < startFlow) {
      continue;
    }
    if (!trimmedPoints.length && index > 0) {
      const [leftFlow, leftValue] = originalPoints[index - 1];
      if (leftFlow < startFlow && airflow > startFlow) {
        const ratio = (startFlow - leftFlow) / (airflow - leftFlow);
        const [, interpolatedValue] = interpolateBetweenSamples(
          leftFlow,
          airflow,
          leftValue,
          value,
          ratio
        );
        trimmedPoints.push([startFlow, interpolatedValue]);
      }
    }
    if (!trimmedPoints.length && airflow > startFlow) {
      trimmedPoints.push([startFlow, value]);
    }
    trimmedPoints.push(point);
  }
  return {
    ...polygon,
    bottomPoints: trimmedPoints.length ? trimmedPoints : originalPoints
  };
}
function alignPolygonToPermissibleBoundary(polygon, permissibleBoundaryData, upperStartFlow, lowerStartFlow) {
  if (!polygon) return polygon;
  return attachLeftBoundarySegment(
    trimBottomBoundaryStart(polygon, lowerStartFlow),
    permissibleBoundaryData,
    upperStartFlow,
    lowerStartFlow
  );
}
function alignPolygonToBandStartPoints(polygon, upperLineData, lowerLineData) {
  if (!polygon || !upperLineData?.length) return polygon;
  const upperStartPoint = upperLineData[0];
  const lowerStartPoint = lowerLineData?.[0] ?? [0, 0];
  const topPoints = [...polygon.topPoints ?? []];
  const bottomPoints = [...polygon.bottomPoints ?? []];
  if (!topPoints.length || topPoints[0][0] !== upperStartPoint[0] || topPoints[0][1] !== upperStartPoint[1]) {
    topPoints.unshift(upperStartPoint);
  }
  if (!bottomPoints.length || bottomPoints[0][0] !== lowerStartPoint[0] || bottomPoints[0][1] !== lowerStartPoint[1]) {
    bottomPoints.unshift(lowerStartPoint);
  }
  return {
    ...polygon,
    topPoints,
    bottomPoints
  };
}
function buildRpmBandPolygonSeries(rpmCurveEntries, rpmLines, chartTheme, permissibleBoundaryData, clipRpmAreaToPermissibleUse, maximumVisibleFlow = null, pressureAxisMax = null, fadedBandOpacity = RPM_BAND_FADED_OPACITY, graphConfig = DEFAULT_GRAPH_CONFIG) {
  if (!rpmCurveEntries.length) return [];
  const flows = buildBandSampleFlows(rpmCurveEntries, permissibleBoundaryData);
  if (!flows.length) return [];
  let previousLineData = null;
  return rpmCurveEntries.flatMap(([rpm, lineData], index) => {
    const bandColor = resolveBandColor(rpmLines[index], index);
    const fullCurrentCurve = buildBandTopValues(
      lineData,
      flows,
      permissibleBoundaryData,
      false,
      maximumVisibleFlow,
      false
    );
    const fullLowerBoundary = buildBandLowerBoundaryValues(
      previousLineData,
      flows,
      permissibleBoundaryData,
      false,
      maximumVisibleFlow
    );
    let fullPolygons = buildBandPolygonsBetweenCurves(flows, fullCurrentCurve, fullLowerBoundary);
    const currentCurve = buildBandTopValues(
      lineData,
      flows,
      permissibleBoundaryData,
      clipRpmAreaToPermissibleUse,
      maximumVisibleFlow,
      previousLineData == null
    );
    const lowerBoundary = buildBandLowerBoundaryValues(
      previousLineData,
      flows,
      permissibleBoundaryData,
      clipRpmAreaToPermissibleUse,
      maximumVisibleFlow
    );
    let polygons = buildBandPolygonsBetweenCurves(flows, currentCurve, lowerBoundary);
    if (fullPolygons.length) {
      fullPolygons = [
        alignPolygonToBandStartPoints(fullPolygons[0], lineData, previousLineData),
        ...fullPolygons.slice(1)
      ];
    }
    if (clipRpmAreaToPermissibleUse && polygons.length) {
      const upperStartFlow = polygons[0].topPoints[0]?.[0] ?? null;
      const lowerStartFlow = getLowerBoundaryActivationFlow(previousLineData, permissibleBoundaryData) ?? upperStartFlow;
      polygons = [
        alignPolygonToPermissibleBoundary(
          polygons[0],
          permissibleBoundaryData,
          upperStartFlow,
          lowerStartFlow
        ),
        ...polygons.slice(1)
      ];
    }
    previousLineData = lineData;
    const series = [];
    if (clipRpmAreaToPermissibleUse && permissibleBoundaryData.length && fullPolygons.length && pressureAxisMax != null) {
      series.push({
        name: `${formatGraphLineValue(rpm, graphConfig)} band faded`,
        type: "custom",
        coordinateSystem: "cartesian2d",
        renderItem(params, api) {
          const polygon = fullPolygons[params.dataIndex];
          if (!polygon) return null;
          const polygonPoints = [
            ...polygon.topPoints,
            ...polygon.bottomPoints.slice().reverse()
          ];
          if (!polygonPoints.length) return null;
          const points = polygonPoints.map(([x, y]) => api.coord([x, y]));
          return {
            type: "polygon",
            shape: { points },
            clipPath: {
              type: "polygon",
              shape: {
                points: (() => {
                  permissibleBoundaryData[0];
                  const boundaryEnd = permissibleBoundaryData[permissibleBoundaryData.length - 1];
                  return [
                    api.coord([0, pressureAxisMax]),
                    api.coord([0, 0]),
                    ...permissibleBoundaryData.map(([x, y]) => api.coord([x, y])),
                    api.coord([boundaryEnd[0], pressureAxisMax])
                  ];
                })()
              }
            },
            style: api.style({
              fill: bandColor,
              opacity: fadedBandOpacity,
              stroke: bandColor,
              lineWidth: 3
            }),
            silent: true
          };
        },
        data: fullPolygons.map((_, polygonIndex) => polygonIndex),
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: rpmCurveEntries.length + 10 + index
      });
    }
    series.push({
      name: `${formatGraphLineValue(rpm, graphConfig)} band`,
      type: "custom",
      coordinateSystem: "cartesian2d",
      renderItem(params, api) {
        const polygon = fullPolygons[params.dataIndex];
        if (!polygon) return null;
        const polygonPoints = [
          ...polygon.topPoints,
          ...polygon.bottomPoints.slice().reverse()
        ];
        if (!polygonPoints.length) return null;
        const points = polygonPoints.map(([x, y]) => api.coord([x, y]));
        const clipPoints = clipRpmAreaToPermissibleUse && permissibleBoundaryData.length && maximumVisibleFlow != null && pressureAxisMax != null ? (() => {
          const boundaryStart = permissibleBoundaryData[0];
          const boundaryEnd = permissibleBoundaryData[permissibleBoundaryData.length - 1];
          return [
            api.coord([boundaryEnd[0], pressureAxisMax]),
            api.coord([maximumVisibleFlow, pressureAxisMax]),
            api.coord([maximumVisibleFlow, 0]),
            api.coord([boundaryStart[0], 0]),
            ...permissibleBoundaryData.map(([x, y]) => api.coord([x, y]))
          ];
        })() : null;
        return {
          type: "polygon",
          shape: { points },
          ...clipPoints ? {
            clipPath: {
              type: "polygon",
              shape: { points: clipPoints }
            }
          } : {},
          style: api.style({
            fill: bandColor,
            stroke: "none"
          }),
          silent: true
        };
      },
      data: polygons.map((_, polygonIndex) => polygonIndex),
      emphasis: { disabled: true },
      tooltip: { show: false },
      silent: true,
      z: Math.max(0, rpmCurveEntries.length - index - 1)
    });
    return series;
  });
}
function buildRpmSeries(rpmLines, rpmPoints, chartTheme, includeDragHandles, permissibleBoundaryData, clipRpmAreaToPermissibleUse, showRpmBandShading, maximumVisibleFlow = null, pressureAxisMax = null, rpmBandLabelColor = null, fadedBandOpacity = RPM_BAND_FADED_OPACITY, graphConfig = DEFAULT_GRAPH_CONFIG) {
  function buildBandLabelAnchorData(lineData) {
    if (lineData.length < 2) return lineData;
    let anchorEndIndex = lineData.length - 1;
    if (pressureAxisMax != null) {
      const minimumSafePressure = pressureAxisMax * 0.12;
      while (anchorEndIndex > 1 && lineData[anchorEndIndex][1] < minimumSafePressure) {
        anchorEndIndex -= 1;
      }
    }
    const previousPoint = lineData[Math.max(0, anchorEndIndex - 1)];
    const endPoint = lineData[anchorEndIndex];
    const insetRatio = anchorEndIndex < lineData.length - 1 ? 0.82 : 0.88;
    const insetPoint = interpolateBetweenSamples(
      previousPoint[0],
      endPoint[0],
      previousPoint[1],
      endPoint[1],
      insetRatio
    );
    return [...lineData.slice(0, Math.max(0, anchorEndIndex - 1)), insetPoint];
  }
  const chartFontFamily = chartTheme.fontFamily ?? "sans-serif";
  const byRpm = {};
  const rpmByLineId = Object.fromEntries(rpmLines.map((line) => [line.id, line.rpm]));
  const lineByRpm = new Map(
    rpmLines.map((line) => [Number(line.rpm), line]).filter(([rpm]) => !Number.isNaN(rpm))
  );
  for (const point of rpmPoints) {
    const key = String(point.rpm ?? rpmByLineId[point.rpm_line_id] ?? "");
    if (!byRpm[key]) byRpm[key] = [];
    byRpm[key].push({
      value: [point.airflow ?? 0, point.pressure ?? 0],
      id: point.id,
      rpm: point.rpm ?? rpmByLineId[point.rpm_line_id],
      rpm_line_id: point.rpm_line_id
    });
  }
  const rpms = Object.keys(byRpm).filter((key) => key !== "").map((rpm) => Number(rpm)).filter((rpm) => !Number.isNaN(rpm)).sort((a, b) => a - b);
  const series = [];
  const rpmCurveEntries = [];
  for (const [idx, rpm] of rpms.entries()) {
    const rpmLine = lineByRpm.get(Number(rpm)) ?? null;
    const pointsAtRpm = byRpm[String(rpm)] ?? [];
    const hasMultiplePoints = pointsAtRpm.length > 1;
    const rawLineData = pointsAtRpm.map((point) => [point.value[0], point.value[1]]).sort((a, b) => a[0] - b[0]);
    const displayLineData = !includeDragHandles && hasMultiplePoints ? buildSmoothedCurveSamples(rawLineData) : rawLineData;
    rpmCurveEntries.push([rpm, displayLineData]);
    series.push({
      name: formatGraphLineValue(rpm, graphConfig, rpmLine),
      type: "line",
      smooth: false,
      data: displayLineData,
      label: { show: false },
      showSymbol: !includeDragHandles && !hasMultiplePoints,
      symbolSize: !includeDragHandles && !hasMultiplePoints ? 8 : 0,
      lineStyle: {
        width: hasMultiplePoints ? 2 : includeDragHandles ? 0 : 1,
        color: CHART_STYLE.rpmLineColor
      },
      itemStyle: {
        color: CHART_STYLE.rpmLineColor
      },
      areaStyle: void 0,
      emphasis: { focus: "series" },
      z: includeDragHandles ? idx * 2 : rpms.length - idx
    });
    if (!includeDragHandles && displayLineData.length) {
      const labelAtLineEnd = showRpmBandShading;
      const labelAnchorData = labelAtLineEnd ? buildBandLabelAnchorData(displayLineData) : displayLineData.slice().reverse();
      series.push({
        name: `${formatGraphLineValue(rpm, graphConfig, rpmLine)} label`,
        type: "line",
        smooth: false,
        data: labelAnchorData,
        showSymbol: false,
        silent: true,
        tooltip: { show: false },
        lineStyle: { width: 0, opacity: 0 },
        endLabel: {
          show: true,
          formatter: () => formatGraphLineValue(rpm, graphConfig, rpmLine),
          color: labelAtLineEnd ? rpmBandLabelColor ?? chartTheme.text : chartTheme.text,
          fontFamily: chartFontFamily,
          distance: 6,
          // ECharts offset format is [x, y].
          // x: negative = left, positive = right
          // y: negative = up, positive = down
          // Banded graph labels use the first pair; non-banded labels use the second.
          offset: labelAtLineEnd ? [-108, 28] : [5, -10],
          fontSize: CHART_STYLE.dragHandleFontSize,
          fontWeight: "normal"
        },
        z: rpms.length + 20
      });
    }
    if (showRpmBandShading && !includeDragHandles && !clipRpmAreaToPermissibleUse && hasMultiplePoints) {
      series.push({
        name: `${formatGraphLineValue(rpm, graphConfig, rpmLine)} area`,
        type: "line",
        smooth: false,
        data: displayLineData,
        showSymbol: false,
        lineStyle: { width: 0, opacity: 0 },
        areaStyle: { color: resolveBandColor(rpmLines[idx], idx) },
        emphasis: { disabled: true },
        tooltip: { show: false },
        z: Math.max(0, rpms.length - idx - 1)
      });
    }
    if (!includeDragHandles) continue;
    series.push({
      name: formatGraphLineValue(rpm, graphConfig, rpmLine),
      type: "scatter",
      data: pointsAtRpm.map((point) => ({
        value: [point.value[0], point.value[1]],
        id: point.id,
        rpm: point.rpm,
        rpm_line_id: point.rpm_line_id,
        pointType: "rpm"
      })),
      symbol: "circle",
      symbolSize: 10,
      draggable: true,
      showInLegend: false,
      emphasis: {
        focus: "series",
        scale: true,
        scaleSize: 1.2,
        itemStyle: { borderColor: chartTheme.background, borderWidth: 2 }
      },
      z: idx * 2 + 1
    });
  }
  if (!includeDragHandles && showRpmBandShading) {
    series.unshift(
      ...buildRpmBandPolygonSeries(
        rpmCurveEntries,
        rpmLines,
        chartTheme,
        permissibleBoundaryData,
        clipRpmAreaToPermissibleUse,
        maximumVisibleFlow,
        pressureAxisMax,
        fadedBandOpacity,
        graphConfig
      )
    );
  }
  return { series, rpmCurveEntries };
}
function buildEfficiencyAndPermissibleSeries(points, chartTheme, includeDragHandles, lineDefinitions, { permissibleLabelColor = null } = {}) {
  const series = [];
  for (const definition of lineDefinitions) {
    const lineData = points.filter((point) => point[definition.key] != null).map((point) => [point.airflow ?? 0, point[definition.key] ?? 0]).sort((a, b) => a[0] - b[0]);
    if (!lineData.length) continue;
    const color = chartTheme[definition.colorKey];
    series.push({
      name: definition.label,
      type: "line",
      smooth: lineData.length > 1 ? 0.18 : false,
      data: lineData,
      showSymbol: false,
      yAxisIndex: 1,
      itemStyle: { color },
      lineStyle: { width: definition.lineWidth, color },
      z: 999
    });
    if (!includeDragHandles && definition.key === "permissible_use" && lineData.length >= 2) {
      const highestPoints = [...lineData].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return b[0] - a[0];
      }).slice(0, 2);
      const anchorPoint = highestPoints[0] ?? null;
      const gradientPoints = highestPoints.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      const segmentStart = gradientPoints[0] ?? null;
      const segmentEnd = gradientPoints[1] ?? null;
      if (!anchorPoint || !segmentStart || !segmentEnd) {
        continue;
      }
      series.push({
        name: "Permissible Use Label",
        type: "custom",
        coordinateSystem: "cartesian2d",
        xAxisIndex: 0,
        yAxisIndex: 1,
        silent: true,
        tooltip: { show: false },
        emphasis: { disabled: true },
        data: [
          {
            value: [
              anchorPoint[0],
              anchorPoint[1],
              segmentStart[0],
              segmentStart[1],
              segmentEnd[0],
              segmentEnd[1]
            ]
          }
        ],
        renderItem(params, api) {
          const anchor = api.coord([api.value(0), api.value(1)]);
          const segmentStart2 = api.coord([api.value(2), api.value(3)]);
          const segmentEnd2 = api.coord([api.value(4), api.value(5)]);
          const dx = segmentEnd2[0] - segmentStart2[0];
          const dy = segmentEnd2[1] - segmentStart2[1];
          const rightOffsetPixels = -55;
          const verticalOffsetPixels = 55;
          const rotation = -Math.atan2(dy, dx);
          return {
            type: "text",
            x: anchor[0] + rightOffsetPixels,
            y: anchor[1] + verticalOffsetPixels,
            rotation,
            style: {
              text: "Permissible Use",
              fill: permissibleLabelColor ?? chartTheme.text,
              font: `${CHART_STYLE.permissibleLabelFontSize}px ${chartTheme.fontFamily ?? "sans-serif"}`,
              textAlign: "center",
              textVerticalAlign: "middle"
            },
            silent: true
          };
        },
        z: 1001
      });
    }
    if (!includeDragHandles) continue;
    series.push({
      name: definition.label,
      type: "scatter",
      data: points.filter((point) => point[definition.key] != null).map((point) => ({
        value: [point.airflow ?? 0, point[definition.key] ?? 0],
        id: point.id,
        lineKey: definition.key,
        pointType: "efficiency"
      })),
      draggable: true,
      showInLegend: false,
      itemStyle: { color },
      symbolSize: 10,
      emphasis: {
        focus: "series",
        scale: true,
        scaleSize: 1.2,
        itemStyle: { borderColor: chartTheme.background, borderWidth: 2 }
      },
      yAxisIndex: 1,
      z: 1e3
    });
  }
  return series;
}
function buildFullChartOption({
  rpmLines,
  rpmPoints,
  efficiencyPoints,
  chartTheme,
  title,
  graphConfig = null,
  includeDragHandles = false,
  clipRpmAreaToPermissibleUse = false,
  showRpmBandShading = true,
  showSecondaryAxis = true,
  flowAxisMaxOverride = null,
  pressureAxisMaxOverride = null,
  tooltip = null,
  graphStyle = null,
  adaptGraphBackgroundToTheme = false
}) {
  const resolvedGraphConfig = resolveGraphConfig(graphConfig);
  const lineDefinitions = resolvedGraphConfig.supports_graph_overlays ? FULL_CHART_LINE_DEFINITIONS : [];
  const xAxisName = formatAxisLabel(
    resolvedGraphConfig.graph_x_axis_label,
    resolvedGraphConfig.graph_x_axis_unit
  );
  const yAxisName = formatAxisLabel(
    resolvedGraphConfig.graph_y_axis_label,
    resolvedGraphConfig.graph_y_axis_unit
  );
  const flowValues = [
    ...rpmPoints.map((point) => Number(point.airflow)),
    ...efficiencyPoints.map((point) => Number(point.airflow))
  ].filter((value) => !Number.isNaN(value) && value >= 0);
  const pressureValues = rpmPoints.map((point) => Number(point.pressure)).filter((value) => !Number.isNaN(value) && value >= 0);
  const rpmFlowValues = rpmPoints.map((point) => Number(point.airflow)).filter((value) => !Number.isNaN(value) && value >= 0);
  const rawFlowMax = flowValues.length ? Math.max(...flowValues) : 0;
  const rawRpmFlowMax = rpmFlowValues.length ? Math.max(...rpmFlowValues) : 0;
  const flowAxisMax = flowAxisMaxOverride ?? (rawFlowMax > 0 ? rawFlowMax * 1.05 : 100);
  const rawPressureMax = pressureValues.length ? Math.max(...pressureValues) : 0;
  const pressureAxisMax = pressureAxisMaxOverride ?? (rawPressureMax > 0 ? rawPressureMax * 1.05 : 100);
  const permissibleBoundaryData = efficiencyPoints.filter((point) => point.permissible_use != null).map((point) => [point.airflow ?? 0, Number(point.permissible_use) / 100 * pressureAxisMax]).filter((point) => !Number.isNaN(point[0]) && !Number.isNaN(point[1])).sort((a, b) => a[0] - b[0]);
  const bandGraphBackgroundColor = showRpmBandShading && resolvedGraphConfig.supports_band_graph_style ? normalizeOptionalColor(graphStyle?.band_graph_background_color) : null;
  const resolvedBandGraphBackgroundColor = adaptGraphBackgroundToTheme && bandGraphBackgroundColor && isDarkColor(chartTheme.background) ? invertHexColor(bandGraphBackgroundColor) : bandGraphBackgroundColor;
  const bandGraphLabelTextColor = showRpmBandShading && resolvedGraphConfig.supports_band_graph_style ? normalizeOptionalColor(graphStyle?.band_graph_label_text_color) : null;
  const bandGraphFadedOpacity = showRpmBandShading && resolvedGraphConfig.supports_band_graph_style ? normalizeOpacity(graphStyle?.band_graph_faded_opacity) : RPM_BAND_FADED_OPACITY;
  const permissibleLabelColor = resolvedGraphConfig.supports_band_graph_style ? normalizeOptionalColor(graphStyle?.band_graph_permissible_label_color) ?? bandGraphLabelTextColor ?? chartTheme.text : chartTheme.text;
  const rpmSeriesBundle = buildRpmSeries(
    rpmLines,
    rpmPoints,
    chartTheme,
    includeDragHandles,
    permissibleBoundaryData,
    clipRpmAreaToPermissibleUse,
    showRpmBandShading && resolvedGraphConfig.supports_band_graph_style,
    rawRpmFlowMax || rawFlowMax,
    pressureAxisMax,
    bandGraphLabelTextColor,
    bandGraphFadedOpacity,
    resolvedGraphConfig
  );
  const chartFontFamily = chartTheme.fontFamily ?? "sans-serif";
  return {
    backgroundColor: resolvedBandGraphBackgroundColor ?? chartTheme.background,
    textStyle: {
      color: chartTheme.text,
      fontFamily: chartFontFamily
    },
    title: {
      text: title,
      left: "center",
      textStyle: { color: chartTheme.text, fontSize: CHART_STYLE.titleFontSize, fontFamily: chartFontFamily }
    },
    tooltip: tooltip ?? { trigger: "axis", formatter: buildFullChartTooltipFormatter(resolvedGraphConfig, lineDefinitions) },
    grid: { left: "9%", right: "5%", top: "12%", bottom: "12%" },
    xAxis: {
      type: "value",
      name: xAxisName,
      nameLocation: "middle",
      nameGap: 32,
      nameTextStyle: {
        color: chartTheme.text,
        fontFamily: chartFontFamily,
        fontSize: AXIS_NAME_FONT_SIZE,
        fontWeight: AXIS_NAME_FONT_WEIGHT
      },
      axisLabel: {
        color: chartTheme.text,
        fontFamily: chartFontFamily,
        fontSize: AXIS_LABEL_FONT_SIZE,
        fontWeight: AXIS_LABEL_FONT_WEIGHT,
        show: true
      },
      min: 0,
      max: flowAxisMax,
      splitLine: { lineStyle: { color: chartTheme.grid } }
    },
    yAxis: [
      {
        type: "value",
        name: yAxisName,
        nameTextStyle: {
          color: chartTheme.text,
          fontFamily: chartFontFamily,
          fontSize: AXIS_NAME_FONT_SIZE,
          fontWeight: AXIS_NAME_FONT_WEIGHT
        },
        axisLabel: {
          color: chartTheme.text,
          fontFamily: chartFontFamily,
          fontSize: AXIS_LABEL_FONT_SIZE,
          fontWeight: AXIS_LABEL_FONT_WEIGHT,
          show: true
        },
        min: 0,
        max: pressureAxisMax,
        splitLine: { lineStyle: { color: chartTheme.grid } }
      },
      {
        type: "value",
        show: false,
        name: "",
        nameTextStyle: {
          color: chartTheme.text,
          fontFamily: chartFontFamily,
          fontSize: AXIS_NAME_FONT_SIZE,
          fontWeight: AXIS_NAME_FONT_WEIGHT
        },
        axisLabel: {
          color: chartTheme.text,
          fontFamily: chartFontFamily,
          fontSize: AXIS_LABEL_FONT_SIZE,
          fontWeight: AXIS_LABEL_FONT_WEIGHT,
          show: false
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        min: 0,
        max: 100
      }
    ],
    series: [
      ...rpmSeriesBundle.series,
      ...buildEfficiencyAndPermissibleSeries(efficiencyPoints, chartTheme, includeDragHandles, lineDefinitions, {
        permissibleLabelColor
      })
    ]
  };
}
export {
  FULL_CHART_LINE_DEFINITIONS as F,
  buildFullChartOption as b,
  getChartTheme as g
};
