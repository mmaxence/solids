uniform float radius;

// Taps on a golden-angle disc (uniform area): 32 from 6 px up, 16 below (grain only shows from about 8 px). Two decorrelated
// Bayer values per pixel rotate the spiral and stratify its radii, so the sparse kernel reads as fine grain instead of rings
// or copies. One cos and sin per pixel; each tap turns the direction by the golden angle with a constant rotation.
// Averaging premultiplied color keeps it valid.
const mat2 GOLD = mat2(-0.7373689, 0.6754903, -0.6754903, -0.7373689);
vec4 sdEffect() {
  if (radius < 0.5) return texture(uScene, vUv);
  vec2 px = radius / uResolution;
  float j = sdBayer(gl_FragCoord.xy) * 6.2831853;
  float k = sdBayer(gl_FragCoord.yx + vec2(1.0, 2.0));
  int n = radius < 6.0 ? 16 : 32;
  float fn = float(n);
  vec2 d = vec2(cos(j), sin(j));
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    if (i >= n) break;
    acc += texture(uScene, vUv + d * sqrt((float(i) + k) / fn) * px);
    d = GOLD * d;
  }
  return acc / fn;
}
