uniform float amount;

void main() {
  vec2 d = vec2(amount / uResolution.x, 0.0);
  vec4 r = texture(uScene, vUv + d);
  vec4 g = texture(uScene, vUv);
  vec4 b = texture(uScene, vUv - d);
  fragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}
