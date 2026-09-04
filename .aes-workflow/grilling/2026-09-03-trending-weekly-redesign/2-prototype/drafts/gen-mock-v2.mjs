// 一次性生成器 v2：Trendshift 视觉复刻（自写 CSS 实现 token：violet #8d54ff / emerald #00bb7f / zinc 阶 / Instrument Sans 栈）
// 真实 W36 数据。用后可删。
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
      presence[n] ??= { days: 0, best: 999, weeks: [] };
      presence[n].days += r.days_on_list || 0;
      presence[n].best = Math.min(presence[n].best, r.best_rank || 999);
      presence[n].weeks.push("2026-" + w);
    }
  }
} catch { }

const LANG = { JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Rust: "#dea584", Go: "#00ADD8", "C++": "#f34b7d", C: "#555555", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c", Java: "#b07219", Vue: "#41b883", Lua: "#000080", Zig: "#ec915c", MDX: "#fcb32c" };
const AVA = ["#8d54ff", "#00bb7f", "#f99c00", "#00a5ef", "#ff2357", "#7c3aed", "#007956", "#52525c"];
const DATA = {
  week: week.week, capturedAt: week.captured_at.slice(0, 10),
  tldr,
  stale: true,
  staleNote: "分析写于回填导入前（当时分类：新晋 20 · 回锅 0）——重分类后 rank1 archify 等已变回锅，分析文字待重跑",
  presenceNote: "在场数据来自 backfill（W31–W35 全球日榜聚合），非官方 weekly 口径",
  repos: week.repos.map(r => ({
    rank: r.rank, name: r.full_name, url: r.url, desc: r.description || "",
    lang: r.language, langColor: LANG[r.language] || "#a1a1aa",
    avaColor: AVA[[...r.full_name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVA.length],
    sw: r.stars_week, st: r.stars_total, forks: r.forks,
    status: r.entry_status, created: (r.created_at || "").slice(0, 10),
    pushed: (r.pushed_at || "").slice(0, 10), license: r.license || "—",
    issues: r.open_issues, topics: (r.topics || []).slice(0, 3),
    readme: (r.readme_excerpt || "").slice(0, 900),
    hist: history[r.full_name] || [], pres: presence[r.full_name] || null,
  })),
};
const NOTES = {
  "tt-a1i/archify": {
    positioning: "Agent skill 赛道：让 LLM 产出「可验证的美观交付物」的技能包（JavaScript）",
    whyNow: "本周 +22,095★（W28 首见时 +1,019，周增速 ×21）；总★ 41.6k 过半来自本周",
    trust: "建仓 2025-11 · license MIT · 活跃推送 2026-09-01（可信度/生态位两栏待扩展信源管线生成，此为口径样例）",
    niche: "生态位：Agent 技能工程化；同类：anthropics/skills、superpowers 类技能集合；差异点主打 verifiable 产出",
  },
};

const html = `<!doctype html>
<!-- draft v2 | published 2026-09-03T11:30:00+08:00
     用户意见：v1 一点美感都没有，直接照抄 Trendshift（内部个人用）
     状态：current —— Trendshift 视觉复刻（token 级：violet/emerald/zinc/Instrument Sans 栈），结构沿用 v1 已锁信息架构 -->
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub Trending 周报 · ${DATA.week}</title>
<style>
:root{
  --bg:#fff;--soft:#fafafa;--border:#e4e4e7;--border-strong:#d4d4d8;
  --ink:#18181b;--body:#52525c;--muted:#a1a1aa;
  --accent:#8d54ff;--accent-deep:#7c3aed;--accent-soft:#f4f2fd;
  --gain:#00bb7f;--gain-deep:#007956;
  --amber-ink:#b45309;--amber-bg:#fffbeb;--amber-line:#fde68a;
  --radius:12px;--radius-sm:8px;
  --font:"Instrument Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 var(--font);-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.topbar{border-bottom:1px solid var(--border);background:#fff}
.topbar-in{max-width:800px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px;letter-spacing:-.01em}
.brand .logo{width:26px;height:26px;border-radius:7px;background:var(--accent);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}
.win{color:var(--muted);font-size:12px}
select{font:inherit;font-size:13px;color:var(--ink);background:#fff;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:6px 10px}
.main{max-width:800px;margin:0 auto;padding:28px 20px 90px}
.hero h1{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:0}
.hero .desc{color:var(--body);font-size:14px;margin:8px 0 0;max-width:640px}
.tldr{margin:14px 0 0;padding:10px 14px;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 var(--radius-sm) var(--radius-sm) 0}
.tldr p{margin:4px 0;color:var(--body);font-size:13.5px}
.stale{display:flex;gap:8px;align-items:flex-start;margin:16px 0 0;padding:10px 14px;background:var(--amber-bg);border:1px solid var(--amber-line);color:var(--amber-ink);border-radius:var(--radius-sm);font-size:13px}
.card{margin:22px 0 0;background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 1px 2px rgba(0,0,0,.04)}
.sec-head{padding:18px 22px 4px}
.sec-head h2{font-size:17px;font-weight:700;margin:0;display:flex;align-items:center;gap:10px}
.sec-head .cnt{color:var(--muted);font-weight:600;font-size:13px}
.sec-head .sub{color:var(--muted);font-size:12.5px;margin:4px 0 0}
.tag{font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:6px}
.tag-new{background:var(--ink);color:#fff}
.tag-ret{background:#fff;color:var(--amber-ink);border:1px solid var(--amber-line)}
.divider{height:1px;background:var(--border);margin:12px 0 0}
.row{position:relative;display:grid;grid-template-columns:44px 1fr auto;gap:14px;align-items:center;padding:14px 22px;cursor:pointer;border-bottom:1px solid var(--border)}
.row:hover{background:var(--soft)}
.ava{width:40px;height:40px;border-radius:10px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px}
.rk{position:absolute;left:6px;top:8px;width:18px;height:18px;border-radius:50%;font-size:10.5px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center;background:var(--muted)}
.rk.g{background:#f99c00}.rk.s{background:#9ca3af}.rk.b{background:#b45309}
.nm{font-weight:700;font-size:15px;color:var(--ink)}
.nm:hover{color:var(--accent-deep)}
.ds{color:var(--body);font-size:13px;margin:2px 0 0;max-width:460px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.meta{display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap}
.dot{width:9px;height:9px;border-radius:50%}
.lang{font-size:12px;color:var(--body)}
.pill{font-size:11px;color:var(--body);border:1px solid var(--border);border-radius:999px;padding:1px 9px}
.badge-new{font-size:10px;font-weight:800;letter-spacing:.05em;background:var(--ink);color:#fff;border-radius:6px;padding:2px 7px}
.badge-ret{font-size:10px;font-weight:800;letter-spacing:.05em;color:var(--amber-ink);border:1px solid var(--amber-line);border-radius:6px;padding:2px 7px;background:var(--amber-bg)}
.badge-pres{font-size:10px;font-weight:700;letter-spacing:.03em;color:var(--accent-deep);border:1px solid #e3d4ff;border-radius:6px;padding:2px 7px;background:var(--accent-soft)}
.nums{text-align:right}
.nums .gain{font-size:15px;font-weight:800;color:var(--gain);font-variant-numeric:tabular-nums;white-space:nowrap}
.nums .glabel{font-size:11px;color:var(--muted);margin-top:1px}
.nums .total{font-size:12px;color:var(--body);font-variant-numeric:tabular-nums;margin-top:3px;white-space:nowrap}
.more>summary{list-style:none;cursor:pointer;text-align:center;padding:12px;color:var(--body);font-size:13px;font-weight:600}
.more>summary:hover{color:var(--accent-deep)}
.more[open]>summary{border-bottom:1px solid var(--border)}
.empty{margin:8px 22px 18px;padding:16px;border:1px dashed var(--border-strong);border-radius:var(--radius-sm);color:var(--muted);font-size:13px}
.detail{background:var(--soft);border-top:1px solid var(--border);padding:16px 22px 18px;display:none}
.detail.open{display:block}
.dgrid{display:grid;grid-template-columns:1fr 236px;gap:18px}
.note{display:grid;gap:7px}
.note .f{font-size:13px;color:var(--body)}
.note .f b{display:inline-block;min-width:64px;color:var(--ink);font-weight:700;margin-right:8px}
.kv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 12px;margin:12px 0 0}
.kv div{font-size:11px;color:var(--muted)}
.kv b{display:block;font-size:13px;color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
.rd{margin-top:12px;font-family:var(--mono);font-size:11.5px;color:var(--body);background:#fff;border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;max-height:170px;overflow:auto;white-space:pre-wrap}
.rd summary{cursor:pointer;color:var(--muted);font-family:var(--font);font-size:12px;list-style:none}
.sparknote{font-size:10.5px;color:var(--muted);margin-top:6px}
footer{max-width:800px;margin:26px auto 0;padding:0 20px;color:var(--muted);font-size:11.5px}
@media (max-width:640px){
  .row{grid-template-columns:36px 1fr auto;padding:12px 14px}
  .ava{width:32px;height:32px;font-size:14px}
  .ds,.nums .total{display:none}
  .dgrid{grid-template-columns:1fr}
  .kv{grid-template-columns:repeat(2,1fr)}
  .hero h1{font-size:21px}
}
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  <span class="brand"><span class="logo">T</span>GitHub Trending 周报</span>
  <span style="display:flex;gap:10px;align-items:center">
    <select><option>${DATA.week}（最新）</option><option>2026-W35</option></select>
    <span class="win">窗口 08-25 – ${DATA.capturedAt} · 按 7 日 ★ 增量</span>
  </span>
</div></div>

<div class="main">
<div class="hero">
  <h1>本周爆发榜 <span style="color:var(--muted);font-weight:600">${DATA.week}</span></h1>
  <p class="desc">新晋一眼可见：爆发、复活的进榜首；连续在榜的收进折叠。每个仓库四字段实锤注释：定位 · 为什么爆 · 可信度 · 生态位竞品。</p>
  <div class="tldr">${DATA.tldr.map(p => "<p>" + p + "</p>").join("")}</div>
</div>
<div class="stale">⚠ <span><b>分析待重跑</b> —— ${DATA.staleNote}</span></div>
<div id="app"></div>
</div>

<footer>自写 CSS 复刻 trendshift.io 视觉 token（violet #8d54ff / emerald #00bb7f / zinc / Instrument Sans 栈，字体未内嵌、回落系统栈）；头像为名字哈希色块（非 GitHub 头像，离线零依赖）。结构沿用访谈锁定：三段版面 · 四字段注释 · sparkline · 在场徽章 · stale 咬合 · ≤640px 降级。</footer>

<script>
const DATA = ${JSON.stringify(DATA)};
const NOTES = ${JSON.stringify(NOTES)};
const fmt = n => n.toLocaleString("en-US");
const kfmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\\.0$/, "") + "k" : String(n);
const app = document.getElementById("app");

function sparkline(pts) {
  if (!pts || pts.length < 2) return '<div class="sparknote">轨迹：仅 ' + (pts ? pts.length : 0) + ' 个快照（跨周积累中）</div>';
  const w = 220, h = 44, p = 4;
  const ys = pts.map(q => q[2]), max = Math.max(...ys), min = Math.min(...ys);
  const X = i => p + i * (w - 2 * p) / (pts.length - 1);
  const Y = v => h - p - (v - min) / (max - min || 1) * (h - 2 * p);
  const d = pts.map((q, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(q[2]).toFixed(1)).join("");
  return '<svg width="' + w + '" height="' + h + '" style="display:block"><path d="' + d + 'L' + X(pts.length - 1) + ',' + h + 'L' + X(0) + ',' + h + 'Z" fill="rgba(0,187,127,.10)"/><path d="' + d + '" fill="none" stroke="#00bb7f" stroke-width="2" stroke-linecap="round"/></svg>'
    + '<div class="sparknote">总★ 轨迹 ' + pts.map(q => q[0].slice(5)).join(" → ") + '</div>';
}

function row(r) {
  const medal = r.rank === 1 ? "g" : r.rank === 2 ? "s" : r.rank === 3 ? "b" : "";
  const badge = r.status === "new" ? '<span class="badge-new">NEW THIS WEEK</span>'
    : '<span class="badge-ret">BACK ON TRENDING</span>';
  const pres = r.pres ? '<span class="badge-pres">ON TRENDING ' + r.pres.days + 'D · BEST #' + r.pres.best + '</span>' : "";
  const topics = (r.topics || []).map(t => '<span class="pill">#' + t + '</span>').join("");
  return '<div class="row" data-r="' + r.rank + '">'
    + (medal ? '<span class="rk ' + medal + '">' + r.rank + '</span>' : '<span class="rk" style="background:#e4e4e7;color:#52525c">' + r.rank + '</span>')
    + '<div class="ava" style="background:' + r.avaColor + '">' + r.name.split("/")[1][0].toUpperCase() + '</div>'
    + '<div style="min-width:0"><a class="nm" href="' + r.url + '" target="_blank">' + r.name + '</a>'
    + '<p class="ds">' + (r.desc || "") + '</p>'
    + '<div class="meta">' + badge + pres + '<span class="dot" style="background:' + r.langColor + '"></span><span class="lang">' + (r.lang || "—") + '</span>' + topics + '</div></div>'
    + '<div class="nums"><div class="gain">+' + fmt(r.sw) + '</div><div class="glabel">Gained this week</div><div class="total">★ ' + kfmt(r.st) + ' · ⑂ ' + kfmt(r.forks) + '</div></div>'
    + '</div>'
    + card(r);
}

function card(r) {
  const n = NOTES[r.name];
  const note = n
    ? ['positioning|定位', 'whyNow|为什么爆', 'trust|可信度', 'niche|生态位'].map(p => {
        const [k, lab] = p.split("|");
        return '<div class="f"><b>' + lab + '</b>' + n[k] + '</div>';
      }).join("")
    : '<div class="f" style="color:var(--muted)">四字段注释（定位 / 为什么爆 / 可信度 / 生态位竞品）——由扩展信源管线生成后落位于此</div>';
  return '<div class="detail" id="d-' + r.rank + '"><div class="dgrid"><div>'
    + '<div class="note">' + note + '</div>'
    + '<div class="kv"><div>总★<b>' + fmt(r.st) + '</b></div><div>周增<b>+' + fmt(r.sw) + '</b></div><div>forks<b>' + fmt(r.forks) + '</b></div>'
    + '<div>open issues<b>' + r.issues + '</b></div><div>建仓<b>' + r.created + '</b></div><div>最近推送<b>' + r.pushed + '</b></div></div>'
    + '<details class="rd"><summary>README 摘录（原始自述——仅作注释层的对照面）</summary>' + (r.readme || "（无）").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])) + '</details>'
    + '</div><div>' + sparkline(r.hist) + '<div class="sparknote">' + DATA.presenceNote + '</div></div></div></div>';
}

function section(title, tag, sub, list, foldAt) {
  if (!list.length) return '<div class="card"><div class="sec-head"><h2>' + title + ' <span class="cnt">0</span></h2><p class="sub">' + sub + '</p></div><div class="empty">本段本周为空——首个 live 周之后，连续在榜的仓库会出现在这里；启用前的在场历史由 backfill 徽章补充。</div></div>';
  const head = foldAt ? list.slice(0, foldAt) : list, tail = foldAt ? list.slice(foldAt) : [];
  let h = '<div class="card"><div class="sec-head"><h2>' + title + ' <span class="cnt">' + list.length + '</span>'
    + (tag === "new" ? ' <span class="tag tag-new">NEW</span>' : tag === "ret" ? ' <span class="tag tag-ret">BACK</span>' : "")
    + '</h2><p class="sub">' + sub + '</p></div><div class="divider"></div>';
  h += head.map(row).join("");
  if (tail.length) h += '<details class="more"><summary>Show ' + tail.length + ' more</summary>' + tail.map(row).join("") + '</details>';
  return h + '</div>';
}

const news = DATA.repos.filter(r => r.status === "new").sort((a, b) => a.rank - b.rank);
const rets = DATA.repos.filter(r => r.status === "returning").sort((a, b) => a.rank - b.rank);
const recs = DATA.repos.filter(r => r.status === "recurring");
app.innerHTML =
  section("新晋", "new", "本周首次登上 weekly 榜（对照 backfill 在场历史判定）", news, 10)
  + section("回锅", "ret", "曾上榜、掉出后本周回归——老项目复活信号", rets, 0)
  + section("常驻", "", "连续在榜", recs, 0);

app.addEventListener("click", e => {
  const row = e.target.closest(".row"); if (!row) return;
  if (e.target.closest("a")) return;
  document.getElementById("d-" + row.dataset.r).classList.toggle("open");
});
</script>
</body>
</html>`;

writeFileSync(new URL("./v2-mock.html", import.meta.url), html);
console.log("written v2-mock.html", (html.length / 1024).toFixed(1) + "KB");
