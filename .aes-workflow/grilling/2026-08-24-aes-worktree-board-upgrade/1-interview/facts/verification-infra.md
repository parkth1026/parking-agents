# Fact: verification-infra

- 派遣问题：parking-agents 仓库现有的验证基建有哪些？这决定了「aes-worktree-board 升级改造」的验收条件能靠什么自动判定。
- 完成：2026-08-24T08:30:00Z（subagent 为只读模式，由宿主代写落盘）

## 查到的

| 事实 | 证据出处 |
|---|---|
| 仓库级测试入口只有 `npm test`，串联 7 个 Node 脚本 + `check:repo` | `package.json:13` |
| **`npm test` 当前是红的**：test-no-tool-names、test-session-start、test-harness-manifests 三条退出 1；`check:repo` 指向的 `skills/making-skills-cross-platform/scripts/check-skill-repo.mjs` 已不存在 | 实跑各命令 |
| 通过的：`test-skill-discovery`（30 skills 结构合法，覆盖 aes-worktree-board 的 frontmatter/目录断言）、`bump-version --check` | 实跑 |
| 没有任何 CI：仓库无 `.github/`，无 workflow 配置 | `ls -d .github` |
| 测试哲学：零依赖纯 Node（`node:test`/`node:assert`），doc-contract 测试不证明端到端；人工验收 = 干净会话 + 不含技能名的一句话触发 | `docs/testing.md:1-7,41-70` |
| parking-skill-creator 验证能力四类：① `quick-validate.mjs`（frontmatter 规则集）② 技能自带 `run-tests.mjs` 回归 ③ 输出评测 gate 制（with/without/old_skill + aggregate-benchmark + eval-viewer）④ 触发评测（subagent 探针 + aggregate-trigger，产出 trigger-benchmark.json） | `.agents/skills/parking-skill-creator/SKILL.md:119-121,157,194,227,309-315` |
| **aes-worktree-board 从未接入 parking-skill-creator 流水线**：无 run-tests.mjs、无 trigger-evals.json、无 references/design.md；接入属新增而非沿用 | grep/ls 实测 |
| 已接入触发评测的模板技能：analyze、karpathy-llm-wiki、parking-skill-creator、shopping-deep-research、workflow-interview-web | `find .agents/skills -name "trigger-*.json"` |
| aes-worktree-board 自有验证入口是分域自检 `node scripts/selftest.mjs <domain>`，七域：`collect / fixture / dispatch / server / repo-root / layout / windows-hide`；成功打印 `{"ok":true}`，失败退 1 | `selftest.mjs:1221-1241`、`SKILL.md:94-96` |
| `collect` 域是**联网域**（打 gh 与线上全量对账）；`fixture` 域是**唯一完全离线域**（508KB fixture + server 断言），最适合做升级验收 | `selftest.mjs:158-241,243-286` |
| `dispatch` 域：临时 Git worktree fixture，验证 .cmd 解析、DIRTY 拒绝(退3)、PID 锁(退2)、`/api/dispatch` 409/202、任务三件套 | `selftest.mjs:731-856` |
| `repo-root` 域：跨仓 collect/dispatch、非 Git 目标快速失败、跨仓 runtime 隔离、技能目录零写入证明 | `selftest.mjs:470-682` |
| `layout` 域含**零 npm 依赖机械断言**（import 只许 `node:` 或 `./`）；`windows-hide` 域机械扫描所有 spawn 调用点必须带 windowsHide | `selftest.mjs:1160-1219,927-969` |
| aes-worktree-board 自检**不在 `npm test` 里**，须手工按域跑 | `package.json:13` |
| SKILL.md 明说自检边界：「页面视觉与交互仍需真实浏览器对照 mock 与 handoff，不能由自检替代」 | `SKILL.md:96` |
| board.html 前端无任何自动化断言（selftest 只断言两个字符串），升级涉及页面时缺自动判定手段 | `selftest.mjs` fixture 域 |
| 目标 issue 仓是 `51world-ai-copilot/aes-agent`（不是 parking-agents）；board.config.json 含 `test` 假 agent（node -e 回显，3 秒 done），是离线跑 dispatch 的关键 | `board.config.json` |
| fixture 采集/消费/校验三条命令齐备（capture-issues-fixture.mjs、`--issues-fixture`/环境变量、selftest fixture 域）；fixture 断言硬编码 #61 blockedBy=[58,59,60] 与 ≥60 条下限 | `capture-issues-fixture.mjs:1-22`、`collect.mjs:180-509` |
| `docs/agents/issue-tracker.md` 固化 wayfinding 口径：GitHub 原生 issue dependencies、frontier 定义、claim=add-assignee | docs/agents/issue-tracker.md |
| `docs/eval-gates-best-practices.md` 给出门禁方法论（场景三件套、基线棘轮、sentinel/full 分层），可作升级验收条款写法参照 | `docs/eval-gates-best-practices.md:1-40` |
| `docs/GOALCONTRACT-GUIDE.md` 要求验收条款必须是「可执行命令/具名文件/门槛值」形态 | `docs/GOALCONTRACT-GUIDE.md:30,103,199` |
| `.mjs` 零依赖约定被现有脚本遵守（layout 域机械保证）；`.agents/skills/` 是开发侧真源、`skills/` 是发布侧，需移植流程 | `AGENTS.md:6-8` |
| 本机 Node v24.19.0；代码特性隐含 ≥20.6；**package.json 无 engines 字段，最低版本无书面记载** | `node --version`、`package.json` |

## 未知项

- `npm test` 三条红灯是历史遗留还是最近回归，未追溯；「npm test 全绿」目前**不能**直接当验收门槛。
- collect/dispatch/repo-root/server/windows-hide 五域未实跑（联网/写 TEMP/spawn 超出只读边界），当前是否通过、耗时未知。
- fixture 与线上 issue 的漂移程度未核（线上变动会红 collect 域而不红 fixture 域）。
- 输出评测/触发评测对「有 CLI、无自然语言输出」技能是否有意义，无先例。
- harness 清单（.claude-plugin 等）是否登记 aes-worktree-board、harness-manifests 失败是否相关，未查。

## 没查的

- test-install-skills、test-pi-extension 具体断言（会写文件，未实跑）。
- bump-version --audit 判定逻辑；hooks/session-start 失败根因。
- selftest 各域引入顺序与历史红灯记录。
- 51world-ai-copilot/aes-agent 仓库本身的 issue 现状（跨仓）。
