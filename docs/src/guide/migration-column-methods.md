# migration column methods

All the methods described in [columns methods](/guide/common-column-methods) still applies in migrations,
to add or change columns with specific types.

This document describes common methods like `default`, `nullable`, `primaryKey` that have effect in both application code and migration,
in methods like `check`, `comment`, `collate` that only have effect in migrations.

## default

Set a default value for a column on a database level. Value can be a raw SQL.

`default` can accept a callback when used in ORM table, but it's not applicable in migrations.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    active: t.boolean().default(false),
    date: t.date().default(t.sql`now()`),
  }));
});
```

If you provide a function to the `default`, it will be called by ORM before creating records, and it won't have any default value on a database level.

```ts
import { change } from '../dbScript';
import { uuidv7 } from 'uuidv7';

change(async (db) => {
  await db.createTable('table', (t) => ({
    // uuidv7 is a function, it is ignored in migrations,
    // column won't have a `DEFAULT` on a database level:
    id: t.uuid().primaryKey().default(uuidv7),
  }));
});
```

[uuid().primaryKey()](/guide/columns-types.html#uuid) has a default `gen_random_uuid()` by default, and if you'd like to drop it use `default(null)`:

```ts
id: t.uuid().primaryKey().default(null),
```

## nullable

By default, `NOT NULL` is added to every column. Use `nullable` to prevent this:

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().nullable(),
  }));
});
```

## enum

In the migration `enum` takes a single argument for enum name, unlike the `enum` column in the ORM.

To create a new enum type, use `createEnum` before creating a table.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createEnum('mood', ['sad', 'ok', 'happy']);

  await db.createTable('table', (t) => ({
    mood: t.enum('mood'),
  }));
});
```

## generated column

[//]: # 'has JSDoc in columnType'

Define a generated column. `generated` accepts a raw SQL.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    two: t.integer().generated`1 + 1`,
  }));
});
```

[//]: # 'has JSDoc in columns/string'

For `tsvector` column type, it can also accept language (optional) and columns:

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('post', (t) => ({
    id: t.id(),
    title: t.text(),
    body: t.text(),
    // join title and body into a single ts_vector
    generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
    // with language:
    spanishTsVector: t
      .tsvector()
      .generated('spanish', ['title', 'body'])
      .searchIndex(),
  }));
});
```

## primaryKey

Mark the column as a primary key. This column type becomes an argument of the `.find` method.
So if the primary key is of `integer` type, `.find` will accept the number,
or if the primary key is of `uuid` type, `.find` will expect a string.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
  }));
});
```

## composite primary key

Specify `primaryKey` on multiple columns to have a composite primary key. `.find` works only with single primary key.

Composite key is useful when defining a join table which is designed to connect other tables.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    name: t.text().primaryKey(),
    active: t.boolean().primaryKey(),
  }));
});
```

Alternatively, use `t.primaryKey([column1, column2, ...columns])` to specify the primary key consisting of multiple columns:

By default, Postgres will name an underlying constraint as `${table name}_pkey`, and override the name by passing a second argument `{ name: 'customName' }`.

Note how `name` column has `different_name` name: `primaryKey` is accepting a column key and will use an underlying name.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.integer(),
    name: t.name('different_name').text(),
    active: t.boolean(),
    ...t.primaryKey(['id', 'name', 'active'], { name: 'tablePkeyName' }),
  }));
});
```

## foreignKey

[//]: # 'has JSDoc'

Set the foreignKey for the column.

In `snakeCase` mode, columns of both tables are translated to a snake_case.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    otherId: t.integer().foreignKey('otherTableName', 'columnName'),
  }));
});
```

In the ORM specify a function returning a table class instead of a name:

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    otherTableId: t.integer().foreignKey(() => OtherTable, 'id'),
  }));
}

export class OtherTable extends BaseTable {
  readonly table = 'otherTable';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
  }));
}
```

Optionally you can pass the third argument to `foreignKey` with options:

```ts
type ForeignKeyOptions = {
  // name of the constraint
  name?: string;
  // see database docs for MATCH in FOREIGN KEY
  match?: 'FULL' | 'PARTIAL' | 'SIMPLE';

  onUpdate?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
  onDelete?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
};
```

## composite foreign key

Set foreign key from multiple columns in the current table to corresponding columns in the other table.

The first argument is an array of columns in the current table, the second argument is another table name, the third argument is an array of columns in another table, and the fourth argument is for options.

Options are the same as in a single-column foreign key.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.integer(),
    name: t.string(), // string is varchar(255)
    ...t.foreignKey(
      ['id', 'name'],
      'otherTable',
      ['foreignId', 'foreignName'],
      {
        name: 'constraintName',
        match: 'FULL',
        onUpdate: 'RESTRICT',
        onDelete: 'CASCADE',
      },
    ),
  }));
});
```

## index

Add an index to the column.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    // add an index to the name column with default settings:
    name: t.text().index(),
  }));
});
```

Optionally you can pass a single argument with options:

```ts
type IndexOptions = {
  // name of the index
  name?: string;
  // is it a unique index
  unique?: boolean;
  // NULLS NOT DISTINCT: availabe in Postgres 15+, makes sense only for unique index
  nullsNotDistinct?: true;
  // index algorithm to use such as GIST, GIN
  using?: string;
  // specify collation:
  collate?: string;
  // see `opclass` in the Postgres document for creating the index
  opclass?: string;
  // specify index order such as ASC NULLS FIRST, DESC NULLS LAST
  order?: string;
  // include columns to an index to optimize specific queries
  include?: MaybeArray<string>;
  // see "storage parameters" in the Postgres document for creating an index, for example, 'fillfactor = 70'
  with?: string;
  // The tablespace in which to create the index. If not specified, default_tablespace is consulted, or temp_tablespaces for indexes on temporary tables.
  tablespace?: string;
  // WHERE clause to filter records for the index
  where?: string;
  // mode is for dropping the index
  mode?: 'CASCADE' | 'RESTRICT';
};
```

## searchIndex

[//]: # 'has JSDoc'

`searchIndex` is designed for [full text search](/guide/text-search).

It can accept the same options as a regular `index`, but it is `USING GIN` by default, and it is concatenating columns into a `tsvector` database type.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    title: t.text(),
    body: t.text(),
    ...t.searchIndex(['title', 'body']),
  }));
});
```

Produces the following index ('english' is a default language, see [full text search](/guide/text-search.html#language) for changing it):

```sql
CREATE INDEX "table_title_body_idx" ON "table" USING GIN (
  to_tsvector('english', "title" || ' ' || "body")
)
```

You can set different search weights (`A` to `D`) on different columns inside the index:

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    title: t.text(),
    body: t.text(),
    ...t.searchIndex([
      { column: 'title', weight: 'A' },
      { column: 'body', weight: 'B' },
    ]),
  }));
});
```

When the table has localized columns,
you can define different indexes for different languages by setting the `language` parameter:

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    titleEn: t.text(),
    bodyEn: t.text(),
    titleFr: t.text(),
    bodyFr: t.text(),
    ...t.searchIndex(['titleEn', 'bodyEn'], { language: 'english' }),
    ...t.searchIndex(['titleFr', 'bodyFr'], { language: 'french' }),
  }));
});
```

Alternatively, different table records may correspond to a single language,
then you can define a search index that relies on a language column by using `languageColumn` parameter:

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    lang: t.type('regconfig'),
    title: t.text(),
    body: t.text(),
    ...t.searchIndex(['title', 'body'], { languageColumn: 'lang' }),
  }));
});
```

It can be more efficient to use a [generated](/guide/migration-column-methods.html#generated-column) column instead of indexing text column in the way described above,
and to set a `searchIndex` on it:

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    title: t.text(),
    body: t.text(),
    generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
  }));
});
```

Produces the following index:

```sql
CREATE INDEX "table_generatedTsVector_idx" ON "table" USING GIN ("generatedTsVector")
```

## unique

Shortcut for `.index({ unique: true })`.

## composite index

Add index for multiple columns.

The first argument is an array of columns, where the column can be a simple string or an object with such options:

```ts
type IndexColumnOptions = {
  // column name OR expression is required
  column: string;
  // SQL expression, like 'lower(name)'
  expression: string;

  collate?: string;
  opclass?: string; // for example, varchar_ops
  order?: string; // ASC, DESC, ASC NULLS FIRST, DESC NULLS LAST
};
```

The second argument is an optional object with index options:

```ts
type IndexOptions = {
  // see the comments above for these options
  name?: string;
  unique?: boolean;
  using?: string;
  include?: MaybeArray<string>;
  nullsNotDistinct?: true;
  with?: string;
  tablespace?: string;
  where?: string;
  mode?: 'CASCADE' | 'RESTRICT';
};
```

Example:

Note how `name` column has a `different_name` name, but it's been referenced by a key name in the index.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    name: t.name('different_name').text(),
    ...t.index(['id', { column: 'name', order: 'ASC' }], { name: 'indexName' }),
  }));
});
```

## composite unique index

Shortcut for `t.index([...columns], { ...options, unique: true })`

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    ...t.unique(['id', 'name']),
  }));
});
```

## timestamps

Adds `createdAt` and `updatedAt` columns of type `timestamp` (with time zone) with default SQL `now()`.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    ...t.timestamps(),
  }));
});
```

## timestampsNoTZ

The same as `timestamps`, but without a time zone.

## timestampsSnakeCase

This method is for the case when `snakeCase` is not set or `false`, but for some reason you need timestamps named as `updated_at` and `created_at`.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    // adds updated_at and created_at
    ...t.timestampsSnakeCase(),
  }));
});
```

## timestampsNoTZSnakeCase

The same as `timestampsSnakeCase`, but without a time zone.

## check

[//]: # 'has JSDoc'

Set a database-level validation check to a column. `check` accepts a raw SQL.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    // validate rank to be from 1 to 10
    rank: t.integer().check(t.sql`1 >= "rank" AND "rank" <= 10`),
  }));
});
```

## multi-column check

Define a check for multiple column by using a spread syntax:

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    a: t.integer(),
    b: t.integer(),
    ...t.check(t.sql`a < b`),
  }));
});
```

## comment

Add database comment to the column.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().comment('This is a column comment'),
  }));
});
```

## compression

Set compression for the column, see Postgres docs for it.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().compression('value'),
  }));
});
```

## collate

Set collation for the column.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.text().collate('es_ES'),
  }));
});
```

## unsupported types

For user-defined types or for types that are not supported yet, use `type`:

When using `type` to define columns in application, you need to also specify `as` so application knows the actual type behind the domain.

In migration, `as` won't have effect.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.type('type_name'),
  }));
});
```

## domain

Domain is a custom database type that allows to predefine a `NOT NULL` and a `CHECK` (see [postgres tutorial](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)).

Before adding a domain column, create the domain type itself, see [create domain](/guide/migration-writing.html#createdomain-dropdomain).

`as` works exactly like as when using `type`, it has no effect in the migration.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    name: t.domain('domainName'),
  }));
});
```

## constraint

You can place a database check and a foreign key on a single constraint:

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('table', (t) => ({
    one: t.integer(),
    two: t.text(),
    ...t.constraint({
      name: 'constraintName',
      check: t.sql`one > 5`,
      references: [
        ['one', 'two'], // this table columns
        'otherTable', // foreign table name
        ['otherOne', 'otherTwo'], // foreign columns
        {
          // see foreignKey above for options
          match: 'FULL',
        },
      ],
    }),
  }));
});
```
