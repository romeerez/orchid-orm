# Migration commands

After the migration tool, `rake-db`, was set and configured, you can use it from a command line.

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

## generate migration

Generate a new migration file, use the `generate` command is aliased with `g`:

```sh
npm run db g migrationName
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

Pass a number to revert multiple last applied migrations, or pass 'all' to revert all of them:

```sh
npm run db rollback 3
npm run db rollback all
```
