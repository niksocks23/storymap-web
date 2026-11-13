// подключаем модули
import { initWebGL } from './webgl.js';
import { state, initMapEvents, fitToScreen, zoomAt, flyTo } from './map.js';
import { initBackground } from './background.js';

// --- КОНФИГИ ---
const SHADER_CONFIG = {
  freq1: 15.0, freq2: 25.0, speed1: 1.5, speed2: 2.0,
  waveWidth: 0.07, amplitude: 0.02, cornerRadius: 0.1
};

const CONFIG = {
  mapWidth: 1536, mapHeight: 1752, padding: 0, coordMode: 'manual',      
  bounds: { minX: -3.94, maxX: 3.8, minY: -4.29, maxY: 4.52 },
  imgBase: 'images/markersImages/', qrBase: 'images/markersImages/',           
  minZoom: 0.3, maxZoom: 0.9,
};

const CATEGORY_COLORS = {
  'Памятник': '#3b82f6', 'Архитектура': '#10b981', 'Искусство': '#a855f7', 'Здание': '#f59e0b',
};

const BACKGROUND_CONFIG = {
  count: 150, minSize: 40 * 1.9, maxSize: 70 * 1.9, minOpacity: 0.1, maxOpacity: 0.4, padding: 2200
};
// ---------------

// ищем элементы DOM
const container = document.getElementById('map-container');
const wrapper   = document.getElementById('map-wrapper');
const markersEl = document.getElementById('markers');
const infoPanel = document.getElementById('info-panel');
const canvas    = document.getElementById('map-canvas');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const tooltip   = document.getElementById('tooltip');
const themeBtns = document.querySelectorAll('.theme-btn');

let allMarkers = []; 

// --- 1. ЛОГИКА 3-ПОЗИЦИОННОЙ ТЕМЫ ---
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme = localStorage.getItem('theme') || 'auto';

function applyTheme() {
  let isDark = currentTheme === 'dark' || (currentTheme === 'auto' && mediaQuery.matches);
  
  if (isDark) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }

  // Подсвечиваем активную кнопку
  themeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  });
}

applyTheme(); // Инициализация при старте

// Клик по кнопкам темы
themeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentTheme = btn.dataset.theme;
    localStorage.setItem('theme', currentTheme);
    applyTheme();
  });
});

// Следим за сменой темы в системе (если выбран "Авто")
mediaQuery.addEventListener('change', () => { 
  if (currentTheme === 'auto') applyTheme(); 
});
// -------------------

// Вспомогательная функция для генерации ID из кириллицы (если в JSON нет поля "id")
function getMarkerId(m) {
  if (m.id) return m.id;
  const map = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',' ':'-','(':'',')':'' };
  return m.name.toLowerCase().split('').map(char => map[char] !== undefined ? map[char] : char).join('').replace(/[^a-z0-9-]/g, '');
}

// --- 2. ЗАПУСК КАРТЫ И ШЕЙДЕРОВ ---
initWebGL(canvas, 'images/map.jpeg', SHADER_CONFIG);
initMapEvents(container, wrapper, markersEl, CONFIG);
initBackground(wrapper, CONFIG.mapWidth, CONFIG.mapHeight, BACKGROUND_CONFIG);

// Кнопки зума
document.getElementById('zoom-in').onclick  = () => zoomAt(1.3, container.clientWidth / 2, container.clientHeight / 2, container, wrapper, markersEl, CONFIG);
document.getElementById('zoom-out').onclick = () => zoomAt(1 / 1.3, container.clientWidth / 2, container.clientHeight / 2, container, wrapper, markersEl, CONFIG);
document.getElementById('zoom-fit').onclick = () => fitToScreen(container, wrapper, markersEl, CONFIG);

window.addEventListener('resize', () => fitToScreen(container, wrapper, markersEl, CONFIG));

// --- 3. ЗАГРУЗКА ДАННЫХ ---
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

function getBounds(markers) {
  if (CONFIG.coordMode === 'manual') return CONFIG.bounds;
  const xs = markers.map(m => m.posX);
  const ys = markers.map(m => m.posY);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// --- 4. ОТРИСОВКА МАРКЕРОВ И ТУЛТИПОВ ---
function renderMarkers(markers) {
  allMarkers = markers;
  const { minX, maxX, minY, maxY } = getBounds(markers);
  const rangeX = (maxX - minX) || 1;
  const rangeY = (maxY - minY) || 1;
  const pad = CONFIG.padding;
  const availW = CONFIG.mapWidth - pad * 2;
  const availH = CONFIG.mapHeight - pad * 2;

  markers.forEach((m) => {
    m._id = getMarkerId(m); // Присваиваем ID для Deep Linking
    
    // Вычисляем координаты на карте
    const px = pad + ((m.posX - minX) / rangeX) * availW;
    const py = pad + ((maxY - m.posY) / rangeY) * availH;  
    m._px = px; m._py = py;

    const btn = document.createElement('button');
    btn.className = 'marker';
    btn.dataset.cat = m.category;
    btn.style.left = px + 'px';
    btn.style.top  = py + 'px';
    btn.setAttribute('aria-label', m.name);

    const inner = document.createElement('span');
    inner.className = 'marker-inner';
    btn.appendChild(inner);

    // Кастомный тултип
    btn.addEventListener('mouseenter', () => {
      if (window.innerWidth <= 600) return; // Отключаем на мобилках
      tooltip.textContent = m.name;
      tooltip.classList.add('visible');
      const rect = btn.getBoundingClientRect();
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.top}px`;
    });
    btn.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));

    // Клик по маркеру
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.moved) return;   
      flyTo(m._px, m._py, container, wrapper, markersEl, CONFIG);
      openInfo(m, btn);
    });

    markersEl.appendChild(btn);
    m._el = btn;
  });

  // Легенда
  const cats = [...new Set(markers.map(m => m.category))];
  const legend = document.getElementById('legend-items');
  cats.forEach(c => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-dot" style="background:${CATEGORY_COLORS[c] || '#888'}"></span>${c}`;
    legend.appendChild(item);
  });
}

// --- 5. ЛОГИКА ПОИСКА ---
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  searchResults.innerHTML = '';

  if (!query) {
    searchResults.style.display = 'none';
    return;
  }

  const matches = allMarkers.filter(m => m.name.toLowerCase().includes(query));

  if (matches.length === 0) {
    searchResults.style.display = 'none';
    return;
  }

  searchResults.style.display = 'block';
  matches.forEach(m => {
    const div = document.createElement('div');
    div.className = 'search-item';
    div.textContent = m.name;
    
    div.addEventListener('click', () => {
      searchResults.style.display = 'none';
      searchInput.value = '';
      searchInput.blur();
      flyTo(m._px, m._py, container, wrapper, markersEl, CONFIG);
      openInfo(m, m._el);
    });
    
    searchResults.appendChild(div);
  });
});

// Закрываем поиск при клике мимо
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    searchResults.style.display = 'none';
  }
});

// --- 6. ИНФО-ПАНЕЛЬ И DEEP LINKING ---
let activeMarkerEl = null;

function setImgSrc(img, src) {
  img.onerror = () => { img.style.opacity = '0.3'; };
  img.onload = () => { img.style.opacity = '1'; };
  img.src = src;
}

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

  // DEEP LINKING: записываем ID в URL
  window.history.replaceState(null, null, `#${m._id}`);
}

document.getElementById('close-btn').onclick = () => {
  infoPanel.classList.add('hidden');
  if (activeMarkerEl) activeMarkerEl.classList.remove('active');
  activeMarkerEl = null;

  // DEEP LINKING: очищаем URL от ID при закрытии
  window.history.replaceState(null, null, window.location.pathname + window.location.search);
};

// --- 7. СТАРТ ПРИЛОЖЕНИЯ ---
(async function init() {
  const markers = await loadMarkers();
  if (!markers || !markers.length) return;
  
  renderMarkers(markers);
  fitToScreen(container, wrapper, markersEl, CONFIG);

  // DEEP LINKING: проверяем, есть ли ID в ссылке при открытии страницы
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const targetMarker = allMarkers.find(m => m._id === hash);
    if (targetMarker) {
      // Небольшая пауза, чтобы карта успела отрисоваться
      setTimeout(() => {
        flyTo(targetMarker._px, targetMarker._py, container, wrapper, markersEl, CONFIG);
        openInfo(targetMarker, targetMarker._el);
      }, 100);
    }
  }
})();