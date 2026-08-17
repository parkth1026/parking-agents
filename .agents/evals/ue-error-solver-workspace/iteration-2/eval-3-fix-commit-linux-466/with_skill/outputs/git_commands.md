# Git Commands to Commit the Fix

These commands should be executed in the AesWorld git repository.
**DO NOT execute these automatically** -- the user should review and run them manually.

## Prerequisites

- Ensure you are on the correct branch (`dev`)
- Ensure no uncommitted changes that might conflict

## Commands

```powershell
# 1. Navigate to the git repo
cd D:\Git\AesWorld

# 2. Pull latest changes first (MANDATORY before any commit)
git pull

# 3. Verify the changed files
git status
git diff Source/AesWorldProfiling/Public/AesWorldProfilingTrace.h
git diff Source/AesWorldProfiling/Private/AesWorldProfilingTrace.cpp

# 4. Stage the changed files
git add Source/AesWorldProfiling/Public/AesWorldProfilingTrace.h
git add Source/AesWorldProfiling/Private/AesWorldProfilingTrace.cpp

# 5. Commit with descriptive message
git commit -m "fix(AesWorldProfiling): Wdelete-incomplete - add stub struct definitions for non-debug builds"

# 6. Push to remote
git push
```

## Commit Message

```
fix(AesWorldProfiling): Wdelete-incomplete - add stub struct definitions for non-debug builds

Add empty FAesTraceScope, FAesTracePayloadScope, and FAesTraceProducerScope
stub definitions in the #else branch of AesWorldProfilingTrace.h so that
TUniquePtr<T> has a complete type in Shipping/non-debug builds.

Fixes Linux CI build #466 clang error:
  error: deleting pointer to incomplete type 'FAesTracePayloadScope'
  may cause undefined behavior [-Werror,-Wdelete-incomplete]
```

## Safety Notes

- `git pull` MUST succeed before committing
- NEVER use `git push --force` or `git push -f`
- If `git pull` reveals conflicts, STOP and resolve manually
- If `git push` fails due to permissions or branch protection, inform the user
