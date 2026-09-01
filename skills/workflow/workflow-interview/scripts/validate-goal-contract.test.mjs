#!/usr/bin/env node
/**
 * validate-goal-contract.test.mjs — 契约校验器的黑盒回归测试
 *
 * 跑法：node validate-goal-contract.test.mjs
 * 全绿退出 0；有失败逐条打印并退出 1。
 *
 * 与 session.test.mjs 同一手法：只走进程边界，临时目录写 fixture 契约，
 * spawnSync 真实校验器，断言退出码与输出文案。不碰真仓库。
 */

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VALIDATOR = join(dirname(fileURLToPath(import.meta.url)), 'validate-goal-contract.mjs');
const ROOT = mkdtempSync(join(tmpdir(), 'contract-validate-test-'));

let total = 0;
let failed = 0;
let seq = 0;

function check(name, cond, detail = '') {
  total += 1;
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? `\n     ${detail.replace(/\r?\n/g, '\n     ')}` : ''}`);
  }
}

function validate(md) {
  const p = join(ROOT, `c${String(++seq).padStart(2, '0')}.md`);
  writeFileSync(p, md, 'utf8');
  return spawnSync(process.execPath, [VALIDATOR, p], { encoding: 'utf8' });
}

/** 骨架契约：换掉 Verify 行即可构造各形态。 */
const skeleton = (verifyLine) => [
  '# Goal Contract: 校验占位',
  '',
  '## 目标',
  '',
  '一句话占位目标可观察。',
  '',
  '## 验收条件',
  '',
  '- AC-001: 一个可判定的占位结果',
  `  - Verify: ${verifyLine}`,
  '',
].join('\n');

// ── 基线与首档规则 ──

check('validate/基线合法契约通过',
  validate(skeleton('[A] `node -e "process.exit(1)"` → 退出码 1')).status === 0);
{
  const res = validate(skeleton('[A] 跑现有测试断言通过'));
  check('validate/首档 [A] 缺反引号拒收', res.status === 1 && `${res.stdout}`.includes('必须用反引号'), `${res.stdout}`.slice(0, 300));
}
check('validate/缺验收条件拒收',
  validate('# Goal Contract: t\n\n## 目标\n\n占位。\n').status === 1);
{
  const res = validate(skeleton('人工对照走查一遍'));
  check('validate/Verify 缺档位标记拒收', res.status === 1 && `${res.stdout}`.includes('先标档位'), `${res.stdout}`.slice(0, 300));
}

// ── 内嵌档段：首档遮蔽的对称修复 ──

{
  const res = validate(skeleton('[C] 人工对照 mock 逐处看；[A] 跑现有测试 → 退出码 0'));
  check('validate/内嵌 [A] 缺反引号拒收', res.status === 1 && `${res.stdout}`.includes('内嵌 [A] 段必须用反引号'), `${res.stdout}`.slice(0, 300));
}
check('validate/内嵌 [A] 带反引号放行',
  validate(skeleton('[C] 人工对照 mock 逐处看；[A] `node -e "process.exit(1)"` → 退出码 1')).status === 0);
{
  const res = validate(skeleton('[C] 人工步骤；[B] fixture 报文对匹配'));
  check('validate/内嵌 [B] 缺反引号只警告',
    res.status === 0 && `${res.stdout}`.includes('WARNING') && `${res.stdout}`.includes('内嵌 [B]'),
    `${res.stdout}`.slice(0, 300));
}
{
  // 多个内嵌段：第二个 [A] 缺反引号同样拒收，第一个带命令不算数。
  const res = validate(skeleton('[C] 人工步骤；[A] `node -e "process.exit(1)"` → 红；[A] 再跑一遍冒烟'));
  check('validate/多内嵌段逐段校验', res.status === 1 && `${res.stdout}`.includes('内嵌 [A] 段必须用反引号'), `${res.stdout}`.slice(0, 300));
}

console.log(`\n${total - failed}/${total} 通过`);
rmSync(ROOT, { recursive: true, force: true });
process.exit(failed > 0 ? 1 : 0);
