uniform sampler2D uField;   // signed distance of the text, set by the core from the element's field: 0.5 at the edge
uniform vec2 uFieldSize;    // texels
uniform float uFieldRange;  // padding texels around the em box, and the distance the byte spans
uniform float depth;        // half thickness, in units of a third of the em half height
uniform float bevel;        // edge rounding

// The text as an extruded 2D distance field with a rounded edge. Unit space: the em (the element's line box) spans the box's short
// side, so the twin sits on the HTML it wraps; the field is the em plus padding, rows top down.
float map(vec3 p) {
  float tu = 2.0 / (uFieldSize.y - 2.0 * uFieldRange);
  vec2 half2 = uFieldSize * tu * 0.5;
  vec2 uv = vec2(p.x, -p.y) / (half2 * 2.0) + 0.5;
  float d2 = (texture(uField, clamp(uv, 0.0, 1.0)).r - 0.5) * 2.0 * uFieldRange * tu - 0.25 * tu; // a quarter texel of bilinear safety
  vec2 q = abs(p.xy) - half2;
  d2 += length(max(q, 0.0));                                   // outside the field rect the lookup clamps; grow by the rect distance
  float r = bevel * 0.08;
  vec2 w = vec2(d2, abs(p.z) - depth * 0.3) + r;
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - r;  // rounded extrusion, a true lower bound
}
void main() { fragColor = sdRender(0.9, 0.3); }
