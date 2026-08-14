# Run interface standard

## Protocol

- Ship `run.cmd`, `run`, `run.toml`, and `scripts/run.mjs` in the repository.
- Require Node only for the interface itself; require no global run CLI.
- Use `[project]` with one `id = "namespace/name"`.
- Use repeated `[[actions]]` tables with `id`, `name`, `kind`, and `run`.
- Restrict `kind` to `task`, `open`, `test`, or `gate`.
- Restrict action ids to unique lowercase dot-separated tokens.
- Reserve `list`, `show`, `doctor`, `help`, and `run`.
- Execute `run` as an argv array with `shell: false` from the repository root.
- Match commands, action ids, and option names without case sensitivity.

Example:

```toml
[project]
id = "acme/widget"

[[actions]]
id = "build"
name = "Build"
kind = "task"
run = ["npm", "run", "build"]
```

## Command surface

- Bare `run` and `run list` list all actions.
- `run show <id>` describes one action.
- `run doctor` validates wrappers, configuration, Node, and action executables.
- `run help` prints usage.
- `run run <id>` is an explicit alias; `run <id>` is the preferred first-level form.
- `-n` and `--dry-run` generate a plan without launching a child process.
- `--json` applies to every command.

## Exit semantics

- Return the child process exit code unchanged after a child starts.
- Use runner-owned codes `64` for usage or unknown action, `65` for invalid configuration, `69` for an unavailable executable, and `70` for an internal runner failure.
- Use the JSON `origin` field (`run` or `child`) with `exitCode` to distinguish ownership. The exact field set remains provisional until the run/v1 Schema batch.

## Machine and terminal result contract

- Keep JSON stdout to exactly one JSON document plus its terminating newline.
- Route child stdout and stderr to stderr while `--json` is active so child text cannot corrupt JSON.
- Include `schema = "run/v1"`, status, exit code, and the command-specific action or check data.
- Treat structured JSON and the process exit code as authoritative. Never parse human headings.
- Keep human query output concise and readable on stdout.
- Put human execution plans, errors, and final outcomes on stderr.
- Label preview as not executed; never present it as successful execution.
- Derive human outcomes from actual process results, never from words printed by the child.

## Integration boundaries

- Append only the run integration sentence to an existing `AGENTS.md`; preserve its existing bytes.
- Do not wrap Git operations.
- Do not edit existing task definitions, package scripts, or task-runner commands.
- Treat missing gate tooling as expected unavailability for `kind = "gate"`; keep those actions visible in list and doctor.
- Keep templates and the runner dependency-free so cloning a standardized repository is sufficient.
