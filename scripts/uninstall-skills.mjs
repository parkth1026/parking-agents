#!/usr/bin/env node
/**
 * Unified uninstaller entry: remove every link in a user-level skills
 * directory that points into this repo's skills/ tree — whatever installed it,
 * including historical deprecated/in-progress links.
 *
 *   node scripts/uninstall-skills.mjs                    interactive TUI
 *                                                        (plain menu when not
 *                                                        a terminal)
 *   node scripts/uninstall-skills.mjs --target both      non-interactive (default)
 *   node scripts/uninstall-skills.mjs --target claude --dry-run
 *
 * Foreign links (lark-*), real directories, and loose files are never touched;
 * skills-backup-* folders next to the target are reported, never deleted.
 * Any argument switches to pure non-interactive mode. Exit codes: 0 ok,
 * 1 failure, 2 usage error.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import readline from "node:readline/promises";
import * as clack from "./vendor/clack-prompts.mjs";
import { repoSources, uninstallSkills } from "./skill-links.mjs";

const TARGETS = {
  agents: () => join(homedir(), ".agents", "skills"),
  claude: () => join(homedir(), ".claude", "skills"),
};

function usage() {
  console.log(`用法: node scripts/uninstall-skills.mjs [选项]

不带参数进入交互卸载（真终端为方向键 clack TUI，回车取高亮推荐项；
管道/CI/哑终端自动退回 plain 菜单，每步回车即默认）；带任意参数则纯非交互（默认 target=both）。

  --target agents|claude|both   卸载目标（默认 both）
  --dry-run                     只报告，不改任何东西`);
}

function parseArgs(argv) {
  const options = { target: null, dryRun: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const value = () => {
      const v = argv[++index];
      if (v === undefined) throw new Error(`缺少参数值: ${arg}`);
      return v;
    };
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--target") options.target = value();
    else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }
  if (options.target !== null && !["agents", "claude", "both"].includes(options.target)) {
    throw new Error(`非法 --target '${options.target}'（可选: agents, claude, both）`);
  }
  return options;
}

function runUninstall({ target, dryRun }) {
  const targets = target === "both" ? ["agents", "claude"] : [target];
  let failed = false;
  for (const key of targets) {
    if (targets.length > 1) console.log(`\n=== ${key} ===`);
    const result = uninstallSkills({ sources: repoSources, target: TARGETS[key](), dryRun });
    if (result.failures.length > 0) failed = true;
  }
  return failed;
}

/** Interactive entry: clack TUI on a real terminal, plain menu otherwise. */
async function interactive() {
  return process.stdin.isTTY && process.stdout.isTTY ? interactiveTui() : interactivePlain();
}

async function interactiveTui() {
  clack.intro("parking-agents 技能卸载器");
  clack.log.info("只删指向本仓 skills/ 的链接，lark-* 等外来项不动。");
  const target = await clack.select({
    message: "卸载目标",
    initialValue: "both",
    options: [
      { value: "both", label: "两个都卸（推荐）", hint: "~/.agents/skills + ~/.claude/skills" },
      { value: "agents", label: "只卸 ~/.agents/skills" },
      { value: "claude", label: "只卸 ~/.claude/skills" },
    ],
  });
  if (clack.isCancel(target)) {
    clack.cancel("已取消");
    return 0;
  }
  const targetLabel = { agents: "~/.agents/skills", claude: "~/.claude/skills", both: "~/.agents/skills + ~/.claude/skills" }[target];
  clack.note(`将删除 ${targetLabel} 里所有指向本仓 skills/ 的链接（外来项不动）。`, "卸载计划");
  const confirmed = await clack.confirm({ message: "确认执行?", initialValue: true });
  if (clack.isCancel(confirmed) || !confirmed) {
    clack.cancel("已取消，未做任何改动。");
    return 0;
  }
  const failed = runUninstall({ target, dryRun: false });
  clack.outro(failed ? "卸载结束：有失败项，见上方日志" : "卸载完成 ✓");
  return failed ? 1 : 0;
}

async function interactivePlain() {
  console.log("parking-agents 技能卸载器（只删指向本仓 skills/ 的链接，lark-* 等外来项不动）\n");
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
  const ask = async (prompt, valid, fallback) => {
    for (;;) {
      process.stdout.write(prompt);
      const answer = (await nextLine()).trim();
      if (answer === "" && fallback !== undefined) return fallback;
      if (valid.includes(answer)) return answer;
      const hint = fallback !== undefined ? `，或直接回车用默认 ${fallback}` : "";
      console.log(`无效选择: ${answer || "(空)"}，请输入 ${valid.join(" / ")}${hint}`);
    }
  };
  try {
    console.log("卸载目标:");
    console.log("  [1] ~/.agents/skills");
    console.log("  [2] ~/.claude/skills");
    console.log("  [3] 两个都卸（默认）");
    const answer = await ask("选择 [1-3]（回车=3）: ", ["1", "2", "3"], "3");
    const target = { "1": "agents", "2": "claude", "3": "both" }[answer];
    const targetLabel = { agents: "~/.agents/skills", claude: "~/.claude/skills", both: "~/.agents/skills + ~/.claude/skills" }[target];
    console.log(`\n即将删除 ${targetLabel} 里所有指向本仓 skills/ 的链接（外来项不动）。`);
    process.stdout.write("确认执行? [Y/n]: ");
    const confirm = (await nextLine()).trim().toLowerCase();
    if (confirm === "n" || confirm === "no") {
      console.log("已取消，未做任何改动。");
      return 0;
    }
    rl.close();
    console.log();
    return runUninstall({ target, dryRun: false }) ? 1 : 0;
  } finally {
    rl.close();
  }
}

if (process.argv.length <= 2) {
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
  const failed = runUninstall({ target: options.target ?? "both", dryRun: options.dryRun });
  process.exit(failed ? 1 : 0);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  usage();
  process.exit(2);
}
