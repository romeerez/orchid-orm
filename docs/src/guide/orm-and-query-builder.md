# ORM and query builder

`Orchid ORM` consists of a query builder (such as [Knex](https://knexjs.org/) or [Kysely](https://www.kysely.dev/docs/intro)) + layer on top of it for defining, querying and utilizing relations (as in [Prisma](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)).

The query builder is for building and executing SQL queries, such as `select`, `create`, `update`, and `delete`.

ORM allows defining `belongsTo`, `hasMany` and [other relations](/guide/orm-relations.html), select and join them, create/update/delete records together with their related records and [more](/guide/orm-relation-queries.html).

## setup

Install by running:

```sh
npm i orchid-orm pqb
# or
pnpm i orchid-orm pqb
```

`orchidORM` is an entry function of the ORM.

The first argument is a connection options object, the ORM-specific options are described below,
see also options for a `pg` adapter that could be passed via the same object: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool).

The second argument is an object where keys are names and values are table classes (see next section for defining a table class).

Returns an instance with tables and some specific functions prefixed with a `$` sign to not overlap with your tables.

```ts
import { orchidORM } from 'orchid-orm';

// import all tables
import { UserTable } from './tables/user';
import { MessageTable } from './tables/message';

export const db = orchidORM({
  // details for databaseURL are below
  databaseURL: process.env.DATABASE_URL,

  // ssl and schema can be set here or as a databaseURL parameters:
  ssl: true,
  schema: 'my_schema',

  // option for logging, false by default
  log: true,

  // option to create named prepared statements implicitly, false by default
  autoPreparedStatements: true,
}, {
  user: UserTable,
  message: MessageTable,
});
```

If needed, you can pass `Adapter` instance instead of connection options:

```ts
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({
  adapter: new Adapter({ databaseURL: process.env.DATABASE_URL }),
  log: true,
}, {
  // ...tables
});
```

## defining a base table

First, need to create a base table class to extend from, this code should be separated from the `db` file:

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable();
```

Optionally, you can customize column types behavior here for all future tables:

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  // set to true if columns in database are in snake_case
  snakeCase: true,

  columnTypes: (t) => ({
    // by default timestamp is returned as a stirng, override to a number
    timestamp: () => t.timestamp().asNumber(),
  }),
});
```

See [override column types](/guide/columns-overview.html#override-column-types) for details of customizing columns.

Tables are defined as classes `table` and `columns` required properties:

`table` is a table name and `columns` is for defining table column types (see [Columns schema](/guide/columns-overview) document for details).

Note that the `table` property is marked as `readonly`, this is needed for TypeScript to check the usage of the table in queries.

```ts
// import BaseTable from a file from the previous step:
import { BaseTable } from './baseTable';

// export type of User object:
export type User = UserTable['columns']['type'];
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(3, 100),
    password: t.text(8, 200),
    ...t.timestamps(),
  }));
}
```

After defining the table place it in the main `db` file as in [setup](#setup) step:

```ts
import { UserTable } from './tables/user';

export const db = orchidORM({
  databaseURL: process.env.DATABASE_URL,
}, {
  user: UserTable,
});
```

And now it's available for querying:

```ts
import { db } from './db'

const user = await db.user.findBy({ name: 'John' })
```

Don't use table classes directly, this won't work:
```ts
// error
await UserTable.findBy({ name: 'John' })
```

`snakeCase` can be overridden for a table:

```ts
import { BaseTable } from './baseTable'

export class SnakeCaseTable extends BaseTable {
  readonly table = 'table';
  // override snakeCase:
  snakeCase = true;
  columns = this.setColumns((t) => ({
    // snake_column in db
    snakeColumn: t.text(),
  }))
}
```

## createDb
 
For the case of using the query builder as a standalone tool, use `createDb` from `pqb` package.

As `Orchid ORM` focuses on ORM usage, docs examples mostly demonstrates how to work with ORM-defined tables,
but everything that's not related to table relations should also work with `pqb` query builder on its own.

It is accepting the same options as `orchidORM` + options of `createBaseTable`:

```ts
import { createDb } from 'pqb'

const db = createDb({
  // db connection options
  databaseURL: process.env.DATABASE_URL,
  log: true,
  
  // columns in db are in snake case:
  snakeCase: true,

  // override column types:
  columnTypes: (t) => ({
    // by default timestamp is returned as a stirng, override to a number
    timestamp: () => t.timestamp().asNumber(),
  }),
})

```

After `db` is defined, construct queryable tables in such way:

```ts
export const User = db('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(3, 100),
  password: t.text(8, 200),
  age: t.integer().nullable(),
  ...t.timestamps(),
}));
```

Now the `User` can be used for making type-safe queries:

```ts
const users = await User.select('id', 'name') // only known columns are allowed
  .where({ age: { gte: 20 } }) // gte is available only on the numeric field, and the only number is allowed
  .order({ createdAt: 'DESC' }) // type safe as well
  .limit(10)

// users array has a proper type of Array<{ id: number, name: string }>
```

The optional third argument is for table options:

```ts
const Table = db('table', (t) => ({ ...columns }), {
  // provide this value if the table belongs to a specific database schema
  schema: 'customTableSchema',
  // override `log` option of `createDb`:
  log: true, // boolean or object described `createdDb` section
  logger: { ... }, // override logger
  noPrimaryKey: 'ignore', // override noPrimaryKey
  snakeCase: true, // override snakeCase
})
```

## databaseURL option

`databaseURL` has the following format:

```
postgres://user:password@localhost:5432/dbname
```

`schema` and `ssl` option can be specified as a parameter:

```
postgres://user:password@localhost:5432/dbname?schema=my_schema&ssl=true
```

If `schema` is set and is different from `public`,
the `SET search_path = schema` query will be performed before the first query run per each database connection.

## snakeCase option

By default, all column names are expected to be named in camelCase.

If only some columns are named in snake_case, you can use `name` method to indicate it:

```ts
import { BaseTable } from './baseTable';

class Table extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    camelCase: t.integer(),
    snakeCase: t.name('snake_case').integer(),
  }));
}

// all columns are available by a camelCase name,
// even though `snakeCase` has a diferent name in the database
const records = await table.select('camelCase', 'snakeCase')
```

Set `snakeCase` to `true` if you want all columns to be translated automatically into a snake_case.

Column name can still be overridden with a `name` method.

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  snakeCase: true,
});

class Table extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    // camelCase column requires an explicit name
    camelCase: t.name('camelCase').integer(),
    // snakeCase is snakerized automatically when generating SQL
    snakeCase: t.integer(),
  }));
}

// result is the same as before
const records = await table.select('camelCase', 'snakeCase')
```

## log option

The `log` option is false by default, `true` or custom object can be provided:

```ts
type LogOption = {
  // for colorful log, true by default
  colors?: boolean,
  
  // callback to run before query
  // Query is a query object, sql is { text: string, values: unknown[] }
  // returned value will be passed to afterQuery and onError
  beforeQuery?(sql: Sql): unknown;
  
  // callback to run after query, logData is data returned by beforeQuery
  afterQuery?(sql: Sql, logData: unknown): void;
  
  // callback to run in case of error
  onError?(error: Error, sql: Sql, logData: unknown): void;
}
```

The log will use `console.log` and `console.error` by default, it can be overridden by passing the `logger` option:

```ts
export const db = orchidORM({
  databaseURL: process.env.DATABASE_URL,
  log: true,
  logger: {
    log(message: string): void {
      // ...
    },
    error(message: string): void {
      // ...
    },
  }
}, {
  // ...tables
})
```

## autoPreparedStatements option

This option was meant to speed up the queries, but benchmarks cannot prove this, so simply ignore this option for now.

`pg` node module used under the hood is performing "unnamed" prepared statements by default ([link](https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY) to Postgres details about this).

When the option is set to `true`, the query builder will generate a name for each different query to make the statement named.

## noPrimaryKey

All tables should have a primary key. Even if it is a join table, it should have a composite primary key consisting of foreign key columns.

If you forgot to define a primary key, ORM will send a friendly remained by throwing an error.

Disable the check for a specific table by setting `noPrimaryKey` property:

```ts
import { BaseTable } from './baseTable'

export class NoPrimaryKeyTable extends BaseTable {
  readonly table = 'table';
  noPrimaryKey = true; // set to `true` to ignore absence of primary key
  columns = this.setColumns((t) => ({
    // ...no primary key defined
  }))
}
```

Or, you can override this behavior for all tables by placing `noPrimaryKey` option into `orchidORM` config:

`ignore` will disable the check, `warning` will print a warning instead of throwing error.

```ts
// ignore absence of primary keys for all tables
const db = orchidORM({
  databaseURL: process.env.DATABASE_URL,
  noPrimaryKey: 'ignore',
}, {
  // ...tables
})

// print a warning for all tables without primary key
const db2 = orchidORM({
  databaseURL: process.env.DATABASE_URL,
  noPrimaryKey: 'warning',
}, {
  // ...tables
})
```

## $from

Use `$from` to build a queries around sub queries similar to the following:

```ts
const subQuery = db.someTable.select('name', {
  relatedCount: (q) => q.related.count(),
})

const result = await db.$from(subQuery).where({ relatedCount: { gte: 5 } }).limit(10)
```

For a standalone query builder, the method is `from`.

## $close

Call `$clone` to end a database connection:

```ts
await db.$close()
```

For a standalone query builder, the method is `close`.
