import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
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

// Core build: everything under src/objects and src/effects becomes an empty module,
// so the size check can measure the engine without its content.
const stubContent = {
  name: 'stub-content',
  setup(b) {
    b.onResolve({ filter: /src\/(objects|effects)(\/|$)|^\.\.?\/(objects|effects)(\/|$)/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {}; export const all = [];', loader: 'js' }));
  },
};

await Promise.all([
  esbuild.build({ ...common, outfile: 'dist/solids.js' }),
  esbuild.build({ ...common, outfile: 'dist/core.js', plugins: [stubContent] }),
]);
// Gzipped bytes, read by the site (hero pitch, Performance page) and verified by the check.
const gz = (f) => gzipSync(readFileSync(f)).length;
writeFileSync('dist/sizes.json', JSON.stringify({ core: gz('dist/core.js'), full: gz('dist/solids.js') }) + '\n');
console.log('built dist/solids.js, dist/core.js, dist/sizes.json');
