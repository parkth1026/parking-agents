---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 377-379
fix_build: 380
error_code: LNK2038
score: 8
result: failure:score=8:LNK2038:fix=#380
primary_fix_commit: 36dfb6e27
recorded_at: 2026-08-16T23:11:10
---

# LNK2038: boost__type_index__abi 不匹配——AesAsset 接入 CGAL/Boost 后模块缺少 bUseRTTI

## Error Message

（源日志为 GBK 编码，中文部分乱码；以下按标准 MSVC 英文句式回写，英文标识符原样保留。）

```
Module.Niagara.10_of_13.cpp.obj : error LNK2038: mismatch detected for 'boost__type_index__abi':
  value 'RTTI is used' doesn't match value 'RTTI is off - typeid() is used only for templates' (AesRoofAsset.cpp.obj)
libopenvdb.lib(Archive.obj) : error LNK2038: mismatch detected for 'boost__type_index__abi': ... (同上，共 13 个 openvdb obj)
AesBuilder_ModularRoad.cpp.obj : error LNK2038: mismatch detected for 'boost__type_index__abi': ... (仅 #377/#378，#379 消失)
C:\ws_aes6_ue_ci\Project\Binaries\Win64\UGA.exe : fatal error LNK1319: 16 mismatches detected (#379 为 15)
Took 246.9766799s to run dotnet.exe, ExitCode=6
AutomationTool exiting with ExitCode=6 (6)
BUILD FAILED
```

三个失败构建（#377/#378/#379）同一模式；UBT 日志：`C:\Users\Administrator\AppData\Roaming\Unreal Engine\AutomationTool\Logs\C+Epic+UE_5.1\UBT-UGA-Win64-Development.txt`（引擎 UE 5.1）。

## Root Cause

AesWorld 仓库在 #376→#377 之间合入了一批资产生成重构提交（区间 `3a84592..261e1df`），其中 `cde4adcb4 "1.AesAsset接入CGAL 2.添加坡屋顶生成算法"` 让 **AesAsset 模块**（含 `Source/AesAsset/Private/Asset/AesRoofAsset.cpp`）开始包含 CGAL/Boost 头。boost::type_index 在每个包含它的编译单元里发出 `/FAILIFMISMATCH` 链接器指令（键 `boost__type_index__abi`）：

- **RTTI 开阵营**：引擎 Niagara 模块 obj、第三方 `libopenvdb.lib`、AesRoad 模块的 `AesBuilder_ModularRoad.cpp.obj`（AesRoad 自 `7b7cf1ffe`（2024-01-25，"aesroad 打包不过的问题"）起就带 `bUseRTTI = true`）——值为 `RTTI is used`；
- **RTTI 关阵营**：AesAsset 模块按 UBT 默认（`bUseRTTI=false`，即 `/GR-`）编译，值为 `RTTI is off - typeid() is used only for templates`。

两阵营 obj 链接进同一个 `UGA.exe`，LNK2038 逐对报不匹配，汇总为 LNK1319，打包失败。

**中间的错误方向尝试**：#379（AesWorld `9c6b8cab`，"删除AesRoad中的bUseRTTI"）把 AesRoad 拉到 RTTI 关阵营，mismatch 从 16 降到 15（`AesBuilder_ModularRoad.cpp.obj` 一条消失），但根因（AesRoofAsset.cpp.obj 对抗整个 RTTI 开阵营）未动，依旧失败。

## Fix

**Commit**: `36dfb6e2755a378f9d11ca84ecde2b4340a37221`（AesWorld 仓库，build #380 检出于 `refs/remotes/origin/dev`）
**Author**: PengBo <pb763396199@qq.com>
**Message**: "开启AesAsest和AesRoad的bUseRTTI"
**What changed**（`git show` 真实 diff，两文件各 +1 行）：

```diff
--- a/Source/AesAsset/AesAsset.Build.cs
+++ b/Source/AesAsset/AesAsset.Build.cs
@@ -6,6 +6,7 @@ public class AesAsset : ModuleRules
     {
         PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;
         bUseUnity = false;
+        bUseRTTI = true;
         bEnableExceptions = true;
```

```diff
--- a/Source/AesRoad/AesRoad.Build.cs
+++ b/Source/AesRoad/AesRoad.Build.cs
@@ -9,6 +9,7 @@ public class AesRoad : ModuleRules
 		PrivatePCHHeaderFile = "Private/AesRoadPrivatePCH.h";
 		bUseUnity = false;
+		bUseRTTI = true;
 		bEnableExceptions = true;
```

即：把 AesAsset（真正的错误源头模块）与 AesRoad（回滚 #379 的错误删除）都对齐到 RTTI 开阵营，与引擎/第三方库一致。#380 全链接 0 错误行，BUILD SUCCESSFUL。

归因强度：**强**——失败区间（376→377）与修复区间（379→380）五个子仓库中均只有 AesWorld 变化，且 diff 内容与错误键 `boost__type_index__abi` 直接对应。

## How to Reproduce / Detect

- 在任意模块引入包含 boost::type_index 的头（CGAL、openvdb、直接 include boost 均可），而该模块 `bUseRTTI=false`，再与 RTTI 开的 obj（引擎/第三方库）链接成可执行文件。
- grep 关键词：`LNK2038`、`boost__type_index__abi`、`RTTI is off - typeid() is used only for templates`、`LNK1319`。
- 特征：报错的"少数派" obj 是刚接入 Boost 系头文件的游戏模块（本例 `AesRoofAsset.cpp.obj`），"多数派"是 Niagara/第三方库。

## Epic Official Guidance

- **Query**: "UE5.1 link error LNK2038: mismatch detected for 'boost__type_index__abi': value 'RTTI is used' doesn't match value 'RTTI is off - typeid() is used only for templates' when linking the game executable. A game module compiled with UE default bUseRTTI=false includes CGAL/boost headers (boost::type_index), while engine Niagara module objects and a third-party libopenvdb.lib in the same link are compiled with RTTI enabled. What causes this linker mismatch and how to fix it properly in UnrealBuildTool module rules?"
- **Answer**（要点）: UE 默认关闭 RTTI（用 UClass/Cast<T> 自有反射替代），而 Boost/CGAL 依赖标准 RTTI 与 dynamic_cast；模块用 `/GR-` 编译、第三方库用 `/GR` 编译，链接器元数据冲突即报 LNK2038。正确修法是在**包含这些头的模块** Build.cs 里加 `bUseRTTI = true`，CGAL/Boost 通常还需 `bEnableExceptions = true`；include 建议用 `THIRD_PARTY_INCLUDES_START/END` 包裹以隔离 UE 编译环境。若多个互依赖模块都含 CGAL，模块级修不动时可升级到 Target.cs 的 `bForceEnableRTTI = true`（代价是引擎级二进制变大）。改 Build.cs 标志后建议 Clean 并删 Binaries/Intermediate，UBT 对 RTTI 标志变化的 obj 失效有时不彻底。
- **References**:
  - Integrating Third-Party Libraries into Unreal Engine — https://dev.epicgames.com/documentation/unreal-engine/integrating-third-party-libraries-into-unreal-engine
  - Set Build Options Locally (BuildConfiguration.xml) — https://dev.epicgames.com/community/learning/knowledge-base/GD59/unreal-engine-set-build-options-locally

## Prevention

- 给游戏模块接入 CGAL/Boost/openvdb 等 RTTI 依赖库时，同步检查该模块 Build.cs：`bUseRTTI = true` + `bEnableExceptions = true`（本仓库已有先例 `7b7cf1ffe`，AesRoad 一月打包失败即同源问题，本次 AesAsset 重蹈覆辙）。
- 长期方案是隔离而非对齐：本仓库后来的 `fc097def6 "将CGAL库迁移到EarthCGAL模块，避免使用RTTI导致的各种问题"` 把 CGAL 挪进专用模块，不再要求游戏模块全局开 RTTI；新集成应优先走这条路（配合 `4e6d5fb81 "Boost库改为引用UE自身的库"` 统一 Boost 来源）。
- 修此类错误时先判断"多数派"是谁：把少数派模块对齐到多数派（本例 #379 反向对齐导致只少一条 mismatch 而不通过）。
- 改动 Build.cs 编译标志后 Clean/删 Intermediate，避免旧 obj 残留造成误判。

## Warning Trend

| Build | warnings C\d+ 计数 | 说明 |
|-------|------------------|------|
| #376（上一 SUCCESS） | 0 | — |
| #380（修复构建） | 6 | 集中：`Source/AesRoad/Private/Producers/Builder/AesBuilder_ModularRoad.cpp(1144)` `bHasEndMesh`、`(1145)` `bHasStartMesh` 两处 C4701 可能未初始化局部变量（各 ×2）；`Engine/Source/ThirdParty/Boost/boost-1_70_0/include/boost/iterator.hpp(16)` C4996 STL4015 std::iterator 弃用（×2） |

新增警告源于该区间新编译的 AesRoad 代码与 Boost 头；C4701 建议对 `bHasStartMesh/bHasEndMesh` 做初始化，属低危代码质量项，与本轮链接错误的修复无冲突。

## Recurrences
| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-08-17 | #563-564 → #565 | RefactorAesEarth 分支 `e076d9bf2` 把自带 `bUseRTTI=true; bEnableExceptions=true; bUseUnity=false` 的 AesRoad 模块整体并入默认设置（RTTI 关/异常关/unity 开）的 AesEarth，boost 代码 `AesBuilder_ModularRoad.cpp` 落入 `Module.AesEarth.2_of_3.cpp.obj`（"RTTI is off"）与 AesRoofAsset.cpp.obj（"RTTI is used"）冲突，并伴 `boost::throw_exception` LNK2019 | 方向与首例相反（首例缺标志，本轮标志随模块合并丢失）；修复=CI 回滚 AesWorld pin 至 dev@e0ca35f5 + `-Clean`；详见 `aes6-563-564-LNK2019-builder-impl-lost-in-module-merge.md`（同组 #563 主错误为搬迁丢 .cpp 的 LNK2019） |
| 2026-08-17 | #566,568-586 → #587（#567 NOT_BUILT） | RefactorAesEarth 在 #565 回滚后四天被整体合回 dev（`e0ca35f5..9f0ef655` 含 `f894d491c..7b9b6f882` 全部重构提交），上轮记录的模块合并冲突原样复发：`Module.AesEarth.2_of_3.cpp.obj`（"RTTI is off"）× `AesRoofAsset.cpp.obj`（"RTTI is used"）+ `boost::throw_exception` LNK2019 → `UGA.exe : fatal error LNK1120`（#568/#575 签名，仅 1 条 mismatch）；#580 起 `e34581d85 "关闭 rtti 解决打包问题"`（05-17 19:26，piaotonghu）把 AesAsset 的 `bUseRTTI = true` 注释成 `// bUseRTTI = true;`，方向翻回首例阵营（`AesRoofAsset.cpp.obj` "RTTI is off" × Niagara/libopenvdb "RTTI is used" ×15，#580/#585/#586 签名）——重演 #379 的反向对齐错误。#566 为组内变体：Editor 目标成功后 UGA 的 WriteMetadata/Link 两动作直接 cancelled（ExitCode=6），LNK 细节未上控制台（只留 "See log for more details"） | 修复=同窗口 4 提交（#586 f08a5ad3 → #587 942caad0），主修复 `4e6d5fb81 "Boost库改为引用UE自身的库"`：恢复 `bUseRTTI = true` + 从 `AesAsset.Build.cs` 删除自带 `ThirdParty/boost-1_70_0/include` 路径、模块依赖改加引擎 `"Boost"`（同时删除 CGAL 内嵌 boost_old 头），统一 boost ABI 来源使阵营冲突无从谈起；伴 `4c19ec2ca "添加AesEarthEntity模块"`、`dcf4bdbec` 合并、`942caad01 "修复编辑器编译错误"`（2 个 PayloadManager .cpp）。#587 全绿（BUILD SUCCESSFUL，警告 w=2）。教训：**回滚≠修复**——分支四天后重新合入 dev 即复发，两次临时手段（#565 回滚、`e34581d85` 反向关 RTTI）都没消掉根因，最终靠 Prevention 预言的"统一 Boost 来源"落地解决 |
| 2026-08-17 | #846-852 → #853 | `fa6f78c36 "修复一些Linux编译错误的问题"`（06-11 16:00，xiewei；经 06-13 LinuxBuild 合并 `5c3818749/72691dde6` 进入 #846 pin `e068cb2`）为修 Linux 编译，把 `AesAsset.Build.cs`（`PCHUsage/bUseUnity/bUseRTTI` 三行）与 `AesEarth.Build.cs`（`bUseRTTI/bUseUnity` 两行）成对注释，Win64 CI 上两模块同时掉回 RTTI 关阵营。两段签名：#846-850 重演首例（`Module.AesAsset.3_of_3.cpp.obj` "RTTI is off" × Niagara.10/13_of_13 + libopenvdb ×13 → LNK1319 15 mismatches）；`1c8a7aa "尝试在AesAsset.Build.cs中添加平台宏"`（06-14 11:37）以 `if (Target.Platform == UnrealTargetPlatform.Win64)` 恢复 AesAsset 三行后，#851-852 阵营翻转成 `Module.AesEarth.2/3_of_3.cpp.obj`（"RTTI is off"）× `AesRoofAsset.cpp.obj`（"RTTI is used"，AesAsset 恢复后 bUseUnity=false 单独编译）→ LNK1319 2 mismatches | 第三次复发，评分 9/10。终修 `84e0768 "AesEarth.Build.cs 添加平台宏"`（06-14 13:37，xiewei）+ merge `b2d05ef`：同款 Win64 平台宏恢复 AesEarth 两行，#853 全绿（BUILD SUCCESSFUL，w=0；fail #846 w=2）。两段失败+两步修复=单一根因（无平台守卫地注释 RTTI 标志）。与 #566-586 轮 `e34581d85` 同源动机（修另一平台时顺手关 RTTI），Prevention 再次应验；本轮修复首次落地**分平台 RTTI**（Linux 关、Win64 开），是"平台宏守卫"路线对"统一 Boost 来源"路线的补充 |
