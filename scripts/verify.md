# Verify Script

## How to run

```sh
node scripts/verify.ts
```

```sh
node scripts/verify.ts --debug
```

Node 24 strips TypeScript types by default, so no loader is required.

## Implemented requirements

- Uses Node native modules to execute CLI commands.
- Uses `git status --porcelain --untracked-files=all` to detect changed files.
- Only considers changed files with these extensions: `.js`, `.ts`, `.mjs`, `.mts`, `.cjs`, `.cts`, `.json`.
- Ignores all changed files with other extensions or no extension.
- Supports `--debug` to print a concise preflight explanation before running verification:
  - Non-ignored changed files and whether each maps to a tracked package or a global change.
  - Ignored changed file count and up to five ignored paths.
  - Whether the adapter matrix is enabled and which file enabled it.
  - Package inclusion summary as changed, dependent, global, or none.
- Tracks package dependencies only for:
  - `packages/create-orm`
  - `packages/orm`
  - `packages/pqb`
  - `packages/rake-db`
  - `packages/schemaConfigs/zod`
  - `packages/schemaConfigs/valibot`
  - `packages/test-factory`
- Ignores changes to package manifests and build metadata that should not affect verification flow:
  - `package.json` at any depth.
  - `rolldown.config.mjs` at any depth.
  - Root `rolldown.utils.mjs`.
  - Root `pnpm-lock.yaml`.
  - Root `turbo.json`.
- Reads tracked package `package.json` files and follows `workspace:*` dependencies.
- Runs verification for changed packages and all tracked packages that depend on them, including transitive dependents.
- Treats any considered change outside the tracked package folders as a global change, including considered changes in packages such as `packages/test-utils`.
- For global changes, runs full tests with `check` and type checks with `types` for all tracked packages.
- Uses package names for `pnpm --filter` commands.
- Uses package folder names in the report, such as `create-orm`, `orm`, `zod`, and `test-factory`.
- Ignores changes to `scripts/verify.ts` and `scripts/verify.test.ts`; those files do not make any package affected.
- Runs changed package tests with `check -o`.
- Runs dependent package tests and global-change tests with `check`.
- When any non-ignored changed file has an `adapters` folder segment in its path, runs adapter-aware affected package tests under all supported adapters (`pqb`, `orm`, `rake-db`, and `test-factory`):
  - `pnpm --filter <pkg> check -o` for changed packages, `pnpm --filter <pkg> check` for dependents.
  - `ADAPTER=node-postgres pnpm --filter <pkg> check -o` for changed packages, `ADAPTER=node-postgres pnpm --filter <pkg> check` for dependents.
  - `ADAPTER=bun pnpm --filter <pkg> bun:check -o` for changed packages, `ADAPTER=bun pnpm --filter <pkg> bun:check` for dependents.
- Affected packages that do not define adapter-specific checks stay on the regular default `check` command.
- For multi-adapter runs, tests for the same package run sequentially across adapters, while different packages still run in parallel.
- Runs type checks for all changed and dependent packages with `types`.
- Runs all generated verification commands in parallel.
- Collects command output instead of streaming it.
- Does not print output for successful commands.
- Prints failed command output before the report when that failure is reportable.
- For grouped failed commands, prints only one package output block: the shortest failed package report.
- For repeated Jest failures inside one package output, prints only the shortest individual failure section.
- Prints only non-empty report lines:
  - `Verified types: ...`
  - `Verified tests: ...`
  - `Failed types: ...`
  - `Failed tests: ...`
  - `Failed under <adapter-name> adapter: ...` for test failures during multi-adapter runs.
- Prints `Verified: no packages affected` when there are no tracked package changes to verify.
- Excludes failed packages from `Verified` lines, even when the failed package output is compacted.
- For failed dependent packages:
  - If a changed package failed for the same verification kind, dependent package output is not printed and dependent packages are not listed in `Failed`.
  - If changed packages passed for that verification kind, failed dependent package output is printed and dependent packages are listed in `Failed`.
