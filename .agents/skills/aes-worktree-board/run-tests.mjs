#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_CHILD_OPTIONS } from './scripts/headless.mjs';

const skillDir = dirname(fileURLToPath(import.meta.url));
const selftest = join(skillDir, 'scripts', 'selftest.mjs');
const domains = [
  'collect', 'fixture', 'dispatch', 'server', 'repo-root', 'layout', 'windows-hide', 'orchestration',
];

let passed = 0;
for (const domain of domains) {
  const result = spawnSync(process.execPath, [selftest, domain], {
    ...HEADLESS_CHILD_OPTIONS,
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `selftest ${domain} failed\n`);
    process.exitCode = 1;
    break;
  }
  passed += 1;
  process.stdout.write(result.stdout);
}

if (passed === domains.length) {
  console.log(JSON.stringify({ ok: true, domains: domains.length, passed }));
}
