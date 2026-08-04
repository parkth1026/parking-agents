# Installing parking-skills on OpenCode

Add the repository as a plugin in your `opencode.json`:

```json
{
  "plugin": ["https://github.com/parkth1026/parking-agents"]
}
```

OpenCode resolves the plugin entry point from the repo-root `package.json` `main` field, which points at `.opencode/plugins/parking-skills.js`.

## What the plugin does

1. **Registers the skills directory** — the `config` hook appends `skills/` to `config.skills.paths`, so OpenCode's native `skill` tool discovers all skills in the library.
2. **Injects the bootstrap** — `experimental.chat.messages.transform` prepends the `using-parking-skills` skill (plus the OpenCode tool mapping) to the first user message.

Without step 2 the skills sit on disk and are never invoked. The bootstrap *is* the integration.

## Verifying it works

Open a clean session and send a message that should trigger a skill without naming it, e.g.:

> Help me write a PowerShell script that checks disk space.

`ps1-creator` should be invoked **before** any script is written. If it isn't, the bootstrap is not reaching the model — check that the plugin loaded and that `.opencode/plugins/parking-skills.js` is resolvable from the repo root.

## Tool mapping

OpenCode's mapping is **not** in `skills/using-parking-skills/references/`. It lives inline in `openCodeToolMapping()` inside `.opencode/plugins/parking-skills.js`, because Shape B injects it directly rather than making the model go read a file. That function is the single source of truth — do not copy the table into this file, or it will drift.
