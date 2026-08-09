---
name: making-skills-cross-platform
description: Convert a single-platform skills repository into a plugin that installs on many harnesses (Claude Code, Codex, Cursor, Pi, Gemini, OpenCode, Kimi, Antigravity) through each one's own native mechanism. Use when a skills repo only works on one tool, when adding a new harness to an existing multi-platform repo, or when auditing whether such a repo is correctly wired.
disable-model-invocation: true
---

# Making a skills repo cross-platform

## The one thing that makes this hard

**Every failure mode here is silent.** A skill with indented frontmatter, buried
one directory too deep, or naming a tool only one platform has, does not error.
It does not warn. It simply never fires, on every platform, forever.

So this skill is structured around a checker, not around prose. Run it first, run
it after every step, and do not declare anything done while it reports a failure.

## Before anything else: baseline

Run the bundled checker against the target repository:

```
node <this-skill>/scripts/check-skill-repo.mjs <repo-root>
```

Useful flags:

| Flag | When |
|---|---|
| `--skills <dir>` | the skills are not at `<repo>/skills` — e.g. grouped under `skills/<category>/<name>/SKILL.md`, where the real scan root is one level down |
| `--bootstrap <name>` | the bootstrap skill is not named `using-*` |
| `--allow <prefix>,<prefix>` | a skill legitimately names tools (e.g. a converter whose *subject* is tool names, or the adapter files themselves) |
| `--json` | you want to diff two runs |

**Get the scan root right before reading anything else.** Point it at the wrong
directory and the per-skill checks examine zero skills. The checker fails rather
than passes in that case, but the failure it reports is "wrong scan root", not
the real state of the repo.

Record the baseline. Everything below is measured against it.

## The three-part architecture

Everything follows from this. Do not skip it — most bad ports come from missing
part 3.

1. **Skills are platform-agnostic.** One `skills/` tree, shared verbatim, zero
   build step. Bodies describe **actions** ("read a file", "run a shell command",
   "dispatch a subagent", "create a todo"), never tool names.

2. **A tool mapping per harness, listing only what differs.** Translates the
   action vocabulary into that platform's real tools. Platforms whose tool
   surface already covers every action get **no mapping file at all**.

3. **A bootstrap injector per harness.** At every session start, the bootstrap
   skill's full text is injected into the model's context wrapped in
   `<EXTREMELY_IMPORTANT>` tags.

> **The bootstrap IS the integration.** Without it the skills are inert: present
> on disk, discoverable, never invoked. A port that adds a manifest but no
> bootstrap has done nothing.

### Two rules that are never bent

**Rule 1 — Skills name actions, not tools.** Porting adds a mapping file and an
injector. It never reaches into a skill body to swap a tool name. If a platform
lacks a capability, the fix goes in that platform's mapping as a documented
degradation.

**Rule 2 — Ship through the platform's own install mechanism.** Never write the
user's global config (`~/.codex/config.toml`, `settings.json`, shell rc files).
If a platform's install mechanism cannot carry the bootstrap, that is a
**limitation to state honestly**, not a licence to edit user files.

## Workflow

### 1. Decide which harnesses are even possible

**Hard requirement:** the platform must allow injecting text into the model's
context at every session start, with no per-session action by the user. Any
form counts — a session-start hook, an in-process plugin callback, or an
instructions file the extension itself declares and installs.

If the only route is the user pasting a prompt each session, **that platform
cannot be supported.** Say so and move on.

Everything else degrades. Read `references/harness-blueprint.md` for the
capability table and what each degradation looks like.

### 2. Flatten the skills tree

`skills/<name>/SKILL.md`, exactly one level. Harnesses scan one level deep;
`skills/category/name/SKILL.md` loads nowhere.

Frontmatter needs unindented `name` (matching the directory name exactly) and
`description`. Descriptions state **when to use**, not what the skill does.

### 3. Convert bodies to action language

Search the bodies for every harness's tool vocabulary — the checker's denylist is
the list to work from. Replace each with the action it stands for.

For subagent work, use the harness-neutral dispatch block:

```
Subagent (general-purpose):
  description: "<one-line task name>"
  model: <required where the harness supports it>
  prompt: |
    <the full prompt>
```

**Expect one or two legitimate exceptions** — a skill whose actual subject is
tool-name conversion, for instance. Allowlist those by path and write the reason
down next to the allowlist. Keep that list short: every entry weakens the rule.

### 4. Write the bootstrap skill

One skill, conventionally `using-<repo>-skills`, that states:

- Invoke a relevant skill **before** any response or action, including
  clarifying questions
- Skills speak in actions; perform each with whatever tool does that job
- The subagent dispatch block and how to translate it
- A **Platform Adaptation** section pointing at each harness's mapping file
- A red-flags table for the rationalisations that skip skill invocation

This file is the only thing injected at session start, so everything the model
must know at turn zero lives here.

### 5. Wire each harness

Four integration shapes. `references/harness-blueprint.md` has the exact files,
manifest fields, and traps for each.

| Shape | Mechanism | Typical harnesses |
|---|---|---|
| A | Shell hook, stdout is injected | Claude Code, Cursor, Copilot CLI |
| B | In-process plugin rewrites the message array | Pi, OpenCode |
| C | Instructions file the extension declares | Gemini CLI |
| D | Manifest declares the bootstrap; platform loads it | Codex, Kimi Code |

**Adding a pointer line to the bootstrap's Platform Adaptation section is the
only edit to a `SKILL.md` a port may make**, and only because that section is a
pointer list rather than behaviour-shaping content.

### 6. Register versions for lockstep

Every manifest carrying a version goes into `.version-bump.json`. An unregistered
manifest ships a stale version indefinitely, and nothing complains.

### 7. Test what you cannot run

Most of these platforms cannot be installed on the machine doing the port. Write
**doc-contract tests** instead — they pin the contract without the harness:

- the manifest declares the fields that harness actually reads
- the bootstrap points at files that exist (a dangling include loads **empty**,
  silently)
- the mapping names tools that platform actually has
- an in-process injector's dedup guard really blocks a second injection

Doc-contract tests prove the wiring is intact. They **do not** prove it runs.

### 8. Acceptance test — the only proof that counts

Open a **clean session** on the harness and send a request that should trigger a
skill **without naming it**. The skill must fire **before** any other work
begins. Keep the transcript.

Track per-harness verification status honestly. A harness with passing contract
tests and no transcript is **unverified** — mark it so in the docs and do not
claim support for it.

## Red flags

| Thought | Reality |
|---|---|
| "The skill says to use a specific tool, I'll just rename it for this platform" | That breaks Rule 1. The fix goes in the mapping file. |
| "Contract tests pass, so the harness works" | They prove the wiring, not the run. Only a transcript proves the run. |
| "I'll copy the injector from the other in-process platform" | Message object shapes and callback frequencies differ per platform. Copying silently double-injects or never injects. |
| "The manifest is added, the port is done" | Without a bootstrap the skills are never invoked. |
| "This platform needs the user to enable it each session" | Then it cannot be supported. Say so. |
| "No mapping file for this harness, so it's unsupported" | No file means no adaptation needed. That is the normal case. |
| "I'll note the platform as supported in the README now" | Not until the acceptance test passes. |
