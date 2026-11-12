// Exercise the artifact customers receive, not imports from this checkout.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import assert from 'node:assert/strict';

const root = process.cwd(), temp = mkdtempSync(join(tmpdir(), 'living-object-package-'));
let chrome, server;
const run = (args, cwd = root) => execFileSync(process.execPath, args, { cwd, stdio: 'pipe' }).toString();
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const pause = ms => new Promise(r => setTimeout(r, ms));
try {
  const packOutput = execFileSync(npm, ['pack', '--json', '--pack-destination', temp], { cwd: root, encoding: 'utf8' });
  // npm can prefix JSON with stdout from the prepack build.
  const packed = JSON.parse(packOutput.slice(packOutput.lastIndexOf('\n[') + 1))[0];
  const files = packed.files.map(f => f.path);
  for (const file of files) assert(/^(?:dist\/(?:[^/]+\.js(?:\.map)?|types\/.+\.d\.ts)|README\.md|LICENSE|docs\/(?:SKILL|integration)\.md|package\.json)$/.test(file), `unexpected packed file: ${file}`);
  for (const file of ['LICENSE', 'README.md', 'docs/SKILL.md', 'docs/integration.md', 'dist/solids.js', 'dist/core.js', 'dist/types/index.d.ts', 'dist/types/core.d.ts']) assert(files.includes(file), `missing ${file}`);
  const consumer = join(temp, 'consumer'); mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync(npm, ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(temp, packed.filename)], { cwd: consumer, stdio: 'pipe' });
  const manifest = JSON.parse(readFileSync(join(consumer, 'node_modules/solids/package.json'), 'utf8'));
  assert.equal(manifest.private, true, 'registry publication safeguard must remain');
  assert.equal(manifest.name, 'solids', 'local identity must not be silently renamed');
  assert.equal(manifest.sideEffects, true, 'custom element registration must survive bundling');
  assert.equal(manifest.dependencies, undefined);

  writeFileSync(join(consumer, 'full.ts'), `import { SdScene, SdObject, defineObject, registry } from 'solids';
import { SdScene as Explicit } from 'solids/dist/solids.js';
const same: typeof SdScene = Explicit;
const scene: SdScene = document.createElement('sd-scene');
const orb: SdObject = document.createElement('sd-orb');
scene.append(orb); scene.setAttribute('paused', '');
const manifest: registry.Manifest = {name:'sample',tag:'sd-sample',description:'Sample geometry',uniforms:[]};
defineObject(manifest, 'shader supplied by caller');
// @ts-expect-error object membership cannot contain plain strings
scene.objects.add('not an object');
// @ts-expect-error uniform kind must match the shader manifest contract
const invalid: registry.UniformDef = {name:'x',type:'int',default:0,label:'X'};
export { same, scene, orb, invalid };
`);
  writeFileSync(join(consumer, 'core.ts'), `import { SdScene, registry } from 'solids/core';
import { SdScene as Explicit } from 'solids/dist/core.js';
const same: typeof SdScene = Explicit;
const scene: SdScene = document.createElement('sd-scene');
// @ts-expect-error core does not register the full shape catalogue
const absent: HTMLElementTagNameMap['sd-orb'] = document.createElement('sd-orb');
export {same,scene,registry,absent};
`);
  for (const file of ['full.ts', 'core.ts']) {
    for (const mode of ['NodeNext', 'Bundler']) run([join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2020', '--module', mode === 'NodeNext' ? 'NodeNext' : 'ESNext', '--moduleResolution', mode, file], consumer);
  }
  // Bundle from the installed package to prove actual exports resolution.
  for (const [entry, code] of Object.entries({
    full: `import * as root from 'solids'; import * as explicit from 'solids/dist/solids.js'; window.packageProbe={same:root.SdScene===explicit.SdScene,objects:root.registry.objects.size,scene:!!customElements.get('sd-scene'),text:!!customElements.get('sd-text')};`,
    core: `import * as core from 'solids/core'; import * as explicit from 'solids/dist/core.js'; window.packageProbe={same:core.SdScene===explicit.SdScene,objects:core.registry.objects.size,effects:core.registry.effects.size,scene:!!customElements.get('sd-scene'),text:!!customElements.get('sd-text')};`
  })) {
    await build({ stdin: { contents: code, resolveDir: consumer }, bundle: true, format: 'esm', outfile: join(consumer, entry + '.js'), logLevel: 'silent' });
    writeFileSync(join(consumer, entry + '.html'), `<!doctype html><html><body><script type="module" src="./${entry}.js"></script></body></html>`);
  }
  const chromePath = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium'].filter(Boolean).find(p => {
    if (p.includes('/')) return existsSync(p);
    try { execFileSync('which', [p], { stdio: 'ignore' }); return true; } catch { return false; }
  });
  assert(chromePath, 'Chrome is required for package registration checks; set CHROME');
  server = createServer((req, res) => {
    const path = resolve(consumer, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(consumer + '/')) { res.writeHead(403).end(); return; }
    try { res.setHeader('Content-Type', extname(path) === '.js' ? 'text/javascript' : 'text/html'); res.end(readFileSync(path)); } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', '--user-data-dir=' + join(temp, 'chrome'), 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    try { port = Number(readFileSync(join(temp, 'chrome/DevToolsActivePort'), 'utf8').split('\n')[0]); } catch { await pause(100); }
  }
  assert(port, 'Chrome did not start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, reject) => { ws.onopen = r; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id;
    const timeout = setTimeout(() => { pending.delete(request); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(request, m => { clearTimeout(timeout); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); });
    ws.send(JSON.stringify({ id: request, method, params }));
  });
  await send('Page.enable');
  for (const entry of ['full', 'core']) {
    await send('Runtime.evaluate', { expression: 'delete window.packageProbe' });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/${entry}.html` });
    let probe;
    for (let i = 0; i < 100 && !probe; i++) {
      await pause(50);
      const result = await send('Runtime.evaluate', { expression: 'window.packageProbe', returnByValue: true }); probe = result.result?.value;
    }
    assert(probe, `${entry} entry did not execute`); assert.equal(probe.same, true); assert.equal(probe.scene, true);
    assert.equal(probe.objects, entry === 'full' ? readdirSync(join(root, 'src/objects'), { withFileTypes: true }).filter(e => e.isDirectory()).length : 0); assert.equal(probe.text, entry === 'full');
    if (entry === 'core') assert.equal(probe.effects, 0);
  }
  ws.close();
  console.log(`PASS clean tarball (${packed.entryCount} files / ${packed.size} bytes), allowlist and MIT contents`);
  console.log('PASS root/core and legacy explicit imports, browser registration and side effects');
  console.log('PASS strict NodeNext and Bundler declarations, positive and negative consumer checks');
} finally {
  if (chrome && chrome.exitCode === null && chrome.signalCode === null) { await new Promise(r => { chrome.once('exit', r); chrome.kill('SIGKILL'); }); }
  if (server) await new Promise(r => server.close(r));
  rmSync(temp, { recursive: true, force: true });
}
