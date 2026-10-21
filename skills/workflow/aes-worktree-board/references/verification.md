# 维护与升级检查

以下是本技能已有维护门禁；不是每次操作或每份任务的 AC。

## 自检

```powershell
node "$skillDir/scripts/selftest.mjs" orchestration
node "$skillDir/scripts/selftest.mjs" orchestration --scenario runner-lifecycle
node "$skillDir/scripts/selftest.mjs" orchestration --scenario recovery
node "$skillDir/scripts/selftest.mjs" orchestration --scenario trajectory-replay
node "$skillDir/scripts/selftest.mjs" orchestration --scenario discovered-work
node "$skillDir/scripts/selftest.mjs" orchestration --scenario delivery-merge
node "$skillDir/scripts/selftest.mjs" board-ui --baseline 700x1000
node "$skillDir/scripts/selftest.mjs" orchestration --scenario storage
node "$skillDir/scripts/selftest.mjs" orchestration --scenario lifecycle
node "$skillDir/scripts/selftest.mjs" orchestration --scenario governance
node "$skillDir/scripts/selftest.mjs" orchestration --scenario continuous
node "$skillDir/scripts/selftest.mjs" orchestration --scenario boundary
node "$skillDir/scripts/selftest.mjs" orchestration --scenario contract
```

默认 `run-tests.mjs` 的 `collect / fixture / dispatch / server / repo-root / layout / windows-hide / orchestration / identity / board-ui` 全部使用本机或离线 fixture，必须稳定全绿。真实 GitHub 巡检另跑 `node "$skillDir/scripts/selftest.mjs" collect-live`；它是受授权、网络和实时 Issue 变化影响的 live smoke，不进入默认门禁。所有新增 child_process 启动点仍使用 `HEADLESS_CHILD_OPTIONS`。页面视觉与交互必须用真实浏览器逐处对照锁定 mock；自动自检不能替代人工 UI AC。

发布或升级前运行技能根的标准回归入口：

```powershell
node "$skillDir/run-tests.mjs"
```

身份隔离专项回归也可单独运行：

```powershell
node "$skillDir/scripts/selftest.mjs" identity
```

设计意图、AC 与本轮修复记录见 [design.md](design.md)；改契约时先更新该文件，再同步 SKILL 与回归断言。
