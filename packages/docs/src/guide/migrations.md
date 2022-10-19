# Migrations

Migrations allow you to evolve your database schema over time. This migration toolkit has several benefits over writing raw SQL migrations or using other tools:

- write migrations in TypeScript
- write only code to create or add something, and it will be automatically possible to undo the migration
- it shares the same column types library as the ORM, which allows to write a `createTable` migration and copy-paste columns to your model

## setup

Install this tool by running:

```sh
npm i -D rake-db
```

Add a script file somewhere to your project, ensure it's located in one of `include` locations of your `tsconfig.json`.

For example, it could be located in `scripts/db.ts` in your project.

Since the configuration is done in a regular TypeScript, it's possible to perform any logic and use any configuration tools to specify database connection options.

In following example `dotenv` is used and configured to first get env variables from `.env.local` and then to get them from `.env` file.

```ts
// scripts/db.ts
import { config } from 'dotenv'
import path from 'path'
import { rakeDb } from 'rake-db'

config({ path: path.resolve(process.cwd(), '.env.local') })
config()

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing in .env');
}

const migrationsPath = path.resolve(process.cwd(), 'migrations')

rakeDb(
  { connectionString },
  { migrationsPath },
);
```

Add `db` script to your `package.json`:

```json
{
  "scripts": {
    "db": "ts-node scripts/db.ts"
  }
}
```

And now it's possible to use it from a command line:

```sh
npm run db g createSomeTable
pnpm run db g createSomeTable
yarn db g createSomeTable
```

### rakeDb

`rakeDb` function in setup script takes connection options, migration config and command line arguments:

```ts
const rakeDb = async (
  options: MaybeArray<AdapterOptions>,
  partialConfig?: Partial<MigrationConfig>,
  args: string[] = process.argv.slice(2),
) => {
  // ...
}
```

First is of the same type `AdapterOptions` which is used when configuring query builder and the ORM.
Provide an array of such options to migrate two and more databases at the same time, which is helpful for maintaining a test database.

Second optional argument of type `MigrationConfig`, here is the type:

```ts
type MigrationConfig = {
  // absolute path to migrations directory
  migrationsPath: string;
  
  // table in your database to store migrated versions
  migrationsTable: string;
  
  // function to require typescript migration file
  requireTs(path: string): void;
  
  // log options, see "log option" in query builder document
  log?: boolean | Partial<QueryLogObject>;
  logger?: {
    log(message: string): void;
    error(message: string): void;
  };
}
```

To configure logging, see (log option)[http://localhost:3000/guide/query-builder.html#createdb] in query builder document.

Defaults are:

- `migrationPath` is `src/migrations`
- `migrationsTable` is `schemaMigrations`
- `requireTs` will use a `ts-node` package
- `log` is on
- `logger` is a standard `console`

Third optional argument of `rakeDb` is array of strings from command line, by default it will use `process.argv` to get the arguments, but you can override it by passing arguments manually.

## create and drop a database

Create and drop a database from a command line:

```sh
npm run db create
npm run db drop
```

These commands will ask for a database administrator username and password.

## generate migration

Generate a new migration file, use `generate` command is aliased with `g`:

```sh
npm run db g migrationName
```

If migration name matches one of known patterns, it will generate a template:

- `create${table name}` for creating a new table
- `drop${table name}` for dropping a table
- `change${table name}` for changing a table
- `add${any string}To${table name}` for adding columns to a table
- `remove${any string}From${table name}` for removing columns from a table

When using `create`, `drop`, `add...to` and `remove...from` name you can also specify columns in a command line to be added to a generated migration.

Specify a column by writing a column name, then a column type separated with `:`, column type can have an argument `(arg)`, then optionally specify a methods chain such as `.primaryKey`, `.nullable`, methods can have arguments too.

When passing an argument, put a column definition into quotes.

Example:

```sh
npm run db g createTodo id:serial.primaryKey 'name:varchar(50)' description:text.nullable
```

Will generate such a migration:

```ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('todo', (t) => ({
    id: t.serial().primaryKey(),
    name: t.varchar(50),
    description: t.text().nullable(),
  }));
});
```

## migrate and rollback

Migrate command will run all not applied yet migrations, sequentially in order:

```sh
npm run db migrate
```

Pass a number to migrate only this specific number of migrations:

```sh
npm run db migrate 3
```

Rollback command will revert one last applied migration:

```sh
npm run db rollback
```

Pass a number to revert multiple last applied migrations, or pass 'all' to revert all of them:

```sh
npm run db rollback 3
npm run db rollback all
```

## migration

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

`db` is extended query builder, so it has all the same methods as a query builder and additional specific methods such as `createTable`, `changeTable` and the others.

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

## migration column methods

Following methods have no effect on validation (except some), parsing or encoding columns, they only have effect when used in the migration.

Even though they have no effect in the application code, you still can copy code from migration to model definition for explicitness, to see database specifics in the model file.

### default

The default value is used only in the migration to set a default on a database level. Value can be a `raw()` SQL.

```ts
import { change } from 'rake-db'
import { raw } from 'pqb'

change(async (db) => {
  await db.createTable('table', (t) => ({
    active: t.boolean().default(false),
    date: t.date().default(raw('now()')),
  }))
})
```

### nullable

By default `NOT NULL` is added to every column, use `nullable` to prevent this.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().nullable()
  }))
})
```

### primaryKey

Mark the column as a primary key. This column type becomes an argument of the `.find` method. So if primary key is of `serial` type, `.find` will except number, or if primary key is of `uuid` type, `.find` will expect a string.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.serial().primaryKey(),
  }))
})
```

### composite primary key

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

### foreignKey

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

### composite foreign key

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

### index

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

### unique

Shortcut for `.index({ unique: true })`.

### composite index

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

### composite unique index

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

### timestamps

Adds `createdAt` and `updatedAt` columns of type `timestamp` (without time zone) with default SQL `now()`.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    ...t.timestamps(),
  }))
})
```

### comment

Add database comment to the column.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().comment('This is a column comment'),
  }))
})
```

### compression

Set compression for the column, see postgres docs for it.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().compression('value'),
  }))
})
```

### collate

Set collation for the column.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().collate('es_ES'),
  }))
})
```

## createTable, dropTable

`createTable` accepts a string for a table name, optional options, and a callback to specify a columns.

`dropTable` accepts the same arguments, it will drop table when migrating and create table when rolling back.

When creating table withing specific schema, write table name with schema name: `'schemaName.tableName'`.

Options are:

```ts
type TableOptions = {
  // used when reverting a `createTable`
  dropMode?: 'CASCADE' | 'RESTRICT'
  
  // add a database comment on the table
  comment?: string
}
```

Example:

```ts
import { change } from 'rake-db'

change(async (db) => {
  // table with comment and dropMode
  await db.createTable(
    'table',
    { comment: 'Table comment', dropMode: 'CASCADE' },
    (t) => ({
      // ...
    })
  )
  
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

`createJoinTable` helps with creating a join table. It accepts array of table names to join, optional options, and optional callback with columns.

`dropJoinTable` accepts the same arguments, it will drop table when migrating and create table when rolling back.

By default, name of join table is a camelCased union of provided table names.

It will create a referencing non-nullable column for each primary key of each table.

All referencing columns of the table will be included to its primary key, which makes every combination unique.

```ts
import { change } from 'rake-db'

change(async (db) => {
  // will create "fooBarBaz" table
  await db.createJoinTable(['foo', 'bar', 'baz'])
})
```

Assuming tables 'foo', 'bar', 'baz' have one primary key of integer type, above code is equivalent for:

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

When changing table withing specific schema, write table name with schema name: `'schemaName.tableName'`.

Options are:

```ts
type ChangeTableOptions = {
  comment?:
    | // add comment to table on migrate, remove comment on rollback
      string
    | // change comment from first to second on migrate, from second to first on rollback
      [string, string]
    | // remove comment on both migrate and rollback
      null
}
```

Callback of change table is different from `createTable`in the way that it expects columns to be wrapped in change methods such as `add`, `drop`, `change`.

### add, drop

`add` will add column on migrate, remove it on rollback.

`drop` will remove column on migrate, add it on rollback.

The column in `add` or `drop` can have all the same methods as when creating table, such methods as `index`, `unique`, `foreignKey`.

Supports adding composite primary key, foreign key, index and all the same as when creating a table.

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

### change

Takes array of two columns, on migrate it will change the column to second element, on rollback will change the column to first element.

```ts
import { change } from 'rake-db'
import { raw } from 'pqb'

change(async (db) => {
  await db.changeTable('table', (t) => ({
    // change column type from integer to string
    column1: t.change(t.integer(), t.string()),
    
    // change column type using SQL expression to convert data
    column2: t.change(t.integer(), t.string(), {
      usingUp: raw('column2::text'),
      usingDown: raw('column2::integer'),
    }),
    
    // change various column properties at once
    column3: t.change(
      t.integer().collate('de_DE').default(123).comment('from comment'),
      t.text().collate('es_ES').default('123').comment('to comment').nullable(),
    ),
    
    // change column default
    column4: t.change(t.default(1), t.default(2)),
    
    // change column default with raw SQL
    column5: t.change(t.default(raw('2 + 2')), t.default(raw('3 + 3'))),
    
    // change column to be nullable or non nullable
    column6: t.change(t.nonNullable(), t.nullable()),
    column7: t.change(t.nullable(), t.nonNullable()),
    
    // change column comment
    column8: t.change(t.comment('from comment'), t.comment('to comment')),
    
    // rename a column
    column9: t.rename('newColumnName'),
  }))
})
```

### rename

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

Add column to table on migrate, remove it on rollback.

`dropColumn` takes the same arguments, removes a column on migrate and adds it on rollback.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.addColumn('tableName', 'columnName', (t) =>
    t.integer().index().nullable()
  )
})
```

## addIndex, dropIndex

Add index to table on migrate, remove it on rollback.

`dropIndex` takes the same arguments, removes the index on migrate, adds it on rollback.

First argument is table name, other arguments are the same as in [composite index](#composite-index).

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

Add foreign key to table on migrate, remove it on rollback.

`dropForeignKey` takes the same arguments, removes the foreign key on migrate, adds it on rollback.

First argument is table name, other arguments are the same as in [composite foreign key](#composite-foreign-key).

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

Add primary key to table on migrate, remove it on rollback.

`dropPrimaryKey` takes the same arguments, removes the primary key on migrate, adds it on rollback.

First argument is table name, other arguments are the same as in [composite primary key](#composite-primary-key).

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

`createSchema` creates a database schema, removes it on rollback.

`dropSchema` takes the same arguments, removes schema on migrate and adds it on rollback.

```ts
import { change } from 'rake-db'

change(async (db) => {
  await db.createSchema('schemaName')
})
```

## createExtension, dropExtension

`createExtension` creates a database extension, removes it on rollback.

`dropExtension` takes the same arguments, removes extension on migrate and adds it on rollback.

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

Returns boolean to know if column exists:

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
