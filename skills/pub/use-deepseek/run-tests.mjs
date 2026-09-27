#!/usr/bin/env node
// run-tests.mjs — use-deepseek 的回归测试（升级/改动后必跑）
// 本技能的运行时行为依赖真实浏览器与 DeepSeek 会话（AC-7 为实机冒烟，人工执行并记入 design.md 迭代记录），
// 可脚本固化的是文档结构护栏——防止改动悄悄破坏协议关键条款。断言与 design.md 的 AC 编号一一对应。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(SKILL_DIR, p), "utf8");

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const skill = read("SKILL.md");
const fm = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
const desc = fm?.[1].match(/^description:\s*(.+)$/m)?.[1] ?? "";

// AC-1 frontmatter 合规
check("AC-1 name 为 use-deepseek", fm != null && /^name:\s*use-deepseek\s*$/m.test(fm[1]));
check("AC-1 description 非空且 ≤1024 且无尖括号", desc.length > 0 && desc.length <= 1024 && !/[<>]/.test(desc));
check("AC-1 全文无 TODO 占位、无「结构选择指南」残留", !skill.includes("TODO") && !skill.includes("结构选择指南"));

// AC-2 接入护栏
check("AC-2 指涉 control-browser 通用协议", skill.includes("control-browser"));
check("AC-2 优先接管既有标签页（tabs.list 与 user.openTabs）", skill.includes("browser.tabs.list()") && skill.includes("browser.user.openTabs()"));
check("AC-2 登录/验证码即停且不代填", skill.includes("验证码") && skill.includes("停下通知用户"));

// AC-3 凭据红线
check("AC-3 不索取不代填凭据", skill.includes("不索取") && skill.includes("代填"));
check("AC-3 凭据类内容不外发", skill.includes("不得外发") && skill.includes("私钥"));

// AC-4 消息循环与等待纪律
check("AC-4 消息循环四步齐备", ["1. 发送", "2. 等待", "3. 读取", "4. 落盘"].every((s) => skill.includes(s)));
check("AC-4 指向 deepseek-ui.md 的完成判定", skill.includes("references/deepseek-ui.md") && skill.includes("多信号"));
check("AC-4 长生成不催促不重发", skill.includes("不催促") && skill.includes("不重发"));

// AC-5 UI 地图护栏
const ui = existsSync(join(SKILL_DIR, "references", "deepseek-ui.md")) ? read("references/deepseek-ui.md") : "";
check("AC-5 deepseek-ui.md 存在且声明以现场快照为准", ui.includes("domSnapshot") && ui.includes("不是选择器契约"));
check("AC-5 完成判定多信号齐备", ["停止", "输入框恢复", "不再增长"].every((s) => ui.includes(s)));

// AC-6 设计文档无占位
const design = read("references/design.md");
check("AC-6 design.md 验收表无 TODO 且含 AC 条目", !design.includes("TODO") && (design.match(/^\| AC-\d+/m) != null));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
