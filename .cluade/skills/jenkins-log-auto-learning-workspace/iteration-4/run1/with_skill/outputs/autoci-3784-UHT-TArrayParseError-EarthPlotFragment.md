# UHT Parse Error: 'Found TArray when expecting comma or right paren' in UPROPERTY

> **Score**: 9/10 | **Job**: autoci | **Date**: 2026-04-09
> **Builds**: #3784 (FAILURE) → #3785 (SUCCESS)
> **Scoring**: Info 3/3 + Diff 2/2 + Commit 3/3 + Reuse 1/2 = 9/10

## Error Message
```
D:\ws_twe_ue5.1_ci\Project\Plugins\G\AesWorld\Source\EarthPrefab\Public\Fragment\EarthPlotFragment.h(74):
  Error: Found 'TArray' when expecting ',' or ')' while parsing Variable specifiers
  in Member variable declaration in struct
ERROR: Build project failed.
```

## Root Cause
Commit `dedcaeb` (an earlier version of "【Task932】添加地块预制体") introduced the new file `EarthPlotFragment.h` with a UPROPERTY syntax error on line 74. The Unreal Header Tool (UHT) parser encountered `TArray<FEarthPlotEdgeSubAsset> EdgeAssets` but couldn't parse it — the UPROPERTY macro on the preceding line was malformed (missing closing `)`, missing semicolon on the prior variable, or missing comma between specifiers). UHT is a custom parser, not a full C++ compiler, so a syntax error in one UPROPERTY causes it to treat the next token (`TArray`) as part of the specifier list where it expects `,` or `)`.

## Fix
- **Commit**: `f639e3246d7e42116fb2a7d1c6b1c26e6d8a8e77` by PengBo (AesWorld)
- **Message**: "【Task932】添加地块预制体，支持配置地块面材质和地块边缘预制体" (Add plot prefab, support configuring plot face material and edge prefab)
- **What changed**: The author rewrote/corrected `EarthPlotFragment.h`, fixing the UPROPERTY syntax. The final working version of line 74 reads:
```cpp
// 包边资产列表
UPROPERTY(BlueprintReadWrite, EditAnywhere, Category = "Plot Edge")
TArray<FEarthPlotEdgeSubAsset> EdgeAssets;
```
This is correctly formed with all required UPROPERTY specifiers and proper parentheses.

Note: The `dedcaeb` commit that introduced the broken file is not available in the local git clone (shallow clone). The `f639e32` commit is the corrected version of the same feature.

## How to Reproduce / Detect
- Write a UPROPERTY specifier line missing the closing `)` before a TArray member:
  ```cpp
  UPROPERTY(EditAnywhere, Category = "Plot Edge"  // missing )
  TArray<FEarthPlotEdgeSubAsset> EdgeAssets;      // UHT reports error here
  ```
- Run `UnrealBuildTool` — UHT will report "Found 'TArray' when expecting ',' or ')'"
- The error always points to the WRONG line (the TArray line), but the actual mistake is on the PREVIOUS UPROPERTY line

## Epic Official Guidance
- **Query**: "UE5 UHT error: Found TArray when expecting comma or right paren while parsing Variable specifiers in Member variable declaration in struct. EarthPlotFragment.h line 74."
- **Answer**: This error occurs because UHT's parser becomes lost due to a syntax error in the UPROPERTY macro preceding the TArray declaration. Most common causes: (1) Missing closing `)` at end of UPROPERTY specifiers, (2) Missing semicolon on the preceding variable, (3) Missing comma between specifiers. Since UHT is a custom parser (not a full C++ compiler), it cannot recover from such errors gracefully and reports the error on the next token it encounters (`TArray`), not on the actual line with the mistake.
- **References**:
  - [Structs in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/structs-in-unreal-engine)
  - [TArray: Arrays in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/array-containers-in-unreal-engine)

## Prevention
- When UHT reports an error on a `TArray` or other type, **check the line ABOVE** the reported error line — the actual syntax mistake is almost always in the preceding UPROPERTY macro
- IDE syntax highlighting and UE code plugins (like the JetBrains Rider UE plugin) will highlight malformed UPROPERTY macros before commit
- After adding new `.h` files with UPROPERTY macros, do a quick local build before pushing to catch UHT errors early
