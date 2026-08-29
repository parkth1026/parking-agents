#!/usr/bin/env node
/**
 * Unified installer entry: junction skills from this repo's skills/ tree into
 * user-level skill directories.
 *
 *   node scripts/install-skills.mjs                              interactive menu
 *   node scripts/install-skills.mjs --target both --set default  non-interactive
 *   node scripts/install-skills.mjs --target agents --set progress --dry-run
 *   node scripts/install-skills.mjs --target claude --only deprecated --dry-run
 *   node scripts/install-skills.mjs --skills cpu-monitor --dry-run
 *   node scripts/install-skills.mjs --list
 *
 * Any argument switches to pure non-interactive mode (CI/agent safe) with
 * defaults target=both, set=default. Zero arguments opens an interactive
 * menu (readline). Exit codes: 0 ok, 1 failure, 2 usage error.
 *
 * --only <category> / --skills a,b,c are explicit selections that BYPASS the
 * set exclusion (--only deprecated installs deprecated; --skills can reach
 * skills inside in-progress).
 */

import { homedir } from "node:os";
import { join } from "node:path";
import readline from "node:readline/promises";
import {
  SETS,
  discoverRepoSkills,
  installSkills,
  repoRoot,
  repoSources,
} from "./skill-links.mjs";

const TARGETS = {
  agents: () => join(homedir(), ".agents", "skills"),
  claude: () => join(homedir(), ".claude", "skills"),
};

function usage() {
  console.log(`用法: node scripts/install-skills.mjs [选项]

不带参数进入交互菜单；带任意参数则纯非交互（默认 target=both, set=default）。

  --target agents|claude|both   安装目标（默认 both）
  --set default|progress|all    套档（默认 default；deprecated/in-progress 默认不装；
                                 整档安装会收走套装外的本仓旧链接）
  --only <分类>                 只装某个分类（绕过套档排除，如 --only deprecated；
                                 外科手术式：只动选中项，不做套装外清除，真跑安全）
  --skills a,b,c                只装指定技能（绕过套档排除，可跨分类；
                                 同上，只动选中项，不做套装外清除）
  --dry-run                     只报告，不改任何东西
  --list                        按分类列出技能与各套档是否包含，然后退出`);
}

function parseArgs(argv) {
  const options = { target: null, set: null, dryRun: false, only: null, skillNames: null, list: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const value = () => {
      const v = argv[++index];
      if (v === undefined) throw new Error(`缺少参数值: ${arg}`);
      return v;
    };
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--list") options.list = true;
    else if (arg === "--target") options.target = value();
    else if (arg === "--set") options.set = value();
    else if (arg === "--only") options.only = value();
    else if (arg === "--skills") {
      options.skillNames = value()
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      if (options.skillNames.length === 0) throw new Error("--skills 名单不能为空");
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }
  if (options.target !== null && !["agents", "claude", "both"].includes(options.target)) {
    throw new Error(`非法 --target '${options.target}'（可选: agents, claude, both）`);
  }
  if (options.set !== null && !(options.set in SETS)) {
    throw new Error(`非法 --set '${options.set}'（可选: ${Object.keys(SETS).join(", ")}）`);
  }
  if (options.only && options.skillNames) throw new Error("--only 与 --skills 不能同时使用");
  return options;
}

/** Per-category counts plus which named sets include each category. */
function categoryTable(skills) {
  const categories = new Map();
  for (const skill of skills) {
    const key = skill.category ?? "(无分类)";
    categories.set(key, (categories.get(key) ?? 0) + 1);
  }
  const rows = [...categories.entries()].sort(([a], [b]) => a.localeCompare(b));
  const inSet = (set, category) =>
    category !== "(无分类)" && !SETS[set].includes(category);
  return { rows, inSet };
}

function listMode(skills) {
  const { rows, inSet } = categoryTable(skills);
  console.log("分类      数量  default  progress  all");
  for (const [category, count] of rows) {
    const mark = (set) => (inSet(set, category) ? "  ✓   " : "  ✗   ");
    console.log(
      `${category.padEnd(10)}${String(count).padStart(3)}   ${mark("default")}    ${mark("progress")}  ✓`
    );
  }
  const count = (set) =>
    skills.filter((skill) => !skill.category || !SETS[set].includes(skill.category)).length;
  console.log(`\n共 ${skills.length} 个技能: default ${count("default")} / progress ${count("progress")} / all ${count("all")}`);
}

function runInstall({ target, set, dryRun, only, skillNames }) {
  const targets = target === "both" ? ["agents", "claude"] : [target];
  let failed = false;
  for (const key of targets) {
    if (targets.length > 1) console.log(`\n=== ${key} ===`);
    const result = installSkills({
      sources: repoSources,
      target: TARGETS[key](),
      labelBase: repoRoot,
      dryRun,
      only,
      skillNames,
      excludeCategories: only || skillNames ? [] : SETS[set],
    });
    if (result.failures.length > 0) failed = true;
  }
  return failed;
}

async function interactive() {
  const skills = discoverRepoSkills();
  const { rows, inSet } = categoryTable(skills);
  const setCount = (set) =>
    skills.filter((skill) => !skill.category || !SETS[set].includes(skill.category)).length;

  console.log("parking-agents 技能安装器\n");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // Queue every line, even ones arriving before a prompt is shown (piped
  // stdin delivers all lines at once; rl.question would drop them).
  const lineQueue = [];
  let lineWaiter = null;
  rl.on("line", (line) => {
    if (lineWaiter) {
      const waiter = lineWaiter;
      lineWaiter = null;
      waiter(line);
    } else {
      lineQueue.push(line);
    }
  });
  const nextLine = () =>
    lineQueue.length > 0
      ? Promise.resolve(lineQueue.shift())
      : new Promise((res) => {
          lineWaiter = res;
        });
  const ask = async (prompt, valid) => {
    for (;;) {
      process.stdout.write(prompt);
      const answer = (await nextLine()).trim();
      if (valid.includes(answer)) return answer;
      console.log(`无效选择: ${answer || "(空)"}，请输入 ${valid.join(" / ")}`);
    }
  };

  try {
    console.log("① 安装目标:");
    console.log("  [1] ~/.agents/skills");
    console.log("  [2] ~/.claude/skills");
    console.log("  [3] 两个都装");
    const targetAnswer = await ask("选择 [1-3]: ", ["1", "2", "3"]);

    console.log("\n② 套档:");
    console.log(`  [1] 默认       (${setCount("default")} 个，排除 deprecated + in-progress)`);
    console.log(`  [2] 含 in-progress (${setCount("progress")} 个，排除 deprecated)`);
    console.log(`  [3] 全部       (${setCount("all")} 个)`);
    const setAnswer = await ask("选择 [1-3]: ", ["1", "2", "3"]);

    const target = { "1": "agents", "2": "claude", "3": "both" }[targetAnswer];
    const set = { "1": "default", "2": "progress", "3": "all" }[setAnswer];
    const targetLabel = { agents: "~/.agents/skills", claude: "~/.claude/skills", both: "~/.agents/skills + ~/.claude/skills" }[target];

    console.log(`\n即将把 ${setCount(set)} 个技能（${set} 档）junction 到 ${targetLabel}。`);
    process.stdout.write("确认执行? [Y/n]: ");
    const confirm = (await nextLine()).trim().toLowerCase();
    if (confirm === "n" || confirm === "no") {
      console.log("已取消，未做任何改动。");
      return 0;
    }
    console.log();
    return runInstall({ target, set, dryRun: false, only: null, skillNames: null }) ? 1 : 0;
  } finally {
    rl.close();
  }
}

const hasArgs = process.argv.length > 2;

if (!hasArgs) {
  try {
    process.exit(await interactive());
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }
  if (options.list) {
    listMode(discoverRepoSkills());
    process.exit(0);
  }
  const target = options.target ?? "both";
  const set = options.set ?? "default";
  if (set !== "default" && (options.only || options.skillNames)) {
    console.warn("warning: --only / --skills 为显式选择，忽略 --set 套档排除（只动选中项，不做套装外清除）");
  }
  const failed = runInstall({
    target,
    set,
    dryRun: options.dryRun,
    only: options.only,
    skillNames: options.skillNames,
  });
  process.exit(failed ? 1 : 0);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  usage();
  process.exit(2);
}
