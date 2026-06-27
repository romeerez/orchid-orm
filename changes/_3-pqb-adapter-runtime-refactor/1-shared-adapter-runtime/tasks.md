## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow `guidelines/code.md` for coding
- For every implementation task that says to "move" behavior, completion requires removing that behavior from the old location and migrating all first-party call sites and types to the new shared `Adapter` interface in the same task scope.

## 1. pqb

- [x] 1.1 Add shared runtime abstractions (classes and interfaces) without migrating driver behavior.
  - 1.1.1 Introduce shared runtime-level class and interface skeletons for root adapters and transaction adapters, plus a stronger shared `AdapterConfigBase` contract that owns common connection fields and shared options (including `connectRetry`) in one place.
  - 1.1.2 Add runtime-level typing and constructor contracts needed for adapter recreation (`clone(params?)`) and metadata access, but keep existing driver-adapter behavior and flow intact in this step.
  - 1.1.3 Limit driver-adapter edits in this step to the minimum strictly required to keep tests passing and types sound; do not migrate behavior yet.
  - 1.1.4 Add or update focused tests that validate only the new abstractions introduced in this step, without asserting moved runtime behavior.
  - 1.1.5 verify if the implementation conforms to guidelines
  - 1.1.6 make sure you didn't forget to cover the implementation with tests
  - 1.1.7 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.8 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Move clone and config-recreation capability into the shared runtime.
  - 1.2.1 Replace adapter-level `reconfigure` and `updateConfig` behavior with runtime-owned `clone(params?)` using stored constructor + config data, remove the old methods from driver-specific adapters and runtime adapter interfaces in `pqb`, and migrate first-party clone call sites/types to the shared `Adapter` interface.
  - 1.2.2 Keep external adapter entrypoint ergonomics unchanged while moving only this recreation capability in this step.
  - 1.2.3 Add or update tests for clone semantics, including preserving adapter class identity and merging override params, and update affected first-party tests to use the new clone-based adapter interface.
  - 1.2.4 verify if the implementation conforms to guidelines
  - 1.2.5 make sure you didn't forget to cover the implementation with tests
  - 1.2.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.3 Move shared metadata getters and URL-derived state handling into the shared runtime.
  - 1.3.1 Centralize shared metadata accessors and URL-derived config/state parsing in runtime code, keeping driver-specific inputs unchanged.
  - 1.3.2 Keep driver-adapter responsibilities limited to driver-specific concerns while moving only metadata and URL-derived shared logic in this step.
  - 1.3.3 Add or update tests that cover runtime metadata behavior parity across first-party drivers.
  - 1.3.4 verify if the implementation conforms to guidelines
  - 1.3.5 make sure you didn't forget to cover the implementation with tests
  - 1.3.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.3.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.4 Move connection lifecycle and retry behavior into the shared runtime.
  - 1.4.1 Centralize shared connection acquisition/release orchestration and `connectRetry` behavior in runtime code.
  - 1.4.2 Keep driver adapters as thin ports that provide concrete connection primitives while moving only shared lifecycle orchestration in this step.
  - 1.4.3 Add or update tests covering shared connect/retry behavior and parity between first-party drivers.
  - 1.4.4 verify if the implementation conforms to guidelines
  - 1.4.5 make sure you didn't forget to cover the implementation with tests
  - 1.4.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.4.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.5 Move nested transaction orchestration into the shared runtime.
  - 1.5.1 Centralize root/transaction runtime orchestration for nested transactions, including same-connection behavior through shared borrow/release hooks.
  - 1.5.2 Keep top-level driver transaction entry and concrete query execution driver-specific while moving only nested orchestration in this step.
  - 1.5.3 Add or update tests for nested transaction semantics and same-connection behavior parity across first-party drivers.
  - 1.5.4 verify if the implementation conforms to guidelines
  - 1.5.5 make sure you didn't forget to cover the implementation with tests
  - 1.5.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.5.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.6 Move shared session-state and error-field behavior into the shared runtime.
  - 1.6.1 Centralize shared locals/`search_path` and SQL session state integration in runtime code.
  - 1.6.2 Centralize common `QueryError` field copying behavior, keeping only driver-declared metadata (for example error fields and queryability after close) in driver-specific code.
  - 1.6.3 Add or update tests for session-state behavior and shared error-field copying parity across first-party drivers.
  - 1.6.4 verify if the implementation conforms to guidelines
  - 1.6.5 make sure you didn't forget to cover the implementation with tests
  - 1.6.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.6.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.7 Finish driver migration to the runtime ports without changing public ergonomics.
  - 1.7.1 Finalize `AdapterBase` and `TransactionAdapterBase` as minimal driver-specific ports used by shared runtime code.
  - 1.7.2 Update `node-postgres` and `postgres-js` to the port contract while preserving `createDb` usage, driver-specific config inputs, and advanced access to concrete `pool` and `sql` handles.
  - 1.7.3 Preserve or replace first-party driver-specific transaction adapter imports with thin wrappers where needed so internal tests/helpers avoid depending on removed duplicated behavior.
  - 1.7.4 Extend adapter-focused tests for full runtime parity, including clone, close/recreate, metadata, transaction, and session-state behavior.
  - 1.7.5 verify if the implementation conforms to guidelines
  - 1.7.6 make sure you didn't forget to cover the implementation with tests
  - 1.7.7 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.7.8 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. rake-db

- [x] 2.1 Switch first-party adapter recreation to `clone`.
  - 2.1.1 Update create/drop database flows and any other low-level adapter recreation sites to use `clone(params?)` instead of `reconfigure`, while keeping the user-observable migration workflow unchanged.
  - 2.1.2 Update tests and package-local docs or comments that describe low-level adapter recreation so they match the shared runtime contract and the new helper name.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm rake-db check` and `pnpm rake-db types`; `rake-db` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. docs

- [x] 3.1 Update the documented low-level adapter recreation workflow.
  - 3.1.1 Revise root docs that currently show `reconfigure` so they use `clone`, keep promising stable driver-specific config entrypoints for `createDb`, and describe low-level adapter classes as advanced tools rather than the main compatibility boundary.
