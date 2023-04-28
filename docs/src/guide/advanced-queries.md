# Advanced query methods

## with

Add Common Table Expression (CTE) to the query.

```ts
import { columnTypes } from 'pqb';
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

// accepts columns shape and a raw expression:
db.table.with(
  'alias',
  {
    id: columnTypes.integer(),
    name: columnTypes.text(3, 100),
  },
  db.table.raw('SELECT id, name FROM "someTable"'),
);

// accepts query:
db.table.with('alias', db.table.all());

// accepts a callback for a query builder:
db.table.with('alias', (qb) =>
  qb.select({ one: db.table.raw((t) => t.integer(), '1') }),
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

Creates a union query, taking an array or a list of callbacks, builders, or raw statements to build the union statement, with optional boolean `wrap`. If the `wrap` parameter is true, the queries will be individually wrapped in parentheses.

```ts
SomeTable.select('id', 'name').union(
  [
    OtherTable.select('id', 'name'),
    SomeTable.raw(`SELECT id, name FROM "thirdTable"`),
  ],
  true, // optional wrap parameter
);
// Other methods takes the same arguments,
// they are different by SQL keyword:
// .unionAll(...)
// .intersect(...)
// .intersectAll(...)
// .except(...)
// .exceptAll(...)
```

## window functions

Window functions such as `row_number`, and `rank`.

Each of the window functions can accept such options:

```ts
type AggregateOptions = {
  // set select alias
  as?: string;

  // Expression can be a table column name or db.table.raw()
  partitionBy?: Expression | Expression[];

  order?:
    | {
        [columnName]: 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'DESC NULLS LAST';
      }
    | RawExpression;
};
```

### selectRowNumber

Selects the` row_number` window function.

Returns the number of the current row within its partition, counting from 1.

```ts
// result is of type Array<{ id: number, rowNumber: number }>
const result = await db.table.select('id').selectRowNumber({
  as: 'rowNumber',
  partitionBy: 'someColumn',
  order: { createdAt: 'ASC' },
});
```

### selectRank

Selects the` rank` window function.

Returns the rank of the current row, with gaps; that is, the row_number of the first row in its peer group.

```ts
// result is of type Array<{ id: number, rank: number }>
const result = await db.table.select('id').selectRank({
  as: 'rank',
  partitionBy: 'someColumn',
  order: { createdAt: 'ASC' },
});
```

### selectDenseRank

Selects the` dense_rank` window function.

Returns the rank of the current row, without gaps; this function effectively counts peer groups.

```ts
// result is of type Array<{ id: number, denseRank: number }>
const result = await db.table.select('id').selectDenseRank({
  as: 'denseRank',
  partitionBy: 'someColumn',
  order: { createdAt: 'ASC' },
});
```

### selectPercentRank

Selects the `percent_rank` window function.

Returns the relative rank of the current row, that is (rank - 1) / (total partition rows - 1). The value thus ranges from 0 to 1 inclusive.

```ts
// result is of type Array<{ id: number, percentRank: number }>
const result = await db.table.select('id').selectPercentRank({
  as: 'percentRank',
  partitionBy: 'someColumn',
  order: { createdAt: 'ASC' },
});
```

### selectCumeDist

Selects the `cume_dist` window function.

Returns the cumulative distribution, that is (number of partition rows preceding or peers with current row) / (total partition rows). The value thus ranges from 1/N to 1.

```ts
// result is of type Array<{ id: number, cumeDist: number }>
const result = await db.table.select('id').selectCumeDist({
  as: 'cumeDist',
  partitionBy: 'someColumn',
  order: { createdAt: 'ASC' },
});
```

## columnInfo

Returns an object with the column info about the current table, or an individual column if one is passed, returning an object with the following keys:

```ts
type ColumnInfo = {
  defaultValue: unknown; // the default value for the column
  type: string; // the column type
  maxLength: number | null; // the max length set for the column, present on string types
  nullable: boolean; // whether the column may be null
};

// columnInfo has type Record<string, ColumnInfo>, where string is name of columns
const columnInfo = await db.table.columnInfo();

// singleColumnInfo has the type ColumnInfo
const singleColumnInfo = await db.table.columnInfo('name');
```

## copy

`copy` is a method to invoke a `COPY` SQL statement, it can copy from or to a file or a program.

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
await db.table.copy({
  columns: ['id', 'title', 'description'],
  from: 'path-to-file',
});
```

## jsonPathQuery

Selects a value from JSON data using a JSON path.

```ts
import { columnTypes } from 'pqb';

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

Return a JSON value/object/array where a given value is set at the given path.
The path is an array of keys to access the value.

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

Return a JSON value/object/array where a given value is inserted at the given JSON path. Value can be a single value or JSON object. If a value exists at the given path, the value is not replaced.

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
    insertAfter: true, // insert after specified position
  })
  .take();

// 'one' is inserted to 0 position
expect(result.alias).toEqual({ tags: ['one', 'two'] });
```

## jsonRemove

Return a JSON value/object/array where a given value is removed at the given JSON path.

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
