import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];

const files = readdirSync(here)
  .filter((f) => f.endsWith('.test.mjs'))
  .filter((f) => (only ? f.includes(only) : true))
  .sort();

let passed = 0;
let failed = 0;

for (const file of files) {
  const mod = await import(pathToFileURL(join(here, file)).href);
  for (const [name, fn] of Object.entries(mod)) {
    if (!name.startsWith('test')) continue;
    try {
      await fn();
      passed += 1;
      process.stdout.write(`ok   ${file} :: ${name}\n`);
    } catch (err) {
      failed += 1;
      process.stdout.write(`FAIL ${file} :: ${name}\n     ${err.message}\n`);
    }
  }
}

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
