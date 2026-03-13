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

// Ajustes principales
const GRID_SIZE = 10;     // más pequeño = más detalle local
const BASE_RADIUS = 42;   // más grande = más mezcla
const SAMPLE_STEP = 1;    // 1 = usa todos los puntos

function resizeCanvas() {
  const w = stimulus.clientWidth;
  const h = stimulus.clientHeight;

  if (!w || !h) return;

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

function clearHeatmap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function getRelativePosition(event) {
  const rect = stimulus.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  return { x, y };
}

function aggregatePoints(data, gridSize = GRID_SIZE) {
  const map = {};

  for (let i = 0; i < data.length; i += SAMPLE_STEP) {
    const p = data[i];
    const gx = Math.round(p.x / gridSize) * gridSize;
    const gy = Math.round(p.y / gridSize) * gridSize;
    const key = `${gx}_${gy}`;

    if (!map[key]) {
      map[key] = { x: gx, y: gy, value: 0 };
    }

    map[key].value += 1;
  }

  return Object.values(map);
}

function getColorsForRatio(ratio) {
  if (ratio < 0.2) {
    return {
      center: "rgba(0, 80, 255, 0.30)",
      mid: "rgba(0, 80, 255, 0.18)"
    };
  }

  if (ratio < 0.4) {
    return {
      center: "rgba(0, 220, 255, 0.40)",
      mid: "rgba(0, 220, 255, 0.22)"
    };
  }

  if (ratio < 0.6) {
    return {
      center: "rgba(0, 255, 120, 0.48)",
      mid: "rgba(0, 255, 120, 0.26)"
    };
  }

  if (ratio < 0.8) {
    return {
      center: "rgba(255, 240, 0, 0.56)",
      mid: "rgba(255, 240, 0, 0.30)"
    };
  }

  return {
    center: "rgba(255, 60, 0, 0.68)",
    mid: "rgba(255, 60, 0, 0.36)"
  };
}

function drawBlob(x, y, radius, centerColor, midColor) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, centerColor);
  gradient.addColorStop(0.45, midColor);
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeatmap(points) {
  clearHeatmap();

  if (!points.length) return;

  const maxValue = Math.max(...points.map((p) => p.value), 1);

  // Capa base suave para unir mejor las zonas
  points.forEach((p) => {
    const ratio = p.value / maxValue;
    const colors = getColorsForRatio(ratio);

    drawBlob(
      p.x,
      p.y,
      BASE_RADIUS,
      colors.center,
      colors.mid
    );
  });

  // Segunda capa más compacta para reforzar núcleos
  points.forEach((p) => {
    const ratio = p.value / maxValue;
    const colors = getColorsForRatio(Math.min(1, ratio * 1.15));

    drawBlob(
      p.x,
      p.y,
      BASE_RADIUS * 0.55,
      colors.center.replace(/0\.\d+\)$/, "0.75)"),
      colors.mid.replace(/0\.\d+\)$/, "0.42)")
    );
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
  clearHeatmap();
  alert("Registro iniciado");
});

showBtn.addEventListener("click", () => {
  if (!rawData.length) {
    alert("No hay datos registrados.");
    return;
  }

  const aggregated = aggregatePoints(rawData, GRID_SIZE);
  drawHeatmap(aggregated);
});

clearBtn.addEventListener("click", () => {
  tracking = false;
  rawData = [];
  clearHeatmap();
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