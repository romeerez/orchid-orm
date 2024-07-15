---
outline: deep
---

# Query methods

Each query method does **not** mutate the query chain, so calling it conditionally won't have an effect:

```ts
let query = db.table.select('id', 'name');

// WRONG: won't have effect
if (params.name) {
  query.where({ name: params.name });
}

// CORRECT: reassign `query` variable
if (params.name) {
  query = query.where({ name: params.name });
}

const results = await query;
```

Each query method has a mutating pair starting with `_`:

```ts
const query = db.table.select('id', 'name');

// Calling mutating method `_where`:
if (params.name) {
  query._where({ name: params.name });
}

const results = await query;
```

Mutating methods started with `_` are used internally, however, their use is not recommended because it would be easier to make mistakes, code will be less obvious.

## NotFoundError handling

[//]: # 'has JSDoc'

When we search for a single record, and it is not found, it can either throw an error, or return `undefined`.

Unlike other database libraries, `Orchid ORM` decided to throw errors by default when using methods `take`, `find`, `findBy`, `get` and the record is not found.
It is a [good practice](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/centralizedhandling.md) to catch common errors in a centralized place (see [global error handling](/guide/error-handling#global-error-handling)), and this allows for a more concise code.

If it's more suitable to get the `undefined` value instead of throwing, use `takeOptional`, `findOptional`, `findByOptional`, `getOptional` instead.

## take and takeOptional

[//]: # 'has JSDoc'

Takes a single record, adds `LIMIT 1`.

`take` throws a `NotFoundError` when not found, and `takeOptional` returns `undefined`.

```ts
const taken: TableType = await db.table.where({ key: 'value' }).take();

const takenOptional: TableType | undefined = await db.table
  .where({ key: 'value' })
  .takeOptional();
```

## find

[//]: # 'has JSDoc'

Finds a single record by the primary key (id), throws [NotFoundError](/guide/error-handling) if not found.
Not available if the table has no or multiple primary keys.

```ts
const result: TableType = await db.table.find(1);
```

### findOptional

[//]: # 'has JSDoc'

Finds a single record by the primary key (id), returns `undefined` when not found.
Not available if the table has no or multiple primary keys.

```ts
const result: TableType | undefined = await db.table.find(123);
```

### findBy

[//]: # 'has JSDoc'

Finds a single unique record, throws [NotFoundError](/guide/error-handling) if not found.
It accepts values of primary keys or unique indexes defined on the table.
`findBy`'s argument type is a union of all possible sets of unique conditions.

You can use `where(...).take()` for non-unique conditions.

```ts
await db.table.findBy({ key: 'value' });
```

### findByOptional

[//]: # 'has JSDoc'

Finds a single unique record, returns `undefined` if not found.
It accepts values of primary keys or unique indexes defined on the table.
`findBy`'s argument type is a union of all possible sets of unique conditions.

You can use `where(...).takeOptional()` for non-unique conditions.

```ts
await db.table.findByOptional({ key: 'value' });
```

### findBySql

[//]: # 'has JSDoc'

Finds a single record with a given SQL, throws [NotFoundError](/guide/error-handling) if not found:

```ts
await db.user.findBySql`
  age = ${age} AND
  name = ${name}
`;
```

### findBySqlOptional

[//]: # 'has JSDoc'

Finds a single record with a given SQL.
Returns `undefined` when not found.

```ts
await db.user.findBySqlOptional`
  age = ${age} AND
  name = ${name}
`;
```

## get and getOptional

[//]: # 'has JSDoc'

`.get` returns a single value, adds `LIMIT 1` to the query, and accepts a column name or a raw SQL expression.

`get` throws a `NotFoundError` when not found, and `getOptional` returns `undefined`.

```ts
import { NumberColumn } from 'orchid-orm';
import { sql } from './baseTable';

const firstName: string = await db.table.get('name');

const rawResult: number = await db.table.get(sql((t) => t.integer())`1 + 1`);

const firstNameOptional: string | undefined = await db.table.getOptional(
  'name',
);
```

## rows

[//]: # 'has JSDoc'

`.rows` returns an array of arrays without field names:

```ts
const rows: Array<Array<number | string>> = await db.table
  .select('id', 'name')
  .rows();

rows.forEach((row) => {
  // row is array of column values
  row.forEach((value) => {
    // value is an id or a name
  });
});
```

## pluck

[//]: # 'has JSDoc'

`.pluck` returns a single array of a single selected column values:

```ts
const ids = await db.table.pluck('id');
// ids are an array of all users' id like [1, 2, 3]
```

## exec

[//]: # 'has JSDoc'

`.exec` won't parse the response at all, and returns undefined:

```ts
const nothing = await db.table.take().exec();
```

## all

[//]: # 'has JSdoc'

`.all` is a default behavior, that returns an array of objects:

```ts
const records = db.table
  .take() // .take() will be overridden by .all()
  .all();
```

## none

[//]: # 'has JSDoc'

`none` will resolve the query into an empty result, without executing a database query.

```ts
await db.table.none(); // -> empty array
await db.table.findOptional(123).none(); // -> undefined
await db.table.find(123).none(); // throws NotFoundError
```

[insert](/guide/create-update-delete#create-insert), [update](/guide/create-update-delete#update), and [delete](/guide/create-update-delete#delete) are returning a count of affected records.

When they are called with `none`, query does not execute and 0 is returned.

```ts
await db.table.insert(data).none(); // -> 0
await db.table.all().update(data).none(); // -> 0
await db.table.all().delete().none(); // -> 0
```

When it's being used in sub-selects, it will return empty arrays, `undefined`'s, or `0` for count,
or it will throw if the sub-query require a result:

```ts
await db.user.select({
  // returns empty array
  pets: (q) => q.pets.none(),
  // returns `undefined`
  firstPet: (q) => q.pets.none().takeOptional(),
  // throws NotFound error
  requriedFirstPet: (q) => q.pets.none().take(),
  // returns `undefined`
  firstPetName: (q) => q.pets.none().getOptional('name'),
  // throws NotFound error
  requiredFirstPetName: (q) => q.pets.none().get('name'),
  // returns empty array
  petsNames: (q) => q.pets.none().pluck('name'),
  // returns 0
  petsCount: (q) => q.pets.none().count(),
});
```

When the `none` query is being used for joins that require match, the host query will return an empty result:

```ts
// all the following queries will resolve into empty arrays

await db.user.select({
  pets: (q) => q.pets.join().none(),
});

await db.user.join((q) => q.pets.none());

await db.user.join('pets', (q) => q.none());
```

When it's being used in `leftJoin` or `fullJoin`, it implicitly adds `ON false` into the join's SQL.

```ts
// this query can return user records
await db.user.leftJoin('pets', (q) => q.none());

// this query won't return user records, because of the added where condition
await db.user.leftJoin('pets', (q) => q.none()).where({ 'pets.name': 'Kitty' });
```

## select

[//]: # 'has JSDoc'

Takes a list of columns to be selected, and by default, the query builder will select all columns of the table.

The last argument can be an object. Keys of the object are column aliases, value can be a column name, sub-query, or raw SQL expression.

```ts
// select columns of the table:
db.table.select('id', 'name', { idAlias: 'id' });

// accepts columns with table names:
db.table.select('user.id', 'user.name', { nameAlias: 'user.name' });

// table name may refer to the current table or a joined table:
db.table
  .join(Message, 'authorId', 'id')
  .select('user.name', 'message.text', { textAlias: 'message.text' });

// select value from the sub-query,
// this sub-query should return a single record and a single column:
db.table.select({
  subQueryResult: Otherdb.table.select('column').take(),
});

// select raw SQL value, specify the returning type via <generic> syntax:
db.table.select({
  raw: sql<number>`1 + 2`,
});

// select raw SQL value, the resulting type can be set by providing a column type in such way:
db.table.select({
  raw: sql`1 + 2`.type((t) => t.integer()),
});

// same raw SQL query as above, but raw value is returned from a callback
db.table.select({
  raw: (q) => q.sql`1 + 2`.type((t) => t.integer()),
});
```

When you use the ORM and defined relations, `select` can also accept callbacks with related table queries:

```ts
await db.author.select({
  allBooks: (q) => q.books,
  firstBook: (q) => q.books.order({ createdAt: 'ASC' }).take(),
  booksCount: (q) => q.books.count(),
});
```

When you're selecting a relation that's connected via `belongsTo` or `hasOne`, it becomes available to use in `order` or in `where`:

```ts
// select books with their authors included, order by author name and filter by author column:
await db.books
  .select({
    author: (q) => q.author,
  })
  .order('author.name')
  .where({ 'author.isPopular': true });
```

### selectAll

[//]: # 'has JSDoc'

When querying the table or creating records, all columns are selected by default,
but updating and deleting queries are returning affected row counts by default.

Use `selectAll` to select all columns. If the `.select` method was applied before it will be discarded.

```ts
const selectFull = await db.table
  .select('id', 'name') // discarded by `selectAll`
  .selectAll();

const updatedFull = await db.table.selectAll().where(conditions).update(data);

const deletedFull = await db.table.selectAll().where(conditions).delete();
```

### distinct

[//]: # 'has JSDoc'

Adds a `DISTINCT` keyword to `SELECT`:

```ts
db.table.distinct().select('name');
```

Can accept column names or raw SQL expressions to place it to `DISTINCT ON (...)`:

```ts
import { sql } from './baseTable';

// Distinct on the name and raw SQL
db.table.distinct('name', sql`raw sql`).select('id', 'name');
```

## as

[//]: # 'has JSDoc'

Sets table alias:

```ts
db.table.as('u').select('u.name');

// Can be used in the join:
db.table.join(Profile.as('p'), 'p.userId', 'user.id');
```

## from

[//]: # 'has JSDoc'

Set the `FROM` value, by default the table name is used.

`from` determines a set of available tables and columns withing the query,
and thus it must not follow `select`, use `select` only after `from`.

```ts
// accepts sub-query:
db.table.from(db.otherTable.select('foo', 'bar'));

// accepts alias of `WITH` expression:
q.with('withTable', db.table.select('id', 'name'))
  .from('withTable')
  // `select` is after `from`
  .select('id', 'name');
```

`from` can accept multiple sources:

```ts
db.table
  // add a `WITH` statement called `withTable
  .with('withTable', db.table.select('one'))
  // select from `withTable` and from `otherTable`
  .from('withTable', db.otherTable.select('two'))
  // source names and column names are properly typed when selecting
  .select('withTable.one', 'otherTable.two');
```

### fromSql

[//]: # 'has JSDoc'

Set the `FROM` value with custom SQL:

```ts
const value = 123;
db.table.fromSql`value = ${value}`;
```

### only

[//]: # 'has JSDoc'

Adds `ONLY` SQL keyword to the `FROM`.
When selecting from a parent table that has a table inheritance,
setting `only` will make it to select rows only from the parent table.

```ts
db.table.only();

// disabling `only` after being enabled
db.table.only().only(false);
```

## offset

[//]: # 'has JSDoc'

Adds an offset clause to the query.

```ts
db.table.offset(10);
```

## limit

[//]: # 'has JSDoc'

Adds a limit clause to the query.

```ts
db.table.limit(10);
```

## truncate

[//]: # 'has JSDoc'

Truncates the specified table.

```ts
// simply truncate
await db.table.truncate();

// restart autoincrementing columns:
await db.table.truncate({ restartIdentity: true });

// truncate also dependant tables:
await db.table.truncate({ cascade: true });
```

## clone

[//]: # 'has JSDoc'

Clones the current query chain, useful for re-using partial query snippets in other queries without mutating the original.

Used under the hood, and not really needed on the app side.

## group

[//]: # 'has JSDoc'

For the `GROUP BY` SQL statement, it is accepting column names or raw SQL expressions.

`group` is useful when aggregating values.

```ts
// Select the category and sum of prices grouped by the category
const results = db.product
  .select('category')
  .selectSum('price', { as: 'sumPrice' })
  .group('category');
```

Also, it's possible to group by a selected value:

```ts
import { sql } from './baseTable';

const results = db.product
  .select({
    month: sql`extract(month from "createdAt")`.type((t) =>
      // month is returned as string, parse it to int
      t.string().parse(parseInt),
    ),
  })
  .selectSum('price', { as: 'sumPrice' })
  // group by month extracted from "createdAt"
  .group('month');
```

## order

[//]: # 'has JSDoc'

Adds an order by clause to the query.

Takes one or more arguments, each argument can be a column name or an object

```ts
db.table.order('id', 'name'); // ASC by default

db.table.order({
  id: 'ASC', // or DESC

  // to set nulls order:
  name: 'ASC NULLS FIRST',
  age: 'DESC NULLS LAST',
});
```

`order` can refer to the values returned from `select` sub-queries (unlike `where` which cannot).
So you can select a count of related records and order by it.

For example, `comment` has many `likes`.
We are selecting few columns of `comment`, selecting `likesCount` by a sub-query in a select, and ordering comments by likes count:

```ts
db.comment
  .select('title', 'content', {
    likesCount: (q) => q.likes.count(),
  })
  .order({
    likesCount: 'DESC',
  });
```

### orderSql

[//]: # 'has JSDoc'

Order by raw SQL expression.

```ts
db.table.orderSql`raw sql`;
```

## having

[//]: # 'has JSDoc'

Build a `HAVING` clause to the query to filter records by results of [aggregate functions](#aggregate-functions).

The argument of `having` is a function where you call the aggregate function and compare it with some value by using [column operators](/guide/where#column-operators).

```ts
db.table.having((q) => q.count().gte(10));
// HAVING count(*) >= 10
```

Multiple having conditions will be combined with `AND`:

```ts
db.table.having(
  (q) => q.sum('column').gt(5),
  (q) => q.avg('column').lt(10),
);
// HAVING sum(column) > 5 AND avg(column) < 10
```

After applying a comparison, `or` and `and` methods become available:

```ts
db.table.having((q) =>
  q.sum('column').equals(5).or(q.min('column').gt(1), q.max('column').lt(10)),
);
// HAVING (sum(column) = 5) OR (min(column) > 1 AND max(column) < 10)
```

Aggregate functions are exactly the same functions described in [aggregate functions](#aggregate-functions), they can accept aggregation options:

```ts
db.table.having((q) =>
  q
    .count('id', {
      distinct: true,
      order: { createdAt: 'DESC', filter: { someColumn: { not: null } } },
    })
    .gte(10),
);
```

Arguments of the aggregate function and of the comparison can be raw SQL:

```ts
db.table.having((q) => q.count(q.sql('coalesce(one, two)')).gte(q.sql`2 + 2`));
```

### havingSql

[//]: # 'has JSDoc'

Provide SQL expression for the `HAVING` SQL statement:

```ts
db.table.havingSql`count(*) >= ${10}`;
```

## map

[//]: # 'has JSDoc'

Use `map` to transform individual records of a query result.

It accepts a single record and should return a single transformed record.

For transforming the whole result of a query, consider using [transform](#transform) instead.

The [hooks](/guide/hooks) that are going to run after the query will receive the query result **before** transformation.

```ts
// add a `titleLength` to every post
const posts = await db.post.limit(10).map((post) => ({
  ...post,
  titleLength: post.title.length,
}));

posts[0].titleLength; // number

// using the exact same `map` function to transform a single post
const singlePost = await db.post.find(id).map((post) => ({
  ...post,
  titleLength: post.title.length,
}));

singlePost.titleLength; // number

// can be used in sub-queries
const postsWithComments = await db.post.select('title', {
  comments: (q) =>
    q.comments.map((comment) => ({
      ...comment,
      truncatedContent: comment.content.slice(0, 100),
    })),
});

postsWithComments[0].comments[0].truncatedContent; // string
```

## transform

[//]: # 'has JSDoc'

Transform the result of the query right after loading it.

`transform` method should be called in the last order, other methods can't be chained after calling it.

It is meant to transform the whole result of a query, for transforming individual records consider using [map](#map).

The [hooks](/guide/hooks) that are going to run after the query will receive the query result **before** transformation.

Consider the following example of a cursor-based pagination by `id`:

```ts
const lastId: number | undefined = req.query.cursor;

type Result = {
  nodes: { id: number; text: string }[];
  cursor?: number;
};

// result is only for demo, it will be inferred
const posts: Result = await db.post
  .select('id', 'text')
  .where({ id: { lt: lastId } })
  .order({ id: 'DESC' })
  .limit(100)
  .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id }));
```

You can also use the `tranform` on nested sub-queries:

```ts
type Result = {
  nodes: {
    id: number;
    text: string;
    comments: { nodes: { id: number; text: string }[]; cursor?: number };
  }[];
  cursor?: number;
};

const postsWithComments: Result = await db.post
  .select('id', 'text')
  .select({
    comments: (q) =>
      q.comments
        .select('id', 'text')
        .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id })),
  })
  .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id }));
```

## narrowType

[//]: # 'has JSDoc'

Narrows a part of the query output type.
Use with caution, type-safety isn't guaranteed with it.
This is similar so using `as` keyword from TypeScript, except that it applies only to a part of the result.

The syntax `()<{ ... }>()` is enforced by internal limitations.

```ts
const rows = db.table
  // filter out records where the `nullableColumn` is null
  .where({ nullableColumn: { not: null } });
  // narrows only a specified column, the rest of result is unchanged
  .narrowType()<{ nullableColumn: string }>()

// the column had type `string | null`, now it is `string`
rows[0].nullableColumn

// imagine that table has a enum column kind with variants 'first' | 'second'
// and a boolean `approved`
db.table
  .where({ kind: 'first', approved: true })
  // after applying such `where`, it's safe to narrow the type to receive the literal values
  .narrowType()<{ kind: 'first', approved: true }>();
```

## log

Override the `log` option, which can also be set in `createDb` or when creating a table instance:

```ts
// turn log on for this query:
await db.table.all().log(true);
await db.table.all().log(); // no argument for true

// turn log off for this query:
await db.table.all().log(false);
```

## clear

Clears the specified operator from the query, and accepts one or more string keys.

The clear key can be one of the following:

- with
- select
- where
- union
- using
- join
- group
- order
- having
- limit
- offset
- counters: removes increment and decrement

Note that currently, it does not affect on resulting TypeScript type, it may be improved in the future.

```ts
// Clears select statement but the resulting type still has the `id` column selected.
db.table.select('id').clear('id');
```

## merge

Merge two queries into one, with a decent type safety:

```ts
const query1 = db.table.select('id').where({ id: 1 });
const query2 = db.table.select('name').where({ name: 'name' });

// result has a proper type { id: number, name: string }
const result = await query1.merge(query2).take();
```

Main info such as table name, and column types, will not be overridden by `.merge(query)`,
but all other query data will be merged if possible (`select`, `where`, `join`, `with`, and many others),
or will be used from provided query argument if not possible to merge (`as`, `onConflict`, returning one or many).

## modify

[//]: # 'has JSDoc'

`modify` allows modifying the query with your function:

```ts
const doSomethingWithQuery = (q: typeof db.table) => {
  // can use all query methods
  return q.select('name').where({ active: true }).order({ createdAt: 'DESC' });
};

const record = await db.table.select('id').modify(doSomethingWithQuery).find(1);

record.id; // id was selected before `modify`
record.name; // name was selected by the function
```

It's possible to apply different `select`s inside the function, and then the result type will be a union of all possibilities:

Use this sparingly as it complicates dealing with the result.

```ts
const doSomethingWithQuery = (q: typeof db.table) => {
  if (Math.random() > 0.5) {
    return q.select('one');
  } else {
    return q.select('two');
  }
};

const record = await db.table.modify(doSomethingWithQuery).find(1);

// TS error: we don't know for sure if the `one` was selected.
record.one;

// use `in` operator to disambiguate the result type
if ('one' in record) {
  record.one;
} else {
  record.two;
}
```

## makeHelper

[//]: # 'has JSDoc'

Use `makeHelper` to make a query helper - a function where you can modify the query, and reuse this function across different places.

```ts
const defaultAuthorSelect = db.author.makeHelper((q) => {
  return q.select('firstName', 'lastName');
});

// this will select id, firstName, lastName with a correct TS type
// and return a single record
const result = await defaultAuthorSelect(db.author.select('id').find(1));
```

Such helper is available for relation queries inside `select`:

```ts
await db.book.select({
  author: (book) => defaultAuthorSelect(book.author),
});
```

Helper can accept additional arguments:

```ts
const selectFollowing = db.user.makeHelper((q, currentUser: { id: number }) => {
  return q.select({
    following: (q) =>
      q.followers.where({ followerId: currentUser.id }).exists(),
  });
});

// select some columns and the `following` boolean field from users
await selectFollowing(db.user.select('id', 'name'), currentUser);
```

To get the result type of query helper, use `QueryHelperResult` type:

```ts
import { QueryHelperResult } from 'orchid-orm';

const selectHelper = db.table.makeHelper((q) => q.select('id', 'name'));

// This type is identical to `db.table.select('id', 'name')`
type SelectQuery = QueryHelperResult<typeof selectHelper>;

// Await to get result, the type is `{ id: number, name: string }[]`
type Result = Awaited<QueryHelperResult<typeof selectHelper>>;
```

## toSQL

[//]: # 'has JSDoc'

Call `toSQL` on a query to get an object with a `text` SQL string and a `values` array of binding values:

```ts
const sql = db.table.select('id', 'name').where({ name: 'name' }).toSQL();

expect(sql.text).toBe(
  'SELECT "table"."id", "table"."name" FROM "table" WHERE "table"."name" = $1',
);
expect(sql.values).toEqual(['name']);
```

`toSQL` is called internally when awaiting a query.

It is caching the result. Not mutating query methods are resetting the cache, but need to be careful with mutating methods that start with `_` - they won't reset the cache, which may lead to unwanted results.

`toSQL` optionally accepts such parameters:

```ts
type ToSqlOptions = {
  clearCache?: true;
  values?: [];
};
```
