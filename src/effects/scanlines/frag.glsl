uniform float density;
uniform float opacity;

void main() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  fragColor = c * (1.0 - line * opacity);
}
