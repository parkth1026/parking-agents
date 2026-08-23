---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 563-564
fix_build: 565
error_code: LNK2019
score: 8
result: failure:score=8:LNK2019:fix=#565:see=//nas.51vr.local/x.public/UE5/ue-llm-wiki/raw/details/aes6-377-379-LNK2038-boost-typeindex-rtti.md
primary_fix_commit: e0ca35f5
recorded_at: 2026-08-17T08:09:29
---

# LNK2019: AesBuilding→AesEarth 模块合并搬迁丢了 Builder 实现文件——声明在、定义无

## Error Message

（#563，Editor 目标 `UnrealEditor-AesEarth.dll` 链接失败；三个未解析符号同属一个类 `FAesBuilderMarkerProducerBuilder`。符号修饰名从略，完整原文见日志。）

```
Module.AesEarth.2_of_3.cpp.obj : error LNK2019: unresolved external symbol
  "public: __cdecl FAesBuilderMarkerProducerBuilder::FAesBuilderMarkerProducerBuilder(
   class FAesGeoreferencingSystem const &,class FString const &,
   class TSharedPtr<class TAesMarkerCache<class FAesMarkerInfo>,1> const &,class FName const &)"
  referenced in function "public: __cdecl FAesBuildingPayloadManager::FAesBuildingPayloadManager(...)"
Module.AesEarth.2_of_3.cpp.obj : error LNK2019: unresolved external symbol
  "public: virtual __cdecl FAesBuilderMarkerProducerBuilder::~FAesBuilderMarkerProducerBuilder(void)"
Module.AesEarth.2_of_3.cpp.obj : error LNK2019: unresolved external symbol
  "public: class TSharedPtr<class TAesMarkerCache<class FAesMarkerInfo>,1> __cdecl
   FAesBuilderMarkerProducerBuilder::GetMarkerCache(void)const "
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Binaries\Win64\UnrealEditor-AesEarth.dll :
  fatal error LNK1120: 3 unresolved externals
Took 302.62243320000005s to run dotnet.exe, ExitCode=6
AutomationTool exiting with ExitCode=6 (6)
BUILD FAILED
```

日志：`{tmpDir}/logs/fail-aes6-ue-runtime-ci-563.log`（907-920 行）；引擎 UE 5.1。

## Root Cause

AesWorld 仓库 `RefactorAesEarth` 分支做模块结构重构。`e076d9bf2 "重构AesWorld的模块结构"`（xiewei，2024-05-17 00:26）把 `Source/AesBuilding/` 整体并入 `Source/AesEarth/`：头文件 `AesBuilderMarkerProducerBuilder.h` 以纯移动（0 内容改动）搬入 `Source/AesEarth/Private/AesBuilding/Producers/Builder/`，但配对的实现文件 `Source/AesBuilding/Private/Builder/AesBuilderMarkerProducerBuilder.cpp`（28 行）只在旧位置被删除（`git show --stat e076d9bf2` 中该文件 `28 ---`）、新位置未补——迁移不完整，提交即可链接的状态被打破。

UBT 因此从未编译该实现：`FAesBuildingPayloadManager` 构造函数与 `FAesDebugBuilderMarkerProducerBuilder::Build`（都在 AesEarth 模块 unity 块 `Module.AesEarth.2_of_3.cpp.obj` 里）引用的构造/析构/GetMarkerCache 三个符号没有任何 .obj 提供定义 → UnrealEditor-AesEarth.dll 链接 LNK2019 ×3 → LNK1120，ExitCode=6。

#563 与 #564 之间作者补交了缺失实现（`520a00c92 "提交Builder"`，真实 diff 见 Fix 节），#564 起该错误消失——但同一重构的另一问题（boost RTTI 阵营冲突）随即在 UGA.exe 链接时暴露，见 Group Context；最终 CI 整体回滚该分支。

## Fix

真正让 #565 变绿的不是分支上的代码，而是**分支回滚 + 全清重建**：

- **Pin 变更**（修复侧书面证据，#564 与 #565 控制台日志 checkout 行直接可见）：AesWorld 检出引用从 `refs/remotes/origin/RefactorAesEarth @ 7b9b6f882` 切回 `refs/remotes/origin/dev @ e0ca35f5a`。`git merge-base 7b9b6f88 e0ca35f5 = e0ca35f5`——dev@e0ca35f5 是失败分支头的祖先，即整体放弃 RefactorAesEarth 上的 8 个提交（f894d491c "重构AesEarth" … 7b9b6f882 "删除Gitignore"，含模块合并与补交）。其余四个子仓库（AesBuilderJenkins/WdpCamera/UnrealImGui/AesRuntimeCore）三个构建 pin 完全相同。
- **构建参数变更**：#564 的 BuildTarget 无 Clean、BuildCookRun 带 `-NoUBTMakefiles`（增量）；#565 的 BuildTarget 带 `-Clean`（日志可见 "Cleaning UGAEditor and UnrealEditor binaries..."），消除旧 obj 残留。
- 回滚后 dev 上 `Source/AesEarth` 不含任何 boost 引用文件、AesBuilding/AesRoad 模块结构未动：本文件主错误与 Group Context 的 boost 冲突同时消失，#565 全程 0 错误行、`AutomationTool exiting with ExitCode=0`。

针对 #563 主错误的分支内定点修复（后随分支整体回滚，但 diff 直接证明错误机理）：

- **Commit**: `520a00c92` by xiewei（AesWorld，2024-05-17 02:12，#563→#564 之间）
- **Message**: "提交Builder"
- **What changed**（`git show 520a00c92` 真实 diff，新增 28 行实现，节选排版、内容原样）：

```diff
--- /dev/null
+++ b/Source/AesEarth/Private/AesBuilding/Producers/Builder/AesBuilderMarkerProducerBuilder.cpp
@@ -0,0 +1,28 @@
+#include "AesBuilderMarkerProducerBuilder.h"
+
+#include "AesBuilderMarkerProducer.h"
+#include "AesMarkerSystemSettings.h"
+#include "AesMarkerSystemStatics.h"
+#include "AesMarkerSystemInterfaces/IAesMarkerSystem.h"
+
+FAesBuilderMarkerProducerBuilder::FAesBuilderMarkerProducerBuilder(
+	const FAesGeoreferencingSystem& InGeoreference,
+	const FString& InMapName,
+	const FAesMarkerCachePtr& InCache,
+	const FName& InClassificationDependencyName)
+	: Cache(InCache)
+	, ClassificationDependencyName(InClassificationDependencyName)
+	, Georeference(InGeoreference)
+	, MapName(InMapName)
+{
+
+}
+
+FAesBuilderMarkerProducerBuilder::~FAesBuilderMarkerProducerBuilder()
+{
+}
+
+FAesMarkerCachePtr FAesBuilderMarkerProducerBuilder::GetMarkerCache() const
+{
+	return Cache;
+}
```

归因强度：**强**——#563→#564 唯一 pin 变化即 `520a00c92`（补回同名实现文件），三符号错误随之消失；#564→#565 唯一 pin 变化即回滚 dev@e0ca35f5（五仓库逐一比对），全绿。

## How to Reproduce / Detect

- 触发方式：跨模块搬文件时只搬 .h 不搬 .cpp（或漏 `git add` 新位置）——引用方编译通过，链接期才爆 LNK2019。
- grep 关键词：`LNK2019`、`FAesBuilderMarkerProducerBuilder`、`UnrealEditor-AesEarth.dll : fatal error LNK1120`、`ExitCode=6`。
- 特征：同一类的构造/析构/多个成员函数**成组**未解析（= 整个 .cpp 缺失），区别于单个模板实例未解析（= 模板实例化/导出问题）。
- 快速定位：`git log --diff-filter=D --name-only` 圈搬迁区间被删的 .cpp；或对未解析类名 `git grep "<ClassName>::"` 确认仓库里是否还有定义。

## Epic Official Guidance

- **Query**: "UE5.1 C++ link error LNK2019: unresolved external symbol (constructor, destructor and GetMarkerCache of class FAesBuilderMarkerProducerBuilder) referenced in FAesBuildingPayloadManager, when linking UnrealEditor-AesEarth.dll. Cause: during a module merge refactor the header was moved into module AesEarth but the matching .cpp implementation file was accidentally not committed. What causes this and how to detect or prevent losing implementation files when merging Unreal modules?"
- **Answer**（要点）: 头文件向编译器作出"定义在别处"的承诺，而链接器在所有 .obj 中找不到机器码——实现 .cpp 缺失时 UBT 根本不会编译它；模块化构建中还需同步检查 MODULENAME_API 导出宏与消费方 Build.cs 依赖是否随迁移更新。预防：用 `git add -A` 原子提交并在 `git status` 核对每个移动的 .h 配对 .cpp 呈 renamed/new 而非纯 deleted；推送前删 Binaries/Intermediate 做全量 Rebuild，缺文件本地即暴露；CI 对干净同步的源码做链接验证，坏提交进不了主分支；搬迁后全文搜索旧模块导出宏防漏改。
- **References**:
  - Modules - Overview and Structure — https://dev.epicgames.com/community/learning/knowledge-base/GDD9/unreal-engine-modules-overview-and-structure
  - Unreal Engine Modules — https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-modules

## Prevention

- 跨模块搬迁用原子提交：`git add -A` 后核对 `git status`，确保每个移动的 .h 与其 .cpp 在同一提交里成对出现。
- 搬迁/合并模块的提交前，本地删 Binaries/Intermediate 全量重建一次——缺 .cpp 在本地即以 LNK2019 暴露，不必等 CI。
- 大重构（整模块合并）分支在可完整链接前不要触发主 CI 流水线；本例 RefactorAesEarth 连续两个构建暴露两类问题后被整体回滚，分支上的修复提交一并作废。
- CI 回退分支 pin 时配合 `-Clean` 重建，避免旧 obj 与新源码混链（参见 Group Context 中 #564 的 boost ABI 冲突，即增量混链的另一恶果）。

## Warning Trend

| Build | Warnings (warning C\d+) |
|-------|--------------------------|
| #562 (上一 SUCCESS，增量) | 0 |
| #563 (fail) | 1 |
| #564 (fail) | 1 |
| #565 (fix，-Clean 全量) | 4 |

趋势：表面恶化（上一 SUCCESS 0 → fix 4），实为**全清重建的计数回潮而非质量回退**：集中文件 `UnrealImGui/Source/ImGui/Private/ImGuiContextManager.cpp(275)` C4996 strcpy（×2）与 `AesWorld/Source/AesAsset/ThirdParty/boost-1_70_0/include/boost/iterator.hpp(16)` C4996 STL4015 std::iterator 弃用（×2），全部是第三方代码弃用告警；#562 为增量构建（无重编译动作）故 0 条，#565 带 -Clean 重编全部源文件故告警重现。与 #377-379 知识文件中 #376(0)→#380(6) 的模式一致。非本轮修复引入。

## Group Context

同组另一失败模式（#564；主错误 LNK2019 消失后同一重构的下一层问题暴露）：

- **构建**：#564（AesWorld RefactorAesEarth @ `7b9b6f882`）
- **日志签名**：`Module.AesEarth.2_of_3.cpp.obj : error LNK2038: mismatch detected for 'boost__type_index__abi': value 'RTTI is off - typeid() is used only for templates' doesn't match value 'RTTI is used' in AesRoofAsset.cpp.obj`；`error LNK2019: unresolved external symbol "void __cdecl boost::throw_exception(class stdext::exception const&)"`；`C:\ws_aes6_ue_ci\Project\Binaries\Win64\UGA.exe : fatal error LNK1120: 1 unresolved externals`（fail-aes6-ue-runtime-ci-564.log 942-951 行）
- **归因强度**：引（重复模式，已落账 `:see=`）——与 `aes6-377-379-LNK2038-boost-typeindex-rtti.md` 同错误码、同根因类（boost::type_index 要求同链 obj 的 RTTI 阵营一致，该文件已含完整 Epic 指导，本轮按规则跳过 Epic 重复查询）。本轮变体方向相反：#377-379 是 AesAsset 接入 CGAL 后**缺** `bUseRTTI` 标志；本轮是重构把**自带** `bUseRTTI=true; bEnableExceptions=true; bUseUnity=false` 的 AesRoad 模块（dev 上 AesRoad.Build.cs 原始设置）整体并入默认设置（RTTI 关/异常关/unity 开）的 AesEarth——boost 代码 `AesBuilder_ModularRoad.cpp`（含 boost/geometry rtree）落入 unity 块 `Module.AesEarth.2_of_3.cpp.obj` 报 "RTTI is off"，与 AesAsset（#380 起 `bUseRTTI=true`）的 `AesRoofAsset.cpp.obj`（"RTTI is used"）冲突，同时异常关闭侧的 `boost::throw_exception` 无定义 → LNK2019。已在该既有文件追加 Recurrences 行。
- #563 未到达此步：Editor 目标链接先死于本文件主错误。
