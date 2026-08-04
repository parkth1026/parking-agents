## Diagnosis: Java OutOfMemoryError — Jenkins Infrastructure Failure

**Build**: [twe-ue5.5-linux-ci #441](http://10.66.12.40/job/wdp-ue/job/Earth/job/twe-ue5.5-linux-ci/441/)
**Result**: FAILURE (duration: 1.3 seconds)
**Error Type**: Infrastructure — not a code/compilation error

**Primary Error**: `java.lang.OutOfMemoryError: Java heap space`
**Root Cause**: The Jenkins JVM ran out of heap memory before the build pipeline could even start. The entire console log is only 3 lines: "Started by timer", the OOM error, and "Finished: FAILURE". The build was timer-triggered and lasted only ~1.3 seconds, meaning the Jenkins master or agent had insufficient free heap to launch the pipeline.
**Confidence**: High

### Complete Build Log

```
Started by timer
java.lang.OutOfMemoryError: Java heap space
Finished: FAILURE
```

### Evidence

- **Knowledge base**: No dedicated entry for OOM/infrastructure failures. However, the existing knowledge file `linux-435-436-Wlogical-op-parentheses-EarthRoadModelerPrefab.md` documents that builds #437 and #438 of this same job also failed due to OOM infrastructure errors. This indicates a recurring pattern on this Jenkins instance.
- **Epic guidance**: Skipped — this is a Jenkins/Java infrastructure error, not related to UE5 engine code or APIs.
- **Source context**: Skipped — no compilation occurred; no source files are involved.
- **Web search**: Skipped — `java.lang.OutOfMemoryError: Java heap space` is a well-known JVM issue requiring no further research.

### Recommended Fix

This is **not a code issue** — no code changes can fix this. The resolution is on the Jenkins infrastructure side:

1. **Immediate**: Retry the build. OOM errors are often transient — if another heavy job was consuming heap at the same time, a retry may succeed.
2. **Short-term**: Restart the Jenkins service to reclaim heap memory (accumulated garbage from long-running processes, pipeline leaks, etc.).
3. **Long-term**: Increase the Jenkins JVM heap size by adjusting `-Xmx` in the Jenkins startup configuration (e.g., from `-Xmx2g` to `-Xmx4g`). Also review the number of concurrent executors and running pipelines that may be exhausting available memory.

### Pattern Note

This is the third observed OOM failure on this job (previously builds #437 and #438 were also OOM). This recurring pattern suggests the Jenkins instance may need a heap size increase or a memory leak investigation.

### References

- [Jenkins OOM Troubleshooting](https://www.jenkins.io/doc/book/system-administration/viewing-logs/)
- Knowledge base file: `linux-435-436-Wlogical-op-parentheses-EarthRoadModelerPrefab.md` (mentions #437, #438 as OOM)
