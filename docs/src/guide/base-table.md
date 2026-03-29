---
description: Creating and configuring the Base Table with snakeCase, autoForeignKeys, nowSQL options and custom column types.
---

# Base Table

## define base table

Define a base table class to extend from, this code should be separated from the `db` file:

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable();

export const { sql } = BaseTable;
```

`sql` is exported here because this way it can be linked with custom columns defined in the `BaseTable`.

Optionally, you can customize column types behavior here for all future tables:

```ts
import { createBaseTable } from 'orchid-orm';
// optionally, use one of the following validation integrations:
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { valibotSchemaConfig } from 'orchid-orm-valibot';

export const BaseTable = createBaseTable({
  // set to true if columns in database are in snake_case
  snakeCase: true,

  // optional, but recommended: derive and use validation schemas from your tables
  schemaConfig: zodSchemaConfig,
  // or
  schemaConfig: valibotSchemaConfig,

  columnTypes: (t) => ({
    // by default timestamp is returned as a string, override to a Data
    timestamp: () => t.timestamp().asDate(),

    // define custom types in one place inside BaseTable to use them later in tables
    myEnum: () => t.enum('myEnum', ['one', 'two', 'three']),
  }),
});

export const { sql } = BaseTable;
```

See [override column types](/guide/columns-overview#override-column-types) for details of customizing columns.

Tables are defined as classes `table` and `columns` required properties:

`table` is a table name and `columns` is for defining table column types (see [Columns schema](/guide/columns-overview) document for details).

Note that the `table` property is marked as `readonly`, this is needed for TypeScript to check the usage of the table in queries.

```ts
import { Selectable, DefaultSelect, Insertable, Updatable } from 'orchid-orm';
// import BaseTable from a file from the previous step:
import { BaseTable } from './base-table';

// export types of User for various use-cases:
export type User = Selectable<UserTable>;
export type UserDefault = DefaultSelect<UserTable>;
export type UserNew = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string(),
    ...t.timestamps(),
  }));
}
```

## snakeCase

By default, all column names are expected to be named in camelCase.

If only some columns are named in snake_case, you can use `name` method to indicate it:

```ts
import { BaseTable } from './base-table';

class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    camelCase: t.integer(),
    snakeCase: t.name('snake_case').integer(),
  }));
}

// all columns are available by a camelCase name,
// even though `snakeCase` has a diferent name in the database
const records = await table.select('camelCase', 'snakeCase');
```

Set `snakeCase` to `true` if you want all columns to be translated automatically into a snake_case.

Column name can still be overridden with a `name` method.

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  snakeCase: true,
});

class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    // camelCase column requires an explicit name
    camelCase: t.name('camelCase').integer(),
    // snakeCase is snakerized automatically when generating SQL
    snakeCase: t.integer(),
  }));
}

// result is the same as before
const records = await table.select('camelCase', 'snakeCase');
```

## autoForeignKeys

In general, it's a good practice to always define database-level foreign keys between related tables,
so the database guarantees data integrity, and a record cannot mistakenly have an id of a record that does not exist.

Adding `autoForeignKeys: true` option to `createBaseTable` will automatically generate foreign keys based on defined relations (in the case you're using migration generator).

You can provide foreign key options instead of `true` to be used by all auto-generated foreign keys.

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  autoForeignKeys: true, // with default options

  // or, you can provide custom options
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
import { BaseTable } from './base-table';

export class MyTable extends BaseTable {
  autoForeignKey = false; // disable only for this table
  autoForeignKey = { onUpdate: 'RESTRICT' }; // or, override options only for this table
}
```

Auto foreign keys can also be enabled, disabled, overridden for a concrete relation:

```ts
import { BaseTable } from './base-table';

export class MyTable extends BaseTable {
  relations = {
    btRel: this.belongsTo(() => OtherTable, {
      columns: ['otherId'],
      references: ['id'],

      // disable for this relation
      foreignKey: false,
      // or, customize options for this relation
      foreignKey: {
        onUpdate: 'RESTRICT',
      },
    }),

    habtmRel: this.hasAndBelongsToMany(() => OtherTable, {
      columns: ['id'],
      references: ['myId'],

      // disable foreign key from the join table to this table
      foreignKey: false,

      through: {
        table: 'joinTable',
        columns: ['otherId'],
        references: ['id'],

        // customize foreign key from the join table to the other table
        foreignKey: {
          onUpdate: 'RESTRICT',
        },
      },
    }),
  };
}
```

## nowSQL

For the specific case you can use `nowSQL` option to specify SQL to override the default value of `timestamps()` method.

If you're using `timestamp` and not `timestampNoTZ` there is no problem,
or if you're using `timestampNoTZ` in a database where time zone is UTC there is also no problem,
but if you're using `timestampNoTZ` in a database with a different time zone,
and you still want `updatedAt` and `createdAt` columns to automatically be saved with a current time in UTC,
you can specify the `nowSQL` for the base table:

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  nowSQL: `now() AT TIME ZONE 'UTC'`,

  // ...other options
});
```
