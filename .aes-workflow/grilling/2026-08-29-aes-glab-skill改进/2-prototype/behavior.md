# 行为对照表: 2026-08-29-aes-glab-skill改进

**确认版·锁定。** 执行 Agent 改的是产品（aes-glab 技能），不是这份对照表。
用户确认：2026-08-29（Q3 选 B/C/D、Q4 结构确认，草稿 v1 无其余异议）

## 变化行

| # | 输入 / 前置 | 现在的行为 | 改后的行为 |
| --- | --- | --- | --- |
| 1 | 用户：「新 Windows 机器从零装 glab 连 git.51vr.local」 | description 无安装触发词，技能不触发或触发后无安装内容，agent 靠通用知识拼指引，双协议参数与避坑点无保证 | 触发技能，按安装节产出：`winget install GLab.GLab` + 落点 `AppData\Local\Programs\glab` + 新开终端生效 + 判定三法（版本/注册表/winget list）+ 衔接认证节四步登录 |
| 2 | agent 会话（Git Bash）执行 `glab ...` 报 `command not found` | 无记录，agent 可能误判「未安装」而引导重装 | 按安装节兜底：注册表 `HKCU\...\Uninstall\*` 查 InstallLocation 或 `winget list --id GLab.GLab`，用全路径调 exe，不判定未安装 |
| 3 | 用户：「auth status 里怎么一直有 gitlab.com 红字，我都 logout 过了」 | 技能无此事实，agent 现场排查（本会话实际发生，耗多轮调查） | 直接引用配置事实节：默认模板块、无害可无视（默认答复）；用户要清则先备份 `config.yml` 再删 `hosts:` 下整个 `gitlab.com:` 块 |
| 4 | 用户/agent：「glab 配置文件在哪」 | 无记录，易猜 Roaming 或 `~/.config` | 一手事实：`C:\Users\<user>\AppData\Local\glab-cli\config.yml` |
| 5 | 用户做 label/milestone、release/pipeline、snippet/多账号/api 回退操作（Q3 选中的 B/C/D 组） | 命令怪癖节仅覆盖 issue/MR 基本面 | 优先实测 B/C/D 组候选；实测通过→命令范式入使用面节；15.0.5 免费档不支持→落一行裁决记录（同免费档链接裁决风格）；无法实测→不写 |
| 6 | 用户做 search 类跨仓库搜索（Q3 未选的 A 组） | 同上无覆盖 | 低优先实测：支持则以最小条目收录，不支持直接落裁决记录，不展开 |
| 7 | 触发面整体 | 认证/401/No token found/GITLAB_TOKEN/新机器配置等 | 另含：从零安装、找不到 glab 命令、配置文件位置、auth status 多余 gitlab.com 段（description 补触发词，1024 限额内） |
| 8 | 边界情形：小白用户在 agent 会话验证登录 | auth status 显示 `(GITLAB_TOKEN)` 来源，小白困惑「怎么和教程不一样」 | 配置事实节含来源差异预告：agent 会话注入环境变量属正常，用户自己终端显示 `(keyring)`，两者等价 |

## 不变清单

- 现有三节内容**逐字保留**：认证（PAT+钥匙串+双协议一行命令）、引导人类用户登录四步、认证故障对照表、命令怪癖（对照 gh）、免费档链接裁决。
- 认证类触发场景行为不变（design.md AC-1 场景依旧命中，旧答案不劣化）。
- 「eval-glab零基础安装指引」六条断言定义不改（iteration-2 评测按原定义跑）。
- `history.json` 既有 glab-workflow iteration-1 轨迹不覆盖，iteration-2 以追加沉淀。
- 分发路径不变：parking-agents 仓库 → `~/.agents/skills/aes-glab` 软链，宿主零感知升级。
- 目标实例不变：git.51vr.local（GitLab 15.0.5-EE 免费档、纯 http、双协议参数红线）。
- design.md 既有 AC-1~AC-5 与迭代记录不删不改，只增补 AC-6/AC-7 与新迭代条目。

## 配置差异

（技能自身无配置文件/环境变量/命令行选项变更，整节省略）
