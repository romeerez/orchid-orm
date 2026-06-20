---
name: spec
description: Use when the user prompts "write spec" or "make spec".
---

Ignore other spec-writing or brainstorming skills.

Create or update exactly:

- `changes/<feature-name>/<NUMBER-idea-name>/spec.md`
- `changes/<feature-name>/<NUMBER-idea-name>/tasks.md`

This is a design-completion command, not research-only and not implementation.

## Input

The prompt should identify:

- a feature folder under `changes/`
- an idea number or idea title inside that feature folder
- optional extra details, especially when neither `selected-variant.md` nor an `ideas.md` section applies

Examples:

- `/spec 611-row-level-security-integration 2`
- `/spec row-level-security-integration "Run work inside an explicit RLS context"`

## Baseline

Resolve one authoritative requirements baseline, in this order:

1. `changes/<feature-name>/<NUMBER-idea-name>/selected-variant.md`, when it exists.
2. If the prompt says `<number>`, the exact `# <number>` section in `changes/<feature-name>/ideas.md`.
3. Otherwise, the user's prompt.

The baseline is the source of truth for goals, scope, examples, naming, constraints, trade-offs, and confirmed decisions. Fill gaps needed for a complete design, but do not contradict it. If `selected-variant.md` has `## Refinement`, treat confirmed Q&A there as current intent; when it conflicts with the main body, the refinement wins.

If the winning baseline is missing or too thin to define user-visible requirements without inventing the feature, stop and ask one focused question.

## Context To Read

1. Resolve the matching feature folder in `changes/`.
   - Prefer exact folder match, then clear feature match, then folders with numbered idea subfolders.
   - If multiple folders are plausible, ask one focused question. Do not guess.
   - If none match, say no matching feature folder was found. Do not create one.
2. Resolve the idea folder inside it by exact number, or exact/clear title suffix.
   - If multiple folders are plausible, ask one focused question.
   - The path must be `changes/<feature-name>/<NUMBER-idea-name>`.
3. Read the full winning baseline.
   - If rule 2 wins, `ideas.md` must contain the exact `# <number>` section.
   - Do not create `selected-variant.md` or `ideas.md`.
4. If `changes/<feature-name>/research.md` exists, read it after the baseline.
   - Use it only for broader context, terminology, external constraints, edge cases, and related capabilities.
   - Ignore every other parent-folder file.
5. Read relevant parts of `docs/src/.vitepress/dist/llms.txt` for Orchid API naming, user-facing patterns, and natural extension points.
6. Inspect only relevant code, tests, exports, docs, and guidelines.
   - Always include root `guidelines/code.md` or `guidelines/test.md`, plus nested `guidelines/code.md` or `guidelines/test.md` files for directories likely to change.
   - Check whether a similar capability already exists under another name or shape.
   - Respect package boundaries: public APIs export from `src/index.ts`; downstream internal `pqb` access goes through `pqb/internal`.

## Design Rules

Use the baseline, optional research, docs, and code reality together.

The design must:

- satisfy the baseline precisely
- define the public contract clearly enough to constrain implementation
- fill missing public API and high-level behavior
- fit existing Orchid naming, type-safety, package boundaries, and user expectations
- prefer TypeScript guarantees over runtime validation when possible
- decide whether the idea adds zero, one, or multiple standalone capabilities
- include important writer-made behavioral decisions in `## Assumptions` only when the baseline leaves a real gap

The design must not:

- merely restate the baseline
- leave essential behavior ambiguous
- overfit to one implementation strategy
- invent a new public API when an existing Orchid surface extends cleanly
- drift into low-level algorithms, helper extraction, control flow, or file-by-file edits

## `spec.md`

Output path: `changes/<feature-name>/<NUMBER-idea-name>/spec.md`

If it exists, read it first, preserve still-correct content, remove stale content, and reconcile it with the current baseline and codebase. Do not append duplicates.

Use this shape. No top-level title.

````md
## Summary

<Short, concrete description of what to implement.>

```ts
<Code example for the new public API or workflow.>
```

## What Changes

- <Concise proposed change.>
- <Another proposed change.>

## Assumptions

- <Important behavioral or scope decision needed because the baseline left a real gap.>

## Capabilities

- `capability-id`: <Standalone responsibility this code addition provides.>
- `another-capability`: <Another standalone responsibility, only when needed.>

<If the idea only extends existing surfaces and adds no standalone capability, say so explicitly.>

## Detailed Design

### Public API

<Define the public surface and semantics, not implementation.>

```ts
<Optional short type or interface snippet.>
```

- <Rule, guarantee, or invariant.>

### Shared State or Data Shape

<Only if shared state, normalized options, or a cross-cutting data shape matters.>

### Integration and Lifecycle

<Where behavior plugs into existing Orchid flows.>

### <Package-Specific or Responsibility-Specific Behavior>

<Only when one package, adapter, or subsystem needs materially different behavior.>

### Error Handling and Limits

- <Contract-level failure mode, guarantee, or limit.>

### Documentation

<Only gotchas or unobvious user-facing edge cases. Do not state that public API must be documented.>
````

`spec.md` requirements:

- `Summary` says what to build and includes enough examples to make every new public API/workflow unambiguous.
- `What Changes` is short, targeted, and complete.
- `Assumptions` appears before `Capabilities` and only when materially important; omit it otherwise. Do not list naming choices or minor API-shape preferences.
- `Capabilities` appears before `Detailed Design`. Do not mirror the idea name mechanically, invent placeholders, or hide separate responsibilities inside one umbrella capability.
- Split capabilities by standalone responsibility. Include generic enabling capabilities when they are substantial and reusable.
- Name capability ids with sharp code-facing kebab-case, such as `role`, `set-config`, or `dynamic-query-session`.
- Name generic enabling capabilities by their shared responsibility, not by the first feature that needs them.
- `Detailed Design` is responsibility-centered, concrete, and complete, but not an implementation plan. Use only needed sections.
- Do not add a `Guidelines` section.

Capability examples:

- If RLS needs independent `role` switching and `set-config` support, prefer separate `role` and `set-config` capabilities unless one real responsibility covers both.
- If both need a generic AsyncLocalStorage-backed session state mechanism that runs SQL before each query, list that generic mechanism separately, e.g. `dynamic-query-session`.

## `tasks.md`

Output path: `changes/<feature-name>/<NUMBER-idea-name>/tasks.md`

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
- optional `docs` section, only for repo-root `docs/` work, placed after package work
- final `changeset` section with the next number and one non-coding task that follows `.agents/skills/changeset/SKILL.md`

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
- tests and types must pass for `<package-list>`: `pnpm <pkg> check` and `pnpm <pkg> types`
- reconcile `spec.md` for every new user-visible requirement

When writing those lines in `tasks.md`, keep the backticks around `spec.md`, the package list, and both command templates as shown in the example below.

Tests/types package-list rules:

- Keep the templates exactly as `pnpm <pkg> check` and `pnpm <pkg> types`; do not expand commands per package.
- Replace `<package-list>` with concrete root script/package names, such as `pqb, orm, rake-db`.
- Include the changed package plus required downstream packages.
- If one task spans multiple packages, use the union.
- For `schema-configs`, list `zod` and `valibot`.

Dependency closure:

- `pqb`: `pqb`, `orm`, `rake-db`, `zod`, `valibot`, `test-factory`
- `rake-db`: `rake-db`, `orm`, `test-factory`
- `orm`: `orm`, `test-factory`
- `zod`: `zod`
- `valibot`: `valibot`
- `test-factory`: `test-factory`
- `create-orm`: `create-orm`
- `test-utils`: `test-utils`, plus packages the inspected code shows depend on the changed utility

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
  - 1.1.6 tests and types must pass for `pqb`, `orm`, `rake-db`, `zod`, `valibot`, `test-factory`: `pnpm <pkg> check` and `pnpm <pkg> types`
  - 1.1.7 reconcile `spec.md` for every new user-visible requirement

## 2. orm

- [ ] 2.1 <change slice title>
  - 2.1.1 scope: ORM table configuration
  - 2.1.2 acceptance: table declarations can opt into read-only query objects without changing default writable behavior.
  - 2.1.3 <high-level actionable subtask>
  - 2.1.4 verify implementation against guidelines
  - 2.1.5 code must be covered by tests
  - 2.1.6 tests and types must pass for `orm`, `test-factory`: `pnpm <pkg> check` and `pnpm <pkg> types`
  - 2.1.7 reconcile `spec.md` for every new user-visible requirement

## 3. docs

- [ ] 3.1 <docs change slice title>
  - 3.1.1 <high-level docs subtask>

## 4. changeset

- [ ] 4.1 Finalize the change
  - 4.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
```

While writing `tasks.md`, keep this implementation-time rule in mind but do not emit it as its own section:

- If later user input is only a non-feature design ask, implementation preference, wording tweak, or detail that does not change user-visible behavior or public API, do not add it to `spec.md`.
- If it changes user-visible behavior, adds/changes a requirement, or changes public API, update the relevant `## Detailed Design` subsection before implementation. Add a new responsibility-centered subsection only when none fits.
- Keep `Summary`, `What Changes`, `Assumptions`, and `Capabilities` aligned when the design materially changes.

## Final Check

Before finishing, verify:

- the correct feature and idea folder were chosen
- the baseline was resolved by the ordered rule and read fully before writing
- only optional `research.md` was used from the parent feature folder
- relevant Orchid docs and code were inspected
- `spec.md` preserves the baseline, has no top-level title, and has no `Guidelines` section
- `Summary`, `What Changes`, optional `Assumptions`, `Capabilities`, and `Detailed Design` satisfy the rules above
- `Detailed Design` is complete, coherent, and not implementation-prescriptive
- every important `What Changes` item and declared capability is covered by `tasks.md`
- `tasks.md` starts with section `0`; `0.1` and `0.2` are the only numbered entries there and are not checkboxes
- section `0` lists root and relevant nested code or test guidelines
- every later checkbox task has numbered subtasks; package tasks start with `scope:` and `acceptance:`
- every coding task ends with the four required verification subtasks, using concrete package names and the two `<pkg>` command templates
- non-coding tasks do not include coding verification subtasks
- sections are only affected packages, optional root `docs`, and final `changeset`
- tasks are ordered for iterative implementation, avoid standalone test tasks, avoid exact test-writing instructions, and fully cover the design

Ask one focused question only when folder/idea resolution is ambiguous or the baseline is missing/too thin.
