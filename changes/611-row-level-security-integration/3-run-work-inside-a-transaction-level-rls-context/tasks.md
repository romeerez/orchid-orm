## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [ ] 1.1 Extend the transaction option contract
  - 1.1.1 Add transaction-scoped `role` and `setConfig` options to the query transaction type surface by reusing the existing SQL session option interface, normalize `setConfig`, and pass the result into the adapter transaction flow.
  - 1.1.2 Keep `$ensureTransaction`, the isolation-level overload, and existing `log`, `schema`, `level`, `readOnly`, and `deferrable` behavior unchanged.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 1.2 Add standalone transaction session context handling
  - 1.2.1 Add adapter feature logic for transaction-scoped role setup, nested transaction inheritance, and restoration without changing the query-scoped SQL session context logic.
  - 1.2.2 Reuse the existing `SqlSessionState` interface for transaction option typing without adding fields to that interface.
  - 1.2.3 Represent transaction `setConfig` through the adapter locals structure instead of a separate transaction-specific config hierarchy.
  - 1.2.4 verify if the implementation conforms to guidelines
  - 1.2.5 make sure you didn't forget to cover the implementation with tests
  - 1.2.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 1.3 Unify transaction locals for search path and setConfig
  - 1.3.1 Update the existing adapter locals flow so transaction `setConfig` entries and existing locals such as `search_path` share the same merge, `SET LOCAL`, nesting, and restore behavior.
  - 1.3.2 Make nested locals restoration handle keys that were absent in the parent locals map without emitting invalid restore values.
  - 1.3.3 verify if the implementation conforms to guidelines
  - 1.3.4 make sure you didn't forget to cover the implementation with tests
  - 1.3.5 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.3.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 1.4 Integrate transaction context into adapter transaction lifecycle
  - 1.4.1 Apply transaction-scoped role and merged locals after `BEGIN` for top-level transactions and after savepoint creation for nested transactions.
  - 1.4.2 Restore the previous transaction-scoped role and locals after successful nested transactions release their savepoint, and rely on rollback-to-savepoint behavior for failed nested transactions while still restoring transaction session context.
  - 1.4.3 Ensure setup, callback execution, savepoint handling, restore, and failure paths run on the transaction connection for both supported adapters.
  - 1.4.4 verify if the implementation conforms to guidelines
  - 1.4.5 make sure you didn't forget to cover the implementation with tests
  - 1.4.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.4.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [ ] 2.1 Expose transaction session options through `$transaction`
  - 2.1.1 Update the ORM-facing `$transaction` type/JSDoc surface so it reflects the `pqb` transaction options for `role` and `setConfig`.
  - 2.1.2 Keep ORM delegation to `pqb` unchanged apart from accepting and forwarding the expanded option shape.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. docs

- [ ] 3.1 Document transaction-level RLS context
  - 3.1.1 Update the transaction and RLS docs to show `$transaction({ role, setConfig }, cb)`, explain how it differs from per-query `$withOptions`, and call out nested transaction restore behavior.
