uniform float amount;

vec4 sdEffect() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
