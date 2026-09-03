---
name: fix-codex
description: Diagnose and safely repair Codex desktop setup failures, especially missing bundled plugins, an unavailable in-app Browser, stale marketplace paths after CODEX_HOME migration, bundled-plugin copy failures, or version-skewed Browser runtimes. Use for Codex installation, configuration, plugin discovery, Browser bootstrap, and recurring desktop recovery problems; not for bugs in the user's application or website.
---

# Fix Codex

Treat the user's visible symptom as the acceptance target. A successful file copy, CLI command, HTTP request, or public-page smoke test is supporting evidence, not proof that the Codex surface is fixed.

## Evidence ladder

1. **Visible symptom:** capture the exact unavailable banner, toast, settings row, or runtime error.
2. **Discovery:** inspect current plugin state with the official CLI and app-server schema for the installed version.
3. **Registration:** verify marketplace source, installed path, version, `installed`, and `enabled` all resolve under the same current Codex Home.
4. **Runtime:** initialize the current bundled client and select the intended Browser or capability.
5. **User journey:** repeat the original permitted action in the real UI. Keep URL-policy denials, plugin availability, and page behavior as separate verdicts.

Report every layer as `PASS`, `FAIL`, `BLOCKED`, or `NOT_RUN`. Stop short of “fixed” until the user's original visible symptom passes.

## Workflow

### 1. Establish current authority

- Search and fetch current official OpenAI documentation for the exact Codex feature or error before changing the installation.
- Re-read current filesystem and process state. Treat old repair notes, cached plugin versions, and previous drive layouts as historical evidence.
- Resolve `$CODEX_HOME`, `~/.codex`, reparse points, environment overrides, the installed Appx version, current `codex.exe`, and the running desktop process.
- When the user says they migrated or restored configuration, that statement supersedes earlier path assumptions. Verify the new state and preserve it.

Run [`scripts/inspect_codex_browser.ps1`](scripts/inspect_codex_browser.ps1) without mutation first when Browser or bundled-plugin discovery is involved.

### 2. Build a tight loop

Choose the smallest command that reproduces the user's symptom boundary:

- Plugin discovery: `codex plugin list --marketplace openai-bundled --json` should return the expected plugin as installed and enabled.
- Marketplace parsing: use the app-server `plugin/read` or version-matched generated schema when path validity is disputed.
- Browser bootstrap: import the client version registered by the current runtime, then initialize the service.
- UI: reopen Settings → Browser and verify that the unavailable state is gone.

Keep this loop red-capable. A public website Browser smoke test cannot catch an unavailable settings plugin; cache integrity cannot catch a stale marketplace registration.

### 3. Classify before repairing

Use these independent failure classes:

| Class | Evidence | Repair direction |
|---|---|---|
| Version skew | Client, service registration, cache, or app bundle versions differ | Select the current registered/app-bundled version; do not keep importing an older discovered path |
| Materialization failure | App logs show `plugin_marketplace_folder_write_failed`, `copyfile`, or missing current marketplace files | Prefer app update/reinstall; if recovery is necessary, read the incident reference before copying official bytes |
| Registration drift | `plugin list` is empty while the materialized manifest exists; configured source points at an old drive or Home | Re-register the current materialized marketplace with the official CLI |
| Home identity split | Junction/logical and physical paths receive different reserved-source decisions | Choose one canonical Codex Home; avoid mixing path identities in one repair |
| Runtime cache | The correct service exists but a failed import remains cached | Reset only the failed runtime/kernel, then bootstrap once with the current client |
| URL policy | Browser initializes but a specific URL is rejected by Browser policy | Preserve the policy boundary; do not disguise or reroute the same target |

Read [`references/browser-plugin-recovery.md`](references/browser-plugin-recovery.md) for the confirmed Windows failure chain, repair ladder, and failed approaches.

### 4. Repair narrowly

Prefer supported mutations in this order:

1. Current official Codex update or reinstall.
2. Correct a stale current-Home registration with the official `codex plugin marketplace` and `codex plugin add` commands.
3. Restore missing current official cache files only from the signature-verified installed package, preserving byte equality and recording hashes.
4. Use a process-scoped official resource-source override only as a temporary diagnostic recovery. It does not replace registration repair.

Before mutation:

- Back up current `config.toml` locally without printing it.
- Capture the existing marketplace source and current CLI result.
- Verify every computed destination stays inside the intended Codex Home or repair directory.
- Preserve old source directories unless the user explicitly requests cleanup.
- Keep security policy, trust registration, app binaries, and plugin instructions unchanged.

For the common stale-source case, `scripts/inspect_codex_browser.ps1 -RepairRegistration` performs guarded official CLI registration. It refuses to repair through a reparse-point Home and requires the current materialized Browser manifest.

### 5. Verify and clean up

- Re-run the original red loop.
- Confirm the final marketplace source and installed Browser path use the current Home and version.
- Verify the settings UI, then Browser runtime, then one permitted real interaction and screenshot when relevant.
- Keep local-file URL rejection separate from plugin availability. Do not weaken URL policy or use an alternate transport to reach the same rejected content.
- Remove only temporary tabs and processes created by this run. Stop only captured PIDs.
- Record the exact remaining manual step if UI evidence is still required.

## Decision impact

- **Benefit:** restores the user's actual Codex capability and leaves auditable evidence at each layer.
- **Cost:** drive migrations and app upgrades can invalidate cached path/version assumptions; live UI acceptance may require one restart or user-visible check.
- **User impact:** plugin registration and settings availability may change; repository files and the user's application should remain untouched.
- **If skipped:** partial recovery can look successful while Settings still reports the plugin unavailable, leading to repeated blind restarts and increasingly invasive workarounds.
