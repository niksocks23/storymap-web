// состояние карты (позиция и зум)
export const state = {
  scale: 1, tx: 0, ty: 0,
  isDragging: false, moved: false,
  dragStartX: 0, dragStartY: 0, dragTx: 0, dragTy: 0,
};

const pointers = new Map();
let pinchState = null;

export function applyTransform(container, wrapper, markersEl, CONFIG) {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const scaledWidth = CONFIG.mapWidth * state.scale;
  const scaledHeight = CONFIG.mapHeight * state.scale;
  
  const margin = 200; 
  const minTx = margin - scaledWidth; 
  const maxTx = cw - margin;          
  state.tx = Math.max(minTx, Math.min(maxTx, state.tx));

  const minTy = margin - scaledHeight;
  const maxTy = ch - margin;
  state.ty = Math.max(minTy, Math.min(maxTy, state.ty));

  wrapper.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
  markersEl.style.setProperty('--ms', String(1 / state.scale));
  
  const gridSize = 40 * state.scale;
  container.style.backgroundPosition = `${state.tx}px ${state.ty}px`;
  container.style.backgroundSize = `${gridSize}px ${gridSize}px`;
}

export function fitToScreen(container, wrapper, markersEl, CONFIG) {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  state.scale = Math.min(cw / CONFIG.mapWidth, ch / CONFIG.mapHeight);
  state.tx = (cw - CONFIG.mapWidth * state.scale) / 2;
  state.ty = (ch - CONFIG.mapHeight * state.scale) / 2;
  applyTransform(container, wrapper, markersEl, CONFIG);
}

export function zoomAt(factor, cx, cy, container, wrapper, markersEl, CONFIG) {
  const newScale = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, state.scale * factor));
  const k = newScale / state.scale;
  state.tx = cx - (cx - state.tx) * k;
  state.ty = cy - (cy - state.ty) * k;
  state.scale = newScale;
  applyTransform(container, wrapper, markersEl, CONFIG);
}

// --- ПЛАВНЫЙ ПЕРЕЛЕТ ---
export function flyTo(px, py, container, wrapper, markersEl, CONFIG) {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  
  // Выбираем масштаб (если сильно отдалили — приближаем до 0.5)
  const targetScale = Math.max(state.scale, 0.5); 

  // Включаем плавную CSS-анимацию
  wrapper.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';

  // Вычисляем, куда должна сместиться карта
  let targetX = cw / 2;
  let targetY = ch / 2;

  // Если мы на ПК (экран > 600px) и открывается панель справа, 
  // сдвигаем центр влево, чтобы маркер не оказался под панелью
  if (window.innerWidth > 600) {
    targetX -= 190; // 190 — это половина ширины панели (380 / 2)
  }

  state.scale = targetScale;
  state.tx = targetX - px * state.scale;
  state.ty = targetY - py * state.scale;

  applyTransform(container, wrapper, markersEl, CONFIG);

  // Убираем анимацию через 600мс
  setTimeout(() => {
    wrapper.style.transition = '';
  }, 600);
}

export function initMapEvents(container, wrapper, markersEl, CONFIG) {
  container.addEventListener('pointerdown', (e) => {
    // Отменяем плавность, если пользователь схватил карту
    wrapper.style.transition = '';
    
    state.moved = false; 
    if (e.target.closest('.marker')) return; 
    
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.dragTx = state.tx;
      state.dragTy = state.ty;
      container.classList.add('dragging');
      container.setPointerCapture(e.pointerId);
    } else if (pointers.size === 2) {
      state.isDragging = false;
      const [p1, p2] = [...pointers.values()];
      const rect = container.getBoundingClientRect();
      pinchState = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        scale: state.scale,
        midX: (p1.x + p2.x) / 2 - rect.left,
        midY: (p1.y + p2.y) / 2 - rect.top,
        tx: state.tx,
        ty: state.ty,
      };
    }
  });

  container.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && pinchState) {
      const [p1, p2] = [...pointers.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const newScale = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, pinchState.scale * (dist / pinchState.dist)));
      const k = newScale / pinchState.scale;
      const rect = container.getBoundingClientRect();
      const currentMidX = (p1.x + p2.x) / 2 - rect.left;
      const currentMidY = (p1.y + p2.y) / 2 - rect.top;

      state.scale = newScale;
      state.tx = currentMidX - (pinchState.midX - pinchState.tx) * k;
      state.ty = currentMidY - (pinchState.midY - pinchState.ty) * k;
      
      state.moved = true;
      applyTransform(container, wrapper, markersEl, CONFIG);
    } else if (state.isDragging && pointers.size === 1) {
      const dx = e.clientX - state.dragStartX;
      const dy = e.clientY - state.dragStartY;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) state.moved = true;
      
      state.tx = state.dragTx + dx;
      state.ty = state.dragTy + dy;
      applyTransform(container, wrapper, markersEl, CONFIG);
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchState = null;
    
    if (pointers.size === 0) {
      state.isDragging = false;
      container.classList.remove('dragging');
    } else if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      state.isDragging = true;
      state.dragStartX = p.x;
      state.dragStartY = p.y;
      state.dragTx = state.tx;
      state.dragTy = state.ty;
    }
  }
  container.addEventListener('pointerup', endPointer);
  container.addEventListener('pointercancel', endPointer);

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    zoomAt(e.deltaY > 0 ? 0.9 : 1.1, e.clientX - rect.left, e.clientY - rect.top, container, wrapper, markersEl, CONFIG);
  }, { passive: false });
}