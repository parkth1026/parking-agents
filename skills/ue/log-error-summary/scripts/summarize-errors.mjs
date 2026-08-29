#!/usr/bin/env node
// summarize-errors.mjs — 日志错误频次表：识别错误行 → 签名归并 → markdown 表
// 用法: node summarize-errors.mjs <日志文件> [输出.md]（省略输出则打印 stdout）
// 退出码: 0 成功 / 1 文件不可读 / 2 用法错
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || input.startsWith("-")) {
  console.log("用法: node summarize-errors.mjs <日志文件> [输出.md]");
  process.exit(2);
}

let content;
try {
  content = readFileSync(input, "utf8");
} catch (err) {
  console.log(`日志文件不可读: ${input}（${err.code ?? err.message}）`);
  process.exit(1);
}

const ERROR_LINE = /\berror\b/i; // v2：大小写不敏感，ERROR/Error/error 均计入（AC-2）
const signature = (line) =>
  line.replace(/\d+/g, "N").replace(/"[^"]*"/g, '"…"').replace(/'[^']*'/g, "'…'").slice(0, 80);

const counts = new Map();
for (const raw of content.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || !ERROR_LINE.test(line)) continue;
  const sig = signature(line);
  const entry = counts.get(sig) ?? { count: 0, sample: line };
  entry.count += 1;
  counts.set(sig, entry);
}

const rows = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
const esc = (s) => s.replace(/\|/g, "\\|");
let md = "# 错误汇总\n\n| 错误模式 | 次数 | 代表样例 |\n| --- | --- | --- |\n";
for (const [sig, e] of rows) md += `| ${esc(sig)} | ${e.count} | ${esc(e.sample)} |\n`;
const total = rows.reduce((s, [, e]) => s + e.count, 0);
md += `\n共 ${total} 条错误，${rows.length} 类。\n`;

if (output) {
  writeFileSync(output, md, "utf8");
  console.log(`错误汇总 → ${output}（${total} 条错误，${rows.length} 类）`);
} else {
  process.stdout.write(md);
}
process.exit(0);
