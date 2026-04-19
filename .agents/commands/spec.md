---
name: 'Spec'
description: Read specs/<feature-name>/<NUMBER-idea-name>/selected-variant.md, complete the feature design, and write or update spec.md and tasks.md
category: Workflow
tags: [spec, tasks, design, planning]
---

Ignore other spec-writing, brainstorming skills if any.

Read an existing selected idea from `specs/<feature-name>/<NUMBER-idea-name>/selected-variant.md`, inspect the relevant Orchid docs and code, and write or update:

- `specs/<feature-name>/<NUMBER-idea-name>/spec.md`
- `specs/<feature-name>/<NUMBER-idea-name>/tasks.md`

**Input**: The argument after `/spec` should identify:

- a feature folder inside `specs/`
- an idea number or idea title inside that feature folder

Examples:

- `/spec 611-row-level-security-integration 2`
- `/spec row-level-security-integration "Run work inside an explicit RLS context"`

**Goal**

Produce two implementation inputs for the selected idea:

- a concise, complete `spec.md` that defines the public API, observable behavior, package boundaries, and high-level design
- a concise `tasks.md` that turns that design into package-grouped implementation tasks

This command is a design-completion workflow, not a research-only workflow and not an implementation workflow.

`selected-variant.md` is the authoritative source of requirements for the selected idea.
Trust its goals, scope, constraints, and confirmed decisions.
But it is not necessarily a complete finished design, and it is not the only context that matters.
Use the selected variant as the requirements baseline, then use relevant Orchid docs, real code, and the optional parent `research.md` to complete the public API and high-level behavior where needed.
Preserve the selected variant's intent precisely; do not change what it already decided. Only fill the gaps and add the missing design needed for what the selected variant already implies but does not fully define.

Ensure there is no conflicts, contradictions between the `selected-variant.md` and the resulting `spec.md`.
If there are any, `selected-variant.md` wins, change the `spec.md` to conform.

**Steps**

1. **Identify the target feature folder**

   Search `specs/` for the folder that best matches the user's feature input.

   Prefer:
   - an exact folder-name match
   - a folder whose name clearly matches the described feature
   - a folder that contains numbered idea subfolders

   If multiple feature folders are plausible, stop and ask one focused clarifying question.
   Do not guess.

   If no relevant feature folder exists, tell the user that no matching feature folder was found.
   Do not create a new feature folder in this command.

2. **Resolve the target idea folder**

   Inside the resolved feature folder, find the idea folder that matches the user's idea input.

   Match by:
   - exact idea number from folders such as `2-run-work-inside-an-explicit-rls-context`
   - or exact / clearly intended idea title from the folder suffix

   If multiple idea folders are plausible, stop and ask one focused clarifying question.
   Do not guess.

   The resolved idea path must be:

   `specs/<feature-name>/<NUMBER-idea-name>`

3. **Verify the required input files**

   Confirm that:
   - `specs/<feature-name>/<NUMBER-idea-name>/selected-variant.md` exists
   - `specs/<feature-name>/research.md` may exist, but is optional

   Ignore every other file in `specs/<feature-name>/`.

   If `selected-variant.md` is missing, stop and tell the user that the idea is not ready for spec generation yet.
   Do not create `selected-variant.md` in this command.

4. **Read `selected-variant.md` carefully**

   Read the full `selected-variant.md` before drafting anything.

   Understand:
   - the goal of the selected idea
   - the proposed public interface
   - explicit constraints and trade-offs
   - what is already decided
   - what is still implied rather than specified
   - which packages or docs are likely affected

   If the file has a `## Refinement` section, treat the confirmed questions and answers there as part of the current design intent.
   If the main body and a confirmed refinement answer conflict, use the confirmed refinement answer as the newer decision.

5. **Read broader research when available**

   If `specs/<feature-name>/research.md` exists, read it after `selected-variant.md`.

   Use it only for:
   - the broader feature context
   - external constraints or terminology
   - edge cases or requirements that shape the selected idea
   - related capabilities that affect the final design

   Do not read or use any other files from `specs/<feature-name>/`.

6. **Inspect Orchid documentation for API fit**

   Read the relevant parts of:

   `docs/src/.vitepress/dist/llms.txt`

   Use the docs to understand:
   - how Orchid explains similar features to users
   - which naming and API patterns already exist
   - which public surfaces are natural extension points
   - how this idea should feel from the user's perspective

   Prefer extending established Orchid patterns over inventing a new surface without a strong reason.

7. **Inspect the codebase for real integration points**

   Search the repo for code, tests, exports, and docs that affect the selected idea.
   Read only what is needed to answer:
   - what public API already exists
   - which packages or repo-root docs areas are affected
   - which internal components are likely involved
   - what package boundaries or exports constrain the design
   - whether a similar capability already exists under a different name or shape
   - which `guidelines/code.md` files apply to the directories that will likely change

   Respect monorepo boundaries while designing:
   - public functionality is exported from `src/index.ts`
   - when downstream packages need internal `pqb` functionality, it should come through `pqb/internal`
   - always include the repo root `guidelines/code.md`, then include any more specific nested `guidelines/code.md` files for directories that will contain relevant implementation changes

8. **Complete the feature design**

   Use `selected-variant.md`, optional `research.md`, Orchid docs, and code context together.

   The design must:
   - achieve the selected-variant goals
   - fill in any missing public API or high-level behavior needed to make the feature complete
   - define the public contract clearly enough to constrain implementation
   - decide whether the idea introduces no standalone capability, one standalone capability, or several distinct capabilities that deserve their own responsibility-centered feature folders
   - identify both direct capabilities and any additional enabling capabilities that other capabilities need in order to work, when those supporting mechanisms are generic and substantial enough to stand on their own
   - stay at the interface, behavior, and responsibility level rather than dictating low-level implementation
   - choose a coherent answer when an important design decision is still missing
   - record important writer-made behavioral decisions in `## Assumptions` when the selected variant leaves a real gap that must be resolved

   The design must not:
   - merely restate the selected variant without completing the missing design around it
   - leave essential behavior ambiguous
   - overfit to one implementation strategy
   - drift away from existing Orchid naming, package boundaries, or user expectations without a strong reason

   When evaluating API shape:
   - prefer type-safe public interfaces that fit Orchid's existing design
   - avoid runtime validations when TypeScript can already reject the invalid input

9. **Write or update `spec.md`**

   The output path must be:

   `specs/<feature-name>/<NUMBER-idea-name>/spec.md`

   If `spec.md` already exists, read it first, preserve still-correct content, remove stale content, and reconcile it with the current selected variant and current codebase reality.
   Do not append duplicate sections.

   The file must use this structure:

   ````md
   ## Summary

   <Short, concrete description of what to implement.>

   ```ts
   <Code example for the new public API or workflow.>
   ```

   ## What Changes

   - <Concise statement of a proposed change.>
   - <Concise statement of another proposed change.>

   ## Assumptions

   - <Important behavioral decision the spec writer had to make because the selected variant left a real gap.>
   - <Another important assumption, only if needed.>

   ## Capabilities

   - `capability-id`: <Concise description of a standalone code addition whose responsibility can exist independently of this selected idea.>
   - `another-capability`: <Concise description of another distinct standalone responsibility, only when needed.>

   <If the selected idea only extends existing surfaces and does not introduce a standalone capability, say so explicitly instead of inventing one.>

   ## Detailed Design

   ### Public API

   <Define the public surface this feature adds or changes. Explain the semantics, not the implementation.>

   ```ts
   <Optional short type or interface snippet when it clarifies the contract.>
   ```

   - <Important rule, guarantee, or invariant of the public surface.>
   - <Another important rule, guarantee, or invariant if needed.>

   ### Shared State or Data Shape

   <Only when the feature introduces shared state, normalized options, or a data shape that other parts of the design depend on.>

   ```ts
   <Optional short shape snippet.>
   ```

   <Explain what this shape represents and what must be preserved.>

   ### Integration and Lifecycle

   <Explain where the new behavior plugs into existing Orchid flows and what must happen across those integration points.>

   ### <Package-Specific or Subsystem-Specific Behavior>

   <Only when one package, adapter, or subsystem needs materially different behavior. Explain that behavior and the boundary around it.>

   ### Error Handling and Limits

   - <Contract-level failure mode, guarantee, or limit.>
   - <Another important failure mode, guarantee, or limit if needed.>

   ### Documentation

   <It's already known that public API changes must be documented - don't note that>
   <Note if there are gotchas, important unobvious edge cases that are important to let user know about>
   ````

   `spec.md` requirements:
   - `Summary` should briefly say what to build, not retell the whole background.
   - Include as many code examples in `Summary` as needed to make every new public API or public workflow unambiguous.
   - If one example is enough, include one. If the design introduces multiple distinct public surfaces, include enough examples to cover all of them.
   - `What Changes` should be short, targeted, and complete for the proposed feature.
   - Include `## Assumptions` only when the writer had to make important behavioral or scope decisions to fill real gaps in `selected-variant.md`, decisions that aren't already implied.
   - Only include assumptions that materially affect usability, behavior, or implementation scope.
   - Do not list interface naming choices, small API-shape preferences, or other minor clarifications as assumptions.
   - `Capabilities` must decide whether the design introduces no standalone capability, one standalone capability, or several capabilities that deserve their own feature folders.
   - Do not mirror the selected idea name mechanically in `Capabilities`. A capability should exist only when the new code has its own clear responsibility and could make sense outside this specific idea.
   - Use single responsibility as a rule of thumb when splitting capabilities. If two interfaces or behaviors can exist independently, prefer separate capability entries instead of one umbrella capability.
   - Look for enabling capabilities as well as direct ones. If multiple capabilities depend on a shared non-trivial mechanism, and that mechanism has its own generic responsibility, list it as its own capability instead of hiding it inside one consumer capability.
   - Example: if an RLS idea requires independent `role` switching and `set-config` support, prefer separate `role` and `set-config` capabilities unless there is a real single responsibility that justifies one `rls` capability.
   - Example: if `role` and `set-config` both require a generic mechanism that synchronizes AsyncLocalStorage-backed session state into SQL that must run before each query, describe that mechanism as its own capability with a generic name such as `dynamic-query-session`, rather than burying it under `role` or `set-config`.
   - Name enabling capabilities by the common responsibility they provide to their consumers, not by one concrete feature that happens to need them first.
   - Every capability entry must use a sharp code-facing id that makes the responsibility obvious at a glance. If the code will call it `role`, the id is `role`.
   - Use kebab-case for multi-word capability ids, such as `set-config`.
   - Every capability entry must include a concise high-level description of what it does.
   - When no standalone capability is introduced, say so explicitly instead of inventing a placeholder capability that merely repeats the selected idea.
   - The template above is illustrative of the preferred shape for `Detailed Design`, not a requirement to keep every listed heading, and not a requirement for the exact sections - use the best section names and contents to define the design for this specific feature.
   - Write `Detailed Design` concretely and section it by responsibility.
   - `Detailed Design` should be detailed enough to remove ambiguity, but it must still stop short of implementation instructions.
   - `Detailed Design` should usually move from the public contract inward:
     1. public API or type surface
     2. shared conceptual state or data shape, if the feature introduces one
     3. execution or lifecycle integration points
     4. package-specific or subsystem-specific behavior, only where behavior materially differs
     5. error handling, limits, and guarantees that are part of the contract
     6. what gotchas, edge cases are important to document for the user
   - Use only the sections that are genuinely needed for this idea. Do not force empty or artificial headings.
   - Prefer section titles that name the responsibility directly.
   - `Detailed Design` should be organized by meaningful interfaces, responsibilities, or subsystems, not by files.
   - Each detailed-design section should answer the important questions for that responsibility:
     - what surface, concept, or responsibility this section defines
     - what must be true about its behavior and semantics
     - what boundaries or package responsibilities matter
     - what constraints, limits, or invariants the implementor must preserve
   - Include short interface or type snippets only when they make the contract clearer.
   - When different packages or adapters need different behavior, explain the difference in one dedicated section per materially different strategy.
   - Keep the focus on interfaces, semantics, and responsibilities. Do not prescribe low-level algorithms, helper extraction, control flow minutiae, or exact file edits.
   - Keep the whole file concise. It should be complete, but it should not read like a full implementation plan.
   - Resolve important ambiguity instead of leaving TODOs, placeholders, or mutually compatible options.
   - Do not add a `Guidelines` section to `spec.md`; the implementing-agent guidance belongs at the top of `tasks.md`.

10. **Write or update `tasks.md`**

The output path must be:

`specs/<feature-name>/<NUMBER-idea-name>/tasks.md`

If `tasks.md` already exists, read it first, preserve still-correct tasks, remove stale tasks, and reconcile it with the final `spec.md`.

The very top of `tasks.md` must start with one mandatory `0` task section before any package or `docs` sections:

`## 0. read spec.md and guidelines`

That `0` task must contain exactly two subtasks:

- `0.1` must require reading `spec.md` before starting later tasks, explicitly include `spec.md` `## Detailed Design`, require following that design for every later task, and require the final implementation to match it exactly
- `0.2` must require deciding whether any later task involves coding, and if it does, require reading and following every listed coding guideline and verifying that all produced code follows them to the letter

Those `0.1` and `0.2` subtasks must be plain numbered list items without checkboxes. Checkbox task items begin only in later implementation sections such as `1.1`, `2.1`, and `3.1`.

The guideline list under that `0` task must be the exact same guideline list that would otherwise have been emitted for this feature: always `guidelines/code.md`, plus every relevant nested `guidelines/code.md` for the directories that the implementation will change

After the mandatory `0` section, the file must be split into valid implementation sections only: affected package sections and, when needed, one `docs` section for work under the repo root `docs/` folder.
Package section titles must use the package folder names from `packages/<package-name>`. Root docs work must use the section title `docs`.
Order the sections by implementation dependency order, with lower-level packages before downstream ones and the optional `docs` section placed where the work fits best, usually after code changes.

Use this structure:

```md
## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow <relevant-nested-path>/guidelines/code.md for coding

## 1. pqb

- [ ] 1.1 <task description>
- [ ] 1.2 <task description>

## 2. orm

- [ ] 2.1 <task description>
- [ ] 2.2 <task description>

## 3. docs

- [ ] 3.1 <task description for the repo root docs/ folder>
```

While writing `tasks.md`, keep this implementation-time rule in mind, but do not emit it as a separate section:

- If the user gives additional input during implementation and it is only a non-feature design ask, implementation preference, wording tweak, or another detail that does not change user-visible behavior and does not change a public interface, do not add it to `spec.md`.
- If the additional input changes how the feature works for the user, adds or changes a user-visible requirement, or changes a public interface, update `spec.md` before implementing it.
- First find the existing `## Detailed Design` subsection whose responsibility already covers that change. Add the new requirement there, or update that subsection if the behavior is changing.
- If no existing `## Detailed Design` subsection cleanly covers the change, add a new responsibility-centered subsection under `## Detailed Design`.
- Keep `## Summary`, `## What Changes`, `## Assumptions`, and `## Capabilities` aligned when the design change materially affects them.

`tasks.md` requirements:

- The file must start with the mandatory `## 0. read spec.md and guidelines` section before any package or `docs` sections.
- That `0` section must contain exactly the `0.1` and `0.2` subtasks described above.
- Those `0.1` and `0.2` subtasks must be plain numbered list items without checkboxes.
- `0.1` must require reading `spec.md`, explicitly include `spec.md` `## Detailed Design`, require following that design for every later task, and require the final implementation to match it exactly.
- `0.2` must require checking whether any later task requires coding and, if so, reading and following the guideline list and verifying that all produced code follows it to the letter.
- The guideline list in that `0` section must be the exact same list that would otherwise have been emitted for this feature: it must always include `- you must follow guidelines/code.md for coding`, and it must add one list item for each relevant nested `guidelines/code.md` file under a directory that will include feature implementation changes.
- Include only nested guideline files that are actually relevant to the planned code changes.
- Example: if the feature will change query-builder code under `packages/pqb/src/query`, include `- you must follow packages/pqb/src/query/guidelines/code.md for coding`.
- Each task must be one meaningful responsibility or change slice.
- A single task may span multiple files.
- Do not split tasks by file unless the responsibilities are actually different.
- If one requirement spans multiple packages, create a separate task in each affected package section.
- After the mandatory `## 0. read spec.md and guidelines` section, only affected package sections and, when needed, one `docs` section for work under the repo root `docs/` folder are valid.
- Use the `docs` section only for work in the repo root `docs/` folder. Keep package-local docs in the relevant package section.
- Do not create empty package or `docs` sections.
- Every task should say what needs to change and include the intent, constraint, or key idea when that is not obvious from the task title alone.
- Tasks may mention likely code locations, exported functions, or docs pages when that helps orient the implementor.
- Do not micromanage exact edits or turn tasks into file-by-file instructions.
- Do not retell the whole design in every task.
- Do not include test tasks.
- Do not include instructions about what tests to write.
- Do not include generic research tasks or vague cleanup tasks.
- The sum of all tasks must implement the declared `Detailed Design`.

11. **Check `spec.md` and `tasks.md` against each other**

Before finishing, map the final design to the task list.

Verify that:

- every important `What Changes` item is covered by at least one task
- every declared capability is reflected in `Detailed Design` and covered by at least one task when capabilities are listed
- `tasks.md` starts with the mandatory `## 0. read spec.md and guidelines` section, with `0.1` covering `spec.md` and `spec.md` `## Detailed Design`, and `0.2` covering coding-guideline reading, following, and produced-code verification
- `0.1` and `0.2` are plain numbered list items without checkboxes, while later implementation tasks use checkbox items
- every guideline entry under that `0` section matches a directory that the design or tasks actually affect, and `guidelines/code.md` is always listed
- every affected package in the design appears in `tasks.md`, and a `docs` section appears when the design includes work under the repo root `docs/` folder
- the tasks are ordered so the change can be implemented iteratively
- the tasks remain concise and do not duplicate the design document

12. **Final quality check**

Before finishing, verify:

- the correct `specs/<feature-name>/<NUMBER-idea-name>` folder was chosen
- `selected-variant.md` was read fully before writing
- only `research.md` was used from the parent feature folder
- relevant Orchid docs and code were actually inspected
- the final `spec.md` achieves the selected-variant goals
- the final `spec.md` has no top-level title and no banned sections
- `Summary` includes enough code examples to cover every new public API or public workflow
- `What Changes` is concise, targeted, and complete
- `Assumptions` exists only when important writer-made behavioral decisions were needed, and if it exists it appears before `Capabilities`
- `Capabilities` appears before `Detailed Design`, clearly states whether the idea adds zero, one, or multiple standalone capabilities, and uses sharp ids with concise descriptions when it lists them
- `Detailed Design` is complete, coherent, and not implementation-prescriptive
- `spec.md` does not include a `Guidelines` section
- the design avoids runtime validations that merely duplicate TypeScript guarantees
- `tasks.md` starts with the mandatory `## 0. read spec.md and guidelines` section before any package or `docs` sections
- that `0` section contains exactly `0.1` and `0.2`, with `0.1` covering `spec.md` and `spec.md` `## Detailed Design`, and `0.2` covering coding-guideline reading, following, and produced-code verification
- that `0.1` and `0.2` are plain numbered list items without checkboxes, while later implementation tasks use checkbox items
- that `0` section includes the guideline list with `guidelines/code.md` and every relevant nested `guidelines/code.md` for the directories the feature will change
- `tasks.md` is grouped into valid implementation sections with the required numbering format: plain `0.1` and `0.2` list items in section `0`, then checkbox tasks for affected package sections and, when needed, `docs` for work under the repo root `docs/` folder
- `tasks.md` contains no test tasks or test-writing instructions
- documentation work under the repo root `docs/`, if needed, uses a `docs` section, while package-local docs stay in the relevant package section
- the combined tasks fully cover the final design

**Guardrails**

- Do not generate `spec.md` from `selected-variant.md` alone. Inspect Orchid docs and code first.
- Do not ignore, weaken, or casually contradict the requirements in `selected-variant.md`; only extend the missing parts of the design that the selected variant implies but does not already define.
- Do not ignore confirmed decisions recorded in `## Refinement`.
- Do not add `Assumptions` for naming choices, small interface-shape preferences, or other minor details.
- Do not read unrelated parent-folder files besides `research.md`.
- Do not create a capability entry just by copying the selected idea or feature name without showing why that responsibility should exist on its own.
- Do not bundle separate responsibilities into one capability merely because the selected idea uses them together; split them when they can exist independently.
- Do not bury a generic enabling mechanism inside one feature-specific capability when that mechanism has its own standalone responsibility and may support multiple capabilities.
- Do not name an enabling capability after the first feature that needs it when a more generic responsibility-centered name exists.
- Do not invent placeholder capabilities when the work only extends existing surfaces.
- Do not invent a new public API when an existing Orchid surface can be extended cleanly.
- Do not let `spec.md` collapse into vague product language or expand into an implementation manual.
- Do not put low-level algorithms, step-by-step coding instructions, or file-by-file edits into `spec.md`.
- Do not put a `Guidelines` section into `spec.md`; put the mandatory guideline list only in the `## 0. read spec.md and guidelines` section of `tasks.md`.
- Do not let `tasks.md` omit or weaken the mandatory `## 0. read spec.md and guidelines` section: `0.1` must require reading and following `spec.md` `## Detailed Design`, and `0.2` must require reading and following the applicable coding guidelines and verifying that all produced code follows them to the letter.
- Do not add checkbox markers to `0.1` or `0.2`; checkbox task items start only in later implementation sections.
- Do not create arbitrary non-package sections in `tasks.md`; after `## 0. read spec.md and guidelines`, only affected package sections and the optional `docs` section for the repo root `docs/` folder are allowed.
- Do not pad `tasks.md` with microsteps, tests, or generic busywork.
- Ask a focused clarifying question only when folder or idea resolution is genuinely ambiguous.
