#!/usr/bin/env node
// init-skill.mjs — 通用技能脚手架（codex init_skill.py 移植，模板语言无关、不带本仓库假设）
// 用法: node init-skill.mjs <name> [--structure workflow|task|reference|capabilities] [--path <目录>]
// 退出码: 0 成功 / 1 拒绝（目录已存在且非空）/ 2 用法错（名字非法/超限）
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_NAME = 64;
const STRUCTURES = {
  workflow:     { label: "工作流型（顺序流程）",   resources: ["scripts", "references"] },
  task:         { label: "任务型（工具集合）",     resources: ["scripts", "references", "assets"] },
  reference:    { label: "参考型（规范标准）",     resources: ["references"] },
  capabilities: { label: "能力型（综合系统）",     resources: ["references", "assets"] },
};

function usage() {
  console.log("用法: node init-skill.mjs <name> [--structure workflow|task|reference|capabilities] [--path <输出目录>]");
  console.log(`  --structure 结构模式（默认 task）: ${Object.keys(STRUCTURES).join(" | ")}`);
  console.log("  --path     输出目录（默认: 本技能所在技能目录的同级，即 .claude/skills/）");
  console.log("示例: node init-skill.mjs log-classifier --structure task");
  process.exit(2);
}

/** 官方归一化：lower → 非 [a-z0-9] 折叠为 - → 去首尾 - → 去重复 - */
export function normalizeName(raw) {
  return raw.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleCase(name) {
  return name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const SKILL_TEMPLATE = (name) => `---
name: ${name}
description: [TODO: 写清楚这个技能做什么、何时触发。包含具体场景、文件类型或任务类型——所有"何时使用"的信息都放这里，正文在触发后才加载。]
---

# ${titleCase(name)}

## Overview

[TODO: 1-2 句话说明这个技能让 agent 能做什么]

## 结构选择指南（完成后删除本节）

[TODO: 选择最适合本技能目的的结构。常见模式：

**1. 工作流型**（顺序流程最佳）
- 有清晰的分步过程时适用
- 结构: Overview → 工作流决策树 → Step 1 → Step 2 …

**2. 任务型**（工具集合最佳）
- 技能提供多种操作/能力时适用
- 结构: Overview → Quick Start → 任务类目 1 → 任务类目 2 …

**3. 参考型**（规范/标准最佳）
- 品牌规范、编码标准、需求文档适用
- 结构: Overview → Guidelines → Specifications → Usage …

**4. 能力型**（综合系统最佳）
- 多个相互关联的特性适用
- 结构: Overview → Core Capabilities → 编号特性列表 …

模式可以混用。多数技能是任务型为主、复杂操作处加工作流。]

## [TODO: 按所选结构替换为第一个正式章节]

[TODO: 补充内容。技术技能给代码样例；复杂流程给决策树；给出含真实用户请求的具体例子；按需引用 scripts/references/assets。]

## 测试

技能自带回归测试。每次升级、改动后必跑，确认没改坏既有行为：

    node run-tests.mjs

[TODO: 把测试用例固化在这里——scripts/ 里每个脚本至少一条真实用例（黑盒执行、比对输出）；fixtures/ 放黄金输入与 expected。测试随技能一起分发，是后续反复升级校验的依据。]

## Resources（可选）

只保留本技能实际需要的资源目录，不需要时删除本节。

- scripts/ — 可直接执行的代码（确定性/重复性任务）
- references/ — 按需载入上下文的参考文档
- assets/ — 用于产出的文件（模板、图标、字体）
`;

const RESOURCE_README = {
  scripts: `# scripts/

放置可执行的辅助脚本占位说明。

- 何时放: 同一段代码会被反复重写，或需要确定性可靠执行时
- 语言无关: 任何可执行形态都可以（脚本、CLI、程序）
- 收益: 省 token、结果确定、可不载入上下文直接执行
- 注意: 脚本仍可能被 agent 读取以打补丁或做环境适配

完成后删除本文件或替换为真实脚本。
`,
  references: `# references/

放置按需载入的参考文档占位说明。

- 何时放: 数据库 schema、API 文档、领域知识、详细工作流指南等 agent 工作时应查阅的资料
- 收益: SKILL.md 保持精简，仅在需要时载入
- 惯例: 大文件（>300 行）在文件头放目录；从 SKILL.md 直接引用，避免嵌套引用

完成后删除本文件或替换为真实文档。
`,
  assets: `# assets/

放置产出物占位说明。

- 何时放: 模板、图片、图标、字体、样板工程等会进入最终产出的文件
- 与 references 的区别: assets 不载入上下文，直接被使用/复制
- 惯例: 二进制与文本均可

完成后删除本文件或替换为真实资产。
`,
};

/** 技能根回归测试骨架：零依赖 Node，check() 计数器，退出码 0=全过/1=有失败 */
const RUN_TESTS_TEMPLATE = (name) => `#!/usr/bin/env node
// run-tests.mjs — ${name} 的回归测试（升级/改动后必跑）
// 惯例：check() 计数器 + 黑盒执行（execFileSync 跑脚本/命令再比对输出），退出码 0=全过/1=有失败；
//       fixtures/ 放黄金输入与 expected，逐字段比对。测试固化在技能里，随技能分发。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(\`  ok  \${name}\`); }
  else { fail++; console.log(\`FAIL  \${name}\`); }
}

// TODO: 逐条固化用例——scripts/ 每个脚本至少一条真实用例（黑盒跑 + 比对输出），别只测存在性
check("SKILL.md 存在且声明 name", existsSync(join(SKILL_DIR, "SKILL.md"))
  && readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8").includes("name:"));

console.log(\`\\n\${pass} passed, \${fail} failed\`);
process.exit(fail ? 1 : 0);
`;

function parseArgs(argv) {  const args = { name: null, structure: "task", path: null };
  const rest = [...argv];
  if (rest.length === 0 || rest[0].startsWith("-")) return { args, error: "missing-name" };
  args.name = rest.shift();
  while (rest.length > 0) {
    const a = rest.shift();
    if (a === "--structure") {
      const v = rest.shift();
      if (!v || !STRUCTURES[v]) return { args, error: `bad-structure:${v ?? ""}` };
      args.structure = v;
    } else if (a === "--path") {
      const v = rest.shift();
      if (!v) return { args, error: "bad-path" };
      args.path = v;
    } else {
      return { args, error: `unknown-arg:${a}` };
    }
  }
  return { args, error: null };
}

// --- CLI ---
const { args, error } = parseArgs(process.argv.slice(2));
if (error) {
  const hint = {
    "missing-name": "缺少技能名",
    "bad-path": "--path 需要一个目录参数",
  };
  console.log(hint[error] ?? (error.startsWith("bad-structure")
    ? `未知结构模式: ${error.slice("bad-structure:".length)}（允许: ${Object.keys(STRUCTURES).join(" | ")}）`
    : `未知参数: ${error.slice("unknown-arg:".length)}`));
  usage();
}

const skillName = normalizeName(args.name);
if (!skillName) {
  console.log("名字非法: 归一化后为空（需至少一个字母或数字）");
  process.exit(2);
}
if (skillName.length > MAX_NAME) {
  console.log(`名字超限（${skillName.length}>64）: ${skillName}`);
  process.exit(2);
}
if (skillName !== args.name.trim()) {
  console.log(`归一化 → ${skillName}`);
}

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."); // .claude/skills/
const outBase = args.path ? resolve(args.path) : skillRoot;
const skillDir = join(outBase, skillName);

if (existsSync(skillDir) && readdirSync(skillDir).length > 0) {
  console.log(`已存在且非空: ${skillDir}（不覆盖，退出码 1）`);
  process.exit(1);
}

mkdirSync(skillDir, { recursive: true });
writeFileSync(join(skillDir, "SKILL.md"), SKILL_TEMPLATE(skillName), "utf8");
console.log(`init ${skillName} → ${skillDir}`);
console.log("  SKILL.md            (含待办占位、结构选择指南节与测试节)");
writeFileSync(join(skillDir, "run-tests.mjs"), RUN_TESTS_TEMPLATE(skillName), "utf8");
console.log("  run-tests.mjs       (回归测试骨架，升级校验的依据)");

const resources = STRUCTURES[args.structure].resources;
for (const res of resources) {
  mkdirSync(join(skillDir, res), { recursive: true });
  writeFileSync(join(skillDir, res, "README.md"), RESOURCE_README[res], "utf8");
  console.log(`  ${res}/README.md     (占位说明，语言无关)`);
}
console.log(`模板通用，不带本仓库假设；结构模式: ${args.structure} = ${STRUCTURES[args.structure].label}`);
console.log("下一步: 完成 SKILL.md 的 TODO 项 → 把测试用例固化进 run-tests.mjs → 删除「结构选择指南」节 → 运行 quick-validate.mjs 与 run-tests.mjs");
process.exit(0);
