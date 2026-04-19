## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

## 1. pqb

- [x] 1.1 Finalize the `withOptions` and async-state contract for `role` and `setConfig`, including string normalization, rejection of nested SQL session overrides, and inheritance of the outer SQL session state when nested scopes only change `log` or `schema`.
- [x] 1.2 Add a shared SQL session execution wrapper that reads the ambient session state, captures and restores prior role and config values, and covers table queries, raw query helpers, relation follow-up work, hook-triggered queries, batched executions, and transaction-backed executions on the same connection.
- [x] 1.3 Integrate that wrapper with the `node-postgres` adapter so pooled queries and transaction queries both run setup, target SQL, and cleanup on the executing `PoolClient` without pinning one connection for the whole callback.
- [x] 1.4 Integrate that wrapper with the `postgres-js` adapter so non-transactional queries use `reserve()`, transactional queries reuse the active transaction connection, and setup/query/cleanup remain separate awaited steps without pipelining.
- [x] 1.5 Make `query` and `queryArrays` support the ambient SQL session state correctly, including `pqb` raw query helpers and ORM `$query` / `$queryArrays`, so they honor `role` and `setConfig` the same way as table queries.
- [x] 1.6 Restore previously unset `setConfig` keys so `current_setting(name, true)` returns `null` after scoped execution instead of `''` (null is not possible due to Postgres limitation, restoring to an empty string).

## 2. orm

- [x] 2.1 Update the ORM-facing `$withOptions` type surface and JSDoc to document `role` and `setConfig` alongside `log` and `schema`, including the nested SQL session restriction and explicit-transaction inheritance semantics.
- [x] 2.2 Update the public `$withOptions` and transactions guides to document request-scoped SQL session usage, raw-query coverage, dotted custom setting names, adapter parity, and the raw-SQL session-state caveat.
