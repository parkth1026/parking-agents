import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

export function runUntilComplete({ command, args, cwd, env, timeoutMs, completionFile = null, completionGraceMs = 15_000 }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let completionSeenAt = null;
    let completionSignature = null;
    let completionStableSince = null;
    let terminationRequested = false;
    let spawnError = null;
    const started = Date.now();
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { spawnError = error; });

    const finish = (status, signal) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      resolve({
        status, signal, error: spawnError, stdout, stderr,
        durationMs: Date.now() - started,
        completedBy: completionSeenAt ? "completion_marker" : "process_exit",
        completionSeenAt,
        terminationRequested
      });
    };
    child.on("close", finish);

    const poll = setInterval(() => {
      if (!completionFile || !existsSync(completionFile)) return;
      const stat = statSync(completionFile);
      const signature = `${stat.size}:${stat.mtimeMs}`;
      if (signature !== completionSignature) {
        completionSignature = signature;
        completionStableSince = Date.now();
        return;
      }
      if (!completionSeenAt && Date.now() - completionStableSince >= 1_000) {
        try {
          if (JSON.parse(readFileSync(completionFile, "utf8")).status === "complete") completionSeenAt = new Date().toISOString();
        } catch { /* incomplete or invalid marker remains untrusted */ }
      }
      if (completionSeenAt && Date.now() - Date.parse(completionSeenAt) >= completionGraceMs && !terminationRequested) {
        terminationRequested = true;
        child.kill("SIGTERM");
        setTimeout(() => { if (!settled) child.kill("SIGKILL"); }, 5_000).unref();
      }
    }, 250);
    poll.unref();

    const timeout = setTimeout(() => {
      if (!terminationRequested) {
        terminationRequested = true;
        child.kill("SIGTERM");
        setTimeout(() => { if (!settled) child.kill("SIGKILL"); }, 5_000).unref();
      }
    }, timeoutMs);
  });
}
