// solids check: the whole test suite, no framework.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

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

sizes();

if (fails.length) { console.error(`\n${fails.length} failure(s)`); process.exit(1); }
console.log('ok');
