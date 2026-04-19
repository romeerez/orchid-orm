---
name: 'Research'
description: Research a feature or topic and write or update changes/<feature-name>/research.md
category: Workflow
tags: [research, analysis, changes]
---

Research a feature or topic and write or update `changes/<feature-name>/research.md`.

**Input**: The argument after `/research` may be:

- A GitHub issue URL
- A GitHub issue number for this repo
- A free-form description of what should be researched

Examples:

- `/research #712`
- `/research https://github.com/romeerez/orchid-orm/issues/712`
- `/research composite foreign keys in relations and migrations`

**Goal**

Produce a research document that captures:

- The purpose and goals of the feature
- Valuable external context gathered from external research
- Detailed requirements and edge cases
- What already exists in orchid-orm and how complete it is
- A user-facing proposal for how the feature should fit this project

The issue or prompt is only the starting point for understanding context. The primary objective is strong external research. After collecting that research, write it down immediately while it is fresh in context. Only then inspect orchid-orm to compare the idea against what already exists here.

This document is for product and design understanding. Do not write implementation details.

**Steps**

1. **Understand the topic**
   - If the input is a GitHub issue URL or issue number, use GitHub MCP to read the issue body and every comment.
   - If only an issue number is given, assume it refers to the current repository.
   - If the issue or prompt mixes multiple unrelated topics, stop and ask the user which topic to research.
   - If the prompt is too vague to identify a concrete research subject, ask one focused clarifying question before proceeding.
   - Extract the likely feature/topic, useful keywords, affected packages, and open questions.

2. **Research external context**
   - Decide what information is worth searching online based on the issue or prompt.
   - Prefer authoritative sources and primary documentation.
   - If the topic involves a Postgres feature, consult the official Postgres docs and capture what Postgres actually supports, including syntax variants, constraints, limitations, and edge cases.
   - If the topic affects ORM or migration-tool behavior, research how established tools handle it, but do not spend time on libraries with fewer than 1000 GitHub stars unless they are uniquely relevant.
   - Read a small number of discussions or forums when helpful to understand user pain points, confusing cases, and desired ergonomics.
   - Treat this as the main phase of the command. The issue or prompt only tells you what to investigate.

3. **Choose the target change folder**
   - After the external research, choose the most accurate short descriptive kebab-case name for the topic.
   - Search `changes/` for an existing folder whose name clearly matches the researched topic.
   - If a similar folder already exists, reuse it. Do not create a duplicate with a slightly different name.
   - If multiple folders are plausible and the choice is ambiguous, ask the user which one to use.
   - If no suitable folder exists, create a new folder name based on what you learned from the research.
   - If the input came from a GitHub issue, the folder name MUST start with the issue number, for example `712-composite-foreign-keys`.
   - The output path is `changes/<feature-name>/research.md`.

4. **Decide what is worth keeping**
   - Keep only information that helps define requirements, edge cases, naming, API shape, migration behavior, compatibility expectations, or product decisions.
   - Separate facts from your inferences.
   - Do not dump raw search notes, long quotes, or competitor feature matrices into the document.

5. **Write or update `research.md` with the external findings**
   - Before inspecting orchid-orm itself, make sure `changes/<feature-name>/research.md` exists and already contains the external research while it is still fresh.
   - If the file already exists, read it now, preserve useful content, integrate the new findings into it, and remove duplication or stale statements.
   - If the file does not exist yet, create it now and write the external findings into it.
   - Do not append repeated notes just because they came from a new source.
   - At this stage, prioritize these sections:
     - `Purpose and goals`
     - `Valuable external context`
     - `Community ideas and pain points` when useful
     - `Requirements and edge cases`
     - `References`
   - Do not wait until the end to write. Capture the research first, then continue.

6. **Inspect what already exists in orchid-orm**
   - After the external research has been written down, search the repo for code, tests, docs, and existing changes related to the topic.
   - Read `docs/src/.vitepress/dist/llms.txt` for high-signal documentation context, then verify relevant claims against actual code or tests when needed.
   - Determine whether the feature already exists, partially exists, exists under a different name, or is only covered by related functionality.
   - Note relevant related features, current limitations, and likely integration points from a user's perspective.
   - Existing project support is required context, but it is analyzed after the external research is stored.

7. **Complete `research.md` with orchid-orm analysis and design**

   Structure the document so it is useful for later proposal and design work. It MUST contain these sections:

   ```md
   # <Feature Title>

   ## Purpose and goals

   ## Valuable external context

   ## Community ideas and pain points <!-- optional: only if there are valuable points -->

   ## Requirements and edge cases

   ## Existing support in orchid-orm

   ## Proposed user-facing design

   ## References
   ```

   Section guidance:
   - `Purpose and goals`: explain what problem is being solved and why it matters.
   - `Valuable external context`: summarize the most relevant findings from Postgres docs, other mature tools, and other authoritative sources.
   - `Community ideas and pain points`: include only useful observations from issue comments, forums, or discussions.
   - `Requirements and edge cases`: detailed, concrete, and actionable. Cover compatibility, limitations, naming constraints, UX or API expectations, migration concerns, failure modes, and edge cases discovered in research.
   - `Existing support in orchid-orm`: state clearly whether the feature already exists, is partial, or is absent. Include related functionality, similar features, and how complete current support appears to be.
   - `Proposed user-facing design`: describe how the feature should feel to users of this project. Focus on behavior and ergonomics, not implementation.
   - `References`: include the most important source links you used.

   After the repo analysis, update the document to complete:
   - `Existing support in orchid-orm`
   - `Proposed user-facing design`
   - Any corrections to earlier sections if orchid-orm constraints change the interpretation of the research

8. **Specific expectations for existing-project analysis**

   In `Existing support in orchid-orm`, you MUST answer:
   - Does this feature already exist?
   - If yes, is it complete, partial, or limited?
   - What related functionality already exists?
   - Are there similar features in `docs/src/.vitepress/dist/llms.txt`, code, tests, or `changes/`?
   - What does that imply for the design of the new or expanded feature?

9. **Final quality check**

Before finishing, verify:

- The file was written to the correct `changes/<feature-name>/research.md` path.
- The target folder name was chosen after the external research phase, not before it.
- External research was performed before the orchid-orm comparison.
- External findings were written down before repo analysis began.
- An existing `research.md`, if present, was integrated; otherwise a new one was created before repo analysis began.
- Existing content was merged instead of duplicated.
- Postgres topics are grounded in official Postgres docs.
- Existing orchid-orm functionality was investigated, not guessed.
- The proposed design stays at the user-facing level.
- The document is concise, factual, and useful for the next design or proposal step.

**Guardrails**

- Do not rely only on the issue text or the user prompt.
- Do not skip issue comments when the input is a GitHub issue.
- Do not create a new change folder when an obviously matching one already exists.
- Do not spend research time on small tools with fewer than 1000 GitHub stars unless they are uniquely relevant.
- Do not pick the final change name before the main external research phase clarifies the topic.
- Do not read or integrate an existing `research.md` until after the main external research phase is complete.
- Do not jump into orchid-orm code inspection before the external research has been captured in `research.md`.
- Do not confuse "mentioned in docs" with "fully implemented"; verify.
- Do not write implementation plans or internal architecture here.
- Ask a focused clarifying question if the topic or target folder is genuinely ambiguous.
