const wrapper = document.getElementById("wrapper");
const stimulus = document.getElementById("stimulus");
const heatmapContainer = document.getElementById("heatmap");

const startBtn = document.getElementById("startBtn");
const showBtn = document.getElementById("showBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

let tracking = false;
let rawData = [];

const heatmap = h337.create({
  container: heatmapContainer,
  radius: 40,
  maxOpacity: 0.7,
  minOpacity: 0.05,
  blur: 0.9
});

function resizeHeatmap() {
  heatmapContainer.style.width = stimulus.clientWidth + "px";
  heatmapContainer.style.height = stimulus.clientHeight + "px";
}

stimulus.addEventListener("load", resizeHeatmap);
window.addEventListener("resize", resizeHeatmap);

function getRelativePosition(event) {
  const rect = wrapper.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  return { x, y };
}

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
  heatmap.setData({ max: 5, data: [] });
  alert("Registro iniciado");
});

showBtn.addEventListener("click", () => {
  if (!rawData.length) {
    alert("No hay datos registrados.");
    return;
  }

  const dataToShow = rawData.map(p => ({
    x: p.x,
    y: p.y,
    value: 1
  }));

  heatmap.setData({
    max: 3,
    data: dataToShow
  });
});

clearBtn.addEventListener("click", () => {
  tracking = false;
  rawData = [];
  heatmap.setData({ max: 5, data: [] });
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