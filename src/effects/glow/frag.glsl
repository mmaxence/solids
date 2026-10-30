uniform float threshold;
uniform float radius;
uniform float strength;

vec4 bright(vec2 uv) {
  vec4 c = texture(uScene, uv);
  return c * smoothstep(threshold, threshold + 0.3, sdLuma(c.rgb));
}

vec4 sdEffect() {
  vec4 base = texture(uScene, vUv);
  vec2 px = radius / uResolution;
  // Four rings of 8 taps, each ring rotated by a per-pixel jitter so the rings never show. One cos and sin per ring; the
  // eight taps turn by 45 degrees with a constant rotation.
  float j = sdBayer(gl_FragCoord.xy) * 0.7853982;
  const mat2 TURN = mat2(0.7071068, 0.7071068, -0.7071068, 0.7071068);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int r = 1; r <= 4; r++) {
    float fr = float(r) / 4.0;
    float w = 1.0 - fr * 0.75;
    float a0 = j + float(r) * 0.3;
    vec2 d = vec2(cos(a0), sin(a0));
    for (int i = 0; i < 8; i++) {
      acc += bright(vUv + d * px * fr) * w;
      wsum += w;
      d = TURN * d;
    }
  }
  return base + acc / wsum * strength * 1.6;
}
