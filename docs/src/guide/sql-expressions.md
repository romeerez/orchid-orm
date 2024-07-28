# SQL expressions

## sql

[//]: # 'has JSDoc'

When there is a need to use a piece of raw SQL, use the `sql` exported from the `BaseTable` file, it is also attached to query objects for convenience.

When selecting a custom SQL, specify a resulting type with `<generic>` syntax:

```ts
import { sql } from './baseTable';

const result: { num: number }[] = await db.table.select({
  num: sql<number>`random() * 100`,
});
```

In a situation when you want the result to be parsed, such as when returning a timestamp that you want to be parsed into a `Date` object, provide a column type in such a way:

This example assumes that the `timestamp` column was overridden with `asDate` as shown in [Override column types](/guide/columns-overview#override-column-types).

```ts
import { sql } from './baseTable';

const result: { timestamp: Date }[] = await db.table.select({
  timestamp: sql`now()`.type((t) => t.timestamp()),
});
```

In some cases such as when using [from](/guide/orm-and-query-builder#from), setting column type via callback allows for special `where` operations:

```ts
const subQuery = db.someTable.select({
  sum: (q) => q.sql`$a + $b`.type((t) => t.decimal()).values({ a: 1, b: 2 }),
});

// `gt`, `gte`, `min`, `lt`, `lte`, `max` in `where`
// are allowed only for numeric columns:
const result = await db.$from(subQuery).where({ sum: { gte: 5 } });
```

Many query methods have a version suffixed with `Sql`, you can pass an SQL template literal directly to these methods.
These methods are: `whereSql`, `whereNotSql`, `orderSql`, `havingSql`, `fromSql`, `findBySql`.

```ts
await db.table.whereSql`"someValue" = random() * 100`;
```

Interpolating values in template literals is completely safe:

```ts
// get value from user-provided params
const { value } = req.params;

// SQL injection is prevented by a library, this is safe:
await db.table.whereSql`column = ${value}`;
```

In the example above, TS cannot check if the table has `column` column, or if there are joined tables that have such column which will lead to error.
Instead, use the [column](/guide/sql-expressions#column) or [ref](/guide/sql-expressions#ref) to reference a column:

```ts
// ids will be prefixed with proper table names, no ambiguity:
db.table.join(db.otherTable, 'id', 'other.otherId').where`
  ${db.table.column('id')} = 1 AND
  ${db.otherTable.ref('id')} = 2
`;
```

SQL can be passed with a simple string, it's important to note that this is not safe to interpolate values in it.

```ts
import { sql } from './baseTable';

// no interpolation is okay
await db.table.where(sql({ raw: 'column = random() * 100' }));

// get value from user-provided params
const { value } = req.params;

// this is NOT safe, SQL injection is possible:
await db.table.where(sql({ raw: `column = random() * ${value}` }));
```

To inject values into `sql({ raw: '...' })` SQL strings, denote it with `$` in the string and provide `values` object.

Use `$$` to provide column or/and table name (`column` or `ref` are preferable). Column names will be quoted so don't quote them manually.

```ts
import { sql } from './baseTable';

// get value from user-provided params
const { value } = req.params;

// this is SAFE, SQL injection are prevented:
await db.table.where(
  sql<boolean>({
    raw: '$$column = random() * $value',
    values: {
      column: 'someTable.someColumn', // or simply 'column'
      one: value,
      two: 123,
    },
  }),
);
```

Summarizing:

```ts
import { sql } from './baseTable';

// simplest form:
sql`key = ${value}`;

// with resulting type:
sql<boolean>`key = ${value}`;

// with column type for select:
sql`key = ${value}`.type((t) => t.boolean());

// with column name via `column` method:
sql`${db.table.column('column')} = ${value}`;

// raw SQL string, not allowed to interpolate values:
sql({ raw: 'random()' });

// with resulting type and `raw` string:
sql<number>({ raw: 'random()' });

// with column name and a value in a `raw` string:
sql({
  raw: `$$column = $value`,
  values: { column: 'columnName', value: 123 },
});

// combine template literal, column type, and values:
sql`($one + $two) / $one`.type((t) => t.numeric()).values({ one: 1, two: 2 });
```

## column

[//]: # 'has JSDoc'

`column` references a table column, this can be used in raw SQL or when building a column expression.
Only for referencing a column in the query's table. For referencing joined table's columns, see [ref](#ref).

```ts
await db.table.select({
  // select `("table"."id" = 1 OR "table"."name" = 'name') AS "one"`,
  // returns a boolean
  one: (q) =>
    q.sql<boolean>`${q.column('id')} = ${1} OR ${q.column('name')} = ${'name'}`,

  // selects the same as above, but by building a query
  two: (q) => q.column('id').equals(1).or(q.column('name').equals('name')),
});
```

## ref

[//]: # 'has JSDoc'

`ref` is similar to [column](#column), but it also allows to reference a column of joined table,
and other dynamically defined columns.

```ts
await db.table.join('otherTable').select({
  // select `("otherTable"."id" = 1 OR "otherTable"."name" = 'name') AS "one"`,
  // returns a boolean
  one: (q) =>
    q.sql<boolean>`${q.ref('otherTable.id')} = ${1} OR ${q.ref(
      'otherTable.name',
    )} = ${'name'}`,

  // selects the same as above, but by building a query
  two: (q) =>
    q
      .ref('otherTable.id')
      .equals(1)
      .or(q.ref('otherTable.name').equals('name')),
});
```

## fn

[//]: # 'has JSDoc'

`fn` allows to call an arbitrary SQL function.

For example, calling `sqrt` function to get a square root from some numeric column:

```ts
const q = await User.select({
  sqrt: (q) => q.fn<number>('sqrt', ['numericColumn']),
}).take();

q.sqrt; // has type `number` just as provided
```

If this is an aggregate function, you can specify aggregation options (see [Aggregate](/guide/aggregate)) via third parameter.

Use `type` method to specify a column type so that its operators such as `lt` and `gt` become available:

```ts
const q = await User.select({
  // Produces `sqrt("numericColumn") > 5`
  sqrtIsGreaterThan5: (q) =>
    q
      .fn('sqrt', ['numericColumn'])
      .type((t) => t.float())
      .gt(5),
}).take();

// Return type is boolean | null
// todo: it should be just boolean if the column is not nullable, but for now it's always nullable
q.sqrtIsGreaterThan5;
```
