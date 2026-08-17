# ue-error-solver `config` 子命令：配置解析链与 NAS 故障表现分析

> 分析方法：按 `analyze` 技能（read-only 深度分析）执行；除本报告外未创建/修改任何文件。
> 三个探测均在本机实际运行过（无副作用路径），结果作为直接证据引用。
> 分析对象：`G:/GIT/AI_WorkFlow/parking-agents` @ HEAD `f1da45d`（该文件最后变更于 `91bb96d`）。

## Question

`node scripts/UeErrorSolver.mjs config` 的配置值按什么顺序、从哪几层文件解析合并出来？NAS 挂掉的话脚本会有什么表现？（附带识别版本陷阱）

## Ranked synthesis

| Rank | 结论 | Confidence | Basis |
|------|------|------------|-------|
| 1 | **两层合并**：技能默认层 `<skill>/config.json`（可用 `--config` 换路径）⊕ 环境层（**三选一**、第一个存在者生效：`$SKILL_ENV` > `~/.config/parking-agents/skill-env.json` > `~/.claude/skill-env.json`），`deepMerge` 深合并、环境层优先、数组整体替换。环境层三候选之间**互不合并** | High | 代码 `UeErrorSolver.mjs:48-55,110-128,39-45` + 本机实测（env 覆盖 defaults、defaults 独有键保留） |
| 2 | **环境层是硬性依赖**：三层候选全不存在 → stderr 打印三步配置引导后 `exit 1`，不输出任何 JSON。本机（三层全无、`SKILL_ENV` 未设置）实测即此路径 | High | 代码 `:57-68,114-115` + 本机实测（EXIT=1） |
| 3 | **NAS 挂掉 → fail-fast**：合并完成后、一切字段校验之前，`assertNasReachable` 对配置中所有 UNC 路径检查"共享根（`//主机/共享`）可达性"，不可达 → stderr 打印 4 行"现状报告: NAS 不可达"，stdout 为空，`exit 1` | High | 代码 `:71-74,77-107,126` + 实测（无效主机 0.245s 退出，EXIT=1，stdout 空） |
| 4 | **版本陷阱确实存在且是三代的**：`91bb96d`（2026-08-16"skill-env 迁 XDG"）把环境层从 `$SKILL_ENV \|\| ~/.claude/skill-env.json`（两候选 OR、缺失时静默、无 NAS 检查、无 `_configSource`）改成现行三层链；而技能目录里的 `workflow.html`（未被该提交更新）仍描述最老的"config.json 单文件"PowerShell 时代模型。三个信息源（workflow.html / SKILL.md / 脚本）口径不一致，脚本是权威 | High | `git show 91bb96d` 完整 diff + `workflow.html:544-606` vs `SKILL.md:27` vs `UeErrorSolver.mjs:8-12` |
| 5 | **NAS 挂掉的影响面不是全脚本**：所有读配置的子命令（`config`/`check-env`/`find-job`/`console-log`/`build-result`/`save-log`，以及未传对应 flag 时的 `resolve-error-file`/`search-kb`/`save-knowledge`）都会被 NAS 检查拦下；其余 12 个不调 `loadConfig` 的子命令（`parse-url`、`extract-errors`、`fix-branch`、`git-submit`、`gitlab-mr` 等）完全不受影响 | High | `loadConfig` 全部调用点：`UeErrorSolver.mjs:951(经245),968,1005,1022,1049,1066,1100,1150,1252` |
| 6 | NAS 检查通过但子目录缺失时的行为不同：`rawDir`/`tmpDir` 缺失会被**自动创建**（NAS 上懒建目录），`wikiDir` 缺失仅记 warning；若 NAS 可达但 mkdir 失败（如权限），异常抛给 `main` 的 catch，输出 JSON error 后 `exit 1` | Medium-High | 代码 `:269-281,1329-1333`；自动创建行为实测确认（本地目录），NAS 上 mkdir 失败路径未实测 |

## Evidence

### A. 解析链代码路径（子问题 1）

- `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/scripts/UeErrorSolver.mjs:8-12`（文件头注释）— 官方自述："配置 = 技能固有默认（config.json，默认取脚本上级）⊕ 环境层，深合并，环境层优先。环境层解析链…`$SKILL_ENV` > `~/.config/parking-agents/skill-env.json` > `~/.claude/skill-env.json`（旧位置回退）；三层都无 → 打印配置引导后 exit 1；配置加载成功后首步对 UNC（NAS）路径做 fail-fast 连通检查"。
- `UeErrorSolver.mjs:944` — `CONFIG_FLAG`：`--config` 的默认值是 `join(scriptDir, "..", "config.json")`，即**默认层路径可被 `--config` 覆盖，但环境层链不可**。
- `UeErrorSolver.mjs:110-128` — `loadConfig` 执行顺序（这就是"按什么顺序"的直接答案）：
  1. `:111-113` 读默认层 `configPath || <skill>/config.json`（存在才读，BOM 容错见 `:34-36`）；
  2. `:114` `resolveEnvLayer()` 选环境层；
  3. `:115` 无环境层 → `guideOnMissingConfig()` → `:67` `process.exit(1)`；
  4. `:117-124` 读环境层 JSON，损坏 → stderr 报错（含文件路径与 parse 错误）+ `exit 1`；
  5. `:125` `deepMerge(defaults, env)`；
  6. `:126` `assertNasReachable(merged)`；
  7. `:127` 返回合并结果。
- `UeErrorSolver.mjs:48-55` — `resolveEnvLayer`：按序构造候选 `[ $SKILL_ENV(若设置, via:"SKILL_ENV"), ~/.config/parking-agents/skill-env.json(via:"new"), ~/.claude/skill-env.json(via:"fallback") ]`，**`for … if (existsSync) return` —— 第一个存在的文件生效，后续不再看**；全无返回 `null`。三个文件之间没有合并关系。
- `UeErrorSolver.mjs:39-45` — `deepMerge(base, over)`：`over`（环境层）为数组 → 整体替换（`:40`，不拼接）；标量/null → 直接覆盖（`:41`）；对象 → 逐键递归（`:43`）。**没有删除键的机制**，默认层独有的键全部保留（含 `_README`）。
- `U:/…路径解析` `UeErrorSolver.mjs:131-136` — `resolveConfigPath`：`~/` 展开到 home；`./` 相对 skill 目录；其余相对路径相对 `cwd`（`resolve()` 语义）。
- `UeErrorSolver.mjs:244-285` — `resolveFullConfig`（仅 `config` 子命令走完整校验）：`gitRepos` 必需且目录必须存在（`:248-256`，缺失 → stdout JSON error + exit 1）；`knowledgeBase.wikiDir/rawDir` 必需（`:258-265`）；`wikiDir` 缺失仅 warning（`:269-271`）；`rawDir` 缺失自动 `mkdirSync`（`:272-275`）；`tmpDir` 取 `config.tmpDir` 或退回 `os.tmpdir()/ue-error-solver`（`:139-142,277-281`）。
- `UeErrorSolver.mjs:947-958` — `config` 子命令：`resolveFullConfig` 成功后再调一次 `resolveEnvLayer()`（`:953`）注入 `_configSource = { path, via }`（via ∈ `SKILL_ENV|new|fallback`，`:954`），最后 `output(cfg)` 输出 JSON。
- `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/config.json:1-3` — **默认层现状只有一个 `_README` 字符串，没有任何业务值**。即当前版本的默认层实际上是"空壳 + 文档"，有效配置几乎全部来自环境层文件。
- `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/config.example.json:2-11` — 模板（拷到 `~/.config/parking-agents/skill-env.json` 即可用）：`jenkins.baseUrl=http://10.66.12.40`、`gitRepos=D:/Git`（本地盘）、`knowledgeBase.rawDir/wikiDir` 与 `tmpDir` 均为 `//nas.51vr.local/x.public/UE5/ue-llm-wiki/…`（NAS UNC）。`_README` 同时说明该文件是"工具中立位置，与 jenkins-log-auto-learning 等技能共享同一份"。
- `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/SKILL.md:27` — SKILL.md 的配置段与脚本头注释一致（三层链 + 深合并 + `_configSource`）。

### B. 本机实测（直接证据）

- **探测 1（环境层缺失，本机真实状态）**：本机 `$SKILL_ENV` 未设置，`~/.config/parking-agents/skill-env.json` 与 `~/.claude/skill-env.json` 均不存在（`ls` 验证）。运行 `node scripts/UeErrorSolver.mjs config` → stderr 打印"未找到配置文件（已查: $SKILL_ENV（未设置）、C:\Users\parking\.config\parking-agents\skill-env.json、C:\Users\parking\.claude\skill-env.json）"+ 三步引导（拷模板→放到新路径→改 gitRepos），**stdout 无输出，EXIT=1**。
- **探测 2（NAS 不可达）**：用 `$SKILL_ENV` 指向一个 `//nas-probe.invalid/x.public/...`（无效主机）的临时配置运行 `config` → stderr：

  ```
  现状报告: NAS 不可达
    不可达路径: \\nas-probe.invalid\x.public\UE5\ue-llm-wiki\raw（knowledgeBase.rawDir、knowledgeBase.wikiDir、tmpDir，共享根 //nas-probe.invalid/x.public）
    受影响操作: 知识库读写（raw/wiki）、学习账本、日志暂存均位于 NAS，本次操作无法继续
    建议检查: 网络或 VPN 连接; NAS 共享权限; 共享根主机是否在线
  ```

  stdout 空，EXIT=1，耗时 0.245s（无法解析的主机名快速失败）。
- **探测 3（合并优先级，成功路径）**：默认层放 `{"_README":"PROBE-DEFAULTS","jenkins":{"baseUrl":"http://from-defaults","envOnlyKeep":"kept-from-defaults"},"gitRepos":"G:/NONEXISTENT-DEFAULT"}`，环境层（经 `$SKILL_ENV`）放冲突值。输出 JSON 精确验证了合并语义：`jenkins.baseUrl="http://from-env"`（环境层覆盖）、`jenkins.envOnlyKeep="kept-from-defaults"`（默认层独有键保留、**对象内逐键合并而非整对象替换**）、`gitRepos` 取环境层的 `G:\GIT`（覆盖默认层的无效值）、`_README` 透传、`warnings` 含"wikiDir directory not found / rawDir created / tmpDir created"、`_configSource={"path":"<env文件>","via":"SKILL_ENV"}`，EXIT=0。

### C. NAS 挂掉的代码路径（子问题 2）

- `UeErrorSolver.mjs:77-107` — `assertNasReachable` 全文：
  - `:79-86` 检查字段清单：`knowledgeBase.rawDir`、`knowledgeBase.wikiDir`、`tmpDir`、`trackFile`、`workflowFile`、`gitRepos`（后三者本技能模板未用，为与 jenkins-log-auto-learning 共享实现而保留）；
  - `:90-92` 每个字段先 `resolveConfigPath`，再用 `uncRoot`（`:71-74`，正则取 `//主机/共享` 前两段）提取共享根；**非 UNC（本地盘如 `D:/Git`）直接跳过不检查**（`:92` 注释"非 UNC（本地盘）不检查"）；
  - `:93` `existsSync(root)` 为假即记入 unreachable（按共享根分组，`:94-96`）；
  - `:98` 全部可达则静默返回；
  - `:100-105` 逐行打印现状报告（不可达路径 + 命中字段 label + 共享根、受影响操作、建议检查）；
  - `:106` `process.exit(1)`。
- `UeErrorSolver.mjs:70` 注释 — 设计意图："子目录允许懒创建，**根不可达才判定 NAS 不可达**"。即 NAS 在线但子目录缺失不算故障（由 `resolveFullConfig:272-281` 懒建/告警处理）。
- `UeErrorSolver.mjs:126` — NAS 检查位于 `loadConfig` 内、`resolveFullConfig` 的一切字段校验（gitRepos 缺失/not found 等）**之前**：若同时存在"NAS 挂"和"gitRepos 缺失"，用户先看到的是 NAS 报告。
- 失败模式对比（`config` 子命令，全部实测或代码直读）：

  | 场景 | stdout | stderr | exit |
  |---|---|---|---|
  | 环境层三层全无 | 空 | "未找到配置文件"+三步引导（`:62-66`） | 1 |
  | 环境层 JSON 损坏 | 空 | "环境层配置 … 不是合法 JSON（…）"（`:121`） | 1 |
  | **NAS 不可达** | **空** | **"现状报告: NAS 不可达" 4 行（`:100-105`）** | **1** |
  | gitRepos / knowledgeBase 缺失或目录不存在 | JSON `{error: …}` | 空（`:249-263`） | 1 |
  | 全部通过 | 完整合并配置 JSON（含 `_README`/`warnings`/`_configSource`） | 空 | 0 |

- NAS 检查影响面（按 `loadConfig` 调用点）：`config`（`:951` 经 `:245`）、`check-env`（`:968`）、`find-job`（`:1005`）、`console-log`（`:1022`）、`build-result`（`:1049`）、`save-log`（`:1066`）无条件触发；`resolve-error-file`（`:1100`，仅当未传 `--git-repos`）、`search-kb`（`:1150`，仅当未传 `--wiki-dir`/`--raw-dir`）、`save-knowledge`（`:1252`，仅当未传 `--raw-dir`）条件触发。**其余 12 个子命令不调 `loadConfig`，NAS 挂掉照常可用**：`parse-url`、`repo-checkouts`、`extract-errors`、`extract-build-cmd`、`source-context`、`git-history`、`local-build`、`fix-branch`、`git-submit`、`gitlab-mr`、`assert-build-passed`、`assert-files-in-repos`。
- `UeErrorSolver.mjs:104` — NAS 报告文案"受影响操作: 知识库读写（raw/wiki）、**学习账本**、日志暂存均位于 NAS"中"学习账本"是 jenkins-log-auto-learning 的概念（对照 `jenkins-log-auto-learning/scripts/config.mjs:124` 的同款文案多了"工作流状态"），本技能实际只有知识库读写与日志暂存放 NAS——文案是共享实现带来的措辞冗余，不影响行为。

### D. 版本陷阱（git 考古）

- `git log --follow` 该脚本仅两次提交：`b257841`（Node ESM 移植引入）与 `91bb96d`（2026-08-16 01:33 +0800，"skill-env 迁 XDG：SKILL_ENV>新路径>旧路径回退 + NAS fail-fast + 模板默认 NAS"，改动 12 个文件）。
- `git show 91bb96d` 中本脚本的 diff 直接给出**迁移前行为**（均为被删除的旧代码）：
  - 旧环境层：`const envPath = process.env.SKILL_ENV || join(homedir(), ".claude", "skill-env.json")` — 只有**两候选、OR 语义、无 XDG 路径**；
  - 旧版环境层缺失时：`if (existsSync(envPath)) env = readJson(envPath); return deepMerge(defaults, env)` — **静默退化为纯默认层，不报错不退出**（新版改为硬性引导退出）；
  - 旧版**没有 `assertNasReachable`** —— NAS 挂掉的表现是后续深处文件操作抛裸 ENOENT/异常，由 `main` 的 catch（`:1329-1333`）转成 JSON error；
  - 旧版环境层 JSON 损坏无 try/catch，异常同样走 `main` catch 输出 stdout JSON error（新版改为 stderr 专文案 + exit 1）；
  - 旧版 `config` 输出**没有 `_configSource`**；
  - 旧报错文案指向 `~/.claude/skill-env.json`，新版全部改为 `~/.config/parking-agents/skill-env.json`。
- `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/ue-error-solver/workflow.html:544-606` — **未被 91bb96d 更新**（文件时间 8 月 4 日，早于迁移提交），其中"配置结构 (config.json)"一节仍描述：所有配置字段直接住在 skill 目录的 `config.json`、临时目录为 `$env:TEMP/ue-error-solver`、无环境层、无 NAS 检查——这是比"旧位置回退"更早一代（PowerShell 时代）的模型。同文件 `:228`（"从 skill 目录读取 config.json"）与 `:606`（"所有路径来自 config.json，不硬编码"）同口径。
- `git show 91bb96d -- .claude/skills/ue-error-solver/config.json` — 默认层在迁移前后都只有 `_README`（仅文字从"真实值见 ~/.claude/skill-env.json"改为三层链说明），即"默认层空壳"并非本次迁移引入。
- `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/jenkins-log-auto-learning/scripts/config.mjs:63-74,98-127` — 姊妹技能以同一套 `resolveEnvLayer`/`assertNasReachable` 实现共享同一份环境层文件（与 `config.example.json:2` 的"工具中立位置…共享同一份"互证）。

## Inference

- **配置值的实际来源**：按当前仓库状态，`config` 的输出值事实上 ≈ 环境层文件内容 + 透传的 `_README` + 运行期注入的 `warnings`/`_configSource`。默认层是空壳，"两层深合并"在今天的语义主要是**契约**（老版本/自定义 `--config` 可带真实默认值）而非当前生效的数据来源。
- **`SKILL_ENV` 指到不存在路径会静默降级**：`:50` 只在变量非空时入候选，`:53` 以 `existsSync` 定胜负——拼错的 `$SKILL_ENV` 不会报错，而是落到 XDG/旧位置文件。唯一暴露途径是成功输出里的 `_configSource.via`（若想确认确实用了 SKILL_ENV，看 via 是否为 `"SKILL_ENV"`）。这是排查"为什么改了配置不生效"时最可能的坑。
- **NAS 挂掉时 `config` 对程序化调用方不友好但可判别**：stdout 为空意味着调用方 `JSON.parse(stdout)` 会失败；三个 exit-1 场景（无配置/坏 JSON/NAS 挂）只能靠 stderr 文案区分，退出码相同（头部约定"业务失败 exit 1"）。
- **NAS 检查的时延上界不在脚本手里**：`existsSync` 没有设置超时。对不可解析主机名（本机实测 0.245s）很快；但若主机名可解析而 SMB 服务挂了/被防火墙静默丢包，Windows 会按 SMB 超时阻塞，每个字段各查一次同根（`:89-93` 循环内逐字段 `existsSync(root)`，模板配置下同一共享根最多查 3 次）——"fail-fast"是相对"深处炸裸栈"而言，墙钟时间在最坏网络条件下可能达数秒至更久。
- **为什么 NAS 检查放在字段校验之前**：`loadConfig` 被几乎所有需要路径的子命令复用，把连通性检查放在合并后第一拍，保证后续 `mkdirSync`（懒建 rawDir/tmpDir）和 KB 读写不会在 NAS 掉线时半途抛裸异常——`:70` 注释与 `jenkins-log-auto-learning/scripts/config.mjs:7-8`（"替代深处裸露的 ENOENT 堆栈"）互证这是有意设计。
- **弱解释被降级的原因**：不存在"三层环境文件互相叠加合并"的解读空间——`:53` 的 `for…return` 与探测 3 的实测共同排除了它；也不存在"NAS 挂掉时自动退回本地目录"的降级路径——`:106` 无条件 `exit(1)`。

## Unknowns / limits

- **主机在线但共享不可达/权限被拒时的实际时延与返回**未实测（需要可控的 NAS 环境）；代码层面只能确定"无超时、以 `existsSync` 布尔值为准"。
- **NAS 可达但 `mkdirSync` 失败**（如共享只读、配额满）的具体表现未实测——推断走 `main` catch → stdout JSON error + exit 1（`:1329-1333`），非 NAS 报告文案。
- **已被移除的 PowerShell 版（UeErrorSolver.psm1）**无法从当前仓库核对（`:3` 注明"原 PowerShell 版已按仓库脚本标准移除"），`workflow.html` 描述的最老一代配置模型只能作为间接佐证，其与当年 ps1 实际行为的差异不可考。
- 本机**不存在任何环境层文件**，因此"XDG 新路径 vs 旧位置回退在真实机器上的取舍"只有代码与 git 证据，无生产环境样本；`_configSource.via` 的 `new`/`fallback` 两种取值未在本机实测（只实测了 `SKILL_ENV`）。
- 下一步若要降低不确定性：在一台存有 `~/.claude/skill-env.json`（仅旧位置）的机器上跑 `config`，确认 `via:"fallback"` 及输出；以及用可达但无权限的 NAS 共享验证 mkdir 失败路径。两者均为只读/可回滚探测。

## 附：本次实测命令（均可安全复跑）

```bash
# 1. 环境层缺失（本机原样）
node scripts/UeErrorSolver.mjs config                       # stderr 引导，EXIT=1

# 2. NAS 不可达（SKILL_ENV 指向 //无效主机/… 的临时 JSON）
SKILL_ENV=<tmp.json> node scripts/UeErrorSolver.mjs config  # stderr 现状报告，EXIT=1

# 3. 合并优先级（--config 给含冲突键的默认层 + SKILL_ENV 给环境层）
SKILL_ENV=<env.json> node scripts/UeErrorSolver.mjs config --config <defaults.json>
# → env 覆盖冲突键、defaults 独有键保留、_README 透传、_configSource.via=SKILL_ENV，EXIT=0
```
