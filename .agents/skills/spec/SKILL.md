---
name: spec
description: Use when the user prompts "write spec" or "make spec".
---

Ignore other spec-writing or brainstorming skills.

Create or update exactly:

- `changes/<feature-name>/<NUMBER-idea-name>/spec.md`

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

## Task List Delegation

After `spec.md` is written and checked, launch a sub-agent to execute the `task-list` skill.

Pass the exact `spec.md` path to the sub-agent. The sub-agent is responsible for creating or updating `tasks.md` in the same folder. Do not write `tasks.md` directly in this skill unless the sub-agent mechanism is unavailable; if unavailable, say so and follow `.agents/skills/task-list/SKILL.md` yourself.

## Final Check

Before finishing, verify:

- the correct feature and idea folder were chosen
- the baseline was resolved by the ordered rule and read fully before writing
- only optional `research.md` was used from the parent feature folder
- relevant Orchid docs and code were inspected
- `spec.md` preserves the baseline, has no top-level title, and has no `Guidelines` section
- `Summary`, `What Changes`, optional `Assumptions`, `Capabilities`, and `Detailed Design` satisfy the rules above
- `Detailed Design` is complete, coherent, and not implementation-prescriptive
- the task-list sub-agent was launched with the exact `spec.md` path

Ask one focused question only when folder/idea resolution is ambiguous or the baseline is missing/too thin.
