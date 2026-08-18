# jenkins-log-auto-learning 严格测试报告

日期:2026-08-14 | 测试人:ZCode(skill-creator 流程) | 对象:`scripts/scan-pairs.mjs` v5.1 + 全部 references

## 结论

**修复前 16/19 → 修复后 19/19 通过,真实环境端到端验证通过。**

发现的 3 个真实缺陷(均已修复):

| # | 缺陷 | 证据 | 修复 |
|---|------|------|------|
| 1 | 不传 `--output` 时默认输出写入技能目录 `tmp/pending-pairs.json`,且 `phase0-scan.md` 明确指示检查 `{skill-dir}/tmp/` | 技能目录内存在今天 13:04 真实运行产生的 130+ 临时文件;T1 用例复现 fresh write | 默认输出改为 `{trackFile}` 同目录;phase0-scan.md/SKILL.md/config.md 同步更新,SKILL.md 新增核心约束 5"技能目录零写入" |
| 2 | `trackFile` 以 `~/` 开头时 ENOENT 崩溃(Node 不展开 `~`),而 `config.example.json` 恰以 `~/memory/...` 为示例 | C9 用例:照抄示例必崩 | 脚本新增 `expandHome()`,trackFile/output 均支持 `~/` |
| 3 | 跟踪文件目录不存在时结尾写入 ENOENT(依赖外部预先建目录) | 代码审查 + 首次运行场景 | 写入前 `mkdirSync(recursive)` |

另修复文档陈旧项:config.md 中"实际值以 config.json 为准"与 `./wiki-raw/...` 示例(旧单层设计残留)。

## 测试方法

- **沙箱**:本目录 `run-tests.mjs`,内置 mock Jenkins HTTP 服务器(随机端口),所有 config/trackFile/output 全部落在 sandbox;每次调用显式设置 `SKILL_ENV`,绝不读取真实 `~/.claude/skill-env.json`,绝不触碰真实 Jenkins/真实跟踪文件。
- **真实环境**:修复后以默认参数(真实 skill-env.json + 真实 Jenkins)完整运行一次。

## 用例明细(修复后全绿)

**C 组 config 读取**
- C1-C3 缺 baseUrl/trackFile、jobs 非数组 → exit 1 且报错信息指明去哪补 ✅
- C4 深合并:环境层 trackFile 覆盖技能层;jobs 数组整体替换(只扫环境层任务) ✅
- C5 环境层为空 → 技能层兜底 ✅
- C6 config 带 UTF-8 BOM 可解析 ✅
- C7 SKILL_ENV 指向不存在文件 → 按空环境层处理 ✅
- C8 未知 CLI 参数 → exit 2 ✅
- C9 `trackFile` `~/` 前缀展开到用户主目录(修复前:崩溃)✅

**P 组状态更新(mock Jenkins 黄金序列)**
- P1 `SUCCESS/FAILURE,FAILURE/SUCCESS/FAILURE/ABORTED/SUCCESS/FAILURE(尾部)/BUILDING` 序列:连续 FAILURE 合并为一组([11,12]→13)、ABORTED 不打断相邻配对([14]→16)、尾部 FAILURE 记 `failure:no-fix-found`、SUCCESS 记 `success:w=?`、ABORTED/NOT_BUILT/BUILDING 记 `skip:*`、配对中的 FAILURE 不提前标记 ✅
- P2 幂等重跑:pending pairs 一致、track 无重复条目 ✅
- P3 已分析首键的构建对被跳过 ✅
- P4 `enabled:false` 任务不发请求 ✅
- P5 不可达任务 WARN 跳过、整体 exit 0;空构建列表正常 ✅
- P6 输出 UTF-8 无 BOM + CRLF + 字段完整 ✅
- P7 跟踪文件不存在时自动初始化空结构 ✅

**T 组技能目录清洁度**
- T1 默认输出不写入技能目录 tmp/(修复前:复现违规)✅
- T2 默认输出 = trackFile 同目录,技能目录文件清单零变化 ✅

**真实环境端到端**
- 7 个启用任务全部扫描,2661 构建/614 FAILURE/150 对(与当日早间运行一致,幂等) ✅
- `pending-pairs.json` 生成于 `C:\Users\Administrator\memory\jenkins-learnings-raw\`(39411 字节) ✅
- 技能目录未产生任何新文件 ✅

## 清理记录

| 项 | 处置 |
|----|------|
| `tmp/`(130+ 文件,含今天真实运行产物) | 删除;有效产物 `pending-pairs.json`(150 对)已迁移至 rawDir 并被真实运行重建覆盖 |
| `wiki-raw/jenkins-learnings/analyzed-builds.json`(迁移前旧跟踪文件) | 归档至 `../archive/analyzed-builds-old.json` 后删除。**注意**:其中 80 个条目不在现行跟踪文件(2049 条)中,含格式错误 key(如缺 `job/` 前缀);现行文件为权威,未合并,如需找回见归档 |
| `report-scan-pairs-assessment.html`(git 跟踪的旧 ps1 版评估报告) | 归档至 `../archive/` 后删除;git 状态显示 `D`,需随下次提交移除跟踪 |
| `.gitignore` 中 `tmp/*`、`wiki-raw*`、`/.claude/.../tmp` | 移除——它们此前静默掩盖了对技能目录的误写入;现在误写入会直接出现在 `git status` |

## 遗留

- 工作树中 `.claude/skills/karpathy-llm-wiki/SKILL.md` 有 `knowledgeBase.*` 命名空间改动(非本次测试产生,属配置分层实施的另一部分),未提交。
- 本次改动均未提交,待用户审阅。
