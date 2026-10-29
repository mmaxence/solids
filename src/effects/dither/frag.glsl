uniform float levels;
uniform float scale;

vec4 sdEffect() {
  vec4 c = texture(uScene, vUv);
  if (c.a < 0.004) return vec4(0.0);
  vec3 straight = c.rgb / c.a;
  float t = sdBayer(gl_FragCoord.xy / scale) - 0.5;
  float n = levels - 1.0;
  vec3 q = floor(straight * n + t + 0.5) / n;
  return vec4(clamp(q, 0.0, 1.0) * c.a, c.a);
}
