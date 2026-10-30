// solids check: the whole test suite, no framework.
import { readFileSync, existsSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { extname, resolve } from 'node:path';

const fails = [];
const fail = (m) => { fails.push(m); console.error('FAIL', m); };
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

function sizes() {
  const budget = { 'dist/core.js': 18 * 1024, 'dist/solids.js': 60 * 1024 };
  for (const [file, max] of Object.entries(budget)) {
    if (!existsSync(file)) { fail(`${file} missing (run npm run build)`); continue; }
    const gz = gzipSync(readFileSync(file)).length;
    console.log(`${file}: ${kb(gz)} gzipped (budget ${kb(max)})`);
    if (gz > max) fail(`${file} over budget: ${kb(gz)} > ${kb(max)}`);
  }
  if (existsSync('dist/sizes.json')) fail('dist/sizes.json is gone: the site gzips the bundles itself');
  // The README quotes the full size; keep it at the build's number.
  const full = existsSync('dist/solids.js') ? Math.round(gzipSync(readFileSync('dist/solids.js')).length / 1024) : 0;
  if (full && !readFileSync('README.md', 'utf8').includes(`about ${full} KB`)) fail(`README.md should say about ${full} KB gzipped`);
}


const UNIFORM_TYPES = new Set(['float']);
export function validateManifest(m, dir) {
  const errs = [];
  for (const k of ['name', 'tag', 'description']) if (typeof m[k] !== 'string' || !m[k]) errs.push(`${dir}: manifest.${k} must be a non-empty string`);
  if (m.tag && !/^sd-[a-z][a-z0-9-]*$/.test(m.tag)) errs.push(`${dir}: tag must match sd-<name>`);
  if (!Array.isArray(m.uniforms)) errs.push(`${dir}: manifest.uniforms must be an array`);
  for (const k of ['tags', 'bleed']) if (k in m) errs.push(`${dir}: manifest.${k} is no longer read; remove it`);
  for (const u of m.uniforms ?? []) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(u.name ?? '')) errs.push(`${dir}: uniform name "${u.name}" must be camelCase`);
    if (!UNIFORM_TYPES.has(u.type)) errs.push(`${dir}: uniform ${u.name} type must be float`);
    if (/^u[A-Z]/.test(u.name ?? '')) errs.push(`${dir}: uniform ${u.name} would shadow a core uniform`);
    if (u.default === undefined) errs.push(`${dir}: uniform ${u.name} needs a default`);
    if (typeof u.label !== 'string') errs.push(`${dir}: uniform ${u.name} needs a label`);
    if (u.type === 'float' && (typeof u.min !== 'number' || typeof u.max !== 'number')) errs.push(`${dir}: float uniform ${u.name} needs min and max`);
  }
  return errs;
}

function manifests() {
  const root = 'src/objects';
  const dirs = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  if (!dirs.length) return fail('no objects found in src/objects');
  for (const d of dirs) {
    const dir = `${root}/${d}`;
    if (!existsSync(`${dir}/manifest.json`)) { fail(`${dir}: missing manifest.json`); continue; }
    if (!existsSync(`${dir}/frag.glsl`)) fail(`${dir}: missing frag.glsl`);
    if (!existsSync(`${dir}/README.md`)) fail(`${dir}: missing README.md`);
    let m;
    try { m = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')); } catch (e) { fail(`${dir}: manifest.json is not valid JSON`); continue; }
    validateManifest(m, dir).forEach(fail);
    if (m.name !== d) fail(`${dir}: manifest.name "${m.name}" must equal folder name`);
    if (existsSync(`${dir}/frag.glsl`)) {
      const frag = readFileSync(`${dir}/frag.glsl`, 'utf8');
      for (const u of m.uniforms ?? []) if (!new RegExp(`uniform\\s+\\w+\\s+${u.name}\\b`).test(frag)) fail(`${dir}: frag.glsl does not declare uniform ${u.name}`);
    }
  }
  const fx = existsSync('src/effects') ? readdirSync('src/effects', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  for (const d of fx) {
    const dir = `src/effects/${d}`;
    if (!existsSync(`${dir}/manifest.json`) || !existsSync(`${dir}/frag.glsl`)) { fail(`${dir}: needs manifest.json and frag.glsl`); continue; }
    const m = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
    if (m.name !== d) fail(`${dir}: manifest.name must equal folder name`);
    if (typeof m.description !== 'string') fail(`${dir}: manifest.description missing`);
    const frag = readFileSync(`${dir}/frag.glsl`, 'utf8');
    for (const u of m.params ?? []) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(u.name ?? '') || u.type !== 'float' || typeof u.min !== 'number' || typeof u.max !== 'number' || typeof u.label !== 'string') fail(`${dir}: param ${u.name} must be a float with name, min, max, label`);
      if (!new RegExp(`uniform\\s+float\\s+${u.name}\\b`).test(frag)) fail(`${dir}: frag.glsl does not declare uniform ${u.name}`);
    }
  }
  // Shades: like effects, plus a README (shown on the shade page) and no param name shared with any object uniform
  // (one program holds an object's uniforms and its shade's, and a redeclaration would fail to compile).
  const objUniforms = new Set(dirs.flatMap((d) => { try { return (JSON.parse(readFileSync(`${root}/${d}/manifest.json`, 'utf8')).uniforms ?? []).map((u) => u.name); } catch { return []; } }));
  const sh = existsSync('src/shades') ? readdirSync('src/shades', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  if (!sh.includes('glass')) fail('src/shades/glass: the glass shade must exist');
  for (const d of sh) {
    const dir = `src/shades/${d}`;
    if (!existsSync(`${dir}/manifest.json`) || !existsSync(`${dir}/frag.glsl`) || !existsSync(`${dir}/README.md`)) { fail(`${dir}: needs manifest.json, frag.glsl and README.md`); continue; }
    const m = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
    if (m.name !== d) fail(`${dir}: manifest.name must equal folder name`);
    if (typeof m.description !== 'string') fail(`${dir}: manifest.description missing`);
    const frag = readFileSync(`${dir}/frag.glsl`, 'utf8');
    if (!/vec4\s+sdShade\s*\(/.test(frag) || !/vec3\s+sdEdge\s*\(/.test(frag)) fail(`${dir}: frag.glsl must define vec4 sdShade(vec3 p, vec3 n, vec3 rd, float rim) and vec3 sdEdge()`);
    for (const u of m.params ?? []) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(u.name ?? '') || u.type !== 'float' || typeof u.min !== 'number' || typeof u.max !== 'number' || typeof u.label !== 'string') fail(`${dir}: param ${u.name} must be a float with name, min, max, label`);
      if (!new RegExp(`uniform\\s+float\\s+${u.name}\\b`).test(frag)) fail(`${dir}: frag.glsl does not declare uniform ${u.name}`);
      if (objUniforms.has(u.name)) fail(`${dir}: param ${u.name} collides with an object uniform of the same name`);
    }
  }
  if (!fails.length) console.log(`manifests ok (${dirs.length} objects, ${fx.length} effects, ${sh.length} shades)`);
}


// ---- headless Chrome: shader compile + pixel smoke ----------------------------------
function chromePath() {
  const c = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const p of c) {
    if (p.startsWith('/')) { if (existsSync(p)) return p; continue; }
    try { execFileSync('which', [p], { stdio: 'ignore' }); return p; } catch {}
  }
  return null;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.css': 'text/css', '.json': 'application/json' };
/** Static server for the repo root; a POST to /__result resolves `result` with the page's JSON. */
function serve(root) {
  let resolveResult;
  const result = new Promise((r) => (resolveResult = r));
  const srv = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__progress') { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { res.end('ok'); if (process.env.SD_TRACE) console.error('progress:', b); }); return; }
    if (req.method === 'POST' && req.url === '/__result') {
      let body = ''; req.on('data', (d) => (body += d)); req.on('end', () => { res.end('ok'); resolveResult(JSON.parse(body)); });
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(resolve(root)) || !existsSync(path)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, port: srv.address().port, result })));
}
/** Open a URL in headless Chrome; the page must POST its JSON result to /__result. */
export function runPage(url, chrome, result, timeoutMs = 30000, size = '1400,900') {
  const profile = (process.env.TMPDIR || '/tmp') + '/solids-chrome-' + process.pid;
  process.once('exit', () => rmSync(profile, { recursive: true, force: true }));
  const args = ['--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run',
    '--disable-crash-reporter', '--no-sandbox', `--user-data-dir=${profile}`, `--window-size=${size}`, url];
  const child = spawn(chrome, args, { stdio: 'ignore' });
  let timer;
  const timeout = new Promise((_, rej) => (timer = setTimeout(() => rej(new Error(`page did not report within ${timeoutMs} ms`)), timeoutMs)));
  return Promise.race([result, timeout]).finally(() => { clearTimeout(timer); child.kill('SIGKILL'); });
}

const CHECK_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>solids check</title>
<style>body{margin:0;background:#0a0a0c;display:flex;flex-wrap:wrap;align-content:flex-start}sd-scene{width:600px;height:400px;display:block}sd-scene.small{width:200px;height:200px}sd-universe{width:600px;height:400px;display:block}</style></head><body>
<script>
window.__errors = [];
const ce = console.error.bind(console);
console.error = (...a) => { window.__errors.push(a.map(String).join(' ')); ce(...a); };
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));
</script>
<script type="module">
import { registry } from '/dist/solids.js';
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const tags = [...registry.objects.values()].map((o) => o.manifest.tag);
const result = { compileErrors: [], consoleErrors: [], tags, cases: {} };
const parseDefault = (o) => { const t = document.createElement(o.localName); o.scene.appendChild(t); const v = [...t.rgb]; t.remove(); return v; };
function read(scene, t = 1) {
  const gl = scene.gl; if (!gl) return null;
  scene.frame(t, 16);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  return buf;
}
function pixels(scene) {
  const buf = read(scene); if (!buf) return -1;
  let n = 0; for (let i = 3; i < buf.length; i += 4) if (buf[i] > 8) n++;
  return n;
}
// Fraction of painted pixels that differ noticeably between two scenes (or two buffers) of the same size.
function differ(a, b) {
  const x = a instanceof Uint8Array ? a : read(a), y = b instanceof Uint8Array ? b : read(b); let n = 0, painted = 0;
  for (let i = 0; i < x.length; i += 4) {
    if (x[i + 3] > 8 || y[i + 3] > 8) painted++;
    if (Math.abs(x[i] - y[i]) > 16 || Math.abs(x[i + 1] - y[i + 1]) > 16 || Math.abs(x[i + 2] - y[i + 2]) > 16 || Math.abs(x[i + 3] - y[i + 3]) > 16) n++;
  }
  return painted ? n / painted : NaN; // nothing painted on either side is not "identical", it is a broken render
}
const free = (...scs) => { for (const sc of scs) { sc.gl?.getExtension('WEBGL_lose_context')?.loseContext(); sc.remove(); } };
const mk = (attrs, objAttrs = {}) => { const sc = document.body.appendChild(document.createElement('sd-scene')); sc.className = 'small'; sc.setAttribute('theme', 'dark'); for (const [k, v] of Object.entries(attrs)) sc.setAttribute(k, v); const o = sc.appendChild(document.createElement(tags[0])); for (const [k, v] of Object.entries(objAttrs)) o.setAttribute(k, v); return sc; };
try {

// Case A: every object once, in one scene.
const all = document.body.appendChild(document.createElement('sd-scene')); all.setAttribute('theme', 'dark');
for (const t of tags) all.appendChild(document.createElement(t));
// Case B: empty scene, and an object with unknown animation/effect names.
const empty = document.body.appendChild(document.createElement('sd-scene')); empty.className = 'small';
const odd = document.body.appendChild(document.createElement('sd-scene')); odd.className = 'small';
const oddObj = document.createElement(tags[0]); oddObj.setAttribute('animation', 'nope'); oddObj.setAttribute('effect', 'nope'); odd.appendChild(oddObj);
// Case C: dynamic add then remove.
const dyn = document.body.appendChild(document.createElement('sd-scene')); dyn.className = 'small';
dyn.appendChild(document.createElement(tags[0]));

await frame(); await frame();
const extra = dyn.appendChild(document.createElement(tags[0]));
await frame();
extra.remove();
await frame(); await frame();
// Browsers cap live WebGL contexts (about 16), so measure early and drop finished scenes.
result.cases.all = { pixels: pixels(all), objects: all.objects.size };
result.cases.empty = { pixels: pixels(empty), objects: empty.objects.size };
result.cases.odd = { pixels: pixels(odd), objects: odd.objects.size };
result.cases.dyn = { pixels: pixels(dyn), objects: dyn.objects.size };
for (const o of all.objects) if (o.broken) result.compileErrors.push(o.manifest.tag);
for (const sc of [all, empty, odd, dyn]) { sc.gl?.getExtension('WEBGL_lose_context')?.loseContext(); sc.remove(); }
// Case S: every object compiles with every shade; glass is the dark default; an unknown shade name draws and warns once.
const shadeNames = [...(registry.shades?.keys() ?? [])];
result.shades = shadeNames; result.programs = 0;
for (const name of shadeNames) {
  const sc = document.body.appendChild(document.createElement('sd-scene')); sc.setAttribute('theme', 'dark'); sc.setAttribute('shading', name);
  for (const t of tags) sc.appendChild(document.createElement(t));
  await frame(); await frame(); sc.frame(1, 16);
  for (const o of sc.objects) { if (o.broken) result.compileErrors.push(o.manifest.tag + '+' + name); else result.programs++; }
  (result.shadePixels ??= {})[name] = pixels(sc);
  sc.gl?.getExtension('WEBGL_lose_context')?.loseContext(); sc.remove();
}
{ const warns = []; const cw = console.warn.bind(console); console.warn = (...a) => { warns.push(a.join(' ')); cw(...a); };
  const g1 = mk({}, { shading: 'glass' }), g0 = mk({}), gx = mk({}, { shading: 'nope' }), gy = mk({}, { shading: 'nope' });
  await frame(); await frame();
  result.cases.shade = { glassEqualsDefault: differ(g1, g0), unknownDraws: pixels(gx), unknownWarned: warns.filter((w) => /nope/.test(w)).length, unknownEqualsDefault: differ(gx, g0) };
  console.warn = cw; for (const sc of [g1, g0, gx, gy]) { sc.gl?.getExtension('WEBGL_lose_context')?.loseContext(); sc.remove(); } }
// Shade behavior: shades differ from each other, params change the image, scene shading is inherited, the object overrides,
// auto is the theme default (glass in dark, the light default in light), and params merge scene under object.
{ const drop = (...scs) => { for (const sc of scs) { sc.gl?.getExtension('WEBGL_lose_context')?.loseContext(); sc.remove(); } };
  const light = (attrs, objAttrs) => { const sc = mk(attrs, objAttrs); sc.setAttribute('theme', 'light'); return sc; };
  const sGlass = mk({}, { shading: 'glass' }), sMatte = mk({}, { shading: 'matte' }), sCel = mk({}, { shading: 'cel' }), sClay = mk({}, { shading: 'clay' }), sMetal = mk({}, { shading: 'metal' });
  await frame(); await frame();
  const names = ['glass', 'matte', 'cel', 'clay', 'metal'], bufs = [sGlass, sMatte, sCel, sClay, sMetal].map((sc) => read(sc));
  let least = 1; for (let i = 0; i < bufs.length; i++) for (let j = i + 1; j < bufs.length; j++) least = Math.min(least, differ(bufs[i], bufs[j]));
  drop(sGlass, sMatte, sCel, sClay, sMetal);
  const b2 = mk({}, { shading: 'cel', 'cel-bands': '2' }), b5 = mk({}, { shading: 'cel', 'cel-bands': '5' });
  const inh = mk({ shading: 'cel' }), exp = mk({}, { shading: 'cel' }), ovr = mk({ shading: 'cel' }, { shading: 'metal' }), met = mk({}, { shading: 'metal' });
  const autoObj = mk({ shading: 'cel' }, { shading: 'auto' }), glassObj = mk({}, { shading: 'glass' });
  const aL = light({}, {}), dL = light({}, { shading: registry.LIGHT_SHADE }), gL = light({}, { shading: 'glass' });
  const pm = mk({ 'cel-bands': '2' }, { shading: 'cel', 'cel-bands': '5' }), pmScene = mk({ shading: 'cel', 'cel-bands': '2' });
  await frame(); await frame();
  result.cases.shade.least = least;
  result.cases.shade.bands = differ(b2, b5);
  result.cases.shade.inherit = differ(inh, exp);
  result.cases.shade.override = { equalsMetal: differ(ovr, met), differsFromCel: differ(ovr, exp) };
  result.cases.shade.autoOnObject = differ(autoObj, glassObj);
  result.cases.shade.autoLight = { equalsDefault: differ(aL, dL), differsFromGlass: differ(aL, gL), name: registry.LIGHT_SHADE };
  result.cases.shade.paramMerge = { objectWins: differ(pm, b5), sceneAlone: differ(pmScene, b2) };
  drop(b2, b5, inh, exp, ovr, met, autoObj, glassObj, aL, dL, gL, pm, pmScene); }
// Review fixes: the key light is fixed to the view (a sphere turned 180 degrees looks the same); removing an object's param lets the
// scene's value through; out-of-range params clamp to the manifest range; cel's ink edge is valid premultiplied color.
{ const drop = (...scs) => { for (const sc of scs) { sc.gl?.getExtension('WEBGL_lose_context')?.loseContext(); sc.remove(); } };
  const lit = mk({}, { shading: 'cel' }), turned = mk({}, { shading: 'cel' });
  const to = turned.firstElementChild, up = to.update.bind(to);
  to.update = (dt) => { up(dt); to.anim.rotation = new Float32Array([-1, 0, 0, 0, 1, 0, 0, 0, -1]); };
  const rm = mk({ 'cel-bands': '2' }, { shading: 'cel', 'cel-bands': '5' }), sc2 = mk({ 'cel-bands': '2' }, { shading: 'cel' });
  const big = mk({}, { shading: 'metal', 'metal-roughness': '1.5' }), one = mk({}, { shading: 'metal', 'metal-roughness': '1' });
  const ink = mk({}, { shading: 'cel' });
  await frame(); await frame();
  rm.firstElementChild.removeAttribute('cel-bands'); await frame(); await frame();
  let over = 0; { const b = read(ink); for (let i = 0; i < b.length; i += 4) if (b[i] > b[i + 3] + 1 || b[i + 1] > b[i + 3] + 1 || b[i + 2] > b[i + 3] + 1) over++; }
  // cel: outline is the parameter that removes the ink line entirely at 0; the old ink name is gone.
  const o0 = mk({}, { shading: 'cel', 'cel-outline': '0' }), o8 = mk({}, { shading: 'cel', 'cel-outline': '0.8' }), oi = mk({}, { shading: 'cel', 'cel-ink': '0' });
  await frame(); await frame();
  result.cases.shade.fixed = { viewLight: differ(lit, turned), paramRemoved: differ(rm, sc2), clamp: { same: differ(big, one), pixels: pixels(big) }, inkOver: over, outline: { off: differ(o0, o8), oldName: differ(oi, o8) } };
  drop(lit, turned, rm, sc2, big, one, ink, o0, o8, oi); }
// Case D: animations move things; reduced motion freezes them.
const an = document.body.appendChild(document.createElement('sd-scene')); an.className = 'small';
const spin = document.createElement(tags[0]); spin.setAttribute('animation', 'spin'); an.appendChild(spin);
await frame(); await frame();
const r1 = [...spin.anim.rotation];
await frame(); await frame();
const r2 = [...spin.anim.rotation];
window.__SD_REDUCED = true;
const pulse = document.createElement(tags[0]); pulse.setAttribute('animation', 'pulse'); an.appendChild(pulse);
await frame(); await frame(); await frame();
result.cases.anim = { spinMoved: r1.some((v, i) => Math.abs(v - r2[i]) > 1e-6), reducedScale: pulse.anim.scale };
window.__SD_REDUCED = false;

// Case F: gravity with two "center" objects: first wins, second orbits, third orbits; nothing is NaN.
const grav = document.body.appendChild(document.createElement('sd-scene')); grav.className = 'small'; grav.setAttribute('interaction', 'gravity hover-lift pointer-follow');
const gObjs = [0, 1, 2].map(() => { const o = grav.appendChild(document.createElement(tags[0])); o.setAttribute('size', '40px'); return o; });
gObjs[0].setAttribute('gravity', 'center'); gObjs[1].setAttribute('gravity', 'center');
for (let i = 0; i < 12; i++) await frame();
const off = (o) => o.anim.offset.map((v) => Math.round(v * 1000) / 1000);
result.cases.gravity = { first: off(gObjs[0]), second: off(gObjs[1]), third: off(gObjs[2]), finite: gObjs.every((o) => o.anim.offset.every(Number.isFinite) && Number.isFinite(o.anim.z)) };

// Case G: a lone object outside any scene draws; a lost-then-restored context draws again without errors.
const lone = document.body.appendChild(document.createElement(tags[tags.length - 1]));
lone.setAttribute('size', '120px');
await frame(); await frame();
const loneScene = lone.shadowRoot?.querySelector('sd-scene') ?? lone.scene;
const lost = mk({});
await frame();
const ext = lost.gl.getExtension('WEBGL_lose_context');
ext.loseContext();
await frame(); await frame();
ext.restoreContext();
await frame(); await frame(); await frame();
result.cases.lone = { pixels: loneScene ? pixels(loneScene) : -1, restoredPixels: pixels(lost), restoredError: lost.gl.getError() };
lone.remove(); free(lost);

// Case H: a lone object re-inserted keeps one inner scene; claimed by a real scene, it drops it.
const lone2 = document.body.appendChild(document.createElement(tags[0]));
await frame();
lone2.remove(); await frame();
document.body.appendChild(lone2); await frame();
const reinsert = lone2.shadowRoot.querySelectorAll('sd-scene').length;
const host = mk({}); host.appendChild(lone2); await frame();
result.cases.lone.reinsert = reinsert;
result.cases.lone.claimed = lone2.shadowRoot.querySelectorAll('sd-scene').length;
// Case I: two overlapping objects look the same before a context loss and after the restore.
const ov = mk({}); ov.style.position = 'relative';
const ovB = ov.appendChild(document.createElement(tags[0])); ovB.style.cssText = 'position:absolute;left:60px;top:40px'; ovB.setAttribute('color', '#ff9bd1');
await frame(); await frame();
const before = read(ov, 1);
const ext2 = ov.gl.getExtension('WEBGL_lose_context');
ext2.loseContext(); await frame(); await frame(); ext2.restoreContext(); await frame(); await frame(); await frame();
result.cases.lone.restoreDiff = differ(before, read(ov, 1));
// Case J: color, state and speed work as properties.
const po = mk({}).firstElementChild;
po.state = 'active'; po.color = '#ff0000'; po.speed = 2;
await frame();
result.cases.props = { stateAttr: po.getAttribute('state'), stateTarget: po.stateTarget, rgb: po.rgb, speed: po.speedValue };
// Case N: any CSS color parses in the scene's color space; an unparseable one keeps the last color.
const rgbOf = (o, c) => { o.setAttribute('color', c); return [...o.rgb]; };
const late = document.createElement(tags[0]); late.setAttribute('color', '#ff3333'); // parsed before its scene is known
result.cases.color = {
  space: po.scene?.colorSpace, p3: rgbOf(po, 'color(display-p3 1 0.2 0.2)'), oklch: rgbOf(po, 'oklch(70% 0.2 30)'),
  red: rgbOf(po, '#ff0000'), kept: rgbOf(po, 'nope'), hex: rgbOf(po, '#ff3333'), wide: rgbOf(po, 'color(display-p3 1 0.2 0.2)'),
  srgb: rgbOf(document.createElement(tags[0]), 'color(display-p3 1 0.2 0.2)'),
};
po.scene.appendChild(late); result.cases.color.attached = [...late.rgb];
free(po.scene);
// Case K: switching or removing the gravity center never snaps.
const stepOf = (objs) => objs.map((o) => [...o.anim.offset]);
const maxStep = (a, b) => Math.max(...a.map((v, i) => Math.hypot(v[0] - b[i][0], v[1] - b[i][1])));
let worst = 0, prev = stepOf(gObjs);
gObjs[0].removeAttribute('gravity'); gObjs[2].setAttribute('gravity', 'center');
for (let i = 0; i < 10; i++) { await frame(); const cur = stepOf(gObjs); worst = Math.max(worst, maxStep(prev, cur)); prev = cur; }
gObjs[2].removeAttribute('gravity'); gObjs[1].removeAttribute('gravity');
for (let i = 0; i < 10; i++) { await frame(); const cur = stepOf(gObjs); worst = Math.max(worst, maxStep(prev, cur)); prev = cur; }
result.cases.gravity.worstStep = worst;
free(grav);
// Case L: yaw stays continuous through an animation change and a speed change.
let yawStep = 0, lastYaw = spin.pose.rotation[1];
spin.setAttribute('animation', 'idle');
for (let i = 0; i < 8; i++) { await frame(); const y = spin.pose.rotation[1]; yawStep = Math.max(yawStep, Math.abs(y - lastYaw)); lastYaw = y; }
spin.setAttribute('animation', 'spin'); for (let i = 0; i < 30; i++) await frame(); lastYaw = spin.pose.rotation[1];
spin.setAttribute('speed', '3');
for (let i = 0; i < 8; i++) { await frame(); const y = spin.pose.rotation[1]; yawStep = Math.max(yawStep, Math.abs(y - lastYaw)); lastYaw = y; }
result.cases.anim.yawStep = yawStep;
// Case M: reduced motion freezes orbits and time-driven shaders.
window.__SD_REDUCED = true;
const rg = mk({ interaction: 'gravity' }); rg.firstElementChild.setAttribute('gravity', 'center'); rg.firstElementChild.setAttribute('size', '40px');
const rgo = rg.appendChild(document.createElement(tags[0])); rgo.setAttribute('size', '40px');
for (let i = 0; i < 6; i++) await frame();
const o1 = [...rgo.anim.offset]; for (let i = 0; i < 4; i++) await frame(); const o2 = [...rgo.anim.offset];
for (const sc of [an, host, ov, rg]) { sc.gl?.getExtension('WEBGL_lose_context')?.loseContext(); sc.remove(); }
const blobTag = tags.find((t) => t === 'sd-blob');
const rb = mk({}, {}); if (blobTag) { rb.firstElementChild.remove(); rb.appendChild(document.createElement(blobTag)); }
await frame(); await frame();
result.cases.reduced = { orbitMoved: Math.hypot(o1[0] - o2[0], o1[1] - o2[1]), blobDiff: differ(read(rb, 1), read(rb, 4)) };
free(rb);
window.__SD_REDUCED = false;

// Case E: effects change the image; per-object effects draw; a hidden scene shown later has no GL error.
const plain = mk({});
const pix = mk({ effect: 'pixelate', 'pixelate-size': '32' });
const objFx = mk({}, { effect: 'pixelate', 'pixelate-size': '32' });
const hidden = mk({}); hidden.style.display = 'none';
const every = mk({ effect: [...registry.effects.keys()].join(' ') });
await frame(); await frame();
hidden.style.display = '';
await frame(); await frame();
result.cases.fx = { delta: differ(plain, pix), objPixels: pixels(objFx), hiddenPixels: pixels(hidden), glError: hidden.gl?.getError(), everyPixels: pixels(every), effects: [...registry.effects.keys()] };
free(plain, pix, objFx, hidden, every);
// Case P: effect mix. 0 copies the scene byte for byte, 2 accentuates; every effect carries a mix param.
const m0 = mk({ effect: 'glow', 'glow-mix': '0' }), none = mk({}), m1 = mk({ effect: 'glow' }), m2 = mk({ effect: 'glow', 'glow-mix': '2' });
await frame(); await frame();
const b0 = read(m0), bn = read(none);
result.cases.mix = { zero: differ(b0, bn), same: b0.length === bn.length && b0.every((v, i) => v === bn[i]), one: differ(m1, none), two: differ(m2, m1),
  missing: [...registry.effects.values()].filter((e) => !e.manifest.params.some((p) => p.name === 'mix')).map((e) => e.manifest.name) };
free(m0, none, m1, m2);

// Case N: repel, magnet, collide, scroll. Frames are driven by hand so the counts are exact.
const run = (sc, n) => { for (let i = 0; i < n; i++) sc.frame(i / 60, 16); };
const place = (sc, x, y) => { const o = document.createElement(tags[0]); o.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px'; o.setAttribute('size', '40px'); sc.appendChild(o); return o; };
const bare = (attrs) => { const sc = mk(attrs); sc.firstElementChild.remove(); return sc; };
const it = result.cases.interact = {};
// One object: collide has nothing to push against.
const c1 = mk({ interaction: 'collide' }); run(c1, 10);
const c1o = c1.firstElementChild.anim.offset;
it.one = { finite: c1o.every(Number.isFinite), max: Math.max(...c1o.map(Math.abs)) };
// Two 40 px objects 10 px apart end at least their size apart.
const c2 = bare({ interaction: 'collide' }); const ca = place(c2, 70, 80), cb = place(c2, 80, 80); run(c2, 40);
const mid = (o) => [o.rect.x + o.rect.width / 2 + o.anim.offset[0], o.rect.y + o.rect.height / 2 + o.anim.offset[1]];
it.apart = Math.hypot(mid(ca)[0] - mid(cb)[0], mid(ca)[1] - mid(cb)[1]); it.width = ca.rect.width;
// repel pushes away from a pointer just right of the object, then springs back; repel-radius narrows it.
const rp = bare({ interaction: 'repel' }); const ro = place(rp, 80, 80);
rp.pointer = { x: 110, y: 100, inside: true }; run(rp, 20);
const rIn = [...ro.anim.offset];
rp.pointer = { x: 0, y: 0, inside: false }; run(rp, 40);
const rBack = Math.hypot(...ro.anim.offset);
rp.setAttribute('repel-radius', '20'); rp.pointer = { x: 110, y: 100, inside: true }; run(rp, 20);
it.repel = { x: rIn[0], mag: Math.hypot(...rIn), back: rBack, narrow: Math.hypot(...ro.anim.offset) };
// magnet pulls toward the pointer, then drifts home.
const mg = bare({ interaction: 'magnet' }); const mo = place(mg, 80, 80);
mg.pointer = { x: 170, y: 100, inside: true }; run(mg, 30);
const mIn = [...mo.anim.offset];
mg.pointer = { x: 0, y: 0, inside: false }; run(mg, 60);
it.magnet = { x: mIn[0], mag: Math.hypot(...mIn), back: Math.hypot(...mo.anim.offset) };
// scroll turns the object as the page scrolls, also under reduced motion; a scene taller than the viewport clamps 0..1 without jumps.
document.body.style.height = '6000px';
window.__SD_REDUCED = true;
const sc1 = mk({ interaction: 'scroll' }); sc1.style.cssText = 'position:absolute;left:0;top:600px';
scrollTo(0, 0); run(sc1, 1); const rot0 = [...sc1.firstElementChild.anim.rotation];
scrollTo(0, 400); run(sc1, 1); const rot1 = [...sc1.firstElementChild.anim.rotation];
window.__SD_REDUCED = false;
it.scroll = { diff: Math.max(...rot0.map((v, i) => Math.abs(v - rot1[i]))) };
const tall = mk({ interaction: 'scroll', 'scroll-turns': '0.25' }); tall.style.cssText = 'position:absolute;left:220px;top:1000px;width:200px;height:2000px';
tall.measure();
const prog = [];
for (let y = 0; y <= 4000; y += 100) {
  scrollTo(0, y); run(tall, 1);
  const m = tall.firstElementChild.anim.rotation;
  prog.push(Math.atan2(m[6], m[0]) / (0.25 * 2 * Math.PI) + 0.5);
}
it.tall = { first: prog[0], last: prog[prog.length - 1], min: Math.min(...prog), max: Math.max(...prog), step: Math.max(...prog.slice(1).map((v, i) => Math.abs(v - prog[i]))) };
scrollTo(0, 0); document.body.style.height = '';
free(c1, c2, rp, mg, sc1, tall);
// Case O: rgb() with spaces parses as red; removing color restores the default; orbit radius follows a moved rest position.
const co = mk({}).firstElementChild;
co.setAttribute('color', 'rgb( 255, 0, 0 )'); await frame();
const unattached = document.createElement(tags[0]); unattached.setAttribute('color', 'rgb( 255, 0, 0 )');
const spacedRed = [...unattached.rgb];
co.removeAttribute('color'); await frame();
const dflt = parseDefault(co);
result.cases.color.spacedRed = spacedRed;
result.cases.color.removedIsDefault = dflt && Math.abs(co.rgb[0] - dflt[0]) < 0.01 && Math.abs(co.rgb[2] - dflt[2]) < 0.01;
const gr = mk({ interaction: 'gravity' }); gr.style.position = 'relative';
const gc = gr.firstElementChild; gc.setAttribute('gravity', 'center'); gc.setAttribute('size', '40px'); gc.style.cssText = 'position:absolute;left:80px;top:80px';
const gs = gr.appendChild(document.createElement(tags[0])); gs.setAttribute('size', '40px'); gs.style.cssText = 'position:absolute;left:140px;top:80px';
for (let i = 0; i < 6; i++) await frame();
gs.style.left = '180px'; gr.measure();
for (let i = 0; i < 60; i++) await frame(); // the ring eases onto the new radius over about 300 ms
result.cases.gravity.resizedRadius = Math.hypot(gs.rect.x + gs.rect.width / 2 + gs.anim.offset[0] - (gc.rect.x + gc.rect.width / 2), gs.rect.y + gs.rect.height / 2 + gs.anim.offset[1] - (gc.rect.y + gc.rect.height / 2));
free(co.scene, gr);
// Case R: orbit rings. Three orbiters at rest distances 60, 100 and 180 px sit on evenly spaced rings (60, 120, 180);
// the inner ring turns 3^1.5 times faster than the outer (Kepler); an orbiter placed 10 px out is pushed to the clearance ring.
const ringScene = (dists) => { const sc = document.body.appendChild(document.createElement('sd-scene')); sc.setAttribute('theme', 'dark'); sc.setAttribute('interaction', 'gravity'); sc.style.cssText = 'position:relative;width:600px;height:400px';
  const c = sc.appendChild(document.createElement(tags[0])); c.setAttribute('gravity', 'center'); c.setAttribute('size', '40px'); c.style.cssText = 'position:absolute;left:280px;top:180px';
  const os = dists.map((d) => { const o = sc.appendChild(document.createElement(tags[0])); o.setAttribute('size', '20px'); o.style.cssText = 'position:absolute;left:' + (290 + d) + 'px;top:190px'; return o; });
  return { sc, c, os }; };
const polar = (c, o) => { const dx = o.rect.x + o.rect.width / 2 + o.anim.offset[0] - (c.rect.x + c.rect.width / 2), dy = o.rect.y + o.rect.height / 2 + o.anim.offset[1] - (c.rect.y + c.rect.height / 2); return [Math.hypot(dx, dy), Math.atan2(dy, dx)]; };
{ const r3 = ringScene([60, 100, 180]), r1 = ringScene([10]);
  await frame();
  for (let i = 0; i < 12; i++) { r3.sc.frame(i / 10, 100); r1.sc.frame(i / 10, 100); } // past the 800 ms join blend
  const a0 = r3.os.map((o) => polar(r3.c, o));
  r3.sc.frame(2, 1000);
  const a1 = r3.os.map((o) => polar(r3.c, o));
  const da = a1.map((p, i) => Math.abs(p[1] - a0[i][1]));
  // Depth: z follows sin(angle) scaled by ring radius over the outer ring, so a pass between rings draws in a stable order.
  const zr = r3.os.map((o, i) => o.anim.z / (Math.sin(a1[i][1]) || 1e-9) * (180 / a1[i][0]));
  // Leaving: the outer orbiter opts out; the others re-spread with an ease, no frame moves more than 12 px.
  let worstLeave = 0, prevL = r3.os.map((o) => [...o.anim.offset]);
  r3.os[2].setAttribute('gravity', 'none');
  for (let i = 0; i < 20; i++) { r3.sc.frame(3 + i / 60, 16); const cur = r3.os.map((o) => [...o.anim.offset]); worstLeave = Math.max(worstLeave, ...cur.map((v, k) => Math.hypot(v[0] - prevL[k][0], v[1] - prevL[k][1]))); prevL = cur; }
  result.cases.rings = { radii: a0.map((p) => p[0]), speedRatio: da[0] / da[2], clamped: polar(r1.c, r1.os[0])[0], zRatio: zr, worstLeave };
  free(r3.sc, r1.sc); }
// Odd roles never make NaN: a second center and an empty gravity value both orbit, with two real orbiters and with none.
{ const rx = ringScene([60, 300]), ry = ringScene([]);
  const x2 = rx.sc.appendChild(document.createElement(tags[0])); x2.setAttribute('gravity', 'center'); x2.setAttribute('size', '20px'); x2.style.cssText = 'position:absolute;left:200px;top:120px';
  const y1 = ry.sc.appendChild(document.createElement(tags[0])); y1.setAttribute('gravity', ''); y1.setAttribute('size', '20px'); y1.style.cssText = 'position:absolute;left:200px;top:120px';
  const y2 = ry.sc.appendChild(document.createElement(tags[0])); y2.setAttribute('gravity', 'center'); y2.setAttribute('size', '20px'); y2.style.cssText = 'position:absolute;left:400px;top:120px';
  await frame();
  for (let i = 0; i < 12; i++) { rx.sc.frame(i / 10, 100); ry.sc.frame(i / 10, 100); }
  const fin = (o) => o.anim.offset.every(Number.isFinite) && Number.isFinite(o.anim.z) && Math.hypot(...o.anim.offset) > 0.01;
  result.cases.rings.oddRoles = { extraCenter: fin(x2), empty: fin(y1), extraCenterAlone: fin(y2) };
  free(rx.sc, ry.sc); }
// Case P: frame metrics. After ten frames frameTime and fps are positive; reading gpuTime opts in to the timer and never throws.
const pf = mk({}); pf.style.cssText = 'position:fixed;left:0;top:0';
const gpu0 = pf.gpuTime;
for (let i = 0; i < 10; i++) await frame();
result.cases.perf = { frameTime: pf.frameTime, fps: pf.fps, gpu0, gpu: pf.gpuTime, glError: pf.gl?.getError() };
free(pf);
// Case U: universe. Seeded 3D bodies, live depth and focus, camera spin, drag and pointer tilt, unique motion, collisions, 3D orbits, pasted markup, odd inputs.
const uni = (attrs) => { const u = document.createElement('sd-universe'); u.setAttribute('theme', 'dark'); for (const [k, v] of Object.entries(attrs)) u.setAttribute(k, v); return document.body.appendChild(u); };
const sig = (u) => [...u.children].map((c) => c.localName + ' ' + c.dataset.pos + ' ' + c.getAttribute('size')).join('|');
const radii = (u) => [...u.children].map((c) => (c.blurPx >= 0.5 ? c.blurPx : 0));
const still = (u) => { for (const c of u.children) c.setAttribute('animation', ''); for (let i = 0; i < 6; i++) u.frame(i / 10, 100); };
const offs = (u) => [...u.children].map((c) => [...c.anim.offset]);
const sameOffs = (a, b) => a.every((o, i) => Math.abs(o[0] - b[i][0]) < 0.01 && Math.abs(o[1] - b[i][1]) < 0.01);
const ptr = (el, type, x, y, extra = {}) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x, clientY: r.top + y, pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, ...extra })); };
const ua = uni({ count: '12', seed: '3', camera: '' }), ub = uni({ count: '12', seed: '3', camera: '' }), uc = uni({ count: '12', seed: '4', camera: '' });
await frame();
const uv = result.cases.universe = { count: ua.children.length, objects: ua.objects.size, same: sig(ua) === sig(ub), other: sig(ua) !== sig(uc), hasPos: [...ua.children].every((c) => /^-?[0-9.]+ -?[0-9.]+ -?[0-9.]+$/.test(c.dataset.pos || '')) };
const kids0 = [...ua.children], pos0 = sig(ua); ua.frame(0, 16); const d0 = radii(ua);
ua.setAttribute('depth', '1'); ua.frame(0, 16); const d1 = radii(ua);
ua.setAttribute('focus', '0.6'); ua.frame(0, 16); const d2 = radii(ua);
ua.setAttribute('depth', '0'); ua.frame(0, 16); uv.depthZero = radii(ua);
uv.kept = [...ua.children].every((c, i) => c === kids0[i]) && sig(ua) === pos0;
uv.depthMoved = d1.some((v, i) => v !== d0[i]) && d2.some((v, i) => v !== d1[i]) && d0.some((v) => v > 0);
{ const zs = [...ua.children].map((c) => Number(c.dataset.pos.split(' ')[2])); const near = ua.children[zs.indexOf(Math.max(...zs))], far = ua.children[zs.indexOf(Math.min(...zs))];
  uv.scale = { near: near.anim.scale, far: far.anim.scale }; }
// Unique motion: no two bodies share an offset or a rotation.
for (let i = 0; i < 10; i++) ua.frame(i / 10, 100);
{ const o = offs(ua), rot = [...ua.children].map((c) => [...c.anim.rotation]); let dupO = 0, dupR = 0;
  for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) { if (Math.hypot(o[i][0] - o[j][0], o[i][1] - o[j][1]) < 0.5) dupO++; if (rot[i].every((v, k) => Math.abs(v - rot[j][k]) < 0.01)) dupR++; }
  uv.unique = { dupOffsets: dupO, dupRotations: dupR }; }
free(ua, ub, uc);
// Camera: spin turns yaw; a fixed camera with no drift holds still; drag and pointer tilt move the view only when their tokens are on.
const us = uni({ count: '6', seed: '2', camera: 'spin' }), uf = uni({ count: '6', seed: '2', camera: '', drift: '0' });
await frame(); still(us); still(uf);
const yaw0 = us.yaw, p0 = uf.bodies.map((b) => [...b.p]), of0 = offs(uf);
for (let i = 0; i < 5; i++) { us.frame(1 + i / 10, 100); uf.frame(1 + i / 10, 100); }
uv.spin = { turned: Math.abs(us.yaw - yaw0) > 0.01, held: uf.yaw === 0 && uf.bodies.every((b, i) => b.p.every((v, k) => v === p0[i][k])) && sameOffs(offs(uf), of0) };
free(us, uf);
const ud = uni({ count: '6', seed: '2', camera: 'drag', drift: '0' }), un0 = uni({ count: '6', seed: '2', camera: '', drift: '0' }), up = uni({ count: '6', seed: '2', camera: 'pointer', drift: '0' });
await frame(); still(ud); still(un0); still(up);
for (const u of [ud, un0]) { ptr(u, 'pointerdown', 100, 100); ptr(u, 'pointermove', 140, 110); ptr(u, 'pointermove', 180, 120); ptr(u, 'pointerup', 180, 120); u.frame(2, 16); }
uv.drag = { turned: Math.abs(ud.yaw) > 0.1, held: un0.yaw === 0 };
const tilt0 = offs(up); ptr(up, 'pointermove', 580, 200); for (let i = 0; i < 8; i++) up.frame(2 + i / 10, 100);
const tilt1 = offs(up); ptr(un0, 'pointermove', 580, 200); const n0 = offs(un0); for (let i = 0; i < 8; i++) un0.frame(2 + i / 10, 100);
uv.tilt = { moved: !sameOffs(tilt0, tilt1), held: sameOffs(n0, offs(un0)) };
free(ud, un0, up);
// Collide: two overlapping pasted bodies separate to at least the sum of their radii (80 px / 640 each); without collide they stay put.
const pasteU = (attrs, inner) => { const d = document.body.appendChild(document.createElement('div')); d.innerHTML = '<sd-universe theme="dark" ' + attrs + '>' + inner + '</sd-universe>'; return d.firstElementChild; };
const two = '<sd-orb data-pos="0 0 0" size="80px"></sd-orb><sd-orb data-pos="0.05 0 0" size="80px"></sd-orb>';
const cc = pasteU('collide camera="" drift="0"', two), cn = pasteU('camera="" drift="0"', two);
await frame();
const dist = (u) => Math.hypot(...u.bodies[0].p.map((v, i) => v - u.bodies[1].p[i]));
for (let i = 0; i < 30; i++) { cc.frame(i / 10, 50); cn.frame(i / 10, 50); }
uv.collide = { apart: dist(cc), together: dist(cn) };
{ const ps = [cc.parentNode, cn.parentNode]; free(cc, cn); ps.forEach((d) => d.remove()); }
// Gravity: a v4 attribute, now ignored. Same universe with or without it, no center child, no orbit or pinned fields on bodies.
const ug = uni({ count: '12', seed: '3', gravity: '', camera: '', drift: '0' }), ug0 = uni({ count: '12', seed: '3', camera: '', drift: '0' }), u0 = uni({ count: '0' }), uk = uni({ count: '8', shapes: 'sd-orb sd-nope ring' }), un = uni({ shapes: 'sd-nope' });
await frame();
{ for (let i = 0; i < 3; i++) { ug.frame(i / 10, 100); ug0.frame(i / 10, 100); }
  uv.gravity = { same: sig(ug) === sig(ug0) && sameOffs(offs(ug), offs(ug0)), centers: [...ug.children].filter((c) => c.getAttribute('gravity') === 'center').length,
    fields: ug.bodies.filter((b) => 'orbit' in b || 'pinned' in b).length, interaction: ug.interactionNames.includes('gravity') }; }
uv.zero = u0.children.length; uv.known = [...uk.children].map((c) => c.localName); uv.none = un.children.length;
free(ug, ug0, u0, uk, un);
// Reduced motion: spin and drift hold still.
window.__SD_REDUCED = true;
const ur = uni({ count: '8', seed: '5', camera: 'spin' });
await frame(); const rmp = ur.bodies.map((b) => [...b.p]); for (let i = 0; i < 5; i++) ur.frame(i / 10, 100);
uv.reduced = { yaw: ur.yaw, held: ur.bodies.every((b, i) => b.p.every((v, k) => v === rmp[i][k])) };
window.__SD_REDUCED = false; free(ur);
// Review fixes: collisions must not pump energy; a held release has no inertia; other pointers are ignored
// during a drag; pinch zoom stays available; drift makes every body wobble; the pointer tilt moves front shapes toward the pointer.
const uke = uni({ count: '36', seed: '5', collide: '', camera: '', drift: '0.5' });
await frame();
const ke = (u) => u.bodies.reduce((t, b) => t + b.r * b.r * b.r * (b.v[0] ** 2 + b.v[1] ** 2 + b.v[2] ** 2), 0);
const ke0 = ke(uke); for (let i = 0; i < 1200; i++) uke.step(100); uv.energy = { ratio: ke(uke) / ke0 }; // the sim alone: drawing 1200 frames would take minutes under software GL
free(uke);
const uh = uni({ count: '6', seed: '2', camera: 'drag', drift: '0' });
await frame(); still(uh);
ptr(uh, 'pointerdown', 100, 100); ptr(uh, 'pointermove', 160, 110); await new Promise((r) => setTimeout(r, 150)); ptr(uh, 'pointerup', 160, 110);
const yawUp = uh.yaw; for (let i = 0; i < 5; i++) uh.frame(3 + i / 10, 100);
uv.heldRelease = { drift: Math.abs(uh.yaw - yawUp) };
ptr(uh, 'pointerdown', 100, 100); const yawDown = uh.yaw; ptr(uh, 'pointermove', 300, 100, { pointerId: 2, isPrimary: false }); uv.otherPointer = { moved: Math.abs(uh.yaw - yawDown) }; ptr(uh, 'pointerup', 100, 100);
uv.touch = getComputedStyle(uh).touchAction;
free(uh);
const uw = uni({ count: '12', seed: '3', camera: '', drift: '0.5' }), uw0 = uni({ count: '12', seed: '3', camera: '', drift: '0' });
await frame(); still(uw); still(uw0);
{ let wob = Infinity; for (let i = 0; i < 20; i++) { uw.frame(1 + i / 10, 100); uw0.frame(1 + i / 10, 100); }
  uw.bodies.forEach((b, k) => { wob = Math.min(wob, Math.hypot(b.el.anim.offset[0] - uw0.bodies[k].el.anim.offset[0], b.el.anim.offset[1] - uw0.bodies[k].el.anim.offset[1])); });
  uv.wobble = { least: wob }; }
free(uw, uw0);
const ut = pasteU('camera="pointer" drift="0"', '<sd-orb data-pos="0 0 0.8" size="60px"></sd-orb>');
await frame(); ut.frame(0, 16);
ptr(ut, 'pointermove', 580, 200); for (let i = 0; i < 8; i++) ut.frame(1 + i / 10, 100); const right = [...ut.firstElementChild.anim.offset];
ptr(ut, 'pointermove', 300, 390); for (let i = 0; i < 8; i++) ut.frame(2 + i / 10, 100); const down = [...ut.firstElementChild.anim.offset];
uv.tiltDir = { right: right[0], down: down[1] };
{ const d = ut.parentNode; free(ut); d.remove(); }
// Pasted markup (what Copy code gives) keeps its child, attaches it and scales a near body up.
const pu = pasteU('count="5" camera=""', '<sd-orb data-pos="0 0 0.8" size="60px"></sd-orb>');
await frame(); pu.frame(0, 16);
uv.pasted = { children: pu.children.length, attached: pu.objects.size, scale: pu.firstElementChild.anim.scale };
{ const d = pu.parentNode; free(pu); d.remove(); }
const ubig = uni({ count: '120', seed: '7' });
await frame(); await frame();
uv.big = { children: ubig.children.length, pixels: pixels(ubig), stray: [...ubig.children].filter((c) => c.scene !== ubig || c.shadowRoot.querySelector('sd-scene')).length };
free(ubig);
// The defocus effect blurs; at radius 0 it is a copy.
const dp = mk({}), db = mk({ effect: 'defocus', 'defocus-radius': '12' }), dz = mk({ effect: 'defocus', 'defocus-radius': '0' });
await frame(); await frame();
uv.defocus = { blur: differ(db, dp), zero: differ(dz, dp) };
free(dp, db, dz);
// Case V: the blit must not flatten glass highlights (rgb above alpha survives); the effect buffer pool keeps
// every size in use and drops sizes no longer drawn; a universe with no author height still draws.
const hv = mk({}, { state: 'active' });
await frame(); await frame();
const hb = read(hv); let bright = 0;
for (let i = 0; i < hb.length; i += 4) if (Math.max(hb[i], hb[i + 1], hb[i + 2]) > hb[i + 3] + 2) bright++;
result.cases.look = { bright };
const pv = mk({}); pv.firstElementChild.remove(); pv.style.cssText = 'position:relative;width:200px;height:200px';
for (let i = 0; i < 40; i++) { const o = pv.appendChild(document.createElement(tags[0])); o.setAttribute('size', (20 + i) + 'px'); o.setAttribute('effect', 'defocus'); o.setAttribute('defocus-radius', '4'); o.style.cssText = 'position:absolute;left:10px;top:10px'; }
await frame(); await frame(); await frame();
const poolFull = pv.fbos?.pool.size;
for (const o of [...pv.children]) o.remove();
pv.frame(0, 16); pv.frame(0, 16); const poolKept = pv.fbos?.pool.size;
for (let i = 0; i < 70; i++) pv.frame(i / 10, 16);
result.cases.pool = { full: poolFull, kept: poolKept, empty: pv.fbos?.pool.size };
free(hv, pv);
const udef = document.body.appendChild(document.createElement('sd-universe')); udef.setAttribute('count', '8'); udef.setAttribute('theme', 'dark'); udef.style.cssText = 'height:auto;width:400px;display:block';
await frame(); await frame();
result.cases.universe.defaultHeight = udef.getBoundingClientRect().height;
result.cases.universe.defaultPixels = pixels(udef);
free(udef);
// Case W: the quad follows the object's scale (a glow at scale 2 paints beyond 1.5x the rect) and the phase attribute offsets the animation clock.
const qs = mk({}, { effect: 'glow', size: '60px' }); qs.style.cssText = 'width:200px;height:200px';
const qo = qs.firstElementChild; const qu = qo.update.bind(qo); qo.update = (dt) => { qu(dt); qo.anim.scale = 2; };
await frame(); await frame();
{ const buf = read(qs), pr = qs.pixelRatio, bw = qs.gl.drawingBufferWidth, bh = qs.gl.drawingBufferHeight, r = qo.rect;
  const cx = (r.x + r.width / 2) * pr, cy = bh - (r.y + r.height / 2) * pr, half = r.width * 0.75 * pr; let outside = 0;
  for (let i = 0; i < buf.length; i += 4) { if (buf[i + 3] <= 8) continue; const x = (i / 4) % bw, y = Math.floor(i / 4 / bw); if (Math.abs(x - cx) > half || Math.abs(y - cy) > half) outside++; }
  result.cases.quad = { outside }; }
free(qs);
const ph = mk({}, { animation: 'spin' }); const ph2 = ph.appendChild(document.createElement(tags[0])); ph2.setAttribute('animation', 'spin'); ph2.setAttribute('phase', '2');
await frame(); await frame();
result.cases.phase = { differ: [...ph.firstElementChild.anim.rotation].some((v, i) => Math.abs(v - ph2.anim.rotation[i]) > 0.1) };
free(ph);
// Case Y: v7 hardening. Params clamp and stay finite; a zero-size body is harmless; reduced motion rests; contexts are released
// on removal and flagged on loss; a failing effect logs once; the clock pauses; odd state keys; frame-rate-free springs;
// late universe children get bodies; blur never leaks; author CSS does not move a universe child; tilt clamps;
// gravity toggles ease; orbiters are pinned for collide; hover-lift follows scale; nested scenes; lone theme; reflection walk.
const Y = result.cases.hard = {};
{ const pz = mk({ effect: 'pixelate' }); pz.setAttribute('pixelate-size', '0');
  const po2 = mk({}).firstElementChild; po2.setAttribute('glow', '-5'); po2.setAttribute('speed', '1e999'); po2.setAttribute('state', 'constructor');
  const sizeMin = registry.effects.get('pixelate').manifest.params.find((q) => q.name === 'size').min;
  Y.clamp = { effect: pz.effectParams.pixelate?.size, effectMin: sizeMin, uniform: po2.uniforms.glow, speed: po2.speedValue, state: po2.stateTarget };
  free(pz, po2.scene); }
{ const g = ringScene([60]); g.sc.setAttribute('gravity-strength', '100'); g.os[0].setAttribute('gravity', 'fall');
  await frame(); for (let i = 0; i < 300; i++) g.sc.frame(i / 60, 16);
  Y.fall = { dist: polar(g.c, g.os[0])[0] }; free(g.sc); }
{ const z = pasteU('collide camera="" drift="0"', '<sd-orb data-pos="0 0 0" size="0px"></sd-orb><sd-orb data-pos="0.02 0 0" size="80px"></sd-orb>');
  await frame(); for (let i = 0; i < 10; i++) z.frame(i / 10, 50);
  Y.zeroSize = z.bodies.every((b) => b.p.every(Number.isFinite)); const zp = z.parentNode; free(z); zp.remove(); }
{ window.__SD_REDUCED = true; const rs = mk({}, { animation: 'spin', phase: '2' }); await frame(); await frame();
  Y.rest = rs.firstElementChild.pose?.rotation[1]; window.__SD_REDUCED = false; free(rs); }
{ const gone = mk({}); await frame(); const gl2 = gone.gl; gone.remove(); await frame(); await frame();
  Y.released = gl2.isContextLost();
  const lost2 = mk({}); await frame(); const ex2 = lost2.gl.getExtension('WEBGL_lose_context'); ex2.loseContext(); await frame(); await frame();
  Y.flagOnLoss = 'fallback' in lost2.dataset; ex2.restoreContext(); await frame(); await frame(); await frame();
  Y.flagCleared = !('fallback' in lost2.dataset); free(lost2); }
{ registry.effects.set('bad', { manifest: { name: 'bad', description: 'x', params: [] }, frag: 'vec4 sdEffect() { return nope; }' });
  const before = window.__errors.length; const be = mk({ effect: 'bad' }); await frame(); for (let i = 0; i < 10; i++) be.frame(i / 10, 16);
  Y.badEffect = { errors: window.__errors.slice(before).filter((e) => /"bad"/.test(e)).length, pixels: pixels(be) };
  window.__errors.length = before; registry.effects.delete('bad'); free(be); }
{ const pc = mk({}); await frame(); await frame(); await frame(); const c0 = pc.clock; pc.setAttribute('paused', '');
  await new Promise((r) => setTimeout(r, 300)); pc.removeAttribute('paused'); await frame(); await frame();
  Y.pausedClock = pc.clock - c0; free(pc); }
{ const sp = (dt, n) => { const sc = mk({ interaction: 'repel' }); sc.style.cssText = 'width:200px;height:200px'; const o = sc.firstElementChild; o.style.cssText = 'position:absolute;left:80px;top:80px'; sc.measure(); sc.pointer = { x: 120, y: 100, inside: true }; for (let i = 0; i < n; i++) sc.frame(i * dt / 1000, dt); const v = [...o.anim.offset]; free(sc); return v; };
  await frame(); const a16 = sp(16, 6), a8 = sp(8, 12); Y.spring = { a16: Math.hypot(...a16), a8: Math.hypot(...a8) }; }
{ const ul = uni({ count: '4', seed: '2', camera: '', drift: '0' }); await frame(); ul.frame(0, 16);
  const late = ul.appendChild(document.createElement('sd-orb')); late.setAttribute('size', '60px'); await frame(); ul.frame(0.1, 16);
  Y.lateBody = { projected: Math.abs(late.anim.scale - 1) > 1e-6 || Math.hypot(...late.anim.offset) > 0.5 };
  // Blur lives on the object, not in its effect chain, and does not follow a child into another scene.
  const ub = uni({ count: '12', seed: '3', camera: '', drift: '0', depth: '1' }); await frame(); ub.frame(0, 16);
  const blurred = [...ub.children].find((c) => c.blurPx > 0.5);
  Y.blur = { field: !!blurred, chain: blurred ? blurred.effectNames.includes('defocus') : null };
  if (blurred) { const home = mk({}); const twin = mk({}); twin.firstElementChild.remove(); const ref = twin.appendChild(document.createElement(blurred.localName)); ref.setAttribute('color', blurred.getAttribute('color')); ref.setAttribute('size', '80px'); home.firstElementChild.remove(); blurred.removeAttribute('data-pos'); blurred.setAttribute('size', '80px'); blurred.removeAttribute('animation'); blurred.removeAttribute('phase'); ref.removeAttribute('animation'); home.appendChild(blurred); document.body.append(home, twin); await frame(); await frame();
    for (let i = 0; i < 8; i++) { home.frame(i / 10, 100); twin.frame(i / 10, 100); } // past the animation cross-fade
    Y.blur.leak = differ(home, twin); free(home, twin); }
  free(ul, ub); }
{ const a = pasteU('camera="" drift="0"', '<sd-orb data-pos="0.3 0 0" size="60px"></sd-orb>'), b = pasteU('camera="" drift="0"', '<sd-orb data-pos="0.3 0 0" size="60px" style="left:10px;top:10px"></sd-orb>');
  await frame(); a.frame(0, 16); b.frame(0, 16);
  const ctr = (u) => { const o = u.firstElementChild; return [o.rect.x + o.rect.width / 2 + o.anim.offset[0], o.rect.y + o.rect.height / 2 + o.anim.offset[1]]; };
  const ca = ctr(a), cb = ctr(b); Y.authorCss = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]); const pa = [a.parentNode, b.parentNode]; free(a, b); pa.forEach((d) => d.remove()); }
{ const ut = uni({ count: '2', seed: '2', camera: 'drag pointer', drift: '0' }); await frame();
  ptr(ut, 'pointerdown', 100, 100); ptr(ut, 'pointermove', 1800, 1200); for (let i = 0; i < 20; i++) ut.frame(i / 10, 100);
  Y.tiltClamp = Math.max(Math.abs(ut.tilt[0]), Math.abs(ut.tilt[1])); ptr(ut, 'pointerup', 1800, 1200); free(ut); }
{ const g = ringScene([80, 140]); await frame(); for (let i = 0; i < 12; i++) g.sc.frame(i / 10, 100);
  let worst = 0, prev = g.os.map((o) => [...o.anim.offset]); const stepAll = () => { const cur = g.os.map((o) => [...o.anim.offset]); worst = Math.max(worst, ...cur.map((v, k) => Math.hypot(v[0] - prev[k][0], v[1] - prev[k][1]))); prev = cur; };
  g.sc.setAttribute('interaction', ''); for (let i = 0; i < 25; i++) g.sc.frame(2 + i / 60, 16); // off: the offsets stop at once (documented)
  prev = g.os.map((o) => [...o.anim.offset]);
  g.sc.setAttribute('interaction', 'gravity'); for (let i = 0; i < 25; i++) { g.sc.frame(3 + i / 60, 16); stepAll(); } // on again: eases back out
  Y.toggleWorst = worst; free(g.sc); }
{ const g = ringScene([100]); g.sc.setAttribute('interaction', 'gravity collide'); const blocker = g.sc.appendChild(document.createElement(tags[0])); blocker.setAttribute('gravity', 'none'); blocker.setAttribute('size', '40px');
  await frame(); for (let i = 0; i < 12; i++) g.sc.frame(i / 10, 100);
  // park the blocker on the orbiter's current spot: its offset should move, the orbiter's should not
  const orbiter = g.os[0]; const spot = [orbiter.rect.x + orbiter.rect.width / 2 + orbiter.anim.offset[0], orbiter.rect.y + orbiter.rect.height / 2 + orbiter.anim.offset[1]];
  blocker.style.cssText = 'position:absolute;left:' + (spot[0] - 20) + 'px;top:' + (spot[1] - 20) + 'px'; g.sc.measure();
  const ring1 = polar(g.c, orbiter)[0]; for (let i = 0; i < 12; i++) g.sc.frame(2 + i / 10, 100);
  Y.pinned = { orbiterRadius: polar(g.c, orbiter)[0], ring: ring1, blockerMoved: Math.hypot(...blocker.anim.offset) }; free(g.sc); }
{ const hs = mk({ interaction: 'hover-lift' }); hs.style.cssText = 'width:200px;height:200px'; const ho = hs.firstElementChild; ho.setAttribute('size', '100px'); ho.style.cssText = 'position:absolute;left:50px;top:50px';
  const hu = ho.update.bind(ho); ho.update = (dt) => { hu(dt); ho.anim.scale = 0.5; }; hs.measure();
  hs.pointer = { x: 100 + 40, y: 100, inside: true }; await frame(); for (let i = 0; i < 20; i++) hs.frame(i / 10, 100);
  Y.hoverScale = ho.anim.scale; free(hs); }
{ const wrap = document.body.appendChild(document.createElement('div')); wrap.innerHTML = '<sd-scene class="small"><sd-scene class="small"><' + tags[0] + '></' + tags[0] + '></sd-scene></sd-scene>'; const outer = wrap.firstElementChild, inner = outer.firstElementChild;
  await frame(); Y.nested = { outer: outer.objects.size, inner: inner.objects.size }; free(inner, outer); wrap.remove(); }
{ const lt = document.body.appendChild(document.createElement(tags[0])); lt.setAttribute('theme', 'light'); await frame();
  const ls = lt.shadowRoot?.querySelector('sd-scene'); const light = ls?.themeValue; lt.setAttribute('theme', 'dark'); const dark = ls?.themeValue;
  Y.loneTheme = light === 1 && dark === 0 ? 1 : [light, dark]; lt.remove(); }
{ const bad = []; for (const t of tags) { const e = document.createElement(t); for (const a of e.constructor.observedAttributes) { const k = a.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); if (Object.hasOwn(e, k) || k in HTMLElement.prototype) bad.push(t + '.' + k); } }
  Y.reflect = bad; }
// Case Z: performance changes that must not change pixels. The march far limit and the bounding-sphere cull are undone through a
// shaderSource wrapper and every object must render byte for byte the same; a scene with no effect keeps no buffers and matches the
// buffer path; an offscreen scene compiles nothing; regenerating 120 bodies measures once; collide at 120 bodies stays under budget.
// Case AA: every object uniform changes the image between its min and its max; a faller settles at its gap; layer names are unique.
{ const U = result.cases.uniforms = {};
  for (const t of tags) { const m = registry.objects.get(t.slice(3)).manifest; for (const u of m.uniforms) {
    const lo = mk({}, {}), hi = mk({}, {}); for (const sc of [lo, hi]) { sc.style.cssText = 'width:120px;height:120px'; sc.firstElementChild.remove(); sc.appendChild(document.createElement(t)); }
    lo.firstElementChild.setAttribute(u.name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), String(u.min)); hi.firstElementChild.setAttribute(u.name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), String(u.max));
    await frame(); U[t + '.' + u.name] = differ(lo, hi); free(lo, hi); } } }
{ const g = ringScene([150]); g.os[0].setAttribute('gravity', 'fall'); await frame(); for (let i = 0; i < 40; i++) g.sc.frame(i / 10, 100);
  result.cases.fall = { dist: polar(g.c, g.os[0])[0], expected: 24 + (40 + 20) / 4 }; free(g.sc); }
{ const names = ['effects', 'shades', 'interactions', 'animations'].flatMap((k) => [...registry[k].keys()]); result.dupNames = names.filter((x, i) => names.indexOf(x) !== i); }
const Z = result.cases.perf2 = {};
const mark = (l) => fetch('/__progress', { method: 'POST', body: l }).catch(() => {});
mark('Z start');
{ const dump = (sc) => { const b = read(sc); return b; };
  const mkAll = () => { const sc = document.body.appendChild(document.createElement('sd-scene')); sc.setAttribute('theme', 'dark'); for (const t of tags) { const o = sc.appendChild(document.createElement(t)); o.setAttribute('state', 'active'); o.setAttribute('size', '96px'); } return sc; };
  const a = mkAll(); await frame(); await frame(); const bufA = dump(a);
  const orig = WebGL2RenderingContext.prototype.shaderSource; let patched = 0;
  WebGL2RenderingContext.prototype.shaderSource = function (sh, src) { const n = src.replace('if (t > 4.6) break;', 'if (t > 7.0) break;').replace('if (sdMisses(ro, rd)) return vec4(0.0); // cull', ''); if (n !== src) patched++; return orig.call(this, sh, n); };
  const b = mkAll(); await frame(); await frame(); const bufB = dump(b);
  WebGL2RenderingContext.prototype.shaderSource = orig;
  let diff = 0; for (let i = 0; i < bufA.length; i++) if (bufA[i] !== bufB[i]) diff++;
  Z.march = { patched, bytesDiffer: diff, pixels: pixels(a) }; free(a, b); mark('Z march done'); }
{ const plain = mk({}), buffered = mk({ effect: 'grain', 'grain-mix': '0' }); await frame(); await frame();
  const x = read(plain), y = read(buffered); let diff = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff++;
  Z.noFx = { buffers: !!plain.fbos?.scene, bytesDiffer: diff, pixels: pixels(plain) }; free(plain, buffered); mark('Z nofx done'); }
{ let links = 0; const lp = WebGL2RenderingContext.prototype.linkProgram; WebGL2RenderingContext.prototype.linkProgram = function (p) { links++; return lp.call(this, p); };
  const far = document.createElement('sd-scene'); far.setAttribute('theme', 'dark'); far.style.cssText = 'position:absolute;top:300vh;left:0;width:200px;height:200px'; far.appendChild(document.createElement(tags[0])); document.body.appendChild(far);
  for (let i = 0; i < 10; i++) await frame();
  Z.offscreen = { fps: far.fps, links }; WebGL2RenderingContext.prototype.linkProgram = lp; free(far); mark('Z offscreen done'); }
{ const um = uni({ count: '0', camera: '', drift: '0' }); let measures = 0; const m0 = um.measure.bind(um); um.measure = () => { measures++; m0(); };
  um.setAttribute('count', '120'); mark('Z regen'); um.frame(0, 16); Z.measures = measures; um.remove(); mark('Z measures done'); } // frame() by hand: 120 bodies in software GL are slow
{ const uc = uni({ count: '120', seed: '7', collide: '', camera: '', drift: '0.5' }); uc.step(16);
  const t0 = performance.now(); for (let i = 0; i < 60; i++) uc.step(16); Z.collideMs = (performance.now() - t0) / 60; uc.remove(); mark('Z collide done'); }
} catch (e) { window.__errors.push('check page threw: ' + (e && e.stack || e)); }
result.consoleErrors = window.__errors;
await fetch('/__result', { method: 'POST', body: JSON.stringify(result) });
</script></body></html>`;

async function smoke() {
  const chrome = chromePath();
  if (!chrome) { console.warn('warn: chrome not found, skipping shader/smoke checks'); return; }
  writeFileSync('scripts/.check-page.html', CHECK_PAGE);
  const { srv, port, result } = await serve('.');
  try {
    const r = await runPage(`http://127.0.0.1:${port}/scripts/.check-page.html`, chrome, result, 240000);
    for (const k of ['all', 'empty', 'odd', 'dyn', 'anim', 'fx', 'gravity', 'lone', 'props', 'reduced', 'color', 'interact', 'mix', 'perf', 'universe', 'look', 'pool', 'rings', 'shade', 'hard', 'perf2', 'uniforms']) r.cases[k] ??= {};
    const objCount = readdirSync('src/objects', { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    if (r.tags.length !== objCount) fail(`registered ${r.tags.length} objects, expected ${objCount}`);
    if (r.compileErrors.length) fail(`shader compile failed: ${r.compileErrors.join(', ')}`); else console.log(`shaders ok (${r.programs} programs, ${r.tags.length} objects x ${r.shades?.length ?? 0} shades)`);
    if (!(r.shades?.length >= 1) || !(r.programs === r.tags.length * r.shades.length)) fail(`shade programs: ${r.programs} compiled for ${r.tags.length} objects x ${r.shades?.length ?? 0} shades`);
    { const sh = r.cases.shade ?? {}, pc = (v) => (v * 100).toFixed(2) + '%';
      if (!(sh.least > 0.02)) fail(`shades: two of glass, matte, cel, clay, metal look alike (least difference ${pc(sh.least ?? 0)})`);
      if (!(sh.bands > 0.02)) fail(`shades: cel-bands 2 vs 5 differ by ${pc(sh.bands ?? 0)}`);
      if (!(sh.inherit < 1e-6)) fail(`shades: scene shading="cel" not inherited (${pc(sh.inherit ?? 1)} differs)`);
      if (!(sh.override?.equalsMetal < 1e-6) || !(sh.override?.differsFromCel > 0.02)) fail(`shades: object shading should override the scene: ${JSON.stringify(sh.override)}`);
      if (!(sh.autoOnObject < 1e-6)) fail(`shades: shading="auto" on an object inside a cel scene should be the theme default (glass), differs ${pc(sh.autoOnObject ?? 1)}`);
      if (!(sh.autoLight?.equalsDefault < 1e-6) || !(sh.autoLight?.differsFromGlass > 0.02)) fail(`shades: auto in the light theme should be ${sh.autoLight?.name}: ${JSON.stringify(sh.autoLight)}`);
      if (!(sh.paramMerge?.objectWins < 1e-6) || !(sh.paramMerge?.sceneAlone < 1e-6)) fail(`shades: params should merge scene under object: ${JSON.stringify(sh.paramMerge)}`);
      const fx = sh.fixed ?? {};
      if (!(fx.viewLight < 0.01)) fail(`shades: the key light should stay fixed to the view: a sphere turned 180 degrees differs by ${pc(fx.viewLight ?? 1)}`);
      if (!(fx.paramRemoved < 1e-6)) fail(`shades: removing an object's cel-bands should let the scene's value through, differs ${pc(fx.paramRemoved ?? 1)}`);
      if (!(fx.clamp?.same < 1e-6) || !(fx.clamp?.pixels > 100)) fail(`shades: metal-roughness="1.5" should clamp to 1: ${JSON.stringify(fx.clamp)}`);
      if (!(fx.outline?.off > 0.02) || !(fx.outline?.oldName < 1e-6)) fail(`shades: cel-outline="0" should remove the ink line (differs ${pc(fx.outline?.off ?? 0)} from 0.8) and cel-ink should be gone (${pc(fx.outline?.oldName ?? 1)})`);
      if (fx.inkOver !== 0) fail(`shades: cel ink edge has ${fx.inkOver} pixels with rgb above alpha (invalid premultiplied color)`); }
    { const sh = r.cases.shade ?? {}; if (!(sh.glassEqualsDefault < 1e-6) || !(sh.unknownDraws > 100) || sh.unknownWarned !== 1 || !(sh.unknownEqualsDefault < 1e-6)) fail(`shades: glass vs default ${sh.glassEqualsDefault}, unknown name drew ${sh.unknownDraws} px and warned ${sh.unknownWarned} times (expected 1), unknown vs default ${sh.unknownEqualsDefault}`); }
    if (r.consoleErrors.length) fail(`console errors: ${r.consoleErrors.join(' | ').slice(0, 1200)}`);
    if (!(r.cases.all.pixels > 1000)) fail(`smoke: scene drew ${r.cases.all.pixels} pixels, expected > 1000`);
    if (r.cases.empty.objects !== 0 || r.cases.empty.pixels !== 0) fail(`empty scene: ${JSON.stringify(r.cases.empty)}`);
    if (!(r.cases.odd.pixels > 100)) fail(`unknown animation/effect names should still render: ${JSON.stringify(r.cases.odd)}`);
    if (r.cases.dyn.objects !== 1) fail(`dynamic add/remove left ${r.cases.dyn.objects} objects, expected 1`);
    if (!(r.cases.fx.delta > 0.05)) fail(`scene effect "pixelate" barely changed the image (${(r.cases.fx.delta * 100).toFixed(1)}% of painted pixels differ)`);
    const fxCount = readdirSync('src/effects', { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    if (r.cases.fx.effects.length !== fxCount) fail(`registered ${r.cases.fx.effects.length} effects, expected ${fxCount}`);
    if (!(r.cases.fx.everyPixels > 1000)) fail(`all-effects chain drew ${r.cases.fx.everyPixels} pixels`);
    if (!(r.cases.fx.objPixels > 1000)) fail(`object-level effect drew ${r.cases.fx.objPixels} pixels`);
    if (!(r.cases.fx.hiddenPixels > 1000) || r.cases.fx.glError !== 0) fail(`hidden-then-shown scene: ${JSON.stringify({ px: r.cases.fx.hiddenPixels, glError: r.cases.fx.glError })}`);
    const mx = r.cases.mix, pct = (v) => (v * 100).toFixed(2) + '%';
    if (!(mx.zero < 0.01) || !mx.same) fail(`glow-mix="0" should match no effect byte for byte: ${pct(mx.zero)} differ, identical ${mx.same}`);
    if (!(mx.two > 0.02)) fail(`glow-mix="2" barely differs from glow-mix="1": ${pct(mx.two)} (mix 1 vs none: ${pct(mx.one)})`);
    if (!Array.isArray(mx.missing) || mx.missing.length) fail(`effects without a mix param: ${JSON.stringify(mx.missing)}`);
    const g = r.cases.gravity, moved = (v) => Math.hypot(v[0], v[1]) > 0.01;
    if (!g.finite) fail('gravity produced NaN');
    if (moved(g.first)) fail(`gravity: the first center moved ${g.first}`);
    if (!moved(g.second) || !moved(g.third)) fail(`gravity: second ${g.second} and third ${g.third} should orbit`);
    if (!(r.cases.lone.pixels > 500)) fail(`lone object drew ${r.cases.lone.pixels} pixels`);
    if (!(r.cases.lone.restoredPixels > 500) || r.cases.lone.restoredError !== 0) fail(`context restore: ${JSON.stringify({ px: r.cases.lone.restoredPixels, err: r.cases.lone.restoredError })}`);
    if (r.cases.lone.reinsert !== 1) fail(`lone object re-inserted has ${r.cases.lone.reinsert} inner scenes, expected 1`);
    if (r.cases.lone.claimed !== 0) fail(`lone object claimed by a scene still has ${r.cases.lone.claimed} inner scene(s)`);
    if (!(r.cases.lone.restoreDiff < 0.05)) fail(`after context restore ${(r.cases.lone.restoreDiff * 100).toFixed(1)}% of pixels differ (blend state lost?)`);
    if (r.cases.props.stateAttr !== 'active' || !Number.isFinite(r.cases.props.stateTarget) || r.cases.props.stateTarget !== 1) fail(`state as property: ${JSON.stringify(r.cases.props)}`);
    const c = r.cases.color ?? {}, fin = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
    const near = (a, b) => fin(a) && fin(b) && a.every((x, i) => Math.abs(x - b[i]) < 0.01), show = (v) => JSON.stringify(v?.map?.((x) => +x.toFixed(3)) ?? v);
    if (!near(r.cases.props.rgb, c.red) || !(c.red[0] > 0.9 && c.red[1] < 0.25)) fail(`color as property: ${show(r.cases.props.rgb)}, attribute gave ${show(c.red)}`);
    if (c.space !== 'display-p3' && c.space !== 'srgb') fail(`scene colorSpace is ${c.space}, expected display-p3 or srgb`);
    // Ranges hold in both spaces and exclude the previous value (red), so a skipped parse fails.
    if (!fin(c.p3) || !(c.p3[0] > 0.9 && c.p3[1] < 0.35 && c.p3[2] > 0.08 && c.p3[2] < 0.3)) fail(`color(display-p3 1 0.2 0.2) parsed to ${show(c.p3)}`);
    if (!fin(c.oklch) || !(c.oklch[0] > 0.85 && c.oklch[1] > 0.3 && c.oklch[1] < 0.55 && c.oklch[2] > 0.2 && c.oklch[2] < 0.45)) fail(`oklch(70% 0.2 30) parsed to ${show(c.oklch)}`);
    if (!near(c.kept, c.red)) fail(`color="nope" changed the color: ${show(c.red)} to ${show(c.kept)}`);
    if (!fin(c.srgb) || !(c.srgb[0] > 0.9 && c.srgb[1] < 0.35 && c.srgb[2] > 0.08)) fail(`sRGB parse of a P3 color gave ${show(c.srgb)}`);
    if (!near(c.attached, c.hex)) fail(`color set before attach was not re-parsed in the scene space: ${show(c.attached)} vs ${show(c.hex)}`);
    if (c.space === 'display-p3' && !(c.hex[0] < 0.97 && c.wide[0] >= 0.99)) fail(`P3 path not live: #ff3333 r=${c.hex?.[0]}, color(display-p3 1 0.2 0.2) r=${c.wide?.[0]}`);
    if (r.cases.props.speed !== 2) fail(`speed as property: ${r.cases.props.speed}`);
    if (!(r.cases.gravity.worstStep < 12)) fail(`gravity center switch snapped: ${r.cases.gravity.worstStep?.toFixed(1)} px in one frame`);
    if (!(r.cases.anim.yawStep < 1.5)) fail(`yaw jumped ${r.cases.anim.yawStep?.toFixed(2)} rad in one frame on an animation or speed change`);
    if (!(r.cases.reduced.orbitMoved < 0.01)) fail(`reduced motion: orbit still moved ${r.cases.reduced.orbitMoved?.toFixed(1)} px`);
    if (!(r.cases.reduced.blobDiff < 0.02)) fail(`reduced motion: blob still animates (${(r.cases.reduced.blobDiff * 100).toFixed(1)}% differ)`);
    const sr = r.cases.color.spacedRed;
    if (!sr || !(sr[0] > 0.8) || !(sr[1] < 0.35)) fail(`rgb( 255, 0, 0 ) parsed as ${JSON.stringify(sr)}, expected red`);
    if (!r.cases.color.removedIsDefault) fail('removing the color attribute did not restore the default color');
    { const g = r.cases.rings ?? {}, want = [60, 120, 180];
      if (!g.radii || !g.radii.every((v, i) => Math.abs(v - want[i]) < 1)) fail(`orbit rings: radii ${JSON.stringify(g.radii)}, expected ${JSON.stringify(want)}`);
      if (!(Math.abs(g.speedRatio / Math.pow(3, 1.5) - 1) < 0.02)) fail(`orbit rings: inner over outer angular speed ${g.speedRatio?.toFixed(3)}, expected 3^1.5 = 5.196`);
      if (!g.zRatio || !g.zRatio.every((v) => Math.abs(v - 1) < 0.02)) fail(`orbit rings: depth should scale with the ring radius over the outer ring, got z/sin ratios ${JSON.stringify(g.zRatio)}`);
      if (!(g.worstLeave < 12)) fail(`orbit rings: an orbiter leaving re-spread the others by ${g.worstLeave?.toFixed(1)} px in one frame (expected an ease, < 12)`);
      if (!g.oddRoles || !g.oddRoles.extraCenter || !g.oddRoles.empty || !g.oddRoles.extraCenterAlone) fail(`orbit rings: odd gravity roles should orbit without NaN: ${JSON.stringify(g.oddRoles)}`);
      if (!(g.clamped >= 38)) fail(`orbit rings: an orbiter 10 px from the center sits at ${g.clamped?.toFixed(1)} px, expected the clearance ring (>= 38)`); }
    if (!(Math.abs(r.cases.gravity.resizedRadius - 100) < 6)) fail(`orbit radius after moving the rest position: ${r.cases.gravity.resizedRadius?.toFixed(1)} px, expected about 100`);
    if (!r.cases.anim.spinMoved) fail('animation "spin" did not change rotation between frames');
    if (r.cases.anim.reducedScale !== 1) fail(`reduced motion: pulse scale ${r.cases.anim.reducedScale}, expected 1`);
    const it = r.cases.interact, js = (v) => JSON.stringify(v);
    if (!it.one?.finite || !(it.one.max < 1e-6)) fail(`collide with one object should not move: ${js(it.one)}`);
    if (!(it.apart >= 40) || it.width !== 40) fail(`collide: two overlapping 40 px objects ended ${it.apart?.toFixed(1)} px apart, expected >= 40 (width ${it.width})`);
    if (!(it.repel?.x < -1) || !(it.repel.back < it.repel.mag * 0.5) || !(it.repel.narrow < it.repel.mag * 0.25)) fail(`repel: pushed left, springs back, repel-radius narrows: ${js(it.repel)}`);
    if (!(it.magnet?.x > 1) || !(it.magnet.back < it.magnet.mag * 0.5)) fail(`magnet: pulled right, drifts home: ${js(it.magnet)}`);
    if (!(it.scroll?.diff > 0.01)) fail(`scroll: rotation did not change with the page scroll under reduced motion: ${js(it.scroll)}`);
    const tl = it.tall;
    if (!tl || Math.abs(tl.first) > 1e-4 || Math.abs(tl.last - 1) > 1e-4 || tl.min < -1e-4 || tl.max > 1 + 1e-4 || !(tl.step < 0.06)) fail(`scroll on a scene taller than the viewport: progress must clamp 0..1 without jumps: ${js(tl)}`);
    const pf = r.cases.perf, finitePos = (v) => Number.isFinite(v) && v > 0;
    if (!finitePos(pf.frameTime) || !finitePos(pf.fps)) fail(`frame metrics after ten frames: ${JSON.stringify(pf)}`);
    if (pf.gpu0 !== null || !(pf.gpu === null || (Number.isFinite(pf.gpu) && pf.gpu >= 0)) || pf.glError !== 0) fail(`gpuTime must be null or finite ms without GL errors: ${JSON.stringify(pf)}`);
    const uv = r.cases.universe;
    if (uv.count !== 12 || uv.objects !== 12) fail(`universe count="12": ${uv.count} children, ${uv.objects} attached`);
    if (!uv.same || !uv.other || !uv.hasPos) fail(`universe seed: same seed same layout ${uv.same}, other seed differs ${uv.other}, data-pos on every child ${uv.hasPos}`);
    if (!uv.kept) fail('universe: depth or focus change regenerated the children');
    if (!uv.depthMoved) fail('universe: depth and focus changes did not update the defocus radii');
    if (!uv.depthZero?.length || !uv.depthZero.every((v) => v === 0)) fail(`universe depth="0": defocus radii ${js(uv.depthZero)}`);
    if (!(uv.scale?.near > uv.scale?.far)) fail(`universe perspective: near scale ${uv.scale?.near} should exceed far scale ${uv.scale?.far}`);
    if (uv.unique?.dupOffsets !== 0 || uv.unique?.dupRotations !== 0) fail(`universe motion in packs: ${js(uv.unique)}`);
    if (!uv.spin?.turned || !uv.spin?.held) fail(`universe camera spin: ${js(uv.spin)}`);
    if (!uv.drag?.turned || !uv.drag?.held) fail(`universe drag: ${js(uv.drag)}`);
    if (!uv.tilt?.moved || !uv.tilt?.held) fail(`universe pointer tilt: ${js(uv.tilt)}`);
    if (!(uv.collide?.apart >= 0.25 - 1e-3) || !(Math.abs(uv.collide?.together - 0.05) < 1e-6)) fail(`universe collide: ${js(uv.collide)} (expected apart >= 0.25, together 0.05)`);
    if (!uv.gravity?.same || uv.gravity.centers !== 0 || uv.gravity.fields !== 0 || uv.gravity.interaction) fail(`universe gravity attribute should be ignored: ${js(uv.gravity)}`);
    if (uv.reduced?.yaw !== 0 || !uv.reduced?.held) fail(`universe under reduced motion still moves: ${js(uv.reduced)}`);
    if (uv.pasted?.children !== 1 || uv.pasted.attached !== 1 || !(uv.pasted.scale > 1)) fail(`pasted universe markup should keep its one child and scale it up: ${js(uv.pasted)}`);
    if (uv.zero !== 0 || uv.none !== 0) fail(`universe count="0" or only unknown shapes: ${uv.zero} and ${uv.none} children, expected 0`);
    if (uv.known?.length !== 8 || !uv.known.every((t) => t === 'sd-orb' || t === 'sd-ring')) fail(`universe shapes="sd-orb sd-nope ring": ${js(uv.known)}`);
    if (uv.big?.children !== 120 || !(uv.big.pixels > 1000) || uv.big.stray !== 0) fail(`universe count="120": ${js(uv.big)}`);
    if (!(uv.defocus?.blur > 0.05) || !(uv.defocus.zero < 0.01)) fail(`defocus: radius 12 vs none ${pct(uv.defocus?.blur ?? 0)}, radius 0 vs none ${pct(uv.defocus?.zero ?? 1)}`);
    if (!(r.cases.look.bright > 20)) fail(`glass highlights flattened: only ${r.cases.look.bright} pixels keep rgb above alpha`);
    if (!(r.cases.pool.full >= 1 && r.cases.pool.full <= 12) || !(r.cases.pool.kept >= 1) || r.cases.pool.empty !== 0) fail(`effect buffer pool: ${r.cases.pool.full} pairs for 40 sizes in 8 px steps (expected 1 to 12), ${r.cases.pool.kept} two frames after removal (expected >= 1, a grace period), ${r.cases.pool.empty} after 70 frames (expected 0)`);
    if (!(uv.energy?.ratio < 1.1)) fail(`universe collide pumps energy: free-body kinetic energy x${uv.energy?.ratio?.toFixed(2)} after 120 s (expected < 1.1)`);
    if (!(uv.heldRelease?.drift < 1e-6)) fail(`universe drag: a release after holding still flung the view by ${uv.heldRelease?.drift} rad`);
    if (!(uv.otherPointer?.moved < 1e-9)) fail(`universe drag: a second pointer moved the view by ${uv.otherPointer?.moved} rad`);
    if (!/pinch-zoom/.test(uv.touch || '')) fail(`universe touch-action "${uv.touch}" blocks pinch zoom`);
    if (!(uv.wobble?.least > 0.5)) fail(`universe drift should make every body wobble: least moved ${uv.wobble?.least?.toFixed(2)} px vs drift 0`);
    if (!(uv.tiltDir?.right > 0) || !(uv.tiltDir?.down > 0)) fail(`universe pointer tilt should move front shapes toward the pointer: ${js(uv.tiltDir)}`);
    if (!(r.cases.quad?.outside > 50)) fail(`quad does not follow scale: ${r.cases.quad?.outside} px painted beyond 1.5x the rect at scale 2 (expected > 50)`);
    if (!r.cases.phase?.differ) fail('phase="2" should offset the spin against a sibling without one');
    { const U = r.cases.uniforms ?? {}; const dead = Object.entries(U).filter(([, v]) => !(v > 0.005)).map(([k, v]) => k + ' ' + (v * 100).toFixed(2) + '%');
      if (!Object.keys(U).length || dead.length) fail(`object uniforms with no visible effect between min and max: ${dead.join(', ') || 'none measured'}`);
      const fl = r.cases.fall ?? {}; if (!(Math.abs(fl.dist - fl.expected) < 3)) fail(`gravity="fall" settled at ${fl.dist?.toFixed(1)} px, expected ${fl.expected}`);
      if (r.dupNames?.length) fail(`layer names collide: ${r.dupNames.join(', ')}`);
      for (const [name, px] of Object.entries(r.shadePixels ?? {})) if (!(px > 1000)) fail(`shade ${name} draws ${px} px on twelve objects (expected > 1000)`); }
    { const Z = r.cases.perf2 ?? {}, j = (v) => JSON.stringify(v);
      if (!(Z.march?.patched >= 2) || Z.march?.bytesDiffer !== 0 || !(Z.march?.pixels > 1000)) fail(`march far limit 4.6 and the bounding-sphere cull must be present and pixel-identical to the old march: ${j(Z.march)} (measures ${Z.measures}, collide ${Z.collideMs?.toFixed(2)} ms)`);
      if (Z.noFx?.buffers !== false || Z.noFx?.bytesDiffer !== 0 || !(Z.noFx?.pixels > 100)) fail(`a scene with no effect should keep no buffers and match the buffer path byte for byte: ${j(Z.noFx)}`);
      if (!(Z.offscreen?.fps === 0) || !(Z.offscreen?.links === 0)) fail(`an offscreen scene should not run or compile before it is seen: ${j(Z.offscreen)}`);
      if (!(Z.measures <= 2)) fail(`regenerating 120 bodies measured the scene ${Z.measures} times (expected at most 2)`);
      if (!(Z.collideMs < 0.4)) fail(`universe collide at 120 bodies takes ${Z.collideMs?.toFixed(2)} ms per step (expected under 0.8)`); }
    { const Y = r.cases.hard ?? {}, j = (v) => JSON.stringify(v);
      if (!(Y.clamp?.effect === Y.clamp?.effectMin) || Y.clamp?.uniform !== 0 || Y.clamp?.speed !== 1 || Y.clamp?.state !== 0.25) fail(`params should clamp and stay finite: ${j(Y.clamp)}`);
      if (!(Y.fall?.dist < 300)) fail(`gravity-strength 100 flung a faller ${Y.fall?.dist?.toFixed(0)} px away (expected under 300)`);
      if (Y.zeroSize !== true) fail('a zero-size universe body made positions non-finite');
      if (Y.rest !== 0) fail(`reduced motion with phase="2" should rest at rotation 0, got ${Y.rest}`);
      if (Y.released !== true) fail('a removed scene should release its WebGL context');
      if (Y.flagOnLoss !== true || Y.flagCleared !== true) fail(`context loss should set data-fallback and restore should clear it: ${j({ on: Y.flagOnLoss, cleared: Y.flagCleared })}`);
      if (Y.badEffect?.errors !== 1 || !(Y.badEffect?.pixels > 100)) fail(`a failing effect should log once and pass through: ${j(Y.badEffect)}`);
      if (!(Y.pausedClock < 0.2)) fail(`the shader clock advanced ${Y.pausedClock?.toFixed(2)} s while paused for 0.3 s`);
      if (!(Math.abs(Y.spring?.a16 / Y.spring?.a8 - 1) < 0.05)) fail(`repel spring depends on frame rate: ${j(Y.spring)}`);
      if (!Y.lateBody?.projected) fail('a child appended to a universe after connect is not projected');
      if (!Y.blur?.field || Y.blur?.chain !== false || !(Y.blur?.leak < 1e-6)) fail(`blur should be a field, not an effect, and not leak: ${j(Y.blur)}`);
      if (!(Y.authorCss < 0.5)) fail(`author CSS moved a universe child by ${Y.authorCss?.toFixed(1)} px`);
      if (!(Y.tiltClamp <= 12 * Math.PI / 180 + 1e-6)) fail(`pointer tilt while dragging outside the box reached ${(Y.tiltClamp * 180 / Math.PI).toFixed(1)} degrees`);
      if (!(Y.toggleWorst < 12)) fail(`toggling gravity off and on snapped ${Y.toggleWorst?.toFixed(1)} px in one frame`);
      if (!(Math.abs(Y.pinned?.orbiterRadius - Y.pinned?.ring) < 1) || !(Y.pinned?.blockerMoved > 5)) fail(`collide should not push an orbiter off its ring: ${j(Y.pinned)}`);
      if (Y.hoverScale !== 0.5) fail(`hover-lift ignores the object's scale: scale ${Y.hoverScale} with the pointer outside the drawn shape`);
      if (Y.nested?.outer !== 0 || Y.nested?.inner !== 1) fail(`a nested scene's object attached to the wrong scene: ${j(Y.nested)}`);
      if (Y.loneTheme !== 1) fail(`theme="light" on a lone object did not reach its scene (${Y.loneTheme})`);
      if (Y.reflect?.length) fail(`attributes that shadow fields or HTMLElement properties: ${j(Y.reflect)}`); }
    if (!(uv.defaultHeight >= 300) || !(uv.defaultPixels > 1000)) fail(`universe with no author height: ${uv.defaultHeight}px tall, ${uv.defaultPixels} px drawn`);
    if (!fails.length) console.log(`smoke ok (${r.cases.all.pixels} px, color space ${r.cases.color.space})`);
    return r;
  } catch (e) { fail(`smoke: ${e.message.split('\n')[0]}`); }
  finally { srv.close(); }
}


async function site() {
  if (!existsSync('site/dist/index.html')) return fail('site/dist missing (run npm run site)');
  const pages = readdirSync('site/dist', { recursive: true }).filter((f) => f.endsWith('.html'));
  for (const f of pages) {
    const html = readFileSync(`site/dist/${f}`, 'utf8');
    if (!/<title>[^<]+<\/title>/.test(html)) fail(`site/${f}: no <title>`);
    const m = f.match(/^objects\/(.+)\.html$/);
    if (m && !html.includes(`<sd-${m[1]}`)) fail(`site/${f}: does not mount <sd-${m[1]}>`);
    const fx = f.match(/^effects\/(.+)\.html$/);
    if (fx && !html.includes(`${fx[1]}-mix`)) fail(`site/${f}: no ${fx[1]}-mix option`);
    if (/\u2014/.test(html)) fail(`site/${f}: contains an em dash`);
  }
  // Agent-first outputs: skill.md is the contract verbatim, llms.txt indexes every library page.
  const text = (f) => (existsSync(`site/dist/${f}`) ? readFileSync(`site/dist/${f}`, 'utf8') : '');
  if (!existsSync('site/dist/skill.md') || !readFileSync('site/dist/skill.md').equals(readFileSync('docs/SKILL.md'))) fail('site/skill.md is not a byte copy of docs/SKILL.md');
  const llms = text('llms.txt');
  const unlisted = pages.filter((f) => /^(objects|effects|shades|interactions)\//.test(f) && !llms.includes(f));
  for (const extra of ['universe.html', 'performance.html']) if (existsSync(`site/dist/${extra}`) && !llms.includes(extra)) unlisted.push(extra);
  if (!llms.startsWith('# solids') || !llms.includes('skill.md') || unlisted.length) fail(`site/llms.txt: title, skill.md and every object, effect and interaction page expected; missing ${unlisted.join(', ') || 'none'}`);
  for (const f of ['skill.md', 'llms.txt']) if (/\u2014/.test(text(f))) fail(`site/${f}: contains an em dash`);
  // Landing: the sections under the hero, in the spec order, and a Copy prompt in the dock.
  const index = text('index.html');
  const h2s = [...index.slice(index.indexOf('<main')).matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]);
  const ORDER = ['Built for agents', 'Install', 'Five layers', 'Universe', 'Catalogue', 'Performance', 'Details'];
  { const band = index.match(/<sd-universe class="band-universe"[^>]*>/)?.[0] ?? ''; if (!/\bcollide\b/.test(band) || /\bgravity\b/.test(band)) fail(`site/index: the universe band should run with collide and no gravity: ${band}`); }
  // fps badge: one per stage on every page (stages and the landing's band stages); the hero's old readout is gone.
  for (const f of pages) { const h = text(f); const stages = (h.match(/class="(stage|band-stage)[ "]/g) ?? []).length, badges = (h.match(/class="fps"/g) ?? []).length;
    if (stages !== badges) { fail(`site/${f}: ${stages} stage(s) but ${badges} fps badge(s)`); break; } }
  if (/id="readout"/.test(index)) fail('site/index: the old dock readout should be gone');
  if (!/class="band-stage"[^>]*>\s*<output class="fps"/.test(index) || (index.match(/class="band-stage"/g) ?? []).length < 3) fail('site/index: the landing rows and the universe band need a band-stage with its fps badge');
  // Page pass: grouped docks with legends, the hero's single row, the Shades page in the Guide, a scrolling code bar, a 20 px badge figure.
  { const spec = (f) => JSON.parse(text(f).match(/<script type="application\/json" id="spec">([^<]*)<\/script>/)?.[1] ?? '{"controls":[]}').controls;
    const groupsOf = (f) => [...new Set(spec(f).map((c) => c.group ?? ''))];
    const expect = { 'objects/orb.html': ['Shape', 'Motion', 'Look'], 'scene.html': ['Scene', 'Interactions', 'Look'], 'universe.html': ['Universe', 'Camera', 'Depth', 'Look'], 'effects/glow.html': ['Scene', 'Effect', 'Look'], 'shades/cel.html': ['Scene', 'Shade', 'Look'], 'interactions/repel.html': ['Scene', 'Interactions', 'Look'] };
    for (const [f, want] of Object.entries(expect)) { const got = groupsOf(f); if (want.some((g) => !got.includes(g)) || got.includes('')) fail(`site/${f}: dock groups ${JSON.stringify(got)}, expected ${JSON.stringify(want)} with every control grouped`); }
    if (spec('index.html').some((c) => c.group)) fail('site/index: the hero dock keeps one flat row (no groups)');
    const css = readFileSync('site/src/styles.css', 'utf8');
    if (!/\.codebar pre \{[^}]*overflow-x: auto/.test(css)) fail('site/styles: the live markup should scroll horizontally (.codebar pre overflow-x: auto)');
    if (!/\.fps b \{[^}]*font-size: 20px/.test(css)) fail('site/styles: the fps figure should be 20 px');
    if (!/<h2>Guide<\/h2><ul>[\s\S]*?href="\.\/shades\.html"/.test(index)) fail('site/index: the Guide list should link the Shades page');
    if (!/<p class="chips"><span><a href="shades\.html">Shades<\/a><\/span>/.test(index)) fail('site/index: the catalogue Shades row should link the Shades page'); }
  // Shades on the site: a page per shade, a comparison page, a catalogue row, a Shading select in every dock, docs.
  const dirsOf = (root) => readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const objectDirs = dirsOf('src/objects'), effectDirs = dirsOf('src/effects'), shadeDirs = dirsOf('src/shades');
  {
    for (const n of shadeDirs) if (!existsSync(`site/dist/shades/${n}.html`)) fail(`site/shades/${n}.html missing`);
    const cmp = text('shades.html');
    if ((cmp.match(/<sd-scene/g) ?? []).length !== shadeDirs.length || (cmp.match(/<sd-[a-z]+ /g) ?? []).length < objectDirs.length * shadeDirs.length) fail(`site/shades.html: expected ${shadeDirs.length} scenes with 12 objects each`);
    if (!/light default/.test(cmp)) fail('site/shades.html: the lede should name the light default');
    if (!/<p class="chips"><span>(<a href="shades\.html">)?Shades/.test(index)) fail('site/index: the catalogue band has no Shades row');
    if (!/<h2[^>]*>Five layers<\/h2>/.test(index)) fail('site/index: the layers band should read Five layers');
    for (const f of ['objects/orb.html', 'effects/glow.html', 'scene.html', 'universe.html', 'index.html', 'shades/cel.html']) {
      const spec = JSON.parse(text(f).match(/<script type="application\/json" id="spec">([^<]*)<\/script>/)?.[1] ?? '{"controls":[]}');
      const c = spec.controls.find((x) => x.attr === 'shading');
      if (!c || c.kind !== 'select' || !c.options.includes('cel') || !c.options.includes('')) fail(`site/${f}: dock has no Shading select listing auto and every shade`);
    }
    const skill = text('skill.md');
    if (!/sdShade/.test(skill) || !/sdEdge/.test(skill) || !/sdLightDir/.test(skill)) fail('site/skill.md: the shade contract (sdShade, sdEdge, sdLightDir) is missing');
    for (const stale of ['sdGlass', 'uPointer', 'vec3`', '`color`. Keep', '"tags"', 'bleed', 'npm run build   #']) if (skill.includes(stale)) fail(`site/skill.md: still mentions ${stale}`);
    for (const need of ['## Adding an interaction', '## Adding an animation', 'npm run check']) if (!skill.includes(need)) fail(`site/skill.md: missing ${need}`);
    const contributing = readFileSync('CONTRIBUTING.md', 'utf8'); if (!/shades/i.test(contributing) || /register it in the matching/.test(contributing) === false && false) fail('CONTRIBUTING.md should mention shades');
    if (/raise `rim`/.test(text('accessibility.html')) || /raise <code>rim/.test(text('accessibility.html'))) fail('site/accessibility: the rim advice is stale (only glass reads rim)');
    if (!/<output class="fps" aria-hidden="true"/.test(index)) fail('site/index: the fps badge must be aria-hidden (an output is a live region)');
    if (!/"empty":"auto"/.test(text('objects/orb.html'))) fail('site/objects/orb: the Shading select should label its empty option auto');
    if (!/shades\.html/.test(text('llms.txt')) || shadeDirs.some((n) => !text('llms.txt').includes(`shades/${n}.html`))) fail('site/llms.txt: shade pages or shades.html unlisted'); }
  // Side menu: two tiers, four collapsible catalogue groups with counts; only the current page's group is open.
  { const side = (f) => text(f).match(/<nav class="side"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const groups = (h) => [...h.matchAll(/<details[^>]*>\s*<summary>([^<]*)<span>([0-9]+)<\/span>/g)].map((m) => m[1].trim() + ' ' + m[2]);
    const idx = side('index.html'), orb = side('objects/orb.html'), glow = side('effects/glow.html');
    const want = `Objects ${objectDirs.length}|Animations ${groups(idx)[1]?.split(' ')[1] ?? '?'}|Effects ${effectDirs.length}|Shades ${shadeDirs.length}|Interactions ${groups(idx)[4]?.split(' ')[1] ?? '?'}`;
    if (groups(idx).join('|') !== want) fail(`site/index: side menu groups ${JSON.stringify(groups(idx))}, expected ${want}`);
    if ((idx.match(/<details open/g) ?? []).length !== 0) fail('site/index: a catalogue group is open on the Introduction');
    const openOrb = orb.match(/<details open[\s\S]*?<\/details>/g) ?? [];
    if (openOrb.length !== 1 || !/aria-current="page"/.test(openOrb[0]) || !/>Objects\s*</.test(openOrb[0])) fail(`site/objects/orb: expected only the Objects group open with the current link inside, got ${openOrb.length} open`);
    if (!/<details open[^>]*>\s*<summary>Effects/.test(glow)) fail('site/effects/glow: the Effects group should be open');
    if (!/<h2>Guide<\/h2>/.test(idx) || !/<h2>Catalogue<\/h2>/.test(idx)) fail('site/index: side menu tiers Guide and Catalogue missing'); }
  { const band = index.slice(index.indexOf('id="catalogue"'), index.indexOf('id="performance"'));
    if (!/about [0-9]+ K tokens/.test(band) || !/\$[0-9]+\.[0-9]{2}/.test(band) || !band.includes('2026-10-06') || !/before the agent/.test(band)) fail('site/index: the catalogue band should say what a shape costs an agent (K tokens, dollars, price date)'); }
  if (h2s.join('|') !== ORDER.join('|')) fail(`site/index: sections ${JSON.stringify(h2s)}, expected ${JSON.stringify(ORDER)}`);
  const dock = index.match(/class="controls dock"[\s\S]*?<\/form>/)?.[0] ?? '';
  const heroPrompt = JSON.parse(index.match(/<script type="application\/json" id="spec">([^<]*)<\/script>/)?.[1] ?? '{}').prompt ?? '';
  if (!dock.includes('id="copy-prompt"') || !heroPrompt.includes('{{markup}}') || !heroPrompt.includes('skill.md')) fail('site/index: the dock needs a Copy prompt with the scene markup and the skill.md link');
  // Sizes reach the page from dist/sizes.json: the hero pitch and the Performance page.
  if (existsSync('dist/sizes.json')) {
    const s = JSON.parse(readFileSync('dist/sizes.json', 'utf8'));
    if (!readFileSync('site/dist/index.html', 'utf8').includes(`about ${Math.round(s.full / 1024)} KB`)) fail(`site/index: hero pitch does not say about ${Math.round(s.full / 1024)} KB`);
    const perf = existsSync('site/dist/performance.html') ? readFileSync('site/dist/performance.html', 'utf8') : '';
    if (!perf.includes(kb(s.core)) || !perf.includes(kb(s.full))) fail(`site/performance: sizes table does not show ${kb(s.core)} and ${kb(s.full)}`);
    if (!/nothing is uploaded/i.test(perf)) fail('site/performance: the page must say nothing is uploaded');
  }
  const chrome = chromePath();
  if (!chrome) return;
  for (const [f, size] of [['scene.html'], ['index.html'], ['index.html', '500,800'], ['objects/orb.html'], ['effects/glow.html'], ['shades/cel.html'], ['performance.html'], ['universe.html']]) {
    const { srv, port, result } = await serve('site/dist');
    try {
      const r = await runPage(`http://127.0.0.1:${port}/${f}?__check`, chrome, result, 30000, size);
      if (f === 'index.html') {
        if (!(r.objects >= 12)) fail(`site/index (${size ?? 'desktop'}): hero has ${r.objects} objects, expected 12`);
        if (!r.hasCenter) fail(`site/index (${size ?? 'desktop'}): dock has no Center control`);
        if (r.scrollWidth > r.innerWidth) fail(`site/index (${size ?? 'desktop'}): horizontal overflow ${r.scrollWidth} > ${r.innerWidth}`);
        if (!(r.h1Bottom < r.dockTop)) fail(`site/index (${size ?? 'desktop'}): title bottom ${r.h1Bottom} is not above the dock top ${r.dockTop}`);
        const styled = (r.markup?.match(/style="position:\s*absolute;/g) || []).length;
        if (styled < 12 || !/<sd-scene[^>]*style="[^"]*height/.test(r.markup || '')) fail(`site/index (${size ?? 'desktop'}): Copy code markup does not reproduce the layout (${styled} positioned objects)`);
        if (!r.centerOptions || r.centerOptions.length !== 6 || r.centerOptions.includes('cube')) fail(`site/index (${size ?? 'desktop'}): Center options should be the orb and its five orbiters, got ${JSON.stringify(r.centerOptions)}`);
        if (r.interactionAttr && !/gravity.*collide/.test(r.interactionAttr)) fail(`site/index (${size ?? 'desktop'}): toggling reordered interactions to "${r.interactionAttr}"`);
        if (!/<section class="band" id="performance">[\s\S]*?href="performance.html"/.test(index)) fail('site/index: the Performance band has no link to performance.html');
        if (!size && !/\d+(\.\d+)? ms/.test(r.liveFrame ?? '')) fail(`site/index: the Performance band's live frame number reads ${JSON.stringify(r.liveFrame)}`);
        if (!(r.contexts <= 6)) fail(`site/index (${size ?? 'desktop'}): ${r.contexts} WebGL scenes, expected at most 6 (one per section row, never one per card)`);
        if (!r.sceneObjects?.length || r.sceneObjects.some((n) => !(n > 0))) fail(`site/index (${size ?? 'desktop'}): a scene holds no objects: ${JSON.stringify(r.sceneObjects)}`);
        if (!/^[0-9]+ fps/.test(r.badge ?? '') || !/[0-9.]+ ms/.test(r.badge ?? '')) fail(`site/index (${size ?? 'desktop'}): hero fps badge reads ${JSON.stringify(r.badge)}`);
      }
      if (f === 'performance.html') {
        const b = r.bench;
        if (!(Number.isFinite(b?.cpu) && b.cpu > 0) || !(b.gpu === null || Number.isFinite(b.gpu))) fail(`site/performance: solidsBench('sd-orb', 5) gave ${JSON.stringify(b)}`);
        if (!/\d/.test(r.benchRow ?? '') || (b?.gpu === null && !/unavailable/.test(r.benchRow ?? ''))) fail(`site/performance: a benchmark row reads ${JSON.stringify(r.benchRow)}`);
        if (!/^\D+[\d.]+unavailable$/.test(r.noTimerRow ?? '')) fail(`site/performance: without the GPU timer a row should show CPU ms and "unavailable", got ${JSON.stringify(r.noTimerRow)}`);
        if (r.scenesBeforeBench !== r.scenes) fail(`site/performance: the benchmark left ${r.scenes - r.scenesBeforeBench} scene(s) behind`);
        if (!/fps/.test(r.meter ?? '') || !/(srgb|display-p3)/.test(r.meter ?? '')) fail(`site/performance: live meter reads ${JSON.stringify(r.meter)}`);
      }
      if (f === 'objects/orb.html' && (!r.legends || r.legends.length < 3)) fail(`site/${f}: dock fieldsets rendered ${JSON.stringify(r.legends)}, expected at least three legends`);
      if (f === 'objects/orb.html' && r.liveEscaped !== true) fail(`site/${f}: Copy code should escape quotes and ampersands in attribute values`);
      if (f === 'objects/orb.html' && !/^[0-9]+ fps/.test(r.badge ?? '')) fail(`site/${f}: fps badge reads ${JSON.stringify(r.badge)}`);
      if (r.errors.length) fail(`site/${f}: console errors: ${r.errors.join(' | ').slice(0, 600)}`);
      if (!(r.scenes >= 1)) fail(`site/${f}: no scene mounted`);
      if (r.theme !== 'light') fail(`site/${f}: one click on Theme gave "${r.theme}", expected light`);
      if ((f.startsWith('effects/') || f.startsWith('shades/')) && r.subject !== 'sd-cube') fail(`site/${f}: Object select left subject "${r.subject}"`);
      if (f === 'scene.html' && !/<sd-ring[^>]*gravity="center"/.test(r.live)) fail(`site/${f}: center select did not mark the ring: ${r.live?.slice(0, 160)}`);
      if (f === 'scene.html' && /<sd-scene[^>]*gravity="/.test(r.live)) fail(`site/${f}: junk gravity attribute on the scene`);
      if (f === 'universe.html' && !/<sd-universe[^>]*camera="none"/.test(r.live)) fail(`site/${f}: with Spin, Drag and Pointer off, Copy code should carry camera="none": ${r.live?.slice(0, 120)}`);
      if (f === 'universe.html' && (!(r.objects >= 30) || !/<sd-universe[^>]*count="36"/.test(r.live) || !/data-pos="/.test(r.live) || /data-z="/.test(r.live))) fail(`site/${f}: universe markup: ${r.objects} children, ${r.live?.slice(0, 160)}`);
      if (f === 'scene.html' && !/gravity-strength="0"/.test(r.live)) fail(`site/${f}: strength slider at 0 did not stick: ${r.live?.slice(0, 160)}`);
    } catch (e) { fail(`site/${f}: ${e.message}`); }
    finally { srv.close(); }
  }
  if (!fails.length) console.log(`site ok (${pages.length} pages)`);
}

sizes();
manifests();
await smoke();
await site();

if (fails.length) { console.error(`\n${fails.length} failure(s)`); process.exit(1); }
console.log('ok');
