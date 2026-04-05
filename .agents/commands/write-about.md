---
name: 'Write About'
description: Write a new about.md for a feature by reading its code and mapping dependencies
category: Docs
tags: [docs, architecture, analysis]
---

Write a new `about.md` for a specific feature and save it in that feature's folder.

**Input**: The argument after `/write-about` should identify the feature. It may be:

- A feature name
- A feature name plus a short description from the user

Examples:

- `/write-about joins`
- `/write-about order: a functionality reflecting Postgres ORDER BY`

**Core behavior**

- Prioritize explaining the feature's purpose and real use cases
- Read the actual code for the target feature before writing anything
- Use the user's description as a hint, not as the only source of truth
- Use `public` vs `internal` as supporting context that helps explain the feature's role
- Figure out what the feature depends on and what depends on it
- Ask clarifying questions whenever the feature boundary, purpose, or target folder is not clear enough
- Write the final document to `about.md` inside the relevant feature folder

**Steps**

1. **Identify the target feature**

   If the user did not clearly specify the feature, use the **AskUserQuestion tool** to ask what feature they want documented.

   If the user provided only a loose name, search the repo to find the most likely feature folder.
   Prefer the narrowest cohesive directory that represents the feature.

   Good signals:

   - A dedicated directory in `packages/*/src/`
   - A group of files sharing a clear feature name
   - Tests colocated with the feature

   If multiple candidate folders match, stop and ask the user to choose.
   Do not guess when the choice is ambiguous.

2. **Confirm the write location**

   The output file must be `<feature-folder>/about.md`.

   If the user named a feature that is implemented across scattered files without an obvious folder:

   - Find the nearest cohesive feature directory
   - If there still is no clear home for `about.md`, ask the user where they want it stored

   Do not create an arbitrary new feature structure just to place the document.

3. **Read the feature thoroughly**

   Read the code in the feature folder first.
   Then read nearby tests, public exports, and adjacent supporting files that define how the feature behaves.

   You should understand:

   - What the feature exposes
   - What responsibilities belong to it
   - What is core behavior vs helper implementation detail
   - What the feature appears to optimize for or protect against

4. **Capture the feature's role in the product**

   Decide how this feature contributes to the end product so you can explain its purpose and use cases accurately.

   One useful lens is whether it is primarily **public** or **internal**:

   - A **public** feature directly adds, changes, configures, or exposes behavior that an end user can intentionally use
   - An **internal** feature mainly supports other features and does not itself add a direct public interface

   This distinction is not the goal by itself. Use it only to sharpen the explanation of:

   - Why the feature exists
   - How it is used
   - Which public behavior it adds, changes, or enables

   Examples:

   - `soft-delete` is best explained through the user-visible behavior it adds: configuration, query behavior changes, and related query methods
   - `mutative-queries-select-relations` is best explained through the public features it enables: selecting relations from create/update/delete flows

   If the feature looks mixed, focus on the dominant purpose and mention the secondary role only if it helps understanding.

5. **Map dependencies**

   Inspect imports and direct usage inside the feature to identify what it depends on.

   Focus on meaningful dependencies:

   - Other internal features
   - Public/internal package entry points
   - Important utility layers the feature relies on for its behavior

   Avoid listing every trivial helper unless it is essential to understand the feature.

6. **Map dependents**

   Search for usages of the feature outside its own folder to learn what depends on it.

   Look for:

   - Imports from the feature
   - Public exports that expose it
   - Other features that call into it
   - Tests that demonstrate real usage patterns

   Prefer feature-level dependents over raw file lists. Group related callers into a single feature when possible.

   Also identify which user-visible functionality is affected by this feature, whether directly or indirectly.

7. **Distill intent**

   Before writing, explicitly decide:

   - Why this feature exists
   - What problem it solves
   - Which distinct use cases it serves
   - Whether calling it `public` or `internal` helps clarify its role

   The **Purpose** section must capture intent, not mechanics.
   Work backwards from code, tests, names, and call sites to infer the real reason this feature exists.
   If the feature is public or internal in an important way, mention that as part of the explanation, but do not let that replace the explanation.

   If intent is still unclear after investigation, ask a targeted clarifying question instead of writing vague filler.

8. **Ask clarifying questions when needed**

   You must stop and ask if any of these are unclear:

   - Which folder is the feature
   - The feature boundary
   - The intended audience or naming
   - Whether two similarly named features should be treated separately or together
   - Whether an existing `about.md` should be replaced when the situation is ambiguous

   Ask only the minimum questions needed to proceed.

9. **Write `about.md`**

   Create or replace `<feature-folder>/about.md` with a concise, factual document.

   Use this structure:

   ```md
   # <Feature Name>

   ## Purpose

   <Explain why this feature exists, what problem it solves, and the intent behind it. Mention whether it is primarily public or internal when that helps clarify its role.>

   ## Use cases

   <List the real ways this feature is used or matters in the product.>
   <If it is public, focus on user-visible usage and include brief examples.>
   <If it is internal, focus on the public functionality it enables or affects and explain how it supports that functionality at a principle level.>

   - **<Use case name>**: <One-sentence description of the case.>
     <For public> Example: <Brief example of public usage.>
     How: <Brief explanation of how the feature is used in this case.>

   - **<Affected public functionality>**: <One-sentence description of the public behavior affected by this internal feature.>
     How: <Brief explanation of how this feature supports that public functionality.>

   ## Used by

   - <Feature or capability that depends on this feature>
   - <Feature or capability that depends on this feature>

   ## Dependencies

   - <Feature or capability this feature depends on>
   - <Feature or capability this feature depends on>
   ```

   Notes:

   - The title must be the feature name
   - Purpose is the most important section; it should capture intent, not just behavior
   - Use cases are the second priority; they should show the real ways the feature is used or matters
   - Mention `public` or `internal` only when it clarifies the explanation
   - For a public feature, Use cases should focus on user-visible usage and include brief examples
   - For an internal feature, Use cases should focus on affected public functionality and what this feature enables there
   - Include every meaningful use case you can support from evidence
   - `Used by` and `Dependencies` may say `None identified` if truly empty
   - Keep it concise, but complete enough that another engineer can understand the feature quickly

10. **Sanity check the document**

Before finishing, verify:

- The document matches the actual code
- The purpose is not just a restatement of filenames
- The purpose clearly explains why the feature exists
- Use cases are distinct from each other
- The use cases reflect how the feature is actually used or how it affects public behavior
- Public features list user-visible usage with examples
- Internal features list the public functionality they enable or affect
- `Used by` and `Dependencies` reflect feature-level relationships, not noise
- The file was written to the correct feature folder

**Guardrails**

- Do not write the doc from the user's prompt alone
- Do not reduce the Purpose section to a `public` vs `internal` label
- Do not invent dependencies, dependents, or use cases that are not supported by the codebase
- Do not stop at one file if the feature spans a folder, tests, and exports
- Do not dump raw grep results into the document; synthesize them into feature-level language
- Do not confuse package dependencies with feature dependencies unless the package itself is the feature
- Do not list low-level implementation details as use cases; keep use cases at the feature or public capability level
- Ask when unclear instead of filling gaps with generic prose
