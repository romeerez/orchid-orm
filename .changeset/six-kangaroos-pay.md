---
'rake-db': minor
'orchid-orm': minor
---

Migrations programmatic usage refactoring (#671)

- `makeRakeDbConfig` is dropped — `migrate`, `rollback`, and `redo` now process config parameters on their own.
- `migrate()` now creates the migrations schema/table when called inside a transaction, so the `createMigrationsSchemaAndTable` pre-creation workaround is no longer needed.
- `createMigrationChangeFn` is added to create the `change` function used by migration files, optionally accepting `columnTypes` from a `BaseTable` to support custom column types in migrations.
- `runMigration` now accepts `log` and `logger` options to control console output.
