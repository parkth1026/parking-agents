#!/usr/bin/env node
/**
 * session.test.mjs — session.mjs 阶段闸门的黑盒回归测试
 *
 * 跑法：node session.test.mjs
 * 全绿退出 0；有失败逐条打印并退出 1。
 *
 * 只走进程边界：spawnSync 真实调用子命令，断言退出码、输出文案和盘上文件。
 * 不 import session.mjs 的内部函数——闸门的消费者（Agent）看到的就是 CLI 行为，
 * 测试口径和使用口径保持一致。测试在 os.tmpdir 下伪造带 .git 的仓库根，不碰真仓库。
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SESSION = join(dirname(fileURLToPath(import.meta.url)), 'session.mjs');
const ROOT = mkdtempSync(join(tmpdir(), 'session-gate-test-'));
mkdirSync(join(ROOT, '.git'), { recursive: true });

// ─────────────────────────────── 断言与调用 ───────────────────────────────

let total = 0;
let failed = 0;

function check(name, cond, detail = '') {
  total += 1;
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? `\n     ${detail.replace(/\r?\n/g, '\n     ')}` : ''}`);
  }
}

function run(...args) {
  return spawnSync(process.execPath, [SESSION, ...args], { cwd: ROOT, encoding: 'utf8' });
}

/** 断言退出码，可选断言 stdout+stderr 里含某段文案。 */
function expect(name, res, code, needle) {
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (res.status !== code) {
    check(name, false, `exit=${res.status}，期望 ${code}\n${out.trim().slice(0, 500)}`);
  } else if (needle && !out.includes(needle)) {
    check(name, false, `输出里找不到「${needle}」\n${out.trim().slice(0, 500)}`);
  } else {
    check(name, true);
  }
}

// ─────────────────────────────── fixture ───────────────────────────────

const CONTEXT = ['任务陈述', '用户提出的方案', '意图假设', '已查事实', '验证基建候选池', '四分类']
  .map((s) => `## ${s}\n\n占位内容。`).join('\n\n');
const IMPACT = `# 影响面\n\n${['用户可见界面', '可观察行为', '可运行输出', '对外接口报文', '用户配置', '历史兼容性']
  .map((s) => `- ${s}：无`).join('\n')}\n`;
const ROUND_OK = JSON.stringify({ stage: '1-interview', round: 1, tier: 'default', item: '占位决定' });
const ASSESS = JSON.stringify({ 意图: '已定', 结果: '已定', 边界: '已定', 约束: '已定', 现状: '已定' });

let seq = 0;
function mkIssue({ interview = false, impact = false, artifacts = [] } = {}) {
  const slug = `t${String(++seq).padStart(2, '0')}`;
  const r = run('init', slug);
  if (r.status !== 0) throw new Error(`init ${slug} 失败：${r.stderr}`);
  const dir = join(ROOT, '.aes-workflow', 'grilling', slug);
  if (interview) {
    writeFileSync(join(dir, '1-interview', 'context.md'), CONTEXT, 'utf8');
    writeFileSync(join(dir, '1-interview', 'rounds.jsonl'), `${ROUND_OK}\n`, 'utf8');
  }
  if (impact) writeFileSync(join(dir, '2-prototype', 'impact-surface.md'), IMPACT, 'utf8');
  for (const f of artifacts) writeFileSync(join(dir, '2-prototype', f), '对照物占位。\n', 'utf8');
  return dir;
}

const manifest = (dir) => JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const doneInterview = (dir) => run('stage', dir, '1-interview', 'done', '--assessment', ASSESS);
const askRow = (pcts) => JSON.stringify({
  stage: '1-interview',
  round: 1,
  tier: 'ask',
  question: '选哪个？',
  options: pcts.map((pct, i) => ({ key: String.fromCharCode(97 + i), text: `选项${i}`, pct })),
});

// ─────────────────────────────── round：行级 schema ───────────────────────────────

{
  const dir = mkIssue();
  expect('round/default 合法行落盘', run('round', dir, ROUND_OK), 0, 'appended');
  expect('round/default 缺 item 拒收', run('round', dir, JSON.stringify({ stage: '1-interview', round: 1, tier: 'default' })), 1, 'item');
  expect('round/tier 非法拒收', run('round', dir, JSON.stringify({ stage: '1-interview', round: 1, tier: 'guess', item: 'x' })), 1, 'tier');
  expect('round/缺 stage 拒收', run('round', dir, JSON.stringify({ round: 1, tier: 'default', item: 'x' })), 1, 'stage');
  expect('round/非法 JSON 用法错', run('round', dir, '{oops'), 2, '不是合法 JSON');
  expect('round/ask 缺 question 拒收', run('round', dir, JSON.stringify({ stage: '1-interview', round: 1, tier: 'ask' })), 1, 'question');
  expect('round/ask options 空数组拒收', run('round', dir, JSON.stringify({ stage: '1-interview', round: 1, tier: 'ask', question: 'q', options: [] })), 1, '非空数组');
  expect('round/ask option 缺 pct 拒收', run('round', dir, JSON.stringify({ stage: '1-interview', round: 1, tier: 'ask', question: 'q', options: [{ key: 'a', text: 'x' }] })), 1, 'pct');
  expect('round/pct 加和 97 超容差拒收', run('round', dir, askRow([50, 30, 17])), 1, '100±2');
  expect('round/pct 加和 99 容差内放行', run('round', dir, askRow([33, 33, 33])), 0, 'appended');
  expect('round/pct 加和 100 放行', run('round', dir, askRow([60, 40])), 0, 'appended');
  expect('round/pct 加和 103 超容差拒收', run('round', dir, askRow([60, 43])), 1, '100±2');
}

// ─────────────────────────────── stage：参数校验 ───────────────────────────────

{
  const dir = mkIssue();
  expect('stage/非法阶段名用法错', run('stage', dir, '9-nope', 'done'), 2, '阶段名');
  expect('stage/非法状态用法错', run('stage', dir, '1-interview', 'perfect'), 2, '状态');
}

// ─────────────────────────────── 1-interview done 闸门 ───────────────────────────────

{
  const dir = mkIssue();
  expect('gate1/空目录报 done 拒收', doneInterview(dir), 1, 'context.md 不存在');
  check('gate1/拒收后 manifest 未被写入', manifest(dir).stage_gates['1-interview'].status === 'pending',
    `status=${manifest(dir).stage_gates['1-interview'].status}`);
}
{
  const dir = mkIssue({ interview: true });
  expect('gate1/产物齐全 + 五维已定放行', doneInterview(dir), 0);
}
{
  const dir = mkIssue({ interview: true });
  expect('gate1/自评停在「未定」拒收',
    run('stage', dir, '1-interview', 'done', '--assessment', JSON.stringify({ 意图: '已定', 结果: '未定', 边界: '已定', 约束: '已定', 现状: '已定' })),
    1, '未定');
  expect('gate1/缺自评拒收', run('stage', dir, '1-interview', 'done'), 1, '五维自评');
}
{
  const dir = mkIssue({ interview: true });
  writeFileSync(join(dir, '1-interview', 'context.md'), CONTEXT.replace('## 四分类', '## 其它'), 'utf8');
  expect('gate1/context.md 缺节拒收', doneInterview(dir), 1, '四分类');
}
{
  const dir = mkIssue({ interview: true });
  writeFileSync(join(dir, '1-interview', 'rounds.jsonl'), `${JSON.stringify({ stage: '1-interview', round: 1, tier: 'default' })}\n`, 'utf8');
  expect('gate1/rounds.jsonl 有坏行拒收', doneInterview(dir), 1, 'rounds.jsonl 第 1 行');
}

// ─────────────────────────────── 2-prototype done 闸门 ───────────────────────────────

{
  const dir = mkIssue();
  expect('gate2/缺 impact-surface 拒收', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior'), 1, 'impact-surface.md 不存在');
}
{
  const dir = mkIssue({ impact: true });
  expect('gate2/无 --artifacts 拒收', run('stage', dir, '2-prototype', 'done'), 1, '至少要用 --artifacts');
  expect('gate2/artifacts 指向不存在的文件拒收', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior'), 1, '找不到对应文件');
  expect('gate2/impact-surface 凑数拒收', run('stage', dir, '2-prototype', 'done', '--artifacts', 'impact-surface'), 1, '凑不了数');
}
{
  const dir = mkIssue({ impact: true, artifacts: ['behavior.md'] });
  expect('gate2/behavior.md 在盘放行', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior'), 0);
}
{
  const dir = mkIssue({ impact: true, artifacts: ['custom-view.md'] });
  expect('gate2/自定义命名对照物放行', run('stage', dir, '2-prototype', 'done', '--artifacts', 'custom-view'), 0);
}

// ─────────────────────────────── skipped：只许 2-prototype，且六面在盘 ───────────────────────────────

{
  const dir = mkIssue({ interview: true, impact: true });
  expect('skip/1-interview 不能 skipped', run('stage', dir, '1-interview', 'skipped', '--reason', 'x'), 1, '不能 skipped');
  expect('skip/3-contract 不能 skipped', run('stage', dir, '3-contract', 'skipped', '--reason', 'x'), 1, '不能 skipped');
  expect('skip/2-prototype 无 reason 拒收', run('stage', dir, '2-prototype', 'skipped'), 1, '--reason');
}
{
  const dir = mkIssue({ interview: true });
  expect('skip/无 impact-surface 拒收', run('stage', dir, '2-prototype', 'skipped', '--reason', '差异极小'), 1, '不豁免六面扫描');
}
{
  const dir = mkIssue({ interview: true, impact: true });
  doneInterview(dir);
  expect('skip/六面在盘 + reason 放行', run('stage', dir, '2-prototype', 'skipped', '--reason', '差异极小'), 0);
  const m = manifest(dir);
  check('skip/放行后推进到 3-contract 而非 ready', m.stage === '3-contract' && m.status === 'in_progress',
    `stage=${m.stage} status=${m.status}`);
}

// ─────────────────────────────── 3-contract done 闸门 ───────────────────────────────

{
  const dir = mkIssue();
  expect('gate3/无 contract.md 拒收', run('stage', dir, '3-contract', 'done'), 1, 'contract.md 不存在');
  writeFileSync(join(dir, '3-contract', 'contract.md'), '## 目标\n\n占位。\n', 'utf8');
  expect('gate3/finalize 没跑过拒收', run('stage', dir, '3-contract', 'done'), 1, 'finalize');
}

// ─────────────────────────────── rebuild：与 done 闸门同口径 ───────────────────────────────

{
  const dir = mkIssue({ impact: true, artifacts: ['custom-view.md'] });
  run('stage', dir, '2-prototype', 'done', '--artifacts', 'custom-view');
  unlinkSync(join(dir, 'manifest.json'));
  expect('rebuild/manifest 损坏可重建', run('rebuild', dir), 0);
  const m = manifest(dir);
  check('rebuild/自定义命名对照物恢复为 done',
    m.stage_gates['2-prototype'].status === 'done' && m.stage_gates['2-prototype'].artifacts_confirmed.includes('custom-view'),
    JSON.stringify(m.stage_gates['2-prototype']));
}
{
  const dir = mkIssue({ interview: true, impact: true });
  doneInterview(dir);
  run('stage', dir, '2-prototype', 'skipped', '--reason', '差异极小');
  run('rebuild', dir);
  const g = manifest(dir).stage_gates['2-prototype'];
  check('rebuild/保留 skipped 裁决与 reason', g.status === 'skipped' && g.reason === '差异极小', JSON.stringify(g));
}

// ─────────────────────────────── verify / finalize / 其它 ───────────────────────────────

{
  const dir = mkIssue();
  expect('verify/无 contract.md 用法错', run('verify', dir), 2, '不存在');
  expect('finalize/无 contract.md 用法错', run('finalize', dir), 2, '不存在');
  writeFileSync(join(dir, '3-contract', 'contract.md'),
    '## 验收条件\n\n- AC-001: 界面按 mock 呈现\n  - Verify: [C] 人工对照 mock 逐处看\n', 'utf8');
  expect('verify/全非 [A] 档时无可执行项', run('verify', dir), 0, '没有 [A] 档');
}
{
  const dir = mkIssue();
  const slug = dir.split(/[\\/]/).pop();
  expect('init/幂等续跑不覆盖', run('init', slug), 0, '已存在');
}
{
  const dir = mkIssue({ interview: true, impact: true });
  doneInterview(dir);
  expect('reinterview/2-prototype 打回', run('stage', dir, '2-prototype', 'needs_reinterview', '--reason', '撞出歧义'), 0);
  const m = manifest(dir);
  check('reinterview/回到 1-interview 且 next_action 更新',
    m.stage === '1-interview' && m.stage_gates['1-interview'].status === 'in_progress' && m.next_action.includes('撞出'),
    `stage=${m.stage} next=${m.next_action}`);
}

// ─────────────────────────────── 收尾 ───────────────────────────────

console.log(`\n${total - failed}/${total} 通过`);
rmSync(ROOT, { recursive: true, force: true });
process.exit(failed > 0 ? 1 : 0);
