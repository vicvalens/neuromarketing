const wrapper = document.getElementById("wrapper");
const stimulus = document.getElementById("stimulus");
const canvas = document.getElementById("heatmapCanvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const showBtn = document.getElementById("showBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

let tracking = false;
let rawData = [];

function resizeCanvas() {
  const w = stimulus.clientWidth;
  const h = stimulus.clientHeight;

  if (!w || !h) return;

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
}

function getRelativePosition(event) {
  const rect = stimulus.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  return { x, y };
}

function aggregatePoints(data, gridSize = 20) {
  const map = {};

  data.forEach((p) => {
    const gx = Math.round(p.x / gridSize) * gridSize;
    const gy = Math.round(p.y / gridSize) * gridSize;
    const key = `${gx}_${gy}`;

    if (!map[key]) {
      map[key] = { x: gx, y: gy, value: 0 };
    }

    map[key].value += 1;
  });

  return Object.values(map);
}

function getHeatColor(value, max) {
  const ratio = value / max;

  if (ratio < 0.25) return "rgba(0, 0, 255, 0.28)";
  if (ratio < 0.5) return "rgba(0, 255, 255, 0.30)";
  if (ratio < 0.7) return "rgba(0, 255, 0, 0.32)";
  if (ratio < 0.85) return "rgba(255, 255, 0, 0.34)";
  return "rgba(255, 0, 0, 0.38)";
}

function drawHeatmap(points) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!points.length) return;

  const maxValue = Math.max(...points.map(p => p.value), 1);

  points.forEach((p) => {
    const radius = 35;
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);

    const color = getHeatColor(p.value, maxValue);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

stimulus.addEventListener("load", resizeCanvas);
window.addEventListener("resize", resizeCanvas);

wrapper.addEventListener("mousemove", (event) => {
  if (!tracking) return;

  const pos = getRelativePosition(event);
  if (!pos) return;

  rawData.push({
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    t: performance.now()
  });
});

startBtn.addEventListener("click", () => {
  tracking = true;
  rawData = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  alert("Registro iniciado");
});

showBtn.addEventListener("click", () => {
  if (!rawData.length) {
    alert("No hay datos registrados.");
    return;
  }

  const aggregated = aggregatePoints(rawData, 20);
  drawHeatmap(aggregated);
});

clearBtn.addEventListener("click", () => {
  tracking = false;
  rawData = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

downloadBtn.addEventListener("click", () => {
  const data = {
    image: stimulus.getAttribute("src"),
    timestamp: new Date().toISOString(),
    raw_mouse_data: rawData
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mouse_heatmap_data.json";
  a.click();
  URL.revokeObjectURL(url);
});

if (stimulus.complete) {
  resizeCanvas();
}