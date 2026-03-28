---
name: type-check
description: Run this after finishing edits to .ts files to catch and fix type errors in the current package and its dependents.
---

# Type Check

## Context
- Refer to `AGENTS.md` to identify dependencies between packages.

## Step 1: Current Package
1. **Identify Package:** Determine `pkg_name` from the modified `.ts` file paths.
2. **Run & Fix:** Execute `pnpm --filter *pkg_name* types`.
3. **Loop:** If errors occur, fix them and re-run until the current package passes.

## Step 2: Dependent Packages
1. **Identify Dependents:** Check `AGENTS.md` for any packages that depend on `pkg_name`.
2. **Verify Downstream:** For each affected dependent package (`dep_pkg`):
   - Execute `pnpm --filter *dep_pkg* types`.
   - **Fix:** If your changes in `pkg_name` broke types in `dep_pkg`, navigate to `dep_pkg` and fix the call sites.
   - **Loop:** Repeat until all affected packages pass.

## Step 3: Reporting
- Provide a summary of all packages checked and any cross-package fixes applied.
- If a fix in a dependent package requires a complex architectural change, stop and ask the user.

## Usage Note
Strictly target `.ts` files. Do not run for other file types.