# iteration-6 测试报告：每半小时定时触发的持续积累能力

**测试日期**: 2026-08-15 | **对象**: jenkins-log-auto-learning v6.0（编排器）+ jenkins-pair-analyze
**问题**: 假设每半小时定时触发一次，能否持续、无重复、无丢失地积累 Jenkins 错误案例？

> **修复附录（2026-08-15 同日）**: 本报告发现的 F1/F2/F3/D8 四缺陷已按最佳实践修复，
> 套件翻转为修复后断言并扩充至 56 用例全过；旧套件 iteration-1(19)/iteration-2(37×2) 同步更新全过。
> 真实账本迁移验证：6 个冻结键自愈（含真实丢失案例 twe-installed [619-623,627]→628 找回并入队）、
> 2 个 BUILDING 冻结键重写为事实、remaining 149→150、无键回滚。
> 修复依据与实现细节见 git 提交记录与 `references/tracking.md`/`phase0-scan.md`。

## 结论（TL;DR）

**调度机制本身过硬，可以支撑每半小时定时触发**——锁、断点恢复、过期重扫、
耗尽回环、20 轮压力零重复、真实环境全链路一轮，全部通过。
**但存在一个会持续漏案例的真实缺陷（F1/F2）**：扫描时未修复的失败被过早终身标记，
修复到来后该错误案例永久丢失。真实账本已实锤丢失 1 例（twe-installed #627→#628）。
修掉 F1/F2 后，这套机制才真正配得上"持续积累"四个字。

## 测试方法

### Part A: 确定性调度模拟（`run-schedule-sim.mjs`，46/46 PASS）

本机 mock Jenkins（可中途注入新构建 = 模拟 CI 持续产出新失败）+ 隔离沙箱，
按编排器 SKILL.md 的流转（status → scan → next → stage → finish）逐轮模拟定时触发。
"分析"环节以合法终态收尾代替（本套件测积累机制，不测分析质量——后者由既有
with/without 评测覆盖）。

| 组 | 覆盖 | 结果 |
|----|------|------|
| A 冷启动与锁 | 无 pending 冷启动、首次扫描、领取、单实例锁拒绝 | 6/6 |
| B 定时循环 | done/skip/error 三路落账、无重复领取、耗尽→重扫回环、过期提示、新失败到来 | 14/14 |
| C 崩溃恢复 | 领取后崩溃续跑、stage 后 finish 前崩溃（记账恰好一次）、abandon 僵死会话 | 6/6 |
| D 守卫与损坏 | 门禁、重复收尾、grammar、重复 finish、workflow 损坏优雅指引 | 8/8 |
| E 压力循环 | 20 轮触发×4 种终态：零重复领取、账本单调、每轮恰好 1 条 runHistory、remaining 交叉一致、重扫幂等、无 BOM+CRLF | 7/7 |
| F 疑点实证 | 见缺陷清单 | 5/5（证实缺陷存在） |

**实现教训**：子进程必须用异步 spawn——spawnSync 阻塞父进程事件循环，
同进程 mock 服务器无法响应子请求（首版 30s 超时全 WARN）。

### Part B: 真实环境全链路一轮（真 Jenkins 10.66.12.40 + 真账本）

1. `status`: 无会话，pending 150 对但过期 10h → 按 phase0-scan.md 重扫 ✓（150 对不变）
2. `next`: 领取 twe-ue5.5 fail=#114 → fix=#115 ✓
3. 真实分析（按 jenkins-pair-analyze 流程）：下载日志 → 根因 `java.io.IOException: 磁盘空间不足`
   （Pull Plugins 阶段 LFS 写盘失败，CPS 序列化崩溃）→ 验证 #115 检出同一提交 dfb3c0f4、
   零错误零警告 → 判定基础设施故障 → 写 `scratch/twe-114-DiskSpaceExhausted.md` ✓
4. `stage done` + `finish`: 账本 2057→2059 键，runHistory 1→2，remaining 150→149 ✓

结论：编排器规定的每个动作在真实环境都走通了，账本真实增长。

## 缺陷清单

### F1【严重·已实锤】尾部失败被过早 no-fix-found，修复对永久丢失

`scan-pairs.mjs` 在配对阶段把"后面还没有 SUCCESS"的失败组直接记
`failure:no-fix-found`。但扫描只是瞬时快照——修复构建往往在扫描之后才完成。
等修复到来再重扫时，配对组 firstKey 已在账本，对被永久排除
（`scan-pairs.mjs:129` 的 `firstKey in track.analyzed` 判断）。

**对定时场景的影响**：UE 构建动辄 1-2 小时，"扫描时有失败还没修复"是常态而非边缘。
每半小时触发 → 每次扫描都会冻结当时未修复的失败 → 这些失败修复后案例全丢。
**这正是"持续积累新错误案例"的核心场景。**

**真实损失（已发生）**：twe-ue5.5-installed #619-623、#627 被标 no-fix-found；
其中 **#627 后有 #628 SUCCESS 修复**——这个真实错误案例已永久进不了分析队列
（沙箱用例 F1/F1b 复现了同一路径）。

### F2【严重·同根因】BUILDING 构建被冻结为 skip:BUILDING

扫描时在构建中的 build 被永久记 `skip:BUILDING`（`scan-pairs.mjs:102`）。
它完成为 FAILURE 且作为失败组头部时，组被 firstKey 判断排除 → 修复对丢失
（真实账本 aes6#4280、twe-linux#720 已被冻结；两者恰好完成成 SUCCESS，未造成实际损失）。

### F3【中】Jenkins 完全不可达被静默当作"无对"

`scan-pairs.mjs` 对每个任务的 fetch 失败只打 WARN 继续，最终 exit 0 写出 0 对
pending。无人值守调度时，Jenkins 挂了会被当成"没有新失败"，分析循环空转且无告警。
phase0-scan.md 的"非零退出码即停止"守卫永远不会触发。

### D8【低-中】账本损坏时无优雅处理，且写入非原子

`analyzed-builds.json` 损坏时 session.mjs 直接抛裸 SyntaxError（对比 workflow.json
有"人工检查后删除再 next，或 abandon"的指引）。且账本经 `writeJsonCRLF` 直接
writeFileSync（非 tmp+rename 原子写），长期无人值守场景断电/中断可能产生截断 JSON，
之后所有命令都崩溃，需要人工修账本。

### 附带发现【低】finish 双写间隙崩溃会重复记账

finish 先写账本再写 workflow.json。两写之间崩溃 → 恢复后再 finish 会重复推入
runHistory 条目（analyzed 键本身幂等，仅统计虚增）。

## 修复建议（未实施，待拍板）

1. **F1/F2（同一修法）**：瞬态不落账——扫描时尾部失败组与 BUILDING 构建不写
   `failure:no-fix-found`/`skip:BUILDING`，只把它们留在 pending 视野外；
   配对排除条件从"firstKey 已落账"改为"组内全部 failBuilds 已落账"
   （与 session.mjs `findPendingPair` 的判定对齐）。存量已冻结的键需要一次性清洗
   （把 no-fix-found 且其后已有 SUCCESS 的键回炉）。
2. **F3**：所有启用任务 fetch 全败时 exit 1（phase0 已有停止守卫，只差触发条件）。
3. **D8**：readTrack 包 die() 指引；账本写入改 tmp+rename 原子写。
4. **双记**：finish 先写 workflow（置 done）再写账本，或 runHistory 推入前查重。

## 给定时调度的运维建议

- 单实例锁只在"领取"环节生效：分析耗时 >30 分钟时下一个触发会**续跑同一对**而不是
  领新对（这是正确设计，但意味着队列推进速度 = 分析完成速度）。按实测单轮分析
  约 2-10 分钟，30 分钟节奏充裕。
- 每次触发应从 `status` 进入（SKILL.md 已规定），僵死会话靠 `claimed_at` 年龄判断后
  abandon——无人值守时建议在调度 prompt 里明确"claimed_at 超过 2 小时视为僵死"。

## 工件

- 测试套件: `run-schedule-sim.mjs`（可重复运行，自带 mock+沙箱清理）
- 结果: `schedule-sim-results.json`
- 真实账本备份: `analyzed-builds-backup-before-realrun.json`（Part B 之前）
- 新知识文件: `~/memory/jenkins-learnings-raw/scratch/twe-114-DiskSpaceExhausted.md`
