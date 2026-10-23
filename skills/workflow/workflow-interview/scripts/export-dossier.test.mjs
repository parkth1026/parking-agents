#!/usr/bin/env node
/**
 * export-dossier.test.mjs — 决策档案家族投影的黑盒回归测试
 *
 * 跑法：node export-dossier.test.mjs
 * 只走进程边界：round 行经 session.mjs 写入（真源路径），再跑 export-dossier.mjs，
 * 断言纯对话载体（无 web/ 目录）也能产出与 web 版同构的档案。
 */

import { appendFileSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SESSION = join(HERE, 'session.mjs');
const EXPORT = join(HERE, 'export-dossier.mjs');
const ROOT = mkdtempSync(join(tmpdir(), 'dossier-test-'));
mkdirSync(join(ROOT, '.git'), { recursive: true });
if (spawnSync('git', ['init', '-q', ROOT]).status !== 0) throw new Error('隔离 Git 初始化失败');
writeFileSync(join(ROOT, '.gitignore'), '/artifacts/\n', 'utf8');

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
  return spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
}

try {
  const r = run(SESSION, 'init', '2026-01-01-档案测试', '--request', '把访谈流程做成可交付的契约');
  check('init/建 issue 成功', r.status === 0, r.stderr);
  const dir = join(ROOT, '.aes-workflow', 'grilling', '2026-01-01-档案测试');

  writeFileSync(join(dir, '1-interview', 'context.md'),
    '# 上下文\n\n## 任务陈述\n\n把访谈流程做成可交付的契约。\n', 'utf8');

  // 真源路径写轮次：default 行（已接受）、ask 单选（用户翻了推荐）、multi_select（无 pct）。
  run(SESSION, 'round', dir, JSON.stringify({
    stage: '1-interview', round: 1, tier: 'default',
    item: '输出目录沿用 issue 目录', why: '与家族约定一致', cost: '无法按仓库归档', user: '未反对',
  }));
  run(SESSION, 'round', dir, JSON.stringify({
    stage: '1-interview', round: 1, tier: 'ask', q_id: 'Q1',
    question: '契约要锁到哪一层？',
    known_facts: '仓库已有三阶段门禁',
    options: [
      { key: 'A', text: '只锁目标与验收', pct: 40, recommended: true, covers: '中间实现自由', pros: '实施范围清楚', cons: '歧义要靠执行者补' },
      { key: 'B', text: '锁到文件级路径', pct: 60, covers: '交接零歧义', cons: ['实现失去自由度'] },
    ],
    user_choice: 'B', user_verbatim: '锁到文件级路径', overturned_recommendation: true,
  }));
  run(SESSION, 'round', dir, JSON.stringify({
    stage: '1-interview', round: 1, tier: 'ask', q_id: 'M1',
    question: '决策档案必须包含哪些上下文？',
    response: { type: 'multi_select', min: 1, max: 2 },
    options: [
      { key: 'REQ', text: '任务原文', pros: ['保留目标语境'] },
      { key: 'DEC', text: '全部候选与决策', pros: ['可复盘'] },
      { key: 'SUM', text: '只保留摘要', cons: ['无法解释为什么'] },
    ],
    choices: ['REQ', 'DEC'],
  }));

  writeFileSync(join(dir, '3-contract', 'contract.md'), [
    '# 目标契约', '',
    '## 目标', '把访谈流程做成可交付的契约，三阶段门禁全绿后交接。', '',
    '## 验收条件',
    '- AC-001 : 契约包含目标与验收条件', '  - Verify : [A] `echo contract-ok`', '',
  ].join('\n'), 'utf8');

  // 场景一：finalize 之前——状态不是契约，但轨迹与候选原文已在档案里。
  const before = run(EXPORT, '--issue-dir', dir);
  check('export/未 finalize 也能导出', before.status === 0, before.stderr);
  const beforeOut = JSON.parse(before.stdout);
  const beforeHtml = readFileSync(beforeOut.path, 'utf8');
  check('export/默认落 issue 根 dossier.html（无 web 目录）',
    beforeOut.path === join(dir, 'dossier.html') && existsSync(beforeOut.path), beforeOut.path);
  check('export/不创建 web/ 目录', !existsSync(join(dir, 'web')));
  check('export/JSON 输出 digest 与来源计数',
    typeof beforeOut.dossier_digest === 'string' && beforeOut.dossier_digest.length === 64 && beforeOut.sources >= 3,
    JSON.stringify(beforeOut));
  check('export/轨迹含三轮真源投影',
    beforeHtml.includes('契约要锁到哪一层？') && beforeHtml.includes('决策档案必须包含哪些上下文？') && beforeHtml.includes('输出目录沿用 issue 目录'),
    '缺问题或默认行');
  check('export/候选与用户决定成对呈现',
    beforeHtml.includes('锁到文件级路径') && beforeHtml.includes('选择 B') && beforeHtml.includes('选择 REQ、DEC'),
    '缺选项或答案');
  check('export/候选好处与代价同时接受字符串和数组',
    beforeHtml.includes('实施范围清楚') && beforeHtml.includes('歧义要靠执行者补') && beforeHtml.includes('可复盘'),
    '字符串或数组字段未渲染');
  check('export/翻推荐与默认接受可见',
    beforeHtml.includes('✓ B.') && beforeHtml.includes('未反对，按默认接受'), '缺选中标记或默认接受');
  check('export/机器 JSON 与原文都在',
    beforeHtml.includes('decision-dossier-data') && beforeHtml.includes('contract-ok'), '缺 script 标签或契约原文');
  check('export/无账本时给家族说明而不是空表',
    beforeHtml.includes('纯对话载体没有 Web 提交事件'), '缺账本说明');

  // 场景二：finalize 通过后（手改 manifest.validation 模拟）——契约节投影进 final 视图。
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.validation = { status: 'valid', ac_count: 1, warnings: [], ran_at: new Date().toISOString() };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const after = run(EXPORT, '--issue-dir', dir);
  check('export/finalize 后导出成功', after.status === 0, after.stderr);
  const afterHtml = readFileSync(JSON.parse(after.stdout).path, 'utf8');
  check('export/契约节从 contract.md 投影',
    afterHtml.includes('目标契约 · 2026-01-01-档案测试') && afterHtml.includes('把访谈流程做成可交付的契约，三阶段门禁全绿后交接'),
    '缺契约标题或目标节');
  check('export/开放歧义数归零',
    afterHtml.includes('开放歧义 0'), '歧义未归零');

  // 场景三：原型节、契约渲染与相对路径——
  //   manifest 用带/不带扩展名混写的确认名（与 session.mjs 口径一致）；diagram-detail 在盘上但未确认；
  //   contract.md 含围栏代码里的假标题与带 \| 的表格；--output 指到 issue 之外两层的目录。
  mkdirSync(join(dir, '2-prototype'), { recursive: true });
  writeFileSync(join(dir, '2-prototype', 'mock.html'), '<!doctype html><title>mock</title><p>mock</p>', 'utf8');
  writeFileSync(join(dir, '2-prototype', 'diagram-detail.html'), '<!doctype html><title>detail</title>', 'utf8');
  writeFileSync(join(dir, '2-prototype', 'behavior.md'), '# 行为\n\n| 输入 | 行为 |\n|-|-|\n| a \\| b | `x \\| y` |\n', 'utf8');
  const withPrototype = JSON.parse(readFileSync(manifestPath, 'utf8'));
  withPrototype.stage_gates = { ...(withPrototype.stage_gates ?? {}), '2-prototype': { status: 'done', artifacts_confirmed: ['mock', 'Behavior.md'] } };
  writeFileSync(manifestPath, `${JSON.stringify(withPrototype, null, 2)}\n`, 'utf8');
  writeFileSync(join(dir, '3-contract', 'contract.md'), [
    '# 目标契约', '',
    '## 目标', '把访谈流程做成可交付的契约，三阶段门禁全绿后交接。', '',
    '## 验收条件', '```', '## 不是标题', '```', '',
    '## 尾节', '正文。', '',
  ].join('\n'), 'utf8');
  const outside = join(ROOT, 'out', 'deep', 'dossier.html');
  const third = run(EXPORT, '--issue-dir', dir, '--output', outside);
  check('export/--output 到 issue 之外也能导出', third.status === 0, third.stderr);
  const thirdHtml = readFileSync(outside, 'utf8');
  check('export/原型节：确认名不分扩展名与大小写，未确认的不冒充确认版',
    /确认版对照物 · \d+ bytes · <a href="[^"]*mock\.html"/.test(thirdHtml)
      && /确认版对照物 · \d+ bytes · <a href="[^"]*behavior\.md"/.test(thirdHtml)
      && /阶段产物 · \d+ bytes · <a href="[^"]*diagram-detail\.html"/.test(thirdHtml),
    '确认标记不符');
  check('export/HTML 原型按相对路径 iframe 引用，前缀随输出位置变化',
    thirdHtml.includes('<iframe class="prototype" src="../../.aes-workflow/grilling/2026-01-01-%E6%A1%A3%E6%A1%88%E6%B5%8B%E8%AF%95/2-prototype/mock.html"'),
    '缺相对路径 iframe');
  check('export/表格渲染且 \\| 是字面管道',
    thirdHtml.includes('<td>a | b</td>') && thirdHtml.includes('<td><code>x | y</code></td>'), '表格单元格不对');
  const tocTitles = [...thirdHtml.matchAll(/<a href="#contract-section-(\d+)">([^<]*)<\/a>/g)].map((m) => `${m[1]}:${m[2]}`);
  const headingIds = [...thirdHtml.matchAll(/<h3 id="contract-section-(\d+)">([^<]*)<\/h3>/g)].map((m) => `${m[1]}:${m[2]}`);
  check('export/目录与正文锚点一一对应，围栏代码里的 ## 不计',
    tocTitles.join('|') === '0:目标|1:验收条件|2:尾节' && headingIds.join('|') === tocTitles.join('|'),
    `toc=${tocTitles} ids=${headingIds}`);
  check('export/五个页签且 hash 路由脚本在场',
    (thirdHtml.match(/<section class="tab-panel" id="tab-/g) ?? []).length === 5 && thirdHtml.includes("addEventListener('hashchange', route)"),
    '页签结构不对');

  // 场景四：旧 Web 已保存用户原答，family 继续记录契约修订。两者是既有来源，
  // 导出必须合并投影，不改写原来源，也不能让 Web 状态静默遮住新修订。
  const webSlug = '2026-01-02-Web修订';
  const webDir = join(ROOT, '.aes-workflow', 'grilling', webSlug);
  check('web/init 独立任务', run(SESSION, 'init', webSlug).status === 0);
  const put = (p, value) => { const pathname = join(webDir, p); mkdirSync(dirname(pathname), { recursive: true }); writeFileSync(pathname, value, 'utf8'); };
  const json = value => `${JSON.stringify(value, null, 2)}\n`;
  put('1-interview/context.md', '# 上下文\n保留旧 Web 回答和新修订。\n');
  put('3-contract/contract.md', '# 契约\n\n## 目标\n保留当前契约正文。\n\n## 输入\n[查询预览](../2-prototype/mock.html?mode=wide&theme=dark#x)\n');
  put('2-prototype/mock.html', '<!doctype html><title>正式查询预览</title><p id="x">query</p>');
  const webManifest = JSON.parse(readFileSync(join(webDir, 'manifest.json'), 'utf8'));
  webManifest.stage_gates['1-interview'].status = 'done';
  webManifest.stage_gates['2-prototype'].status = 'skipped';
  webManifest.stage_gates['3-contract'].status = 'done';
  webManifest.status = 'ready'; webManifest.validation = { status: 'valid' };
  put('manifest.json', json(webManifest));
  const webRounds = Array.from({ length: 6 }, (_, index) => ({
    id: `web-r${index + 1}`, no: index + 1, stage: index < 2 ? '1-interview' : '3-contract',
    title: `旧 Web 第 ${index + 1} 轮`, status: 'submitted',
    items: [{ q_id: index === 1 ? 'C1' : 'D1', tier: index === 1 ? 'confirm' : 'default', line: `旧事项 ${index + 1} — 代价：保留原证据` }],
  }));
  webRounds[0].items[0].source_refs = ['web/original-source'];
  webRounds[0].items.push({ q_id: 'Q1', tier: 'ask', question: '同一问题应如何处理？', options: [{ key: 'A', text: '旧回答', pct: 50 }, { key: 'B', text: '新回答', pct: 50 }] });
  webRounds[2].items.push({ q_id: 'T1', tier: 'ask', question: '旧 Web 文本原话？', response: { type: 'long_text' } });
  const oldState = { schema_version: 2, slug: webSlug, phases: [], open_ambiguities: 0, rounds: webRounds, locked: [], final: { round: 'web-final', title: '旧确认版契约', sections: [{ title: '历史目标', body: '原 Web 确认内容保持' }] } };
  put('web/state.json', json(oldState));
  for (const round of webRounds) {
    const answers = [{ q_id: round.items[0].q_id, type: round.no === 2 ? 'confirm' : 'accept' }];
    if (round.no === 1) answers.push({ q_id: 'Q1', type: 'choice', choice: 'A' });
    if (round.no === 3) answers.push({ q_id: 'T1', type: 'text', value: '旧用户文本原话保持' });
    put(`web/submissions/${round.id}.json`, json({ round: round.id, answers }));
    put(`web/consumed/${round.id}.json`, json({ round: round.id, applied: true }));
  }
  const ledger = Array.from({ length: 18 }, (_, index) => ({ at: `2026-01-01T00:00:${String(index).padStart(2, '0')}Z`, type: 'submitted', round: `web-r${index % 6 + 1}`, event_digest: `old-event-${index}` }));
  put('web/decision-ledger.jsonl', ledger.map(row => JSON.stringify(row)).join('\n') + '\n');
  for (const row of [
    { stage: '1-interview', round: 1, tier: 'default', item: '旧事项 1', cost: '保留原证据', user: '未反对', source_refs: ['family/mirror-source'], triggered_by: 'MIRROR_TRIGGER_SOURCE', maps_to: ['AC-001'] },
    { stage: '1-interview', round: 1, tier: 'ask', q_id: 'Q1', question: '同一问题应如何处理？', options: [{ key: 'A', text: '旧回答', pct: 50 }, { key: 'B', text: '新回答', pct: 50 }], user_choice: 'A' },
    { stage: '1-interview', round: 2, tier: 'confirm', item: '旧事项 2', cost: '保留原证据', user: '确认' },
    { stage: '3-contract', round: 3, tier: 'ask', q_id: 'T1', question: '旧 Web 文本原话？', response: { type: 'long_text' }, user_choice: 'text', user_verbatim: '旧用户文本原话保持' },
  ]) check('web/写入镜像轮次', run(SESSION, 'round', webDir, JSON.stringify(row)).status === 0);
  const webFiles = ['manifest.json', '1-interview/context.md', '1-interview/rounds.jsonl', '2-prototype/mock.html', '3-contract/contract.md', 'web/state.json', 'web/decision-ledger.jsonl', ...webRounds.flatMap(round => [`web/submissions/${round.id}.json`, `web/consumed/${round.id}.json`]), 'dossier.html']
    .map(p => ({ path: p, role: p === 'dossier.html' ? 'derived' : p === 'manifest.json' || p === 'web/state.json' ? 'state' : p.endsWith('contract.md') ? 'contract' : p.endsWith('context.md') ? 'requirement' : p.startsWith('2-prototype/') ? 'prototype' : 'decision' }));
  const plan = join(ROOT, 'web-plan.json'); writeFileSync(plan, json({ files: webFiles, excluded: [] }));
  const register = () => run(SESSION, 'delivery', webDir, '--plan', plan);
  const project = output => {
    const result = run(EXPORT, '--issue-dir', webDir, ...(output ? ['--output', output] : []));
    check('web/导出正式档案', result.status === 0, result.stderr);
    if (result.status !== 0) return null;
    const html = readFileSync(JSON.parse(result.stdout).path, 'utf8');
    return { html, visible: html.replace(/<script type="application\/json" id="decision-dossier-data">[\s\S]*?<\/script>/, ''), data: JSON.parse(html.match(/id="decision-dossier-data">([\s\S]*?)<\/script>/)[1]) };
  };
  check('web/登记当前正式来源', register().status === 0);
  const initial = project();
  check('web/镜像不重复，保留旧六轮与十八条账本', initial?.data.state.rounds.length === 6 && initial.data.ledger.length === 18 && initial.data.state.rounds.flatMap(round => round.items).length === 8);
  check('web/完全镜像合并来源与验收映射，不吞新增依据', initial?.data.state.rounds[0].items[0].source_refs.includes('web/original-source') && initial.data.state.rounds[0].items[0].source_refs.includes('family/mirror-source') && initial.data.state.rounds[0].items[0].source_refs.includes('MIRROR_TRIGGER_SOURCE') && initial.data.state.rounds[0].items[0].maps_to.includes('AC-001'));
  check('web/查询链接保留 pathname、query 和 fragment 语义', initial?.visible.includes('href="2-prototype/mock.html?mode=wide&amp;theme=dark#x"') && !initial.visible.includes('mock.html%3F'));
  check('web/来源 bytes 与磁盘一致，可见页面没有 undefined bytes', initial?.data.sources.every(source => Number.isSafeInteger(source.bytes) && source.bytes === statSync(join(webDir, source.path)).size) && !initial.html.includes('undefined bytes'));
  const originals = Object.fromEntries(webFiles.filter(file => file.path.startsWith('web/')).map(file => [file.path, readFileSync(join(webDir, file.path), 'utf8')]));
  const revised = run(SESSION, 'revise', webDir, '--reason', '同一目标下补充可追踪修订');
  check('web/revise 保留底本后重开契约', revised.status === 0, revised.stderr);
  const newRows = [
    { stage: '3-contract', round: 99, tier: 'default', item: 'CURRENT_REVISION_DECISION', why: '只记 Agent 修订，不制造用户确认' },
    { stage: '1-interview', round: 1, tier: 'default', q_id: 'D1', item: 'SAME_ROUND_REVISION_ITEM', why: '复用已有轮号仍须保留' },
    { stage: '1-interview', round: 1, tier: 'ask', q_id: 'Q1', question: '同一问题应如何处理？', options: [{ key: 'A', text: '旧回答', pct: 50 }, { key: 'B', text: '新回答', pct: 50 }], user_choice: 'custom', user_verbatim: '当前修订原话：保留旧回答并使用新办法' },
    { stage: '1-interview', round: 1, tier: 'ask', q_id: 'Q2', question: 'NEW_UNANSWERED_QUESTION', options: [{ key: 'A', text: '待用户决定', pct: 100 }] },
    { stage: '3-contract', round: 99, tier: 'ask', q_id: 'T1', question: '当前文本修订？', response: { type: 'long_text' }, user_choice: 'text', user_verbatim: 'CURRENT_REVISION_TEXT_VERBATIM' },
    { stage: '1-interview', round: 1, tier: 'default', q_id: 'D1', item: '旧事项 1', why: 'NEW_REVISION_REASON', cost: 'NEW_REVISION_COST', user: '未反对' },
    { stage: '1-interview', round: 1, tier: 'ask', q_id: 'Q1', question: '同一问题应如何处理？', options: [{ key: 'A', text: '旧回答', pct: 50 }, { key: 'B', text: 'NEW_REVISION_OPTION', pct: 50 }], user_choice: 'A' },
    { stage: '1-interview', round: 1, tier: 'ask', q_id: 'Q1', question: '同一问题应如何处理？', options: [{ key: 'A', text: '旧回答', pct: 50 }, { key: 'B', text: '新回答', pct: 50 }], user_choice: 'A', user_verbatim: 'SAME_CHOICE_NEW_BOUNDARY：A仅限新边界使用' },
  ];
  for (const row of newRows) check('web/追加当前修订轮次', run(SESSION, 'round', webDir, JSON.stringify(row)).status === 0);
  appendFileSync(join(webDir, '3-contract/contract.md'), '\n## 当前修订\nCURRENT_CONTRACT_BODY\n');
  check('web/修订后重新登记', register().status === 0);
  const current = project();
  check('web/修订后阶段与顶层状态取当前门禁，旧 final 仍保持', current?.data.status === 'in-progress' && current.data.state.phases.find(phase => phase.id === '3-contract')?.status === 'active' && current.data.state.final.title === oldState.final.title && current.data.manifest.validation.status === 'invalid');
  const allItems = current?.data.state.rounds.flatMap(round => round.items) ?? [];
  check('web/新轮次与同轮追加均进入 state 和可见轨迹', ['CURRENT_REVISION_DECISION', 'SAME_ROUND_REVISION_ITEM', 'NEW_UNANSWERED_QUESTION', 'CURRENT_REVISION_TEXT_VERBATIM', '当前修订原话：保留旧回答并使用新办法'].every(text => current?.visible.includes(text)) && allItems.some(item => item.line?.includes('CURRENT_REVISION_DECISION')) && allItems.some(item => item.line?.includes('SAME_ROUND_REVISION_ITEM')));
  const firstRound = current?.data.state.rounds.find(round => round.id === 'web-r1');
  const firstAnswers = current?.data.submissions['web-r1']?.answers ?? [];
  check('web/原问答保持，冲突答案独立保留且不覆盖旧回答', firstRound?.items.filter(item => item.question === '同一问题应如何处理？').length === 4 && firstAnswers.some(answer => answer.q_id === 'Q1' && answer.choice === 'A') && firstAnswers.some(answer => answer.q_id !== 'Q1' && answer.text === '当前修订原话：保留旧回答并使用新办法'));
  check('web/同问题同选择的新限制原话在各投影完整保留', current?.visible.includes('SAME_CHOICE_NEW_BOUNDARY：A仅限新边界使用') && firstRound.items.some(item => item.user_verbatim === 'SAME_CHOICE_NEW_BOUNDARY：A仅限新边界使用') && firstAnswers.some(answer => answer.q_id !== 'Q1' && answer.choice === 'A' && answer.user_verbatim === 'SAME_CHOICE_NEW_BOUNDARY：A仅限新边界使用') && current.data.traceability.some(row => row.answer?.user_verbatim === 'SAME_CHOICE_NEW_BOUNDARY：A仅限新边界使用'));
  check('web/同事项同答案的依据代价与选项变化仍保留', ['NEW_REVISION_REASON', 'NEW_REVISION_COST', 'NEW_REVISION_OPTION'].every(text => current?.visible.includes(text)) && firstRound.items.some(item => item.line?.includes('NEW_REVISION_REASON')) && firstRound.items.some(item => item.options?.some(option => option.text === 'NEW_REVISION_OPTION')));
  check('web/冲突与新增记录有明确来源，追踪矩阵包含新回答', current?.visible.includes('1-interview/rounds.jsonl') && current.data.traceability.some(row => row.answer?.text === '当前修订原话：保留旧回答并使用新办法' && row.source_refs.some(ref => ref.startsWith('1-interview/rounds.jsonl'))));
  check('web/未回答的修订不冒造确认或接受', current?.data.state.open_ambiguities === 1 && current.data.traceability.find(row => row.round === 'web-r1' && firstRound.items.find(item => item.q_id === row.id)?.question === 'NEW_UNANSWERED_QUESTION')?.answer === null && current.data.traceability.find(row => row.round === '3-contract-r99')?.answer === null, JSON.stringify({ ambiguities: current?.data.state.open_ambiguities, rows: current?.data.traceability }));
  check('web/全部原 Web 证据字节保持且账本仍十八条', Object.entries(originals).every(([p, bytes]) => readFileSync(join(webDir, p), 'utf8') === bytes) && current?.data.ledger.length === 18);
  const relocated = project(join(ROOT, 'relocated', 'web-dossier.html'));
  check('web/同一来源导出位置不改变投影摘要和修订轨迹', current?.data.dossier_digest === relocated?.data.dossier_digest && current?.data.state_digest === relocated?.data.state_digest && relocated?.visible.includes('CURRENT_REVISION_DECISION'));
  const preview = join(ROOT, 'web-preview');
  const previewRun = run(SESSION, 'submission-check', webDir, '--output', preview);
  check('web/修订档案可生成正式提交预览', previewRun.status === 0, previewRun.stdout + previewRun.stderr);
  if (previewRun.status === 0) {
    const previewHtml = readFileSync(join(preview, 'issue', 'dossier.html'), 'utf8');
    const previewData = JSON.parse(previewHtml.match(/id="decision-dossier-data">([\s\S]*?)<\/script>/)[1]);
    check('web/预览保持相同轨迹和来源字节数', previewData.dossier_digest === current?.data.dossier_digest && previewData.sources.every(source => Number.isSafeInteger(source.bytes) && source.bytes === statSync(join(preview, 'issue', source.path)).size) && !previewHtml.includes('undefined bytes'), JSON.stringify({ digest: [previewData.dossier_digest, current?.data.dossier_digest], sources: previewData.sources.filter(source => source.bytes !== statSync(join(preview, 'issue', source.path)).size) }));
    check('web/预览查询链接不把 query 编进文件名', previewHtml.includes('href="2-prototype/mock.html?mode=wide&amp;theme=dark#x"') && !previewHtml.includes('mock.html%3F'));
  }
  const staleManifest = JSON.parse(readFileSync(join(webDir, 'manifest.json'), 'utf8'));
  staleManifest.validation = { status: 'valid', stale: true }; staleManifest.status = 'ready'; staleManifest.stage_gates['3-contract'].status = 'done';
  put('manifest.json', json(staleManifest));
  check('web/stale-valid 重新登记', register().status === 0);
  const stale = project();
  check('web/stale-valid 不冒充当前已定稿契约', stale?.data.status === 'in-progress' && stale.data.state.final.title === oldState.final.title);
  check('web/导出及预览不写入 Git 索引', spawnSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8' }).stdout === '');
  const legacyWeb = join(ROOT, 'legacy-web');
  mkdirSync(join(legacyWeb, '1-interview'), { recursive: true });
  cpSync(join(webDir, 'web'), join(legacyWeb, 'web'), { recursive: true });
  cpSync(join(webDir, '1-interview', 'rounds.jsonl'), join(legacyWeb, '1-interview', 'rounds.jsonl'));
  for (const condition of ['无 manifest', '坏 manifest']) {
    if (condition === '坏 manifest') writeFileSync(join(legacyWeb, 'manifest.json'), '{malformed', 'utf8');
    const legacyRun = run(EXPORT, '--issue-dir', legacyWeb);
    check(`web/旧任务${condition}仍能导出`, legacyRun.status === 0, legacyRun.stderr);
    if (legacyRun.status === 0) {
      const legacyPath = JSON.parse(legacyRun.stdout).path;
      const legacyHtml = readFileSync(legacyPath, 'utf8');
      const legacyData = JSON.parse(legacyHtml.match(/id="decision-dossier-data">([\s\S]*?)<\/script>/)[1]);
      check(`web/旧任务${condition}保留六轮十八账本与旧回答`, legacyData.state.rounds.length === 6 && legacyData.ledger.length === 18 && legacyData.submissions['web-r1'].answers.find(answer => answer.q_id === 'Q1').choice === 'A' && legacyPath.includes(join('web', 'exports')));
    }
  }
} finally {
  rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

console.log(failed === 0 ? `${total}/${total} 通过` : `${total - failed}/${total} 通过，${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
