---
title: "UE5 Jenkins 日志学习知识库"
created: 2026-03-31
updated: 2026-05-14
type: concept
tags: [error-pattern, clang, jenkins]
sources: []
---

# UE5 Jenkins 日志学习知识库

## 目录结构
- `details/` - 高价值知识文档（详细分析、关键错误模式）
- `scratch/` - 低价值/临时文档（简单记录、重复模式）
- `logs/` - 原始日志文件
- `patterns/` - 错误模式分类汇总

## 学习进度
- 已分析构建对: 5
- 已生成文档: 4
- 最后更新: 2026-03-31

## 主要错误模式

### 1. C++20 标准兼容性问题
**文件**: `details/cpp20-cesium-compile-error.md`  
**Job**: wdp5-runtime-ue5.5 #158→159  
**错误**: CesiumForUnreal插件的GSL库与UE5.5 C++20标准冲突  
**修复**: 更新CesiumForUnreal到适配版本

### 2. Installed Build 头文件缺失
**文件**: `details/installed-build-headers-missing.md`  
**Job**: wdp5-plugins-ue5.5 #294→295  
**错误**: TStaticSamplerState、GetRHI、GTransparentBlackTexture等未定义  
**修复**: 添加必要的头文件包含

### 3. Linux 跨平台宏展开问题
**文件**: `details/linux-macro-compile-error.md`  
**Job**: wdp5-runtime-ue5.5-linux-ci #278→279  
**错误**: REGISTER_RUNTIME_API宏在Clang下类型检查失败  
**修复**: 调整宏定义以支持跨平台编译

### 4. UE5.5 UMaterial API 变更
**文件**: `details/ue55-umaterial-api-change.md`  
**Job**: wdp5-plugins-ue5.5 #287→288  
**错误**: UMaterial::GetRenderProxy() API变更  
**修复**: 适配新的Material渲染API

### 5. DataTable RowStruct 缺失
**文件**: `scratch/datatable-rowstruct-missing.md`  
**Job**: wdp5-runtime-ue5.5 #139→140  
**错误**: DataTable的RowStruct引用丢失  
**修复**: 修复数据表结构体引用

## 构建对汇总

| 轮次 | Job | 失败构建 | 成功构建 | 错误类型 | 文档位置 |
|------|-----|----------|----------|----------|----------|
| 1 | wdp5-runtime-ue5.5 | #158 | #159 | C++20兼容性问题 | details/cpp20-cesium-compile-error.md |
| 2 | wdp5-plugins-ue5.5 | #294 | #295 | Installed Build头文件缺失 | details/installed-build-headers-missing.md |
| 3 | wdp5-runtime-ue5.5-linux-ci | #278 | #279 | Linux宏展开问题 | details/linux-macro-compile-error.md |
| 4 | wdp5-runtime-ue5.5 | #139 | #140 | DataTable RowStruct缺失 | scratch/datatable-rowstruct-missing.md |
| 5 | wdp5-plugins-ue5.5 | #287 | #288 | UE5.5 UMaterial API变更 | details/ue55-umaterial-api-change.md |


## Related
- [[linux-ld-duplicate-symbol-FAesEditorToolTypeIdGenerator]]
- [[scene-index]]

## 目录与读写边界（2026-08-17 治理注记）

- wiki/details/ —— 2026-05 迁移封存层（70 篇 + 2026-08-17 拆分出的 5 个子页），只读。
- raw/details/ —— jenkins-log-auto-learning 的活跃生成层，自动写入。
- 提升（promotion）流程：raw/details 高分文件经人工审核后提升至 wiki。
- karpathy 五目录（entities/concepts/sources/comparisons/queries）为预留骨架，尚未启用。
