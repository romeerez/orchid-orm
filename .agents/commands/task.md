---
name: 'Task'
description: Resolve a change task list from `changes/` and implement only the requested tasks
category: Workflow
tags: [workflow, implementation, tasks, changes]
---

Implement the mandatory section `0` preflight first, then implement only the requested checkbox tasks from an existing change.

**Input**

- feature folder in `changes/`
- idea number or idea title
- task selector

Examples:

- `/task row level security 2 1.1`
- `/task row level security 2 "from 1 till 2"`
- `/task row level security 2 "all from 1"`

**Selectors**

- `1.1`: only task `1.1`
- `from 1 till 2`: all numbered checkbox tasks in sections `1` through `2`
- `all from 1`: all numbered checkbox tasks from section `1` to the end

Only checkbox lines like `- [ ] 1.2 ...` in sections after `0` are selectable tasks. Section `0` is mandatory preflight, not part of the selector. Section headers are not tasks.

**Workflow**

1. Resolve `changes/<feature-name>/<NUMBER-idea-name>`.
   Match feature by exact or clearly intended folder name.
   Match idea by exact number or clearly intended title suffix.
   If ambiguous, ask one focused question. Do not guess.
   If no matching feature or idea exists, stop.

2. Require these files:
   - `changes/<feature-name>/<NUMBER-idea-name>/tasks.md`
   - `changes/<feature-name>/<NUMBER-idea-name>/spec.md`
     If either is missing, stop. Do not create files in this command.

3. Read `tasks.md` fully before starting.
   `tasks.md` is authoritative for the task list, numbering, mandatory `0` preflight, and required pre-read files.
   `tasks.md` must start with `## 0. read spec.md and guidelines`.
   That section must contain plain numbered `0.1` and `0.2` items without checkboxes.
   If the mandatory `0` section is missing or malformed, stop and report it.

4. Unconditionally perform all tasks in section `0` before continuing.
   Do not treat `0.1` or `0.2` as optional.
   Do not treat `0.1` or `0.2` as selector-controlled.
   Complete both of them in full before resolving or starting any requested checkbox task.
   This is mandatory even when the selector starts at section `1` or later.
   Read `spec.md` and every guideline doc named in `tasks.md` exactly as section `0` requires.
   Read, understand, and obey them before implementing.

5. Resolve the selector against `tasks.md`.
   Keep the matched tasks in file order.
   If nothing matches, stop.

6. Only work on all tasks in the 0 section and on the selected tasks whose checkbox is exactly `[ ]`.
   If a requested task is already `[-]` or `[x]`, stop and report it.
   If a requested range includes any `[-]` or `[x]` task, stop and report the blocking tasks.
   Do not partially start a blocked range.

7. Implement only the selected checkbox tasks, one at a time.
   When starting a task, change `[ ]` to `[-]`.
   Implement only that task and the code strictly needed for its spec-defined behavior.
   Do not intentionally do adjacent or future tasks.
   When that single task is implemented and verified, change `[-]` to `[x]`.
   If blocked mid-task, leave it as `[-]` and explain why.

8. Verify before marking `[x]`.
   Run the relevant tests or checks for the affected code.
   If TypeScript files changed, run the relevant type checks for the current package and its dependents.
   If verification fails or cannot be run, do not mark `[x]`.

9. Report:
   - requested task selector
   - confirmation that section `0` was fully completed before any selected task
   - tasks completed in this session
   - any task left as `[-]`
   - verification that was run

**Guardrails**

- Do not create or infer missing change folders, idea folders, `tasks.md`, or `spec.md`
- Do not guess when the feature, idea, or selector is ambiguous
- Do not skip `tasks.md`, the mandatory section `0`, `spec.md`, or guideline docs referenced by `tasks.md`
- Do not treat section `0` as optional or selector-controlled
- Do not start any selected checkbox task until both `0.1` and `0.2` are fully completed
- Do not work on selectable tasks unless their checkbox is `[ ]`
- Do not mark `[x]` before implementation and verification are complete for that single task
- Do not implement anything outside the exact requested selector other than the mandatory section `0` preflight
