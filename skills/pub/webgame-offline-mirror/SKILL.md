---
name: webgame-offline-mirror
description: 把线上网页游戏完整恢复成本地离线可运行的副本。当源码丢失需要抢救游戏、想把网页游戏搬到本地断网运行、或要完整镜像某个重前端站点时使用。覆盖引擎识别、三层资源抓取（引用闭包/家族枚举/运行时录制）、后端接口本地化、屏蔽外网的全流程验证。只存单个页面的需求不适用；仅限自己拥有或已获授权的目标。
---

# Webgame Offline Mirror

把一个线上网页游戏恢复成**离线可运行**的本地副本：资产、前端、后端替代全部本地化，运行时零外网请求。

**使用边界（先于一切）**：仅用于自己拥有、或有明确授权的目标。收到无授权目标的请求时拒绝并说明，不执行。

## 产出

镜像目录 + 本地服务（含后端替代）+ 三零验证报告（零缺失/零外网/零报错）+ 截图 + README（运行与更新手册）。

## 工作流总览

```
第0层 侦察（引擎指纹 + 源码可恢复性 + 后端面） → 决定全部参数
第1层 静态引用闭包 → mirror.mjs + audit-closure.mjs
第2层 家族全枚举 → 注册表抽取 / id 空间 / 词候选
第3层 运行时录制回灌 → verify-offline.mjs 驱动录制
第4层 后端本地化 → 录制形状 + patch + 本地实现
第5层 三零终验 → --block-external 全流程
```

三层抓取缺一不可：每层都独立命中过其他层永远找不到的文件。任何单层方案（wget/HTTrack/单跑闭包）对网页游戏都有系统性盲区。

## 第 0 层：侦察

1. 按 [references/engine-playbooks.md](references/engine-playbooks.md) 的指纹表识别引擎。拿不准就先跑一轮第 1 层看请求形状。
2. **源码映射探测**：抓 entry JS 后试 `<chunk>.map`。命中 → 任务变为源码恢复（本技能不覆盖），先向用户报告；未命中 → 产物镜像路线。
3. 有 service worker 的站点：先找 SW 的预缓存清单，那是现成的完整文件列表。
4. 找**资源 base resolver**：游戏资源 URL 由 `base + path (+ '?v=' + build)` 拼接。在 bundle 里 `.png`/`.glb` 字面量附近找到该函数，读出前缀。不确认 base 直接拼 URL 会全 404。
5. 后端面：搜独立 API 域与 `fetch(` 调用。有后端 → 第 4 层必做，先读 [references/backend-mock.md](references/backend-mock.md) 的「客户端分析」。

## 第 1 层：静态引用闭包

```bash
node scripts/mirror.mjs --origin <url> --out ./mirror --report report.json
node scripts/audit-closure.mjs --mirror ./mirror --origin <url> --out missing.txt
```

抓到收敛（audit 报零真实缺失；探测性 404 属正常）。脚本已内置坑 1/2/5 的修复（hash 锚定正则、无引号 url()、超时退避），背景见 [references/pitfalls.md](references/pitfalls.md)。

## 第 2 层：家族全枚举

对模板串拼接的 URL（`` `${id}.png` ``），三个策略按优先级：

1. **注册表抽取（首选）**：数据驱动家族（图标/标记/皮肤）在 bundle 里几乎总有注册表对象。抽全集一次收口。**不打地鼠**——运行时随机暴露的名字永远抓不完。
2. **id 空间枚举**：数字序列命名按数据文件全集生成，404 淘汰。
3. **词候选探测**：从 bundle 提取全部单词字面量（约一两千个）按家族扩展名探测，404 淘汰。

产出追加进 urls 文件，重跑 mirror（断点续跑，已有文件跳过下载但仍参与引用解析）。收敛判据：一轮无新增命中。

## 第 3 层：运行时录制回灌

```bash
node scripts/verify-offline.mjs --mirror ./mirror --flow flow.json
```

交互用 JSON flow 描述（click 正则多语言 / wait / press / key / shot）。真实站点跑一轮发现真实用法，本地镜像跑一轮验证完整性，missing 回灌 urls 文件迭代到零。

已知障碍与解法见 pitfalls.md「浏览器自动化类」：弹窗拦截、同名按钮多层含义、主菜单消失判定。

## 第 4 层：后端本地化

完整流程见 [references/backend-mock.md](references/backend-mock.md)。要点：形状只录不猜（真实流量做蓝本）；patch 客户端 base 一处（备份 `.orig`）；闸门接口时效字段推到远未来；未实现的端点惰性应答而不是假成功；进度落库用事务。核心玩法在服务端的游戏（服务端权威/双向流）在此层判定不可行，向用户说明。

## 第 5 层：三零终验

```bash
node scripts/verify-offline.mjs --mirror ./mirror --block-external --flow flow.json --out verdict.json
```

**必须屏蔽外网**：不屏蔽时缺失文件被线上静默补上，验证是假的。全流程（登录→菜单→对局→结算→刷新存档）跑通，三零 + 截图留证。交付 README 写清运行方式与更新流程（build id 变化时重跑管线）。

## 何时读哪个文件

| 文件 | 何时读 |
| --- | --- |
| references/engine-playbooks.md | 第 0 层，识别引擎后看对应资产模式与策略 |
| references/methodology.md | 开始前通读；每层的收敛判据与细节 |
| references/pitfalls.md | 抓取/验证结果异常时对号入座；14 条实测坑 |
| references/backend-mock.md | 确认有后端时；客户端分析方法与实现分级 |

## 测试

技能自带回归测试（无网络依赖，本地 fixture 站点黑盒验证三个脚本）。每次升级、改动后必跑：

    node run-tests.mjs

## 环境要求

Node ≥ 22（`node:sqlite`、内置 fetch）；playwright（`npm i -D playwright && npx playwright install chromium`，仅 verify-offline.mjs 需要）。
