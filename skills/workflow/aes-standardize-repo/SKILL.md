---
name: aes-standardize-repo
description: 仓库标准化——分析代码状态（形态/脚本面/CI），定制落地零安装 run 接口（跨平台 wrapper + run.toml + 机器可读 schema）；./run 执行动作、-n 预览、--json 输出；含临时落点路由层与构建工具链探测；改造用户脚本前逐项访谈确认。
disable-model-invocation: true
---

# 标准化一个仓库

把 run 标准作为第一个独立版本化的标准化阶段落地。后续仓库标准保持增量叠加；本阶段不得超出 run 接口的范围。

本技能是 prompt-driven 流程，不是 deterministic 脚本：**分析代码状态 → 定制命令集 → 必要时访谈 → 确认后才写**。生成器（standardize_repo.mjs）只是落地工具；形态判定、动作定制、改造决策是流程的判断力所在。节奏纪律：先读仓绝不冷问、推荐先行让用户一词可接受、探索已定的事不问、一节一答、不可逆动作前单独确认、不知道的绝不发明。

`assets/run/run.cmd` 与生成到目标仓库的 `run`/`run.cmd` 是跨平台入口的登记平台例外；
编排脚本一律 `.mjs`（run-standard v3）。禁止新增 PowerShell、批处理或 shell 编排脚本；
既有仓库的存量 ps1 按 v3 登记制豁免（run.toml 头部注释登记，只缩不扩）。

## 选择路径

1. 目标目录已包含项目文件时，走既有仓库路径；已有 run 接口的仓走增量路径——先呈现 diff，不静默覆盖。
2. 仅当目标要成为新仓库时才走创建路径：先初始化 Git，再执行同一套 run 生成流程。
3. 动目标之前，先解析并遵守所有适用的 `AGENTS.md`。

## 一、探索：先读仓，绝不冷问

1. **形态信号**（判定产品形态集，决定命名）：`src-tauri`/tauri.conf=desktop；`package.json` `bin` 字段 / Cargo `[[bin]]`=cli；vite+`index.html`=web；server 入口/监听代码=server；`packages/*` workspace=多形态候选；`.sln`/electron 目录等历史信号只作参考。形态集是 R1 命名规则（action-naming 第 8 条）的判定输入。形态信号同时推导 setup 的构建工具链探测面（run-standard §9.8：`Cargo.toml`/`src-tauri`→rustc/cargo+Windows MSVC 伴生件、`.sln`/`.csproj`→dotnet、`go.mod`→go；纯 Node 仓探测面为空，评审时显式确认）。
2. **脚本面**（任何类型都要收）：package.json scripts；ps1/bat/sh/mjs 入口脚本；Makefile/justfile/Taskfile；CI workflows（`.github/workflows/*`、`.gitlab-ci.yml`）——每个可人工触发的 job step 都是潜在动作。
3. **现状**：已有 run 接口→增量；git 脏工作区→先提示再动；`README*`/`AGENTS.md` 快速开始段=用户真实习惯。
4. 只提取仓库级操作：环境准备、开发/启动、构建、检查、类型检查、测试/门禁、分发；动作必须映射到这些既有业务，而不是发明平行命令。动作清单里不放 Git 命令。
5. 原样保留既有命令；映射它们，而不是替换或改写。接受动词族以内的脚本全部映射，`:` 与 `-` 一律转成 `.`。凡无法映射的，必须在输出里报告。
6. 把拟定 id 和 argv 拿到 [references/run-standard.md](references/run-standard.md) 核对。

## 二、呈现发现：三件套

向用户呈现（确认前不写任何文件）：

1. **形态判定表**：这个仓库的形态集是什么、单还是多形态、依据哪个信号、命名建议——单形态裸动词，roadmap 明文第二形态时预留限定词（action-naming 第 8-10 条：R1/R2/R3）。
2. **拟定动作目录**：每条 = id / kind / desc 草稿 / 来源（npm script、入口文件、CI step、意图推断）。
3. **改造项清单（单列）**：凡标准化需要动用户的东西——改脚本内容、移动文件、改 package.json scripts、退役旧入口——逐项列出「改什么/为什么/推荐方案/不改的替代（run 直呼原文件）」。**绝不静默执行任何一项。**

## 三、确认：一节一答，推荐先行

按节问，每节推荐先行、一词可接受；探索已经定死的事直接跳过整节：

- **Section A 形态与命名**：呈现形态判定与推荐命名；多形态时给对仗矩阵预览。
- **Section B 改造项**：无改造项则整节跳过。每项给「改 vs 不改的替代」；不可逆动作（删旧脚本/移动文件）单独确认；被改旧入口默认留 deprecation 提示，直接删除需显式同意。
- **Section C 收取舍**：机械映射之外的取舍现场问掉（如某个 script 收不收、为什么），不留事后不一致。

## 四、生成与改造

确认全部完成后执行。改造项按已确认方案逐项落地（移动/重命名用 git 语义可追溯）；无改造直接生成。

在任意目录运行内置生成器。把 `<repo>` 和 `<namespace/name>` 替换为解析后的值。

```powershell
node <skill-dir>/scripts/standardize_repo.mjs <repo> --project-id <namespace/name>
```

空目录要成为新仓库时加 `--create`：

```powershell
node <skill-dir>/scripts/standardize_repo.mjs <repo> --create --project-id <namespace/name>
```

生成器从 `assets/run/` 复制模板（wrapper、runner、TEST_TMP_ROOT 临时落点路由层 `scripts/run/lib/tmp-root.mjs`、以及供下游软件校验 `run.toml` 用的机器可读 `run.schema.json`），创建带动词域头注释的 `run.toml`，逐字节保留既有 `AGENTS.md`，只追加这两行集成说明（主句 `./run` POSIX 形态——`.\run` 在 Git Bash 解析失败，run-standard G16）：

```text
本仓库标准操作：`./run` 发现，`./run <id> -n` 预览，`./run <id>` 执行，`--json` 机器可读。
（Windows：cmd 用 `run`，PowerShell 用 `.\run.cmd`；POSIX 用 `./run`。）
```

除非用户明确授权替换既有 run 接口，否则不要传 `--force`。仓库专属 argv 评审通过之前，生成的 `run.toml` 只算候选稿。**候选稿的三个已知盲区**（增量路径必须人工对照）：① 只机械映射 package.json scripts——原 run.toml 的直 argv 动作（不经 npm script，如 `vp check`）天然不可见，逐一对照旧动作清单防丢失；② setup 的 argv 按 lockfile 探测的包管理器直写（如 `pnpm install`），不继承原动作的旗标语义（如 `--frozen-lockfile`）——评审时逐旗标核对；③ setup 候选稿只有包管理器 install，无构建工具链探测（生成器语言无关）——含 Node 外工具链的仓按 run-standard §9.8 评审补齐（setup 末尾非致命探测 + desc 写明），纯 Node 仓在评审记录里显式确认探测面为空。skipped 清单里的动词域外脚本（start/typecheck/fmt 等）不是噪音，每条都要归位或显式排除。

生成的 runner 用 `scripts/vendor/toml/` 下内置的零运行时依赖 TOML 解析器解析 `run.toml`，接受完整 TOML 1.0 语法（多行数组、注释、带引号的键、内联表、日期时间字面量）；`run/v2` schema 会把文档限制在 `[project].id` 与带 `id`、`name`、`desc`、`kind`、字符串数组 `run` 的 `[[actions]]` 条目——`desc` 必填（run standard v4）：有效行为契约（做什么/数据落哪/默认档与量级/旗标/边界），缺失或空白在加载期报 CONFIG。runner 内建 did-you-mean 未知 id 建议（唯一前缀/家族前缀/动词近邻/编辑距离四层，见 [references/run-standard.md](references/run-standard.md) §2.3），`--json` error 的 `details.suggestion`/`details.family` 同步携带。

模板还内建**双层 Node 前置**（v1.3.0，run-standard 9.5/G12）：wrapper 在 `exec node` 前 fail-fast 探测 Node 存在性——缺失时输出 nodejs.org 安装指引（下载页默认 LTS 即可）并以 69 退出，绝不裸报 9009/command not found；runner 在动作执行前经 `scripts/run/lib/node-version.mjs` 校验版本下限，过老同样 69 + 重装 LTS 指引（dry-run/list/show/doctor 不受门限——诊断与契约读取始终可达）。文案原则：人面只指路「装 LTS」，精确 range 留给机器面（doctor 的 `checks.node.required` 与 `--json` details）。`run.cmd` 内容必须保持**纯 ASCII**——cmd 按活动代码页逐字节解析，CJK 双字节序列的第二字节可撞 `&`/`|` 等元字符，把 rem/echo 行拆成命令执行（实测复现）；指引文案用英文，sh 侧（UTF-8）无此问题可用中文。Node 之外构建工具链的前置检测在动作层而非 runner 层：setup 末尾非致命探测（run-standard §9.8）——就绪打印版本与伴生件（如 Windows msvc host 的 VS C++ 工具链）、缺失 warn 指路不挡退出码、构建类动作的缺工具链报错同源附指引（fail-closed 不变）；标准只规定行为契约，探测实现各仓自持（参照实现 `scripts/run/lib/rust-toolchain.mjs` 单源）。

## 五、评审动作映射

1. 定任何 id 之前先读 [references/action-naming.md](references/action-naming.md)：首段动词取自封闭动词域；限定词按 R1/R2/R3（单形态裸动词+roadmap 预留、形态五词封闭+登记、迁移受控）；同一动词族的限定词必须编码同一维度、互为对仗（`dev.desktop`/`dev.cli` 表形态，`dev`↔`prod` 表意图环境）；禁止 `dev.*.prod` 矛盾前缀，也禁止把同类东西拆进两个动词族。包清单之外的入口脚本按意图在动词域内命名——`server-release.mjs` 是 `prod.server`，不是 `dev.*` 变体。
2. `[project]` 和 `[[actions]]` 是仅有的顶层表形式。
3. 保留仓库支持的核心动作；权威任务定义暴露了项目专属的开发、测试、门禁、分发变体时才补充。
4. 每条命令都是显式 argv 数组。禁止 shell 字符串、管道、重定向、命令串联、隐式切换工作目录。
5. 门禁动作用 `kind = "gate"` 标记；runner 从可执行文件推导可用性，将来装上工具即自动激活，接口无需改动。
6. 动作 id 里绝不出现 `list`、`show`、`doctor`、`help`、`run`。
7. 不要用 JSON 冒充 TOML 数组绕路。TOML 解析归生成的 runner 所有；格式化工具写出的多行数组与注释都是合法输入。
8. **desc 契约纪律（v4）**：生成器写入的"候选稿"desc（机械转发描述）只是占位。评审时逐动作替换为真实有效行为契约——做什么、数据落哪、默认档与量级、直呼旗标、边界承诺；长驻动作写明数据空间，有旗标的写全旗标清单。desc 与实际行为分叉是最严重违例（假契约比缺契约更糟）。
9. **核定 Node 下限（v1.3.0）**：`scripts/run/lib/node-version.mjs` 的常量与 `REQUIRED_NODE_RANGE` 是模板默认值（2026-09 前端生态水位 22.13/24）。按目标仓依赖树 `engines` 交集核定改写该文件，并与各 `package.json` 的 `engines.node` 同笔同步——两处分叉即假契约。纯 node 编排仓可放宽，但不得低于 runner 语法要求（顶层 await，≥14.8）。
10. **setup 必须带构建工具链非致命探测（run-standard §9.8）**：探测面从形态信号推导（见一、1）；含 Node 外工具链的仓，setup 编排脚本在依赖安装完成后探测之——就绪打印版本/关键伴生件（如 Windows msvc host 的 VS C++ 工具链），缺失 warn + 官方安装指引、不挡退出码；构建类动作的缺工具链报错同源附安装指引（fail-closed 语义不变）。desc 写明探测面与 warn 语义，与实际行为分叉即假契约。纯 Node 仓在评审记录里显式确认探测面为空。

## 六、验证结果

全部检查在仓库根目录执行：

```powershell
.\run
.\run doctor
.\run <safe-action> -n
.\run list --json
.\run show <safe-action>
.\run <typo-id>
```

macOS 或 Linux 用 `./run`。确认：裸 run 能列出动作；doctor 报 wrapper 对齐（v1.3.0）且 `node` 检查展示本仓核定的 `required` range；预览不启动子进程；JSON stdout 恰好解析为一个 JSON 文档；`show` 展示完整 desc 契约；敲一个 typo id（如 `buidl`）得到 did-you-mean 建议。至少真实执行一个安全动作并核对退出码不变。在 Windows 上，这个真实动作必须选一个可执行文件经 PATHEXT 解析为 `.cmd`/`.bat` 的（通常是 npm）——在 Node 18.20+/20.12+ 上，doctor 报可用并不证明可执行，因为这些版本拒绝无 shell 地 spawn 批处理文件。执行时 stderr 应出现 `[tmp-route]` 路由行：机器已设 `TEST_TMP_ROOT` → 注入子进程 TMP/TEMP，未设 → 回退提示行（零配置仅多一行提示，行为同旧模板，见 run-standard §9.7）。无 Node 场景按 run-standard 9.5 抽验（可选）：`env PATH=/nonexistent /bin/sh ./run` 应得安装指引与退出码 69，而非 command not found。

命名一致性用本 skill 的校验器闭环（结构归 `run.schema.json`，"义"归它）：

```powershell
node <skill-dir>/scripts/check_naming.mjs <repo>
```

要求零 error 收工（含 R2 形态限定词封闭校验：dev.*/prod.* 族的形态位必须在 desktop/cli/web/mobile/server 五词内或头注释登记）；warn 逐条确认（已登记的动词域扩展、机械映射的人工改名或确有必要的限定词微调）。

改协议字段、保留字、退出码语义或机器输出之前，先读 [references/run-standard.md](references/run-standard.md)。修改本 skill 的指令或资源后，用 skill-creator 的 `quick_validate.py` 验证。

## 七、收尾交接

告诉用户：哪些文件落地了（run 接口三件套 + AGENTS.md 集成句 + 各改造项）；哪三份账本读这些产物（run.toml 命令契约 / README 用户习惯 / AGENTS.md 开发纪律——desc 与实际行为分叉是最严重违例）；后续小调整直接编辑 run.toml 即可；重跑本技能仅在切换命名体系或从零重来时必要。
