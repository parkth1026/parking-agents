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

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, existsSync, utimesSync } from 'node:fs';
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
const SURFACES = ['用户可见界面', '可观察行为', '可运行输出', '对外接口报文', '用户配置', '历史兼容性', '架构与依赖'];
// IMPACT_LEGACY 靠「架构与依赖」是最后一面来派生；往中间插面时这行会先炸，逼着同步改。
if (SURFACES[SURFACES.length - 1] !== '架构与依赖') {
  rmSync(ROOT, { recursive: true, force: true });
  throw new Error('IMPACT_LEGACY 依赖「架构与依赖」是 SURFACES 最后一面，调整面序请同步改测试。');
}
const impactOf = (surfaces) => `# 影响面\n\n${surfaces.map((s) => `- ${s}：无`).join('\n')}\n`;
const IMPACT = impactOf(SURFACES);
// 七面闸门之前的存量写法：缺「架构与依赖」，用来验新增的第七面拒收/降级行为。
const IMPACT_LEGACY = impactOf(SURFACES.slice(0, -1));
// 第七面判「有」的在野写法：bullet、表格（加粗单元格）、判「有」措辞、面名加粗。
const IMPACT_ARCH_YES = `# 影响面\n\n${SURFACES.slice(0, -1).map((s) => `- ${s}：无`).join('\n')}\n- 架构与依赖：有\n`;
const IMPACT_ARCH_YES_TABLE = `# 影响面\n\n| 影响面 | 判 |\n| --- | --- |\n${SURFACES.map((s) => `| ${s} | ${s === '架构与依赖' ? '**有**' : '无'} |`).join('\n')}\n`;
const IMPACT_ARCH_YES_VERDICT = `# 影响面\n\n${SURFACES.slice(0, -1).map((s) => `- ${s}：无`).join('\n')}\n- 架构与依赖：判「有」\n`;
const IMPACT_ARCH_YES_BOLD = `# 影响面\n\n${SURFACES.slice(0, -1).map((s) => `- ${s}：无`).join('\n')}\n- **架构与依赖**：有\n`;
const ROUND_OK = JSON.stringify({ stage: '1-interview', round: 1, tier: 'default', item: '占位决定' });
const ASSESS = JSON.stringify({ 意图: '已定', 结果: '已定', 边界: '已定', 约束: '已定', 现状: '已定' });

let seq = 0;
function mkIssue({ interview = false, impact = false, legacyImpact = false, artifacts = [] } = {}) {
  const slug = `t${String(++seq).padStart(2, '0')}`;
  const r = run('init', slug);
  if (r.status !== 0) throw new Error(`init ${slug} 失败：${r.stderr}`);
  const dir = join(ROOT, '.aes-workflow', 'grilling', slug);
  if (interview) {
    writeFileSync(join(dir, '1-interview', 'context.md'), CONTEXT, 'utf8');
    writeFileSync(join(dir, '1-interview', 'rounds.jsonl'), `${ROUND_OK}\n`, 'utf8');
  }
  // impact 传 true 用七面全「无」的默认 fixture，传字符串用指定版本（判「有」等变体）。
  if (impact) writeFileSync(join(dir, '2-prototype', 'impact-surface.md'), impact === true ? IMPACT : impact, 'utf8');
  if (legacyImpact) writeFileSync(join(dir, '2-prototype', 'impact-surface.md'), IMPACT_LEGACY, 'utf8');
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

// ─────────────────────── round：response 结构化应答 ───────────────────────

{
  const dir = mkIssue();
  const multiRow = (response, options) => JSON.stringify({
    stage: '1-interview', round: 1, tier: 'ask', question: '覆盖哪些范围？',
    response, options,
  });
  const noPctOptions = [
    { key: 'A', text: '任务原文', covers: '保留目标语境' },
    { key: 'B', text: '全部决策', pros: ['可复盘'] },
    { key: 'C', text: '只留摘要', cons: ['无法解释为什么'] },
  ];
  // 多选选项是候选集合不是互斥概率：不带 pct 必须能落进家族真源（与 web 发布 schema 同口径）。
  expect('round/multi_select 无 pct 放行',
    run('round', dir, multiRow({ type: 'multi_select', min: 1, max: 2 }, noPctOptions)), 0, 'appended');
  {
    const line = readFileSync(join(dir, '1-interview', 'rounds.jsonl'), 'utf8').trim().split(/\r?\n/).pop();
    const obj = JSON.parse(line);
    check('round/min/max 别名正规化为 min_selections/max_selections',
      obj.response.min_selections === 1 && obj.response.max_selections === 2
      && obj.response.min === undefined && obj.response.max === undefined,
      JSON.stringify(obj.response));
  }
  expect('round/min 与 min_selections 冲突拒收',
    run('round', dir, multiRow({ type: 'multi_select', min: 1, min_selections: 2, max_selections: 2 }, noPctOptions)), 1, '不一致');
  expect('round/response.type 未知拒收',
    run('round', dir, multiRow({ type: 'dropdown' }, noPctOptions)), 1, 'response.type');
  expect('round/response 非对象拒收',
    run('round', dir, multiRow('multi_select', noPctOptions)), 1, 'response 要是对象');
  expect('round/single_select 显式声明仍强制 pct',
    run('round', dir, multiRow({ type: 'single_select' }, noPctOptions)), 1, 'pct');
  expect('round/multi_select 选项缺 key 拒收',
    run('round', dir, multiRow({ type: 'multi_select' }, [{ text: '没 key' }])), 1, 'key');
  expect('round/multi_select 选项 pct 非数字拒收',
    run('round', dir, multiRow({ type: 'multi_select' }, [{ key: 'A', text: 'x', pct: '高' }])), 1, 'pct');
  // 无 response 缺省 single_select：老规则原样生效，防止本次放宽把单选闸门一起放掉。
  expect('round/无 response 缺省单选仍强制 pct',
    run('round', dir, JSON.stringify({ stage: '1-interview', round: 1, tier: 'ask', question: 'q', options: noPctOptions })), 1, 'pct');
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
{
  const dir = mkIssue({ legacyImpact: true, artifacts: ['behavior.md'] });
  expect('gate2/缺第七面「架构与依赖」done 拒收', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior'), 1, '架构与依赖');
  check('gate2/第七面拒收后 manifest 未被写入', manifest(dir).stage_gates['2-prototype'].status === 'pending',
    `status=${manifest(dir).stage_gates['2-prototype'].status}`);
}
{
  const dir = mkIssue({ impact: true, artifacts: ['diagram.html'] });
  expect('gate2/--artifacts diagram 命中 .html 候选', run('stage', dir, '2-prototype', 'done', '--artifacts', 'diagram'), 0);
}
{
  const dir = mkIssue({ impact: IMPACT_ARCH_YES, artifacts: ['behavior.md'] });
  expect('gate2/判「有」缺 diagram 拒收', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior'), 1, '必须包含 diagram');
}
{
  // 拿 diagram.md 文本文件顶名不算图——联动锚定 diagram.html 本尊在盘。
  const dir = mkIssue({ impact: IMPACT_ARCH_YES, artifacts: ['behavior.md', 'diagram.md'] });
  expect('gate2/判「有」用 diagram.md 顶名仍拒收', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior,diagram'), 1, '必须包含 diagram');
}
{
  const dir = mkIssue({ impact: IMPACT_ARCH_YES, artifacts: ['behavior.md', 'diagram.html'] });
  expect('gate2/判「有」+ diagram 放行', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior,diagram'), 0);
}
{
  // missingArtifacts 认可带扩展名写法（第三候选=原名），联动按去扩展名比较，同口径放行。
  const dir = mkIssue({ impact: IMPACT_ARCH_YES, artifacts: ['behavior.md', 'diagram.html'] });
  expect('gate2/判「有」diagram.html 带扩展名写法放行', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior,diagram.html'), 0);
}
{
  const dir = mkIssue({ impact: IMPACT_ARCH_YES_TABLE, artifacts: ['behavior.md'] });
  expect('gate2/表格格式判「有」同样触发联动', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior'), 1, '必须包含 diagram');
}
{
  const dir = mkIssue({ impact: IMPACT_ARCH_YES_VERDICT, artifacts: ['behavior.md'] });
  expect('gate2/「判『有』」措辞同样触发联动', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior'), 1, '必须包含 diagram');
}
{
  const dir = mkIssue({ impact: IMPACT_ARCH_YES_BOLD, artifacts: ['behavior.md'] });
  expect('gate2/面名加粗写法同样触发联动', run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior'), 1, '必须包含 diagram');
}

// ─────────────────────────────── skipped：只许 2-prototype，且七面在盘 ───────────────────────────────

{
  const dir = mkIssue({ interview: true, impact: true });
  expect('skip/1-interview 不能 skipped', run('stage', dir, '1-interview', 'skipped', '--reason', 'x'), 1, '不能 skipped');
  expect('skip/3-contract 不能 skipped', run('stage', dir, '3-contract', 'skipped', '--reason', 'x'), 1, '不能 skipped');
  expect('skip/2-prototype 无 reason 拒收', run('stage', dir, '2-prototype', 'skipped'), 1, '--reason');
}
{
  const dir = mkIssue({ interview: true });
  expect('skip/无 impact-surface 拒收', run('stage', dir, '2-prototype', 'skipped', '--reason', '差异极小'), 1, '不豁免七面扫描');
}
{
  const dir = mkIssue({ interview: true, legacyImpact: true });
  expect('skip/缺第七面「架构与依赖」拒收', run('stage', dir, '2-prototype', 'skipped', '--reason', '差异极小'), 1, '架构与依赖');
}
{
  const dir = mkIssue({ interview: true, impact: true });
  doneInterview(dir);
  expect('skip/七面在盘 + reason 放行', run('stage', dir, '2-prototype', 'skipped', '--reason', '差异极小'), 0);
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
  const dir = mkIssue({ impact: true, artifacts: ['behavior.md', 'diagram.html'] });
  run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior,diagram');
  // 换回缺第七面的存量 impact-surface：rebuild 与 done 闸门同口径，应降级
  writeFileSync(join(dir, '2-prototype', 'impact-surface.md'), IMPACT_LEGACY, 'utf8');
  expect('rebuild/缺第七面「架构与依赖」时 2-prototype 降级', run('rebuild', dir), 0);
  const m = manifest(dir);
  check('rebuild/降级后 issue 不再 ready',
    m.stage_gates['2-prototype'].status === 'in_progress' && m.status === 'in_progress',
    JSON.stringify({ gate: m.stage_gates['2-prototype'].status, stage: m.stage, status: m.status }));
  check('rebuild/降级保留已确认对照物清单',
    (m.stage_gates['2-prototype'].artifacts_confirmed || []).includes('diagram'),
    JSON.stringify(m.stage_gates['2-prototype']));
}
{
  const dir = mkIssue({ impact: IMPACT_ARCH_YES_TABLE, artifacts: ['behavior.md'] });
  unlinkSync(join(dir, 'manifest.json'));
  // manifest 损坏重建：扫描到 behavior 一份对照物，判「有」缺 diagram → 与 done 闸门同口径不判 done
  expect('rebuild/判「有」缺 diagram 不判 done', run('rebuild', dir), 0);
  check('rebuild/联动降级后 gate 为 in_progress',
    manifest(dir).stage_gates['2-prototype'].status === 'in_progress',
    JSON.stringify(manifest(dir).stage_gates['2-prototype']));
}
{
  const dir = mkIssue({ interview: true, impact: IMPACT_ARCH_YES, artifacts: ['behavior.md', 'diagram.html'] });
  doneInterview(dir);
  run('stage', dir, '2-prototype', 'done', '--artifacts', 'behavior,diagram');
  // 手工把 manifest 推到 ready（模拟三阶段全闭的存量 issue），再删掉 diagram.html：
  // rebuild 降级 2-prototype 的同时，ready 这个推论必须跟着回落，不许残留。
  const mp = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(mp, 'utf8'));
  m.stage_gates['3-contract'] = { status: 'done' };
  m.stage = '3-contract';
  m.status = 'ready';
  writeFileSync(mp, JSON.stringify(m), 'utf8');
  unlinkSync(join(dir, '2-prototype', 'diagram.html'));
  expect('rebuild/联动降级时 ready 随之回落', run('rebuild', dir), 0);
  const after = manifest(dir);
  check('rebuild/降级后 status 不再残留 ready',
    after.stage_gates['2-prototype'].status === 'in_progress' && after.status === 'in_progress',
    JSON.stringify({ gate: after.stage_gates['2-prototype'].status, status: after.status }));
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

// ─────────────────────── 首档遮蔽修复：一行多档的内嵌 [A] 段 ───────────────────────

const VALID_CONTRACT = [
  '# Goal Contract: 测试占位',
  '',
  '## 目标',
  '',
  '占位目标一句话可观察。',
  '',
  '## 验收条件',
  '',
  '- AC-001: 可观察的占位结果成立',
  '  - Verify: [A] `node -e "process.exit(1)"` → 退出码 1（此刻应为红）',
  '',
].join('\n');
// 把 manifest 手工推到「三阶段全闭 + finalize 已过」的形态（黑盒盘上事实，同 rebuild 测试手法）。
function forceReady(dir, contract) {
  writeFileSync(join(dir, '3-contract', 'contract.md'), contract || VALID_CONTRACT, 'utf8');
  writeFileSync(join(dir, '2-prototype', 'behavior.md'), '占位\n', 'utf8');
  const mp = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(mp, 'utf8'));
  m.stage_gates['2-prototype'] = { status: 'done', artifacts_confirmed: ['behavior'] };
  m.stage_gates['3-contract'] = { status: 'done', closed_at: '2026-08-31T00:00:00Z' };
  m.stage = '3-contract';
  m.status = 'ready';
  m.validation = { status: 'valid', ac_count: 1, warnings: [], ran_at: '2026-08-31T00:00:00Z' };
  writeFileSync(mp, JSON.stringify(m), 'utf8');
  return m;
}

{
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'),
    '## 验收条件\n\n- AC-001: 界面按 mock 呈现\n  - Verify: [C] 人工对照 mock 逐处看；[A] `node -e "process.exit(1)"` → 退出码 1\n', 'utf8');
  const res = run('verify', dir);
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  check('shadow/内嵌 [A] 段被执行计红', res.status === 0 && out.includes('AC-001 [A·内嵌]') && out.includes('红 1'), out.trim().slice(0, 400));
  check('shadow/页脚列出非 [A] 段', out.includes('AC-001 [C]'), out.trim().slice(0, 400));
}
{
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'),
    '## 验收条件\n\n- AC-001: 占位结果\n  - Verify: [C] 人工步骤；[A] 没写反引号命令 → 退出码 0\n', 'utf8');
  expect('shadow/内嵌 [A] 抽不出命令拦下', run('verify', dir), 1, 'UNRUNNABLE');
}
{
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'), VALID_CONTRACT, 'utf8');
  writeFileSync(join(dir, '3-contract', 'verify.txt'), 'SMOKE MARKER\n', 'utf8');
  run('verify', dir, '--write');
  check('evidence/独立复验写 verify-evidence.txt', existsSync(join(dir, '3-contract', 'verify-evidence.txt')));
  check('evidence/独立复验不碰冒烟快照', readFileSync(join(dir, '3-contract', 'verify.txt'), 'utf8') === 'SMOKE MARKER\n');
}

// ─────────────────────── 生命周期对账：打回回撤 / F5 / 多契约 mtime ───────────────────────

{
  const dir = mkIssue({ interview: true, impact: true });
  doneInterview(dir);
  forceReady(dir);
  expect('lifecycle/打回 ready issue', run('stage', dir, '3-contract', 'needs_reinterview', '--reason', '口径没问'), 0);
  const after = manifest(dir);
  check('lifecycle/ready 回落 in_progress', after.status === 'in_progress', `status=${after.status}`);
  check('lifecycle/validation 标 stale 带理由',
    after.validation.stale === true && /口径没问/.test(after.validation.stale_reason || ''),
    JSON.stringify(after.validation));
  check('lifecycle/closed_at 清除并记 reverted_at',
    after.stage_gates['3-contract'].closed_at === undefined && !!after.stage_gates['3-contract'].reverted_at,
    JSON.stringify(after.stage_gates['3-contract']));
  check('list/打回态出现告警', `${run('list').stdout || ''}`.includes('⚠已打回待修订'));
}
{
  // 打回后契约没改过（mtime 早于上次 finalize）→ finalize fail-fast；修订后放行并清 stale。
  const dir = mkIssue({ interview: true, impact: true });
  doneInterview(dir);
  forceReady(dir);
  const cp = join(dir, '3-contract', 'contract.md');
  utimesSync(cp, new Date('2026-08-30T00:00:00Z'), new Date('2026-08-30T00:00:00Z'));
  run('stage', dir, '3-contract', 'needs_reinterview', '--reason', '整族打回');
  expect('lifecycle/打回后契约未修订即拒', run('finalize', dir), 1, '还没折进契约');
  writeFileSync(cp, VALID_CONTRACT.replace('占位目标', '修订后的占位目标'), 'utf8');
  const res = run('finalize', dir);
  check('lifecycle/修订后重新通过并清 stale',
    res.status === 0 && manifest(dir).validation.stale === undefined && manifest(dir).status === 'ready',
    `${res.status}\n${JSON.stringify(manifest(dir).validation)}`);
}
{
  // F5：结构过了但冒烟崩 → validation 必须落在 invalid，done 闸门随之拒收。
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'),
    VALID_CONTRACT.replace('`node -e "process.exit(1)"`', '`definitely-missing-cmd-xyz-9g`'), 'utf8');
  expect('lifecycle/冒烟崩 exit 1', run('finalize', dir), 1, 'UNRUNNABLE');
  check('lifecycle/冒烟崩后 validation 不停在 valid',
    manifest(dir).validation.status === 'invalid', JSON.stringify(manifest(dir).validation));
  expect('lifecycle/finalize 失败后 done 仍被拒', run('stage', dir, '3-contract', 'done'), 1, 'finalize');
}
{
  // 里程碑家族：contract-m2.md 在 finalize 后改动同样触发 done 对账。
  // 写完把 mtime 推到未来——闸门带 +2s 容差，同瞬写入测不出真实场景的先后。
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'), VALID_CONTRACT, 'utf8');
  expect('lifecycle/主契约 finalize 通过', run('finalize', dir), 0);
  const m2 = join(dir, '3-contract', 'contract-m2.md');
  writeFileSync(m2, '# M2 占位\n', 'utf8');
  const future = new Date(Date.now() + 8000);
  utimesSync(m2, future, future);
  expect('lifecycle/家族契约改动后 done 拒', run('stage', dir, '3-contract', 'done'), 1, 'contract-m2.md 在上次 finalize 之后又改过');
}

// ─────────────────────── 口径闸门：复刻精度必须问过 ───────────────────────

const MOCK_CONTRACT = [
  '# Goal Contract: 界面占位',
  '',
  '## 目标',
  '',
  '界面按对照物呈现的占位目标。',
  '',
  '## 验收条件',
  '',
  '- AC-001: 界面结构与关键状态呈现',
  '  - Verify: [C] 人工对照 mock.html 逐处走查',
  '',
].join('\n');
const CALIBER_ASK = JSON.stringify({
  stage: '3-contract', round: 1, tier: 'ask',
  question: '复刻精度判到多严：结构对照还是像素级？',
  options: [{ key: 'A', text: '结构对照', pct: 70 }, { key: 'B', text: '像素级还原', pct: 30 }],
});
{
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'), MOCK_CONTRACT, 'utf8');
  expect('caliber/契约引用 mock 未问口径拒', run('finalize', dir), 1, '复刻精度');
}
{
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'), MOCK_CONTRACT, 'utf8');
  expect('caliber/落盘口径提问行', run('round', dir, CALIBER_ASK), 0, 'appended');
  expect('caliber/问过口径放行', run('finalize', dir), 0);
}
{
  // 确认清单里的 mock（2-prototype gate）同样触发，不依赖契约正文写没写 mock.html。
  const dir = mkIssue({ interview: true, impact: true, artifacts: ['mock.html'] });
  doneInterview(dir);
  run('stage', dir, '2-prototype', 'done', '--artifacts', 'mock');
  writeFileSync(join(dir, '3-contract', 'contract.md'), VALID_CONTRACT, 'utf8');
  expect('caliber/确认清单含 mock 同样触发', run('finalize', dir), 1, '复刻精度');
}
{
  // 声明逐像素而规格源没点名 → 只警告不拦。
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'),
    VALID_CONTRACT.replace('占位目标一句话可观察。', '整页逐像素还原的占位目标。'), 'utf8');
  const res = run('finalize', dir);
  check('caliber/逐像素无规格源只警告',
    res.status === 0 && `${res.stdout || ''}`.includes('规格源'),
    `${res.status}\n${`${res.stdout || ''}${res.stderr || ''}`.slice(0, 400)}`);
}

console.log(`\n${total - failed}/${total} 通过`);
rmSync(ROOT, { recursive: true, force: true });
process.exit(failed > 0 ? 1 : 0);
