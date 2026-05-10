## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Rename adapter `locals` to `setConfig`
  - 1.1.1 Rename `AdapterConfigBase.locals`, `AdapterTransactionOptions.locals`, `AdapterClass` / `TransactionAdapterClass` fields and parameters, adapter helper names, adapter tests, and driver adapter references to `setConfig`.
  - 1.1.2 Preserve existing `searchPath` behavior by deriving `setConfig.search_path` from config / URL `searchPath` and continuing to pass it to both node-postgres and postgres.js connection setup.
  - 1.1.3 Treat adapter base `setConfig` and transaction option `setConfig` as the same normalized map of Postgres settings.
  - 1.1.4 Update helper tests for merge, setup SQL, restore SQL, overridden keys, and keys absent from the parent config map.
- [ ] 1.2 Add transaction session context to ALS
  - 1.2.1 Add transaction-scoped context to `AsyncState` for the effective transaction `role` and effective transaction `setConfig`.
  - 1.2.2 Keep this transaction context separate from query-scoped `AsyncState.role` / `AsyncState.setConfig`, so `$withOptions` query setup/cleanup behavior is not used for transaction-level context.
  - 1.2.3 Initialize top-level transaction context from adapter base `setConfig`, transaction `role`, and transaction `setConfig`.
  - 1.2.4 For nested transactions, derive a child context from the parent ALS context by overriding only provided `role` / `setConfig` values, and restore the parent ALS context after the nested transaction finishes.
  - 1.2.5 Do not capture parent transaction role/config with `current_role` or `current_setting` for restore; use the values tracked in ALS.
- [ ] 1.3 Apply top-level transaction role and config
  - 1.3.1 Reuse the existing `SqlSessionState` option shape for `transaction({ role, setConfig }, cb)` typing without adding fields to that interface.
  - 1.3.2 Pass normalized transaction `role` and `setConfig` through `QueryTransaction.transaction` to `adapter.transaction`.
  - 1.3.3 After `BEGIN`, before the callback runs, apply transaction-scoped role with transaction-local role semantics and apply transaction `setConfig` through the adapter `SET LOCAL` config path.
  - 1.3.4 Keep `$ensureTransaction`, the isolation-level overload, and existing `log`, `schema`, `level`, `readOnly`, and `deferrable` behavior unchanged.
- [ ] 1.4 Apply nested transaction role/config and restore parent context
  - 1.4.1 Create the nested savepoint before applying nested `role` or `setConfig`.
  - 1.4.2 Apply only the nested transaction's provided role/config overrides after the savepoint, then run the callback under the child ALS transaction context.
  - 1.4.3 On successful nested completion, restore the parent role and parent config values from ALS before releasing the savepoint. Reset config keys that exist only in the child context.
  - 1.4.4 On nested callback failure or nested setup failure after savepoint creation, roll back to the savepoint, restore the parent ALS context, and rely on Postgres rollback-to-savepoint behavior to undo nested transaction-local role/config SQL.
  - 1.4.5 Support deeper nesting recursively: each level restores to the effective parent role/config it observed before applying its own options.
  - 1.4.6 Ensure setup, callback execution, savepoint handling, restore, and failure paths run on the transaction connection for both node-postgres and postgres.js.
- [ ] 1.5 Cover pqb behavior with tests and verification
  - 1.5.1 Add or update transaction tests for top-level `setConfig`, top-level `role`, nested `setConfig` override/restore, nested role override/restore, resetting child-only config keys, rollback-to-savepoint restore, and deeper nested restore.
  - 1.5.2 Add or update tests showing transaction-level context does not change query-scoped `$withOptions` / `withOptions` nested-scope behavior.
  - 1.5.3 Add or update type tests / compile coverage for `transaction({ role, setConfig }, cb)` and the unchanged isolation-level overload.
  - 1.5.4 Verify the implementation conforms to `guidelines/code.md` and `packages/pqb/src/query/guidelines/code.md`.
  - 1.5.5 Run `pnpm --filter pqb check --silent -o` for changed pqb tests when focused verification is enough, then run `pnpm pqb check` and `pnpm pqb types` before marking pqb work complete.
  - 1.5.6 If implementation details diverge from `spec.md`, update `spec.md` before marking tasks complete.

## 2. orm

- [ ] 2.1 Expose transaction session options through `$transaction`
  - 2.1.1 Update the ORM-facing `$transaction` type/JSDoc surface so it reflects the `pqb` transaction options for `role` and `setConfig`.
  - 2.1.2 Keep ORM delegation to `pqb` unchanged apart from accepting and forwarding the expanded option shape.
  - 2.1.3 Add or update ORM type/runtime coverage if `$transaction` has its own transaction option surface.
  - 2.1.4 Verify the implementation conforms to guidelines.
  - 2.1.5 Run `pnpm --filter orm check --silent -o` for changed orm tests when focused verification is enough, then run `pnpm orm check` and `pnpm orm types` before marking orm work complete.
  - 2.1.6 If implementation details diverge from `spec.md`, update `spec.md` before marking tasks complete.

## 3. docs

- [ ] 3.1 Document transaction-level RLS context
  - 3.1.1 Update the transaction and RLS docs to show `$transaction({ role, setConfig }, cb)`, explain how it differs from per-query `$withOptions`, and call out nested transaction restore behavior.
  - 3.1.2 Mention that nested transactions temporarily override the parent transaction role/config and restore the parent context when the nested transaction finishes.
  - 3.1.3 Run the relevant docs checks if docs have tests or type examples for the changed pages.
