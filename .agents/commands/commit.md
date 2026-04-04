---
description: Commit an archived OpenSpec change
---

Commit an archived OpenSpec change securely and intelligently.

**Input**: Optionally specify an archived change name (e.g., `/commit migrate-public-config`). If omitted, infer from context or prompt the user.

**Steps**

1. **Verify Archive Status**

   If the user requests to commit a change that is still in `openspec/changes/` (active/not archived), **abort immediately**. 
   Inform the user: "Change must be archived first. Please run the archive command or archive it manually before committing."

2. **Select the Archived Change by Analyzing Uncommitted Files**

   First, run `git status` (or `git diff --name-only`) to get the list of all currently modified, added, or deleted files in the working directory.
   Search for these modified file paths across all archived tasks by running a search (e.g., `grep_search`) inside `openspec/changes/archive/*/specs/tasks.md`.
   The archives whose `tasks.md` mention the currently modified files are your active, non-committed changes.
   If no change name is provided:
   - If the uncommitted files match exactly one non-committed archive, select it automatically.
   - If they match multiple archives, list those specific archives and use the **AskUserQuestion tool** to let the user select one.
   - If they match no archives (or if there are no uncommitted files), prompt the user for guidance or ask for a change name.
   
   *Rule*: Only commit **one feature** (one change) at a time.

3. **Read Artifacts for Context**

   Once the specific archive is chosen (`<name>`), read `openspec/changes/archive/<name>/specs/tasks.md` to efficiently extract all the relevant file paths modified for this feature.
   Check `openspec/changes/archive/<name>/proposal.md` to understand the scope and look for GitHub issue numbers.

4. **Analyze and Confirm Unstashed Changes**

   Run `git status` to identify all modified, added, or deleted files in the working directory.
   Compare these files against the file paths extracted from `specs/tasks.md`.
   - Stage the files that match the `tasks.md` list (`git add <file>`).
   - **If there are other non-committed file paths** that are NOT mentioned in `tasks.md`:
     List them to the user and use the **AskUserQuestion tool** to ask for confirmation. Present these options:
     1. Accept them to also be committed.
     2. Reject them (so they are left uncommitted).
     3. Tell you selectively which of them should be committed together with the relevant changes.
   - Stage any additionally approved files based on the user's response.

5. **Generate Commit Message**

   Write a good, short, and sharp commit message summarizing the feature.
   - Look inside `proposal.md` for a link to a GitHub issue.
   - If a GitHub issue link (e.g., `https://github.com/.../issues/123`) or reference is found, add `(#123)` to the end of the commit title.
   - Example: `Implement public config logging (#123)`

6. **Execute Commit**

   Run `git commit` with the correctly staged files.

7. **Display Output**

   Display a summary of the commit:
   - Commit title and message
   - Files committed
   - Files left unstaged (if any unrelated changes were intentionally excluded)

**Output On Success**

```
## Commit Complete

**Feature:** <change-name>
**Commit Title:** <commit-title-with-issue-number>

Successfully committed the feature. 

**Files Committed:**
- src/path/to/file.ts
- ...

*(If applicable)*
**Unrelated files left unstaged:**
- src/path/to/other.ts
```

**Guardrails**
- Never commit active (unarchived) changes. Abort and require archiving first.
- Only commit one feature at a time.
- Do not blindly `git add .`. Only stage files that contextually belong to the archived tasks.
- Ensure the commit message is short and sharp.
- Always append the GitHub issue number to the title if present in `proposal.md`.
