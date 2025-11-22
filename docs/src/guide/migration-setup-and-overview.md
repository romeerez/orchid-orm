---
outline: deep
---

# Migrations setup and overview

Migrations allow you to evolve your database schema over time. This migration toolkit has several benefits over writing raw SQL migrations or using other tools:

- migrations are written in TypeScript, so they can have any logic and database queries made with a query builder.
- changes will be reverted automatically when rolling back a migration, no need to write `down` section manually (in most cases).
- when plugging it to an existing project, it can generate initial migration automatically based on existing db structure.
- Orchid ORM can generate migrations automatically from the app code.

If you're using OrchidORM, the migration toolkit is already bundled in, import it from `orchid-orm/migrations`, no need to install it separately.

You can also use it as a standalone tool, install and use the `rake-db` package.

## how it works

Special table `schemaMigrations` is automatically created to keep track of all the migrated files' prefixes and names.
It's allowed to have two migrations with the same name, but all the migrations must have different numeric prefixes.

All changes are wrapped into a single transaction. If you have 3 pending migrations, and the last one throws an error,
none of them will be applied.
See [transaction per migration](/guide/migration-commands.html#transaction-per-migration) to change this strategy.

The transaction beings with setting a lock ([pg_advisory_xact_lock](https://www.postgresql.org/docs/current/functions-admin.html)).
If you're deploying a cluster of node.js applications, and each application tries to apply migrations at the same time,
the first one will set a lock and apply the migrations, the rest will wait for a lock,
and after the lock is released all migrations are already applied.

Locally, migrations are compiled from TS to JS on the fly before running.
When deploying to a remote server, you may want to precompile migrations first to make migration process a bit faster on the server side.

If you want to use `rake-db` together with OrchidORM, [ORM initializer script](/guide/quickstart) can generate configurations.
When using it as a standalone tool, you can still use the same script and copy just the rake-db from it (config is in `dbScript.ts` file).
Generated script allows to choose between `tsx`, `vite`, and `ts-node` to run migrations, and generates different configs based on the chosen tool.
Generated package.json will have `build:migrations` and `db:compiled` scripts for pre-compiling and running migrations in production.

## setup

It is already set up if you ran the initializer script from [quickstart](/guide/quickstart).

To use it as a standalone tool, install this package:

```sh
npm i -D rake-db
# or
pnpm i -D rake-db
```

::: info
`rake-db` is named after a command in Ruby on Rails because it was initially inspired by it.
:::

Since the configuration is done in TypeScript, it's highly customizable.

It's better to have database configuration options exported from a separate file,
so the same db config can be used by both migration tool and when initializing ORM.

Example structure (it's created automatically if you follow [quickstart](/guide/quickstart)):

```
src/
└── db/
    ├── migrations/ - contains migrations files that can be migrated or rolled back.
    │   ├── recurrent/ - optional: sql files for triggers and functions
    │   │   └── my-function.sql - sql file containing CREATE OR REPLACE
    │   ├── 0001_createPost.ts
    │   └── 0002_createComment.ts
    ├── baseTable.ts - for defining column type overrides.
    ├── config.ts - database credentials are exported from here.
    ├── db.ts - main file for the ORM, connects all tables into one `db` object.
    ├── dbScript.ts - script run by `npm run db *command*`.
    └── seed.ts - for filling tables with data.
```

Export database options:

In this example, `dotenv` is used and configured to first get env variables from `.env.local` and then to get them from the `.env` file.

`DATABASE_URL` contains db credentials, also you can specify a db schema and ssl mode in it, see [database setup](/guide/quickstart#database-setup).

```ts
// db/config.ts

import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config();

const database = {
  databaseURL: process.env.DATABASE_URL,
};
if (!database.databaseURL) throw new Error('DATABASE_URL is missing in .env');

export const config = {
  database,
};
```

Configuring migrations in `db/dbScript.ts`:

```ts
// db/dbScript.ts

// for porsager/postgres driver:
import { rakeDb } from 'orchid-orm/migrations/postgres-js'; // when using Orchid ORM
import { rakeDb } from 'rake-db/postgres-js'; // when using a standalone rake-db
// for node-postgres driver
import { rakeDb } from 'orchid-orm/migrations/node-postgres'; // when using Orchid ORM
import { rakeDb } from 'rake-db/node-postgres'; // when using a standalone rake-db

import { config } from './config';
import { BaseTable } from './baseTable';

export const change = rakeDb(config.database, {
  // relative path to the current file:
  migrationsPath: './migrations',
  // it also can be an absolute path:
  // migrationsPath: path.resolve(__dirname, 'migrations'),

  // This is needed only if you use a bundler such as Vite:
  migrations: import.meta.glob('./migrations/*.ts'),

  // 'serial' (0001, 0002, and so on) is by default, also can be 'timestamp'.
  // Read more about serial vs timestamp below.
  migrationId: 'serial',

  // (when using it with ORM) column type overrides and snakeCase option will be taken from the BaseTable:
  baseTable: BaseTable,
  // (when using it for ORM) path to ORM `db` instance, this is needed to automatically generate migrations.
  dbPath: './db',

  // 'single' is the default (recommended), set to 'per-migration' to run every migration in its own transaction:
  transaction: 'single',

  // custom commands can be defined as follows:
  commands: {
    // dbOptions is an array of database configs
    // config is the config of `rakeDb` defined above
    // args of type string[] is an array of command line arguments startring after the command name
    async seed(dbOptions, config, args) {
      const { seed } = await import('./seed');
      await seed();
    },
  },

  // This is for compatibility with `tsx` and other TS runners, no need to change.
  // Is optional when `migrations` setting is set, is required otherwise.
  import: (path) => import(path),
});
```

Add the `db` script to your `package.json`:

```json
{
  "scripts": {
    "db": "tsx|vite-node|ts-node|bun src/db/dbScript.ts"
  }
}
```

And now it's possible to use it from a command line:

```sh
npm run db new create-a-table
pnpm db new create-a-table
yarn db new create-a-table
pnpm db new "create a table" # spaces are replaced with dashes
```

## serial vs timestamp

Migration files can be prefixed with serial numbers (0001, 0002, and so on), or with timestamps.
Serial is the default, for timestamp prefixes set `migrationId: 'timetamp'` in the config.

The key difference is in handling possible conflicts.

Consider a scenario when you have created a migration in your local branch, then your colleague creates a migration and commits their work to the repository.
You pull the changes, they work on your machine, you push your work and migrations are executed in a different order than they were ran for you,
because on a remote server your colleague's migration ran first, and in your local it ran last.

Using serial numbers are making the case described above impossible, at the cost of having to solve such conflicts.

You can resolve file conflicts automatically with the `rebase` command, read more [about rebase here](/guide/migration-commands#rebase).

Using timestamps frees from file conflicts, at the cost of potential problems caused by wrong migration execution order.

If you'd like to rename existing migrations from timestamps to serial numbers, there is a [change-ids](/guide/migration-commands#change-ids).

## awaiting rakeDb

`rakeDb` function starts executing immediately after it's called, `node.js` will keep the program alive until it has at least one pending promise, and it closes after `rakeDb` is finished.

But some other environments may not wait for `rakeDb` to finish automatically, then you'll need to await for it manually in such a way:

```ts
export const change = rakeDb(dbConfig, rakeDbConfig);

// wait for `rakeDb` to finish:
await change.promise;
```

The promise resolves into a result object:

```ts
interface RakeDbResult {
  // database connection options
  options: AdapterOptions[];
  // rake-db config
  config: AnyRakeDbConfig;
  // command and arguments passed to `rakeDb.lazy` or taken from process.argv
  args: string[];
}
```

Aliases of commands are resolved, so if this was run with `pnpm db migrate`, the command will be `up`.
See full list of aliases in `rakeDbAliases` exported from the `rake-db` package.

## rakeDb

`rakeDb` function in the setup script takes connection options, migration config, and command line arguments:

```ts
const rakeDb = async (
  options: MaybeArray<AdapterOptions>,
  partialConfig?: Partial<MigrationConfig>,
  args: string[] = process.argv.slice(2),
) => {
  // ...
};
```

The first is of the same type `AdapterOptions` which is used when configuring the query builder and the ORM.
Provide an array of such options to migrate two and more databases at the same time, which helps maintain a test database.

The second optional argument of type `MigrationConfig`, all properties are optional, here is the type:

```ts
type MigrationConfig = {
  // (for Orchid ORM) columnTypes and snakeCase can be applied form ORM's BaseTable
  baseTable?: BaseTable;
  // (for Orchid ORM) import path to Orchid ORM `db` instance, used for auto-generating migrations.
  dbPath?: string;
  // (for Orchid ORM) change this if ORM instance is exported under a different name than `db`.
  dbExportedAs?: string; // 'db' is the default

  // or it can be set manually:
  columnTypes?: (t) => {
    // the same columnTypes config as in BaseTable definition
  };
  // set to true to have all columns named in camelCase in the app, but in snake_case in the db
  // by default, camelCase is expected in both app and db
  snakeCase?: boolean;

  // basePath and dbScript are determined automatically
  // basePath is a dir name of the file which calls `rakeDb`, and dbScript is a name of this file
  basePath?: string;
  dbScript?: string;

  // path to migrations directory
  migrationsPath?: string;

  // prefix migration files with a serial number (default) or with a timestamp
  migrationId?: 'serial' | 'timestamp';

  // path to recurrent migrations directory
  // migrationsPath + '/recurrent' is the default
  recurrentPath?: string;

  // table in your database to store migrated versions
  migrationsTable?: string;

  // function to import typescript migration file
  import?(path: string): void;

  // specify behavior for what to do when no primary key was defined on a table
  noPrimaryKey?: 'error' | 'warn' | 'ignore';

  // log options, see "log option" in the query builder document
  log?: boolean | Partial<QueryLogObject>;
  // standard console by default
  logger?: {
    log(message: string): void;
    error(message: string): void;
  };

  // throw if a migration doesn't have a default export
  forceDefaultExports?: boolean;

  beforeMigrate?(db: Db): Promise<void>;
  afterMigrate?(db: Db): Promise<void>;
  beforeRollback?(db: Db): Promise<void>;
  afterRollback?(db: Db): Promise<void>;
};
```

To configure logging, see [log option](/guide/orm-and-query-builder#log-option) in the query builder document.

Note that `migrationsPath` can accept an absolute path, or a relative path to the current file.

Defaults are:

- `basePath` is the dir name of the file you're calling `rakeDb` from
- `migrationPath` is `src/db/migrations`
- `recurrentPath` is `src/db/migrations/recurrent` (directory doesn't have to exist if you don't need it)
- `migrationsTable` is `schemaMigrations`
- `snakeCase` is `false`, so camelCase is expected in both the app and the database
- `import` will use a standard `import` function
- `noPrimaryKey` is `error`, it'll bite if you accidentally forgot to add a primary key to a new table
- `log` is on
- `logger` is a standard `console`

The third optional argument of `rakeDb` is an array of strings from the command line, by default it will use `process.argv` to get the arguments, but you can override it by passing arguments manually.

## snakeCase

By default, this option is `false` and camelCase is expected in a database, change it to `true` if all or most of the columns in your database are in snake_case.

When `snakeCase` is `true`, all column names in migrations will be translated into snake_case automatically.

It changes behavior of `db pull` command at handling column names and timestamps, see [db pull](/guide/migration-commands#pull) for details.

## seeds

To make database seeds, create own script with the needed logic.

In the example, new db instance is constructed with `createDb`,
but you can import `db` object from where it's defined in your app.

```ts
// db/seed.ts
import { db } from './db';

export const seed = async () => {
  await db.table.createMany([{ name: 'record 1' }, { name: 'record 2' }]);

  await db.close();
};
```

Add a custom command to `rake-db` config:

```ts
// db/dbScript

// ...snip imports

export const change = rakeDb(config.database, {
  // ...other options

  commands: {
    async seed(options) {
      const { seed } = await import('./seed');
      await seed();
    },
  },
});
```

Run the seeds with the command:

```sh
npm run db seed
# or
pnpm db seed
```

## recurrent migrations

Recurrent migrations are useful when you want to update SQL functions, triggers, and other database items regularly.

This feature is optional, it's not required to have a `recurrent` directory.

For example, store `add` SQL function into `src/db/migrations/recurrent/add.sql`:

```sql
CREATE OR REPLACE FUNCTION add(integer, integer) RETURNS integer
  AS 'select $1 + $2;'
  LANGUAGE SQL
  IMMUTABLE
RETURNS NULL ON NULL INPUT;
```

When you run the command `recurrent` (aliased as `rec`), `rake-db` will recursively scan the `recurrent` directory and execute all sql files in parallel.

As they are executed in parallel, if one functions depends on the other better place it in a single sql file.

As it is scanned recursively, you can structure `recurrent` directory as it feels better, for example:

```
src/
└── db/
    └── migrations/
        └── recurrent/
            ├── functions/
            │   └── my-function.sql
            └── triggers/
                └── my-trigger.sql
```

## before and after callbacks

[//]: # 'has JSdoc'

To run arbitrary code before or after `migrate` or `rollback` commands, define functions in `rakeDb` config object.

These callbacks are triggered once per database per command.
If 5 migrations were applied, the callback will be called either before all 5, or after.

All callbacks except `afterChangeCommit` are executed inside a transaction together with migrations.
If callback throws an error, the transaction is rolled back and all migration changes aren't saved.

- `beforeMigrate`, `afterMigrate`: is called before or after migrating up
- `beforeRollback`, `afterRollback`: is called before migrating down
- `beforeChange`, `afterChange`: is called before or after migrate or rollback
- `afterChangeCommit`: happens after the migrations transaction is committed and database locks are released.

Non-"Change" callbacks receive a single query builder instance argument, this is not ORM instance,
and yet it can be used for building and executing queries.

Example: each time when `npm run db migrate` is run, after all migrations were successfully applied, this will create new records of a specific table if it is empty.

```ts
export const change = rakeDb(options, {
  async afterMigrate({ db, migrations }) {
    // skip if no migrations were executed
    if (!migrations.length) return;

    const haveRecords = await db('table').exists();
    if (!haveRecords) {
      await db('table').createMany([
        { name: 'one' },
        { name: 'two' },
        { name: 'three' },
      ]);
    }
  },
});
```

`beforeChange` and `afterChange` receive two additional arguments: boolean `up` to check whether it's migrate or rollback,
and boolean `redo` to check whether it's migrating down then up for [redo](/guide/migration-commands#redo) command.

Example for how to run your code after migrating or rolling back, but not in the middle of `redo`:

```ts
export const change = rakeDb(options, {
  afterChange({ db, up, redo, migrations }) {
    if (!up && redo) return;

    console.log('migrate, rollback, or redo command is finished', {
      migrations, // list of migrations that were executed
    });
  },
});
```

For dumping database you should use `afterChangeCommit` because `pg_dump` won't work until the transaction is committed (because of database locks).
Example:

```ts
import { execSync } from 'node:child_process';

export const change = rakeDb(
  { databaseURL: 'postgres://...' },
  {
    afterChangeCommit({ options, migrations }) {
      // skip dumping if there were no pending migrations
      if (!migrations.length) return;

      // `as string` is safe because you can see that databaseURL was set above
      dump(options[0].databaseURL as string);
    },
  },
);

function dump(databaseURL: string) {
  execSync(`pg_dump --schema-only ${databaseURL} > structure.sql`);

  console.log('Db structure was dumped to structure.sql');
}
```

## run migrations from code

### rakeDb lazy

`rakeDb` is designed to be launched with CLI, it will execute one command, and finish.

But in some cases you might want to run it programmatically, and you can do it with `rakeDb.lazy`:

```ts
export const { change, run } = rakeDb.lazy(dbConfig, rakeDbConfig);

// run a command programmatically:
await run(['migrate']);

// optionally, you can provide a partial `rakeDbConfig` to override some values,
// here we override the logger.
const result = await run(['migrate'], {
  log: true,
  logger: {
    log(message: string): void {
      console.log(message);
    },
    warn(message: string): void {
      console.warn(message);
    },
    error(message: string): void {
      console.error(message);
    },
  },
});

// the same result type as in "awaiting rakeDb" section above.
result.options;
result.config;
result.args;
```

`rakeDb.lazy` is accepting the same options as `rakeDb`, and returns two functions.

`change` is to be used in migrations to wrap database changes with it.

`run` is a function to execute a command,
it accepts the same CLI args as `rakeDb` (see [commands section](./migration-commands.md)),
optionally takes config overrides, returns a `Promise<void>`.

### migrateFiles

Useful in tests: use `migrateFiles` to apply only a given migrations.

It works when using `rakeDb.lazy` for configuration, it won't work with `rakeDb`.

This is a lightweight function that skips most of the normal migration command steps,
all it does is it runs a given migrations.

```ts
import { migrateFiles } from 'rake-db';

await migrateFiles(db, [
  import('./0001_user_org_member'),
  import('./0002_account_operator'),
]);
```

`db` is `OrchidORM` instance returned by [orchidORM](/guide/orm-and-query-builder.html#setup).

Unless the `migrateFiles` is called in a regular [transaction](/guide/transactions.html#transaction) or a [testTransaction](/guide/transactions.html#testtransaction),
it wraps given migrations in a transaction.

### makeConnectAndMigrate

You can prepare a function beforehand, and then to run migrations dynamically from your app logic.

```ts
// for porsager/postgres driver:
import { makeConnectAndMigrate } from 'rake-db/postgres-js';
// for node-postgres driver:
import { makeConnectAndMigrate } from 'rake-db/node-postgres';

const connectAndMigrate = makeConnectAndMigrate({
  // minimal config for file-reading approach:
  migrationsPath: './path/to/migrations',
  import: (path) => import(path),

  // alternatively, if you're using Vite:
  migrations: import.meta.glob('./migrations/*.ts'),
});

// later in the app logic:
connectAndMigrate({ databaseURL: givenURL });
// supports array:
connectAndMigrate([{ databaseURL: givenURL }, { databaseURL: otherURL }]);
// runs all pending migrations by default, you can limit it with `count`:
connectAndMigrate({ databaseURL: givenURL }, { count: 1 });
```
