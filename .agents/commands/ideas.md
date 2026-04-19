---
name: 'Ideas'
description: Read changes/<feature-name>/research.md and write or update changes/<feature-name>/ideas.md
category: Workflow
tags: [ideas, planning, changes]
---

Read an existing `changes/<feature-name>/research.md` and write or update `changes/<feature-name>/ideas.md`.

**Input**: The argument after `/ideas` should identify an existing researched change. It may be:

- A free-form feature or topic name
- A change folder name
- A short user description that clearly points to an existing researched change

Examples:

- `/ideas row level security`
- `/ideas 611-row-level-security-integration`
- `/ideas composite foreign keys in relations`

**Goal**

Produce an ideas document that turns the existing research into a prioritized list of user-facing ideas for later proposal, design, and implementation work.

The existing `research.md` is the source of truth. Use it to understand the topic well, then distill only the ideas that clearly follow from it.

By "ideas", we mean user-facing goals, proposals, or features. This document is not an implementation plan.

Every listed idea must:

- Add concrete value for the end user on its own
- Be clear about why it matters in the researched topic
- Be framed from the interface or product-design perspective
- Be accessible to a human reader without relying on unexplained shorthand or jargon
- Avoid implementation details unless they are necessary for high-level understanding

If two partial ideas only make sense together, combine them into one idea instead of listing both.

**Steps**

1. **Identify the target change folder**

   Search `changes/` for the existing folder that best matches the user's input.

   Prefer:
   - An exact folder-name match
   - A folder whose name clearly matches the described feature
   - A folder that already contains `research.md`

   If multiple folders are plausible, stop and ask the user which one to use.
   Do not guess when the match is ambiguous.

   If no relevant researched change exists, tell the user that no matching `changes/<feature-name>/research.md` was found.
   Do not create a new change folder here.

   The output path is `changes/<feature-name>/ideas.md`.

2. **Read the existing research thoroughly**

   Read the full `research.md` before drafting anything.

   Use it to understand:
   - The problem being solved
   - The intended user-facing outcome
   - Which capabilities appear essential vs optional
   - The main user pain points or constraints
   - What orchid-orm already supports and what is missing

   Pay special attention to:
   - `Purpose and goals`
   - `Requirements and edge cases`
   - `Existing support in orchid-orm`
   - `Proposed user-facing design`

   `Valuable external context` and `Community ideas and pain points` matter only insofar as they help clarify what ideas are justified in the research document itself.

3. **Derive candidate ideas from the research**

   Extract only ideas that are clearly supported by the research.

   Good ideas are:
   - User-facing capabilities
   - Clear product or interface proposals
   - Distinct pieces of value a user could understand and want

   Exclude:
   - Internal implementation tasks
   - Refactors
   - Infrastructure work with no standalone user value
   - Open questions presented in the research but not resolved enough to become an idea
   - Anything that requires adding assumptions beyond the research

   Do not split a single cohesive capability into multiple ideas unless each part independently adds value to users.
   If an idea only matters because another idea exists, it should likely be part of that larger idea.
   Prefer wording that a human can understand on first read.
   If the research uses dense shorthand, rename the idea or explain it later in `How`.

4. **Categorize the ideas**

   Use up to these three categories and in this order:
   - `Must haves`: ideas that are required for the feature to function in a meaningful way
   - `Valuables`: ideas that clearly improve the feature for users, but the main purpose is still achievable without them
   - `Nice to have`: extra convenience or narrower-scope ideas that are beneficial but not essential

   Skip any category that has no supported ideas.

   A lower-priority category must not contain an idea that higher-priority ideas depend on.
   If that happens, reclassify the blocking idea upward or merge the ideas.

5. **Prioritize and connect the ideas**

   Within each category, order ideas by:
   - First: ideas that do not depend on another listed idea
   - Then: ideas that depend on earlier ideas
   - Throughout: higher-concept importance first

   The ordering should make conceptual sense for the feature, not read like a task list.

   For every idea, determine which earlier ideas it depends on.
   Only list ideas that actually appear earlier in the document.
   If none, say `None`.

6. **Write or update `ideas.md`**

   If `changes/<feature-name>/ideas.md` already exists, read it now, preserve any still-supported ideas, remove unsupported or stale content, and reconcile the document with the current `research.md`.

   If the file does not exist yet, create it.

   Use this structure:

   ```md
   # <Feature Title>

   ## Must haves

   ### 1. <Idea title>

   - Why: <Why this idea matters for the researched feature.>
   - Adds: <What user-facing value or capability this idea adds.>
   - How: <How the idea would work or be experienced from the user's perspective. Use a short list instead if multiple ingredients are needed to make the idea understandable.>
   - Depends on: <Comma-separated earlier idea titles, or `None`.>

   #### Use cases (optional)

   - <Brief scenario that shows the problem and how this idea solves it.>
     <Optional minimal code example if it genuinely helps.>

   ## Valuables

   ### 2. <Idea title>

   - Why: <Why this idea matters for the researched feature.>
   - Adds: <What user-facing value or capability this idea adds.>
   - How: <How the idea would work or be experienced from the user's perspective. Use a short list instead if multiple ingredients are needed to make the idea understandable.>
   - Depends on: <Comma-separated earlier idea titles, or `None`.>

   **Use cases**: (one or more, optional)

   - <Brief scenario that shows the problem and how this idea solves it.>
     <Optional minimal code example if it genuinely helps.>

   ## Nice to have

   ### 3. <Idea title>

   - Why: <Why this idea matters for the researched feature.>
   - Adds: <What user-facing value or capability this idea adds.>
   - How: <How the idea would work or be experienced from the user's perspective. Use a short list instead if multiple ingredients are needed to make the idea understandable.>
   - Depends on: <Comma-separated earlier idea titles, or `None`.>

   #### Use cases (optional)

   - <Brief scenario that shows the problem and how this idea solves it.>
     <Optional minimal code example if it genuinely helps.>
   ```

   Document guidance:
   - Use the research title for `# <Feature Title>` when it is clear
   - Keep every field concise and specific
   - `Why` should explain importance in the context of this researched topic
   - `Adds` should explain the concrete user-facing value
   - `How` should make the idea easier for a human to picture, especially when the title or `Adds` could still feel abstract
   - Keep `How` at a user-facing level; mention workflow or API shape only when it genuinely clarifies the idea
   - If `How` needs multiple ingredients, use a short list instead of cramming them into one sentence
   - `Depends on` should name earlier ideas exactly as written, or `None`
   - Add `Use cases` when they make the idea clearer
   - Every use case should briefly show the situation, state how the idea solves it, and may include a minimal code example
   - If there are multiple distinct use cases, list all of them
   - If there is only one useful use case, include just one
   - If the idea is simple and already self-explanatory, skip `Use cases` instead of adding filler
   - Do not add category intros unless they are genuinely useful
   - Do not include implementation steps, acceptance criteria, or internal architecture

7. **Quality check**

   Before finishing, verify:
   - The file was written to the correct `changes/<feature-name>/ideas.md` path
   - The chosen change folder is the best match for the user's input
   - Every listed idea is clearly supported by `research.md`
   - No idea depends on unstated assumptions outside the research
   - Each idea adds standalone user value
   - Categories are correct and empty ones were skipped
   - Ordering reflects conceptual priority and dependency
   - `Depends on` only references earlier ideas that the current idea truly relies on
   - `How` makes ambiguous ideas more understandable without turning them into implementation plans
   - `Use cases` are present when they add clarity, and omitted when they would just repeat the idea
   - The document stays at the user-facing or interface-design level
   - Implementation detail appears only when necessary for high-level understanding
   - Idea titles are `###` headings prefixed with numbers, and numbering continues across categories without restarting

**Guardrails**

- Do not do new research for this command
- Do not inspect orchid-orm code or docs to invent additional ideas
- Do not create a new change folder
- Do not treat unresolved questions as settled ideas
- Do not add ideas just because they sound useful
- Do not split ideas too finely
- Do not turn this into a proposal, design doc, or implementation plan
- Ask a focused clarifying question if the target folder is ambiguous
- If the research does not justify any concrete user-facing ideas, say so instead of inventing filler
