# Fact: mattpocock-skills 基准

- 派遣问题:查清 mattpocock/skills 本地 clone 的仓库身份、技能清单与组织、用户安装路径、工程基建(package/CI/测试)、文档与贡献体系、版本与发布节奏,共六项。
- 完成:2026-08-24T18:23:26+08:00

目标仓库:G:/GIT/AI_WorkFlow_ref/mattpocock-skills(下文相对路径均相对该根)。git 只做了只读操作;外部信息(stars/release)用 `gh repo view` 查证。

## 查到的

### 1. 仓库身份

| 事实 | 证据出处 |
| --- | --- |
| 定位是「Skills For Real Engineers」,作者每日自用的 agent 技能集,反对 vibe coding | `README.md:11`、`README.md:15` |
| 上游是 GitHub `mattpocock/skills`(origin 惟一 remote,clone 而非 fork) | `git remote -v` → `https://github.com/mattpocock/skills.git` |
| 本地 HEAD = `5b15a47`(2026-08-21 11:56:33 +0100,fix: clarify wording in implementation steps for code review process),与 origin/main 一致、落后 0 个提交 | `git log -1`、`git log HEAD..origin/main`(空)、`git branch -vv` |
| 远端 pushedAt = 2026-08-21T10:56:48Z,与本地最后提交同刻 → 本地即最新,无需同步 | `gh repo view mattpocock/skills --json pushedAt` |
| stars = 234,665;GitHub 描述「Skills for Real Engineers. Straight from my .agents directory.」;共 454 commits | `gh repo view --json stargazerCount,description`;GitHub 页面 |
| README 顶部挂 newsletter 引流(aihero.dev,约 60,000 订阅)与 skills.sh 徽章 | `README.md:13`、`README.md:21-23` |
| 本地工作区干净,但存在无上游的本地分支 `parking-dev`(7 个本地提交,主题 grill-with-docs-plus)及 `release/v1.2`;`.aes-workflow/`、`.scratch/` 是空目录(无文件) → 该 clone 上做过用户自己的实验,非纯镜像 | `git status --short`(空)、`git log main..parking-dev --oneline`、`find .aes-workflow .scratch -type f`(空) |

### 2. 技能清单与组织

| 事实 | 证据出处 |
| --- | --- |
| 共 36 个技能(SKILL.md 计数):engineering 18 + productivity 7 + misc 4 + in-progress 7 + deprecated 0 | `find skills -name SKILL.md | wc -l` + 按桶统计 |
| 五桶分类:engineering(日常代码)/ productivity(日常非代码)/ misc(留着但不推广)/ in-progress(公测,不入插件)/ deprecated | `CLAUDE.md:1-7` |
| 命名风格:kebab-case 动词性短语(ask-matt、grill-with-docs、to-spec、to-tickets、diagnosing-bugs、wait-what、improve-codebase-architecture) | `skills/engineering/`、`skills/productivity/` 目录名 |
| 单技能标准结构:SKILL.md(YAML frontmatter 仅 name + description)+ 可选同目录参考文件(tdd/tests.md、tdd/mocking.md;wizard/template.sh)+ 每技能一个 `agents/openai.yaml`(Codex 展示元数据)+ 可选 `scripts/`(diagnosing-bugs/scripts/hitl-loop.template.sh) | `skills/engineering/tdd/SKILL.md:1-5`、`ls skills/engineering/{tdd,wizard,diagnosing-bugs}`、`skills/engineering/tdd/agents/openai.yaml` |
| 有 README 索引且分两层:顶层 README 的 Reference 区按桶列出每个技能(名称链到 SKILL.md);每个桶还有自己的 README.md 作桶内索引 | `CLAUDE.md:13-15`、`README.md:184-231`、`skills/engineering/README.md:1-15` |
| 索引按「谁能调用」分两组:User-invoked(只能人敲 `/xxx`)vs Model-invoked(模型可自动取用),桶 README 与顶层 README 都按此分组 | `README.md:186`、`CLAUDE.md:19`、`skills/engineering/README.md:5-15` |
| 「promoted」不变式:engineering/productivity 每个技能必须同时出现在顶层 README 和 `.claude-plugin/plugin.json` 的 skills 数组(25 个);misc/in-progress/deprecated 不得出现在任何一处 | `CLAUDE.md:9`、`.claude-plugin/plugin.json`(skills 数组 25 项) |

### 3. 使用者视角(安装路径)

| 事实 | 证据出处 |
| --- | --- |
| 两条互斥安装路线:「Claude Code 插件 = 订阅式只读托管包、自动更新」vs「skills.sh = 把可编辑文件复制进你的项目」;明说装两份会得到双份技能 | `README.md:25-27`、`.agents/install-block.md`("The two routes are exclusive") |
| Claude Code 路线:`claude plugins install mattpocock-skills`(在官方 marketplace,无需先加源) | `README.md:34-44`、`.agents/install-block.md` |
| Codex 及其他 agent 路线:`npx skills@latest add mattpocock/skills`(可挑选技能,需带上 setup-matt-pocock-skills);更新用 `npx skills update` | `README.md:49-70`、`.agents/install-block.md` |
| 安装后每仓库跑一次 `/setup-matt-pocock-skills`:选 issue tracker(GitHub/Linear/本地文件)、triage 标签、文档存放位置 | `README.md:74-82` |
| 安装命令的真源是 `.agents/install-block.md`(canonical block),README/docs 一律 verbatim 复制,改命令先改这里 | `CLAUDE.md:11`、`.agents/install-block.md:1-4` |
| `scripts/link-skills.sh` 是维护者 dev-only 的 symlink 安装器(链到 ~/.claude/skills 与 ~/.agents/skills),明确声明不是受支持的安装器 | `scripts/link-skills.sh:3-6`、`CLAUDE.md:23` |
| 无 npm 发布渠道:package.json `private: true`,不经 npm registry 分发 | `package.json:4` |
| `.claude-plugin/marketplace.json` 让仓库自成单插件 marketplace,但只是未对用户文档化的兜底路线 | `.claude-plugin/marketplace.json`、`.agents/install-block.md`("Not the install story" 节) |

### 4. 工程基建

| 事实 | 证据出处 |
| --- | --- |
| package.json v1.2.3、private、scripts 仅 3 个(changeset / version / check-plugin-version),devDependencies 只有 @changesets/cli + changelog-github,packageManager npm@10.9.4 | `package.json:3-20` |
| package-lock.json 存在,lockfileVersion 3(根包 version 占位 0.0.0) | `package-lock.json:1-5` |
| LICENSE 为 MIT,Copyright (c) 2026 Matt Pocock | `LICENSE:1-3` |
| CHANGELOG.md 共 270 行,覆盖 1.0.0 → 1.2.3 六个版本段,颗粒度到单个 PR:每条带 PR 链接、commit 链接、Thanks 署名和行为级描述 | `CHANGELOG.md:3`(1.2.3)、`:17`、`:27`、`:157`、`:219`、`:225`;`grep -c` 270 行 |
| 版本流转用 changesets:`.changeset/` 内有 config.json(changelog-github、baseBranch main、privatePackages version+tag)与多个待发布 changeset 文件 | `.changeset/config.json`、`.changeset/` 目录列表 |
| CI 惟一 workflow:`.github/workflows/release.yml`,push main 触发,Node 22,`npm ci`,用 changesets/action 开「Version PR」,publish 步骤只做 `npx changeset tag` | `.github/workflows/release.yml:3-33`、`ls .github/`(无其他内容) |
| 没有测试:package.json 无 test script,仓库无 tests 目录,CI 不跑任何测试;质量闸门是 `claude plugin validate . --strict`(改 manifest 后跑)与 `npm run check-plugin-version` | `package.json:11-15`、`CLAUDE.md:11`、`scripts/sync-plugin-version.mjs:1-6` |
| 维护脚本 3 个:sync-plugin-version.mjs(package.json 版本 → plugin.json,--check 模式给 CI/人肉校验)、link-skills.sh(dev 链接)、list-skills.sh(列 SKILL.md) | `scripts/` 目录、`scripts/sync-plugin-version.mjs:1-6`、`scripts/link-skills.sh:3-6`、`scripts/list-skills.sh:1-7` |
| 文风硬约束:全仓库散文禁用 em-dash(SKILL.md、docs、README、CHANGELOG、ADR、changeset、注释),要求改写而非字符替换 | `CLAUDE.md:25` |

### 5. 文档与贡献

| 事实 | 证据出处 |
| --- | --- |
| docs/ 镜像两个 promoted 桶:docs/engineering/ 18 页 + docs/productivity/ 7 页,每技能一页;非 promoted 桶无 docs 页 | `ls docs/`、`CLAUDE.md:17` |
| 每个文档页固定四节:What it does / When to reach for it / Common questions / It's working if,模板在 `.agents/writing-docs.md`;发布 URL 为 aihero.dev/skills-\<name\> | `CLAUDE.md:17`、`docs/engineering/tdd.md:1-2` |
| AGENTS.md 是指向 CLAUDE.md 的 symlink(1.2.0 引入,让 Codex 读同一份仓库指令);本 Windows clone 上表现为内容为「CLAUDE.md」的 9 字节文件 | `AGENTS.md:1`(内容即 `CLAUDE.md`)、`CHANGELOG.md` 1.2.0 段("Add AGENTS.md as a symlink to CLAUDE.md") |
| CLAUDE.md 是仓库操作真源:桶结构、promoted 不变式、安装块真源、docs 规则、invocation 二分、ask-matt 路由同步义务、link-skills、禁 em-dash | `CLAUDE.md:1-25` |
| CONTEXT.md 是领域术语表:Issue tracker / Issue / Decision ticket / Triage role 四词条(含 avoid-list)、关系表、已解决的历史歧义(backlog 二义) | `CONTEXT.md:1-31` |
| `.agents/` 承载仓库自身工程文档:install-block.md、invocation.md(双 harness 调用模型)、writing-docs.md、adr/(2 个 ADR:0001 setup 指针策略、0002 为什么先发 Claude 插件) | `ls .agents/`、`ls .agents/adr/`、`README.md:57` |
| 范围决策有落点:`.out-of-scope/` 存 3 篇(mainstream-issue-trackers-only、question-limits、setup-skill-verify-mode) | `ls .out-of-scope/` |
| 没有 CONTRIBUTING.md、没有 issue 模板、没有 PR 模板(.github 下只有 workflows/) | `ls -R .github/`、`find -iname "CONTRIBUTING*" -o -iname "*TEMPLATE*"`(空) |
| 路由入口 ask-matt 是「说谎即坏」的受同步资产:增删改用户可达技能时必须回头改它 | `CLAUDE.md:21` |

### 6. 版本与发布节奏

| 事实 | 证据出处 |
| --- | --- |
| git tag 共 7 个:mattpocock-skills@1.0.0、v1.0.0、v1.0.1、v1.1.0、v1.2.0、v1.2.2、v1.2.3(无 v1.2.1 tag,CHANGELOG 也无 1.2.1 段) | `git tag`、`grep "^## " CHANGELOG.md` |
| 最新 GitHub Release:v1.2.3,发布于 2026-08-06T14:05:28Z | `gh repo view --json latestRelease` |
| 版本号策略:changesets 的 patch/minor 语义(1.2.0 加 Codex 双 harness 元数据为 minor;修文案/小修为 patch);版本落盘由 changesets/action 的 Version PR 承担 | `CHANGELOG.md:27`(1.2.0 Minor)、`:3-15`(Patch)、`.github/workflows/release.yml:30-33` |
| 版本一致性机制:`npm run version` 在 changeset version 后跑 sync-plugin-version.mjs,保证 package.json 与 .claude-plugin/plugin.json 版本一致,`--check` 供校验 | `package.json:13-14`、`scripts/sync-plugin-version.mjs:1-6` |
| 发布节奏参照:1.0.0 → 1.2.3(6 个版本段),CHANGELOG 最后更新 2026-08-06,最近提交 2026-08-21(未发版的日常迭代仍在进行) | `CHANGELOG.md:3-225`、`git log -1 -- CHANGELOG.md`(2026-08-06)、`git log -1`(2026-08-21) |

## 未知项

- 各历史 tag(v1.0.0 等)的逐一发布日期没查(只确认了最新 release v1.2.3 = 2026-08-06);要补需 `gh release list` 或逐 tag `git log -1 --format=%ad <tag>`。
- v1.2.1 为何缺失(CHANGELOG 无此段、无 tag)未考证。
- GitHub release notes 的正文内容没读(只取了 tag 名与日期)。
- 仓库当前 open issues / PR 数量没查(`gh` 只用了 repo 元数据那次调用)。
- skills.sh(`npx skills` 安装器)是谁维护的、与 Matt 的关系,本地仓库未说明,未外查。
- 上游是否存在比本地更新的提交:已证伪——远端 pushedAt 与本地 HEAD 同刻(2026-08-21),本地即最新;但「此后(2026-08-24)远端又推了新提交」这种情况需再 fetch 才能否定,未做 fetch(只读约束)。

## 没查的

- parking-agents 自身的任何现状(它是差距分析的另一半,不归本次事实调查)。
- aihero.dev 网站如何渲染 docs 页(install widget 机制),只取了仓库内 CLAUDE.md/install-block.md 的描述。
- 远端大量 origin/* 功能分支的内容(只列了分支名,未逐个看)。
- 用户本地分支 parking-dev 的 7 个提交具体改了什么(只看了一行式标题,细节超出派遣范围)。
