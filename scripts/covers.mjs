// Renders the share covers into site/src/og (committed; gen-site copies them): og/solids.jpg for the site, og/objects/<name>.jpg per
// object, og/apple-touch-icon.png. Run after `npm run site` when an object is added or the look changes: `npm run covers`.
// Needs Chrome (CHROME=/path/to/chrome to override). The cover pages are written under site/dist/.covers and removed after.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

if (!existsSync('site/dist/solids.js')) { console.error('run npm run site first'); process.exit(1); }
const chrome = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium'].filter(Boolean)
  .find((p) => (p.startsWith('/') ? existsSync(p) : (() => { try { execFileSync('which', [p], { stdio: 'ignore' }); return true; } catch { return false; } })()));
if (!chrome) { console.error('Chrome not found (set CHROME)'); process.exit(1); }

// The palette and the object list, as the site uses them.
globalThis.window = globalThis; globalThis.HTMLElement = class {}; globalThis.customElements = { get: () => undefined, define: () => {} };
const { PALETTE, registry } = await import(pathToFileURL(resolve('dist/solids.js')).href);
const color = (i) => PALETTE[i % PALETTE.length];
const objects = [...registry.objects.values()].map((o) => o.manifest); // registry order, so each cover matches its page's color
const size = gzipSync(readFileSync('dist/solids.js')).length; // as the site states it
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `html,body{margin:0;width:1200px;height:630px;overflow:hidden;color:#f2f2f5;font:16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
body{position:relative;background:radial-gradient(ellipse 55% 75% at 74% 50%,rgba(155,209,255,.11),transparent 70%),#0a0a0c}
.copy{position:absolute;left:76px;top:68px;bottom:64px;width:540px;display:flex;flex-direction:column;z-index:1}
.brand{display:flex;align-items:center;gap:12px;font-size:28px;font-weight:600;letter-spacing:-.01em}
h1{font-size:66px;line-height:1.02;letter-spacing:-.035em;font-weight:650;margin:auto 0 22px}
h1 code{font:600 58px/1.05 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-.02em}
p{font-size:26px;line-height:1.36;color:#9a9aa3;margin:0}
.url{margin-top:auto;font-size:21px;color:#74747d}
sd-scene{position:absolute;top:0;bottom:0;right:0;left:540px}
sd-scene>*{position:absolute;translate:-50% -50%}`;
const at = (l, t) => `style="left:${l}%;top:${t}%"`;
const shell = (copy, scene, title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style>
<script type="module" src="../solids.js"></script></head><body><div class="copy"><div class="brand"><img src="../favicon.svg" width="32" height="32" alt="">solids</div>${copy}<div class="url">mmaxence.github.io/solids</div></div>
<sd-scene theme="dark" dpr="2">${scene}</sd-scene></body></html>`;
const far = (r) => ` effect="defocus" defocus-radius="${r}" state="off"`;

const pages = [{ out: 'og/solids.jpg', name: 'site', w: 1200, h: 630, html: shell(
  `<h1>Lightweight 3D objects for the web</h1><p>One script tag, no dependencies, about ${Math.round(size / 1024)} KB.</p>`,
  [`<sd-orb size="250px" color="${color(0)}" glow="0.8" animation="float" speed="0.6" ${at(50, 52)}></sd-orb>`,
    `<sd-ring size="160px" color="${color(1)}" animation="float" phase="1" ${at(18, 24)}></sd-ring>`,
    `<sd-knot size="150px" color="${color(3)}" animation="float" phase="9" ${at(84, 24)}></sd-knot>`,
    `<sd-crystal size="128px" color="${color(2)}" animation="float" phase="5" ${at(84, 78)}></sd-crystal>`,
    `<sd-star size="104px" color="${color(5)}" animation="float" phase="7" ${at(20, 78)}></sd-star>`,
    `<sd-capsule size="84px" color="${color(4)}" animation="float" phase="2" ${at(52, 9)}></sd-capsule>`,
    `<sd-blob size="96px" color="${color(4)}"${far(7)} ${at(64, 92)}></sd-blob>`,
    `<sd-disc size="80px" color="${color(0)}"${far(8)} ${at(26, 4)}></sd-disc>`,
    `<sd-prism size="72px" color="${color(1)}"${far(6)} ${at(97, 52)}></sd-prism>`].join(''), 'solids') },
  ...objects.map((o, i) => ({ out: `og/objects/${o.name}.jpg`, name: o.name, w: 1200, h: 630, html: shell(
    `<h1><code>&lt;${esc(o.tag)}&gt;</code></h1><p>${esc(o.description)}</p>`,
    `<sd-${o.name} size="400px" color="${color(i)}" animation="float" speed="0.5" ${at(50, 50)}></sd-${o.name}>`, o.name) })),
  { out: 'og/apple-touch-icon.png', name: 'icon', w: 180, h: 180, html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>icon</title>
<style>html,body{margin:0;width:180px;height:180px;overflow:hidden;background:radial-gradient(circle at 50% 45%,#16202b,#0a0a0c 75%)}sd-orb{position:absolute;left:24px;top:24px}</style>
<script type="module" src="../solids.js"></script></head><body><sd-orb size="132px" color="${color(0)}" glow="0.6" theme="dark" dpr="3"></sd-orb></body></html>` },
];

mkdirSync('site/dist/.covers', { recursive: true });
pages.forEach((p, i) => writeFileSync(`site/dist/.covers/${i}.html`, p.html));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.map': 'application/json' };
const srv = createServer((req, res) => { const f = resolve('site/dist', '.' + new URL(req.url, 'http://x').pathname);
  if (!existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'text/plain' }); res.end(readFileSync(f)); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port, dport = 9800 + Math.floor(Math.random() * 150), profile = `${tmpdir()}/solids-covers-${dport}`;
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${dport}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error('covers: timed out'); done(1); }, 180000).unref?.();
const done = (code) => { proc.kill('SIGKILL'); srv.close(); rmSync('site/dist/.covers', { recursive: true, force: true }); try { rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(code); };
let target;
for (let i = 0; i < 75 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${dport}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
if (!target) { console.error('Chrome did not start'); done(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl); let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
await send('Page.enable');
for (const [i, p] of pages.entries()) {
  await send('Emulation.setDeviceMetricsOverride', { width: p.w, height: p.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/.covers/${i}.html` });
  await sleep(1500);
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 1500)))', awaitPromise: true });
  const png = p.out.endsWith('.png');
  const shot = await send('Page.captureScreenshot', png ? { format: 'png' } : { format: 'jpeg', quality: 88 });
  if (!shot.result?.data) { console.error('no screenshot for', p.out); done(1); }
  mkdirSync(`site/src/${p.out}`.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(`site/src/${p.out}`, Buffer.from(shot.result.data, 'base64'));
  console.log(`site/src/${p.out}`);
}
// What the covers bake in; the check compares it with the bundle, the manifests and the object pages.
writeFileSync('site/src/og/covers.json', JSON.stringify({ kb: Math.round(size / 1024), objects: Object.fromEntries(objects.map((o, i) => [o.name, { description: o.description, color: color(i) }])) }, null, 2) + '\n');
done(0);
