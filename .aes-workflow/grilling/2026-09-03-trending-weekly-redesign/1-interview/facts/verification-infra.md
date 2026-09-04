# Fact: 验证基建

- 派遣问题：1) run-tests.mjs 测什么/怎么跑/viewer 覆盖面；2) validate-week.mjs 校验什么 schema、fixture 约定；3) 仓库级 CI/门禁与晋级要求；4) 视觉/HTML 产物验收既有手段；5) 改 viewer.html 现有测试会不会挡
- 完成：2026-09-03T01:26:02+08:00（subagent 调查，宿主落盘）

## 查到的

| 事实 | 证据出处 |
| --- | --- |
| run-tests.mjs 是离线黑盒回归：check() 计数器 + spawnSync 跑脚本比对输出/产物，退出码 0=全过/1=有失败，全程不碰网络 | `skills/pub/github-trending-weekly/run-tests.mjs:2-4` |
| 覆盖 10 个测试节：T1 fetch 离线解析 fixture、T2 页面结构异常拒绝、T3 enrich --stub 回放、T4 update-history 分类/环比/幂等、T5 validate-week 门禁、T6 build-report 产物、T8 serve.mjs 本地后端全路由、T9 SKILL_ENV 配置链、T10 行数截断与元数据回填、T7 SKILL.md 声明 | `skills/pub/github-trending-weekly/run-tests.mjs:43-295` |
| viewer 相关断言仅 2 条，且都是字符串包含 `src="data.js"`：T6 检查生成的 index.html、T8 检查 serve 的 GET / 响应体；无任何 DOM/视觉/截图断言 | `skills/pub/github-trending-weekly/run-tests.mjs:167,201` |
| 跑法：技能目录下 `node run-tests.mjs`（SKILL.md 维护节写明"改任何脚本后必跑"）；也可被仓库级 `npm run evals` 逐技能执行 | `skills/pub/github-trending-weekly/SKILL.md:124-128`、`scripts/run-evals.mjs:100-107` |
| validate-week.mjs 位于技能内 scripts/，校验三种契约：周快照 `trending-week/1`（schema/week/captured_at/repos 恰 20 条/逐字段类型/rank 连续不重复/full_name 唯一）、历史 `repo-history/1`、--full 追加周↔历史咬合 | `skills/pub/github-trending-weekly/scripts/validate-week.mjs:2-9`、`scripts/lib/validate.mjs:8-75` |
| 数据契约的人读镜像在 references/data-schema.md（三 JSON 契约 + viewer 载荷契约），代码为唯一实现 | `skills/pub/github-trending-weekly/references/data-schema.md:1-6` |
| fixture 约定：`fixtures/trending-weekly.html`（689KB 真实榜单快照，解析锚点固化处）+ `fixtures/stub/`（3 仓库 × gh api 响应 json + readme 回放）；GitHub 改版时更新 parse-html 正则并重新固化 fixture 后跑 run-tests 回归 | `skills/pub/github-trending-weekly/run-tests.mjs:4,46,86`、`SKILL.md:116`、`fixtures/stub/` |
| 仓库无任何 CI：根目录不存在 `.github/`；`npm test` 跑 aes-qa 截图契约、tests/skills、hooks、pi、harnesses、bump-version、check:repo，均不执行本技能的 run-tests | 仓库根 `ls`（.github 缺失）、`package.json:scripts.test` |
| 仓库级唯一会执行本技能测试的命令是 `npm run evals`（scripts/run-evals.mjs 按名字发现技能并 spawnSync 其 run-tests.mjs） | `scripts/run-evals.mjs:93-107` |
| 晋级门禁（docs/agents/skill-release.md）：评测五件套齐全 + 最新一轮 run-tests.mjs 退出码 0 | `docs/agents/skill-release.md:7-9`、`README.md:138` |
| 本技能目前五件套只有 run-tests.mjs（无 trigger-evals/output-evals/trigger-benchmark/history 四个 json），run-evals 判"⚠️ 五件套不齐" | 技能目录 `ls -a`、`scripts/run-evals.mjs:110-117` |
| 仓库内没有针对 HTML 产物的截图对比或结构断言基建；parking-skill-creator 的浏览器评审针对技能评测产物（eval viewer），不直接验收 viewer.html | `skills/workflow/parking-skill-creator/SKILL.md:122,248` |
| 可复用的视觉验收手段（存在但非本技能专用）：aes-qa 截图证据协议（`npm run test:aes-qa-screenshot-evidence`）；playwright-cli 技能提供 snapshot/screenshot/dashboard 标注评审，仓库根 `.playwright-cli/` 有历史快照证明流程用过 | `skills/workflow/aes-qa/SKILL.md:11-17,65`、`package.json:scripts`、`skills/pub/playwright-cli/SKILL.md:20-21,49,171` |
| viewer.html 实体在 `assets/viewer.html`（165 行，第 68 行 `<script src="data.js">`，第 70 行读 `window.TRENDING_DATA`）；build-report 将其整文件拷贝为 report/index.html（缺失即 fatal），serve.mjs 直接回读同一文件 | `assets/viewer.html:68,70`、`scripts/build-report.mjs:29-32`、`scripts/serve.mjs:36,51-52` |
| 改 viewer 挡不挡测试：只要保留 assets/viewer.html 存在且含 `src="data.js"` 字符串，run-tests 不红；删除文件、去掉/改名 data.js 引用、serve 返回 500 才会红 | `run-tests.mjs:167,201`、`build-report.mjs:31`、`serve.mjs:51` |
| data.js 载荷形状断言在生成物上（window.TRENDING_DATA 前缀、周数、analysis 内联、readme 截断 900），与 viewer 的 JS 实现解耦——viewer 重构不触发这些断言 | `run-tests.mjs:160-165,203` |

## 未知项

- 是否有机器外定时任务跑 `npm run evals` 或本技能 run-tests——仓库内无 CI、无证据。
- aes-qa 截图证据协议依赖的 GitLab 侧 pipeline 是否实际可用（本技能从未出过 QaReceipt）。
- 真实 workspace（D:\GIT_dev\github-trading）里的现网 report 产物状态——在仓库外，未查。

## 没查的

- 未实际执行 run-tests.mjs / npm test / npm run evals（只读纪律，结论全部来自读代码）。
- 未逐行读 viewer.html 全部 165 行标记（只核对数据加载两行）、serve.mjs 完整路由实现。
- 未查 ~/.agents、~/.zcode 下插件缓存与 browser-use 技能细节（属宿主环境，非本仓库）。
