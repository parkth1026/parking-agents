#!/usr/bin/env node
// AC-002 转换保真门：D-01（冻结的 9-17 纪要正文 XML）经被测转换器（scripts/xml-to-md.mjs）
// 转换后，与 D-02（tests/fixtures/minutes-body.expected.md，由冻结原型生成，见 fixture-verification.md）
// 逐字节 diff。本脚本只读各期望文件，绝不重新生成它们（防黄金用例自指恒真）。
// G-01/G-02（li-grid-*.）：li 内嵌 grid 文本列回归对，2026-10-12 实战样本曾整列丢失；
// 期望侧为手工撰写（冻结生成器含旧缺陷，无法生成新行为），登记见 fixture-verification.md 附录。
// 用法: node verify-fixture.mjs   （cwd 任意，路径相对本文件解析）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '..', 'tests', 'fixtures');
const converter = path.join(here, 'xml-to-md.mjs');

const cases = [
  { id: 'D', xml: 'minutes-content.xml', expected: 'minutes-body.expected.md', assetsRel: '2026-09-17-WDP6-discussion-assets' },
  { id: 'G', xml: 'li-grid-content.xml', expected: 'li-grid-expected.md', assetsRel: 'TEST-ASSETS' },
];

if (!fs.existsSync(converter)) { console.error(`缺少 ${converter}`); process.exit(2); }
let failed = false;
for (const c of cases) {
  const xmlPath = path.join(fixtures, c.xml);
  const expPath = path.join(fixtures, c.expected);
  for (const f of [xmlPath, expPath]) {
    if (!fs.existsSync(f)) { console.error(`缺少 ${f}`); process.exit(2); }
  }
  const tmpOut = path.join(fixtures, `.verify-actual-${c.id}.tmp.md`);
  try {
    execFileSync(process.execPath, [converter, '--xml', xmlPath, '--out', tmpOut, '--assets-rel', c.assetsRel], { stdio: ['ignore', 'pipe', 'inherit'] });
    const actual = fs.readFileSync(tmpOut);
    const expected = fs.readFileSync(expPath);
    if (actual.equals(expected)) {
      console.log(`ok [${c.id}]: 被测转换器对 ${c.xml} 的输出与 ${c.expected} 逐字节一致（${expected.length} bytes）`);
      continue;
    }
    failed = true;
    // 定位首差异，便于排障
    const n = Math.min(actual.length, expected.length);
    let i = 0;
    while (i < n && actual[i] === expected[i]) i++;
    console.error(`FAIL [${c.id}]: 与 ${c.expected} 不一致（actual ${actual.length} B / expected ${expected.length} B，首差异 offset ${i}）`);
    console.error(`  actual:   ${JSON.stringify(actual.subarray(Math.max(0, i - 40), i + 40).toString('utf8'))}`);
    console.error(`  expected: ${JSON.stringify(expected.subarray(Math.max(0, i - 40), i + 40).toString('utf8'))}`);
  } finally {
    try { fs.rmSync(tmpOut); } catch { /* 临时文件已不存在 */ }
  }
}
process.exit(failed ? 1 : 0);
