---
name: 'Refine'
description: Interactively refine an existing feature design document, update it in place, and keep a refinement log
category: Workflow
tags: [refine, design, interactive, changes]
---

Run an interactive refinement session for an existing feature design document.

This command is for clarifying and tightening a proposal that already exists. It is not a one-shot rewrite. The workflow may span multiple user turns.

The normal behavior is:

- read the proposal carefully
- identify what looks unclear, ambiguous, or under-specified
- discuss questions with the user
- record only user-confirmed questions in a `## Refinement` section
- record only user-confirmed conclusions under those questions
- keep the main design above `## Refinement` synchronized with every confirmed conclusion

**Input**

This workflow can start in two ways:

1. **Directly from the user**

   The argument after `/refine` should identify:
   - a feature or change folder
   - an idea number or idea title
   - optionally, a file name to refine

   If the user does not specify a file, default to:

   `changes/<feature-name>/<NUMBER-idea-name>/selected-variant.md`

   Examples:
   - `/refine 611-row-level-security-integration 2`
   - `/refine row-level-security-integration "Run work inside an explicit RLS context"`
   - `/refine row-level-security-integration 2 variants.md`

2. **From another workflow**

   If the calling workflow already knows the input file, use that file directly instead of re-resolving it.

   By default, update that same file in place.

   Only write to a different output path when the caller or the user explicitly instructs you to do so.

**Goal**

Make the design document more reliable for later work by resolving important questions collaboratively and keeping both:

- the main design
- the refinement log

in sync throughout the session.

The refinement log is part of the artifact. It should help a later reader understand which questions mattered and what was decided.

**Steps**

1. **Resolve the input file**

   If another workflow already provided the input file path, use it.

   If the user initiated the workflow directly:
   - find the best matching folder in `changes/`
   - resolve the idea folder inside `changes/<feature-name>/`
   - default the input file name to `selected-variant.md` unless the user specified another file

   Matching rules:
   - prefer an exact change-folder match
   - prefer an exact idea number match from folders such as `2-run-work-inside-an-explicit-rls-context`
   - otherwise match the idea title against the folder suffix or `ideas.md`

   If multiple folders or ideas are plausible, ask one focused clarifying question.
   Do not guess.

   If the resolved input file does not exist, stop and tell the user.
   Do not create the starting design file in this command.

2. **Read the proposal and supporting context**

   Read the full input file before commenting on it.

   Understand:
   - the goal
   - the proposed approach
   - the explicit assumptions
   - what is still implied rather than stated
   - which statements depend on existing orchid-orm behavior or external facts

   Read only the extra context that is needed to understand or verify the design:
   - relevant orchid-orm docs in `docs/src/.vitepress/dist/llms.txt`
   - external sources when needed for technical accuracy or when the user asks you to research

   When researching online, prefer official docs and trustworthy primary sources.

3. **Ensure the document has a refinement section**

   If the input file does not already contain `## Refinement`, append an empty `## Refinement` section at the end of the file immediately.

   If `## Refinement` already exists, preserve it and continue working inside it.

   There must be exactly one top-level `## Refinement` section in the final document.

4. **Give the user your initial assessment**

   After you understand the proposal, tell the user:
   - whether the design looks clear overall
   - which parts seem ambitious, risky, vague, or incomplete
   - whether anything important appears to be missing

   You may propose refinement questions at this point.

   Do not write those proposed questions into the document unless the user confirms that they should be tracked.

5. **Add only confirmed questions to `## Refinement`**

   When the user confirms a question to track, write it into `## Refinement` unless that same question is already present.

   Use one subsection per tracked question in this form:

   ```md
   ## Refinement

   ### 1. <question title>

   <explain the question>

   Pending.
   ```

   Rules:
   - number questions in the order they are first accepted
   - do not duplicate a question that is already present
   - if the document already contains refinement questions, continue from the existing numbering
   - preserve earlier answered questions unless the user explicitly wants them removed

6. **Work through questions collaboratively**

   Process questions one by one. Let the user steer the order when they want to.

   Different question types need different behavior:
   - **Technical questions**
     - inspect orchid-orm code, tests, docs, and external references as needed
     - prefer official documentation when online research is needed
     - distinguish confirmed facts from inference

   - **Ergonomics or product-shape questions**
     - propose options when helpful
     - include short code examples if they clarify the trade-offs
     - do not settle the decision on your own when it depends on user preference

   While a question is still open, you may temporarily write notes under it such as:
   - `Pending.`
   - candidate options
   - small example snippets
   - research notes that help the discussion

   Keep these notes concise and useful.

7. **Only record an answer after user confirmation**

   Do not treat a tentative discussion as a final answer.

   Once the user confirms the conclusion for a question:
   - replace temporary notes or options under that question with a final answer
   - keep the final answer directly under the corresponding question

   The final recorded answer should include:
   - the conclusion
   - why it was chosen (if available)
   - the key points of how you reached it

   Use this form:

   ```md
   ### Question 1: <question>

   #### Answer:

   <final conclusion, why it was chosen, and the key evidence or reasoning behind it>
   ```

8. **Synchronize the main design after every confirmed answer**

   After every confirmed answer, immediately update the document above `## Refinement` so it matches the new conclusion.

   Update whichever parts are affected:
   - goal
   - approach
   - assumptions
   - examples
   - references
   - any other affected design details

   If a confirmed answer changes the design, the main document must be updated before you move on.

   Remove contradictions and stale statements instead of leaving the log to explain them away.

9. **Continue until the open questions are resolved**

   The user may add more questions later in the same session.

   Each time:
   - add newly confirmed questions to `## Refinement`
   - research or discuss them
   - wait for user confirmation
   - record the final answer
   - sync the design above `## Refinement`

   If the user asks you to investigate something in the codebase or online, do that work before recording the answer.

10. **Finish cleanly**

When all tracked questions are answered, make sure the document is coherent as a whole.

The refinement log should still remain in the file unless the user explicitly asks to remove it.

**Quality check**

Before finishing, verify:

- the correct input file was chosen
- direct invocations defaulted to `selected-variant.md` unless the user chose another file
- delegated invocations used the already-known input file unless explicitly told otherwise
- the full proposal was read before assessment
- `## Refinement` exists exactly once
- proposed questions were not written unless the user confirmed them
- duplicate questions were not added
- every recorded answer was user-confirmed
- every recorded answer includes the conclusion and why or supporting basis when available
- temporary options or notes were replaced once a final answer was recorded
- the design above `## Refinement` was updated after each confirmed conclusion
- the main design and the refinement log do not contradict each other

**Guardrails**

- Do not invent questions and silently write them into the log
- Do not answer ergonomics decisions on the user's behalf
- Do not leave the main design stale after recording a confirmed answer
- Do not rely on memory for technical claims that should be checked in code, docs, or official external sources
- Do not dump raw research notes into the document
- Do not remove earlier refinement history unless the user asks
- Do not create the initial proposal file here if it does not already exist
- Ask a focused clarifying question whenever the target change, idea, or file is ambiguous
