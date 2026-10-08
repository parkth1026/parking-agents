#!/usr/bin/env node
// run-tests.mjs — drawio 技能的结构回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒检查，退出码 0=全过/1=有失败。测试固化在技能里，随技能分发。
// 回归对象：frontmatter 合法、references 本地化在位（不外网拉取）、调用示例宿主中立、
// 上游同步所需的章节齐全、references 无机器绝对路径。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL = join(SKILL_DIR, "SKILL.md");
const REFS = [
  join(SKILL_DIR, "references", "xml-reference.md"),
  join(SKILL_DIR, "references", "mermaid-reference.md"),
  join(SKILL_DIR, "references", "style-reference.md"),
];
const DESIGN = join(SKILL_DIR, "references", "design.md");
const design = existsSync(DESIGN) ? readFileSync(DESIGN, "utf8") : "";

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const skill = existsSync(SKILL) ? readFileSync(SKILL, "utf8") : "";
const fm = skill.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)?.[1] ?? "";
const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
const desc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";

// frontmatter：name = 目录名；description 含中英触发词
check("SKILL.md 存在且含 frontmatter", skill !== "" && fm !== "");
check("name 与目录名一致", name === "drawio");
check("frontmatter 仅 name/description 两键", (fm.match(/^[a-z-]+:/gm) ?? []).length === 2);
check("description 含英文触发词（draw.io / diagram）", /draw\.io/i.test(desc) && /diagram/i.test(desc));
check("description 含中文触发句", desc.includes("用户要求画图"));

// 本地化不变量：正文不再指向 raw.githubusercontent.com 的 reference
check("正文无 raw.githubusercontent.com 拉取指令", !/raw\.githubusercontent\.com/.test(skill));
check("Mermaid reference 指向本地 references/", skill.includes("references/mermaid-reference.md"));
check("XML reference 指向本地 references/", skill.includes("references/xml-reference.md"));

// 宿主中立：无 Claude 插件市场调用前缀
check("无 /drawio:drawio 插件前缀示例", !skill.includes("/drawio:drawio"));

// 上游同步基线：核心章节齐全（上游 SKILL.md 结构）
for (const section of [
  "## Authoring: Mermaid or XML?",
  "## The pipeline",
  "## ELK layout for XML",
  "## Mermaid syntax reference",
  "## Choosing the output format",
  "## Browser URL output",
  "## draw.io CLI",
  "## File naming",
  "## XML format",
  "## XML reference",
  "## Troubleshooting",
  "## CRITICAL: XML well-formedness",
]) {
  check(`正文含节「${section}」`, skill.includes(section));
}

// references 三件套在位且非空
for (const ref of REFS) {
  const ok = existsSync(ref) && readFileSync(ref, "utf8").length > 1000;
  check(`references/${ref.split(/[\\/]/).pop()} 在位且非空`, ok);
}

// 机器路径出厂门禁（本技能版）：SKILL.md 含上游面向所有 Windows 机器的通用默认安装位
// （C:\Program Files、%LOCALAPPDATA%、其他盘示例），属可移植内容放行；拦的是本机特定
// 盘符（G:/F:）。锚定「单字母+冒号+斜杠」避免把 https:// 误判成盘符。design.md 是仓内
// 记录，任何盘符一律不许有；~/ 简写与上游 WSL2 通用示例（/home/user、$WIN_USER）按审计
// 口径不算机器路径，放行。
const DRIVE = /(^|[^A-Za-z])[A-Za-z]:[\\/]/;
const texts = [skill, ...REFS.map((p) => readFileSync(p, "utf8"))];
check("分发文档无本机盘符路径（G:/F:）", !texts.some((t) => /(^|[^A-Za-z])[GF]:[\\/]/.test(t)));
check("design.md 无盘符路径", !DRIVE.test(design));

// Codex 适配：agents/openai.yaml（本仓 Codex 元数据载体）三键齐全且允许隐式调用
const openaiYaml = existsSync(join(SKILL_DIR, "agents", "openai.yaml"))
  ? readFileSync(join(SKILL_DIR, "agents", "openai.yaml"), "utf8") : "";
check("agents/openai.yaml 存在且 interface 三键齐全", openaiYaml !== ""
  && ["display_name:", "short_description:", "default_prompt:"].every((k) => openaiYaml.includes(k)));
check("openai.yaml 允许隐式调用", openaiYaml.includes("allow_implicit_invocation: true"));
check("openai.yaml display_name 与技能名一致", openaiYaml.includes('display_name: "drawio"'));

// design.md 四节范式
check("design.md 存在且四节齐全", design !== ""
  && ["意图与触发场景", "设计取舍", "验收条件", "迭代记录"].every((k) => design.includes(`## ${k}`)));

// 占位残留
check("无 TODO 占位残留", !texts.some((t) => t.includes("[TODO")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
