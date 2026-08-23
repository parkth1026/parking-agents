---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 1556-1558
fix_build: 1559
error_code: C2039
score: 9
result: failure:score=9:C2039:fix=#1559
primary_fix_commit: 6e81a7ec
recorded_at: 2026-08-19T18:06:50
---

# C2039: 编辑器插件访问 UTexture::Source（WITH_EDITORONLY_DATA 成员）在游戏目标下编译失败

## Error Message

```
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\Editor\AesEditorMode\Private\AesEditorBlueprintFunctionLibrary.cpp(209): error C2039: 'Source': is not a member of 'UTexture'
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Intermediate\Build\Win64\UnrealGame\Inc\AesEditorMode\UHT\AesEditorBlueprintFunctionLibrary.generated.h(13): note: see declaration of 'UTexture'
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\Editor\AesEditorMode\Private\AesEditorBlueprintFunctionLibrary.cpp(215): error C2039: 'Source': is not a member of 'UTexture'
```

（#1556/#1557 报错在 209/215 行；#1558 中间加过一个 include 使行号偏移到 210/216，错误不变。共 2 个唯一错误位置，Incredibuild 输出各重复一次。）

## Root Cause

culprit 提交 `bd9e45754`（"更新tooltip样式"，ZhuXiaoan，2024-08-28）在编辑器模块 AesEditorMode 的蓝图库中新增 `GetTextureSizeX/Y`，用 `Texture->Source.IsValid() ? Texture->Source.GetSizeX()` 取纹理尺寸。UE5.1 中 `UTexture::Source`（FTextureSource，导入源像素数据）声明在 `WITH_EDITORONLY_DATA` 宏块内（Engine/Source/Runtime/Engine/Classes/Engine/Texture.h）。

aes6-ue-runtime-ci 一次流水线构建两个目标：`UGAEditor Win64 Development`（编辑器目标，该模块编译为 UnrealEditor-AesEditorMode.dll，正常通过）与 `UGA-Win64-Development` 游戏目标（"For UGA-Win64-Development" 段，同一编辑器插件模块随单体质游戏构建重编，UHT 头来自 `UnrealGame` 通道，`WITH_EDITORONLY_DATA=0`）。游戏目标下 `Source` 成员被整体剥离，编译器报 C2039 "is not a member of 'UTexture'"。

同族先例（同码不同成员，各自独立成档）：`aes6-635-C2039-editoronly-source-model-api.md`（UStaticMesh 源模型 API）、`aes6-362-C2039-unguarded-sourcetextures.md`（UTexture2DArray::SourceTextures）。本例成员是 `UTexture::Source`，为此家族在 Texture 基类上的首例。

中间失败尝试：`9e0099b05`（"尝试修复编译报错"）给该文件加了 `#include "Engine/Texture.h"`（#1558）——误判为缺头文件。实际 UTexture 类型可见（note 行指向其声明），缺的是编辑器专属成员本身，加 include 无效。

## Fix

- **Commit**: `6e81a7ec1d59cd97afd199fc4192533151edcfe1` by ZhuXiaoan, 2024-08-28 17:40 ("修复编译问题")
- **Message**: "修复编译问题"
- **What changed**: 只改错误文件本身（2 增 2 删），把编辑器专属的 `Texture->Source` 访问换成全目标可用的渲染资源访问器 `GetResource()->GetSizeX/Y()`，空指针回退 `GetSurfaceWidth/Height()` 保留。#1559 中该文件重新编译（28.5s）通过，0 error。

真实 diff（`git show 6e81a7ec1`）：

```diff
 int UAesEditorBlueprintFunctionLibrary::GetTextureSizeX(UTexture* Texture)
 {
 	if (!Texture) return 0;
-	return Texture->Source.IsValid() ? Texture->Source.GetSizeX() : Texture->GetSurfaceWidth();
+	return Texture->GetResource() ? Texture->GetResource()->GetSizeX() : Texture->GetSurfaceWidth();
 }

 int UAesEditorBlueprintFunctionLibrary::GetTextureSizeY(UTexture* Texture)
 {
 	if (!Texture) return 0;
-	return Texture->Source.IsValid() ? Texture->Source.GetSizeY() : Texture->GetSurfaceHeight();
+	return Texture->GetResource() ? Texture->GetResource()->GetSizeY() : Texture->GetSurfaceHeight();
 }
```

culprit 侧 diff（`git show bd9e45754`，节选）：

```diff
+int UAesEditorBlueprintFunctionLibrary::GetTextureSizeX(UTexture* Texture)
+{
+	if (!Texture) return 0;
+	return Texture->Source.IsValid() ? Texture->Source.GetSizeX() : Texture->GetSurfaceWidth();
+}
```

归因强度：强（fail→fix 窗口 #1558→#1559 七个仓库 pin 中 AesWorld 是唯一变化（9e0099b0→6e81a7ec），窗口内仅一个提交、直改错误文件、#1559 错误消失；culprit 与 fix 提交均有真实 diff）。

评分说明：Commit 维第 3 分未得——提交消息"修复编译问题"过于泛化，单独读不出改了什么/为何修复（修复语义来自 diff 与错误配对）。

## How to Reproduce / Detect

- grep 构建日志：`error C2039: 'Source': is not a member of 'UTexture'`，note 行指向 `Intermediate\Build\Win64\UnrealGame\Inc\...\UHT\*.generated.h` 的 UTexture 声明——UnrealGame UHT 通道 = 游戏目标剥离态。
- grep 源码（编辑器模块也随游戏目标编译的插件）：`Texture->Source`、`->Source.IsValid()`、`Source.GetSizeX`。
- 判别要点：报"不是成员"而 note 指向该类声明 = 成员被宏剥离，不是缺 include——加 `#include` 修不好（#1558 已验证）。

## Epic Official Guidance

- **Query**: "UE5.1 C++ compilation error: error C2039: 'Source': is not a member of 'UTexture' at AesEditorBlueprintFunctionLibrary.cpp line 209 ... editor plugin module also compiled as part of a Win64 Development game target. What causes this and how to get texture source size in a way that compiles in both editor and game targets?"
- **Answer**（要点）: `UTexture::Source` 包在 `WITH_EDITORONLY_DATA` 预处理宏内；Development 游戏目标（尤其单体质构建）中 UBT 剥离全部编辑器专属成员以优化体积，编译该插件的翻译单元里该成员字面上不存在。官方推荐模式：`#if WITH_EDITORONLY_DATA` 守卫 `Source` 访问，运行时回退 `UTexture2D::GetPlatformData()->SizeX/SizeY`（烘焙后仍存的 cooked 尺寸）或 `GetSurfaceWidth()`（渲染资源尺寸，资源未加载时返回 0，返回 float 需转 int）。若模块纯编辑器用途，应在 .uplugin 里声明 Editor 类型；必须进游戏的模块用条件编译是引擎标准做法。
- **References**:
  - Lifecycle of a Texture in Unreal Engine for Virtual Production — https://dev.epicgames.com/community/learning/tutorials/vEyw/lifecycle-of-a-texture-in-unreal-engine-for-virtual-production
  - From Texture to Display: The Color Pipeline of a Pixel in UE | Unreal Fest 2024 — https://dev.epicgames.com/community/learning/talks-and-demos/9XbP/from-texture-to-display-the-color-pipeline-of-a-pixel-in-unreal-engine-unreal-fest-2024

（本例实际修复采用 `GetResource()->GetSizeX/Y()`，Epic 建议的宏守卫+PlatformData 是等效替代方案，均全目标可编译。）

## Prevention

- 编辑器模块里凡触碰 `WITH_EDITORONLY_DATA` 成员（`UTexture::Source`、`UStaticMesh::SourceModels`、`UTexture2DArray::SourceTextures` 等），一律包 `#if WITH_EDITORONLY_DATA` 宏守卫并提供运行时回退路径；见本库 aes6-635 / aes6-362 同族案例。
- 该仓库的编辑器插件模块会随 UGA 游戏目标（UnrealGame UHT 通道）重编——"在编辑器目标编译通过"不代表安全，提交前跑一次游戏目标构建或在本地按 Development Game 配置编译受影响模块。
- C2039 "is not a member" 且 note 指向类声明时，先查该成员是否在 `WITH_EDITORONLY_DATA` 块内，不要先加 include（#1558 的无效尝试即是教训）。

## Warning Trend

| Build | Warnings |
|-------|----------|
| #1556 (fail) | 0 |
| #1559 (fix)  | 0 |

趋势：持平（±0）。fail 构建组（#1556-#1558）编译警告计数均为 0，fix 构建 #1559 亦为 0（日志中仅有运行时 LogConsoleManager 警告，不计编译警告）。

## Recurrences

| Date | Builds | Trigger | Notes |
|------|--------|---------|-------|
| 2026-08-19 | #1751, #1754 → #1755 | culprit 60f2d57ed（luwei 2024-09-23，"【官方资产库】…"）在 AesModelRegistrySource.cpp RenderThumbnail() 中直接写 `Thumbnail->CompressionNoAlpha = true` 与 `Thumbnail->Source.Init/LockMip/UnlockMip` | 同因、新成员组合（UTexture2D 的 CompressionNoAlpha + Source，均为 WITH_EDITORONLY_DATA 成员）。本轮是**写入**路径（程序化生成缩略图并填充像素），非 #1556 的读取尺寸；修复 70237c4 改走 UE5 全目标可用的 `GetPlatformData()->Mips[0].BulkData.Lock/Unlock` + `SetNumSlices(1)` + `NeverStream=true`，与 Epic 建议的 PlatformData 路线一致。签名 `AesModelRegistrySource.cpp(525/528/529/558): error C2039: 'CompressionNoAlpha'/'Source': is not a member of 'UTexture2D'` |
