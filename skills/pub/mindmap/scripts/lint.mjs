#!/usr/bin/env node
// lint.mjs — 按 references/rules.md 自检 *.mindmap.md（A 结构型 / B 记录卡型）
// 用法: node lint.mjs <文件.md> [更多文件…]
// 退出码: 0 无违规 / 1 有违规 / 2 用法错或文件读不到
import { readFileSync } from "node:fs";

const TAG = /〔[^〕]*〕/g;
const R = { branch: 12, leaf: 30, kids: 7, depth: 6, note: 20, entity: 50, field: 45, cardLeaf: 30, accLine: 90 };
const META = /^(来源|图例|说明|元信息|关联)/;
const STATUS = /[✅🧪❓](已定|探索|待定)/gu;
const CARD_RE = /^Story：.*〔E\d-S\d+/;
const FIELDS = /^(用户|原因|验收)：?/;

const files = process.argv.slice(2);
if (!files.length) {
  console.error("用法: node lint.mjs <文件.md> [更多文件…]");
  process.exit(2);
}

const len = (s) => [...s].length;
// 计字口径：去掉魔法注释、（注）、状态标记、〔〕标签、🔌，链接只留文字
const clean = (s) => s.replace(/<!--.*?-->/g, "").replace(/（注：.*?）/g, "")
  .replace(STATUS, "").replace(TAG, "")
  .replace(/🔌/g, "")
  .replace(/\[\[(.*?)\]\]/g, "$1")
  .replace(/\[(.*?)\]\(.*?\)/g, "$1").trim();

function parse(text) {
  const lines = text.split(/\r?\n/);
  let i0 = 0;
  let cardMode = false;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) { i0 = end + 1; cardMode = /^cardMode:\s*true/m.test(lines.slice(1, end).join("\n")); }
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
  return { nodes, v, cardMode };
}

let grand = 0;
for (const f of files) {
  let text;
  try { text = readFileSync(f, "utf8"); }
  catch (e) { console.error(`读不到 ${f}: ${e.message}`); process.exit(2); }
  const { nodes, v, cardMode } = parse(text);

  // 档位判定：frontmatter 声明 或 ≥3 实体卡行（机械判据）
  const cardLines = nodes.filter((n) => CARD_RE.test(n.raw.replace(/^\s*/, "")));
  const isB = cardMode || cardLines.length >= 3;
  const mode = isB ? "B(记录卡)" : "A(结构)";

  const stack = [];
  for (const n of nodes) {
    while (stack.length && stack.at(-1).d >= n.d) stack.pop();
    if (stack.length) stack.at(-1).kids++;
    n.parent = stack.at(-1) || null;
    n.hidden = stack.some((s) => s.fold);
    stack.push(n);
  }

  const roots = nodes.filter((n) => n.d === 1);
  if (roots.length !== 1) v.push([roots[1]?.line ?? 1, `根节点（#）应恰好 1 个，实际 ${roots.length}`, ""]);

  // ── B 档结构校验 ──
  const ids = new Map();
  for (const n of nodes) {
    const t = n.raw;
    const cm = t.match(CARD_RE);
    if (cm) {
      n.isCard = true;
      const id = (t.match(/〔\s*(E\d-S\d+)/) || [])[1];
      n.id = id || null;
      if (id) {
        if (ids.has(id)) v.push([n.line, `编号 ${id} 重复（首次 L${ids.get(id)}），编号全局唯一`, t]);
        else ids.set(id, n.line);
      } else {
        v.push([n.line, "卡行缺〔E#-S#〕编号", t]);
      }
      // 实体行字数（去标签/🔌/Story：前缀）
      const body = clean(t).replace(/^Story：/, "");
      if (len(body) > R.entity) v.push([n.line, `实体行 ${len(body)} 字 > ${R.entity}`, t]);
      // 字段行归属：用户/原因/验收必须直接挂在卡行下（d = card.d+1）
      for (const k of n.kidList || []) void k;
    }
  }
  // 字段行检查（第二遍：知道 parent 后）
  const fieldOk = new Set();
  for (const n of nodes) {
    if (!/^\s*(用户|原因|验收)：?/.test(n.raw)) continue;
    const p = n.parent;
    const inCardZone = p && (p.isCard || (p.raw || "").startsWith("验收"));
    if (!inCardZone) continue; // 非卡区字段行按 A 档普通节点处理
    fieldOk.add(n);
    // 归属：验收分支挂在卡行下，用户/原因挂在卡行下
    if (p.raw.startsWith("验收") && !p.parent?.isCard) v.push([n.line, "验收子叶挂错层（应挂卡行的验收分支下）", n.raw]);
    const L = len(clean(n.raw));
    const isAccLine = /^验收：/.test(n.raw);
    const cap = isAccLine ? R.accLine : (n.raw === '验收' ? R.field : (n.raw.startsWith('验收') ? R.cardLeaf : R.field));
    if (L > cap) v.push([n.line, `${n.raw.startsWith("验收") ? "验收子叶" : "字段行"} ${L} 字 > ${cap}`, n.raw]);
  }
  // 顶格/错层字段行：用户/原因 必须直接挂卡行；验收单行挂卡行、checklist 叶挂验收分支（分支挂卡行）
  for (const n of nodes) {
    const fm = n.raw.match(/^(用户|原因)：/) || (n.raw.startsWith('验收') ? ['验收'] : null);
    if (!fm) continue;
    const p = n.parent;
    let anchored = false;
    if (fm[0] === '验收') {
      anchored = p?.isCard || (p?.raw?.startsWith('验收') && p.parent?.isCard) || p?.raw === '验收' && p.parent?.isCard;
      anchored = p?.isCard || (p && p.raw === '验收' && p.parent && p.parent.isCard);
    } else {
      anchored = p?.isCard;
    }
    const zoneNear = nodes.some((m) => m.isCard && Math.abs(m.line - n.line) < 8);
    if (zoneNear && !anchored) v.push([n.line, "字段行脱离卡片（顶格或错层）——结构事故", n.raw]);
  }
  // 编号前缀与 EPIC 一致
  const epicOf = {};
  let curEpic = null;
  for (const n of nodes) {
    const em = (n.raw || "").match(/^E(\d)/);
    if (n.d === 2 && em) curEpic = em[1];
    if (n.isCard && n.id && curEpic && !n.id.startsWith(`E${curEpic}`)) {
      v.push([n.line, `编号 ${n.id} 前缀与所在 EPIC E${curEpic} 不一致`, n.raw]);
    }
  }

  for (const n of nodes) {
    const t = clean(n.raw);
    const L = len(t);
    const isLeaf = n.kids === 0;
    const inCard = isB && (n.isCard || (n.parent && (n.parent.isCard || n.parent.raw?.startsWith("验收"))));
    if (n.d > R.depth) v.push([n.line, `深度 ${n.d} > ${R.depth}，考虑拆文件`, t]);
    if (n.kids > R.kids && !(isB && (n.d === 2 || n.d === 1))) v.push([n.line, `子节点 ${n.kids} > ${R.kids}，再分一组`, t]);
    // A 档字数；B 档卡区跳过（卡区规则单独查），非卡区仍查
    const isEpicTitle = isB && n.d === 2 && (/^E\d/.test(t) || /发布门|横切|总纲|排期/.test(t));
    if (!inCard && !n.isCard && !isEpicTitle) {
      const bCap = isB ? 35 : R.branch;
      const lCap = isB ? 130 : R.leaf;
      if (!isLeaf && n.d > 1 && L > bCap) v.push([n.line, `分支 ${L} 字 > ${bCap}，说明下沉为叶子`, t]);
      if (isLeaf && L > lCap) v.push([n.line, `叶子 ${L} 字 > ${lCap}`, t]);
    }
    for (const [, note] of n.raw.matchAll(/（注：(.*?)）/g)) {
      if (len(note) > R.note) v.push([n.line, `（注）${len(note)} 字 > ${R.note}`, note]);
    }
    if (/\[\[.*?\]\]/.test(n.raw)) v.push([n.line, "节点含 [[ ]]，改纯文本，wiki 页列进顶部关联注释", t]);
    if (n.d === 2 && META.test(t)) v.push([n.line, "元信息占用一级分支，移到顶部注释", t]);
    // B 档：EPIC(一级分支) 建议带 fold（提示级）
    if (isB && n.d === 2 && !n.fold && nodes.some((m) => m.parent === n && m.isCard)) {
      v.push([n.line, "B 档 EPIC 未加 fold（首屏渐进披露）", t]);
    }
  }

  v.sort((a, b) => a[0] - b[0]);
  const lens = nodes.map((n) => len(clean(n.raw)));
  const stats = {
    档位: mode,
    节点数: nodes.length,
    卡片: cardLines.length,
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
  for (const [l, why, t] of v) console.log(`  L${l} ${why}${t ? `：${(t || "").slice(0, 40)}` : ""}`);
  grand += v.length;
}
process.exit(grand ? 1 : 0);
