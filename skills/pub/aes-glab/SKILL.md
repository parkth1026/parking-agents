---
name: aes-glab
description: 自建 GitLab（git.51vr.local，19.4.1-ee）的 glab 命令行全流程——winget 安装、PAT+钥匙串登录、token 失效/401/GITLAB_TOKEN 排查、多 host 残留与凭据管理器清理（cmdkey 假成功坑）、配置文件事实与命令怪癖，及 issue/MR/label/milestone/pipeline/api 操作范式。
---

# glab 全流程范式（安装·配置·使用）

目标实例 `git.51vr.local`（**GitLab 19.4.1-ee**，2026-10-14 确认从 15.0.5 升级而来；免费档不变——namespace plan=`default` 实测；纯 http——443 端口不服务）。本技能只服务此实例。**glab 与服务端无版本配套关系**：REST API v4 跨版本稳定（v1.114–v1.123 十版 release notes 无任何服务端兼容修复项；1.113 与 1.123 对 19.4.1 回归测试全过）——服务端升级不要求升 CLI。换实例时调整 hostname 与协议。伴生仓库文档（完整约定）：`D:\GIT\AntAgentWeb2-dev1\docs\agents\issue-tracker.md`。

## 安装（Windows 为主）

- 首选渠道（本机实测）：`winget install GLab.GLab`——落点 `C:\Users\<user>\AppData\Local\Programs\glab\glab.exe`；装完**新开终端**再跑 glab（PATH 新会话才生效）。
- 其他渠道（未实测，只列不展开）：scoop / choco / 官方 release zip。
- 判定装没装、装在哪：`glab --version`；找不到命令时查注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\*`（DisplayName 含 glab）的 InstallLocation，或 `winget list --id GLab.GLab`。
- **agent Git Bash 坑（实测）**：agent 会话里 `glab` 可能不在 PATH（`command not found`）而用户 PowerShell 正常——按上面的落点/注册表用全路径调 exe，不要据此判定「未安装」。
- 版本参考：v1.123.0（2026-10-14 实测；各怪癖条目自带验证版本标注，1.113 与 1.123 行为一致）。升级用 `winget upgrade GLab.GLab`——keyring 与 config 无损保留（实测），装完新开终端。

## 认证（先读这节）

定版做法：个人访问令牌（PAT）存进系统钥匙串（Windows 凭据管理器）——与 gh 等价的体验，机器配置里零环境变量。

- 一次性登录，令牌走标准输入、不进命令行历史：
  - Git Bash：`printf '%s' "$TOKEN" | glab auth login --hostname git.51vr.local --api-protocol http --git-protocol http --stdin`
  - PowerShell：`"令牌" | glab auth login --hostname git.51vr.local --api-protocol http --git-protocol http --stdin`
- 两个协议参数必须带：纯 http 实例上 glab 默认走 https，所有调用被拒。这是头号坑。
- 验证：`glab auth status` 应显示 `✓ Logged in to git.51vr.local as <用户> (keyring)`。Git Bash 里剥掉环境变量再验一次更硬：`env -u GITLAB_TOKEN -u GITLAB_HOST glab auth status`。
- 优先级：`GITLAB_TOKEN` 只在 agent 会话被注入（Windows 注册表与 shell 配置是干净的），存在时压过钥匙串。两者共存，命令行为无差别。
- 令牌住在 Windows 凭据管理器里，日常不要碰它；确需清理（残留 host、垃圾条目）时按「凭据管理器操作规范」节操作——那里有已实测的假成功坑。

## 配置事实（一次性配置）

- 配置文件位置（实测）：`C:\Users\<user>\AppData\Local\glab-cli\config.yml`——不是 Roaming、不是 `~/.config`。
- **gitlab.com 噪音块（行为已变化）**：glab 首次运行仍会在 `hosts:` 下写入 `gitlab.com` 默认模板块，`glab auth logout` 只删凭据不删该块。但 1.113/1.123 实测：config 设了默认 host（`host: git.51vr.local`）后，裸跑 `glab auth status` **只显示默认 host，不再渲染 gitlab.com 段**——旧观察「永远多一段红色 401/No token found」适用于未设默认 host 的场景（如 2026-08 / v1.115 时代）。要清则**先备份** config.yml，再删 `hosts:` 下整个 `gitlab.com:` 块，功能无损（已验证）。
- 令牌来源差异：agent 会话注入 `GITLAB_TOKEN` 时 auth status 显示 `(GITLAB_TOKEN)`，用户自己终端显示 `(keyring)`——两者等价，引导小白时主动预告这句免困惑。

## 引导人类用户登录

用户要把机器登进来时，用大白话一步步带，一次只给一步，不要一次倒完全部：

0. **没装先看安装节**：确认 `glab --version` 能跑，装好了再进下面四步。

1. **浏览器里造 PAT**：登录 `http://git.51vr.local` 后打开 `http://git.51vr.local/-/profile/personal_access_tokens`（头像 → Preferences → Access Tokens）。填写：名称 `glab-机器名`；有效期可留空（空 = 永不过期）；权限只勾 `api`。点创建后复制 `glpat-` 开头的令牌——只显示这一次，关页面就没了。
2. **任意终端登录**（PowerShell 或 Git Bash 都行）：把认证节里的一行命令给用户，令牌换成他自己的。用户偏交互式（`glab auth login --hostname git.51vr.local --api-protocol http --git-protocol http`）时，预告坑位：`SSH hostname:` 和 `API hostname:` 提示一律**留空回车跳过**（只有 SSH/API 部署在另一个域名的实例才需要填——在这乱填是最常见的「过不去」卡点）；随后登录方式选 Token、粘贴令牌。
3. **成功标志**：终端打印 `✓ Stored your credentials in the operating system keyring.`
4. **验证**：`glab auth status` 显示钥匙串登录；在仓库克隆里 `glab issue list` 能列出 issue。此后任何终端裸跑 glab 命令，零环境配置。

## 认证故障对照

| 症状 | 原因 | 处理 |
|---|---|---|
| 任何调用 connection refused | https 默认 vs 纯 http 实例 | 登录时带 `--api-protocol http --git-protocol http` |
| 401 Unauthorized | 令牌过期或吊销 | 重造 PAT，重跑登录 |
| `No token found (checked config file, keyring, and environment variables)` | 钥匙串条目丢失（本机已知失败模式） | 重跑一行登录命令即恢复 |
| `API call failed: context deadline exceeded` + `X could not authenticate to one or more of the configured GitLab instances` | config `hosts:` 里有**不可达的残留 host**（2026-10-14 实例：升级测试机 10.100.20.59，ping 100% 丢包）——是网络不通，不是令牌问题 | 逐 host 隔离定位：`glab auth status --hostname <host>`；不可达的按「凭据管理器操作规范」删钥匙串条目 + config 块 |
| 登录身份不对、令牌像被忽略 | `GITLAB_TOKEN` 环境变量优先 | 看 `glab auth status` 输出里的来源行；agent 会话注入属正常设计 |
| 想要「像 gh 一样浏览器登录」 | OAuth 网页流或设备码流 | 仍不推荐：自建实例要先注册 OAuth 应用配 client_id；OAuth 尝试还会在凭据管理器成对留下 `glab:127.0.0.1:<port>:token:manual*` 垃圾条目（2026-10-14 清了 46 条）。PAT + 钥匙串就是答案 |

**不要用 `glab auth status -t` 取令牌给 curl**（2026-10-14 双版本实测失效：打印的 glpat 串被 REST 401 / GraphQL `Invalid token` 双拒，与钥匙串内真正使用的令牌不一致；glab 自身全部调用不受影响）。需要 API 调用一律走 `glab api`；确需 curl 的场景（如 issue 链接端点）令牌从用户处另取或用安全存储，勿依赖 `-t`。

## 凭据管理器操作规范（2026-10-14 实战总结）

- glab 钥匙串条目命名格式：`glab:<host>:token:`（如 `glab:git.51vr.local:token:`）。`git:http://<host>`、`git:https://...` 系列是 **git 本体**的 HTTP 凭据（可能存的是账号密码而非 PAT），删了 git fetch/push 就会要密码——**红线，不可碰**。
- 历次 OAuth 浏览器登录尝试会成对留下 `glab:127.0.0.1:<port>:token:manual<A|B>*` 垃圾条目（一次尝试一对），无任何引用，可安全批量删除。
- Git Bash 里 cmdkey 参数必须写 `//list`、`//delete`（MSYS 路径转义，单斜杠会被当路径吃掉）。
- **cmdkey 假成功坑（实测 46 连坑）**：对不存在的目标执行 `//delete` 同样打印 "Credential deleted successfully"；且 cmdkey 输出带 CRLF，`grep -o 'glab:[^ ]*'` 提取的名字尾部粘着 `\r`（`\r` 不属于空格），拿这种名字去删等于删不存在的目标。正确做法：名单先 `tr -d '\r'` 清洗再删；**验收只认删后 `cmdkey //list` 的实际计数，不认 cmdkey 的成功消息**。
- 删残留 host 的完整配方：① `cmdkey //delete:"glab:<host>:token:"`；② 备份后删 config.yml `hosts:` 下该 host 的整块。只做①不做②时，`auth status --hostname` 该 host 会从超时变成「未认证」提示——块还在但凭据没了。

## 命令怪癖（对照 gh）

- JSON 输出参数在不同子命令上不一致：`glab issue view -F json` 正确；`glab issue list -O json`——list 上 `-F` 是另一含义（details/ids/urls），传 json 会**静默退回文本表格**；`glab mr list -F json` 正确。解析失败时先查该子命令 `--help` 用哪种拼法。
- `glab issue create` 无 JSON 输出——从 stdout 尾部解析 issue URL，或改用 `glab api POST projects/项目id/issues`。
- 分页用 `--page` / `--per-page`，没有 gh 那样的 `-L/--limit`。
- 仓库推断靠当前目录的 git remote，克隆内自动生效；克隆外 `-R` 可指定仓库但 host 默认 gitlab.com（除非设 `GITLAB_HOST`）——本环境优先在克隆内跑。
- GitLab 的 issue 与 MR 各自独立编号，`#42` 要先知道说的是哪个面。
- `--description "$(cat 文件)"` 传 UTF-8 中文安全；Git Bash 终端显示可能乱码，GitLab 存储无损，别被显示误导。
- **`glab repo view` 不可用**：按路径、按数字 ID、强制 `GITLAB_HOST` 三种方式均 404（1.113/1.123 双测，`glab api projects/<id>` 同一项目正常）——要项目信息用 `glab api projects/项目id` 替代。
- **`glab ci status` 退出码语义**：rc=1 可能只是最新 pipeline 状态为 failed 的如实反映——输出里有真实 pipeline 数据（编号、阶段、时长）就不是命令失败，先看输出再下结论。
- **`glab auth status --output json`**（1.122+）：脚本化检查首选，字段含 host/state/user/token_source/git_protocol，比解析文本输出可靠。

## 使用面实测范式（v1.115–v1.123 · 2026-08~10 实测）

**通用头号坑**：子命令拼错或不存在时，glab **打印帮助文本且退出码 0**——脚本无法靠退出码发现失败。解析输出前先确认不是帮助文本（特征：含 `USAGE` 字样）。实测踩例：`snippet list`、`search issues`。

- **label**：`glab label list` ✓ 可用；增删走 `label create/delete`。
- **milestone**：`glab milestone list` 裸跑在克隆内也报错 `At least one of the flags in the group [project group] is required`——必须显式 `--project OWNER/REPO`（或 `--group`，二者互斥）；支持 `--output json`。
- **release**：`glab release list` ✓ 可用（形态正确；本仓库暂无 release）。
- **pipeline**：`glab pipeline list` ✓ 可用；`glab ci status` 在当前分支无 pipeline 且无关联 MR 时报错——先 `pipeline list` 确认有再 `ci status`。
- **snippet**：v1.115 仅 `create` 一个子命令，**没有 list**；列 snippet 走 `glab api snippets`（项目级 ✓ 实测返回 `[]`；`personal_snippets` 端点在 15.0.5 上 404）。
- **search**：v1.115 无全局 issue/MR 搜索子命令（仅 `semantic` beta AI 代码搜索，付费面）。跨仓库搜索走 REST：`glab api "search?scope=issues&search=<词>"` ✓ 实测命中真实 issue——**但关键词必须 ASCII**：`/search` 端点所有 scope（issues/MR/项目名/blobs 代码/wiki/commits）查询词含任意中文字符即稳定 HTTP 500（15.0.5-ee 与 19.3.2-ee 双实例实测同现，属既有缺陷非升级引入；中文数据写入/展示本身无损）。仓库内搜索不受此限：`glab issue list --search "中文词"` 走列表端点 LIKE 匹配，中文可用。跨仓库找中文标题的 issue/MR 无直接解——按 `--label` 过滤或逐仓 `issue list` 后本地过滤。证据见 references/evidence-usage.md（2026-09-14 补测节）。
- **api 回退**：`glab api` 支持 `--paginate` 与 `--output ndjson`（与 gh 同名同义）；项目路径要 URL 编码（如 `neon%2FTWE%2FAesMetaTool`）。`--page/--per-page` 仅 list 类命令（见怪癖节）。
- **多账号**：每 host 一令牌（config `hosts:` 每主机单 user），同 host 多账号不支持；临时换身份用 `GITLAB_TOKEN` 环境变量压钥匙串。

逐条实测记录（命令 + 原始输出摘要）见 [references/evidence-usage.md](references/evidence-usage.md)。

## 免费档链接裁决

- `relates_to` 免费可用。`blocks`/`blocked_by` 在**所有已发布版本**都是 Premium（实证跨度：官方文档源码 v15.11 至 v19.2 各 tag 加现行文档；功能 12.1/2019 引入）——**升级永不解锁**，只随付费 license 生效。阻塞语义永久走 `Blocked by: #<n>, #<n>` 文本行。**19.3.2-ee 升级实例实测（2026-09-14，EE 构建未挂 license）**：`blocks` 返回 `Blocked issues not available for current license`，`link_type=blocked_by` 直接被判非法值，quick action `/blocked_by #<n>` 发帖成功但**静默不建链**——免费档三条路全堵，正文文本行是唯一规范路径。19.4.1 上免费档判断已复核（namespace plan=`default`，2026-10-14），blocks/blocked_by 行为未重测（最近实证仍是 19.3.2-ee）。
- `glab api -f` 在 issue 链接端点上静默丢参——改用 curl（令牌来源见认证节的 `-t` 失效警告，从用户处另取）：
  `curl -s -X POST -H "PRIVATE-TOKEN: $T" "http://git.51vr.local/api/v4/projects/项目id/issues/编号/links" --data-urlencode "target_project_id=项目id" --data-urlencode "target_issue_iid=编号" --data-urlencode "link_type=relates_to"`
- 15.0 上链接查询返回扁平对象数组（每项带 `link_type` 字段），不是 source/target 对。
- `target_project_id` 参数在 **19.x 必带、15.x 可省**——19.3.2 实测缺参报 `target_project_id is missing`（2026-09-14）；上方 curl 范式已含该参数，双版本通用。
- 真子票（issue 挂 issue）任何档位都不存在。伪子票 = 子票正文首行 `Part of #<n>` + `relates_to` 布线做界面导航。
