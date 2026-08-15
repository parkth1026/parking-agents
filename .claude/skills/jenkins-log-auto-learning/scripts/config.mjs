// config.mjs — jenkins-log-auto-learning 共享配置加载
//
// 配置 = 技能固有默认（config.json，默认取脚本上级）⊕ 环境覆盖（$SKILL_ENV 或
// ~/.claude/skill-env.json），二者深合并，环境层优先；脚本内无绝对路径。
// 所有路径字段支持 ~/ 前缀展开。
//
// 导出:
//   readJson(path)            读 JSON（strip UTF-8 BOM）
//   readJsonOrDie(path,label,hint)  读长期 JSON 文件；损坏即报错退出并给恢复指引
//   deepMerge(base, over)     深合并；数组整体替换（不拼接）
//   expandHome(p)             展开 ~ / ~/ 前缀到用户主目录
//   loadConfig(configPath)    合并并校验必要字段，缺失即 exit(1) 并报错
//   writeJsonCRLF(path, obj)  UTF-8 无 BOM + CRLF 写入（与 ps1 时代输出格式一致）
//   writeJsonAtomicCRLF(path, obj)  同上格式，但 tmp+rename 原子替换（防崩溃截断）
//   localTimestamp()          本地时间 yyyy-MM-ddTHH:mm:ss

import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// 容错：strip UTF-8 BOM（历史 config 可能带 BOM，JSON.parse 不接受）
export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

// 优雅读：账本/pending 等长期文件损坏时不抛裸栈——报错退出并给出恢复指引。
// （workflow.json 的既有处理风格推广到全部长期 JSON）
export function readJsonOrDie(path, label, hint) {
  try {
    return readJson(path);
  } catch (e) {
    console.error(`${label} 不是合法 JSON（${e.message}）。${hint}`);
    process.exit(1);
  }
}

// 深合并：over 覆盖 base；数组整体替换（不拼接）
export function deepMerge(base, over) {
  if (Array.isArray(over)) return over.slice();
  if (over === null || typeof over !== "object") return over;
  const out = Array.isArray(base) ? base.slice() : base && typeof base === "object" ? { ...base } : {};
  for (const k of Object.keys(over)) out[k] = deepMerge(base && base[k], over[k]);
  return out;
}

// 展开 ~ / ~/ 前缀到用户主目录（config.example.json 示例使用 ~/ 路径）
export function expandHome(p) {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
  return p;
}

// 默认取脚本上级 config.json；环境层取 $SKILL_ENV 或 ~/.claude/skill-env.json
export function loadConfig(configPath) {
  let defaults = {};
  if (existsSync(configPath)) defaults = readJson(configPath);
  const envPath = process.env.SKILL_ENV || join(homedir(), ".claude", "skill-env.json");
  let env = {};
  if (existsSync(envPath)) env = readJson(envPath);
  const merged = deepMerge(defaults, env);

  const baseUrl = merged.jenkins && merged.jenkins.baseUrl;
  if (!baseUrl) {
    console.error("缺少 jenkins.baseUrl —— 请在 ~/.claude/skill-env.json（或 --config / $SKILL_ENV 指向的文件）中设置。");
    process.exit(1);
  }
  if (!merged.trackFile) {
    console.error("缺少 trackFile —— 请在 skill-env.json 中设置。");
    process.exit(1);
  }
  if (!Array.isArray(merged.jobs)) {
    console.error("缺少 jobs 列表 —— 请在 skill-env.json 中设置。");
    process.exit(1);
  }
  return merged;
}

// UTF-8 无 BOM + CRLF 写入（与此前 ps1 版输出格式一致）
export function writeJsonCRLF(path, obj) {
  const text = JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  writeFileSync(path, text, "utf8");
}

// 原子写（tmp + rename）：rename 在 Windows 走 MoveFileEx(REPLACE_EXISTING)、
// 同卷原子替换——崩溃/断电时读者只会看到完整旧文件或完整新文件，不会看到半文件。
// 长期账本（analyzed-builds.json / pending-pairs.json）一律走这里。
export function writeJsonAtomicCRLF(path, obj) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n", "utf8");
  renameSync(tmp, path);
}

// 本地时间 yyyy-MM-ddTHH:mm:ss（与 PowerShell Get-Date -Format 输出一致）
export function localTimestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
