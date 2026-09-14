# run 命令执行标准 v4（跨仓库）

> 状态：v1 定稿（2026-08-17）；v1→v2 动词域修订（2026-08-26，见 12.2 迁移表）；v2→v3 脚本语言政策修订（2026-09-04，见 12.2）；v3→v4 desc 契约字段修订（2026-09-07，见 12.2）；v4.1 限定词治理（2026-09-07，§4）与 TEST_TMP_ROOT 临时落点路由增补（2026-09-15，§9.7——行为条款，不涉 schema/动词域/退出码，不升主版本）。草案经四路红队对抗校验后修订：事实核查 ×2（35 条引述逐条回源）、标准攻击（15 项缺陷）、落地审查（对照参照实现逐行核对）。校验结论与修订记录见附录 D。
> 证据方法：best-practice-research 工作流 —— 官方/上游证据优先，四路 researcher 并行调研（npm/pnpm、yarn/cargo、make/just/Task/git/go/docker/kubectl、PowerShell/POSIX/GNU/clig.dev）。所有实质性规则在附录 A 标注先例、来源与置信度；无官方先例的自定项在附录 B 诚实列出。
> 适用范围：本人全部 git 仓库的统一执行入口 —— 仓库根 `run.toml`（声明式动作清单）+ `run`/`run.cmd`（wrapper）+ `scripts/run.mjs`（runner）。
> 参照实现：AntAgent2（runner v1.3.0，run/v2）。本标准与参照实现的**主要**差异与已知缺口见第 13 节。

---

## 0. 摘要

每个仓库自带一个 `run` 入口。**动作（action）声明在 `run.toml`，动词（verb）取自封闭域，id 形如 `verb.qualifier` 点分层级**。交互固定三步：`./run` 发现 → `./run <id> -n` 预览 → `./run <id>` 执行；`--json` 获得机器可读输出；`./run doctor` 体检环境。退出码即契约：成功 0、子进程码原样透传、runner 自身错误用 BSD sysexits 槽位。

## 1. 设计原则（第一性原理）

| # | 原则 | 一句话表述 | 关键先例（详见附录 A） |
|---|------|-----------|------------------------|
| P1 | 单一入口，动词封闭 | 所有仓库操作收敛到一个入口；动词域是封闭集合，扩展走受控通道 | go："Go is a tool for managing Go source code."（统一入口 + 封闭命令表）；cargo 官方三分类（内置/别名/外部子命令）；GNU make 16.6 惯例目标清单（证明"权威惯例动词清单"这一形态，封闭性先例以 go/cargo 为准） |
| P2 | 可发现 | 无参数调用即列出全部动作，带一句话说明 | `npm run`（无 command 即列出脚本）；just `--list` + `default-list` |
| P3 | 可预览 | 任何动作可 `-n/--dry-run` 预览"将执行什么"而不执行 | make `-n`："Print the recipe that would be executed, but do not execute it (except in certain circumstances)."；rsync `-n`；GNU 长选项表正式收录 `dry-run`；clig.dev 旗标表收录 `-n, --dry-run` |
| P4 | 可机器读 | `--json` 输出带版本号的单行信封；stdout 只放 JSON | cargo `--message-format=json`（`reason` 判别 + `build-finished` 终止标记 + 格式版本化教训）；pnpm 11 stdout/stderr 分离；clig.dev "Display output as formatted JSON if `--json` is passed." |
| P5 | 显式无隐式 | 无 pre/post 隐式钩子链；命令是显式 argv 数组、不经 shell | yarn berry 官方："we intentionally don't support arbitrary pre and post hooks for user-defined scripts (such as prestart)."；显式 argv 规避 shell 注入与 CVE-2024-27980 类风险 |
| P6 | 退出码即契约 | test/gate 的判决只认退出码；非零语义必须文档化 | POSIX "Usually, utilities return zero for successful completion and values greater than zero for various error conditions."；clig.dev "Return zero exit code on success, non-zero on failure."；BSD sysexits（64/65/69/70 槽位） |
| P7 | 一词一义 | 同一动词族内限定词只编码一个维度；语义矛盾命名禁止 | git 2.23 官方把过载的 `checkout` 拆为 `switch`/`restore`；clig.dev "Don't have ambiguous or similarly-named commands." |

**宽容的边界**：输入侧的大小写归一（id 匹配、旗标比较、子命令分派均大小写不敏感）是唯一的宽容点，仅限字符归一、不涉及语义猜测——这与 P5 不冲突：宽容只作用于"怎么写"，不作用于"做什么"。

## 2. CLI 交互面

```
run [list | show <id> | doctor | help | run <id> | <id>] [-n|--dry-run] [--json]
```

各平台调用形态：bash/POSIX 用 `./run`；Windows cmd 用 `run`（经 PATHEXT 解析到 `run.cmd`）；PowerShell 用 `.\run.cmd`。（注意：PowerShell/Git Bash 下 `.\run` 会解析为字面文件 `run` 或 `.run`，均无法执行——AGENTS.md 模板见第 11 节。）

| 调用形式 | 行为 | 备注 |
|---|---|---|
| `run`（无参数） | 列出全部动作 | just `default-list` 同款（无参数=列出而非执行）；npm run 无参数同款 |
| `run list` | 列出全部动作 | 与裸 `run` 等价 |
| `run show <id>` | 显示单个动作详情 | 对应 cargo `help <command>` 的"单条目深查" |
| `run doctor` | 环境体检（wrapper/runner 版本对齐、node、各动作可执行可用性），可返回非零 | |
| `run help` | 用法说明 | GNU："All programs should support two standard options: '--version' and '--help'."（`-h/--help`、`--version` 旗标列为 v2 添加项，见第 13 节 G1/G2） |
| `run run <id>` | 执行动作 | 与裸 id 等价 |
| `run <id>` | 执行动作 | 主形态 |

规则：

1. **保留字**：`list` / `show` / `doctor` / `help` / `run` 不得用作动作 id（含扩展前缀形式，如 `x.run`）。先例：git 官方对别名的保留字保护 —— "aliases that hide existing Git commands are ignored except for deprecated commands."（内置优先）。
2. **精确匹配**：id 按大小写不敏感的完全相等匹配；**不做前缀缩写、不做模糊匹配**。先例：git/go/docker/kubectl 子命令均要求完整名；git 官方仅对**长选项**开放唯一前缀缩写且明言脚本中不要依赖；clig.dev："Don't allow arbitrary abbreviations of subcommands."
3. **未知 id**：报 USAGE（64），错误信息必须引导发现——先给最近匹配建议（did-you-mean，存在时），再给全量列表引导（"use run to list actions"）。最近匹配四层规则，按序短路（宁缺毋滥，乱建议比不建议更糟；全部大小写不敏感）：① **唯一前缀**——输入是恰好一个动作 id 的前缀 → 建议该 id（唯一前缀是比单字符编辑更强的意图信号，接住 "dev"→"dev.desktop" 这类省限定词肌肉记忆——编辑距离 8，纯距离匹配接不住）；② **家族前缀**——输入恰是多段 id 的完整前缀段（"test" 对 test.\*）→ 不猜单条、报全家族成员（用户意图是家族，猜出 "test"→"dist" 这类跨动词近邻属语义乱建议）；③ **动词近邻**——输入是某动词（id 首段）的 1 编辑近邻（"tist"→"test"）→ 回到动词族：动词自身是 id（"gat"→"gate"）则精确建议，否则报动词族；同时等距命中多个动词属动词型噪声，放弃建议并抑制第 ④ 层；④ **编辑距离**——Levenshtein 最近候选且 ≤ 阈值（len>4 时 max(2, ⌊len/3⌋)；len≤4 收严为 1）→ 建议。单条建议进 `--json` error 的 `details.suggestion`，家族进 `details.family`——机器面（AI/编排）与人类拿到同一份矫正回 canonical id 的信号。先例：git 未知子命令输出 "The most similar command is"（实测）；cargo/rustc "Did you mean \`build\`?"（实测）；clig.dev 错误条目（能给出可能的修复就直接给）。对应物先例：npm 缺脚本报错附 "To see a list of scripts, run:" 引导（npm CLI 行为，实测 npm 11.12.1）。
4. **旗标**：`-n` / `--dry-run`、`--json`（比较大小写不敏感）。长短同义旗标成对接受是 GNU 先例（quiet/silent 成对收录）。未知选项一律报错（USAGE 64）而非忽略——不强制"选项先于操作数"的顺序，旗标可出现在任意位置（POSIX Utility Syntax Guidelines 第 9 条是顺序约定，本标准不采用其为硬规则，仅对齐"未知选项报错"这一点）。
5. **无操作旗标的宽容**：`-n`/`--json` 传给 list/show/doctor/help 时被静默接受（`--json` 有效，`-n` 无操作）。
6. **`run run` 的不对称（刻意）**：`run run`（保留字子命令缺操作数）退化为列出动作，而 `run <未知id>` 报 64。这是"子命令位缺参=回到发现"的宽容设计，与 just default-list 精神一致；与未知 id 的严格报错并存，属本标准自定的不对称（附录 B）。
7. **参数透传**（v2 项）：若未来支持向动作追加参数，采用 npm 官方规则 `--` 分隔："A `--` argument tells the cli parser to stop reading flags"。v1 不支持额外位置参数。

## 3. 动作 id 命名规范

1. **语法**：`^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$`（段内连字符不得开头/结尾/连续）—— 小写点分层级，每段以小写字母开头。对照：just 正式语法 `NAME = [a-zA-Z_][a-zA-Z0-9_-]*`（允许连字符/下划线）；Task schema 对 name 无约束。本标准原收紧为"点分、段内无连字符"（自定项，附录 B，收益是分隔符唯一、可机械推导）；2026-08-18 起放宽为允许段内连字符：仓库锁定了 `bench.download-workers` 这一动作 id（goal contract 2026-08-16-resource-budget-debt），且 npm 机械映射是单向确定的、连字符位置歧义只影响"由 id 反推脚本名"这个本就不承诺的方向。
2. **首段必须取自第 4 节封闭动词域，或为保留扩展标记 `x`**（`x.<verb>[.<qualifier>...]` 形式，见第 4 节扩展规则）。
3. **手写 id 默认两段**（`verb` 或 `verb.qualifier`）；第三段及以上仅当存在真实从属关系。
4. **族内维度对仗（P7）**：同一动词的**手写**直接子节点必须编码同一维度且互为对仗 —— v2 起全目录限定词统一编码**形态**维度（`desktop`/`server`，裸动词默认纯前端 web 形态），动词对编码**意图环境**（`dev`↔`prod`），形成 `dev.desktop`/`dev.server`/`prod.desktop`/`prod.server` 的双向对仗矩阵；v1 的 `serve.dev`/`serve.prod`（限定词表环境）与之跨族颠倒，已在 v2 退役（12.2）。先例：cargo profile 体系（"Cargo has 4 built-in profiles: dev, release, test, and bench."，`--release` ≡ `--profile=release`）；go test 层级过滤 `-run=X/Y`（"possible parents of matches are run too" 的层级语义）。
5. **禁止语义矛盾前缀**（如 `dev.*.prod`）与保留字（第 2.1 条）。
6. **npm 脚本机械映射（优先级最高的规则）**：脚本名中的冒号与连字符一律转点 —— `test:gate-review-fixes → test.gate.review.fixes`。此映射**单向确定**（脚本名→id 唯一），反向不唯一（`test.gate.review.fixes` 无法还原连字符位置），因此**动作 `name` 字段必须保留原脚本名**。先例：pnpm 官方以冒号前缀为正式示例（`"/^watch:.*/"` 选择 `watch:` 族，命中按字典序执行）；yarn berry 支持冒号脚本名跨工作区调用（仅当全工作区恰好唯一同名匹配，cwd 为声明该脚本的工作区）。
7. **规则裁决：映射优先于深度纪律。** 机械映射产生的段数（如 `test:coverage-matrix → test.coverage.matrix` 三段）是映射的确定性副产品，**不受** 3.3"默认两段"与 3.4"族内维度对仗"约束——那两条只约束手写 id。代价是映射族（如 `test.*`）的限定词维度可能混杂，属于可接受的过渡债；收敛方向是改脚本名（`test:coverage-matrix → test:coverage`）而非改映射规则。冒号→**点**是本标准自定（附录 B）。
8. **id 唯一**：动作 id 在清单内唯一（加载期查重，冲突报 CONFIG）。

## 4. 标准动词域（封闭，v2）

| 动词 | 语义 | kind | 行业先例 |
|---|---|---|---|
| `setup` | 环境准备：进入可开发状态的一次性/幂等准备（依赖安装、初始化） | task | 对应物先例：GNU make 惯例目标 `install`、npm `install` / pnpm `add`。**命名反证须知**：PowerShell 把 `Setup` 列为 `Install` 与 `Initialize` 的避免同义词——本标准仍用 `setup` 取更宽语义"准备就绪"且不设 `install` 动词避免撞义，此命名属自定（附录 B） |
| `dev` | 带热重载的开发场景（纯前端/桌面/分离服务），长驻 | open | cargo 内置 profile `dev`："used for normal development and debugging"（"dev=开发形态"的官方命名先例）；PowerShell `Start`（异步） |
| `prod` | 生产形态启动：真实数据目录+真实产物，无热重载，长驻；与 `dev` 构成意图环境轴，限定词沿用形态维度（`prod.desktop`/`prod.server`） | open | Node.js `NODE_ENV=production` / ASP.NET Core `ASPNETCORE_ENVIRONMENT=Production` 的环境二元惯例；cargo `--release` profile（参照实现显式区分：release profile 只代表编译优化，不决定运行环境）；PowerShell `Start`（异步）。v2 入域（12.2） |
| `build` | 产物构建 | task | GNU/make `build` 惯例；cargo/go/docker `build`；PowerShell `Build`（Lifecycle 组，PS6 新增）："Creates an artifact (usually a binary or document) out of some set of input files (usually source code or declarative documents.)" |
| `check` | 链路校验：轻量快速的自检层，**必须轻于 build** | task | cargo `check`："compile the packages without performing the final step of code generation, which is faster than running cargo build"，且官方明示盲区 "Some diagnostics and errors are only emitted during code generation"——快速层必须声明局限（见 5.3）。注意：make 16.6 的 `check` 语义是 self-tests（≈test）；本标准取 cargo 义"快速校验层" |
| `lint` | 静态检查 | task | go `vet`："report likely mistakes in packages"；cargo 生态 clippy/fmt。`lint` 无官方动词表对应（附录 B） |
| `test` | 测试（带判决语义：退出码 0=通过） | test | go/cargo/npm `test` 全员一致；npm 保留脚本名 `test` 可直呼 `npm test` |
| `gate` | 发布门：多层门禁合成的通过性判定，失败即阻断发布 | gate | 对应物先例：PowerShell `Assert`（Lifecycle）："Affirms the state of a resource."；退出码判决（P6）。`gate` 名本身无通用 CLI 先例（CI 领域概念，附录 B） |
| `dist` | 生产发布打包（门禁全绿后的产物发布形态） | task | GNU make 惯例目标 `dist`："Create a distribution tar file for this program."；PowerShell `Deploy`/`Publish` |
| `bench` | 基准实验：可重复的性能测量，产出证据报告（无判决语义，不作门禁证据） | task | cargo 内置命令 `bench`（归 Build Commands 分类）；cargo 4 内置 profile 之一 `bench`（继承 release）。2026-08-19 v1 定稿前晋升：参照实现已锁定 `bench.download-workers`（goal contract 2026-08-16-resource-budget-debt），先例充分故纳入 v1 域，不再走 v2 晋升 |

**动词域是版本化的封闭集合。** 仓库不得自造标准域动词。扩展与映射规则：

- **扩展前缀**：`x.<verb>[.<qualifier>...]`（如 `x.perf.lan`）。`x` 是保留扩展标记；扩展动词不得与标准动词同义（`x.setup` 禁止——它应直接用 `setup`），亦不得使用保留字（`x.run` 禁止）。
- 扩展动词的 kind 必须显式声明（kind 本就是必填字段），无法推断时用 `task`。
- 先例：cargo 外部子命令（"Cargo is designed to be extensible with new subcommands without having to modify Cargo itself."）；git 别名不得遮蔽内置命令。`x.` 前缀本身是自定（附录 B）。
- **生态动词映射指引**（非域动词的归位建议）：

| 生态动词 | 归位 | 依据 |
|---|---|---|
| `clean` | `x.clean`（**v2 晋升候选首位**） | make 16.6 标准目标清单收录 `clean` |
| `fmt`/`format` | `lint.fmt` 或 `x.fmt` | cargo `fmt` 归 Build 分类（静态规范化） |
| `doc`/`docs` | `build.doc` | cargo `doc` 归 Build Commands 分类 |
| `publish` | `dist.publish` | cargo `publish` 归 Publishing 分类；dotnet `publish` |
| `run`（cargo run / dotnet run） | 按长驻语义归 `dev`/`prod` 族 | `run` 是本入口保留字，禁止复用 |

**限定词治理（v4.1，2026-09-07 拍板）**，与动词域同构的三条规则：

- **单形态默认裸动词（R1）**：仓库只有一种产品形态时 `dev`/`build`/`prod` 用裸动词——限定词在单形态仓零信息量，且机械映射天然产裸动词，限定词化会在映射结果与人工意图间制造双入口。唯一例外：第二形态已进 roadmap（issue/ADR 明文）时预先限定词化，避免未来改名（参照实现即此例）。
- **形态限定词封闭五词（R2）**：`desktop`/`cli`/`web`/`mobile`/`server`，仅约束 `dev.*`/`prod.*` 族的形态位；新形态词须在 run.toml 头注释登记（与动词域扩展同构），`library` 不是形态限定词。
- **第二形态迁移路径（R3）**：裸→限定词是受控改名——同笔改 id、did-you-mean 接旧名、按 12.2 惯例留迁移表，不是静默重构。

- 晋升为标准动词须升标准版本（第 12 节）。

## 5. kind 语义

| kind | 语义 | 判别 | 权威先例 |
|---|---|---|---|
| `open` | 启动长驻进程，不期待其退出（dev/prod 族） | 异步、陪伴式 | PowerShell 官方 `Start`/`Invoke` 二分："Use the `Invoke` verb to perform synchronous operations, such as running a command and waiting for it to end. Use the `Start` verb to begin asynchronous operations, such as starting an autonomous process." |
| `task` | 有限作业，跑完即退 | 同步、终态明确 | 同上 `Invoke`（同步） |
| `test` | 有限作业 + 判决语义（非零=失败，须可作门禁证据） | 退出码即结果 | POSIX 0/>0；clig.dev "Map the non-zero exit codes to the most important failure modes" |
| `gate` | 判决动作：对仓库发布资格做断言，非零=门未过 | 断言、阻断性 | PowerShell `Assert`；cargo 每命令统一 EXIT STATUS（"0: Cargo succeeded. / 101: Cargo failed to complete." 二元判决的极简先例） |

规则：

1. **kind 由动词域决定**（推导表）：`dev`/`prod` → `open`；`test` → `test`；`gate` → `gate`；`setup`/`build`/`check`/`lint`/`dist`/`bench` → `task`。扩展动词（`x.*`）不参与推导，kind 必须显式声明。
2. **kind 是元数据，不改变动作执行机制**（doctor 等外围命令的行为差异除外，见 5.4）。先例：cargo 的七大命令分类、npm run 的 "Lifecycle scripts" / "Scripts available via `npm run`" 分组展示，均为**文档/索引层分类**，不改变命令执行机制。
3. **快速层必须声明局限**：`gate.quick` 一类的快速门必须在 `name` 中声明"不构成发布门通过"（参照实现：`gate.quick` 的 name 为"快速门 L0+L1（不构成发布门通过）"）。先例：cargo check 官方明示其盲区。
4. **doctor 对 gate 宽容**：非 gate 动作的可执行缺失使 doctor 判 UNAVAILABLE；gate 类工具缺失单独展示、不阻断 doctor 退出码（门禁工具属发布期依赖，缺席只降级不报障）。此宽容为自定项（附录 B）。
5. **open 动作的生命周期与停止**：open 动作由用户中断（Ctrl+C / SIGINT/SIGTERM）停止属于**正常生命周期**，不是错误。动作脚本自身负责信号清理（端口、子进程）。runner 的目标行为是向子进程转发终止信号并以 128+N 记录退出码（npm 官方先例：脚本被信号杀死时 npm 重发同一信号 "so that npm will exit with the same status as the child"）；当前实现将信号终止一律归 70 INTERNAL，属已知缺口（第 13 节 G10）。

## 6. run.toml 配置规范

```toml
[project]
id = "namespace/name"          # ^[a-z0-9][a-z0-9.-]*/[a-z0-9][a-z0-9.-]*$

[[actions]]
id = "dev.server"               # 第 3 节 id 规范
name = "分离开发服务（release 后端 + Vite HMR 前端）"  # 非空；见下方 name/desc 职责规则
desc = "后端与前端进程说明、数据目录落点、默认档与可用旗标、边界承诺"  # 非空；有效行为契约（v4 必填）
kind = "open"                  # task | open | test | gate
run = ["node", "./scripts/run/dev-server.mjs"]  # 显式 argv，非空字符串数组
```

1. 顶层仅允许 `project` 与 `actions`；action 仅允许恰好 `id`/`name`/`desc`/`kind`/`run` 五字段（`additionalProperties: false`）。收紧理由同 cargo `[alias]` 的 "Aliases are not allowed to redefine existing built-in commands."——封闭 schema 是防漂移的第一道闸。
2. **name 单职责 + desc 契约职责**（v4）：机械映射场景 name 必须保留原脚本名（供反查，见 3.6）；手写动作 name 必须自含一句话短摘要（list 内联渲染，保持紧凑）。**desc 是有效行为契约**：做什么、数据落哪、默认档/量级、可用旗标与边界承诺；`show` 与 `--json` 渲染，`list` 不渲染。desc 禁止与实际行为分叉——变更动作行为（旗标/默认档/数据空间）必须同笔更新 desc；缺失或空白 desc 在加载期报 CONFIG（与 id 唯一性同为 runner 兜底项）。动机：参照实现曾出现"启动器硬编码 fast 测试档而目录面零文档"的声明/行为分叉（G6/G19），optional 字段在目录里必然性腐烂，必填是唯一可持续形态。
3. `run` 必须是显式 argv 数组，**禁止 shell 字符串**（P5；规避注入与跨平台引号地狱）。
4. **argv 应直达真实入口**。经 `npm run <script>` 中转、而脚本本体又是 `a && b && c` shell 链的**转发型动作**是过渡形态：它使 `-n` 预览只能看到第一层、并架空"不经 shell"的主张。编排需求应收敛为仓库内 .mjs 脚本（如 `scripts/run/dev-server.mjs`），并鼓励该编排脚本自身支持 `-n` 透传；`run = [[...],[...]]` 顺序数组原语列为 v2 议题（第 13 节 G11）。
5. **编排脚本一律 node `.mjs`**（v3）。`run` 数组不得引用 PowerShell/批处理/shell 编排脚本；`run`/`run.cmd` wrapper 是唯一登记的平台例外。`node` argv 由 runner 特判映射为 `process.execPath`（第 9.3 条），不依赖 PATH 中的 node。接口的唯一运行时假设是 Node——不假设 PowerShell 版本，也不假设目标 OS 预装任何 shell 脚本宿主。Windows 内置 `powershell.exe`（5.1，OS 组件）允许出现在**隔离的** node 模块内部，用于 node 无等价物的 OS 能力（如 Win32_Process 查询），但不得作为 run 动作的 argv 入口。
6. **存量 ps1 豁免登记制**（v3）：v3 之前已存在的 ps1 动作可继续运行，但必须在 run.toml 头部注释显式登记豁免范围；豁免清单只允许缩小、不允许扩大；新增动作一律 .mjs。豁免登记是仓库级事实（登记实例随仓库走），本标准只定义机制。
7. 动作至少一条；解析失败的错误信息附带 TOML 行号（列号尽力——语义类错误仅有行号）。
8. 每个采纳仓库同时维护 `run.schema.json`（JSON Schema draft 2020-12，v4 起 `$id: urn:run:v2`）。id 唯一性与 name/desc 非空白由 runner 兜底（schema 对两者仅约束 minLength，弱于 runner，见第 13 节 G14）。多仓库把 schema 装入同一验证器会撞 `$id`，聚合消费方需自行去重（v2 可在 urn 中嵌入 project.id）。

## 7. 输出契约

### 7.1 stdout 纯净原则

- **`--json` 模式：stdout 只有一行 JSON 信封**；子进程的 stdout/stderr 全部转接到 runner 的 stderr。先例：pnpm 11 官方 "pnpm now prints `$ command` (to stderr, so stdout stays pipe-friendly)"；POSIX "The standard error shall be used only for diagnostic messages."
- 人类模式下子进程 stdio 直接继承（inherit）；执行类的 runner 横幅（`[run] <id> -> ...`、完成/失败行、预览行）一律走 stderr。
- 预览（dry-run）人类可读输出走 stderr（`[run] plan:` / `[run] dry run: no command was executed`）。

### 7.2 JSON 信封

统一信封 `{ "schema": "run/v2", ...payload }`，单行输出。**调用方必须校验 `schema` 字段**（cargo metadata 的官方教训："The format is stable and versioned. When calling cargo metadata, you should pass --format-version flag explicitly to avoid forward incompatibility hazard."）。

字段出现矩阵（与参照实现逐一对齐；`origin`/`project` **不是**通用字段）：

| command | status | 字段 |
|---|---|---|
| list | ok | `project`, `actions:[{id,name,desc,kind,run,available}]` |
| show | ok | `project`, `action` |
| doctor | ok | `project`, `checks:{wrapper,config,node,tools[],gate}` |
| doctor（失败） | error | **`origin`**, `exitCode`, `project`, `checks` |
| help | ok | `usage`, `reserved`（无 project） |
| execute（预览） | **preview** | **`origin`**, `project`, `action`, `argv`, `cwd`, `dryRun:true`, `executed:false` |
| execute（执行后） | **success / failed** | **`origin`**, `exitCode`（子进程码）, `project`, `action`, `argv`, `cwd`, `dryRun:false`, `executed:true` |
| error | error | **`origin`**, `exitCode`, `error:{message, details?}`（details 可选，未提供时整个键不出现；无 project） |

通用字段仅 `command` / `status` / `exitCode`。`argv` 为执行向量快照，与 `action.run` 同值（顶层便利字段）。`available` 是运行时派生字段（探测 `run[0]` 是否在 PATH），不写入 run.toml。`checks.config` 在当前实现中恒 `ok:true`（配置错误在加载期即抛出，到不了 doctor），属占位展示位（第 13 节 G17）。

### 7.3 v2 方向（非本版承诺）

流式事件采用 JSON Lines（UTF-8 无 BOM、每行一个合法 JSON、`\n` 行终止——jsonlines.org 规范将末行换行列为 "strongly recommended but not required"，本标准收严为强制），事件判别字段参照 cargo JSON 消息的 `reason` + 终止标记 `build-finished` 模式。

## 8. 退出码契约

| 码 | 常量 | 场景 | BSD sysexits 槽位 |
|---|---|---|---|
| 0 | OK | 成功；list/show/help/dry-run 一律 0 | EX_OK |
| 64 | USAGE | 未知选项、多余位置参数、未知 id | EX_USAGE（Python `os.EX_USAGE` 同源："the command was used incorrectly"） |
| 65 | CONFIG | run.toml 缺失/解析失败/校验失败/重复 id/保留字 | EX_DATAERR 槽位（注意：sysexits 的 EX_CONFIG=78，本标准沿用现有 runner 的 65 槽位并如此文档化，属既成事实约定，附录 B） |
| 69 | UNAVAILABLE | 动作可执行不在 PATH、spawn 失败、doctor 检出关键缺失（含 wrapper 版本不匹配、Node 缺失或版本低于下限） | EX_UNAVAILABLE |
| 70 | INTERNAL | runner 意外异常；子进程被信号终止（**含用户中断 open 动作——已知缺口 G10，v2 目标为转发信号并按 128+N 记录**） | EX_SOFTWARE |
| 其他 | — | **子进程正常退出时，其退出码原样透传** | — |

1. **透传是硬规则**：动作失败时 run 的退出码等于子进程退出码。先例：现代 npm（≥7）与 pnpm 均为原样透传（npm 官方："If the script exits with a code other than 0, then this will abort the process."）。**例外**：信号终止不透传（当前归 70；npm 的先例是重发信号与子进程同状态退出，见 5.5 与 G10）。
2. POSIX 告诫非零具体值不可依赖（"A strictly conforming application shall not rely on any specific value"）——因此非零语义**由本节文档化**（Node.js CLI 最佳实践同要求："be sure to document them properly"）。
3. 禁止用错误计数当退出码（GNU Coding Standards 4.2 Writing Robust Programs："Do not use a count of errors as the exit status for a program"）。

## 9. 平台与安全

1. 子进程一律 `shell:false` + 显式 argv。
2. Windows 上解析到 `.cmd`/`.bat`（如 npm/npx）时经 `cmd.exe /d /s /c` 中转；转义覆盖空白与引号（`\"`），**cmd 元字符（`& | < > ^ %`）在无空白参数中不转义、`%VAR%` 会被 cmd 展开**——`run` 数组应避免 cmd 元字符，该盲区见第 13 节 G9。
3. `node` 命令特判映射为 `process.execPath`；PATH 搜索使用 `PATHEXT`。
4. 动作执行 cwd 固定为仓库根；环境变量原样透传（不增不改）——**唯一例外**：`TEST_TMP_ROOT` 临时落点路由对子进程 TMP/TEMP 的注入（9.7）。
5. runner 依赖 Node 运行时：语法层面要求 Node ≥14.8（顶层 await），但各仓实际下限由其依赖树决定（参照实现为 22.13+/24+，与三处 package.json `engines.node` 对齐——依据 vite 8 / eslint 10 / jsdom 29 的 engines 交集）。前置检查双层（参照实现 runner v1.3.0 起，G12 落地）：wrapper 在 `exec node` 前 fail-fast 探测 Node 存在性（缺失→69 UNAVAILABLE + nodejs.org 安装指引，不裸报 9009/command not found）；runner 在动作执行前校验版本下限（过老→69 + 重装 LTS 指引）。dry-run/list/show/doctor 不受版本门限——诊断与契约读取在任何 Node 上可达，版本下限由 doctor 呈现（10 节）。无 Node 的仓库（纯 Rust/C#）不能直接复用 wrapper，需等价实现（第 14 节适用边界）。
6. 退出用 `process.exitCode = await main()` 而非 `process.exit()`（Node.js 官方警告强制退出会截断挂起的异步 I/O）。
7. **`TEST_TMP_ROOT` 临时落点路由（v4.1，2026-09-15）**：测试临时落点的唯一决策变量是跨项目标准名 `TEST_TMP_ROOT`（不认仓库名前缀变体——同名跨仓统一是它的存在意义）。语义（与参照实现 AntHub 2026-09-14 契约的实证形态一致）：
   - **解析链**：变量 > 回退 `os.tmpdir()`；变量值做探针可写校验；目录缺失自动重建（RAM 盘重启自洁属常态，盘在即建）；盘符不在/不可写 = 配置漂移 → 告警 + 回退，测试不因漂移失败；解析根剩余空间 <15% 水位告警不失败（`statfsSync` 能力探测，Node 过老或网络盘不可得即跳过）。
   - **runner 行为**：动作执行前经 `scripts/run/lib/tmp-root.mjs`（自包含单源，仅 node: 内置依赖）解析——已设且有效 → 注入子进程 `TMP`/`TEMP` = 解析根 + stderr 路由行 `[tmp-route] TEST_TMP_ROOT=<root> → 注入子进程 TMP/TEMP`；未设 → 回退提示行（零配置机器仅多一行提示，子进程走机器默认 tmp）。路由/告警行一律 stderr（7.1 stdout 纯净），`--json` 模式同样。
   - **直呼形态**：`node scripts/run/lib/tmp-root.mjs --print` 首行=解析根绝对路径、随后逐行告警、退出码恒 0——供 PowerShell 等入口消费。
   - **建议条款（各仓可选，标准不带代码）**：入口脚本自解析（裸直呼不经 ./run 的 .mjs 调 `selfResolveTmp`——双保险第二险）+ 机械守卫（禁裸读 `process.env.TEMP/TMP`/`$env:TEMP`/`GetTempPath()`、禁盘符字面量、直呼入口自解析断言）。测试/gate 重的仓建议采纳；轻量仓 run 层路由单保险即可。
   - **desc 契约联动（6.2）**：动作 desc 涉及临时落点时写 `TEST_TMP_ROOT` 语义（落哪/回退哪），与实际注入行为分叉即假契约。
   - **存量仓**：已被标准化的仓不自动获得路由层——重新跑生成器或手抄 `scripts/run/lib/tmp-root.mjs` + runner 注入两处即可。

## 10. doctor（环境体检）

1. 校验 wrapper 内嵌版本（`run-wrapper-version:` 注释）与 runner 版本一致，不一致即 doctor 失败（归 69 UNAVAILABLE）。
2. 逐动作探测可执行可用性（gate 类按 5.4 宽容）。
3. doctor 的 JSON 输出含 `checks` 结构（wrapper/config/node/tools/gate）；`config` 为恒真占位（见 7.2 与 G17）。`node` 含版本下限校验（`ok`/`version`/`required`，不满足即 doctor 归 69——G12 落地）。

## 11. 仓库落地清单

采纳本标准的仓库**必须**包含：

| 文件 | 作用与要求 |
|---|---|
| `run.toml` | 动作清单（第 6 节 schema） |
| `run.schema.json` | 清单的 JSON Schema（v4 起 `$id: urn:run:v2`，desc 必填） |
| `run`（sh 入口） | `#!/usr/bin/env sh` + `set -eu`，Node 存在性 fail-fast（缺失→69 + nodejs.org 指引，9.5），`exec node "$RUN_ROOT/scripts/run.mjs" "$@"`；**必须带可执行位提交**（`git update-index --chmod=+x run`），仓库需 `.gitattributes` 保证其为 LF |
| `run.cmd` | `@echo off` + Node 存在性 fail-fast（同上）+ 透传 `%errorlevel%`；**内容必须纯 ASCII**——cmd 按活动代码页逐字节解析，CJK 双字节序列（GBK/UTF-8 皆然）的第二字节可撞 `&`/`|` 等元字符，把 rem/echo 行拆成命令执行，指引文案因此用英文（sh 侧 UTF-8 无此问题，可中文） |
| `scripts/run.mjs` | runner（或等价实现，遵守本标准交互面/输出/退出码契约） |
| `scripts/run/lib/tmp-root.mjs` | TEST_TMP_ROOT 临时落点路由层（9.7；自包含单源，随 runner 一起由模板生成——2026-09-15 起的模板增量） |

两个 wrapper 内嵌 `run-wrapper-version:` 与 runner 版本对齐（doctor 校验）。

**AGENTS.md 集成（必须）**：采纳仓库的 AGENTS.md 必须包含标准操作行（跨 shell 形态），并将开发命令引导到 run 入口，消除与裸 npm 脚本的双入口漂移：

```md
本仓库标准操作：`./run` 发现，`./run <id> -n` 预览，`./run <id>` 执行，`--json` 机器可读。
（Windows：cmd 用 `run`，PowerShell 用 `.\run.cmd`；POSIX 用 `./run`。）
```

（参照仓库 AntAgentWeb2 的 AGENTS.md 已含操作行，但写法为 `.\run`——在 Git Bash 解析为 `.run` 即失败，且其 Dev Commands 段仍并列 `npm run dev` 等旧入口，均列入第 13 节 G5/G16。）

## 12. 演进与治理

1. **版本化**：JSON 信封 `schema: "run/v2"`（v4 起，随 desc 结构变更升位；v1→v3 期为 `run/v1`）；schema/动词域/保留字/退出码语义变更必须 bump 标准与 schema 版本。先例：cargo metadata `--format-version`。
2. **动词域变更**：新增/移除标准动词 = 标准版本升级（v1→v2），须附：迁移表（先例：yarn classic→berry 官方迁移指南对 `upgrade`→`up` 等逐条映射）+ 弃用期（先例：cargo "Deprecated commands receive only critical bug fixes, and may be removed in future versions."）。v2 候选动词当前排队：`clean`（首位）、`fmt`、`doc`（`bench` 已于 2026-08-19 在 v1 定稿前晋升入域，见第 4 节）。

   **v1→v2（2026-08-26，参照实现 AntAgentWeb2）**：入域 `prod`（生产形态启动，open）；退役 `serve`——其"分离服务"语义降为限定词 `server` 承接。动机：v1 的 `serve.dev`/`serve.prod` 限定词表环境，与 `dev.desktop` 限定词表形态跨族颠倒；v2 统一为"动词=意图环境（dev/prod），限定词=形态（desktop/server）"。迁移表：`serve.dev`→`dev.server`、`serve.prod`→`prod.server`、（新增）`prod.desktop`。旧 id 不设别名保留：经查参照实现无外部消费方（tests/e2e、CI 均不引用 run id），一次性切换，弃用期为零。schema `run/v1` 不随升：动词域由本标准与仓库 run.toml 头部约束，JSON schema 从不编码动词域（12.1 的"schema 版本"指结构变更；此裁量随本条留痕）。
   **v2→v3（2026-09-04，参照实现 AntAgent2）**：**脚本语言政策**——编排脚本一律 node `.mjs`（6.5），废除 v2 的 pwsh -File 调用条款与「pwsh 在 Linux 装配后可用」的跨平台假设（14.3 改为 node 单一运行时假设）；新增存量 ps1 豁免登记制（6.6，只缩不扩）。动词域、JSON 信封 `run/v1`、交互面、退出码全部不变——无 id 迁移表、无弃用期。参照实现的迁移实录（7 动作 + 两契约探针等价改写）见 AntAgent2 docs/adr/0004。
   **v3→v4（2026-09-07，参照实现 AntAgent2）**：**desc 契约字段必填**（6.1/6.2）——每个动作必须携带有效行为契约（数据空间/默认档/旗标/边界），`show`/`--json` 渲染；缺失报 CONFIG。schema `$id` 与 JSON 信封随结构变更升位：`urn:run:v1`→`urn:run:v2`、`run/v1`→`run/v2`（runner v1.2.0）。迁移：各仓一次性 backfill desc（runner+schema+run.toml 同仓同笔升级，无弃用期）；动机与裁决见 G6/G19 及 AntAgent2 的 AGENTS.md「文档同步三律」。参照实现同笔退役裸动词 `dev`（#53 后无 web 产品形态，浏览器形态目录不再保留），并补 `test.frontend`/`test.rust` 薄动作。
3. **wrapper/runner 版本对齐**：doctor 把关；跨仓库升级时先 doctor 后使用。
4. **就近取证**：动词域引用行业先例时应记录取证版本快照（附录 C）——本次调研发现 npm 12/pnpm 11 相对旧版均有动词域变动（pnpm 11 移除了对 npm CLI 的透传），版本漂移是真实风险。

## 13. 落地差距（参照实现 AntAgent2 runner v1.2.0 vs 本标准）

> 经落地审查红队核对后的**已知主要**差距清单（非穷尽）。

| # | 差距 | 处置 |
|---|---|---|
| G1 | 无 `-h`/`--help` 旗标（仅有 `help` 子命令） | v2 添加（GNU 强制项"All programs should support two standard options: '--version' and '--help'."） |
| G2 | 无 `--version` 旗标（版本经 doctor 展示） | v2 添加（同上） |
| G3 | `run run`（不带 id）退化为列出动作而非报错 | 维持现状（2.6 已规定为刻意的宽容行为） |
| G4 | 无参数透传（`--` 规则） | v2 项（第 2.7 条已定规则） |
| G5 | ~~AGENTS.md 的 Dev Commands 段仍列 `npm run dev` 等旧入口~~ | **参照实现已整改（2026-09-07）**：Dev Commands 收敛为 run 入口优先，`npm run dev` 随裸 `dev` 动作一并退役 |
| G6 | ~~动作无 `description` 字段（name 兼任说明）~~ | **v4 已落地（2026-09-07）**：desc 必填（6.1/6.2），show/--json 渲染，缺失报 CONFIG |
| G7 | 扩展前缀 `x.` 尚无实现需求 | 规范先行，实现按需 |
| G8 | 信封字段非统一矩阵（`origin`/`project`/`details` 按命令缺失，见 7.2） | 文档已按实际对齐；v2 统一化（error/help 补 project、origin 恒在） |
| G9 | Windows 中转的 cmd 元字符盲区（`& | < > ^ %` 不转义），"argv 语义不变"仅对空白/引号成立 | v2 补元字符转义；当前以 9.2 的规避规则过渡 |
| G10 | 子进程被信号终止一律归 70 INTERNAL，未区分用户中断、未转发信号（与 npm 先例相反，见 5.5/8 表） | v2：转发信号 + 128+N |
| G11 | 转发型动作（`check = ["npm","run","check"]` 等 8 个经 npm 中转）使 `-n` 预览只见一层、第二层是 `&&` shell 链，架空 P3/P5 | 编排收敛为可见脚本（6.4）；`run=[[...],[...]]` 原语为 v2 议题 |
| G12 | ~~Node 版本下限未定义、doctor 不校验（实际要求 ≥14.8）~~ | **已落地（2026-09-07，参照实现 runner v1.3.0，模板同步）**：双层前置——wrapper fail-fast（Node 缺失→安装指引）+ runner 动作前版本门 + doctor node 校验（9.5/10 节）；下限以各仓 engines 为准（参照实现 22.13+/24+，依据依赖树交集） |
| G13 | `run` sh wrapper 在 git 中无可执行位、仓库无 `.gitattributes`（POSIX 克隆 `./run` 直接 permission denied；CRLF 风险） | 立即修：`git update-index --chmod=+x run` + `.gitattributes` |
| G14 | `run.schema.json` 严格度弱于 runner（name 允许纯空白串；schema 自述"唯一由 runner 兜底的是 id 唯一性"不实） | v2：schema 收紧（`pattern: "\\S"`）并修正自述 |
| G15 | runner 不校验动词域封闭性、kind 与动词推导一致性（`x.<保留字>` 形式已由 runner 拦截；动词域封闭与 kind 推导仍靠人工遵守） | v2：runner 校验 + 报 CONFIG |
| G16 | AGENTS.md 标准操作行写法 `.\run` 在 Git Bash 失败（解析为 `.run`） | 立即修：按第 11 节模板改写 |
| G17 | doctor 的 `config` 检查恒 ok（死字段）；tools 过滤存在历史残留条件 | v2：删除或赋予真实语义 |
| G18 | available 探测无缓存（每次 list/show/preview 全量 PATH×PATHEXT 扫描） | v2：进程内缓存 |
| G19 | run.toml 内容债：`dev`/`build`/`check`/`lint`/`gate` 五个 name 零信息；`check` 动作语义倒挂（实际为 regression-cases + regression + **完整 build**，重于 build，违反 4 节 check 定义与 5.3 局限声明）；`test.*` 映射族限定词维度混杂（3.7 已豁免，属过渡债） | **部分整改（2026-09-07，参照实现）**：五个 name 已补真实摘要、全动作 desc 已回填、裸 `dev` 退役、`setup` 收敛为三处全装编排脚本；**残留**：`check` 语义倒挂未整改（需拆 build 出 check，另立项） |
| G20 | vendored TOML 解析器实现 TOML 1.1 超集，与 schema 宣称的 TOML 1.0 集不一致（跨工具链解析漂移风险） | v2：锁 1.0 子集或同步修订 schema 自述 |

## 14. 适用边界（v1 明确不规定的事）

1. **动作并发与互斥**：v1 无锁、无互斥声明。同族动作互斥（如 `dev.server` 与 `prod.server` 端口冲突、`build` 与 `dev` 并发写 dist）是仓库脚本自身的责任，标准只要求 name 中可声明。
2. **monorepo 分层**：v1 仅支持仓库根单份 `run.toml`；子包操作经根清单的动作表达（转发型动作的正式位，见 6.4）。分层 schema 是 v2 议题。
3. **动作平台适用性**：v1 无 platform/变体字段。跨平台仓库应保证动作跨平台——编排脚本以 node 编写（v3 6.5），凡有 Node 的平台即可运行；或在 name 中声明平台限定。Linux 上 doctor 报 unavailable 属预期行为而非标准违规。
4. **环境变量注入**：只透传不增不改；唯一的标准内建注入是 `TEST_TMP_ROOT` 临时落点路由（9.7——run 层统一路由，非按动作定制）；其余需要注入的动作自行包装脚本。
5. **编排原语**：v1 无 depends_on/组合原语（P5 显式优先）；过渡方案见 6.4。

## 附录 A：证据映射表

> 置信度：**实锤**=官方/上游原文逐字引述（回源核对）；**转述**=官方文档准确转述；**补充**=社区/第三方权威或本地实测；**自定**=本标准自创（无先例）。一行内两种证据分别标注。

| 标准条款 | 先例 | 来源 | 置信度 |
|---|---|---|---|
| P1 封闭动词域（形态先例） | "Go is a tool for managing Go source code." + 封闭命令表 + "go help \<command\>" | https://pkg.go.dev/cmd/go | 实锤 |
| P1 封闭动词域（扩展模型） | cargo(1)："command may be one of: built-in commands / [aliases] / [external tools]" | https://doc.rust-lang.org/cargo/commands/cargo.html | 实锤 |
| P1 惯例动词清单（形态先例，非封闭性） | make 16.6 "All GNU programs should have the following targets in their Makefiles:"（all/clean/install/check/dist…） | https://www.gnu.org/software/make/manual/html_node/Standard-Targets.html（make 4.4.1） | 实锤 |
| P2 无参发现 | npm run："If no 'command' is provided, it will list the available scripts." | https://docs.npmjs.com/cli/v12/commands/npm-run | 实锤 |
| P2 无参发现（just） | "If no recipe makes sense as the default recipe, you can use `default-list` to list the available recipes instead" | https://github.com/casey/just/blob/master/README.md | 实锤 |
| P3 预览 | make："Print the recipe that would be executed, but do not execute it (except in certain circumstances)."；rsync："-n, --dry-run: This makes rsync perform a trial run that doesn't make any changes" | https://www.gnu.org/software/make/manual/html_node/Options-Summary.html 、https://download.samba.org/pub/rsync/rsync.1 | 实锤 |
| P3 dry-run 收录为标准旗标 | GNU 长选项表收录 `dry-run`/`just-print`/`recon`；clig.dev 旗标表 "-n, --dry-run: Dry run." | https://www.gnu.org/prep/standards/html_node/Option-Table.html 、https://clig.dev/ | 实锤 / 补充 |
| P4 机器读 | cargo `--message-format=json`：按行 JSON、`reason` 判别、`build-finished` 终止标记、"only interpret a line as JSON if it starts with `{`" | https://doc.rust-lang.org/cargo/reference/external-tools.html | 实锤 |
| P4 格式版本化 | "The format is stable and versioned. When calling cargo metadata, you should pass --format-version flag explicitly" | 同上 | 实锤 |
| P4 --json | clig.dev："Display output as formatted JSON if `--json` is passed." | https://clig.dev/ | 补充 |
| P5 无隐式钩子 | yarn berry："we intentionally don't support arbitrary pre and post hooks for user-defined scripts (such as prestart)." | https://yarnpkg.com/advanced/lifecycle-scripts | 实锤 |
| P5 无隐式钩子（迁移佐证） | 迁移指南："custom pre and post scripts are no longer supported" | https://yarnpkg.com/migration/guide | 转述 |
| P6 退出码 | POSIX："Usually, utilities return zero for successful completion and values greater than zero for various error conditions." | https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap01.html（POSIX.1-2024） | 实锤 |
| P6 透传 | npm："If the script exits with a code other than 0, then this will abort the process."；npm/run-script 源码："we send the signal back to ourselves again so that npm will exit with the same status as the child" | https://docs.npmjs.com/cli/v12/using-npm/scripts 、https://github.com/npm/run-script/blob/main/lib/run-script-pkg.js | 实锤 |
| P6 sysexits 槽位 | BSD sysexits.h（EX_USAGE=64/EX_DATAERR=65/EX_UNAVAILABLE=69/EX_SOFTWARE=70/EX_CONFIG=78）；Python os.EX_* | https://man7.org/linux/man-pages/man3/sysexits.h.3head.html 、https://docs.python.org/3/library/os.html#os.EX_OK | 实锤 |
| P6 禁错误计数当退出码 | GNU Coding Standards 4.2："Do not use a count of errors as the exit status for a program" | https://www.gnu.org/prep/standards/html_node/Semantics.html | 实锤 |
| P7 一词一义 | git 2.23.0 RelNotes：switch/restore 拆分 checkout 的官方动机原文 | https://github.com/git/git/blob/master/Documentation/RelNotes/2.23.0.adoc | 实锤 |
| P7 避免近义命令 | clig.dev："Don't have ambiguous or similarly-named commands." | https://clig.dev/ | 补充 |
| 2.1 保留字保护 | git-config alias："aliases that hide existing Git commands are ignored except for deprecated commands." | https://git-scm.com/docs/git-config | 实锤 |
| 2.2 禁缩写 | gitcli(7) 仅长选项允许唯一前缀缩写且劝阻脚本依赖；clig.dev："Don't allow arbitrary abbreviations of subcommands." | https://git-scm.com/docs/gitcli 、https://clig.dev/ | 实锤 / 补充 |
| 2.3 未知命令引导 | npm `Missing script` 报错附 "To see a list of scripts, run:" 引导 | npm CLI 行为（本地 npm 11.12.1 实测；官方文档页无此文案） | 补充（实测） |
| 2.4 长短旗标成对 | GNU 选项表 quiet/silent 成对收录 | https://www.gnu.org/prep/standards/html_node/Option-Table.html | 实锤 |
| 2.4 `--help`/`--version` 强制 | GNU："All programs should support two standard options: '--version' and '--help'." | https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces.html | 实锤 |
| 2.7 `--` 分隔 | POSIX XBD 12.2 Guideline 10："The first -- argument that is not an option-argument should be accepted as a delimiter indicating the end of options."；npm："A `--` argument tells the cli parser to stop reading flags" | https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap12.html 、https://docs.npmjs.com/cli/v12/using-npm/config | 实锤 |
| 3.4 族内对仗 | cargo profiles："Cargo has 4 built-in profiles: dev, release, test, and bench."；go test "-run=X/Y ... possible parents of matches are run too" | https://doc.rust-lang.org/cargo/reference/profiles.html 、https://pkg.go.dev/cmd/go | 实锤 |
| 3.6 冒号前缀族 | pnpm："Run all scripts that start with `watch:`: `pnpm run \"/^watch:.*/\" ... Matched scripts run in lexicographical order"；yarn berry：冒号脚本名跨工作区调用（仅当全工作区恰好唯一同名匹配） | https://pnpm.io/cli/run 、https://yarnpkg.com/cli/run | 实锤 |
| 4 setup（对应物） | make 16.6 `install` 惯例；PowerShell `Install`（其同义词反表含 `Setup`——命名反证，正文已声明） | https://www.gnu.org/software/make/manual/html_node/Standard-Targets.html 、https://learn.microsoft.com/en-us/powershell/scripting/developer/cmdlet/approved-verbs-for-windows-powershell-commands | 实锤（对应物先例；命名自定） |
| 4 dev | cargo profile dev："used for normal development and debugging" | https://doc.rust-lang.org/cargo/reference/profiles.html | 实锤 |
| 4 serve | Task 官方示例 "task docs:serve"；PowerShell Start（异步） | https://taskfile.dev/usage/ 、MS Learn 同上 | 实锤 |
| 4 build | PowerShell `Build`（PS6 新增，Lifecycle）："Creates an artifact (usually a binary or document) out of some set of input files (usually source code or declarative documents.)" | MS Learn 同上（powershell-7.6，ms.date 2026-03-30） | 实锤 |
| 4 check | cargo check："compile the packages without performing the final step of code generation, which is faster than running cargo build" + 盲区声明 | https://doc.rust-lang.org/cargo/commands/cargo-check.html | 实锤 |
| 4 lint（对应物） | go vet："report likely mistakes in packages" | https://pkg.go.dev/cmd/go | 实锤（对应物先例） |
| 4 test | npm 保留脚本名（`npm test` 直呼）；go/cargo test | https://docs.npmjs.com/cli/v12/using-npm/scripts | 实锤 |
| 4 gate（对应物） | PowerShell `Assert`："Affirms the state of a resource." | MS Learn 同上 | 实锤（对应物先例） |
| 4 dist | make 16.6 `dist`："Create a distribution tar file for this program." | https://www.gnu.org/software/make/manual/html_node/Standard-Targets.html | 实锤 |
| 4 x. 扩展（机制先例） | cargo 外部子命令机制（cargo-foo 自动挂载）；git 别名不遮蔽内置 | https://doc.rust-lang.org/cargo/reference/external-tools.html 、https://git-scm.com/docs/git-config | 实锤（前缀本身自定） |
| 4 生态映射 bench/doc | cargo 命令分类：`bench`/`doc` 均归 Build Commands；4 内置 profile 含 `bench` | https://doc.rust-lang.org/cargo/commands/index.html 、profiles.html | 实锤 |
| 5 open/task 二分 | PowerShell："Use the `Invoke` verb to perform synchronous operations, such as running a command and waiting for it to end. Use the `Start` verb to begin asynchronous operations, such as starting an autonomous process." | MS Learn 同上 | 实锤 |
| 5.2 kind=文档层分类 | npm run 分组展示（源码 `lib/commands/run.js` 输出 "Lifecycle scripts included in \<pkg\>:" / "Scripts available in \<pkg\> via `npm run`:"）；cargo 七大分类 | https://github.com/npm/cli/blob/latest/lib/commands/run.js 、https://doc.rust-lang.org/cargo/commands/index.html | 实锤（源码）/补充（实测输出） |
| 5.3 快速层声明盲区 | cargo check 盲区声明（同上） | cargo-check.html | 实锤 |
| 6.1 封闭 schema | cargo "[alias]"："Aliases are not allowed to redefine existing built-in commands."（防重定义精神同源） | https://doc.rust-lang.org/cargo/reference/config.html#alias | 实锤 |
| 7.1 stdout 纯净 | pnpm 11："pnpm now prints `$ command` (to stderr, so stdout stays pipe-friendly)"；POSIX："The standard error shall be used only for diagnostic messages." | https://pnpm.io/blog/releases/11.0 、https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap01.html | 实锤 |
| 7.2 信封版本校验 | cargo metadata --format-version 教训（同上） | cargo external-tools | 实锤 |
| 7.3 JSON Lines | jsonlines.org 三规则（UTF-8 无 BOM / 每行合法 JSON / `\n` 行终止；末行换行为其推荐项，本标准收严为强制） | https://jsonlines.org/ | 补充 |
| 8.2 非零语义须文档化 | POSIX 不依赖具体值 + Node.js CLI 最佳实践 "be sure to document them properly" | POSIX 同上 、https://github.com/lirantal/nodejs-cli-apps-best-practices | 实锤 / 补充 |
| 9.6 exitCode 而非 exit | Node.js 官方对 process.exit() 截断挂起异步操作的警告 | https://nodejs.org/api/process.html | 实锤 |
| 12.2 迁移表 + 弃用期 | yarn classic→berry 官方迁移指南逐条映射（Renamed commands 表）；cargo："Deprecated commands receive only critical bug fixes, and may be removed in future versions." | https://yarnpkg.com/migration/guide 、https://doc.rust-lang.org/cargo/commands/deprecated-and-removed.html | 实锤 |
| 12.4 版本漂移风险 | pnpm 11.0："Commands previously implemented by passing through to the `npm` CLI have either been reimplemented natively or removed." | https://pnpm.io/blog/releases/11.0 | 实锤 |

## 附录 B：诚实边界（自定项与未证实项）

**本标准自定（无官方先例，属设计决策）：**

1. **点分层隔符 `verb.qualifier`**：行业分层用冒号（npm 社区、pnpm/yarn/Task 官方）、`::`（just 模块）、`/`（go test 过滤）。点分是本标准选择（与 TOML 键、文件名、域名习惯一致），无先例反对分层本身。
2. **id 段内禁连字符**：just 允许连字符；本标准收紧以保机械映射单向确定。
3. **`--json` 作为统一旗标**：npm 官方明示 "--json ... Not supported by all npm commands"；pnpm 分命令用 `--json`/`--format=json`/`--reporter=ndjson`。统一旗标是本标准的规范化，超出两家实践。
4. **10 动词域的具体集合**：行业先例支持各动词**个体**（见第 4 节），但没有任何官方标准规定过这个**集合**。动词域封闭本身是本标准立的规（各工具只有事实上的封闭清单）。
5. **`x.` 扩展前缀**：机制有 cargo/git 先例，前缀本身自定。
6. **退出码 65=CONFIG**：sysexits 的 EX_CONFIG 实为 78；65 槽位是 EX_DATAERR。沿用参照实现既成事实并文档化。
7. **`gate` 动词名**：CI 领域通用概念，无通用 CLI 官方动词对应。
8. **`lint` 动词**：无官方动词表对应（go 的对应物叫 `vet`）。
9. **JSON 信封字段结构**：无正式标准，仅社区先例（clig.dev/jsonlines）。
10. **大小写不敏感匹配/旗标比较**（含子命令分派）：无官方背书的宽容行为，第 1 节已划定其与 P5 的边界。
11. **doctor 对 gate 的宽容**（5.4）：影响退出码的实质行为规则，自定。
12. **`run run` 缺操作数退化为列出**（2.6）：自定的不对称宽容。
13. **`setup` 动词命名**：PowerShell 官方将 `Setup` 列为避免同义词（反证已知悉）；取"准备就绪"宽语义保留，自定。
14. **project.id 的 namespace/name 形态**：自定。
15. **编排脚本一律 .mjs 的语言政策**（v3 6.5/6.6）：行业无强制先例（npm/just 等以各自生态语言为默认，属事实惯例而非标准）；支撑逻辑是 wrapper/runner 已强制 Node 为唯一运行时，语言统一消除第二运行时前置（PowerShell 版本、shell 宿主差异）。豁免登记制为配套自定。

**调研中显式未证实（不编造）：**

- POSIX 无 `-h/--help` 规定（出处是 GNU）；GNU 标准无 0/1/2 退出码总则（仅 grep/diffutils 各自手册）。
- PowerShell 无 development/CI 专用动词组；.NET/cargo 无统一官方退出码参考章节（cargo 以每命令 EXIT STATUS 0/101 表达）。
- npm 官方对冒号分层命名**零表述**（纯社区惯例）；ELIFECYCLE 错误码在 npm ≥7 已消亡（历史行为，勿再当作现行语义引用）。
- git 子命令**不支持**前缀缩写（官方仅长选项有此规则，子命令无正面文档，实测仅完整名可用）。
- make 手册 16.6 无 `test` 目标（automake 层面才有 test/check 同义）；just 的 `-l` 短选项未见官方文档记载。
- kubectl `--help` 里的 Beginner/Intermediate/Advanced 分组未见于 kubernetes.io 官方网页（仅工具输出）。

## 附录 C：调研快照（2026-08-17）

| 对象 | 版本/渠道 | 备注 |
|---|---|---|
| npm | latest 12.0.2（registry dist-tags 实测）；文档站 v12 与 v11 并行 | v12 新增 get/set/patch/stage 等，移除 star 族 |
| pnpm | 11.22.0（12.0.0 尚处 rc）；本机实测 11.11.0 | 11.0 移除 npm CLI 透传、新增 `pnpm ci` |
| yarn | berry 站点 4.18.0-dev（master 文档）；classic 1.22.22 | berry 移除用户级 pre/post 钩子 |
| cargo | 本机 1.95.0（2026-03-21）；官方文档随稳定版发布 | 命令页含 Deprecated and Removed 分类 |
| make | 手册 4.4.1 | 16.6 Standard Targets |
| just | master（README 自述功能标注至 1.58.0） | GRAMMAR.md 定义 NAME 词法 |
| Task | taskfile.dev 当前线上版 | schema.json 对 name 无约束 |
| git | 2.55.0（页面更新 2026-06-29） | |
| go | 当前线上版（pkg.go.dev/cmd/go） | |
| docker / kubectl | 当前线上版 / v1.36 | |
| POSIX | POSIX.1-2024（IEEE Std 1003.1-2024，Issue 8） | |
| GNU Coding Standards | last updated 2026-04-27 | |
| PowerShell 文档 | powershell-7.6（ms.date 2026-03-30） | Approved Verbs |
| clig.dev | 当前线上版 | 补充级证据 |

## 附录 D：调研与校验方法（含对抗校验记录）

### D.1 调研流程

1. **本地事实（explore 角色）**：通读 `scripts/run.mjs`（v1.1.0）、`run`/`run.cmd`、`run.schema.json`、根与 frontend 的 package.json scripts、AGENTS.md，产出 CLI 交互面/schema/退出码/输出结构的实现事实。
2. **外部证据（researcher ×4 并行）**：npm+pnpm；yarn+cargo；make/just/Task+git/go/docker/kubectl；PowerShell+POSIX+GNU+clig.dev+Node/Python/sysexits。规则：官方/上游优先、逐条 URL+版本、原文短引述、未证实显式标注。

### D.2 对抗校验（红队 ×4，2026-08-17）

| 角色 | 范围 | 结论 |
|---|---|---|
| 事实核查员 A | npm/pnpm/yarn/cargo 共 15 组引述逐条回源 | 13 组逐字属实；2 组"内容真实但出处错配"（yarn 迁移指南无逐字原句→降级转述；npm "To see a list of scripts" 出自 CLI 行为→改标实测）。另核出 cargo `--list` 统一清单仅本地实测支撑→降级。**未发现编造** |
| 事实核查员 B | make/just/Task/git/go/POSIX/GNU/clig.dev/PowerShell/Python/sysexits/Node/jsonlines 共 20 组 | 18 组逐字属实；2 组修正（make `-n` 引文补回官方括注 "(except in certain circumstances)"；GNU 禁错误计数句实际在 Semantics.html 而非 Errors.html）。负面断言（POSIX 无 --help、make 无 test 目标等）全部复核成立 |
| 标准攻击者 | 全文设计对抗 | 15 项缺陷（4 高）：3.2 与 x. 规则字面矛盾（已修，3.2 重写）；open 停止契约缺失且信号→70 与自引先例相反（已补 5.5 + G10）；转发型动作架空预览/无 shell 主张（已补 6.4 + G11）；"差异全部列出"承诺失实（已降级措辞并补 G8–G20）；setup 证据反噬（已标注命名反证）；clean/fmt/bench/doc 缺位（已补生态映射表与 v2 候选）；并发/monorepo/平台/保留字治理缺位（已补第 14 节与 12.1）；其余按条修订 |
| 落地审查员 | 对照 run.mjs/run.toml/schema/AGENTS.md 逐行核对 + 本机实测 | 信封字段矩阵失实（origin/project/details 非通用，已按实际重写 7.2）；G9 元字符盲区、G13 exec bit、G14 schema 严格度、G17 doctor 死字段、G19 run.toml 内容债（check 语义倒挂、5 个零信息 name）等均采纳入差距表；纠正了草案对 POSIX 指南编号的误用与 `just --evaluate` 的误引。**其中一条红队发现（"run.toml 已禁止技术名词限定词并改用 dev.desktop"）经与 run.toml 原文核对不成立，予以驳回**——对抗结论本身也被对抗 |

### D.3 修订对照

草案 → 定稿的主要变更：3.2 重写（x. 豁免）、3.7 新增（映射优先裁决）、4 节 setup 命名反证与生态映射表、5.5 新增（open 生命周期）、6.4/6.5 新增（直达入口/.ps1 调用）、7.2 字段出现矩阵重写、8 节信号例外标注、9.2 承诺收窄 + Node 下限、11 节 exec bit/.gitattributes/跨 shell 调用形态、13 节 G8–G20、14 节适用边界、附录 A 五处引用修正与补行、附录 B 五项自定补录。
