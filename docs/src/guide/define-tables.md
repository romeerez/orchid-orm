---
description: Defining tables, table configuration options, and type inference helpers like Selectable, Insertable, Updatable.
---

# Define Tables

## define table

Table definitions are similar to Models or Entities in other ORMs.
The key difference is that Model/Entity is meant to also contain business logic,
while a table in OrchidORM is only meant for configuring a database table columns, relations, [softDelete](/guide/soft-delete),
[query hooks](/guide/hooks#lifecycle-hooks) (aka callbacks), so to define the database table and querying specifics, but not for app logic.

```ts
import { defineTable, sql } from './table-factory';
import { PostTable } from './post.table';
import { SubscriptionTable } from './subscription.table';

export const UserTable = defineTable(
  'user',
  {
    // The comment will be persisted to database's table metadata.
    comment: 'this is a table for storing users',

    // If you don't define a primary key, OrchidORM will remind you about it with an error.
    // Set `noPrimaryKey: true` if you really want a table without a primary key.
    noPrimaryKey: true,

    // You can set `snakeCase` for all tables in `createTableFactory`,
    // or you can enable it for an individual table.
    snakeCase: true,

    // For full text search: 'english' is the default, you can set it to other language.
    language: 'spanish',

    // Type-level read-only table.
    readOnly: true,
  },
  (t) => ({
    id: t.uuid().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
    username: t.string().unique(),
    email: t.string().email().unique(),
    deletedAt: t.timestamp().nullable(),
    subscriptionProvider: t.enum('paymentProvider', ['stripe', 'paypal']),
    subscriptionId: t.uuid(),
    startDate: t.timestamp(),
    endDate: t.timestamp(),
    ...t.timestamps(),
  }),
)
  // For "soft delete" functionality:
  .softDelete()
  // composite primary key
  .primaryKey(['firstName', 'lastName'])
  // composite unique index
  .unique(['subscriptionProvider', 'subscriptionId'])
  // composite foreign key
  .foreignKey(
    ['subscriptionProvider', 'subscriptionId'],
    () => SubscriptionTable,
    ['provider', 'id'],
  )
  // postgres `EXCLUDE` constraint: do not let the timeranges of different rows overlap
  .exclude([{ expression: `tstzrange("startDate", "endDate")`, with: '&&' }])
  // database-level check
  .check(sql`username != email`)
  // To define "virtual" columns that will be computed on a database side with a custom SQL
  .computed({
    fullName: (q) =>
      sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
        (t) => t.string(),
      ),
  })
  // The `default` scope will be applied to all queries,
  // you can define additional scopes to use them when building queries.
  .scopes({
    default: (q) => q.where({ hidden: false }),
    active: (q) => q.where({ active: true }),
  })
  .relations((user) => ({
    posts: user('id').hasMany(() => PostTable('authorId')),
  }));
```

- for configuring columns see [Columns schema overview](/guide/columns-overview).
- documentation for composite primary keys, indexes, exclusions, foreign keys, is residing in [migration column methods](/guide/migration-column-methods)
- for defining table's relations see [Modeling relations](/guide/relations).
- check out [soft delete](/guide/soft-delete)
- for `computed` see [Computed columns](/guide/computed-columns).
- for `scopes` see [Scopes](/guide/scopes).

All table files must be linked into `orchidORM` instance, as was shown above in the [setup](/guide/orm-setup#setup) section.

When trying OrchidORM on an existing project that already has a database with tables,
you can run a command to generate code for tables and a migration for it by running [db pull](/guide/migration-commands#pull).

## nameInDb

The first argument of `defineTable` is the query-facing table alias.
It is used for the TypeScript query API, including qualified column names such as `'user.firstName'`.
By default, it is also used as the database table name.

Set `nameInDb` when the table has a different name in the database:

```ts
export const UserTable = defineTable(
  'user',
  { nameInDb: 'app_users' },
  (t) => ({
    id: t.identity().primaryKey(),
    firstName: t.text(),
  }),
);

await db.user.select('user.firstName');
// SELECT "user"."firstName" FROM "app_users" "user"
```

When `snakeCase` is enabled and `nameInDb` is not set, Orchid derives the database table name from the table alias:

```ts
export const { defineTable } = createTableFactory({
  snakeCase: true,
});

export const UserProfileTable = defineTable('userProfile', (t) => ({
  id: t.identity().primaryKey(),
  firstName: t.text(),
}));

await db.userProfile.select('userProfile.firstName');
// SELECT "userProfile"."first_name" FROM "user_profile" "userProfile"
```

An explicit `nameInDb` is used as-is and is not changed by `snakeCase`.
Use the existing [`schema`](#table-db-schema) property for schema qualification; `nameInDb` is only the relation name inside that schema.

## init

A table can define an `init` callback. It is called when a DB-aware ORM instance is created:
by `orchidORM` in the regular one-step setup, or by `makeOrchidOrmDb` in the split setup.

Use `init` when table setup needs the full ORM object, most commonly for configuring table [hooks](/guide/hooks).

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(),
})).init((orm: typeof db, hooks) => {
  hooks.beforeCreate(({ set }) => {
    set({ name: 'new user' });
  });
});
```

## table db schema

The schema can be overridden in table options:

```ts
export const UserTable = defineTable(
  'user',
  { schema: 'customSchema' },
  (t) => ({
    id: t.identity().primaryKey(),
  }),
);

// schema also supports a function:
export const TenantUserTable = defineTable(
  'user',
  { schema: () => tenantManager.getStore().currentSchema },
  (t) => ({
    id: t.identity().primaryKey(),
  }),
);
```

`schema` can also be a default of `createTableFactory` or a helper derived with
`defineTable.extend`. A `schema` provided in a table's options always takes
precedence over that default.

[$withOptions](/guide/orm-setup#withoptions) allows to run queries with a given schema, but only if the schema wasn't set as shown above.

## snakeCase

`snakeCase` can be overridden for a table:

```ts
import { defineTable } from './table-factory';

export const SnakeCaseTable = defineTable(
  'table',
  { snakeCase: true },
  (t) => ({
    // snake_column in db
    snakeColumn: t.text(),
  }),
);
```

## noPrimaryKey

All tables should have a primary key. Even if it is a join table, it should have a composite primary key consisting of foreign key columns.

If you forgot to define a primary key, ORM will send a friendly remained by throwing an error.

Disable the check for a specific table by setting `noPrimaryKey` option:

```ts
import { defineTable } from './table-factory';

export const NoPrimaryKeyTable = defineTable(
  'table',
  { noPrimaryKey: true },
  (t) => ({
    // ...no primary key defined
  }),
);
```

Primary key presence checks are on by default. See [noPrimaryKey in ORM setup](/guide/orm-setup#noPrimaryKey) for global configuration options.

For function-style tables, `createTableFactory` can make `noPrimaryKey` a
factory default. Set `noPrimaryKey: false` in a table's options to keep the
check for a table that overrides an inherited `true` default.

## generatorIgnore

Set `generatorIgnore: true` to keep a table available for queries while
excluding it from generated migration DDL reconciliation. Function-style table
factories can set this as a default for their tables. Set
`generatorIgnore: false` on a table to opt it back into migration generation
when the factory default is `true`.

See [generatorIgnore](/guide/generate-migrations#generatorignore) for details.

## readOnly tables

Set `readOnly: true` in table options to keep read queries available and make mutation methods unavailable at the TypeScript level.

```ts
import { defineTable } from './table-factory';

export const ReportTable = defineTable('report', { readOnly: true }, (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(),
}));

await db.report.where({ id: 1 }).select('name');

await db.report.create({ name: 'new report' }); // TypeScript error
await db.report.find(1).update({ name: 'changed' }); // TypeScript error
await db.report.find(1).delete(); // TypeScript error
```

Tables are writable by default. Only the literal `true` enables this behavior.

`readOnly` is a TypeScript API restriction for queries. It does not change migration generation, generated SQL, or database permissions.

This is different from column-level [readOnly()](/guide/common-column-methods#readonly), which forbids assigning a specific column in `create` and `update` data.

## Infer table types

### Selectable

`Selectable` represents a record type returned from a database and parsed with [column parsers](/guide/common-column-methods#parse).

For instance, when using `asDate` for a [timestamp](/guide/columns-types#date-and-time) column, `Selectable` will have `Date` type for this column.

It contains all the columns including the ones marked with [select(false)](/guide/common-column-methods.html#exclude-from-select),
as well as [Computed columns](/guide/computed-columns).

```ts
import { Selectable } from 'orchid-orm';

export type User = Selectable<typeof UserTable>;
```

### DefaultSelect

`DefaultSelect` is for table types returned from a database, with respect for column parsers, limited only to columns selected by default.

It does not include [select(false)](/guide/common-column-methods.html#exclude-from-select) columns, as well as [Computed columns](/guide/computed-columns).

```ts
import { DefaultSelect } from 'orchid-orm';

export type UserDefault = DefaultSelect<typeof UserTable>;
```

### Insertable

`Insertable` types an object you can create a new record with.

Column type may be changed by [encode](/guide/common-column-methods#encode) function.

`Insertable` type for timestamp column is a union `string | number | Date`.

```ts
import { Insertable } from 'orchid-orm';

export type UserNew = Insertable<typeof UserTable>;
```

### Updatable

`Updatable` is the same as `Insertable` but all fields are optional.

```ts
import { Updatable } from 'orchid-orm';

export type UserUpdate = Updatable<typeof UserTable>;
```

### Queryable

`Queryable`: disregarding if [parse](/guide/common-column-methods#parse) or [encode](/guide/common-column-methods#encode) functions are specified for the column,
types that are accepted by `where` and other query methods remains the same.

Use this type to accept data for querying a table.

```ts
import { Queryable } from 'orchid-orm';

export type UserQueryable = Queryable<typeof UserTable>;
```
