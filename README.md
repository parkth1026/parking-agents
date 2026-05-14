# parking-agents

---

## 🦴 为什么这套架构能"省" Request

VS Code Copilot 的计费模型有一个被多数人忽视的特性：

>Copilot只有**用户发送** 的请求才消耗Requst，
>**回答问题** 与**subagent** **不额外消耗 request 配额，
>真正消耗配额的是主 agent 自己直接发起的 LLM 推理回合。

`Parking + Worker` 双角色设计就是把这个特性吃满。

### 思路一句话

**主 agent 当骨架，subagent 当肌肉。** 主 agent 只保留意图与决策，把所有"重上下文"操作（读多个文件、跑长命令、写大段代码、做调研）都打包丢给 Worker，Worker 跑完返回**精炼摘要**，主 agent 再决定下一步。

### 三个免费红利

| 红利 | 操作 | 节省 |
|---|---|---|
| **免费问答** | Parking 用 `vscode/askQuestions` 反复跟用户对齐意图 | 0 配额，但避免"猜错任务方向"导致的整轮浪费 |
| **免费委派** | 每次 `runSubagent` 调用 Worker | 0 额外配额，Worker 内部跑多少轮工具调用都不计入主对话回合数 |
| **上下文不污染** | Worker 在自己的独立上下文里啃完一堆文件 / 跑一串命令，只回 1-3 句摘要 | 主对话窗口永远清爽，主 agent 后续推理质量不下降 |

### 最优工作节奏

```
用户提需求
   │
   ▼
Parking 用 askQuestions 澄清（免费，可反复）
   │
   ▼
Parking 派 Worker 干活（免费，重活全外包）
   │
   ▼
Worker 自己读改搜跑、内部循环 → 回报摘要
   │
   ▼
Parking 蒸馏 → 用 askQuestions 问"下一个 sprint 干什么"（免费）
   │
   ▼
循环……
```

每一轮叫一个 **sprint**：单一目标、单一 Worker、用户随时介入校准。

### 三条不可违背的铁律

1. **主 agent 永远不亲自做重活** —— 读改搜跑全部下放，主上下文只装意图和摘要。
2. **同一时刻只有一个 subagent 在跑** —— 串行调度，不并发，避免控制流失序。
3. **subagent 不嵌套** —— 调用链扁平为单层，Worker 不能再起子 subagent。

### Anti-pattern（用了就白白烧配额）

- ❌ 主 agent 自己 `read_file` 十次"先了解一下" → 应当让 Worker 探索
- ❌ 把意图理解阶段塞进 Worker 提示词里"猜着写" → 应当先 `askQuestions` 跟用户对齐
- ❌ Worker 回报里塞完整文件内容 / 长命令日志 → 应当只回 1-3 句结论 + 关键证据定位
- ❌ Parking 拿到 Worker 结果直接结束 → 应当再问"是否符合预期 / 下一步做什么"

### 升级版：加上 Evaluator 形成验收闭环

`Master + Worker + Evaluator` 是 Parking 体系的进化形态，把"白嫖"思路再推一层：Worker 干完后 Master 派 Evaluator **正交验证**（独立跑命令 / 拉权威源），用 Hardness 评分挡住"假完成 / 假修复"。Evaluator 调用同样不额外计费，所以**多一道验证 = 0 成本但抓出大量假阳性**。详见 [docs/HARNESS-TRIAD-REFACTOR-PLAN.md](docs/HARNESS-TRIAD-REFACTOR-PLAN.md)。


---

## 安装

### 方式一：复制文件

将本仓库的 `.copilot/` 目录复制到用户级目录：

```powershell
# Windows
Copy-Item -Recurse .copilot\agents\ $env:USERPROFILE\.copilot\agents\
Copy-Item -Recurse .copilot\skills\ $env:USERPROFILE\.copilot\skills\
```

```bash
# macOS / Linux
cp -r .copilot/agents/ ~/.copilot/agents/
cp -r .copilot/skills/ ~/.copilot/skills/
```

### 方式二：符号链接（推荐）

使用 junction（Windows）或 symlink 链接到本仓库，后续 `git pull` 即可同步更新：

```powershell
# Windows（需管理员权限）
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\agents" -Target "D:\GIT\parking-agents\.copilot\agents"
New-Item -ItemType Junction -Path "$env:USERPROFILE\.copilot\skills" -Target "D:\GIT\parking-agents\.copilot\skills"
```

```bash
# macOS / Linux
ln -s /path/to/parking-agents/.copilot/agents ~/.copilot/agents
ln -s /path/to/parking-agents/.copilot/skills ~/.copilot/skills
```

> 安装后在 VS Code 中打开 Copilot Chat，即可通过 agent 模式选择 Parking 或 SuperPower。

---

## Parking 体系

**通用型编排器**，适合日常编程任务。

```
Parking（编排）→ Worker（执行）
```

| 角色 | 职责 |
|------|------|
| **Parking** | 意图理解、任务拆分、委派 Worker、结果蒸馏回报用户 |
| **Worker** | 全能执行器：文件读写、终端操作、代码修改、搜索探索 |

Parking 还可按需调度以下**专用 subagent**：

| Subagent | 描述 |
|----------|------|
| **parking-agent-creator** | 创建/脚手架新的 agent 或 skill 文件 |
| **parking-agent-eval** | 只读评估：lint、校验 customization 文件，输出打分 + 修复建议 |
| **parking-agent-insight** | Insight 分析编排：数据提取 → LLM 语义分析 → 叙事 + HTML 报告 |
| **parking-agent-analytics** | 脚本执行 + 定量分析：工具链脚本、HTML 报告、token 统计 |
| **Simplify** | 代码审查与清理：复用性、质量、效率三维审查并自动修复 |

---

## SuperPower 体系（还在调试中）

**技能驱动编排器**，适合需要结构化工作流的场景（TDD、调试、计划等）。

```
SuperPower（编排 + 技能路由）→ SuperPowerSub（按技能执行）
```

| 角色 | 职责 |
|------|------|
| **SuperPower** | 识别意图、匹配最佳 skill、委派 SuperPowerSub 并传入 skill 规范 |
| **SuperPowerSub** | 严格按 skill 定义执行，保证流程一致性 |

### Skills 列表

| Skill | 描述 |
|-------|------|
| **brainstorming** | 创作性工作前置探索：需求理解、意图对齐、方案设计 |
| **claude-to-vscode-skill-converter** | Claude Code skill/prompt → VS Code Copilot 格式转换 |
| **dispatching-parallel-agents** | 多个独立任务的并行 subagent 分派策略 |
| **executing-plans** | 按既有计划分步执行，带审查检查点 |
| **finishing-a-development-branch** | 开发完成后的集成决策（merge / PR / cleanup） |
| **requesting-code-review** | 完成任务后触发结构化代码审查 |
| **subagent-driven-development** | 当前会话内基于 subagent 的并行实现执行 |
| **systematic-debugging** | 遇到 bug/失败时的系统化诊断流程（先于修复） |
| **test-driven-development** | TDD 工作流：先写测试再写实现 |
| **verification-before-completion** | 完成声明前的强制验证（跑命令、确认输出） |
| **writing-plans** | 多步任务的实施计划编写（先于编码） |

---

