---
outline: deep
---

# Programmatic use of migrations

You can use `rake-db` for non-trivial setups to have more control over database management.
For regular cases, it is simpler to use a CLI version described in [Setup and Overview](/guide/migration-setup-and-overview.html).

The examples below are importing functions from `orchid-orm/migration`,
but you can use `rake-db` as a standalone tool and import the same functions from `rake-db`.

Most of the functions accept a `db` argument, which can be one of:

- instance returned by [orchidORM](/guide/orm-and-query-builder.html#instantiate-orchidorm).
- adapter: a wrapper of node-postgres, Postgres.js, or Bun SQL, which you can import from `orchid-orm/{adapter}` as `Adapter` class.

All the exposed functions are designed to respect the currently opened transaction.
[//]: # (TODO: add example)

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

const adapter = db.$adapter.reconfigure({
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

const adapter = db.$adapter.reconfigure({
  user: 'postgres',
  database: 'postgres',
});

await createDatabase(adapter, {
  database: 'database-to-create',
  owner: 'username', // optional
});
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

## makeRakeDbConfig

Migration files depend on a `change` function that depends on `columnTypes` that can be defined in the config directly,
or can be taken from the configured `baseTable`.

That's why migration functions require a `config` object. You can define and export this config in a separate file:

```ts
// src/db/db-config.ts
import { rakeDb } from 'orchid-orm/migrations/postgres-js';
import { makeRakeDbConfig } from 'orchid-orm/migrations';

export const config = makeRakeDbConfig({
  baseTable: BaseTable,
  migrationsPath: './migrations',
  import: (path) => import(path),
});

export const migrator = rakeDb(config);

// migrations will import the `change` from this file
export const { change } = migrator;
```

Then you can import the `migrator` to run the migrations as a CLI script:

```ts
// src/db/db-script.ts
import { migrator } from './db-config';

migrator.run({ databaseURL: process.env.DATABASE_URL });
```

And you can reuse the same `config` when running migrations programmatically:

```ts
import { migrate } from 'orchid-orm/migrations';
import { config } from './db-config';

await migrate(db, config);
```

::: warning
Keep the `change` function in a different file from `migrator.run`,
because otherwise `migrator.run` will be triggerred when running migrations programmatically
because the `change` function is imported by migrations.
:::

## programmatic migrations

For the following actions the `config` described above is needed.

### migrate

`migrate` applies pending migrations, updates migrated versions. Unlike the `up` CLI command, it does not run recurring migrations.

By default, it runs all migrations in a single transaction.
Add `transaction: 'per-migration'` to the config to run every migration file in a separate transaction.

`migrate` won't start new transactions if it is already wrapped in one.

```ts
import { migrate } from 'orchid-orm/migrations';

// apply all pending migrations
await migrate(db, config);

// parameters:
await migrate(db, config, {
  // how many pending migrations to migrate, Infinity is the default
  count: Infinity,
  // for timestamp-based only: force migrate when having out-of-order migrations
  force: false,
});
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
```
