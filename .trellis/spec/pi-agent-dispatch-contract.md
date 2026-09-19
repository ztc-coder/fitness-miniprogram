# Pi Agent Dispatch Contract

## 1. Scope / Trigger

This contract applies to the project-local Pi integration under `.pi/` and `.trellis/workflow.md`.

Trigger: the project uses the global `pi-interactive-subagents` extension for Trellis worker sessions while the local Trellis extension remains responsible for workflow and task context injection.

The global extension is outside this repository and must not be modified by project changes.

## 2. Signatures

The default Pi dispatch tool is registered by the global extension:

```ts
subagent({
  agent: "trellis-implement" | "trellis-check",
  name?: string,
  task: string,
  cwd?: string,
  model?: string,
})
```

The first line of `task` is mandatory:

```text
Active task: .trellis/tasks/<task-directory>
```

The local Trellis extension has an opt-in compatibility tool:

```text
TRELLIS_NATIVE_SUBAGENT=1 -> register trellis_subagent and Alt+O
unset/other value          -> do not register either
```

## 3. Contracts

### Dispatch

- `subagent` is the only default Pi dispatch entry point.
- Use `task`, not `prompt`, for the global extension API.
- `trellis-implement` and `trellis-check` are project-level Agent definitions under `.pi/agents/`.
- The Agent reads the task manifest and task artifacts itself; the local Trellis extension does not need to inject its native subagent prompt into the child.

### Context

The local Trellis extension must continue to register `session_start`, `tool_call`, `before_agent_start`, and context-related handlers. Bash calls receive the current `TRELLIS_CONTEXT_ID` unless the command already supplies one.

### Agent lifecycle

Both project Trellis Agent definitions must declare:

```yaml
auto-exit: true
interactive: false
session-mode: standalone
system-prompt: append
```

This allows the global extension to close autonomous workers and deliver `subagent_result` to the parent session.

### Fallback

`TRELLIS_NATIVE_SUBAGENT=1` is an emergency compatibility switch only. It restores the old native tool and its progress-card shortcut without changing Trellis context injection.

## 4. Validation & Error Matrix

| Condition | Expected behavior |
| --- | --- |
| Environment variable is unset or not exactly `1` | No local `trellis_subagent` tool and no local `Alt+O` shortcut; global `subagent` remains available. |
| `TRELLIS_NATIVE_SUBAGENT=1` | Native fallback tool and `Alt+O` are registered. |
| Dispatch task does not start with `Active task:` | Agent falls back to `task.py current --source`; callers should still treat the dispatch as invalid and correct it. |
| Agent definition is missing | Global extension cannot discover the role; do not silently substitute a different Agent. |
| Global extension or tmux is unavailable | Native fallback may be enabled for the current Pi process; record the limitation rather than changing global extension code. |
| Context handler is changed while adding the switch | Reject the change; dispatch gating must not wrap Trellis context injection. |

## 5. Good / Base / Bad Cases

- Good: `subagent({ agent: "trellis-check", task: "Active task: .trellis/tasks/09-19-pi-subagent-dispatch-migration\n\nReview the changes." })`.
- Base: `TRELLIS_NATIVE_SUBAGENT=1` is used temporarily when the global dispatch path cannot start; context injection still remains active.
- Bad: registering both `trellis_subagent` and `subagent` by default, because the model can select different lifecycle implementations unpredictably.
- Bad: calling the global tool with `prompt`, because the global extension expects `task`.
- Bad: importing private functions from the global extension by absolute path, because its lifecycle depends on the host ExtensionAPI and can change independently.

## 6. Tests Required

- Static contract check: default registration path excludes `trellis_subagent` and `Alt+O`; the exact opt-in value restores both.
- Context regression check: `session_start`, `tool_call`, `before_agent_start`, and `TRELLIS_CONTEXT_ID` remain registered outside the dispatch condition.
- Agent manifest check: project `trellis-implement` and `trellis-check` resolve with the four lifecycle frontmatter values above.
- Pi startup check: default mode discovers the global `subagent` tool and no native `trellis_subagent`; fallback mode loads the native tool.
- Project regression check: `npm test -- --runInBand` passes.

## 7. Wrong vs Correct

### Wrong

```ts
pi.registerTool({ name: "trellis_subagent", ... });
```

This exposes the local implementation by default and competes with the global `subagent` tool.

### Correct

```ts
const nativeSubagentEnabled = process.env.TRELLIS_NATIVE_SUBAGENT === "1";

if (nativeSubagentEnabled) {
  pi.registerTool({ name: "trellis_subagent", ... });
}
```

Context handlers remain outside this condition, and the main workflow calls the global tool with `task` and the `Active task:` preamble.
