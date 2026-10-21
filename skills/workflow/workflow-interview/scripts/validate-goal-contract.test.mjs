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

import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
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

{
  const detailed = skeleton('[D] 对照确认的业务结果和消费者示例').replace('一句话占位目标可观察。',
    '- 下游脚本可稳定读取结果。\n- 既有消费者仍能工作。\n\n' + '必要的背景与期望结果需要完整表达。'.repeat(45));
  check('validate/多段列表长目标不因形式拒收', validate(detailed).status === 0);
  check('validate/空目标仍拒收', validate(skeleton('[D] 对照具体结果').replace('一句话占位目标可观察。', '')).status === 1);
}

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


{
  const base=skeleton('[D] 检查可取得的文件正文内容');
  check('validate/稳定AC允许缺号',validate(base.replace('AC-001','AC-003')).status===0);
  const extra=Array.from({length:8},(_,i)=>'- AC-'+String(i+1).padStart(3,'0')+': 第'+(i+1)+'个独立且可观察的验收结果\n  - Verify: [D] 检查具名文件的实际正文内容').join('\n');
  check('validate/不按AC数量强制拆分',validate('## 目标\n\n完整且可观察的目标。\n\n## 验收条件\n\n'+extra).status===0);
  check('validate/重复AC身份仍拒收',validate(base+'\n- AC-001: 另一个可观察的具体结果\n  - Verify: [D] 检查具名文件的实际正文内容').status===1);
  const source=join(ROOT,'source.svg');
  writeFileSync(source,'<svg/>');
  check('validate/自由载体的实际引用可取得',validate(base+'\n## 读什么\n\n- `'+source.replaceAll('\\','/')+'`').status===0);
  check('validate/声明缺失依据仍拒收',validate(base+'\n## 读什么\n\n- `../2-prototype/missing.svg`').status===1);
  check('validate/不因引用过程来源名称拒收',validate(base+'\n说明：调查结论也可在 rounds.jsonl 中追溯。').status===0);
}

{
  const p=join(dirname(fileURLToPath(import.meta.url)),'..','references','..','..','aes-goal-contract','references','goal-contract-shape.md');
  const template=readFileSync(p,'utf8').match(/~~~markdown\n([\s\S]*?)\n~~~/)[1];
  check('validate/当前文档模板直接可校验',validate(template).status===0);
  check('validate/自主边界接受有效段落',validate(skeleton('[D] 检查实际文件的有效内容')+'\n## 自主边界\n\nAgent在已授权范围内自行选择内部实现。').status===0);
}
console.log(`\n${total - failed}/${total} 通过`);
rmSync(ROOT, { recursive: true, force: true });
process.exit(failed > 0 ? 1 : 0);
