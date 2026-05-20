(function () {
  const host = document.querySelector('[data-product-graph-host]');
  const payload = window.__PRODUCT_GRAPH_DATA__ || null;

  if (!host || !payload || !window.echarts) {
    return;
  }

  const RPM_BAND_FALLBACK_COLORS = ['#0066e3', '#009760', '#e69100', '#ff399f', '#6e57b3', '#259eb0'];
  const CHART_STYLE = {
    rpmBandFadedOpacity: 0.18,
    axisNameFontSize: 20,
    axisNameFontWeight: '600',
    axisLabelFontSize: 18,
    axisLabelFontWeight: '500',
    titleFontSize: 32,
    dragHandleFontSize: 20,
    permissibleLabelFontSize: 18
  };

  const themeName = document.documentElement.dataset.bsTheme === 'dark' ? 'dark' : 'light';
  const chartTheme = themeName === 'dark'
    ? {
        background: '#1a1b26',
        text: '#c0caf5',
        grid: '#3b4261',
        accent: '#7aa2f7',
        efficiency: '#4ade80',
        permissible: '#f87171',
        neutralLine: '#d1d5db',
        fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif'
      }
    : {
        background: '#ffffff',
        text: '#1e293b',
        grid: '#d7dde8',
        accent: '#2563eb',
        efficiency: '#15803d',
        permissible: '#dc2626',
        neutralLine: '#dddddd',
        fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif'
      };

  const graphConfig = payload.graphConfig || {};
  const rpmLines = Array.isArray(payload.rpmLines) ? payload.rpmLines : [];
  const efficiencyPoints = Array.isArray(payload.efficiencyPoints) ? payload.efficiencyPoints : [];
  const showRpmBandShading = payload.showRpmBandShading !== false;
  const supportsOverlays = graphConfig.supports_graph_overlays !== false;
  const chartFontFamily = chartTheme.fontFamily;
  const FLOW_EPSILON = 1e-6;

  function normalizeOptionalColor(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  function numericValue(value) {
    if (value == null || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function formatNumericValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value ?? '');
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, '');
  }

  function resolveBandColor(line, index) {
    return (
      normalizeOptionalColor(line?.band_color) ||
      RPM_BAND_FALLBACK_COLORS[index % RPM_BAND_FALLBACK_COLORS.length]
    );
  }

  function getOppositeGlowColor(color) {
    const normalized = normalizeOptionalColor(color);
    if (!normalized || !normalized.startsWith('#')) return normalized;
    const hex = normalized.slice(1);
    if (hex.length !== 3 && hex.length !== 6) return normalized;
    const expanded = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
    const numeric = Number.parseInt(expanded, 16);
    if (Number.isNaN(numeric)) return normalized;
    const r = 255 - ((numeric >> 16) & 255);
    const g = 255 - ((numeric >> 8) & 255);
    const b = 255 - (numeric & 255);
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  function toRgbaColor(color, alpha = 1) {
    const normalized = normalizeOptionalColor(color);
    if (!normalized) return null;
    if (!normalized.startsWith('#')) return normalized;
    const hex = normalized.slice(1);
    const expanded = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
    if (expanded.length !== 6) return normalized;
    const numeric = Number.parseInt(expanded, 16);
    if (Number.isNaN(numeric)) return normalized;
    const r = (numeric >> 16) & 255;
    const g = (numeric >> 8) & 255;
    const b = numeric & 255;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }

  function axisLabel(label, unit) {
    const cleanLabel = String(label || '').trim();
    const cleanUnit = String(unit || '').trim();
    if (!cleanLabel && !cleanUnit) return '';
    if (!cleanUnit) return cleanLabel;
    if (!cleanLabel) return cleanUnit;
    return `${cleanLabel} (${cleanUnit})`;
  }

  function formatGraphLineValue(value, line = null) {
    const explicitLabel = String(line?.display_label ?? '').trim();
    if (explicitLabel) return explicitLabel;
    const unit = String(graphConfig.graph_line_value_unit ?? '').trim();
    const numeric = formatNumericValue(value);
    return unit ? `${numeric} ${unit}` : numeric;
  }

  function niceAxisMax(values, fallback) {
    const numericValues = values.filter((value) => Number.isFinite(value) && value >= 0);
    if (!numericValues.length) return fallback;
    const maxValue = Math.max(...numericValues);
    return maxValue > 0 ? maxValue * 1.05 : fallback;
  }

  function getNiceAxisTickInterval(axisMax, targetTickCount = 5) {
    const numericMax = Number(axisMax);
    if (!Number.isFinite(numericMax) || numericMax <= 0) return null;

    const rawInterval = numericMax / targetTickCount;
    if (!Number.isFinite(rawInterval) || rawInterval <= 0) return null;

    const exponent = Math.floor(Math.log10(rawInterval));
    const magnitude = 10 ** exponent;
    const normalized = rawInterval / magnitude;

    let niceNormalized;
    if (normalized <= 1) niceNormalized = 1;
    else if (normalized <= 2) niceNormalized = 2;
    else if (normalized <= 5) niceNormalized = 5;
    else niceNormalized = 10;

    return niceNormalized * magnitude;
  }

  function buildAxisLabelFormatter(axisMax, axisInterval) {
    const roundedAxisMax = Number(axisMax);
    const roundedAxisInterval = Number(axisInterval);
    const hasInterval = Number.isFinite(roundedAxisInterval) && roundedAxisInterval > 0;

    return (value) => {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return '';

      if (
        hasInterval &&
        Number.isFinite(roundedAxisMax) &&
        Math.abs(numericValue - roundedAxisMax) < 1e-6
      ) {
        const remainder = Math.abs(numericValue % roundedAxisInterval);
        const isAlignedToInterval =
          remainder < 1e-6 ||
          Math.abs(remainder - roundedAxisInterval) < 1e-6;
        if (!isAlignedToInterval) return '';
      }

      return formatNumericValue(numericValue);
    };
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

  function normalizeFlowValues(values) {
    return [...values]
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)
      .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > FLOW_EPSILON);
  }

  function collectUniqueSortedFlows(rpmCurveEntries, permissibleBoundaryData, extraFlows = []) {
    const values = new Set();
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

      if (
        curveLeft == null ||
        curveRight == null ||
        boundaryLeft == null ||
        boundaryRight == null
      ) {
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
      return (
        findBoundaryLevelCrossings(permissibleBoundaryData, 0)[0] ??
        permissibleBoundaryData[0][0]
      );
    }

    const lowerStartFlow = lowerLineData[0][0];
    const lowerEndFlow = lowerLineData[lowerLineData.length - 1][0];
    const lowerBoundaryCrossings = findCurveBoundaryCrossings(
      lowerLineData,
      permissibleBoundaryData
    )
      .filter((airflow) => airflow >= lowerStartFlow && airflow <= lowerEndFlow)
      .sort((a, b) => a - b);

    return lowerBoundaryCrossings[0] ?? lowerStartFlow;
  }

  function buildBoundarySegmentPoints(boundaryData, startFlow, endFlow) {
    if (!boundaryData.length || startFlow == null || endFlow == null || startFlow === endFlow) {
      return [];
    }

    const minimumFlow = Math.min(startFlow, endFlow);
    const maximumFlow = Math.max(startFlow, endFlow);
    const segmentFlows = new Set([startFlow, endFlow]);

    for (const [airflow] of boundaryData) {
      if (airflow > minimumFlow && airflow < maximumFlow) {
        segmentFlows.add(airflow);
      }
    }

    return normalizeFlowValues(Array.from(segmentFlows))
      .map((airflow) => [airflow, interpolateYAtX(boundaryData, airflow)])
      .filter(([, value]) => value != null);
  }

  function buildBandSampleFlows(rpmCurveEntries, permissibleBoundaryData) {
    if (!permissibleBoundaryData.length) {
      return collectUniqueSortedFlows(rpmCurveEntries, permissibleBoundaryData);
    }

    const intersectionFlows = rpmCurveEntries.flatMap(([, lineData]) =>
      findCurveBoundaryCrossings(lineData, permissibleBoundaryData)
    );
    const boundaryToAxisCrossings = findBoundaryLevelCrossings(permissibleBoundaryData, 0);

    return collectUniqueSortedFlows(
      rpmCurveEntries,
      permissibleBoundaryData,
      [...intersectionFlows, ...boundaryToAxisCrossings]
    );
  }

  function buildBandTopValues(
    lineData,
    flows,
    permissibleBoundaryData,
    clipRpmAreaToPermissibleUse,
    maximumVisibleFlow = null,
    allowPermissibleFallbackBeforeLineStart = false
  ) {
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
        if (
          allowPermissibleFallbackBeforeLineStart &&
          permissibleBoundaryPressure != null &&
          lineStartFlow != null &&
          airflow < lineStartFlow
        ) {
          return permissibleBoundaryPressure;
        }
        return null;
      }

      if (lineEndFlow != null && airflow > lineEndFlow) return pressure;
      return permissibleBoundaryPressure == null ? pressure : Math.min(pressure, permissibleBoundaryPressure);
    });
  }

  function buildBandLowerBoundaryValues(
    lowerLineData,
    flows,
    permissibleBoundaryData,
    clipRpmAreaToPermissibleUse,
    maximumVisibleFlow = null
  ) {
    if (!flows.length) return [];
    if (!lowerLineData?.length) {
      if (!clipRpmAreaToPermissibleUse) return flows.map(() => 0);
      const minimumVisibleFlow = permissibleBoundaryData.length ? permissibleBoundaryData[0][0] : null;
      const activationFlow =
        getLowerBoundaryActivationFlow(lowerLineData, permissibleBoundaryData) ??
        minimumVisibleFlow;
      return flows.map((airflow) =>
        minimumVisibleFlow != null && maximumVisibleFlow != null && airflow >= minimumVisibleFlow && airflow <= maximumVisibleFlow
          ? airflow < activationFlow
            ? interpolateYAtX(permissibleBoundaryData, airflow)
            : 0
          : null
      );
    }

    const lowerStartFlow = lowerLineData[0][0];
    const lowerEndFlow = lowerLineData[lowerLineData.length - 1][0];
    const minimumVisibleFlow = permissibleBoundaryData.length ? permissibleBoundaryData[0][0] : null;
    const activationFlow =
      getLowerBoundaryActivationFlow(lowerLineData, permissibleBoundaryData) ??
      lowerStartFlow;

    return flows.map((airflow) => {
      if (!clipRpmAreaToPermissibleUse) {
        const lowerPressure = interpolateYAtX(lowerLineData, airflow);
        return lowerPressure ?? 0;
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

      const leftDiff =
        upperLeft != null && lowerLeft != null
          ? upperLeft - lowerLeft
          : null;
      const rightDiff =
        upperRight != null && lowerRight != null
          ? upperRight - lowerRight
          : null;

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

  function attachLeftBoundarySegment(
    polygon,
    permissibleBoundaryData,
    upperStartFlow,
    lowerStartFlow
  ) {
    if (
      !polygon ||
      !permissibleBoundaryData.length ||
      upperStartFlow == null ||
      lowerStartFlow == null ||
      lowerStartFlow <= upperStartFlow
    ) {
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

  function alignPolygonToPermissibleBoundary(
    polygon,
    permissibleBoundaryData,
    upperStartFlow,
    lowerStartFlow
  ) {
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
    const topPoints = [...(polygon.topPoints ?? [])];
    const bottomPoints = [...(polygon.bottomPoints ?? [])];

    if (
      !topPoints.length ||
      topPoints[0][0] !== upperStartPoint[0] ||
      topPoints[0][1] !== upperStartPoint[1]
    ) {
      topPoints.unshift(upperStartPoint);
    }

    if (
      !bottomPoints.length ||
      bottomPoints[0][0] !== lowerStartPoint[0] ||
      bottomPoints[0][1] !== lowerStartPoint[1]
    ) {
      bottomPoints.unshift(lowerStartPoint);
    }

    return {
      ...polygon,
      topPoints,
      bottomPoints
    };
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
        const boundedY = Math.min(Math.max(y, Math.min(y0, y1)), Math.max(y0, y1));
        smoothed.push([x, boundedY]);
      }

      smoothed.push([x1, y1]);
    }

    return smoothed;
  }

  function buildBandLabelAnchorData(lineData, pressureAxisMax = null) {
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
    const insetPoint = [
      previousPoint[0] + ((endPoint[0] - previousPoint[0]) * insetRatio),
      previousPoint[1] + ((endPoint[1] - previousPoint[1]) * insetRatio)
    ];

    return [...lineData.slice(0, Math.max(0, anchorEndIndex - 1)), insetPoint];
  }

  function buildRpmBandPolygonSeries(
    rpmCurveEntries,
    rpmLinesForBands,
    permissibleBoundaryData,
    pressureAxisMax,
    clipRpmAreaToPermissibleUse,
    maximumVisibleFlow,
    fadedBandOpacity
  ) {
    if (!rpmCurveEntries.length) return [];

    const shouldClipToPermissibleUse = clipRpmAreaToPermissibleUse && permissibleBoundaryData.length > 0;
    const flows = buildBandSampleFlows(rpmCurveEntries, permissibleBoundaryData);
    if (!flows.length) return [];

    let previousLineData = null;
    return rpmCurveEntries.flatMap(([rpm, lineData], index) => {
      const bandColor = resolveBandColor(rpmLinesForBands[index], index);
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
        shouldClipToPermissibleUse,
        maximumVisibleFlow,
        previousLineData == null
      );
      const lowerBoundary = buildBandLowerBoundaryValues(
        previousLineData,
        flows,
        permissibleBoundaryData,
        shouldClipToPermissibleUse,
        maximumVisibleFlow
      );
      let polygons = buildBandPolygonsBetweenCurves(flows, currentCurve, lowerBoundary);

      if (fullPolygons.length) {
        fullPolygons = [
          alignPolygonToBandStartPoints(fullPolygons[0], lineData, previousLineData),
          ...fullPolygons.slice(1)
        ];
      }

      if (shouldClipToPermissibleUse && polygons.length) {
        const upperStartFlow = polygons[0].topPoints[0]?.[0] ?? null;
        const lowerStartFlow =
          getLowerBoundaryActivationFlow(previousLineData, permissibleBoundaryData) ??
          upperStartFlow;
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

      if (shouldClipToPermissibleUse && fullPolygons.length && pressureAxisMax != null) {
        series.push({
          name: `${formatGraphLineValue(rpm, rpmLinesForBands[index])} band faded`,
          type: 'custom',
          coordinateSystem: 'cartesian2d',
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
              type: 'polygon',
              shape: { points },
              clipPath: {
                type: 'polygon',
                shape: {
                  points: (() => {
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
          z: -20 - index
        });
      }

      series.push({
        name: `${formatGraphLineValue(rpm, rpmLinesForBands[index])} band`,
        type: 'custom',
        coordinateSystem: 'cartesian2d',
        renderItem(params, api) {
          const polygon = polygons[params.dataIndex];
          if (!polygon) return null;
          const polygonPoints = [
            ...polygon.topPoints,
            ...polygon.bottomPoints.slice().reverse()
          ];
          if (!polygonPoints.length) return null;
          const points = polygonPoints.map(([x, y]) => api.coord([x, y]));
          const clipPoints =
            shouldClipToPermissibleUse && maximumVisibleFlow != null && pressureAxisMax != null
              ? (() => {
                  const boundaryEnd = permissibleBoundaryData[permissibleBoundaryData.length - 1];
                  return [
                    api.coord([boundaryEnd[0], pressureAxisMax]),
                    api.coord([maximumVisibleFlow, pressureAxisMax]),
                    api.coord([maximumVisibleFlow, 0]),
                    api.coord([boundaryEnd[0], 0]),
                    ...permissibleBoundaryData.map(([x, y]) => api.coord([x, y]))
                  ];
                })()
              : null;
          return {
            type: 'polygon',
            shape: { points },
            ...(clipPoints
              ? {
                  clipPath: {
                    type: 'polygon',
                    shape: { points: clipPoints }
                  }
                }
              : {}),
            style: api.style({
              fill: bandColor,
              stroke: 'none'
            }),
            silent: true
          };
        },
        data: polygons.map((_, polygonIndex) => polygonIndex),
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: -10 - index
      });

      return series;
    });
  }

  function buildBandLabelAnchorData(lineData, pressureAxisMax = null) {
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
    const insetPoint = [
      previousPoint[0] + ((endPoint[0] - previousPoint[0]) * insetRatio),
      previousPoint[1] + ((endPoint[1] - previousPoint[1]) * insetRatio)
    ];

    return [...lineData.slice(0, Math.max(0, anchorEndIndex - 1)), insetPoint];
  }

  function buildRpmSeries(
    rpmLinesInput,
    rpmPointsInput,
    includeDragHandles,
    permissibleBoundaryData,
    clipRpmAreaToPermissibleUse,
    showRpmBandShadingInput,
    maximumVisibleFlow = null,
    pressureAxisMax = null
  ) {
    const byRpm = {};
    const rpmByLineId = Object.fromEntries(rpmLinesInput.map((line) => [line.id, line.rpm]));
    const lineByRpm = new Map(rpmLinesInput.map((line) => [Number(line.rpm), line]).filter(([rpm]) => !Number.isNaN(rpm)));
    for (const point of rpmPointsInput) {
      const key = String(point.rpm ?? rpmByLineId[point.rpm_line_id] ?? '');
      if (!byRpm[key]) byRpm[key] = [];
      byRpm[key].push({
        value: [point.airflow ?? 0, point.pressure ?? 0],
        id: point.id,
        rpm: point.rpm ?? rpmByLineId[point.rpm_line_id],
        rpm_line_id: point.rpm_line_id
      });
    }

    const rpms = Object.keys(byRpm)
      .filter((key) => key !== '')
      .map((rpm) => Number(rpm))
      .filter((rpm) => !Number.isNaN(rpm))
      .sort((a, b) => a - b);

    const series = [];
    const rpmCurveEntries = [];
    for (const [idx, rpm] of rpms.entries()) {
      const rpmLine = lineByRpm.get(Number(rpm)) ?? null;
      const pointsAtRpm = byRpm[String(rpm)] ?? [];
      const hasMultiplePoints = pointsAtRpm.length > 1;
      const bandColor = resolveBandColor(rpmLine, idx);
      const rawLineData = pointsAtRpm.map((point) => [point.value[0], point.value[1]]).sort((a, b) => a[0] - b[0]);
      const displayLineData = !includeDragHandles && hasMultiplePoints
        ? buildSmoothedCurveSamples(rawLineData)
        : rawLineData;
      rpmCurveEntries.push([rpm, displayLineData]);
      series.push({
        name: formatGraphLineValue(rpm, rpmLine),
        type: 'line',
        smooth: false,
        data: includeDragHandles ? displayLineData : displayLineData.slice().reverse(),
        label: { show: false },
        showSymbol: !includeDragHandles,
        symbol: 'circle',
        symbolSize: !includeDragHandles && !hasMultiplePoints ? 8 : 0,
        lineStyle: {
          width: hasMultiplePoints ? 2 : includeDragHandles ? 0 : 1,
          color: '#0000ff'
        },
        itemStyle: {
          color: bandColor
        },
        color: bandColor,
        areaStyle: undefined,
        emphasis: { focus: 'series' },
        z: includeDragHandles ? idx * 2 : rpms.length - idx
      });

      if (!includeDragHandles && displayLineData.length) {
        const labelUsesBandStyling = showRpmBandShadingInput;
        const reversedLineData = displayLineData.slice().reverse();
        const labelAnchorData = labelUsesBandStyling
          ? buildBandLabelAnchorData(reversedLineData, pressureAxisMax)
          : reversedLineData;
        const labelColor = labelUsesBandStyling ? bandGraphLabelTextColor : chartTheme.text;
        const labelGlowColor = toRgbaColor(getOppositeGlowColor(labelColor), 0.95);
        series.push({
          name: `${formatGraphLineValue(rpm, rpmLine)} label`,
          type: 'line',
          smooth: false,
          data: labelUsesBandStyling
            ? buildBandLabelAnchorData(displayLineData.slice().reverse(), pressureAxisMax)
            : displayLineData.slice().reverse(),
          showSymbol: false,
          silent: true,
          tooltip: { show: false },
          lineStyle: { width: 0, opacity: 0 },
          endLabel: {
            show: true,
            formatter: () => formatGraphLineValue(rpm, rpmLine),
            color: labelColor,
            fontFamily: chartFontFamily,
            distance: 6,
            offset: [1, 25],
            textBorderColor: labelGlowColor ?? undefined,
            textBorderWidth: 4.5,
            shadowBlur: 8,
            shadowColor: labelGlowColor ?? undefined,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            fontSize: CHART_STYLE.dragHandleFontSize,
            fontWeight: 'normal'
          },
          z: 5000,
          zlevel: 10
        });
      }
    }

    if (!includeDragHandles && showRpmBandShadingInput) {
      series.unshift(
        ...buildRpmBandPolygonSeries(
          rpmCurveEntries,
          rpmLinesInput,
          permissibleBoundaryData,
          pressureAxisMax,
          clipRpmAreaToPermissibleUse,
          maximumVisibleFlow,
          bandGraphFadedOpacity
        )
      );
    }

    return { series, rpmCurveEntries };
  }

  function buildDecoratedOverlayLineSeries({
    name,
    data,
    color,
    lineWidth,
    smooth,
    yAxisIndex = 1,
    z = 999,
    showLabel = false,
    labelColor = chartTheme.text,
    labelFormatter = () => name
  }) {
    const outlineWidth = lineWidth + 3;
    const glowWidth = lineWidth + 6;
    const glowColor = toRgbaColor(getOppositeGlowColor(labelColor), 0.95);

    return [
      {
        name: `${name} glow`,
        type: 'line',
        smooth,
        data,
        showSymbol: false,
        yAxisIndex,
        itemStyle: {
          color: '#000000'
        },
        lineStyle: {
          width: glowWidth,
          color: '#000000',
          opacity: 0.14,
          cap: 'round',
          join: 'round'
        },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: z - 2
      },
      {
        name: `${name} outline`,
        type: 'line',
        smooth,
        data,
        showSymbol: false,
        yAxisIndex,
        itemStyle: {
          color: '#000000'
        },
        lineStyle: {
          width: outlineWidth,
          color: '#000000',
          opacity: 0.5,
          cap: 'round',
          join: 'round'
        },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z: z - 1
      },
      {
        name,
        type: 'line',
        smooth,
        data,
        showSymbol: false,
        yAxisIndex,
        itemStyle: { color },
        lineStyle: {
          width: lineWidth,
          color,
          cap: 'round',
          join: 'round'
        },
        endLabel: showLabel
          ? {
              show: true,
              formatter: labelFormatter,
              color: labelColor,
              fontFamily: chartFontFamily,
              distance: 6,
              offset: [1, 0],
              textBorderColor: glowColor ?? undefined,
              textBorderWidth: 4,
              shadowBlur: 8,
              shadowColor: glowColor ?? undefined,
              shadowOffsetX: 0,
              shadowOffsetY: 0,
              fontSize: CHART_STYLE.permissibleLabelFontSize,
              fontWeight: 'normal'
            }
          : { show: false },
        emphasis: { disabled: true },
        tooltip: { show: false },
        silent: true,
        z
      }
    ];
  }

  function buildEfficiencyAndPermissibleSeries(
    points,
    includeDragHandles,
    lineDefinitions,
    { permissibleLabelColor = null, bandGraphLabelTextColor = null } = {},
    permissibleLabelOffset = null
  ) {
    const resolvedPermissibleLabelOffset = {
      x: Number.isFinite(Number(permissibleLabelOffset?.x)) ? Number(permissibleLabelOffset.x) : 0,
      y: Number.isFinite(Number(permissibleLabelOffset?.y)) ? Number(permissibleLabelOffset.y) : 0
    };
    const series = [];

    for (const definition of lineDefinitions) {
      const lineData = points
        .filter((point) => point[definition.key] != null)
        .map((point) => [point.airflow ?? 0, point[definition.key] ?? 0])
        .sort((a, b) => a[0] - b[0]);

      if (!lineData.length) continue;

      const color = chartTheme[definition.colorKey];
      const smooth = lineData.length > 1 ? 0.18 : false;
      series.push(
        ...buildDecoratedOverlayLineSeries({
          name: definition.label,
          data: lineData,
          color,
          lineWidth: definition.lineWidth,
          smooth,
          yAxisIndex: 1,
          z: 999,
          showLabel: false,
          labelColor: definition.key === 'permissible_use'
            ? (permissibleLabelColor ?? chartTheme.text)
            : (bandGraphLabelTextColor ?? chartTheme.text),
          labelFormatter: () => definition.label
        })
      );

      if (!includeDragHandles && lineData.length >= 2) {
        if (definition.key !== 'permissible_use') {
          continue;
        }
        const anchorPoint = lineData[lineData.length - 1] ?? null;
        if (!anchorPoint) continue;
        const labelGlowColor = toRgbaColor(getOppositeGlowColor(permissibleLabelColor ?? chartTheme.text), 0.95);

        series.push({
          name: 'Permissible Use Label',
          type: 'custom',
          coordinateSystem: 'cartesian2d',
          xAxisIndex: 0,
          yAxisIndex: 1,
          silent: true,
          tooltip: { show: false },
          emphasis: { disabled: true },
          data: [{ value: [anchorPoint[0], anchorPoint[1]] }],
          renderItem(params, api) {
            const x = api.value(0);
            const y = api.value(1);
            const anchor = api.coord([x, y]);
            const rightOffsetPixels = 70 + resolvedPermissibleLabelOffset.x;
            const verticalOffsetPixels = -15 + resolvedPermissibleLabelOffset.y;
            return {
              type: 'text',
              x: anchor[0] + rightOffsetPixels,
              y: anchor[1] + verticalOffsetPixels,
              style: {
                text: '⬇️ Permissible Use',
                fill: permissibleLabelColor ?? chartTheme.text,
                stroke: labelGlowColor ?? undefined,
                lineWidth: 3.5,
                shadowBlur: 8,
                shadowColor: labelGlowColor ?? undefined,
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                font: `${CHART_STYLE.permissibleLabelFontSize}px ${chartFontFamily}`,
                textAlign: 'center',
                textVerticalAlign: 'middle'
              },
              silent: true,
              z: 5000,
              zlevel: 10
            };
          },
          z: 5000,
          zlevel: 10
        });
      }

      continue;
    }

    return series;
  }

  const graphConfigDefaults = {
    graph_x_axis_label: graphConfig.graph_x_axis_label || 'Airflow',
    graph_x_axis_unit: graphConfig.graph_x_axis_unit || 'L/s',
    graph_y_axis_label: graphConfig.graph_y_axis_label || 'Pressure',
    graph_y_axis_unit: graphConfig.graph_y_axis_unit || 'Pa',
    graph_line_value_unit: graphConfig.graph_line_value_unit || 'RPM'
  };

  const overlayDefinitions = supportsOverlays
    ? [
        { key: 'efficiency_centre', label: 'Efficiency centre', colorKey: 'efficiency', lineWidth: 3 },
        { key: 'efficiency_lower_end', label: 'Efficiency lower end', colorKey: 'permissible', lineWidth: 3 },
        { key: 'efficiency_higher_end', label: 'Efficiency higher end', colorKey: 'permissible', lineWidth: 3 },
        { key: 'permissible_use', label: 'Permissible use', colorKey: 'neutralLine', lineWidth: 3 }
      ]
    : [];

  const flowValues = [
    ...rpmLines.flatMap((line) => (line.points || []).map((point) => Number(point.airflow))),
    ...efficiencyPoints.map((point) => Number(point.airflow))
  ].filter((value) => !Number.isNaN(value) && value >= 0);

  const pressureValues = rpmLines.flatMap((line) => (line.points || []).map((point) => Number(point.pressure))).filter((value) => !Number.isNaN(value) && value >= 0);
  const flowAxisMax = niceAxisMax(flowValues, 100);
  const pressureAxisMax = niceAxisMax(pressureValues, 100);
  const flowAxisTickInterval = getNiceAxisTickInterval(flowAxisMax);
  const pressureAxisTickInterval = getNiceAxisTickInterval(pressureAxisMax);
  const bandGraphBackgroundColor = normalizeOptionalColor(graphConfig.band_graph_background_color);
  const bandGraphFadedOpacityValue = Number(graphConfig.band_graph_faded_opacity);
  const bandGraphFadedOpacity =
    Number.isFinite(bandGraphFadedOpacityValue)
      ? Math.max(0, Math.min(1, bandGraphFadedOpacityValue))
      : CHART_STYLE.rpmBandFadedOpacity;
  const bandGraphLabelTextColor = normalizeOptionalColor(graphConfig.band_graph_label_text_color) || chartTheme.text;
  const permissibleLabelColor = normalizeOptionalColor(graphConfig.band_graph_permissible_label_color) || bandGraphLabelTextColor || chartTheme.text;
  const graphTitle = String(payload.graphTitle || payload.productModel || 'Performance graph').trim();
  const resolvedGraphBackgroundColor = '#d9d9d9';
  host.style.background = resolvedGraphBackgroundColor;
  const hostWidth = host.getBoundingClientRect?.().width || host.clientWidth || 0;
  const titleWidth = Math.max(280, Math.floor(hostWidth * 0.9));
  const titleFontSize = hostWidth > 0 && hostWidth < 640
    ? 20
    : hostWidth < 900
      ? 26
      : CHART_STYLE.titleFontSize;
  const permissibleBoundaryData = efficiencyPoints
    .filter((point) => point.permissible_use != null)
    .map((point) => [point.airflow ?? 0, (Number(point.permissible_use) / 100) * pressureAxisMax])
    .filter((point) => !Number.isNaN(point[0]) && !Number.isNaN(point[1]))
    .sort((a, b) => a[0] - b[0]);

  const rpmPoints = rpmLines.flatMap((line) =>
    (line.points || []).map((point) => ({
      id: point.id,
      airflow: point.airflow,
      pressure: point.pressure,
      rpm: line.rpm,
      rpm_line_id: line.id
    }))
  );

  const { series: rpmSeries, rpmCurveEntries } = buildRpmSeries(
    rpmLines,
    rpmPoints,
    false,
    permissibleBoundaryData,
    true,
    showRpmBandShading,
    flowAxisMax,
    pressureAxisMax
  );
  const hoverState = {
    cursorX: null,
    cursorY: null
  };
  const overlaySeriesLabels = new Set(overlayDefinitions.map((definition) => definition.label));
  const airflowUnit = String(graphConfig.graph_x_axis_unit || 'L/s').trim();
  const pressureUnit = String(graphConfig.graph_y_axis_unit || 'Pa').trim();

  function formatReading(value, unit) {
    const numeric = Number(value);
    const formatted = Number.isFinite(numeric) ? String(Math.round(numeric)) : '';
    return unit ? `${formatted} ${unit}` : formatted;
  }

  const option = {
    backgroundColor: resolvedGraphBackgroundColor,
    textStyle: {
      color: chartTheme.text,
      fontFamily: chartFontFamily
    },
    title: {
      text: graphTitle,
      left: 'center',
      width: titleWidth,
      textStyle: {
        color: chartTheme.text,
        fontFamily: chartFontFamily,
        fontWeight: 700,
        fontSize: titleFontSize,
        width: titleWidth,
        overflow: 'break',
        lineHeight: titleFontSize + 4
      }
    },
    axisPointer: {
      type: 'line',
      snap: true
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params];
        const rpmItems = items.filter((item) => item && item.seriesName && !overlaySeriesLabels.has(String(item.seriesName)));
        if (!rpmItems.length) return '';
        const cursorX = hoverState.cursorX ?? (Array.isArray(rpmItems[0]?.value) ? rpmItems[0].value[0] : rpmItems[0]?.axisValue);
        const cursorY = hoverState.cursorY ?? (Array.isArray(rpmItems[0]?.value) ? rpmItems[0].value[1] : null);
        const rows = rpmItems.map((item) => {
          const value = Array.isArray(item.value) ? item.value : [item.value, null];
          const xValue = value[0] != null ? value[0] : null;
          const yValue = value[1] != null ? value[1] : null;
          return `<div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:${item.color || chartTheme.accent};"></span>${item.seriesName}: ${formatReading(xValue, airflowUnit)} - ${formatReading(yValue, pressureUnit)}</div>`;
        });
        const lines = [
          `<div style="margin-bottom:6px;font-weight:600;">Cursor : ${formatReading(cursorX, airflowUnit)} - ${formatReading(cursorY, pressureUnit)}</div>`
        ];
        lines.push(...rows);
        return `<div style="font-family:${chartFontFamily};">${lines.join('')}</div>`;
      }
    },
    grid: {
      left: '7%',
      right: '6%',
      top: '12%',
      bottom: '10%'
    },
    xAxis: {
      type: 'value',
      name: axisLabel(graphConfigDefaults.graph_x_axis_label, graphConfigDefaults.graph_x_axis_unit),
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: {
        color: chartTheme.text,
        fontFamily: chartFontFamily,
        fontSize: CHART_STYLE.axisNameFontSize,
        fontWeight: CHART_STYLE.axisNameFontWeight
      },
      min: 0,
      max: flowAxisMax,
      axisLabel: {
        color: chartTheme.text,
        fontFamily: chartFontFamily,
        fontSize: CHART_STYLE.axisLabelFontSize,
        fontWeight: CHART_STYLE.axisLabelFontWeight,
        formatter: buildAxisLabelFormatter(flowAxisMax, flowAxisTickInterval)
      },
      splitLine: { lineStyle: { color: chartTheme.grid } }
    },
    yAxis: [
      {
        type: 'value',
        name: axisLabel(graphConfigDefaults.graph_y_axis_label, graphConfigDefaults.graph_y_axis_unit),
        nameTextStyle: {
          color: chartTheme.text,
          fontFamily: chartFontFamily,
          fontSize: CHART_STYLE.axisNameFontSize,
          fontWeight: CHART_STYLE.axisNameFontWeight
        },
        min: 0,
        max: pressureAxisMax,
        axisLabel: {
          color: chartTheme.text,
          fontFamily: chartFontFamily,
          fontSize: CHART_STYLE.axisLabelFontSize,
          fontWeight: CHART_STYLE.axisLabelFontWeight,
          formatter: buildAxisLabelFormatter(pressureAxisMax, pressureAxisTickInterval)
        },
        splitLine: { lineStyle: { color: chartTheme.grid } }
      },
      {
        type: 'value',
        show: false,
        min: 0,
        max: 100
      }
    ],
    series: [
      ...rpmSeries,
      ...buildEfficiencyAndPermissibleSeries(
        efficiencyPoints,
        false,
        overlayDefinitions,
        {
          permissibleLabelColor,
          bandGraphLabelTextColor
        },
        null
      )
    ]
  };

  const chart = window.echarts.init(host, null, { renderer: 'canvas' });
  chart.setOption(option, { notMerge: true });
  const zr = chart.getZr();
  const onMouseMove = (event) => {
    const x = Number(event?.offsetX);
    const y = Number(event?.offsetY);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const coords = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [x, y]);
      if (Array.isArray(coords)) {
        hoverState.cursorX = coords[0];
        hoverState.cursorY = coords[1];
      } else if (coords && typeof coords === 'object') {
        hoverState.cursorX = coords.x ?? coords[0] ?? null;
        hoverState.cursorY = coords.y ?? coords[1] ?? null;
      }
    }
  };
  zr.on('mousemove', onMouseMove);
  zr.on('globalout', () => {
    hoverState.cursorX = null;
    hoverState.cursorY = null;
  });
  const applyCanvasBackground = () => {
    const canvas = host.querySelector('canvas');
    if (canvas) {
      canvas.style.backgroundColor = resolvedGraphBackgroundColor;
    }
    const viewportRoot = chart.getZr?.().painter?.getViewportRoot?.();
    if (viewportRoot) {
      viewportRoot.style.backgroundColor = resolvedGraphBackgroundColor;
    }
    chart.getDom().style.backgroundColor = resolvedGraphBackgroundColor;
  };
  applyCanvasBackground();

  const updateResponsiveTitle = () => {
    const currentWidth = host.getBoundingClientRect?.().width || host.clientWidth || 0;
    const nextTitleWidth = Math.max(280, Math.floor(currentWidth * 0.9));
    const nextTitleFontSize = currentWidth > 0 && currentWidth < 640
      ? 20
      : currentWidth < 900
        ? 26
        : CHART_STYLE.titleFontSize;
    chart.setOption({
      title: {
        width: nextTitleWidth,
        textStyle: {
          fontSize: nextTitleFontSize,
          lineHeight: nextTitleFontSize + 4
        }
      }
    });
    applyCanvasBackground();
  };

  const resize = () => {
    updateResponsiveTitle();
    chart.resize();
  };
  window.addEventListener('resize', resize);
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('resize', resize);
    zr.off('mousemove', onMouseMove);
    chart.dispose();
  }, { once: true });
})();
