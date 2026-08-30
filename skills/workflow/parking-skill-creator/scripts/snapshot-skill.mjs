#!/usr/bin/env node
// snapshot-skill.mjs — 改进既有技能前的去识别化快照
// 复制技能目录到 <workspace>/skill-snapshot[-vN]，并把快照内 SKILL.md 改名 SKILL.md.bak。
// 为什么改名：技能扫描器按 SKILL.md 文件名识别技能；workspace 若在技能扫描根
// 下，快照里留一个活的 SKILL.md 会被识别成
// 第二个同名技能，还会污染触发评测的技能清单。基线 run 把快照目录当「技能路径」，
// prompt 注明技能文档读 SKILL.md.bak，scripts/references 照常按相对路径用。
// 用法: node snapshot-skill.mjs <技能目录> [workspace目录]
//       workspace 缺省为 skills 祖先父级的 evals/<技能名>-workspace（向上找名为
//       skills 的祖先、取其父，任意嵌套深度都落在扫描根外；找不到时回退上两级
//       公式，既有同级旧 workspace 可显式传参沿用）。
// 退出码: 0 成功 / 1 拒绝（不是技能目录、无可用快照名、复制失败）/ 2 用法错
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.log("用法: node snapshot-skill.mjs <技能目录> [workspace目录]");
  console.log("  workspace 缺省为 skills 祖先父级的 evals/<技能名>-workspace（向上找 skills 祖先，");
  console.log("  找不到时回退上两级公式）；快照目录 skill-snapshot，已占用自动递增 -v2/-v3…");
  console.log("示例: node snapshot-skill.mjs ../feishu-doc-qa");
  process.exit(2);
}

const [skillDirRaw, workspaceRaw] = process.argv.slice(2);
if (!skillDirRaw || skillDirRaw.startsWith("-")) usage();

const skillDir = resolve(skillDirRaw);
const marker = join(skillDir, "SKILL.md");
if (!existsSync(marker) || !statSync(marker).isFile()) {
  console.error(`拒绝：${marker} 不存在或不是文件，不是技能目录`);
  process.exit(1);
}

// 缺省 workspace 落在技能扫描根之外：向上找名为 skills 的祖先、取其父，任意嵌套
// 深度的分类布局都归位到 <skills 祖先的父>/evals/，快照与评测产物里的 SKILL.md
// 永远不会被技能扫描器看到。纯字符串解析、不跟进符号链接——link 挂载时按调用侧
// 路径解析（用户级 ~/.agents/skills/<技能> 照旧落 ~/.agents/evals）。
function defaultWorkspaceRoot(skillDir) {
  for (let dir = dirname(skillDir); ; ) {
    if (basename(dir) === "skills") return { root: dirname(dir), fallback: false };
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { root: dirname(dirname(skillDir)), fallback: true };
}

let workspace;
if (workspaceRaw) {
  workspace = resolve(workspaceRaw);
} else {
  const def = defaultWorkspaceRoot(skillDir);
  if (def.fallback) console.log("注: 目录向上未找到 skills 祖先，workspace 回退上两级解析");
  workspace = join(def.root, "evals", `${basename(skillDir)}-workspace`);
}
if (existsSync(workspace) && !statSync(workspace).isDirectory()) {
  console.error(`拒绝：workspace 路径被文件占用：${workspace}`);
  process.exit(1);
}
try {
  mkdirSync(workspace, { recursive: true });
} catch (err) {
  console.error(`拒绝：workspace 无法创建（${err.code ?? err.message}）：${workspace}`);
  process.exit(1);
}

// skill-snapshot → skill-snapshot-v2 → skill-snapshot-v3 … 取第一个不存在的
let snapDir = null;
for (const name of ["skill-snapshot", ...Array.from({ length: 98 }, (_, i) => `skill-snapshot-v${i + 2}`)]) {
  const candidate = join(workspace, name);
  if (!existsSync(candidate)) { snapDir = candidate; break; }
}
if (!snapDir) {
  console.error(`拒绝：${workspace} 下 skill-snapshot 到 -v99 全部被占用，请清理后重试`);
  process.exit(1);
}

try {
  // dereference:技能目录经符号链接挂载（用户级 link 指向仓库深层）时，必须复制
  // 实体内容而不是链接本身——否则 snapDir 成为指向源的链接，下方 rename 会
  // 穿透链接把源技能的 SKILL.md 改名。真目录场景下该选项不改变任何行为。
  cpSync(skillDir, snapDir, { recursive: true, dereference: true });
  const bak = join(snapDir, "SKILL.md.bak");
  if (existsSync(bak)) rmSync(bak); // 全新目录正常不会有，防御 Windows rename 目标存在即失败
  renameSync(join(snapDir, "SKILL.md"), bak);
} catch (err) {
  console.error(`复制失败：${err.message}`);
  rmSync(snapDir, { recursive: true, force: true });
  process.exit(1);
}

console.log(`SNAPSHOT ${snapDir}`);
console.log("基线 run 的「技能路径」填上面目录，prompt 注明：技能文档读 SKILL.md.bak");
