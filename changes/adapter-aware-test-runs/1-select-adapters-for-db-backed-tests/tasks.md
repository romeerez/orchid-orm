## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow `guidelines/code.md` for coding

## 1. pqb

- [ ] 1.1 Read `ORCHID_TEST_ADAPTER` in `test-utils` and default to `postgres-js`.
  - 1.1.1 Replace the current hardcoded `postgres-js` choice in shared test helpers with `process.env.ORCHID_TEST_ADAPTER`, defaulting to `postgres-js` when the env var is not set.
  - 1.1.2 Make sure the shared `test-utils` exports used by public packages all use the adapter selected by that env var.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 1.2 Update `packages/pqb/src/query/guidelines/code.md` for adapter-specific test runs.
  - 1.2.1 Update `packages/pqb/src/query/guidelines/code.md` so `node-postgres` changes require `ORCHID_TEST_ADAPTER=node-postgres`, `postgres-js` changes require `ORCHID_TEST_ADAPTER=postgres-js`, and shared adapter-related changes require running the package `check` script.

## 2. orm

- [ ] 2.1 Run ORM `check` once per adapter.
  - 2.1.1 Update the ORM `check` script so it runs the full suite sequentially with `ORCHID_TEST_ADAPTER=postgres-js` and `ORCHID_TEST_ADAPTER=node-postgres`.
  - 2.1.2 verify if the implementation conforms to guidelines
  - 2.1.3 make sure you didn't forget to cover the implementation with tests
  - 2.1.4 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.5 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. rake-db

- [ ] 3.1 Run rake-db `check` once per adapter.
  - 3.1.1 Update the rake-db `check` script so it runs the full suite sequentially with `ORCHID_TEST_ADAPTER=postgres-js` and `ORCHID_TEST_ADAPTER=node-postgres`.
  - 3.1.2 verify if the implementation conforms to guidelines
  - 3.1.3 make sure you didn't forget to cover the implementation with tests
  - 3.1.4 make sure the package test and typecheck commands are passing (`pnpm rake-db check` and `pnpm rake-db types`; `rake-db` is the folder name under `packages/`, not the `package.json` name)
  - 3.1.5 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 4. test-factory

- [ ] 4.1 Run test-factory `check` once per adapter.
  - 4.1.1 Update the test-factory `check` script so it runs the full suite sequentially with `ORCHID_TEST_ADAPTER=postgres-js` and `ORCHID_TEST_ADAPTER=node-postgres`.
  - 4.1.2 verify if the implementation conforms to guidelines
  - 4.1.3 make sure you didn't forget to cover the implementation with tests
  - 4.1.4 make sure the package test and typecheck commands are passing (`pnpm test-factory check` and `pnpm test-factory types`; `test-factory` is the folder name under `packages/`, not the `package.json` name)
  - 4.1.5 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
