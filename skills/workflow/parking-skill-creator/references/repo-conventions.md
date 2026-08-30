# 宿主与本仓库约定

只有在**本仓库**建技能、或技能需要读环境值（路径、凭据）时才需要读本文件。
零配置技能与在别的宿主仓库建技能都用不上它——所以它不常驻 SKILL.md 正文。

## 技能环境配置（族级标准）

需要环境值（路径、凭据）的技能遵守统一约定，随技能分发到任何宿主仓库都成立：

- 解析链：`$SKILL_ENV` > `~/.config/parking-agents/skill-env.json` > 技能内缺省值；解析逻辑一份为准，放 `scripts/lib/` 共享。
- 真实环境值不进 git；技能目录内 `config.json` 只放占位说明（键名、格式、示例值），不放假真值。
- 零配置技能（全 CLI 参数 + 目录约定）不接这条链，也无需 `config.json`。

## 本仓库使用提示

（仓库惯例不进 init 模板，建本仓库技能时在此口径下自行接线。）

- **运行时**：本机 Windows + Node v24，Git Bash 终端。技能脚本一律 `.mjs` + kebab-case，放 `scripts/`，共享代码进 `scripts/lib/`；只用 Node 内置模块，零 npm 依赖、零 python 运行时依赖。
- **测试**：固化在技能根 `run-tests.mjs`——`check()` 计数器 + `execFileSync` 黑盒跑子命令，退出码 0=全过/1=有失败；fixtures 进 `fixtures/`，黄金输入配 expected 输出逐字段比对。测试随技能分发、每次升级必跑；评测沙箱默认在 skills 祖先父级的 `evals/<技能名>-workspace/`（从技能目录向上找 `skills` 祖先、取其父，与 `skills` 根平行，任意嵌套深度均落扫描根外——workspace 里出现 `SKILL.md` 产物也不会冒充技能）；影子复查 `check-shadow-skills` 按产物来源判罚：真技能不限层级全合法，产物目录（`evals/`、`eval-fixtures/`、`*-workspace/`、`skill-snapshot*`）里的活 `SKILL.md` 才判影子。
- **配置**：本技能零配置——不读 config 文件、不依赖 skill-env 命名空间，全部经 CLI 参数与目录约定。
- **git**：本仓库提交信息用中文、面向用户解释「为什么」，关键参数修正与行业知识修改要点名，不写改动流水账。
- **技能目录**：由宿主配置技能扫描根；本技能内部只使用 `<skill-dir>`、`scripts/`、`references/` 等相对路径，不把宿主扫描根名称写进文档或脚本。
