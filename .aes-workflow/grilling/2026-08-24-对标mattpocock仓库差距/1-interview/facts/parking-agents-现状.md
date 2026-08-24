# Fact: parking-agents 现状

- 派遣问题:查清本仓库的定位与入口、双树结构与同步机制、版本与发布、测试与 CI、evals 产物、文档体系六方面事实,为对标高星 skill 仓库的差距清单供料。
- 完成:2026-08-24T18:23:38+08:00

## 查到的

### 1. 仓库定位与使用入口

| 事实 | 证据出处 |
| --- | --- |
| 仓库自述为「个人跨平台 skill 库 + VS Code Copilot agent 工具箱」,并明说「体系未完成,随用随加」「不保证稳定」 | `README.md:3`、`README.md:249` |
| 仓库定位是「两半」:`skills/` 跨平台技能库(9 harness 共享)与 `.copilot/agents/` VS Code Copilot 专用 agent,互不依赖 | `README.md:5-14` |
| 本机安装入口是仓库根的双击 `.cmd`:`install-skills-agents.cmd` → junction 到 `~/.agents/skills`,`install-skills-claude.cmd` → `~/.claude/skills`,对应 `npm run install:skills:*` | `README.md:58-67`、`install-skills-agents.cmd:2-12` |
| `scripts/` 的角色:`bump-version.mjs` 版本锁步 + `install/uninstall-skills-*.mjs` 安装器(安装器本体为 `install-skills.mjs`,两侧入口包装) | `README.md:32`、`scripts/install-skills.mjs:104`(`installSkills()`) |
| `gemini-extension.json` 的角色:Gemini CLI 扩展清单,声明 `contextFileName: GEMINI.md`(后者 @-include AGENTS.md),自身带 version 0.1.0 | `gemini-extension.json:4-5`、`README.md:108` |
| 平台插件安装共支持 9 个 harness;验收状态分层:✅ 已跑端到端验收(Claude Code/Codex/Pi),⚠️ 集成已写好+契约测试覆盖但未端到端验证(Cursor/Gemini/OpenCode/Kimi/Copilot CLI/Antigravity),❌ VS Code Copilot 明确不适配 | `README.md:71-130` |
| 各平台清单分散在 `.claude-plugin/ .codex-plugin/ .cursor-plugin/ .kimi-plugin/ .pi/ .opencode/` + `gemini-extension.json` | `README.md:43-45` |

### 2. 双树结构与同步机制

| 事实 | 证据出处 |
| --- | --- |
| 目录约定:`skills/` 是三分类两层布局(`engineering/<name>/`、`productivity/<name>/`、`pub/<name>/`,每类一份 README 讲触发语义);`.agents/skills/` 是开发侧扁平全量真源 | `README.md:19-24`、`skills/engineering/README.md:1-9` |
| 技能数量:发布侧 `skills/` 共 28 个(engineering 18 + productivity 7 + pub 3);开发侧 `.agents/skills/` 共 30 个 | 目录清点(`ls skills/*/`、`ls .agents/skills/`,2026-08-24);README 亦自述「全量 30+」`README.md:24` |
| 两份数据集按技能名交集为 **0**:28 个发布侧技能没有一个存在于 `.agents/skills/`,两侧是完全不相交的两批技能,并非镜像/超集关系 | 目录清点 + `comm -12` 比对两侧技能名(结果为空) |
| README 自称「开发侧 `.agents/skills/` 是超集」,与实测「两侧零交集」矛盾——文档描述与实际内容漂移 | `README.md:146`(自称超集)vs 上一条实测 |
| 同步机制无脚本:约定是「两者改动需经移植流程同步,不视为同一份」,`scripts/` 下没有任何同步/移植脚本(只有 bump-version 和 install/uninstall) | `AGENTS.md:7-8`、`scripts/` 目录清点 |
| 双侧一致性校验不存在:`check:repo` 只对发布侧三个分区逐一跑结构检查器;`tests/skills/test-skill-discovery.mjs` 只断言 `.agents/skills/` 结构;没有任何脚本比对两侧内容 | `package.json:8`、`tests/skills/test-skill-discovery.mjs:3`、`scripts/` 目录清点 |
| 两侧合并只发生在安装时:安装器把 `.agents/skills` 与 `skills` 两个源按名扁平合并,重名时先列出的开发侧赢("dev side (wins clashes)" / "first source wins") | `scripts/install-skills.mjs:9-10`、`scripts/install-skills.mjs:61-64`、`scripts/install-skills.mjs:107-115` |
| 安装形态是每技能一条目录 junction(POSIX 退化 symlink),agent 直读工作区;安装附带体检:清死链、真实目录挪进 `skills-backup-<ts>/`、报告异常项 | `scripts/install-skills.mjs:12-31`、`README.md:67` |

### 3. 版本与发布

| 事实 | 证据出处 |
| --- | --- |
| 仓库单版本号 0.1.0(`package.json` 与六份平台 manifest 均为 0.1.0) | `package.json:3`、`.claude-plugin/plugin.json:3` |
| 版本管理是「七份 manifest 锁步」:`.version-bump.json` 注册 package.json + `.claude-plugin/plugin.json` + `marketplace.json` + `.codex-plugin` + `.cursor-plugin` + `.kimi-plugin` + `gemini-extension.json`,由 `node scripts/bump-version.mjs <ver>` 一次改齐 | `.version-bump.json:2-10`、`README.md:241-245` |
| `bump-version.mjs` 带 `--check`(报漂移)与 `--audit`(找出带版本但未注册的文件),两者已进 `npm test` | `.version-bump.json` 同文件、`scripts/bump-version.mjs:15-16`、`package.json:13` |
| **没有 LICENSE 文件**(package.json 声明 `"license": "MIT"` 但仓库无 LICENSE 文本) | `package.json:15`;`ls LICENSE*` 无结果 |
| **没有 CHANGELOG**(且 `--audit` 的排除表里预留了 `CHANGELOG.md`/`RELEASE-NOTES.md`,说明工具支持但文件从未创建) | `ls CHANGELOG*` 无结果;`.version-bump.json:13-14` |
| **没有任何 git tag**(本地 `git tag` 为空),即无版本标签、无基于 tag 的 release 流程 | `git tag` 输出为空 |
| **技能没有各自版本**:全部 SKILL.md frontmatter 无 `version:` 字段(全仓 grep 无命中),只有 name/description(/disable-model-invocation) | grep `^version:` --include=SKILL.md 无命中;样例 `skills/engineering/tdd/SKILL.md:1-4`、`.agents/skills/making-skills-cross-platform/SKILL.md:1-6` |
| 当前分支 `dev`,领先 `origin/main` 25 个提交;`origin/main` 最新提交是 2026-08-23 的 "delete dev" | `git branch --show-current`、`git rev-list --count origin/main..dev`=25、`git log -1 origin/main` |
| marketplace 名为 `parking-skills-dev`,插件名 `parking-skills`,作者 piaotonghu | `.claude-plugin/marketplace.json:2-10`、`.claude-plugin/plugin.json:2` |

### 4. 测试与 CI

| 事实 | 证据出处 |
| --- | --- |
| package.json scripts 共 7 个:`check:repo`、`install:skills:agents/claude`、`uninstall:skills:agents/claude`、`test` | `package.json:7-13` |
| `npm test` 是 9 段命令链:技能发现与结构断言 → 安装器测试 → 工具名 lint → session-start hook 三种 JSON 形状 → Pi 扩展注入与去重 → 各平台 manifest 契约 → bump-version `--check`/`--audit` → `check:repo` | `package.json:13`、`README.md:232` |
| 六个测试文件的主题:① `test-skill-discovery.mjs` `.agents/skills/` 结构断言(防静默失效);② `test-install-skills.mjs` 安装器夹具测试(create/keep/repoint/convert 决策);③ `test-no-tool-names.mjs` 技能正文禁写工具名 lint;④ `test-session-start.mjs` hook JSON 形状;⑤ `test-pi-extension.mjs` Pi 扩展;⑥ `test-harness-manifests.mjs` 各 harness manifest 契约 | `tests/skills/test-skill-discovery.mjs:3-5`、`tests/skills/test-install-skills.mjs:3-6`、`tests/skills/test-no-tool-names.mjs:3-9`、`tests/hooks/test-session-start.mjs:3-6`、`tests/pi/test-pi-extension.mjs`、`tests/harnesses/test-harness-manifests.mjs:3-7` |
| **npm test 覆盖的是安装器/结构/集成契约(基础设施),不测技能内容质量,也不跑任何技能触发/输出 evals** | `package.json:13`(测试链中无 eval 相关命令)、`README.md:232-234` |
| `check:repo` 用的结构检查器 `check-skill-repo.mjs` 是可复用工具(repo-agnostic),把「静默失败变成响亮失败」 | `.agents/skills/making-skills-cross-platform/scripts/check-skill-repo.mjs:1-13` |
| **没有任何 CI**:仓库无 `.github/` 目录(无 workflows) | `ls .github` → No such file or directory |

### 5. 评测(evals)

| 事实 | 证据出处 |
| --- | --- |
| 开发侧技能普遍带 per-skill evals 文件:`trigger-evals.json`(query + should_trigger 二分类)存在于 analyze、karpathy-llm-wiki、parking-skill-creator、shopping-deep-research、workflow-interview-web 等;`output-evals.json`(prompt + assertions,含 manual 断言类型)存在于 karpathy-llm-wiki、log-error-summary、shopping-deep-research、steelman-analysis、workflow-interview-web | 目录清点 `find .agents/skills -iname "*eval*"`;样例 `.agents/skills/shopping-deep-research/trigger-evals.json:1-4`(20 条 query)、`.agents/skills/shopping-deep-research/output-evals.json:1-10` |
| parking-skill-creator 是 eval 工具化所在:有 `run-tests.mjs`(技能自带回归)、`scripts/aggregate-trigger.mjs`(聚合 trigger evals)、`live-trigger-evals.json`、`eval-viewer/`(generate-review.mjs + viewer.html) | `.agents/skills/parking-skill-creator/run-tests.mjs:1-4`、`grep trigger-evals` 命中该技能两个脚本、`eval-viewer/` 目录清点 |
| 发布侧 `skills/` 几乎无 evals:唯一一份是 `skills/pub/shadcn/evals/evals.json`(skill_name + prompt + expected_output 格式,属上游移植产物);engineering/productivity 28 技能均无 evals | `find skills -iname "*eval*"` 仅 1 命中;`skills/pub/shadcn/evals/evals.json:1-5` |
| eval 工作区是 gitignored 草稿:`/.agents/evals/` 被忽略(内有 aes-grilling-workspace 等运行时工作区),「durable records live in each skill dir」 | `.gitignore:13-14`、`ls .agents/evals` |
| `.copilot/agents/eval/` 是另一套行为 eval:从 VS Code Copilot debug-logs(JSONL)两阶段管线(extract-outputs.js → run-eval.js + test-cases/*.yaml 声明式断言)验证 agent 行为合规 | `.copilot/agents/eval/README.md:3-14`、目录含 `analyze-interactions.js/extract-outputs.js/run-eval.js/test-cases` |
| `docs/eval-gates-best-practices.md` 是 eval/门禁方法论调研文档(40 参考仓核查版),非可运行脚本 | `docs/eval-gates-best-practices.md:1-6` |
| **npm test 不运行任何技能 evals**(触发或输出);evals 也没有统一入口命令,须逐技能手跑 | `package.json:13` 测试链无 eval 项 |

### 6. 文档体系

| 事实 | 证据出处 |
| --- | --- |
| docs/ 结构:`agents/`(issue-tracker、triage-labels、domain 三份约定)、`research/`(9 篇调研产出)、`retrospectives/`(复盘)、`design/`、`reports/`(gitignored 运行报告)、顶层 testing.md / install-layout.md / porting-to-a-new-harness.md / GOALCONTRACT-GUIDE.md / eval-gates-best-practices.md | `docs/` 目录清点;`README.md:36-41` |
| `docs/reports/` 整目录被 gitignore(0 个文件被 git 跟踪),虽盘上有 8 个报告目录 | `git ls-files docs/reports` 计数 0;`.gitignore:5`;目录清点 |
| CONTEXT.md 是领域术语表(单一上下文 single-context):目前 12 条术语全部围绕 aes-qa 测试域(aes-qa、aes-gate、可辩护、契约 AC 等) | `CONTEXT.md:1-44` |
| CONTEXT.md 声称「决策记录在 `docs/adr/`」,但 **`docs/adr/` 目录不存在**(按 AGENTS.md 是 domain-modeling 按需惰性创建,至今未创建) | `CONTEXT.md:3`;`find -type d -name adr` 无命中;`AGENTS.md:24` |
| `docs/agents/` 三文件是技能族的 per-repo 配置:issue-tracker(GitHub Issues + gh CLI)、triage-labels(五标签)、domain(单一上下文约定) | `docs/agents/issue-tracker.md:1-3`、`docs/agents/triage-labels.md:1-3`、`docs/agents/domain.md:1-3`、`AGENTS.md:10-24` |
| `hooks/session-start`(bash)在每次会话注入 AGENTS.md 仓库约定,是「集成本身」;Cursor 用独立 schema 文件 `hooks-cursor.json` | `hooks/session-start:1-13`、`README.md:33`、`README.md:140`、`hooks/` 目录清点 |
| 工程侧技能来自 Matt Pocock skills,迁移约定「保持正文原文」便于将来同步上游 | `README.md:193` |
| `.aes-workflow/`、`.aes-worktree-board/` 是工作流技能族运行时目录,有意入库 | `README.md:52-53` |

## 未知项

- GitHub 远端有没有 Releases 页面内容:本地 `git tag` 为空已证无标签 release,但远端网页上的 Release/描述未验证(本次未走网络查询)。
- 发布侧 28 个技能正文是否仍与 mattpocock/skills 上游逐字一致(README:193 仅是单方声明,未做逐字 diff)。
- 两侧零交集是「有意设计」还是「文档过时」:README:24/146 与 AGENTS.md:7-8 描述的「移植流程同步」找不到任何脚本或文档化的操作步骤(`docs/porting-to-a-new-harness.md` 讲的是移植到新 harness,不是 .agents→skills 移植),该流程的实际操作方式无法从仓库内证据确定。

## 没查的

- 参考仓(mattpocock/skills 等高星 skill 仓库)的形态与标准:不归本次派遣,本次只查 parking-agents 现状。
- `.copilot/agents/` VS Code Copilot 那一半的 agent 编排细节(仅确认了 eval/insight 工具链存在与入口):与「skill 开发与发布」差距清单关系弱。
- 各平台 manifest(`.pi/ .opencode/ .kimi-plugin/` 等)字段级内容:只确认存在与版本锁步关系,未逐个展开。
- `docs/research/`、`docs/retrospectives/` 各文档内容质量:只清点了数量与主题,内容不改变差距清单事实。
