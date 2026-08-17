# Path Audit Report - Jenkins Log Auto-Learning Test Run

**Date**: 2026-04-13T23:30:00
**Skill Version**: v5.1
**Run Summary**: Processed 10 builds from `twe-ue5.5-installed` job (9 FAILURE + 1 SUCCESS), skipped 5 ABORTED/NOT_BUILT

---

## 1. Files Created During This Run

### 1a. rawDir Files (Knowledge Output)

| # | File Path | Size | Classification | Verdict |
|---|-----------|------|----------------|---------|
| 1 | `D:\Claude_skills\wiki-raw\jenkins-learnings\details\installed-441-UHT-CategorySpecifier.md` | 2,951 B | rawDir/details | **PASS** |
| 2 | `D:\Claude_skills\wiki-raw\jenkins-learnings\details\installed-452-C2440-UPackageToUObject.md` | 2,477 B | rawDir/details | **PASS** |
| 3 | `D:\Claude_skills\wiki-raw\jenkins-learnings\scratch\installed-469-C7568-TSharedFuture-Template.md` | 2,238 B | rawDir/scratch | **PASS** |

### 1b. rawDir Files (Tracking)

| # | File Path | Size | Classification | Verdict |
|---|-----------|------|----------------|---------|
| 4 | `D:\Claude_skills\wiki-raw\jenkins-learnings\analyzed-builds.json` | 14,843 B (updated) | rawDir/trackFile | **PASS** |

### 1c. tmpDir Files (Temporary Logs)

| # | File Path | Size | Classification | Verdict |
|---|-----------|------|----------------|---------|
| 5 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-441.log` | 476,057 B | tmpDir/logs | **PASS** |
| 6 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-442.log` | 443 B | tmpDir/logs | **PASS** |
| 7 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-448.log` | 1,364 B | tmpDir/logs | **PASS** |
| 8 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-452.log` | 447,258 B | tmpDir/logs | **PASS** |
| 9 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-453.log` | 444,856 B | tmpDir/logs | **PASS** |
| 10 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-454.log` | 444,840 B | tmpDir/logs | **PASS** |
| 11 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-469.log` | 469,043 B | tmpDir/logs | **PASS** |
| 12 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-470.log` | 449,290 B | tmpDir/logs | **PASS** |
| 13 | `D:\Claude_skills\tmp\ue-error\logs\fail-installed-471.log` | 449,453 B | tmpDir/logs | **PASS** |
| 14 | `D:\Claude_skills\tmp\ue-error\logs\success-installed-443.log` | 1,915,049 B | tmpDir/logs | **PASS** |
| 15 | `D:\Claude_skills\tmp\ue-error\logs\success-installed-457.log` | 1,935,606 B | tmpDir/logs | **PASS** |
| 16 | `D:\Claude_skills\tmp\ue-error\logs\success-installed-472.log` | 1,942,698 B | tmpDir/logs | **PASS** |

---

## 2. Files Modified During This Run

| # | File Path | Before Size | After Size | Classification | Verdict |
|---|-----------|-------------|------------|----------------|---------|
| 1 | `D:\Claude_skills\wiki-raw\jenkins-learnings\analyzed-builds.json` | 7,759 B | 14,843 B | rawDir/trackFile | **PASS** |

---

## 3. wikiDir Write Check (Must Be Read-Only)

### BEFORE Snapshot
- Total files in wikiDir: 52
- Last modification: `2026-04-13T22:31:24` (analyzed-builds.json)

### AFTER Snapshot
- Total files in wikiDir: 52
- Last modification: `2026-04-13T22:31:24` (analyzed-builds.json) -- **UNCHANGED**

**Verdict**: **PASS** -- Zero writes to wikiDir. All file timestamps and sizes are identical between BEFORE and AFTER snapshots.

---

## 4. Path Classification Summary

| Category | Expected Base Path | Files Created | Files Modified | Verdict |
|----------|-------------------|---------------|----------------|---------|
| **tmpDir** | `D:\Claude_skills\tmp\ue-error\` | 12 | 0 | **PASS** |
| **rawDir** | `D:\Claude_skills\wiki-raw\jenkins-learnings\` | 3 | 1 | **PASS** |
| **wikiDir** | `C:\Users\Administrator\memory\jenkins-learnings\` | 0 | 0 | **PASS** |
| **Unexpected** | (any other path) | 0 | 0 | **PASS** |

---

## 5. Path Resolution Verification

Config field -> Resolved path -> Matches expected?

| Config Field | Config Value | Resolved Absolute Path | Expected | Match |
|-------------|-------------|------------------------|----------|-------|
| `tmpDir` | `./tmp/ue-error` | `D:\Claude_skills\tmp\ue-error` | `D:\Claude_skills\tmp\ue-error-solver\...` or `D:\Claude_skills\tmp\ue-error\...` | **PASS** (note: config says `ue-error`, not `ue-error-solver`) |
| `knowledgeBase.rawDir` | `./wiki-raw/jenkins-learnings` | `D:\Claude_skills\wiki-raw\jenkins-learnings` | `D:\Claude_skills\wiki-raw\jenkins-learnings\...` | **PASS** |
| `knowledgeBase.wikiDir` | `~/memory/jenkins-learnings` | `C:\Users\Administrator\memory\jenkins-learnings` | `C:\Users\Administrator\memory\jenkins-learnings\...` | **PASS** |
| `trackFile` | `analyzed-builds.json` | `D:\Claude_skills\wiki-raw\jenkins-learnings\analyzed-builds.json` | (rawDir)/(trackFile) | **PASS** |

### Note on tmpDir Path
The task description expected tmpDir files at `D:\Claude_skills\tmp\ue-error-solver\...` but config.json specifies `tmpDir: "./tmp/ue-error"`. The skill correctly follows config.json, resulting in files at `D:\Claude_skills\tmp\ue-error\...`. This is **correct behavior** -- the skill must be config-driven, not hardcoded.

---

## 6. Overall Summary

| Metric | Value |
|--------|-------|
| Total files created | 15 (3 knowledge + 12 tmp logs) |
| Total files modified | 1 (analyzed-builds.json) |
| wikiDir writes | 0 (PASS -- read-only maintained) |
| Unexpected path writes | 0 |
| Path violations | 0 |

### **OVERALL VERDICT: PASS**

All file writes went to the correct directories as specified in config.json. The wikiDir was treated as read-only throughout the run. All knowledge files were written to rawDir (details/ for score >= 8, scratch/ for score 5-7). All temporary logs went to tmpDir/logs/. No files were written to unexpected locations.

---

## 7. Builds Processed

| Build | Result | Analysis | Knowledge File |
|-------|--------|----------|----------------|
| installed#440 | SUCCESS | w=331 | (none -- tracking only) |
| installed#441 | FAILURE | UHT Category specifier, score=9, fix=#443 | details/installed-441-UHT-CategorySpecifier.md |
| installed#442 | FAILURE | Infra: pipeline script crash | (none -- tracking only) |
| installed#448 | FAILURE | Infra: git network error | (none -- tracking only) |
| installed#452 | FAILURE | C2440 UPackage->UObject, score=9, fix=#457 | details/installed-452-C2440-UPackageToUObject.md |
| installed#453 | FAILURE | Same as #452, score=9, fix=#457 | (see #452 file) |
| installed#454 | FAILURE | Same as #452, score=9, fix=#457 | (see #452 file) |
| installed#469 | FAILURE | C7568 TSharedFuture, score=7, fix=#472 | scratch/installed-469-C7568-TSharedFuture-Template.md |
| installed#470 | FAILURE | Same as #469, score=7, fix=#472 | (see #469 file) |
| installed#471 | FAILURE | Same as #469, score=7, fix=#472 | (see #469 file) |

Skipped (ABORTED/NOT_BUILT): autoci#3956, autoci#3930, installed#466, installed#456, installed#455
