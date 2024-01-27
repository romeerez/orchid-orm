# Advanced query methods

## with

[//]: # 'has JSDoc'

Add Common Table Expression (CTE) to the query.

```ts
import { columnTypes } from 'orchid-orm';
import { NumberColumn } from './number';

// .with optionally accepts such options:
type WithOptions = {
  // list of columns returned by this WITH statement
  // by default all columns from provided column shape will be included
  // true is for default behavior
  columns?: string[] | boolean;

  // Adds RECURSIVE keyword:
  recursive?: true;

  // Adds MATERIALIZED keyword:
  materialized?: true;

  // Adds NOT MATERIALIZED keyword:
  notMaterialized?: true;
};

// accepts columns shape and a raw SQL expression:
db.table.with(
  'alias',
  {
    id: columnTypes.integer(),
    name: columnTypes.text(3, 100),
  },
  db.table.sql`SELECT id, name FROM "someTable"`,
);

// accepts query:
db.table.with('alias', db.table.all());

// accepts a callback for a query builder:
db.table.with('alias', (qb) =>
  qb.select({ one: db.table.sql((t) => t.integer())`1` }),
);

// All mentioned forms can accept options as a second argument:
db.table.with(
  'alias',
  {
    recursive: true,
    materialized: true,
  },
  rawOrQueryOrCallback,
);
```

Defined `WITH` table can be used in `.from` or `.join` with all the type safeness:

```ts
db.table.with('alias', db.table.all()).from('alias').select('alias.id');

db.table
  .with('alias', db.table.all())
  .join('alias', 'alias.id', 'user.id')
  .select('alias.id');
```

## withSchema

[//]: # 'has JSDoc'

Specifies the schema to be used as a prefix of a table name.

Though this method can be used to set the schema right when building the query,
it's better to specify schema when calling `db(table, () => columns, { schema: string })`

```ts
db.table.withSchema('customSchema').select('id');
```

Resulting SQL:

```sql
SELECT "user"."id" FROM "customSchema"."user"
```

## union, unionAll, intersect, intersectAll, except, exceptAll

[//]: # 'has JSDoc'

Creates a union query, taking an array or a list of callbacks, builders, or raw SQL statements to build the union statement, with optional boolean `wrap`.
If the `wrap` parameter is true, the queries will be individually wrapped in parentheses.

```ts
SomeTable.select('id', 'name').union(
  [
    OtherTable.select('id', 'name'),
    SomeTable.sql`SELECT id, name FROM "thirdTable"`,
  ],
  true, // optional wrap parameter
);
```

Other methods takes the same arguments, they are different by SQL keyword:

- `unionAll` - `union` that allows duplicated rows
- `intersect` - get only rows that are present in all queries
- `intersectAll` - `intersect` that allows duplicated rows
- `except` - get only rows that are in the first query but not in the second
- `exceptAll` - `except` that allows duplicated rows

## json

[//]: # 'has JSDoc'

Wraps the query in a way to select a single JSON string.
So that JSON encoding is done on a database side, and the application doesn't have to turn a response to a JSON.
It may be better for performance in some cases.

```ts
// json is a JSON string that you can directly send as a response.
const json = await db.table.select('id', 'name').json();
```

## jsonPathQuery

[//]: # 'has JSDoc'

Selects a value from JSON data using a JSON path.

```ts
import { columnTypes } from 'orchid-orm';

db.table.jsonPathQuery(
  columnTypes.text(3, 100), // type of the value
  'data', // name of the JSON column
  '$.name', // JSON path
  'name', // select value as name

  // Optionally supports `vars` and `silent` options
  // check Postgres docs for jsonb_path_query for details
  {
    vars: 'vars',
    silent: true,
  },
);
```

Nested JSON operations can be used in place of JSON column name:

```ts
db.table.jsonPathQuery(
  columnTypes.text(3, 100),
  // Available: .jsonSet, .jsonInsert, .jsonRemove
  db.table.jsonSet('data', ['key'], 'value'),
  '$.name',
  'name',
);
```

## jsonSet

[//]: # 'has JSDoc'

Return a JSON value/object/array where a given value is set at the given path.
The path is an array of keys to access the value.

Can be used in [update](/guide/create-update-delete.html#update) callback.

```ts
const result = await db.table.jsonSet('data', ['name'], 'new value').take();

expect(result.data).toEqual({ name: 'new value' });
```

Optionally takes parameters of type `{ as?: string, createIfMissing?: boolean }`

```ts
await db.table.jsonSet('data', ['name'], 'new value', {
  as: 'alias', // select data as `alias`
  createIfMissing: true, // ignored if missing by default
});
```

## jsonInsert

[//]: # 'has JSDoc'

Return a JSON value/object/array where a given value is inserted at the given JSON path. Value can be a single value or JSON object. If a value exists at the given path, the value is not replaced.

Can be used in [update](/guide/create-update-delete.html#update) callback.

```ts
// imagine user has data = { tags: ['two'] }
const result = await db.table.jsonInsert('data', ['tags', 0], 'one').take();

// 'one' is inserted to 0 position
expect(result.data).toEqual({ tags: ['one', 'two'] });
```

Optionally takes parameters of type `{ as?: string, insertAfter?: boolean }`

```ts
// imagine user has data = { tags: ['one'] }
const result = await db.table
  .jsonInsert('data', ['tags', 0], 'two', {
    as: 'alias', // select as an alias
    insertAfter: true, // insert after the specified position
  })
  .take();

// 'one' is inserted to 0 position
expect(result.alias).toEqual({ tags: ['one', 'two'] });
```

## jsonRemove

[//]: # 'has JSDoc'

Return a JSON value/object/array where a given value is removed at the given JSON path.

Can be used in [update](/guide/create-update-delete.html#update) callback.

```ts
// imagine a user has data = { tags: ['one', 'two'] }
const result = await db.table
  .jsonRemove(
    'data',
    ['tags', 0],
    // optional parameters:
    {
      as: 'alias', // select as an alias
    },
  )
  .take();

expect(result.alias).toEqual({ tags: ['two'] });
```

## getColumnInfo

[//]: # 'has JSDoc'

Returns an object with the column info about the current table, or an individual column if one is passed, returning an object with the following keys:

```ts
type ColumnInfo = {
  defaultValue: unknown; // the default value for the column
  type: string; // the column type
  maxLength: number | null; // the max length set for the column, present on string types
  nullable: boolean; // whether the column may be null
};

import { getColumnInfo } from 'orchid-orm';

// columnInfo has type Record<string, ColumnInfo>, where string is name of columns
const columnInfo = await getColumnInfo(db.table);

// singleColumnInfo has the type ColumnInfo
const singleColumnInfo = await getColumnInfo(db.table, 'name');
```

## copyTableData

[//]: # 'has JSDoc'

`copyTableData` is a function to invoke a `COPY` SQL statement, it can copy from or to a file or a program.

Copying from `STDIN` or to `STDOUT` is not supported.

It supports all the options of the `COPY` statement of Postgres. See details in [Postgres document](https://www.postgresql.org/docs/current/sql-copy.html).

The copying is performed by the Postgres database server, and it must have access to the file.

Type of copy argument:

```ts
export type CopyOptions<Column = string> = {
  columns?: Column[];
  format?: 'text' | 'csv' | 'binary';
  freeze?: boolean;
  delimiter?: string;
  null?: string;
  header?: boolean | 'match';
  quote?: string;
  escape?: string;
  forceQuote?: Column[] | '*';
  forceNotNull?: Column[];
  forceNull?: Column[];
  encoding?: string;
} & (
  | {
      from: string | { program: string };
    }
  | {
      to: string | { program: string };
    }
);
```

Example usage:

```ts
import { copyTableData } from 'orchid-orm';

await copyTableData(db.table, {
  columns: ['id', 'title', 'description'],
  from: 'path-to-file',
});
```
