# AC-005 模拟隔天过程记录

- 时间：2026-08-23（Asia/Hong_Kong）
- 测试 round：`overnight-r3`
- server 进程：PID 60852（detached，测试期间持续存活）
- 浏览器：真实 headed Chromium

## 过程

1. 发布 `overnight-r3` 后启动：

   ```text
   node wait-submit.mjs --issue-dir <issue> --round overnight-r3
   ```

   宿主后台会话 ID 为 `65695`，等待中没有 submission。
2. 在浏览器提交前向该会话发送 Ctrl+C，wait-submit 退出码为 1；这模拟宿主关闭，server PID
   60852 未终止。
3. 浏览器选择 A「仍然 200 并入盘，重开后吸收」，点击提交。
   - Playwright network request #42：`POST /api/submit => 200 OK`。
   - 页面 round 随即显示 `SUBMITTED · 已锁定`。
   - 截图：[01-submit-without-waiter.png](01-submit-without-waiter.png)。
4. 在磁盘检查 `web/submissions/overnight-r3.json`：文件存在，`received_at` 为
   `2026-08-22T17:08:28.614Z`，答案为 `Q-OVERNIGHT / choice A`。
5. 模拟新会话续跑：

   ```json
   {"ok":true,"pending":[{"round":"overnight-r3","stage":"3-contract","answers":[{"q_id":"Q-OVERNIGHT","type":"choice","choice":"A"}]}]}
   ```

6. 模拟家族 round 映射检查成功后运行 `--mark-consumed overnight-r3`，输出：

   ```json
   {"ok":true,"round":"overnight-r3","consumed":true}
   ```

7. 再次 `--scan` 输出 `{"ok":true,"pending":[]}`。
8. 在 server 完全停止后，以当前 `app.mjs` 代码重新执行 `server.mjs start`，真实 Chromium
   冷启动后从盘上恢复全部 submitted/locked 状态；console 为 `0 Errors, 0 Warnings`。
   - 截图：[02-restart-restored-current.png](02-restart-restored-current.png)。
   - 随后显式 shutdown 返回 200，`server-info` 与 `.session-token` 均不存在。

## 结论

等待者被杀后浏览器提交仍 200，submission 先在盘；重开扫描能发现未消化提交，标记后不再
重复吸收。AC-005 通过。此处使用 acceptance fixture 模拟映射，不改家族 manifest、
`rounds.jsonl` 或 `session.mjs`。
