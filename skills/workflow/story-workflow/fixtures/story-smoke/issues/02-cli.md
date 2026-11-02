# 命令行输入输出
Status: planned
Assignee:
Blocked by: 姓名数组规范化

交付src/cli.mjs，复用normalizeNames，从stdin读取JSON数组（支持无末尾换行）；成功JSON和换行输出到stdout退出0，非法输入退出1且stdout空、stderr有可读错误。node --test tests/cli.test.mjs及全量node --test。