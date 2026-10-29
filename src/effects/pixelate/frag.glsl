uniform float size;

void main() {
  vec2 cell = size / uResolution;
  vec2 uv = (floor(vUv / cell) + 0.5) * cell;
  fragColor = texture(uScene, uv);
}
