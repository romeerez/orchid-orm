---
description: Using the pqb query builder as a standalone tool without the full ORM.
---

# Standalone query builder

If you'd like to use the query builder of OrchidORM as a standalone tool, install `pqb` package and use `createDb` to initialize it.

As `Orchid ORM` focuses on ORM usage, docs examples mostly demonstrates how to work with ORM-defined tables,
but everything that's not related to table relations should also work with `pqb` query builder on its own.

It is accepting the same options as `orchidORM` + options of `createBaseTable`:

```ts
// for porsager/postgres driver:
import { createDb } from 'pqb/postgres-js';
// for node-postgres driver:
import { createDb } from 'pqb/node-postgres';

import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
// or
import { SchemaConfig } from 'orchid-orm-valibot';

const db = createDb({
  // ORM configuration options
  databaseURL: process.env.DATABASE_URL,
  log: true,

  // columns in db are in snake case:
  snakeCase: true,

  // override default SQL for timestamp, see `nowSQL` above
  nowSQL: `now() AT TIME ZONE 'UTC'`,

  // optional, but recommended: makes zod schemas for your tables
  schemaConfig: zodSchemaConfig,
  // or
  schemaConfig: valibotSchemaConfig,

  // override column types:
  columnTypes: (t) => ({
    // by default timestamp is returned as a string, override to a number
    timestamp: () => t.timestamp().asNumber(),
  }),
});
```

After `db` is defined, construct queryable tables in such way:

```ts
export const User = db('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.string(),
  age: t.integer().nullable(),
  ...t.timestamps(),
}));
```

Now the `User` can be used for making type-safe queries:

```ts
const users = await User.select('id', 'name') // only known columns are allowed
  .where({ age: { gte: 20 } }) // gte is available only on the numeric field, and the only number is allowed
  .order({ createdAt: 'DESC' }) // type safe as well
  .limit(10);

// users array has a proper type of Array<{ id: number, name: string }>
```

The optional third argument is for table options:

```ts
const Table = db('table', (t) => ({ ...columns }), {
  // provide this value if the table belongs to a specific database schema:
  schema: 'customTableSchema',
  // override `log` option of `createDb`:
  log: true, // boolean or object described `createdDb` section
  logger: { ... }, // override logger
  noPrimaryKey: 'ignore', // override noPrimaryKey
  snakeCase: true, // override snakeCase
})
```
