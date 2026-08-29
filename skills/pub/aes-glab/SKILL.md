---
name: aes-glab
description: glab 命令行（自建 GitLab 实例 git.51vr.local）安装、配置与使用全流程范式。从未安装 glab 要从零安装、找不到 glab 命令、想知道 glab 配置文件在哪、auth status 出现多余 gitlab.com 段，或要登录认证、碰上 token 失效、401、No token found、环境变量 GITLAB_TOKEN、新机器配置、想用浏览器或 OAuth 登录，或要做 issue/MR/label/milestone/release/pipeline/snippet/search/api 操作时使用：winget 安装渠道与落点、PAT+系统钥匙串登录引导、配置文件事实、命令怪癖与免费档链接裁决、使用面实测范式。
---

# glab 全流程范式（安装·配置·使用）

目标实例 `git.51vr.local`（GitLab 15.0.5-EE 免费档，纯 http——443 端口不服务）。换实例时调整 hostname 与协议。伴生仓库文档（完整约定）：`D:\GIT\AntAgentWeb2-dev1\docs\agents\issue-tracker.md`。

## 安装（Windows 为主）

- 首选渠道（本机实测）：`winget install GLab.GLab`——落点 `C:\Users\<user>\AppData\Local\Programs\glab\glab.exe`；装完**新开终端**再跑 glab（PATH 新会话才生效）。
- 其他渠道（未实测，只列不展开）：scoop / choco / 官方 release zip。
- 判定装没装、装在哪：`glab --version`；找不到命令时查注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\*`（DisplayName 含 glab）的 InstallLocation，或 `winget list --id GLab.GLab`。
- **agent Git Bash 坑（实测）**：agent 会话里 `glab` 可能不在 PATH（`command not found`）而用户 PowerShell 正常——按上面的落点/注册表用全路径调 exe，不要据此判定「未安装」。
- 版本参考：v1.115.0（2026-08 实测；本技能各怪癖均以此版本为准）。

## 认证（先读这节）

定版做法：个人访问令牌（PAT）存进系统钥匙串（Windows 凭据管理器）——与 gh 等价的体验，机器配置里零环境变量。

- 一次性登录，令牌走标准输入、不进命令行历史：
  - Git Bash：`printf '%s' "$TOKEN" | glab auth login --hostname git.51vr.local --api-protocol http --git-protocol http --stdin`
  - PowerShell：`"令牌" | glab auth login --hostname git.51vr.local --api-protocol http --git-protocol http --stdin`
- 两个协议参数必须带：纯 http 实例上 glab 默认走 https，所有调用被拒。这是头号坑。
- 验证：`glab auth status` 应显示 `✓ Logged in to git.51vr.local as <用户> (keyring)`。Git Bash 里剥掉环境变量再验一次更硬：`env -u GITLAB_TOKEN -u GITLAB_HOST glab auth status`。
- 优先级：`GITLAB_TOKEN` 只在 agent 会话被注入（Windows 注册表与 shell 配置是干净的），存在时压过钥匙串。两者共存，命令行为无差别。
- 令牌住在 Windows 凭据管理器里，不要手动碰它。

## 配置事实（一次性配置）

- 配置文件位置（实测）：`C:\Users\<user>\AppData\Local\glab-cli\config.yml`——不是 Roaming、不是 `~/.config`。
- **gitlab.com 噪音块（实测）**：glab 首次运行会在 `hosts:` 下写入 `gitlab.com` 默认模板块，`glab auth status` 因此永远多一段红色 401/No token found；`glab auth logout` 只删凭据不删该块。答复双路径：默认「无害可无视」（`No token found` 恰说明 gitlab.com 上没有凭据）；用户要清则**先备份** config.yml，再删 `hosts:` 下整个 `gitlab.com:` 块，删后只剩 git.51vr.local 段，功能无损（本机已验证）。
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
| 登录身份不对、令牌像被忽略 | `GITLAB_TOKEN` 环境变量优先 | 看 `glab auth status` 输出里的来源行；agent 会话注入属正常设计 |
| 想要「像 gh 一样浏览器登录」 | OAuth 网页流或设备码流 | 本实例不推荐：自建实例要先注册 OAuth 应用配 client_id，设备码流要 GitLab 17.9+，实测还会生成 https 授权链接撞纯 http 实例。PAT + 钥匙串就是答案 |

无环境变量的终端里取令牌给原生 curl：
`T=$(glab auth status -t --hostname git.51vr.local 2>&1 | grep -o 'glpat-[A-Za-z0-9_-]*' | head -1)`——令牌打在 **stderr** 上，`2>&1` 不能省。

## 命令怪癖（对照 gh）

- JSON 输出参数在不同子命令上不一致：`glab issue view -F json` 正确；`glab issue list -O json`——list 上 `-F` 是另一含义（details/ids/urls），传 json 会**静默退回文本表格**；`glab mr list -F json` 正确。解析失败时先查该子命令 `--help` 用哪种拼法。
- `glab issue create` 无 JSON 输出——从 stdout 尾部解析 issue URL，或改用 `glab api POST projects/项目id/issues`。
- 分页用 `--page` / `--per-page`，没有 gh 那样的 `-L/--limit`。
- 仓库推断靠当前目录的 git remote，克隆内自动生效；克隆外 `-R` 可指定仓库但 host 默认 gitlab.com（除非设 `GITLAB_HOST`）——本环境优先在克隆内跑。
- GitLab 的 issue 与 MR 各自独立编号，`#42` 要先知道说的是哪个面。
- `--description "$(cat 文件)"` 传 UTF-8 中文安全；Git Bash 终端显示可能乱码，GitLab 存储无损，别被显示误导。

## 使用面实测范式（v1.115 · 2026-08 实测）

**通用头号坑**：子命令拼错或不存在时，glab **打印帮助文本且退出码 0**——脚本无法靠退出码发现失败。解析输出前先确认不是帮助文本（特征：含 `USAGE` 字样）。实测踩例：`snippet list`、`search issues`。

- **label**：`glab label list` ✓ 可用；增删走 `label create/delete`。
- **milestone**：`glab milestone list` 裸跑在克隆内也报错 `At least one of the flags in the group [project group] is required`——必须显式 `--project OWNER/REPO`（或 `--group`，二者互斥）；支持 `--output json`。
- **release**：`glab release list` ✓ 可用（形态正确；本仓库暂无 release）。
- **pipeline**：`glab pipeline list` ✓ 可用；`glab ci status` 在当前分支无 pipeline 且无关联 MR 时报错——先 `pipeline list` 确认有再 `ci status`。
- **snippet**：v1.115 仅 `create` 一个子命令，**没有 list**；列 snippet 走 `glab api snippets`（项目级 ✓ 实测返回 `[]`；`personal_snippets` 端点在 15.0.5 上 404）。
- **search**：v1.115 无全局 issue/MR 搜索子命令（仅 `semantic` beta AI 代码搜索，付费面）。跨仓库搜索走 REST：`glab api "search?scope=issues&search=<词>"` ✓ 实测命中真实 issue。
- **api 回退**：`glab api` 支持 `--paginate` 与 `--output ndjson`（与 gh 同名同义）；项目路径要 URL 编码（如 `neon%2FTWE%2FAesMetaTool`）。`--page/--per-page` 仅 list 类命令（见怪癖节）。
- **多账号**：每 host 一令牌（config `hosts:` 每主机单 user），同 host 多账号不支持；临时换身份用 `GITLAB_TOKEN` 环境变量压钥匙串。

逐条实测记录（命令 + 原始输出摘要）见 [references/evidence-usage.md](references/evidence-usage.md)。

## 免费档链接裁决

- `relates_to` 免费可用。`blocks`/`blocked_by` 在**所有已发布版本**都是 Premium（实证跨度：官方文档源码 v15.11 至 v19.2 各 tag 加现行文档；功能 12.1/2019 引入）——**升级永不解锁**，只随付费 license 生效。阻塞语义永久走 `Blocked by: #<n>, #<n>` 文本行。
- `glab api -f` 在 issue 链接端点上静默丢参——改用 curl：
  `curl -s -X POST -H "PRIVATE-TOKEN: $T" "http://git.51vr.local/api/v4/projects/项目id/issues/编号/links" --data-urlencode "target_project_id=项目id" --data-urlencode "target_issue_iid=编号" --data-urlencode "link_type=relates_to"`
- 15.0 上链接查询返回扁平对象数组（每项带 `link_type` 字段），不是 source/target 对。
- 真子票（issue 挂 issue）任何档位都不存在。伪子票 = 子票正文首行 `Part of #<n>` + `relates_to` 布线做界面导航。
