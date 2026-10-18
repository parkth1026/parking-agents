# 使用面逐条实测记录（v1.115.0 · 2026-08-29）

执行环境：Windows 10，glab v1.115.0（`C:\Users\Administrator\AppData\Local\Programs\glab\glab.exe`），
克隆目录 `D:\GIT_dev\AesMetaTool`（git.51vr.local · neon/TWE/AesMetaTool · 15.0.5-EE 免费档），
全部只读探测，未向实例写入任何内容。裁决口径：可用=命令范式入 SKILL.md 使用面节；
不可用/怪癖=裁决记录；未实测=不写。

## 通用怪癖（所有组前置）

| 命令 | 输出摘要 | 裁决 |
| --- | --- | --- |
| `glab snippet list` | 打印 `glab snippet` 父命令帮助文本，**退出码 0** | 子命令不存在时静默退回帮助且成功退出——入节为头号坑 |
| `glab search issues "CUDA"` | 打印 `glab search` 帮助文本，**退出码 0** | 同上，第二实证 |

## B 组 label/milestone（Q3 选中，优先）

| 命令 | 输出摘要 | 裁决 |
| --- | --- | --- |
| `glab label list` | `Showing label 7 of 7`，表格列出 needs-triage 等 7 条真实 label | ✓ 可用，入节 |
| `glab milestone list`（裸跑） | `ERROR: At least one of the flags in the group [project group] is required` | 怪癖入节：克隆内也必须 `--project OWNER/REPO` 或 `--group` |
| `glab milestone list --project neon/TWE/AesMetaTool` | `No milestones found.`（命令正常执行） | ✓ 加参数后可用，入节；help 确认支持 `--output json` |

## C 组 release/pipeline（Q3 选中，优先）

| 命令 | 输出摘要 | 裁决 |
| --- | --- | --- |
| `glab release list` | `No releases available` + 空表头（命令形态正确） | ✓ 可用，入节 |
| `glab pipeline list` | `No pipelines available` | ✓ 可用，入节 |
| `glab ci status` | `✘ no pipeline found for branch dev-twe-ci and failed to find associated merge request` + ERROR | 怪癖入节：分支无 pipeline 且无 MR 时报错，先 list 后 status |

## D 组 snippet/多账号/api（Q3 选中，优先）

| 命令 | 输出摘要 | 裁决 |
| --- | --- | --- |
| `glab snippet -h` | COMMANDS 仅 `create` 一条 | 裁决入节：v1.115 无 list 子命令 |
| `glab api snippets` | `[]`，退出码 0 | ✓ 项目级列表走 API，入节 |
| `glab api personal_snippets` | `{"error":"404 Not Found"}`，退出码 1 | 裁决入节：该端点 15.0.5 不可用 |
| `glab api "projects/neon%2FTWE%2FAesMetaTool/labels?per_page=3"` | 完整 JSON 数组（needs-triage 等 3 条） | ✓ api 回退可用；URL 编码路径入节 |
| `glab api --help` | 含 `--paginate`（`Make additional HTTP requests to fetch all pages`）与 `--output ndjson` | ✓ 与 gh 同名同义，入节 |
| 多账号（证据=配置结构） | config.yml `hosts:` 每主机单 `user` 单令牌；keyring 同构 | 裁决入节：同 host 多账号不支持，临时换身份用 `GITLAB_TOKEN` 覆盖 |

## A 组 search（Q3 未选，最小条目）

| 命令 | 输出摘要 | 裁决 |
| --- | --- | --- |
| `glab search -h` | COMMANDS 仅 `semantic`（beta，AI 代码搜索，付费面）；help 明示 beta 警告 | 裁决入节：无全局 issue/MR 搜索子命令 |
| `glab api "search?scope=issues&search=CUDA"` | JSON 数组，命中 issue #20「发布包 CUDA 后端…」 | ✓ REST 退路可用，入节 |

## A 组补测：/search 中文关键词 500（2026-09-14 · 升级回归会话）

执行环境：Windows 10，glab v1.113.0，双实例对照——升级测试实例 `10.100.20.59`
（19.3.2-ee，项目 neon/ueb id 2283，`GITLAB_HOST` 显式指定）与既有实例
`git.51vr.local`（15.0.5-ee，同项目同 id）。以下均为只读查询。

| 命令 | 输出摘要 | 裁决 |
| --- | --- | --- |
| `glab api "search?scope=issues&search=生命周期"`（新实例） | `{"message":"500 Internal Server Error"}`，两次复现稳定 | 中文关键词 × `/search` = 500，硬约束入节 |
| `glab api "search?scope=projects&search=升级"`（旧实例对照） | 同样 500 | 15.0.5 已存在——非升级回归，双实例共有既有缺陷 |
| `glab api "projects/2283/search?scope=blobs&search=构建"`（新实例） | 500；wiki_blobs / commits / merge_requests 各 scope 同 | 故障面 = 所有 scope，全局与项目级同 |
| `glab api "search?scope=issues&search=upgrade"`（新实例） | JSON 数组正常返回（命中其它项目真实 issue） | ASCII 关键词一切正常 |
| `glab issue list --all --search "生命周期"`（新实例，克隆内） | 命中 issue #1「[升级测试] Issue 生命周期验证」 | 列表端点 LIKE 匹配中文可用，入节为仓库内替代路径 |
| 附带现象：`glab api "search?scope=issues&search=GitLab 升级"` | 代理层 400 Bad Request | glab 不自动 URL 编码空格，调用侧自行编码 |

根因定位（判断）：中文数据无损——中文标题 issue、中文 commit message、中文文件内容的
写入/展示/clone 全部正常，故障仅在搜索链路对多字节查询词的处理；服务端修复属实例级运维项，
技能侧对策 = ASCII 关键词 / 仓库内 list 搜索 / label 过滤。

## 断言升级复盘（iteration-2 后提出 · iteration-3 已落地 · 2026-08-30）

**已落地 1（评分器收编）**：六条断言评分器收编为技能自带脚本
`grade-install-guide.mjs`（技能目录根部，参数化：传 eval 目录判全部 gate，传 run 目录判单臂；
产出聚合器口径 grading.json）。iteration-3 起直接复用，不再每次重写。

**已落地 2（题面去泄露，iteration-3 实证）**：题面删去「http:// 前缀 + 纯 http/443 不服务提示」，
断言 3（双协议参数）区分度恢复：

| gate | 基线六断言 | 耗时 | tokens |
| --- | --- | --- | --- |
| with_skill | 6/6 + **附加检查 2/2**（PATH 兜底、噪音块说明均命中） | 108s | 98.8k |
| old_skill | 6/6（旧认证节本就携带双协议知识） | 259s | 169.2k |
| without_skill | **5/6——挂的正是断言 3**（登录命令有 --hostname 无双协议，默认 https 思维） | 436s | 215.2k |

结论：技能的不可替代价值 = 纯 http 双协议坑 + agent PATH 兜底 + 噪音块事实；
效率收益稳定（快 3~4×、省 2×+ tokens）。题面变更经用户 2026-08-30 授权，
跨轮题面史由 git 记录；history 现共 4 条 run。

## 2026-10-14 登录故障排查 + 升级 19.4.1 后全链路回归（glab 1.113.0 → 1.123.0）

背景：服务端 git.51vr.local 已从 15.0.5 升级到 19.4.1-ee（`glab api version` 实测），
DNS 解析 10.66.12.253。用户报告「glab 登录有问题」。根因不是登录，是 config 里
残留的升级测试实例 10.100.20.59（19.3.2-ee，即 2026-09-14 A 组补测用的那台）整机
不可达，把 `glab auth status` 拖成全局认证失败。

| 命令 / 操作 | 输出摘要 | 裁决 |
| --- | --- | --- |
| `glab auth status`（裸跑） | 只显示 git.51vr.local，✓ keyring 登录，rc=0 | 噪音块「永远多一段红 401」描述过时，改正文 |
| `glab auth status --hostname 10.100.20.59` | `API call failed: context deadline exceeded` + `X could not authenticate to one or more...` | 多 host 残留是真实故障模式，故障表加行 |
| `ping 10.100.20.59` / `curl http、https` | 100% 丢包；80/443 双超时（exit 28） | 主机级不可达，非认证问题 |
| `glab api user / version / metadata` | 用户 piaotonghu active；19.4.1-ee | 服务端版本事实更新入正文 |
| `glab api "namespaces/neon"` | `"plan":"default"` | 免费档判断在 19.4.1 上复核成立 |
| `glab repo view <路径/2449/GITLAB_HOST 强制>` | 三种方式均 `404 Not Found`（1.113 与 1.123 双测） | 怪癖节新增：用 `glab api projects/<id>` 替代 |
| `glab ci status` | rc=1 但输出真实 pipeline #10248（verify failed，52m15s） | 怪癖节新增：退出码反映 pipeline 状态 |
| `glab auth status -t` 提取令牌 → curl REST / GraphQL | REST `401 Unauthorized`；GraphQL `{"errors":[{"message":"Invalid token"}]}`（双版本复现） | `-t` 配方证伪，正文删除并改为警告 |
| curl 直探 `/api/graphql`（无令牌 POST） | `{"data":{"currentUser":null}}` 合法结构 | GraphQL 端点本身健康 |
| `git credential fill`（git:http:// 条目） | 密码 10 字符——是账号密码不是 PAT | git 凭据与 glab 令牌是两条独立链路，红线依据 |
| cmdkey 第一轮批量删 46 条 | 46 次 "deleted successfully"，删后清单 46 条全在 | **假成功坑实证**：CRLF 名字 + 不存在目标也报成功，入正文 |
| cmdkey `tr -d '\r'` 清洗后重删 | 删后清单仅剩 `glab:git.51vr.local:token:`，0 残留 | 验收只认删后计数 |
| 清理后回归（auth/api user/issue/mr/pipeline/label/milestone/git fetch ×3 轮） | 20+ 项全过，延迟 310–350ms | 清理零副作用 |
| `winget upgrade GLab.GLab`（1.113→1.123） | keyring 1 条、config hosts、登录状态全部无损；回归 7/7 | 升级保留凭据实测；版本参考更新 |
| `glab auth status --output json`（1.123） | `{"hosts":[{...,"token_source":"keyring",...}]}` | 脚本化检查新范式入怪癖节 |
| gitlab.com release notes v1.114–v1.123 逐版核对（REST API 取） | 无任何 GitLab 19.x 服务端兼容修复、无 repo view/404 修复 | 「无版本配套关系」结论的证据，入正文头部 |

处置留痕：config.yml 备份 `config.yml.bak-20261014`；删除清单留档
`deleted-credentials-20261014.txt`；SKILL.md 备份 `SKILL.md.bak-20261018`（本次修订）。
