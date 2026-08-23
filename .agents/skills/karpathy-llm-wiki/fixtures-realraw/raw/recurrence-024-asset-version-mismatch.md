---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 2138-2139
fix_build: 2140
error_code: PackageTooNew
score: 9
result: failure:score=6:PackageTooNew:fix=#2140:see=//nas.51vr.local/x.public/UE5/ue-llm-wiki/raw/details/recurrence-024-asset-version-mismatch.md
recorded_at: 2026-08-20T15:11:35
---

# PackageTooNew: M_Terrain.uasset 以更高引擎版本保存导致 Cook 失败

wikiDir 重复模式复发记录：原始知识文件
`//nas.51vr.local/x.public/UE5/ue-llm-wiki/wiki/details/024-asset-version-mismatch.md`
（UE 资产版本不匹配导致 Cook 失败）已覆盖此错误签名与根因，截至 2026-08-20 同任务
（aes6-ue-runtime-ci）上已第 9 次复发（含 1 次无 VCS 变更的工作区污染变体，见下表首行），不另立新知识文件。

## Error Message

```text
LogAssetRegistry: Error: Package C:/ws_aes6_ue_ci/Project/Plugins/51Hitech/EarthArtAsset/Content/Terrain/Material/RootMaterial/M_Terrain.uasset is too new. Engine Version: 1008  Package Version: 1009
ERROR: Cook failed.
AutomationTool exiting with ExitCode=25 (Error_UnknownCookFailure)
ERROR: Package project failed.
```

（构建 #1074、#1075 连续失败，2026-08-18，UnrealEditor-Cmd Cook 阶段 ExitCode=1，
错误行在两份日志的 Warning/Error Summary 中各出现 2 次，错误码级别条目仅此一条）

## Root Cause

EarthArtAsset 仓库提交 `baddd2d81b841ea076b5adca8bc5c0a7736b4cb9`
「1.恢复地形材质上的道路mask 2.高架护栏材质修改」把根材质
`Content/Terrain/Material/RootMaterial/M_Terrain.uasset` 以 Package Version 1009 保存提交，
而 CI 引擎版本为 1008。UE 资产格式不向后兼容：高版本保存的资产无法被低版本引擎加载，
Cook 阶段读取该材质即报 "is too new"，随后以 Error_UnknownCookFailure (ExitCode=25) 终止打包。
与 wiki 原文件记载的根因同族（#3877 WBP_DomManager.uasset 1008 vs 1013、#3763 双资产同类），
本次版本差仅 +1（1008 vs 1009），推测是开发者本地引擎构建略新于 CI 引擎所致。

## Fix

- **Commit**: `281dfc701d1f6a2c408263e1336f0acd32d56811`（281dfc701，EarthArtAsset 仓库）
- **Message**: 「1.恢复地形材质上的道路mask 2.高架护栏材质修改」——与引入提交 baddd2d 消息相同
  （同内容重存提交）
- **What changed**: 以 CI 兼容版本重新保存并重提交 M_Terrain.uasset（baddd2d → 281dfc7，
  二进制资产，无文本 diff）。#1076 中 "is too new" 零出现，Cook ExitCode=0，打包成功。

归因强度：等效强归因链（唯一 pin 变化 281dfc701 + 与失败对象同名 + 错误消失）。
#1075(失败)→#1076(成功) 七个仓库 pin 比对（AesBuilderJenkins/WdpCamera/UnrealImGui/
AesRuntimeCore/AesWorld/EarthArtAsset/51EarthBuilder）中唯一变化是 EarthArtAsset
`baddd2d`→`281dfc7`；AesWorld 虽在 #1075 已更新为 4be3a67，但 #1076 未再变，且该提交为
版本结构定义代码，与资产版本错误无涉。真实 diff 不可得（本地 D:/Git 无 EarthArtAsset 克隆，
GitLab 匿名 API/git 访问均 404/要求凭据）。

## How to Reproduce / Detect

- grep 关键词：`is too new`、`Package Version: 1009`、`Error_UnknownCookFailure`
- 规律：LogAssetRegistry Error "is too new" 是 Cook 阶段唯一 Error 级条目，且
  `UnrealEditor-Cmd.exe, ExitCode=1` → 基本必然是资产版本高于引擎版本
- 定位引入提交：比对该插件仓库在失败/成功两构建的 `Checking out Revision`（本 Jenkins
  实例 changeSet 恒空，控制台日志回退是预期路径）

## Epic Official Guidance

- **Query**: "UE5.1 cook failure during packaging: LogAssetRegistry Error 'Package .../M_Terrain.uasset is too new. Engine Version: 1008 Package Version: 1009' followed by 'ERROR: Cook failed.' and AutomationTool ExitCode=25 (Error_UnknownCookFailure). The asset was saved by a newer engine build than the CI engine. What causes this error and how to fix and prevent it?"
- **Answer**（要点）：UE 严格的向前兼容规则——新版本引擎保存的资产无法被旧版本打开或 Cook。
  Engine 1008 对应 UE5.1，Package 1009 对应更高版本引擎（Epic 按 5.2 解读；本项目为自研
  分支，实际为略新的本地构建）。修复两条路：(1) 资产回滚到最后一个兼容版本提交（无法从
  高版本"降存"，需在旧版本编辑器中重做变更）；(2) 升级 CI 与全员引擎版本。预防：
  .uproject 中显式固定 EngineAssociation；版本控制预提交钩子解析 .uasset 头部
  PackageFileSummary 的 FileVersionUE5，超出允许值即拦截提交；统一源码构建/关闭启动器
  自动更新。ExitCode=25 是 UAT 对 Cook 失败的笼统兜底码，根因要看其前的 Error 行。
- **References**:
  - [Versioning of Assets and Packages](https://dev.epicgames.com/documentation/unreal-engine/versioning-of-assets-and-packages-in-unreal-engine)
  - [Will my UE4.X project open in UE5.0?](https://dev.epicgames.com/community/learning/knowledge-base/9y6d/unreal-engine-will-my-ue4-x-project-open-in-ue5-0)

## Prevention

- 提交 .uasset 前用与 CI 相同版本的引擎保存；CI 侧可在 Cook 前加资产版本检查步骤提前失败
- 预提交钩子解析 .uasset 头部版本号，超出引擎允许值即拦截（Epic 建议方案，见上节）
- 同名重存提交（baddd2d→281dfc7 消息一字不差）是本类修复的典型形态：CI 失败通知应
  直接 @ 最近内容提交者，缩短自愈窗口

## Warning Trend

| Build | Warnings |
|-------|----------|
| #1074 (fail) | 0 |
| #1075 (fail) | 0 |
| #1076 (fix)  | 0 |
| #1127 (fail) | 0 |
| #1129 (fail) | 0 |
| #1141 (fix)  | 0 |
| #1173 (fail) | 0 |
| #1174 (fix)  | 0 |
| #1550 (fail) | 0 |
| #1551 (fail) | 0 |
| #1552 (fail) | 0 |
| #1553 (fail) | 0 |
| #1554 (fix)  | 0 |
| #1976 (fail) | 0 |
| #1977 (fail) | 0 |
| #1978 (fail) | 0 |
| #1979 (fail) | 0 |
| #1980 (fix)  | 0 |
| #2133 (fail) | 0 |
| #2134 (fail) | 0 |
| #2136 (fix)  | 0 |
| #2138 (fail) | 24 |
| #2139 (fail) | 0 |
| #2140 (fix)  | 24 |

趋势：持平（±0）。历次 consoleText 均为 Incredibuild/xgConsole 编排日志，逐文件编译器
警告行不落盘，计数为 grep `warning C\d+:|warning CS\d+:` 口径。
2026-08-20 补记（#2138-2140 轮）：#2138/#2140 各 24 条真实编译警告（14×C5038 初始化顺序、
6×C4996 弃用 API、2×C4005 宏重定义、2 条汇总行口径差异），逐文件警告现已落盘；#2139 为 0
系增量构建未重编译（xgConsole 仅 10.9s），计数失真。本轮趋势：持平（fail 24 → fix 24）。

## Recurrences

| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-08-20 | #2138-2139 → #2140 | **新变体（无 VCS 变更的工作区污染）**，构建 2024-10-30：#2136(成功)/#2138/#2139/#2140 四构建的 7 个仓库 pin（EarthArtAsset 7d80592、AesWorld 2034ddc 等）与 p4 changelist 204479 **完全一致**，但 #2138/#2139 Cook 各报 2403 处 "is too new"（全部位于 P4 管辖的 Project/Content/：Content 根、EarthSimEngine/、EarthSimKit/、AdvancedLocomotionV4/ 等，另有 1 条次要错误 MI_West_Arty_M777.uasset "has malformed tag"）。2403 个资产以 1009 版本在工作区出现，系**版本控制之外的写入**（污染窗口 07:37–08:50 UTC，即 #2136 结束后 #2138 开始前；疑似略新于 CI 的本地 5.1 引擎进程在共享工作区 ws_aes6_ue_ci 批量重存），普通 `p4 sync @204479`（have list 视为最新，no-op）与 p4 revert/clean 均未还原 | 同签名第 9 次复发（变体，infra 机制而非提交引入）：#2138 由 GitLab push（PengBo）自动触发失败（Error_UnknownCookFailure, ExitCode=25）；#2139 由 pengbo 手动 Rebuild（参数不变）**未愈**；#2140 由 tonghu（piaotonghu）手动触发且 **ForceBuild=true**（RunUAT 追加 `-Clean`，流水线参数记录在案）后 "is too new" 归零、Cook ExitCode=0、BUILD SUCCESSFUL（#2137 NOT_BUILT 未入组）。引擎四构建恒为 5.1.1-23901901+++UE5+Release-5.1（安装版 C:\Epic\UE_5.1），排除引擎侧变化；#2136 与 #2140 对同一批 GameTest 资产输出相同的 "saved with empty engine version" 警告，佐证 #2140 内容已还原为 depot 状态（≤1008）。修复=管理员操作 + 流水线参数变化，**无修复提交**。本轮评分 6：Info 2（token+路径，无行号）+ Diff 2 + Commit 1（ForceBuild 参数变化+手动触发记录；无 VCS 提交、不直接触及错误对象、无书面"为何修复"）+ Reuse 1（等效强归因链条件②不成立——ForceBuild 与失败资产非同名对应，如实记 0；预防建议 +1）。frontmatter.score=9 为模式页文件级评分（details/ 档位依据），行级评分以结论串与账本为准。预防增量：CI 在 Cook 前对 Project/Content 做 p4 `sync -f` 或 `p4 clean -d`（还原被本地修改的版本文件）；流水线对共享工作区加执行器互斥或专用账号锁定，杜绝工作区被引擎进程就地重存 |
| 2026-08-20 | #2133-2134 → #2136 | EarthArtAsset 457988b「以色列立面Prefab开启碰撞」把 Content/AesAsset/FacadeAsset/Israel/ 下 4 个 DataTable（DT_FacadeAsset_SingleWithDirection_Israel_{PH,PL,RH,RL}.uasset）以 Package Version 1009 保存提交（CI 引擎 1008），连续 2 败（#2135 NOT_BUILT 未入组），各日志 4 条 "is too new"（LogInit 汇总 4 error / 217-216 warning），Cook 阶段 UnrealEditor-Cmd ExitCode=1 → Error_UnknownCookFailure (25) | 同根因第 8 次复发；修复 7d80592「重新用5.1提交： 以色列立面Prefab开启碰撞」——与引入提交同名的变更改用 5.1 引擎重存，#2136 "is too new" 零出现、Success - 0 error(s)、BUILD SUCCESSFUL。#2134(失败)→#2136(成功) 六仓 pin 比对（WdpCamera/UnrealImGui/AesRuntimeCore/AesWorld/EarthArtAsset/51EarthBuilder）两个变化：EarthArtAsset 457988b→7d80592（修复本体）与 AesWorld 0a96b35→2034ddc「aesworld引用EditorScriptingUtilities」——后者经本地 D:/Git/AesWorld `git show` 验证仅触及 AesWorld.uplugin（+4 行 EditorScriptingUtilities 依赖声明，无任何 .uasset），排除后唯一相关变化即 7d80592。归因强度：等效强归因链（排除后唯一 pin 变化 + 提交标题与失败资产「以色列立面」同名对应 + 错误消失）；真实 diff 不可得（本地无 EarthArtAsset 克隆，二进制资产亦无文本 diff）。评分 9：Info 2（token+路径，无行号）+ Diff 2 + Commit 3 + Reuse 2 |
| 2026-08-20 | #1976-1979 → #1980 | P4 主工程内容变更（syncID aes6-ue-runtime-ci-twe_autoci，head 203864→203881 窗口内）把 Project/Content/GameTest/GameMode/GameMode_Vehicle.uasset 以 Package Version 1009 保存提交（CI 引擎 1008） | 同根因第 7 次复发，首见于 P4 管理的主工程 Content（前 6 次均为 git 插件仓库）。Cook 22 错 = 1 条 "is too new" + 21 条下游 BP 编译错误（51EarthBuilder 两个 WBP 的 invalid cast / stale pins / 函数找不到，引用 GameMode_Vehicle 类与 Free/Play/Edit Mode 函数，与前次复发同构级联）。修复亦经 P4：#1979→#1980 七个 git 仓库 pin 完全一致（AesBuilderJenkins/WdpCamera/UnrealImGui/AesRuntimeCore/AesWorld/EarthArtAsset/51EarthBuilder 逐一核对 Checking out Revision），唯一版本控制变化是 p4 sync 203881→203890，#1980 由用户 tonghu 手动触发；#1980 中 "is too new" 与全部 BP 错误零出现、GameMode_Vehicle Cook 成功、BUILD SUCCESSFUL。P4 changelist 明细不可得（本机无 p4 CLI），等效强归因链条件②（变更内容与失败对象同名对应）无法验证，本轮 Reuse 如实记 0（评分 6：Info 2 + Diff 2 + Commit 1 + Reuse 1） |
| 2026-08-19 | #1550-1553 → #1554 | AesWorld e04b8fb44「更新tooltip动图」（2024-08-27 17:13）把 Content/UI 下 37 个资产（TooltipGIF 动图 8 个、DT_TooltipInfo、WBP_Tooltip、DT_ToolBar_*/WBP_BottomTabButton_* 等）以 Package Version 1009 保存提交（CI 引擎 1008），连续 4 败，各日志报 72-78 处 "is too new" 并伴随下游 BP 编译错误（invalid cast / stale pins，随资产修复一并消失） | 同根因第 6 次复发，首见于 AesWorld 仓库（前 5 次为 EarthArtAsset/51EarthBuilder）。修复为两步：9d0825b2「还原错版本提交」字节级回滚全部资产（stat 与 e04b8fb44 完全镜像，如 WBP_BottomTabButton_1 152985↔167213）+ f43f99f「更正引擎版本」用 5.1 引擎重存并更名 TooltipGIF 资产为 T_GIF_*（building→T_GIF_Building 等）；#1554 "is too new" 零出现、Cook ExitCode=0、BUILD SUCCESSFUL。#1553→#1554 七仓 pin 比对（AesBuilderJenkins/WdpCamera/UnrealImGui/AesRuntimeCore/AesWorld/51EarthBuilder/EarthArtAsset）唯一变化即 AesWorld d0b07c2→f43f99f；本地 D:/Git/AesWorld 克隆 git show 验证两个修复提交 36 文件全为二进制 .uasset（0 insertions/deletions，无文本 diff），归因强度：等效强归因链（唯一 pin 变化 f43f99f + 与失败对象文件级同名 + 错误消失） |
| 2026-08-18 | #1173 → #1174 | 51EarthBuilder 60363ff「修改Graphics的单词错误」把 Content/UI/Settings/DT_Settings.uasset（日志全路径 C:/ws_aes6_ue_ci/Project/Plugins/51Hitech/51EarthBuilder/…）以 Package Version 1009 保存提交（CI 引擎 1008） | 同根因第 5 次复发；修复 9f18fd5「重新用5.1提交“修改Graphics的单词错误”」——与引入提交同名的变更改用 5.1 引擎重存，#1174 “is too new” 零出现、BUILD SUCCESSFUL。#1173→#1174 六仓 pin 比对（WdpCamera/UnrealImGui/AesRuntimeCore/AesWorld/EarthArtAsset/51EarthBuilder）唯一变化即 51EarthBuilder 60363ff→9f18fd5；真实 diff 不可得（本地 D:/Git 无 51EarthBuilder 克隆），二进制资产无文本 diff |
| 2026-08-18 | #1127-1129 → #1141 | EarthArtAsset c05ce82「解决“道路替换功能的预览模型显示不均匀”的问题」把 Content/Layer/Asset/DT_InstanceSplineAsset_Lane.uasset（日志全路径 C:/ws_aes6_ue_ci/Project/Plugins/51Hitech/EarthArtAsset/…）以 Package Version 1009 保存提交（CI 引擎 1008）；#1129 追加 f94a9f4「修正高架样式2的车道数」仍未自愈（构建发生于 2024-07-13，包名 ci-0.1.59-240713xxxx） | 同根因第 4 次复发；修复 71c09ab「重新用5.1引擎提交解决“道路替换功能的预览模型显示不均匀”的问题」——与引入提交同名的变更改用 5.1 引擎重存，#1141 “is too new” 零出现、BUILD SUCCESSFUL。窗口内 AesWorld cf49005「更新编辑器矢量材质」经本地 git diff 验证仅触及 M_LineSet/M_PointSet 两个无关材质 |
| 2026-08-18 | #1074-1075 → #1076 | EarthArtAsset baddd2d「恢复地形材质上的道路mask」以 Package Version 1009 保存 M_Terrain.uasset（CI 引擎 1008） | 同根因第 3 次复发；修复 281dfc7 同消息重存，七仓 pin 比对唯一变化，#1076 错误消失 |
| 2026-03-31 | #3877 → #3876 | WBP_DomManager.uasset saved with higher UE version (1008 vs 1013) | 原始记录（见 wiki 原文件） |
| 2026-01-14 | #3763 → #3765 | BP_BuildingGizmo_Height.uasset + WBP_Tips.uasset (1008 vs 1013) | 修复 0a4a089「修复资产版本太新导致打包失败」（见 wiki 原文件） |

原始知识文件（wikiDir，只读）：`//nas.51vr.local/x.public/UE5/ue-llm-wiki/wiki/details/024-asset-version-mismatch.md`
——含引擎版本锁定、资产提交检查、CI 前置检查等团队规范与技术措施全文。
