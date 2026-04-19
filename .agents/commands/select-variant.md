---
name: 'Select Variant'
description: Select a specific variant from changes/<feature-name>/<NUMBER-idea-name>/variants.md, write selected-variant.md, and optionally refine it in place
category: Workflow
tags: [variant, selection, refine, changes]
---

Read a specific idea's `variants.md`, choose exactly one variant, write `changes/<feature-name>/<NUMBER-idea-name>/selected-variant.md`, and optionally refine that saved file in place.

**Input**: The argument after `/select-variant` should include:

- A feature or change folder name
- An idea number or idea title
- Optionally, a variant number or a variant title
- Optionally, an explicit instruction such as `refine` or `don't refine`
- Optionally, an explicit instruction such as `replace` or `overwrite`

Examples:

- `/select-variant 611-row-level-security-integration 2`
- `/select-variant 611-row-level-security-integration 2 1`
- `/select-variant row-level-security-integration "Run work inside an explicit RLS context" "ALS-backed query-time RLS state in $withOptions"`
- `/select-variant row-level-security-integration 2 refine`
- `/select-variant row-level-security-integration 2 1 don't refine`
- `/select-variant row-level-security-integration 2 1 replace`

**Goal**

Produce a final selection document for one idea variant.

This command is a selection workflow, not a design-generation workflow. It should:

- Resolve the intended feature and idea without guessing through ambiguity
- Read the idea's existing `variants.md`
- Select exactly one variant
- Check whether replacing an existing `selected-variant.md` is allowed
- Write a fresh `selected-variant.md` from the selected variant
- Ask whether to refine it unless the user already decided that
- Optionally follow the refine workflow against the saved `selected-variant.md`

The command must save the selected variant document first. If refinement is requested, `.agents/commands/refine.md` then updates that saved file in place.

**Steps**

1. **Identify the target change folder**

   Search `changes/` for the folder that best matches the user's feature input.

   Prefer:
   - An exact folder-name match
   - A folder whose name clearly matches the described feature
   - A folder that already contains `ideas.md`

   If multiple folders are plausible, stop and ask the user which one to use.
   Do not guess when the match is ambiguous.

   If no relevant change folder exists, tell the user that no matching change folder was found.
   Do not create a new change folder here.

2. **Resolve the target idea**

   Find an idea folder inside `changes/<feature-name>/` that matches the user's idea input.

   Match by:
   - Exact idea number from folders such as `2-run-work-inside-an-explicit-rls-context`
   - Or exact / clearly intended idea name from the folder suffix
   - If needed, read `changes/<feature-name>/ideas.md` to confirm the exact numbered idea title

   If multiple idea folders are plausible, stop and ask one focused clarifying question.
   Do not guess between similarly named ideas.

   The resolved idea path must be:

   `changes/<feature-name>/<NUMBER-idea-name>`

3. **Verify required input files**

   Confirm that `changes/<feature-name>/<NUMBER-idea-name>/variants.md` exists.

   If `variants.md` is missing, stop and tell the user that the idea does not have variants yet.
   Do not create `variants.md` in this command.

4. **Read `variants.md` and identify the available variants**

   Read the full `changes/<feature-name>/<NUMBER-idea-name>/variants.md`.

   Identify variants from headings in this form:

   `## Solution <number>: <solution name>`

   For each variant, capture:
   - Its exact solution number
   - Its exact solution name
   - Its full section content

   Treat the variant body as the content from that `## Solution ...` heading until the next `## Solution ...` heading, or until the next top-level section that is not part of that solution.

   Ignore non-variant sections such as:
   - `# <Idea Title>`
   - `## Goal`
   - `## Context from existing research`
   - `## Comparison`
   - `## References`

5. **Select exactly one variant**

   If the user provided a variant number or name:
   - Match by exact solution number
   - Or exact / clearly intended solution name

   If the title match is ambiguous, stop and ask one focused clarifying question.
   Do not guess between similarly named variants.

   If the user did not provide a variant:
   - If there is exactly one variant in `variants.md`, select it automatically
   - If there is more than one variant, stop and ask the user which variant to choose

   Record:
   - The exact idea title
   - The selected solution number
   - The selected solution name
   - The selected solution body

6. **Check whether `selected-variant.md` can be replaced**

   Check whether `changes/<feature-name>/<NUMBER-idea-name>/selected-variant.md` already exists.

   If it does not exist, continue.

   If it exists, inspect the user input for an explicit replacement decision.

   Explicit yes:
   - `replace`
   - `overwrite`
   - `recreate`
   - clearly equivalent wording

   If `selected-variant.md` exists and the user did not explicitly choose replacement, stop and ask a short direct question about whether the existing file should be replaced.

   If the user says no, stop without changing the file.

7. **Write a fresh `selected-variant.md`**

   The output path must be:

   `changes/<feature-name>/<NUMBER-idea-name>/selected-variant.md`

   Create this file only after:
   - the selection is complete
   - replacement was explicitly allowed when needed

   Build the file from `variants.md` by preserving only:
   - `## Goal`
   - `## Context from existing research`
   - the selected `## Solution <number>: <solution name>` section content
   - `## References`

   Omit:
   - all non-selected `## Solution ...` sections
   - `## Comparison`
   - any other sections that only exist to compare or discuss unselected variants

   Use this structure:

   ```md
   # <Selected solution name>

   ## Goal

   <Copied from `variants.md`.>

   ## Context from existing research

   <Copied from `variants.md`.>

   ## Solution

   <Write the original selected solution section content here, including any example subsection(s), but without the original `## Solution ...` heading.>

   ## References

   <Copied from `variants.md`.>
   ```

   Output guidance:
   - Use the exact selected solution name in the `#` heading
   - Preserve `## Goal`, `## Context from existing research`, and `## References` from `variants.md`
   - Do not include the selected solution number anywhere in the final file unless it naturally appears inside copied prose
   - The `## Solution` section should contain the original selected solution content, including any example subsection(s), but without the original `## Solution ...` heading
   - Do not invent extra detail at this step
   - Do not include process notes, unresolved questions, comparison material, or metadata about the selection itself

8. **Determine whether refinement is required**

   Inspect the user input for an explicit refinement decision.

   Explicit yes:
   - `refine`
   - `refined`
   - clearly equivalent wording

   Explicit no:
   - `don't refine`
   - `do not refine`
   - `skip refine`
   - clearly equivalent wording

   If the user explicitly chose refinement, proceed to the refinement step using the saved `selected-variant.md`.

   If the user explicitly chose not to refine, finish without refinement.

   If the user did not make the decision explicit, ask a short direct question about whether the saved `selected-variant.md` should be refined.

9. **Refine the saved `selected-variant.md` when requested**

   If refinement is required, follow the workflow in `.agents/commands/refine.md` using:

   `changes/<feature-name>/<NUMBER-idea-name>/selected-variant.md`

   as the input file.

   The refine step must update that same file in place.

   If refinement is skipped, leave the just-written `selected-variant.md` unchanged.

10. **Quality check**

Before finishing, verify:

- The change folder is the best match for the user's feature input
- The idea folder is the best match for the user's idea input
- `variants.md` was read from the correct idea folder
- Exactly one variant was selected
- If `selected-variant.md` already existed, replacement was explicitly provided by the user or explicitly asked and confirmed
- `selected-variant.md` was written only after the selection / replacement flow was complete
- The saved file initially used the selected solution name as the top title
- The saved file initially preserved the goal, context, selected solution content, and references from `variants.md`
- The saved file initially used `## Solution` as the selected solution section title
- The saved file did not include the solution number as output metadata
- The saved file omitted non-selected variants and comparison-only material
- The refine decision was either explicitly provided by the user or explicitly asked
- Refinement was only performed when requested
- If refinement was performed, it happened only after `selected-variant.md` was written and it updated that same file in place
- If refinement was skipped, the just-written `selected-variant.md` remained unchanged

**Guardrails**

- Do not create or update `variants.md` in this command
- Do not guess when feature, idea, or variant matching is ambiguous
- Do not auto-select among multiple variants when the user did not specify one
- Do not replace an existing `selected-variant.md` unless the user explicitly said to replace it or confirmed replacement when asked
- Do not write `selected-variant.md` before the selection and replacement checks are complete
- Do not wait on the refine decision before writing `selected-variant.md`
- Do not refine unless the user explicitly chose it or answered yes when asked
- Do not write a second output file for refinement
- Do not regenerate or reconcile `selected-variant.md` from `variants.md` after refinement begins
- Do not turn this command into implementation planning
