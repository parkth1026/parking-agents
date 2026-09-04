// 一次性生成器 v3：对 trendshift.io/weekly 核心列表 1:1 复刻（规格来自实测计算样式，2026-09-03）
// 实测规格：行 flex pad 24/16 · 分隔线 #DADCE7 · 名 16px/500 rgba(23,23,23,.8) · 描述 14px #5C5E70
//   数字 14px/500 #171717 + label 12px #5C5E70@70% · New 徽章 10px/600/uppercase/.25px #6670CC
//   pill 12px #5C5E70 pad 4/8 r6 · H1 24px/600 #171717 · tab r8 靛紫10%底
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

const LANG = { JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Rust: "#dea584", Go: "#00ADD8", "C++": "#f34b7d", Shell: "#89e051", HTML: "#e34c26", Vue: "#41b883", MDX: "#fcb32c" };
const DATA = {
  week: week.week, capturedAt: week.captured_at.slice(0, 10),
  tldr,
  staleNote: "分析写于回填导入前（当时分类：新晋 20 · 回锅 0）——重分类后 rank1 archify 等已变回锅，分析文字待重跑",
  presenceNote: "在场数据来自 backfill（W31–W35 全球日榜聚合），非官方 weekly 口径",
  repos: week.repos.map(r => ({
    rank: r.rank, name: r.full_name, url: r.url, desc: r.description || "",
    lang: r.language, langColor: LANG[r.language] || "#a1a1aa",
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
    trust: "建仓 2025-11 · license MIT · 活跃推送 2026-09-01（可信度/生态位待扩展信源管线生成，此为口径样例）",
    niche: "生态位：Agent 技能工程化；同类：anthropics/skills、superpowers 类技能集合；差异点主打 verifiable 产出",
  },
};

const html = `<!doctype html>
<!-- draft v3 | published 2026-09-03T12:40:00+08:00
     用户意见：把 trendshift 核心 1:1 抄下来（实时页面 DOM 实测）
     状态：current —— 规格全部来自对 trendshift.io/weekly 的计算样式实测（行/名/描述/数字/徽章/pill/H1/tab） -->
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
.stale{display:flex;gap:8px;align-items:flex-start;margin:16px 0 0;padding:10px 14px;background:var(--amber-bg);border:1px solid var(--amber-line);color:var(--amber-ink);border-radius:var(--r);font-size:13px}
.listwrap{margin:20px 0 0;border:1px solid var(--divider);border-radius:var(--r-lg)}
.group{padding:10px 16px 4px}
.group h2{font-size:11px;font-weight:600;letter-spacing:.25px;text-transform:uppercase;color:var(--body);margin:8px 0 0;display:flex;gap:8px;align-items:baseline}
.group h2 .cnt{color:var(--zinc70);font-weight:400}
.group .sub{color:var(--zinc70);font-size:12.5px;margin:2px 0 6px}
.row{display:flex;gap:6px;padding:24px 16px;border-bottom:1px solid var(--divider);cursor:pointer;align-items:flex-start}
.row:hover{background:#fafafa}
.rk{flex:0 0 32px;display:flex;justify-content:flex-start;padding-top:2px}
.rk .medal{width:24px;height:24px;border-radius:50%;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
.rk .medal.g{background:#f99c00}.rk .medal.s{background:#9ca3af}.rk .medal.b{background:#b45309}
.rk .plain{color:var(--zinc70);font-size:12px;font-weight:600;padding:5px 0 0 8px}
.rk .spacer{width:32px}
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
.more>summary{list-style:none;cursor:pointer;text-align:center;padding:12px;color:var(--body);font-size:13px;font-weight:600;border-top:1px solid var(--divider)}
.more>summary:hover{color:var(--indigo)}
.detail{border-top:1px solid var(--divider);padding:16px;display:none}
.detail.open{display:block}
.dgrid{display:grid;grid-template-columns:1fr 236px;gap:18px}
.note{display:grid;gap:7px}
.note .f{font-size:13.5px;color:var(--body)}
.note .f b{display:inline-block;min-width:60px;color:var(--ink);font-weight:600;margin-right:8px}
.kv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 12px;margin:12px 0 0}
.kv div{font-size:11px;color:var(--zinc70)}
.kv b{display:block;font-size:13px;color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.rd{margin-top:12px;background:#fafafa;border:1px solid var(--divider);border-radius:6px;padding:10px 12px}
.rd summary{cursor:pointer;color:var(--body);font-size:12px;list-style:none}
.rd pre{margin:8px 0 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:var(--body);max-height:160px;overflow:auto;white-space:pre-wrap}
.sparknote{font-size:10.5px;color:var(--zinc70);margin-top:6px}
footer{max-width:832px;margin:26px auto 0;padding:0 16px;color:var(--zinc70);font-size:11.5px}
@media (max-width:640px){
  .row{padding:16px 12px}
  .rdesc,.nums .pair span.fk{display:none}
  .dgrid{grid-template-columns:1fr}
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
  <p class="desc">本周爆发仓库，按 7 日 star 增量排序。新晋一眼可见；每个仓库附四字段实锤注释（定位 · 为什么爆 · 可信度 · 生态位竞品）。</p>
  <div class="tldr">${DATA.tldr.map(p => "<p>" + p + "</p>").join("")}</div>
</div>
<div class="stale">⚠ <span><b>分析待重跑</b> —— ${DATA.staleNote}</span></div>
<div id="app"></div>
</div>

<footer>对 trendshift.io/weekly 核心 1:1（DOM 实测规格 2026-09-03）：行 pad 24/16 · 分隔线 #DADCE7 · 名 16px/500 · 描述 14px #5C5E70 · 数字 14px/500 + Gained this week 12px · New 徽章 10px/600/uppercase #6670CC · pill 12px r6 · H1 24px/600。差异：猫头鹰→名次圆牌（图片素材离线不可用）；Like/Bookmark/Mentioned-on 无数据不渲染；★ 数字=总量（语义诚实），精确增量在 Gained 标签；字体未内嵌走系统回落。</footer>

<script>
const DATA = ${JSON.stringify(DATA)};
const NOTES = ${JSON.stringify(NOTES)};
const fmt = n => n.toLocaleString("en-US");
const kfmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\\.0$/, "") + "k" : String(n);
const ICONS = {
  star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/></svg>',
  fork: '<svg viewBox="0 0 24 24"><circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="5" r="2.2"/><circle cx="12" cy="19" r="2.2"/><path d="M6 7.2v2a4 4 0 004 4h4a4 4 0 004-4v-2M12 13.2v3.6"/></svg>'
};
const app = document.getElementById("app");

function sparkline(pts) {
  if (!pts || pts.length < 2) return '<div class="sparknote">轨迹：仅 ' + (pts ? pts.length : 0) + ' 个快照（跨周积累中）</div>';
  const w = 220, h = 44, p = 4;
  const ys = pts.map(q => q[2]), max = Math.max(...ys), min = Math.min(...ys);
  const X = i => p + i * (w - 2 * p) / (pts.length - 1);
  const Y = v => h - p - (v - min) / (max - min || 1) * (h - 2 * p);
  const d = pts.map((q, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(q[2]).toFixed(1)).join("");
  return '<svg width="' + w + '" height="' + h + '" style="display:block"><path d="' + d + 'L' + X(pts.length - 1) + ',' + h + 'L' + X(0) + ',' + h + 'Z" fill="rgba(102,112,204,.10)"/><path d="' + d + '" fill="none" stroke="#6670cc" stroke-width="2" stroke-linecap="round"/></svg>'
    + '<div class="sparknote">总★ 轨迹 ' + pts.map(q => q[0].slice(5)).join(" → ") + '</div>';
}

function row(r, prevRank) {
  const medal = r.rank === 1 ? "g" : r.rank === 2 ? "s" : r.rank === 3 ? "b" : "";
  const rk = medal
    ? '<span class="medal ' + medal + '">' + r.rank + '</span>'
    : (prevRank && prevRank <= 3 ? '<span class="plain"></span>' : '<span class="plain">' + r.rank + '</span>');
  const bdg = r.status === "new" ? '<span class="bdg">New this week</span>' : '<span class="bdg z">Back on trending</span>';
  const pres = r.pres ? '<span class="bdg">On trending ' + r.pres.days + 'D · Best #' + r.pres.best + '</span>' : "";
  const topics = (r.topics || []).map(t => '<span class="tpill"><span class="h">#</span>' + t + '</span>').join("");
  return '<div class="row" data-r="' + r.rank + '">'
    + '<div class="rk">' + rk + '</div>'
    + '<div class="rmain"><div class="rhead"><a class="nm" href="' + r.url + '" target="_blank">' + r.name + '</a>'
    + '<div class="nums"><div class="pair"><span>' + ICONS.star + kfmt(r.st) + '</span><span class="fk">' + ICONS.fork + kfmt(r.forks) + '</span></div>'
    + '<div class="glabel">+' + fmt(r.sw) + ' Gained this week</div></div></div>'
    + '<div class="badges">' + bdg + pres + '</div>'
    + '<p class="rdesc">' + (r.desc || "") + '</p>'
    + '<div class="rfoot"><span class="lang"><span class="dot" style="background:' + r.langColor + '"></span>' + (r.lang || "—") + '</span>' + topics + '</div>'
    + '</div></div>'
    + card(r);
}

function card(r) {
  const n = NOTES[r.name];
  const note = n
    ? ["positioning|定位", "whyNow|为什么爆", "trust|可信度", "niche|生态位"].map(p => {
        const [k, lab] = p.split("|");
        return '<div class="f"><b>' + lab + '</b>' + n[k] + '</div>';
      }).join("")
    : '<div class="f" style="color:var(--zinc70)">四字段注释（定位 / 为什么爆 / 可信度 / 生态位竞品）——由扩展信源管线生成后落位于此</div>';
  return '<div class="detail" id="d-' + r.rank + '"><div class="dgrid"><div>'
    + '<div class="note">' + note + '</div>'
    + '<div class="kv"><div>总★<b>' + fmt(r.st) + '</b></div><div>周增<b>+' + fmt(r.sw) + '</b></div><div>forks<b>' + fmt(r.forks) + '</b></div>'
    + '<div>open issues<b>' + r.issues + '</b></div><div>建仓<b>' + r.created + '</b></div><div>最近推送<b>' + r.pushed + '</b></div></div>'
    + '<details class="rd"><summary>README 摘录（原始自述——仅作注释层的对照面）</summary><pre>' + (r.readme || "（无）").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])) + '</pre></details>'
    + '</div><div>' + sparkline(r.hist) + '<div class="sparknote">' + DATA.presenceNote + '</div></div></div></div>';
}

function section(title, sub, list, foldAt) {
  if (!list.length) return '<div class="group"><h2>' + title + ' <span class="cnt">0</span></h2><p class="sub">' + sub + '</p></div><div style="padding:4px 16px 18px;color:var(--zinc70);font-size:13px">本段本周为空——首个 live 周之后，连续在榜的仓库会出现在这里；启用前的在场历史由 backfill 徽章补充。</div>';
  const head = foldAt ? list.slice(0, foldAt) : list, tail = foldAt ? list.slice(foldAt) : [];
  let h = '<div class="group"><h2>' + title + ' <span class="cnt">' + list.length + '</span></h2><p class="sub">' + sub + '</p></div>';
  let prev = 0;
  h += head.map(r => { const s = row(r, prev); prev = r.rank; return s; }).join("");
  if (tail.length) h += '<details class="more"><summary>Show ' + tail.length + ' more</summary>' + tail.map(r => { const s = row(r, prev); prev = r.rank; return s; }).join("") + '</details>';
  return h;
}

const news = DATA.repos.filter(r => r.status === "new").sort((a, b) => a.rank - b.rank);
const rets = DATA.repos.filter(r => r.status === "returning").sort((a, b) => a.rank - b.rank);
const recs = DATA.repos.filter(r => r.status === "recurring");
app.innerHTML = '<div class="listwrap">'
  + section("New this week · 新晋", "本周首次登上 weekly 榜（对照 backfill 在场历史判定）", news, 10)
  + section("Back on trending · 回锅", "曾上榜、掉出后本周回归——老项目复活信号", rets, 0)
  + section("Staying on · 常驻", "连续在榜", recs, 0)
  + '</div>';

app.addEventListener("click", e => {
  const row = e.target.closest(".row"); if (!row) return;
  if (e.target.closest("a")) return;
  document.getElementById("d-" + row.dataset.r).classList.toggle("open");
});
</script>
</body>
</html>`;

writeFileSync(new URL("./v3-mock.html", import.meta.url), html);
console.log("written v3-mock.html", (html.length / 1024).toFixed(1) + "KB");
