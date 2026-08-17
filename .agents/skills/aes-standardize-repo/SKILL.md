---
name: aes-standardize-repo
description: 手动调用的仓库标准化工具：为仓库落地零安装 run 接口（跨平台 wrapper + run.toml + 机器可读 schema），`.\run` 发现与执行动作，`-n` 预览，`--json` 机器可读。
disable-model-invocation: true
---

# 标准化一个仓库

把 run 标准作为第一个独立版本化的标准化阶段落地。后续仓库标准保持增量叠加；本阶段不得超出 run 接口的范围。

## 选择路径

1. 目标目录已包含项目文件时，走既有仓库路径。
2. 仅当目标要成为新仓库时才走创建路径：先初始化 Git，再执行同一套 run 生成流程。
3. 动目标之前，先解析并遵守所有适用的 `AGENTS.md`。

## 生成前先勘察

1. 读包清单、lockfile、任务运行器配置、`README*` 和 `AGENTS.md`。
2. 只提取仓库级操作：环境准备、开发/启动、构建、检查、类型检查、测试/门禁、分发。
3. 读仓库现有脚本与任务定义，恢复它们已经实现的操作；动作必须映射到这些既有业务，而不是发明平行命令。
4. 动作清单里不放 Git 命令。
5. 原样保留既有命令；映射它们，而不是替换或改写。
6. 接受动词族以内的脚本全部映射，`:` 与 `-` 一律转成 `.`（`test:regression-cases` → `test.regression.cases`）。禁止静默丢弃脚本——凡无法映射的，必须在生成器输出里报告。
7. 把拟定 id 和 argv 拿到 [references/run-standard.md](references/run-standard.md) 核对。

## 生成接口

在任意目录运行内置生成器。把 `<repo>` 和 `<namespace/name>` 替换为解析后的值。

```powershell
node <skill-dir>/scripts/standardize_repo.mjs <repo> --project-id <namespace/name>
```

空目录要成为新仓库时加 `--create`：

```powershell
node <skill-dir>/scripts/standardize_repo.mjs <repo> --create --project-id <namespace/name>
```

生成器从 `assets/run/` 复制模板（wrapper、runner、以及供下游软件校验 `run.toml` 用的机器可读 `run.schema.json`），创建带动词域头注释的 `run.toml`，逐字节保留既有 `AGENTS.md`，只追加这一句集成说明：

```text
本仓库标准操作：`.\run` 发现，`.\run <id> -n` 预览，`.\run <id>` 执行，`--json` 机器可读。
```

除非用户明确授权替换既有 run 接口，否则不要传 `--force`。仓库专属 argv 评审通过之前，生成的 `run.toml` 只算候选稿。

生成的 runner 用 `scripts/vendor/toml/` 下内置的零运行时依赖 TOML 解析器解析 `run.toml`，接受完整 TOML 1.0 语法（多行数组、注释、带引号的键、内联表、日期时间字面量）；`run/v1` schema 仍会把文档限制在 `[project].id` 与带 `id`、`name`、`kind`、字符串数组 `run` 的 `[[actions]]` 条目。

## 评审动作映射

1. 定任何 id 之前先读 [references/action-naming.md](references/action-naming.md)：首段动词取自封闭动词域；限定词只用产品级词汇（`web`/`desktop`/`mobile`/`server` 等形态、`dev`/`prod` 等环境），绝不表实现技术（`tauri`/`electron`/`vite` 这类名词写进 `name`，不写进 id——技术栈会迁移，产品形态不会）也不表源文件名；同一动词族的限定词必须编码同一维度、互为对仗（`serve.dev`/`serve.prod` 表环境，`dev`/`dev.desktop` 表形态）；禁止 `dev.*.prod` 矛盾前缀，也禁止把同类东西拆进两个动词族（`dev.server` + `serve.prod` 不成体系，应为 `serve.dev` + `serve.prod`）。包清单之外的入口脚本（PowerShell、Makefile、justfile）按意图在动词域内命名——`server-release.ps1` 是 `serve.prod`，不是 `dev.*` 变体。
2. `[project]` 和 `[[actions]]` 是仅有的顶层表形式。
3. 保留仓库支持的核心动作；权威任务定义暴露了项目专属的开发、测试、门禁、分发变体时才补充。
4. 每条命令都是显式 argv 数组。禁止 shell 字符串、管道、重定向、命令串联、隐式切换工作目录。
5. 门禁动作用 `kind = "gate"` 标记；runner 从可执行文件推导可用性，将来装上工具即自动激活，接口无需改动。
6. 动作 id 里绝不出现 `list`、`show`、`doctor`、`help`、`run`。
7. 不要用 JSON 冒充 TOML 数组绕路。TOML 解析归生成的 runner 所有；格式化工具写出的多行数组与注释都是合法输入。

## 验证结果

全部检查在仓库根目录执行：

```powershell
.\run
.\run doctor
.\run <safe-action> -n
.\run list --json
```

macOS 或 Linux 用 `./run`。确认：裸 run 能列出动作；doctor 能区分"可选门禁工具暂不可用"与真失败；预览不启动子进程；JSON stdout 恰好解析为一个 JSON 文档。至少真实执行一个安全动作并核对退出码不变。在 Windows 上，这个真实动作必须选一个可执行文件经 PATHEXT 解析为 `.cmd`/`.bat` 的（通常是 npm）——在 Node 18.20+/20.12+ 上，doctor 报可用并不证明可执行，因为这些版本拒绝无 shell 地 spawn 批处理文件。

命名一致性用本 skill 的校验器闭环（结构归 `run.schema.json`，"义"归它）：

```powershell
node <skill-dir>/scripts/check_naming.mjs <repo>
```

要求零 error 收工；warn 逐条确认（已登记的动词域扩展或确有必要的机械映射改名）。

改协议字段、保留字、退出码语义或机器输出之前，先读 [references/run-standard.md](references/run-standard.md)。修改本 skill 的指令或资源后，用 skill-creator 的 `quick_validate.py` 验证。
