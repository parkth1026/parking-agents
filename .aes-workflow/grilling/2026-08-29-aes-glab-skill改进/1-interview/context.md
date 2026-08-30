# Context Snapshot: 2026-08-29-aes-glab-skill改进

- 创建：2026-08-29T19:51:30+08:00
- 分片来源：无，宿主直接调查

## 任务陈述

「总结一下你的经验 现在 glab skill 改名叫 aes-glab 了 他包含了 对 glab 的 安装 配置 还有使用的 全部教程 。你可以参考 gh 这个技能 对 github 的使用。看下我们对 glab 做什么改动比较好？」

## 用户提出的方案

- 参考 `gh` skill（`D:\GIT_dev\parking-agents\skills\pub\gh\SKILL.md`）的形态来改进 aes-glab。

## 意图假设

用户在本次会话中被引导（作为纯小白）完成了 glab 的安装、登录、配置清理全流程，
途中踩出了旧 skill 未覆盖的事实（winget 安装位置、agent bash PATH 不可见、
config.yml 真实位置、gitlab.com 默认 host 噪音块）。他期望 aes-glab 成为
「安装 + 配置 + 使用」全覆盖的教程型技能，本次改动的核心是把会话经验固化进 skill，
补齐安装与配置两块缺口。注意：任务陈述说「他包含了……全部教程」是期望而非现状——
现状 SKILL.md 没有安装节与配置节。

## 已查事实

| 事实 | 出处 | 分类 |
| --- | --- | --- |
| aes-glab 现内容仅三节：认证、命令怪癖（对照 gh）、免费档链接裁决；无安装节、无配置节 | `D:\GIT_dev\parking-agents\.agents\skills\aes-glab\SKILL.md` 全文（6050B，2026-08-29 19:41 更新） | Fact |
| skill 目录已挂输出评测「eval-glab零基础安装指引」：六条 manual 断言——官方安装渠道可执行命令、安装验证与 PATH 说明、登录命令带双协议参数、PAT 创建步骤（只勾 api）、交互避坑（SSH hostname 留空）、最终验证步骤与期望输出；评测 prompt 明确「Windows 10、只产出指引不执行」 | `aes-glab\output-evals.json` | Fact |
| 评测 prompt 场景是 Windows 10 从零安装 | `output-evals.json` 的 prompt 字段 | Fact |
| 该安装指引评测定义于 iteration-1（2026-08-29T17:33），但 history.json 只有「glab-workflow」一条运行记录，安装指引评测尚未跑过 | `aes-glab\history.json` | Fact |
| design.md 记录意图、设计取舍、AC-1~AC-5、迭代记录；迭代记录末条为 2026-08-29 中文重写 + quick-validate PASS + run-tests.mjs 按知识型豁免 | `aes-glab\references\design.md` | Fact |
| gh skill（参照物）不覆盖安装，假设已装；内容为查阅型命令范式（JSON/分页/搜索/issue 关系/discussions/read-file/多账号认证） | `D:\GIT_dev\parking-agents\skills\pub\gh\SKILL.md` | Fact |
| 本会话实测：用户经 `winget install GLab.GLab` 装 glab v1.115.0；安装落点 `C:\Users\<user>\AppData\Local\Programs\glab\glab.exe`（注册表 InstallLocation 可查） | 本会话（registry `HKCU\...\Uninstall\*` DisplayName like glab） | Fact |
| 本会话实测：agent 的 Git Bash 会话里 `glab` 不在 PATH（command not found），用户自己的 PowerShell 正常；兜底手段=全路径调用 exe 或注册表/winget list 定位 | 本会话 bash 实测 | Fact |
| 本会话实测：Windows 下 glab 配置文件在 `C:\Users\<user>\AppData\Local\glab-cli\config.yml`（不是 Roaming 也不是 ~/.config） | 本会话文件系统实测 | Fact |
| 本会话实测：config.yml 的 `hosts:` 下有 glab 首次运行写入的 `gitlab.com` 默认模板块，导致 `glab auth status` 永远多一段红色 401/No token found 噪音；`glab auth logout` 只删凭据不删该块；删块（备份后）即消失，功能无损 | 本会话编辑 config.yml 前后对照验证 | Fact |
| 本会话实测：skill 现有「引导人类用户登录」四步流程对纯小白有效（一次一步、成功标志、验证闭环）；新手真实困惑点是 gitlab.com 噪音段与 agent 会话 GITLAB_TOKEN 来源差异 | 本会话引导实录 | Fact |
| skill 物理位置在 parking-agents 仓库 `.agents/skills/aes-glab/`，经 `C:\Users\Administrator\.agents\skills\aes-glab` 软链分发；旧 `glab` 软链已不存在 | `ls -la ~/.agents/skills/` | Fact |
| skill description 现含认证/401/No token found/新机器配置等触发词，但不含「安装」 | SKILL.md frontmatter description | Fact |
| parking-skill-creator 提供验证基建：quick-validate（规则校验）、输出评测循环（探针/评审/history 沉淀）、触发评测；知识型技能可豁免 run-tests.mjs | `parking-agents\.agents\skills\parking-skill-creator\SKILL.md` | Fact |

## 验证基建候选池

| 途径 | 代价 |
| --- | --- |
| quick-validate（parking-skill-creator 脚手架规则校验） | 低；本机直接跑，迭代记录已有先例 |
| 对照 output-evals.json 六条断言人工核对改后 SKILL.md | 低；但无独立探针，验证的是「文档写没写」而非「agent 用它产出过」 |
| 完整输出评测循环（iteration-2：subagent 探针 with_skill 产出安装指引 + 评审六断言 + history 沉淀） | 中；评测 prompt 明确只产出指引不执行安装，不依赖内网在线；耗时一轮探针+评审 |
| 真机复装验证（新机器/卸载重装走一遍指引） | 高；动系统状态，不适合作为本次验收 |

## 术语冲突

- 用户说「他包含了……全部教程」：现状并不包含安装/配置教程，按「期望目标」理解（见意图假设）；已在确认区向用户求证。

## 四分类（第 1 轮问后已定）

- **Fact**：上表全部；改动落点=parking-agents 仓库 aes-glab 目录（唯一合理位置，软链即生效）。
- **User decision**：① 使用面扩充——已定 **B：同步扩到 gh 广度**（翻推荐，`overturned_recommendation=true`；新增使用面内容须逐条对 git.51vr.local 实测后写入，GitLab 15.0.5 免费档没有的能力落成裁决记录而非命令范式）；② 验收——已定 **B：完整输出评测循环**（探针+评审+history 沉淀）；③ 目标口径——已定：安装+配置+使用全覆盖，使用面 gh 级广度（经 Q1=B 升级）。
- **Agent-owned**：安装/配置内容的具体行文与排版（沿引导式「一次一步」风格）；新增节与现有三节的先后顺序；description 触发词的具体措辞；design.md 的 AC 增补与迭代记录写法；提交信息措辞。
- **Blocked**：无。

## 决定边界未知项

- 无——「配置」的边界（一次性配置 vs 日常偏好管理）已归入确认区 C2。

## 未知项

- 无必须问的仓库外事实；安装渠道除 winget 外（scoop/choco/官方 release）本机未实测，写进 skill 时按「渠道清单+本机实测 winget」标注证据等级即可，不构成阻塞。
