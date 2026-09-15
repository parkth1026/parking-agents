#!/usr/bin/env node
// export-dossier.mjs — 从家族真源生成决策档案 HTML（两载体共用同一投影库）
//   档案是契约的轻量可视化预览：轨迹、候选、决定与契约原文投影进页面；来源文件（mock / diagram / 附件）
//   按相对路径引用，不内嵌正文——档案必须与 issue 目录同放才能看到原型。
//
//   node export-dossier.mjs --issue-dir <issue> [--output <html>]
//
// 纯对话载体（无 web/ 目录）从 rounds.jsonl/manifest/contract 投影；web 载体
// 追加 state/submissions/ledger 证据。输出 JSON 与 web 版 export-static 同构。
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { exportDossier } from './lib/dossier.mjs';

function fail(message, code = 1) {
  console.error(`export-dossier: ${message}`);
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
if (!flags['issue-dir']) fail('用法：export-dossier.mjs --issue-dir <issue> [--output <html>]', 2);
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
