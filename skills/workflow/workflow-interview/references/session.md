# 任务记录与命令

命令路径以 workflow-interview 技能目录为基准。已有任务沿原目录续跑，不批量改写旧记录。

## 建立与恢复

```bash
node <skill-dir>/scripts/session.mjs init <date>-<任务词组> --request "<用户原话>"
node <skill-dir>/scripts/session.mjs rebuild <issue>
```

init 幂等。续跑读取 manifest、当前契约和相关决定；rebuild 依据已有记录恢复状态，
不从文件存在推断用户确认。任务目录随目标仓保存；迁移时保持引用有效，避免两个可编辑真源。

manifest 只由 session.mjs 写。context、facts、原型和审查材料按实际需要保存，
必要理解可直接纳入契约；不要求材料齐套。

## 结构化问答

发生问答时，用 `session.mjs round <issue> '<JSON>'` 追加实际记录，不手改 rounds.jsonl。

```json
{
  "stage": "1-interview",
  "round": 1,
  "tier": "ask",
  "question": "目标系统需要离线运行吗？",
  "options": [
    { "key": "A", "text": "完全离线" },
    { "key": "B", "text": "允许在线服务" }
  ],
  "response": { "type": "single_select" },
  "user_choice": "A",
  "user_verbatim": "部署环境不能联网"
}
```

- stage：1-interview / 2-prototype / 3-contract；round 为轮次。
- tier：default / confirm / ask。default、confirm 用 item，ask 用 question。
- options 有选项时每项含 key、text；pct 可省略，旧数值原样保留。
- response.type：single_select、multi_select、boolean、short_text、long_text、number、date_time、ranking、evidence。
- user_choice、user_verbatim、choices 保存实际答案；triggered_by 可指向触发问题的材料。
- 多选边界用 min_selections / max_selections；旧 min / max 别名仍支持，冲突值拒收。

这些字段用于已有记录协议，不要求制造未发生的问答或为普通工程取舍逐项提问。

## 职责状态与修订

```bash
node <skill-dir>/scripts/session.mjs stage <issue> 1-interview done --reason "<已有授权或决定>"
node <skill-dir>/scripts/session.mjs stage <issue> 2-prototype done --artifacts "<实际确认的文件>"
node <skill-dir>/scripts/session.mjs stage <issue> 2-prototype skipped --reason "<复用依据或无需另制的理由>"
```

done 是宿主对已对齐内容的声明，不是机器替用户确认。--artifacts 可省略；列出的材料
须已确认且可访问。--goal 可记录目标；旧 --assessment 兼容读取，不决定阶段能否完成。

改变目标或验收含义时对齐受影响部分，保留可比较旧版与重要理由。需要重访时用
needs_reinterview 记录原因；它撤销旧 ready、标记校验过期，不删除历史。纯契约修订
可直接更新并重新 finalize，无需为形式重新访谈。

## 校验、复验与交接

```bash
node <skill-dir>/scripts/session.mjs finalize <issue>
node <skill-dir>/scripts/session.mjs stage <issue> 3-contract done --next "<交接>"
node <skill-dir>/scripts/session.mjs verify <issue> --write
```

finalize 检查契约结构、所有 [A] 命令入口和交接条件。冒烟 PASS 只表示入口返回零，
FAIL 表示非零，UNRUNNABLE 表示无法执行；仍需判断命令是否覆盖目标、非零是否属于
有效占位或真实失败。占位不能证明产品或验收载体已就绪。非 [A] 项需另行取得相应证据。

ready 需要职责已履行、授权与验收已对齐、当前校验有效且无契约阻塞。finalize 单独通过
不表示用户确认或产品完成。旧任务已确认的验证和人工要求继续有效。

冒烟快照为 3-contract/verify.txt；实现后复验写 verify-evidence.txt，不覆盖原冒烟快照。
契约或 candidate 变化后仍按下游摘要、SHA 和回执协议复验，不能沿用失配证据。

需要完整档案时运行：

```bash
node <skill-dir>/scripts/export-dossier.mjs --issue-dir <issue>
```

契约模板见 [goal-contract-shape.md](../../aes-goal-contract/references/goal-contract-shape.md)，
交接文本见 [handoff-prompt.md](../../aes-goal-contract/references/handoff-prompt.md)。
