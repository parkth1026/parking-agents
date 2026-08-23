---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 1876-1880
fix_build: 1881
error_code: MissingPlugin
score: 9
result: failure:score=9:MissingPlugin:fix=#1881
primary_fix_commit: 1898298
recorded_at: 2026-08-20T01:11:42
---

# MissingPlugin: builder 引用清单缺 ChaosVehiclesPlugin → 车辆蓝图编译级联 → Cook ExitCode=25

`PluginsGit` 参数在 #1876 新接入 51EarthBuilder 插件后，烹煮范围扩到依赖引擎插件
ChaosVehiclesPlugin 的车辆内容（DD_Vehicles_Advanced / CitySampleVehicles 共 1717 个资产），
而管线会按 builder 的"引用插件清单"重置 UGA.uproject 的 Plugins 数组——当时清单里没有
ChaosVehiclesPlugin，引擎车辆插件未启用 → `/Script/ChaosVehicles` 脚本包解析失败 →
20+ 个车辆蓝图编译错误级联（#1876 共 1088 error）→ Cook 命令行 ExitCode=25
(Error_UnknownCookFailure) 连续失败 4 次；builder 引用清单补上该插件后 #1881 全绿。

## Error Message

#1876/#1878/#1880 三个同型失败构建同一签名（错误计数 1088 / 1077 / 1069）：

```text
LogLinker: Warning: [AssetLog] C:\ws_aes6_ue_ci\Project\Content\DD_Vehicles_Advanced\Blueprints\Vehicles\Wheels\Bikes\BP_BikeNoWheel.uasset: VerifyImport: Failed to find script package for import object 'Package /Script/ChaosVehicles'
LogBlueprint: Error: [Compiler] In use pin  Vehicle  no longer exists on node  Get . Please refresh node or break links to remove pin. from Source: /Game/DD_Vehicles_Advanced/Animations/Mannequin/ABP_ThirdP_Rider.ABP_ThirdP_Rider
LogBlueprint: Error: [Compiler] Could not find a function named "GetForwardSpeed" in 'ABP_ThirdP_Rider'.
LogInit: Display: Failure - 1088 error(s), 8962 warning(s)
ERROR: Cook failed.
AutomationTool exiting with ExitCode=25 (Error_UnknownCookFailure)
```

错误按资产分布（`from Source:` 计数）：BP_WheelsConfig 192、BP_Seat 180、
ABP_ThirdP_Advanced(Mannequin) 141、ABP_ThirdP_Advanced(Mannequin_UE5) 112 等共 20+ 资产，
全部位于 `/Game/DD_Vehicles_Advanced/`。次级簇：`/51EarthBuilder/UI/NewMap/WBP_MapList`
15 条（"This cast has an invalid target type (was the class deleted without a redirect?)" +
`Failed to load '/AesWorld/UI/BPI_GridItem'`），随同一修复消失，判定为同一加载失败状态下的
级联症状。无任何 error Cxxxx 行——C++ 编译阶段全绿，失败纯在 Cook 的蓝图编译期。

## Root Cause

引入侧（#1874 SUCCESS → #1876 FAILURE 的唯一差异）：job 参数 `PluginsGit` 从 5 个仓库
变为 6 个——新增 `51EarthBuilder.git dev`（#1876 日志可见 `Before: No Plugin: ...51EarthBuilder\.git\index`
全新克隆）。builder 接入带来两个后果：

1. 烹煮范围从 3468 个资产扩到 9114 个，新增 DD_Vehicles_Advanced（739）与
   CitySampleVehicles（978）——这批内容依赖引擎插件 ChaosVehiclesPlugin
   （`/Script/ChaosVehicles`，UE5.1 位于 `Engine/Plugins/Experimental/ChaosVehiclesPlugin`）；
2. 流水线 "Prepare uproject" 阶段按 builder 的引用插件清单**重置** UGA.uproject 的
   Plugins 数组（日志回显 `"Plugins": [...] matched, will be replace`）。当时 51EarthBuilder
   的引用清单只有 AesWorld / EarthArtAsset / EarthAdvancedKit，**不含 ChaosVehiclesPlugin**。

于是引擎车辆插件未启用：Linker 对车辆蓝图 import 的 `/Script/ChaosVehicles` 包
VerifyImport 失败、import 指针置空；蓝图编译期找不到对应类，节点 pin 全部失配，
产生 1000+ 条 "In use pin no longer exists / Could not find a function" 级联错误；
Cook 命令行把蓝图编译失败汇总为 ExitCode=1，AutomationTool 报
ExitCode=25 (Error_UnknownCookFailure)。#1880 曾试图用 Revert "修正NepMap界面的按键排序"
（0968f1c）自愈，无效——问题不在内容提交，而在 builder 的引用插件清单。

家族定位：与 `aes6-3-9-MissingPlugin-unreal-imgui-missing-from-ci-workspace.md`（代码侧新增
依赖而清单没跟上，UBT 期 ExitCode=6）和
`aes6-1193-1206-MissingPlugin-earthbuilder-removed-from-pluginsgit.md`（清单侧删行而工程
ini 仍引用，Cook 期类加载回退 ExitCode=25）同属"插件清单与工程需求脱节"家族的**第三个
方向**：清单重置机制引入了新构建项，而其引用清单未覆盖烹煮内容的引擎插件依赖。
签名与上两例不同，故另立本文件，token 复用 MissingPlugin。

## Fix

修复 = 51EarthBuilder 提交 `1898298`（dev 分支）把 ChaosVehiclesPlugin 加入 builder 的
引用插件清单。

- **Commit**: 1898298（51EarthBuilder dev；作者不可得——changeSet API 为空、控制台未回显作者）
- **Message**: "先让builder 引用 vehicle， 因为管线会重置 引用插件list"
- **What changed**: builder 引用清单加入 vehicle 引擎插件，使管线重置 UGA.uproject
  Plugins 数组时保留 ChaosVehiclesPlugin。直接证据：#1881 "Prepare uproject" 阶段回显
  `"Plugins": [ { "Name": "ChaosVehiclesPlugin", "Enabled": true } ] matched, will be replace`，
  随后引擎日志 `LogPackageName: Mount point added: '../../Plugins/Experimental/ChaosVehiclesPlugin/Content/'`，
  车辆内容（739 + 978 资产）全部烹煮成功，`Success - 0 error(s), 188 warning(s)`。
- **归因强度：等效强归因链（唯一 pin 变化 0968f1c→1898298 + 与失败对象同名 + 错误消失）**
  - ① 相邻失败→成功对 #1880 vs #1881：六个插件仓库 pin 中五个完全相同
    （WdpCamera 212c1f1 / UnrealImGui 493d166 / AesRuntimeCore 8e8df11 / AesWorld f2d057c /
    EarthArtAsset a31c0dd），唯一变化是 51EarthBuilder 0968f1c → 1898298；
  - ② 变更对象与失败对象同名对应：提交标题 "builder 引用 vehicle" ↔ 缺失的
    ChaosVehiclesPlugin 引用（报错的 `/Script/ChaosVehicles` 脚本包）；中间 pin 0968f1c
    （Revert）已被 #1880 实测为仍失败，排除其承担因果；
  - ③ 错误在 #1881 消失（蓝图错误 0、Cook/UnrealPak 全部 ExitCode=0）。
- 真实 diff 不可得：本地 `{gitRepos}`（D:/Git）无 51EarthBuilder 克隆，GitLab 匿名读取
  需凭据；以两次构建控制台回显（"Prepare uproject" 替换清单 + 插件挂载点）为书面证据，
  均可从 Jenkins consoleText 复取。

## How to Reproduce / Detect

- grep 日志：`VerifyImport: Failed to find script package` / `no longer exists on node` /
  `Could not find a function named` / `Error_UnknownCookFailure` / `ChaosVehicles`
- 特征：C++ 编译阶段全绿（无 error Cxxxx），Cook 期蓝图编译错误 1000+ 条且按资产聚集在
  同一内容包；错误资产引用的 `/Script/{Plugin}.*` 在 "Prepare uproject" 替换后的清单里找不到
- 排查顺序：先看本构建 `Plugins: ...`（企业微信通知块）与上一 SUCCESS 比对哪个仓库新增/
  变化；再看 "Prepare uproject" 回显的替换清单是否覆盖错误资产依赖的引擎插件；
  最后数 `Cooking /Game/...` 行确认烹煮范围是否扩大
- 本地复现：从 .uproject 的 Plugins 数组去掉 ChaosVehiclesPlugin 后对含
  DD_Vehicles_Advanced 的地图跑 Cook 命令行，即可得到同签名级联

## Epic Official Guidance

- **Query**: "UE5.1 CI cook commandlet fails with Error_UnknownCookFailure (editor ExitCode=1,
  AutomationTool ExitCode=25). Vehicle content blueprints log Blueprint compiler errors like
  'In use pin Vehicle no longer exists on node Get', 'Could not find a function named
  GetForwardSpeed', and linker warnings 'VerifyImport: Failed to find script package for
  import object Package /Script/ChaosVehicles' — because ChaosVehiclesPlugin was not enabled
  in the .uproject plugin list while the content still references its classes. Why does a
  disabled engine plugin produce this blueprint compile cascade during cook instead of a
  clear missing-plugin error, and how to detect or prevent this in CI?"
- **Answer** (Epic UE assistant, 要点):
  - 级联机制：Cook 命令行加载依赖链上每个资产；插件禁用时其 Script 包不进内存，Linker
    对 import 记 VerifyImport 警告但**不当即致命**，import 指针留空；蓝图必须编译出字节码，
    编译器遇到引用空类的节点（如 Get Forward Speed）找不到 pin/函数，产生级联错误；
    Editor 汇总 ExitCode 1，UAT 翻译成 ExitCode 25（Error_UnknownCookFailure 是 cook 期
    未处理错误的 catch-all，不含"哪个插件缺失"信息）。
  - CI 预防分层：① 实时扫日志，`VerifyImport: Failed to find script package` 一出现立即
    终止（该警告在首批资产加载时就出现，不必等数小时 cook 跑完）；② cook 前跑
    `UnrealEditor-Cmd.exe <project> -run=DataValidation -ValidationErrorsAreFatal`
    （需启用 Data Validation 插件）；③ 用 Asset Registry 依赖审计：遍历蓝图资产的
    dependencies，凡指向 `/Script/{Plugin}` 的核对 .uproject 中该插件 Enabled，缺失即
    fatal；④ UE5.1+ 可用 Project Settings 的 Asset Referencing Policy 限制内容域对插件的
    引用；⑤ 给 UAT 加 `-WarningsAsErrors`，让初始 VerifyImport 警告直接阻断流程。
- **References**:
  - How to Set up Vehicles — https://dev.epicgames.com/documentation/unreal-engine/how-to-set-up-vehicles-in-unreal-engine
  - Taking the Pain Out of Engine Upgrades | Unreal Fest Orlando 2025 — https://dev.epicgames.com/community/learning/talks-and-demos/7Knn/unreal-engine-taking-the-pain-out-of-engine-upgrades-unreal-fest-orlando-2025

## Prevention

- 接入新构建项（如 51EarthBuilder）或扩大烹煮范围前，先盘点内容依赖的引擎/市场插件，
  把它们同步进 builder 的引用清单——"重置引用插件清单"的管线里，清单就是唯一事实源
  （本家族三个方向的事故都源于清单与实际需求脱节，双向都出过）
- 管线侧加预检：Prepare uproject 替换 Plugins 数组后，用 Asset Registry（或
  DataValidation commandlet）校验待烹煮内容依赖的 `/Script/{Plugin}.*` 均已启用，
  缺失即快速失败并点名插件——比 Cook 期 1000+ 条级联错误早且可读
- 低成本止血：把 `VerifyImport: Failed to find script package` 配置为 CI 日志致命信号
  （Epic Tier 1），或 UAT 加 `-WarningsAsErrors`

## Warning Trend

| Build | Warnings |
|-------|----------|
| #1876 (fail) | 8962 |
| #1881 (fix)  | 188 |

趋势：改善（-8774，约 -98%）。计数取自命令行自身汇总行（`Failure - 1088 error(s),
8962 warning(s)` vs `Success - 0 error(s), 188 warning(s)`）；标准编译器警告计数
（`warning C\d+:|warning CS\d+:` 行）为 272 → 0——fix 构建为增量编译（仅 4 个动作），
该口径参考意义有限，以命令行汇总为准。fail 构建 8962 条警告远超正常水位，与插件缺失
状态相关（资产加载失败引发大量 Linker 噪声），修复后回落，正面趋势。

## Group Context（同对其它失败模式，fix 同为 #1881）

- **#1877 — Live Coding 残留进程（infra）**: UBT 阶段即失败，
  `Unable to build while Live Coding is active. Exit the editor and game, or press Ctrl+Alt+F11`
  （ExitCode=6）——CI agent 上残留编辑器/Live Coding 会话锁住构建，与代码和插件清单无关。
  签名：`Unable to build while Live Coding is active`。归因强度：infra，不另立文件。
- **#1879 — 流水线 JVM OOM（infra）**: `java.lang.OutOfMemoryError: Java heap space`，
  日志仅 197 字节即终止。已有 token `PipelineJvmOOM`（见
  `aes6-605-PipelineJvmOOM-gc-overhead-p4-populate.md`）覆盖此模式，不另立文件。
- **#1878 — 主模式重复**: `Rebuilds build #1877`，同 pin（51EarthBuilder 5ca3e058），
  1077 错误同签名。
