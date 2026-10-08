# drawio 技能设计记录

## 意图与触发场景

用户要画图时（流程图、架构图、时序图、ER 图、类图、网络图、线框图、原型草图，或提到 draw.io / drawio / .drawio 文件 / 导出 PNG/SVG/PDF），由 agent 生成原生 `.drawio` 文件并按需导出或生成浏览器 URL。**不依赖 MCP server**——这是从 jgraph/drawio-mcp 仓库引入其官方 skill 路线（plugins/claude-code/skills/drawio）的原因：MCP 是该仓库的另一条集成路线，与本 skill 互不依赖。

触发模式：语境触发（description 完整描述 + 中文触发词），非名字触发。

## 设计取舍

**来源与同步策略**：上游 https://github.com/jgraph/drawio-mcp 的 `plugins/claude-code/skills/drawio/SKILL.md`（2026-10-08 快照，上游宣称与 codex/copilot 副本 byte-identical）。相对上游共 4 处本地差异，其余保持原文以降低未来同步成本：

1. description 追加中文触发句（中文语境触发）。
2. Mermaid reference 从 raw.githubusercontent.com 改读技能内 `references/mermaid-reference.md`（离线可用；本机网络拉 raw 不稳定）。
3. XML reference 同上，改读 `references/xml-reference.md`，并指路 `references/style-reference.md`。
4. 调用示例去掉 `/drawio:drawio` 前缀——那是上游 Claude Code 插件市场的调用语法；本仓按裸 skill 分发到 ZCode/Claude/Codex，无插件前缀。

**References 三件套**：`xml-reference.md`（35KB）/ `mermaid-reference.md`（14.6KB）/ `style-reference.md`（38KB）从上游 `shared/` 原样 vendor。三者是上游所有集成路线共用的 single source of truth。

**依赖分层**（上游设计，本机 2026-10-08 实测）：

| 路径 | 依赖 | 本机状态 |
|---|---|---|
| XML 直写 `.drawio` | 零依赖 | ✅ |
| `url` 模式（app.diagrams.net 链接） | 仅 Node 内置 zlib | ✅ Node v24 |
| PNG/SVG/PDF 导出 | draw.io Desktop CLI | ✅ 26.1.1 起可用 |
| Mermaid → `.drawio` 转换 | Desktop ≥ 近版本 | ✅ 需 32.x（26.1.1 实测失败：`Export failed`） |
| ELK `--layout` / libavoid | Desktop ≥ 近版本 | ✅ 需 32.x（26.1.1 不识别 `--layout`，把 preset 名当输入文件） |

CLI 定位链（PATH → 默认安装位 → 注册表 → 其他盘）是上游 SKILL.md 自带的；本机 draw.io Desktop 装在非默认盘、不在 PATH，靠注册表 uninstall 键那一步找到。

## 验收条件

| AC | 条件 | 状态 |
|---|---|---|
| AC-1 | `run-tests.mjs` 退出码 0（frontmatter/本地化/章节/无插件前缀/Codex 元数据/路径门禁） | ✅ 31/31 |
| AC-2 | 实机冒烟：XML 直写 + PNG 导出 + url 生成三条路径通过 | ✅ 2026-10-08（26.1.1 上即通过） |
| AC-3 | Desktop 升级后 Mermaid 转换与 ELK 布局通过 | ✅ 2026-10-08 升级 32.3.0 后：mmd→drawio 6636B、ELK 坐标 100,100→12,12、mmd→drawio→png 23442B |
| AC-4 | 安装器 `--target both --skills drawio` 双目标可见；`~/.codex/skills/drawio` junction 可达 | ✅ 2026-10-08 三路挂载 + junction 下 run-tests 28 项全绿 |
| AC-5 | 仓级门禁：no-tool-names / discovery / check:repo 对本技能零命中 | ✅ drawio 无一条失败；仓内存量红（nuwa-skill 嵌套与命名、多技能 WebSearch/WebFetch 字样）系既有问题 |

## 迭代记录

- 2026-10-08 初铸：从 jgraph/drawio-mcp 引入，4 处本地适配（见设计取舍），references 三件套 vendor。上游 4 路（app server/tool server/plugins/project instructions）中选 plugins 路线，理由：不依赖 MCP、单文件、官方维护。
- 2026-10-08 Codex 适配三件：`agents/openai.yaml`（interface + allow_implicit_invocation，本仓 Codex 元数据标准载体）；调用示例去插件前缀（宿主中立）；`~/.codex/skills/drawio` junction 指向本仓真身（与安装器同款链接形态，仓内更新即达 Codex）。
- 2026-10-08 同机升级 draw.io Desktop 26.1.1 → 32.3.0（原位 F 盘），Mermaid/ELK 两条依赖新 CLI 的路径由红转绿；升级通道踩坑记录：bash 直接 exec 带 requireAdministrator 清单的安装包会报 Permission denied（ERROR_ELEVATION_REQUIRED 不触发 UAC），须经 cmd.exe/ShellExecute 路径启动。
