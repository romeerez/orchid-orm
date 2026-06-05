---
name: changeset
description: Use when the user prompts "changeset".
---

# Changeset

## Overview

Create the release changeset, optional breaking-change note, staging, and commit. Order matters: scope, patch/minor classification, file edits, exact-message commit.

## Workflow

1. Determine the change scope.
   - If the prompt describes the change directly, use that description.
   - If the prompt is like `611 1`, find `changes/611*/1*/spec.md` and read it.
   - If the scope is still unclear, ask the user before continuing.
2. Determine the issue number.
   - Prefer the numeric prefix from a `changes/` directory.
   - Otherwise use the prompt's issue number.
   - If no issue number is known, ask the user; the changeset and commit message must end with `(#<issue-number>)`.
3. Classify the release type.
   - `patch`: adding new functionality.
   - `patch`: extending existing functionality while preserving previous contracts.
   - `minor`: any backward-compatibility gap or breaking behavior/API change.
4. Determine affected packages.
   - Include packages whose public behavior/API changed.
   - Use each package's `name` from `packages/<folder>/package.json` in the changeset file.
   - If `pqb` or `rake-db` are affected, always include `orchid-orm`.
   - If `pqb` or `rake-db` is `minor`, `orchid-orm` is also `minor`.
5. For a `minor` change, prepend a section to `BREAKING_CHANGES.md`.
   - Describe before, after, and upgrade steps.
   - Grep current affected versions from `packages/*/package.json`.
   - Title: affected packages and versions after this release by incrementing minor and setting patch to `0`.
   - Keep the section short and clear.
6. From the repo root, run:
   ```sh
   pnpm changeset add --empty
   ```
7. Edit the generated `.changeset/*.md` file printed by the command.
   - Put affected packages between the `---` lines in changeset format.
   - Use `patch` or `minor` values only.
   - Always include `orchid-orm` when `pqb` or `rake-db` are affected.
   - After the second `---`, add a blank line and a 1-2 sentence description ending with `(#<issue-number>)`.
8. Stage and commit:
   - Run `git add -A`; include all changed files, even files not changed by this agent.
   - Commit with exactly the same message as the changeset description, including `(#<issue-number>)`.

## Quick Reference

| Situation                     | Release type            |
| ----------------------------- | ----------------------- |
| New functionality             | `patch`                 |
| Contract-preserving extension | `patch`                 |
| Backward-compatibility gap    | `minor`                 |
| `pqb` or `rake-db` affected   | Include `orchid-orm`    |
| `pqb` or `rake-db` is `minor` | `orchid-orm` is `minor` |

## Examples

Prompt `changeset 611 1` means read `changes/611*/1*/spec.md`.

Example changeset file:

```md
---
'orchid-orm': minor
'pqb': patch
---

Fix selecting relation when deleting a record (#708)
```

## Common Mistakes

- Do not classify new functionality as `minor`; it is `patch` unless compatibility is not preserved.
- Do not forget `orchid-orm` when `pqb` or `rake-db` are affected.
- Do not invent an issue number. Ask the user if it is unknown.
- Do not alter the commit message; it must exactly match the changeset description.
