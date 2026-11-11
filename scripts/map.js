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

export function initMapEvents(container, wrapper, markersEl, CONFIG) {
  container.addEventListener('pointerdown', (e) => {
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
      // Считаем начальное состояние для пинч-зума
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
      
      // Вычисляем новый масштаб
      const newScale = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, pinchState.scale * (dist / pinchState.dist)));
      const k = newScale / pinchState.scale;
      
      // Вычисляем текущий центр между пальцами (он может двигаться)
      const rect = container.getBoundingClientRect();
      const currentMidX = (p1.x + p2.x) / 2 - rect.left;
      const currentMidY = (p1.y + p2.y) / 2 - rect.top;

      // Применяем зум и смещение
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
