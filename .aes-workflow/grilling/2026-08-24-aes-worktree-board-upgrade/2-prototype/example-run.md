# 可执行示例: 2026-08-24-aes-worktree-board-upgrade

**确认版·锁定。** 执行 Agent 改的是产品，不是这份示例。
用户确认：2026-08-24T09:22:01Z

示例输出为写死的预期形态，不连真实系统。报文结构定义见 api-mock.md，此处只写「怎么用、看到什么」。
`$SK` = `.agents/skills/aes-worktree-board`，工作目录 = 目标仓根。

## 场景 1：Desktop Task 登记（正常路径）

```bash
node $SK/scripts/orchestrate.mjs task create --issue 17 --worktree dev4 --role executor \
  --thread-id T-01HXYZ --model luna-max --routing-reason "单包、AC明确、自动测试可覆盖"
```
```text
{"result":"created","taskId":"tk-dev4-17-g1","state":"dispatching","lease":"dev4"}
```
退出码 0。registry.json、transitions.jsonl 各新增一笔（原子写）。

## 场景 2：未授权的 headless 派发被拒（变化行 2）

```bash
node $SK/scripts/orchestrate.mjs task create --issue 17 --worktree dev4 --role executor --agent claude
```
```text
[preflight] cli-fallback 需显式授权：加 --fallback-authorized "<用户原话>"；正常路径是 Desktop create_thread。
```
退出码 2，registry 无变化。

## 场景 3：事件入箱→消费→重复消费（变化行 3/4/5）

```bash
node $SK/scripts/orchestrate.mjs inbox put --thread T-02R --kind final --payload-file poll1.json
node $SK/scripts/orchestrate.mjs consume --event-id E-7f3a
node $SK/scripts/orchestrate.mjs consume --event-id E-7f3a   # 重复送达
```
```text
{"result":"queued","eventId":"E-7f3a"}
{"result":"consumed","eventId":"E-7f3a","transition":{"from":"reviewing","to":"approved"},"nextAction":"merge-gate"}
{"result":"already-consumed","eventId":"E-7f3a"}
```
三条退出码都是 0。第三条不产生任何状态变化。

## 场景 4：新回合续接（listener 恢复，q3=B）

```bash
node $SK/scripts/orchestrate.mjs inbox pending
```
```text
{"pending":[{"eventId":"E-9c21","threadId":"T-05X","kind":"final","receivedAt":"…"}],
 "cursors":{"T-01H":"E-8811","T-02R":"E-7f3a"},"orchestration":"running"}
```
新回合的 agent 先跑这条，把上回合漏掉的事件补消费完，再继续 wait_threads。

## 场景 5：第三次 BLOCK 熔断（变化行 7/8）

```bash
node $SK/scripts/orchestrate.mjs block record --task tk-dev1-56-g1 --commit a1b2c3 --event-id E-b3 --finding-file review3.md
```
```text
{"result":"circuit-broken","blockCount":3,"state":"handoff-required",
 "handoffBundle":".aes-worktree-board/runtime/handoff/tk-dev1-56-g1.md"}
```
退出码 0。交接包已生成；此后对该线路的任何派发命令都退出 2。

## 场景 6：全局停止评估（变化行 10/11）

```bash
node $SK/scripts/orchestrate.mjs stop eval --write
node $SK/scripts/collect.mjs          # 之后再巡检
```
```text
{"result":"stopped","reason":"no-advanceable-lane",
 "lanes":{"dev1":"handoff-required","dev2":"handoff-required","dev3":"parked","dev4":"merged","dev5":"parked","test":"excluded"}}
collect: 写出 status.json (schemaVersion 3)；orchestration=stopped 原样保留，终态未被改写
```
若仍有可推进线路，`stop eval` 退出 1 并点名哪条线路还能走（此时 `--write` 不生效）。

## 场景 7：编排回归域（新验收主力）

```bash
node $SK/scripts/selftest.mjs orchestration
```
```text
{"ok":true,"domain":"orchestration","scenarios":10,"passed":10}
```
十个场景 = 复盘 P2.3 清单（duplicate final、漏 polls、三次 BLOCK、park 后 late event、runtime NOT_RUN 不阻塞 autonomous、global stop、v2 快照兼容、torn read、锁竞争、merge 后 behind 刷新）。失败退出 1 并打印首个失败场景。

## 场景 8：现有用法必须逐字节不变（不变清单）

```bash
node $SK/scripts/selftest.mjs fixture
node $SK/scripts/collect.mjs --no-gh --issues-fixture $SK/fixtures/aes-agent-issues.json
```
这两条现在能跑；改完之后必须同样能跑、同样退出 0（fixture 域输出 `{"ok":true,"domain":"fixture"}` 不变；collect 输出的 schemaVersion 从 2 变 3 是唯一预期差异，已列变化行 16 的兼容口径）。
