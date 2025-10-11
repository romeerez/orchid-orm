---
outline: deep
---

# Where conditions

## where

[//]: # 'has JSDoc'

Constructing `WHERE` conditions:

```ts
import { sql } from './baseTable';

db.table.where({
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
  // import `sql` from your `BaseTable`
  column: sql`sql expression`,
  // or use `(q) => sql` for the same
  column2: (q) => sql`sql expression`,

  // reference other columns in such a way:
  firstName: (q) => q.ref('lastName'),
});
```

Multiple `where`s are joined with `AND`:

```ts
db.table.where({ foo: 'foo' }).where({ bar: 'bar' });
```

```sql
SELECT * FROM table WHERE foo = 'foo' AND bar = 'bar'
```

`undefined` values are ignored, so you can supply a partial object with conditions:

```ts
type Params = {
  // allow providing exact age, or lower or greate than
  age?: number | { lt?: number; gt?: number };
};

const loadRecords = async (params: Params) => {
  // this will load all records if params is an empty object
  const records = await db.table.where(params);
};
```

It supports a sub-query that is selecting a single value to compare it with a column:

```ts
db.table.where({
  // compare `someColumn` in one table with the `column` value returned from another query.
  someColumn: db.otherTable.where(...conditions).get('column'),
});
```

`where` can accept other queries and merge their conditions:

```ts
const otherQuery = db.table.where({ name: 'John' });

db.table.where({ id: 1 }, otherQuery);
// this will produce WHERE "table"."id" = 1 AND "table"."name' = 'John'
```

`where` supports raw SQL:

```ts
db.table.where(sql`a = b`);
```

`where` can accept a callback with a specific query builder containing all "where" methods such as `where`, `orWhere`, `whereNot`, `whereIn`, `whereExists`:

```ts
db.table.where((q) =>
  q
    .where({ name: 'Name' })
    .orWhere({ id: 1 }, { id: 2 })
    .whereIn('letter', ['a', 'b', 'c'])
    .whereExists(Message, 'authorId', 'id'),
);
```

`where` can accept multiple arguments, conditions are joined with `AND`:

```ts
db.table.where({ id: 1 }, db.table.where({ name: 'John' }), sql`a = b`);
```

### where sub query

[//]: # 'has JSDoc'

`where` handles a special callback where you can query a relation to get some value and filter by that value.

It is useful for a faceted search. For instance, posts have tags, and we want to find all posts that have all the given tags.

```ts
const givenTags = ['typescript', 'node.js'];

const posts = await db.post.where(
  (post) =>
    post.tags // query tags of the post
      .whereIn('tagName', givenTags) // where name of the tag is inside array
      .count() // count how many such tags were found
      .equals(givenTags.length), // the count must be exactly the length of array
  // if the post has ony `typescript` tag but not the `node.js` it will be omitted
);
```

This will produce an efficient SQL query:

```sql
SELECT * FROM "post"
WHERE (
  SELECT count(*) = 3
  FROM "tag" AS "tags"
  WHERE "tag"."tagName" IN ('typescript', 'node.js')
    -- join tags to the post via "postTag" table
    AND EXISTS (
      SELECT 1 FROM "postTag"
      WHERE "postTag"."postId" = "post"."id"
        AND "postTag"."tagId" = "tag"."id"
    )
)
```

In the example above we use `count()`, you can also use any other [aggregate method](/guide/aggregate) instead, such as [min](/guide/aggregate#min), [max](/guide/aggregate#max), [avg](/guide/aggregate#avg).

The `count()` is chained with `equals` to check for a strict equality, any other [operation](#column-operators) is also allowed, such as `not`, `lt`, `gt`.

### where special keys

[//]: # 'has JSDoc'

The object passed to `where` can contain special keys, each of the keys corresponds to its own method and takes the same value as the type of argument of the method.

For example:

```ts
db.table.where({
  NOT: { key: 'value' },
  OR: [{ name: 'a' }, { name: 'b' }],
  IN: {
    columns: ['id', 'name'],
    values: [
      [1, 'a'],
      [2, 'b'],
    ],
  },
});
```

Using methods [whereNot](#whereNot), [orWhere](#orWhere), [whereIn](#wherein) instead of this is a shorter and cleaner way, but in some cases, such object keys way may be more convenient.

```ts
db.table.where({
  // see .whereNot
  NOT: { id: 1 },
  // can be an array:
  NOT: [{ id: 1 }, { id: 2 }],

  // see .orWhere
  OR: [{ name: 'a' }, { name: 'b' }],
  // can be an array:
  // this will give id = 1 AND id = 2 OR id = 3 AND id = 4
  OR: [
    [{ id: 1 }, { id: 2 }],
    [{ id: 3 }, { id: 4 }],
  ],

  // see .in, the key syntax requires an object with columns and values
  IN: {
    columns: ['id', 'name'],
    values: [
      [1, 'a'],
      [2, 'b'],
    ],
  },
  // can be an array:
  IN: [
    {
      columns: ['id', 'name'],
      values: [
        [1, 'a'],
        [2, 'b'],
      ],
    },
    { columns: ['someColumn'], values: [['foo', 'bar']] },
  ],
});
```

### whereSql

Use a custom SQL expression in `WHERE` statement:

```ts
db.table.whereSql`a = b`;
```

### whereOneOf

[//]: # 'has JSDoc'

`whereOneOf` stands for "...**and** where one of the given is true".

Accepts the same arguments as `where`.

```ts
db.table.where({ id: 1 }).whereOneOf({ color: 'red' }, { color: 'blue' });
```

```sql
SELECT * FROM table
WHERE id = 1 AND (color = 'red' OR color = 'blue')
```

Note that columns inside every argument are joined with `AND`:

```ts
db.table.whereOneOf({ id: 1, color: 'red' }, { id: 2 });
```

```sql
SELECT * FROM table
WHERE (id = 1 AND color = 'red') OR (id = 2)
```

#### whereNotOneOf

[//]: # 'has JSDoc'

Negative [whereOneOf](#whereoneof):

```ts
db.table.where({ id: 1 }).whereNotOneOf({ color: 'red' }, { color: 'blue' });
```

```sql
SELECT * FROM table
WHERE id = 1 AND NOT (color = 'red' OR color = 'blue')
```

### orWhere

[//]: # 'has JSDoc'

`orWhere` stands for "...**or** where one of the given is true".

Accepts the same arguments as `where`.

```ts
db.table.where({ id: 1, color: 'red' }).orWhere({ id: 2, color: 'blue' });
// equivalent:
db.table.orWhere({ id: 1, color: 'red' }, { id: 2, color: 'blue' });
```

```sql
SELECT * FROM table
WHERE (id = 1 AND color = 'red') OR (id = 2 AND color = 'blue')
```

### whereNot

[//]: # 'has JSDoc'

`whereNot` takes the same argument as `where`,
multiple conditions are combined with `AND`,
the whole group of conditions is negated with `NOT`.

```ts
// find records of different colors than red
db.table.whereNot({ color: 'red' });
// WHERE NOT color = 'red'
db.table.whereNot({ one: 1, two: 2 });
// WHERE NOT (one = 1 AND two = 2)
```

#### whereNotSql

[//]: # 'has JSDoc'

`whereNotSql` is a version of `whereNot` accepting SQL expression:

```ts
db.table.whereNotSql`sql expression`;
```

#### orWhereNot

[//]: # 'has JSDoc'

`orWhereNot` takes the same arguments as `orWhere`, and prepends each condition with `NOT` just as `whereNot` does.

### whereIn

[//]: # 'has JSDoc'

`whereIn` and related methods are for the `IN` operator to check for inclusion in a list of values.

When used with a single column it works equivalent to the `in` column operator:

```ts
db.table.whereIn('column', [1, 2, 3]);
// the same as:
db.table.where({ column: [1, 2, 3] });
```

`whereIn` can support a tuple of columns, that's what the `in` operator cannot support:

```ts
db.table.whereIn(
  ['id', 'name'],
  [
    [1, 'Alice'],
    [2, 'Bob'],
  ],
);
```

It supports sub query which should return records with columns of the same type:

```ts
db.table.whereIn(['id', 'name'], OtherTable.select('id', 'name'));
```

It supports raw SQL expression:

```ts
db.table.whereIn(['id', 'name'], sql`((1, 'one'), (2, 'two'))`);
```

When empty set of values is given, `whereIn` will resolve into a [none](/guide/query-methods#none) query that has a special behavior.

```ts
// following queries resolves into `none`:
db.table.where('id', []);
db.table.where(['id', 'name'], []);
db.table.where({ id: [] });
```

#### orWhereIn

[//]: # 'has JSDoc'

Takes the same arguments as `whereIn`.
Add a `WHERE IN` condition prefixed with `OR` to the query:

```ts
db.table.whereIn('a', [1, 2, 3]).orWhereIn('b', ['one', 'two']);
```

#### whereNotIn

[//]: # 'has JSDoc'

Acts as `whereIn`, but negates the condition with `NOT`:

```ts
db.table.whereNotIn('color', ['red', 'green', 'blue']);
```

#### orWhereNotIn

[//]: # 'has JSDoc'

Acts as `whereIn`, but prepends `OR` to the condition and negates it with `NOT`:

```ts
db.table.whereNotIn('a', [1, 2, 3]).orWhereNoIn('b', ['one', 'two']);
```

### whereExists

[//]: # 'has JSDoc'

`whereExists` is for support of the `WHERE EXISTS (query)` clause.

This method is accepting the same arguments as `join`, see the [join](#join) section for more details.

```ts
// find users who have accounts
// find by a relation name if it's defined
db.user.whereExists('account');

// find users who have an account with positive balance
// `accounts` is a relation name
db.user.whereExists((q) => q.accounts.where({ balance: { gt: 0 } }));

// find using a table and a join conditions
db.user.whereExists(db.account, 'account.id', 'user.id');

// find using a query builder in a callback:
db.user.whereExists(db.account, (q) => q.on('account.id', '=', 'user.id'));
```

#### orWhereExists

[//]: # 'has JSDoc'

Acts as `whereExists`, but prepends the condition with `OR`:

```ts
// find users who have an account or a profile,
// imagine that the user has both `account` and `profile` relations defined.
db.user.whereExist('account').orWhereExists('profile');
```

#### whereNotExists

[//]: # 'has JSDoc'

Acts as `whereExists`, but negates the condition with `NOT`:

```ts
// find users who don't have an account,
// image that the user `belongsTo` or `hasOne` account.
db.user.whereNotExist('account');
```

#### orWhereNotExists

[//]: # 'has JSDoc'

Acts as `whereExists`, but prepends the condition with `OR` and negates it with `NOT`:

```ts
// find users who don't have an account OR who don't have a profile
// imagine that the user has both `account` and `profile` relations defined.
db.user.whereNotExists('account').orWhereNotExists('profile');
```

## column operators

[//]: # 'has JSDoc'

`where` argument can take an object where the key is the name of the operator and the value is its argument.

Different types of columns support different sets of operators.

All column operators can take a value of the same type as the column, a sub-query, or a raw SQL expression:

```ts
db.table.where({
  numericColumn: {
    // lower than 5
    lt: 5,

    // lower than the value returned by sub-query
    lt: OtherTable.select('someNumber').take(),

    // raw SQL expression produces WHERE "numericColumn" < "otherColumn" + 10
    lt: sql`"otherColumn" + 10`,
  },
});
```

These operators are also available as functions that can be chained to queries, see [Aggregate functions](/guide/aggregate).

### any operators

The following operators are available for any kind of column:

- `equals`: `=` operator, it may be useful for comparing column value with JSON object;
- `not`: `!=` (aka `<>`) not equal operator;
- `in`: `IN` operator to check if the column value is included in a list of values.
  Takes an array of values, or a sub-query returning a list of values, or a raw SQL expression that returns a list;
- `notIn`: `NOT IN` operator, and takes the same arguments as `in`.

```ts
db.table.where({
  // when searching for an exact same JSON value, this won't work:
  jsonColumn: someObject,

  // use `{ equals: ... }` instead:
  jsonColumn: { equals: someObject },

  anyColumn: { not: value },

  column: {
    in: ['a', 'b', 'c'],

    // WHERE "column" IN (SELECT "column" FROM "otherTable")
    in: OtherTable.select('column'),

    in: sql`('a', 'b')`,
  },
});
```

### ordinal operators

Ordinal operators are available for numbers, dates and timestamps, text types, booleans, bit types, arrays, `jsonb` type, and `tsvector`/`tsquery`.

- `lt`: `<`, lower than;
- `lte`: `<=`, lower than or equal to;
- `gt`: `>`, greater than;
- `gte`: `>=`, greater than or equal to;
- `between`: for `BETWEEN ... AND`, it is inclusive, equivalent to `value1 <= target AND target <= value2`.

Numeric types (int, decimal, double precision, etc.) are comparable with numbers,
string-based types are comparable with strings,
date types (date, timestamp) are comparable with `Date` object or `Data.toISOString()` formatted strings.

```ts
db.table.where({
  // works with numbers:
  numericColumn: {
    gt: 5,
    lt: 10,
  },

  // works with dates, timestamps as well:
  date: {
    lte: new Date(),
    gte: new Date().toISOString(),
  },

  column: {
    // simple values
    between: [1, 10],

    // sub-query and raw SQL expression
    between: [OtherTable.select('column').take(), sql`2 + 2`],
  },
});
```

### text operators

For `text`, `varchar`, `string`, and `json` columns.

`json` is stored as text, so it also has text operators. Use the `jsonb` type for JSON operators.

Takes a string, or sub-query returning string, or raw SQL expression as well as other operators.

`%` and `_` chars in the input are escaped so the data entered by the user cannot affect the search logic.

```ts
db.table.where({
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
  },
});
```

### JSONB column operators

JSON functions are available only for the `jsonb` column, note that the `json` type has text operators instead.

You can use [jsonPathQueryFirst](/guide/json.html#jsonpathqueryfirst) to filter by a JSON value, follow the link for details.

The value can be of any type, it can also be returned from a sub-query, raw SQL expression.

```ts
db.table.where((q) =>
  q.get('jsonbColumn').jsonPathQueryFirst('$.name').equals(value),
);
```

`jsonSupersetOf`: check if the column value is a superset of provided value.

For instance, it is true if the column has JSON `{ "a": 1, "b": 2 }` and provided value is `{ "a": 1 }`.

Takes the value of any type, or sub query which returns a single value, or a raw SQL expression.

```ts
db.table.where({
  jsonbColumn: {
    jsonSupersetOf: { a: 1 },
  },
});
```

`jsonSubsetOf`: check if the column value is a subset of provided value.

For instance, it is true if the column has JSON `{ "a": 1 }` and provided value is `{ "a": 1, "b": 2 }`.

Takes the value of any type, or sub query which returns a single value, or a raw SQL expression.

```ts
db.table.where({
  jsonbColumn: {
    jsonSubsetOf: { a: 1 },
  },
});
```

### array operators

- `has`: checks if a value is contained within a list;
- `hasEvery`: checks if all values are contained within the list;
- `containedIn`: checks if all values from the array column are present in the given list;
- `hasSome`: checks if at least one value is contained in the list, i.e. checks if the arrays are overlapping;
- `length`: filters by array length, it can take a simple value or an object with [numeric operators](#numeric-and-date-operators).

```ts
db.table.where({
  arrayColumn: {
    // WHERE 1 = ANY("arrayColumn")
    has: 1,

    // WHERE "arrayColumn" @> ARRAY[1, 2]
    hasEvery: [1, 2]

    // WHERE "arrayColumn" <@ ARRAY[1, 2]
    containedIn: [1, 2]

    // WHERE "arrayColumn" && ARRAY[1, 2]
    hasSome: [1, 2]

    // WHERE COALESCE(array_length("arrayColumn", 1), 0) = 0
    // coalesce is needed because array_length returns NULL for an empty array.
    length: 0,

    // WHERE COALESCE(array_length("arrayColumn", 1), 0) > 3
    length: {
      gt: 3,
    },
  },
});
```

## exists

[//]: # 'has JSDoc'

Use `exists()` to check if there is at least one record-matching condition.

It will discard previous `select` statements if any. Returns a boolean.

```ts
const exists: boolean = await db.table.where(...conditions).exists();
```
