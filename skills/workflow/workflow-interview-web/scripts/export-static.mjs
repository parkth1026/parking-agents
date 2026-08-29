#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
// 投影实现随家族分发（决策档案是核心逻辑，两载体共用同一份）；本脚本只是 web 侧 CLI 壳。
import { exportDossier } from '../../workflow-interview/scripts/lib/dossier.mjs';

function fail(message, code = 1) {
  console.error(`export-static: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else {
      flags[key] = next;
      index += 1;
    }
  }
  return flags;
}

const flags = parseArgs(process.argv.slice(2));
if (!flags['issue-dir']) fail('用法：export-static.mjs --issue-dir <issue> [--output <html>]', 2);
const issueDir = resolve(String(flags['issue-dir']));
if (!existsSync(issueDir) || !statSync(issueDir).isDirectory()) fail(`issue 目录不存在：${issueDir}`, 2);
const output = flags.output === undefined ? undefined : resolve(String(flags.output));

const { pathname, dossier } = exportDossier(issueDir, output);
console.log(JSON.stringify({
  ok: true,
  type: 'decision-dossier-exported',
  path: pathname,
  state_digest: dossier.state_digest,
  dossier_digest: dossier.dossier_digest,
  ledger_events: dossier.ledger.length,
  sources: dossier.sources.length,
}));
