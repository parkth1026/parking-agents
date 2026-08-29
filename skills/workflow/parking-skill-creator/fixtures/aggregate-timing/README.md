# 聚合 timing 离线夹具

这些目录是可直接交给 `scripts/aggregate-benchmark.mjs` 的最小真实评测布局，分别覆盖：

- `all-null`：所有 run 都有 `timing.json`，但两个 timing 字段均为 `null`；
- `partial`：本轮有有效 timing，但每个 gate 各缺一个指标；
- `normal`：所有 run 都有有效 timing；
- `missing-file`：所有 run 都没有 `timing.json`。

回归测试会把单个 `iteration-1` 目录复制到临时目录再聚合，避免在夹具中写入 `benchmark.json`/`benchmark.md`。
