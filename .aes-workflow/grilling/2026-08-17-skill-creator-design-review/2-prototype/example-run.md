<!-- draft v1 | published 2026-08-17T17:40:00+08:00
     用户意见：好的·通过(全文无修改,2026-08-17)
     状态：confirmed -->

# 可执行示例: 2026-08-17-skill-creator-design-review

端到端跑起来的样子。写死示例输出，不连真实系统。报文结构以 api-mock.md 为准，此处只写「怎么用、看到什么」。

## 场景 1：init 一个新技能（变化）

```bash
$ node scripts/init-skill.mjs demo-flow --structure task
init demo-flow → G:/x/.claude/skills/demo-flow
  SKILL.md            (含待办占位、结构选择指南节与测试节)
  run-tests.mjs       (回归测试骨架，升级校验的依据)
  references/design.md  (设计文档骨架:意图/取舍/验收AC编号/迭代记录)
  scripts/README.md     (占位说明，语言无关)
  ...
```

## 场景 2：quick-validate（变化 + 不变并存）

```bash
$ node scripts/quick-validate.mjs ../../demo-flow
PASS G:/x/.claude/skills/demo-flow
  name: demo-flow (9/64)
  description: 68/1024, 无尖括号
  键: name, description ✓
                                    # ← 无警告：design.md 与 run-tests.mjs 齐备

$ node scripts/quick-validate.mjs ../../analyze     # 存量老技能
PASS G:/x/.claude/skills/analyze
  ...
  警告: 无 run-tests.mjs——新技能必须固化测试(init 脚手架自带)；旧技能升级时补上
  警告: 无 references/design.md——设计依据不可考(新技能必须,老技能升级时补)
                                      # ← 退出码仍是 0，老技能照常工作
```

## 场景 3：评测起跑前的 gate 问询（变化，对话内）

```
（6.1 起跑前，agent 问用户）
这轮评测跑哪些 gate？默认建议：with_skill + old_skill + without_skill（改进型）。
可增删，也可自定义 gate 名（gate 名=产物配置目录名）。
> 就默认 + 再加一个 with_skill_no_refs（不带 references 跑一组）
（agent 逐 gate spawn，目录布局照旧：eval-<名>/<gate>/run-1/outputs/）
```

## 场景 4：聚合并沉淀历史（变化）

```bash
$ node scripts/aggregate-benchmark.mjs <workspace>/iteration-2 --skill-name feishu-doc-qa \
    --history G:/PM/.agents/skills/feishu-doc-qa
benchmark.json / benchmark.md 已产出（与现在逐字节同口径）
history: 追加 1 条 run（第 2 条）→ won 2 / lost 0 / tie 1（vs 上一条，按 eval 名匹配）
history: current_best 保持 runs[1]（pass_rate 持平不推进）
```

不带 `--history` 时：输出与现在完全一致（不变用法，见 behavior.md 不变清单）。

## 场景 5：结构审查步产出（变化，对话内 + design.md 追加）

```
（6.4 聚合后，agent 按拆分 checklist 审查）
结构审查（只建议，不执行）：
  [✓] 信号1 原子可复用：SKILL.md 第 3 节的日志解析例程，ue-error-solver 也各自实现了一份
  [✓] 信号2 多类意图：description 同时招「翻译报错」与「汇总周报」两类不相干请求
  [ ] 信号3 编排内嵌：无
  [✓] 信号4 触发评测 near-miss：q5/q9 误触发集中在「翻译」类
建议：把「日志解析」抽成独立原子技能，本技能改为编排层调度（样板：grill-with-docs 之于 grilling）。
      是否拆分由你决定，我不动手。
（用户不拆 → agent 在 design.md 迭代记录追加一行，含此结论）
```

## 场景 6：打包（变化：包内多两个文件）

```bash
$ node scripts/package-skill.mjs ../../demo-flow dist/
校验 PASS；打包 8 条目：
  demo-flow/SKILL.md
  demo-flow/run-tests.mjs
  demo-flow/history.json          # ← 新增（Q6-C：成绩随包）
  demo-flow/references/design.md  # ← 新增（Q1-A：设计随包）
  ...
→ dist/demo-flow.skill
```

## 不变场景（必须逐字节照跑）

```bash
$ node scripts/snapshot-skill.mjs ../../feishu-doc-qa
SNAPSHOT G:/x/.claude/skill-workspaces/feishu-doc-qa-workspace/skill-snapshot-v2
基线 run 的「技能路径」填上面目录，prompt 注明：技能文档读 SKILL.md.bak

$ node scripts/check-shadow-skills.mjs        # 无参数自动发现，输出同现在
$ node <技能目录>/run-tests.mjs               # 36 例全过不被破坏
```
