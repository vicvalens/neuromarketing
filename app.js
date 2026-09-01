const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const imageInput = $("#imageInput");
const jsonInput = $("#jsonInput");
const stimulus = $("#stimulus");
const stage = $("#stage");
const emptyState = $("#emptyState");
const resultCanvas = $("#resultCanvas");
const resultCtx = resultCanvas.getContext("2d", { willReadFrequently: true });
const aoiCanvas = $("#aoiCanvas");
const aoiCtx = aoiCanvas.getContext("2d");
const cursorIndicator = $("#cursorIndicator");
const recordingBadge = $("#recordingBadge");
const startBtn = $("#startBtn");
const stopBtn = $("#stopBtn");
const clearBtn = $("#clearBtn");
const downloadPngBtn = $("#downloadPngBtn");
const downloadJsonBtn = $("#downloadJsonBtn");
const durationSelect = $("#durationSelect");
const methodSelect = $("#methodSelect");
const durationField = $("#durationField");
const opacityRange = $("#opacityRange");
const fixationRange = $("#fixationRange");
const opacityOutput = $("#opacityOutput");
const fixationOutput = $("#fixationOutput");
const statusText = $("#statusText");
const timerValue = $("#timerValue");
const sampleMetric = $("#sampleMetric");
const fixationMetric = $("#fixationMetric");
const timeMetric = $("#timeMetric");
const automaticSummary = $("#automaticSummary");
const focusMetric = $("#focusMetric");
const competitionMetric = $("#competitionMetric");
const hotspotMetric = $("#hotspotMetric");
const perceptionPanel = $("#perceptionPanel");
const perceptionReading = $("#perceptionReading");
const perceptionEvidence = $("#perceptionEvidence");
const aoiTypeSelect = $("#aoiTypeSelect");
const drawAoiBtn = $("#drawAoiBtn");
const clearAoiBtn = $("#clearAoiBtn");
const aoiStatus = $("#aoiStatus");
const aoiTableBody = $("#aoiTableBody");
const aoiValidation = $("#aoiValidation");
const aoiConfidence = $("#aoiConfidence");
const aoiValidationList = $("#aoiValidationList");
const saveBaselineBtn = $("#saveBaselineBtn");
const comparisonStatus = $("#comparisonStatus");
const comparisonResults = $("#comparisonResults");
const baselineCanvas = $("#baselineCanvas");
const candidateCanvas = $("#candidateCanvas");
const baselineName = $("#baselineName");
const candidateName = $("#candidateName");
const focusComparison = $("#focusComparison");
const competitionComparison = $("#competitionComparison");
const hotspotComparison = $("#hotspotComparison");
const similarityComparison = $("#similarityComparison");
const differenceCanvas = $("#differenceCanvas");
const winnerPanel = $("#winnerPanel");
const beforeScore = $("#beforeScore");
const afterScore = $("#afterScore");
const winnerName = $("#winnerName");
const winnerReason = $("#winnerReason");
const winnerConfidence = $("#winnerConfidence");
const printReportBtn = $("#printReportBtn");
const projectNameInput = $("#projectNameInput");
const studentNameInput = $("#studentNameInput");
const studyDateInput = $("#studyDateInput");
const worksAnswer = $("#worksAnswer");
const communicatesAnswer = $("#communicatesAnswer");
const perceivedAnswer = $("#perceivedAnswer");
const studyConclusion = $("#studyConclusion");
const designRecommendations = $("#designRecommendations");
const printProject = $("#printProject");
const printStudent = $("#printStudent");
const printDate = $("#printDate");
const viewButtons = $$(".view-btn");

const SAMPLE_INTERVAL = 50;
const FIXATION_RADIUS = 0.035;
const MIN_FIXATION_MS = 180;

let imageName = "render";
let imageUrl = "";
let recording = false;
let samples = [];
let fixations = [];
let pointer = null;
let sessionStartedAt = 0;
let sessionEndedAt = 0;
let sampleTimer = null;
let countdownTimer = null;
let currentView = "original";
let automaticMap = null;
let automaticMetrics = null;
let perceptualMetrics = null;
let aois = [];
let drawingAoi = false;
let aoiDragStart = null;
let aoiPreview = null;
let comparisonBaseline = null;

const AOI_COLORS = {
  Product: "#f2f2f2",
  Brand: "#9ec5ff",
  Message: "#ffd166",
  "Call to Action": "#ff7a59",
  Distractor: "#c7a4ff"
};

function makeId() {
  return window.crypto?.randomUUID?.() || `aoi-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function setView(view) {
  currentView = view;
  viewButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const original = view === "original";
  stimulus.hidden = !original;
  resultCanvas.hidden = original;
  if (!original) renderResult();
  renderAois();
}

function enableResultControls(enabled) {
  viewButtons.forEach((button) => { button.disabled = !enabled; });
  downloadPngBtn.disabled = !enabled;
  downloadJsonBtn.disabled = !enabled;
  drawAoiBtn.disabled = !enabled;
}

function resetSession(keepImage = true) {
  stopRecordingTimers();
  recording = false;
  samples = [];
  fixations = [];
  automaticMap = null;
  automaticMetrics = null;
  perceptualMetrics = null;
  aois = [];
  drawingAoi = false;
  aoiDragStart = null;
  aoiPreview = null;
  pointer = null;
  sessionStartedAt = 0;
  sessionEndedAt = 0;
  stage.classList.remove("recording");
  recordingBadge.hidden = true;
  startBtn.disabled = !keepImage || !stimulus.src;
  startBtn.textContent = methodSelect.value === "automatic" ? "Analyze automatically" : "Start test";
  stopBtn.disabled = true;
  clearBtn.disabled = !keepImage || !stimulus.src;
  enableResultControls(false);
  sampleMetric.textContent = "0";
  fixationMetric.textContent = "0";
  timeMetric.textContent = "0.0 s";
  automaticSummary.hidden = true;
  perceptionPanel.hidden = true;
  saveBaselineBtn.disabled = true;
  comparisonResults.hidden = true;
  winnerPanel.hidden = true;
  comparisonStatus.textContent = comparisonBaseline
    ? `Baseline saved: ${comparisonBaseline.name}. Analyze a revised render, then mark Product and Distractor.`
    : "Run an automatic analysis and mark Product and Distractor.";
  aoiCanvas.hidden = true;
  aoiCanvas.classList.remove("drawing");
  aoiTypeSelect.value = "";
  clearAoiBtn.disabled = true;
  updateAoiTable();
  timerValue.textContent = formatTime(Number(durationSelect.value) * 1000);
  timerValue.parentElement.classList.remove("warning");
  setView("original");
  if (keepImage && stimulus.src) {
    setStatus(methodSelect.value === "automatic"
      ? "Image ready. Run the automatic saliency analysis."
      : "Image ready. Start the test when the participant is prepared.");
  }
}

function stopRecordingTimers() {
  clearInterval(sampleTimer);
  clearInterval(countdownTimer);
  sampleTimer = null;
  countdownTimer = null;
}

function loadImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = URL.createObjectURL(file);
  imageName = file.name.replace(/\.[^.]+$/, "") || "render";
  stimulus.onload = () => {
    emptyState.hidden = true;
    stimulus.hidden = false;
    resultCanvas.width = stimulus.naturalWidth;
    resultCanvas.height = stimulus.naturalHeight;
    aoiCanvas.width = stimulus.naturalWidth;
    aoiCanvas.height = stimulus.naturalHeight;
    resetSession(true);
  };
  stimulus.src = imageUrl;
}

function pointerToNormalized(event) {
  const rect = stimulus.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

function updateCursorIndicator(event) {
  const stageRect = stage.getBoundingClientRect();
  cursorIndicator.style.left = `${event.clientX - stageRect.left}px`;
  cursorIndicator.style.top = `${event.clientY - stageRect.top}px`;
}

function startSession() {
  if (methodSelect.value === "automatic") {
    analyzeAutomatically();
    return;
  }
  if (!stimulus.src || recording) return;
  resetSession(true);
  recording = true;
  sessionStartedAt = performance.now();
  stage.classList.add("recording");
  recordingBadge.hidden = false;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  clearBtn.disabled = true;
  viewButtons.forEach((button) => { button.disabled = true; });
  setView("original");
  setStatus("Recording. Point at the areas that attract your attention and pause according to their importance.");

  sampleTimer = setInterval(() => {
    if (!pointer) return;
    samples.push({ x: pointer.x, y: pointer.y, t: Math.round(performance.now() - sessionStartedAt) });
    sampleMetric.textContent = String(samples.length);
  }, SAMPLE_INTERVAL);

  const durationMs = Number(durationSelect.value) * 1000;
  countdownTimer = setInterval(() => {
    const elapsed = performance.now() - sessionStartedAt;
    const remaining = durationMs ? durationMs - elapsed : elapsed;
    timerValue.textContent = durationMs ? formatTime(remaining) : formatTime(elapsed);
    timerValue.parentElement.classList.toggle("warning", durationMs > 0 && remaining <= 5000);
    timeMetric.textContent = `${(elapsed / 1000).toFixed(1)} s`;
    if (durationMs && remaining <= 0) finishSession();
  }, 100);
}

function normalize(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const range = max - min || 1;
  return Float32Array.from(values, (value) => (value - min) / range);
}

function boxBlur(values, width, height, radius) {
  const integral = new Float32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += values[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const output = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const sum = integral[(y1 + 1) * (width + 1) + x1 + 1]
        - integral[y0 * (width + 1) + x1 + 1]
        - integral[(y1 + 1) * (width + 1) + x0]
        + integral[y0 * (width + 1) + x0];
      output[y * width + x] = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
    }
  }
  return output;
}

function automaticHotspots(map, width, height, count = 12) {
  const working = Float32Array.from(map);
  const points = [];
  const radius = Math.max(7, Math.round(Math.min(width, height) * 0.11));
  for (let n = 0; n < count; n += 1) {
    let bestIndex = 0;
    for (let i = 1; i < working.length; i += 1) {
      if (working[i] > working[bestIndex]) bestIndex = i;
    }
    const value = working[bestIndex];
    if (value < 0.22) break;
    const x = bestIndex % width;
    const y = Math.floor(bestIndex / width);
    points.push({
      x: x / (width - 1),
      y: y / (height - 1),
      start: n * 220,
      duration: Math.round(220 + value * 780),
      samples: 1,
      saliency: value
    });
    for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
        const d = Math.hypot(xx - x, yy - y) / radius;
        if (d <= 1) working[yy * width + xx] *= d * d;
      }
    }
  }
  return points;
}

function describeHotspot(point) {
  const horizontal = point.x < 0.36 ? "left" : point.x > 0.64 ? "right" : "center";
  const vertical = point.y < 0.36 ? "upper" : point.y > 0.64 ? "lower" : "middle";
  return horizontal === "center" && vertical === "middle" ? "Center" : `${vertical}-${horizontal}`;
}

function computeAutomaticMetrics(map, hotspots) {
  const sorted = [...map].sort((a, b) => b - a);
  const total = sorted.reduce((sum, value) => sum + value, 0) || 1;
  const topTenCount = Math.max(1, Math.round(sorted.length * 0.1));
  const topShare = sorted.slice(0, topTenCount).reduce((sum, value) => sum + value, 0) / total;
  const concentration = topShare > 0.46 ? "High" : topShare > 0.34 ? "Moderate" : "Distributed";
  const strongHotspots = hotspots.filter((point) => point.saliency >= 0.55).length;
  const competition = strongHotspots >= 5 ? "High" : strongHotspots >= 3 ? "Moderate" : "Low";
  return { concentration, competition, primary: hotspots[0] ? describeHotspot(hotspots[0]) : "Not detected", topShare };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function perceptualLabel(score, low, high) {
  if (score < 38) return low;
  if (score > 62) return high;
  return `Balanced ${low.toLowerCase()} / ${high.toLowerCase()}`;
}

function computePerceptualMetrics(pixels, luminance, saturation, normalizedEdges) {
  const count = luminance.length || 1;
  let luminanceTotal = 0;
  let saturationTotal = 0;
  let edgeTotal = 0;
  let redTotal = 0;
  let blueTotal = 0;
  for (let i = 0; i < count; i += 1) {
    luminanceTotal += luminance[i];
    saturationTotal += saturation[i];
    edgeTotal += normalizedEdges[i];
    redTotal += pixels[i * 4] / 255;
    blueTotal += pixels[i * 4 + 2] / 255;
  }
  const meanLuminance = luminanceTotal / count;
  const meanSaturation = saturationTotal / count;
  const meanEdge = edgeTotal / count;
  let variance = 0;
  for (const value of luminance) variance += (value - meanLuminance) ** 2;
  const luminanceContrast = Math.sqrt(variance / count);
  const temperature = clampScore(50 + ((blueTotal - redTotal) / count) * 170);
  const vividness = clampScore(meanSaturation * 190);
  const boldness = clampScore(luminanceContrast * 260 + meanSaturation * 60);
  const complexity = clampScore(meanEdge * 145 + luminanceContrast * 90);
  const energy = clampScore(vividness * 0.36 + boldness * 0.38 + complexity * 0.26);
  return { energy, temperature, boldness, complexity, vividness, meanLuminance, meanSaturation, luminanceContrast, meanEdge };
}

function renderPerceptualAnalysis() {
  if (!perceptualMetrics) {
    perceptionPanel.hidden = true;
    return;
  }
  const scales = [
    ["energy", "Calm", "Energetic"],
    ["temperature", "Warm", "Cool"],
    ["boldness", "Soft", "Bold"],
    ["complexity", "Simple", "Complex"],
    ["vividness", "Subtle", "Vivid"]
  ];
  scales.forEach(([key, low, high]) => {
    $(`#${key}Marker`).style.left = `${perceptualMetrics[key]}%`;
    $(`#${key}Value`).textContent = perceptualLabel(perceptualMetrics[key], low, high);
  });
  const descriptors = scales
    .map(([key, low, high]) => ({ distance: Math.abs(perceptualMetrics[key] - 50), label: perceptualMetrics[key] >= 50 ? high : low }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3)
    .map((item) => item.label.toLowerCase());
  perceptionReading.textContent = `The image is visually perceived as ${descriptors.slice(0, -1).join(", ")} and ${descriptors.at(-1)}.`;
  perceptionEvidence.textContent = `Average saturation ${Math.round(perceptualMetrics.meanSaturation * 100)}%, luminance contrast ${Math.round(perceptualMetrics.luminanceContrast * 100)}%, edge activity ${Math.round(perceptualMetrics.meanEdge * 100)}%, and average brightness ${Math.round(perceptualMetrics.meanLuminance * 100)}%.`;
  perceptionPanel.hidden = false;
}

function attentionGrid() {
  if (automaticMap) return automaticMap;
  const width = 180;
  const height = Math.max(90, Math.round(width * stimulus.naturalHeight / stimulus.naturalWidth));
  const values = new Float32Array(width * height);
  const points = fixations.length ? fixations : samples.map((point) => ({ ...point, duration: SAMPLE_INTERVAL }));
  const radius = Math.max(6, Math.round(Math.min(width, height) * 0.075));
  points.forEach((point) => {
    const cx = point.x * (width - 1);
    const cy = point.y * (height - 1);
    const weight = Math.max(1, (point.duration || SAMPLE_INTERVAL) / SAMPLE_INTERVAL);
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(height - 1, Math.ceil(cy + radius)); y += 1) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(width - 1, Math.ceil(cx + radius)); x += 1) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d <= 1) values[y * width + x] += weight * Math.exp(-3.2 * d * d);
      }
    }
  });
  return { width, height, values };
}

function measureAoi(aoi) {
  if (!samples.length && !automaticMap) return 0;
  const grid = attentionGrid();
  let total = 0;
  let inside = 0;
  const x0 = Math.floor(aoi.x * grid.width);
  const y0 = Math.floor(aoi.y * grid.height);
  const x1 = Math.ceil((aoi.x + aoi.w) * grid.width);
  const y1 = Math.ceil((aoi.y + aoi.h) * grid.height);
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const value = grid.values[y * grid.width + x];
      total += value;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) inside += value;
    }
  }
  return total ? inside / total * 100 : 0;
}

function hasRequiredAreas(areas = aois) {
  return areas.some((area) => area.type === "Product")
    && areas.some((area) => area.type === "Distractor");
}

function areaCoverage(area) {
  return Math.max(0, Math.min(100, area.w * area.h * 100));
}

function coverageByType(areas, type) {
  return Math.min(100, areas.filter((area) => area.type === type).reduce((sum, area) => sum + areaCoverage(area), 0));
}

function overlapCoverage(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, right - left) * Math.max(0, bottom - top) * 100;
}

function evaluateAreaQuality() {
  const issues = [];
  let score = 100;
  if (!hasRequiredAreas()) {
    return { score: 0, level: "Not ready", key: "neutral", issues: ["Define both Product and Distractor."] };
  }

  const productCoverage = coverageByType(aois, "Product");
  const distractorCoverage = coverageByType(aois, "Distractor");
  if (productCoverage < 12) {
    issues.push(`Product covers only ${productCoverage.toFixed(1)}% of the image; draw tightly around the complete product.`);
    score -= 35;
  } else if (productCoverage > 78) {
    issues.push(`Product covers ${productCoverage.toFixed(1)}% of the image and may include too much background.`);
    score -= 30;
  } else if (productCoverage > 65) {
    issues.push(`Product coverage is large (${productCoverage.toFixed(1)}%); verify that background is excluded.`);
    score -= 10;
  }
  if (distractorCoverage > 65) {
    issues.push(`Distractor covers ${distractorCoverage.toFixed(1)}% of the image; isolate only competing elements.`);
    score -= 25;
  } else if (distractorCoverage < 2) {
    issues.push(`Distractor covers only ${distractorCoverage.toFixed(1)}%; verify that the competing background is represented.`);
    score -= 10;
  }

  const productAreas = aois.filter((area) => area.type === "Product");
  const distractorAreas = aois.filter((area) => area.type === "Distractor");
  const overlap = productAreas.reduce((total, product) => total
    + distractorAreas.reduce((sum, distractor) => sum + overlapCoverage(product, distractor), 0), 0);
  if (overlap > 1) {
    issues.push(`Product and Distractor overlap across ${overlap.toFixed(1)}% of the image.`);
    score -= Math.min(35, 15 + overlap);
  }

  if (comparisonBaseline?.areas?.length) {
    const beforeProduct = coverageByType(comparisonBaseline.areas, "Product");
    const beforeDistractor = coverageByType(comparisonBaseline.areas, "Distractor");
    const productDifference = Math.abs(productCoverage - beforeProduct);
    const distractorDifference = Math.abs(distractorCoverage - beforeDistractor);
    if (productDifference > 15) {
      issues.push(`Product coverage differs by ${productDifference.toFixed(1)} points between Before and After.`);
      score -= 25;
    } else if (productDifference > 8) {
      issues.push(`Product coverage differs moderately between Before and After (${productDifference.toFixed(1)} points).`);
      score -= 10;
    }
    if (distractorDifference > 20) {
      issues.push(`Distractor coverage differs by ${distractorDifference.toFixed(1)} points between Before and After.`);
      score -= 20;
    } else if (distractorDifference > 10) {
      issues.push(`Distractor coverage differs moderately between Before and After (${distractorDifference.toFixed(1)} points).`);
      score -= 8;
    }
  }

  score = Math.max(0, Math.round(score));
  const level = score >= 80 ? "High" : score >= 55 ? "Moderate" : "Low";
  return {
    score,
    level,
    key: level.toLowerCase(),
    issues: issues.length ? issues : ["Area definitions are consistent and suitable for comparison."]
  };
}

function updateAreaValidation() {
  const quality = evaluateAreaQuality();
  aoiValidation.dataset.level = quality.key;
  aoiConfidence.textContent = quality.level === "Not ready" ? quality.level : `${quality.level} · ${quality.score}/100`;
  aoiValidationList.innerHTML = quality.issues.map((issue) => `<li>${issue}</li>`).join("");
  return quality;
}

function updateBaselineAvailability() {
  const ready = Boolean(automaticMap && automaticMetrics && hasRequiredAreas());
  saveBaselineBtn.disabled = !ready;
  if (automaticMap && !hasRequiredAreas()) {
    comparisonStatus.textContent = "Mark Product and Distractor to enable the baseline.";
  } else if (ready && !comparisonBaseline) {
    comparisonStatus.textContent = "Required areas ready. Save the current render as the baseline.";
  } else if (ready && comparisonBaseline && comparisonResults.hidden) {
    comparisonStatus.textContent = `Baseline saved: ${comparisonBaseline.name}. Analyze the revised render.`;
  } else if (ready && comparisonBaseline) {
    comparisonStatus.textContent = "Comparison and Product emphasis recommendation ready.";
  }
}

function attentionByType(areas, type) {
  return Math.min(100, areas
    .filter((area) => area.type === type)
    .reduce((sum, area) => sum + (Number.isFinite(area.attention) ? area.attention : measureAoi(area)), 0));
}

function pointInsideAreas(point, areas, type) {
  if (!point) return false;
  return areas.some((area) => area.type === type
    && point.x >= area.x && point.x <= area.x + area.w
    && point.y >= area.y && point.y <= area.y + area.h);
}

function productEmphasisScore(areas, metrics, primaryPoint) {
  const productAttention = attentionByType(areas, "Product");
  const distractorAttention = attentionByType(areas, "Distractor");
  const hotspotOnProduct = pointInsideAreas(primaryPoint, areas, "Product");
  const competitionPoints = metrics.competition === "Low" ? 10 : metrics.competition === "Moderate" ? 6 : 2;
  const score = 0.55 * productAttention
    + 0.20 * (100 - distractorAttention)
    + (hotspotOnProduct ? 15 : 0)
    + competitionPoints;
  return {
    score: Math.max(0, Math.min(100, score)),
    productAttention,
    distractorAttention,
    hotspotOnProduct
  };
}

function updateWinner() {
  winnerPanel.hidden = true;
  if (!comparisonBaseline || !automaticMap || !automaticMetrics || !hasRequiredAreas()) return;
  const baselineResult = productEmphasisScore(
    comparisonBaseline.areas,
    comparisonBaseline.metrics,
    comparisonBaseline.primaryPoint
  );
  const currentAreas = aois.map((area) => ({ ...area, attention: measureAoi(area) }));
  const currentResult = productEmphasisScore(currentAreas, automaticMetrics, fixations[0]);
  const areaQuality = evaluateAreaQuality();
  beforeScore.textContent = `${Math.round(baselineResult.score)}/100`;
  afterScore.textContent = `${Math.round(currentResult.score)}/100`;
  winnerConfidence.textContent = `${areaQuality.level} · ${areaQuality.score}/100`;

  const difference = currentResult.score - baselineResult.score;
  const afterWins = difference > 1.5;
  const beforeWins = difference < -1.5;
  winnerName.textContent = afterWins ? `After — ${imageName}` : beforeWins ? `Before — ${comparisonBaseline.name}` : "No clear winner";

  const productDelta = currentResult.productAttention - baselineResult.productAttention;
  const distractorDelta = currentResult.distractorAttention - baselineResult.distractorAttention;
  if (!afterWins && !beforeWins) {
    const details = [];
    if (Math.abs(productDelta) >= 1) details.push(`After has ${Math.abs(productDelta).toFixed(1)} points ${productDelta > 0 ? "more" : "less"} product attention`);
    if (Math.abs(distractorDelta) >= 1) details.push(`After has ${Math.abs(distractorDelta).toFixed(1)} points ${distractorDelta < 0 ? "less" : "more"} distraction`);
    winnerReason.textContent = details.length
      ? `The total scores remain too close for a clear recommendation. ${details.join("; ")}.`
      : "Both renders perform similarly for the selected Product emphasis goal.";
  } else {
    const winnerLabel = afterWins ? "After" : "Before";
    const winner = afterWins ? currentResult : baselineResult;
    const loser = afterWins ? baselineResult : currentResult;
    const strengths = [];
    const tradeoffs = [];
    const productAdvantage = winner.productAttention - loser.productAttention;
    const distractionAdvantage = loser.distractorAttention - winner.distractorAttention;
    if (productAdvantage >= 1) strengths.push(`${productAdvantage.toFixed(1)} points more attention on the product`);
    else if (productAdvantage <= -1) tradeoffs.push(`${Math.abs(productAdvantage).toFixed(1)} points less attention on the product`);
    if (distractionAdvantage >= 1) strengths.push(`${distractionAdvantage.toFixed(1)} points less distraction`);
    else if (distractionAdvantage <= -1) tradeoffs.push(`${Math.abs(distractionAdvantage).toFixed(1)} points more distraction`);
    if (winner.hotspotOnProduct && !loser.hotspotOnProduct) strengths.push("a primary hotspot located on the product");
    else if (!winner.hotspotOnProduct && loser.hotspotOnProduct) tradeoffs.push("a primary hotspot outside the product");
    const strengthText = strengths.length ? ` Its advantages are ${strengths.join(" and ")}.` : "";
    const tradeoffText = tradeoffs.length ? ` Trade-off: ${tradeoffs.join(" and ")}.` : "";
    winnerReason.textContent = `${winnerLabel} receives the higher Product emphasis score.${strengthText}${tradeoffText}`;
  }
  if (areaQuality.level === "Low") {
    winnerReason.textContent += " Low area confidence: revise the rectangles before using this recommendation.";
  } else if (areaQuality.level === "Moderate") {
    winnerReason.textContent += " Area confidence is moderate; interpret the recommendation with caution.";
  }
  winnerPanel.hidden = false;
  updateStudySummary();
}

function updateStudySummary() {
  const recommendations = [];
  if (!automaticMetrics && !fixations.length) {
    studyConclusion.textContent = "Run an analysis to generate a concise conclusion.";
    recommendations.push("Recommendations will appear after the image is analyzed.");
  } else {
    const method = automaticMap ? "The automatic saliency estimate" : "The participant cursor test";
    const primary = automaticMetrics?.primary || (fixations[0] ? "the first recorded fixation" : "an undetermined region");
    const concentration = automaticMetrics?.concentration || "observed";
    const competition = automaticMetrics?.competition || "not automatically classified";
    let conclusion = `${method} shows ${concentration.toLowerCase()} focus concentration, with the primary attention point located at ${primary}. Visual competition is ${competition.toLowerCase()}.`;
    if (perceptualMetrics && !perceptionPanel.hidden) conclusion += ` Perceptually, ${perceptionReading.textContent.replace(/^The image is visually perceived as /, "the image reads as ")}`;
    if (!winnerPanel.hidden && winnerName.textContent !== "—") {
      conclusion += ` For the Product emphasis goal, the comparison result is: ${winnerName.textContent}.`;
    }
    studyConclusion.textContent = conclusion;

    if (automaticMetrics?.competition === "High") recommendations.push("Reduce secondary high-contrast details so fewer elements compete with the intended focal point.");
    else if (automaticMetrics?.competition === "Moderate") recommendations.push("Strengthen the hierarchy by giving the principal element a clearer contrast or scale advantage.");
    else recommendations.push("Preserve the clear hierarchy while checking that supporting details remain legible.");

    if (hasRequiredAreas()) {
      const productAttention = attentionByType(aois, "Product");
      const distractorAttention = attentionByType(aois, "Distractor");
      if (!pointInsideAreas(fixations[0], aois, "Product")) recommendations.push("Move, enlarge or visually emphasize the product so the primary hotspot falls inside it.");
      if (distractorAttention > productAttention * 0.65) recommendations.push("Lower the brightness, saturation or edge contrast of the marked distractor.");
      else recommendations.push("Maintain the product–distractor separation and verify it with another render variation.");
    } else {
      recommendations.push("Mark Product and Distractor areas to obtain goal-specific recommendations.");
    }
    if (comparisonBaseline && comparisonResults.hidden) recommendations.push("Analyze the revised render and define equivalent areas to complete the Before / After comparison.");
  }
  designRecommendations.replaceChildren(...recommendations.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
}

function updateAoiTable() {
  if (!aois.length) {
    aoiTableBody.innerHTML = '<tr class="empty-row"><td colspan="4">No areas defined</td></tr>';
    aoiStatus.textContent = samples.length || automaticMap ? "Ready to define areas." : "Run an analysis first.";
    updateAreaValidation();
    updateBaselineAvailability();
    updateWinner();
    updateStudySummary();
    return;
  }
  aoiTableBody.innerHTML = aois.map((aoi) => {
    const attention = measureAoi(aoi);
    return `<tr>
      <td><span class="aoi-swatch" style="--area-color:${AOI_COLORS[aoi.type]}"></span>${aoi.type}</td>
      <td>${areaCoverage(aoi).toFixed(1)}%</td>
      <td><strong>${attention.toFixed(1)}%</strong></td>
      <td><button class="remove-aoi" data-aoi-id="${aoi.id}" aria-label="Remove ${aoi.type} area">Remove</button></td>
    </tr>`;
  }).join("");
  aoiStatus.textContent = `${aois.length} ${aois.length === 1 ? "area" : "areas"} measured.`;
  updateAreaValidation();
  updateBaselineAvailability();
  updateWinner();
  updateStudySummary();
}

function renderAois() {
  if (!stimulus.src) return;
  aoiCtx.clearRect(0, 0, aoiCanvas.width, aoiCanvas.height);
  const regions = aoiPreview ? [...aois, aoiPreview] : aois;
  regions.forEach((aoi) => {
    const x = aoi.x * aoiCanvas.width;
    const y = aoi.y * aoiCanvas.height;
    const w = aoi.w * aoiCanvas.width;
    const h = aoi.h * aoiCanvas.height;
    const color = AOI_COLORS[aoi.type] || "#ffffff";
    aoiCtx.save();
    aoiCtx.fillStyle = `${color}24`;
    aoiCtx.strokeStyle = color;
    aoiCtx.lineWidth = Math.max(3, aoiCanvas.width * 0.003);
    aoiCtx.setLineDash(aoi === aoiPreview ? [12, 8] : []);
    aoiCtx.fillRect(x, y, w, h);
    aoiCtx.strokeRect(x, y, w, h);
    aoiCtx.font = `700 ${Math.max(16, Math.round(aoiCanvas.width * 0.018))}px system-ui`;
    const labelWidth = aoiCtx.measureText(aoi.type).width + 20;
    const labelHeight = Math.max(27, aoiCanvas.width * 0.03);
    aoiCtx.fillStyle = color;
    aoiCtx.fillRect(x, Math.max(0, y - labelHeight), labelWidth, labelHeight);
    aoiCtx.fillStyle = "#090d0c";
    aoiCtx.textBaseline = "middle";
    aoiCtx.fillText(aoi.type, x + 10, Math.max(labelHeight / 2, y - labelHeight / 2));
    aoiCtx.restore();
  });
  aoiCanvas.hidden = !(regions.length || drawingAoi);
}

function aoiPointer(event) {
  const rect = aoiCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function toggleAoiDrawing(force) {
  if ((force === true || (force === undefined && !drawingAoi)) && !aoiTypeSelect.value) {
    aoiStatus.textContent = "Choose an area type to begin drawing.";
    return;
  }
  drawingAoi = typeof force === "boolean" ? force : !drawingAoi;
  aoiCanvas.classList.toggle("drawing", drawingAoi);
  aoiCanvas.hidden = !(drawingAoi || aois.length);
  drawAoiBtn.classList.toggle("active", drawingAoi);
  drawAoiBtn.textContent = drawingAoi ? "Cancel drawing" : "Draw area";
  aoiStatus.textContent = drawingAoi
    ? `Drag over the ${aoiTypeSelect.value.toLowerCase()} area.`
    : (aois.length ? `${aois.length} ${aois.length === 1 ? "area" : "areas"} measured.` : "Ready to define areas.");
  renderAois();
}

function snapshotStimulus() {
  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(stimulus.naturalWidth, stimulus.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(stimulus.naturalWidth * scale);
  canvas.height = Math.round(stimulus.naturalHeight * scale);
  canvas.getContext("2d").drawImage(stimulus, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function renderComparisonImage(canvas, imageSource, map) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const mapCanvas = document.createElement("canvas");
      mapCanvas.width = map.width;
      mapCanvas.height = map.height;
      const mapCtx = mapCanvas.getContext("2d");
      const pixels = mapCtx.createImageData(map.width, map.height);
      for (let i = 0; i < map.values.length; i += 1) {
        const intensity = map.values[i];
        const [r, g, b] = heatColor(intensity);
        pixels.data[i * 4] = r;
        pixels.data[i * 4 + 1] = g;
        pixels.data[i * 4 + 2] = b;
        pixels.data[i * 4 + 3] = Math.round(166 * Math.pow(intensity, 1.25));
      }
      mapCtx.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(mapCanvas, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    image.src = imageSource;
  });
}

function loadImageSource(source) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = source;
  });
}

async function computeImageSimilarity(beforeSource, afterSource) {
  const [beforeImage, afterImage] = await Promise.all([loadImageSource(beforeSource), loadImageSource(afterSource)]);
  const width = 160;
  const height = 120;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(beforeImage, 0, 0, width, height);
  const before = ctx.getImageData(0, 0, width, height).data;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(afterImage, 0, 0, width, height);
  const after = ctx.getImageData(0, 0, width, height).data;
  let difference = 0;
  for (let i = 0; i < before.length; i += 4) {
    difference += Math.abs(before[i] - after[i]);
    difference += Math.abs(before[i + 1] - after[i + 1]);
    difference += Math.abs(before[i + 2] - after[i + 2]);
  }
  const meanDifference = difference / (width * height * 3 * 255);
  return Math.max(0, Math.min(100, (1 - meanDifference) * 100));
}

async function renderAttentionDifference(canvas, imageSource, beforeMap, afterMap) {
  const image = await loadImageSource(imageSource);
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const overlay = document.createElement("canvas");
  overlay.width = afterMap.width;
  overlay.height = afterMap.height;
  const overlayCtx = overlay.getContext("2d");
  const pixels = overlayCtx.createImageData(overlay.width, overlay.height);
  const differences = new Float32Array(afterMap.values.length);
  let maxDifference = 0;
  for (let y = 0; y < afterMap.height; y += 1) {
    for (let x = 0; x < afterMap.width; x += 1) {
      const beforeX = Math.round(x / Math.max(1, afterMap.width - 1) * (beforeMap.width - 1));
      const beforeY = Math.round(y / Math.max(1, afterMap.height - 1) * (beforeMap.height - 1));
      const index = y * afterMap.width + x;
      const difference = afterMap.values[index] - beforeMap.values[beforeY * beforeMap.width + beforeX];
      differences[index] = difference;
      maxDifference = Math.max(maxDifference, Math.abs(difference));
    }
  }
  const scale = maxDifference || 1;
  for (let i = 0; i < differences.length; i += 1) {
    const difference = differences[i];
    const strength = Math.abs(difference) / scale;
    if (strength < 0.09) continue;
    const gain = difference > 0;
    pixels.data[i * 4] = gain ? 255 : 36;
    pixels.data[i * 4 + 1] = gain ? 76 : 160;
    pixels.data[i * 4 + 2] = gain ? 52 : 255;
    pixels.data[i * 4 + 3] = Math.round(210 * Math.pow(strength, 0.75));
  }
  overlayCtx.putImageData(pixels, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
}

function similarityLabel(value) {
  if (value >= 97) return `${value.toFixed(1)}% · Nearly identical`;
  if (value >= 88) return `${value.toFixed(1)}% · Similar`;
  if (value >= 72) return `${value.toFixed(1)}% · Moderately different`;
  return `${value.toFixed(1)}% · Substantially different`;
}

function saveCurrentAsBaseline() {
  if (!automaticMap || !automaticMetrics || !hasRequiredAreas()) return;
  comparisonBaseline = {
    name: imageName,
    imageSource: snapshotStimulus(),
    map: { width: automaticMap.width, height: automaticMap.height, values: Float32Array.from(automaticMap.values) },
    metrics: { ...automaticMetrics },
    primaryPoint: fixations[0] ? { ...fixations[0] } : null,
    areas: aois.map((area) => ({ ...area, attention: measureAoi(area) }))
  };
  saveBaselineBtn.textContent = "Replace baseline";
  comparisonResults.hidden = true;
  winnerPanel.hidden = true;
  comparisonStatus.textContent = `Baseline saved: ${imageName}. Upload and analyze the revised render, then mark Product and Distractor.`;
}

async function updateComparison() {
  if (!comparisonBaseline || !automaticMap || !automaticMetrics) return;
  if (comparisonBaseline.name === imageName && comparisonBaseline.imageSource === stimulus.src) return;
  const candidateSource = snapshotStimulus();
  comparisonStatus.textContent = "Comparing baseline and current design…";
  const [, , similarity] = await Promise.all([
    renderComparisonImage(baselineCanvas, comparisonBaseline.imageSource, comparisonBaseline.map),
    renderComparisonImage(candidateCanvas, candidateSource, automaticMap),
    computeImageSimilarity(comparisonBaseline.imageSource, candidateSource),
    renderAttentionDifference(differenceCanvas, candidateSource, comparisonBaseline.map, automaticMap)
  ]);
  baselineName.textContent = comparisonBaseline.name;
  candidateName.textContent = imageName;
  const beforeShare = Math.round(comparisonBaseline.metrics.topShare * 100);
  const afterShare = Math.round(automaticMetrics.topShare * 100);
  const shareDelta = afterShare - beforeShare;
  focusComparison.textContent = `${comparisonBaseline.metrics.concentration} → ${automaticMetrics.concentration} (${shareDelta >= 0 ? "+" : ""}${shareDelta} pts)`;
  competitionComparison.textContent = `${comparisonBaseline.metrics.competition} → ${automaticMetrics.competition}`;
  hotspotComparison.textContent = `${comparisonBaseline.metrics.primary} → ${automaticMetrics.primary}`;
  similarityComparison.textContent = similarityLabel(similarity);
  comparisonResults.hidden = false;
  winnerPanel.hidden = true;
  comparisonStatus.textContent = hasRequiredAreas()
    ? "Comparison and Product emphasis recommendation ready."
    : "Comparison ready. Mark Product and Distractor on the revised render to calculate a winner.";
  updateWinner();
}

function analyzeAutomatically() {
  if (!stimulus.src || recording) return;
  resetSession(true);
  const automaticStartedAt = performance.now();
  startBtn.disabled = true;
  startBtn.textContent = "Analyzing…";
  setStatus("Analyzing contrast, edges, color, brightness and composition…");

  requestAnimationFrame(() => {
    const maxDimension = 320;
    const scale = Math.min(1, maxDimension / Math.max(stimulus.naturalWidth, stimulus.naturalHeight));
    const width = Math.max(32, Math.round(stimulus.naturalWidth * scale));
    const height = Math.max(32, Math.round(stimulus.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(stimulus, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const luminance = new Float32Array(width * height);
    const saturation = new Float32Array(width * height);

    for (let i = 0; i < luminance.length; i += 1) {
      const r = pixels[i * 4] / 255;
      const g = pixels[i * 4 + 1] / 255;
      const b = pixels[i * 4 + 2] / 255;
      luminance[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      saturation[i] = Math.max(r, g, b) - Math.min(r, g, b);
    }

    const localMean = boxBlur(luminance, width, height, Math.max(3, Math.round(Math.min(width, height) * 0.035)));
    const contrast = new Float32Array(width * height);
    const edges = new Float32Array(width * height);
    const center = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        contrast[i] = Math.abs(luminance[i] - localMean[i]);
        const gx = -luminance[i - width - 1] + luminance[i - width + 1]
          - 2 * luminance[i - 1] + 2 * luminance[i + 1]
          - luminance[i + width - 1] + luminance[i + width + 1];
        const gy = -luminance[i - width - 1] - 2 * luminance[i - width] - luminance[i - width + 1]
          + luminance[i + width - 1] + 2 * luminance[i + width] + luminance[i + width + 1];
        edges[i] = Math.hypot(gx, gy);
        const dx = (x / (width - 1) - 0.5) / 0.55;
        const dy = (y / (height - 1) - 0.5) / 0.55;
        center[i] = Math.exp(-2.1 * (dx * dx + dy * dy));
      }
    }

    const c = normalize(contrast);
    const e = normalize(edges);
    const s = normalize(saturation);
    perceptualMetrics = computePerceptualMetrics(pixels, luminance, saturation, e);
    const raw = new Float32Array(width * height);
    for (let i = 0; i < raw.length; i += 1) raw[i] = 0.34 * c[i] + 0.29 * e[i] + 0.22 * s[i] + 0.15 * center[i];
    automaticMap = { width, height, values: normalize(boxBlur(boxBlur(raw, width, height, 3), width, height, 2)) };
    fixations = automaticHotspots(automaticMap.values, width, height);
    samples = fixations.map((point, index) => ({ x: point.x, y: point.y, t: index * 220 }));
    automaticMetrics = computeAutomaticMetrics(automaticMap.values, fixations);
    sessionStartedAt = automaticStartedAt;
    sessionEndedAt = performance.now();
    sampleMetric.textContent = "Automatic";
    fixationMetric.textContent = String(fixations.length);
    timeMetric.textContent = `${((sessionEndedAt - sessionStartedAt) / 1000).toFixed(2)} s`;
    focusMetric.textContent = automaticMetrics.concentration;
    competitionMetric.textContent = automaticMetrics.competition;
    hotspotMetric.textContent = automaticMetrics.primary;
    automaticSummary.hidden = false;
    renderPerceptualAnalysis();
    updateAoiTable();
    clearBtn.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "Analyze again";
    enableResultControls(true);
    setStatus(`Automatic analysis complete: ${fixations.length} prominent visual regions detected.`);
    setView("heatmap");
    updateComparison();
  });
}

function finishSession() {
  if (!recording) return;
  recording = false;
  sessionEndedAt = performance.now();
  stopRecordingTimers();
  stage.classList.remove("recording");
  recordingBadge.hidden = true;
  pointer = null;
  startBtn.disabled = false;
  startBtn.textContent = "Repeat test";
  stopBtn.disabled = true;
  clearBtn.disabled = false;

  if (!samples.length) {
    setStatus("No points were recorded. Repeat the test while keeping the cursor over the image.");
    return;
  }

  fixations = detectFixations(samples);
  fixationMetric.textContent = String(fixations.length);
  timeMetric.textContent = `${((sessionEndedAt - sessionStartedAt) / 1000).toFixed(1)} s`;
  enableResultControls(true);
  updateAoiTable();
  setStatus(`Session complete: ${samples.length} samples and ${fixations.length} approximate fixations.`);
  setView("heatmap");
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function detectFixations(input) {
  if (!input.length) return [];
  const groups = [];
  let group = [input[0]];

  for (let i = 1; i < input.length; i += 1) {
    const center = group.reduce((acc, point) => ({ x: acc.x + point.x / group.length, y: acc.y + point.y / group.length }), { x: 0, y: 0 });
    if (distance(input[i], center) <= FIXATION_RADIUS) {
      group.push(input[i]);
    } else {
      groups.push(group);
      group = [input[i]];
    }
  }
  groups.push(group);

  return groups
    .map((points) => {
      const first = points[0];
      const last = points[points.length - 1];
      return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
        start: first.t,
        duration: Math.max(SAMPLE_INTERVAL, last.t - first.t + SAMPLE_INTERVAL),
        samples: points.length
      };
    })
    .filter((fixation) => fixation.duration >= MIN_FIXATION_MS);
}

function drawBaseImage() {
  resultCanvas.width = stimulus.naturalWidth;
  resultCanvas.height = stimulus.naturalHeight;
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultCtx.drawImage(stimulus, 0, 0, resultCanvas.width, resultCanvas.height);
}

function heatColor(value) {
  const v = Math.max(0, Math.min(1, value));
  const stops = [
    [0.00, [0, 20, 110]], [0.20, [0, 130, 255]], [0.40, [0, 230, 175]],
    [0.60, [245, 235, 20]], [0.80, [255, 105, 0]], [1.00, [220, 0, 25]]
  ];
  for (let i = 1; i < stops.length; i += 1) {
    if (v <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const t = (v - p0) / (p1 - p0);
      return c0.map((channel, index) => Math.round(channel + (c1[index] - channel) * t));
    }
  }
  return stops.at(-1)[1];
}

function buildHeatmap() {
  const width = resultCanvas.width;
  const height = resultCanvas.height;
  const densityCanvas = document.createElement("canvas");
  densityCanvas.width = width;
  densityCanvas.height = height;
  const densityCtx = densityCanvas.getContext("2d", { willReadFrequently: true });
  if (automaticMap) {
    const mapCanvas = document.createElement("canvas");
    mapCanvas.width = automaticMap.width;
    mapCanvas.height = automaticMap.height;
    const mapCtx = mapCanvas.getContext("2d");
    const image = mapCtx.createImageData(automaticMap.width, automaticMap.height);
    const opacity = Number(opacityRange.value) / 100;
    for (let i = 0; i < automaticMap.values.length; i += 1) {
      const intensity = automaticMap.values[i];
      const [r, g, b] = heatColor(intensity);
      image.data[i * 4] = r;
      image.data[i * 4 + 1] = g;
      image.data[i * 4 + 2] = b;
      image.data[i * 4 + 3] = Math.round(255 * opacity * Math.pow(intensity, 1.25));
    }
    mapCtx.putImageData(image, 0, 0);
    densityCtx.imageSmoothingEnabled = true;
    densityCtx.drawImage(mapCanvas, 0, 0, width, height);
    return densityCanvas;
  }

  const radius = Math.max(30, Math.min(width, height) * 0.085);
  const points = fixations.length ? fixations : samples.map((point) => ({ ...point, duration: SAMPLE_INTERVAL }));
  const maxDuration = Math.max(...points.map((point) => point.duration || SAMPLE_INTERVAL));

  densityCtx.globalCompositeOperation = "lighter";
  points.forEach((point) => {
    const x = point.x * width;
    const y = point.y * height;
    const weight = 0.10 + 0.22 * Math.sqrt((point.duration || SAMPLE_INTERVAL) / maxDuration);
    const gradient = densityCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${weight})`);
    gradient.addColorStop(0.35, `rgba(255,255,255,${weight * 0.65})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    densityCtx.fillStyle = gradient;
    densityCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  });

  const density = densityCtx.getImageData(0, 0, width, height);
  const colored = densityCtx.createImageData(width, height);
  const opacity = Number(opacityRange.value) / 100;

  for (let i = 0; i < density.data.length; i += 4) {
    const intensity = density.data[i + 3] / 255;
    const [r, g, b] = heatColor(intensity);
    colored.data[i] = r;
    colored.data[i + 1] = g;
    colored.data[i + 2] = b;
    colored.data[i + 3] = Math.round(255 * opacity * Math.pow(intensity, 0.7));
  }
  densityCtx.putImageData(colored, 0, 0);
  return densityCanvas;
}

function drawScanpath() {
  const width = resultCanvas.width;
  const height = resultCanvas.height;
  const visible = fixations.slice(0, Number(fixationRange.value));
  if (!visible.length) return;
  const maxDuration = Math.max(...visible.map((fixation) => fixation.duration));

  resultCtx.save();
  resultCtx.lineWidth = Math.max(3, width * 0.004);
  resultCtx.strokeStyle = "rgba(255,255,255,.9)";
  resultCtx.shadowColor = "rgba(0,0,0,.7)";
  resultCtx.shadowBlur = 8;
  resultCtx.beginPath();
  visible.forEach((fixation, index) => {
    const x = fixation.x * width;
    const y = fixation.y * height;
    if (index === 0) resultCtx.moveTo(x, y);
    else resultCtx.lineTo(x, y);
  });
  resultCtx.stroke();

  visible.forEach((fixation, index) => {
    const x = fixation.x * width;
    const y = fixation.y * height;
    const radius = Math.max(18, width * (0.018 + 0.018 * fixation.duration / maxDuration));
    resultCtx.beginPath();
    resultCtx.fillStyle = "rgba(255,91,53,.9)";
    resultCtx.strokeStyle = "white";
    resultCtx.lineWidth = Math.max(2, width * 0.0025);
    resultCtx.arc(x, y, radius, 0, Math.PI * 2);
    resultCtx.fill();
    resultCtx.stroke();
    resultCtx.fillStyle = "white";
    resultCtx.font = `800 ${Math.round(radius)}px system-ui`;
    resultCtx.textAlign = "center";
    resultCtx.textBaseline = "middle";
    resultCtx.fillText(String(index + 1), x, y + 1);
  });
  resultCtx.restore();
}

function renderResult() {
  if (!stimulus.src || !samples.length) return;
  drawBaseImage();
  if (currentView === "heatmap") resultCtx.drawImage(buildHeatmap(), 0, 0);
  if (currentView === "scanpath") drawScanpath();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadPng() {
  if (currentView === "original") setView("heatmap");
  renderResult();
  if (aois.length) resultCtx.drawImage(aoiCanvas, 0, 0);
  resultCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${imageName}-${currentView}.png`);
    renderResult();
  }, "image/png");
}

function sessionData() {
  return {
    schema: "neurodesign-cursor-session-v1",
    image: { name: imageName, width: stimulus.naturalWidth, height: stimulus.naturalHeight },
    methodology: {
      type: automaticMap ? "automatic-bottom-up-saliency" : "cursor-guided-visual-exploration",
      sampleIntervalMs: SAMPLE_INTERVAL,
      fixationRadiusNormalized: FIXATION_RADIUS,
      minimumFixationMs: MIN_FIXATION_MS
    },
    durationMs: Math.round(sessionEndedAt - sessionStartedAt),
    createdAt: new Date().toISOString(),
    samples,
    fixations,
    automaticMetrics,
    perceptualMetrics,
    areasOfInterest: aois.map((aoi) => ({ ...aoi, estimatedAttentionPercent: Number(measureAoi(aoi).toFixed(2)) }))
  };
}

function downloadJson() {
  downloadBlob(new Blob([JSON.stringify(sessionData(), null, 2)], { type: "application/json" }), `${imageName}-sesion.json`);
}

async function importJson(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.schema !== "neurodesign-cursor-session-v1" || !Array.isArray(data.samples)) throw new Error("Incompatible format");
    if (!stimulus.src) {
      setStatus("First upload the image used in the session, then import the JSON again.");
      return;
    }
    samples = data.samples;
    fixations = Array.isArray(data.fixations) && data.fixations.length ? data.fixations : detectFixations(samples);
    aois = Array.isArray(data.areasOfInterest) ? data.areasOfInterest.map(({ type, x, y, w, h, id }) => ({
      type, x, y, w, h, id: id || makeId()
    })) : [];
    sessionStartedAt = 0;
    sessionEndedAt = Number(data.durationMs) || samples.at(-1)?.t || 0;
    sampleMetric.textContent = String(samples.length);
    fixationMetric.textContent = String(fixations.length);
    timeMetric.textContent = `${(sessionEndedAt / 1000).toFixed(1)} s`;
    clearBtn.disabled = false;
    clearAoiBtn.disabled = !aois.length;
    enableResultControls(true);
    updateAoiTable();
    setStatus(`Session imported: ${samples.length} samples and ${fixations.length} fixations.`);
    setView("heatmap");
  } catch (error) {
    setStatus(`The file could not be imported: ${error.message}`);
  } finally {
    jsonInput.value = "";
  }
}

imageInput.addEventListener("change", () => loadImage(imageInput.files[0]));
jsonInput.addEventListener("change", () => importJson(jsonInput.files[0]));
startBtn.addEventListener("click", startSession);
stopBtn.addEventListener("click", finishSession);
clearBtn.addEventListener("click", () => resetSession(true));
downloadPngBtn.addEventListener("click", downloadPng);
downloadJsonBtn.addEventListener("click", downloadJson);
durationSelect.addEventListener("change", () => {
  if (!recording) timerValue.textContent = formatTime(Number(durationSelect.value) * 1000);
});
methodSelect.addEventListener("change", () => {
  durationField.hidden = methodSelect.value !== "cursor";
  timerValue.parentElement.hidden = methodSelect.value !== "cursor";
  resetSession(true);
});
opacityRange.addEventListener("input", () => {
  opacityOutput.textContent = `${opacityRange.value}%`;
  if (currentView === "heatmap") renderResult();
});
fixationRange.addEventListener("input", () => {
  fixationOutput.textContent = fixationRange.value;
  if (currentView === "scanpath") renderResult();
});
viewButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
drawAoiBtn.addEventListener("click", () => toggleAoiDrawing());
saveBaselineBtn.addEventListener("click", saveCurrentAsBaseline);
let titleBeforePrint = null;

function preparePrintReport() {
  updateStudySummary();
  if (titleBeforePrint === null) titleBeforePrint = document.title;
  const project = projectNameInput.value.trim();
  if (project) document.title = `${project} — Neurodesign Study`;
  printProject.textContent = project || "Untitled project";
  printStudent.textContent = studentNameInput.value.trim() || "Student not specified";
  const parsedDate = studyDateInput.value ? new Date(`${studyDateInput.value}T12:00:00`) : null;
  printDate.textContent = parsedDate ? parsedDate.toLocaleDateString() : "Date not specified";
  [worksAnswer, communicatesAnswer, perceivedAnswer].forEach((field) => {
    field.style.height = "auto";
    field.style.height = `${Math.max(72, field.scrollHeight)}px`;
  });
}

function restoreAfterPrint() {
  if (titleBeforePrint !== null) document.title = titleBeforePrint;
  titleBeforePrint = null;
  [worksAnswer, communicatesAnswer, perceivedAnswer].forEach((field) => { field.style.height = ""; });
}

printReportBtn.addEventListener("click", () => {
  preparePrintReport();
  window.print();
});
window.addEventListener("beforeprint", preparePrintReport);
window.addEventListener("afterprint", restoreAfterPrint);
clearAoiBtn.addEventListener("click", () => {
  aois = [];
  aoiPreview = null;
  clearAoiBtn.disabled = true;
  toggleAoiDrawing(false);
  aoiTypeSelect.value = "";
  updateAoiTable();
  renderAois();
});
aoiTypeSelect.addEventListener("change", () => {
  if (!aoiTypeSelect.value || drawAoiBtn.disabled) return;
  toggleAoiDrawing(true);
});
aoiTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-aoi-id]");
  if (!button) return;
  aois = aois.filter((aoi) => aoi.id !== button.dataset.aoiId);
  clearAoiBtn.disabled = !aois.length;
  updateAoiTable();
  renderAois();
});

aoiCanvas.addEventListener("pointerdown", (event) => {
  if (!drawingAoi) return;
  aoiCanvas.setPointerCapture(event.pointerId);
  aoiDragStart = aoiPointer(event);
  aoiPreview = { id: "preview", type: aoiTypeSelect.value, x: aoiDragStart.x, y: aoiDragStart.y, w: 0, h: 0 };
  renderAois();
});
aoiCanvas.addEventListener("pointermove", (event) => {
  if (!drawingAoi || !aoiDragStart) return;
  const point = aoiPointer(event);
  aoiPreview = {
    id: "preview",
    type: aoiTypeSelect.value,
    x: Math.min(aoiDragStart.x, point.x),
    y: Math.min(aoiDragStart.y, point.y),
    w: Math.abs(point.x - aoiDragStart.x),
    h: Math.abs(point.y - aoiDragStart.y)
  };
  renderAois();
});
aoiCanvas.addEventListener("pointerup", (event) => {
  if (!drawingAoi || !aoiDragStart || !aoiPreview) return;
  if (aoiCanvas.hasPointerCapture(event.pointerId)) aoiCanvas.releasePointerCapture(event.pointerId);
  if (aoiPreview.w >= 0.015 && aoiPreview.h >= 0.015) {
    aois.push({ ...aoiPreview, id: makeId() });
    clearAoiBtn.disabled = false;
  }
  aoiDragStart = null;
  aoiPreview = null;
  toggleAoiDrawing(false);
  aoiTypeSelect.value = "";
  updateAoiTable();
  renderAois();
});

stage.addEventListener("pointermove", (event) => {
  updateCursorIndicator(event);
  pointer = recording ? pointerToNormalized(event) : null;
});
stage.addEventListener("pointerleave", () => { pointer = null; });
stage.addEventListener("pointerdown", (event) => {
  if (recording) {
    stage.setPointerCapture(event.pointerId);
    pointer = pointerToNormalized(event);
  }
});
stage.addEventListener("pointerup", (event) => {
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
});

window.addEventListener("beforeunload", () => {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
});

studyDateInput.valueAsDate = new Date();

const reportFields = { projectNameInput, studentNameInput, studyDateInput, worksAnswer, communicatesAnswer, perceivedAnswer };
Object.entries(reportFields).forEach(([key, field]) => {
  const stored = localStorage.getItem(`neurodesign-report-${key}`);
  if (stored) field.value = stored;
  field.addEventListener("input", () => localStorage.setItem(`neurodesign-report-${key}`, field.value));
});
