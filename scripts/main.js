// подключаем модули
import { initWebGL } from './webgl.js';
import { state, initMapEvents, fitToScreen, zoomAt } from './map.js';
import { initBackground } from './background.js';

// настройки волн (шейдера)
const SHADER_CONFIG = {
  freq1: 15.0,        // частота волн 1 (больше = мельче)
  freq2: 25.0,        // частота волн 2
  speed1: 1.5,        // скорость движения 1
  speed2: 2.0,        // скорость движения 2
  waveWidth: 0.07,    // ширина прозрачности
  amplitude: 0.02,    // сила колыхания краев
  cornerRadius: 0.1   // радиус скругления углов (от 0.0 до 0.5)
};

// настройки карты
const CONFIG = {
  mapWidth: 1536,
  mapHeight: 1752,
  padding: 0,
  coordMode: 'manual',      
  bounds: { minX: -3.94, maxX: 3.8, minY: -4.29, maxY: 4.52 },
  imgBase: 'images/markersImages/',       
  qrBase: 'images/markersImages/',           
  minZoom: 0.3,
  maxZoom: 0.9,
};

// цвета для категорий
const CATEGORY_COLORS = {
  'Памятник': '#3b82f6',
  'Архитектура': '#10b981',
  'Искусство': '#a855f7',
  'Здание': '#f59e0b',
};

// НАСТРОЙКИ ДЕРЕВЬЕВ
const BACKGROUND_CONFIG = {
  count: 150,         // сколько всего деревьев
  minSize: 40 *1.9,        // минимальный размер (пиксели)
  maxSize: 70 *1.9,        // максимальный размер (пиксели)
  minOpacity: 0.1,    // минимальная прозрачность
  maxOpacity: 0.4,    // максимальная прозрачность
  padding: 2200       // насколько далеко они могут уйти за края карты
};

// ищем элементы
const container = document.getElementById('map-container');
const wrapper   = document.getElementById('map-wrapper');
const markersEl = document.getElementById('markers');
const infoPanel = document.getElementById('info-panel');
const canvas    = document.getElementById('map-canvas');

// запускаем шейдеры (волны)
// ВОТ ЗДЕСЬ ИСПРАВЛЕНО: добавлен третий аргумент SHADER_CONFIG
initWebGL(canvas, 'images/map.jpeg', SHADER_CONFIG);

// включаем зум и перетаскивание
initMapEvents(container, wrapper, markersEl, CONFIG);

// ЗАПУСКАЕМ ДЕРЕВЬЯ (передаем BACKGROUND_CONFIG четвертым аргументом!)
initBackground(wrapper, CONFIG.mapWidth, CONFIG.mapHeight, BACKGROUND_CONFIG);

// кнопки зума
document.getElementById('zoom-in').onclick  = () => zoomAt(1.3, container.clientWidth / 2, container.clientHeight / 2, container, wrapper, markersEl, CONFIG);
document.getElementById('zoom-out').onclick = () => zoomAt(1 / 1.3, container.clientWidth / 2, container.clientHeight / 2, container, wrapper, markersEl, CONFIG);
document.getElementById('zoom-fit').onclick = () => fitToScreen(container, wrapper, markersEl, CONFIG);

// при ресайзе окна - центрируем
window.addEventListener('resize', () => fitToScreen(container, wrapper, markersEl, CONFIG));

// загружаем точки
async function loadMarkers() {
  try {
    const res = await fetch('markers.json');
    if (!res.ok) throw new Error(res.statusText);
    return (await res.json()).markers;
  } catch (err) {
    console.error('Не удалось загрузить markers.json:', err);
    return [];
  }
}

// вычисляем границы
function getBounds(markers) {
  if (CONFIG.coordMode === 'manual') return CONFIG.bounds;
  const xs = markers.map(m => m.posX);
  const ys = markers.map(m => m.posY);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

// создаем точки на карте
function renderMarkers(markers) {
  const { minX, maxX, minY, maxY } = getBounds(markers);
  const rangeX = (maxX - minX) || 1;
  const rangeY = (maxY - minY) || 1;
  const pad = CONFIG.padding;
  const availW = CONFIG.mapWidth  - pad * 2;
  const availH = CONFIG.mapHeight - pad * 2;

  markers.forEach((m) => {
    const px = pad + ((m.posX - minX) / rangeX) * availW;
    const py = pad + ((maxY - m.posY) / rangeY) * availH;  

    const btn = document.createElement('button');
    btn.className = 'marker';
    btn.dataset.cat = m.category;
    btn.style.left = px + 'px';
    btn.style.top  = py + 'px';
    btn.title = m.name;
    btn.setAttribute('aria-label', m.name);

    const inner = document.createElement('span');
    inner.className = 'marker-inner';
    btn.appendChild(inner);

    // клик по точке
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.moved) return;   
      openInfo(m, btn);
    });

    markersEl.appendChild(btn);
    m._el = btn;
  });

  // строим легенду
  const cats = [...new Set(markers.map(m => m.category))];
  const legend = document.getElementById('legend-items');
  cats.forEach(c => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${CATEGORY_COLORS[c] || '#888'}"></span>${c}`;
    legend.appendChild(item);
  });
}

// активная точка
let activeMarkerEl = null;

// ставим картинку
function setImgSrc(img, src) {
  img.onerror = () => { img.style.opacity = '0.3'; };
  img.onload = () => { img.style.opacity = '1'; };
  img.src = src;
}

// открываем панель
function openInfo(m, el) {
  if (activeMarkerEl) activeMarkerEl.classList.remove('active');
  activeMarkerEl = el;
  el.classList.add('active');

  const imgPath = CONFIG.imgBase + encodeURIComponent(m.img);
  const qrPath = CONFIG.qrBase + encodeURIComponent(m.qr);

  setImgSrc(document.getElementById('info-img'), imgPath);
  document.getElementById('info-img').alt = m.name;
  document.getElementById('info-category').textContent = m.category;
  document.getElementById('info-name').textContent = m.name;
  document.getElementById('info-description').textContent = m.description;
  
  setImgSrc(document.getElementById('info-qr'), qrPath);
  document.getElementById('info-link').href = m.url;

  infoPanel.classList.remove('hidden');
}

// закрываем панель
document.getElementById('close-btn').onclick = () => {
  infoPanel.classList.add('hidden');
  if (activeMarkerEl) activeMarkerEl.classList.remove('active');
  activeMarkerEl = null;
};

// старт
(async function init() {
  const markers = await loadMarkers();
  if (!markers || !markers.length) return;
  renderMarkers(markers);
  fitToScreen(container, wrapper, markersEl, CONFIG);
})();