#!/usr/bin/env node
// check-shadow-skills.mjs — 技能扫描根「影子技能」检测(随时可跑的漏网之鱼复查)
// 规则:真技能不限层级——skills/<分类>/<技能名>/ 任意嵌套深度都合法;
// 评测产物目录(evals/、eval-fixtures/、*-workspace/、skill-snapshot*)里出现的
// 活 SKILL.md 才是影子——递归扫描的宿主会把它们识别成第二个技能,挤进技能清单、
// 污染触发评测。快照请走 snapshot-skill.mjs(SKILL.md 已改名 .bak),本脚本负责
// 揪出所有冒充真技能的活体 SKILL.md。
// 用法: node check-shadow-skills.mjs [技能根1 技能根2 ...]
//   不带参数时自动检查 skills 祖先扫描根(从本技能目录向上找名为 skills 的祖先,
//   与 snapshot-skill.mjs 同一语义;找不到时回退技能父目录)。
// 退出码: 0 干净 / 1 发现影子技能 / 2 用法错(没有可查的根)
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, relative, resolve } from "node:path";

const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__"]);
const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 评测产物目录名单:SKILL.md 落在这些目录内即判影子(按产物来源区分真技能与冒充
// 产物)。名单是硬编码约定——未来新增产物形态须回来登记,否则该形态漏检。
const ARTIFACT_EXACT_DIRS = new Set(["evals", "eval-fixtures"]);
const isArtifactDir = (name) => ARTIFACT_EXACT_DIRS.has(name)
  || name.startsWith("skill-snapshot")
  || name.endsWith("-workspace");

// 无参数派生:与 snapshot-skill.mjs 同一语义——从本技能目录向上找名为 skills 的
// 祖先作扫描根,分类布局下从任一分类技能跑都覆盖全仓技能根;找不到时回退技能
// 父目录并提示。
function deriveDefaultScanRoot() {
  for (let dir = dirname(SKILL_DIR); ; ) {
    if (basename(dir) === "skills") return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.log("注: 目录向上未找到 skills 祖先，派生根回退技能父目录");
  return resolve(SKILL_DIR, "..");
}

function usage() {
  console.log("用法: node check-shadow-skills.mjs [技能根1 技能根2 ...]");
  console.log("  不带参数时自动检查 skills 祖先扫描根(从本技能目录向上找,存在才查)。");
  console.log("  影子技能 = 评测产物目录(evals/eval-fixtures/*-workspace/skill-snapshot*)里的活 SKILL.md。");
  console.log("示例: node check-shadow-skills.mjs <扫描根>");
  process.exit(2);
}

const argRoots = process.argv.slice(2);
const roots = argRoots.length
  ? argRoots.map((r) => resolve(r))
  : [deriveDefaultScanRoot()].filter((r) => {
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
    // 真技能不限层级;路径上任一段落在产物目录名单内即为影子
    (segments.slice(0, -1).some(isArtifactDir) ? shadows : legit).push(file);
  }

  console.log(root);
  console.log(`  技能 ${legit.length} 个（递归）`);
  if (!shadows.length) {
    console.log("  ✓ 无影子技能");
    continue;
  }
  totalShadows += shadows.length;
  console.log(`  影子技能 ${shadows.length} 个:`);
  for (const file of shadows) {
    console.log(`    ${relative(root, file)}  → 位于评测产物目录，会冒充真技能`);
  }
}

if (totalShadows) {
  console.log(`\n共 ${totalShadows} 个影子技能:递归扫描的宿主会把它们当真技能列进清单。`);
  console.log("快照请改用 snapshot-skill.mjs(SKILL.md 自动改 .bak);评测产物/夹具请移出技能根或去识别化。");
  process.exit(1);
}
console.log(`\n全部干净:${roots.length} 个技能根无影子技能。`);
