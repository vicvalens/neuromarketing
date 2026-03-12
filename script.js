const wrapper = document.getElementById("wrapper");
const stimulus = document.getElementById("stimulus");
const heatmapContainer = document.getElementById("heatmap");

const startBtn = document.getElementById("startBtn");
const showBtn = document.getElementById("showBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

let tracking = false;
let rawData = [];
let heatmap = null;

function createHeatmap() {
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

function resizeHeatmap() {
  if (!stimulus.clientWidth || !stimulus.clientHeight) return;
  createHeatmap();
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

stimulus.addEventListener("load", resizeHeatmap);
window.addEventListener("resize", resizeHeatmap);

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

  if (!heatmap) {
    createHeatmap();
  } else {
    heatmap.setData({ max: 1, data: [] });
  }

  alert("Registro iniciado");
});

showBtn.addEventListener("click", () => {
  if (!rawData.length) {
    alert("No hay datos registrados.");
    return;
  }

  const aggregated = aggregatePoints(rawData, 20);
  const maxValue = Math.max(...aggregated.map((p) => p.value));

  if (!heatmap) createHeatmap();

  heatmap.setData({
    max: maxValue || 1,
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
  resizeHeatmap();
}