---
outline: deep
description: Programmatic use of migrations including creating databases, schemas, tables, and running migrations programmatically.
---

# Programmatic use of migrations

You can use `rake-db` for non-trivial setups to have more control over database management.
For regular cases, it is simpler to use a CLI version described in [Setup and Overview](/guide/migration-setup-and-overview.html).

The examples below are importing functions from `orchid-orm/migration`,
but you can use `rake-db` as a standalone tool and import the same functions from `rake-db`.

Most of the functions accept a `db` argument, which can be one of:

- instance returned by [orchidORM](/guide/orm-setup.html#instantiate-orchidorm).
- adapter: a wrapper of node-postgres or postgres-js, which you can import from `orchid-orm/postgres-js` as `Adapter` class.

All the exposed functions are designed to respect the currently opened transaction.

The exposed functions aren't closing connection automatically, remember to call `db.$close()` or `adapter.close()` in the end.

## running rake-db commands

```ts
import { rakeDb } from 'orchid-orm/migrations/postgres-js';

const migrator = rakeDb(rakeDbConfig);

migrator.run(
  // first argument can be an array for multiple databases
  { databaseURL: 'postgres://...' },
  // array of CLI arguments
  ['up'],
);
```

## creating and dropping

### create database

[//]: # 'has JSDoc'

To create a database, reconfigure the connection with a power user and an existing database to connect to.

```ts
import { createDatabase } from 'orchid-orm/migrations';

const adapter = db.$getAdapter().reconfigure({
  user: 'postgres',
  database: 'postgres',
});

await createDatabase(adapter, {
  database: 'database-to-create',
  owner: 'username', // optional
});
```

### drop database

[//]: # 'has JSDoc'

To drop a database, reconfigure the connection with a power user and a different database to connect to.

Ensure the connections to the database are closed before dropping, because Postgres won't be able to drop it otherwise.

```ts
import { createDatabase } from 'orchid-orm/migrations';

const adapter = db.$getAdapter().reconfigure({
  user: 'postgres',
  database: 'postgres',
});

await createDatabase(adapter, {
  database: 'database-to-create',
  owner: 'username', // optional
});
```

### createMigrationsSchemaAndTable

`createMigrationsSchemaAndTable` creates a table to keep track of applied migrations.
If the db connection config has `schema` or if `migrationsTable` has it, it will also try to create the schema.

Can be called in a transaction, it won't throw or fail the transaction if the schema or the table already exist.

```ts
import {
  createMigrationsSchemaAndTable,
  makeRakeDbConfig,
} from 'orchid-orm/migrations';

await createMigrationsSchemaAndTable(db, {
  migrationsTable: 'migrations',
  // can contain schema
  migrationsTable: 'custom-schema.migrations',

  logger: console, // will log if logger is provided
});

// to provide `log: true` instead of a logger, prepare the config with `makeRakeDbConfig`
const config = makeRakeDbConfig({
  log: true,
  migrationsTable: 'migrations',
  import: (path) => import(path),
});

await createMigrationsSchemaAndTable(db, config);
```

### create schema

[//]: # 'has JSDoc'

`createSchema` uses a savepoint when it is called in a transaction to not break it if the schema already exists.

Prepends `CREATE SCHEMA` to a given SQL.

```ts
import { createSchema } from 'orchid-orm/migrations';

const result: 'done' | 'already' = await createSchema(db, '"schema"');
```

### drop schema

[//]: # 'has JSDoc'

`dropSchema` uses a savepoint when it is called in a transaction to not break it if the schema does not exist.

Prepends `DROP SCHEMA` to a given SQL.

```ts
import { dropSchema } from 'orchid-orm/migrations';

const result: 'done' | 'already' = await dropSchema(db, '"schema"');
```

### create table

[//]: # 'has JSDoc'

`createTable` uses a savepoint when it is called in a transaction to not break it if the table already exists.

Prepends `CREATE TABLE` to a given SQL.

```ts
import { createTable } from 'orchid-orm/migrations';

const result: 'done' | 'already' = await createTable(db, '"table"');
```

### drop table

[//]: # 'has JSDoc'

`dropTable` uses a savepoint when it is called in a transaction to not break it if the table does not exist.

Prepends `DROP TABLE` to a given SQL.

```ts
import { dropTable } from 'orchid-orm/migrations';

const result: 'done' | 'already' = await dropTable(db, '"table"');
```

## createMigrationChangeFn

Migration files rely on a `change` function.

Create this `change` function using `createMigrationChangeFn`:

```ts
import { createMigrationChangeFn } from 'orchid-orm/migrations';

export const change = createMigrationChangeFn({
  // optional, to support custom column types defined in your BaseTable in migrations:
  columnTypes: BaseTable.columnTypes,
});
```

## programmatic migrations

`migrate`, `rollback`, `redo` accept a config of `MigrateConfig` type.

### MigrateConfig

`MigrateConfig` is a union: you must provide **either** a path to a migrations directory, **or** an object listing all migrations explicitly.

**File-based** — load migrations from a directory on disk:

```ts
await migrate(db, {
  // relative to the current file, or an absolute path
  migrationsPath: './migrations',
  // required for tsx and other TS runners to import migration files
  import: (path) => import(path),
});
```

**Migrations provided** — list migrations explicitly as lazy imports (common with bundlers such as Vite):

```ts
await migrate(db, {
  migrations: {
    // keys are file names (without extension), values are lazy import functions
    '0001_create-users': () => import('./migrations/0001_create-users'),
    '0002_create-posts': () => import('./migrations/0002_create-posts'),
  },
});
```

Both forms accept the following shared options:

```ts
type MigrateConfig =
  | {
      // path to the migrations directory (relative to the current file or absolute)
      migrationsPath: string;
      // base directory used to resolve a relative migrationsPath;
      // defaults to the directory of the calling file
      basePath?: string;
      // required for tsx and other TS runners to import TypeScript migration files
      import(path: string): Promise<unknown>;

      // + shared options below
    }
  | {
      // explicitly list migrations as lazy import functions
      migrations: {
        [fileName: string]: () => Promise<unknown>;
      };

      // + shared options below
    };

// shared options (both variants accept these):
{
  // prefix migration files with serial numbers (0001, 0002, …) or timestamps
  // default: serial with 4 digits
  migrationId?: 'serial' | 'timestamp';

  // table in the database used to track applied migrations
  // may include a schema: 'my-schema.migrations'
  // default: 'schemaMigrations'
  migrationsTable?: string;

  // 'single': wrap all pending migrations in one transaction (default, recommended)
  // 'per-migration': run each migration file in its own transaction
  transaction?: 'single' | 'per-migration';

  // calls `SET LOCAL search_path = <value>` at the start of each migration transaction;
  // pass a function for dynamic resolution, e.g. in multi-tenant apps
  transactionSearchPath?: string | (() => string);

  // throw when a migration file has no default export
  // default: false
  forceDefaultExports?: boolean;

  // generated by the `change-ids` command when switching between serial and timestamp IDs;
  // see: /guide/migration-commands#change-ids
  renameMigrations?: { to: 'serial' | 'timestamp'; map: Record<string, string> };

  // enable console logging with `log: true`, or silence it with `log: false`
  log?: boolean | Partial<QueryLogObject>;
  // custom logger object; standard console is used by default
  logger?: { log(message: string): void; error(message: string): void };

  // called once per db before / after migrating up a set of migrations (inside the transaction)
  beforeMigrate?(arg: { db: Db; migrations: MigrationItem[] }): void | Promise<void>;
  afterMigrate?(arg: { db: Db; migrations: MigrationItem[] }): void | Promise<void>;

  // called once per db before / after rolling back a set of migrations (inside the transaction)
  beforeRollback?(arg: { db: Db; migrations: MigrationItem[] }): void | Promise<void>;
  afterRollback?(arg: { db: Db; migrations: MigrationItem[] }): void | Promise<void>;

  // called once per db before / after migrate or rollback (inside the transaction)
  // `up`: true when migrating up, false when rolling back
  // `redo`: true during the rollback phase of a `redo` command
  beforeChange?(arg: { db: Db; up: boolean; redo: boolean; migrations: MigrationItem[] }): void | Promise<void>;
  afterChange?(arg: { db: Db; up: boolean; redo: boolean; migrations: MigrationItem[] }): void | Promise<void>;

  // called after the migrations transaction is committed (outside the transaction)
  // use for work that requires a committed db state, e.g. running pg_dump
  afterChangeCommit?(arg: { adapter: Adapter; up: boolean; migrations: MigrationItem[] }): void | Promise<void>;
}
```

All callbacks are called once per database. If 5 migrations are applied the callbacks fire once — before or after all 5 — not per migration. All callbacks except `afterChangeCommit` run inside the migrations transaction; if one throws, the transaction is rolled back and no migration changes are saved.

For detailed callback examples see [before and after callbacks](/guide/migration-setup-and-overview.html#before-and-after-callbacks).

### migrate

`migrate` applies pending migrations, updates migrated versions. Unlike the `up` CLI command, it does not run recurring migrations.

By default, it runs all migrations in a single transaction.
Add `transaction: 'per-migration'` to the config to run every migration file in a separate transaction.

`migrate` won't start new transactions if it is already wrapped in one.

`migrate` creates a migration table if it doesn't exist yet.

Note that the `config` supports `transactionSearchPath` for dynamically switching a current db schema,
this may be useful in multi-schema scenarios.

```ts
import { migrate } from 'orchid-orm/migrations';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const config = {
  basePath: dirname(fileURLToPath(import.meta.url)),
  migrationsPath: './migrations',
  import: (path) => import(path),
};

// apply all pending migrations
await migrate(db, config);

// parameters:
await migrate(db, config, {
  // how many pending migrations to migrate, Infinity is the default
  count: Infinity,
  // for timestamp-based only: force migrate when having out-of-order migrations
  force: false,
});

// using `transactionSearchPath` for multi-tenancy, applies migrations for different schemas
for (const schemaName of ['tenant-1', 'tenant-2']) {
  config.transactionSearchPath = schemaName;
  await migrate(db, config);
}
```

### rollback

`rollback` acts in the same way as `migrate` just in the opposite direction, and the `count` is 1 by default.

```ts
import { rollback } from 'orchid-orm/migrations';

// rolls back the last applied migration
await rollback(db, config);

// parameters:
await rollback(db, config, {
  // how many pending migrations to rollback, 1 is the default
  count: 1,
  // for timestamp-based only: force rollback when having out-of-order migrations
  force: false,
});
```

### redo

`redo` performs a `rollback` and then `migrate`.

```ts
import { rollback } from 'orchid-orm/migrations';

// reapplies one last migration
await rollback(db, config);

// parameters:
await rollback(db, config, {
  // how many pending migrations to redo, 1 is the default
  count: 1,
  // for timestamp-based only: force redoing when having out-of-order migrations
  force: false,
});
```

### runMigration

Use `runMigration` when to execute a specific migration file or an inline `change` block without tracking the migration versions.
It's primarily for testing purposes.

The 2nd argument may be a config object supporting `transactionSearchPath` to run migrations within a given `search_path` context, and logging options:

- `log: true` to log using console
- `logger` to provide a custom logger object

```ts
import { runMigration } from 'orchid-orm/migrations';

// run the inline `change`:
await runMigration(db, () => {
  change(async (db) => {
    await db.createTable('table', (t) => ({
      id: t.identity(),
      name: t.string(),
    }));
  });
});

// run a single migration file:
await runMigration(db, () => import('./migrations/0001_migration-file'));

// run multiple files:
await runMigration(db, async () => {
  await import('./migrations/0001_migration-file');
  await import('./migrations/0002_another-file');
});

await runMigration(db, { transactionSearchPath: 'test-schema' }, async () => {
  await import('./migrations/0001_migration-file');
});
```
