# 无嵌套 Agent 工具时的 headless 触发探针

## 适用边界

先让准备编排探针的会话自检工具清单。只有**当前编排会话本身**没有 spawn/Agent 能力，且主会话已经把同宿主、同模型的 `ZCODE_API_KEY` 与 `ZCODE_MODEL` 放进当前进程环境时，才使用本 fallback。

不满足任一条件就停止编排，把触发评测交回主会话直跑。不得由当前 agent 自己回答探针，也不得把“无法运行”伪装成 `SKILL: none`。fallback 只能替代 transport，不能改变题库、prompt、模型或判定口径。

## 三条红线

1. **共享配置禁区**：不得读取、备份、修改或恢复 `~/.zcode/cli/config.json`，也不得从 `~/.zcode/v2/config.json` 或任何其他配置文件提取 key。launcher 用私有空 settings 隔离共享 CLI 配置。
2. **凭据只进进程环境**：只接受父进程预置的 `ZCODE_API_KEY` 与 `ZCODE_MODEL`。不得把 key 放进命令参数、prompt、stdin、settings、日志、probe-results、临时文件或仓库文件；不得输出 key、长度或前缀。
3. **禁止自答**：一次 headless 调用对应一个独立探针，`--max-turns 1`。Provider 失败、超时、CLI 不存在或首行协议非法都记执行失败，重跑或交回主会话，编排器绝不补写答案。

不要把真实 key 写进 shell 历史。环境值必须由已授权的主会话/宿主进程预先注入；本技能不提供读取凭据存储的命令。

## 逐字 prompt

launcher 固定生成下列模板；`<query 原文>` 与 `<技能清单>` 是仅有的两个插槽：

```text
你是一个技能路由判断器。你不需要、也不允许实际执行任务、调用任何工具或浏览任何文件——你只做一件事：从下面的技能清单里选出会用到的技能。

用户向你提出以下请求：

<query 原文>

请先决定你会使用哪个技能来处理它。可用技能清单如下（name + description）：
<逐条列出会话可见的全部技能清单>

回复格式要求（必须严格遵守）：
第一行输出 `SKILL: <技能name>`——你会读取并使用的技能名；若不需要任何技能则输出 `SKILL: none`。
第二行起用不超过 15 个字说明理由。
```

技能清单只含会话可见的 `name + description`。不得包含 `should_trigger`、预期答案、评测意图、目标技能暗示、题库路径、评分器或既有 `probe-results`。query 必须是题库原文，不改写、不加解释。

## 单轮执行

先把技能清单写入不含凭据的普通文本文件，再逐 query 串行或按宿主许可受限并发调用。Windows + Git Bash 的本机入口示例：

```bash
node scripts/run-headless-trigger-probe.mjs \
  --query "<query 原文>" \
  --skills-file "<workspace>/visible-skills.txt" \
  --command bash \
  --command-arg /c/Users/parking/bin/zcode \
  --temp-root "<workspace>/tmp" \
  --scan-root "<workspace>" \
  --scan-root "$TEMP" \
  --exclude "$HOME/.zcode"
```

原生可执行文件宿主可省略 `--command`/`--command-arg`，默认直接运行 `zcode --prompt`。launcher 使用参数数组而不是 shell 拼接 prompt，并额外传入 `--max-turns 1 --mode plan --surface terminal --settings <私有空文件> --no-color`。它只转发合法的首行与短理由；Provider 原始 stderr 不外显，防止错误信息带出凭据。

把合法回复逐条按 `references/schemas.md` 追加到 `probe-results.jsonl`。launcher 不代写 JSONL，以免执行失败被误记成有效探针。

## 清理与残留扫描

每次调用都把 `TEMP`/`TMP`/`TMPDIR` 指向该调用独占的 `psc-trigger-probe-*` 目录。Provider 返回后先在目录内检查凭据前缀，再无条件递归删除；即使前缀文件已随目录清掉，本次调用仍判失败。私有目录清理完成后必须继续扫描全部外部 `--scan-root`，输出 `RESIDUE_SCAN_OK`（干净）或 `RESIDUE_SCAN_DONE ... status=failed`（有问题）的审计摘要，最后才统一报告所有失败；私有命中不得跳过外部扫描。只删除 launcher 自己创建的目录；不清理共享 Temp 中来源不明的文件。

`--scan-root` 必须覆盖本轮所有可写位置，至少包括 workspace 和宿主 Temp；严格验收可把每个授权且可读的本地盘根逐个传入。扫描器默认排除当前用户的 `.zcode/cli/config.json` 与 `.zcode/v2/config.json`，其他合法 secret store 用 `--exclude` 明确排除。它仅从进程环境在内存中派生 12 字符前缀，分块读取普通文件，不跟随 symlink，不打印匹配内容或前缀。发现残留、遇到不可读路径或扫描不完整都退出 1；命中路径由人工确认后再做最小范围清理，不自动删除非自有文件。

扫描本地盘时必须排除宿主合法凭据存储所在的树，并在验收报告中写明排除项；不要用残留扫描变相读取已知 secret store。若无法给出完整、授权且排除了 secret store 的扫描根集合，就把全盘扫描标成 `BLOCKED`，不得声称已完成。

结束前确认：

- `psc-trigger-probe-*` 私有临时目录为零；
- 每个调用都有 `RESIDUE_SCAN_OK` 或 `RESIDUE_SCAN_DONE` 外部扫描摘要；成功调用没有 `RESIDUE`；
- `~/.zcode/cli/config.json` 未被当前流程读取或改写；
- 日志、JSONL、仓库 diff 和临时目录中没有凭据前缀；
- 无效/失败调用没有对应的自答探针行。
