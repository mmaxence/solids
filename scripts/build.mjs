import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  minify: true,
  sourcemap: true,
  target: 'es2020',
  loader: { '.glsl': 'text' },
  logLevel: 'warning',
};

// Core build: everything under src/objects, src/effects, src/interactions and src/text becomes an empty module,
// so the size check measures the engine without its content (objects, effects and interactions are registry content).
const stubContent = {
  name: 'stub-content',
  setup(b) {
    b.onResolve({ filter: /src\/(objects|effects|interactions|text)(\/|$)|^\.\.?\/(objects|effects|interactions|text)(\/|$)/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {}; export const all = [];', loader: 'js' }));
  },
};

await Promise.all([
  esbuild.build({ ...common, outfile: 'dist/solids.js' }),
  esbuild.build({ ...common, outfile: 'dist/core.js', plugins: [stubContent] }),
]);
const gz = (f) => (gzipSync(readFileSync(f)).length / 1024).toFixed(1) + ' KB';
console.log(`built dist/solids.js (${gz('dist/solids.js')} gzipped), dist/core.js (${gz('dist/core.js')})`);
