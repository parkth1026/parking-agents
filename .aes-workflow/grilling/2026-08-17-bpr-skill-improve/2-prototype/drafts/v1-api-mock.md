<!-- draft v1 | published 2026-08-17
     用户意见：待质疑
     状态：draft -->

# 接口报文对: verify-refs.mjs

> 定脚本**输出报文结构**（字段、状态闭集、退出码）。怎么跑、人看到什么在 example-run.md，本文件不重复。

## 成功（默认文本模式，exit 0）

```text
verify-refs: report.md
  checked      5
  [ok]          3
  [ambiguous]   1   (403 — 可能 bot 拦截，人工复核)
  [unreachable] 0
结果：通过（无 unreachable 引用）
```

## 业务失败（存在 unreachable，exit 1）

```text
verify-refs: report.md
  checked      5
  [ok]          2
  [ambiguous]   1   (429 — 可能限流，人工复核)
  [unreachable] 2
    - https://ghost.example/article-x   (404)
    - https://typo.exmaple.com/docs     (DNS 解析失败)
结果：2 条 unreachable——按幻觉处理：补出处或删除
```

## 用法错（exit 2）

```text
用法: node verify-refs.mjs <报告.md> [--json] [--timeout <ms>]
  <报告.md>   含 markdown 引用的报告文件路径
  --json      输出结构化 JSON（见下）
  --timeout   单 URL 请求超时毫秒数，默认 10000
```

```text
错误: 文件不存在 — no-such-file.md
```

## 意外错误（exit 3）

```text
意外错误: <异常消息与堆栈首行>
```

## JSON 模式（--json，结构供自动化消费）

```json
{
  "file": "report.md",
  "checked": 5,
  "ok": 2,
  "ambiguous": 1,
  "unreachable": 2,
  "results": [
    { "url": "https://react.dev/learn/start-a-new-react-project", "status": "ok", "http": 200 },
    { "url": "https://example.com/article", "status": "ambiguous", "http": 403 },
    { "url": "https://ghost.example/article-x", "status": "unreachable", "http": 404 },
    { "url": "https://typo.exmaple.com/docs", "status": "unreachable", "error": "ENOTFOUND" }
  ],
  "exit": 1
}
```

## 已锁定的约定

| 约定 | 内容 | 出处 |
| --- | --- | --- |
| status 闭集 | `ok` / `unreachable` / `ambiguous`，无其它值 | 本对照物 |
| ambiguous 判据 | HTTP 403 / 429 / 503，或超时——机器无法区分"拦截"与"死链"，不自动判死 | urlhealth 思路（领域调研）+ 判分建议"bot 拦截是自动化验证天花板（10-20%）" |
| unreachable 判据 | 404 / 410、DNS 失败、连接拒绝；HEAD 405 时回退 GET 复核 | 本对照物 |
| 退出码语义 | 0=通过（ambiguous 不计失败）；1=存在 unreachable；2=用法错；3=意外错误 | 本对照物 |
| 提取范围 | markdown 链接 `[..](url)` + 行内裸 URL；去重（含去 anchor/尾标点） | 本对照物 |
| 字段恒存 | JSON 顶层 `file/checked/ok/ambiguous/unreachable/results/exit` 恒存在；`results[].http` 与 `error` 互斥（一个必有其一） | 本对照物 |
| 只读边界 | 脚本只发网络请求与读目标文件，不写任何文件 | 用户裁定 C3 精神（技能只读） |
