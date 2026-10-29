// Dev server on 4110: rebuilds the bundle and regenerates the site on change.
import * as esbuild from 'esbuild';
import { watch } from 'node:fs';
import { execFileSync } from 'node:child_process';

const run = (s) => { try { execFileSync('node', [s], { stdio: 'inherit' }); } catch {} };
run('scripts/build.mjs');
run('scripts/gen-site.mjs');
let t;
const regen = () => { clearTimeout(t); t = setTimeout(() => { run('scripts/build.mjs'); run('scripts/gen-site.mjs'); }, 150); };
for (const d of ['src', 'site/src', 'docs']) watch(d, { recursive: true }, regen);
const ctx = await esbuild.context({ entryPoints: [], outdir: 'site/dist' });
const { port } = await ctx.serve({ servedir: 'site/dist', port: 4110, host: '127.0.0.1' });
console.log(`solids site: http://127.0.0.1:${port}/  (repo root also at /?)`);
