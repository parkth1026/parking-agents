#!/usr/bin/env node
// generate-review.mjs — 评测评审服务器（官方 generate_review.py 完整移植，Windows 适配）
// 扫描 iteration 目录（eval-*/<config>/run-*/outputs/），内嵌全部数据生成自包含页面。
// 服务器模式: http://127.0.0.1:<port>（默认 3117，被占自动换下一空闲端口），POST /api/feedback 落盘 feedback.json。
// --static <路径>: 写单文件 HTML（反馈走对话或下载），不起服务器。
// 用法: node generate-review.mjs <iteration目录> [--port N] [--skill-name 名] [--previous-workspace 目录]
//        [--benchmark benchmark.json] [--static 输出.html] [--no-open]
// 退出码: 0 成功 / 1 目录无效或无数据 / 2 用法错
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson, writeText } from "../scripts/lib/jsonio.mjs";

const TEXT_EXTS = new Set([".txt", ".md", ".json", ".csv", ".py", ".js", ".mjs", ".ts", ".tsx", ".jsx",
  ".yaml", ".yml", ".xml", ".html", ".css", ".sh", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".sql", ".r", ".toml", ".log"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]);
const METADATA_FILES = new Set(["transcript.md", "user_notes.md", "metrics.json"]);
const MIME = {
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
};

function usage() {
  console.log("用法: node generate-review.mjs <iteration目录> [选项]");
  console.log("  --port N               起始端口（默认 3117，被占自动换）");
  console.log("  --skill-name 名        标题里的技能名（默认从目录名推断）");
  console.log("  --previous-workspace 目录  上一轮 iteration（显示上轮输出与留言）");
  console.log("  --benchmark 路径       benchmark.json（默认 <iteration>/benchmark.json 若存在）");
  console.log("  --static 输出.html     写单文件 HTML 而不起服务器");
  console.log("  --no-open              不自动开浏览器");
  process.exit(2);
}

function isDir(p) { try { return statSync(p).isDirectory(); } catch { return false; } }

/** 嵌入单个输出文件（类型对齐官方 generate_review.py：text/image/pdf/xlsx/binary/error） */
function embedFile(path) {
  const name = basename(path);
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  try {
    if (TEXT_EXTS.has(ext)) {
      return { name, type: "text", content: readFileSync(path, "utf8") };
    }
    if (IMAGE_EXTS.has(ext)) {
      const b64 = readFileSync(path).toString("base64");
      const mime = MIME[ext] || "application/octet-stream";
      return { name, type: "image", data_uri: `data:${mime};base64,${b64}` };
    }
    if (ext === ".pdf") {
      const b64 = readFileSync(path).toString("base64");
      return { name, type: "pdf", data_uri: `data:application/pdf;base64,${b64}` };
    }
    if (ext === ".xlsx") {
      // SheetJS 在浏览器端渲染，传 base64 原始字节
      return { name, type: "xlsx", data_b64: readFileSync(path).toString("base64") };
    }
    const b64 = readFileSync(path).toString("base64");
    return { name, type: "binary", data_uri: `data:application/octet-stream;base64,${b64}` };
  } catch {
    return { name, type: "error", content: "(Error reading file)" };
  }
}

/** 扫描 iteration 目录 → evals 数组（v2 数据契约，viewer.html 直接消费） */
export function scanIteration(iterDir) {
  let searchDir = iterDir;
  const direct = readdirSync(iterDir).filter((n) => n.startsWith("eval-") && isDir(join(iterDir, n)));
  if (direct.length === 0 && isDir(join(iterDir, "runs"))) searchDir = join(iterDir, "runs");

  const evals = [];
  for (const evalName of readdirSync(searchDir).filter((n) => n.startsWith("eval-") && isDir(join(searchDir, n))).sort()) {
    const evalDir = join(searchDir, evalName);
    const metadata = readJson(join(evalDir, "eval_metadata.json")) || {};
    const entry = { name: evalName, prompt: metadata.prompt ?? "", configs: {} };

    for (const cfgName of readdirSync(evalDir).sort()) {
      const cfgDir = join(evalDir, cfgName);
      if (!isDir(cfgDir)) continue;
      const runNames = readdirSync(cfgDir).filter((n) => /^run-\d+$/.test(n)).sort();
      if (runNames.length === 0) continue;

      for (const runName of runNames) {
        const runDir = join(cfgDir, runName);
        const outputsDir = join(runDir, "outputs");
        const outputs = isDir(outputsDir)
          ? readdirSync(outputsDir).filter((f) => statSync(join(outputsDir, f)).isFile() && !METADATA_FILES.has(f)).sort()
              .map((f) => embedFile(join(outputsDir, f)))
          : [];
        (entry.configs[cfgName] ??= []).push({
          run: runName,
          timing: readJson(join(runDir, "timing.json")),
          grading: readJson(join(runDir, "grading.json")),
          outputs,
        });
      }
    }
    if (Object.keys(entry.configs).length > 0) evals.push(entry);
  }
  return evals;
}

/** 上轮 iteration：feedback（v2 reviews）+ 输出，键 = "eval|config|run" */
export function loadPrevious(prevDir) {
  const previousFeedback = {};
  const previousOutputs = {};
  const fb = readJson(join(prevDir, "feedback.json"));
  if (fb && Array.isArray(fb.reviews)) {
    for (const r of fb.reviews) {
      if (r.comment && r.comment.trim()) previousFeedback[`${r.eval}|${r.config}|${r.run}`] = r.comment;
    }
  }
  for (const ev of scanIteration(prevDir)) {
    for (const cfg of Object.keys(ev.configs)) {
      for (const run of ev.configs[cfg]) {
        if (run.outputs.length > 0) previousOutputs[`${ev.name}|${cfg}|${run.run}`] = run.outputs;
      }
    }
  }
  return { previousFeedback, previousOutputs };
}

/** 生成自包含 HTML（viewer.html 模板 + 嵌入数据） */
export function generateHtml(data) {
  const templatePath = join(dirname(fileURLToPath(import.meta.url)), "viewer.html");
  const template = readFileSync(templatePath, "utf8");
  return template.replace("/*__EMBEDDED_DATA__*/", `const EMBEDDED_DATA = ${JSON.stringify(data)};`);
}

// --- CLI ---
const argv = process.argv.slice(2);
const iterArg = argv.find((a) => !a.startsWith("--"));
if (!iterArg || argv.includes("--help")) usage();
const flag = (name) => { const i = argv.indexOf(name); return i !== -1 ? argv[i + 1] : undefined; };

const iterDir = resolve(iterArg);
if (!isDir(iterDir)) {
  console.log(`目录无效: ${iterDir}`);
  process.exit(1);
}

const evals = scanIteration(iterDir);
if (evals.length === 0) {
  console.log(`未发现评测 run（需要 eval-*/<config>/run-*/outputs/）: ${iterDir}`);
  process.exit(1);
}

// 技能名推断：<skill>-workspace/iteration-N → <skill>；非标准布局逐级回退
function inferSkillName(iterDir) {
  const base = basename(iterDir);
  let name = base.replace(/-iteration-\d+$/, "");
  if (name === base || /^iteration(-\d+)?$/.test(name)) {
    // 目录本身就是 iteration-N：回退到父目录（<skill>-workspace → <skill>）
    name = basename(resolve(iterDir, "..")).replace(/-workspace$/, "");
  }
  return name;
}
const skillName = flag("--skill-name") || inferSkillName(iterDir);
const portArg = flag("--port");
const startPort = portArg ? parseInt(portArg, 10) : 3117;
const staticPath = flag("--static");
const noOpen = argv.includes("--no-open");

const prevArg = flag("--previous-workspace");
const previous = prevArg && isDir(resolve(prevArg)) ? loadPrevious(resolve(prevArg)) : { previousFeedback: {}, previousOutputs: {} };

const benchmarkArg = flag("--benchmark");
const benchmarkPath = benchmarkArg ? resolve(benchmarkArg) : join(iterDir, "benchmark.json");
const benchmark = existsSync(benchmarkPath) ? readJson(benchmarkPath) : null;

const data = {
  skill_name: skillName,
  iteration: basename(iterDir),
  evals,
  previous_feedback: previous.previousFeedback,
  previous_outputs: previous.previousOutputs,
};
if (benchmark) data.benchmark = benchmark;

// --static 降级模式
if (staticPath) {
  writeText(resolve(staticPath), generateHtml(data));
  console.log(`静态报告: ${resolve(staticPath)}（单文件，自包含，双击打开；反馈走对话）`);
  process.exit(0);
}

// ---- 服务器模式 ----
const feedbackPath = join(iterDir, "feedback.json");

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    // 每次请求重扫，浏览器刷新即得新数据
    let html;
    try {
      const freshEvals = scanIteration(iterDir);
      const freshBench = existsSync(benchmarkPath) ? readJson(benchmarkPath) : benchmark;
      html = generateHtml({ ...data, evals: freshEvals.length > 0 ? freshEvals : evals, benchmark: freshBench });
    } catch {
      html = generateHtml(data);
    }
    const body = Buffer.from(html, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": body.length });
    res.end(body);
  } else if (req.method === "GET" && url === "/api/feedback") {
    const body = Buffer.from(existsSync(feedbackPath) ? readFileSync(feedbackPath, "utf8") : "{}");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Length": body.length });
    res.end(body);
  } else if (req.method === "POST" && url === "/api/feedback") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.reviews)) {
          throw new Error("expected JSON object with 'reviews' key");
        }
        writeJson(feedbackPath, parsed);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch (e) {
        const body = Buffer.from(JSON.stringify({ error: String(e.message || e) }));
        res.writeHead(500, { "Content-Type": "application/json", "Content-Length": body.length });
        res.end(body);
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
});

/** 端口探测：从 startPort 起找第一个空闲端口（Windows 无 lsof，用 bind 试探法） */
async function findFreePort(start) {
  for (let port = start; port < start + 100; port++) {
    const ok = await new Promise((resolvePromise) => {
      const probe = net.createServer();
      probe.once("error", () => resolvePromise(false));
      probe.once("listening", () => probe.close(() => resolvePromise(true)));
      probe.listen(port, "127.0.0.1");
    });
    if (ok) return port;
  }
  throw new Error(`无空闲端口（尝试 ${start}~${start + 99}）`);
}

const port = await findFreePort(startPort);
await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));

const url = `http://127.0.0.1:${port}`;
console.log(`viewer 已启动: ${url}`);
console.log(`  Workspace: ${iterDir}`);
console.log(`  Feedback:  ${feedbackPath}`);
if (prevArg) console.log(`  Previous:  ${prevArg}`);
if (benchmark) console.log(`  Benchmark: ${benchmarkPath}`);
console.log(`  （Ctrl+C 停止）`);

if (!noOpen) openBrowser(url);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

let shutDown = false;
function shutdown() {
  if (shutDown) return;
  shutDown = true;
  console.log("\nStopped.");
  server.closeIdleConnections?.();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}

function openBrowser(u) {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", u], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [u], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [u], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    console.log(`（无法自动开浏览器，请手动访问 ${u}）`);
  }
}
