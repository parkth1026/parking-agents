#!/usr/bin/env node
// serve.mjs — 本地只读后端：viewer 页面 + JSON API，默认绑定 127.0.0.1（不对外）。
// 数据每次请求时从 data/ 目录现读——服务常开也能看到最新采集结果，不存在 data.js 过期问题。
// 用法:
//   node serve.mjs [--workspace <dir>] [--port 8788] [--host 127.0.0.1]
// workspace/port/host 省略时走配置链（lib/config.mjs：CLI > 配置 > 代码缺省）。
// 路由:
//   GET /                          viewer 页面（等同 report/index.html）
//   GET /data.js                   viewer 载荷（动态生成）
//   GET /api/weeks                 全部周摘要（week/counts/top1/has_analysis）
//   GET /api/weeks/:id             单周完整快照 JSON
//   GET /api/weeks/:id/analysis    该周分析 markdown 文本
//   GET /api/repos                 全部上榜仓库历史摘要
//   GET /api/repos/:owner__repo    单仓库累计历史 JSON
//   GET /api/latest                最近一周完整快照
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, paths, repoFileName, fatal, WEEK_RE } from "./lib/util.mjs";
import { resolveWorkspace, resolveServeOpts } from "./lib/config.mjs";
import { buildPayload, listWeekFiles, weekSummary } from "./lib/report-data.mjs";

const args = parseArgs(process.argv.slice(2), {
  workspace: {},
  port: {},
  host: {},
  portfile: {},   // 实际监听端口写入该文件（--port 0 随机端口时供程序化读取）
});
const { port: portArg, host } = resolveServeOpts(args);
const port = Number(portArg);
if (!Number.isInteger(port) || port < 0 || port > 65535) fatal(`--port 非法: ${portArg}`);
const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const p = paths(resolveWorkspace(args.workspace));
const viewerSrc = join(SKILL_DIR, "assets", "viewer.html");

function send(res, code, type, body, extra = {}) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, "application/json; charset=utf-8", JSON.stringify(obj, null, 2));

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const path = decodeURIComponent(url.pathname);
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "只支持 GET" });

    if (path === "/" || path === "/index.html") {
      if (!existsSync(viewerSrc)) return json(res, 500, { error: "viewer 模板缺失" });
      return send(res, 200, "text/html; charset=utf-8", readFileSync(viewerSrc));
    }
    if (path === "/data.js") {
      try {
        const payload = buildPayload(p.weeks);
        return send(res, 200, "text/javascript; charset=utf-8", `window.TRENDING_DATA = ${JSON.stringify(payload)};\n`);
      } catch (e) { return json(res, 500, { error: e.message }); }
    }
    if (path === "/api/weeks") {
      const weeks = listWeekFiles(p.weeks).map((f) => weekSummary(p.weeks, f));
      return json(res, 200, { count: weeks.length, weeks });
    }
    if (path === "/api/latest") {
      const files = listWeekFiles(p.weeks);
      if (!files.length) return json(res, 404, { error: "没有周快照" });
      return json(res, 200, JSON.parse(readFileSync(join(p.weeks, files.at(-1)), "utf8")));
    }
    let m = /^\/api\/weeks\/(\d{4}-W\d{2})$/.exec(path);
    if (m) {
      if (!WEEK_RE.test(m[1])) return json(res, 400, { error: "周编号非法" });
      const f = join(p.weeks, `${m[1]}.json`);
      if (!existsSync(f)) return json(res, 404, { error: `无 ${m[1]}` });
      return json(res, 200, JSON.parse(readFileSync(f, "utf8")));
    }
    m = /^\/api\/weeks\/(\d{4}-W\d{2})\/analysis$/.exec(path);
    if (m) {
      const f = join(p.weeks, `${m[1]}.analysis.md`);
      if (!existsSync(f)) return json(res, 404, { error: `无 ${m[1]} 分析` });
      return send(res, 200, "text/markdown; charset=utf-8", readFileSync(f, "utf8"));
    }
    if (path === "/backfill" || path === "/backfill/") {
      // workspace 附录：缺周回填 presence 页（自包含单文件，存在才挂载）
      const f = join(p.ws, "backfill", "index.html");
      if (!existsSync(f)) return json(res, 404, { error: "无 backfill 页（workspace 无 backfill/index.html）" });
      return send(res, 200, "text/html; charset=utf-8", readFileSync(f));
    }
    if (path === "/api/repos") {
      const files = readdirSync(p.repos).filter((f) => f.endsWith(".json")).sort();
      const repos = files.map((f) => {
        const h = JSON.parse(readFileSync(join(p.repos, f), "utf8"));
        return {
          full_name: h.full_name,
          first_seen_week: h.first_seen_week,
          last_seen_week: h.last_seen_week ?? null,
          weeks_on_chart: h.snapshots.length,
        };
      });
      return json(res, 200, { count: repos.length, repos });
    }
    m = /^\/api\/repos\/([A-Za-z0-9_.-]+__[A-Za-z0-9_.-]+)$/.exec(path);
    if (m) {
      const f = join(p.repos, `${m[1]}.json`);
      if (!existsSync(f)) return json(res, 404, { error: `无 ${m[1]}` });
      return json(res, 200, JSON.parse(readFileSync(f, "utf8")));
    }
      return json(res, 404, { error: `未知路由: ${path}`, routes: ["/", "/data.js", "/backfill/", "/api/weeks", "/api/weeks/:id", "/api/weeks/:id/analysis", "/api/repos", "/api/repos/:owner__repo", "/api/latest"] });
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") fatal(`端口 ${port} 被占用，换一个: node serve.mjs --port 8789`);
  fatal(`服务器错误: ${e.message}`);
});
server.listen(port, args.host, () => {
  const actual = server.address().port;
  if (args.portfile) writeFileSync(args.portfile, String(actual));
  console.log(`LISTENING port=${actual}`);
  const lan = host === "0.0.0.0" ? Object.values(networkInterfaces()).flat()
    .filter((n) => n?.family === "IPv4" && !n.internal).map((n) => n.address) : [];
  console.log(`GitHub Trending 周报后端  http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${actual}`);
  for (const ip of lan) console.log(`  局域网访问  http://${ip}:${actual}/`);
  if (lan.length) console.log(`  提示: 局域网内其他设备打不开时，检查 Windows 防火墙对 TCP ${actual} 的入站放行`);
  console.log(`  CLI/API    http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${actual}/api/weeks`);
});
