---
name: code-doc
description: Use when the user prompts "code doc" to create or update internal Orchid ORM code documentation from changes/ specs, short-code feature folders, or existing implementation code.
---

Document internal feature knowledge close to the implementation. Use top-level specs only when durable knowledge is shared across packages.

**Inputs**

- `code doc gr`: resolve one `changes/gr-*` folder.
- `code doc 707`: resolve one `changes/707-*` folder.
- `code doc gr 2`: document only the nested folder in `changes/gr-*` that starts with `2`.
- `code doc select`: document an implementation topic that may not live in `changes/`.

If the feature folder, nested selector, or implementation topic is ambiguous, ask one focused clarification question. Otherwise infer the scope and proceed.

**Caveman style**

- When this skill runs, use the caveman skill's full style for all agent-facing progress, questions, and final reports: terse fragments, no filler, exact technical terms preserved.
- Do not announce the style. Just write that way.
- Generated code docs must also use caveman style. Keep markdown headings, links, code symbols, API names, SQL terms, and quoted errors exact; compress explanatory prose.
- Do not compress so far that durable technical meaning, ordering, or ownership becomes ambiguous. If caveman wording would hide a constraint, write the clear version.
- Code blocks and code comments stay normal code style.

**Workflow**

1. Resolve the source scope.
   - If the input starts with a code or number, find exactly one non-archived `changes/<id>-*` folder whose name starts with that value.
   - If a second numeric selector is provided, include only the direct child folder whose first path segment equals that number, such as `1-*` for `1`, and read its `spec.md`.
   - Without a nested selector, find every `spec.md` under the matched feature folder and treat all of them as the documentation source.
   - Also read useful feature-level context files in that change folder, such as `research.md` or a root `spec.md`, when present.
   - If the request is not based on `changes/`, search the implementation, tests, and docs for the named topic.

2. Distill the source specs.
   - Extract only durable requirements, constraints, decisions, gotchas, known omissions, and reasons for unusual behavior.
   - Drop task-management detail, implementation history, repeated examples, and obvious API descriptions.
   - Separate cross-package facts from package-specific implementation details.

3. Inspect the implementation.
   - Use `rg` to search feature names, API names, SQL terms, metadata keys, tests, and migration/generator code.
   - Follow the code wherever the feature actually lives. Relevant behavior may be split across the main feature file, helper modules, type surfaces, internal metadata, public exports, internal exports, tests, SQL rendering, introspection, migration generation, adapter hooks, or package setup glue.
   - Determine the affected packages and the smallest relevant set of code files that explain each package's role.
   - Read the actual implementation before writing docs. Do not rely only on `changes/`.
   - Look for nuances not captured in the source specs: defensive conditions, ordering requirements, metadata shapes, Postgres constraints, compatibility behavior, and workarounds.

4. Choose doc locations.
   - Before creating a doc, search existing `.md` files under `specs/` and the affected package folders for the same feature under another name. Update or merge with the existing doc when it already owns the topic.
   - Default to package-local docs when the implementation and durable decisions are owned by one package, even if the source change folder describes a user-visible feature.
   - For a feature fully owned by one package and centered on one code file, put one markdown file beside that code file with the same base name.
   - If a package implements one feature across several files, create one package-level feature doc in the folder that best owns the feature. That single doc owns the package's role for the feature, including supporting files and helper modules.
   - Do not create one doc per implementation file when those files support the same package-level feature.
   - If unrelated aspects in the same package are genuinely distinct, create separate focused docs.
   - If there is no dedicated code file, infer the clearest feature name, such as `foreign-key.md`, and place it in the folder most relevant to that code.
   - Create or update a top-level `specs/<feature-name>.md` only when the feature spans packages or has durable requirements that multiple packages must share.
   - Do not create a top-level spec just because the source lives in `changes/<id>-*`, has a feature-style name, or includes public API details for one package.

5. Name docs deliberately.
   - Derive top-level spec names from the change folder only after deciding a top-level spec is warranted. Drop numeric prefixes and short tracking-code prefixes. Example: `changes/gr-grant-revoke` becomes `specs/grant-revoke.md`.
   - Package docs usually match the main implementation file without the TypeScript suffix.
   - Drop implementation-only suffixes such as `.db` when they are not meaningful to the feature doc. Example: `grants.db.ts` gets `grants.md`.
   - Keep meaningful suffixes that describe a package role. Example: `grants.generator.ts` gets `grants.generator.md`.

6. Write the docs.
   - Top-level specs describe only cross-package knowledge: purpose, requirements, Postgres or platform constraints, decisions, gotchas, known omissions, and links to package docs.
   - Package docs describe only that package's role: what it owns, relevant files, package-specific requirements, internal decisions, non-obvious conditions, and gotchas.
   - Package docs for cross-package features must link to the top-level spec instead of duplicating feature-wide requirements.
   - Top-level specs must link back to all package docs with one brief note per package role.
   - For a package-only feature, put durable purpose, requirements, decisions, gotchas, and known omissions directly in the package doc.
   - Keep docs distilled. Do not document every function, restate tests, or duplicate neighboring specs.
   - Use whatever document shape best fits the feature, but write for future maintainers who need to understand why non-obvious code exists.
   - Use caveman style in prose: short, direct fragments are okay; exact technical names stay unchanged; constraints stay unambiguous.
   - Prefer relative markdown links.

7. De-duplicate and tighten.
   - For cross-package features, re-read the top-level and package docs together before finishing.
   - Move duplicated feature-wide knowledge into the top-level spec and replace package-level copies with links.
   - Move package-specific details out of the top-level spec and into the owning package doc.
   - Ensure no two docs in the same package cover the same feature under different names.
   - Ensure package docs mention other packages only by linking to the top-level spec or by a brief role note when needed for orientation.

8. Add code comments only for gotchas.
   - If implementation code contains a workaround, surprising condition, ordering dependency, or edge-case guard whose reason is not obvious, add a short comment explaining why it exists.
   - Do not add comments that restate straightforward code.

9. Verify and archive.
   - Run `pnpm verify`. If only markdown docs changed and no packages are affected, inspect the written links and formatting manually.
   - If the skill was run for a full `changes/<id>-*` feature without a nested selector, move the entire feature folder to `changes/archived/` after docs are written and checked.
   - Do not archive when a nested selector such as `1` or `2` was used.
   - Do not archive when the request documented an implementation topic outside `changes/`.
   - If `changes/archived/<folder-name>` already exists, stop and ask before moving.

**Quality bar**

- The docs explain why non-obvious code exists, not just what it does.
- Cross-package knowledge lives in one top-level spec.
- Package-only knowledge lives in package docs, with no top-level spec created solely as a feature summary.
- Package docs do not describe other packages' implementations.
- Related package docs link through the top-level spec instead of duplicating requirements.
- Existing code and tests are inspected before conclusions are written.
- Uncertainty is called out in the final response when inference was required.

**Final report**

Report in caveman style: resolved source scope, docs created or updated, packages covered, code comments added, verification performed, whether the change folder was archived, and any points that were documented with uncertainty.
