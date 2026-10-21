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

// 问答结构继续校验；偏好概率不再必填或强制加和。
{
  const dir = mkIssue();
  expect('round/default 合法行落盘', run('round', dir, ROUND_OK), 0);
  expect('round/default 缺 item 拒收', run('round', dir, JSON.stringify({stage:'1-interview', round:1, tier:'default'})), 1, 'item');
  expect('round/未知 stage 拒收', run('round', dir, JSON.stringify({stage:'unknown', round:1, tier:'default', item:'x'})), 1);
  expect('round/未知 tier 拒收', run('round', dir, JSON.stringify({stage:'1-interview', round:1, tier:'guess', item:'x'})), 1);
  expect('round/非法 JSON 拒收', run('round', dir, '{oops'), 2);
  expect('round/ask 缺 question 拒收', run('round', dir, JSON.stringify({stage:'1-interview', round:1, tier:'ask'})), 1);
  expect('round/空 options 拒收', run('round', dir, JSON.stringify({stage:'1-interview', round:1, tier:'ask', question:'q', options:[]})), 1);
  const row = {stage:'1-interview', round:1, tier:'ask', question:'选哪个？', options:[{key:'A', text:'甲'}, {key:'B', text:'乙'}]};
  expect('round/单选不必填 pct', run('round', dir, JSON.stringify(row)), 0);
  expect('round/显式单选不必填 pct', run('round', dir, JSON.stringify({...row, response:{type:'single_select'}})), 0);
  expect('round/历史非百分之百分布继续可读', run('round', dir, askRow([50,30,17])), 0);
  expect('round/已有百分比原样保留', run('round', dir, askRow([50,30,20])), 0);
  const saved = readFileSync(join(dir,'1-interview','rounds.jsonl'),'utf8');
  check('round/历史数值不被重算', saved.includes('"pct":17') && saved.includes('"pct":20'));
  expect('round/可选 pct 非数字仍拒收', run('round', dir, JSON.stringify({...row, options:[{key:'A',text:'甲',pct:'x'}]})), 1, 'pct');
  expect('round/未知应答类型拒收', run('round', dir, JSON.stringify({...row,response:{type:'invalid'}})), 1);
  expect('round/应答类型对象无效拒收', run('round', dir, JSON.stringify({...row,response:[]})), 1);
  expect('round/多选无需 pct', run('round', dir, JSON.stringify({...row,response:{type:'multi_select',min:1,max:2},choices:['A']})), 0);
  const last=JSON.parse(readFileSync(join(dir,'1-interview','rounds.jsonl'),'utf8').trim().split('\n').at(-1));
  check('round/多选别名正规化',last.response.min_selections===1 && last.response.max_selections===2 && !('min' in last.response));
  expect('round/冲突别名拒收',run('round',dir,JSON.stringify({...row,response:{type:'multi_select',min:1,min_selections:2}})),1,'不一致');
}
{
  const dir=mkIssue();
  expect('stage/未知职责拒收',run('stage',dir,'unknown','done'),2);
  expect('stage/未知状态拒收',run('stage',dir,'1-interview','unknown'),2);
  expect('gate1/可无 context rounds 和自评',run('stage',dir,'1-interview','done'),0);
  check('gate1/不从角色声明推断整件任务 ready',manifest(dir).status==='in_progress');
  writeFileSync(join(dir,'1-interview','context.md'),'# 调查摘要\n无需固定章节。');
  expect('gate1/已有简短 context 可复用',run('stage',dir,'1-interview','done'),0);
  writeFileSync(join(dir,'1-interview','rounds.jsonl'),'{broken');
  expect('gate1/已有坏问答仍拒收',run('stage',dir,'1-interview','done'),1,'不是合法 JSON');
}
{
  const dir=mkIssue();
  expect('gate2/不强制 impact 或对照物',run('stage',dir,'2-prototype','done'),0);
  expect('gate2/声明缺失材料仍拒收',run('stage',dir,'2-prototype','done','--artifacts','missing.svg'),1,'找不到');
  writeFileSync(join(dir,'2-prototype','dependency.svg'),'<svg/>');
  expect('gate2/自由命名和载体',run('stage',dir,'2-prototype','done','--artifacts','dependency.svg'),0);
  writeFileSync(join(dir,'2-prototype','impact-surface.md'),'架构与依赖：有');
  expect('gate2/架构变化不强制 HTML 图',run('stage',dir,'2-prototype','done'),0);
  expect('skip/原型无需独立材料',run('stage',dir,'2-prototype','skipped','--reason','已有用户要求足够具体'),0);
  expect('skip/无依据拒收',run('stage',dir,'2-prototype','skipped','--reason',''),1);
  expect('skip/契约职责不能省略',run('stage',dir,'3-contract','skipped','--reason','x'),1);
}
{
  const dir=mkIssue({interview:true,impact:true,artifacts:['custom-view.md']});
  run('stage',dir,'1-interview','done');
  run('stage',dir,'2-prototype','done','--artifacts','custom-view');
  unlinkSync(join(dir,'1-interview','context.md'));
  unlinkSync(join(dir,'2-prototype','impact-surface.md'));
  expect('rebuild/缺可选材料不撤已有声明',run('rebuild',dir),0);
  check('rebuild/确认材料和职责保留',manifest(dir).stage_gates['2-prototype'].status==='done' && manifest(dir).stage_gates['1-interview'].status==='done');
  unlinkSync(join(dir,'2-prototype','custom-view.md'));
  expect('rebuild/已声明依据丢失可恢复但降级',run('rebuild',dir),0);
  check('rebuild/依据丢失不保持完成',manifest(dir).stage_gates['2-prototype'].status==='in_progress');
}
{
  const dir=mkIssue({interview:true,impact:true,artifacts:['mock.html','behavior.md']});
  run('stage',dir,'2-prototype','done','--artifacts','mock');
  unlinkSync(join(dir,'manifest.json'));
  expect('rebuild/manifest 丢失仍能恢复入口',run('rebuild',dir),0);
  const m=manifest(dir);
  check('rebuild/不由文件存在推断确认',m.status!=='ready' && m.stage_gates['2-prototype'].status==='pending' && !m.stage_gates['2-prototype'].artifacts_confirmed);
}
{
  const dir=mkIssue();
  run('stage',dir,'2-prototype','skipped','--reason','复用原始请求');
  expect('rebuild/保留有依据的 skip',run('rebuild',dir),0);
  check('rebuild/理由不丢失',manifest(dir).stage_gates['2-prototype'].reason==='复用原始请求');
  expect('gate3/无契约仍拒收',run('stage',dir,'3-contract','done'),1,'不存在');
  writeFileSync(join(dir,'3-contract','contract.md'),'## 目标\n目标。');
  expect('gate3/无 finalize 仍拒收',run('stage',dir,'3-contract','done'),1,'finalize');
}
{
  const dir=mkIssue();
  expect('verify/无契约用法错',run('verify',dir),2,'不存在');
  expect('finalize/无契约用法错',run('finalize',dir),2,'不存在');
  const before=readFileSync(join(dir,'manifest.json'),'utf8');
  expect('init/幂等续跑',run('init',dir.split(/[\\/]/).pop()),0,'已存在');
  check('init/不重写历史记录',readFileSync(join(dir,'manifest.json'),'utf8')===before);
}

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
  const dir = mkIssue({ interview: true, impact: true });
  doneInterview(dir);
  const blockedContract = VALID_CONTRACT
    .replace('# Goal Contract: 测试占位', '# Goal Contract: 测试占位\n\n- Status: Blocked')
    + '\n## 挡着的事\n\n- 缺少原生导出环境。\n';
  forceReady(dir, blockedContract);
  expect('blocked/finalize 校验成功', run('finalize', dir), 0);
  check('blocked/finalize 不点亮 ready',
    manifest(dir).status === 'blocked' && manifest(dir).blocked.length === 1,
    JSON.stringify({ status: manifest(dir).status, blocked: manifest(dir).blocked }));
  expect('blocked/stage done 保留阻塞', run('stage', dir, '3-contract', 'done'), 0);
  check('blocked/stage done 不点亮 ready', manifest(dir).status === 'blocked', manifest(dir).status);
  expect('blocked/rebuild 保留阻塞', run('rebuild', dir), 0);
  check('blocked/rebuild 不点亮 ready', manifest(dir).status === 'blocked', manifest(dir).status);
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
  expect('lifecycle/澄清不改变契约也可机器复验', run('finalize', dir), 0);
  check('lifecycle/机器复验不恢复未完成的授权声明', manifest(dir).status === 'in_progress');
  writeFileSync(cp, VALID_CONTRACT.replace('占位目标', '修订后的占位目标'), 'utf8');
  const res = run('finalize', dir);
  check('lifecycle/修订后重新通过并清 stale',
    res.status === 0 && manifest(dir).validation.stale === undefined && manifest(dir).status === 'in_progress',
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
  expect('lifecycle/家族契约改动后 done 拒', run('stage', dir, '3-contract', 'done'), 1, '契约在上次 finalize 之后又改过');
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
  expect('caliber/文件名不强制新一轮确认', run('finalize', dir), 0);
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
  expect('caliber/已有确认清单不强制关键词', run('finalize', dir), 0);
}
{
  // 声明逐像素而规格源没点名 → 只警告不拦。
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'),
    VALID_CONTRACT.replace('占位目标一句话可观察。', '整页逐像素还原的占位目标。'), 'utf8');
  const res = run('finalize', dir);
  check('caliber/不以关键字替代意图判定',
    res.status === 0 && !`${res.stderr || ''}`.includes('复刻精度'),
    `${res.status}\n${`${res.stdout || ''}${res.stderr || ''}`.slice(0, 400)}`);
}

// ─────────────────────── 人验软闸与交付后人工复核 ───────────────────────

{
  // 人验 Verify：WARNING 点名但不拒绝——词级检测必带误伤，防线在起草规则，这里只给可见性。
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'), [
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
    '- AC-002: 员工试用下单核心流程后确认整体验收通过',
    '  - Verify: [C] 员工确认验收通过',
    '',
  ].join('\n'), 'utf8');
  const res = run('finalize', dir);
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  check('humangate/人验 Verify 段 WARNING 点名但不拦',
    res.status === 0 && out.includes('疑似以人的确认为通过条件') && out.includes('AC-002'),
    `${res.status}\n${out.trim().slice(0, 400)}`);
}
{
  // 「用户确认版」是合法语境（确认版对照物），不点名——误伤即空转信号。
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'), [
    '# Goal Contract: 测试占位',
    '',
    '## 目标',
    '',
    '占位目标一句话可观察。',
    '',
    '## 验收条件',
    '',
    '- AC-001: 报文与对照物一致',
    '  - Verify: [C] 对照用户确认版 api-mock 报文逐字段核对；[A] `node -e "process.exit(1)"` → 退出码 1',
    '',
  ].join('\n'), 'utf8');
  const res = run('finalize', dir);
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  check('humangate/确认版对照物不误伤', res.status === 0 && !out.includes('疑似以人的确认为通过条件'),
    `${res.status}\n${out.trim().slice(0, 400)}`);
}
{
  // 交付后人工复核节 → 用户待办清单随交接打出；Verify 里没有它，不进完成判定。
  const dir = mkIssue();
  writeFileSync(join(dir, '3-contract', 'contract.md'), `${VALID_CONTRACT
    .replace('# Goal Contract: 测试占位', '# Goal Contract: 测试占位\n\n- Status: Ready')}## 交付后人工复核\n\n- 员工试走下单流程 — 证据：D-01 试走录屏\n`, 'utf8');
  const res = run('finalize', dir);
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  check('postreview/人工复核节转用户待办清单',
    res.status === 0 && out.includes('交付后人工复核（用户待办') && out.includes('员工试走下单流程'),
    `${res.status}\n${out.trim().slice(0, 400)}`);
}


{
  const dir = mkIssue();
  const cp = join(dir,'3-contract','contract.md');
  const contract = VALID_CONTRACT + '\n## 强约束\n\n- 用户已确认旧任务必须使用锁定 spec、逐像素口径和连续三次运行。\n';
  writeFileSync(cp,contract);
  expect('handoff/无需过程文件也可校验',run('finalize',dir),0);
  check('handoff/校验成功不冒充用户确认',manifest(dir).status==='in_progress');
  expect('handoff/已有授权可合并履行访谈职责',run('stage',dir,'1-interview','done','--reason','原始请求与已确认契约'),0);
  expect('handoff/原型按实际需要省略',run('stage',dir,'2-prototype','skipped','--reason','复用既有规格'),0);
  expect('handoff/省略原型不制造风险义务',run('finalize',dir),0);
  expect('handoff/声明内容对齐后就绪',run('stage',dir,'3-contract','done'),0);
  check('handoff/ready 有职责声明与有效校验',manifest(dir).status==='ready');
  expect('handoff/恢复不要求补齐过程文件',run('rebuild',dir),0);
  check('handoff/已确认旧约束逐字保留',readFileSync(cp,'utf8')===contract);
  check('handoff/恢复保留已有 ready',manifest(dir).status==='ready');
  const time = new Date(manifest(dir).validation.ran_at);
  writeFileSync(cp,contract.replace('占位目标','新的占位目标'));
  utimesSync(cp,time,time);
  expect('binding/同秒或旧mtime不能掩盖契约变化',run('stage',dir,'3-contract','done'),1,'改过');
  check('binding/list 暴露内容失效',run('list').stdout.includes('契约改动晚于finalize'));
  run('rebuild',dir);
  check('binding/恢复撤销失效 ready',manifest(dir).status==='in_progress');
}
{
  const dir=mkIssue();
  writeFileSync(join(dir,'3-contract','contract.md'),VALID_CONTRACT);
  run('finalize',dir);
  const before=manifest(dir);
  before.status='ready';
  writeFileSync(join(dir,'manifest.json'),JSON.stringify(before));
  writeFileSync(join(dir,'3-contract','contract.md'),'## 验收条件\n没有合法条件。');
  expect('binding/无效契约复验拒收',run('finalize',dir),1);
  check('binding/失败不残留ready或valid',manifest(dir).status!=='ready' && manifest(dir).validation.status==='invalid');
}
{
  const dir=mkIssue();
  writeFileSync(join(dir,'3-contract','contract.md'),VALID_CONTRACT+'\n## 残留风险\n\n- 已接受的真实风险。\n');
  const m=manifest(dir);
  m.residual_risk='已接受的真实风险';
  writeFileSync(join(dir,'manifest.json'),JSON.stringify(m));
  expect('risk/明确风险随交接保留',run('finalize',dir),0);
  writeFileSync(join(dir,'3-contract','contract.md'),VALID_CONTRACT);
  expect('risk/不得因流程简化丢弃明确风险',run('finalize',dir),1,'残留风险');
}

{
  const dir=mkIssue();
  writeFileSync(join(dir,'3-contract','contract.md'),VALID_CONTRACT.replace('[A] `node -e "process.exit(1)"` → 退出码 1（此刻应为红）','[C] 主管核对真实交付后签字确认'));
  const r=run('finalize',dir);
  const out=r.stdout+r.stderr;
  check('human/纯人验不被建议移出完成义务',r.status===0 && out.includes('保留待人验') && !/必须移走|真人才能判的部分移|等于没有终止条件/.test(out));
}
{
  const dir=mkIssue();
  const cp=join(dir,'3-contract','contract.md');
  const goal='下游能够稳定消费审计结果。\n\n- JSON 字段含义明确。\n- 默认文本消费者仍然兼容。';
  const contract=VALID_CONTRACT.replace('占位目标一句话可观察。',goal);
  writeFileSync(cp,contract);
  const r=run('finalize',dir);
  const command=r.stdout.split(/\r?\n/).find(line=>line.startsWith('/goal '));
  check('handoff/多段目标完整进入交接',r.status===0 && command?.includes('JSON 字段含义明确') && command.includes('默认文本消费者仍然兼容'));
  const longContract=contract.replace(goal,goal+'\n\n'+'必要的期望行为说明。'.repeat(420));
  writeFileSync(cp,longContract);
  const fallback=run('finalize',dir);
  check('handoff/超长目标切换会话式交接不阻塞契约',fallback.status===0 && fallback.stdout.includes('已改用会话式交接') && !fallback.stdout.split(/\r?\n/).some(line=>line.startsWith('/goal ')));
  check('handoff/切换工具保留完整目标与旧验收',readFileSync(cp,'utf8')===longContract);
}
console.log(`\n${total - failed}/${total} 通过`);
rmSync(ROOT, { recursive: true, force: true });
process.exit(failed > 0 ? 1 : 0);
