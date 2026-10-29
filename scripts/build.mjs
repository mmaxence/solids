import * as esbuild from 'esbuild';

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
    b.onResolve({ filter: /src\/(objects|effects)\/|^\.\.?\/(objects|effects)\// }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {}; export const all = [];', loader: 'js' }));
  },
};

await Promise.all([
  esbuild.build({ ...common, outfile: 'dist/solids.js' }),
  esbuild.build({ ...common, outfile: 'dist/core.js', plugins: [stubContent] }),
]);
console.log('built dist/solids.js, dist/core.js');
