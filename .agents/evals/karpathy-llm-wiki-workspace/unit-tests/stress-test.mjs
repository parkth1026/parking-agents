#!/usr/bin/env node
// validate-wiki.mjs 边界压力测试 — 验证 suspected gaps（仅存在于 workspace）
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const SCRIPT = "D:/GIT_dev/Claude_skills/.claude/skills/karpathy-llm-wiki/scripts/validate-wiki.mjs";
const ROOT = "D:/GIT_dev/Claude_skills/.claude/skills/karpathy-llm-wiki-workspace/unit-tests/stress";
rmSync(ROOT, { recursive: true, force: true });

function run(wiki) {
  try { return { code: 0, out: execFileSync("node", [SCRIPT, "--wiki", wiki], { encoding: "utf8" }) }; }
  catch (e) { return { code: e.status, out: (e.stdout?.toString() ?? "") }; }
}
const W = (p, c) => { mkdirSync(join(ROOT, p, ".."), { recursive: true }); writeFileSync(join(ROOT, p), c); return join(ROOT, p); };

console.log("[T1] Obsidian 别名链接 [[Page|alias]] — 目标存在但用了别名");
{
  const wiki = W("t1/concepts/A.md", "---\ntitle: A\ntype: concept\ntags: []\n---\n# A\nSee [[B|the B page]] and [[C]].\n");
  W("t1/concepts/B.md", "---\ntitle: B\ntype: concept\ntags: []\n---\n# B\nSee [[A]] and [[C]].\n");
  W("t1/concepts/C.md", "---\ntitle: C\ntype: concept\ntags: []\n---\n# C\nSee [[A]] and [[B]].\n");
  const r = run(wiki);
  console.log("  断链误报:", r.out.includes("B|the B page") ? "是 — [[B|alias]] 被当作整个字符串找 B|alias.md → 误报断链" : "否");
}

console.log("[T2] 标题锚点链接 [[Page#Section]] — Obsidian 常用");
{
  const wiki = W("t2/concepts/A.md", "---\ntitle: A\ntype: concept\ntags: []\n---\n# A\nSee [[B#How It Works]] and [[C]].\n");
  W("t2/concepts/B.md", "---\ntitle: B\ntype: concept\ntags: []\n---\n# B\n## How It Works\nSee [[A]] and [[C]].\n");
  W("t2/concepts/C.md", "---\ntitle: C\ntype: concept\ntags: []\n---\n# C\nSee [[A]] and [[B]].\n");
  const r = run(wiki);
  console.log("  断链误报:", r.out.includes("B#How It Works") ? "是 — [[B#heading]] 未拆分锚点 → 误报断链" : "否");
}

console.log("[T3] Windows 非法文件名字符（冒号，常见于论文/演讲标题）");
{
  // agent 按标题创建 "Attention: Is All You Need.md" 会直接失败或产生兼容问题
  // 模拟：页面 A 链接 [[Attention: Is All You Need]]，该文件无法在 Windows 创建
  const wiki = W("t3/concepts/A.md", "---\ntitle: A\ntype: concept\ntags: []\n---\n# A\nSee [[Attention Is All You Need]] and [[B]].\n");
  W("t3/concepts/B.md", "---\ntitle: B\ntype: concept\ntags: []\n---\n# B\nSee [[A]] twice? no. See [[A]] and [[C]].\n");
  W("t3/concepts/C.md", "---\ntitle: C\ntype: concept\ntags: []\n---\n# C\nSee [[A]] and [[B]].\n");
  console.log("  说明: Windows 文件名禁止 : ? * \" < > | — SKILL.md 无标题→文件名净化规则");
  const r = run(wiki); console.log("  （对照）正常链接运行:", r.out.includes("Status: PASS") ? "PASS" : "FAIL");
}

console.log("[T4] 块状 YAML tags（tags:\\n  - a）逃过 tag 合规检查");
{
  const wiki = W("t4/concepts/A.md", "---\ntitle: A\ntype: concept\ntags:\n  - totally-bogus-tag\n---\n# A\nSee [[B]] and [[C]].\n");
  W("t4/concepts/B.md", "---\ntitle: B\ntype: concept\ntags: []\n---\n# B\nSee [[A]] and [[C]].\n");
  W("t4/concepts/C.md", "---\ntitle: C\ntype: concept\ntags: []\n---\n# C\nSee [[A]] and [[B]].\n");
  W("t4/SCHEMA.md", "# S\n- legit\n");
  const r = run(wiki);
  console.log("  非法标签漏检:", !r.out.includes("totally-bogus-tag") ? "是 — 只匹配 tags: [inline] 数组风格，块状风格被跳过" : "否");
}

console.log("[T5] 大小写：[[transformer]] vs Transformer.md（Windows 不敏感/Linux 敏感）");
{
  const wiki = W("t5/concepts/A.md", "---\ntitle: A\ntype: concept\ntags: []\n---\n# A\nSee [[b]] and [[c]].\n");
  W("t5/concepts/B.md", "---\ntitle: B\ntype: concept\ntags: []\n---\n# B\nSee [[A]] and [[C]].\n");
  W("t5/concepts/C.md", "---\ntitle: C\ntype: concept\ntags: []\n---\n# C\nSee [[A]] and [[B]].\n");
  const r = run(wiki);
  console.log("  小写链接判定:", r.out.includes("Status: PASS") ? "PASS（Windows existsSync 大小写不敏感 → 可移植性隐患：Linux/Obsidian 严格匹配）" : "FAIL");
}

console.log("[T6] 非标准目录（如自建 fundamentals/）中的页面互链");
{
  const wiki = W("t6/fundamentals/A.md", "---\ntitle: A\ntype: concept\ntags: []\n---\n# A\nSee [[B]] and [[C]].\n");
  W("t6/fundamentals/B.md", "---\ntitle: B\ntype: concept\ntags: []\n---\n# B\nSee [[A]] and [[C]].\n");
  W("t6/fundamentals/C.md", "---\ntitle: C\ntype: concept\ntags: []\n---\n# C\nSee [[A]] and [[B]].\n");
  const r = run(wiki);
  console.log("  非标准目录链接:", r.out.includes("Broken Links") ? "误报断链 — SEARCH_DIRS 硬编码 8+1 个目录，fundamentals/ 不在内" : "正常");
  console.log("  孤儿误报:", r.out.includes("Orphan Pages (3)") ? "是 — 链接找到文件但 inboundCount 只按 SEARCH_DIRS 命中累计，目录外页面全部算孤儿" : "否");
}

console.log("[T7] 空目录/无 SCHEMA 的极简 wiki");
{
  const wiki = W("t7/concepts/A.md", "---\ntitle: A\ntype: concept\ntags: []\n---\n# A\nSee [[B]] and [[B]]... 只有 1 个不同目标会 underlinked\n");
  W("t7/concepts/B.md", "---\ntitle: B\ntype: concept\ntags: []\n---\n# B\nSee [[A]] and [[A]].\n");
  const r = run(wiki);
  console.log("  无 SCHEMA 运行:", r.code === 0 || r.code === 1 ? "正常（tagCompliance 无 schema 得 10 分）" : "崩溃");
  console.log("  重复链接计数: A 出链 [[B]]x2 →", r.out.includes("Under-linked") ? "去重不当(2 计 2)" : "每个[[B]]都算 1 出链（同目标重复链接凑数可行 — 规则漏洞）");
}

console.log("[T8] log.md 表格链接污染 index 检查 / log 中 [[链接]] 被忽略");
{
  const wiki = W("t8/concepts/A.md", "---\ntitle: A\ntype: concept\ntags: []\n---\n# A\nSee [[B]] and [[C]].\n");
  W("t8/concepts/B.md", "---\ntitle: B\ntype: concept\ntags: []\n---\n# B\nSee [[A]] and [[C]].\n");
  W("t8/concepts/C.md", "---\ntitle: C\ntype: concept\ntags: []\n---\n# C\nSee [[A]] and [[B]].\n");
  W("t8/log.md", "# Log\n| Date | Op | Details |\n|---|---|---|\n| 2026 | ingest | [[D]] ghost in log only |\n");
  W("t8/SCHEMA.md", "# S\n- a\n");
  const r = run(wiki);
  console.log("  log.md 中断链:", r.out.includes("log.md -> [[D]]") ? "被计入（log 被排除扫描，OK）" : "未计入（log.md 在 EXCLUDED_NAMES，正确）");
}
