uniform float density;
uniform float opacity;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  float line = step(0.5, fract(gl_FragCoord.y / density));
  return c * (1.0 - line * opacity);
}
