# `node scripts/UeErrorSolver.mjs config` 配置解析链与 NAS 宕机行为分析

分析对象：`G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/scripts/UeErrorSolver.mjs`（1339 行，commit `91bb96d`/`c7b4be7` 后的当前版本）。所有行号均指该文件，另附配置文件与 git 历史引用。本文所有结论均经本机实测验证（实测记录见第 5 节）。

---

## 1. 结论速览

1. 配置 = **两层深合并**：`config.json`（技能固有默认，取脚本上级目录）⊕ **环境层**（三层解析链取**第一个存在的文件**，不是三层叠加）。
2. 环境层解析链：**`$SKILL_ENV` > `~/.config/parking-agents/skill-env.json` > `~/.claude/skill-env.json`（旧位置回退）**（L48–55）。
3. 深合并语义：环境层逐字段覆盖默认层、未覆盖字段保留；**数组整体替换不拼接**（L39–45）。
4. NAS 挂掉：`loadConfig` 内 **fail-fast**——合并完成后第一件事就对所有 UNC 路径的 `//主机/共享` 根做 `existsSync` 探测，任一根不可达 → **stderr 打印"现状报告: NAS 不可达"→ exit 1**，stdout 无 JSON（L77–107、L126）。
5. 版本陷阱：这条三层链是 **2026-08-16 的 commit `91bb96d` 刚改的**；旧版只有 `$SKILL_ENV || ~/.claude/skill-env.json` 两层、无 XDG 中间层、无 NAS 检查、无 `_configSource`。且仓库里还留着一个**没有任何环境层概念的 PowerShell 旧副本**（`skills/dev/ue-error-solver/`）。

---

## 2. 配置解析链：顺序与层次

### 2.1 两层模型

```
最终配置 = deepMerge( 默认层 config.json , 环境层 skill-env.json )   ← 环境层优先
```

定义在文件头注释 L8–12 与 `loadConfig`（L110–128）。

### 2.2 默认层：`config.json`（脚本上级目录，不是 cwd）

- 入口有两处，殊途同归：
  - `config` 子命令的 `--config` flag 默认值：`join(scriptDir, "..", "config.json")`（L944），即 **脚本所在目录的上一级**，与当前工作目录无关；
  - `loadConfig(configPath)` 内部兜底：`configPath || join(scriptDir, "..", "config.json")`（L111）。
- 本仓库中该文件是 `.claude/skills/ue-error-solver/config.json`——**只含一个 `_README` 键，没有任何实际配置值**。所有真实字段都声明为"环境相关"，由环境层提供。
- 读取时容错：剥离 UTF-8 BOM 再 `JSON.parse`（`readJson`，L34–36；注释明言"历史 config 可能带 BOM"）。
- 注意：默认层 JSON 解析失败会**直接抛异常**，被 `main()` 的 try/catch 捕获后输出 `{error}` 并 exit 1（L1329–1333）；只有环境层解析失败才有专门的修复提示（见 2.4）。

### 2.3 环境层：三层解析链，"第一个存在者胜出"

`resolveEnvLayer()`（L48–55）按顺序构造候选并取**第一个 `existsSync` 为真的文件**，其余候选直接忽略（不叠加、不合并）：

| 优先级 | 候选 | `via` 标注值 | 说明 |
|---|---|---|---|
| 1 | `$SKILL_ENV` 环境变量指向的任意路径 | `"SKILL_ENV"` | 显式覆盖，仅当变量**已设置**才进入候选 |
| 2 | `~/.config/parking-agents/skill-env.json` | `"new"` | XDG 风格新位置（本机即 `C:\Users\parking\.config\parking-agents\skill-env.json`） |
| 3 | `~/.claude/skill-env.json` | `"fallback"` | 旧位置回退 |

关键细节：

- `homedir()` 取自 `node:os`（L23），Windows 上解析为 `C:\Users\<user>`。
- 选中哪一层由 `config` 子命令输出的 `_configSource: { path, via }` 标注（L950–955；`via` 取上述三个值之一）。注意 `resolveEnvLayer` 在 happy path 上会被调用两次（`loadConfig` 一次、`config.run` 里为 `_configSource` 再一次），幂等无害。
- 环境层文件与 `jenkins-log-auto-learning` 等技能**共享同一份**（见 `config.example.json` 的 `_README`），这是它放在 `~/.config/parking-agents/` 工具中立位置的原因。
- 模板：`.claude/skills/ue-error-solver/config.example.json`（默认即指向 NAS 知识库 `//nas.51vr.local/x.public/...`，`gitRepos: "D:/Git"`，`tmpDir` 也在 NAS 上）。

### 2.4 解析链的三种失败分支（均在合并前/合并时终止）

| 分支 | 触发条件 | 行为 | 退出码 |
|---|---|---|---|
| 三层全无 | `resolveEnvLayer()` 返回 null | `guideOnMissingConfig()`（L58–68）：stderr 打印已查路径 + 三步引导（拷模板 → 放到新位置 → 按机器改 `gitRepos`） | **1** |
| 环境层非法 JSON | 选中文件 `JSON.parse` 抛错 | stderr 指明文件路径与错误信息，提示参考模板重建（L117–123） | **1** |
| NAS 不可达 | 合并结果含不可达 UNC 根 | `assertNasReachable`（见第 3 节） | **1** |

### 2.5 合并语义：`deepMerge(base, over)`（L39–45）

- 环境层（`over`）非空即覆盖默认层（`base`）；默认层独有的键**原样保留**（实测：`_README`、`jenkins.extra` 均出现在最终输出）。
- 嵌套对象递归合并（实测：`--config` 给 `jenkins.baseUrl=A, extra=kept`，环境层只给 `jenkins.baseUrl=B` → 结果 `baseUrl=B, extra=kept`）。
- **数组整体替换**：环境层的数组直接 `slice()` 生效，不与默认层拼接（实测：默认 `[1,2,3]` + 环境 `[9]` → `[9]`）。注释原文："数组整体替换（不拼接）"。
- 标量/null 直接覆盖。

### 2.6 `config` 子命令在合并之后还做什么（`resolveFullConfig`，L244–285）

`config` 子命令（L946–958）= `loadConfig`（读+合并+NAS 检查）→ `resolveFullConfig`（校验+路径解析+目录兜底）→ 附加 `_configSource` → stdout JSON（exit 0）。顺序如下：

1. `gitRepos` 必填且目录必须存在，否则输出 `{error}` exit 1（L248–255）；
2. `knowledgeBase.wikiDir/rawDir` 必填（L258–265）；
3. `wikiDir` 不存在 → 只记 warning；`rawDir` 不存在 → **`mkdirSync(recursive)` 自动创建**并记 warning（L269–275）——这是一个写副作用；
4. `tmpDir` 缺省时回退 `os.tmpdir()/ue-error-solver`（`getTempDir`，L139–142），不存在则同样自动创建（L277–281）；
5. 所有 warning 汇入 `merged.warnings` 数组随 JSON 输出。

路径字符串的规范化规则（`resolveConfigPath`，L131–136）：`~/` 开头 → 展开 `homedir()`；`./` 开头 → 相对 **skill 目录**（不是 cwd）；其余相对路径 → 相对 cwd `resolve()`。

---

## 3. NAS 挂掉时脚本的表现

### 3.1 机制：`assertNasReachable`（L77–107），fail-fast、位于一切校验之前

调用点在 `loadConfig` 的最后一行（L126）——即 `resolveFullConfig` 的**第一行**（L245）。因此时序上：**NAS 连通检查发生在 gitRepos 存在性检查、knowledgeBase 字段校验、rawDir/tmpDir 自动创建之前**。NAS 挂了就轮不到后面任何步骤。

检查逻辑：

1. 收集合并配置中的 6 个候选路径字段：`knowledgeBase.rawDir`、`knowledgeBase.wikiDir`、`tmpDir`、`trackFile`、`workflowFile`、`gitRepos`（L78–86；`trackFile`/`workflowFile` 是共享 skill-env 的 `jenkins-log-auto-learning` 字段，本技能模板没有，但环境层若提供了也会被查）。
2. 每个字段先 `resolveConfigPath` 规范化，再用 `uncRoot`（L71–74）提取 `//主机/共享` 根——**只查 UNC 路径**；本地盘（`D:/Git`）和映射盘符（`Z:/...`）一律跳过（L92–93）。
3. 对每个根做 `existsSync`；不可达的根聚合后打印报告并 `process.exit(1)`（L98–106）。

### 3.2 实测表现（本机模拟 NAS 宕机，环境层指向 `//nas-down-test.51vr.local/x.public/...`）

stderr 输出（stdout **无任何 JSON**）：

```
现状报告: NAS 不可达
  不可达路径: \\nas-down-test.51vr.local\x.public\UE5\ue-llm-wiki\raw（knowledgeBase.rawDir、knowledgeBase.wikiDir、tmpDir，共享根 //nas-down-test.51vr.local/x.public）
  受影响操作: 知识库读写（raw/wiki）、学习账本、日志暂存均位于 NAS，本次操作无法继续
  建议检查: 网络或 VPN 连接; NAS 共享权限; 共享根主机是否在线
```

- **退出码 1**（业务失败；脚本约定 stdout JSON / exit 1 业务失败 / exit 2 用法错误，L6）。
- 报告按"共享根"聚合：同一 NAS 挂掉时三个字段合并成一行，列出各字段 label。
- 检查的是**共享根**（`//主机/共享`），子目录允许懒创建——根可达即放行（注释 L70："子目录允许懒创建，根不可达才判定 NAS 不可达"）。

### 3.3 需要知道的边界行为

- **影响面是全部读配置的子命令**：`config`、`check-env`、`find-job`、`console-log`、`build-result`、`save-log`、`resolve-error-file`、`search-kb`、`save-knowledge` 都要过 `loadConfig` → NAS 挂了全数 exit 1。NAS 在线时这些命令也不可用的只有一类：`console-log --save`、`save-log` 会把日志写到 NAS 上的 `tmpDir`（模板默认 `.../raw/tmp/ue-error`）。完全不碰配置、全靠显式参数的子命令（`parse-url --base-url`、`extract-errors`、`source-context`、`git-history`、`local-build`、`fix-branch`、`git-submit`、`gitlab-mr`、`assert-*`）不受影响。
- **根可达但深层路径坏的**（权限被删、子目录树损坏）：fail-fast 检查放行 → 走到 `resolveFullConfig` 的 `mkdirSync(rawDir)` / `mkdirSync(tmpDir)`（L273、L279）抛异常 → `main()` 捕获 → stdout `{error: ...}` + exit 1（L1330–1333）。
- **阻塞时长**：`existsSync` 对 UNC 是同步 SMB 探测。本机实测 DNS 解析失败的假主机约 0.15s 即返回；真实"主机名可解析但主机死机/网络黑洞"场景会阻塞到 SMB 超时（通常数秒级）才判定失败——脚本本身无超时参数。
- 映射盘符（如 `Z:/wiki`）指向 NAS 时**不会**被检查——`uncRoot` 只识别 `//host/share` 形态（L71–74）。

---

## 4. 版本陷阱（本仓库内现存三套"真相"）

输出目录名里的"版本陷阱"确实存在，来自三个方向：

### 4.1 `.mjs` 自身的解析链是刚变的（commit `91bb96d`，2026-08-16）

`git log --follow` 显示该文件只有两个 commit：`b257841`（初版）→ `91bb96d`（"skill-env 迁 XDG：SKILL_ENV>新路径>旧路径回退 + NAS fail-fast + 模板默认 NAS"）。**旧版与新版差异**（`git show 91bb96d` 的 diff 可见）：

| 维度 | 旧版（`b257841`） | 现版（`91bb96d`+） |
|---|---|---|
| 环境层候选 | `$SKILL_ENV` **或** `~/.claude/skill-env.json`（两层） | `$SKILL_ENV` > `~/.config/parking-agents/skill-env.json` > `~/.claude/skill-env.json`（三层） |
| 配置全无时 | **静默退化为仅默认层**（`_README` 裸配置），后续才报缺 `gitRepos` | 三步配置引导 + exit 1 |
| 环境层 JSON 坏 | 抛异常走通用 error | 专门提示修复该文件 |
| NAS fail-fast | 无 | 有（`assertNasReachable`） |
| `_configSource` | 无 | 有 |

陷阱：旧文档/旧肌肉记忆说"放 `~/.claude/skill-env.json`"——现版仍兼容（回退层），但若 `~/.config/parking-agents/skill-env.json` 也存在，**旧位置文件会被完全无视**（不是合并），且 `config` 输出的 `_configSource.via` 能用来确认实际生效的是哪层。

### 4.2 NAS 共享名刚改过（commit `c7b4be7`，2026-08-16）

模板与文档从 `//nas.51vr.local/PaaS/...` 改为 `//nas.51vr.local/x.public/...`。机器上若残留指旧共享名的 skill-env，`assertNasReachable` 会把"共享名过期"误报成"NAS 不可达"（`PaaS` 根不存在，报文一样是"现状报告: NAS 不可达"）——排障时先核对共享名。

### 4.3 `skills/dev/` 下的 PowerShell 旧副本仍在仓库里

`.claude/skills/ue-error-solver/scripts/UeErrorSolver.psm1` 已按 `b41a3cb`（"删除 PS 双胞胎"）删除，但 **`G:/GIT/AI_WorkFlow/parking-agents/skills/dev/ue-error-solver/scripts/UeErrorSolver.psm1` 仍被 git 跟踪**。其 `Read-SkillConfig` **只读模块目录上级的 `config.json`，根本没有环境层概念、没有 NAS 检查**；且它的 `config.json`（`skills/dev/ue-error-solver/config.json`）里是**写死的本地真实值**（`C:/Users/Administrator/memory/...`）。跑错副本（psm1 vs mjs）会得到完全不同的配置模型与失败行为。`.mjs` 文件头 L3 特意注明"唯一入口；原 PowerShell 版已按仓库脚本标准移除"，但 dev 目录这份是漏网的旧拷贝。

---

## 5. 实测验证记录（本机，2026-08-16）

本机基线：`SKILL_ENV` 未设置、`~/.config/parking-agents/` 与 `~/.claude/skill-env.json` 均不存在（三层全空）；NAS `//nas.51vr.local/x.public` 当前**可达**。

| # | 操作 | 结果 |
|---|---|---|
| 1 | `node scripts/UeErrorSolver.mjs config`（无任何环境层） | stderr 三步引导（列出已查的三个具体绝对路径），exit 1 |
| 2 | `SKILL_ENV=模板副本`（NAS 路径，NAS 在线） | NAS 检查放行 → 卡在 `gitRepos directory not found: D:\Git`（本机无 D:/Git），exit 1 |
| 3 | `SKILL_ENV=指向假主机 //nas-down-test.51vr.local/...` | stderr"现状报告: NAS 不可达"（rawDir/wikiDir/tmpDir 聚合为一行），exit 1，耗时 ~0.15s |
| 4 | `SKILL_ENV=全本地路径配置` | exit 0；输出含默认层 `_README`、环境层独有键、`_configSource.via="SKILL_ENV"`；`rawDir`/`tmpDir` 被自动创建并记入 `warnings`；`tmpDir` 回退 `os.tmpdir()/ue-error-solver` |
| 5 | `--config=含 baseUrl/default 与数组` + `SKILL_ENV=覆盖 baseUrl 与数组` | 环境层标量胜出、默认层兄弟键保留、数组整体替换（`[9]`） |

（测试用的临时 fixture 与自动创建的目录均已清理。）

---

## 6. 关键文件引用

- 主脚本：`G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/scripts/UeErrorSolver.mjs`
  - L8–12 配置模型与解析链总注释；L34–36 `readJson`（BOM 容错）；L39–45 `deepMerge`；L48–55 `resolveEnvLayer`；L58–68 `guideOnMissingConfig`；L71–74 `uncRoot`；L77–107 `assertNasReachable`；L110–128 `loadConfig`；L131–136 `resolveConfigPath`；L139–142 `getTempDir`；L244–285 `resolveFullConfig`；L944 `CONFIG_FLAG`；L946–958 `config` 子命令；L1306–1313 `usage`
- 默认层（仅 `_README` 存根）：`G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/config.json`
- 环境层模板（默认 NAS）：`G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/config.example.json`
- 技能文档（配置约定）：`G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/SKILL.md`（L27）
- 旧 PowerShell 副本（无环境层、无 NAS 检查、config.json 含写死本地值）：`G:/GIT/AI_WorkFlow/parking-agents/skills/dev/ue-error-solver/scripts/UeErrorSolver.psm1`、`G:/GIT/AI_WorkFlow/parking-agents/skills/dev/ue-error-solver/config.json`
- 关键 git commit（均在 2026-08-16）：`91bb96d`（三层链+NAS fail-fast+`_configSource`）、`c7b4be7`（NAS 共享名 PaaS→x.public）、`b41a3cb`（删 `.claude` 下 PS 双胞胎）、`b257841`（初版两层链）
