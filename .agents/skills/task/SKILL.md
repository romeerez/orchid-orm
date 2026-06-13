---
name: task
description: Use when the user prompts "do task".
---

Implement the mandatory section `0` preflight first, then implement only the requested checkbox tasks from an existing change.
Each selected checkbox task includes its nested plain subtask list; those nested subtasks are part of the selected task and are not independently selectable.

**Input**

- feature folder in `changes/`
- idea number or idea title
- task selector, unless explicit multi-agent mode should run all selectable tasks

Examples:

- `do task 123 2 1.1`
- `do task 123 2 "from 1 till 2"`
- `do task abc 2 "all from 1"`
- `do task 123 2 in multi-agent mode` runs all selectable tasks from section `1` onward

**Selectors**

- `1`: all selectable checkbox tasks in section `1`, with each selected task's nested subtasks
- `1.1`: only checkbox task `1.1` and its nested subtasks
- `from 1 till 2`: all selectable checkbox tasks in sections `1` through `2`, with each selected task's nested subtasks
- `all from 1`: all selectable checkbox tasks from section `1` to the end, with each selected task's nested subtasks
- selectors like `1.1.1` are invalid because nested subtasks are not independently selectable

If no task selector is provided, ask one focused clarification question by default.
If no task selector is provided and the user explicitly requested multi-agent mode, do not ask for clarification; use `all from 1`.

Only checkbox lines like `- [ ] 1.2 ...` in sections after `0` are selectable tasks.
Nested plain list items like `- 1.2.1 ...` are required subtasks of their parent checkbox task and are not separately selectable.
Section `0` is mandatory preflight, not part of the selector. Section headers are not tasks.

**Execution mode**

Default to single-agent execution.
Use multi-agent execution only when the user explicitly asks for it; mentioning `multi` is enough.
Do not infer multi-agent execution from task count, complexity, ranges, or `all` selectors.

In multi-agent mode, the main agent remains the coordinator and owns folder resolution, selector resolution, section `0` preflight, checkbox state changes in `tasks.md`, verification decisions, and the final report.
Dispatch agents only after section `0` is fully complete and the selected checkbox tasks are resolved.
Dispatch exactly one agent for one selected parent checkbox task at a time, in file order.
Wait for that agent to finish, inspect its changes, and verify the task before dispatching the next agent.
Do not run agents in parallel.

Each task agent must receive:

- the exact change folder path
- the selected parent checkbox task and its nested subtasks
- the requirement to read `spec.md` and every applicable guideline doc before editing
- the instruction to implement only that parent task and its nested subtasks
- the instruction not to edit checkbox state in `tasks.md`
- the verification commands or nested verification subtasks it must run or report as blocked

**Workflow**

1. Resolve `changes/<feature-name>/<id-idea-name>`.
   Match feature by exact or clearly intended folder name.
   If the feature input is a bare number, such as an issue number, it must be enough to match exactly one `changes/<number>-*` feature folder.
   The id can be a number, such as an issue number, or an abbreviation, such as `abc`.
   Match idea by finding a folder in the feature folder that starts with that id, or by clearly intended title suffix.
   If ambiguous, ask one focused question. Do not guess.
   If no matching feature or idea exists, stop.

2. Require these files:
   - `changes/<feature-name>/<id-idea-name>/tasks.md`
   - `changes/<feature-name>/<id-idea-name>/spec.md`
     If either is missing, stop. Do not create files in this command.

3. Read `tasks.md` fully before starting.
   `tasks.md` is authoritative for the task list, numbering, mandatory `0` preflight, and required pre-read files.
   `tasks.md` must start with `## 0. read spec.md and guidelines`.
   That section must contain plain numbered `0.1` and `0.2` items without checkboxes.
   The unnumbered guideline bullets under section `0` are supporting lines, not additional tasks or selectors.
   After section `0`, only affected package sections and, when needed, a `docs` section for repo-root `docs/` work are valid implementation sections.
   After section `0`, every implementation task must be a checkbox item such as `- [ ] 1.1 ...` that owns an indented nested plain subtask list whose visible text starts with the parent task number, such as `1.1.1`, `1.1.2`, `2.3.1`, and so on.
   If the mandatory `0` section is missing or malformed, or if later tasks do not follow that parent-task-plus-subtasks format, stop and report it.

4. Unconditionally perform all tasks in section `0` before continuing.
   Do not treat `0.1` or `0.2` as optional.
   Do not treat `0.1` or `0.2` as selector-controlled.
   Complete both of them in full before resolving or starting any requested checkbox task.
   This is mandatory even when the selector starts at section `1` or later.
   Read `spec.md` and every guideline doc named in `tasks.md` exactly as section `0` requires.
   Read, understand, and obey them before implementing.

5. Resolve the selector against the selectable checkbox tasks in `tasks.md`.
   If no selector was provided and execution mode is single-agent, ask one focused clarification question before resolving tasks.
   If no selector was provided and execution mode is explicit multi-agent, resolve the selector as `all from 1`.
   Keep the matched tasks in file order.
   If the selector points to a nested subtask such as `1.1.1`, stop and report that only parent checkbox tasks are selectable.
   If nothing matches, stop.

6. Only work on all tasks in the 0 section and on the selected tasks whose checkbox is exactly `[ ]`.
   If a requested task is already `[-]` or `[x]`, stop and report it.
   If a requested range includes any `[-]` or `[x]` task, stop and report the blocking tasks.
   Do not partially start a blocked range.

7. Implement only the selected checkbox tasks, one at a time.
   When starting a task, change `[ ]` to `[-]`.
   Use that task's nested subtask list as the required work for the task.
   Implement every nested subtask under that selected checkbox task, and only the code or docs strictly needed for its spec-defined behavior.
   Do not intentionally do adjacent or future tasks.
   In single-agent mode, implement the task directly.
   In multi-agent mode, dispatch exactly one sequential task agent for the current parent checkbox task and wait for it to finish.
   Review the agent's result and inspect the workspace before deciding whether verification is complete.
   When that single parent task is implemented and verified, and all of its nested subtasks are complete, change `[-]` to `[x]`.
   If blocked mid-task, leave it as `[-]` and explain why.
   If a task agent is blocked or verification fails, leave the task as `[-]`, stop dispatching further task agents, and report the blocker.

8. Verify before marking `[x]`.
   Honor the nested verification subtasks exactly as written for the selected task.
   Run the relevant tests or checks for the affected code.
   For coding tasks, ensure the implementation conforms to the applicable guidelines, make sure test coverage for the implementation is not missing, run `pnpm <pkg> check` and `pnpm <pkg> types` for each affected package, and update `spec.md` first if user-prompted changes meaningfully affect the feature.
   If verification fails or cannot be run, do not mark `[x]`.

9. Report:
   - requested task selector
   - execution mode used: single-agent or sequential multi-agent
   - confirmation that section `0` was fully completed before any selected task
   - tasks completed in this session
   - any task left as `[-]`
   - verification that was run

**Guardrails**

- Do not create or infer missing change folders, idea folders, `tasks.md`, or `spec.md`
- Do not guess when the feature, idea, or selector is ambiguous
- Do not skip `tasks.md`, the mandatory section `0`, `spec.md`, or guideline docs referenced by `tasks.md`
- Do not treat section `0` as optional or selector-controlled
- Do not treat the supporting guideline bullets under section `0` as additional tasks or selectors
- Do not ask for a missing task selector when the user explicitly requested multi-agent mode; resolve it as `all from 1`
- Do ask for a missing task selector in single-agent mode
- Do not start any selected checkbox task until both `0.1` and `0.2` are fully completed
- Do not treat nested plain subtask lines such as `1.1.1` as independently selectable tasks
- Do not work on selectable tasks unless their checkbox is `[ ]`
- Do not use multi-agent execution unless the user explicitly asks for it; mentioning `multi` is enough
- Do not run task agents in parallel; multi-agent execution is sequential only
- Do not let task agents edit checkbox state in `tasks.md`; the coordinator owns task state
- Do not mark a parent checkbox task `[x]` before all of its nested subtasks are complete and verification is complete for that single task
- Do not implement anything outside the exact requested selector other than the mandatory section `0` preflight
