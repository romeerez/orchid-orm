# ORM setup and overview

**Orchid ORM** stands for Postgres ORM, where ORM is an abstract interface to work with tables and relations between them with ease and fun.

While the `pqb` query builder is designed to cover the abilities of [knex](https://knexjs.org) to allow building any possible queries,
`orchid-orm` takes inspiration from [prisma](https://prisma.io/) and other ORMs to give the highest productivity.

`orchid-orm` tables are interfaces on top of `pqb` tables, and all methods of `pqb` are also available here.
For query methods see [query builder](/guide/query-builder) document.

## setup

Install by running:

```sh
npm i orchid-orm
```

`orchidORM` is an entry function of the ORM.

The first argument is a connection options object, for all connection options see: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool).

Connection options are the same as for the query builder, see [createDb](/guide/query-builder.html#createDb) for details.

The second argument is an object where keys are names and values are table classes (see next section for defining a table class).

Returns an instance with tables and some specific functions prefixed with a `$` sign to not overlap with your tables.

```ts
import { orchidORM } from 'orchid-orm'

// import all tables
import { UserTable } from './tables/user'
import { MessageTable } from './tables/message'

export const db = orchidORM({
  // the same options as in a query builder setup
  databaseURL: process.env.DATABASE_URL,
  ssl: true,
  schema: 'my_schema',
  log: true,
  autoPreparedStatements: true,
  noPrimaryKey: 'ignore',
}, {
  user: UserTable,
  message: MessageTable,
})
```

## defining a base table

First, need to create a base table class to extend from, this code should be separated from the `db` file:

```ts
import { createBaseTable } from 'orchid-orm'

export const BaseTable = createBaseTable()
```

Optionally, you can customize column types behavior here for all future tables:

```ts
import { createBaseTable } from 'orchid-orm'

export const BaseTable = createBaseTable({
  // set to true if columns in database are in snake_case
  snakeCase: true,

  columnTypes: (t) => ({
    // by default timestamp is returned as a stirng, override to a number
    timestamp() {
      return t.timestamp.call(this).asNumber()
    },
  }),
})
```

See [query builder setup](/guide/query-builder-setup.html#snakecase) for `snakeCase` option.

See [column types document](/guide/columns-overview.html#override-column-types) for details of customizing columns.

Tables are defined as classes with two required properties:

`table` is a table name and `columns` is for defining table column types (see [Columns schema](/guide/columns-overview) document for details).

Note that the `table` property is marked as `readonly`, this is needed for TypeScript to check the usage of the table in queries.

```ts
// import BaseTable from a file from the previous step:
import { BaseTable } from './baseTable'

// export type of User object:
export type User = UserTable['columns']['type']
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(3, 100),
    password: t.text(8, 200),
    ...t.timestamps(),
  }))
}
```

After defining the table place it in the main `db` file as in [setup](#setup) step:

```ts
import { UserTable } from './tables/user'

export const db = orchidORM({
  databaseURL: process.env.DATABASE_URL,
}, {
  user: UserTable,
})
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

For the case when the table should not have a primary key, you can override `noPrimaryKey` by setting a property to the table:

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

## $from

Use `$from` to build a queries around sub queries similar to the following:

```ts
const subQuery = db.someTable.select('name', {
  relatedCount: (q) => q.related.count(),
})

const result = await db.$from(subQuery).where({ relatedCount: { gte: 5 } }).limit(10)
```

## $close

Call `$clone` to end a database connection:

```ts
await db.$close()
```

## raw

Since column types can be customized when creating a base table, use the `raw` method from the `db.table` and it will have customized types:

```ts
const result = await db.someTable.select({
  rawValue: db.someTable.raw((t) => t.customTime(), 'sql')
})
```

For simplicity, when the `raw` is used in `where` or another method which doesn't affect on resulting type, you can import it from `pqb`:

```ts
import { raw } from 'pqb'

const result = await db.someTable.where(
  raw('a = $a AND b = $b', {
    a: 123,
    b: 'text'
  })
)
```

Read more about raw in a [query builder](/guide/query-builder#raw) document.
