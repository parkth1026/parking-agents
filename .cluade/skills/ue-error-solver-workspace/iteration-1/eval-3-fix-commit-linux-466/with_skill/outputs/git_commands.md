# Git Commands for Fix Deployment

These are the git commands that WOULD be run to commit and push the fix.
**These commands were NOT actually executed -- this is a test run.**

## Pre-requisites

- Git repo: `D:\Git\AesWorld` (mapped to `twe-ue5.5` in config)
- Branch: The branch tracked by the linux CI job (likely `dev_linux` based on log)
- Files to modify:
  - `Source/AesWorldProfiling/Public/AesWorldProfilingTrace.h`
  - `Source/AesWorldProfiling/Private/AesWorldProfilingTrace.cpp`

## Commands

```powershell
# Step 1: Navigate to the git repo
cd "D:\Git\AesWorld"

# Step 2: Pull latest changes (MANDATORY before any commit)
git pull

# Step 3: Verify the files exist and apply changes
# (In this case, the AesWorldProfiling module must exist in the local clone first)
# Note: The local clone at D:\Git\AesWorld does NOT have the AesWorldProfiling module yet.
# The developer must first pull the latest code that includes commit 8894ec3.

# Step 4: Stage the changed files
git add Source/AesWorldProfiling/Public/AesWorldProfilingTrace.h
git add Source/AesWorldProfiling/Private/AesWorldProfilingTrace.cpp

# Step 5: Commit with descriptive message
git commit -m "fix(AesWorldProfiling): Wdelete-incomplete - add complete-type stubs for FAesTracePayloadScope in non-debug branch"

# Step 6: Push to remote
git push
```

## Important Notes

1. **git pull MUST succeed before committing** -- if there are conflicts, stop and resolve manually
2. **NEVER force push** -- `git push --force` is forbidden
3. **If push fails** (permission, branch protection), inform the user and stop
4. **This fix was already committed** as `c6e1eab5` by xiongxing and verified in build #469 (SUCCESS)
5. Since the fix is already in the repo, these commands are documented for reference only

## Actual Fix Status

The knowledge base confirms:
- **Fix commit**: `c6e1eab5e83fbe5ca0733f38bb73a18a6d9af909`
- **Author**: xiongxing
- **Message**: "为非debug构建提供Trace struct空桩定义，修复clang -Wdelete-incomplete错误"
- **Verified**: Build #469 succeeded
