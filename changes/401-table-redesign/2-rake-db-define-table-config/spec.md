## Summary

Allow rake-db migration config to use the function-style `defineTable` returned by `createTableFactory` / `createTableFactory` as the table-factory metadata source, while keeping existing `baseTable` config supported for class-based projects.

```ts
import { createTableFactory } from 'orchid-orm';
import { rakeDb } from 'orchid-orm/migrations/postgres-js';
import { config } from './config';

export const { defineTable, sql } = createTableFactory({
  snakeCase: true,
  language: 'english',
  nowSQL: `now() AT TIME ZONE 'UTC'`,
  defineTableExportAs: 'defineTable',
  columnTypes: (t) => ({
    ...t,
    // custom column types
  }),
});

export const change = rakeDb.run(config.database, {
  migrationsPath: './migrations',
  dbPath: './db',
  defineTable,
  import: (path) => import(path),
});
```

## What Changes

- Add `defineTable` as a rake-db config option alongside the existing `baseTable` option.
- Treat `baseTable` and `defineTable` as alternative sources of the same migration configuration metadata: column types, snake-case naming, default search language, `nowSQL`, export name, and factory file path.
- Update manual migration, migration generation, and pull/codegen flows that currently read `config.baseTable` to read normalized table-factory metadata instead.
- Keep existing `baseTable` behavior, public names, and generated class-style code unchanged for users who still configure migrations with `createBaseTable`.

## Assumptions

- `defineTable` refers to the factory function returned by `createTableFactory` / `createTableFactory`, not to an individual table definition value.
- `baseTable` and `defineTable` are mutually exclusive in a single rake-db config. Passing both is invalid because generated code can only target one table-definition style.
- Function-style migration pull should generate function-style table files that import the configured `defineTable` export; it should not generate class-based tables extending a synthetic base class.

## Capabilities

- `table-factory-config`: Normalizes class-based and function-style table factory metadata into the shape rake-db needs at runtime and during code generation.
- `define-table-migrations-config`: Lets rake-db config accept `defineTable` for manual migrations and generated migrations without requiring an old `BaseTable`.
- `function-table-pull-codegen`: Lets ORM-backed `db pull` use the configured function-style factory metadata when generating app table definition files.

## Detailed Design

### Public API

`rake-db` config accepts a new optional `defineTable` option wherever `baseTable` is accepted today.

```ts
interface RakeDbCliConfigInputBase<SchemaConfig, CT> {
  baseTable?: RakeDbBaseTable<CT>;
  defineTable?: RakeDbDefineTable<CT>;
}

interface MigrateConfigBase {
  baseTable?: RakeDbBaseTable<unknown>;
  defineTable?: RakeDbDefineTable<unknown>;
}

interface RakeDbDefineTable<CT> {
  exportAs: string;
  nowSQL?: string;
  types: CT;
  snakeCase?: boolean;
  language?: string;
  getFilePath(): string;
}
```

- The exact shared interface names may differ, but the public contract is that rake-db accepts the function returned as `defineTable` from `createTableFactory` / `createTableFactory`.
- `RakeDbDefineTable` must not require `new`, `prototype`, or any class constructor behavior.
- `types`, `snakeCase`, and `language` carry the same migration metadata that rake-db currently reads from a `BaseTable` instance/prototype.
- `RakeDbBaseTable` remains accepted for class-based projects.
- If a config provides both `baseTable` and `defineTable`, config processing fails with a clear message explaining that only one table factory source can be configured.
- `defineTable` takes precedence over the standalone `columnTypes`, `snakeCase`, and `language` options for the same reasons `baseTable` does today.
- `noPrimaryKey` remains a separate rake-db config option and is not read from `defineTable`.

### Shared State or Data Shape

Introduce one normalized internal table-factory metadata shape for rake-db and ORM migration code to consume.

```ts
interface RakeDbTableFactoryConfig<CT> {
  exportAs: string;
  getFilePath(): string;
  columnTypes: CT;
  nowSQL?: string;
  snakeCase?: boolean;
  language?: string;
}
```

- Config processing derives this shape from either `baseTable` or `defineTable`.
- For `baseTable`, `columnTypes`, `snakeCase`, and `language` are read from the same class static/prototype fields used today.
- For `defineTable`, `columnTypes` is read from the configured table factory's `types`, and `snakeCase` / `language` are read directly from that factory.
- The normalized shape intentionally does not preserve whether the source was `baseTable` or `defineTable`; code that consumes it should only depend on the shared metadata fields.
- `RakeDbConfig` keeps existing top-level `columnTypes`, `snakeCase`, `language`, and `baseTable` fields for compatibility, and config processing uses the normalized shape internally so code paths stop branching directly on constructor-specific metadata.
- Manual migration DB instances continue to expose `db.options.baseTable` for old code when configured with `baseTable`; when configured with `defineTable`, `db.options.defineTable` is available and `db.options.baseTable` is absent.

### Integration and Lifecycle

`makeRakeDbConfig` and public migration functions normalize the table factory before migrations run.

- CLI config, programmatic `migrate`, `rollback`, and `redo`, and adapter-specific `rakeDb.run` all accept `defineTable`.
- `processMigrateConfig` copies `snakeCase` and `language` from normalized table-factory metadata into the effective migration config before migrations execute.
- `makeRakeDbConfig` sets effective `columnTypes` from `defineTable.types` when `defineTable` is provided.
- `createMigrationChangeFn(config)` keeps inferring migration `db` column types from the processed config, so migration files typed through `change(async (db) => ...)` see the custom column types from `defineTable`.
- `createTable` and `changeTable` use the effective `nowSQL` from normalized metadata, so timestamp defaults behave the same whether users configured `baseTable` or `defineTable`.

### Migration Generation

ORM migration generation should require either `config.baseTable` or `config.defineTable` when `dbPath` is present.

- The invalid-config error names the missing setting as `baseTable` or `defineTable` instead of only `baseTable`.
- Generation continues to load the ORM `db` from `dbPath`; code table/view metadata still comes from the ORM instance, not from the rake-db config table factory.
- Generated migration code uses the same migration DSL as today and does not need to mention `defineTable`.
- Verification migrations run with the effective column types, snake-case setting, language, and `nowSQL` derived from the selected table factory.

### Pull and App Code Generation

ORM-backed `db pull` should use the selected table factory source when generating table definition files.

- With `baseTable`, `db pull` keeps generating class-style table files that import the configured base table export and extend it.
- With `defineTable`, `db pull` generates function-style table files that import the configured `defineTable` export and call it.
- `defineTable.getFilePath()` supplies the import path source for generated table files, matching the current `baseTable.getFilePath()` role.
- `defineTable.exportAs` supplies the imported identifier. If the factory was configured with `defineTableExportAs: 'myDefineTable'`, generated files import and call `myDefineTable`.
- Pulled function-style tables use the same options object shape as `defineTable(name, options, columns)`, including `schema`, `nameInDb`, `comment`, and `noPrimaryKey` when those are currently emitted for class-style tables.
- Pull remains unavailable without `dbPath` and without either `baseTable` or `defineTable`.

### Package-Specific Behavior

`orm` owns attaching rake-db-consumable metadata to `defineTable` because `createTableFactory` creates the function-style table factory.

- The metadata attached to `defineTable` must be stable and read-only from rake-db's perspective.
- `defineTable.types`, `defineTable.snakeCase`, `defineTable.language`, `defineTable.exportAs`, `defineTable.nowSQL`, and `defineTable.getFilePath()` mirror the corresponding class-based `BaseTable` metadata.
- `createTableFactory` remains an alias of `createTableFactory` and returns the same metadata-bearing `defineTable`.

`rake-db` owns config acceptance and migration runtime semantics.

- The standalone package should define the structural `RakeDbDefineTable` type without importing from `orm`.
- Existing public exports should expose the updated config types through the same entry points.

### Error Handling and Limits

- Passing both `baseTable` and `defineTable` is an invalid config error.
- Passing a malformed `defineTable` value fails during config processing with a message that names the missing metadata member.
- If `defineTable.getFilePath()` cannot determine a path, rake-db surfaces the same error from the factory rather than replacing it with a generic pull/generation error.
- `defineTable` config support does not change how individual table definitions are registered in ORM instances.
- `defineTable` config support does not make standalone rake-db generate ORM app table files; function-style pull codegen is only for the existing ORM-backed pull path.

### Documentation

Update migration setup and programmatic migration docs to show `defineTable` as the function-style replacement for `baseTable`, and mention that `baseTable` remains valid for class-style projects.
