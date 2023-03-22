# Migration commands

After the migration tool, `rake-db`, was [set and configured](/guide/migration-setup-and-overview#setup), you can use it from a command line.

## create and drop a database

Create and drop a database from a command line:

```sh
npm run db create
npm run db drop
```

These commands will ask for a database administrator username and password.

## reset a database

`reset` is a shortcut command to drop, create and migrate.

```sh
npm run db reset
```

## pull

Generate migration file from an existing database using `pull` command:

```sh
npm run db pull
```

This will create a single migration file with all the tables and columns.

If `appCodeUpdater` is configured in `rake-db` config file, it will also generate project files.

Currently, it supports generating code to create:

- schemas
- tables
- enums
- columns with all possible column options
- primary keys
- foreign keys
- indexes
- domain types

Assuming we have two tables in a database, one with camelCase columns and the other with snake_case:

```sql
CREATE TABLE "camel" (
  "id" serial PRIMARY KEY,
  "camelCaseColumn" text NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE TABLE "snake" (
  "id" serial PRIMARY KEY,
  "snake_case_column" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
```

When snakeCase is `false` (default), `db pull` will produce the following migration, where snake_case columns are explicitly named and `timestampsSnakeCase` is used:

```ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('camel', (t) => ({
    id: t.serial().primaryKey(),
    camelCaseColumn: t.text(),
    ...t.timestamps(),
  }));
  
  await db.createTable('snake', (t) => ({
    id: t.serial().primaryKey(),
    snakeCaseColumn: t.name('snake_case_column').text(),
    ...t.timestampsSnakeCase(),
  }))
});
```

When snakeCase is `true`, `db pull` will produce the following migration, this time camelCase columns are explicitly named, and timestamps have no shortcut:

```ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('camel', (t) => ({
    id: t.serial().primaryKey(),
    camelCaseColumn: t.name('camelCaseColumn').text(),
    createdAt: t.name('createdAt').timestamp().default(t.raw('now()')),
    updatedAt: t.name('updatedAt').timestamp().default(t.raw('now()')),
  }));

  await db.createTable('snake', (t) => ({
    id: t.serial().primaryKey(),
    snakeCaseColumn: t.text(),
    ...t.timestamps(),
  }))
});
```

If column type is a custom one defined by user, or if it is not supported yet, `db pull` will log a warning and output the column as follows:

```ts
await db.createTable('table', (t) => ({
  column: t.type('unsupported_type'),
}))
```

It works, just when using `t.type` in the application to define a column, you need to use `as` method to treat it as another column:

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // treat unsupported type as text
    column: t.type('unsupported_type').as(t.text()),
  }));
}
```

## generate migration

Generate a new migration file by using `g` command (`g` is an alias for `generate`):

```sh
npm run db g migrationName
# or
pnpm db g migrationName
```

If the migration name matches one of the known patterns, it will generate a template:

- `create${table name}` for creating a new table
- `drop${table name}` for dropping a table
- `change${table name}` for changing a table
- `add${any string}To${table name}` for adding columns to a table
- `remove${any string}From${table name}` for removing columns from a table

When using the `create`, `drop`, `add...to`, and `remove...from` names you can also specify columns in a command line to be added to a generated migration.

Specify a column by writing a column name, then a column type separated with `:`, column type can accept an argument `(arg)`, then optionally specify a methods chain such as `.primaryKey`, `.nullable`, methods can have arguments too.

When passing an argument, put a column definition into quotes.

Example:

```sh
npm run db g createTodo id:serial.primaryKey 'name:varchar(50)' description:text.nullable
```

Will generate such a migration:

```ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('todo', (t) => ({
    id: t.serial().primaryKey(),
    name: t.varchar(50),
    description: t.text().nullable(),
  }));
});
```

## migrate and rollback

Migrate command will run all not applied yet migrations, sequentially in order:

```sh
npm run db migrate
```

Pass a number to migrate only this specific number of migrations:

```sh
npm run db migrate 3
```

The rollback command will revert one last applied migration:

```sh
npm run db rollback
```

Pass a number to revert multiple last applied migrations, or pass `all` to revert all of them:

```sh
npm run db rollback 3
npm run db rollback all
```

## custom commands

`rakeDb` allows to specify your own functions for a custom commands:

```ts
import { rakeDb } from 'rake-db'
import { createDb } from 'pqb'
import { config } from './config'

rakeDb(
  // config may have array of databases, for dev and for test
  config.databases,
  {
    commands: {
      async custom(dbConfigs, config, args) {
        // dbConfig is array of provided database configs
        for (const dbConfig of dbConfigs) {
          const db = createDb(dbConfig)
          
          // perform some query
          await db('table').insert(someData)
          
          // closing db after using it
          await db.close()
        }
        
        // config is this config object we're inside
        config.commands.custom // this is a function we're inside of
        
        // command line arguments of type string[]
        console.log(args)
      }
    }
  },
);
```

Running this command will perform a query and log arguments `['one', 'two']` to the console:

```sh
npm run db custom one two
```