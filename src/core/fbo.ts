export type FBO = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

export function createFBO(gl: WebGL2RenderingContext, w: number, h: number): FBO {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  const f = { fb, tex, w: 0, h: 0 };
  resizeFBO(gl, f, w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return f;
}

export function resizeFBO(gl: WebGL2RenderingContext, f: FBO, w: number, h: number) {
  w = Math.max(1, w); h = Math.max(1, h);
  if (f.w === w && f.h === h) return;
  gl.bindTexture(gl.TEXTURE_2D, f.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  f.w = w; f.h = h;
}

export function deleteFBO(gl: WebGL2RenderingContext, f: FBO) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
