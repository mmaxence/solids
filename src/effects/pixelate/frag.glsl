uniform float size;

vec4 sdEffect() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  return texture(uScene, uv);
}
