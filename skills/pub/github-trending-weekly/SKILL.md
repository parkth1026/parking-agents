---
name: github-trending-weekly
description: 每周采集 GitHub Trending（weekly 榜 top 20）生成可积累的周报：脚本抓取榜单、gh api 富化仓库元数据与 README、JSON 结构校验、累计星数历史、新晋/常驻/回锅分类、双击可开的 HTML 周报（含全部历史周）。用户说「跑一下本周 GitHub 周报 / 更新 trending 数据 / 出周报 / 看看本周新晋了什么项目」或定时任务要求执行本技能时使用；数据不依赖 LLM，分析文字在数据校验通过后生成。
---

# GitHub Trending 周报

把 GitHub Trending 周榜变成可积累的资产。数据路径全部是确定性脚本（任何一步校验失败即停，绝不写坏数据），LLM 只负责两件事：写本周分析文字、写知识页。

## 前置条件

- Node ≥ 18（用到内置 fetch）
- `gh` 已登录（`gh auth status` 通过即可，公开仓库只读）
- workspace 已配置（见下节「配置」）；未配置时脚本会报三步引导并退出

## 配置

输出位置与服务参数走两层解析（`scripts/lib/config.mjs`），优先级从高到低：

1. **CLI 参数**：`--workspace` / `--port` / `--host`（本次调用显式覆盖）
2. **环境层**（真实值，不进任何 git 仓库）：`$SKILL_ENV`（指向文件则该文件即本域配置；指向目录则读 `<目录>/github-trending-weekly.json`）> `~/.config/parking-agents/github-trending-weekly.json`（一域一文件）
3. **技能内 `config.json`**：随仓库版本化，只放占位说明（本技能无固有默认项）

字段：`workspace`（必填，数据/报告落地目录，支持 `~/`）、`port`（缺省 8788）、`host`（缺省 127.0.0.1）。模板见 `config.example.json`。所有路径相对 workspace 解析，本技能文档不写死机器路径。

## 工作流（按序执行，每步退出码非 0 就停，不要跳步续跑）

设 `<S>` = 本技能 scripts 目录。workspace 由「配置」解析，命令不必传；需临时覆盖时加 `--workspace <dir>`。

### Step 1 采集榜单

```bash
node <S>/fetch-trending.mjs
```

抓 `github.com/trending?since=weekly`，解析 20 个仓库（rank / 全名 / 描述 / 语言 / 总星 / 周增星），结构校验不过则拒绝写入。产出 `data/weeks/<YYYY-Www>.json`。失败常见原因：限流（稍后重试）、页面改版（读「维护」节）。

### Step 2 富化仓库详情

```bash
node <S>/enrich-repos.mjs
```

逐仓库 `gh api` 补 topics、homepage、创建/推送时间、forks、license、README 摘要（前 2500 字符）。单仓库失败标 `api_ok:false` 继续；gh 不可用整体退出。

### Step 3 更新历史与分类

```bash
node <S>/update-history.mjs
```

累计每仓库历史 `data/repos/<owner>__<repo>.json`，分类 `new`（首次上榜）/ `recurring`（上周也在）/ `returning`（上过榜但上周不在），并算环比。幂等，重跑安全。

### Step 4 数据门禁

```bash
node <S>/validate-week.mjs --full
```

全量结构校验 + 周↔历史咬合检查。**不过不进 Step 5**。

### Step 5 写本周分析（LLM 环节）

读 `data/weeks/<YYYY-Www>.json`（重点看 `entry_status == "new"` 的仓库和 `stars_week` 排序），按 `references/analysis-guide.md` 的口径写 `data/weeks/<YYYY-Www>.analysis.md`。不写也能出报告，但每周例行时应当写。

### Step 6 重建报告

```bash
node <S>/build-report.mjs
```

汇总全部历史周生成 `report/data.js` + `report/index.html`（viewer 从 assets 拷贝，双击离线打开，分析文字内联）。告诉用户报告路径。

### Step 7 知识页（可选，每周例行时做）

按 `references/analysis-guide.md` 末尾的模板写 workspace 下的 `wiki/<YYYY-Www>.md`。

## 输出物一览

| 路径 | 内容 |
| --- | --- |
| `data/weeks/*.json` | 周快照（页面字段 + API 字段 + 分类） |
| `data/weeks/*.analysis.md` | 本周分析（LLM 写） |
| `data/repos/*.json` | 每仓库累计上榜历史 |
| `report/index.html` + `report/data.js` | 周报 viewer（全部历史周可切换） |
| `wiki/*.md` | 知识页 |

数据契约（字段、类型、枚举）见 `references/data-schema.md`。

## 本地后端（serve.mjs）

纯 HTML 双击可用，但要命令行访问或让 browser 工具打开时，起本地后端：

```bash
node <S>/serve.mjs [--port 8788]
```

workspace 与 port/host 同走「配置」（CLI > 环境层 > 缺省）。

- viewer：`http://127.0.0.1:8788/`（与双击 index.html 同一 viewer；`/data.js` 按请求实时生成，服务常开也能看到最新采集）
- `/backfill/` — workspace 的 `backfill/index.html`（缺周回填 presence 页，自包含，存在才挂载）
- JSON API（curl / agent 浏览器工具 / WebFetch 均可）：
  - `GET /api/weeks` — 全部周摘要（counts/top1/has_analysis）
  - `GET /api/weeks/:id` — 单周完整快照；`/api/weeks/:id/analysis` — 该周分析 markdown
  - `GET /api/repos` — 全部上榜仓库摘要；`GET /api/repos/:owner__repo` — 单仓库累计历史
  - `GET /api/latest` — 最近一周快照
- 只读、只绑 127.0.0.1，不对外。`--port 0` + `--portfile <f>` 供程序化取随机端口。
- **局域网共享**：加 `--host 0.0.0.0`，启动时枚举本机局域网 IPv4 并打印可直接分享的 URL。首次共享需放行防火墙（管理员）：
  `netsh advfirewall firewall add rule name="github-trending-weekly" dir=in action=allow protocol=TCP localport=8788 profile=domain,private`
  只读 API，暴露面仅为周报数据；不要把 profile 放宽到 public。

例行周报时可后台起服务；数据每次采集后无需重启。

## 常见失败与处理

- **fetch 报"页面不含 Box-row"或条数不符**：先用浏览器/curl 确认页面结构；若 GitHub 改版，更新 `scripts/lib/parse-html.mjs` 的正则并重新固化 `fixtures/trending-weekly.html`，跑 `node run-tests.mjs` 回归。
- **enrich 大面积 miss**：`gh api rate_limit` 查配额；限流则等待，已成功的字段保留。
- **validate --full 报历史不一致**：不要手改 JSON，重跑 Step 3（幂等）后再校验。
- **脚本报「未指定 workspace」**：CLI 与配置层都没给。按报错里的三步引导建 `~/.config/parking-agents/github-trending-weekly.json`，或本次传 `--workspace <dir>`；不要依赖当前目录。
- **重跑同一周**：Step 1-4 幂等，直接按序重跑即可（同周快照替换不重复）。

## 维护

解析锚点固化在 fixtures（真实 HTML 快照 + gh api 响应回放），`run-tests.mjs` 断言全部离线（含配置解析链回归）。改任何脚本后必跑：

```bash
node run-tests.mjs
```

设计依据与验收条件（AC-1..AC-8）见 `references/design.md`。
