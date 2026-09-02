// config.mjs — github-trending-weekly 配置解析（族级标准接线，零依赖）。
//
// 输出位置（workspace）与服务参数（port/host）两层解析，优先级从高到低：
//   1. CLI 参数（本次调用显式覆盖，如 --workspace / --port）
//   2. 环境层（真实值，不进任何 git 仓库），按解析链取第一个存在的文件：
//      $SKILL_ENV（指向文件则该文件即本域配置；指向目录则读 <目录>/github-trending-weekly.json）
//      > ~/.config/parking-agents/github-trending-weekly.json（一域一文件，文件名即归属）
//   3. 技能内 config.json（随仓库版本化，只放占位说明；当前无固有默认项）
// 本域从未用旧单文件 skill-env.json，不做 legacy 回退——该文件整读会拿到别的域的真实值。
// 三层都无 workspace 时打印三步引导后 exit 1，绝不落回「当前目录」（原 default:"" 的误写隐患已移除）。
// workspace 支持 ~/ 前缀展开。
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const DOMAIN = "github-trending-weekly";
const scriptDir = dirname(fileURLToPath(import.meta.url));

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function isFile(p) {
  try { return existsSync(p) && statSync(p).isFile(); } catch { return false; }
}

// 环境层解析链：$SKILL_ENV（文件 | 目录下 <域>.json）> ~/.config/parking-agents/<域>.json
export function resolveEnvLayer() {
  const candidates = [];
  if (process.env.SKILL_ENV) {
    candidates.push({ path: process.env.SKILL_ENV, via: "SKILL_ENV" });
    candidates.push({ path: join(process.env.SKILL_ENV, `${DOMAIN}.json`), via: "SKILL_ENV" });
  }
  candidates.push({ path: envPathDomain(), via: "domain" });
  for (const c of candidates) if (isFile(c.path)) return c;
  return null;
}

export function envPathDomain() {
  return join(homedir(), ".config", "parking-agents", `${DOMAIN}.json`);
}

// 深合并：over 覆盖 base；数组整体替换（不拼接）
function deepMerge(base, over) {
  if (Array.isArray(over)) return over.slice();
  if (over === null || typeof over !== "object") return over;
  const out = base && typeof base === "object" && !Array.isArray(base) ? { ...base } : {};
  for (const k of Object.keys(over)) out[k] = deepMerge(out[k], over[k]);
  return out;
}

// 合并技能层（config.json 占位/固有默认）⊕ 环境层（优先）
export function loadConfig() {
  let skillLayer = {};
  const skillPath = join(scriptDir, "..", "..", "config.json");
  if (isFile(skillPath)) skillLayer = readJson(skillPath);
  const layer = resolveEnvLayer();
  return { merged: deepMerge(skillLayer, layer ? readJson(layer.path) : {}), layer };
}

export function expandHome(p) {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
  return p;
}

// workspace：CLI 显式值 > 配置合并值；都没有 → 三步引导后 exit 1
export function resolveWorkspace(cliValue) {
  if (cliValue) return cliValue;
  const { merged } = loadConfig();
  const ws = merged.workspace;
  if (typeof ws === "string" && ws.trim()) return expandHome(ws.trim());
  console.error(`[github-trending-weekly] 未指定 workspace：CLI --workspace 与配置层（$SKILL_ENV${process.env.SKILL_ENV ? `=${process.env.SKILL_ENV}` : "（未设置）"}、${envPathDomain()}、技能内 config.json）都没有。`);
  console.error("配置引导:");
  console.error(`  1. 建 ${envPathDomain()}，内容: { "workspace": "D:/your/path" }`);
  console.error("  2. 或本次调用直接传 --workspace <dir>");
  console.error("  3. 字段说明与模板见技能目录 config.example.json");
  process.exit(1);
}

// serve 参数：CLI > 配置 > 代码缺省。port 校验仍由调用方做。
export function resolveServeOpts(args) {
  const { merged } = loadConfig();
  const port = args.port ?? (merged.port != null ? String(merged.port) : "8788");
  const host = args.host ?? (typeof merged.host === "string" && merged.host ? merged.host : "127.0.0.1");
  return { port, host };
}
