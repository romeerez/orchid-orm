# Where conditions

## where

Constructing `WHERE` conditions:

```ts
Table.where({
  // column of the current table
  name: 'John',

  // table name may be specified, it can be the name of a joined table
  'table.lastName': 'Johnsonuk',

  // object with operators, see the "column operators" section to see a full list of them:
  age: {
    gt: 30,
    lt: 70,
  },

  // where column equals to raw SQL
  column: Table.raw('raw expression')
})

```

`undefined` values are ignored, so you can supply a partial object with conditions:

```ts
type Params = {
  // allow providing exact age, or lower or greate than
  age?: number | { lt?: number; gt?: number }
}

const loadRecords = async (params: Params) => {
  // this will load all records if params is an empty object
  const records = await Table.where(params)
}
```

`.where` can accept other queries and merge their conditions:

```ts
const otherQuery = Table.where({ name: 'John' })

Table.where({ id: 1 }, otherQuery)
// this will produce WHERE "table"."id" = 1 AND "table"."name' = 'John'
```

`.where` supports raw argument:

```ts
Table.where(Table.raw('a = b'))
```

`.where` can accept a callback with a specific query builder containing all "where" methods such as `.where`, `.or`, `.whereNot`, `.whereIn`, `.whereExists`:

```ts
Table.where((q) =>
  q.where({ name: 'Name' })
    .or({ id: 1 }, { id: 2 })
    .whereIn('letter', ['a', 'b', 'c'])
    .whereExists(Message, 'authorId', 'id')
)
```

`.where` can accept multiple arguments, conditions are joined with `AND`:

```ts
Table.where({ id: 1 }, Table.where({ name: 'John' }), Table.raw('a = b'))
```

### where special keys

The object passed to `.where` can contain special keys, each of the keys corresponds to its own method and takes the same value as the type of argument of the method.

For example:

```ts
Table.where({
  NOT: { key: 'value' },
  OR: [{ name: 'a' }, { name: 'b' }],
  IN: { columns: ['id', 'name'], values: [[1, 'a'], [2, 'b']] },
})
```

Using methods instead of this is a shorter and cleaner way, but in some cases, such object keys way may be more convenient.

Currently `EXISTS` key is not type safe, so it cannot check if specified columns really belongs to a target table,
better to use `whereExists` method instead that does the checks.

```ts
Table.where({
  // see .whereNot
  NOT: { id: 1 },
  // can be an array:
  NOT: [{ id: 1 }, { id: 2 }],

  // see .or
  OR: [{ name: 'a' }, { name: 'b' }],
  // can be an array:
  // this will give id = 1 AND id = 2 OR id = 3 AND id = 4
  OR: [[{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 4 }]],

  // see .in, the key syntax requires an object with columns and values
  IN: { columns: ['id', 'name'], values: [[1, 'a'], [2, 'b']] },
  // can be an array:
  IN: [
    { columns: ['id', 'name'], values: [[1, 'a'], [2, 'b']] },
    { columns: ['someColumn'], values: [['foo', 'bar']] },
  ],

  // see .whereExists
  EXISTS: [OtherTable, 'someId', 'id'],
  // can be an array:
  EXISTS: [
    [SomeTable, 'someId', 'id'],
    [AnotherTable, 'anotherId', 'id'],
  ]
})
```

## and

`.and` is an alias for `.where` to make it closer to SQL:

```ts
Table.where({ id: 1 }).and({ name: 'John' })
```

## or

`.or` is accepting the same arguments as `.where`, joining arguments with `OR`.

Columns in single arguments are still joined with `AND`.

The database is processing `AND` before `OR`, so this should be intuitively clear.

```ts
Table.or({ id: 1, color: 'red' }, { id: 2, color: 'blue' })
````

This query will produce such SQL (simplified):
```sql
SELECT * FROM "table"
WHERE id = 1 AND color = 'red'
   OR id = 2 AND color = 'blue'
```

## find

The `find` method is available only for tables which has exactly one primary key.

Find record by id, throw [NotFoundError](/guide/query-builder-error-handling.html) if not found:

```ts
await Table.find(1)
```

## findOptional

Find record by id, returns `undefined` when not found:

```ts
await Table.findOptional(1)
```

## findBy

`.findBy` Takes the same arguments as `.where` and returns a single record, throwing `NotFoundError` if not found.

```ts
Table.findBy(...conditions)
// is equivalent to:
Table.where(...conditions).take()
```

## findOptional

`.findOptional` Takes the same arguments as `.where` and returns a single record, returns `undefined` when not found:

```ts
Table.findOptional(...conditions)
// is equivalent to:
Table.where(...conditions).takeOptional()
```

## whereNot

`.whereNot` takes the same arguments as `.where` and prepends them with `NOT` in SQL

```ts
// find records of different colors than red
Table.whereNot({ color: 'red' })
```

## andNot

`.andNot` is an alias for `.whereNot`

## orNot

`.orNot` takes the same arguments as `.or`, and prepends each condition with `NOT` just as `.whereNot` does.

## whereIn, orWhereIn, whereNotIn, orWhereNotIn

`.whereIn` and related methods are for the `IN` operator to check for inclusion in a list of values.

`.orWhereIn` acts as `.or`, `.whereNotIn` acts as `.whereNot`, and `.orWhereNotIn` acts as `.orNot`.

When used with a single column it works equivalent to the `in` column operator:

```ts
Table.whereIn('column', [1, 2, 3])
// the same as:
Table.where({ column: [1, 2, 3] })
```

`.whereIn` can support a tuple of columns, that's what the `in` operator cannot support:

```ts
Table.whereIn(
  ['id', 'name'],
  [[1, 'Alice'], [2, 'Bob']],
)
```

It supports sub query which should return records with columns of the same type:

```ts
Table.whereIn(
  ['id', 'name'],
  OtherTable.select('id', 'name'),
)
```

It supports raw query:

```ts
Table.whereIn(
  ['id', 'name'],
  Table.raw(`((1, 'one'), (2, 'two'))`)
)
```

## whereExists, orWhereExists, whereNotExists, orWhereNotExists

`.whereExists` and related methods are for support of the `WHERE EXISTS (query)` clause.

This method is accepting the same arguments as `.join`, see the [join](#join) section for more details.

`.orWhereExists` acts as `.or`, `.whereNotExists` acts as `.whereNot`, and `.orWhereNotExists` acts as `.orNot`.

```ts
User.whereExists(Account, 'account.id', 'user.id')

User.whereExists(Account, (q) =>
  q.on('account.id', '=', 'user.id')
)
```

## exists

Use `.exists()` to check if there is at least one record-matching condition.

It will discard previous `.select` statements if any. Returns a boolean.

```ts
const exists: boolean = await Table.where(...conditions).exists()
```

## column operators

`.where` argument can take an object where the key is the name of the operator and the value is its argument.

Different types of columns support different sets of operators.

All column operators can take a value of the same type as the column, a sub-query, or a raw expression:

```ts
Table.where({
  numericColumn: {
    // lower than 5
    lt: 5,

    // lower than the value returned by sub-query
    lt: OtherTable.select('someNumber').take(),

    // raw expression produces WHERE "numericColumn" < "otherColumn" + 10
    lt: Table.raw('"otherColumn" + 10')
  }
})
```

### Any type of column operators

`equals` is a simple `=` operator, it may be useful for comparing column value with JSON object:

```ts
Table.where({
  // this will fail because an object with operators is expected
  jsonColumn: someObject,

  // use this instead:
  jsonColumn: { equals: someObject },
})
```

`not` is `!=` (or `<>`) not equal operator:

```ts
Table.where({
  anyColumn: { not: value }
})
```

`in` is for the `IN` operator to check if the column value is included in a list of values.

Takes an array of the same type as a column, a sub-query that returns a list of values, or a raw expression that returns a list.

```ts
Table.where({
  column: {
    in: ['a', 'b', 'c'],

    // WHERE "column" IN (SELECT "column" FROM "otherTable")
    in: OtherTable.select('column'),

    in: Table.raw("('a', 'b')")
  }
})
```

`notIn` is for the `NOT IN` operator, and takes the same arguments as `in`

### Numeric, Date, and Time column operators

To compare numbers, dates, and times.

`lt` is for `<` (lower than)

`lte` is for `<=` (lower than or equal)

`gt` is for `>` (greater than)

`gte` is for `>=` (greater than or equal)

```ts
Table.where({
  numericColumn: {
    gt: 5,
    lt: 10,
  },

  date: {
    lte: new Date()
  },

  time: {
    gte: new Date(),
  },
})
```

`between` also works with numeric, dates, and time columns, it takes an array of two elements.

Both elements can be of the same type as a column, a sub-query, or a raw query.

```ts
Table.where({
  column: {
    // simple values
    between: [1, 10],

    // sub-query and raw expression
    between: [
      OtherTable.select('column').take(),
      Table.raw('2 + 2'),
    ],
  }
})
```

### Text column operators

For `text`, `char`, `varchar`, and `json` columns.

`json` is stored as text, so it has text operators. Use the `jsonb` type for JSON operators.

Takes a string, or sub-query returning string, or raw expression as well as other operators.

```ts
Table.where({
  textColumn: {
    // WHERE "textColumn" LIKE '%string%'
    contains: 'string',
    // WHERE "textColumn" ILIKE '%string%'
    containsInsensitive: 'string',
    // WHERE "textColumn" LIKE 'string%'
    startsWith: 'string',
    // WHERE "textColumn" ILIKE 'string%'
    startsWithInsensitive: 'string',
    // WHERE "textColumn" LIKE '%string'
    endsWith: 'string',
    // WHERE "textColumn" ILIKE '%string'
    endsWithInsensitive: 'string',
  }
})
```

### JSONB column operators

For the `jsonb` column, note that the `json` type has text operators instead.

`jsonPath` operator: compare a column value under a given JSON path with the provided value.

Value can be of any type to compare with JSON value, or it can be a sub-query or a raw expression.

```ts
Table.where({
  jsonbColumn: {
    jsonPath: [
      '$.name', // first element is JSON path
      '=', // second argument is comparison operator
      'value' // third argument is a value to compare with
    ]
  }
})
```

`jsonSupersetOf`: check if the column value is a superset of provided value.

For instance, it is true if the column has JSON `{ "a": 1, "b": 2 }` and provided value is `{ "a": 1 }`.

Takes the value of any type, or sub query which returns a single value, or a raw expression.

```ts
Table.where({
  jsonbColumn: {
    jsonSupersetOf: { a: 1 },
  }
})
```

`jsonSubsetOf`: check if the column value is a subset of provided value.

For instance, it is true if the column has JSON `{ "a": 1 }` and provided value is `{ "a": 1, "b": 2 }`.

Takes the value of any type, or sub query which returns a single value, or a raw expression.

```ts
Table.where({
  jsonbColumn: {
    jsonSupersetOf: { a: 1 },
  }
})
```
