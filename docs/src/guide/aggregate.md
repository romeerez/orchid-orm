# Aggregate functions

Various aggregate functions are supported (count, min, max, string_agg, etc.) and it's possible to call a custom aggregate function.

Each aggregate function is accepting such options:

```ts
type AggregateOptions = {
  // Add DISTINCT inside of function call.
  distinct?: boolean;

  // The same argument as in .order() to be set inside of function call.
  order?: OrderArg | OrderArg[];

  // The same argument as in .where() to be set inside of function call.
  filter?: WhereArg;

  // The same argument as in .orWhere() to support OR logic of the filter clause.
  filterOr?: WhereArg[];

  // Adds WITHIN GROUP SQL statement.
  withinGroup?: boolean;

  // Defines OVER clause.
  // Can be the name of a window defined by calling the .window() method,
  // or object the same as the .window() method takes to define a window.
  over?: WindowName | OverOptions;
};
```

Calling aggregate function on a table will return a simple value:

```ts
const result: number = await db.table.count();
```

All functions can be called inside a `select` callback to select an aggregated value:

```ts
// avg can be null in case when no records
const result: { count: number; avg: number | null }[] = await db.table.select({
  count: (q) => q.count(),
  avg: (q) => q.avg('price'),
});
```

They can be used in [having](/guide/query-methods.html#having):

```ts
db.table.having((q) => q.count().gte(10));
```

Functions can be chained with [column operators](/guide/where.html#column-operators).
Strictly according to the return type of the function, `count` can be chained with `gt` but not with `contains`.

```ts
// numeric functions can be chained with `gt`, `lt`, and other numeric operators:
const bool = await db.table.sum('numericColumn').gt(5);

await db.table.select({
  someTitleContainsXXX: (q) => q.stringAgg('title').contains('xxx'),
  notAllBooleansAreTrue: (q) => q.boolAnd('booleanColumn').not(true),
});
```

Multiple aggregate functions can be joined with `and` or `or` in a such way:

```ts
// SELECT count(*) > 5 AND "numericColumn" < 100 FROM "table"
const bool = await db.table
  .count()
  .gt(5)
  .and(db.table.sum('numericColumn').lt(100));

const { theSameBool } = await db.table.select({
  theSameBool: (q) => q.count().gt(5).and(q.sum('numericColumn').lt(100)),
});
```

## fn

`fn` allows to call an arbitrary SQL function.

For example, calling `sqrt` function to get a square root from some numeric column:

```ts
const q = await User.select({
  sqrt: (q) => q.fn<number>('sqrt', ['numericColumn']),
}).take();

q.sqrt; // has type `number` just as provided
```

If this is an aggregate function, you can specify aggregation options via third parameter.

Forth parameter is for runtime column type. When specified, allows to chain the function with the column operators:

```ts
const q = await User.select({
  // chain `sqrt("numericColumn")` with the "greater than 5"
  sqrtIsGreaterThan5: (q) =>
    q.fn('sqrt', ['numericColumn'], {}, (t) => t.float()).gt(5),
}).take();

// Return type is boolean | null
// todo: it should be just boolean if the column is not nullable, but for now it's always nullable
q.sqrtIsGreaterThan5;
```

## count

[//]: # 'has JSDoc'

Count records with the `count` function:

```ts
// count all records:
const result: number = await db.table.count();

// count records where a column is not NULL:
db.table.count('name');

// see options above:
db.table.count('*', aggregateOptions);

// select counts of people grouped by city
db.people
  .select('city', {
    population: (q) => q.count(),
  })
  .group('city');
```

## min

[//]: # 'has JSDoc'

Get the minimum value for the specified numeric column, returns number or `null` if there are no records.

```ts
const result: number | null = await db.table.min(
  'numericColumn',
  aggregateOptions,
);

// select min product price grouped by product category
db.product
  .select('category', {
    minPrice: (q) => q.min('price'),
  })
  .group('category')
  .take();
```

## max

[//]: # 'has JSDoc'

Gets the maximum value for the specified numeric column, returns number or `null` if there are no records.

```ts
const result: number | null = await db.table.max(
  'numericColumn',
  aggregateOptions,
);

// select max product price grouped by product category
db.product
  .select('category', {
    maxPrice: (q) => q.max('price'),
  })
  .group('category')
  .take();
```

## sum

[//]: # 'has JSDoc'

Retrieve the sum of the values of a given numeric column, returns number or `null` if there are no records.

```ts
const result: number | null = await db.table.sum(
  'numericColumn',
  aggregateOptions,
);

// select sum of employee salaries grouped by years
db.employee
  .select('year', {
    yearlySalaries: (q) => q.sum('salary'),
  })
  .group('year');
```

## avg

[//]: # 'has JSDoc'

Retrieve the average value of a numeric column, it returns a number or `null` if there are no records.

```ts
const result: number | null = db.table.avg('numericColumn', aggregateOptions);

// select average movies ratings
db.movie
  .select('title', {
    averageRating: (q) => q.avg('rating'),
  })
  .group('title');
```

## bitAnd

[//]: # 'has JSDoc'

Bitwise `and` aggregation, returns `number` or `null` if there are no records.

```ts
const result: number | null = db.table.bitAnd(
  'numericColumn',
  aggregateOptions,
);

// select grouped `bitAnd`
db.table
  .select('someColumn', {
    bitAnd: (q) => q.bitAnd('numericColumn'),
  })
  .group('someColumn');
```

## bitOr

[//]: # 'has JSDoc'

Bitwise `or` aggregation, returns `number` or `null` if there are no records.

```ts
const result: number | null = db.table.bitOr('numericColumn', aggregateOptions);

// select grouped `bitOr`
db.table
  .select('someColumn', {
    bitOr: (q) => q.bitOr('numericColumn'),
  })
  .group('someColumn');
```

## boolAnd

[//]: # 'has JSDoc'

Aggregate booleans with `and` logic, it returns `boolean` or `null` if there are no records.

```ts
const result: boolean | null = db.table.boolAnd(
  'booleanColumn',
  aggregateOptions,
);

// select grouped `boolAnd`
db.table
  .select('someColumn', {
    boolAnd: (q) => q.boolAnd('booleanColumn'),
  })
  .group('someColumn');
```

## boolOr

[//]: # 'has JSDoc'

Aggregate booleans with `or` logic, it returns `boolean` or `null` if there are no records.

```ts
const result: boolean | null = db.table.boolOr(
  'booleanColumn',
  aggregateOptions,
);

// select grouped `boolOr`
db.table
  .select('someColumn', {
    boolOr: (q) => q.boolOr('booleanColumn'),
  })
  .group('someColumn');
```

## every

[//]: # 'has JSDoc'

Equivalent to `boolAnd`.

## jsonAgg and jsonbAgg

[//]: # 'has JSDoc'

Aggregate values into an array by using `json_agg`. Returns array of values or `null` if there are no records.

`jsonAgg` is working a bit faster, `jsonbAgg` is better only when applying JSON operations in SQL.

```ts
const idsOrNull: number[] | null = db.table.jsonAgg('id', aggregateOptions);

const namesOrNull: string[] | null = db.table.jsonbAgg(
  'name',
  aggregateOptions,
);

// select grouped `jsonAgg`
db.table
  .select('someColumn', {
    jsonAgg: (q) => q.jsonAgg('anyColumn'),
  })
  .group('someColumn');
```

## jsonObjectAgg and jsonbObjectAgg

[//]: # 'has JSDoc'

It does the construction of JSON objects, keys are provided strings and values can be table columns or raw SQL expressions, and returns `object` or `null` if no records.

`jsonObjectAgg` is different from `jsonbObjectAgg` by internal representation in the database, `jsonObjectAgg` is a bit faster as it constructs a simple string.

```ts
import { TextColumn } from './string';

// object has type { nameAlias: string, foo: string } | null
const object = await db.table.jsonObjectAgg(
  {
    // select a column with alias
    nameAlias: 'name',
    // select raw SQL with alias
    foo: db.table.sql<string>`"bar" || "baz"`,
  },
  aggregateOptions,
);

// select aggregated object
db.table.select('id', {
  object: (q) =>
    q.jsonObjectAgg({
      nameAlias: 'name',
      foo: db.table.sql<string>`"bar" || "baz"`,
    }),
});
```

## stringAgg

[//]: # 'has JSDoc'

Select joined strings, it returns a string or `null` if no records.

```ts
const result: string | null = db.table.stringAgg(
  'name',
  ', ',
  aggregateOptions,
);

// select joined strings grouped by some column
db.table
  .select('someColumn', {
    joinedNames: (q) => q.stringAgg('name', ', '),
  })
  .group('someColumn');
```

## xmlAgg

[//]: # 'has JSDoc'

Concatenates `xml` columns, returns a `string` or `null` if no records.

```ts
const xml: string | null = await db.table.xmlAgg('xmlColumn', aggregateOptions);

// select joined XMLs grouped by some column
db.table
  .select('someColumn', {
    joinedXMLs: (q) => q.xmlAgg('xml'),
  })
  .group('someColumn');
```
