uniform float radius;

// 32 taps on a golden-angle disc (uniform area). Two decorrelated Bayer values per pixel rotate the
// spiral and stratify its radii, so the sparse kernel reads as fine grain instead of rings or copies.
// 16 taps showed grain from about 8 px up. Averaging premultiplied color keeps it valid.
vec4 sdEffect() {
  if (radius < 0.5) return texture(uScene, vUv);
  vec2 px = radius / uResolution;
  float j = sdBayer(gl_FragCoord.xy) * 6.2831853;
  float k = sdBayer(gl_FragCoord.yx + vec2(1.0, 2.0));
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    float a = float(i) * 2.3999632 + j;
    acc += texture(uScene, vUv + vec2(cos(a), sin(a)) * sqrt((float(i) + k) / 32.0) * px);
  }
  return acc / 32.0;
}
