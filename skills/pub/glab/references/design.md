# glab 技能设计

## 意图与触发场景

用户或 agent 在自建 GitLab 实例（git.51vr.local，15.0.5-EE 免费档、纯 http）上使用 glab 命令行。两类入口：

- **认证类**（优先级最高）：登录、token 失效、401、`No token found`、环境变量 `GITLAB_TOKEN`、新机器配置、想模仿 gh 的浏览器登录。历史上环境变量约定源于钥匙串令牌丢失后的权宜之计，本技能把定版路径（PAT + 钥匙串）固化，防止复发。
- **命令类**：issue/MR/链接操作中的命令拼法与档位裁决。

## 设计取舍

- **PAT + 钥匙串 而非 OAuth 网页流**：OAuth 需预注册应用配 client_id、设备码流需 GitLab 17.9+、实测还生成 https 授权链接撞纯 http 实例；两条 OAuth 路折腾完的落点与 PAT 完全相同（同一钥匙串、同一令牌）。
- **协议参数写死在命令里**：纯 http 实例上 glab 默认 https 全拒，是实测头号坑。
- **交互提示「留空回车」单独强调**：真实用户卡点（SSH hostname 提示过不去），不是推测。
- **参考型结构而非流程编排**：内容是查阅型命令范式与裁决，对位 gh skill；无多步编排逻辑。
- **免费档裁决只留结论**：完整论证在仓库 `docs/agents/issue-tracker.md` 的 Link capability & tier rulings 节，技能内只留可执行结论，防止结论丢失也防止双份维护漂移。
- **语言**：中文行文，英文术语仅 PAT、keyring 两个（过四道 gate），其余英文均为机器契约（命令、参数、路径、产品名、协议名）。

## 验收条件

| 编号 | 条件 |
|---|---|
| AC-1 | 认证类请求（登录/token 报错/401/环境变量/新机器/浏览器登录愿望）触发本技能 |
| AC-2 | 引导登录四步可照做成功，成功标志为终端打印 `✓ Stored your credentials in the operating system keyring.` |
| AC-3 | 三个实测坑不被漏：协议参数必须带、`issue list -O json` 与 `-F json` 的拼法差异、令牌读回走 stderr |
| AC-4 | 免费档链接结论被直接引用（blocks 全版本 Premium、升级不解锁），不再重查文档 |
| AC-5 | 中文行文与术语克制合规（正文英文术语 ≤5） |

## 迭代记录

- 2026-08-29：初版（英文，对位 gh skill）。
- 2026-08-29：按 parking-skill-creator 中文重写并审查——quick-validate PASS（description 206/1024、无尖括号、键合规）；结构审查四信号未命中（信号 1/2/3 均 ✗，信号 4 无数据——触发评测未跑，如实记 null）；run-tests.mjs 按知识型技能豁免（无可客观断言的产物输出，且命令行为依赖内网实例在线，跨机分发会假失败）。
