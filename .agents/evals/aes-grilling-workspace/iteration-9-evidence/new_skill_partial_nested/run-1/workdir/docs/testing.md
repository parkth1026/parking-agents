# 测试约定

零依赖，不引测试框架。`test/run-tests.mjs` 是唯一入口，它逐个 import
`test/*.test.mjs` 并汇总结果。

```bash
npm test          # 全跑
node test/run-tests.mjs receiver   # 只跑某个文件
```

断言用 `node:assert/strict`。

## 规矩

- 新增行为先写一条会失败的测试，再写实现。
- 改动可观察行为（HTTP 状态码、响应体、落盘格式、转发 body 形状）必须有对应断言，
  不能只测内部函数返回值。
- 用到计数器的测试在 `beforeEach` 位置调 `resetForTests()`，否则会互相污染。
- 需要 fixture 的放 `test/fixtures/`，一个文件一个用途，不复用。

## 现在没覆盖的部分

- 没有端到端测试，没有起真实 HTTP 服务的用例；`receiver` 用假的 req/res 对象测。
- 转发的重试与退避只测了「重试到上限后丢批」，没测退避时长。
- 配置加载只测了 default 一条路径，没测 NODE_ENV 覆盖。
- 没有性能或压力测试，仓库里没有任何基准脚本。
