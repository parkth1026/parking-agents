---
name: ue-error-solver
description: |
  从 Jenkins CI 日志中诊断并修复构建错误。下载控制台日志，提取错误，
  执行多源诊断（知识库、Epic UE5 助手、网络搜索、源码），并可选地修复代码并提交。

  **触发条件：**
  (1) 用户粘贴了 Jenkins 构建 URL 或提到了失败的构建编号/任务名
  (2) 用户说"构建失败"、"编译错误"、"链接错误"、"构建挂了/红了"
  (3) 用户要求分析、诊断或修复 CI 构建失败
---

# UE Error Solver

从 Jenkins 日志中诊断 UE 构建错误，多源查找解决方案，可选地修复代码并提交。

## 脚本调用约定

所有操作通过 `scripts/UeErrorSolver.mjs` 子命令完成（Node ESM，无需安装依赖）：

```bash
SCRIPT="<skill目录>/scripts/UeErrorSolver.mjs"
node "$SCRIPT" <command> [--flags]     # 输出 JSON 到 stdout；业务失败 exit 1，用法错误 exit 2
node "$SCRIPT" --help                  # 查看全部子命令
```

**配置**：`config.json`（技能默认）⊕ 环境层（优先），深合并。环境层解析链：`$SKILL_ENV` > `~/.config/parking-agents/skill-env.json`；本机知识库路径指向 NAS。`node "$SCRIPT" config` 输出合并并解析后的配置（含 `gitRepos`、`knowledgeBase.*`、`tmpDir`，`_configSource` 标注配置来源）。

**临时文件**：日志等临时输出一律写入 `config.tmpDir`（或 `os.tmpdir()`），**绝不写入 skill 目录**。

## 输入解析

- **完整 URL**：`http://host/job/.../905/` → `node "$SCRIPT" parse-url --ref "$url"`
- **任务名 + 编号**：`linux-ci 905` → `node "$SCRIPT" find-job --search "linux-ci"` 模糊匹配（baseUrl 取自 config），多个结果时列出让用户选择，再 `parse-url --ref "linux-ci 905" --base-url "$baseUrl"`

## 执行流程

### Phase 0.5：环境前置检查（强制，所有动手前必须执行）

**目的**：避免 LLM 绕过 config 直接 clone 到 tmp 目录，或用错误的仓库路径提交。

```bash
node "$SCRIPT" check-env --repos "AesWorld"   # 仓库名从错误日志/用户输入提取，逗号分隔
```

**检查清单**：

| # | 检查项 | 失败动作 |
|---|---|---|
| 1 | 合并后配置含必要字段（`config.json` + 环境层 `~/.config/parking-agents/skill-env.json`） | 终止，按脚本打印的三步配置引导初始化 |
| 2 | `config.gitRepos` 存在且目录为真 | 终止，列出实际探测到的路径 |
| 3 | 错误日志提到的仓库名（如 `AesWorld`）在 `$config.gitRepos/<RepoName>` 下存在 | 警告并给出 `git clone` 指引，请求用户授权后 clone 到 `$config.gitRepos/<RepoName>` |
| 4 | 本地仓库的 `origin` remote 与 CI 用的 GitLab 一致（可传 `--expected-remote`） | 警告并继续 |

**关键规则**：
- **后续 Phase 2/4/5 所有文件操作必须在 `$config.gitRepos` 下的仓库内进行**
- **禁止重新 clone 到 tmp 目录**——`$config.gitRepos/<RepoName>` 是唯一的源码工作区
- 仅当 `$config.gitRepos/<RepoName>` 不存在时，才允许一次性 clone 到该位置

### Phase 1：下载并解析构建日志

```bash
# 下载并保存到 config.tmpDir（返回 savedPath；>500KB 自动另存过滤版）
node "$SCRIPT" console-log --job-path "/job/wdp-ue/job/Earth/job/xxx" --build 905 --save
node "$SCRIPT" build-result --job-path "$jobPath" --build 905    # 检查构建状态（仍在运行/已成功时通知用户）
node "$SCRIPT" extract-errors --log-file "$savedPath"            # 提取完整错误块（含 note: 行、实例化链）
node "$SCRIPT" extract-build-cmd --log-file "$savedPath"         # 提取构建命令（Phase 4 重编译用）
```

1. `console-log --save` 一步完成下载 + 保存（jobPath 来自 `parse-url` 的输出）。
2. `build-result` 检查构建状态（仍在运行/已成功时通知用户）。
3. `extract-errors` 提取结构化错误块。
4. 🧠 **LLM 判断：错误分类与分组** — 将相同错误（同代码+同文件）归组，识别主要错误 vs 级联错误，多个独立错误保持分开。
5. `extract-build-cmd` 提取构建命令。

向用户展示摘要：错误数量、主要错误、分类。

### Phase 1.5：准备工作分支（确保源码可访问）

CI 构建的分支（如 `dev`）可能与本地当前分支（如 `master`）差异很大，导致 Phase 2 找不到源文件。
**必须先切到 CI 构建的 commit**，后续 Phase 4 直接在此分支上修改。

```bash
node "$SCRIPT" repo-checkouts --log-file "$savedPath"   # 提取所有仓库的 branch/commit
node "$SCRIPT" fix-branch --repo-root "$localRepoRoot" \
    --source-branch "$targetRepo.branch" --source-commit "$targetRepo.commit" \
    --fix-branch "fix/$shortDesc-$buildNum"
```

**🚨 起始点选择铁律（防"基于陈旧 CI commit 提 MR"陷阱）**：

`fix-branch` 会自动 fetch `origin/<SourceBranch>` 最新 HEAD，然后比较 CI commit 与 HEAD 的领先/落后关系：

- **CI commit 与 HEAD 一致**（CI 是最新构建）→ 用 CI commit
- **CI commit 落后 HEAD**（dev 已经往前走了）→ **强制用 origin/HEAD 创建分支**，CI commit 仅用于诊断上下文

这是因为 CI 的 `SourceCommit` 只反映"构建那一刻的状态"，CI 队列里可能积压了 N 个 commit，从 CI 构建到我们修复之间 dev 可能已经被推进了好几次。如果直接基于 CI commit 建分支，MR 会包含一组**逆向 cherry-pick 才能干净合并**的 commits，且容易冲突。

**绝对禁止**：直接 `git checkout <CI commit>` 然后在那个游离 HEAD 上改代码，这等于丢弃所有 dev 后续改进。

### Phase 2：多源诊断

**顺序**：始终执行 2.1 + 2.2 → 根据知识库评分决定 2.3 / 2.4。

**来源选择规则**：
1. **2.1 源码**：始终执行（基础设施错误 OOM/磁盘/网络除外）
2. **2.2 知识库**：始终执行（目录不存在除外）
3. **2.3 Epic 助手**：执行，除非知识库评分 ≥ 8 或错误为基础设施/非 UE 类型
4. **2.4 网络搜索**：执行，除非知识库 ≥ 8 或 Epic 已给明确修复

#### 2.1 源码上下文

```bash
node "$SCRIPT" resolve-error-file --error-path "$errorFilePath"   # gitRepos 取自 config，或传 --git-repos
node "$SCRIPT" source-context --file "$resolved.localPath" --line "$lineNum"
node "$SCRIPT" git-history --repo-root "$resolved.repoRoot" --file "$resolved.localPath"
```

读取错误行 ±15 行上下文（`--context` 可调） + 相关头文件 + 最近 10 条 git 提交（`--count` 可调）。

#### 2.2 知识库搜索

```bash
node "$SCRIPT" search-kb --terms "$errorCode,$moduleName"
```

🧠 **LLM 判断：知识库匹配评分（0-10）**
- **8-10**：同错误代码 + 同文件路径 + 含修复段落 → 跳过 Epic (2.3)
- **5-7**：同错误代码但不同文件或修复不完整 → 继续 Epic
- **1-4**：仅关键词重叠 → 继续 Epic
- **0**：无匹配 → 继续 Epic

#### 2.3 Epic UE 助手

🧠 **LLM 判断：构建 Epic 查询** — 将完整错误块（含 `note:` 行、实例化链）+ 源码上下文组合为具体问题。多个独立错误**分别查询**，每个用全新对话。

调用 `epic-ue-assistant` skill 执行查询。模块不存在时跳过并记录警告。

#### 2.4 网络搜索

不常见错误、第三方库问题、引擎版本迁移时执行。

#### Phase 2 检查清单（强制）

| 步骤 | 状态 | 结果 |
|---|---|---|
| 2.1 源码 | 已完成 / 已跳过（原因） | 文件/代码片段 |
| 2.2 知识库 | 已完成 / 目录不存在 | 搜索词 + 评分 X/10 |
| 2.3 Epic | 已完成 / 已跳过（原因） | 关键答案 |
| 2.4 Web | 已完成 / 已跳过（原因） | 关键发现 |

### Phase 3：呈现诊断

🧠 **LLM 判断：根因分析合成** — 综合所有来源证据，确定根因并评估置信度。

**中文输出**（技术术语保持英文）：

```
## 诊断：{ErrorCode} — {FileName}

**错误信息**：{error message}
**根因分析**：{definitive analysis}
**置信度**：{高/中/低}

### 证据
- 知识库：{KB 文件路径和匹配评分，或"目录不存在"/"未找到匹配"}
- Epic 指引：{Epic 回答要点，或"跳过：{原因}"}
- 源码上下文：{相关代码片段，或"跳过：{原因}"}
- Web 搜索：{搜索结果，或"跳过：{原因}"}

### 修复建议
{具体修复步骤和代码改动}

### 参考资料
- {Epic 文档链接}
- {知识库文件链接}
- {Web 链接}
```

证据部分必须与 Phase 2 检查清单一致。多个独立错误分别呈现。

### Phase 4：修复代码（可选，仅用户要求 fix/修复/解决 时）

🧠 **LLM 判断：生成代码修复** — 基于诊断结果生成具体代码改动。

**修复流程（必须按顺序）**：

1. **应用修复**：在 Phase 1.5 已创建的修复分支上修改本地文件。**文件路径必须位于 `$config.gitRepos/<RepoName>` 下，禁止在 tmp/clone 副本里修改**。

2. **本地验证**（**强制**，除非用户明确说"跳过验证直接提"）：
   ```bash
   # 必须用 CI 实际使用的构建命令，不要用 UBT -Force（增量判断会失效）
   node "$SCRIPT" local-build --repo-root "$repoRoot" --build-command "$buildCmd"
   ```

   **UBT 增量陷阱**（已知问题）：
   - UBT 用 `git status` 判断 working set，直接删 `.obj`/`manifest`/`.target` 都无法强制重编
   - 不要用 `UBT -Force`，它会"重建 makefile"但实际仍认为 target up to date
   - **正确做法**：用 CI 用的命令（如 `RunUAT BuildPlugins -WhiteList=<Plugin> -NoHostPlatformOnly`）
   - 也可以用全新分支名重新执行 `fix-branch`（新分支会让 UBT 把所有 action 标记为 missing）

🧠 **LLM 判断：分析编译结果**：
- 成功 → 进入 Phase 5
- 失败且原因可定位 → 回到 Phase 2 修订修复，最多 3 次后停止并报告
- 失败且原因与本次修复无关（如 OpenCVHelper 缺预编译）→ 标注为无关失败，进入 Phase 5 并在 MR 描述里说明

### Phase 5：提交并创建 MR（可选，仅用户明确要求时）

**前置条件（全部为真才允许执行）**：

- [ ] Phase 4 已应用修复
- [ ] **本地编译已通过**（`node "$SCRIPT" assert-build-passed --exit-code <local-build 的 ExitCode>` 验证），或用户明确豁免（`--user-waived`，豁免需在最终回复中明示）
- [ ] 修改的文件在 `$config.gitRepos/<RepoName>` 下（`node "$SCRIPT" assert-files-in-repos --files <files> --git-repos-root <root>` 验证）
- [ ] 修复分支由 `fix-branch` 创建，基于 CI 的源 commit（不是本地任意分支）

```bash
# Step 1: 提交并推送（纯 push，不含 MR 创建；--force 消息会被拒绝）
node "$SCRIPT" git-submit --repo-root "$repoRoot" --files "Source/Foo.cpp" \
    --message "fix($module): $errorCode - $shortDesc"

# Step 2: 通过 GitLab API 创建 MR（认证：GITLAB_PRIVATE_TOKEN 或 git credential manager）
node "$SCRIPT" gitlab-mr --repo-root "$repoRoot" \
    --source-branch "$commitResult.branch" --target-branch "$targetRepo.branch" \
    --title "fix($module): $errorCode - $shortDesc" \
    --description "## Root Cause
$rootCause

## Fix
$fixDesc"
```

`gitlab-mr` 从 git remote URL 自动推断 GitLab 实例和项目路径。
认证失败（401/403）时返回手动创建 MR 的 URL。

**禁止直接 push 到 dev/release/master**——所有修复必须通过 MR。

### Phase 6：知识积累（Phase 4 已执行且编译成功时触发）

🧠 **LLM 判断：撰写知识条目内容** — 包含错误信息、根因、修复 diff、证据来源、预防措施。

```bash
node "$SCRIPT" save-knowledge --job-short "$jobShort" --build "$buildNum" \
    --error-code "$errorCode" --short-desc "$shortDesc" --content "$entryContent"
# 或 --content-file entry.md 从文件读入
```

仅保存已验证修复，不保存推测性诊断。同错误码+同描述的已有条目会自动追加 `## Update:` 段落。

条目落在 `{knowledgeBase.rawDir}/details/`，命名与头部对齐 jenkins-pair-analyze 的
knowledge-format.md（`{job}-{build}-{code}-{desc}.md`、一级标题含错误码）——
两个技能共享同一知识库，口径一致才能互相检索到对方的积累。search-kb 同时匹配
内容行与文件名（文件名兜底覆盖正文缺错误码 token 的历史文件）。

## 约束

1. **对 Jenkins 只读**：绝不修改 Jenkins 配置或触发构建
2. **绝不强制推送**：`git push --force` 绝对禁止（`git-submit` 会拒绝含 `--force` 的消息）
3. **修复必须通过 MR**：绝不直接 push 到 dev/release/master，始终创建修复分支 + MR
4. **修复分支基于 CI commit**：使用 `repo-checkouts` + `fix-branch` 确保修复分支基于与 CI 完全相同的起点
5. **配置驱动路径**：所有路径来自 config.json / skill-env.json，不硬编码。**禁止在 `$config.gitRepos` 之外重新 clone 仓库**
6. **本地编译验证为默认强制项**：Phase 5 前必须通过 `local-build`（用 CI 用的命令）并通过 `assert-build-passed`，除非用户明确豁免
7. **修复提交必须在 `$config.gitRepos` 下**：禁止在 tmp/clone 副本里修改后提交（`assert-files-in-repos` 强制）
8. **UTF-8 without BOM**：所有输出文件，CRLF 换行
9. **优雅降级**：如果 Jenkins 不可达、Epic API 失败或知识库为空——继续使用可用来源并通知用户
10. **仅保存已验证知识**：仅在编译确认修复有效后才保存到知识库
11. **不静默提交**：提交代码前始终通知用户
12. **HTTP 请求使用 curl.exe**：脚本内部统一走 `curl.exe`（非 `Invoke-WebRequest`/Node fetch）——Cloudflare 和某些 Jenkins 配置会阻止其他 HTTP 客户端
13. **中文输出**：诊断报告以中文撰写，技术术语保持英文
14. **禁止纯模型诊断**：每条诊断必须引用至少一个已执行来源的证据
15. **GitLab 认证**：`gitlab-mr` 自动从 git credential manager 提取凭据，也支持 `GITLAB_PRIVATE_TOKEN`。Jenkins 用 `JENKINS_USER` / `JENKINS_TOKEN` 环境变量
16. **临时文件不入 skill 目录**：日志、MR 请求体等临时文件一律写入 `config.tmpDir` 或 `os.tmpdir()`，绝不写入 skill 目录或 git 仓库
