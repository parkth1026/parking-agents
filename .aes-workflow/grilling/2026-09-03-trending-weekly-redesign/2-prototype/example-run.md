# 可执行示例: 改版后的一次完整周跑（确认版）

**确认版·锁定（2026-09-03T19:20:00+08:00）。** 报文结构见 api-mock.md，本文只写「怎么用、看到什么」。

## 场景 1：每周例行全流程（改后）

```console
$ node scripts/fetch-trending.mjs --workspace D:\GIT_dev\github-trading
抓取 https://github.com/trending?since=weekly …
OK  2026-W37  20 个仓库  →  …\data\weeks\2026-W37.json
第 1 名: <owner/repo>  本周 +NNNNN  总 NNNNN

$ node scripts/enrich-repos.mjs --workspace D:\GIT_dev\github-trading
ok  #1  tt-a1i/archify (+readme +tree +contrib +commit +release)     ← 变化：信源标记 1→5
ok  #2  anthropics/claude-plugins-community (+readme +tree +commit)  ← 变化：单信源缺失不整仓失败
…（20 行，每仓耗时约为现在 2.5 倍）

$ node scripts/update-history.mjs --workspace D:\GIT_dev\github-trading
OK  分类: 新晋 15 · 常驻 3 · 回锅 2 · 历史 N 周                        ← 变化：重分类时追加：
WARN 2026-W36 analysis 已标 stale（entry_status 集合变化：archify new→returning）

$ node scripts/validate-week.mjs --workspace … 2026-W37 --full
OK  trending-week/1 · repo-history/1 · 咬合通过                        ← 变化：认得新可选字段

# （LLM 环节：读周 JSON 写 analysis.md——四字段口径：定位 2-4 句 /
#   为什么爆=因果挂证据 / 可信度 / 生态位=nicheTags 受控词表+同类差异；
#   数据门禁不过则此步跳过，报告照常出——不变）

$ node scripts/build-report.mjs --workspace D:\GIT_dev\github-trading
OK  7 周（含分析 2）  →  …\report\data.js
    viewer: …\report\index.html（双击打开，离线可用；或跑 serve.mjs 走 http）
← 变化：data.js 增 note/presence/accel/coreImg/staleAt；accel 由 repo-history 计算；行尾图 URL 在此解析

$ node scripts/serve.mjs
LISTENING port=8788
GitHub Trending 周报后端  http://127.0.0.1:8788/
```

## 场景 2：必须逐字节一样能跑的既有用法

```console
$ node run-tests.mjs
（T1–T10 全绿，退出码 0 —— 晋级门禁依赖此语义；新增断言只增不减）
```

- 双击 `report/index.html`：离线打开、零控制台报错、数据完整渲染（AC-6；行尾图离线回落首字母色块——B7）。
- `curl http://127.0.0.1:8788/api/weeks`：报文与改前一致（D2）。

## 场景 3：只看本周（最短路径，用户真实日常）

双击 `report/index.html` → TLDR 首行 10 秒抓最猛 → 扫 20 行（徽章+SURGE+行尾大图）→ 点行读定位详解与生态位 → 关闭。
