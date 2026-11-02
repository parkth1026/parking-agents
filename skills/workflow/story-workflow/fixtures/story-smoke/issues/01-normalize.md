# 姓名数组规范化
Status: ready-for-agent
Assignee:
Blocked by: None

交付src/normalize.mjs导出normalizeNames；字符串数组逐项trim，去空白和空项，按首次出现顺序去重且大小写敏感。非数组或有非字符串元素抛TypeError。运行node --test tests/normalize.test.mjs，保存原始日志和源码摘要。