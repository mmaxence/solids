import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Emit from the implementation, then make the declaration graph valid for native
// NodeNext consumers as well as bundlers. Runtime JS and hosted paths are unchanged.
rmSync('dist/types', { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.declarations.json'], { stdio: 'inherit' });
function rewrite(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) rewrite(file);
    else if (file.endsWith('.d.ts')) {
      const source = readFileSync(file, 'utf8').replace(/(['"])(\.\.?\/[^'"\n]+)\1/g, (match, quote, specifier) => {
        if (/\.(?:js|json|glsl)$/.test(specifier)) return match;
        // Some source imports address directories; declarations use explicit files.
        const target = join(dir, specifier);
        const suffix = (() => { try { return readdirSync(target).includes('index.d.ts') ? '/index.js' : '.js'; } catch { return '.js'; } })();
        return quote + specifier + suffix + quote;
      });
      writeFileSync(file, source);
    }
  }
}
rewrite('dist/types');
const core = `import { SdScene } from './core/scene.js';
import { SdObject, defineObject, reflect } from './core/object.js';
import { SdUniverse, PALETTE } from './core/universe.js';
import * as registry from './core/registry.js';
export { SdScene, SdUniverse, SdObject, defineObject, reflect, registry, PALETTE };
declare global {
  interface HTMLElementTagNameMap {
    'sd-scene': SdScene;
    'sd-universe': SdUniverse;
  }
}
`;
writeFileSync('dist/types/core.d.ts', core);
const tags = readdirSync('src/objects', { withFileTypes: true }).filter(e => e.isDirectory()).map(e => JSON.parse(readFileSync(`src/objects/${e.name}/manifest.json`, 'utf8')).tag).sort();
writeFileSync('dist/types/index.d.ts', readFileSync('dist/types/index.d.ts', 'utf8') + `
// Registration is a side effect of the full entry only; core does not register shapes.
declare global {
  interface HTMLElementTagNameMap {
    'sd-scene': SdScene;
    'sd-universe': SdUniverse;
    'sd-text': import('./text/index.js').SdText;
${tags.map(tag => `    '${tag}': SdObject;`).join('\n')}
  }
}
`);
console.log('Emitted public declarations and browser element types in dist/types.');
