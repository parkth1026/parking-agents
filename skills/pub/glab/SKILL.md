---
name: glab
description: glab 命令行（自建 GitLab 实例 git.51vr.local）使用范式。用户要登录或认证 glab、碰上 token 失效、401、No token found、环境变量 GITLAB_TOKEN、新机器配置、想用浏览器或 OAuth 登录，或要做 issue/MR/链接操作时使用：按个人访问令牌（PAT）+ 系统钥匙串的登录流程引导，含协议参数、交互提示陷阱、故障对照、命令怪癖与免费档链接裁决。
---

# glab 使用范式

目标实例 `git.51vr.local`（GitLab 15.0.5-EE 免费档，纯 http——443 端口不服务）。换实例时调整 hostname 与协议。伴生仓库文档（完整约定）：`D:\GIT\AntAgentWeb2-dev1\docs\agents\issue-tracker.md`。

## 认证（先读这节）

定版做法：个人访问令牌（PAT）存进系统钥匙串（Windows 凭据管理器）——与 gh 等价的体验，机器配置里零环境变量。

- 一次性登录，令牌走标准输入、不进命令行历史：
  - Git Bash：`printf '%s' "$TOKEN" | glab auth login --hostname git.51vr.local --api-protocol http --git-protocol http --stdin`
  - PowerShell：`"令牌" | glab auth login --hostname git.51vr.local --api-protocol http --git-protocol http --stdin`
- 两个协议参数必须带：纯 http 实例上 glab 默认走 https，所有调用被拒。这是头号坑。
- 验证：`glab auth status` 应显示 `✓ Logged in to git.51vr.local as <用户> (keyring)`。Git Bash 里剥掉环境变量再验一次更硬：`env -u GITLAB_TOKEN -u GITLAB_HOST glab auth status`。
- 优先级：`GITLAB_TOKEN` 只在 agent 会话被注入（Windows 注册表与 shell 配置是干净的），存在时压过钥匙串。两者共存，命令行为无差别。
- 令牌住在 Windows 凭据管理器里，不要手动碰它。

## 引导人类用户登录

用户要把机器登进来时，用大白话一步步带，一次只给一步，不要一次倒完全部：

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

## 免费档链接裁决

- `relates_to` 免费可用。`blocks`/`blocked_by` 在**所有已发布版本**都是 Premium（实证跨度：官方文档源码 v15.11 至 v19.2 各 tag 加现行文档；功能 12.1/2019 引入）——**升级永不解锁**，只随付费 license 生效。阻塞语义永久走 `Blocked by: #<n>, #<n>` 文本行。
- `glab api -f` 在 issue 链接端点上静默丢参——改用 curl：
  `curl -s -X POST -H "PRIVATE-TOKEN: $T" "http://git.51vr.local/api/v4/projects/项目id/issues/编号/links" --data-urlencode "target_project_id=项目id" --data-urlencode "target_issue_iid=编号" --data-urlencode "link_type=relates_to"`
- 15.0 上链接查询返回扁平对象数组（每项带 `link_type` 字段），不是 source/target 对。
- 真子票（issue 挂 issue）任何档位都不存在。伪子票 = 子票正文首行 `Part of #<n>` + `relates_to` 布线做界面导航。
