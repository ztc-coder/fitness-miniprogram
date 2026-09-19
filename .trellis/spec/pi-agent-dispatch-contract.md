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

`task` must begin with the `Active task:` line:

```text
Active task: .trellis/tasks/<task-directory>
```

This is the first line of the **dispatch body**, not of the prompt the child actually receives. The global extension prepends a two-line preamble and delivers the body through a context artifact file, so the child sees:

```text
Complete your task autonomously. When you are finished, simply stop — your session ends automatically.

Active task: .trellis/tasks/<task-directory>
...
```

An Agent therefore must **scan** for the `Active task:` line (e.g. the first line matching `^Active task:`) instead of requiring the literal first line of the prompt. A strict line-1 match fails on every dispatch.

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

All project Trellis Agent definitions (`trellis-implement`, `trellis-check`, `trellis-research`) must declare:

```yaml
auto-exit: true
interactive: false
session-mode: standalone
system-prompt: append
```

This allows the global extension to close autonomous workers and deliver `subagent_result` to the parent session. An Agent without `auto-exit: true` keeps its pane and session open after the task finishes.

### Model resolution

Project Agent models are declared in `<project>/.pi/settings.json` under `subagents.agentOverrides`, not in Agent frontmatter:

```json
{
  "subagents": {
    "agentOverrides": {
      "trellis-implement": { "model": "pc-deepseek/deepseek-flash", "thinking": "high", "fallbackModels": [] },
      "trellis-check": { "model": "pc-grok/grok-4.6", "thinking": "medium", "fallbackModels": [] },
      "trellis-research": { "model": "pc-deepseek/deepseek-flash", "thinking": "low", "fallbackModels": [] }
    }
  }
}
```

The global extension merges `~/.pi/agent/settings.json` with `<project>/.pi/settings.json` as `{ ...userSettings.agentOverrides, ...projectSettings.agentOverrides }` — a **shallow spread keyed by Agent name**, not a field-level deep merge. Consequences:

- Project entries for Agent names the global file does not define (`trellis-implement` / `trellis-check` / `trellis-research`) are added and leave the global `scout` / `researcher` / `worker` / `reviewer` / `visual-tester` / `claude-code` entries intact.
- A project entry that reuses an existing global name replaces that whole entry. Declaring only `{ "model": "..." }` for `scout` drops the global `scout.thinking` and `scout.fallbackModels`; restate every field the Agent needs.

Resolution order for the effective model is `agentOverrides.<name>.model` → Agent frontmatter `model` → `subagents.defaultModel`; for thinking it is `agentOverrides.<name>.thinking` → frontmatter → `subagents.defaultThinking`; for fallbacks it is `agentOverrides.<name>.fallbackModels` → frontmatter. All of these are independent of the parent session model.

When `subagents.defaultModel` / `defaultThinking` happen to equal a project override's values, the resolved model string cannot distinguish "override applied" from "fell back to default". Verify with a field unique to the project entry — `fallbackModels` is the reliable discriminator, and it appears in the child's session `*.loadout.json` and in the child's `PI_SUBAGENT_FALLBACK_MODELS`.

### Fallback

`TRELLIS_NATIVE_SUBAGENT=1` is an emergency compatibility switch only. It restores the old native tool and its progress-card shortcut without changing Trellis context injection.

## 4. Validation & Error Matrix

| Condition | Expected behavior |
| --- | --- |
| Environment variable is unset or not exactly `1` | No local `trellis_subagent` tool and no local `Alt+O` shortcut; global `subagent` remains available. |
| `TRELLIS_NATIVE_SUBAGENT=1` | Native fallback tool and `Alt+O` are registered. |
| Dispatch body does not start with `Active task:` | Agent falls back to `task.py current --source`; callers should still treat the dispatch as invalid and correct it. |
| Agent requires `Active task:` on the literal first line of the prompt | Always fails: the extension prepends a two-line preamble. Match with a `^Active task:` scan. |
| Project `agentOverrides` entry reuses a global Agent name with only some fields | The global entry is replaced wholesale, silently dropping its other fields. |
| Agent definition is missing | Global extension cannot discover the role; do not silently substitute a different Agent. |
| Global extension or tmux is unavailable | Native fallback may be enabled for the current Pi process; record the limitation rather than changing global extension code. |
| Context handler is changed while adding the switch | Reject the change; dispatch gating must not wrap Trellis context injection. |
| Agent frontmatter uses a `description: |` block scalar | The global extension's line-based frontmatter parser reads `description` as `|`, so the Agent picker shows an empty description. Use a single-line value. |
| Project `subagents.agentOverrides` omits a Trellis Agent | That Agent silently runs on `subagents.defaultModel` + `subagents.defaultThinking` instead of the intended role model. Indistinguishable from a working override when the default equals the intended values; check `fallbackModels` instead. |

## 5. Good / Base / Bad Cases

- Good: `subagent({ agent: "trellis-check", task: "Active task: .trellis/tasks/09-19-pi-subagent-dispatch-migration\n\nReview the changes." })`.
- Base: `TRELLIS_NATIVE_SUBAGENT=1` is used temporarily when the global dispatch path cannot start; context injection still remains active.
- Bad: registering both `trellis_subagent` and `subagent` by default, because the model can select different lifecycle implementations unpredictably.
- Bad: calling the global tool with `prompt`, because the global extension expects `task`.
- Bad: importing private functions from the global extension by absolute path, because its lifecycle depends on the host ExtensionAPI and can change independently.

## 6. Tests Required

- Static contract check: default registration path excludes `trellis_subagent` and `Alt+O`; the exact opt-in value restores both.
- Context regression check: `session_start`, `tool_call`, `before_agent_start`, and `TRELLIS_CONTEXT_ID` remain registered outside the dispatch condition.
- Agent manifest check: project `trellis-implement`, `trellis-check`, and `trellis-research` resolve with the four lifecycle frontmatter values above, and each `description` parses to a non-empty single-line string.
- Model override check: merged `subagents.agentOverrides` contains project `trellis-implement` / `trellis-check` / `trellis-research` entries alongside the global `scout` / `researcher` / `worker` / `reviewer` / `visual-tester` / `claude-code` entries.
- Dispatch smoke check: a real `subagent({ agent: "trellis-implement", task: "Active task: <dir>\n\n..." })` resolves `<dir>`, reads its `prd.md` and the specs listed in its `implement.jsonl`, and writes a probe artifact; a dispatch with no `Active task:` line must degrade without guessing. Verified 2026-09-19 against `3c36184`.
- Override discrimination check: the child's `*.loadout.json` and `PI_SUBAGENT_FALLBACK_MODELS` carry the project `fallbackModels`, which is the only field that separates an applied override from `defaultModel` when their values coincide.
- Lifecycle check: both children exit on their own, deliver `subagent_result`, and leave no tmux pane behind.
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

Context handlers remain outside this condition, and the main workflow calls the global tool with `task` and the `Active task:` dispatch line.
