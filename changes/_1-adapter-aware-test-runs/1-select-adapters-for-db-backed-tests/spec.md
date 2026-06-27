## Summary

Introduce adapter-aware test execution for first-party packages that run real database queries so local test commands still default to `postgres-js`, contributors can switch one run to `node-postgres` with an env var, and package `check` scripts can rerun the same eligible suites against every registered adapter in sequence.

```sh
pnpm pqb check

ORCHID_TEST_ADAPTER=node-postgres pnpm pqb check

pnpm check
```

## What Changes

- Add one shared registry of first-party test adapters and resolve the active adapter from env instead of hardcoding `postgres-js` in `test-utils`.
- Add adapter-aware package test entrypoints for `pqb`, `orm`, `rake-db`, and `test-factory` so local commands support default and specific-adapter runs, while `check` reruns each eligible suite once per registered adapter.
- Keep multi-adapter CI execution process-based by rerunning Jest once per registered adapter instead of swapping adapters inside one Jest process.
- Update the existing `packages/pqb/src/query/guidelines/code.md` guidance so adapter-specific code changes require running tests with the matching adapter, and shared adapter test infrastructure changes require running all adapters.
- Update package `check` scripts and GitHub Actions so CI gets full adapter coverage without introducing a second env mode.

## Assumptions

- Adapter-matrix reruns are required only for packages whose tests execute real queries through first-party adapters: `pqb`, `orm`, `rake-db`, and `test-factory`.

## Capabilities

- `test-adapter-selection`: Shared env-driven resolution of which first-party adapter a DB-backed test run should use.
- `test-adapter-matrix`: Re-execution of eligible package `check` suites once per registered adapter in a fixed sequential order.

## Detailed Design

### Test Workflow Surface

The change adds a repo-level test workflow surface rather than a new library runtime API.

- When neither env var is set, DB-backed tests keep using `postgres-js`.
- `ORCHID_TEST_ADAPTER=<adapter-id>` selects one registered adapter for that test run.
- Unknown adapter ids must fail fast before Jest starts, and the error should list the valid registered ids.
- Adapter-aware package commands must keep passing through normal Jest arguments such as explicit test files or `-o`.

### Shared Adapter Registry

One shared registry should define the adapters that Orchid's first-party DB-backed tests know how to run.

- The registry is the single source of truth for supported test adapters, their ids, and the order used by multi-adapter `check` runs.
- `test-utils` should read `process.env.ORCHID_TEST_ADAPTER`, default to `postgres-js` when it is not set, and derive `testAdapter`, `createTestDb`, `testOrchidORM`, `testRakeDb`, and any adapter-detection helpers from the resolved adapter instead of a hardcoded boolean.
- Future adapters join multi-adapter `check` runs by registering themselves once; package scripts should derive their sequential run list from that registry instead of maintaining separate hardcoded adapter lists.
- The default adapter remains `postgres-js`, so the registry order should preserve that default explicitly instead of relying on object-key ordering accidents.

### Test Process Integration

The new behavior plugs into package test commands, not into individual test files.

- `pqb`, `orm`, `rake-db`, and `test-factory` should use one shared adapter-aware runner for `check` and one sequential multi-adapter `check` shape.
- `check` should invoke Jest once and preserve the current package-local behavior unless the caller explicitly sets `ORCHID_TEST_ADAPTER`.
- `check` for eligible packages should launch separate Jest processes, each with `ORCHID_TEST_ADAPTER=<registered-id>`, and run the full eligible package suite once per adapter in registry order.
- The multi-adapter CI path is intentionally process-based because `test-utils` creates singleton adapter-backed helpers at module load time and Jest caches those modules within a process. The design must not try to hot-swap adapters inside one Jest instance.
- Package `check` scripts may implement the sequence directly with chained commands or through a shared script, but the observable behavior must be sequential whole-suite reruns with one adapter env var per process.

### Package Scope

Only packages whose tests execute real queries through the first-party adapters need adapter-aware reruns.

- `pqb`, `orm`, `rake-db`, and `test-factory` are in scope because their test suites use `test-utils` or otherwise execute live queries through the supported adapters.
- `schemaConfigs/zod` and `schemaConfigs/valibot` stay out of scope for this change because their tests use type helpers but do not need to rerun query execution across adapters.
- `test-utils` remains internal and does not need its own standalone test command surface. Its changes are verified through the public packages that consume it.
- Packages such as `create-orm`, `docs`, `repro`, `benchmarks`, and `test-builds` keep their existing single-run behavior unless they later add DB-backed tests that rely on first-party adapters.

### Adapter-Specific and Shared Verification Guidance

The existing `packages/pqb/src/query/guidelines/code.md` needs a package-specific addition because adapter changes can otherwise look covered while only one driver actually ran.

- `packages/pqb/src/query/guidelines/code.md` must require `ORCHID_TEST_ADAPTER=node-postgres` when a change touches `node-postgres` adapter code or tests.
- The same file must require `ORCHID_TEST_ADAPTER=postgres-js` when a change touches `postgres-js` adapter code or tests.
- When a change touches shared adapter runtime code, shared adapter test infrastructure, or the adapter registry that powers env-based selection, that file must require running the package `check` script that exercises all registered adapters.
- The default no-env test path should remain documented as the fastest local loop and should still map to `postgres-js`.

### CI Behavior

GitHub Actions should consume the same workflow surface that contributors use locally.

- The test workflow should keep calling `pnpm check`, and eligible package `check` scripts should already expand that into sequential per-adapter runs.
- Database create and migrate steps should keep their existing workflow and should not need CI YAML that names adapters explicitly.
- CI must rely on the same shared adapter registry or shared runner logic that package `check` uses so adding a future adapter does not require a parallel adapter list inside workflow config.

### Error Handling and Limits

- Unknown adapter ids must stop the run before package tests start instead of silently falling back to `postgres-js`.
- Multi-adapter `check` reruns the entire eligible package suite per adapter. It does not try to detect only DB-backed files or skip direct driver-specific tests inside those packages.
- Packages outside the adapter-matrix scope continue using their existing single-run Jest commands in `check`.
- Adding a future adapter to the registry is not enough on its own if first-party package entrypoints or `test-utils` do not yet expose the package-specific constructors that the shared registry needs.

### Documentation

The `packages/pqb/src/query/guidelines/code.md` update should call out that the default local path is still `postgres-js`, that `ORCHID_TEST_ADAPTER=<id>` is the targeted verification path for adapter-specific changes, and that the package `check` script is the slower full-matrix path meant for CI and shared adapter changes.
