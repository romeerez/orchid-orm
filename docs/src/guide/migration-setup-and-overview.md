# Migrations setup and overview

Migrations allow you to evolve your database schema over time. This migration toolkit has several benefits over writing raw SQL migrations or using other tools:

- write migrations in TypeScript, that enables performing insert queries and having any logic
- write only code to create or add something, and it will be automatically possible to undo the migration
- it shares the same column types library as the ORM, which allows you to write a `createTable` migration and copy-paste columns to your table class
- optionally, automatically updating table files of ORM after running a migration, instead of copy-pasting

## how it works

`rake-db` automatically creates a table `schemaMigrations` where it saves all the migrated files prefixes and names.
It's allowed to have two migrations with the same name, but all the migrations must have different numeric prefixes.

All changes are wrapped into a single transaction. If you have 3 pending migrations, and the last one throws an error,
none of them will be applied.

The transaction beings with setting a [pg_advisory_xact_lock](https://www.postgresql.org/docs/current/functions-admin.html).
If you're deploying a cluster of node.js applications, and each application starts with running migrations,
the first of them will set a lock and apply the migrations, the rest will wait for a lock,
and after the lock is released all migrations are already applied.

Locally, migrations are compiled from TS to JS on the fly before running.
When developing to remote server, it may be preferable to precompile them first.
If you're using `rake-db` as a standalone tool, try [ORM initializer script](/guide/quickstart.html) to use configs from it,
the script allows to choose between `tsx`, `vite`, and `ts-node` and generates configs accordingly,
package.json has `build:migrations` and `db:compiled` scripts.

## setup

It is already set up if you ran `npx orchid-orm@latest` command from a [quickstart](/guide/quickstart).

Install this migration tool by running:

```sh
npm i -D rake-db
```

::: info
`rake-db` is named after a command in Ruby on Rails because took some inspiration from it.
:::

Since the configuration is done in a regular TypeScript, it's possible to perform any logic and use any configuration tools to specify database connection options.

We suggest to keep database configuration options exported from a separate file, so it can be used both by migration tool and by `db` instance in a project.

Example structure (it's created automatically if you follow [quickstart](/guide/quickstart)):

```
src/
└── db/
    ├── migrations/ - contains migrations files that can be migrated or rolled back.
    │   ├── recurrent/ - optional: sql files for triggers and functions
    │   │   └── my-function.sql - sql file containing CREATE OR REPLACE
    │   ├── timestamp_createPost.ts
    │   └── timestamp_createComment.ts
    ├── baseTable.ts - for defining column type overrides.
    ├── config.ts - database credentials are exported from here.
    ├── db.ts - main file for the ORM, connects all tables into one `db` object.
    ├── dbScript.ts - script run by `npm run db *command*`.
    └── seed.ts - for filling tables with data.
```

Export database options:

In this example, `dotenv` is used and configured to first get env variables from `.env.local` and then to get them from the `.env` file.

`DATABASE_URL` contains db credentials, also you can specify a db schema and ssl mode in it, see [database setup](/guide/quickstart.html#database-setup).

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

Configure a `db` script:

```ts
// db/dbScript.ts

import { rakeDb } from 'rake-db';
import { appCodeUpdater } from 'orchid-orm/codegen';
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

  // column type overrides and snakeCase option will be taken from the BaseTable:
  baseTable: BaseTable,

  // optionally, for automatic code updating after running migrations:
  // baseTable is required when setting appCodeUpdater
  appCodeUpdater: appCodeUpdater({
    // paths are relative to the current file
    tablePath: (tableName) => `./tables/${tableName}.table.ts`,
    ormPath: './db.ts',
  }),

  // true by default, whether to use code updater by default
  useCodeUpdater: false,

  // custom commands can be defined as follows:
  commands: {
    // dbOptions is an array of database configs
    // config is the config of `rakeDb` (that contains migrationPath, appCodeUpdater, etc)
    // args of type string[] is an array of command line arguments startring after the command name
    async seed(dbOptions, config, args) {
      const { seed } = await import('./seed');
      await seed();
    },
  },
});
```

Add the `db` script to your `package.json`:

```json
{
  "scripts": {
    "db": "ts-node src/db/dbScript.ts"
  }
}
```

And now it's possible to use it from a command line:

```sh
npm run db new createSomeTable
pnpm db new createSomeTable
yarn db new createSomeTable
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

## rakeDb lazy

`rakeDb` is designed to be launched with CLI, it will execute one command, and finish.

But in some cases you might want to run it programmatically, and you can do it with `rakeDb.lazy`:

```ts
export const { change, run } = rakeDb.lazy(dbConfig, rakeDbConfig);

// run a command programmatically:
await run(['migrate']);

// optionally, you can provide a partial `rakeDbConfig` to override some values,
// here we override the logger.
await run(['migrate'], {
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
```

`rakeDb.lazy` is accepting the same options as `rakeDb`, and returns two functions.

`change` is to be used in migrations to wrap database changes with it.

`run` is a function to execute a command,
it accepts the same CLI args as `rakeDb` (see [commands section](./migration-commands.md)),
optionally takes config overrides, returns a `Promise<void>`.

## ReferenceError: require is not defined

If you encounter the error `ReferenceError: require is not defined`,
it means you're running on ESM and your node.js runner could not import `ts` migration.

This may happen with `ts-node/esm`, `vite`.

To resolve it, simply add the `import` function to the `rakeDb` config:

```ts
export const change = rakeDb(config.database, {
  import: (path) => import(path),
});
```

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
  // columnTypes and snakeCase can be applied form ORM's BaseTable
  baseTable?: BaseTable;
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

  appCodeUpdater?(params: {
    // abstract syntax tree of changes
    ast: RakeDbAst;
    // connection options
    options: AdapterOptions;
    // to resolve relative paths
    basePath: string;
    // the same object is passed between various appCodeUpdater calls
    cache: object;
    // the logger object from the above config
    // if log: false in the above config, logger is undefined
    logger?: {
      log(message: string): void;
      error(message: string): void;
    };
  }): Promise<void>;

  useCodeUpdater?: boolean;

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
- `recurrentPath` is `src/db/migrations/recurrent` (directory doesn't have to exist if don't need it)
- `migrationsTable` is `schemaMigrations`
- `snakeCase` is `false`, so camelCase is expected in both the app and the database
- `import` will use a standard `import` function
- `noPrimaryKey` is `error`, it'll bite if you accidentally forgot to add a primary key to a new table
- `log` is on
- `logger` is a standard `console`
- `useCodeUpdater` is `true`, but it won't run anything if you don't specify `appCodeUpdater` config

The third optional argument of `rakeDb` is an array of strings from the command line, by default it will use `process.argv` to get the arguments, but you can override it by passing arguments manually.

## snakeCase

By default, this option is `false` and camelCase is expected in a database, change it to `true` if all or most of the columns in your database are in snake_case.

When `snakeCase` is `true`, all column names in migrations will be translated into snake_case automatically.

It changes behavior of `db pull` command at handling column names and timestamps, see [db pull](/guide/migration-commands#pull) for details.

## appCodeUpdater

`appCodeUpdater` is a module that will add new and update existing project files when running migrations.

To prevent running when not needed, append `--code false` flag to cli command:

```sh
npm run db migrate --code false
```

If you don't want to run it on every migration, set `useCodeUpdater` to false and run migration with `--code` flag to run code updater when needed:

```sh
npm run db migrate --code
```

What `appCodeUpdater` does:

- creates base table file if it doesn't exist
- creates main `db` file if it doesn't exist
- creates a new table file when creating a table
- adds table entry to `db` file when creating a table
- adds new columns, indexes, and foreign keys to the table file when they are added in a migration
- changes columns, indexes, and foreign keys in the table file when they are changed in a migration
- changes `table` and `schema` property in the table file when renaming a table
- removes table entry from `db` file when dropping a table

`appCodeUpdater` does **not** delete or rename existing files, because it is better to be done manually.
A modern editor will update all file usage in imports across the project when renaming a file or an exported class.

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

To run custom code before or after `migrate` or `rollback` command, define functions in `rakeDb` config object:

Supported callbacks are `beforeMigrate`, `afterMigrate`, `beforeRollback`, `afterRollback`.

Example: each time when `npm run db migrate` is run, after the migration was successfully applied, this will create new records of a specific table if it is empty.

If `options` is an array of multiple database configs, callbacks are run for each of the databases.

```ts
export const change = rakeDb(options, {
  async afterMigrate(db: Db) {
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
