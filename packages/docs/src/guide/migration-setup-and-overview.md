# Migrations setup and overview

Migrations allow you to evolve your database schema over time. This migration toolkit has several benefits over writing raw SQL migrations or using other tools:

- write migrations in TypeScript
- write only code to create or add something, and it will be automatically possible to undo the migration
- it shares the same column types library as the ORM, which allows you to write a `createTable` migration and copy-paste columns to your table class

## setup

Install this tool by running:

```sh
npm i -D rake-db
```

Add a script file somewhere to your project, and ensure it's located in one of `include` locations of your `tsconfig.json`.

For example, it could be located in `scripts/db.ts` in your project.

Since the configuration is done in a regular TypeScript, it's possible to perform any logic and use any configuration tools to specify database connection options.

In the following example, `dotenv` is used and configured to first get env variables from `.env.local` and then to get them from the `.env` file.

```ts
// scripts/db.ts
import { config } from 'dotenv'
import path from 'path'
import { rakeDb } from 'rake-db'
import { appCodeUpdater } from 'orchid-orm';

config({ path: path.resolve(process.cwd(), '.env.local') })
config()

const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) {
  throw new Error('DATABASE_URL is missing in .env');
}

rakeDb(
  {
    databaseURL,
    // ssl option can be set here or as a URL parameter on databaseURL
    ssl: true
  },
  {
    migrationsPath: path.resolve(process.cwd(), 'migrations'),
    
    // optionally, for automatic code updating after running migrations:
    appCodeUpdater: appCodeUpdater({
      tablePath: (tableName) => `src/app/tables/${tableName}.table.ts`,
      baseTablePath: 'src/lib/baseTable.ts',
      baseTableName: 'BaseTable',
      mainFilePath: 'src/db.ts',
    }),
  },
);
```

Add the `db` script to your `package.json`:

```json
{
  "scripts": {
    "db": "ts-node scripts/db.ts"
  }
}
```

And now it's possible to use it from a command line:

```sh
npm run db g createSomeTable
pnpm run db g createSomeTable
yarn db g createSomeTable
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
}
```

The first is of the same type `AdapterOptions` which is used when configuring the query builder and the ORM.
Provide an array of such options to migrate two and more databases at the same time, which helps maintain a test database.

The second optional argument of type `MigrationConfig`, here is the type:

```ts
type MigrationConfig = {
  // absolute path to migrations directory
  migrationsPath: string;
  
  // table in your database to store migrated versions
  migrationsTable: string;
  
  // function to require typescript migration file
  requireTs(path: string): void;
  
  // specify behavior for what to do when no primary key was defined on a table
  noPrimaryKey?: 'error' | 'warn' | 'ignore'
  
  // log options, see "log option" in the query builder document
  log?: boolean | Partial<QueryLogObject>;
  logger?: {
    log(message: string): void;
    error(message: string): void;
  };

  appCodeUpdater?(params: {
    // abstract syntax tree of changes
    ast: RakeDbAst;
    // connection options
    options: AdapterOptions;
    // the same object is passed between various appCodeUpdater calls
    cache: object;
  }): Promise<void>

  useCodeUpdater?: boolean,
}
```

To configure logging, see [log option](/guide/query-builder.html#createdb) in the query builder document.

Defaults are:

- `migrationPath` is `src/migrations`
- `migrationsTable` is `schemaMigrations`
- `requireTs` will use a `ts-node` package
- `noPrimaryKey` is `error`
- `log` is on
- `logger` is a standard `console`
- `useCodeUpdater` is `true`

The third optional argument of `rakeDb` is an array of strings from the command line, by default it will use `process.argv` to get the arguments, but you can override it by passing arguments manually.

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
- changes `table` property in the table file when renaming a table
- removes table entry from `db` file when dropping a table

`appCodeUpdater` does not delete or rename existing files, because it is better to be done manually.
A modern editor will update all file usage in imports across the project when renaming a file or an exported class.

