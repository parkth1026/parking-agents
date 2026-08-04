# 测试

```bash
npm test
```

零依赖，纯 Node。没有 `node_modules`，没有 lockfile，没有测试框架 —— 只有 `node:test` 和 `node:assert`。

---

## 为什么这些测试值得存在

**技能加载在所有平台上都是静默失败。** frontmatter 缩进错了、目录嵌套深了一层、`openai.yml` 写成了 `.yml` —— 没有报错、没有警告、没有日志。那个技能只是从此再也不被调用。仓库里的 `.copilot/agents/Simplify.md` 就以这种状态存在了很久，没人发现。

所以这里的测试不是"验证功能正确"，而是**把静默失败变成响亮失败**。

---

## 三层结构

### 1. 结构断言 —— `tests/skills/`

| 文件 | 守住什么 |
|---|---|
| `test-skill-discovery.mjs` | 技能能被平台发现：一层扁平、有 `SKILL.md`、frontmatter 可解析且 `name` 与目录名一致、`agents/openai.yaml` 命名正确、bootstrap 的 reference 文件齐全 |
| `test-no-tool-names.mjs` | **铁律一**：技能正文只写动作，不写任何 harness 的工具名 |

`test-no-tool-names.mjs` 是整套改造的支点。动作语言纪律没有编译器保证 —— 它靠的是人不写错。这个测试是唯一的自动防线。

它的豁免名单只有两项，且都在文件里注明了理由：

- `skills/claude-to-vscode-skill-converter/` —— 工具名转换表**就是**这个技能的主题
- `skills/using-parking-skills/references/` —— 适配层本身，指名真实工具正是它的职责

### 2. Hook 输出契约 —— `tests/hooks/`

`test-session-start.mjs` 用三种环境变量组合真实执行 `hooks/session-start`，断言每个平台**恰好一个**顶层 JSON 字段。

这条断言是防双重注入的核心：**Claude Code 会同时读 `additional_context` 和 `hookSpecificOutput`，且不去重**。多输出一个字段，bootstrap 就被注入两遍。

### 3. Doc-contract 测试 —— `tests/harnesses/`、`tests/pi/`

大部分平台无法在这台机器上安装或驱动，写不出端到端测试。**能钉住的是契约**：

- manifest 声明了该 harness 真正会读的字段
- bootstrap 指向的文件确实存在（Gemini 的 `@`-include 指向不存在的文件时会静默加载空内容）
- 工具映射点名了该平台真实拥有的工具
- 每个带版本号的 manifest 都登记进了 `.version-bump.json`
- Shape B 插件的去重逻辑真的能挡住第二次注入

`tests/pi/test-pi-extension.mjs` 额外做一件事：**交叉校验 Pi 映射的两个副本**。`references/pi-tools.md`（人读的）和 `piToolMapping()`（实际注入的）是同一份内容的两处维护，漂移是静默的。

---

## doc-contract 测试不能证明什么

它证明契约没烂，**不证明端到端能跑通**。

`docs/porting-to-a-new-harness.md` 附录 A 的「验证」一列如实区分了这两者。测试全绿不是把 ⚠️ 改成 ✅ 的理由 —— 只有跑过 Part 3 的验收测试并留下 transcript 才是。

## 验收测试（人工）

每个能实际运行的 harness，开一个**干净会话**，发一句不含技能名的话：

> 帮我写个 PowerShell 脚本检查磁盘空间

`ps1-creator` 必须在**写任何代码之前**自动触发。触发不了，说明 bootstrap 没到模型面前 —— 技能全都躺在磁盘上没被调用。

冒烟快检：问「你现在有哪些 parking skills？」。bootstrap 成功注入的话模型知道自己有。
