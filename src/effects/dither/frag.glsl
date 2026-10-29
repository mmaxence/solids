uniform float levels;
uniform float scale;

void main() {
  vec4 c = texture(uScene, vUv);
  if (c.a < 0.004) { fragColor = vec4(0.0); return; }
  vec3 straight = c.rgb / c.a;
  float t = sdBayer(gl_FragCoord.xy / scale) - 0.5;
  float n = levels - 1.0;
  vec3 q = floor(straight * n + t + 0.5) / n;
  fragColor = vec4(clamp(q, 0.0, 1.0) * c.a, c.a);
}
