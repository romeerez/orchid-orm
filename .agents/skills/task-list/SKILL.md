---
name: task-list
description: Use when user asks to write a task list, not to do a task
---

Create or update exactly:

- `tasks.md` in the same directory as the provided `spec.md`

This is a task-list command for an existing spec, not research-only and not implementation.

By default, write a full task list that covers the complete spec. Only write a
partial task list when the user explicitly asks for a limited scope.

## Input

The prompt must provide a path to `changes/<feature-name>/<NUMBER-idea-name>/spec.md`.

If no spec path is provided, ask one focused question for the path. If the path is not an existing `spec.md` file, stop and report it.

## Context To Read

1. Read the provided `spec.md` fully before writing tasks.
2. Read relevant code, tests, exports, docs, and guidelines needed to identify affected packages and likely implementation areas.
   - Always include root `guidelines/code.md` or `guidelines/test.md`, plus nested `guidelines/code.md` or `guidelines/test.md` files for directories likely to change.
   - Respect package boundaries: public APIs export from `src/index.ts`; downstream internal `pqb` access goes through `pqb/internal`.
3. If `tasks.md` exists in the same folder, read it first, preserve still-correct tasks, remove stale tasks, and reconcile it with final `spec.md`.

## `tasks.md`

Output path: same directory as the provided `spec.md`.

If it exists, read it first, preserve still-correct tasks, remove stale tasks, and reconcile it with final `spec.md`.

The file must start with this section before any package or docs work:

```md
## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md or guidelines/test.md for coding
- you must follow <relevant-nested-path>/guidelines/code.md or <relevant-nested-path>/guidelines/test.md for coding
```

Section `0` rules:

- It contains exactly two numbered entries, `0.1` and `0.2`; both are plain list items, not checkboxes.
- Guideline bullets are required supporting lines, not subtasks.
- Include root `guidelines/code.md` or `guidelines/test.md` and every relevant nested `guidelines/code.md` or `guidelines/test.md` for directories the implementation will change.

After section `0`, only these sections are valid:

- affected package sections, ordered by dependency: lower-level packages before downstream packages
- for full task lists only, optional `docs` section, only for repo-root `docs/` work, placed after package work
- for full task lists only, final `changeset` section with the next number and one non-coding task that follows `.agents/skills/changeset/SKILL.md`

Package section names must be package folder names or root package script names. For schema config work, use `zod` and/or `valibot`, never `schema-configs` or `schemaConfigs`. Keep package-local docs in the relevant package section.

Every implementation checkbox task after section `0`:

- is a responsibility/change-slice title, not the instruction itself
- is complete only when all nested subtasks are done
- owns an indented numbered subtask list, e.g. `1.1.1`, `1.1.2`
- has at least one actionable subtask; do not add filler
- stays high-level, not file-by-file or helper-by-helper
- may mention likely code locations, exported functions, or docs pages when useful for orientation

If one requirement spans multiple packages, create a separate task in each affected package section. Do not create empty sections, standalone test tasks, generic research tasks, vague cleanup tasks, or exact test-writing instructions.

Every package coding task must start its subtask list with:

- `<task>.1 scope: <short package area or capability class>`
- `<task>.2 acceptance: <high-level expected outcome>`

Then add change-specific subtasks. End every coding task with these exact verification subtasks after the numeric prefix:

- verify implementation against guidelines
- code must be covered by tests
- tests and types must pass: run `pnpm verify`
- reconcile `spec.md` for every new user-visible requirement

When writing those lines in `tasks.md`, keep the backticks around `spec.md` and `pnpm verify` as shown in the example below.

Non-coding tasks, including repo-root docs-only tasks and the final changeset task, do not get the four coding verification subtasks.

Use this structure:

```md
## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md or guidelines/test.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md or packages/pqb/src/query/guidelines/test.md for coding

## 1. pqb

- [ ] 1.1 <change slice title>
  - 1.1.1 scope: query-builder read-only query capability
  - 1.1.2 acceptance: read-only query objects keep read behavior and reject mutation APIs at the type level.
  - 1.1.3 <high-level actionable subtask>
  - 1.1.4 verify implementation against guidelines
  - 1.1.5 code must be covered by tests
  - 1.1.6 tests and types must pass: run `pnpm verify`
  - 1.1.7 reconcile `spec.md` for every new user-visible requirement

## 2. orm

- [ ] 2.1 <change slice title>
  - 2.1.1 scope: ORM table configuration
  - 2.1.2 acceptance: table declarations can opt into read-only query objects without changing default writable behavior.
  - 2.1.3 <high-level actionable subtask>
  - 2.1.4 verify implementation against guidelines
  - 2.1.5 code must be covered by tests
  - 2.1.6 tests and types must pass: run `pnpm verify`
  - 2.1.7 reconcile `spec.md` for every new user-visible requirement

## 3. docs

- [ ] 3.1 <docs change slice title>
  - 3.1.1 <high-level docs subtask>

## 4. changeset

- [ ] 4.1 Finalize the change
  - 4.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
```

Do not add `docs` or `changeset` sections to a partial task list. A partial task
list should contain section `0` and only the affected package or script sections
needed for the explicitly requested scope.

While writing `tasks.md`, keep this implementation-time rule in mind but do not emit it as its own section:

- If later user input is only a non-feature design ask, implementation preference, wording tweak, or detail that does not change user-visible behavior or public API, do not add it to `spec.md`.
- If it changes user-visible behavior, adds/changes a requirement, or changes public API, update the relevant `## Detailed Design` subsection before implementation. Add a new responsibility-centered subsection only when none fits.
- Keep `Summary`, `What Changes`, `Assumptions`, and `Capabilities` aligned when the design materially changes.

## Final Check

Before finishing, verify:

- the provided path is an existing `spec.md` under `changes/<feature-name>/<NUMBER-idea-name>/`
- relevant Orchid docs, code, tests, exports, and guidelines were inspected
- every important `What Changes` item and declared capability is covered by `tasks.md`
- `tasks.md` starts with section `0`; `0.1` and `0.2` are the only numbered entries there and are not checkboxes
- section `0` lists root and relevant nested code or test guidelines
- every later checkbox task has numbered subtasks; package tasks start with `scope:` and `acceptance:`
- every coding task ends with the four required verification subtasks, including `pnpm verify`
- non-coding tasks do not include coding verification subtasks
- sections are only affected packages, optional root `docs` for full task lists, and final `changeset` for full task lists
- tasks are ordered for iterative implementation, avoid standalone test tasks, avoid exact test-writing instructions, and fully cover the design unless the user explicitly requested a partial task list
