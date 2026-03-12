// Referencias a elementos
const stage = document.getElementById("stage");
const stimulus = document.getElementById("stimulus");
const heatmapContainer = document.getElementById("heatmap");

const startBtn = document.getElementById("startBtn");
const showBtn = document.getElementById("showBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");

let tracking = false;
let rawData = [];
let heatmapInstance = null;

// Configura y crea la instancia del mapa de calor
function createHeatmap() {
  if (typeof h337 === "undefined") {
    console.error("heatmap.js no cargó");
    return;
  }

  // Limpiar contenido previo
  heatmapContainer.innerHTML = "";
  
  // Sincronizar tamaño del contenedor con la imagen real
  const w = stimulus.clientWidth;
  const h = stimulus.clientHeight;
  heatmapContainer.style.width = w + "px";
  heatmapContainer.style.height = h + "px";

  heatmapInstance = h337.create({
    container: heatmapContainer,
    radius: 40,
    maxOpacity: 0.7,
    minOpacity: 0,
    blur: 0.85
  });
}

// Obtener coordenadas relativas a la imagen
function getRelativePosition(event) {
  const rect = stimulus.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  return { x, y };
}

// Agrupar puntos cercanos para mejorar la visualización
function aggregatePoints(data, gridSize = 10) {
  const map = {};
  data.forEach((p) => {
    const gx = Math.round(p.x / gridSize) * gridSize;
    const gy = Math.round(p.y / gridSize) * gridSize;
    const key = `${gx}_${gy}`;
    if (!map[key]) map[key] = { x: gx, y: gy, value: 0 };
    map[key].value += 1;
  });
  return Object.values(map);
}

// Eventos de ratón
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

// Botones
startBtn.addEventListener("click", () => {
  tracking = true;
  rawData = [];
  if (heatmapInstance) heatmapInstance.setData({ max: 0, data: [] });
  alert("Grabación iniciada. Mueve el mouse sobre la imagen.");
});

showBtn.addEventListener("click", () => {
  if (!rawData.length) {
    alert("No hay datos para mostrar.");
    return;
  }
  
  tracking = false; // Detener seguimiento al mostrar
  createHeatmap(); // Asegurar que el tamaño sea correcto

  const aggregated = aggregatePoints(rawData, 15);
  const maxValue = Math.max(...aggregated.map((p) => p.value));

  heatmapInstance.setData({
    max: maxValue,
    data: aggregated
  });
});

clearBtn.addEventListener("click", () => {
  tracking = false;
  rawData = [];
  if (heatmapInstance) heatmapInstance.setData({ max: 0, data: [] });
  alert("Datos limpiados.");
});

downloadBtn.addEventListener("click", () => {
  const data = {
    image: stimulus.getAttribute("src"),
    timestamp: new Date().toISOString(),
    points: rawData
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tracking_data.json";
  a.click();
});

// Inicialización cuando la imagen carga
stimulus.onload = () => createHeatmap();
window.onresize = () => createHeatmap();