# transcript（run 最终回复）

分析完成，报告已保存至 `G:/GIT/AI_WorkFlow/parking-agents/.claude/skills/analyze-workspace/iteration-1/eval-简单问题-深度适配/without_skill/run-1/outputs/analysis.md`。

## 核心结论

**`npm test` 是什么**：不是一个测试框架，而是 `package.json` 里用 `&&` 串起来的 8 步顺序执行链（前一步失败即停止），全部基于 Node 内置能力，零第三方测试依赖。

**具体跑了 8 件事**：
1. `tests/skills/test-skill-discovery.mjs` — 断言 `skills/` 每个技能是一级子目录、`SKILL.md` 存在、frontmatter 合法、引导技能及其 4 个工具映射文件齐全
2. `tests/skills/test-no-tool-names.mjs` — 扫描技能正文，禁止出现任何特定平台的工具名（技能只描述"动作"，工具映射放 references）
3. `tests/hooks/test-session-start.mjs` — 真实执行 session-start 钩子，验证 Claude Code / Cursor / Copilot 三种平台各自输出恰好一个正确字段的 JSON
4. `node --test tests/pi/test-pi-extension.mjs` — 6 个 node:test 用例，测 Pi 扩展的生命周期钩子、引导注入/去重/清除、映射文档与注入内容同步
5. `node --test tests/harnesses/test-harness-manifests.mjs` — 约 10 个用例，逐平台（Cursor/Gemini/Antigravity/Kimi/OpenCode）验证清单和工具映射契约
6-7. `scripts/bump-version.mjs --check/--audit` — 各平台清单版本号锁步一致、无漏登记
8. `npm run check:repo` — 调用随仓库分发的通用结构检查器复跑 1、2 的规则

**组织方式**：测试目录按被测对象划分（skills/hooks/pi/harnesses），与仓库顶层目录一一对应；写法分两种——简单结构断言用自写脚本（failures 累积 + exit 1），多用例的用 Node 内置 `node:test`。测试哲学是"契约型"：这是个跨 8 个 AI 编码平台的技能库，多数平台无法本机运行，测试专门把会静默失败的事（技能不加载、清单指向缺失文件、版本漂移）变成响亮失败。

**一个额外发现**：当前工作区 `skills/` 正被重组为 `dev/`、`pub/` 两层分组（未提交改动），而测试仍断言一级深度布局、`check:repo` 引用的脚本路径也已搬家——以当前状态直接跑 `npm test` 预计会失败。
