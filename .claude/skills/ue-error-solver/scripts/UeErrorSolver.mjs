#!/usr/bin/env node
// UeErrorSolver.mjs — Jenkins CI 构建错误诊断与修复工具集
// （唯一入口；原 PowerShell 版已按仓库脚本标准移除）
//
// 用法: node UeErrorSolver.mjs <command> [--flags]
// 所有子命令输出 JSON 到 stdout；业务失败 exit 1，用法错误 exit 2。
//
// 配置 = 技能固有默认（config.json，默认取脚本上级）⊕ 环境层，深合并，环境层优先。
//        环境层解析链（只查本地文件，不依赖网络）:
//        $SKILL_ENV > ~/.config/parking-agents/skill-env.json
//        两层都无 → 打印配置引导后 exit 1；配置加载成功后首步对 UNC（NAS）路径
//        做 fail-fast 连通检查，不可达时打印现状报告后 exit 1。
// 临时文件一律写入 config.tmpDir 或 os.tmpdir()，绝不写入 skill 目录。
// HTTP 请求统一走 curl.exe（Cloudflare/部分 Jenkins 会拦截非 curl 客户端）。
// 输出文件编码 UTF-8 无 BOM；正则匹配大小写不敏感（与 PowerShell -match 一致）。

import { fileURLToPath } from "node:url";
import { dirname, join, resolve, isAbsolute, basename, extname, sep } from "node:path";
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync,
  readdirSync, rmSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const scriptDir = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 通用工具
// ============================================================

// 容错：strip UTF-8 BOM（历史 config 可能带 BOM，JSON.parse 不接受）
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

// 深合并：over 覆盖 base；数组整体替换（不拼接）
function deepMerge(base, over) {
  if (Array.isArray(over)) return over.slice();
  if (over === null || typeof over !== "object") return over;
  const out = Array.isArray(base) ? base.slice() : base && typeof base === "object" ? { ...base } : {};
  for (const k of Object.keys(over)) out[k] = deepMerge(base && base[k], over[k]);
  return out;
}

// 环境层解析链: $SKILL_ENV > ~/.config/parking-agents/skill-env.json
function resolveEnvLayer() {
  const candidates = [];
  if (process.env.SKILL_ENV) candidates.push({ path: process.env.SKILL_ENV, via: "SKILL_ENV" });
  candidates.push({ path: join(homedir(), ".config", "parking-agents", "skill-env.json"), via: "new" });
  for (const c of candidates) if (existsSync(c.path)) return c;
  return null;
}

// 两层都无配置文件：给可照做的三步引导，而不是裸报缺失字段
function guideOnMissingConfig() {
  const template = join(scriptDir, "..", "config.example.json");
  const newPath = join(homedir(), ".config", "parking-agents", "skill-env.json");
  console.error(`未找到配置文件（已查: $SKILL_ENV${process.env.SKILL_ENV ? `=${process.env.SKILL_ENV}` : "（未设置）"}、${newPath}）`);
  console.error("配置引导:");
  console.error(`  1. 拷贝模板: ${template}（默认已指向 NAS 知识库）`);
  console.error(`  2. 放到:     ${newPath}`);
  console.error("  3. 按机器改: gitRepos（如 D:/Git）");
  process.exit(1);
}

// 从 UNC 路径取 //主机/共享 根（子目录允许懒创建，根不可达才判定 NAS 不可达）
function uncRoot(p) {
  const m = String(p).replace(/\\/g, "/").match(/^(\/\/[^/]+\/[^/]+)/);
  return m ? m[1] : null;
}

// 配置加载成功后的首步动作：UNC（NAS）路径共享根不可达时打印现状报告后 exit 1
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
    const p = resolveConfigPath(String(raw));
    const root = uncRoot(p);
    if (!root) continue; // 非 UNC（本地盘）不检查
    if (!existsSync(root)) {
      if (!unreachable.has(root)) unreachable.set(root, []);
      unreachable.get(root).push({ label, path: p });
    }
  }
  if (unreachable.size === 0) return;

  console.error("现状报告: NAS 不可达");
  for (const [root, hits] of unreachable) {
    console.error(`  不可达路径: ${hits[0].path}（${hits.map((h) => h.label).join("、")}，共享根 ${root}）`);
  }
  console.error("  受影响操作: 知识库读写（raw/wiki）、学习账本、日志暂存均位于 NAS，本次操作无法继续");
  console.error("  建议检查: 网络或 VPN 连接; NAS 共享权限; 共享根主机是否在线");
  process.exit(1);
}

// 技能固有默认（config.json）⊕ 环境层（解析链见文件头）
function loadConfig(configPath) {
  const cfgPath = configPath || join(scriptDir, "..", "config.json");
  let defaults = {};
  if (existsSync(cfgPath)) defaults = readJson(cfgPath);
  const layer = resolveEnvLayer();
  if (!layer) guideOnMissingConfig();
  let env = {};
  if (existsSync(layer.path)) {
    try {
      env = readJson(layer.path);
    } catch (e) {
      console.error(`环境层配置 ${layer.path} 不是合法 JSON（${e.message}）。修复后重试，或参考模板 config.example.json 重建。`);
      process.exit(1);
    }
  }
  const merged = deepMerge(defaults, env);
  assertNasReachable(merged);
  return merged;
}

// 将 ~/…、./…（相对 skill 目录）、其余相对路径统一解析为规范化绝对路径
function resolveConfigPath(p, baseDir = join(scriptDir, "..")) {
  let s = String(p);
  if (/^~[/\\]/.test(s)) s = join(homedir(), s.slice(2));
  else if (/^\.[/\\]/.test(s)) s = join(baseDir, s.slice(2));
  return resolve(s);
}

// 临时目录：config.tmpDir 优先，退回 os.tmpdir()/ue-error-solver（不在 skill 目录内）
function getTempDir(config) {
  if (config && config.tmpDir) return resolveConfigPath(config.tmpDir);
  return join(tmpdir(), "ue-error-solver");
}

// 子进程封装：stdout/stderr 收集为字符串，code 为退出码；支持 stdin 输入
function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, {
      windowsHide: true,
      cwd: opts.cwd,
      env: opts.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => resolvePromise({ stdout: "", stderr: String(e), code: null }));
    child.on("close", (code) => resolvePromise({ stdout, stderr, code }));
    if (opts.input !== undefined) child.stdin.end(opts.input);
    else child.stdin.end();
  });
}

const CURL_BIN = process.platform === "win32" ? "curl.exe" : "curl";

// Jenkins/GitLab 认证参数（JENKINS_USER/JENKINS_TOKEN 环境变量）
function jenkinsAuthArgs() {
  if (process.env.JENKINS_USER && process.env.JENKINS_TOKEN) {
    return ["-u", `${process.env.JENKINS_USER}:${process.env.JENKINS_TOKEN}`];
  }
  return [];
}

// 读取日志输入：--log-file <path> 或 "-"（stdin）
function readLogInput(logFile) {
  if (!logFile) {
    console.error("缺少必需参数 --log-file（或传 - 读 stdin）");
    process.exit(2);
  }
  if (logFile === "-") return readFileSync(0, "utf8");
  if (!existsSync(logFile)) {
    console.error(`日志文件不存在: ${logFile}`);
    process.exit(2);
  }
  return readFileSync(logFile, "utf8");
}

function toInt(v, dflt) {
  if (v === undefined || v === null || v === "") return dflt;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? dflt : n;
}

// 本地时间戳（与 PowerShell Get-Date -Format 输出一致）
function pad2(n) { return String(n).padStart(2, "0"); }
function tsStamp(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}
function tsDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function tsDateTime(d) {
  return `${tsDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// 结果输出：JSON 到 stdout；fail=true 时 exit 1
function output(obj, fail = false) {
  console.log(JSON.stringify(obj, null, 2));
  if (fail) process.exitCode = 1;
}

// 递归遍历目录收集文件（pred 为文件名判断函数）；不可读目录静默跳过
function collectFiles(dir, pred) {
  const results = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (pred(entry.name)) results.push(full);
    }
  }
  return results;
}

// 往上查找 .git 推断仓库根
function findRepoRoot(filePath) {
  let dir = dirname(resolve(filePath));
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ============================================================
// Phase 0: 配置读取与校验
// ============================================================

// 读取 + 深合并 + 路径解析 + 关键目录校验（rawDir 缺失时自动创建）
function resolveFullConfig(configPath) {
  const merged = loadConfig(configPath);
  const warnings = [];

  if (!merged.gitRepos) {
    output({ error: "Config missing required property: gitRepos — 请在 ~/.config/parking-agents/skill-env.json（或 config.json / $SKILL_ENV 指向的文件）中设置" }, true);
    return null;
  }
  merged.gitRepos = resolveConfigPath(merged.gitRepos);
  if (!existsSync(merged.gitRepos)) {
    output({ error: `gitRepos directory not found: ${merged.gitRepos}` }, true);
    return null;
  }

  if (!merged.knowledgeBase) {
    output({ error: "Config missing required property: knowledgeBase — 请在 ~/.config/parking-agents/skill-env.json 中设置 knowledgeBase.wikiDir 与 rawDir" }, true);
    return null;
  }
  if (!merged.knowledgeBase.wikiDir || !merged.knowledgeBase.rawDir) {
    output({ error: "Config knowledgeBase missing wikiDir or rawDir — 请在 ~/.config/parking-agents/skill-env.json 中补齐" }, true);
    return null;
  }
  merged.knowledgeBase.wikiDir = resolveConfigPath(merged.knowledgeBase.wikiDir);
  merged.knowledgeBase.rawDir = resolveConfigPath(merged.knowledgeBase.rawDir);

  if (!existsSync(merged.knowledgeBase.wikiDir)) {
    warnings.push(`wikiDir directory not found: ${merged.knowledgeBase.wikiDir}`);
  }
  if (!existsSync(merged.knowledgeBase.rawDir)) {
    mkdirSync(merged.knowledgeBase.rawDir, { recursive: true });
    warnings.push(`rawDir created: ${merged.knowledgeBase.rawDir}`);
  }

  merged.tmpDir = getTempDir(merged);
  if (!existsSync(merged.tmpDir)) {
    mkdirSync(merged.tmpDir, { recursive: true });
    warnings.push(`tmpDir created: ${merged.tmpDir}`);
  }

  merged.warnings = warnings;
  return merged;
}

// Phase 0.5 环境前置检查：config、gitRepos、仓库可用性
async function testEnvironmentReadiness(config, repoNames, expectedRemoteUrl) {
  const errors = [];
  const warnings = [];
  const missingRepos = [];

  if (!config.gitRepos) {
    return { ready: false, errors: ["Config missing required property: gitRepos"], warnings, missingRepos, gitReposRoot: null };
  }
  const gitReposRoot = resolveConfigPath(config.gitRepos);
  if (!existsSync(gitReposRoot)) {
    return { ready: false, errors: [`gitRepos directory not found: ${gitReposRoot}`], warnings, missingRepos, gitReposRoot };
  }

  for (const repo of repoNames) {
    const repoPath = join(gitReposRoot, repo);
    if (!existsSync(repoPath)) {
      missingRepos.push(repo);
      warnings.push(`Repo '${repo}' not found under gitRepos (${gitReposRoot}). To set up, run: git clone <GitLab URL>/${repo}.git "${repoPath}"`);
    } else {
      const { stdout, code } = await run("git", ["-C", repoPath, "remote", "get-url", "origin"]);
      if (code !== 0) {
        warnings.push(`Repo '${repo}' has no 'origin' remote configured.`);
      } else if (expectedRemoteUrl && !stdout.includes(expectedRemoteUrl)) {
        warnings.push(`Repo '${repo}' origin (${stdout.trim()}) does not match expected (${expectedRemoteUrl}).`);
      }
    }
  }

  return {
    ready: errors.length === 0 && missingRepos.length === 0,
    errors, warnings, missingRepos, gitReposRoot,
  };
}

// ============================================================
// Phase 1: Jenkins + 日志
// ============================================================

// 解析 Jenkins 构建 URL 或短名+编号
function parseJenkinsBuildUrl(buildRef, baseUrl) {
  let m = buildRef.match(/^(https?:\/\/[^/]+)(\/.+?)\/(\d+)\/?(?:console(?:Full)?)?$/);
  if (m) {
    const jobPath = m[2];
    const parts = jobPath.split("/job/").filter(Boolean);
    return {
      baseUrl: m[1],
      jobPath,
      buildNumber: parseInt(m[3], 10),
      jobShort: parts[parts.length - 1],
    };
  }
  m = buildRef.match(/^(.+?)[# ]+(\d+)$/);
  if (m) {
    if (!baseUrl) throw new Error(`BaseUrl is required for short-name format: '${buildRef}'`);
    return {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      jobPath: null,
      buildNumber: parseInt(m[2], 10),
      jobShort: m[1].trim(),
    };
  }
  throw new Error(`Cannot parse Jenkins build input: '${buildRef}'`);
}

// 从 Jenkins 日志提取所有 git 仓库 checkout 信息（remote URL、分支、commit）
function extractRepoCheckouts(log) {
  const lines = log.split("\n");
  const results = [];
  let currentUrl = null;
  let currentPath = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    let m = line.match(/>\s*git config remote\.origin\.url\s+(https?:\/\/\S+)/);
    if (m) { currentUrl = m[1]; continue; }
    m = line.match(/Running in\s+(\S+)/);
    if (m) { currentPath = m[1]; continue; }
    m = line.match(/Checking out Revision\s+([0-9a-f]{40})\s+\(refs\/remotes\/origin\/([^)]+)\)/);
    if (m) {
      let repoName = currentUrl;
      if (currentUrl) {
        const rm = currentUrl.match(/\/([^/]+?)(?:\.git)?$/);
        if (rm) repoName = rm[1];
      }
      results.push({
        repoUrl: currentUrl,
        repoName,
        branch: m[2],
        commit: m[1],
        localPath: currentPath,
      });
    }
  }
  return results;
}

// Jenkins job 路径规范化：
// 1) Git Bash/MSYS 会把 "/job/..." 参数转换成 "<Git根>/job/..."——还原为首个 /job/ 起
// 2) 兼容不带前导斜杠的 "job/..." 写法
function normalizeJobPath(p) {
  if (!p) return p;
  let s = String(p).replace(/\\/g, "/");
  // 相对规范形式 "job/a/job/b" 本身就是路径前缀，不得截断；只剥离 /job/ 前的杂项前缀（如 /view/... 或完整 URL）
  const idx = s.indexOf("/job/");
  if (idx > 0 && !s.startsWith("job/")) s = s.slice(idx);
  if (!s.startsWith("/")) s = "/" + s;
  return s;
}

// Jenkins API 递归模糊搜索 job
async function findJenkinsJob(baseUrl, searchTerm) {
  const base = baseUrl.replace(/\/+$/, "");
  const results = [];
  const authArgs = jenkinsAuthArgs();
  // 部分旧版 Jenkins 要求 tree 参数中的 [] 必须 URL 编码，未编码时返回空响应
  const treeQuery = `tree=${encodeURIComponent("jobs[name,_class]")}`;

  async function recurse(apiUrl, prefix, depth) {
    if (depth > 15) return; // 防御 folder 环
    const { stdout } = await run(CURL_BIN, ["-s", "-f", ...authArgs, apiUrl]);
    if (!stdout) return;
    let data;
    try { data = JSON.parse(stdout); } catch { return; }
    if (!data.jobs) return;
    for (const job of data.jobs) {
      const jobPath = `${prefix}/job/${job.name}`;
      if (job.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        results.push(jobPath);
      }
      if (/Folder|Org/.test(job._class || "")) {
        await recurse(`${base}${jobPath}/api/json?${treeQuery}`, jobPath, depth + 1);
      }
    }
  }

  await recurse(`${base}/api/json?${treeQuery}`, "", 0);
  return results;
}

// 下载构建控制台日志（curl.exe，认证可选；jobPath 自动规范化）
async function getJenkinsConsoleLog(baseUrl, jobPath, buildNumber) {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}${normalizeJobPath(jobPath)}/${buildNumber}/consoleText`;
  const { stdout, stderr, code } = await run(CURL_BIN, ["-s", "-f", ...jenkinsAuthArgs(), url]);
  if (code !== 0) {
    throw new Error(`Failed to download console log from ${url} (exit code ${code})${stderr ? `: ${stderr.trim().slice(0, 300)}` : ""}`);
  }
  return stdout;
}

// 查询构建结果元数据（jobPath 自动规范化）
async function getJenkinsBuildResult(baseUrl, jobPath, buildNumber) {
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}${normalizeJobPath(jobPath)}/${buildNumber}/api/json?tree=result,timestamp,duration`;
  const { stdout, stderr, code } = await run(CURL_BIN, ["-s", "-f", ...jenkinsAuthArgs(), url]);
  if (code !== 0) {
    throw new Error(`Failed to query build result from ${url} (exit code ${code})${stderr ? `: ${stderr.trim().slice(0, 300)}` : ""}`);
  }
  let data;
  try { data = JSON.parse(stdout); } catch {
    throw new Error(`Failed to parse build result JSON from ${url}`);
  }
  return { result: data.result, timestamp: data.timestamp, duration: data.duration };
}

// 保存日志到临时目录；>500KB 时额外保存过滤版本。文件名含时间戳。
function saveJenkinsLog(log, jobShort, buildNumber, tmpDirPath) {
  mkdirSync(tmpDirPath, { recursive: true });
  const ts = tsStamp(new Date());
  const safeName = jobShort.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${safeName}_${buildNumber}_${ts}.log`;
  const filePath = join(tmpDirPath, fileName);
  writeFileSync(filePath, log, "utf8");

  let filteredPath = null;
  if (log.length > 512000) {
    const filterPattern = /error|fatal|warning|LNK|ExitCode|FAILED|Error:|Exception/i;
    const filtered = log.split("\n").filter((l) => filterPattern.test(l)).join("\r\n");
    filteredPath = join(tmpDirPath, `${safeName}_${buildNumber}_${ts}_filtered.log`);
    writeFileSync(filteredPath, filtered, "utf8");
  }
  return { savedPath: filePath, filteredPath, bytes: Buffer.byteLength(log, "utf8") };
}

// 错误类型模式（顺序即优先级；大小写不敏感，与 PowerShell -match 一致）
const ERROR_PATTERNS = [
  ["Compilation", /error C\d+:|error CS\d+:|fatal error C\d+:|error:.*\[-W/i],
  ["Linker", /LNK\d+:|unresolved external symbol/i],
  ["UBT", /UnrealBuildTool|UnrealHeaderTool|UBT ERROR|UHT ERROR/i],
  ["Cook", /LogCook: Error|Cook failed|Package.*failed/i],
  ["Infrastructure", /OutOfMemoryException|IOException|disk full|network (error|failure|unreachable)|timeout(?!=\d)|timed out/i],
];

// 提取结构化错误块（含 note:/|/^ 续行、referenced by 行）
function extractErrorBlocks(log) {
  const lines = log.split("\n");
  const results = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].replace(/\r$/, "");
    let matchedType = null;
    for (const [type, re] of ERROR_PATTERNS) {
      if (re.test(line)) { matchedType = type; break; }
    }

    if (matchedType) {
      const block = [line];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j].replace(/\r$/, "");
        if (/^\s*(note:|  \||\s*\^)/.test(next) || /^\s+referenced by/.test(next)) {
          block.push(next);
          j++;
        } else break;
      }

      // 错误代码
      let errorCode = null;
      let m = line.match(/((?:fatal )?error C\d+)/i);
      if (m) errorCode = m[1];
      else if ((m = line.match(/(error CS\d+)/i))) errorCode = m[1];
      else if ((m = line.match(/(LNK\d+)/i))) errorCode = m[1];
      else if ((m = line.match(/(error:.*?\[-W[^\]]+\])/))) errorCode = m[1];

      // 文件路径 + 行号（MSVC Windows 路径格式）
      let filePath = null;
      let lineNumber = 0;
      if ((m = line.match(/([a-zA-Z]:\\[^(]+?)\((\d+)/))) {
        filePath = m[1];
        lineNumber = parseInt(m[2], 10);
      } else if ((m = line.match(/([a-zA-Z]:\\[^:]+?):(\d+)/))) {
        filePath = m[1];
        lineNumber = parseInt(m[2], 10);
      }

      results.push({ lines: block, errorCode, filePath, lineNumber, type: matchedType });
      i = j;
    } else {
      i++;
    }
  }
  return results;
}

// 提取 UBT/Build 命令行（Phase 4 重编译用）
function extractBuildCommand(log) {
  for (const rawLine of log.split("\n")) {
    const trimmed = rawLine.replace(/\r$/, "").trim();
    if (/UnrealBuildTool\.(exe|dll)|RunUBT\.bat|Build\.bat/i.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

// ============================================================
// Phase 2: 源码 + 知识库
// ============================================================

// CI 绝对路径 → 本地 git 仓库文件映射。
// CI 工作区常把仓库内容挂在 Plugins\<Group>\<Repo>\ 下（如 ...\Project\Plugins\G\AesWorld\Source\...），
// 而本地仓库根即 Source\...——因此按"逐级去头的相对后缀"从最长到最短匹配，至少保留 1 级目录防止误配。
function resolveErrorFileInRepo(errorPath, gitRepos) {
  let relative = null;
  let m = errorPath.match(/Plugins[/\\](.+)$/i);
  if (m) relative = m[1].replace(/\//g, "\\");
  else if ((m = errorPath.match(/Source[/\\](.+)$/i))) {
    relative = `Source\\${m[1].replace(/\//g, "\\")}`;
  }

  if (!relative) {
    return { localPath: null, repoRoot: null, relativePath: null, found: false };
  }

  const fileName = basename(relative.replace(/\\/g, "/"));
  const candidates = collectFiles(gitRepos, (n) => n === fileName);
  if (candidates.length === 0) {
    return { localPath: null, repoRoot: null, relativePath: relative, found: false };
  }

  const norm = (p) => resolve(p).replace(/\//g, "\\").toLowerCase();
  const parts = relative.split("\\");
  for (let i = 0; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join("\\").toLowerCase();
    const hits = candidates.filter((f) => norm(f).endsWith(suffix));
    if (hits.length > 0) {
      const found = resolve(hits[0]);
      return {
        localPath: found,
        repoRoot: findRepoRoot(found),
        relativePath: relative,
        matchedSuffix: parts.slice(i).join("\\"),
        found: true,
      };
    }
  }
  return { localPath: null, repoRoot: null, relativePath: relative, found: false };
}

// 读取源文件指定行前后上下文（默认 ±15 行，>>> 标记目标行）
function getSourceContext(filePath, lineNumber, contextLines = 15) {
  if (!existsSync(filePath)) throw new Error(`Source file not found: ${filePath}`);
  const allLines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const start = Math.max(0, lineNumber - 1 - contextLines);
  const end = Math.min(allLines.length - 1, lineNumber - 1 + contextLines);
  const out = [];
  for (let i = start; i <= end; i++) {
    const marker = i === lineNumber - 1 ? ">>>" : "   ";
    out.push(`${marker} ${i + 1}: ${allLines[i]}`);
  }
  return out.join("\r\n");
}

// 文件 git 提交历史（--oneline）
async function getFileGitHistory(repoRoot, filePath, count = 10) {
  let relPath = filePath;
  const normRoot = resolve(repoRoot).replace(/\//g, "\\");
  const normFile = resolve(filePath).replace(/\//g, "\\");
  if (normFile.toLowerCase().startsWith(normRoot.toLowerCase())) {
    relPath = normFile.slice(normRoot.length).replace(/^[/\\]+/, "");
  }
  const { stdout, code } = await run("git", ["-C", repoRoot, "log", "--oneline", `-${count}`, "--", relPath]);
  if (code !== 0) throw new Error(`git log failed in ${repoRoot} for ${relPath}: ${stdout.trim()}`);
  return stdout.replace(/\n$/, "").split("\n").filter(Boolean).join("\r\n");
}

// 知识库搜索（wikiDir + rawDir 递归下的 .md）。内容行与文件名都参与匹配：
// 文件名兜底覆盖正文缺错误码 token 的历史文件（搜索只 grep 正文时这类文件会沉底）
function searchKnowledgeBase(wikiDir, rawDir, searchTerms) {
  const results = [];
  const searchDirs = [];
  if (existsSync(wikiDir)) searchDirs.push(wikiDir);
  if (existsSync(rawDir)) searchDirs.push(rawDir);

  for (const dir of searchDirs) {
    const mdFiles = collectFiles(dir, (n) => extname(n).toLowerCase() === ".md");
    for (const file of mdFiles) {
      let content;
      try { content = readFileSync(file, "utf8"); } catch { continue; }
      if (!content) continue;
      const lines = content.split(/\r?\n/);
      for (const term of searchTerms) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(escaped, "i");
        let matchedInContent = false;
        for (const m of lines.filter((l) => re.test(l)).slice(0, 3)) {
          results.push({ filePath: file, matchedLine: m.trim(), searchTerm: term });
          matchedInContent = true;
        }
        if (!matchedInContent && re.test(basename(file))) {
          results.push({ filePath: file, matchedLine: `(文件名匹配) ${basename(file)}`, searchTerm: term });
        }
      }
    }
  }
  return results;
}

// ============================================================
// Phase 4-6: 修复 + 提交 + 知识积累
// ============================================================

// 在仓库目录执行构建命令（cmd.exe /c）
async function invokeLocalBuild(repoRoot, buildCommand) {
  const { stdout, code } = await run("cmd.exe", ["/c", buildCommand], { cwd: repoRoot });
  return { exitCode: code, output: stdout, success: code === 0 };
}

// 基于 CI 源分支/commit 创建修复分支。
// 起始点选择铁律：fetch origin/<branch> 后比较 CI commit 与 HEAD——
// 一致用 CI commit；CI commit 落后则强制用 origin/HEAD（CI commit 仅作诊断上下文）。
async function newFixBranch(repoRoot, sourceBranch, sourceCommit, fixBranchName) {
  const notes = [];
  try {
    // 1) fetch 最新源分支（必须成功）
    const fetch = await run("git", ["-C", repoRoot, "fetch", "origin", `${sourceBranch}:refs/remotes/origin/${sourceBranch}`]);
    if (fetch.code !== 0 && !/already exists/i.test(fetch.stdout + fetch.stderr)) {
      return {
        success: false, branchName: null, baseCommit: null,
        error: `fetch origin/${sourceBranch} 失败（无法保证基于最新代码修复）: ${(fetch.stderr || fetch.stdout).trim()}`,
        isNew: false, notes,
      };
    }

    // 2) CI commit 与 origin/<branch> HEAD 的领先/落后关系
    const head = await run("git", ["-C", repoRoot, "rev-parse", `origin/${sourceBranch}`]);
    const latestHead = head.stdout.trim();
    let behindCount = 0;
    let aheadCount = 0;
    if (sourceCommit) {
      const b = await run("git", ["-C", repoRoot, "rev-list", "--count", `${sourceCommit}..origin/${sourceBranch}`]);
      behindCount = parseInt(b.stdout.trim(), 10) || 0;
      const a = await run("git", ["-C", repoRoot, "rev-list", "--count", `origin/${sourceBranch}..${sourceCommit}`]);
      aheadCount = parseInt(a.stdout.trim(), 10) || 0;
    }

    // 3) 决定起始点
    let base = `origin/${sourceBranch}`;
    let baseDescription = `origin/${sourceBranch} (latest HEAD: ${latestHead.slice(0, 8)})`;
    if (sourceCommit && behindCount === 0 && aheadCount === 0) {
      base = sourceCommit;
      baseDescription = `CI commit ${sourceCommit} (与 origin/${sourceBranch} HEAD 一致)`;
    } else if (sourceCommit && behindCount > 0) {
      notes.push(`CI commit ${sourceCommit.slice(0, 8)} 落后 origin/${sourceBranch} HEAD ${behindCount} 个 commit。将基于最新 HEAD 创建修复分支，确保 MR 不冲突。`);
      const log = await run("git", ["-C", repoRoot, "log", "--oneline", `${sourceCommit}..origin/${sourceBranch}`]);
      const logLines = log.stdout.split("\n").filter(Boolean).slice(0, 5);
      for (const l of logLines) notes.push(`  ${l.trim()}`);
      if (behindCount > 5) notes.push(`  ... (+${behindCount - 5} more)`);
    }

    // 4) 分支已存在 → 直接检出
    const existing = await run("git", ["-C", repoRoot, "branch", "--list", fixBranchName]);
    if (existing.stdout.includes(fixBranchName)) {
      await run("git", ["-C", repoRoot, "checkout", fixBranchName]);
      const hash = (await run("git", ["-C", repoRoot, "rev-parse", "HEAD"])).stdout.trim();
      notes.push(`Fix branch '${fixBranchName}' 已存在，HEAD=${hash.slice(0, 8)}`);
      return { success: true, branchName: fixBranchName, baseCommit: hash, baseDescription, error: null, isNew: false, notes };
    }

    // 5) 创建并切换到修复分支（基于决定的起始点）
    const branch = await run("git", ["-C", repoRoot, "checkout", "-b", fixBranchName, base]);
    if (branch.code !== 0) {
      return {
        success: false, branchName: null, baseCommit: null,
        error: `Failed to create branch: ${(branch.stderr || branch.stdout).trim()}`,
        isNew: false, notes,
      };
    }
    const hash = (await run("git", ["-C", repoRoot, "rev-parse", "HEAD"])).stdout.trim();
    notes.push(`Fix branch '${fixBranchName}' 已创建，base=${baseDescription}, HEAD=${hash.slice(0, 8)}`);
    return { success: true, branchName: fixBranchName, baseCommit: hash, baseDescription, error: null, isNew: true, notes };
  } catch (e) {
    return { success: false, branchName: null, baseCommit: null, error: String(e.message || e), isNew: false, notes };
  }
}

// 提交并推送变更（禁止 --force）
async function submitGitChanges(repoRoot, files, message) {
  if (/--force/.test(message)) {
    return { success: false, commitHash: null, error: "Force push is forbidden" };
  }
  try {
    for (const f of files) await run("git", ["-C", repoRoot, "add", f]);

    const commit = await run("git", ["-C", repoRoot, "commit", "-m", message]);
    if (commit.code !== 0) {
      return { success: false, commitHash: null, error: `git commit failed: ${(commit.stderr || commit.stdout).trim()}` };
    }
    const hash = (await run("git", ["-C", repoRoot, "rev-parse", "HEAD"])).stdout.trim();
    const branch = (await run("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();

    const push = await run("git", ["-C", repoRoot, "push", "-u", "origin", branch]);
    if (push.code !== 0) {
      return { success: false, commitHash: hash, error: `git push failed: ${(push.stderr || push.stdout).trim()}` };
    }
    return { success: true, commitHash: hash, branch, error: null };
  } catch (e) {
    return { success: false, commitHash: null, error: String(e.message || e) };
  }
}

// 通过 GitLab API 创建 MR（从 remote URL 推断实例与项目；认证优先 GITLAB_PRIVATE_TOKEN）
async function newGitLabMergeRequest(repoRoot, sourceBranch, targetBranch, title, description, removeSourceBranch) {
  try {
    const remote = await run("git", ["-C", repoRoot, "remote", "get-url", "origin"]);
    if (remote.code !== 0) {
      return { success: false, mrUrl: null, mrId: null, error: `Cannot read origin remote in ${repoRoot}` };
    }
    const remoteUrl = remote.stdout.trim();
    let m = remoteUrl.match(/^(https?:\/\/[^/]+)\/(.+?)(?:\.git)?$/);
    if (!m) {
      return { success: false, mrUrl: null, mrId: null, error: `Cannot parse GitLab URL from remote: ${remoteUrl}` };
    }
    const gitlabBase = m[1];
    const projectPath = m[2];

    let parsed;
    try { parsed = new URL(remoteUrl); } catch {
      return { success: false, mrUrl: null, mrId: null, error: `Cannot parse remote URL: ${remoteUrl}` };
    }

    // 认证
    let authArgs = [];
    if (process.env.GITLAB_PRIVATE_TOKEN) {
      authArgs = ["-H", `PRIVATE-TOKEN: ${process.env.GITLAB_PRIVATE_TOKEN}`];
    } else {
      // 从 git credential manager 提取（禁用交互提示防挂起）
      const credInput = `protocol=${parsed.protocol.replace(/:$/, "")}\nhost=${parsed.hostname}\n\n`;
      const cred = await run("git", ["credential", "fill"], {
        input: credInput,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo" },
      });
      let username = null;
      let password = null;
      for (const line of cred.stdout.split("\n")) {
        let mm = line.match(/^username=(.+)$/); if (mm) username = mm[1];
        mm = line.match(/^password=(.+)$/); if (mm) password = mm[1];
      }
      if (username && password) {
        authArgs = ["-u", `${username}:${password}`];
      } else {
        return {
          success: false, mrUrl: null, mrId: null,
          error: `No authentication available. Set GITLAB_PRIVATE_TOKEN or configure git credential manager for ${parsed.hostname}.`,
        };
      }
    }

    const encodedProject = encodeURIComponent(projectPath);
    const apiUrl = `${gitlabBase}/api/v4/projects/${encodedProject}/merge_requests`;

    const body = { source_branch: sourceBranch, target_branch: targetBranch, title };
    if (description) body.description = description;
    if (removeSourceBranch) body.remove_source_branch = true;

    // JSON 写入系统临时文件用 @file 引用（规避命令行长度与转义问题）；用后即删
    const bodyFile = join(tmpdir(), `gl_mr_body_${randomUUID()}.json`);
    writeFileSync(bodyFile, JSON.stringify(body), "utf8");
    let resp;
    try {
      resp = await run(CURL_BIN, [
        "-s", "-w", "\n%{http_code}", "-X", "POST", apiUrl,
        ...authArgs, "-H", "Content-Type: application/json",
        "--data-binary", `@${bodyFile}`,
      ]);
    } finally {
      try { rmSync(bodyFile, { force: true }); } catch { /* 忽略清理失败 */ }
    }

    // 解析响应（最后一行是 HTTP 状态码）
    const respLines = resp.stdout.split("\n");
    const httpCode = (respLines[respLines.length - 1] || "").trim();
    const respBody = respLines.slice(0, -1).join("\n");

    if (/^2\d\d$/.test(httpCode)) {
      const mr = JSON.parse(respBody);
      return { success: true, mrUrl: mr.web_url, mrId: mr.iid, error: null };
    }

    let errMsg = respBody;
    try { errMsg = JSON.parse(respBody).message.join("; "); } catch { /* 保留原文 */ }
    let manualUrl = null;
    if (httpCode === "401" || httpCode === "403") {
      const es = encodeURIComponent(sourceBranch);
      const et = encodeURIComponent(targetBranch);
      manualUrl = `${gitlabBase}/${projectPath}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${es}&merge_request%5Btarget_branch%5D=${et}`;
    }
    return { success: false, mrUrl: manualUrl, mrId: null, error: `GitLab API returned HTTP ${httpCode}: ${errMsg}`, manualUrl };
  } catch (e) {
    return { success: false, mrUrl: null, mrId: null, error: String(e.message || e) };
  }
}

// 保存知识条目（rawDir/details/ 下；同错误码+同描述 → 追加 Update 段落）。
// 命名与头部对齐 jenkins-pair-analyze 的 knowledge-format.md（{job}-{build}-{code}-{desc}.md，
// 构建号做主标识避免冲突），保证 auto-learning 侧的 recurrence 检索两个写入方口径一致
function saveKnowledgeEntry(rawDir, jobShort, buildNumber, errorCode, shortDesc, content) {
  const detailsDir = join(rawDir, "details");
  mkdirSync(detailsDir, { recursive: true });

  let existing = [];
  try {
    existing = readdirSync(detailsDir).filter((f) => f.endsWith(".md") && f.includes(errorCode));
  } catch { /* 首次运行目录刚创建 */ }

  for (const ex of existing) {
    const exPath = join(detailsDir, ex);
    let header = "";
    try { header = readFileSync(exPath, "utf8").split(/\r?\n/).slice(0, 5).join(" "); } catch { continue; }
    if (header.includes(shortDesc)) {
      const appendix = `\r\n\r\n---\r\n## Update: ${jobShort}#${buildNumber} (${tsDate(new Date())})\r\n\r\n${content}`;
      appendFileSync(exPath, appendix, "utf8");
      return exPath;
    }
  }

  const safe = (s) => s.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${safe(jobShort)}-${buildNumber}-${safe(errorCode)}-${safe(shortDesc).slice(0, 40) || "case"}.md`;
  const filePath = join(detailsDir, fileName);

  const fileContent = `# ${errorCode}: ${shortDesc}\r\n\r\n` +
    `> **Job**: ${jobShort} | **Date**: ${tsDateTime(new Date())}\r\n` +
    `> **Builds**: #${buildNumber}（ue-error-solver 单次诊断，修复已本地编译验证）\r\n\r\n` +
    content;
  writeFileSync(filePath, fileContent, "utf8");
  return filePath;
}

// Phase 5 门禁：断言文件都在 gitRepos 下（拒绝 tmp/clone 副本提交）
function assertFilesInGitRepos(files, gitReposRoot) {
  const normalizedRoot = resolve(gitReposRoot).replace(/[\\/]+$/, "").toLowerCase();
  for (const f of files) {
    const resolved = resolve(f);
    if (!existsSync(resolved)) {
      return { passed: false, error: `File not found: ${f}` };
    }
    const norm = resolved.replace(/[\\/]+$/, "").toLowerCase();
    if (norm !== normalizedRoot && !norm.startsWith(normalizedRoot + sep)) {
      return {
        passed: false,
        error: `Refusing to commit file outside gitRepos: ${resolved} (gitRepos root: ${normalizedRoot}). Use the canonical checkout under ${normalizedRoot} instead of a tmp/clone.`,
      };
    }
  }
  return { passed: true };
}

// ============================================================
// CLI 参数解析与子命令注册
// ============================================================

// flagSpec: { "--flag": [key, "value"|"bool", default?] }
function parseFlags(argv, flagSpec, command) {
  const out = {};
  for (const [, [key, kind, dflt]] of Object.entries(flagSpec)) {
    if (kind === "bool") out[key] = false;
    else if (dflt !== undefined) out[key] = typeof dflt === "function" ? dflt() : dflt;
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const spec = flagSpec[a];
    if (!spec) {
      console.error(`未知参数: ${a}（${command}）`);
      process.exit(2);
    }
    const [key, kind] = spec;
    if (kind === "bool") out[key] = true;
    else {
      const v = argv[++i];
      if (v === undefined) {
        console.error(`参数 ${a} 需要一个值（${command}）`);
        process.exit(2);
      }
      out[key] = v;
    }
  }
  return out;
}

function requireArgs(args, names, command) {
  for (const n of names) {
    if (args[n] === undefined || args[n] === null || args[n] === "") {
      console.error(`缺少必需参数 --${n}（${command}）`);
      process.exit(2);
    }
  }
}

// 从 config 或 --base-url 取 Jenkins baseUrl
function resolveBaseUrl(args, config) {
  if (args.baseUrl) return args.baseUrl;
  if (config && config.jenkins && config.jenkins.baseUrl) return config.jenkins.baseUrl;
  console.error("缺少 Jenkins baseUrl —— 请传 --base-url 或在 ~/.config/parking-agents/skill-env.json 中设置 jenkins.baseUrl");
  process.exit(1);
}

const CONFIG_FLAG = { "--config": ["configPath", "value", () => join(scriptDir, "..", "config.json")] };

const COMMANDS = {
  config: {
    desc: "读取并深合并配置（config.json ⊕ 环境层），解析并校验路径；_configSource 标注配置来源",
    flags: { ...CONFIG_FLAG },
    async run(args) {
      const cfg = resolveFullConfig(args.configPath);
      if (cfg) {
        const layer = resolveEnvLayer();
        cfg._configSource = { path: layer ? layer.path : null, via: layer ? layer.via : null };
        output(cfg);
      }
    },
  },

  "check-env": {
    desc: "Phase 0.5 环境前置检查（config/gitRepos/仓库可用性）",
    flags: {
      ...CONFIG_FLAG,
      "--repos": ["repos", "value"],
      "--expected-remote": ["expectedRemote", "value"],
    },
    async run(args) {
      const cfg = loadConfig(args.configPath);
      const repoNames = (args.repos || "").split(",").map((s) => s.trim()).filter(Boolean);
      const result = await testEnvironmentReadiness(cfg, repoNames, args.expectedRemote);
      output(result, !result.ready);
    },
  },

  "parse-url": {
    desc: "解析 Jenkins 构建 URL 或 短名#编号 / 短名 编号",
    flags: {
      "--ref": ["ref", "value"],
      "--base-url": ["baseUrl", "value"],
    },
    async run(args) {
      requireArgs(args, ["ref"], "parse-url");
      output(parseJenkinsBuildUrl(args.ref, args.baseUrl));
    },
  },

  "repo-checkouts": {
    desc: "从 Jenkins 日志提取 git checkout 信息（repoUrl/branch/commit）",
    flags: { "--log-file": ["logFile", "value"] },
    async run(args) {
      const log = readLogInput(args.logFile);
      output(extractRepoCheckouts(log));
    },
  },

  "find-job": {
    desc: "Jenkins API 递归模糊搜索 job（输出 job 路径数组）",
    flags: {
      ...CONFIG_FLAG,
      "--search": ["search", "value"],
      "--base-url": ["baseUrl", "value"],
    },
    async run(args) {
      requireArgs(args, ["search"], "find-job");
      const baseUrl = resolveBaseUrl(args, loadConfig(args.configPath));
      output(await findJenkinsJob(baseUrl, args.search));
    },
  },

  "console-log": {
    desc: "下载构建控制台日志（--save 保存到 config.tmpDir，--stdout 直接输出内容）",
    flags: {
      ...CONFIG_FLAG,
      "--job-path": ["jobPath", "value"],
      "--build": ["build", "value"],
      "--base-url": ["baseUrl", "value"],
      "--save": ["save", "bool"],
      "--stdout": ["rawStdout", "bool"],
    },
    async run(args) {
      requireArgs(args, ["jobPath", "build"], "console-log");
      const cfg = loadConfig(args.configPath);
      const baseUrl = resolveBaseUrl(args, cfg);
      const buildNumber = toInt(args.build, null);
      const log = await getJenkinsConsoleLog(baseUrl, args.jobPath, buildNumber);
      if (args.rawStdout) {
        process.stdout.write(log);
        return;
      }
      if (args.save) {
        const saved = saveJenkinsLog(log, args.jobPath.split("/job/").filter(Boolean).pop() || "jenkins", buildNumber, getTempDir(cfg));
        output(saved);
      } else {
        output({ content: log, bytes: Buffer.byteLength(log, "utf8") });
      }
    },
  },

  "build-result": {
    desc: "查询构建结果元数据（result/timestamp/duration）",
    flags: {
      ...CONFIG_FLAG,
      "--job-path": ["jobPath", "value"],
      "--build": ["build", "value"],
      "--base-url": ["baseUrl", "value"],
    },
    async run(args) {
      requireArgs(args, ["jobPath", "build"], "build-result");
      const baseUrl = resolveBaseUrl(args, loadConfig(args.configPath));
      output(await getJenkinsBuildResult(baseUrl, args.jobPath, toInt(args.build, null)));
    },
  },

  "save-log": {
    desc: "保存日志到临时目录（默认 config.tmpDir，>500KB 另存过滤版）",
    flags: {
      ...CONFIG_FLAG,
      "--log-file": ["logFile", "value"],
      "--job-short": ["jobShort", "value"],
      "--build": ["build", "value"],
      "--tmp-dir": ["tmpDir", "value"],
    },
    async run(args) {
      requireArgs(args, ["jobShort", "build"], "save-log");
      const log = readLogInput(args.logFile);
      const cfg = loadConfig(args.configPath);
      const tmpDirPath = args.tmpDir ? resolve(args.tmpDir) : getTempDir(cfg);
      output(saveJenkinsLog(log, args.jobShort, toInt(args.build, 0), tmpDirPath));
    },
  },

  "extract-errors": {
    desc: "提取结构化错误块（errorCode/filePath/lineNumber/type + 续行）",
    flags: { "--log-file": ["logFile", "value"] },
    async run(args) {
      output(extractErrorBlocks(readLogInput(args.logFile)));
    },
  },

  "extract-build-cmd": {
    desc: "提取 UBT/Build 命令行（Phase 4 重编译用）",
    flags: { "--log-file": ["logFile", "value"] },
    async run(args) {
      const cmd = extractBuildCommand(readLogInput(args.logFile));
      output({ buildCommand: cmd });
    },
  },

  "resolve-error-file": {
    desc: "CI 绝对路径 → 本地 git 仓库文件映射",
    flags: {
      ...CONFIG_FLAG,
      "--error-path": ["errorPath", "value"],
      "--git-repos": ["gitRepos", "value", () => null],
    },
    async run(args) {
      requireArgs(args, ["errorPath"], "resolve-error-file");
      let gitRepos = args.gitRepos;
      if (!gitRepos) {
        const cfg = loadConfig(args.configPath);
        if (!cfg.gitRepos) {
          console.error("缺少 gitRepos —— 请传 --git-repos 或在 ~/.config/parking-agents/skill-env.json 中设置");
          process.exit(1);
        }
        gitRepos = cfg.gitRepos;
      }
      output(resolveErrorFileInRepo(args.errorPath, resolveConfigPath(gitRepos)));
    },
  },

  "source-context": {
    desc: "读取源文件指定行上下文（默认 ±15 行，>>> 标记目标行）",
    flags: {
      "--file": ["file", "value"],
      "--line": ["line", "value"],
      "--context": ["context", "value", () => 15],
    },
    async run(args) {
      requireArgs(args, ["file", "line"], "source-context");
      output({ snippet: getSourceContext(args.file, toInt(args.line, 1), toInt(args.context, 15)) });
    },
  },

  "git-history": {
    desc: "文件 git 提交历史（输出 --oneline 格式，默认 10 条）",
    flags: {
      "--repo-root": ["repoRoot", "value"],
      "--file": ["file", "value"],
      "--count": ["count", "value", () => 10],
      "--oneline": ["oneline", "bool"],
    },
    async run(args) {
      requireArgs(args, ["repoRoot", "file"], "git-history");
      output({ history: await getFileGitHistory(args.repoRoot, args.file, toInt(args.count, 10)) });
    },
  },

  "search-kb": {
    desc: "知识库搜索（wikiDir + rawDir + details 目录 .md 文件）",
    flags: {
      ...CONFIG_FLAG,
      "--terms": ["terms", "value"],
      "--wiki-dir": ["wikiDir", "value", () => null],
      "--raw-dir": ["rawDir", "value", () => null],
    },
    async run(args) {
      requireArgs(args, ["terms"], "search-kb");
      let { wikiDir, rawDir } = args;
      if (!wikiDir || !rawDir) {
        const cfg = loadConfig(args.configPath);
        if (!cfg.knowledgeBase || !cfg.knowledgeBase.wikiDir || !cfg.knowledgeBase.rawDir) {
          console.error("缺少 knowledgeBase.wikiDir/rawDir —— 请传 --wiki-dir/--raw-dir 或在 ~/.config/parking-agents/skill-env.json 中设置");
          process.exit(1);
        }
        wikiDir = wikiDir || cfg.knowledgeBase.wikiDir;
        rawDir = rawDir || cfg.knowledgeBase.rawDir;
      }
      const terms = args.terms.split(",").map((s) => s.trim()).filter(Boolean);
      output(searchKnowledgeBase(resolveConfigPath(wikiDir), resolveConfigPath(rawDir), terms));
    },
  },

  "local-build": {
    desc: "在仓库目录执行构建命令（必须用 CI 实际使用的命令）",
    flags: {
      "--repo-root": ["repoRoot", "value"],
      "--build-command": ["buildCommand", "value"],
    },
    async run(args) {
      requireArgs(args, ["repoRoot", "buildCommand"], "local-build");
      output(await invokeLocalBuild(args.repoRoot, args.buildCommand));
    },
  },

  "fix-branch": {
    desc: "基于 CI 源分支/commit 创建修复分支（fetch 后自动决定起始点）",
    flags: {
      "--repo-root": ["repoRoot", "value"],
      "--source-branch": ["sourceBranch", "value"],
      "--source-commit": ["sourceCommit", "value"],
      "--fix-branch": ["fixBranch", "value"],
    },
    async run(args) {
      requireArgs(args, ["repoRoot", "sourceBranch", "fixBranch"], "fix-branch");
      output(await newFixBranch(args.repoRoot, args.sourceBranch, args.sourceCommit, args.fixBranch));
    },
  },

  "git-submit": {
    desc: "提交并推送变更（禁止 --force；files 逗号分隔）",
    flags: {
      "--repo-root": ["repoRoot", "value"],
      "--files": ["files", "value"],
      "--message": ["message", "value"],
    },
    async run(args) {
      requireArgs(args, ["repoRoot", "files", "message"], "git-submit");
      const files = args.files.split(",").map((s) => s.trim()).filter(Boolean);
      const result = await submitGitChanges(args.repoRoot, files, args.message);
      output(result, !result.success);
    },
  },

  "gitlab-mr": {
    desc: "通过 GitLab API 创建 MR（认证：GITLAB_PRIVATE_TOKEN > git credential）",
    flags: {
      "--repo-root": ["repoRoot", "value"],
      "--source-branch": ["sourceBranch", "value"],
      "--target-branch": ["targetBranch", "value", () => "dev"],
      "--title": ["title", "value"],
      "--description": ["description", "value", () => ""],
      "--remove-source-branch": ["removeSourceBranch", "bool"],
    },
    async run(args) {
      requireArgs(args, ["repoRoot", "sourceBranch", "title"], "gitlab-mr");
      const result = await newGitLabMergeRequest(
        args.repoRoot, args.sourceBranch, args.targetBranch, args.title,
        args.description, args.removeSourceBranch,
      );
      output(result, !result.success);
    },
  },

  "save-knowledge": {
    desc: "保存知识条目到 rawDir/details/（重复条目自动追加 Update）",
    flags: {
      ...CONFIG_FLAG,
      "--raw-dir": ["rawDir", "value", () => null],
      "--job-short": ["jobShort", "value"],
      "--build": ["build", "value"],
      "--error-code": ["errorCode", "value"],
      "--short-desc": ["shortDesc", "value"],
      "--content": ["content", "value", () => null],
      "--content-file": ["contentFile", "value", () => null],
    },
    async run(args) {
      requireArgs(args, ["jobShort", "build", "errorCode", "shortDesc"], "save-knowledge");
      let content = args.content;
      if (!content && args.contentFile) {
        if (!existsSync(args.contentFile)) {
          console.error(`content 文件不存在: ${args.contentFile}`);
          process.exit(2);
        }
        content = readFileSync(args.contentFile, "utf8");
      }
      if (!content) {
        console.error("缺少内容 —— 请传 --content 或 --content-file");
        process.exit(2);
      }
      let rawDir = args.rawDir;
      if (!rawDir) {
        const cfg = loadConfig(args.configPath);
        if (!cfg.knowledgeBase || !cfg.knowledgeBase.rawDir) {
          console.error("缺少 knowledgeBase.rawDir —— 请传 --raw-dir 或在 ~/.config/parking-agents/skill-env.json 中设置");
          process.exit(1);
        }
        rawDir = cfg.knowledgeBase.rawDir;
      }
      const saved = saveKnowledgeEntry(
        resolveConfigPath(rawDir), args.jobShort, toInt(args.build, 0),
        args.errorCode, args.shortDesc, content,
      );
      output({ savedPath: saved });
    },
  },

  "assert-build-passed": {
    desc: "Phase 5 门禁：断言本地编译已通过（--user-waived 用户豁免）",
    flags: {
      "--exit-code": ["exitCodeArg", "value"],
      "--user-waived": ["userWaived", "bool"],
    },
    async run(args) {
      if (args.userWaived) {
        output({ passed: true, warning: "User waived local build verification. Phase 5 proceeding without compile check." });
        return;
      }
      const code = toInt(args.exitCodeArg, null);
      if (code === null) {
        output({ passed: false, error: "Cannot enter Phase 5: Invoke-LocalBuild was not run. 传 --exit-code 或 --user-waived。" }, true);
        return;
      }
      if (code !== 0) {
        output({ passed: false, error: `Cannot enter Phase 5: local build failed (ExitCode=${code}). Fix the error or pass --user-waived to skip.` }, true);
        return;
      }
      output({ passed: true });
    },
  },

  "assert-files-in-repos": {
    desc: "Phase 5 门禁：断言文件都在 gitRepos 下（files 逗号分隔）",
    flags: {
      "--files": ["files", "value"],
      "--git-repos-root": ["gitReposRoot", "value"],
    },
    async run(args) {
      requireArgs(args, ["files", "gitReposRoot"], "assert-files-in-repos");
      const files = args.files.split(",").map((s) => s.trim()).filter(Boolean);
      const result = assertFilesInGitRepos(files, args.gitReposRoot);
      output(result, !result.passed);
    },
  },
};

function usage() {
  console.error("用法: node UeErrorSolver.mjs <command> [--flags]");
  console.error("配置: config.json（脚本上级）⊕ 环境层 $SKILL_ENV > ~/.config/parking-agents/skill-env.json，深合并，环境层优先。");
  console.error("子命令:");
  for (const [name, c] of Object.entries(COMMANDS)) {
    console.error(`  ${name.padEnd(24)} ${c.desc}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (!command || command === "--help" || command === "-h" || command === "help") {
    usage();
    process.exit(command ? 0 : 2);
  }
  const cmd = COMMANDS[command];
  if (!cmd) {
    console.error(`未知子命令: ${command}`);
    usage();
    process.exit(2);
  }
  const args = parseFlags(argv.slice(1), cmd.flags, command);
  try {
    await cmd.run(args);
  } catch (e) {
    output({ error: String(e.message || e) }, true);
  }
}

main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
