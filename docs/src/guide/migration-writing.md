---
outline: deep
description: Writing migrations with the change function, creating and dropping tables, columns, enums, and schemas.
---

# Writing a migration

All column names will be translated to snake_case if `snakeCase` option is set to true in `rakeDb` options.

Use a `change` function for changing the database schema, it accepts a callback with `db` and optionally you can use a second argument `up` to know if it is an up migration or down.

```ts
import { change } from '../db-script';

change(async (db, up) => {
  if (up) {
    console.log('migrate is called');
  } else {
    console.log('rollback is called');
  }
});
```

A single migration file can have multiple `change`s.

It's useful when creating a database schema or enum, and then creating a table that depends on it.

When migrating, `change`s are executed from top to bottom, so the schema and the enum will be created before the table.

On rollback, `change`s are executed from bottom to top, so the schema and the enum will be dropped **after** the table that is using them.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createSchema('custom');
  await db.createEnum('yearSeason', ['spring', 'summer', 'fall', 'winter']);
});

change(async (db) => {
  await db.createTable('custom.table', (t) => ({
    id: t.identity().primaryKey(),
    season: t.enum('yearSeason'),
  }));
});
```

`db` is an extended query builder, so it has [all the same methods](/guide/query-methods) as a query builder and additional specific methods such as `createTable`, `changeTable`, and others.

Example of creating a table and populating it with values:

```ts
import { change } from '../src';

change(async (db, up) => {
  const { table } = await db.createTable('languages', (t) => ({
    id: t.identity().primaryKey(),
    // `string` is a varchar with a limit 255 by default.
    name: t.string().unique(),
    code: t.string().unique(),
  }));

  // it's important to use this `up` check to not run the queries on rollback
  if (up) {
    // TS knows the column types, so this will be type-checked:
    await table.createMany([
      { name: 'Ukrainian', code: 'ua' },
      { name: 'English', code: 'en' },
      { name: 'Polish', code: 'pl' },
      { name: 'Belarusian', code: 'be' },
      { name: 'French', code: 'fr' },
    ]);

    // use db.query to perform raw SQL queries
    const language = 'Ukrainian';
    const { rows } = await db.query`
      SELECT * FROM languages WHERE name = ${language}
    `;
    console.log(rows);
  }
});
```

## default export

In some setups it may be required to load multiple migrations first, and execute them later.

The problem is, `rakeDb` wouldn't know which db changes belong to which migration files, and you need to do default exports to solve it:

```ts
import { change } from '../src';

export default change(async (db, up) => {
  const { table } = await db.createTable('table', (t) => ({
    // ...
  }));
});
```

If there are multiple changes in the same file, `export default` an array:

```ts
import { change } from '../src';

export default [
  change(async (db, up) => {
    // change 1
  }),
  change(async (db, up) => {
    // change 2
  }),
];
```

To accidentally not forgot to write a default export, set `forceDefaultExports` to `true` in a `rakeDb` config.

## createTable, dropTable

[//]: # 'has JSDoc'

`createTable` accepts a string for a table name, optional options, and a callback to specify columns.

`dropTable` accepts the same arguments, it will drop the table when migrating and create a table when rolling back.

To create an empty table, the callback with columns may be omitted.

When creating a table within a specific schema, write the table name with schema name: `'schemaName.tableName'`.

Returns object `{ table: TableInterface }` that allows to insert records right after creating a table.

Options are:

```ts
type TableOptions = {
  // create the table only if it not exists already
  createIfNotExists?: boolean;

  // drop the table only if it exists
  dropIfExists?: boolean;

  // used when reverting a `createTable`
  dropMode?: 'CASCADE' | 'RESTRICT';

  // add a database comment on the table
  comment?: string;

  // by default, it will throw an error when the table has no primary key
  // set `noPrimaryKey` to `true` to bypass it
  noPrimaryKey?: boolean;

  // override rakeDb `snakeCase` option for only this table
  snakeCase?: boolean;
};
```

Example:

```ts
import { change } from '../db-script';

change(async (db, up) => {
  // call `createTable` with options
  await db.createTable(
    'table',
    {
      comment: 'Table comment',
      dropMode: 'CASCADE',
      noPrimaryKey: true,
    },
    (t) => ({
      // ...
    }),
  );

  // call without options
  const { table } = await db.createTable('user', (t) => ({
    id: t.identity().primaryKey(),
    email: t.text().unique(),
    name: t.text(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));

  // create records only when migrating up
  if (up) {
    // table is a db table interface, all query methods are available
    await table.createMany([...data]);
  }
});
```

## changeTable

[//]: # 'has JSDoc'

`changeTable` accepts a table name, optional options, and a special callback with column changes.

When changing a table within a specific schema, write the table name with schema name: `'schemaName.tableName'`.

Options are:

```ts
type ChangeTableOptions = {
  comment?:
    | // add a comment to the table on migrating, remove a comment on rollback
    string // change comment from first to second on migrating, from second to first on rollback
    | [string, string] // remove a comment on both migrate and rollback
    | null;

  // override rakeDb `snakeCase` option for only this table
  snakeCase?: boolean;
};
```

The callback of the `changeTable` is different from `createTable` in the way that it expects columns to be wrapped in change methods such as `add`, `drop`, and `change`.

### add, drop

`add` will add a column, or a standalone column/table item, on migrating and remove it on rollback.

`drop` will remove a column, or a standalone column/table item, on migrating and add it on rollback.

The column in `add` or `drop` can have all the same methods as when creating a table, such methods as `index`, `unique`, `exclude`, and `foreignKey`.

To add or drop an existing column's primary key, check, foreign key, index, unique index, or exclude constraint without adding or dropping the column itself, pass a standalone helper to `t.add` or `t.drop` under the column key.

Supports adding or dropping a composite primary key, foreign key, index, exclude - the same as when creating a table.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    // add column
    column1: t.add(t.text()),

    // remove column
    column2: t.drop(t.boolean()),

    // add or drop a primary key on an existing column
    column3: t.add(t.primaryKey('table_column3_pkey')),
    column4: t.drop(t.primaryKey('table_column4_pkey')),

    // add or drop a check on an existing column
    column5: t.add(t.check(t.sql`column5 > 5`, 'column5_check')),
    column6: t.drop(t.check(t.sql`column6 > 5`, 'column6_check')),

    // add or drop a foreign key on an existing column
    column7: t.add(
      t.foreignKey('otherTable', 'otherTableId', {
        name: 'column7ForeignKey',
      }),
    ),
    column8: t.drop(
      t.foreignKey('otherTable', 'otherTableId', {
        name: 'column8ForeignKey',
      }),
    ),

    // add or drop an index on an existing column
    column9: t.add(t.index({ name: 'column9Index' })),
    column10: t.drop(t.index({ name: 'column10Index' })),

    // add or drop a unique index on an existing column
    column11: t.add(
      t.unique({
        name: 'column11Unique',
        deferrable: 'immediate',
      }),
    ),
    column12: t.drop(t.unique({ name: 'column12Unique' })),

    // add or drop an EXCLUDE constraint on an existing column
    column13: t.add(t.exclude('&&', { name: 'column13Exclude' })),
    column14: t.drop(t.exclude('&&', { name: 'column14Exclude' })),

    // add composite primary key:
    ...t.add(t.primaryKey(['foo', 'bar'])),

    // drop composite primary key:
    ...t.drop(t.primaryKey(['foo', 'bar'])),

    // add composite index:
    ...t.add(t.index(['foo', 'bar'])),

    // drop composite index:
    ...t.drop(t.index(['foo', 'bar'])),

    // add composite unique index:
    ...t.add(
      t.unique(['foo', 'bar'], {
        name: 'fooBarUnique',
        deferrable: 'deferred',
      }),
    ),

    // drop composite unique index:
    ...t.drop(t.unique(['foo', 'bar'])),

    // add EXCLUDE constraint on two columns
    ...t.add(
      t.exclude(
        [
          { column: 'column1', with: '=' },
          { column: 'column2', with: '<>' },
        ],
        { using: 'GIST' },
      ),
    ),

    // drop EXCLUDE constraint on two columns
    ...t.drop(
      t.exclude(
        [
          { column: 'column1', with: '=' },
          { column: 'column2', with: '<>' },
        ],
        { name: 'tableExclude', using: 'GIST' },
      ),
    ),

    // add composite foreign key:
    ...t.add(
      t.foreignKey(['foo', 'bar'], 'otherTable', ['otherFoo', 'otherBar']),
    ),

    // drop composite foreign key:
    ...t.drop(
      t.foreignKey(['foo', 'bar'], 'otherTable', ['otherFoo', 'otherBar']),
    ),

    // add a table check
    ...t.add(t.check(t.sql`column3 > column4`)),

    // drop a table check
    ...t.drop(t.check(t.sql`column3 > column4`)),

    // add a constraint
    ...t.add(
      t.constraint({
        name: 'constraintName',
        check: t.sql`column3 < 20`,
        foreignKey: [['foo', 'bar'], 'otherTable', ['otherFoo', 'otherBar']],
      }),
    ),

    // add timestamps:
    ...t.add(t.timestamps()),
  }));
});
```

`t.add` in `changeTable` may be omitted:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    // add column when migrating up, drop it when migrating down
    column: t.text(),
  }));
});
```

### change

Takes two columns or standalone column helpers.
When migrating, it will change the column to the second element,
and when doing rollback will change the column to the first element.

When only changing an existing column's primary key, check, foreign key, index, unique index, or exclude constraint without changing the column type, use the standalone helper directly inside `t.change`.

Use `t.add(...)` and `t.drop(...)` for adding or removing standalone column items.

Dropping or creating a primary key on multiple columns is allowed with full-column changes.

Index options are listed [here](/guide/migration-column-methods#index).

Exclude constraint options are listed [here](/guide/migration-column-methods#exclude).

Foreign key options are listed [here](/guide/migration-column-methods#foreignkey).

Composite foreign keys continue to use the table-level
`t.foreignKey([...], ...)` syntax.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    // change column type from integer to varchar(255)
    column1: t.change(t.integer(), t.string()),

    // change column type using SQL expression to convert data
    column2: t.change(t.integer(), t.string(), {
      usingUp: t.sql`column2::text`,
      usingDown: t.sql`column2::integer`,
    }),

    // change column default
    column3: t.change(t.default(1), t.default(2)),

    // it's important to specify a column type (json)
    // when we want the value to be correctly serialized:
    // t.json().default([]) will be serialized with JSON.stringify,
    // t.default([]) won't.
    column4: t.change(t.json(), t.json().default([])),

    // change column default with raw SQL
    column5: t.change(t.default(t.sql`2 + 2`), t.default(t.sql`3 + 3`)),

    // change column to be nullable or non-nullable
    column6: t.change(t.nonNullable(), t.nullable()),
    column7: t.change(t.nullable(), t.nonNullable()),

    // change column comment
    column8: t.change(t.comment('from comment'), t.comment('to comment')),

    // change primary key
    column9: t.change(
      t.primaryKey('oldPrimaryKeyName'),
      t.primaryKey('newPrimaryKeyName'),
    ),

    // change check
    column10: t.change(
      t.check(t.sql`column10 > 5`, 'oldCheckName'),
      t.check(t.sql`column10 < 10`, 'newCheckName'),
    ),

    // change index
    column11: t.change(
      t.index({
        // index options to be applied when migrating down
        name: 'oldIndexName',
      }),
      t.index({
        // index options to be applied when migrating up
        name: 'newIndexName',
      }),
    ),

    // change unique index
    column12: t.change(
      t.unique({ name: 'oldUniqueName', deferrable: 'immediate' }),
      t.unique({ name: 'newUniqueName', deferrable: 'deferred' }),
    ),

    // change foreign key without repeating the column type
    column13: t.change(
      t.foreignKey('oneTable', 'oneColumn', {
        // foreign key options to be applied when migrating down
        name: 'oneForeignKeyName',
        match: 'PARTIAL',
        onUpdate: 'RESTRICT',
        onDelete: 'SET DEFAULT',
      }),
      t.foreignKey('otherTable', 'otherColumn', {
        // foreign key options to be applied when migrating up
        name: 'otherForeignKeyName',
        match: 'FULL',
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      }),
    ),

    // change exclude
    column14: t.change(
      t.exclude('=', {
        // exclude options to be applied when migrating down
        name: 'oldExcludeName',
      }),
      t.exclude('&&', {
        // exclude options to be applied when migrating up
        name: 'newExcludeName',
      }),
    ),

    // change various column properties at once
    column15: t.change(
      t
        .integer()
        .collate('de_DE')
        .default(123)
        .compression('pglz')
        .comment('from comment')
        .index({ name: 'oneIndexName' })
        .foreignKey('oneTable', 'oneColumn', {
          name: 'oneForeignKeyName',
        }),
      t
        .text()
        .collate('es_ES')
        .default('123')
        .compression('lz4')
        .comment('to comment')
        .nullable()
        .index({ name: 'otherIndexName' })
        .foreignKey('otherTable', 'otherColumn', {
          name: 'otherForeignKeyName',
        }),
    ),
  }));
});
```

### rename

[//]: # 'has JSDoc'

Rename a column:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    oldColumnName: t.rename('newColumnName'),
  }));
});
```

Note that the renaming `ALTER TABLE` is executed before the rest of alterations,
so if you're also adding a new constraint on this column inside the same `changeTable`,
refer to it with a new name.

## renameTable

[//]: # 'has JSDoc'

Rename a table:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameTable('oldTableName', 'newTableName');
});
```

Prefix table name with a schema to set a different schema:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameTable('fromSchema.oldTable', 'toSchema.newTable');
});
```

## changeTableSchema

[//]: # 'has JSDoc'

Set a different schema to the table:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.changeTableSchema('tableName', 'fromSchema', 'toSchema');
});
```

## addColumn, dropColumn

[//]: # 'has JSDoc'

Add a column to the table on migrating, and remove it on rollback.

`dropColumn` takes the same arguments, removes a column on migrate, and adds it on rollback.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.addColumn('tableName', 'columnName', (t) =>
    t.integer().index().nullable(),
  );
});
```

## addIndex, dropIndex

[//]: # 'has JSDoc'

Add an index to the table on migrating, and remove it on rollback.

`dropIndex` takes the same arguments, removes the index on migrate, and adds it on rollback.

The first argument is the table name, other arguments are the same as in [composite index](#composite-index).

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.addIndex(
    'tableName',
    ['column1', { column: 'column2', order: 'DESC' }],
    {
      name: 'indexName',
    },
  );
});
```

## renameIndex

[//]: # 'has JSDoc'

Rename index:

```ts
import { change } from '../db-script';

change(async (db) => {
  // tableName can be prefixed with a schema
  await db.renameIndex('tableName', 'oldIndexName', 'newIndexName');
});
```

## addForeignKey, dropForeignKey

[//]: # 'has JSDoc'

Add a foreign key to a table on migrating, and remove it on rollback.

`dropForeignKey` takes the same arguments, removes the foreign key on migrate, and adds it on rollback.

Arguments:

- table name
- column names in the table
- other table name
- column names in the other table
- options:
  - `name`: constraint name
  - `match`: 'FULL', 'PARTIAL', or 'SIMPLE'
  - `onUpdate` and `onDelete`: 'NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', or 'SET DEFAULT'

The first argument is the table name, other arguments are the same as in [composite foreign key](#composite-foreign-key).

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.addForeignKey(
    'tableName',
    ['id', 'name'],
    'otherTable',
    ['foreignId', 'foreignName'],
    {
      name: 'constraintName',
      match: 'FULL',
      onUpdate: 'RESTRICT',
      onDelete: 'CASCADE',
    },
  );
});
```

## addPrimaryKey, dropPrimaryKey

[//]: # 'has JSDoc'

Add a primary key to a table on migrate, and remove it on rollback.

`dropPrimaryKey` takes the same arguments, removes the primary key on migrate, and adds it on rollback.

First argument is a table name, second argument is an array of columns.
The optional third argument may have a name for the primary key constraint.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.addPrimaryKey('tableName', ['id', 'name'], {
    name: 'tablePkeyName',
  });
});
```

## addCheck, dropCheck

[//]: # 'has JSDoc'

Add or drop a check for multiple columns.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.addCheck('tableName', t.sql`column > 123`);
});
```

## renameConstraint

[//]: # 'has JSDoc'

Rename a table constraint such as a primary key or a database check

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameConstraint(
    'tableName', // may include schema: 'schema.table'
    'oldConstraintName',
    'newConstraintName',
  );
});
```

## renameColumn

[//]: # 'has JSDoc'

Rename a column:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameColumn('tableName', 'oldColumnName', 'newColumnName');
});
```

## createEnum, dropEnum

[//]: # 'has JSDoc'

`createEnum` creates an enum on migrate, drops it on rollback.

`dropEnum` does the opposite.

Third argument for options is optional.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createEnum('numbers', ['one', 'two', 'three']);

  // use `schemaName.enumName` format to specify a schema
  await db.createEnum('customSchema.mood', ['sad', 'ok', 'happy'], {
    // following options are used when dropping enum
    dropIfExists: true,
    cascade: true,
  });
});
```

## addEnumValues, dropEnumValues

[//]: # 'has JSDoc'

Use these methods to add or drop one or multiple values from an existing enum.

`addEnumValues` will drop values when rolling back the migration.

Dropping a value internally acts in multiple steps:

1. Select all columns from the database that depends on the enum;
2. Alter all these columns to have text type;
3. Drop the enum;
4. Re-create the enum without the value given;
5. Alter all columns from the first step to have the enum type;

In the case when the value is used by some table,
migrating `dropEnumValue` or rolling back `addEnumValue` will throw an error with a descriptive message,
in such case you'd need to manually resolve the issue by deleting rows with the value, or changing such values.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.addEnumValue('numbers', 'four');

  // you can pass options
  await db.addEnumValue('numbers', 'three', {
    // where to insert
    before: 'four',
    // skip if already exists
    ifNotExists: true,
  });

  // enum name can be prefixed with schema
  await db.addEnumValue('public.numbers', 'five', {
    after: 'four',
  });
});
```

## changeEnumValues

[//]: # 'has JSDoc'

Drops the enum and re-creates it with a new set of values.
Before dropping, changes all related column types to text, and after creating changes types back to the enum,
in the same way as [dropEnumValues](/guide/migration-writing#addenumvalues,-dropenumvalues) works.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.changeEnumValues(
    // can be prefixed with schema: 'public.numbers'
    'numbers',
    // change from:
    ['one', 'two'],
    // change to:
    ['three', 'four'],
  );
});
```

## renameEnumValues

[//]: # 'has JSDoc'

Rename one or multiple enum values using this method:

```ts
import { change } from '../db-script';

change(async (db) => {
  // rename value "from" to "to"
  await db.rename('numbers', { from: 'to' });

  // enum name can be prefixed with schema
  await db.rename('public.numbers', { from: 'to' });
});
```

## renameType

[//]: # 'has JSDoc'

Rename a type (such as enum):

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameType('oldTypeName', 'newTypeName');
});
```

Prefix the type name with a schema to set a different schema:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameType('fromSchema.oldType', 'toSchema.newType');
});
```

## changeTypeSchema

Set a different schema to the type (such as enum):

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.changeTypeSchema('typeName', 'fromSchema', 'toSchema');
});
```

## createSchema, dropSchema

[//]: # 'has JSDoc'

`createSchema` creates a database schema, and removes it on rollback.

`dropSchema` takes the same arguments, removes schema on migration, and adds it on rollback.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createSchema('schemaName');
});
```

## renameSchema

[//]: # 'has JSDoc'

Renames a database schema, renames it backwards on roll back.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameSchema('from', 'to');
});
```

## createExtension, dropExtension

[//]: # 'has JSDoc'

`createExtension` creates a database extension, and removes it on rollback.

`dropExtension` takes the same arguments, removes the extension on migrate, and adds it on rollback.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createExtension('pg_trgm');
});
```

## createDomain, dropDomain

[//]: # 'has JSDoc'

Domain is a custom database type that is based on other type and can include `NOT NULL` and a `CHECK` (see [postgres tutorial](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)).

When using ORM's migration generator, follow [this](/guide/orm-setup.html#postgres-domains) instead.

Construct a column type in the function as the second argument.

Specifiers [nullable](/guide/common-column-methods#nullable), [default](/guide/common-column-methods#default), [check](/guide/migration-column-methods#check), [collate](/guide/migration-column-methods#collate)
will be saved to the domain type on database level.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createDomain('domainName', (t) =>
    t.integer().check(t.sql`value = 42`),
  );

  // use `schemaName.domainName` format to specify a schema
  await db.createDomain('schemaName.domainName', (t) =>
    t
      .text()
      .nullable()
      .collate('C')
      .default('default text')
      .check(t.sql`length(value) > 10`),
  );
});
```

## renameDomain

[//]: # 'has JSDoc'

To rename a domain:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameDomain('oldName', 'newName');

  // to move domain to a different schema
  await db.renameDomain('oldSchema.domain', 'newSchema.domain');
});
```

## createCollation, dropCollation

[//]: # 'has JSDoc'

Create and drop a database collation, (see [Postgres docs](https://www.postgresql.org/docs/current/sql-createcollation.html)).

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createCollation('myCollation', {
    // This is a shortcut for setting lcCollate and lcCType at once.
    locale: 'en-u-kn-true',

    // set `lcType` and `lcCType` only if the `locale` is not set.
    // lcType: 'C',
    // lcCType: 'C',

    // provider can be 'icu' or 'libc'. 'libc' is a default.
    provider: 'icu',

    // true by default, false is only supported with 'icu' provider.
    deterministic: true,

    // Is intended to by used by `pg_upgrade`. Normally, it should be omitted.
    version: '1.2.3',

    // For `CREATE IF NOT EXISTS` when creating.
    createIfNotExists: true,

    // For `DROP IF EXISTS` when dropping.
    dropIfExists: true,

    // For `DROP ... CASCADE` when dropping.
    cascase: true,
  });
});
```

Instead of specifying the collation options, you can specify a collation to copy options from.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createCollation('myCollation', {
    fromExisting: 'otherCollation',
  });
});
```

To create a collation withing a specific database schema, prepend it to the collation name:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createCollation('schemaName.myCollation', {
    // `fromExisting` also can accept a collation name with a schema.
    fromExisting: 'schemaName.otherCollation',
  });
});
```

## createView, dropView

[//]: # 'has JSDoc'

Create and drop database views.

Provide SQL as a string or via `t.sql` that can accept variables.
Orchid creates views with `securityInvoker: true` by default, which is safer for views over RLS-managed tables because PostgreSQL checks the caller's permissions and RLS policies.
Set `securityInvoker: false` explicitly when the view should use PostgreSQL's ordinary owner-checked behavior.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createView(
    'simpleView',
    `
    SELECT a.one, b.two
    FROM a
    JOIN b ON b."aId" = a.id
  `,
  );

  // view can accept t.sql with variables in such way:
  const value = 'some value';
  await db.createView(
    'viewWithVariables',
    t.sql`
      SELECT * FROM a WHERE key = ${value}
    `,
  );

  // view with options
  await db.createView(
    'schemaName.recursiveView',
    {
      // createOrReplace has effect when creating the view
      createOrReplace: true,

      // dropIfExists and dropMode have effect when dropping the view
      dropIfExists: true,
      dropMode: 'CASCADE',

      // for details, check Postgres docs for CREATE VIEW,
      // these options are matching CREATE VIEW options
      temporary: true,
      recursive: true,
      columns: ['n'],
      checkOption: 'LOCAL', // or 'CASCADED'
      securityBarrier: true,
      // securityInvoker defaults to true; set it to false to opt out.
      securityInvoker: true,
    },
    `
      VALUES (1)
      UNION ALL
      SELECT n + 1 FROM "schemaName"."recursiveView" WHERE n < 100;
    `,
  );
});
```

## createMaterializedView, dropMaterializedView, refreshMaterializedView

[//]: # 'has JSDoc'

Create, drop, and refresh database materialized views.

Materialized views store the result of their SQL query in the database, so reads can
be faster, but the stored rows become stale until the materialized view is refreshed.
PostgreSQL does not allow direct `INSERT`, `UPDATE`, or `DELETE` on a materialized
view. Use `refreshMaterializedView` to replace its stored rows.

Provide SQL as a string or via `t.sql` that can accept variables.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createMaterializedView(
    'analytics.monthlySales',
    {
      columns: ['month', 'total'],
    },
    `
      SELECT date_trunc('month', "createdAt") AS month, sum(total) AS total
      FROM "order"
      GROUP BY 1
    `,
  );

  // materialized views can also accept t.sql with variables:
  const minimumTotal = 1000;
  await db.createMaterializedView(
    'analytics.largeMonthlySales',
    t.sql`
      SELECT date_trunc('month', "createdAt") AS month, sum(total) AS total
      FROM "order"
      GROUP BY 1
      HAVING sum(total) >= ${minimumTotal}
    `,
  );
});
```

Pass `withData: false` to create a materialized view with `WITH NO DATA`.
PostgreSQL creates the object, but leaves it unpopulated and unscannable until it
is refreshed with data.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createMaterializedView(
    'analytics.monthlySales',
    {
      columns: ['month', 'total'],
      withData: false,
    },
    `
      SELECT date_trunc('month', "createdAt") AS month, sum(total) AS total
      FROM "order"
      GROUP BY 1
    `,
  );
});
```

`dropMaterializedView` takes the same SQL and creation options as
`createMaterializedView`; they are used to recreate the materialized view on
rollback. `dropIfExists` and `dropMode` affect the `DROP MATERIALIZED VIEW`
statement.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.dropMaterializedView(
    'analytics.monthlySales',
    {
      columns: ['month', 'total'],
      withData: false,
      dropIfExists: true,
      dropMode: 'CASCADE',
    },
    `
      SELECT date_trunc('month', "createdAt") AS month, sum(total) AS total
      FROM "order"
      GROUP BY 1
    `,
  );
});
```

Materialized views use PostgreSQL indexes in the same way as tables.
Use `addIndex` and `dropIndex` with the materialized view name.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.addIndex('analytics.monthlySales', ['month'], {
    name: 'monthlySalesMonthIndex',
    unique: true,
  });
});
```

Refresh a materialized view when its stored rows should be replaced.
`concurrently: true` emits `CONCURRENTLY`, and `withData` controls `WITH DATA` or
`WITH NO DATA`.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.refreshMaterializedView('analytics.monthlySales');

  await db.refreshMaterializedView('analytics.monthlySales', {
    concurrently: true,
    withData: true,
  });

  await db.refreshMaterializedView('analytics.monthlySales', {
    withData: false,
  });
});
```

PostgreSQL has extra requirements for concurrent refresh:

- `CONCURRENTLY` cannot be combined with `WITH NO DATA`; Orchid rejects
  `{ concurrently: true, withData: false }` before running SQL.
- The materialized view must already be populated.
- The materialized view must have at least one unique index that uses only column
  names, covers all rows, and is not an expression or partial index.
- Only one refresh at a time can run for the same materialized view.

## createRole, dropRole

Create and drop database roles.

`createRole` uses `IF NOT EXISTS` logic by default (wrapped in a `DO $$ ... $$` block), so creating the same role again won't fail.

`dropRole` accepts the same arguments as `createRole`, it will create the role back when rolling back the migration.

```ts
import { change } from '../db-script';

change(async (db) => {
  // options are optional
  await db.createRole('name');

  await db.createRole('name', {
    super: true,
    inherit: true,
    createRole: true,
    createDb: true,
    canLogin: true,
    replication: true,
    connLimit: 123,
    validUntil: new Date('2030-01-01'),
    bypassRls: true,
    // config is of type Record<string, string>:
    // consult with Postgres docs for supported variables.
    config: {
      statement_timeout: '30s',
      work_mem: '128MB',
    },
  });
});
```

## enableRls, disableRls, forceRls, noForceRls

Manage table-level Row Level Security flags in migrations.

- `enableRls(tableName)`: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- `disableRls(tableName)`: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
- `forceRls(tableName)`: `ALTER TABLE ... FORCE ROW LEVEL SECURITY`
- `noForceRls(tableName)`: `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY`

All methods are reversible on rollback:

- `enableRls` rolls back with `disableRls`
- `forceRls` rolls back with `noForceRls`

Use `'schemaName.tableName'` for schema-qualified tables.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.enableRls('project');
  await db.forceRls('project');
});

change(async (db) => {
  await db.enableRls('tenant.project');
});
```

For ORM-side declaration and migration generation of table RLS flags, see [Row Level Security](/guide/row-level-security#table-rls-declaration-and-defaults) and [Generate Migrations](/guide/generate-migrations#row-level-security).

## createPolicy, dropPolicy, changePolicy

Create, drop, and change Row Level Security policies in migrations.

`createPolicy` and `dropPolicy` accept a table name, policy name, and policy definition.
Use `'schemaName.tableName'` for schema-qualified tables.
`dropPolicy` takes the full policy definition so rollback can recreate the policy.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createPolicy('project', 'project_select_same_tenant', {
    as: 'PERMISSIVE',
    for: 'SELECT',
    to: ['app_user', 'app_admin'],
    using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });

  await db.createPolicy('project', 'project_insert_same_tenant', {
    as: 'PERMISSIVE',
    for: 'INSERT',
    to: 'app_user',
    withCheck: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });

  await db.createPolicy('project', 'project_not_archived', {
    as: 'RESTRICTIVE',
    for: 'UPDATE',
    to: 'app_user',
    using: db.sql`archived_at IS NULL`,
    withCheck: db.sql`archived_at IS NULL`,
  });
});
```

Policy options:

- `as`: `'PERMISSIVE'` or `'RESTRICTIVE'`
- `for`: `'ALL'`, `'SELECT'`, `'INSERT'`, `'UPDATE'`, or `'DELETE'`; omitted means `ALL`
- `to`: one role or an array of roles; use `to: 'public'` to make the policy apply to public access by any role; omitted means PostgreSQL `PUBLIC`
- `using`: raw SQL expression for row visibility and existing-row checks
- `withCheck`: raw SQL expression for inserted or updated rows

Expression rules:

- `SELECT` and `DELETE` require `using` and do not accept `withCheck`.
- `INSERT` requires `withCheck` and does not accept `using`.
- `UPDATE`, `ALL`, and omitted `for` require both `using` and `withCheck`.

`changePolicy` uses `ALTER POLICY` for rename, role, `USING`, and `WITH CHECK` changes:

```ts
change(async (db) => {
  await db.changePolicy('project', 'project_select_same_tenant', {
    from: {
      name: 'project_select_same_tenant',
      to: ['app_user'],
      using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
    to: {
      name: 'project_select_same_tenant_v2',
      to: ['app_user', 'app_admin'],
      using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid AND archived_at IS NULL`,
    },
  });
});
```

Changing the policy table, mode, or command recreates the policy because PostgreSQL cannot alter those fields in place.
For ORM-side declaration and migration generation of policies, see [Row Level Security](/guide/row-level-security#rls-policies).

## renameRole

Renames a database role.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.renameRole('old-name', 'new-name');
});
```

## changeRole

Alters a database role. Alters it back on a migration rollback.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.changeRole('old-name', {
    from: {
      // since it is not present in `to`, it will be disabled
      canLogin: true,
      config: {
        // not present in `to` - this will reset the option
        statement_timeout: '30s',
      },
      connLimit: 10,
    },
    to: {
      // the role will be renamed if `to` has a new name
      name: 'new-name',
      // grants a permission to create a database
      createDb: true,
      connLimit: 20,
    },
  });
});
```

## grant, revoke

Grant or revoke direct privileges on existing PostgreSQL objects.
These methods are for existing objects only.
Use [changeDefaultPrivileges](/guide/migration-writing#changedefaultprivileges) for privileges that PostgreSQL should apply to future objects created by a role.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createRole('app_user', { canLogin: true });

  await db.grant({
    to: 'app_user',
    schemas: ['public'],
    privileges: ['USAGE'],
  });

  await db.grant({
    to: 'app_user',
    tables: ['project', 'task'],
    privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  });

  await db.grant({
    to: 'app_user',
    sequences: ['project_id_seq'],
    privileges: ['USAGE', 'SELECT'],
  });
});
```

`grantablePrivileges` grants privileges with `WITH GRANT OPTION`:

```ts
change(async (db) => {
  await db.grant({
    to: 'reporting_admin',
    tables: ['project'],
    grantablePrivileges: ['SELECT'],
    grantedBy: 'app_owner',
  });
});
```

`revoke` accepts the same target and privilege shape.
In `revoke`, `to` names the roles whose privileges are revoked:

```ts
change(async (db) => {
  await db.revoke({
    to: 'PUBLIC',
    routines: ['public.reset_password(text)'],
    privileges: ['EXECUTE'],
    revokeMode: 'CASCADE',
  });

  await db.revoke({
    to: 'readonly',
    tables: ['project'],
    grantablePrivileges: ['UPDATE'],
    revokeMode: 'RESTRICT',
  });
});
```

Options:

- `to`: one role or a non-empty array of roles. `PUBLIC`, `CURRENT_ROLE`, `CURRENT_USER`, and `SESSION_USER` are emitted as PostgreSQL role specifications.
- `grantedBy`: optional grantor role emitted as `GRANTED BY`.
- `privileges`: ordinary privileges to grant or revoke.
- `grantablePrivileges`: privileges to grant with grant option, or privileges to revoke that should be restored with grant option on rollback.
- `revokeMode`: `CASCADE` or `RESTRICT`, used only when a `REVOKE` statement is emitted.

Supported targets:

| Target key       | PostgreSQL target            | Privileges                                                                   |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `schemas`        | `ON SCHEMA`                  | ALL, USAGE, CREATE                                                           |
| `tables`         | `ON TABLE`                   | ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| `allTablesIn`    | `ON ALL TABLES IN SCHEMA`    | ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| `sequences`      | `ON SEQUENCE`                | ALL, USAGE, SELECT, UPDATE                                                   |
| `allSequencesIn` | `ON ALL SEQUENCES IN SCHEMA` | ALL, USAGE, SELECT, UPDATE                                                   |
| `routines`       | `ON ROUTINE`                 | ALL, EXECUTE                                                                 |
| `allRoutinesIn`  | `ON ALL ROUTINES IN SCHEMA`  | ALL, EXECUTE                                                                 |
| `types`          | `ON TYPE`                    | ALL, USAGE                                                                   |
| `domains`        | `ON DOMAIN`                  | ALL, USAGE                                                                   |
| `databases`      | `ON DATABASE`                | ALL, CREATE, CONNECT, TEMPORARY, TEMP                                        |

`ALL` renders as `ALL PRIVILEGES`.
`TEMP` is accepted as a database privilege alias for `TEMPORARY`.
`MAINTAIN` is supported by PostgreSQL 17 and newer.

Concrete table, sequence, routine, type, and domain names may be schema-qualified.
Unqualified concrete object names are prefixed with the configured migration schema.
Schema-wide targets such as `allTablesIn`, `allSequencesIn`, and `allRoutinesIn` contain schema names directly and are not schema-prefixed.

When both `privileges` and `grantablePrivileges` are provided, Orchid emits separate SQL statements so rollback can restore each privilege group correctly.
On rollback, `grant` emits the matching `REVOKE`, and `revoke` emits the matching `GRANT`.
Rolling back `revoke({ grantablePrivileges })` grants those privileges back with `WITH GRANT OPTION`.

Common PostgreSQL grant gotchas:

- Granting table privileges does not grant access to sequences used by that table.
- A role usually needs `USAGE` on the schema before it can access objects in that schema.
- Revoking a direct grant from a role or from `PUBLIC` does not prove the role has no effective access through membership, ownership, or superuser bypass.
- `GRANT` and `REVOKE` affect existing objects only; use default privileges for objects created later.

For ORM-side declaration and migration generation of grants, see [Generate Migrations](/guide/generate-migrations#grants).

## changeDefaultPrivileges

Grant or revoke default privileges for a role on objects created in a schema or globally.

Default privileges automatically apply to tables, sequences, functions, types, schemas (global only), and large objects (global only) created in the future by the specified `owner`.

You can use `all: true` to grant ALL privileges on all object types, or `allGrantable: true` to grant ALL privileges with GRANT OPTION on all object types. When `allGrantable` is provided, `all` is ignored. Individual object type configurations are merged on top of the `all` or `allGrantable` base.

```ts
import { change } from '../db-script';

change(async (db) => {
  // grant default privileges using all with specific overrides
  await db.changeDefaultPrivileges({
    owner: 'admin',
    grantee: 'app_user',
    schema: 'public',
    grant: {
      all: true, // grants ALL privileges on sequences, functions, and types
      tables: {
        // can limit privileges for certain objects
        privileges: ['SELECT', 'INSERT'],
      },
    },
  });

  // grant default privileges using allGrantable
  await db.changeDefaultPrivileges({
    grantee: 'admin',
    schema: 'public',
    grant: {
      allGrantable: true, // grants ALL privileges with GRANT OPTION on all object types
    },
  });

  // grant default privileges using individual object types
  await db.changeDefaultPrivileges({
    grantee: 'app_user',
    schema: 'public',
    grant: {
      tables: {
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
        grantablePrivileges: ['DELETE'],
      },
      sequences: {
        privileges: ['USAGE'],
      },
    },
  });

  // revoke default privileges
  await db.changeDefaultPrivileges({
    grantee: 'app_user',
    schema: 'public',
    revoke: {
      tables: {
        privileges: ['DELETE'],
      },
    },
  });
});
```

Options:

- `owner`: Corresponds to PostgreSQL `FOR ROLE target_role`. Objects created by this role will have the default privileges applied. Optional, defaults to the current user.
- `grantee`: The role name to grant/revoke privileges for
- `schema`: The schema where objects will be created
- `grant`: Privileges to grant (optional)
- `revoke`: Privileges to revoke (optional)

Each of `grant` and `revoke` can contain:

- `tables`: With `privileges` and optional `grantablePrivileges`
- `sequences`: With `privileges` and optional `grantablePrivileges`
- `functions`: With `privileges` and optional `grantablePrivileges`
- `types`: With `privileges` and optional `grantablePrivileges`

**Supported privileges by object type:**

| Object Type | Available Privileges                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| Tables      | ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| Sequences   | ALL, USAGE, SELECT, UPDATE                                                   |
| Functions   | ALL, EXECUTE                                                                 |
| Types       | ALL, USAGE                                                                   |

When `ALL` is specified, it grants all available privileges for that object type. In SQL, this is rendered as `ALL PRIVILEGES`.

## tableExists

[//]: # 'has JSDoc'

Returns boolean to know if table exists:

```ts
import { change } from '../db-script';

change(async (db) => {
  if (await db.tableExists('tableName')) {
    // ...do something
  }
});
```

## columnExists

[//]: # 'has JSDoc'

Returns boolean to know if a column exists:

Note that when `snakeCase` option is set to true, this method won't translate column to snake case, unlike other parts.

```ts
import { change } from '../db-script';

change(async (db) => {
  if (await db.columnExists('tableName', 'columnName')) {
    // ...do something
  }
});
```

## constraintExists

[//]: # 'has JSDoc'

Returns boolean to know if constraint exists:

```ts
import { change } from '../db-script';

change(async (db) => {
  if (await db.constraintExists('constraintName')) {
    // ...do something
  }
});
```
