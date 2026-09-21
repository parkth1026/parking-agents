#!/usr/bin/env node
// AC-002 转换保真门：D-01（冻结的 9-17 纪要正文 XML）经被测转换器（scripts/xml-to-md.mjs）
// 转换后，与 D-02（tests/fixtures/minutes-body.expected.md，由冻结原型生成，见 fixture-verification.md）
// 逐字节 diff。本脚本只读 D-02，绝不重新生成它（防黄金用例自指恒真）。
// 用法: node verify-fixture.mjs   （cwd 任意，路径相对本文件解析）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '..', 'tests', 'fixtures');
const d01 = path.join(fixtures, 'minutes-content.xml');
const d02 = path.join(fixtures, 'minutes-body.expected.md');
const converter = path.join(here, 'xml-to-md.mjs');

for (const f of [d01, d02, converter]) {
  if (!fs.existsSync(f)) { console.error(`缺少 ${f}`); process.exit(2); }
}

// 期望输出冻结时的 assets-rel 口径（见 fixture-verification.md 生成命令）
const ASSETS_REL = '2026-09-17-WDP6-discussion-assets';
const tmpOut = path.join(fixtures, '.verify-actual.tmp.md');
try {
  execFileSync(process.execPath, [converter, '--xml', d01, '--out', tmpOut, '--assets-rel', ASSETS_REL], { stdio: ['ignore', 'pipe', 'inherit'] });
  const actual = fs.readFileSync(tmpOut);
  const expected = fs.readFileSync(d02);
  if (actual.equals(expected)) {
    console.log(`ok: 被测转换器对 D-01 的输出与 D-02 逐字节一致（${expected.length} bytes）`);
    process.exit(0);
  }
  // 定位首差异，便于排障
  const n = Math.min(actual.length, expected.length);
  let i = 0;
  while (i < n && actual[i] === expected[i]) i++;
  console.error(`FAIL: 与 D-02 不一致（actual ${actual.length} B / expected ${expected.length} B，首差异 offset ${i}）`);
  console.error(`  actual:   ${JSON.stringify(actual.subarray(Math.max(0, i - 40), i + 40).toString('utf8'))}`);
  console.error(`  expected: ${JSON.stringify(expected.subarray(Math.max(0, i - 40), i + 40).toString('utf8'))}`);
  process.exit(1);
} finally {
  try { fs.rmSync(tmpOut); } catch { /* 临时文件已不存在 */ }
}
