---
description: Creating and configuring a table factory with snakeCase, autoForeignKeys, nowSQL options, and custom column types.
---

# Table Factory

If you're currently using the class-based based table design, [follow this doc](/guide/migrate-to-new-table-design) to migrate to the new function-style design.

## define table factory

Define a shared table factory separately from the `db` file. It provides the
`defineTable`, `defineView`, and `sql` helpers used by table, view, migration,
and raw SQL examples:

```ts
import { createTableFactory } from 'orchid-orm';

export const { defineTable, defineView, sql } = createTableFactory();
```

`sql` is exported here because this way it can be linked with custom columns
defined in the table factory.

Optionally, you can customize column types behavior here for all future tables:

```ts
import { createTableFactory } from 'orchid-orm';
// optionally, use one of the following validation integrations:
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { valibotSchemaConfig } from 'orchid-orm-valibot';

export const { defineTable, defineView, sql } = createTableFactory({
  // set to true if tables and columns in database are in snake_case
  snakeCase: true,

  // optional, but recommended: derive and use validation schemas from your tables
  schemaConfig: zodSchemaConfig,
  // or
  schemaConfig: valibotSchemaConfig,

  columnTypes: (t) => ({
    // by default timestamp is returned as a string, override to a Date
    timestamp: () => t.timestamp().asDate(),

    // define custom types in one place to use them later in tables
    myEnum: () => t.enum('myEnum', ['one', 'two', 'three']),
  }),
});
```

See [override column types](/guide/columns-overview#override-column-types) for details of customizing columns.

When using the `node-postgres` or `bun` adapters, set the `schemaConfig`
imported from the corresponding adapter. Nothing is needed when using
`postgres-js`.

Different Postgres drivers have different column type parsing behavior and
restrictions, and this adjusts how OrchidORM column types encode and parse
certain column types.

```ts
import { createTableFactory } from 'orchid-orm';
import { nodePostgresSchemaConfig } from 'pqb/node-postgres';
import { bunSchemaConfig } from 'orchid-orm/bun';

export const { defineTable, defineView, sql } = createTableFactory({
  // for node-postgres
  schemaConfig: nodePostgresSchemaConfig,
  // for bun
  schemaConfig: bunSchemaConfig,
});
```

Tables are exported constants created with `defineTable`.

The first argument is a table name for queries. The columns callback defines
table column types. See [Columns schema](/guide/columns-overview) for details.

```ts
import { Selectable, DefaultSelect, Insertable, Updatable } from 'orchid-orm';
import { defineTable } from './table-factory';

export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.string(),
  ...t.timestamps(),
}));

// export types of User for various use-cases:
export type User = Selectable<typeof UserTable>;
export type UserDefault = DefaultSelect<typeof UserTable>;
export type UserNew = Insertable<typeof UserTable>;
export type UserUpdate = Updatable<typeof UserTable>;
```

## snakeCase

By default, table names and column names are expected to match the names used in TypeScript.

If only some columns are named in snake_case, you can use `name` method to indicate it:

```ts
import { defineTable } from './table-factory';

export const Table = defineTable('table', (t) => ({
  id: t.identity().primaryKey(),
  camelCase: t.integer(),
  snakeCase: t.name('snake_case').integer(),
}));

// all columns are available by a camelCase name,
// even though `snakeCase` has a different name in the database
const records = await table.select('camelCase', 'snakeCase');
```

Set `snakeCase` to `true` if you want table names and column names to be translated automatically into snake_case.

For tables and views, `snakeCase` changes the default database relation name stored as `nameInDb`.
The name passed to `defineTable` or `defineView` remains a query-facing alias.
Set [`nameInDb`](/guide/define-tables#nameindb) explicitly when the database table name should not be derived from the alias.

Column name can still be overridden with a `name` method.

```ts
import { createTableFactory } from 'orchid-orm';

export const { defineTable } = createTableFactory({
  snakeCase: true,
});

export const ProfileTable = defineTable('userProfile', (t) => ({
  id: t.identity().primaryKey(),
  // camelCase column requires an explicit name
  camelCase: t.name('camelCase').integer(),
  // snakeCase is snakerized automatically when generating SQL
  snakeCase: t.integer(),
}));

// result is the same as before
const records = await db.profile.select('camelCase', 'snakeCase');
```

## autoForeignKeys

In general, it's a good practice to always define database-level foreign keys between related tables,
so the database guarantees data integrity, and a record cannot mistakenly have an id of a record that does not exist.

Adding `autoForeignKeys: true` option to `createTableFactory` will automatically generate foreign keys based on defined relations (in the case you're using migration generator).

You can provide foreign key options instead of `true` to be used by all auto-generated foreign keys.

```ts
import { createTableFactory } from 'orchid-orm';

export const { defineTable, defineView, sql } = createTableFactory({
  autoForeignKeys: true, // with default options
});

// or, you can provide custom options
export const tableFactory = createTableFactory({
  autoForeignKeys: {
    // all fields are optional
    match: 'FULL', // 'SIMPLE' by default, can be 'FULL', 'PARTIAL', 'SIMPLE'.
    onUpdate: 'CASCADE', // 'NO ACTION' by default, can be 'NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'.
    onDelete: 'CASCADE', // same as `onUpdate`.
    dropMode: 'CASCADE', // for the down migration, 'RESTRICT' is the default, can be 'CASCADE' or 'RESTRICT'.
  },
});
```

When this is enabled, you can disable it for a specific table.
And when this is disabled globally, you can enable it only for a specific table in the same way.

```ts
import { defineTable } from './table-factory';

export const MyTable = defineTable(
  'myTable',
  { autoForeignKeys: false },
  (t) => ({
    id: t.identity().primaryKey(),
  }),
);

// or, override options only for this table:
export const MyOtherTable = defineTable(
  'myOtherTable',
  { autoForeignKeys: { onUpdate: 'RESTRICT' } },
  (t) => ({
    id: t.identity().primaryKey(),
  }),
);
```

Auto foreign keys can also be enabled, disabled, or overridden for a concrete relation:

```ts
import { defineTable } from './table-factory';

export const MyTable = defineTable('myTable', (t) => ({
  id: t.identity().primaryKey(),
  otherId: t.integer(),
})).relations((myTable) => ({
  btRel: myTable('otherId')
    .belongsTo(() => OtherTable('id'))
    // disable for this relation:
    .foreignKey(false),

  btRelWithOptions: myTable('otherId')
    .belongsTo(() => OtherTable('id'))
    // or, customize options for this relation:
    .foreignKey({
      onUpdate: 'RESTRICT',
    }),

  habtmRel: myTable('id')
    .hasAndBelongsToMany(() => OtherTable('id'))
    .through('joinTable', 'myId', 'otherId')
    // for hasAndBelongsToMany, foreignKey configures database foreign keys
    // from the join table to this table and to the related table.
    .foreignKey({
      forThisTable: false,
      forRelatedTable: { onUpdate: 'RESTRICT' },
    }),
}));
```

## nowSQL

For the specific case you can use `nowSQL` option to specify SQL to override the default value of `timestamps()` method.

If you're using `timestamp` and not `timestampNoTZ` there is no problem,
or if you're using `timestampNoTZ` in a database where time zone is UTC there is also no problem,
but if you're using `timestampNoTZ` in a database with a different time zone,
and you still want `updatedAt` and `createdAt` columns to automatically be saved with a current time in UTC,
you can specify the `nowSQL` for the table factory:

```ts
import { createTableFactory } from 'orchid-orm';

export const { defineTable, defineView, sql } = createTableFactory({
  nowSQL: `now() AT TIME ZONE 'UTC'`,

  // ...other options
});
```
