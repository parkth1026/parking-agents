---
title: "C2672/C2893 Invoke Overload Resolution Failure in FlushUpToDateTask Lambda"
created: 2026-05-14
updated: 2026-08-18
type: concept
tags: [compile-error, cpp, msvc, aesworld, error-pattern]
sources: ["aes6-ue-runtime-ci #496"]
---
# C2672/C2893 Invoke Overload Resolution Failure in FlushUpToDateTask Lambda

aes6-ue-runtime-ci #496 FAILURE — std::invoke cannot deduce matching overload for lambda inside TAesMarkerCache<FAesMarkerInfo>::FlushUpToDateTask. The error manifests as C2672 (no matching overloaded function) and C2893 (failed template specialization).

## Error Context

`
AesMarkerCache.hpp(390): error C2672: 'Invoke': no matching overloaded function found
AesMarkerCache.hpp(390): error C2893: Failed to specialize function template
  'unknown-type Invoke(FuncType &&,ArgTypes &&...)'
  With FuncType=CallableType &, ArgTypes={TAesMarkerCache<FAesMarkerInfo>::FMarker *const *&}
`

- **File**: AesMarkerSystem/Private/Core/AesMarkerCache.hpp:390
- **Function**: ForEachMarker lambda inside FlushUpToDateTask
- **Build pair**: #496 (FAIL, commit 6ea1ec5) → #495 (SUCCESS, commit 2d30a21)

## Root Cause

The regression commit 6ea1ec5 ("修改错误...") introduced a change in the ForEachMarker lambda that caused std::invoke template argument deduction to fail. The lambda's operator() signature no longer matched what ForEachMarker expected — likely a capture type or return type mismatch.

## Fix Pattern

When encountering C2672/C2893 with Invoke in a template lambda:

1. Check if the lambda's operator() signature matches what the template expects
2. Look for recent commits that changed the lambda capture or return type
3. Common cause: lambda return type deduction failure with std::invoke
4. Fix often involves explicit return type or adjusting capture semantics

## Recurrence


## Related

- 003-disk-full-pch-write-failed — another AesWorld plugin build issue
- aes6-4017-AesEarth-Reset — AesEarth Reset member function error
- 004-Exit27-AesWorld-Plugin-Build-Failure — AesWorld plugin exit code 27
- [[038-c2660-handle-download-complete-args-mismatch]]
- [[029-C2664-TypeConversionError-UnrealEngineProperty]]
