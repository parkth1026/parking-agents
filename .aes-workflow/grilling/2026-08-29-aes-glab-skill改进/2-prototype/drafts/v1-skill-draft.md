<!-- draft v1 | published 2026-08-29T20:05:00+08:00
     用户意见：Q3 选中 label/milestone、release/pipeline、snippet/多账号/api（search 未选降为低优先）；Q4 结构按草稿走；其余无异议
     状态：confirmed（结构裁决已并入 behavior.md，2026-08-29） -->

# 新 SKILL.md 结构草稿 v1

对位现状：现有三节全部保留（文字不动），新增【安装】【配置事实】两节，
使用面节按候选清单扩充。节序如下，★ = 本次新增，● = 现有不动：

```
frontmatter description（改：补安装/配置触发词）
# glab 全流程范式（改标题，原「glab 使用范式」）
├─ 实例与仓库定位（● 现首段不动）
├─ ★ 安装（Windows 为主）
├─ 认证（● 不动）
├─ ★ 配置事实（一次性配置的裁决事实）
├─ 引导人类用户登录（● 不动；首步前加「第 0 步：未装先看安装节」一句）
├─ 认证故障对照（● 不动）
├─ 命令怪癖（对照 gh）（● 不动；按扩充清单并入新条目）
├─ ★ 使用面扩充（逐条实测后定去留，见候选清单）
└─ 免费档链接裁决（● 不动）
```

## ★ 安装节内容要点

1. **首选渠道（本机实测）**：`winget install GLab.GLab`——落点
   `C:\Users\<user>\AppData\Local\Programs\glab\glab.exe`；装完**新开终端**生效。
2. 渠道清单（未实测，只列不展开）：scoop / choco / 官方 release zip，证据等级标注。
3. **装没装/在哪的判定**：`glab --version`；找不到命令时按
   `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\*` DisplayName 查
   InstallLocation，或 `winget list --id GLab.GLab`。
4. **agent Git Bash 坑（实测）**：agent 会话里 `glab` 可能不在 PATH
   （`command not found`）而用户 PowerShell 正常——兜底=用上面注册表/落点的
   全路径调 exe，不要因此判定「未安装」。
5. 版本参考：本机 v1.115.0（2026-08 实测）。

## ★ 配置事实节内容要点

1. **配置文件位置（实测）**：`C:\Users\<user>\AppData\Local\glab-cli\config.yml`
   ——不是 Roaming、不是 `~/.config`。
2. **gitlab.com 噪音块（实测）**：glab 首次运行在 `hosts:` 写入 `gitlab.com`
   默认模板块，`glab auth status` 永远多一段红色 401/No token found；
   `glab auth logout` 只删凭据不删该块。双路径：**无害可无视**（默认）；
   要清则**先备份**再删 `hosts:` 下整个 `gitlab.com:` 块，删后仅剩
   `git.51vr.local` 段，功能无损（本机已验证）。
3. **令牌来源差异提示**：agent 会话注入 `GITLAB_TOKEN` 时 auth status 显示
   `(GITLAB_TOKEN)`，用户自己终端显示 `(keyring)`——两者都正常，引导小白时
   预告这句，免困惑（本会话实录）。

## ★ 使用面扩充候选清单（执行阶段逐条实测后定去留）

| 候选 | gh 对应 | 初始判断 |
| --- | --- | --- |
| `glab search`（issues/mrs 全局搜索） | gh search | 待实测 15.0.5 免费档支持度 |
| label 管理（增删/筛选） | gh issue label（隐含） | 待实测 |
| milestone 操作 | gh 有 | 待实测免费档 |
| `glab release` | gh release | 待实测 |
| `glab pipeline`/`ci` 触发与查看 | gh run | 待实测实例 CI 开启状态 |
| `glab snippet` | gh gist | 待实测 |
| 多 host/多账号（GITLAB_HOST 之外） | gh auth 多账号 | 待实测必要性 |
| `glab api` 回退细节与分页拼法 | gh api --paginate | 半已有（怪癖节），补全 |

裁决规则（写进 design.md 约束）：**实测通过→命令范式入节；实例/档位不支持→
落成一行裁决记录（同免费档链接裁决风格）；无法实测→不写**。

## frontmatter description 改法（草案）

在现有 description 基础上补：「从未安装 glab 要从零安装（winget）、找不到 glab
命令、配置文件位置、auth status 出现多余 gitlab.com 段」等触发词，长度控制在
1024 限额内。

## design.md 增补（草案）

- 新增 AC-6：安装类请求触发本技能并产出六断言形态指引
- 新增 AC-7：配置类事实（config 位置/噪音块/PATH 兜底）被直接引用不重查
- 迭代记录追加一条（本次改动+评测结果）

## output-evals.json 改动

沿用既有「eval-glab零基础安装指引」六断言不改；iteration-2 评测跑它并沉淀
history；使用面扩充是否增补新 eval 断言由执行阶段按实测结果提议（默认不新增，
避免一次改动摊子过大）。
