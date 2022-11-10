# migration column methods

Following methods have no effect on validation (except some), parsing or encoding columns, they only have effect when used in the migration.

Even though they have no effect in the application code, you still can copy code from migration to model definition for explicitness, to see database specifics in the model file.

## default

The default value is used only in the migration to set a default on a database level. Value can be a raw SQL.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    active: t.boolean().default(false),
    date: t.date().default(db.raw('now()')),
  }))
})
```

## nullable

By default `NOT NULL` is added to every column, use `nullable` to prevent this.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().nullable()
  }))
})
```

## primaryKey

Mark the column as a primary key. This column type becomes an argument of the `.find` method. So if primary key is of `serial` type, `.find` will except number, or if primary key is of `uuid` type, `.find` will expect a string.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.serial().primaryKey(),
  }))
})
```

## composite primary key

Use `t.primaryKey([column1, column2, ...columns])` to specify primary key consisting of multiple columns:

By default, postgres will name an underlying constraint as `${table name}_pkey`, override the name by passing second argument `{ name: 'customName' }`.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.integer(),
    name: t.text(),
    active: t.boolean(),
    ...t.primaryKey(['id', 'name', 'active'], { name: 'tablePkeyName' }),
  }))
})
```

## foreignKey

Set the foreignKey for the column.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    otherId: t.integer().foreignKey('otherTableName', 'columnName'),
  }))
})
```

In the ORM specify a function returning a model instead of table name:

```ts
export class SomeModel extends Model {
  table = 'someTable';
  columns = this.setColumns((t) => ({
    otherTableId: t.integer().foreignKey(() => OtherTable, 'id'),
  }))
}

export class OtherTable extends Model {
  table = 'otherTable'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }))
}
```

Optionally you can pass third argument to `foreignKey` with options:

```ts
type ForeignKeyOptions = {
  // name of the constraint
  name?: string;
  // see database docs for MATCH in FOREIGN KEY
  match?: 'FULL' | 'PARTIAL' | 'SIMPLE';
  
  onUpdate?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
  onDelete?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
}
```

## composite foreign key

Set foreign key from multiple columns in current table to corresponding columns in other table.

First argument is array of columns in current table, second argument is other table name, third argument is array of columns in other table, forth argument is for options.

Options are the same as in single column foreign key.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.integer(),
    name: t.string(),
    ...t.foreignKey(
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
  }))
})
```

## index

Add index to the column.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    // add index to name column with default settings:
    name: t.text().index(),
  }))
})
```

Optionally you can pass a single argument with options:

```ts
type IndexOptions = {
  // name of the index
  name?: string;
  // is it an unique index
  unique?: boolean;
  // index algorhytm to use such as GIST, GIN
  using?: string;
  // expression is an argument to be passed to a column:
  // CREATE INDEX name ON table ( columnName(expression) )
  expression?: number | string;
  // specify collation:
  collate?: string;
  // see `opclass` in postgres document for creating index
  operator?: string;
  // specify index order such as ASC NULLS FIRST, DESC NULLS LAST
  order?: string;
  // include columns to index to optimize specific queries
  include?: MaybeArray<string>;
  // see "storage parameters" in postgres document for creating index, for example 'fillfactor = 70'
  with?: string;
  // The tablespace in which to create the index. If not specified, default_tablespace is consulted, or temp_tablespaces for indexes on temporary tables.
  tablespace?: string;
  // WHERE clause to filter records for the index
  where?: string;
  // mode is for dropping the index
  mode?: 'CASCADE' | 'RESTRICT';
};
```

## unique

Shortcut for `.index({ unique: true })`.

## composite index

Add index for multiple columns.

First argument is an array of columns, where column can be a simple string or an object with such options:

```ts
type IndexColumnOptions = {
  // name of the column
  column: string,
  // see comments above for these options
  expression?: number | string;
  collate?: string;
  operator?: string;
  order?: string;
}
```

Second argument is optional object with index options:

```ts
type IndexOptions = {
  // see comments above for these options
  name?: string;
  unique?: boolean;
  using?: string;
  include?: MaybeArray<string>;
  with?: string;
  tablespace?: string;
  where?: string;
  mode?: 'CASCADE' | 'RESTRICT';
}
```

Example:

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    ...t.index(['id', { column: 'name', order: 'ASC' }], { name: 'indexName' }),
  }))
})
```

## composite unique index

Shortcut for `t.index([...columns], { ...options, unique: true })`

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    ...t.unique(['id', 'name']),
  }))
})
```

## timestamps

Adds `createdAt` and `updatedAt` columns of type `timestamp` (without time zone) with default SQL `now()`.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    ...t.timestamps(),
  }))
})
```

## comment

Add database comment to the column.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().comment('This is a column comment'),
  }))
})
```

## compression

Set compression for the column, see postgres docs for it.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().compression('value'),
  }))
})
```

## collate

Set collation for the column.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().collate('es_ES'),
  }))
})
```
