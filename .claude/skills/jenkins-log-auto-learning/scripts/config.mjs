// config.mjs — jenkins-log-auto-learning 共享配置加载
//
// 配置 = 技能固有默认（config.json，默认取脚本上级）⊕ 环境层，二者深合并，环境层优先。
// 环境层解析链（只查本地文件，不依赖网络）:
//   $SKILL_ENV > ~/.config/parking-agents/skill-env.json > ~/.claude/skill-env.json（旧位置回退）
//   第一个存在的文件生效；三层都无 → 打印配置引导（已查路径 + 三步引导）后 exit 1。
// 配置加载成功后首步对 UNC（NAS）路径做 fail-fast 连通检查，不可达时打印现状报告
// （不可达路径/受影响操作/建议检查）后 exit 1，替代深处裸露的 ENOENT 堆栈。
// 所有路径字段支持 ~/ 前缀展开；脚本内无绝对路径。
//
// 导出:
//   readJson(path)            读 JSON（strip UTF-8 BOM）
//   readJsonOrDie(path,label,hint)  读长期 JSON 文件；损坏即报错退出并给恢复指引
//   deepMerge(base, over)     深合并；数组整体替换（不拼接）
//   expandHome(p)             展开 ~ / ~/ 前缀到用户主目录
//   resolveEnvLayer()         按解析链返回 { path, via }（via: SKILL_ENV|new|fallback）；无文件返回 null
//   loadConfig(configPath)    合并并校验必要字段 + NAS 连通检查，缺失/不可达即 exit(1)
//   writeJsonCRLF(path, obj)  UTF-8 无 BOM + CRLF 写入（与 ps1 时代输出格式一致）
//   writeJsonAtomicCRLF(path, obj)  同上格式，但 tmp+rename 原子替换（防崩溃截断）
//   localTimestamp()          本地时间 yyyy-MM-ddTHH:mm:ss

import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

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

// ---------- 环境层解析链 ----------

const envPathNew = () => join(homedir(), ".config", "parking-agents", "skill-env.json");
const envPathOld = () => join(homedir(), ".claude", "skill-env.json");

// $SKILL_ENV > 新路径 > 旧路径回退；第一个存在的文件生效
export function resolveEnvLayer() {
  const candidates = [];
  if (process.env.SKILL_ENV) candidates.push({ path: process.env.SKILL_ENV, via: "SKILL_ENV" });
  candidates.push({ path: envPathNew(), via: "new" });
  candidates.push({ path: envPathOld(), via: "fallback" });
  for (const c of candidates) if (existsSync(c.path)) return c;
  return null;
}

// 三层都无配置文件：给可照做的三步引导，而不是裸报缺失字段
function guideOnMissingConfig() {
  const template = join(scriptDir, "..", "config.example.json");
  console.error(`未找到配置文件（已查: $SKILL_ENV${process.env.SKILL_ENV ? `=${process.env.SKILL_ENV}` : "（未设置）"}、${envPathNew()}、${envPathOld()}）`);
  console.error("配置引导:");
  console.error(`  1. 拷贝模板: ${template}（默认已指向 NAS 知识库）`);
  console.error(`  2. 放到:     ${envPathNew()}`);
  console.error("  3. 按机器改: gitRepos（如 D:/Git）");
  process.exit(1);
}

// ---------- NAS fail-fast 连通检查 ----------

// 从 UNC 路径取 //主机/共享 根（子目录允许懒创建，根不可达才判定 NAS 不可达）
function uncRoot(p) {
  const m = String(p).replace(/\\/g, "/").match(/^(\/\/[^/]+\/[^/]+)/);
  return m ? m[1] : null;
}

// 配置加载成功后的首步动作：对配置里的 UNC（NAS）路径检查共享根可达性，
// 不可达时打印现状报告（不可达路径/受影响操作/建议检查）后 exit 1。
// 本地盘路径不检查（目录缺失由既有逻辑按需创建或报错，行为不变）。
function assertNasReachable(merged) {
  const fields = [];
  if (merged.knowledgeBase) {
    if (merged.knowledgeBase.rawDir) fields.push(["knowledgeBase.rawDir", merged.knowledgeBase.rawDir]);
    if (merged.knowledgeBase.wikiDir) fields.push(["knowledgeBase.wikiDir", merged.knowledgeBase.wikiDir]);
  }
  if (merged.tmpDir) fields.push(["tmpDir", merged.tmpDir]);
  if (merged.trackFile) fields.push(["trackFile", merged.trackFile]);
  if (merged.workflowFile) fields.push(["workflowFile", merged.workflowFile]);
  if (merged.gitRepos) fields.push(["gitRepos", merged.gitRepos]);

  const unreachable = new Map(); // root -> [{label, path}]
  for (const [label, raw] of fields) {
    const root = uncRoot(expandHome(String(raw)));
    if (!root) continue; // 非 UNC（本地盘）不检查
    if (!existsSync(root)) {
      if (!unreachable.has(root)) unreachable.set(root, []);
      unreachable.get(root).push({ label, path: expandHome(String(raw)) });
    }
  }
  if (unreachable.size === 0) return;

  console.error("现状报告: NAS 不可达");
  for (const [root, hits] of unreachable) {
    console.error(`  不可达路径: ${hits[0].path}（${hits.map((h) => h.label).join("、")}，共享根 ${root}）`);
  }
  console.error("  受影响操作: 知识库读写（raw/wiki）、学习账本、工作流状态、日志暂存均位于 NAS，本次操作无法继续");
  console.error("  建议检查: 网络或 VPN 连接; NAS 共享权限; 共享根主机是否在线");
  process.exit(1);
}

// ---------- 配置加载 ----------

// 默认取脚本上级 config.json；环境层按解析链取（见文件头）
export function loadConfig(configPath) {
  let defaults = {};
  if (existsSync(configPath)) defaults = readJson(configPath);
  const layer = resolveEnvLayer();
  if (!layer) guideOnMissingConfig();
  const env = readJsonOrDie(layer.path, `环境层配置 ${layer.path}`,
    "修复 JSON 后重试，或参考模板 config.example.json 重建。");
  const merged = deepMerge(defaults, env);

  const baseUrl = merged.jenkins && merged.jenkins.baseUrl;
  if (!baseUrl) {
    console.error(`缺少 jenkins.baseUrl —— 请在 ${envPathNew()}（或 $SKILL_ENV 指向的文件）中设置；模板见 ${join(scriptDir, "..", "config.example.json")}。`);
    process.exit(1);
  }
  if (!merged.trackFile) {
    console.error(`缺少 trackFile —— 请在 ${envPathNew()}（或 $SKILL_ENV 指向的文件）中设置。`);
    process.exit(1);
  }
  if (!Array.isArray(merged.jobs)) {
    console.error(`缺少 jobs 列表 —— 请在 ${envPathNew()}（或 $SKILL_ENV 指向的文件）中设置。`);
    process.exit(1);
  }
  assertNasReachable(merged);
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
