# 评测模型的选择与控制

评测循环会 spawn 大量 subagent（执行臂、探针、评分器），默认全部继承宿主会话的模型——通常是最贵的那档。
本文回答两个问题：起跑前怎么问用户用什么模型；选定的模型怎么真正落到每个 run 上并被验证。

## 起跑前问什么

在 6.1 的 gate 问询上追加模型维度，一次问清三件事（用户不在场时按默认跑并注明）：

1. **gate 集**（原有问题，不变）。
2. **执行臂与探针的模型**：默认 = 宿主同款。降档动机通常是成本：探针（一行路由判断）与 baseline 臂最适合先降；with_skill 臂是否降档由用户定。
3. **评分器（grader）的模型**：默认 = 宿主同款。判罚质量直接进 pass_rate，一般不建议降档（可用「低档模型 + thoughtLevel: high」折中）。

用户给出的模型记为**轮次模型配置**，写进该轮 benchmark 的 notes；headless 通道的 run 另有 run-meta.json。

## 三条通道的现实（按优先级）

| 通道 | 模型可控性 | 事实依据 |
| --- | --- | --- |
| **Agent 工具 + 自定义 agent（首选）** | **可控**：spawn 时指定 `subagent_type: <自定义agent>`，模型钉扎在 agent 定义里 | `~/.zcode/agents/<name>.md` 的 frontmatter 支持 `model:` 与 `thoughtLevel:`（zcode 自带 agent 创建 UI 生成的真实文件实证）；无需 API key，Agent 传输层不变（timing 捕获、分批并发、沙箱纪律全部沿用） |
| Agent 工具（默认） | 不可控。subagent 一律继承宿主会话模型；能控制的只有 agent 类型 | Agent 工具契约本身 |
| headless `zcode --prompt`（fallback） | 按进程可控：`ZCODE_MODEL` + `ZCODE_API_KEY` 环境变量 | 本机实测：无效模型 ID 立即硬失败（fail-fast）；共享 OAuth 不喂 headless。仅在需要「同一会话内逐 run 换模型」等自定义 agent 覆盖不了的精细控制时使用，见 `scripts/run-headless-eval-arm.mjs` |

### 自定义 agent 通道的做法

用户在 zcode 里创建评测专用 subagent（UI 会把定义写入 `~/.zcode/agents/<name>.md`），frontmatter 实例：

```yaml
---
name: "skill-creator-evals"
description: "skill-creator-evals 专用 subagent"
color: yellow
model: "custom:builtin%3Abigmodel-coding-plan:GLM-5.3-Flash"
thoughtLevel: high
injectAgentsMd: true
---
```

- 模型值来自 zcode 的模型选择器（形如 `custom:builtin%3A...:GLM-5.3-Flash`），用户在 UI 里选即得，不要手拼。
- 需要分档时建多个：如 `skill-creator-evals`（执行臂/探针，低档）+ `skill-creator-graders`（评分器，高档或低档+高 thought）。
- **注册表是宿主启动快照**：agent 定义必须在该评测会话开始前存在——当前会话中途新建的 agent，本会话 spawn 不到（实测 `Agent type not found`；宿主重启后即恢复）。起跑前先 spawn 一次 1-turn 冒烟确认在列。
- **没有运行时临时建 agent 的能力**：Agent 工具无模型参数与内联定义；subagent 工具清单里没有 Agent 工具（嵌套 spawn 不存在，实测）；CLI 无 agents 子命令。要换模型只能「定义文件 + 重启」或走 headless。

### 换机器/缺定义时的自建与降级链

1. **自建（推荐）**：用 `node scripts/provision-eval-agent.mjs --ensure --name <agent> [--model <id>] [--force]`——检测/自建/校验一体：缺失按模板写入（默认 `model: inherit`，`model:` 值从 zcode 模型选择器抄）、已存在幂等不改写、model 不同须 `--force` 才覆盖；`--check` 供冒烟前校验、`--list` 枚举现有定义（含 model/thoughtLevel）。代价是**一次宿主重启**才生效；先问用户再写。
2. **headless 通道**：进程级模型控制、无需重启，但要求 `ZCODE_API_KEY`+`ZCODE_MODEL` 已预置（换机器时用户自带 key 才可用）。
3. **宿主同款兜底**：以上都不可用时按默认 spawn（general-purpose），评测照常能跑，只是没有降档——**缺定义从不导致评测失败**。
- 编排侧只改一处：run prompt 模板不变，spawn 参数把 agent 类型从 `general-purpose` 换成用户选定的评测 agent。

## 控制成功的三道验证

1. **冒烟在列**：跑批前对该 agent 类型 spawn 一次 1-turn 识别请求——注册表里有它即通过；`Agent type not found` = 定义晚于会话启动，重开会话或换通道。
2. **定义可审计**：agent 定义是磁盘文件（`~/.zcode/agents/*.md`），评测记录里引用其 `model:` 值作为轮次模型配置的依据；headless 通道则以 run-meta.json 的 `model_requested` 为准（schema 见 references/schemas.md）。
3. **可比性门**：模型是 harness 维度。同一 eval 的各 gate 必须**同模型同批**跑（6.1 铁律的模型扩展）；跨模型的历史轮不参与 vs_previous 胜负，benchmark notes 必须写明「模型配置=X，与上轮（Y）不可比」。混合模型轮（如 baseline 降档、with_skill 不降）允许，但 delta 必须标注「含模型差异，不可归因技能」。

## 成本建议（默认给用户的菜单）

- 全宿主同款（默认，零改动，历史可比）。
- 探针 + baseline 降档：触发评测 60+ 探针是最大数量头，输出只有一行，降档损失最小；用自定义 agent（如 `GLM-5.3-Flash`）实现。
- 执行臂全降、grader 保档（或低档模型 + `thoughtLevel: high`）：适合回归轮。
- 发版验收轮：全部保档（with_skill/old_skill/without_skill 同模型），保证数字可进 history 对比。

## 本机已实证的宿主行为记录（zcode 0.16.5, 2026-09-01）

- `~/.zcode/agents/<name>.md` 是用户级自定义 agent 定义位置（zcode agent 创建 UI 的实际落盘处）；frontmatter 支持 `model:`/`thoughtLevel:`。
- Agent 注册表为会话启动快照：会话中途新建的 agent 本会话不可见（实测 not found）；宿主重启后同一会话可正常 spawn 并通过 1-turn 工具冒烟（2026-09-01 实测：skill-creator-evals / GLM-5.3-Flash，28.6k tokens、单工具调用成功落盘）。
- subagent 工具清单无 Agent 工具（嵌套 spawn 不存在，2026-09-01 实测）——运行时临时建 agent 无通道。
- `~/.zcode/v2/agents-state.json` 存在 `builtInModelOverrides`（可按内置 agent 类型覆写模型）——观察到的宿主机制，但会全局改变内置类型行为，不建议评测用。
- `--max-turns`、`--settings` 出现在 `--help` 文本里但参数解析器拒收（`Unknown option`）——启动器不要依赖它们。
- 裸 `zcode --prompt`（无 ZCODE_MODEL）：`Model config is missing`；共享 OAuth 登录不喂 headless。`ZCODE_MODEL=<无效ID>`：认证通过、模型解析失败 → `Turn execution failed`（fail-fast 成立）。
- `run-headless-eval-arm.mjs` 守门路径（缺 ZCODE_MODEL / 缺 ZCODE_API_KEY / 参数缺失 → 退出码 2 拒绝）已实测；带真实 key 的成功路径未在本机验证，首用先冒烟。
