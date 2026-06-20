---
name: implemenation-note
description: Use when the user prompts "implementation note" for an existing change idea.
---

Prepare technical implementation notes for an existing `changes/` idea before task implementation.

**Input**

- A selector like `414 1` or `gr 2`.
- One or several user wishes, concerns, risk areas, or integration questions to research.

The selector resolves to:

- `changes/<id>-*/<number>-*/spec.md`
- `changes/<id>-*/<number>-*/tasks.md`

`<id>` may be numeric or letters. `<number>` is the idea folder number.

**Workflow**

1. Resolve the change folder.
   Match `changes/<id>-*` for the first selector and `<number>-*` inside that folder for the second selector.
   If either part is ambiguous or missing, ask one focused clarification question.
   Require both `spec.md` and `tasks.md`; do not create missing change folders or missing spec/task files.

2. Read the local context.
   Read `spec.md`, `tasks.md`, and existing `*-implementation-note.md` files in the same folder.
   Existing notes are authoritative context for avoiding contradictions and duplicate guidance.
   Preserve harmony between new notes, old notes, `spec.md`, and `tasks.md`.

3. Split the user's request into implementation-note topics.
   If the user asks for several independent points, research each point separately and write each useful result as a separate numbered note.
   If a point turns out to have no real implementation risk, no useful guidance, and no required spec/task change, do not write a note for that point; report that it did not need one.

4. Investigate before writing.
   Trust the high-level user goal in `spec.md`, but do not trust its implementation details blindly.
   Examine the existing code, tests, docs, and related change files to understand the real integration points.
   Search for similar existing behavior and shared helpers before proposing new paths.
   You may run focused tests, add temporary logs, or make temporary internal prototype edits to understand behavior.
   You may try several approaches to compare fit, duplication, blast radius, and type-system impact.
   Prototype edits do not need to make TypeScript checks pass, but they are exploratory only.

5. Clean exploratory work.
   Before finishing, remove temporary logs and prototype code unless the user explicitly asked to keep implementation changes.
   The intended persistent edits are `spec.md`, `tasks.md`, and useful `*-implementation-note.md` files.

6. Choose or document approaches.
   Prefer one recommended implementation approach when the evidence supports it.
   If there is no clear best approach, write the plausible approaches, tradeoffs, and the decision needed into the implementation note, then stop and ask the user to choose before proceeding further.

7. Update `spec.md` when research changes the design.
   If code investigation shows a better implementation model, different integration boundary, missing edge case, or incorrect detail, update `spec.md`.
   Keep the high-level feature goal intact unless the user changes it.
   Do not add speculative implementation detail to `spec.md` unless it changes the feature contract or task-relevant design.

8. Write implementation notes.
   Create notes in the same folder as `spec.md`.
   Use the next available integer starting at `1`: `1-implementation-note.md`, `2-implementation-note.md`, and so on.
   For multiple useful topics in one run, create one note per topic with consecutive available numbers.
   Keep notes concise and implementation-facing.

   Recommended note shape:

   ```md
   # <Short Topic>

   ## Context

   ## Findings

   ## Recommended approach

   ## Tasks affected

   ## Verification focus
   ```

   If no single approach is clearly best, replace `Recommended approach` with:

   ```md
   ## Options

   ## Recommendation needed
   ```

9. Update `tasks.md`.
   For every task that must follow a note, edit that task's nested subtask list to require reading and following the relevant note.
   Use the existing task numbering style and preserve checkbox state.
   Prefer a focused subtask under the affected parent task over a broad global instruction.
   If a note applies to multiple tasks, add explicit references under each affected task.

10. Verify the final state.
    Confirm that every new note is referenced by the relevant task(s), no referenced note is missing, and `spec.md`, `tasks.md`, and all notes are mutually consistent.
    Report the selector, files changed, notes created or intentionally skipped, spec/task updates, and any user decision that is still needed.

**Guardrails**

- Do not implement the feature as the final deliverable.
- Do not leave temporary debugging logs or prototype edits in code.
- Do not write an implementation note that only repeats `spec.md` or `tasks.md`.
- Do not force a note for a concern that investigation shows is harmless and needs no future action.
- Do not update `tasks.md` with broad "read all notes" instructions when a note only applies to specific tasks.
- Do not guess ambiguous selectors.
