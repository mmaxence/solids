// solids check: the whole test suite, no framework.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
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
}


const UNIFORM_TYPES = new Set(['float', 'vec3', 'color']);
export function validateManifest(m, dir) {
  const errs = [];
  for (const k of ['name', 'tag', 'description']) if (typeof m[k] !== 'string' || !m[k]) errs.push(`${dir}: manifest.${k} must be a non-empty string`);
  if (m.tag && !/^sd-[a-z][a-z0-9-]*$/.test(m.tag)) errs.push(`${dir}: tag must match sd-<name>`);
  if (!Array.isArray(m.uniforms)) errs.push(`${dir}: manifest.uniforms must be an array`);
  for (const u of m.uniforms ?? []) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(u.name ?? '')) errs.push(`${dir}: uniform name "${u.name}" must be camelCase`);
    if (!UNIFORM_TYPES.has(u.type)) errs.push(`${dir}: uniform ${u.name} type must be float|vec3|color`);
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
  if (!fails.length) console.log(`manifests ok (${dirs.length} objects, ${fx.length} effects)`);
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
export function runPage(url, chrome, result, timeoutMs = 30000) {
  const profile = (process.env.TMPDIR || '/tmp') + '/solids-chrome-' + process.pid;
  const args = ['--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run',
    '--disable-crash-reporter', '--no-sandbox', `--user-data-dir=${profile}`, '--window-size=1400,900', url];
  const child = spawn(chrome, args, { stdio: 'ignore' });
  let timer;
  const timeout = new Promise((_, rej) => (timer = setTimeout(() => rej(new Error(`page did not report within ${timeoutMs} ms`)), timeoutMs)));
  return Promise.race([result, timeout]).finally(() => { clearTimeout(timer); child.kill('SIGKILL'); });
}

const CHECK_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>solids check</title>
<style>body{margin:0;background:#0a0a0c;display:flex;flex-wrap:wrap;align-content:flex-start}sd-scene{width:600px;height:400px;display:block}sd-scene.small{width:200px;height:200px}</style></head><body>
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
function read(scene) {
  const gl = scene.gl; if (!gl) return null;
  scene.frame(1, 16);
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
function readAt(scene, t) {
  const gl = scene.gl; if (!gl) return null;
  scene.frame(t, 16);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  return buf;
}
// Fraction of painted pixels that differ noticeably between two scenes (or two buffers) of the same size.
function differ(a, b) {
  const x = a instanceof Uint8Array ? a : read(a), y = b instanceof Uint8Array ? b : read(b); let n = 0, painted = 0;
  for (let i = 0; i < x.length; i += 4) {
    if (x[i + 3] > 8 || y[i + 3] > 8) painted++;
    if (Math.abs(x[i] - y[i]) > 16 || Math.abs(x[i + 1] - y[i + 1]) > 16 || Math.abs(x[i + 2] - y[i + 2]) > 16 || Math.abs(x[i + 3] - y[i + 3]) > 16) n++;
  }
  return painted ? n / painted : 0;
}
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
const before = readAt(ov, 1);
const ext2 = ov.gl.getExtension('WEBGL_lose_context');
ext2.loseContext(); await frame(); await frame(); ext2.restoreContext(); await frame(); await frame(); await frame();
result.cases.lone.restoreDiff = differ(before, readAt(ov, 1));
// Case J: color, state and speed work as properties.
const po = mk({}).firstElementChild;
po.state = 'active'; po.color = '#ff0000'; po.speed = 2;
await frame();
result.cases.props = { stateAttr: po.getAttribute('state'), stateTarget: po.stateTarget, rgb: po.rgb, speed: po.speedValue };
// Case K: switching or removing the gravity center never snaps.
const stepOf = (objs) => objs.map((o) => [...o.anim.offset]);
const maxStep = (a, b) => Math.max(...a.map((v, i) => Math.hypot(v[0] - b[i][0], v[1] - b[i][1])));
let worst = 0, prev = stepOf(gObjs);
gObjs[0].removeAttribute('gravity'); gObjs[2].setAttribute('gravity', 'center');
for (let i = 0; i < 10; i++) { await frame(); const cur = stepOf(gObjs); worst = Math.max(worst, maxStep(prev, cur)); prev = cur; }
gObjs[2].removeAttribute('gravity'); gObjs[1].removeAttribute('gravity');
for (let i = 0; i < 10; i++) { await frame(); const cur = stepOf(gObjs); worst = Math.max(worst, maxStep(prev, cur)); prev = cur; }
result.cases.gravity.worstStep = worst;
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
result.cases.reduced = { orbitMoved: Math.hypot(o1[0] - o2[0], o1[1] - o2[1]), blobDiff: differ(readAt(rb, 1), readAt(rb, 4)) };
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
const free = (...scs) => { for (const sc of scs) { sc.gl?.getExtension('WEBGL_lose_context')?.loseContext(); sc.remove(); } };
free(plain, pix, objFx, hidden, every);

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
rp.setAttribute('repel-radius', '5'); rp.pointer = { x: 110, y: 100, inside: true }; run(rp, 20);
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
} catch (e) { window.__errors.push('check page threw: ' + (e && e.stack || e)); }
result.consoleErrors = window.__errors;
await fetch('/__result', { method: 'POST', body: JSON.stringify(result) });
</script></body></html>`;

async function smoke() {
  const chrome = chromePath();
  if (!chrome) { console.warn('warn: chrome not found, skipping shader/smoke checks'); return; }
  mkdirSync('scripts', { recursive: true });
  writeFileSync('scripts/.check-page.html', CHECK_PAGE);
  const { srv, port, result } = await serve('.');
  try {
    const r = await runPage(`http://127.0.0.1:${port}/scripts/.check-page.html`, chrome, result);
    for (const k of ['all', 'empty', 'odd', 'dyn', 'anim', 'fx', 'gravity', 'lone', 'props', 'reduced', 'interact']) r.cases[k] ??= {};
    const objCount = readdirSync('src/objects', { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    if (r.tags.length !== objCount) fail(`registered ${r.tags.length} objects, expected ${objCount}`);
    if (r.compileErrors.length) fail(`shader compile failed: ${r.compileErrors.join(', ')}`); else console.log(`shaders ok (${r.tags.length})`);
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
    if (!r.cases.props.rgb || Math.abs(r.cases.props.rgb[0] - 1) > 0.01 || r.cases.props.rgb[1] > 0.01) fail(`color as property: ${JSON.stringify(r.cases.props.rgb)}`);
    if (r.cases.props.speed !== 2) fail(`speed as property: ${r.cases.props.speed}`);
    if (!(r.cases.gravity.worstStep < 12)) fail(`gravity center switch snapped: ${r.cases.gravity.worstStep?.toFixed(1)} px in one frame`);
    if (!(r.cases.anim.yawStep < 0.35)) fail(`yaw jumped ${r.cases.anim.yawStep?.toFixed(2)} rad in one frame on an animation or speed change`);
    if (!(r.cases.reduced.orbitMoved < 0.01)) fail(`reduced motion: orbit still moved ${r.cases.reduced.orbitMoved?.toFixed(1)} px`);
    if (!(r.cases.reduced.blobDiff < 0.02)) fail(`reduced motion: blob still animates (${(r.cases.reduced.blobDiff * 100).toFixed(1)}% differ)`);
    if (!r.cases.anim.spinMoved) fail('animation "spin" did not change rotation between frames');
    if (r.cases.anim.reducedScale !== 1) fail(`reduced motion: pulse scale ${r.cases.anim.reducedScale}, expected 1`);
    const it = r.cases.interact, js = (v) => JSON.stringify(v);
    if (!it.one?.finite || !(it.one.max < 1e-6)) fail(`collide with one object should not move: ${js(it.one)}`);
    if (!(it.apart >= 40) || it.width !== 40) fail(`collide: two overlapping 40 px objects ended ${it.apart?.toFixed(1)} px apart, expected >= 40 (width ${it.width})`);
    if (!(it.repel?.x < -1) || !(it.repel.back < it.repel.mag * 0.5) || !(it.repel.narrow < 0.5)) fail(`repel: pushed left, springs back, repel-radius narrows: ${js(it.repel)}`);
    if (!(it.magnet?.x > 1) || !(it.magnet.back < it.magnet.mag * 0.5)) fail(`magnet: pulled right, drifts home: ${js(it.magnet)}`);
    if (!(it.scroll?.diff > 0.01)) fail(`scroll: rotation did not change with the page scroll under reduced motion: ${js(it.scroll)}`);
    const tl = it.tall;
    if (!tl || Math.abs(tl.first) > 1e-4 || Math.abs(tl.last - 1) > 1e-4 || tl.min < -1e-4 || tl.max > 1 + 1e-4 || !(tl.step < 0.06)) fail(`scroll on a scene taller than the viewport: progress must clamp 0..1 without jumps: ${js(tl)}`);
    if (!fails.length) console.log(`smoke ok (${r.cases.all.pixels} px)`);
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
    if (/\u2014/.test(html)) fail(`site/${f}: contains an em dash`);
  }
  const chrome = chromePath();
  if (!chrome) return;
  for (const f of ['scene.html', 'index.html', 'objects/orb.html', 'effects/glow.html']) {
    const { srv, port, result } = await serve('site/dist');
    try {
      const r = await runPage(`http://127.0.0.1:${port}/${f}?__check`, chrome, result);
      if (r.errors.length) fail(`site/${f}: console errors: ${r.errors.join(' | ').slice(0, 600)}`);
      if (!(r.scenes >= 1)) fail(`site/${f}: no scene mounted`);
      if (r.theme !== 'light') fail(`site/${f}: one click on Theme gave "${r.theme}", expected light`);
      if (f.startsWith('effects/') && r.subject !== 'sd-cube') fail(`site/${f}: Object select left subject "${r.subject}"`);
      if (f === 'scene.html' && !/<sd-ring[^>]*gravity="center"/.test(r.live)) fail(`site/${f}: center select did not mark the ring: ${r.live?.slice(0, 160)}`);
      if (f === 'scene.html' && /<sd-scene[^>]*gravity="/.test(r.live)) fail(`site/${f}: junk gravity attribute on the scene`);
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
