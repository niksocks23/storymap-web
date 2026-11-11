// генерируем деревья вокруг карты
export function initBackground(wrapper, mapWidth, mapHeight, settings) {
  // создаем слой для деревьев
  const layer = document.createElement('div');
  layer.id = 'trees-layer';
  wrapper.insertBefore(layer, wrapper.firstChild); // ставим позади карты

  const treesData = []; // массив для хранения данных о деревьях

  // ШАГ 1: Генерируем данные для всех деревьев
  for (let i = 0; i < settings.count; i++) {
    let x, y;
    let onMap = true;
    
    // ищем координаты, которые не попадают на саму карту
    while (onMap) {
      x = Math.random() * (mapWidth + settings.padding * 2) - settings.padding;
      y = Math.random() * (mapHeight + settings.padding * 2) - settings.padding;
      
      // проверяем, не попали ли мы на карту
      if (x < 0 || x > mapWidth || y < 0 || y > mapHeight) {
        onMap = false;
      }
    }

    // Выбираем размер и остальные параметры
    const size = Math.random() * (settings.maxSize - settings.minSize) + settings.minSize;
    const opacity = Math.random() * (settings.maxOpacity - settings.minOpacity) + settings.minOpacity;
    const rotate = Math.random() * 30 - 15;
    
    // Сохраняем в массив (добавляем size к y, чтобы сортировать по НИЖНЕМУ краю дерева)
    treesData.push({ x, y, size, opacity, rotate });
  }

  // ШАГ 2: Сортируем деревья по оси Y (сверху вниз)
  // Деревья с меньшим Y (которые выше на экране) будут добавлены первыми и окажутся позади.
  // Деревья с большим Y (ниже на экране) добавятся последними и перекроют верхние.
  treesData.sort((a, b) => (a.y + a.size) - (b.y + b.size));

  // ШАГ 3: Создаем и добавляем элементы в DOM в правильном порядке
  treesData.forEach(t => {
    const tree = document.createElement('img');
    tree.src = 'images/tree.png';
    tree.className = 'bg-tree';
    tree.style.left = `${t.x}px`;
    tree.style.top = `${t.y}px`;
    tree.style.width = `${t.size}px`;
    tree.style.opacity = t.opacity;
    tree.style.transform = `rotate(${t.rotate}deg)`;
    
    layer.appendChild(tree);
  });
}