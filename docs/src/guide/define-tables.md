---
description: Defining tables, table configuration options, and type inference helpers like Selectable, Insertable, Updatable.
---

# Define Tables

## define table

Table classes are similar to Models or Entities in other ORMs.
The key difference is that Model/Entity is meant to also contain business logic,
while a table in OrchidORM is only meant for configuring a database table columns, relations, [softDelete](/guide/soft-delete),
[query hooks](/guide/hooks#lifecycle-hooks) (aka callbacks), so to define the database table and querying specifics, but not for app logic.

```ts
import { BaseTable, sql } from './base-table';
import { PostTable } from './post.table';
import { SubscriptionTable } from './subscription.table';

export class UserTable extends BaseTable {
  // `readonly` is needed for TS to remember the string literal.
  readonly table = 'user';

  // The comment will be persisted to database's table metadata.
  comment = 'this is a table for storing users';

  // If you don't define a primary key, OrchidORM will remind you about it with an error,
  // Set `noPrimaryKey = true` if you really want a table without a primary key.
  noPrimaryKey = true;

  // You can set `snakeCase` for all tables in the `BaseTable`,
  // or you can enable it for an individual table.
  snakeCase = true;

  // For full text search: 'english' is the default, you can set it to other langauge
  language = 'spanish';

  // For "soft delete" functionality
  readonly softDelete = true; // or a string with a column name

  columns = this.setColumns(
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
    // The second function is optional, it is for composite primary keys, indexes, etc.
    // For a single thing no need to wrap it in array:
    // (t) => t.index(['role', 'deletedAt']),
    // For multiple things, return array:
    (t) => [
      // composite primary key
      t.primaryKey(['firstName', 'lastName']),
      // composite unique index
      t.unique(['subscriptionProvider', 'subscriptionId']),
      // composite foreign key
      t.foreignKey(
        ['subscriptionProvider', 'subscriptionId'],
        () => SubscriptionTable,
        ['provider', 'id'],
      ),
      // postgres `EXCLUDE` constraint: do not let the timeranges of different rows to overlap
      t.exclude([
        { expression: `tstzrange("startDate", "endDate")`, with: '&&' },
      ]),
      // database-level check
      t.check(sql`username != email`),
    ],
  );

  // To define "virtual" columns that will be computed on a database side with a custom SQL
  computed = this.setComputed({
    fullName: (q) =>
      sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
        (t) => t.string(),
      ),
  });

  // The `defaut` scope will be applied to all queries,
  // you can define additional scopes to use them when building queries.
  scopes = this.setScopes({
    default: (q) => q.where({ hidden: false }),
    active: (q) => q.where({ active: true }),
  });

  relations = {
    posts: this.hasMany(() => PostTable, {
      columns: ['id'],
      references: ['authorId'],
    }),
  };
}
```

- `table` and `softDelete` must be readonly for TS to recognize them properly, other properties don't have to be readonly.
- for configuring columns see [Columns schema overview](/guide/columns-overview).
- documentation for composite primary keys, indexes, exclusions, foreign keys, is residing in [migration column methods](/guide/migration-column-methods)
- for defining table's relations see [Modeling relations](/guide/relations).
- check out [soft delete](/guide/soft-delete)
- for `computed` see [Computed columns](/guide/computed-columns).
- for `scopes` see [Scopes](/guide/scopes).

All table files must be linked into `orchidORM` instance, as was shown above in the [setup](/guide/orm-setup#setup) section.

When trying OrchidORM on an existing project that already has a database with tables,
you can run a command to generate code for tables and a migration for it by running [db pull](/guide/migration-commands#pull).

## table db schema

The schema can be overridden in a table class:

```ts
class UserTable extends BaseTable {
  schema = 'customSchema';
  // also supports a function:
  schema = () => tenantManager.getStore().currentSchema;
}
```

[$withOptions](/guide/orm-setup#withoptions) allows to run queries with a given schema, but only if the schema wasn't set as shown above.

## snakeCase

`snakeCase` can be overridden for a table:

```ts
import { BaseTable } from './base-table';

export class SnakeCaseTable extends BaseTable {
  readonly table = 'table';
  // override snakeCase:
  snakeCase = true;
  columns = this.setColumns((t) => ({
    // snake_column in db
    snakeColumn: t.text(),
  }));
}
```

## noPrimaryKey

All tables should have a primary key. Even if it is a join table, it should have a composite primary key consisting of foreign key columns.

If you forgot to define a primary key, ORM will send a friendly remained by throwing an error.

Disable the check for a specific table by setting `noPrimaryKey` property:

```ts
import { BaseTable } from './base-table';

export class NoPrimaryKeyTable extends BaseTable {
  readonly table = 'table';
  noPrimaryKey = true; // set to `true` to ignore absence of primary key
  columns = this.setColumns((t) => ({
    // ...no primary key defined
  }));
}
```

Primary key presence checks are on by default. See [noPrimaryKey in ORM setup](/guide/orm-setup#noPrimaryKey) for global configuration options.

## Infer table types

### Selectable

`Selectable` represents a record type returned from a database and parsed with [column parsers](/guide/common-column-methods#parse).

For instance, when using `asDate` for a [timestamp](/guide/columns-types#date-and-time) column, `Selectable` will have `Date` type for this column.

It contains all the columns including the ones marked with [select(false)](/guide/common-column-methods.html#exclude-from-select),
as well as [Computed columns](/guide/computed-columns).

```ts
import { Selectable } from 'orchid-orm';

export type User = Selectable<UserTable>;
```

### DefaultSelect

`DefaultSelect` is for table types returned from a database, with respect for column parsers, limited only to columns selected by default.

It does not include [select(false)](/guide/common-column-methods.html#exclude-from-select) columns, as well as [Computed columns](/guide/computed-columns).

```ts
import { DefaultSelect } from 'orchid-orm';

export type UserDefault = DefaultSelect<UserTable>;
```

### Insertable

`Insertable` types an object you can create a new record with.

Column type may be changed by [encode](/guide/common-column-methods#encode) function.

`Insertable` type for timestamp column is a union `string | number | Date`.

```ts
import { Insertable } from 'orchid-orm';

export type UserNew = Insertable<UserTable>;
```

### Updatable

`Updatable` is the same as `Insertable` but all fields are optional.

```ts
import { Updatable } from 'orchid-orm';

export type UserUpdate = Updatable<UserTable>;
```

### Queryable

`Queryable`: disregarding if [parse](/guide/common-column-methods#parse) or [encode](/guide/common-column-methods#encode) functions are specified for the column,
types that are accepted by `where` and other query methods remains the same.

Use this type to accept data for querying a table.

```ts
import { Queryable } from 'orchid-orm';

export type UserQueryable = Queryable<UserTable>;
```
