# 动作命名规范

run/v2 协议约束动作 id 的"形"（小写点分词、段内连字符、保留字、四种 kind），v4 起并要求 desc 契约字段；本规范补上"义"：让一个仓库的动作目录读起来是一套意图分类法，而不是照抄的文件名。没有它，入口脚本会得到 `dev.server.prod` 这种 id——顶着 dev 前缀却和开发毫无关系。

## 动词域

id 的首段是从封闭动词域里取的动词。动词声明意图，并决定 kind（v2 修订：`serve` 退役——"分离服务"语义降为限定词 `server` 承接；`prod`、`bench` 入域）：

| 动词 | 意图 | kind |
| --- | --- | --- |
| `setup` | 环境准备（依赖安装、初始化） | task |
| `dev` | 带热重载的开发场景 | open |
| `prod` | 生产形态启动（真实数据目录 + 真实产物，无热重载）；与 `dev` 构成意图环境轴 | open |
| `build` | 产出构建产物 | task |
| `dist` | 产出发布/分发产物（门禁全绿后的正式分发） | task |
| `check` | 链式校验（必须轻于 build） | task |
| `lint` | 静态分析 | task |
| `test` | 测试 | test |
| `gate` | 发布门 | gate |
| `bench` | 基准实验（产出证据报告，无判决语义） | task |

仓库可以扩展动词域（例如 `perf`），但必须在自己 `run.toml` 的头注释里登记。生成器的接受脚本族从这同一份动词域派生——保持三处同步（生成器、本文件、check_naming.mjs）。

## 规则

1. **动词开头，默认两段。** 第三段仅在真实从属时允许（`test.regression.cases` 是 regression 这套测试的用例语料），绝不是用来塞复合词的。段内允许连字符（`bench.download-workers`），不得开头/结尾/连续。
2. **限定词只用产品级词汇，绝不表实现技术，也不表源文件名。** 合法词汇只有两类：产品形态（封闭五词，见第 9 条）与环境（`dev`、`prod`、`test`…）。禁止出现 `tauri`、`electron`、`vite`、`cargo` 这类技术名词——技术栈会迁移，产品形态不会；今天叫 `dev.tauri`，明天换框架这个名字就开始说谎，而 `dev.desktop` 一直成立。技术细节写在 `name`/`desc` 里。`dev.server` 的意思是"桌面产品的分离服务开发形态"，不是"住在 server.ps1 里的那个东西"。
3. **同一动词族内，限定词必须编码同一个维度，互为对仗（v2 起全目录统一为：动词=意图环境，限定词=形态）。** `dev.desktop` / `dev.server` 的限定词都表形态；`dev`↔`prod` 表意图环境，形成 `dev.desktop`/`dev.server`/`prod.desktop`/`prod.server` 的双向对仗矩阵。禁止把同一类东西拆到两个动词族里（`dev.server` + `serve.prod` 就是不成体系的反例：两者都是服务组合，应当是 `dev.server` + `prod.server`）。
4. **禁止语义矛盾的前缀。** `dev` 声明的是开发场景，所以 `dev.*.prod` 从根上就是错的——生产形态验证属于 `prod.*`。
5. **包脚本映射是机械的：** npm 脚本 `test:gate-review-fixes` 映射为 id `test.gate.review.fixes`（`:` 与 `-` 都变成 `.`）。可预测胜过好看：任何人都能从脚本名推出 id，生成器也永远不必丢弃带连字符的脚本。只有当机械结果语义错误或违反第 2 条（带技术名词）时，才允许人工改名；无论哪种情况，`name` 字段都保留原始脚本名。
6. **包清单之外的入口脚本**（PowerShell、Makefile、justfile）按意图在动词域内命名，不照抄文件名：`server-release.ps1` 是 `prod.server`（它起的是生产形态服务），`release.ps1` 是 `dist`（它产的是分发产物）。
7. **`name` + `desc` 双字段（v4 起 desc 必填）：** 包脚本映射时 `name` 回显源命令；入口脚本写一句意图短摘要（实现技术写在这里，不写进 id）。`desc` 是有效行为契约——做什么、数据落哪、默认档与量级、可用旗标与边界承诺；`run show <id>` 与 `--json` 渲染。生成器写入的"候选稿"desc 只是占位，评审时必须替换为真实契约；desc 与实际行为分叉是最严重违例（假契约比缺契约更糟）。
8. **单形态默认裸动词，roadmap 明文时预留限定词（R1，2026-09-07 拍板）。** 仓库只有一种产品形态时，`dev`/`build`/`prod` 用裸动词——限定词在单形态仓零信息量，且 npm 机械映射天然产裸动词（`dev` script → `dev` id），限定词化会在生成器映射与人工意图之间制造双入口（AntAgent2 主仓 `dev`+`dev.desktop` 并存的历史伤口）。唯一例外：第二形态已进 roadmap（issue/ADR/run.toml 头注释明文）时，预先限定词化避免未来改名——AntAgent2（desktop + cli 胚芽在案）即此例，`dev.desktop`/`prod.desktop` 受例外条款保护。形态判定依据探索阶段收集的信号（`src-tauri`、`bin` 字段、cargo `[[bin]]`、vite `index.html` 等），不靠猜。
9. **形态限定词词汇域封闭（R2）：desktop / cli / web / mobile / server 五词。** 仅约束 `dev.*`/`prod.*` 族的形态位（`test.regression`、`bench.download-workers` 的限定词是专题词，不受此域约束）。新形态词（如 `agent`、`daemon`）必须先在 run.toml 头注释登记，与动词域扩展同构；check_naming 对未登记的新词报 error。`library` 不是形态限定词——库仓用裸动词 + desc 表达。
10. **第二形态加入时的迁移路径（R3）。** 裸→限定词是受控改名，不是静默重构：同笔 run.toml 改 id、did-you-mean 接住旧名的肌肉记忆（唯一前缀层：`dev`→唯一 `dev.desktop`）、按 run-standard 12.2 惯例留迁移表（先例：`serve`→`dev.server` 一次性切换零弃用期）。反向同理：roadmap 撤销时限定词→裸也走同一条路。

## 实例

| 来源 | id | 依据 |
| --- | --- | --- |
| npm `dev`（单形态仓） | `dev` | 机械映射；R1 单形态默认裸动词 |
| `dev.ps1`（桌面一键开发，实现是 Tauri，仓内已明文规划 CLI 第二形态） | `dev.desktop` | R1 例外条款：roadmap 在案即预留限定词；实现技术留在 `name`/`desc` 里，换框架 id 不变 |
| 双形态仓（desktop + cli） | `dev.desktop` + `dev.cli` | R1/R2：限定词取封闭五词，同族对仗（§3 矩阵），cli 加入零迁移 |
| `server.ps1`（前后端分离开发） | `dev.server` | 意图：开发场景的分离服务形态；与 `prod.server` 同族，动词表意图环境 |
| `server-release.ps1`（生产形态服务） | `prod.server` | 意图：生产形态验证，不是开发；与 `dev.server` 成对 |
| `release.ps1`（打包） | `dist` | 意图：分发产物 |
| npm `test:regression-cases` | `test.regression.cases` | 机械映射：`:`/`-` → `.` |
| npm `bench:download-workers` | `bench.download-workers` | 机械映射人工微调：段内连字符保留（§1 允许），`name` 保留原脚本名 |
