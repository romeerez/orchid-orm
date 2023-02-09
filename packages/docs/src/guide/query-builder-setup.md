# Query Builder

The query builder is the interface used for building and executing standard SQL queries, such as `select`, `create`, `update`, and `delete`.

`pqb` is aiming to be as similar to [knex](https://knexjs.org/) query builder as possible, but with better TypeScript support and some additional features.

Everything listed in this document also applies to the [ORM](/guide/orm-setup-and-overview), except for relations and other ORM-specific features.

Install by running:

```sh
npm i pqb
```

## createDb

`createDb` is a function to configure query builder instance, it is accepting the same options as [node-postgres](https://node-postgres.com/) library and some additional.

For all connection options see: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool)

```ts
import { createDb } from 'pqb'

const db = createDb({
  // databaseURL has the following format:
  // postgres://user:password@localhost:5432/dbname
  // 
  // ssl option can be specified as a parameter:
  // postgres://user:password@localhost:5432/dbname?ssl=true
  databaseURL: process.env.DATABASE_URL,
  
  // ssl can also be specified as an option:
  ssl: true,
  
  // option for logging, false by default
  log: true,
  
  // optionally, you can customize column types behavior
  columnTypes: (t) => ({
    ...t,
    // by default timestamp is returned as a stirng, override to a number
    timestamp: () => t.timestamp().asNumber(),
  }),

  // option to create named prepared statements implicitly, false by default
  autoPreparedStatements: true,
  
  // handle case when there is no primary key on a table, 'error' is default
  // 'error' | 'warning' | 'ignore'
  noPrimaryKey: 'ignore',
})
```

To reuse the underlying `Adapter` instance, you can provide an adapter:

```ts
import { createDb, Adapter } from 'pqb'

const db = createDb(
  {
    adapter: new Adapter({ databaseURL: process.env.DATABASE_URL }),
    log: true,
  }
)
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
const db = createDb({
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
})
```

## columnTypes option

It is possible to override the parsing of columns returned from the database.

See [column types document](/guide/columns-overview.html#override-column-types) for details.

## autoPreparedStatements option

This option was meant to speed queries up, but benchmarks cannot prove this, so simply ignore this option for now.

`pg` node module used under the hood is performing "unnamed" prepared statements by default ([link](https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY) to Postgres details about this).

When the option is set to `true`, the query builder will generate a name for each different query to make the statement named.

## noPrimaryKey option

All tables should have a primary key. Even if it is a join table, it should have a composite primary key consisting of foreign key columns.

In case when developer forgets about defining a primary key, this library will throw an error by default.

You can change this behavior by specifying `warning` to print a warning message, or `ignore` to do nothing.

```ts
const db1 = createDb({ ...options })
// will throw an error by default
db1('table', () => ({
  // no primary key defined
}))

const db2 = createDb({ ...options, noPrimaryKey: 'warning' })
// will print a warning message
db2('table', () => ({
  // no primary key defined
}))

const db3 = createDb({ ...options, noPrimaryKey: 'ignore' })
// no error or warning
db2('table', () => ({
  // no primary key defined
}))
```

`noPrimaryKey` can be customized for a specific table:

```ts
const db = createDb({ ...options })
db('table', () => ({
  // no primary key defined
}), {
  // override the option for a specific table
  noPrimaryKey: 'ignore'
})
```

## close

Call `db.close` to end the database connection:

```ts
await db.close()
```

## database table interface

Make a queryable object by calling `db` with a table name and schema definition.

(see [Columns schema](/guide/columns-overview) document for details)

```ts
const db = createDb(options)

export const User = db('user', (t) => ({
  id: t.serial().primaryKey(),
  name: t.text(3, 100),
  password: t.text(8, 200),
  age: t.integer().nullable(),
  ...t.timestamps(),
}));
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
})
```

Now the `User` can be used for making type-safe queries:

```ts
const users = await User.select('id', 'name') // only known columns are allowed
  .where({ age: { gte: 20 } }) // gte is available only on the numeric field, and the only number is allowed
  .order({ createdAt: 'DESC' }) // type safe as well
  .limit(10)

// users array has a proper type of Array<{ id: number, name: string }>
```

The database schema for the table can be optionally specified in a third argument:
```ts
const Country = db(
  'country',
  (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
  }),
  {
    schema: 'geo',
  },
);

const sql = Country.all().toSql()
sql === `SELECT * FROM "geo"."country"`
```

Schema argument is optional, in the case it was not provided query builder won't have any type guarantees and the result will have fields of type `unknown`:

```ts
const User = db('user')
const users = await User.select('any string')
  .where({ foo: 'bar' })
  .order({ baz: 'DESC' })
  .limit(10)

// users has type of Array<Record<string, unknown>>
```
