#!/usr/bin/env node
// inventory.mjs — 只读盘点：转换时必须随身搬走的 ignored 资产与 submodule
// 结果以 JSON 打印，退出码 0 正常 / 1 目标不可读。
// 用法: node inventory.mjs --target <clone路径>
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { git, parseArgs } from "./lib/core.mjs";

export function runInventory(target) {
  const ignored = git(target, [
    "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z",
  ])
    .split("\0")
    .filter(Boolean);

  // submodule 工作目录本身是 tracked gitlink，不在 ignored 清单里，必须显式列出
  const submodules = [];
  try {
    const mods = git(target, ["config", "--file", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"]);
    for (const line of mods.trim().split("\n").filter(Boolean)) {
      submodules.push(line.split(" ").pop());
    }
  } catch {
    // 没有 .gitmodules
  }

  return { target, ignored, submodules, all: [...ignored, ...submodules] };
}

// ---- CLI（仅在作为主模块执行时运行；被 convert.mjs import 时不触发） ----
import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target || !existsSync(args.target)) {
    console.error("用法: node inventory.mjs --target <clone路径>");
    process.exit(1);
  }
  const target = path.resolve(args.target);
  if (!existsSync(path.join(target, ".git")) || statSync(path.join(target, ".git")).isFile()) {
    console.error("目标必须是独立 clone（.git 为目录）");
    process.exit(1);
  }
  console.log(JSON.stringify(runInventory(target), null, 2));
}
