const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const imageInput = $("#imageInput");
const jsonInput = $("#jsonInput");
const stimulus = $("#stimulus");
const stage = $("#stage");
const emptyState = $("#emptyState");
const resultCanvas = $("#resultCanvas");
const resultCtx = resultCanvas.getContext("2d", { willReadFrequently: true });
const cursorIndicator = $("#cursorIndicator");
const recordingBadge = $("#recordingBadge");
const startBtn = $("#startBtn");
const stopBtn = $("#stopBtn");
const clearBtn = $("#clearBtn");
const downloadPngBtn = $("#downloadPngBtn");
const downloadJsonBtn = $("#downloadJsonBtn");
const durationSelect = $("#durationSelect");
const opacityRange = $("#opacityRange");
const fixationRange = $("#fixationRange");
const opacityOutput = $("#opacityOutput");
const fixationOutput = $("#fixationOutput");
const statusText = $("#statusText");
const timerValue = $("#timerValue");
const sampleMetric = $("#sampleMetric");
const fixationMetric = $("#fixationMetric");
const timeMetric = $("#timeMetric");
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
}

function enableResultControls(enabled) {
  viewButtons.forEach((button) => { button.disabled = !enabled; });
  downloadPngBtn.disabled = !enabled;
  downloadJsonBtn.disabled = !enabled;
}

function resetSession(keepImage = true) {
  stopRecordingTimers();
  recording = false;
  samples = [];
  fixations = [];
  pointer = null;
  sessionStartedAt = 0;
  sessionEndedAt = 0;
  stage.classList.remove("recording");
  recordingBadge.hidden = true;
  startBtn.disabled = !keepImage || !stimulus.src;
  startBtn.textContent = "Start test";
  stopBtn.disabled = true;
  clearBtn.disabled = !keepImage || !stimulus.src;
  enableResultControls(false);
  sampleMetric.textContent = "0";
  fixationMetric.textContent = "0";
  timeMetric.textContent = "0.0 s";
  timerValue.textContent = formatTime(Number(durationSelect.value) * 1000);
  timerValue.parentElement.classList.remove("warning");
  setView("original");
  if (keepImage && stimulus.src) setStatus("Image ready. Start the test when the participant is prepared.");
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
  resultCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${imageName}-${currentView}.png`);
  }, "image/png");
}

function sessionData() {
  return {
    schema: "neurodesign-cursor-session-v1",
    image: { name: imageName, width: stimulus.naturalWidth, height: stimulus.naturalHeight },
    methodology: {
      type: "cursor-guided-visual-exploration",
      sampleIntervalMs: SAMPLE_INTERVAL,
      fixationRadiusNormalized: FIXATION_RADIUS,
      minimumFixationMs: MIN_FIXATION_MS
    },
    durationMs: Math.round(sessionEndedAt - sessionStartedAt),
    createdAt: new Date().toISOString(),
    samples,
    fixations
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
    sessionStartedAt = 0;
    sessionEndedAt = Number(data.durationMs) || samples.at(-1)?.t || 0;
    sampleMetric.textContent = String(samples.length);
    fixationMetric.textContent = String(fixations.length);
    timeMetric.textContent = `${(sessionEndedAt / 1000).toFixed(1)} s`;
    clearBtn.disabled = false;
    enableResultControls(true);
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
opacityRange.addEventListener("input", () => {
  opacityOutput.textContent = `${opacityRange.value}%`;
  if (currentView === "heatmap") renderResult();
});
fixationRange.addEventListener("input", () => {
  fixationOutput.textContent = fixationRange.value;
  if (currentView === "scanpath") renderResult();
});
viewButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

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
