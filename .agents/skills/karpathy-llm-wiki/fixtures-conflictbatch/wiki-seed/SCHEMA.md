# Wiki Schema

## Domain
UE5 C++ compilation, Jenkins CI/CD, IWYU errors, linker errors, build failures, and related toolchain knowledge.

## Tag Taxonomy
### Error Types
- compile-error
- linker-error
- cook-error
- packaging-error
- infra-error
- iwyu

### Error Codes
（小写编译器/链接器诊断码，如 c2039/c2653；新增码先入册再使用）
- c2039
- c2653
- c3861
- c2027
- c1083

### Languages & Compilers
- cpp
- csharp
- msvc
- clang
- gcc

### Platforms
- windows
- linux

### Engine
- ue5.5
- ue5
- uht
- ubt
- rhi
- shader
- struct
- slate
- nanite
- lumen

### Build System
- jenkins
- p4
- git
- dotnet
- automation
- compilation
- incremental-build

### Jobs
（Jenkins job 简称，与 jobCode 注册表对应）
- aes6
- twe

### Plugin
- aesworld
- aesruntime
- aesmarkersystem
- wdpcamera
- wdpenvironment
- skycreator

### Knowledge Type
- error-pattern
- fix-pattern
- migration
- iwyu-pattern
- infra
- best-practice
- core-concept

## Page Types
（v6 起由 validate-wiki.mjs 校验：基础五类 entity/concept/source/comparison/query 恒有效，此处只声明本库扩展类型）
- jenkins-error

## Page Directories
（本库页面实际所在的扩展目录；validate-wiki v6 据此解析 [[链接]] 与统计页面）
- details/
- patterns/

## Conventions
- Page titles use Title Case
- Tags use lowercase-kebab-case（允许点号，如 ue5.5）
- Dates use YYYY-MM-DD format
- All files use UTF-8 without BOM, LF line endings
- Wikilinks use [[Page Name]] format
- 新建知识页沿用 raw v2 命名（{jobCode}-{构建号}-{ErrorCode}-{ShortDesc}.md）；历史迁移名（001- 等）与既有页名不重命名，避免破坏跨技能检索
