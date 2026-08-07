import { audit } from '../src/audit.mjs';
import { strict as assert } from 'node:assert';
import { writeFileSync, rmSync } from 'node:fs';

writeFileSync('tmp-ok.json', JSON.stringify({ name: 'x' }));
writeFileSync('tmp-bad.json', JSON.stringify({ debug: true }));
assert.equal(audit('tmp-ok.json').length, 0);
assert.equal(audit('tmp-bad.json').length, 2);
rmSync('tmp-ok.json'); rmSync('tmp-bad.json');
console.log('all tests passed');
