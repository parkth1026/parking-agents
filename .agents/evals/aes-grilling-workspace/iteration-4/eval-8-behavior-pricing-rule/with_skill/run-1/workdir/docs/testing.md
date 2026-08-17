# 测试约定

- 全部测试：`npm test`（node test/run-tests.mjs，退出码 0 为过）。
- 价格计算改动必须补边界值断言；金额一律精确断言，不做范围判断。
