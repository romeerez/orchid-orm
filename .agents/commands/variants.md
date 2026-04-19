---
name: 'Variants'
description: Read a specific idea and write or update changes/<feature-name>/<NUMBER-idea-name>/variants.md
category: Workflow
tags: [variants, design, research, changes]
---

Read a specific idea from `changes/<feature-name>/ideas.md`, research solution variants for it, and write or update `changes/<feature-name>/<NUMBER-idea-name>/variants.md`.

**Input**: The argument after `/variants` should include both:

- A feature or change folder name
- An idea number or idea title from `changes/<feature-name>/ideas.md`

Examples:

- `/variants 712-composite-foreign-keys 2`
- `/variants row-level-security-integration "Policy-aware query configuration"`
- `/variants composite-foreign-keys-in-relations 3`

**Goal**

Produce a document that explains the goal of one specific idea and proposes one or more genuinely different user-facing solutions for achieving it.

This command is about solution design, not implementation planning. The output should help a human compare approaches, and it should also be clear enough that a later AI can use it as a reliable basis for a more detailed proposal.

The existing `research.md` is background context, but it is usually not enough on its own. Unless the idea is trivial and the solution space is obvious, do fresh idea-specific research to:

- Discover distinct viable ways the idea could be implemented
- Understand the trade-offs of those approaches well enough to propose high-quality solutions
- Ground the proposed solutions in Postgres behavior, existing ecosystem patterns, and orchid-orm's current user-facing design

**Steps**

1. **Identify the target change folder**

   Search `changes/` for the folder that best matches the user's feature input.

   Prefer:
   - An exact folder-name match
   - A folder whose name clearly matches the described feature
   - A folder that already contains both `research.md` and `ideas.md`

   If multiple folders are plausible, stop and ask the user which one to use.
   Do not guess when the match is ambiguous.

   If no relevant change folder exists, tell the user that no matching researched change was found.
   Do not create a new change folder here.

2. **Resolve the target idea**

   Read the full `changes/<feature-name>/ideas.md`.

   Match the requested idea by:
   - Exact idea number from headings like `### 2. <Idea title>`
   - Or exact / clearly intended idea title

   If the title match is ambiguous, stop and ask one focused clarifying question.
   Do not guess between similarly named ideas.

   Record:
   - The exact numbered idea heading
   - The idea title
   - Its `Why`, `Adds`, `How`, `Depends on`, and any use cases that help clarify the idea

3. **Read existing research for idea-specific context**

   Read `changes/<feature-name>/research.md` after identifying the idea.

   Use it to understand:
   - The broader feature context
   - Requirements and edge cases that affect this idea
   - Existing orchid-orm support that may constrain or shape solutions
   - References already collected that may be relevant to this idea

   Ignore research sections that do not materially affect the selected idea.
   The purpose of this step is to narrow the problem before doing variant research.

4. **Decide how much new research is needed**

   Make an explicit judgment:
   - If the idea is trivial and the solution space is obvious, proceed with only:
     - `ideas.md`
     - the idea-relevant parts of `research.md`
     - relevant orchid-orm docs
     - any obviously relevant references already listed in `research.md`
   - Otherwise, do fresh idea-specific research before drafting solutions

   Bias toward doing fresh research unless the idea is truly simple.
   This command should usually perform broader solution-oriented research than `ideas.md` already contains.

5. **Research solution variants**

   When fresh research is needed, research specifically for this idea rather than the whole feature.

   Prioritize:
   - Official Postgres docs when the idea touches Postgres capabilities or limitations
   - Mature existing tools and libraries to learn how different user-facing approaches are exposed
   - Existing discussions or community references when they reveal user pain points, confusing trade-offs, or useful ergonomics

   Research goals:
   - Find distinct approaches, not just one preferred approach
   - Understand enough detail to explain each proposed solution clearly and accurately
   - Avoid proposing solutions that conflict with Postgres realities or well-established user expectations

   Do not do generic background research that does not affect the proposed variants.
   Keep the research focused on how the idea could be expressed to users.

6. **Inspect relevant orchid-orm documentation**

   Read `docs/src/.vitepress/dist/llms.txt`, but only the sections that are relevant to the selected idea or its candidate solutions.

   Use the docs to understand:
   - How similar existing features are explained to users
   - Which naming or API patterns already exist
   - How this idea could integrate naturally into orchid-orm from a user's perspective

7. **Read relevant references from `research.md`**

   At the end of `research.md`, review the reference list.

   Read only the references that appear relevant to:
   - The selected idea
   - A candidate solution
   - A trade-off that needs stronger grounding

   It is not necessary to read every reference.
   Prefer the sources that materially improve solution quality.

8. **Derive the solution variants**

   Propose one or more solutions that are genuinely different ways to achieve the idea's goal.

   Good solution differences include:
   - Different public interfaces
   - Different user workflows
   - Different levels of explicitness vs automation
   - Different ways responsibility is split between user configuration and framework behavior

   Bad solution differences include:
   - Minor naming changes
   - Slightly different method signatures with the same overall workflow
   - Variants that are effectively the same approach with small ergonomic tweaks

   If the idea only supports one serious solution, that is acceptable.
   Do not invent weak alternatives just to produce multiple options.

9. **Write or update `variants.md`**

   The output path must be:

   `changes/<feature-name>/<NUMBER-idea-name>/variants.md`

   Where:
   - `NUMBER` is the idea number from `ideas.md`
   - `idea-name` is a short kebab-case form of the idea title

   If the idea folder does not exist yet, create it.

   If `variants.md` already exists, read it now, preserve useful content, remove stale or unsupported claims, and reconcile it with the current idea and research.

   Use this structure:

   ```md
   # <Idea Title>

   ## Goal

   <Explain what this idea is trying to achieve for users and why it matters.>

   ## Context from existing research

   <Brief summary of the relevant context from `research.md`, orchid-orm docs, and any prior references that materially shape the solution space.>

   ## Solution 1: <Solution name>

   - Summary: <One paragraph describing the solution at a user-facing level.>
   - User-facing interface: <Describe the public API, configuration, methods, or other visible surface users would work with.>
   - How it works: <Explain the principles clearly enough that both a human reader and a later AI can understand the exact intended behavior without guessing. Stay out of implementation internals, but remove ambiguity about what the solution means.>
   - Workflow: <Describe the sequence of what a user does and what they get. Use a short list if it is clearer.>
   - Pros: <Benefits of this solution.>
   - Cons: <Limitations, awkwardness, or trade-offs of this solution.>

   #### Example use case

   - <Brief scenario showing when a user would choose this solution and what result they get.>
     <Optional minimal code example when it materially improves clarity.>

   ## Solution 2: <Solution name> <!-- optional -->

   - Summary: <One paragraph describing the solution at a user-facing level.>
   - User-facing interface: <Describe the public API, configuration, methods, or other visible surface users would work with.>
   - How it works: <Explain the principles clearly enough that both a human reader and a later AI can understand the exact intended behavior without guessing. Stay out of implementation internals, but remove ambiguity about what the solution means.>
   - Workflow: <Describe the sequence of what a user does and what they get. Use a short list if it is clearer.>
   - Pros: <Benefits of this solution.>
   - Cons: <Limitations, awkwardness, or trade-offs of this solution.>

   #### Example use case

   - <Brief scenario showing when a user would choose this solution and what result they get.>
     <Optional minimal code example when it materially improves clarity.>

   ## Comparison <!-- optional: only when there are multiple solutions -->

   - <How solution 1 is better than solution 2 for certain users or priorities.>
   - <How solution 2 is better than solution 1 for certain users or priorities.>
   - <Which solution seems most natural for orchid-orm users, if that conclusion is justified.>

   ## References

   - <Relevant source and why it matters to this idea or a proposed solution.>
   ```

   Document guidance:
   - Stay strictly at the user-facing or product-design level
   - Describe visible behavior, public interfaces, workflows, and trade-offs
   - Do not write implementation plans, internal architecture, or low-level mechanics
   - `How it works` must be concrete and unambiguous enough that a later AI can use it for a more detailed proposal without inventing missing behavior
   - Prefer short clear prose over dense shorthand
   - Add inline source references when a claim, constraint, or solution idea comes from a specific source
   - Include a `Comparison` section only when there is more than one real solution
   - If there is only one serious solution, explain it well instead of padding the document

10. **Source handling**

The resulting solution descriptions should reference relevant sources when they are based on those sources.

Source expectations:

- Cite official Postgres docs when they shape what is possible or desirable
- Cite mature existing tools when they inspire a user-facing approach or reveal a trade-off
- Cite orchid-orm docs when they influence naming, workflow, or integration expectations
- Cite community sources only when they add meaningful insight into user needs or pain points

Do not add references that were not actually used.
Do not dump a large bibliography just because it exists.

11. **Quality check**

Before finishing, verify:

- The file was written to the correct `changes/<feature-name>/<NUMBER-idea-name>/variants.md` path
- The selected feature folder is the best match for the user's input
- The selected idea is the correct numbered heading or title from `ideas.md`
- The proposed solutions are genuinely different, unless only one serious solution exists
- The command did enough fresh research to justify the proposed variants, unless the idea was clearly trivial
- Relevant parts of `research.md` were used, and irrelevant parts were ignored
- Relevant orchid-orm docs were consulted
- Relevant references from `research.md` were read when they helped the idea
- Each solution is described clearly enough for both a human reader and a later AI to understand the intended user-facing behavior without guessing
- `Pros` and `Cons` reflect real trade-offs rather than filler
- The document stays at the user-facing level and does not drift into implementation planning
- Source references appear where they materially support a solution or claim

**Guardrails**

- Do not create a new change folder
- Do not skip reading `ideas.md` before reading `research.md`
- Do not treat the old `research.md` as sufficient by default for solution quality
- Do not propose shallow variants that are the same idea with small wording changes
- Do not write implementation tasks, internal architecture, or code-generation guidance
- Do not read all of `docs/src/.vitepress/dist/llms.txt` or all references blindly; stay selective and relevant
- Do not guess when the feature folder or idea match is ambiguous
- Ask one focused clarifying question if the target folder or idea cannot be identified confidently
