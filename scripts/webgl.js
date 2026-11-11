export function initWebGL(canvas, imageSrc, config) {
  // получаем контекст webgl (alpha: true для прозрачного фона)
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
  let program, timeUniform;

  // вершинный шейдер (позиционирование)
  const vsSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;

  // фрагментный шейдер (тут вся математика цвета и прозрачности)
  const fsSource = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_time;

    uniform float u_freq1;
    uniform float u_freq2;
    uniform float u_speed1;
    uniform float u_speed2;
    uniform float u_waveWidth;
    uniform float u_amplitude;
    uniform float u_cornerRadius;

    void main() {
      vec4 color = texture2D(u_texture, v_texCoord);
      
      // сдвигаем координаты в центр
      vec2 p = v_texCoord - 0.5;
      vec2 b = vec2(0.5, 0.5); 
      
      // математика скругления углов (sdf)
      vec2 q = abs(p) - b + u_cornerRadius;
      float dist = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - u_cornerRadius;
      
      // расстояние от края внутрь
      float edge = -dist;
      
      // генерация шума для волн
      float noise1 = sin(v_texCoord.x * u_freq1 + u_time * u_speed1) * cos(v_texCoord.y * u_freq1 + u_time * u_speed1);
      float noise2 = sin(v_texCoord.y * u_freq2 - u_time * u_speed2) * 0.5;
      float noise = noise1 + noise2;
      
      // плавная прозрачность
      float width = u_waveWidth + noise * u_amplitude; 
      float alpha = smoothstep(0.0, width, edge);
      
      gl_FragColor = vec4(color.rgb, color.a * alpha);
    }
  `;

  // создание шейдера
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  // компиляция и сборка программы
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  // настройка буферов (квадрат на весь экран)
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0,  1.0,  1.0,  1.0, -1.0, -1.0,
    -1.0, -1.0,  1.0,  1.0,  1.0, -1.0,
  ]), gl.STATIC_DRAW);

  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    0.0, 1.0, 1.0, 0.0, 1.0, 1.0,
  ]), gl.STATIC_DRAW);

  // связываем атрибуты
  const a_position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(a_position);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

  const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
  gl.enableVertexAttribArray(a_texCoord);
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 0, 0);

  timeUniform = gl.getUniformLocation(program, 'u_time');

  // передаем настройки из переданного конфига в шейдер
  gl.uniform1f(gl.getUniformLocation(program, 'u_freq1'), config.freq1);
  gl.uniform1f(gl.getUniformLocation(program, 'u_freq2'), config.freq2);
  gl.uniform1f(gl.getUniformLocation(program, 'u_speed1'), config.speed1);
  gl.uniform1f(gl.getUniformLocation(program, 'u_speed2'), config.speed2);
  gl.uniform1f(gl.getUniformLocation(program, 'u_waveWidth'), config.waveWidth);
  gl.uniform1f(gl.getUniformLocation(program, 'u_amplitude'), config.amplitude);
  gl.uniform1f(gl.getUniformLocation(program, 'u_cornerRadius'), config.cornerRadius);

  // загружаем картинку
  const image = new Image();
  image.src = imageSrc;
  image.onload = () => {
    // создаем текстуру
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    // запускаем цикл рендера
    let startTime = Date.now();
    function render() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 0.0); 
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // считаем время для анимации
      const time = (Date.now() - startTime) / 1000.0;
      gl.uniform1f(timeUniform, time);
      
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }
    render();
  };
}