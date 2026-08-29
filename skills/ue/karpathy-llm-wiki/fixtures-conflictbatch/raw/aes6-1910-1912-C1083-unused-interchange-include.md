---
schema: raw-knowledge/2
base_url: http://10.66.12.40
job: aes6-ue-runtime-ci
job_code: aes6
job_path: job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci
fail_builds: 1910-1912
fix_build: 1913
error_code: C1083
score: 10
result: failure:score=10:C1083:fix=#1913
primary_fix_commit: ba6a58c
recorded_at: 2026-08-20T03:04:31
---

# C1083: 未使用的 InterchangeResult.h include 导致编译失败

## Error Message

```
C:\ws_aes6_ue_ci\Project\Plugins\51Hitech\AesWorld\Source\Editor\AesEditorUI\Private\AesEditorUISubsystem.cpp(11): fatal error C1083: Cannot open include file: 'InterchangeResult.h': No such file or directory
```

（#1910、#1911、#1912 三个连续构建同一行同一错误，其后 `BUILD FAILED: Command failed (Result:1): ... xgConsole.exe` 为级联输出。）

## Root Cause

功能提交 `e3ee9749`（2024-09-29 19:48:51，luwei，"【模型库】对应的GITF、建筑、植被、人物模型及其他模型的对应描述需要参考设计"）在 `AesEditorUISubsystem.cpp` 顶部新增模型库 Tooltip 功能时，顺带加入了三个 include——其中 `ImageUtils.h` 与 `InterchangeResult.h` 在整个文件中**从未被使用**（含新增代码，全文 0 处引用）。

`InterchangeResult.h` 属于引擎的 **InterchangeCore** 模块。AesEditorUI 模块的 Build.cs 未声明对 InterchangeCore 的依赖，UBT 不会把该模块的 Public include 路径加进编译命令。C++ 预处理器必须先解析所有 `#include` 指令才进入正文编译——**即使头文件里的类型一个都没用到，找不到头文件照样 fatal error**。于是 #1910（19:52，culprit 落地后首个构建）起连续三个构建在同一行失败。

culprit diff（引入侧，`git show e3ee9749` 节选）：

```diff
 #include "AesEditorBlueprintFunctionLibrary.h"
 #include "AesEditorMode.h"
 #include "AesMarkerSystemModule.h"
+#include "IImageWrapperModule.h"
+#include "ImageUtils.h"
+#include "InterchangeResult.h"
 #include "Engine/World.h"
```

## Fix

- **Commit**: `ba6a58cf888edc3e7e0094e47b7ecfcfaa697fc2` by luwei（AesWorld 仓库 dev 分支，http://10.100.10.55/neon/AesWorld.git）
- **Message**: "打包不过的问题"（2024-09-29 20:46:41 +0800）
- **What changed**: 删除 `AesEditorUISubsystem.cpp` 中两个未使用的 include。报错行号 11 与删除行完全吻合；#1913 构建编译通过（仅余 5 条 tbbmalloc 的 LNK4204 警告，与本案无关）。

修复 diff（`git show ba6a58c`）：

```diff
 #include "AesEditorMode.h"
 #include "AesMarkerSystemModule.h"
 #include "IImageWrapperModule.h"
-#include "ImageUtils.h"
-#include "InterchangeResult.h"
 #include "Engine/World.h"
```

归因强度：强验证——修复提交直接修改报错文件本身，diff 即修复内容；同一窗口内 7 个插件 pin 比对仅 AesWorld 一个变化（`ebcc2ac` → `ba6a58c`，Jenkins 控制台 `Before:/After:` 行）。

时间线：19:48 culprit 提交 → 19:52 / 20:33 / 20:45 三个构建失败 → 20:46 修复提交 → #1913 成功。

## How to Reproduce / Detect

- 日志 grep 关键词：`Cannot open include file: 'InterchangeResult.h'`、`fatal error C1083`、`AesEditorUISubsystem.cpp(11)`
- 触发条件：在未依赖 InterchangeCore 的模块里 `#include "InterchangeResult.h"`（哪怕不用其类型），UE 5.1 编辑器目标编译立即 C1083
- 排查路径：看报错行号是否正是一个 `#include` 行 → 在文件内全文搜索该头文件的主类型（如 `Interchange`）确认是否真的用到 → 用不到即删；用得到则去 Build.cs 加模块依赖

## Epic Official Guidance

- **Query**: "UE5.1 C++ compilation error: C1083 in file Source/Editor/AesEditorUI/Private/AesEditorUISubsystem.cpp at line 11. Error message: fatal error C1083: Cannot open include file: 'InterchangeResult.h': No such file or directory. The include was added but no Interchange types are actually used in the file. What causes this error and how to fix it properly (include path vs module dependency on InterchangeCore)?"
- **Answer**（AgentAnswer 要点）:
  - C1083 `Cannot open include file` 是 **UBT 模块依赖缺失**的标志性错误：引擎中头文件存在于磁盘不够，UBT 只把**已声明依赖**模块的 Public include 路径加入编译搜索路径
  - `InterchangeResult.h` 属于 `InterchangeCore` 模块；AesEditorUI 未依赖它，编译器找不到头文件路径
  - 预处理器在解析正文前必须解析全部 `#include`——不使用其类型也照样编译失败
  - 正确修法二选一：(1) 真不需要 → 按 IWYU 直接删掉 include（本项目本次的修法）；(2) 需要 Interchange 类型 → 在 `AesEditorUI.Build.cs` 的 `PrivateDependencyModuleNames` 中加 `"InterchangeCore"`。**不要**用 `PublicIncludePaths` 硬编码路径绕过——那只解决编译不解决链接，真用到类型时会变 LNK2019
  - 改 Build.cs 后需重新生成工程文件（右键 .uproject → Generate Visual Studio project files）刷新 include 路径
- **References**:
  - Unreal Engine C++ API Reference — https://dev.epicgames.com/documentation/unreal-engine/API
  - Unreal Engine Modules — https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-modules

## Prevention

- **IWYU（Include What You Use）**：只 include 当前文件真正使用的头文件；提交前自查新增 include 是否有对应类型使用（全文搜主类型名）
- **需要引擎模块头文件时先加依赖**：Build.cs 的 `PrivateDependencyModuleNames` 声明模块，而非依赖传递性 include 或手写 include 路径
- **CI 快速定位**：C1083 的报错行号即 include 行——先判断该头文件是否被使用（未用 → 删；在用 → 查模块依赖），多数此类失败可在 1 分钟内分流

## Warning Trend

| Build | Warnings |
|-------|----------|
| #1910 (fail) | 0 |
| #1911 (fail) | 0 |
| #1912 (fail) | 0 |
| #1913 (fix)  | 0 |

趋势：持平（fail 组与 fix 构建的编译器警告计数均为 0；#1913 有 5 条 tbbmalloc LNK4204 链接器警告，不计入 `warning C\d+:` 口径，与本案无关）。
