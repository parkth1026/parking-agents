# 动作命名规范

run/v1 协议约束动作 id 的"形"（小写点分词、保留字、四种 kind），但对"义"只字未提。本规范补上义：让一个仓库的动作目录读起来是一套意图分类法，而不是照抄的文件名。没有它，入口脚本会得到 `dev.server.prod` 这种 id——顶着 dev 前缀却和开发毫无关系。

## 动词域

id 的首段是从封闭动词域里取的动词。动词声明意图，并决定 kind：

| 动词 | 意图 | kind |
| --- | --- | --- |
| `setup` | 环境准备 | task |
| `dev` | 带热重载的开发循环 | open |
| `start` | 启动具名的长驻进程 | open |
| `serve` | 本地起服务供验证 | open |
| `preview` | 本地托管已构建产物 | open |
| `build` | 产出构建产物 | task |
| `dist` | 产出发布/分发产物 | task |
| `check` | 链式校验 | task |
| `lint` | 静态分析 | task |
| `typecheck` | 类型检查 | task |
| `test` | 测试 | test |
| `gate` | 发布门 | gate |

仓库可以扩展动词域（例如 `perf`），但必须在自己 `run.toml` 的头注释里登记。生成器的接受脚本族从这同一份动词域派生——保持两处同步。

## 规则

1. **动词开头，默认两段。** 第三段仅在真实从属时允许（`test.regression.cases` 是 regression 这套测试的用例语料），绝不是用来塞复合词的。
2. **限定词只用产品级词汇，绝不表实现技术，也不表源文件名。** 合法词汇只有两类：产品形态（`web`、`desktop`、`mobile`、`server`…）与环境（`dev`、`prod`、`test`…）。禁止出现 `tauri`、`electron`、`vite`、`cargo` 这类技术名词——技术栈会迁移，产品形态不会；今天叫 `dev.tauri`，明天换框架这个名字就开始说谎，而 `dev.desktop` 一直成立。技术细节写在 `name` 描述里。`serve.dev` 的意思是"开发环境的分离模式服务"，不是"住在 server.ps1 里的那个东西"。
3. **同一动词族内，限定词必须编码同一个维度，互为对仗。** `serve.dev` / `serve.prod` 的限定词都表环境；`dev` / `dev.desktop` 的限定词都表产品形态。禁止把同一类东西拆到两个动词族里（`dev.server` + `serve.prod` 就是不成体系的反例：两者都是服务组合，应当是 `serve.dev` + `serve.prod`）。
4. **禁止语义矛盾的前缀。** `dev` 声明的是开发场景，所以 `dev.*.prod` 从根上就是错的——生产形态验证属于 `serve.prod`。
5. **包脚本映射是机械的：** npm 脚本 `test:gate-review-fixes` 映射为 id `test.gate.review.fixes`（`:` 与 `-` 都变成 `.`）。可预测胜过好看：任何人都能从脚本名推出 id，生成器也永远不必丢弃带连字符的脚本。只有当机械结果语义错误或违反第 2 条（带技术名词）时，才允许人工改名；无论哪种情况，`name` 字段都保留原始脚本名。
6. **包清单之外的入口脚本**（PowerShell、Makefile、justfile）按意图在动词域内命名，不照抄文件名：`server-release.ps1` 是 `serve.prod`（它起的是生产形态服务），`release.ps1` 是 `dist`（它产的是分发产物）。
7. **`name` 字段：** 包脚本映射时回显源命令；入口脚本写一句意图描述（实现技术写在这里，不写进 id）。

## 实例

| 来源 | id | 依据 |
| --- | --- | --- |
| npm `dev` | `dev` | 机械映射 |
| `dev.ps1`（桌面一键开发，实现是 Tauri） | `dev.desktop` | 意图：产品形态是桌面；实现技术留在 `name` 里，换框架 id 不变 |
| `server.ps1`（前后端分离开发） | `serve.dev` | 意图：开发环境的服务组合；与 `serve.prod` 同族，限定词表环境 |
| `server-release.ps1`（生产形态服务） | `serve.prod` | 意图：生产形态验证，不是开发；与 `serve.dev` 成对 |
| `release.ps1`（打包） | `dist` | 意图：分发产物 |
| npm `test:regression-cases` | `test.regression.cases` | 机械映射：`:`/`-` → `.` |
