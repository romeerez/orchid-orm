# Migrations setup and overview

Migrations allow you to evolve your database schema over time. This migration toolkit has several benefits over writing raw SQL migrations or using other tools:

- write migrations in TypeScript
- write only code to create or add something, and it will be automatically possible to undo the migration
- it shares the same column types library as the ORM, which allows to write a `createTable` migration and copy-paste columns to your model

## setup

Install this tool by running:

```sh
npm i -D rake-db
```

Add a script file somewhere to your project, ensure it's located in one of `include` locations of your `tsconfig.json`.

For example, it could be located in `scripts/db.ts` in your project.

Since the configuration is done in a regular TypeScript, it's possible to perform any logic and use any configuration tools to specify database connection options.

In following example `dotenv` is used and configured to first get env variables from `.env.local` and then to get them from `.env` file.

```ts
// scripts/db.ts
import { config } from 'dotenv'
import path from 'path'
import { rakeDb } from 'rake-db'

config({ path: path.resolve(process.cwd(), '.env.local') })
config()

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing in .env');
}

const migrationsPath = path.resolve(process.cwd(), 'migrations')

rakeDb(
  { connectionString },
  { migrationsPath },
);
```

Add `db` script to your `package.json`:

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

`rakeDb` function in setup script takes connection options, migration config and command line arguments:

```ts
const rakeDb = async (
  options: MaybeArray<AdapterOptions>,
  partialConfig?: Partial<MigrationConfig>,
  args: string[] = process.argv.slice(2),
) => {
  // ...
}
```

First is of the same type `AdapterOptions` which is used when configuring query builder and the ORM.
Provide an array of such options to migrate two and more databases at the same time, which is helpful for maintaining a test database.

Second optional argument of type `MigrationConfig`, here is the type:

```ts
type MigrationConfig = {
  // absolute path to migrations directory
  migrationsPath: string;
  
  // table in your database to store migrated versions
  migrationsTable: string;
  
  // function to require typescript migration file
  requireTs(path: string): void;
  
  // log options, see "log option" in query builder document
  log?: boolean | Partial<QueryLogObject>;
  logger?: {
    log(message: string): void;
    error(message: string): void;
  };
}
```

To configure logging, see [log option](/guide/query-builder.html#createdb) in query builder document.

Defaults are:

- `migrationPath` is `src/migrations`
- `migrationsTable` is `schemaMigrations`
- `requireTs` will use a `ts-node` package
- `log` is on
- `logger` is a standard `console`

Third optional argument of `rakeDb` is array of strings from command line, by default it will use `process.argv` to get the arguments, but you can override it by passing arguments manually.
