# Error Classification Reference

Quick reference for classifying build errors and choosing diagnosis strategy.

## Compilation Errors (C/C++)

| Code | Category | Typical Cause | Primary Source |
|------|----------|---------------|----------------|
| C1083 | Missing Header | File not found, module dependency missing | Knowledge Base + Epic |
| C2061 | Syntax/Type | Undeclared identifier, missing forward decl | Epic + Source Context |
| C2027 | Unknown Type | Incomplete type, missing include | Knowledge Base + Epic |
| C2039 | Member Not Found | API change, wrong class hierarchy | Epic + Source Context |
| C2065 | Undeclared Identifier | Missing include or namespace | Knowledge Base |
| C2504 | Base Class Error | Circular dependency, missing base class | Epic |
| C2653 | Not a Class/Namespace | Namespace resolution failure | Source Context |
| C2664 | Type Conversion | Implicit conversion not allowed | Source Context |
| C4430 | Missing Type Specifier | Forward declaration issue | Source Context |

## Linker Errors

| Code | Category | Typical Cause | Primary Source |
|------|----------|---------------|----------------|
| LNK2019 | Unresolved External | Missing implementation, wrong module | Knowledge Base + Epic |
| LNK2001 | Unresolved External | Virtual function not implemented | Epic + Source Context |
| LNK1120 | Unresolved Externals | Multiple LNK2019 errors combined | (fix individual LNK2019s) |
| LNK1104 | Cannot Open File | Missing lib, wrong lib path | Web Search |

## UBT/UHT Errors

| Pattern | Category | Typical Cause | Primary Source |
|---------|----------|---------------|----------------|
| UBT ERROR | Build Tool | Build.cs misconfiguration | Knowledge Base + Epic |
| UHT ERROR | Header Tool | UCLASS/UPROPERTY macro issues | Epic |
| PrecompiledManifest | PCH | Stale precompiled headers | Knowledge Base |

## Cook/Package Errors

| Pattern | Category | Typical Cause | Primary Source |
|---------|----------|---------------|----------------|
| LogCook: Error | Cook Failure | Asset reference error, missing dependency | Epic + Web Search |
| Package failed | Package | Platform-specific build issue | Epic + Web Search |
| UassetVersion | Asset Version | Engine version mismatch | Knowledge Base |

## Infrastructure Errors (no code fix)

| Pattern | Category | Action |
|---------|----------|--------|
| OutOfMemory | Resource | Report to user, suggest retry |
| disk full | Resource | Report to user |
| network timeout | Network | Report to user, suggest retry |
| agent offline | Jenkins | Report to user |
| ABORTED | Manual | Report to user |
