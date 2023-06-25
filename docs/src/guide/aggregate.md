# Aggregate functions

Various aggregate functions are supported (count, min, max, string_agg, etc) and it's possible to call a custom aggregate function.

Each of the functions can accept such options:

```ts
type AggregateOptions = {
  // set select alias
  as?: string;

  // add DISTINCT inside of function call
  distinct?: boolean;

  // the same argument as in .order() to be set inside of function call
  order?: OrderArg | OrderArg[];

  // the same argument as in .where() to be set inside of function call
  filter?: WhereArg;

  // the same argument as in .or() to support OR logic of the filter clause
  filterOr?: WhereArg[];

  // adds WITHIN GROUP SQL statement
  withinGroup?: boolean;

  // defines OVER clause.
  // Can be the name of a window defined by calling the .window() method,
  // or object the same as the .window() method takes to define a window.
  over?: WindowName | WindowArg;
};
```

## count, selectCount

Performs count, returns number:

```ts
// count all:
const number = db.table.count();

// count where a column is not NULL:
db.table.count('name');

// see options above:
db.table.count('*', aggregateOptions);
```

`selectCount` supports the same parameters as `count`, used with `group`.

Select count among other fields:

```ts
// record contains both id and count
const record = db.table.select('id').selectCount().group('id').take();
```

## min, selectMin

Gets the minimum value for the specified column, returns number or `null`.

```ts
const numberOrNull = db.table.min('numericColumn', aggregateOptions);
```

`selectMin` supports the same parameters as `min`, used with `group`.

Select min among other fields:

```ts
// record contains both id and min
const record = db.table
  .select('id')
  .selectMin('numericColumn')
  .group('id')
  .take();
```

## max, selectMax

Gets the maximum value for the specified column, returns number or `null`.

```ts
const numberOrNull = db.table.max('numericColumn', aggregateOptions);
```

`selectMax` supports the same parameters as `max`, used with `group`.

Select max among other fields:

```ts
// record contains both id and max
const record = db.table
  .select('id')
  .selectMax('numericColumn')
  .group('id')
  .take();
```

## sum, selectSum

Retrieve the sum of the values of a given column, returns number or `null`.

```ts
const numberOrNull = db.table.sum('numericColumn', aggregateOptions);
```

`selectSum` supports the same parameters as `sum`, used with `group`.

Select sum among other fields:

```ts
// record contains both id and sum
const record = db.table
  .select('id')
  .selectSum('numericColumn')
  .group('id')
  .take();
```

## avg, selectAvg

Retrieve the average of the values, and returns a number or `null`.

```ts
const numberOrNull = db.table.avg('numericColumn', aggregateOptions);
```

`selectAvg` supports the same parameters as `avg`, used with `group`.

Select avg among other fields:

```ts
// record contains both id and avg
const record = db.table
  .select('id')
  .selectAvg('numericColumn')
  .group('id')
  .take();
```

## bitAnd, selectBitAnd

Bitwise and aggregation, return `number` or `null`

```ts
const numberOrNull = db.table.bitAnd('numericColumn', aggregateOptions);
```

`selectBitAnd` supports the same parameters as `bitAnd`, used with `group`.

Select bit and among other fields:

```ts
// record contains both id and bit and
const record = db.table
  .select('id')
  .selectBitAnd('numericColumn')
  .group('id')
  .take();
```

## bitOr, selectBitOr

Bitwise or aggregation returns `number` or `null`

```ts
const numberOrNull = db.table.bitOr('numericColumn', aggregateOptions);
```

`selectBitOr` supports the same parameters as `bitOr`, used with `group`.

Select bit or among other fields:

```ts
// record contains both id and bit or
const record = db.table
  .select('id')
  .selectBitOr('numericColumn')
  .group('id')
  .take();
```

## boolAnd, selectBoolAnd

Aggregate booleans with and logic returns `boolean` or `null`

```ts
const booleanOrNull = db.table.boolAnd('booleanColumn', aggregateOptions);
```

`selectBoolAnd` supports the same parameters as `boolAnd`, used with `group`.

Select bool and among other fields:

```ts
// record contains both id and bool and
const record = db.table
  .select('id')
  .selectBoolAnd('booleanColumn')
  .group('id')
  .take();
```

## boolOr, selectBoolOr

Aggregate booleans with or logic returns `boolean` or `null`

```ts
const booleanOrNull = db.table.boolOr('booleanColumn', aggregateOptions);
```

`selectBoolOr` supports the same parameters as `boolOr`, used with `group`.

Select bool or among other fields:

```ts
// record contains both id and bool or
const record = db.table
  .select('id')
  .selectBoolOr('booleanColumn')
  .group('id')
  .take();
```

## every, selectEvery

Equivalent to `boolAnd`.

## jsonAgg, selectJsonAgg, jsonbAgg, selectJsonbAgg

Aggregate values into an array return array column values or `null`.

`jsonAgg` is different from `jsonbAgg` by internal representation in the database, possibly one of them will work a bit faster.

```ts
// ids have type number[] | null
const idsOrNull = db.table.jsonAgg('id', aggregateOptions);

// names have type string[] | null
const namesOrNull = db.table.jsonbAgg('name', aggregateOptions);
```

`selectJsonAgg` supports the same parameters as `jsonAgg`, used with `group`.

```ts
// record contains both id and ids
const record = db.table
  .select('id')
  .selectJsonAgg('id', { as: 'ids' })
  .group('id')
  .take();
```

## jsonObjectAgg, selectJsonObjectAgg, jsonbObjectAgg, selectJsonbObjectAgg

It does the construction of JSON objects, keys are provided strings and values can be table columns or raw SQL expressions, and returns `object` or `null`.

`jsonObjectAgg` is different from `jsonbObjectAgg` by internal representation in the database, possibly one of them will work a bit faster.

```ts
import { TextColumn } from './string';

// object have type { nameAlias: string, foo: string } | null
const object = db.table.jsonAgg(
  {
    nameAlias: 'name',
    foo: db.table.sql((t) => t.text(3, 100))`"bar" || "baz"`,
  },
  aggregateOptions,
);
```

`selectJsonObjectAgg` supports the same parameters as `jsonObjectAgg`, used with `group`.

```ts
// record contains both id and object
const record = db.table
  .select('id')
  .selectJsonObjectAgg({ nameAlias: 'name' }, { as: 'object' })
  .group('id')
  .take();
```

## stringAgg, selectStringAgg

It performs the joining of a string using a delimiter and returns `string` or `null`.

```ts
const stringOrNull = db.table.stringAgg('name', ', ', aggregateOptions);
```

`selectStringAgg` supports the same parameters as `stringAgg`, used with `group`.

```ts
// record contains both id and names
const record = db.table
  .select('id')
  .selectStringAgg('name', ', ', aggregateOptions)
  .group('id')
  .take();
```

## xmlAgg, selectXmlAgg

No one uses XML nowadays, this method is here for collection.

The argument is a column of XML type, that returns a `string` or `null`.

```ts
// xml is of type string | null
const xml = await LegacyTable.xmlAgg('xmlColumn', aggregateOptions);
```

`selectXmlAgg` supports the same parameters as `xmlAgg`, used with `group`.

```ts
// record contains both id and xmlData
const record = LegacyTable.select('id')
  .selectJsonAgg('xmlColumn', { as: 'xmlData' })
  .group('id')
  .take();
```
