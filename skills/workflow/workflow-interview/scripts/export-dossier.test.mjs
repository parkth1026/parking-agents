#!/usr/bin/env node
/**
 * export-dossier.test.mjs — 决策档案家族投影的黑盒回归测试
 *
 * 跑法：node export-dossier.test.mjs
 * 只走进程边界：round 行经 session.mjs 写入（真源路径），再跑 export-dossier.mjs，
 * 断言纯对话载体（无 web/ 目录）也能产出与 web 版同构的档案。
 */

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SESSION = join(HERE, 'session.mjs');
const EXPORT = join(HERE, 'export-dossier.mjs');
const ROOT = mkdtempSync(join(tmpdir(), 'dossier-test-'));
mkdirSync(join(ROOT, '.git'), { recursive: true });

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
      { key: 'A', text: '只锁目标与验收', pct: 40, recommended: true, covers: '中间实现自由', cons: ['歧义要靠执行者补'] },
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
} finally {
  rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

console.log(failed === 0 ? `${total}/${total} 通过` : `${total - failed}/${total} 通过，${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
