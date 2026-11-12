import { sourcePresentation } from "./renderer-utils.js";
import { nativeFallback, layoutKey, boundedNumber } from "./renderer-utils.js";
import { createFrameLoop } from "./frame-loop.js";
import { rasterize } from "./text-mask.js";
// Silhouette-driven text materials. No dependencies; original text owns semantics.
const vertex = `attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
// Two-pass chamfer distance transform. Red stores signed edge distance;
// alpha retains the original antialiased glyph mask.
function distanceTexture(ctx, w, h) {
  const image = ctx.getImageData(0, 0, w, h),
    data = image.data,
    n = w * h;
  const inside = new Float32Array(n),
    outside = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const filled = data[i * 4 + 3] > 127;
    inside[i] = filled ? 10000 : 0;
    outside[i] = filled ? 0 : 10000;
  }
  for (const f of [inside, outside]) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let v = f[i];
        if (x) v = Math.min(v, f[i - 1] + 1);
        if (y) v = Math.min(v, f[i - w] + 1);
        if (x && y) v = Math.min(v, f[i - w - 1] + 1.4142);
        if (y && x < w - 1) v = Math.min(v, f[i - w + 1] + 1.4142);
        f[i] = v;
      }
    for (let y = h - 1; y >= 0; y--)
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        let v = f[i];
        if (x < w - 1) v = Math.min(v, f[i + 1] + 1);
        if (y < h - 1) v = Math.min(v, f[i + w] + 1);
        if (x < w - 1 && y < h - 1) v = Math.min(v, f[i + w + 1] + 1.4142);
        if (x && y < h - 1) v = Math.min(v, f[i + w - 1] + 1.4142);
        f[i] = v;
      }
  }
  for (let i = 0; i < n; i++)
    data[i * 4] = Math.round(
      Math.max(0, Math.min(1, 0.5 + (outside[i] - inside[i]) / 64)) * 255,
    );
  const flipped = new Uint8Array(data.length);
  for (let y = 0; y < h; y++)
    flipped.set(data.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4);
  return flipped;
}
export function attachGPU(element, options = {}) {
  const host = options.host ?? element.parentElement,
    canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "material-canvas";
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  const source = sourcePresentation(element);
  host.append(canvas);
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  });
  if (!gl) return nativeFallback(canvas);
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw Error(message);
    }
    return s;
  }
  const uniformNames = [
    "size",
    "pointer",
    "velocity",
    "traces[0]",
    "time",
    "energy",
    "intensity",
    "mode",
    "detail",
    "finishMode",
    "finishAmount",
    "finishScale",
    "color",
    "mask",
    "originalMask",
    "firstPass",
  ];
  const passes = [];
  let vs;
  try {
    vs = shader(gl.VERTEX_SHADER, vertex);
    for (const fragment of options.fragmentSources ?? [
      options.fragmentSource,
    ]) {
      const program = gl.createProgram();
      const pass = { program, fs: null };
      passes.push(pass);
      // Intermediate textures retain straight RGB for subsequent effects. Only
      // the canvas presentation pass uses the compositor's premultiplied format.
      const fragments = options.fragmentSources ?? [options.fragmentSource];
      const presenting = passes.length === fragments.length;
      const source = presenting
        ? fragment.replace(/void\s+main\s*\(/, "void materiaMain(") +
          "\nvoid main(){materiaMain();gl_FragColor.rgb *= gl_FragColor.a;}"
        : fragment;
      pass.fs = shader(gl.FRAGMENT_SHADER, source);
      gl.attachShader(program, vs);
      gl.attachShader(program, pass.fs);
      gl.bindAttribLocation(program, 0, "p");
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(program));
      pass.u = Object.fromEntries(
        uniformNames.map((k) => [k, gl.getUniformLocation(program, k)]),
      );
    }
  } catch (error) {
    for (const pass of passes) {
      gl.deleteProgram(pass.program);
      if (pass.fs) gl.deleteShader(pass.fs);
    }
    if (vs) gl.deleteShader(vs);
    console.warn("Materia: shader unavailable; using native text.", error);
    return nativeFallback(canvas);
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  function makeTexture() {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }
  const texture = makeTexture();
  const targets =
    passes.length > 1
      ? [0, 1].map(() => ({
          texture: makeTexture(),
          framebuffer: gl.createFramebuffer(),
        }))
      : [];
  let layerOptions = options.layerOptions;
  let energy = 0,
    visible = true,
    dead = false,
    lost = false,
    amount = boundedNumber(options.intensity, 0, 1, 0.7),
    point = [0.5, 0.5],
    velocity = [0, 0],
    traces = new Float32Array(24),
    traceIndex = 0,
    flow = false,
    frozen = false,
    modeNumber = options.mode ?? 0,
    detail = 10,
    finishMode = 0,
    finishAmount = 0.7,
    finishScale = 10;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    emptyTraces = new Float32Array(24);
  function render(now, dt) {
    if (dead || lost || !visible || document.hidden) return;
    if (flow && !reduced.matches) {
      point = [
        0.5 + Math.sin(now * 0.00065) * 0.27,
        0.5 + Math.cos(now * 0.001) * 0.16,
      ];
      energy = 1.15;
    } else energy = Math.max(0, energy - dt * 0.4);
    for (let i = 2; i < 24; i += 3)
      traces[i] = Math.max(0, traces[i] - dt * 0.32);
    velocity = velocity.map((v) => v * Math.exp(-dt * 2));
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.activeTexture(gl.TEXTURE0);
    let inputTexture = texture;
    for (let index = 0; index < passes.length; index++) {
      const { program, u } = passes[index];
      const layer = layerOptions?.[index];
      const layerAmount = layer
        ? layer.enabled === false
          ? 0
          : boundedNumber(layer.strength, 0, 1, 0.7)
        : amount;
      const layerScale = layer ? boundedNumber(layer.scale, 1, 24, 10) : detail;
      gl.useProgram(program);
      const target = index < passes.length - 1 ? targets[index % 2] : null;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      gl.uniform1i(u.mask, 0);
      gl.uniform1i(u.originalMask, 1);
      gl.uniform1f(u.firstPass, index === 0 ? 1 : 0);
      gl.uniform2f(u.size, canvas.width, canvas.height);
      gl.uniform2fv(u.pointer, point);
      gl.uniform2fv(u.velocity, velocity);
      gl.uniform3fv(u["traces[0]"], reduced.matches ? emptyTraces : traces);
      gl.uniform1f(u.time, now * 0.001);
      gl.uniform1f(u.energy, reduced.matches ? 0 : energy);
      gl.uniform1f(u.intensity, layerAmount);
      gl.uniform1f(u.mode, modeNumber);
      gl.uniform1f(u.detail, layerScale);
      gl.uniform1f(u.finishMode, finishMode);
      gl.uniform1f(
        u.finishAmount,
        reduced.matches ? 0 : layer ? layerAmount : finishAmount,
      );
      gl.uniform1f(u.finishScale, layer ? layerScale : finishScale);
      gl.uniform3fv(u.color, options.color ?? [0.13, 0.17, 0.14]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (target) inputTexture = target.texture;
    }
    return (
      (energy > 0 || traces.some((v, i) => i % 3 === 2 && v > 0) || flow) &&
      !reduced.matches
    );
  }
  const loop = createFrameLoop(render);
  const wake = () => loop.wake();
  function refresh() {
    if (dead || lost) return;
    const box = host.getBoundingClientRect(),
      dpr = Math.min(
        devicePixelRatio,
        1.5,
        1400 / Math.max(1, box.width),
        1400 / Math.max(1, box.height),
      );
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const raster = rasterize(element, host, dpr),
      ctx = raster.getContext("2d");
    const pixels = distanceTexture(ctx, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    for (const target of targets) {
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        target.texture,
        0,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      canvas.width,
      canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    source.hide();
    wake();
  }
  function move(e) {
    if (frozen) return;
    const b = host.getBoundingClientRect();
    const next = [
      (e.clientX - b.left) / b.width,
      1 - (e.clientY - b.top) / b.height,
    ];
    velocity = next.map((v, i) =>
      Math.max(-0.6, Math.min(0.6, (v - point[i]) * 4)),
    );
    point = next;
    traces.set([...point, 1], traceIndex * 3);
    traceIndex = (traceIndex + 1) % 8;
    energy = 1.2;
    wake();
  }
  function pulse() {
    if (frozen) return;
    point = [0.5, 0.5];
    velocity = [0.18, 0.05];
    energy = 1.5;
    wake();
  }
  const contextLost = () => {
    lost = true;
    loop.block("context", true);
    source.restore();
    canvas.hidden = true;
  };
  canvas.addEventListener("webglcontextlost", contextLost);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerdown", move);
  let measuredLayout = "";
  const resizeRefresh = () => {
    const key = layoutKey(element, host);
    if (key !== measuredLayout) {
      measuredLayout = key;
      refresh();
    }
  };
  const resize = new ResizeObserver(resizeRefresh);
  resize.observe(host);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    loop.block("offscreen", !visible);
  });
  observer.observe(host);
  const visibility = () => {
    loop.block("hidden", document.hidden);
  };
  document.addEventListener("visibilitychange", visibility);
  reduced.addEventListener("change", wake);
  document.fonts.ready.then(refresh);
  refresh();
  return {
    supported: true,
    refresh,
    pulse,
    setLayerOptions(value) {
      layerOptions = value;
      if (frozen) render(performance.now(), 0);
      else wake();
    },
    setFinish(mode, amount, scale) {
      finishMode = boundedNumber(mode, 0, 5, 0);
      finishAmount = boundedNumber(amount, 0, 1, 0.7);
      finishScale = boundedNumber(scale, 1, 24, 10);
      wake();
    },
    setDetail(v) {
      v = boundedNumber(v, 1, 24, detail);
      detail = v;
      pulse();
    },
    setMode(v) {
      modeNumber = v;
      wake();
    },
    setFlow(v) {
      flow = v;
      wake();
    },
    setFrozen(v) {
      if (v && !frozen) render(performance.now(), 0);
      frozen = v;
      loop.block("frozen", v);
    },
    setIntensity(v) {
      v = boundedNumber(v, 0, 1, amount);
      amount = v;
      pulse();
    },
    destroy() {
      dead = true;
      loop.destroy();
      resize.disconnect();
      observer.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerdown", move);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", wake);
      source.restore();
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.remove();
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      for (const target of targets) {
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      }
      for (const pass of passes) {
        gl.deleteProgram(pass.program);
        gl.deleteShader(pass.fs);
      }
      gl.deleteShader(vs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
