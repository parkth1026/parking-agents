# 测试约定

- 全部测试：`npm test`（node test/run-tests.mjs，退出码 0 为过）。
- 消费链路改动需要为失败路径补断言；仓库没有集成环境，用本地 jsonl 数据验证。
