#!/usr/bin/env node
/**
 * 校验 Goal Contract 里验收那一半。
 *
 * 用法：node validate-goal-contract.mjs <goal contract 路径>
 * 退出码：0 通过，1 有 ERROR，2 用法或读文件出错。
 *
 * 查这些：
 *   1. 验收条件 1 到 7 条。超了说明这个任务该拆，不是把条数压回去。
 *   2. AC 编号是连续唯一的三位 AC-001、AC-002。
 *   3. 每条 AC 恰好挂一行缩进的 "- Verify: [A|B|C|D] <内容>"。一行内可续写内嵌档段
 *      （「[C] 步骤…；[A] `命令`」），首档是主档。
 *   4. [A] 和 [B] 的 Verify 没写反引号命令或路径时给 WARNING。
 *   5. 「要落盘的东西」出现时，编号必须是连续唯一的 D-01、D-02。
 *   6. 有 [B] 却没有「要落盘的东西」时给 WARNING，fixture 可能已经在磁盘上了。
 *   7. 引用了 mock.html / diagram.html 却没有「读什么」时给 WARNING。
 *   8. 模板占位符 <name> 和没解决的 TODO、TBD、FIXME 直接拒。
 *   9. 交接指令模板已经接管的章节还留着就拒（Agent Mandate / Iteration Strategy /
 *      Completion 等，见 handoff-prompt.md）——避免每份契约重复抄一遍。
 *  10. [A] 档段没写反引号命令直接拒（含一行多档里的内嵌 [A]）：session.mjs verify
 *      靠反引号抽命令，抽不出就静默漏跑，而漏跑的那段 AC 看起来跟通过了一模一样。
 *  11. 契约在 issue 目录里但同级没有 manifest.json 时给 WARNING。
 *  12. 「读什么」指向 2-prototype 下的对照物但文件不在时给 WARNING。
 *  13. 「自主边界」「残留风险」写了就不能空着，且只能各出现一次。
 *  14. 引用 issue 目录里的过程文件直接拒——契约必须自包含。
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('用法：node validate-goal-contract.mjs <goal contract 路径>');
  process.exit(2);
}

const resolvedPath = resolve(target);
let content;
try {
  content = readFileSync(resolvedPath, 'utf8');
} catch (cause) {
  console.error(`读不到文件：${resolvedPath}`);
  console.error(String(cause.message ?? cause));
  process.exit(2);
}

const errors = [];
const warnings = [];

/** 把正文按二级标题切开。同名标题保留多份，用来查重复。 */
function collectSections(text) {
  const map = new Map();
  const marks = [...text.matchAll(/^## (.+?)[ \t]*$/gm)];
  marks.forEach((mark, index) => {
    const start = mark.index + mark[0].length;
    const end = index + 1 < marks.length ? marks[index + 1].index : text.length;
    const name = mark[1].trim();
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(text.slice(start, end).trim());
  });
  return map;
}

const sections = collectSections(content);
const section = (name) => (sections.get(name)?.[0] ?? null);
const bulletLines = (body) =>
  (body ?? '').split(/\r?\n/).filter((line) => /^-\s+\S/.test(line));
const meaningful = (value) => {
  const text = (value ?? '').trim();
  if (!text) return false;
  return !/^(none|n\/?a|unknown|pending|later|-|todo|tbd|fixme|xxx)[.!]?$/i.test(text);
};

// 占位符判据只认模板那种 <字母...> 的形式。放宽到任意 <...> 会把
// "响应时间 < 200ms 且 QPS > 100" 这类数值阈值当成占位符拒掉，而阈值恰恰是好 AC 该写的。
if (/<[A-Za-z][A-Za-z0-9 ,._/|-]{1,80}>/.test(content)) {
  errors.push('留着模板占位符 <...>，填掉再落盘。');
}

// TODO 一类的词只有以占位符形态出现才算错：独占一行，或者行首跟个冒号的空承诺。
// 出现在句子中间的多半是内容本身，「搜索标题含 TODO 的笔记」是合法 AC，
// 拒掉会逼人为了绕过校验器改需求措辞。句中出现降级为 WARNING。
if (/^[ \t]*(?:[-*+][ \t]*)?(?:\*\*)?(TODO|TBD|FIXME|XXX)\b[ \t]*(?:[:：]|[\s.!-]*$)/m.test(content)) {
  errors.push('留着没解决的 TODO、TBD 或 FIXME 标记。');
} else if (/\b(TODO|TBD|FIXME|XXX)\b/i.test(content)) {
  warnings.push('正文句子里出现 TODO、TBD 或 FIXME，确认它是内容本身，不是没做完的标记。');
}

// 早期重契约的遗留章节。留着这条防回退：Agent Mandate / Iteration Strategy / Completion
// 这类内容每份契约抄一遍就会各自漂移，已经收进通用的 handoff-prompt.md 交接模板，
// 契约里不该再重复写一份；其余是更早期格式留下的仪式性章节。
for (const legacy of [
  'Contract Metadata', 'Validation Matrix', 'Approval Binding', 'Independent Handoff',
  'Delivery Standard', 'Authority and Escalation', 'Provenance', 'Completion',
  'Iteration Strategy', 'Agent Mandate',
]) {
  if (sections.has(legacy)) {
    errors.push(`这一节已经由 handoff-prompt.md 的交接模板承载，删掉：${legacy}`);
  }
}

// 目标：存不存在由校验器查，这里只查它是不是一句话。写成任务清单是最常见的走形。
const goal = section('目标');
if (goal !== null) {
  if (!meaningful(goal)) {
    errors.push('目标要写一句能观察到的完成状态。');
  } else if (/^-\s+/m.test(goal) || /^\d+[.)]\s+/m.test(goal)) {
    errors.push('目标写成了列表。它是一句话的完成状态，不是任务清单。');
  } else if (goal.length > 600) {
    errors.push('目标太长，细节挪进范围、验收条件或者仓库里的文件。');
  }
}

let acceptance = section('验收条件');
if (acceptance === null) {
  errors.push('缺少章节：验收条件');
  acceptance = '';
}

const acMatches = [...acceptance.matchAll(/^-\s+(AC-\d{3}):\s*(\S.*)$/gm)];
const acceptanceBullets = bulletLines(acceptance);
if (acceptanceBullets.length !== acMatches.length) {
  errors.push('验收条件的每条顶层 bullet 都要写成 "- AC-001: <可判定的结果>"。');
}

const acceptanceIds = acMatches.map((match) => match[1]);
const uniqueAcceptanceIds = [...new Set(acceptanceIds)];
if (acceptanceIds.length < 1) {
  errors.push('验收条件至少要有一条 AC。');
}
if (acceptanceIds.length > 7) {
  errors.push('一个任务最多七条 AC。拆成几个能独立交付的任务，不要写成规格书。');
}
if (uniqueAcceptanceIds.length !== acceptanceIds.length) {
  errors.push('AC 编号有重复。');
}
for (let index = 0; index < acceptanceIds.length; index += 1) {
  const expected = `AC-${String(index + 1).padStart(3, '0')}`;
  if (acceptanceIds[index] !== expected) {
    errors.push(`AC 编号要连续，这里应该是 ${expected}。`);
    break;
  }
}
for (const match of acMatches) {
  const criterion = match[2].trim();
  if (criterion.length < 8) {
    errors.push(`${match[1]} 太短，说不清一个可判定的结果。`);
  }
  if (/^(works?|working correctly|done|complete|tests? pass|能用|正常|做完|测试通过)[.!。]?$/i.test(criterion)) {
    errors.push(`${match[1]} 无法独立判定，换成能观察到的结果。`);
  }
}

// 每条 AC 恰好一行缩进的 Verify。Verify 是「怎么算过」的落点：验收阶段照它填方法，
// 没有 Verify 的 AC 到那时可以临时换一个更好过的验法。
// 逐块配对而不是数总数，防止一条挂两行、另一条挂零行时总数恰好相等而漏检。
const verifyPerAc = new Map();
let currentAcId = null;
for (const line of acceptance.split(/\r?\n/)) {
  const acHead = line.match(/^-\s+(AC-\d{3}):/);
  if (acHead) {
    currentAcId = acHead[1];
    if (!verifyPerAc.has(currentAcId)) verifyPerAc.set(currentAcId, 0);
    continue;
  }
  if (/^\s+-\s+Verify:/.test(line)) {
    if (currentAcId === null) {
      errors.push('Verify 行出现在所有 AC 之前。');
    } else {
      verifyPerAc.set(currentAcId, verifyPerAc.get(currentAcId) + 1);
    }
  }
}
for (const id of uniqueAcceptanceIds) {
  const count = verifyPerAc.get(id) ?? 0;
  if (count !== 1) {
    errors.push(`${id} 要恰好挂一行缩进的 Verify，现在有 ${count} 行。`);
  }
}

let hasGoldenCaseVerify = false;
for (const verifyMatch of acceptance.matchAll(/^\s+-\s+Verify:\s*(\S.*)$/gm)) {
  const rest = verifyMatch[1].trim();
  const tierMatch = rest.match(/^\[([ABCD])\]\s+(\S.*)$/);
  if (!tierMatch) {
    errors.push(`Verify 行要先标档位 [A]、[B]、[C] 或 [D] 再写内容：${rest}`);
    continue;
  }
  const [, tier, body] = tierMatch;
  const trimmed = body.trim();
  if (tier === 'B') hasGoldenCaseVerify = true;
  if (trimmed.length < 8) {
    errors.push(`Verify [${tier}] 的内容太短，没法照着验：${trimmed}`);
  }
  // [A] 档必须有反引号：session.mjs verify 从反引号里抽命令去实际执行。抽不出就静默
  // 漏跑，而漏跑的 AC 在报告里跟通过了长得一模一样——这是这份校验器唯一能挡住的假绿。
  if (tier === 'A' && !/`[^`]+`/.test(trimmed)) {
    errors.push(`Verify [A] 必须用反引号写出要跑的命令，否则 verify 抽不出来会静默漏跑：${trimmed}`);
  }
  // [B] 不带反引号只降级为 WARNING：fixture 路径可能确实还没有惯用写法，
  // 但缺了它验收阶段要靠猜，值得人工复核一次。
  if (tier === 'B' && !/`[^`]+`/.test(trimmed)) {
    warnings.push(`Verify [B] 该用反引号写出 fixture 的落盘路径：${trimmed}`);
  }
  // 内嵌档段（一行多档：「[C] 步骤…；[A] `命令`」）。session 的冒烟与本校验器曾共用
  // 「只认首档」的视野，内嵌 [A] 既不被跑也不被查——双处一致的盲区（2026-08-31 实锤：
  // 3 份契约 4 条 AC 的内嵌 [A] 从未冒烟）。每段独立校验：内嵌 [A] 同样必须有反引号。
  const marks = [...rest.matchAll(/\[([ABCD])\]/g)];
  for (let i = 1; i < marks.length; i += 1) {
    const segStart = marks[i].index + marks[i][0].length;
    const segEnd = i + 1 < marks.length ? marks[i + 1].index : rest.length;
    const seg = rest.slice(segStart, segEnd).trim();
    if (marks[i][1] === 'A' && !/`[^`]+`/.test(seg)) {
      errors.push(`Verify 的内嵌 [A] 段必须用反引号写出要跑的命令，否则冒烟抽不出来会静默漏跑：${seg || '(空段)'}`);
    } else if (marks[i][1] === 'B' && !/`[^`]+`/.test(seg)) {
      warnings.push(`Verify 的内嵌 [B] 段该用反引号写出 fixture 的落盘路径：${seg}`);
    }
  }
}

for (const optional of ['读什么', '要落盘的东西', '挡着的事', '自主边界', '残留风险']) {
  if ((sections.get(optional)?.length ?? 0) > 1) {
    errors.push(`章节只能出现一次：${optional}`);
  }
}

// 这两节空着比不写更糟：写了标题就等于宣称「这件事想过了」，执行 Agent 和下一个改契约的
// 人都会照此当真，而底下什么都没有。要么写满，要么整节删掉。
for (const declared of ['自主边界', '残留风险']) {
  const body = section(declared);
  if (body !== null && bulletLines(body).length < 1) {
    errors.push(`「${declared}」写了标题就至少给一条，空着看起来像已经想过了。不写就整节删掉。`);
  }
}

// 契约必须自包含：单独拿走它仍然完整可交接。唯一允许指向 issue 目录内部的，是「读什么」
// 点名的确认版对照物（2-prototype/ 根下那几份）。指回过程文件的契约一旦被单独拿走就残废了,
// 而它恰恰是这套流程里唯一会被单独拿走的那份文件——交接指令只给它一个路径。
const processRefs = new Set(
  [...content.matchAll(/(1-interview\/|2-prototype\/drafts\/|manifest\.json|rounds\.jsonl|impact-surface\.md)/g)]
    .map((match) => match[1]),
);
for (const ref of processRefs) {
  errors.push(`引用了过程文件 ${ref}，契约就不自包含了。那里的结论要聚进契约本身，不是指回素材。`);
}

const readFirst = section('读什么');
if (readFirst !== null && bulletLines(readFirst).length < 1) {
  errors.push('「读什么」写了就至少给一条指路。');
}

// 确认版对照物应该从「读什么」指路。引用了 HTML 对照物（mock / diagram）却没有这一节时，
// 执行 Agent 只能从 Verify 行反推对照物是什么。对照物是条件产物，不涉界面或架构改动的
// 任务没有它完全合法，所以只降级为 WARNING。
if (/[\w./\\-]*(?:mock|diagram)[\w-]*\.html/i.test(content) && readFirst === null) {
  warnings.push('正文引用了 mock.html / diagram.html，但没有「读什么」这一节指向它。');
}

// 契约落在 issue 目录里（<issue>/3-contract/contract.md）时，同级该有 manifest.json。
// 没有说明它是手搬进去的，或者目录被改坏了——两种情况编排器都会找不到状态。
const contractDir = dirname(resolvedPath);
const issueDir = dirname(contractDir);
if (/[\\/]3-contract$/.test(contractDir) && !existsSync(join(issueDir, 'manifest.json'))) {
  warnings.push('契约在 issue 目录的 3-contract/ 下，但上一级没有 manifest.json。跑 session.mjs rebuild。');
}

// 「读什么」指向的对照物必须真的在。指了一份不存在的文件，执行 Agent 会当作
// 「这份对照物我读不到，那就自己发明」——比不指还糟。
if (readFirst !== null) {
  for (const ref of readFirst.matchAll(/`([^`]*2-prototype\/[^`]+)`/g)) {
    if (!existsSync(resolve(contractDir, ref[1]))) {
      warnings.push(`「读什么」指向的对照物不存在：${ref[1]}`);
    }
  }
}

const deliverables = section('要落盘的东西');
if (deliverables !== null) {
  const deliverableBullets = bulletLines(deliverables);
  const deliverableMatches = [...deliverables.matchAll(/^-\s+(D-\d{2}):\s*(\S.*)$/gm)];
  if (deliverableBullets.length < 1 || deliverableBullets.length !== deliverableMatches.length) {
    errors.push('「要落盘的东西」的每条 bullet 都要写成 "- D-01: <路径>: <要求>"。');
  }
  const deliverableIds = deliverableMatches.map((match) => match[1]);
  if (new Set(deliverableIds).size !== deliverableIds.length) {
    errors.push('落盘物的编号有重复。');
  }
  for (let index = 0; index < deliverableIds.length; index += 1) {
    const expected = `D-${String(index + 1).padStart(2, '0')}`;
    if (deliverableIds[index] !== expected) {
      errors.push(`落盘物编号要连续，这里应该是 ${expected}。`);
      break;
    }
  }
} else if (hasGoldenCaseVerify) {
  warnings.push('有 [B] 档的 Verify 但没有「要落盘的东西」这一节，确认 fixture 已经在磁盘上。');
}

for (const warning of warnings) console.log(`WARNING: ${warning}`);
if (errors.length > 0) {
  for (const message of errors) console.log(`ERROR: ${message}`);
  console.log(`INVALID: ${resolvedPath}`);
  process.exit(1);
}
console.log(`AC_COUNT: ${acceptanceIds.length}`);
console.log(`VALID: ${resolvedPath}`);
process.exit(0);
