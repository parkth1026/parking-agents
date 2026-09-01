#!/usr/bin/env node

// 标准技能根部回归入口；黑盒用例放 scripts/ 下，逐个以子进程跑并汇总退出码。
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const suites = ['session.test.mjs', 'validate-goal-contract.test.mjs', 'export-dossier.test.mjs'];
let failed = 0;
for (const suite of suites) {
  const res = spawnSync(process.execPath, [join(HERE, 'scripts', suite)], { stdio: 'inherit' });
  if (res.status !== 0) failed = 1;
}
process.exit(failed);
