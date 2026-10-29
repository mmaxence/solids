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
  const budget = { 'dist/core.js': 15 * 1024, 'dist/solids.js': 40 * 1024 };
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
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error(`page did not report within ${timeoutMs} ms`)), timeoutMs));
  return Promise.race([result, timeout]).finally(() => child.kill('SIGKILL'));
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

// Case A: every object once, in one scene.
const all = document.body.appendChild(document.createElement('sd-scene'));
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
function sum(scene) { const buf = read(scene); let s = 0; for (const b of buf) s += b; return s; }
// Case E: effects change the image; per-object effects draw; a hidden scene shown later has no GL error.
const mk = (attrs, objAttrs = {}) => { const sc = document.body.appendChild(document.createElement('sd-scene')); sc.className = 'small'; for (const [k, v] of Object.entries(attrs)) sc.setAttribute(k, v); const o = sc.appendChild(document.createElement(tags[0])); for (const [k, v] of Object.entries(objAttrs)) o.setAttribute(k, v); return sc; };
const plain = mk({});
const pix = mk({ effect: 'pixelate', 'pixelate-size': '32' });
const objFx = mk({}, { effect: 'pixelate', 'pixelate-size': '32' });
const hidden = mk({}); hidden.style.display = 'none';
const every = mk({ effect: [...registry.effects.keys()].join(' ') });
await frame(); await frame();
hidden.style.display = '';
await frame(); await frame();
const sPlain = sum(plain), sPix = sum(pix);
result.cases.fx = { plain: sPlain, pix: sPix, delta: Math.abs(sPlain - sPix) / sPlain, objPixels: pixels(objFx), hiddenPixels: pixels(hidden), glError: hidden.gl?.getError(), everyPixels: pixels(every), effects: [...registry.effects.keys()] };
result.cases.all = { pixels: pixels(all), objects: all.objects.size };
result.cases.empty = { pixels: pixels(empty), objects: empty.objects.size };
result.cases.odd = { pixels: pixels(odd), objects: odd.objects.size };
result.cases.dyn = { pixels: pixels(dyn), objects: dyn.objects.size };
for (const o of all.objects) if (o.broken) result.compileErrors.push(o.manifest.tag);
window.__check?.(result, { frame, registry, pixels });
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
    const objCount = readdirSync('src/objects', { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    if (r.tags.length !== objCount) fail(`registered ${r.tags.length} objects, expected ${objCount}`);
    if (r.compileErrors.length) fail(`shader compile failed: ${r.compileErrors.join(', ')}`); else console.log(`shaders ok (${r.tags.length})`);
    if (r.consoleErrors.length) fail(`console errors: ${r.consoleErrors.join(' | ').slice(0, 800)}`);
    if (!(r.cases.all.pixels > 1000)) fail(`smoke: scene drew ${r.cases.all.pixels} pixels, expected > 1000`);
    if (r.cases.empty.objects !== 0 || r.cases.empty.pixels !== 0) fail(`empty scene: ${JSON.stringify(r.cases.empty)}`);
    if (!(r.cases.odd.pixels > 100)) fail(`unknown animation/effect names should still render: ${JSON.stringify(r.cases.odd)}`);
    if (r.cases.dyn.objects !== 1) fail(`dynamic add/remove left ${r.cases.dyn.objects} objects, expected 1`);
    if (!(r.cases.fx.delta > 0.02)) fail(`scene effect "pixelate" barely changed the image (delta ${r.cases.fx.delta})`);
    const fxCount = readdirSync('src/effects', { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    if (r.cases.fx.effects.length !== fxCount) fail(`registered ${r.cases.fx.effects.length} effects, expected ${fxCount}`);
    if (!(r.cases.fx.everyPixels > 1000)) fail(`all-effects chain drew ${r.cases.fx.everyPixels} pixels`);
    if (!(r.cases.fx.objPixels > 1000)) fail(`object-level effect drew ${r.cases.fx.objPixels} pixels`);
    if (!(r.cases.fx.hiddenPixels > 1000) || r.cases.fx.glError !== 0) fail(`hidden-then-shown scene: ${JSON.stringify({ px: r.cases.fx.hiddenPixels, glError: r.cases.fx.glError })}`);
    if (!r.cases.anim.spinMoved) fail('animation "spin" did not change rotation between frames');
    if (r.cases.anim.reducedScale !== 1) fail(`reduced motion: pulse scale ${r.cases.anim.reducedScale}, expected 1`);
    if (!fails.length) console.log(`smoke ok (${r.cases.all.pixels} px)`);
    return r;
  } catch (e) { fail(`smoke: ${e.message.split('\n')[0]}`); }
  finally { srv.close(); }
}

sizes();
manifests();
await smoke();

if (fails.length) { console.error(`\n${fails.length} failure(s)`); process.exit(1); }
console.log('ok');
