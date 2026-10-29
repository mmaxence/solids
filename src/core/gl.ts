import quadVert from './quad.vert.glsl';
import prelude from './prelude.glsl';
import effectPrelude from './effect.glsl';

export type Program = { prog: WebGLProgram; loc: Map<string, WebGLUniformLocation>; };
const cache = new WeakMap<WebGL2RenderingContext, Map<string, Program>>();

export function createGL(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  gl.bindVertexArray(gl.createVertexArray());
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return gl;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed');
  return sh;
}

/** 'object' fragments get the raymarch prelude; 'effect' fragments get the post-pass prelude. */
export function program(gl: WebGL2RenderingContext, frag: string, kind: 'object' | 'effect' = 'object'): Program {
  let m = cache.get(gl);
  if (!m) cache.set(gl, (m = new Map()));
  const key = kind[0] + frag;
  const hit = m.get(key);
  if (hit) return hit;
  const src = (kind === 'object' ? prelude : effectPrelude) + '\n' + frag;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, quadVert));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, src));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
  const loc = new Map<string, WebGLUniformLocation>();
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(prog, i)!; loc.set(info.name, gl.getUniformLocation(prog, info.name)!); }
  const p = { prog, loc };
  m.set(key, p);
  return p;
}

export function clearCache(gl: WebGL2RenderingContext) { cache.delete(gl); }

export type UniformValue = number | number[] | Float32Array;
export function setUniforms(gl: WebGL2RenderingContext, p: Program, values: Record<string, UniformValue>) {
  for (const [name, v] of Object.entries(values)) {
    const l = p.loc.get(name);
    if (l === undefined) continue;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.length === 1) gl.uniform1i(l, v[0]);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    else if (v.length === 9) gl.uniformMatrix3fv(l, false, v);
  }
}

export function drawQuad(gl: WebGL2RenderingContext) { gl.drawArrays(gl.TRIANGLES, 0, 3); }
