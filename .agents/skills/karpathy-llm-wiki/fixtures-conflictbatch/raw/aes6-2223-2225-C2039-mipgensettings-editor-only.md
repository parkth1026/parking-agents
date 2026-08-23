---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 2223-2225
fix_build: 2226
error_code: C2039
score: 10
result: failure:score=10:C2039:fix=#2226
primary_fix_commit: 5b08a232d
recorded_at: 2026-08-21T01:07:03
---

# C2039: 'MipGenSettings' is not a member of 'UTexture2D'（编辑器专属属性在打包构建中被剥离）

## Error Message

三个连续失败构建（#2223 / #2224 / #2225，2024-12-17 16:29–17:10）同一行、同一错误：

```
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\AesEarth\Private\AesVegetation\Producers\AesVegetationMarkerProducer.cpp(186): error C2039: 'MipGenSettings': is not a member of 'UTexture2D'
BUILD FAILED: Command failed (Result:1): xgConsole.exe ... UAT_XGE.xml
AutomationTool exiting with ExitCode=1 (Error_Unknown)
```

引擎版本 UE 5.1（日志路径 `C+Epic+UE_5.1`），任务为 runtime 打包 CI。

## Root Cause

**引入侧（culprit）**：提交 `af322e181`（"更新Shrubs散布"，即 #2223–#2225 的 AesWorld dev pin）在 `FAesVegetationMarkerProducer` 构造函数中新增了对运行时纹理的初始化，其中无条件访问了编辑器专属属性：

```cpp
ShrubsTexture->CompressionSettings = TextureCompressionSettings::TC_VectorDisplacementmap;
ShrubsTexture->MipGenSettings = TextureMipGenSettings::TMGS_NoMipmaps;   // ← 第 186 行
```

**为什么编辑器能编译、打包 CI 编不过**：UE 5.1 中 `UTexture::MipGenSettings` 声明在 `Engine/Classes/Engine/Texture.h` 的 `#if WITH_EDITORONLY_DATA` 块内——Mip 生成策略只对 Cooker 有意义，mip 链在打包时已烘焙进资产，运行时不需要（也不携带）这份元数据。编辑器目标 `WITH_EDITORONLY_DATA=1`，成员存在，编译通过（开发者本地验证正常）；runtime/打包目标 `WITH_EDITORONLY_DATA=0`，成员被物理剥离，编译器报 C2039。这是典型的"只在打包目标暴露的编辑器 API 泄漏"，作者在编辑器里验证后直接合入，由 runtime CI 拦下。

## Fix

- **Commit**: `5b08a232d` by chenwenjie (2024-12-17 17:20 +0800)
- **Message**: "修复打包不过问题"
- **What changed**: 把 `MipGenSettings` 访问包进 `#if WITH_EDITOR` 守卫；非编辑器构建改用运行时可用的 `MipLoadOptions = ETextureMipLoadOptions::OnlyFirstMip` 达成同等"只留第一层 mip"的意图。
- **归因强度**：强（真实 diff，`git show 5b08a232d`）。#2225→#2226 八个检出 pin 中唯一变化即 AesWorld `af322e18`→`5b08a23`，提交直接修改错误文件第 186 行，#2226 错误消失。

`git show 5b08a232d --unified=5`（AesWorld 仓库，路径 `Source/AesEarth/Private/AesVegetation/Producers/AesVegetationMarkerProducer.cpp`）：

```diff
 	if (!ShrubsTexture)
 	{
 		UE_LOG(LogTemp, Error, TEXT("Failed to get RHI texture."));
 		return;
 	}
-
 	ShrubsTexture->CompressionSettings = TextureCompressionSettings::TC_VectorDisplacementmap;
+#if WITH_EDITOR
 	ShrubsTexture->MipGenSettings = TextureMipGenSettings::TMGS_NoMipmaps;
+#else
+	ShrubsTexture->MipLoadOptions = ETextureMipLoadOptions::OnlyFirstMip;
+
+#endif //
 	ShrubsTexture->SRGB = false;
 	ShrubsTexture->UpdateResource();
```

修复后 #2226（2024-12-17 17:1x 后）编译零错误，打包通过。

## How to Reproduce / Detect

- 触发条件：插件代码无条件访问 `UTexture`/`UTexture2D` 的编辑器专属成员（`MipGenSettings`、`CompressionNoMipmaps` 等 WITH_EDITORONLY_DATA 成员），编辑器目标编译通过、打包/runtime 目标必炸。
- grep 关键词（扫源码预防）：`->MipGenSettings`、`MipGenSettings =`、`WITH_EDITORONLY_DATA`；扫日志定位：`error C2039` + `MipGenSettings`。
- 判别特征：错误**只在 runtime/打包 CI 出现**而编辑器与开发同事本地全绿——出现该组合时优先怀疑编辑器 API 泄漏。

## Epic Official Guidance

- **Query**: "UE5.1 error C2039: 'MipGenSettings' is not a member of 'UTexture2D' when building packaged target, works in editor. Why and how to fix?"
- **Answer**（Epic UE 助手，2026-08-21 查询；首次请求 SSL 失败，重试成功）：`MipGenSettings` 及许多纹理压缩/生成设置属性属于 **Editor-Only Data**，在 UE 5.1 引擎源码（`Texture.h`）中包裹于 `#if WITH_EDITORONLY_DATA`。编辑器构建中该宏为真、变量存在；打包/Shipping 构建中为假，变量在编译期被物理剥离以缩减运行时内存。修复即用预处理器守卫包裹访问（Epic 示例用 `#if WITH_EDITORONLY_DATA`，与本修复的 `#if WITH_EDITOR` 意图一致）。若运行时逻辑确需纹理分类信息，Epic 建议改用运行时可用的替代：`LODGroup`（TextureGroup 分类）、自建 DataAsset/DataTable 存元数据、或 `UAssetUserData`。验证技巧：在 IDE 切到 **Development（非 Development Editor）** 配置编译即可在打包前提前暴露此类错误。
- **References**:
  - Texture Asset Editor — https://dev.epicgames.com/documentation/unreal-engine/texture-asset-editor-in-unreal-engine
  - Lifecycle of a Texture in Unreal Engine — https://dev.epicgames.com/community/learning/tutorials/vEyw/lifecycle-of-a-texture-in-unreal-engine-for-virtual-production

## Prevention

- 访问 `WITH_EDITORONLY_DATA` 成员（`MipGenSettings` 等）必须就地加 `#if WITH_EDITOR(ONLY_DATA)` 守卫，并在 `#else` 分支给出运行时等价物（本例 `MipLoadOptions=OnlyFirstMip`）或明确留空注释。
- 提交前用 **Development / Shipping 配置**（而非 Development Editor）编译一次插件，可在本地提前拦截"编辑器 API 泄漏"，不必等 runtime CI 爆红。
- 对运行时需要的纹理属性，优先使用运行时可用的 API（`LODGroup`、`MipLoadOptions`、`SRGB`、`Filter`），编辑器专属属性只用于 Cook 流程。

## Warning Trend

| Build | Warnings |
|-------|----------|
| #2223 (fail) | 4 |
| #2224 (fail) | 2 |
| #2225 (fail) | 2 |
| #2226 (fix)  | 4 |

趋势：表面恶化（fix 4 vs fail-2225 2，+100%），实为计数口径差异——四个数字全部是**同一文件同一两条** C4996 弃用警告（`AesVegetationMarkerProducer.cpp` 的 `UTexture2D::PlatformData` 直接访问，建议改用 `GetPlatformData()/SetPlatformData()`；#2223/#2226 日志中该文件被编译两遍，两条各计两次）。修复提交未引入任何新警告，唯一警告集恒为 2 条；无按文件的集中新增。遗留提醒：这两条 C4996 弃用警告在引擎升级前需迁移到 accessor API，否则下个引擎版本将无法编译（警告原文已明示）。

## Recurrences

| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2025-08-12 | #2855-#2856 → #2857 | `EarthRenderTarget2DFragment.cpp`（EarthPrefab）创建 RT 资产时无守卫访问 `MipGenSettings` / `CompressionNone`——同为 `UTexture` 的 WITH_EDITORONLY_DATA 成员，宿主换成派生类 `UTextureRenderTarget2D` | 同因（编辑器专属数据成员泄漏进 runtime 目标）；中间 #2856 曾以补头文件自救（`376716541` "添加丢失的头文件"）无效——成员在打包目标被物理剥离，不是可见性问题 |

- 复发轮归因（2026-08-22 分析，评分 10）：#2856→#2857 全部检出 pin（7 仓库）唯一变化 AesWorld `376716541`→`6cf5a1145`（PengBo，"为EDITORONLY_DATA的参数添加WITH_EDITORONLY_DATA"），`git show` 实证修复即守卫包裹 + 移除无效 include；#2857 错误消失（BUILD SUCCESSFUL，0 错误行）。
- 修复 diff（AesWorld `6cf5a1145`，`Source/EarthPrefab/Private/Output/EarthRenderTarget2DFragment.cpp`）：

```diff
-#include "Engine/Texture.h"
 #include "Engine/TextureRenderTarget2D.h"
 ...
-		RenderTarget2D->MipGenSettings = TMGS_NoMipmaps;
-		RenderTarget2D->CompressionNone = true;
 		RenderTarget2D->MipsSamplerFilter = TF_Nearest;
 		RenderTarget2D->ClearColor = ClearColor;
 		RenderTarget2D->bAutoGenerateMips = bAutoGenerateMipMaps;
 		RenderTarget2D->AddressX = TA_Clamp;
 		RenderTarget2D->AddressY = TA_Clamp;
+#if WITH_EDITORONLY_DATA
+		RenderTarget2D->MipGenSettings = TMGS_NoMipmaps;
+		RenderTarget2D->CompressionNone = true;
+#endif
 		RenderTarget2D->InitAutoFormat(RenderTargetSize.X, RenderTargetSize.Y);
```

- 警告计数：#2855=24、#2856=24、#2857=0——0 为增量构建假象（fix 轮仅重编 1 个 unity chunk，fail 轮为 5 个，产出那 24 条警告的文件未参与重编），非真实清零。
