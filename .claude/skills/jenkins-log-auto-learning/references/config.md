# 配置与环境

配置分两层，深合并（环境层覆盖技能层）：

- **技能固有默认** `config.json`（与 SKILL.md 同目录，随仓库版本化）：本技能当前无固有项。
- **环境层** `~/.config/parking-agents/skill-env.json`（工具中立位置，不进任何仓库）：下列字段的真实值都在这里（本机指向 NAS 知识库 `//nas.51vr.local/x.public/UE5/ue-llm-wiki/`）。解析链：`$SKILL_ENV` > 该路径 > `~/.claude/skill-env.json`（旧位置回退）。模板见 `config.example.json`（默认已指向 NAS，拷贝后按机器改 `gitRepos` 即可用）；三层都无配置时脚本打印三步配置引导后退出。

下列字段指合并后的有效配置。

## 关键字段

- `jenkins.baseUrl` —— Jenkins 服务器 URL（实际值在环境层配置文件，见上）
- `gitRepos` —— 非浅克隆 git 仓库目录的路径（用于获取实际代码差异）
- `jobs[]` —— 要扫描的任务列表（只处理 `"enabled": true` 的条目）
- `tmpDir` —— 仅存放临时工作文件（下载的日志、中间数据）
- `knowledgeBase.wikiDir` —— **精选知识**（本技能只读）：经人工审核从 raw 提升的文件
- `knowledgeBase.rawDir` —— **所有自动学习输出都写在这里**：
  - `details/` —— 高质量知识文件（评分 >= 8）
  - `scratch/` —— 部分知识文件（评分 5-7）
  - `{trackFile}` —— 学习进度跟踪 JSON
- `trackFile` —— 跟踪 JSON 的完整路径（例如 `~/memory/jenkins-learnings-raw/analyzed-builds.json`，支持 `~/` 前缀）；由 session.mjs 统一写入。`scan-pairs.mjs` 生成的 `pending-pairs.json` 与其同目录
- `workflowFile` —— 工作流会话状态（可选，缺省 `{trackFile} 同目录/workflow.json`）：领取锁、阶段门禁、断点续跑指针。唯一写入者是 `scripts/session.mjs`
- 所有路径字段（`trackFile`、`workflowFile`、`tmpDir`、`knowledgeBase.*`、`gitRepos`）均支持 `~/` 前缀，脚本会展开到用户主目录

> **重要**：本技能只**写入** `knowledgeBase.rawDir`。`knowledgeBase.wikiDir` 是精选/已验证的知识库——本技能从中读取以检查已有知识（避免重复），但绝不向其写入。人工审核负责将 raw 文件提升至 wiki。

不要硬编码路径——始终从 config 读取。

## 本地 Git 仓库

config.json 中的 `gitRepos` 指向一个包含插件仓库非浅克隆的目录。使用它们来获取修复提交的**实际代码差异**——这对于生成可操作的知识文件至关重要。

```powershell
cd {gitRepos}/{repoName}
git show <commitHash> --unified=5
```

如果本地找不到某个提交，先拉取：`git fetch origin && git show <commitHash> --unified=5`

要查找提交属于哪个仓库，遍历 `{gitRepos}` 下的每个子目录。仓库名通常与控制台日志中的插件名匹配（例如 `AesWorld`、`SkyCreatorPlugin`）。

如果 `git show` 在 `git fetch` 后仍然失败（提交因 force-push 或 rebase 而不复存在），将该提交记录为不可用，Diff 评分维度计 0 分，并在知识文件中注明："Commit {hash} no longer available in repository — likely force-pushed."

没有实际 diff 的知识文件是不完整的——读者无法准确知道遇到同样错误时该改什么。Reuse 评分维度要求实际 diff，而非推断。

## URL 构造

config 中的 `job.path` 字段已包含 `job/` 前缀及完整 `/job/` 分隔符目录结构（例如 `job/wdp-ue/job/Earth/job/twe-ue5.5-ci`）。按如下方式构造 API URL（不额外添加 `job/`）：

```
{baseUrl}/{job.path}/api/json?tree=...
{baseUrl}/{job.path}/{buildNumber}/consoleText
```

这将生成类似 `{baseUrl}/job/wdp-ue/job/Earth/job/twe-ue5.5-ci/api/json?tree=...` 的 URL。

## 单实例规则

同一跟踪文件同一时间只允许运行一个本技能的实例。这由 `session.mjs next` 的领取锁**机械保证**：workflow.json 中存在未终结会话时，next 拒绝领取并打印续跑指针。并行运行多个实例会导致 `analyzed-builds.json` 的竞态条件——构建被重复处理，跟踪条目被覆盖，知识文件出现重复编号。

如果要求你运行多轮，请**串行**执行（等每一轮 finish 后再开始下一轮）。
