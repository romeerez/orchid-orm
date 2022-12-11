# Writing a migration

Use a `change` function for changing the database schema, it accepts a callback with `db` and optionally you can use a second argument `up` to know if it is an up migration or down.

```ts
import { change } from 'rake-db'

change(async (db, up) => {
  if (up) {
    console.log('migrate is called')
  } else {
    console.log('rollback is called')
  }
})
```

`db` is an extended query builder, so it has all the same methods as a query builder and additional specific methods such as `createTable`, `changeTable`, and others.

It's possible to run custom raw queries, for example, to create a table and fill it:

```ts
import { change } from 'rake-db'

change(async (db, up) => {
  await db.createTable('table', (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))

  if (up) {
    await db.query({
      text: 'INSERT INTO table(name) VALUES ($1, $2, $3)',
      values: ['a', 'b', 'c']
    })
  }
})
```

## createTable, dropTable

`createTable` accepts a string for a table name, optional options, and a callback to specify columns.

`dropTable` accepts the same arguments, it will drop the table when migrating and create a table when rolling back.

When creating a table within a specific schema, write the table name with schema name: `'schemaName.tableName'`.

Options are:

```ts
type TableOptions = {
  // used when reverting a `createTable`
  dropMode?: 'CASCADE' | 'RESTRICT';
  
  // add a database comment on the table
  comment?: string;
  
  // by default, it will throw an error when the table has no primary key
  // set `noPrimaryKey` to `true` to bypass it
  noPrimaryKey?: boolean;
}
```

Example:

```ts
import { change } from 'rake-db'

change(async (db) => {
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
    })
  )
  
  // call without options
  await db.createTable('user', (t) => ({
    id: t.serial().primaryKey(),
    email: t.text().unique(),
    name: t.text(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }))
})
```

## createJoinTable, dropJoinTable

`createJoinTable` helps with creating a join table. It accepts an array of table names to join, optional options, and optional callbacks with columns.

`dropJoinTable` accepts the same arguments, it will drop the table when migrating and create a table when rolling back.

By default, the name of the join table is a camelCased union of provided table names.

It will create a referencing non-nullable column for each primary key of each table.

All referencing columns of the table will be included in its primary key, which makes every combination unique.

```ts
import { change } from 'rake-db'

change(async (db) => {
  // will create a "fooBarBaz" table
  await db.createJoinTable(['foo', 'bar', 'baz'])
})
```

Assuming tables 'foo', 'bar', and 'baz' have one primary key of integer type, the above code is equivalent for:

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('fooBarBaz', (t) => ({
    fooId: t.integer().foreignKey('foo', 'id'),
    barId: t.integer().foreignKey('bar', 'id'),
    bazId: t.integer().foreignKey('baz', 'id'),
    ...t.primaryKey(['fooId', 'barId', 'bazId']),
  }))
})
```

Options are:

```ts
type JoinTableOptions = {
  // override join table name:
  tableName?: string;
  
  // same options as in createTable:
  comment?: string;
  dropMode?: 'CASCADE' | 'RESTRICT';
}
```

Provide a callback if you want to add additional columns:

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createJoinTable(['foo', 'bar', 'baz'], (t) => ({
    something: t.text(),
    ...t.timestamps(),
  }))
})
```

## changeTable

`changeTable` accepts a table name, optional options, and a special callback with column changes.

When changing a table within a specific schema, write the table name with schema name: `'schemaName.tableName'`.

Options are:

```ts
type ChangeTableOptions = {
  comment?:
    | // add a comment to the table on migrating, remove a comment on rollback
      string
    | // change comment from first to second on migrating, from second to first on rollback
      [string, string]
    | // remove a comment on both migrate and rollback
      null
}
```

The callback of the `changeTable` is different from `createTable` in the way that it expects columns to be wrapped in change methods such as `add`, `drop`, and `change`.

## add, drop

`add` will add a column on migrating, and remove it on rollback.

`drop` will remove the column on migrating, and add it on rollback.

The column in `add` or `drop` can have all the same methods as when creating a table, such methods as `index`, `unique`, and `foreignKey`.

Supports adding a composite primary key, foreign key, and index, and all the same as when creating a table.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column1: t.add(t.text()),
    column2: t.drop(t.boolean()),
    
    // add composite primary key:
    ...t.add(t.primaryKey(['foo', 'bar'])),
    
    // add composite index:
    ...t.add(t.index(['foo', 'bar'])),
    
    // add composite unique index:
    ...t.add(t.unique(['foo', 'bar'])),
    
    // add composite foreign key:
    ...t.add(
      t.foreignKey(
        ['foo', 'bar'],
        'otherTable',
        ['otherFoo', 'otherBar']
      )
    ),
    
    // add timestamps:
    ...t.add(t.timestamps()),
  }))
})
```

## change

Takes an array of two columns, on migrating it will change the column to the second element, and on rollback will change the column to the first element.

Dropping or creating a primary key on multiple columns is allowed.

Index options are listed [here](/guide/migration-column-methods.html#index).

Foreign key options are listed [here](/guide/migration-column-methods.html#foreignkey).

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.changeTable('table', (t) => ({
    // change column type from integer to string
    column1: t.change(t.integer(), t.string()),
    
    // change column type using SQL expression to convert data
    column2: t.change(t.integer(), t.string(), {
      usingUp: t.raw('column2::text'),
      usingDown: t.raw('column2::integer'),
    }),
    
    // change column default
    column3: t.change(t.default(1), t.default(2)),
    
    // change column default with raw SQL
    column4: t.change(t.default(t.raw('2 + 2')), t.default(t.raw('3 + 3'))),
    
    // change column to be nullable or non-nullable
    column5: t.change(t.nonNullable(), t.nullable()),
    column6: t.change(t.nullable(), t.nonNullable()),
    
    // change column comment
    column7: t.change(t.comment('from comment'), t.comment('to comment')),
    
    // add index
    column8: t.change(t.integer(), t.integer().index()),
    
    // remove index
    column9: t.change(t.integer().index(), t.integer()),
    
    // change index
    column10: t.change(
      t.integer().index({
        // index options to be applied when migrating down
      }),
      t.integer().index({
        // index options to be applied when migrating up
      })
    ),
    
    // add primary key
    column11: t.change(
      t.integer(),
      t.integer().primaryKey()
    ),
    
    // drop primary key
    column12: t.change(
      t.integer().primaryKey(),
      t.integer(),
    ),
    
    // add foreign key
    column13: t.change(
      t.integer(),
      t.integer().foreignKey('otherTable', 'otherTableId'),
    ),
    
    // remove foreign key
    column14: t.change(
      t.integer().foreignKey('otherTable', 'otherTableId'),
      t.integer(),
    ),
    
    // change foreign key
    column15: t.change(
      t.integer().foreignKey('oneTable', 'oneColumn', {
        // foreign key options to be applied when migrating up
        name: 'oneForeignKeyName',
        match: 'PARTIAL',
        onUpdate: 'RESTRICT',
        onDelete: 'SET DEFAULT',
      }),
      t.integer().foreignKey('otherTable', 'otherColumn', {
        // foreign key options to be applied when migrating down
        name: 'otherForeignKeyName',
        match: 'FULL',
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      }),
    ),

    // change various column properties at once
    column16: t.change(
      t.integer()
        .collate('de_DE')
        .default(123)
        .comprssion('pglz')
        .comment('from comment')
        .index({ name: 'oneIndexName' })
        .foreignKey('oneTable', 'oneColumn', {
          name: 'oneForeignKeyName',
        }),
      t.text()
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
  }))
})
```

## rename

Rename a column:

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.changeTable('table', (t) => ({
    oldColumnName: t.rename('newColumnName'),
  }))
})
```

## renameTable

Rename a table:

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.renameTable('oldTableName', 'newTableName')
})
```

## addColumn, dropColumn

Add a column to the table on migrating, and remove it on rollback.

`dropColumn` takes the same arguments, removes a column on migrate, and adds it on rollback.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.addColumn('tableName', 'columnName', (t) =>
    t.integer().index().nullable()
  )
})
```

## addIndex, dropIndex

Add an index to the table on migrating, and remove it on rollback.

`dropIndex` takes the same arguments, removes the index on migrate, and adds it on rollback.

The first argument is the table name, other arguments are the same as in [composite index](#composite-index).

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.addIndex(
    'tableName',
    ['column1', { column: 'column2', order: 'DESC' }],
    {
      name: 'indexName',
    }
  )
})
```

## addForeignKey, dropForeignKey

Add a foreign key to a table on migrating, and remove it on rollback.

`dropForeignKey` takes the same arguments, removes the foreign key on migrate, and adds it on rollback.

The first argument is the table name, other arguments are the same as in [composite foreign key](#composite-foreign-key).

```ts
import { change } from 'rake-db'

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
    }
  )
})
```

## addPrimaryKey, dropPrimaryKey

Add a primary key to a table on migrate, and remove it on rollback.

`dropPrimaryKey` takes the same arguments, removes the primary key on migrate, and adds it on rollback.

The first argument is the table name, other arguments are the same as in [composite primary key](#composite-primary-key).

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.addPrimaryKey(
    'tableName',
    ['id', 'name'],
    { name: 'tablePkeyName' },
  )
})
```

## renameColumn

Rename a column:

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.renameColumn('tableName', 'oldColumnName', 'newColumnName')
})
```

## createSchema, dropSchema

`createSchema` creates a database schema, and removes it on rollback.

`dropSchema` takes the same arguments, removes schema on migration, and adds it on rollback.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createSchema('schemaName')
})
```

## createExtension, dropExtension

`createExtension` creates a database extension, and removes it on rollback.

`dropExtension` takes the same arguments, removes the extension on migrate, and adds it on rollback.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createExtension('pg_trgm')
})
```

## tableExists

Returns boolean to know if table exists:

```ts
import { change } from 'rake-db'

change(async (db) => {
  if (await db.tableExists('tableName')) {
    // ...do something
  }
})
```

## columnExists

Returns boolean to know if a column exists:

```ts
import { change } from 'rake-db'

change(async (db) => {
  if (await db.columnExists('tableName', 'columnName')) {
    // ...do something
  }
})
```

## constraintExists

Returns boolean to know if constraint exists:

```ts
import { change } from 'rake-db'

change(async (db) => {
  if (await db.constraintExists('constraintName')) {
    // ...do something
  }
})
```
