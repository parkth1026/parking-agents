# quick-validate 的判定细则

SKILL.md 第 5 步只写「跑什么、四个退出码各是什么意思」。要改校验器、要判断某个 frontmatter 写法会不会被拦、
或者拿到 `UNDECIDABLE` 想知道为什么时，读本文件。

## 支持子集与越界失败关闭

规则集：name kebab-case ≤64；description ≤1024 且无尖括号；compatibility ≤500；**键分诊**（下述）。合法 → `PASS`（退出码 0）；违规逐条列规则名（退出码 1）；参数缺失出用法（退出码 2）；frontmatter 含解析器支持子集外的构造时报 `UNDECIDABLE`（退出码 3）——**既不判 PASS 也不判 FAIL**，因为读不到宿主会读到的值，猜一个比没有门禁更危险。支持子集（与宿主 YAML 语义对齐）：单行/多行 plain 标量（含行尾注释剥离与续行折叠）、双引号标量（含 `\"` `\n` `\uNNNN` 等转义）、单引号标量、块标量 `|` 与 `>`（含 strip/clip）、嵌套块父键；越界即失败关闭：flow 集合 `[...]`/`{...}`、跨行引号标量、单引号双写 `''`、块标量 keep chomping `+`。越界只有落在被校验的键（name/description/compatibility）上才阻塞判定——`allowed-tools: [Read, Glob]` 这类合法 flow 序列不影响 PASS。打包门同样拒绝无法判定的技能。CRLF 与 LF 同判定。

## 键分诊

**键分诊**：未知键**不判失败**，只提示。理由是枚举宿主的键集必然落后——官方 `quick_validate.py` 正因为拿白名单当判定依据，拒掉了 31 个官方技能中的 24 个（`user-invocable`、`version`、`argument-hint` 都是宿主真实支持却不在表内的键）。这条规则真正能防的是**必填键拼错**：`descrption:` 写错了技能就没有触发面。所以改为——与已知键编辑距离 ≤2 且 ≤ 键长/3 的未知键判**拼写错误**（退出码 1，报出建议键名）；其余未知键只出警告。已知键集含官方 6 项与 changelog 逐条求证的 12 项宿主 skill 键（`disable-model-invocation`/`argument-hint`/`user-invocable`/`effort`/`model`/`context`/`background`/`agent`/`disallowed-tools`/`display-name`/`default-enabled`/`fallback`），比对前按 kebab/snake/camel 归一（宿主对部分键接受三种写法）。

## 全仓复扫防腐化

键集腐化只有在真实语料上才暴露（单技能 fixture 看不见），所以 `run-tests.mjs` 有一条**全仓复扫**：进程内直接调 `validateSkill()` 遍历本仓全部技能，任一失败即测试失败（实测 58 个技能 20ms；换成 spawn CLI 要 48 秒——这条回归能常设，前提是走进程内调用）。非本仓布局的宿主自动跳过。
