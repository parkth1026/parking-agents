#!/usr/bin/env node
// check-shadow-skills.mjs — 技能扫描根「影子技能」检测(随时可跑的漏网之鱼复查)
// 规则:技能扫描根只认一级目录下的 SKILL.md;
// 更深层出现的任何 SKILL.md(workspace 快照、评测产物、夹具)都可能被递归扫描器
// 识别成第二个技能,挤进技能清单、污染触发评测。快照请走 snapshot-skill.mjs
// (SKILL.md 已改名 .bak),本脚本负责揪出所有违反这条规则的活体 SKILL.md。
// 用法: node check-shadow-skills.mjs [技能根1 技能根2 ...]
//   不带参数时自动检查本技能目录的同级扫描根(存在才查)。
// 退出码: 0 干净 / 1 发现影子技能 / 2 用法错(没有可查的根)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { parseFrontmatter } from "./lib/frontmatter.mjs";

const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__"]);
const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SCAN_ROOT = resolve(SKILL_DIR, "..");

function usage() {
  console.log("用法: node check-shadow-skills.mjs [技能根1 技能根2 ...]");
  console.log("  不带参数时自动检查本技能目录的同级扫描根(存在才查)。");
  console.log("  影子技能 = 技能根下非一级目录里的 SKILL.md(快照/评测产物/夹具冒充的技能)。");
  console.log("示例: node check-shadow-skills.mjs <扫描根>");
  process.exit(2);
}

const argRoots = process.argv.slice(2);
const roots = argRoots.length
  ? argRoots.map((r) => resolve(r))
  : [DEFAULT_SCAN_ROOT].filter((r) => {
      try { return statSync(r).isDirectory(); } catch { return false; }
    });
if (!roots.length) usage();

for (const root of roots) {
  try {
    if (!statSync(root).isDirectory()) throw new Error("不是目录");
  } catch {
    console.error(`拒绝:${root} 不存在或不是目录`);
    process.exit(2);
  }
}

/** 递归收集 root 下全部 SKILL.md(跳过 .git/node_modules/__pycache__,不跟进符号链接) */
function collectSkillMd(dir, acc) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isSymbolicLink()) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) collectSkillMd(p, acc);
    } else if (ent.name === "SKILL.md") {
      acc.push(p);
    }
  }
  return acc;
}

let totalShadows = 0;
for (const root of roots) {
  const all = collectSkillMd(root, []);
  const legit = [];
  const shadows = [];
  for (const file of all) {
    const segments = relative(root, file).split(/[\\/]/);
    // ["<技能名>", "SKILL.md"] 是唯一合法形态;更深的都是影子
    (segments.length === 2 ? legit : shadows).push({ file, segments });
  }

  console.log(root);
  console.log(`  一级技能 ${legit.length} 个`);
  if (!shadows.length) {
    console.log("  ✓ 无影子技能");
    continue;
  }
  totalShadows += shadows.length;
  console.log(`  影子技能 ${shadows.length} 个:`);
  for (const { file, segments } of shadows) {
    let name = "?";
    try {
      const { values } = parseFrontmatter(readFileSync(file, "utf8"));
      if (typeof values.name === "string" && values.name) name = values.name;
    } catch { /* 读不出 frontmatter 就显示 ? */ }
    const inWorkspace = segments.some((s) => s.endsWith("-workspace"));
    console.log(`    ${relative(root, file)}  → 会被识别成技能 "${name}"${inWorkspace ? "(workspace 内)" : ""}`);
  }
}

if (totalShadows) {
  console.log(`\n共 ${totalShadows} 个影子技能:递归扫描的宿主会把它们当真技能列进清单。`);
  console.log("快照请改用 snapshot-skill.mjs(SKILL.md 自动改 .bak);评测产物/夹具请移出技能根或去识别化。");
  process.exit(1);
}
console.log(`\n全部干净:${roots.length} 个技能根无影子技能。`);
