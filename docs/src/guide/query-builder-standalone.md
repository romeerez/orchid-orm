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
// for Bun SQL driver:
import { createDb } from 'pqb/bun';

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

The optional fourth argument is for table options.
Pass `undefined` as the third argument when you do not need composite primary keys, indexes, or other table metadata:

```ts
const Table = db('table', (t) => ({ ...columns }), undefined, {
  // provide this value if the table belongs to a specific database schema:
  schema: 'customTableSchema',
  // override `log` option of `createDb`:
  log: true, // boolean or object described `createdDb` section
  logger: { ... }, // override logger
  noPrimaryKey: 'ignore', // override noPrimaryKey
  snakeCase: true, // override snakeCase
})
```

## table name in db

The table name passed as the first `db` argument is the query-facing table alias.
It is used for query typing and qualified column names.
By default, it is also used as the database table name.

When `snakeCase` is enabled and `nameInDb` is not set, Orchid derives the database table name from the alias:

```ts
const db = createDb({
  databaseURL: process.env.DATABASE_URL,
  snakeCase: true,
});

const UserProfile = db('userProfile', (t) => ({
  id: t.identity().primaryKey(),
  firstName: t.text(),
}));

await UserProfile.select('userProfile.firstName');
// SELECT "userProfile"."first_name" FROM "user_profile" "userProfile"
```

Set `nameInDb` when the physical table has a different name:

```ts
const User = db(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    firstName: t.text(),
  }),
  undefined,
  { nameInDb: 'app_users' },
);

await User.select('user.firstName');
// SELECT "user"."firstName" FROM "app_users" "user"
```

An explicit `nameInDb` is used as-is and is not changed by `snakeCase`.
Use the existing `schema` table option for schema qualification; `nameInDb` is only the relation name inside that schema.
