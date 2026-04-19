# Implementation Notes

These notes capture only the user-visible differences and caveats that matter for public docs.

## Public interface differences from the spec

- `role` and `setConfig` are available on `transaction` / `$transaction` options as well, not only on `withOptions` / `$withOptions`. `TransactionOptions` extends `StorageOptions`, so transaction-only code can open the SQL session directly without wrapping the work in `withOptions`. The same nested SQL-session restriction applies there too. If docs need a transaction example, `transaction({ role, setConfig }, ...)` / `$transaction({ role, setConfig }, ...)` is the concrete public surface exposed by the implementation. (`packages/pqb/src/query/basic-features/transaction/transaction.ts`, `packages/orm/src/transaction.ts`, `packages/pqb/src/query/basic-features/storage/storage.ts`)

## Important implicit behavior to document

- Raw SQL helpers (`db.$query`, `db.$queryArrays`, `db.query`, `db.queryArrays`) DO receive ambient SQL session state from `withOptions` / `$withOptions` and honor `role` / `setConfig` the same way as table queries. This was implemented in Task 1.5. (`packages/pqb/src/query/db-sql-query.ts`)

- Config restoration behavior: When a config key was previously unset (null), it is restored using `set_config(key, '', false)`. After cleanup, `current_setting(name, true)` returns `''` (empty string) instead of `null`. This is because once a config variable is created in a PostgreSQL session, it cannot be truly deleted - only reset to empty string. Docs should avoid promising preservation of the "unset vs empty" distinction. (`packages/pqb/src/adapters/adapter.utils.ts`)
