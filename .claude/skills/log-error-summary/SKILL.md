---
name: log-error-summary
description: 统计构建/服务日志中的错误分布，输出 markdown 频次表（错误模式/次数/代表样例，同型错误归并计数）。用户想看一份日志里有哪些错误、各出现多少次、哪类错误最高频时使用——典型场景是 Jenkins 构建日志、服务运行日志的错误排查第一步。
---

# Log Error Summary

## Overview

把一份文本日志变成一张错误频次表：哪些错误模式、各出现多少次、代表行长什么样——排查日志的第一步交给确定性脚本，不靠肉眼数。

## Quick Start

    node scripts/summarize-errors.mjs <日志文件> [输出.md]

- 省略输出参数则打印到 stdout；给了则写文件并回报「N 条错误，M 类」。
- 表格三列：错误模式（签名）/ 次数 / 代表样例，按次数降序。

## 口径

- 错误行 = 含 error 字样的行（大小写不敏感：ERROR/Error/error 均计入，见 design.md AC-2）。
- 同型归并：行内数字、双引号/单引号串视为可变量归一后取前 80 字符做签名——`exit code 1` 与 `exit code 137` 是同一类。
- 只统计、不解读：错误根因分析不在本技能范围，产出表后由人或后续流程接手。

## 测试

技能自带回归测试。每次升级、改动后必跑，确认没改坏既有行为：

    node run-tests.mjs

用例固化在 run-tests.mjs（黑盒跑脚本 + 比对输出），黄金输入在 fixtures/。

## Resources

- scripts/summarize-errors.mjs — 确定性计数脚本（低自由度）
- references/design.md — 设计文档：意图、取舍、验收条件 AC-N、迭代记录（评测断言以 ac 字段引用之）
- fixtures/ — 测试黄金输入
