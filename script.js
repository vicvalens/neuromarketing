const stage = document.getElementById("stage");
const stimulus = document.getElementById("stimulus");
const heatmapContainer = document.getElementById("heatmap");

const startBtn = document.getElementById("startBtn");
const showBtn = document.getElementById("showBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

let tracking = false;
let rawData = [];
let heatmap = null;

function syncStageSize() {
  const w = stimulus.clientWidth;
  const h = stimulus.clientHeight;

  if (!w || !h) return;

  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;

  heatmapContainer.style.width = `${w}px`;
  heatmapContainer.style.height = `${h}px`;
}

function createHeatmap() {
  if (typeof h337 === "undefined") {
    console.error("heatmap.js no cargó");
    return;
  }

  heatmapContainer.innerHTML = "";
  heatmapContainer.style.width = stimulus.clientWidth + "px";
  heatmapContainer.style.height = stimulus.clientHeight + "px";

  heatmap = h337.create({
    container: heatmapContainer,
    radius: 40,
    maxOpacity: 0.75,
    minOpacity: 0.1,
    blur: 0.9,
    gradient: {
      0.2: "blue",
      0.4: "cyan",
      0.6: "lime",
      0.8: "yellow",
      1.0: "red"
    }
  });

  heatmap.setData({ max: 1, data: [] });
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

stimulus.addEventListener("load", () => {
  createHeatmap();
});

window.addEventListener("resize", () => {
  if (!stimulus.clientWidth || !stimulus.clientHeight) return;
  createHeatmap();
});

stage.addEventListener("mousemove", (event) => {
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

  alert("Registro iniciado");

  if (!heatmap) {
    createHeatmap();
  } else {
    heatmap.setData({ max: 1, data: [] });
  }
});

showBtn.addEventListener("click", () => {
  if (!rawData.length) {
    alert("No hay datos registrados.");
    return;
  }

  if (typeof h337 === "undefined") {
    alert("La librería heatmap.js no cargó.");
    return;
  }

  const aggregated = aggregatePoints(rawData, 20);
  const maxValue = Math.max(...aggregated.map((p) => p.value), 1);

  if (!heatmap) createHeatmap();
  if (!heatmap) return;

  heatmap.setData({
    max: maxValue,
    data: aggregated
  });
});

clearBtn.addEventListener("click", () => {
  tracking = false;
  rawData = [];

  if (heatmap) {
    heatmap.setData({ max: 1, data: [] });
  }
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
  createHeatmap();
}