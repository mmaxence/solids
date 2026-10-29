uniform float points;
uniform float depth;

// Star outline (after Inigo Quilez): n points, outer radius r, m sets the spike sharpness (2 is a polygon, n the sharpest).
float sdStar(vec2 p, float r, float n, float m) {
  float an = 3.141593 / n, en = 3.141593 / m;
  vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

float map(vec3 p) {
  // Rest pose: turned a little so the bevels catch the light.
  p.xz = mat2(0.94, -0.342, 0.342, 0.94) * p.xz;
  p.yz = mat2(0.985, -0.174, 0.174, 0.985) * p.yz;
  float n = floor(points + 0.5);
  float s = sdStar(p.xy, 0.72, n, 0.4 * n + 0.6);
  vec2 w = vec2(s, abs(p.z) - depth * 0.5);
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  // 45 degree bevel around the outline.
  return max(d, (w.x + w.y + depth * 0.4) * 0.7071);
}

void main() {
  fragColor = sdRender(1.1, 0.35);
}
