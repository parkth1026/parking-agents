// 一次性生成器：用真实 workspace 数据产出 v1 界面草稿（写死数据、单文件自包含）
// 用后可删；不是技能交付物。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WS = "D:/GIT_dev/github-trading";
const week = JSON.parse(readFileSync(join(WS, "data/weeks/2026-W36.json"), "utf8"));
const analysis = readFileSync(join(WS, "data/weeks/2026-W36.analysis.md"), "utf8");

// 本周看点（TLDR 头文案，真实取自 analysis.md 前 3 行）
const tldr = analysis.split("## 新晋仓库")[0].split("\n").map(s => s.trim())
  .filter(s => s && !s.startsWith("#")).slice(0, 3);

// per-repo 历史快照（sparkline 数据）
const history = {};
for (const r of week.repos) {
  const f = join(WS, "data/repos", r.full_name.replace("/", "__") + ".json");
  try {
    const h = JSON.parse(readFileSync(f, "utf8"));
    history[r.full_name] = h.snapshots.map(s => [s.week, s.rank, s.stars_total, s.stars_week]);
  } catch { history[r.full_name] = []; }
}

// backfill presence（W31–W35 在场证据；文件结构以实际为准，解析失败降级为空）
let presence = {};
try {
  for (const w of ["W31", "W32", "W33", "W34", "W35"]) {
    const p = JSON.parse(readFileSync(join(WS, "backfill/2026-" + w + ".presence.json"), "utf8"));
    const repos = Array.isArray(p) ? p : (p.repos || p["2026-" + w] || []);
    if (Array.isArray(repos)) for (const r of repos) {
      const n = r.full_name; if (!n) continue;
      presence[n] ??= { days: 0, best: 999, weeks: [] };
      presence[n].days += r.days_on_list || 0;
      presence[n].best = Math.min(presence[n].best, r.best_rank || 999);
      presence[n].weeks.push("2026-" + w);
    }
  }
} catch { /* mock 降级：无在场数据时不渲染该栏 */ }

const LANG = { JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Rust: "#dea584", Go: "#00ADD8", "C++": "#f34b7d", C: "#555555", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c", Java: "#b07219", Vue: "#41b883", Lua: "#000080", Zig: "#ec915c", MDX: "#fcb32c" };

const DATA = {
  week: week.week,
  capturedAt: week.captured_at.slice(0, 10),
  tldr,
  stale: true, // 演示：回填重分类后 analysis 未重跑 → viewer 亮 stale 条
  staleNote: "本页分析写于回填导入前（当时分类：新晋20·回锅0）；重分类后 rank1 archify 等已变回锅，分析文字待重跑",
  presenceNote: "在场数据来自 backfill W31–W35 全球日榜聚合，非官方 weekly 口径",
  repos: week.repos.map(r => ({
    rank: r.rank, name: r.full_name, url: r.url, desc: r.description || "",
    lang: r.language, langColor: LANG[r.language] || "#8b949e",
    sw: r.stars_week, st: r.stars_total, forks: r.forks,
    status: r.entry_status, created: (r.created_at || "").slice(0, 10),
    pushed: (r.pushed_at || "").slice(0, 10), license: r.license || "—",
    issues: r.open_issues, readme: (r.readme_excerpt || "").slice(0, 900),
    hist: history[r.full_name] || [], pres: presence[r.full_name] || null,
  })),
};

// 四字段注释示意（仅 rank1 用真实可查事实手工写一条，作口径样例；其余走 analysis 现有三 bullet）
const NOTES = {
  "tt-a1i/archify": {
    positioning: "Agent skill 赛道：让 LLM 产出「可验证的美观交付物」的技能包（JavaScript）",
    whyNow: "本周 +22,095★（W28 首见时 +1,019，一周内周增速 ×21）；总★ 41.6k 中过半是本周新增",
    trust: "建仓 2025-11；license " + (DATA.repos[0].license) + "；forks/issues 待扩展信源核验（示意）",
    niche: "生态位：Agent 技能工程化；同类：anthropics/skills、superpowers 类技能集合；差异点主打 verifiable 产出（示意——本字段由扩展信源+生态位知识库生成）",
  },
};

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>周报改版 v1 草稿 · ${DATA.week}</title>
<style>
:root{--bg:#0d1117;--panel:#161b22;--fg:#e6edf3;--muted:#8b949e;--accent:#58a6ff;--green:#3fb950;--yellow:#d29922;--purple:#bc8cff;--line:#30363d;--mono:ui-monospace,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 -apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:920px;margin:0 auto;padding:24px 20px 80px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between}
h1{font-size:20px;margin:0}
.window{color:var(--muted);font-size:12px;font-family:var(--mono)}
select{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 8px}
.stale{border:1px solid var(--yellow);background:#1f1b0e;color:var(--yellow);border-radius:8px;padding:8px 12px;font-size:12px;margin:14px 0 0}
.tldr{margin:20px 0 0;border-left:3px solid var(--accent);padding:4px 0 4px 14px}
.tldr h2{font-size:16px;margin:0 0 6px}
.tldr p{margin:4px 0;color:var(--muted);font-size:13px}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0}
.chip{border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:12px;color:var(--muted)}
.chip b{color:var(--fg)}
section{margin-top:28px}
h3.sec{font-size:15px;margin:0 0 4px;display:flex;align-items:center;gap:8px}
h3.sec .n{color:var(--muted);font-weight:400;font-size:12px}
.sub{color:var(--muted);font-size:12px;margin:0 0 10px}
.tag-new{color:var(--green);border:1px solid var(--green);border-radius:4px;font-size:11px;padding:0 6px}
.tag-ret{color:var(--yellow);border:1px solid var(--yellow);border-radius:4px;font-size:11px;padding:0 6px}
.row{position:relative;display:grid;grid-template-columns:34px 1fr 130px 90px;gap:10px;align-items:center;padding:9px 10px;border-bottom:1px solid var(--line);cursor:pointer}
.row:hover{background:#1b2129}
.row .bar{position:absolute;left:0;top:0;bottom:0;background:rgba(63,185,80,.09);pointer-events:none}
.rk{font-family:var(--mono);color:var(--muted);text-align:right;font-size:13px}
.rk.top{color:#e3b341;font-weight:700}
.nm{font-weight:600;color:var(--accent);text-decoration:none;font-size:13.5px}
.ds{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px}
.meta{display:flex;gap:8px;align-items:center;margin-top:2px;flex-wrap:wrap}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.lang{font-size:11px;color:var(--muted)}
.badge-pres{font-size:11px;color:var(--purple);border:1px solid var(--purple);border-radius:4px;padding:0 5px}
.sw{font-family:var(--mono);text-align:right;font-size:13.5px;color:var(--green);font-variant-numeric:tabular-nums}
.sw small{display:block;color:var(--muted);font-size:10.5px}
.st{font-family:var(--mono);text-align:right;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
details.more{margin-top:8px}
details.more summary{cursor:pointer;color:var(--muted);font-size:12px;padding:6px 0}
details.fold>summary{cursor:pointer;list-style:none;padding:8px 0;color:var(--muted);font-size:13px}
details.fold>summary::before{content:"▸ ";}
details.fold[open]>summary::before{content:"▾ ";}
.empty{border:1px dashed var(--line);border-radius:8px;padding:14px;color:var(--muted);font-size:12.5px}
.card{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:14px 16px;margin:10px 0}
.note{display:grid;gap:6px;margin:10px 0}
.note div{font-size:12.5px}
.note b{color:var(--accent);font-weight:600;margin-right:6px}
.kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px 14px;font-size:12px;color:var(--muted);margin:8px 0}
.kv b{color:var(--fg);font-weight:600;display:block;font-family:var(--mono)}
.rd{font-family:var(--mono);font-size:11.5px;color:var(--muted);background:#0d1117;border:1px solid var(--line);border-radius:6px;padding:8px 10px;max-height:180px;overflow:auto;white-space:pre-wrap}
footer{margin-top:40px;color:var(--muted);font-size:11.5px;border-top:1px solid var(--line);padding-top:12px}
.changed{outline:1px dashed var(--accent);outline-offset:2px}
@media (max-width:640px){
  .row{grid-template-columns:26px 1fr 86px}
  .st,.ds{display:none}
  .wrap{padding:16px 12px 60px}
}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>GitHub Trending 周报 <span style="color:var(--muted);font-weight:400">· ${DATA.week}</span></h1>
  <div>
    <select><option>${DATA.week}（最新）</option><option>2026-W35（backfill 在场数据）</option></select>
    <div class="window">数据窗口 2026-08-25 – ${DATA.capturedAt} · 按 7 日 star 增量排序</div>
  </div>
</header>

<div class="stale changed">⚠ 分析待重跑：${DATA.staleNote}</div>

<div class="tldr changed">
  <h2>${DATA.repos[0].name} 爆发 +${DATA.repos[0].sw.toLocaleString()}★ · ${DATA.repos[1].name} · ${DATA.repos[2].name}</h2>
  ${DATA.tldr.map(p => `<p>${p}</p>`).join("")}
</div>

<div class="chips"><span class="chip">新晋 <b id="cNew"></b></span><span class="chip">回锅 <b id="cRet"></b></span><span class="chip">常驻 <b id="cRec"></b></span><span class="chip">上榜 <b>20</b></span></div>

<div id="app"></div>

<footer>
  <p>【v1 草稿·新增】三段版面（新晋高亮→回锅平铺→常驻折叠）/ TLDR 头 / stale 咬合条 / trendshift 式行样式（+N★ 窗口标签、比例条、tabular-nums、语言色点、前三名金色）/ 四字段注释（定位·为什么爆·可信度·生态位竞品）/ 详情卡 sparkline + backfill 在场徽章 / 移动端降级（窄屏隐藏总★与描述）。</p>
  <p>【不变】零依赖单文件、双击 file:// 可开、data.js 注入方式、周切换、serve.mjs 路由、trending-week/1 与 repo-history/1 数据契约。</p>
  <p>【示意标注】archify 的四字段注释为口径样例（可信度/生态位两栏待扩展信源落地后由管线生成）；sparkline 与在场数据为真实落盘数据。</p>
</footer>
</div>
<script>
const DATA = ${JSON.stringify(DATA)};
const NOTES = ${JSON.stringify(NOTES)};
const app = document.getElementById("app");
const fmt = n => n.toLocaleString("en-US");
const maxSw = Math.max(...DATA.repos.map(r => r.sw));

function sparkline(pts) {
  if (!pts || pts.length < 2) return '<div style="color:var(--muted);font-size:11px">轨迹：仅 ' + (pts ? pts.length : 0) + ' 个快照（跨周积累中）</div>';
  const w = 220, h = 40, pad = 4;
  const ys = pts.map(p => p[2]), max = Math.max(...ys), min = Math.min(...ys);
  const x = i => pad + i * (w - 2 * pad) / (pts.length - 1);
  const y = v => h - pad - (v - min) / (max - min || 1) * (h - 2 * pad);
  const line = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(p[2]).toFixed(1)).join("");
  const labels = pts.map(p => p[0].slice(5)).join(" → ");
  return '<div><svg width="' + w + '" height="' + h + '" style="display:block"><path d="' + line + '" fill="none" stroke="var(--green)" stroke-width="1.5"/><path d="' + line + 'L' + x(pts.length - 1) + ',' + h + 'L' + x(0) + ',' + h + 'Z" fill="rgba(63,185,80,.12)" stroke="none"/></svg><div style="color:var(--muted);font-size:10.5px;font-family:var(--mono)">总★ 轨迹 ' + labels + '</div></div>';
}

function row(r, secClass) {
  const pres = r.pres ? '<span class="badge-pres">在场 ' + r.pres.days + ' 天 · 最好 #' + r.pres.best + '</span>' : "";
  return '<div class="row ' + secClass + '" data-r="' + r.rank + '">'
    + '<div class="bar" style="width:' + (r.sw / maxSw * 100).toFixed(1) + '%"></div>'
    + '<div class="rk' + (r.rank <= 3 ? " top" : "") + '">' + r.rank + '</div>'
    + '<div><a class="nm" href="' + r.url + '" target="_blank">' + r.name + '</a>'
    + '<div class="ds">' + (r.desc || "") + '</div>'
    + '<div class="meta"><span class="dot" style="background:' + r.langColor + '"></span><span class="lang">' + (r.lang || "—") + '</span>' + pres + '</div></div>'
    + '<div class="sw">+' + fmt(r.sw) + '★<small>this week</small></div>'
    + '<div class="st">' + fmt(r.st) + '<small>total</small></div>'
    + '</div>';
}

function card(r) {
  const n = NOTES[r.name];
  const note = n
    ? '<div class="note changed">'
      + '<div><b>定位</b>' + n.positioning + '</div>'
      + '<div><b>为什么爆</b>' + n.whyNow + '</div>'
      + '<div><b>可信度</b>' + n.trust + '</div>'
      + '<div><b>生态位</b>' + n.niche + '</div></div>'
    : '<div class="note" style="color:var(--muted);font-size:12px">四字段注释（定位/为什么爆/可信度/生态位竞品）——新口径，由扩展信源管线生成后落位于此</div>';
  return '<div class="card" id="card-' + r.rank + '" style="display:none">'
    + '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">'
    + '<div style="flex:1;min-width:240px">' + note
    + '<div class="kv"><div><b>' + fmt(r.st) + '</b>总★</div><div><b>' + fmt(r.sw) + '</b>周增</div><div><b>' + fmt(r.forks) + '</b>forks</div><div><b>' + r.issues + '</b>open issues</div><div><b>' + r.created + '</b>建仓</div><div><b>' + r.pushed + '</b>最近推送</div><div><b>' + r.license + '</b>license</div></div></div>'
    + '<div>' + sparkline(r.hist) + '<div style="color:var(--muted);font-size:10.5px;margin-top:6px;max-width:240px">' + DATA.presenceNote + '</div></div></div>'
    + '<details style="margin-top:8px"><summary style="cursor:pointer;color:var(--muted);font-size:12px">README 摘录（原始自述——注释层的对照面，非结论来源）</summary><div class="rd">' + (r.readme || "（无）").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])) + '</div></details>'
    + '</div>';
}

function section(title, tag, sub, list, open, topN) {
  if (!list.length) return '<section><h3 class="sec">' + title + ' <span class="n">0 个</span></h3><p class="sub">' + sub + '</p><div class="empty">本段本周为空——' + (title === "常驻" ? "首个 live 周之后，连续在榜的仓库会出现在这里（当前历史靠 backfill 在场数据补充）" : "空态") + '</div></section>';
  const head = topN ? list.slice(0, topN) : list, tail = topN ? list.slice(topN) : [];
  let h = '<section><h3 class="sec">' + title + ' <span class="tag-' + tag + '">NEW' === "" ? "" : "";
  h = '<section><h3 class="sec">' + title + ' <span class="n">' + list.length + ' 个</span> ' + (tag ? '<span class="tag-' + tag + '">' + (tag === "new" ? "新晋" : "回锅") + '</span>' : "") + '</h3><p class="sub">' + sub + '</p>';
  h += head.map(r => row(r, tag === "new" ? "sec-new" : "sec-ret")).join("") + head.map(card).join("");
  if (tail.length) h += '<details class="more ' + (open ? "" : "fold") + '"><summary>显示其余 ' + tail.length + ' 个</summary>' + tail.map(r => row(r, "sec-new")).join("") + tail.map(card).join("") + '</details>';
  else if (!open) h = h; // 常驻段整体折叠的形态由下一版按真实常驻数据呈现
  return h + '</section>';
}

const news = DATA.repos.filter(r => r.status === "new").sort((a, b) => a.rank - b.rank);
const rets = DATA.repos.filter(r => r.status === "returning").sort((a, b) => a.rank - b.rank);
const recs = DATA.repos.filter(r => r.status === "recurring");
document.getElementById("cNew").textContent = news.length;
document.getElementById("cRet").textContent = rets.length;
document.getElementById("cRec").textContent = recs.length;

app.innerHTML =
  section("新晋", "new", "本周首次登上 weekly 榜（对照 backfill 在场历史判定）", news, true, 10)
  + section("回锅", "ret", "曾上榜、掉出后本周重新入榜——老项目复活信号", rets, true, 0)
  + section("常驻", "", "连续在榜", recs, false, 0);

app.addEventListener("click", e => {
  const rEl = e.target.closest(".row"); if (!rEl) return;
  const c = document.getElementById("card-" + rEl.dataset.r);
  if (c) c.style.display = c.style.display === "none" ? "block" : "none";
});
</script>
</body>
</html>`;

writeFileSync(new URL("./v1-mock.html", import.meta.url), html);
console.log("written v1-mock.html", (html.length / 1024).toFixed(1) + "KB",
  "| new:", DATA.repos.filter(r => r.status === "new").length,
  "ret:", DATA.repos.filter(r => r.status === "returning").length,
  "rec:", DATA.repos.filter(r => r.status === "recurring").length,
  "| presence repos:", Object.keys(presence).length);
