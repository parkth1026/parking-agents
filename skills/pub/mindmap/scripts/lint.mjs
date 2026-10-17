#!/usr/bin/env node
// lint.mjs — 按 references/rules.md 自检 *.mindmap.md
// 用法: node lint.mjs <文件.md> [更多文件…]
// 退出码: 0 无违规 / 1 有违规 / 2 用法错或文件读不到
import { readFileSync } from "node:fs";

const R = { branch: 12, leaf: 30, kids: 7, depth: 6, note: 20 };
const META = /^(来源|图例|说明|元信息|关联)/;
const STATUS = /[✅🧪❓](已定|探索|待定)/gu;

const files = process.argv.slice(2);
if (!files.length) {
  console.error("用法: node lint.mjs <文件.md> [更多文件…]");
  process.exit(2);
}

const len = (s) => [...s].length;
// 计字口径：去掉魔法注释、（注）、状态标记，链接只留文字
const clean = (s) => s.replace(/<!--.*?-->/g, "").replace(/（注：.*?）/g, "")
  .replace(STATUS, "").replace(/\[\[(.*?)\]\]/g, "$1")
  .replace(/\[(.*?)\]\(.*?\)/g, "$1").trim();

function parse(text) {
  const lines = text.split(/\r?\n/);
  let i0 = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) i0 = end + 1;
  }
  const nodes = [];
  const v = [];
  let h = 0;
  let inComment = false;
  for (let i = i0; i < lines.length; i++) {
    const line = lines[i];
    if (inComment) { if (line.includes("-->")) inComment = false; continue; }
    if (/^\s*<!--/.test(line)) { if (!line.includes("-->")) inComment = true; continue; }
    let m, d, t;
    if ((m = line.match(/^(#+)\s+(.*)/))) {
      h = m[1].length; d = h; t = m[2];
      if (h > 2) v.push([i + 1, `用了 ${"#".repeat(h)} 标题，二级以下改用列表`, t]);
    } else if ((m = line.match(/^([ \t]*)[-*+]\s+(.*)/))) {
      const ind = m[1];
      if (ind.includes("\t")) v.push([i + 1, "缩进含 Tab，改用 2 空格", m[2]]);
      else if (ind.length % 2) v.push([i + 1, `缩进 ${ind.length} 空格，不是 2 的倍数`, m[2]]);
      d = h + Math.floor(ind.replace(/\t/g, "  ").length / 2) + 1; t = m[2];
    } else continue;
    nodes.push({ line: i + 1, d, raw: t, fold: /markmap:\s*fold/.test(t), kids: 0 });
  }
  return { nodes, v };
}

let total = 0;
for (const f of files) {
  let text;
  try { text = readFileSync(f, "utf8"); }
  catch (e) { console.error(`读不到 ${f}: ${e.message}`); process.exit(2); }
  const { nodes, v } = parse(text);

  const stack = [];
  for (const n of nodes) {
    while (stack.length && stack.at(-1).d >= n.d) stack.pop();
    if (stack.length) stack.at(-1).kids++;
    n.hidden = stack.some((s) => s.fold);
    stack.push(n);
  }

  const roots = nodes.filter((n) => n.d === 1);
  if (roots.length !== 1) v.push([roots[1]?.line ?? 1, `根节点（#）应恰好 1 个，实际 ${roots.length}`, ""]);

  for (const n of nodes) {
    const t = clean(n.raw);
    const L = len(t);
    const isLeaf = n.kids === 0;
    if (n.d > R.depth) v.push([n.line, `深度 ${n.d} > ${R.depth}，考虑拆文件`, t]);
    if (n.kids > R.kids) v.push([n.line, `子节点 ${n.kids} > ${R.kids}，再分一组`, t]);
    if (!isLeaf && n.d > 1 && L > R.branch) v.push([n.line, `分支 ${L} 字 > ${R.branch}，说明下沉为叶子`, t]);
    if (isLeaf && L > R.leaf) v.push([n.line, `叶子 ${L} 字 > ${R.leaf}`, t]);
    for (const [, note] of n.raw.matchAll(/（注：(.*?)）/g)) {
      if (len(note) > R.note) v.push([n.line, `（注）${len(note)} 字 > ${R.note}`, note]);
    }
    if (/\[\[.*?\]\]/.test(n.raw)) v.push([n.line, "节点含 [[ ]]，改纯文本，wiki 页列进顶部关联注释", t]);
    if (n.d === 2 && META.test(t)) v.push([n.line, "元信息占用一级分支，移到顶部注释", t]);
  }

  v.sort((a, b) => a[0] - b[0]);
  const lens = nodes.map((n) => len(clean(n.raw)));
  const stats = {
    节点数: nodes.length,
    一级分支: nodes.filter((n) => n.d === 2).length,
    首屏节点: nodes.filter((n) => n.d <= 3 && !n.hidden).length,
    最大深度: nodes.length ? Math.max(...nodes.map((n) => n.d)) : 0,
    平均字数: lens.length ? +(lens.reduce((a, b) => a + b) / lens.length).toFixed(1) : 0,
    带注节点: nodes.filter((n) => /（注：/.test(n.raw)).length,
    状态标记: nodes.filter((n) => /[✅🧪❓](已定|探索|待定)/u.test(n.raw)).length,
    违规: v.length,
  };
  console.log(`${f}`);
  console.log("  " + Object.entries(stats).map(([k, x]) => `${k} ${x}`).join(" · "));
  for (const [l, why, t] of v) console.log(`  L${l} ${why}${t ? `：${t}` : ""}`);
  total += v.length;
}
process.exit(total ? 1 : 0);
