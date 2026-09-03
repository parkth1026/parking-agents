# Browser bundled-plugin recovery

Read this reference when the in-app Browser plugin is unavailable, Browser bootstrap loads an old client, bundled-plugin materialization fails, or a Codex Home migration leaves stale marketplace paths.

## Confirmed Windows incident

The observed failure had several independent layers. Treat the version numbers and paths below as historical examples; rediscover current values before acting.

1. The desktop application bundled a newer Browser client/service than an older cached marketplace. Importing the old client failed because it used `node:process`, which the current Node REPL rejected.
2. The current service cache was absent. Restoring only that cache made Browser runtime initialization and public-page control pass, but Settings still showed the plugin unavailable. That was a partial repair.
3. Application logs repeatedly recorded `plugin_marketplace_folder_write_failed` and `bundled_plugins_marketplace_resolve_failed`. Direct `copyFile` from WindowsApps returned `UNKNOWN / errno -4094`; the app's encrypted-copy fallback recognized a different error value.
4. A byte-for-byte ordinary-file mirror let materialization finish, but materialization alone still did not install/register the plugin.
5. Codex Home had previously been a C-drive junction to E. Reserved bundled-marketplace validation treated logical C and physical E as different sources. Registration written for one Home became invalid after configuration moved back to a real C directory.
6. The decisive visible repair was to remove the stale E-drive marketplace registration, register the existing C-drive materialized marketplace using the official CLI, and install Browser from that marketplace. The semantic configuration change was limited to `marketplaces.openai-bundled.source`.

## High-signal diagnostics

### Home and path identity

Collect, without printing unrelated configuration:

- Process, User, and Machine `CODEX_HOME` values.
- `Get-Item ~/.codex` attributes, `LinkType`, and `Target`.
- The `marketplaces.openai-bundled.source` value.
- Current materialized marketplace path and `.materialization-key`.
- Current Browser cache versions.

A manifest existing at a path does not prove that the app-server accepts that path as the reserved source. When path identity is disputed, use version-matched `plugin/read` against both candidates. One path may pass while an alias to the same files fails.

### Official CLI boundary

Use the current app-matched CLI. Verify it against the installed app resource hash when multiple cached CLI versions exist.

```powershell
codex plugin list --marketplace openai-bundled --json
codex plugin marketplace list
```

An empty installed/available result with a valid materialized manifest indicates discovery/registration drift, not missing bytes.

### Log signals

Search current desktop logs narrowly for:

```text
plugin_marketplace_folder_write_failed
bundled_plugins_marketplace_resolve_failed
copyfile
browser-service.mjs
```

Redact credentials and quote only signal-bearing lines.

## Safe repair ladder

### Stale marketplace source

Use only when the current Home is authoritative, is not a reparse point, and contains a valid current materialized bundled marketplace.

1. Back up current config locally.
2. Run official marketplace removal for the stale registration.
3. Add `<current-home>/.tmp/bundled-marketplaces/openai-bundled` with the official CLI.
4. Install `browser@openai-bundled` with the official CLI.
5. Assert `installed=true`, `enabled=true`, current version, and current-Home source.
6. Reopen Settings → Browser for the user-visible acceptance check.

The CLI may reject adding a reserved marketplace from the signed WindowsApps source while accepting the app-materialized current-Home source. Respect that distinction; do not rename the marketplace or edit its manifest to evade the guard.

### Materialization copy failure

Prefer a fixed official app version. When a temporary local recovery is authorized:

- Source only from the signature-verified installed package.
- Verify the bundled marketplace identity and Browser manifest.
- Copy file contents to a versioned repair directory without inheriting unsupported encryption attributes.
- Verify every file with SHA-256.
- Use the application's existing resource-source hook only for the repair launch and record that the override is process-scoped.
- After launch, separately verify marketplace registration. Successful materialization is not completion.

This recovery can become stale after an application update. Discover and verify the new installed version each run; never reuse an old mirror silently.

## Failed approaches and why

- **Loading the first Browser client found on disk:** selected an obsolete client and produced a misleading runtime error. Select the registered/current version.
- **Restoring only `browser-service.mjs` and its cache:** fixed service bootstrap but not app plugin discovery.
- **Public-page DOM/click/screenshot as overall acceptance:** proved Browser transport, not Settings plugin availability.
- **Repeated ordinary restart:** repeated the same deterministic materialization or registration failure.
- **Resource mirror reported as a full fix:** materialization succeeded but the marketplace remained unregistered.
- **Changing permission toggles or enabling full CDP:** did not repair plugin registration and expanded risk without addressing the failure layer.
- **Treating `file://` denial as proof the plugin was missing:** URL policy is independent of runtime/plugin availability.
- **Carrying an E-drive source into a restored C-drive Home:** made a valid plugin invisible because reserved-source identity no longer matched.

## Completion matrix

| Claim | Required evidence |
|---|---|
| Official bytes restored | Source identity plus complete hash equality |
| Marketplace materialized | Current manifest, plugins, and materialization key exist |
| Browser registered | Official CLI/app-server lists Browser at the current source |
| Browser enabled | `installed=true` and `enabled=true` |
| Settings fixed | “In-app browser plugin unavailable” absent in the real Settings page |
| Browser runtime fixed | Current client initializes and selects intended Browser |
| Target page accepted | Original permitted URL/state works in the actual Browser |

Never substitute a lower row's prerequisite or a different row's result for the claim being made.
