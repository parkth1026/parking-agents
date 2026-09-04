// 一次性生成器 v8：v7 基础上按用户裁决——
//  ① 核心界面图移到榜单行：每个仓库名字前面（trendshift 行首头像位），40px 圆角缩略图，
//     加载失败回落首字母色块（离线不破相）
//  ② 详情卡 = 纯分析（定位/为什么爆/可信度/生态位）+ 沉底的 kv/README，不再放图
//  行层 1:1 规格 + SURGE 层不动。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WS = "D:/GIT_dev/github-trading";
const week = JSON.parse(readFileSync(join(WS, "data/weeks/2026-W36.json"), "utf8"));
const analysis = readFileSync(join(WS, "data/weeks/2026-W36.analysis.md"), "utf8");
const tldr = analysis.split("## 新晋仓库")[0].split("\n").map(s => s.trim())
  .filter(s => s && !s.startsWith("#")).slice(0, 2);

const history = {};
for (const r of week.repos) {
  try {
    const h = JSON.parse(readFileSync(join(WS, "data/repos", r.full_name.replace("/", "__") + ".json"), "utf8"));
    history[r.full_name] = h.snapshots.map(s => [s.week, s.rank, s.stars_total, s.stars_week]);
  } catch { history[r.full_name] = []; }
}
let presence = {};
try {
  for (const w of ["W31", "W32", "W33", "W34", "W35"]) {
    const p = JSON.parse(readFileSync(join(WS, "backfill/2026-" + w + ".presence.json"), "utf8"));
    const repos = Array.isArray(p) ? p : (p.repos || p["2026-" + w] || []);
    if (Array.isArray(repos)) for (const r of repos) {
      const n = r.full_name; if (!n) continue;
      presence[n] ??= { days: 0, best: 999 };
      presence[n].days += r.days_on_list || 0;
      presence[n].best = Math.min(presence[n].best, r.best_rank || 999);
    }
  }
} catch { }

const LANG = { JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Rust: "#dea584", Go: "#00ADD8", "C++": "#f34b7d", Shell: "#89e051", HTML: "#e34c26", Vue: "#41b883", MDX: "#fcb32c" };
const AVA = ["#6670cc", "#00bb7f", "#f99c00", "#00a5ef", "#ff2357", "#7c3aed", "#007956", "#52525c"];

function pickCoreImage(readme, full_name) {
  if (!readme) return null;
  const found = [];
  for (const m of readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) found.push(m[1]);
  for (const m of readme.matchAll(/<img[^>]+src="([^"]+)"/g)) found.push(m[1]);
  const bad = /badge|shields\.io|badge\/|\/api\/|travis|circleci|codecov|license|downloads|issues|stars|fork/i;
  const nice = /hero|screenshot|demo|preview|banner|interface|ui|app|window/i;
  const cands = found.filter(u => !/^data:/i.test(u) && !bad.test(u) && !/\.svg(\?|$)/i.test(u));
  if (!cands.length) return null;
  cands.sort((a, b) => (nice.test(b) ? 1 : 0) - (nice.test(a) ? 1 : 0));
  let u = cands[0];
  if (!/^https?:\/\//i.test(u)) {
    u = u.replace(/^\.\//, "").replace(/^\//, "");
    u = "https://raw.githubusercontent.com/" + full_name + "/HEAD/" + u;
  }
  return u;
}

const repos = week.repos.map(r => {
  const hist = history[r.full_name] || [];
  const vel = r.stars_total > 0 ? r.stars_week / r.stars_total : 0;
  let accel = null, accelBase = null;
  if (hist.length >= 2) {
    const prev = hist[hist.length - 2];
    if (prev[3] > 0) { accel = r.stars_week / prev[3]; accelBase = prev[0]; }
  }
  const coreImg = pickCoreImage(r.readme_excerpt, r.full_name);
  return {
    rank: r.rank, name: r.full_name, url: r.url, desc: r.description || "",
    lang: r.language, langColor: LANG[r.language] || "#a1a1aa",
    avaColor: AVA[[...r.full_name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVA.length],
    avaLetter: r.full_name.split("/")[1][0].toUpperCase(),
    sw: r.stars_week, st: r.stars_total, forks: r.forks,
    status: r.entry_status, created: (r.created_at || "").slice(0, 10),
    pushed: (r.pushed_at || "").slice(0, 10), license: r.license || "—",
    issues: r.open_issues, topics: (r.topics || []).slice(0, 3),
    readme: (r.readme_excerpt || "").slice(0, 900),
    hist, pres: presence[r.full_name] || null,
    vel, velPct: Math.round(vel * 100), surge: vel >= 0.20, accel, accelBase,
    coreImg,
  };
}).sort((a, b) => a.rank - b.rank);

const surges = repos.filter(r => r.surge).sort((a, b) => b.vel - a.vel);
const surgeLine = "⚡ 本周最猛：" + surges.slice(0, 3).map(r =>
  `${r.name} +${r.sw.toLocaleString("en-US")}（单周吃下总★ ${r.velPct}%）`).join(" · ");

const DATA = {
  week: week.week, capturedAt: week.captured_at.slice(0, 10),
  tldr: [surgeLine, ...tldr],
  staleNote: "分析写于回填导入前（当时分类：新晋 20 · 回锅 0）——重分类后 rank1 archify 等已变回锅，分析文字待重跑",
  surgeNote: "SURGE = 本周增量 ÷ 总★ ≥ 20%（2026-W36 分布天然断层：最高 58.7%，第六名 17.4%）；×N = 与该仓上一次上榜周增量之比；行首缩略图取自 README 首图（过滤徽章），缺图回落 GitHub Social Preview，离线回落首字母色块",
  repos,
};

// 四字段口径（v6 锁定）：定位=主字段 2-4 句 / 为什么爆=因果 / 可信度 / 生态位=tags+同类差异
const NOTES = {
  "tt-a1i/archify": {
    positioning: "Agent skill 赛道的「交付物引擎」。装进 Claude Code 这类 coding agent 后，对话直接产出架构图、流程图、时序图、数据流图——每张图都是自含 HTML，带动效、可交互、可导出，不依赖 draw.io / Mermaid 等外部绘图工具。核心界面就是产物本身：agent 对话驱动的图表定义，实时渲染的可交互 HTML 画布，导出即可进文档或 wiki。",
    whyNow: "踩中本周的主线信号：本期 top20 有 7 个仓直接服务 agent 技能/插件/MCP 生态（见本周分析）。「给 coding agent 造配件」是当前开源最热品类，而「架构文档」是其中最高频的刚需位——此前 diagram-as-code 全靠人工写定义，archify 补上了 agent 原生生成这个空位。",
    trust: "建仓 2025-11 · MIT · 推送活跃（2026-09-01）。扩展信源管线落地后补全：贡献者结构、commit 节奏、issue 响应速度、是否营销驱动（此为口径样例）",
    nicheTags: ["agent-skills", "diagram-generation", "claude-code", "verifiable-output"],
    niche: "同类：anthropics/skills（官方技能集）、superpowers 类技能集合。差异点：主打 verifiable 产出——图可校验、可导出，不只是一段提示词",
  },
};
const PLACEHOLDER = {
  positioning: "（主字段 · 2-4 句）这个软件属于什么领域、解决什么问题、核心界面长什么样、怎么用——你最关注的内容，新口径下由扩展信源管线生成，不再是压缩的一句话。",
  whyNow: "（因果叙事）它为什么这周爆：踩中什么事件/需求/生态位，不复述行内已有的数字。",
  trust: "（可信度信号）建仓时间、license、维护活跃度、贡献者结构、是否营销驱动——扩展信源核验后填充。",
  nicheTags: ["等待", "管线生成"],
  niche: "同类竞品列表 + 差异点一句话。",
};

const html = `<!doctype html>
<!-- draft v8 | published 2026-09-03T16:30:00+08:00
     用户意见：图片应该放在每个仓库名字前面（行首头像位），不是解释区那边；详情卡大空间留给分析
     状态：current —— 行首核心图缩略（README 首图→Social Preview→离线首字母色块）；详情卡=纯分析 -->
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub Trending 周报 · ${DATA.week}</title>
<style>
:root{
  --ink:#171717;--body:#5c5e70;--divider:#dadce7;--indigo:#6670cc;
  --indigo-soft:rgba(102,112,204,.1);--ink80:rgba(23,23,23,.8);--zinc70:rgba(92,94,112,.7);
  --amber-ink:#b45309;--amber-bg:#fffbeb;--amber-line:#fde68a;
  --r:8px;--r-lg:12px;
  --font:"Instrument Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:16px/1.5 var(--font);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.topbar{border-bottom:1px solid var(--divider)}
.topbar-in{max-width:832px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;color:var(--ink)}
.brand .logo{width:24px;height:24px;border-radius:6px;background:var(--indigo);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.win{color:var(--zinc70);font-size:12px}
select{font:inherit;font-size:13px;color:var(--ink);background:#fff;border:1px solid var(--divider);border-radius:var(--r);padding:8px 12px}
.main{max-width:832px;margin:0 auto;padding:28px 16px 90px}
.pagehead h1{font-size:24px;font-weight:600;color:var(--ink);margin:0 0 6px}
.pagehead .desc{color:var(--body);font-size:14px;margin:0}
.tldr{margin:14px 0 0;padding:10px 14px;border-left:3px solid var(--indigo);background:var(--indigo-soft);border-radius:0 var(--r) var(--r) 0}
.tldr p{margin:4px 0;color:var(--body);font-size:13.5px}
.tldr p.hot{color:var(--ink);font-weight:600}
.stale{display:flex;gap:8px;align-items:flex-start;margin:16px 0 0;padding:10px 14px;background:var(--amber-bg);border:1px solid var(--amber-line);color:var(--amber-ink);border-radius:var(--r);font-size:13px}
.listwrap{margin:20px 0 0;border:1px solid var(--divider);border-radius:var(--r-lg)}
.listhead{padding:16px 16px 12px;border-bottom:1px solid var(--divider)}
.listhead h2{font-size:17px;font-weight:600;margin:0 0 2px}
.listhead p{font-size:12.5px;color:var(--zinc70);margin:0}
.row{position:relative;display:flex;gap:10px;padding:24px 16px;border-bottom:1px solid var(--divider);cursor:pointer;align-items:flex-start}
.row:last-of-type{border-bottom:none}
.row:hover{background:#fafafa}
.surgebar{position:absolute;left:0;bottom:-1px;height:2px;background:var(--indigo);z-index:1}
.rk{flex:0 0 32px;display:flex;justify-content:flex-start;padding-top:2px}
.rk .medal{width:24px;height:24px;border-radius:50%;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
.rk .medal.g{background:#f99c00}.rk .medal.s{background:#9ca3af}.rk .medal.b{background:#b45309}
.rk .plain{color:var(--zinc70);font-size:12px;font-weight:600;padding:5px 0 0 8px}
.rthumb{flex:0 0 288px}
.rthumb .box{width:288px;aspect-ratio:16/9;border-radius:10px;border:1px solid var(--divider);overflow:hidden;background:#fafafa}
.rthumb img,.rthumb .fb{width:100%;height:100%;display:block}
.rthumb img{object-fit:cover;object-position:top}
.rthumb .fb{display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:34px}
.rmain{flex:1;min-width:0}
.rhead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.nm{font-size:16px;font-weight:500;color:var(--ink80)}
.nm:hover{color:var(--indigo)}
.nums{flex:0 0 auto;text-align:right;color:var(--ink)}
.nums .pair{display:flex;gap:12px;justify-content:flex-end;font-size:14px;font-weight:500;font-variant-numeric:tabular-nums}
.nums .pair span{display:inline-flex;align-items:center;gap:4px}
.nums .pair svg{width:14px;height:14px;fill:none;stroke:var(--ink);stroke-width:1.8;opacity:.85}
.nums .glabel{font-size:12px;color:var(--zinc70);margin-top:2px}
.badges{display:flex;gap:14px;align-items:center;margin-top:7px;flex-wrap:wrap}
.bdg{font-size:10px;font-weight:600;letter-spacing:.25px;text-transform:uppercase;color:var(--indigo)}
.bdg.z{color:var(--zinc70)}
.rdesc{font-size:14px;color:var(--body);margin:5px 0 0}
.rfoot{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
.tpill{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--body);border:1px solid var(--divider);border-radius:6px;padding:4px 8px}
.tpill .h{color:var(--zinc70)}
.lang{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--body)}
.dot{width:9px;height:9px;border-radius:50%}
.detail{border-top:1px solid var(--divider);padding:16px;display:none;background:#fcfcfd}
.detail.open{display:block}
.note .lead{font-size:14.5px;color:var(--ink);line-height:1.7}
.note .lead b{color:var(--indigo);margin-right:10px}
.analysis{margin-top:12px;display:grid;gap:10px}
.analysis .f{font-size:13.5px;color:var(--body)}
.analysis .f b{display:inline-block;min-width:60px;color:var(--ink);font-weight:600;margin-right:8px}
.niche{margin-top:2px}
.niche .tags{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.npill{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--indigo);background:var(--indigo-soft);border-radius:6px;padding:4px 8px}
.npill .h{opacity:.7}
.niche .who{font-size:13px;color:var(--body)}
.niche .who b{color:var(--ink);font-weight:600;margin-right:8px}
.kv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 12px;margin:12px 0 0}
.kv div{font-size:11px;color:var(--zinc70)}
.kv b{display:block;font-size:13px;color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.rd{margin-top:12px;background:#fff;border:1px solid var(--divider);border-radius:6px;padding:10px 12px}
.rd summary{cursor:pointer;color:var(--body);font-size:12px;list-style:none}
.rd pre{margin:8px 0 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:var(--body);max-height:160px;overflow:auto;white-space:pre-wrap}
.surgenote{margin:14px 2px 0;font-size:11.5px;color:var(--zinc70)}
footer{max-width:832px;margin:26px auto 0;padding:0 16px;color:var(--zinc70);font-size:11.5px}
@media (max-width:640px){
  .row{padding:16px 12px}
  .rdesc,.nums .pair span.fk{display:none}
  .rthumb{flex:0 0 100%;order:3;margin-top:10px}
  .rthumb .box{width:100%}
  .kv{grid-template-columns:repeat(2,1fr)}
  .pagehead h1{font-size:20px}
}
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  <span class="brand"><span class="logo">T</span>GitHub Trending 周报</span>
  <span style="display:flex;gap:10px;align-items:center">
    <select><option>${DATA.week}（最新）</option><option>2026-W35</option></select>
    <span class="win">${DATA.capturedAt.slice(0,4)}-08-25 – ${DATA.capturedAt}</span>
  </span>
</div></div>

<div class="main">
<div class="pagehead">
  <h1>Weekly trending repositories</h1>
  <p class="desc">Top 20 · 按 7 日 star 增量排序 · 新晋/回锅以徽章标注 · SURGE = 单周吃下总★两成以上的爆发仓 · 点行看定位详解与生态位</p>
  <div class="tldr">${DATA.tldr.map((p, i) => "<p" + (i === 0 ? ' class="hot"' : "") + ">" + p + "</p>").join("")}</div>
</div>
<div class="stale">⚠ <span><b>分析待重跑</b> —— ${DATA.staleNote}</span></div>
<div id="app"></div>
<p class="surgenote">${DATA.surgeNote}</p>
</div>

<footer>基础对 trendshift.io/weekly 1:1（DOM 实测规格 2026-09-03）。自有层：完整 top20 单列 · SURGE 徽章+速度条 · 行首核心图缩略（README 首图→Social Preview→离线首字母色块）· 详情卡=纯分析（定位 2-4 句 / 为什么爆因果 / 可信度 / 生态位 #tag）。差异声明：猫头鹰→名次圆牌+行首真图；Like/Bookmark/Mentioned-on 无数据不渲染；★=总量、增量在 Gained 标签；字体走系统回落。</footer>

<script>
const DATA = ${JSON.stringify(DATA)};
const NOTES = ${JSON.stringify(NOTES)};
const PLACEHOLDER = ${JSON.stringify(PLACEHOLDER)};
const fmt = n => n.toLocaleString("en-US");
const kfmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\\.0$/, "") + "k" : String(n);
const ICONS = {
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/></svg>',
  fork: '<svg viewBox="0 0 24 24"><circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="5" r="2.2"/><circle cx="12" cy="19" r="2.2"/><path d="M6 7.2v2a4 4 0 004 4h4a4 4 0 004-4v-2M12 13.2v3.6"/></svg>'
};
const app = document.getElementById("app");

function rowThumb(r) {
  const social = "https://opengraph.githubassets.com/surge/" + r.name;
  const src = r.coreImg || social;
  return '<div class="rthumb"><div class="box"><img loading="lazy" alt="' + r.name + '" src="' + src + '" data-fb="' + r.avaColor + "|" + r.avaLetter + '"></div></div>';
}

function row(r) {
  const medal = r.rank === 1 ? "g" : r.rank === 2 ? "s" : r.rank === 3 ? "b" : "";
  const rk = medal ? '<span class="medal ' + medal + '">' + r.rank + '</span>' : '<span class="plain">' + r.rank + '</span>';
  const bdgs = [];
  bdgs.push(r.status === "new" ? '<span class="bdg">New this week</span>' : '<span class="bdg z">Back on trending</span>');
  if (r.surge) bdgs.push('<span class="bdg">⚡ Surge +' + r.velPct + '%/wk</span>');
  if (r.accel && r.accelBase) bdgs.push('<span class="bdg">×' + r.accel.toFixed(1) + ' vs ' + r.accelBase.slice(5) + '</span>');
  if (r.pres) bdgs.push('<span class="bdg">On trending ' + r.pres.days + 'D · Best #' + r.pres.best + '</span>');
  const topics = (r.topics || []).map(t => '<span class="tpill"><span class="h">#</span>' + t + '</span>').join("");
  return '<div class="row" data-r="' + r.rank + '">'
    + (r.surge ? '<div class="surgebar" style="width:' + r.velPct + '%"></div>' : '')
    + '<div class="rk">' + rk + '</div>'
    + '<div class="rmain"><div class="rhead"><a class="nm" href="' + r.url + '" target="_blank">' + r.name + '</a>'
    + '<div class="nums"><div class="pair"><span>' + ICONS.star + kfmt(r.st) + '</span><span class="fk">' + ICONS.fork + kfmt(r.forks) + '</span></div>'
    + '<div class="glabel">+' + fmt(r.sw) + ' Gained this week</div></div></div>'
    + '<div class="badges">' + bdgs.join("") + '</div>'
    + '<p class="rdesc">' + (r.desc || "") + '</p>'
    + '<div class="rfoot"><span class="lang"><span class="dot" style="background:' + r.langColor + '"></span>' + (r.lang || "—") + '</span>' + topics + '</div>'
    + '</div>'
    + rowThumb(r)
    + '</div>'
    + card(r);
}

function card(r) {
  const n = NOTES[r.name];
  const analysisHtml = n
    ? '<div class="f"><b>为什么爆</b>' + n.whyNow + '</div>'
      + '<div class="f"><b>可信度</b>' + n.trust + '</div>'
      + '<div class="niche"><div class="tags">'
      + n.nicheTags.map(t => '<span class="npill"><span class="h">#</span>' + t + '</span>').join("")
      + '</div><div class="who"><b>生态位</b>' + n.niche + '</div></div>'
    : '<div class="f"><b>为什么爆</b>' + PLACEHOLDER.whyNow + '</div>'
      + '<div class="f"><b>可信度</b>' + PLACEHOLDER.trust + '</div>'
      + '<div class="niche"><div class="tags">'
      + PLACEHOLDER.nicheTags.map(t => '<span class="npill"><span class="h">#</span>' + t + '</span>').join("")
      + '</div><div class="who"><b>生态位</b>' + PLACEHOLDER.niche + '</div></div>';
  const lead = n ? n.positioning : PLACEHOLDER.positioning;
  return '<div class="detail" id="d-' + r.rank + '">'
    + '<div class="note"><div class="lead"><b>定位</b>　' + lead + '</div></div>'
    + '<div class="analysis">' + analysisHtml + '</div>'
    + '<div class="kv"><div>总★<b>' + fmt(r.st) + '</b></div><div>周增<b>+' + fmt(r.sw) + '</b></div><div>forks<b>' + fmt(r.forks) + '</b></div>'
    + '<div>open issues<b>' + r.issues + '</b></div><div>建仓<b>' + r.created + '</b></div><div>最近推送<b>' + r.pushed + '</b></div></div>'
    + '<details class="rd"><summary>README 摘录（原始自述——仅作注释层的对照面）</summary><pre>' + (r.readme || "（无）").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])) + '</pre></details>'
    + '</div>';
}

app.innerHTML = '<div class="listwrap"><div class="listhead"><h2>This week · Top 20</h2>'
  + '<p>新晋 ' + DATA.repos.filter(r => r.status === "new").length + ' · 回锅 ' + DATA.repos.filter(r => r.status === "returning").length + ' · 常驻 ' + DATA.repos.filter(r => r.status === "recurring").length + ' · SURGE ' + DATA.repos.filter(r => r.surge).length + '</p></div>'
  + DATA.repos.map(row).join("") + '</div>';

// 行首图加载失败 → 首字母色块回落（离线不破相）
app.querySelectorAll(".rthumb img").forEach(img => {
  img.addEventListener("error", () => {
    const [color, letter] = (img.dataset.fb || "|?").split("|");
    const fb = document.createElement("div");
    fb.className = "fb";
    fb.style.background = color;
    fb.textContent = letter;
    img.replaceWith(fb);
  });
});

app.addEventListener("click", e => {
  const row = e.target.closest(".row"); if (!row) return;
  if (e.target.closest("a")) return;
  document.getElementById("d-" + row.dataset.r).classList.toggle("open");
});
</script>
</body>
</html>`;

writeFileSync(new URL("./v9-mock.html", import.meta.url), html);
console.log("written v8-mock.html", (html.length / 1024).toFixed(1) + "KB",
  "| row-coreImg:", repos.filter(r => r.coreImg).length + "/20");
