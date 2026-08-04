# 执行轨迹报告

## Phase 0: 扫描发现

### Jenkins API 调用 URL

config.json 中 job path 格式为 `wdp-ue/job/Earth/job/twe-ue5.5-ci`，实际 Jenkins API 路径需要每层加 `job/` 前缀。实际调用 URL：

- **TWE job**: `http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-ci/api/json?tree=allBuilds[number,result,timestamp]{0,200}`
- **AES job**: `http://10.66.12.40/job/wdp-ue/job/Earth/job/aes6-ue-runtime-ci/api/json?tree=allBuilds[number,result,timestamp]{0,200}`

注意：config.json 里的 path 字段 (`wdp-ue/job/Earth/job/twe-ue5.5-ci`) 直接拼接 baseUrl 会得到 404。正确的做法是把 path 里的每段名字用 `/job/` 分隔，并在 baseUrl 后加 `/job/`。这是本次执行的一个已处理差异——实际通过补全 `job/` 前缀成功调用。

### 每个 job 可见的 build 范围

| Job | 最小编号 | 最大编号 | 总可见 builds |
|-----|----------|----------|---------------|
| TWE 编译 (twe-ue5.5-ci) | 842 (SUCCESS) | 1041 (ABORTED) | 200 |
| AesRuntime (aes6-ue-runtime-ci) | 3744 (SUCCESS) | 3947 (SUCCESS) | 200 |

**TWE FAILURE builds（升序）**: 898, 899, 900, 901, 902, 903, 954, 1018, 1034
**AES FAILURE builds（升序）**: 3746, 3754, 3755, 3756, 3763, 3784, 3877, 3879, 3881, 3898, 3899, 3908, 3913, 3939

### 从哪个编号开始扫

tracking 文件为空 `{}`，analyzed map 为空，所有 builds 均未分析。从最小 build 编号开始：
- TWE：从 #842 开始（但从最小的 FAILURE build #898 开始优先处理）
- AES：从 #3744 开始（最小 FAILURE #3746 优先）

**是否从最小 build 开始，而非 last_analyzed+1**：YES，严格按照 SKILL.md 要求，以 analyzed{} map 为准，empty map = 全部未学，从最低编号的 FAILURE builds 开始扫。

### 选出的 10 个 builds（FAILURE 优先，升序）

| # | Job | Build | Result | Fix Build |
|---|-----|-------|--------|-----------|
| 1 | TWE 编译 | #898 | FAILURE | #904 |
| 2 | TWE 编译 | #899 | FAILURE | #904 |
| 3 | TWE 编译 | #900 | FAILURE | #904 |
| 4 | TWE 编译 | #901 | FAILURE | #904 |
| 5 | TWE 编译 | #902 | FAILURE | #904 |
| 6 | TWE 编译 | #903 | FAILURE | #904 |
| 7 | TWE 编译 | #954 | FAILURE | #955 |
| 8 | TWE 编译 | #1018 | FAILURE | #1019 |
| 9 | TWE 编译 | #1034 | FAILURE | #1035 |
| 10 | AesRuntime | #3746 | FAILURE | #3747 |

---

## Phase 1: 每个 build 分析过程

### TWE #898–#903（同一错误模式，fix build #904）

**错误提取**:
```
tiff.lib(tif_jpeg.obj) : error LNK2019: unresolved external symbol jpeg_std_error
tiff.lib(tif_ojpeg.obj) : error LNK2001: unresolved external symbol jpeg_std_error
tiff.lib(tif_jpeg.obj) : error LNK2019: unresolved external symbol jpeg_CreateCompress
... (21 unresolved externals total)
D:\ws_twe-ue5.5_ci\Project\Plugins\G\AesWorld\Binaries\Win64\UnrealEditor-AesEditorMode.dll : fatal error LNK1120: 21 unresolved externals
ExitCode=6
```

- **错误码**: LNK2019 / LNK2001 / LNK1120
- **文件**: tiff.lib (tif_jpeg.obj, tif_ojpeg.obj) → UnrealEditor-AesEditorMode.dll
- **行号**: N/A（linker error，无行号）
- 6 个 builds (#898-#903) 完全相同的错误模式

**找到的 fix build**: #904 (SUCCESS)
- #904 错误行数：1（来自 WeChat notification line，不是真正的编译错误）
- 确认 build #904 中无 LNK2019/LNK2001 错误

**commit 信息获取方式**:
- changeSet API 返回空 `{"_class":"org.jenkinsci.plugins.workflow.job.WorkflowRun"}` — WorkflowRun pipeline 常见问题
- 从 console log 的 WeChat notification 消息中提取插件 commit 信息
- AesWorld commit: `79df524 "修复提交后管线5.5引擎打包不过的问题"` (Fix pipeline 5.5 packaging failure)
- 完整 hash 从 console git checkout 行确认: `79df5241ab1a0953df24bf44ef44ec0b8c1dcdb5`

**错误↔commit 关联**:
- 错误 DLL：`UnrealEditor-AesEditorMode.dll` → AesEditorMode 模块属于 AesWorld 插件
- AesWorld commit `79df524` 提交信息直接描述修复了 5.5 打包失败
- 关联强度：**strong**（commit 直接修改了出错的 AesWorld 插件）

**评分**: Info 2/3（无行号）+ Diff 2/2 + Commit 3/3 + Reuse 2/2 = **9/10**

---

### TWE #954（Jenkins 内部状态加载失败）

**错误提取**:
```
Error when executing failure post condition:
Caused: java.io.IOException: Failed to load build state
    at org.jenkinsci.plugins.workflow.cps.CpsFlowExecution$3.onSuccess(...)
Finished: FAILURE
```

- **错误码**: 无 C/LNK 错误码，Jenkins 内部 IOException
- **文件**: N/A
- **行号**: N/A

**找到的 fix build**: #955 (SUCCESS，0 error lines)

**commit 获取**: Console log 中可见 AesWorld commit `79df524`（与 #904 相同），说明此次失败与代码无关。

**结论**: Jenkins CPS 流程引擎状态文件加载失败，属于 **基础设施故障**（Jenkins 服务器内部问题），非代码错误。记录为 `failure:infra:jenkins-state-load-error`。

**评分**: 0/10 → 不写知识文件，tracking 记录 infra

---

### TWE #1018（网络/Robocopy 失败）

**错误提取**:
```
2026/01/16 17:38:51 ERROR 1311 (0x0000051F) Creating Destination Directory \\10.66.12.53\eci\UE5\TWEBuild\...
CategoryInfo: CloseError: ProcessNotTerminated,Microsoft.PowerShell.Commands.WaitProcessCommand
ERROR: robocopy error
```

- 编译阶段：全部成功 (ExitCode=0)
- 失败原因：robocopy 无法在网络共享 `\\10.66.12.53\eci` 创建目录（ERROR 1311 = 登录会话不存在）
- 同时有 PowerShell WaitProcessCommand TimeoutException

**结论**: 网络共享访问失败，属于 **基础设施故障**（网络/权限/会话过期问题），非代码错误。记录为 `failure:infra:robocopy-network-error-1311`。

**评分**: 1/10 → 不写知识文件，tracking 记录 infra

---

### TWE #1034（C2061 FZoneGraphBuildData）

**错误提取**:
```
D:\ws_twe-ue5.5_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Public\Utils\EarthRoadJunctionUtilities.h(40): error C2061: syntax error: identifier 'FZoneGraphBuildData'
Took 134.53s to run dotnet.exe, ExitCode=6
BUILD FAILED
```

- **错误码**: C2061
- **文件**: `AesWorld/Source/EarthPrefab/Public/Utils/EarthRoadJunctionUtilities.h`
- **行号**: 40

**找到的 fix build**: #1035 (SUCCESS，0 error lines)

**commit 信息获取方式**: changeSet API 空；从 console log WeChat notification 提取：
- **#1034 (FAILURE)**: AesWorld `06b7287 "Merge branch 'dev_RoadModeler' into dev"` — 引入问题的 merge commit
- **#1035 (SUCCESS)**: AesWorld `441c970 "修复CICD打包报错"` — 修复提交

**错误↔commit 关联**:
- `dev_RoadModeler` 分支合并引入了新的道路结点工具文件 `EarthRoadJunctionUtilities.h`，该文件使用了 `FZoneGraphBuildData` 但缺少必要的 include
- 修复 commit `441c970` 直接描述"修复 CICD 打包报错"，针对此问题
- 关联强度：**strong**（引入问题的 commit 和修复 commit 都是 AesWorld，错误文件也在 AesWorld）

**评分**: Info 3/3 + Diff 2/2 + Commit 2/3（message 未明确描述 include 修复）+ Reuse 2/2 = **9/10**

---

### AES #3746（Cook 失败，uasset 版本过新）

**错误提取**:
```
LogAssetRegistry: Error: Package .../DT_ToolBar_Terrain_Edit.uasset is too new. Engine Version: 1008  Package Version: 1013
LogAssetRegistry: Error: Package .../DT_ToolBar_Terrain_Create.uasset is too new. Engine Version: 1008  Package Version: 1013
Took 61.501058s to run UnrealEditor-Cmd.exe, ExitCode=1
ERROR: Cook failed.
AutomationTool exiting with ExitCode=25 (Error_UnknownCookFailure)
BUILD FAILED
```

- **错误码**: ExitCode=25 (Error_UnknownCookFailure)，无 C/LNK 错误码
- **文件**: `AesWorld/Content/UI/BottomToolBar/DT_ToolBar_Terrain_Edit.uasset`, `DT_ToolBar_Terrain_Create.uasset`
- **行号**: N/A

**找到的 fix build**: #3747 (SUCCESS，0 error lines)

**commit 信息获取方式**: changeSet API 未测试；从 console log WeChat notification 提取：
- **#3746 (FAILURE)**: AesWorld `1f6ada4 "优化 warning"` — 可能在 UE5.5 下编辑后保存了 uasset
- **#3747 (SUCCESS)**: AesWorld `a5dafc6 "在5.1下将地形挖洞和轮廓线重绘放到地形编辑页签下"` — 在 5.1 编辑器中重新保存了这些资产

**错误↔commit 关联**:
- `a5dafc6` 提交描述"在5.1下"操作，正是重新用 UE5.1 编辑器保存了相关 uasset，修复了版本不兼容问题
- 关联强度：**moderate**（commit message 明确涉及 5.1 下的 UI 编辑，与 DT_ToolBar 资产相关）

**评分**: Info 1/3（无 C 错误码/行号）+ Diff 2/2 + Commit 2/3 + Reuse 2/2 = **7/10**

---

## Phase 2: Tracking 更新

**trackFile 写入路径**: `C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\raw\jenkins-log-auto-learning\analyzed-builds.json`

这是 **knowledgeDir**，不是 outputDir。符合 SKILL.md 要求：trackFile 在 `{knowledgeDir}/{trackFile}`。

**analyzed map 新增的 key（共 10 个）**:
```json
"wdp-ue/job/Earth/job/twe-ue5.5-ci#898": "failure:score=9:LNK2019-tiff-jpeg",
"wdp-ue/job/Earth/job/twe-ue5.5-ci#899": "failure:score=9:LNK2019-tiff-jpeg",
"wdp-ue/job/Earth/job/twe-ue5.5-ci#900": "failure:score=9:LNK2019-tiff-jpeg",
"wdp-ue/job/Earth/job/twe-ue5.5-ci#901": "failure:score=9:LNK2019-tiff-jpeg",
"wdp-ue/job/Earth/job/twe-ue5.5-ci#902": "failure:score=9:LNK2019-tiff-jpeg",
"wdp-ue/job/Earth/job/twe-ue5.5-ci#903": "failure:score=9:LNK2019-tiff-jpeg",
"wdp-ue/job/Earth/job/twe-ue5.5-ci#954": "failure:infra:jenkins-state-load-error",
"wdp-ue/job/Earth/job/twe-ue5.5-ci#1018": "failure:infra:robocopy-network-error-1311",
"wdp-ue/job/Earth/job/twe-ue5.5-ci#1034": "failure:score=9:C2061-FZoneGraphBuildData",
"wdp-ue/job/Earth/job/aes6-ue-runtime-ci#3746": "failure:score=7:cook-package-version-too-new"
```

**last_analyzed 更新值**:
```json
"last_analyzed": {
  "wdp-ue/job/Earth/job/twe-ue5.5-ci": 1034,
  "wdp-ue/job/Earth/job/aes6-ue-runtime-ci": 3746
}
```

**runHistory 新增记录**:
```json
{
  "timestamp": "2026-04-08T00:00:00",
  "buildsAnalyzed": 10,
  "failurePairsFound": 4,
  "knowledgeWritten": 3,
  "infra": 2,
  "remaining": {
    "wdp-ue/job/Earth/job/twe-ue5.5-ci": 0,
    "wdp-ue/job/Earth/job/aes6-ue-runtime-ci": 13
  }
}
```

---

## Phase 3: 知识文件

| 文件路径 | 分数 | 说明 |
|---------|------|------|
| `knowledgeDir/details/001-LNK2019-TiffLibJpegSymbols.md` | 9/10 | TWE #898-903：tiff.lib 缺少 libjpeg 链接，6次连续失败，fix=commit 79df524 |
| `knowledgeDir/details/002-C2061-FZoneGraphBuildData.md` | 9/10 | TWE #1034：EarthRoadJunctionUtilities.h 缺少 FZoneGraphBuildData include，fix=commit 441c970 |
| `knowledgeDir/scratch/001-CookFail-PackageVersionTooNew.md` | 7/10 | AES #3746：DT_ToolBar uasset 在 UE5.5 下保存版本过新导致 UE5.1 CI cook 失败，fix=commit a5dafc6 |

完整路径：
- `C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\raw\jenkins-log-auto-learning\details\001-LNK2019-TiffLibJpegSymbols.md`
- `C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\raw\jenkins-log-auto-learning\details\002-C2061-FZoneGraphBuildData.md`
- `C:\Users\Administrator\.openclaw-autoclaw\workspace\knowledge-bases\raw\jenkins-log-auto-learning\scratch\001-CookFail-PackageVersionTooNew.md`

---

## 问题和异常

### 1. config.json 中 job path 格式与实际 Jenkins API URL 不一致

- **预期**: config 里 `"path": "wdp-ue/job/Earth/job/twe-ue5.5-ci"` 在 SKILL.md 示例 URL 中直接拼接为 `{baseUrl}/job/{job.path}/api/json`
- **实际**: `http://10.66.12.40/wdp-ue/job/Earth/job/twe-ue5.5-ci/api/json` 返回 404
- **正确 URL**: `http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-ci/api/json`（第一段 `wdp-ue` 也需要 `/job/` 前缀）
- **处理方式**: 自动补全第一段的 `job/` 前缀成功访问

### 2. changeSet API 始终返回空（WorkflowRun pipeline）

- TWE 和 AES 都是 WorkflowRun 类型，changeSet API 返回 `{"_class":"org.jenkinsci.plugins.workflow.job.WorkflowRun"}`（空 changeSet）
- **fallback 有效**: 通过 console log 中的 WeChat notification 消息提取到每个 build 的插件 commit 信息，格式为 `"PluginName": "<font color='comment'>commitHash message</font>"`

### 3. 三个不同类型的失败模式被正确识别

- **LNK2019 (6次连续)**: 代码问题，写 details/ 知识文件（9/10）
- **Jenkins 内部异常 (954)**: 基础设施问题，记录为 infra，不写知识文件（0/10）
- **Robocopy 网络失败 (1018)**: 基础设施问题，记录为 infra，不写知识文件（1/10）
- **C2061 缺少 include (1034)**: 代码问题，写 details/ 知识文件（9/10）
- **Cook PackageVersion (3746)**: 代码/资产问题，写 scratch/ 知识文件（7/10）

### 4. 6 次连续相同失败（898-903）写为单个知识文件

- 按 SKILL.md 要求，多个 FAILURE 共享同一 fix build 时，每个 FAILURE 在 tracking 中单独记录
- 但错误模式完全相同时，写单个知识文件（不重复），tracking 中各 build 均指向同一分数/模式
- 这符合 "Deduplication" 原则

### 5. AES job 仍有 13 个 FAILURE build 待分析

- 本轮只处理了 AES #3746，剩余 AES FAILURE builds（3754, 3755, 3756, 3763, 3784, 3877, 3879, 3881, 3898, 3899, 3908, 3913, 3939）将在下一轮继续
