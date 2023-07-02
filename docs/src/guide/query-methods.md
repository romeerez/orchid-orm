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
It is a [good practice](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/centralizedhandling.md) to catch common errors in a centralized place (see [global error handling](/guide/error-handling.html#global-error-handling)), and this allows for a more concise code.

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

## find and findOptional

[//]: # 'has JSDoc'

Find a single record by the primary key (id), adds `LIMIT 1`.

`find` throws a `NotFoundError` when not found, and `findOptional` returns `undefined`.

```ts
const found: TableType = await db.table.find(123);

const foundOptional: TableType | undefined = await db.table.find(123);
```

## findBy and findByOptional

[//]: # 'has JSDoc'

The same as `where(conditions).take()`, it will filter records and add a `LIMIT 1`.

`findBy` throws a `NotFoundError` when not found, and `findByOptional` returns `undefined`.

```ts
const found: TableType = await db.table.findBy({
  key: 'value',
});

const foundOptional: TableType | undefined = await db.table.findByOptional({
  key: 'value',
});
```

## get and getOptional

[//]: # 'has JSDoc'

`.get` returns a single value, adds `LIMIT 1` to the query, and accepts a column name or a raw SQL expression.

`get` throws a `NotFoundError` when not found, and `getOptional` returns `undefined`.

```ts
import { NumberColumn } from 'pqb';

const firstName: string = await db.table.get('name');

const rawResult: number = await db.table.get(
  db.table.sql((t) => t.integer())`1 + 1`,
);

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

## raw sql

[//]: # 'has JSDoc'

When there is a need to use a piece of raw SQL, use the `sql` method from tables, or a `raw` function imported from `orchid-orm`.

When selecting a raw SQL, specify a resulting type with `<generic>` syntax:

```ts
const result: { num: number }[] = await db.table.select({
  num: db.table.sql<number>`
    random() * 100
  `,
});
```

In a situation when you want the result to be parsed, such as when returning a timestamp that you want to be parsed into a `Date` object, provide a column type in such a way:

This example assumes that the `timestamp` column was overridden with `asDate` as shown in [Override column types](/guide/columns-overview#override-column-types).

```ts
const result: { timestamp: Date }[] = await db.table.select({
  timestamp: db.table.sql`now()`.type((t) => t.timestamp()),
});
```

In some cases such as when using [from](/guide/orm-and-query-builder.html#from), setting column type via callback allows for special `where` operations:

```ts
const subQuery = db.someTable.select({
  sum: (q) => q.sql`$a + $b`.type((t) => t.decimal()).values({ a: 1, b: 2 }),
});

// `gt`, `gte`, `min`, `lt`, `lte`, `max` in `where`
// are allowed only for numeric columns:
const result = await db.$from(subQuery).where({ sum: { gte: 5 } });
```

```ts
db.$from(Otherdb.table.select('foo', 'bar'));
```

`where` and other methods don't need the return type, so it can be omitted:

```ts
await db.table.where(db.table.sql`
  "someValue" = random() * 100
`);
```

Instead of `sql` method, you can use `raw` function from `orchid-orm` (or `pqb`) to do the same.
The only difference, `raw` function don't have access to the overridden column types.

```ts
import { raw } from 'orchid-orm';

await db.table.where(raw`
  "someValue" = random() * 100
`);

await db.table.select({
  // it is a default `timestamp` column,
  // if you have overriden it with `asDate` or `asNumber` it won't be parsed properly:
  now: raw`now()`.type((t) => t.timestamp()),
});
```

Interpolating values in template literals is completely safe:

```ts
// get value from user-provided params
const { value } = req.params;

// SQL injection is prevented by a library, this is safe:
await db.table.where(db.table.sql`
  column = ${value}
`);
```

SQL can be passed with a simple string, it's important to note that this is not safe to interpolate values in it.

```ts
// no interpolation is okay
await db.table.where(db.table.sql({ raw: 'column = random() * 100' }));

// get value from user-provided params
const { value } = req.params;

// this is NOT safe, SQL injection is possible:
await db.table.where(db.table.sql({ raw: `column = random() * ${value}` }));
```

To inject values into `raw` SQL strings, denote it with `$` in the string and provide `values` object.

Use `$$` to provide column or/and table name. Column names will be quoted so don't quote them manually.

```ts
// get value from user-provided params
const { value } = req.params;

// this is SAFE, SQL injection are prevented:
await db.table.where(
  db.table.sql({
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
// simplest form:
db.table.sql`key = ${value}`;

// with resulting type:
db.table.sql<boolean>`key = ${value}`;

// with column type for select:
db.table.sql`key = ${value}`.type((t) => t.boolean());

// with column name:
db.table.sql`$$columnName = ${value}`.values({
  columnName: 'column',
});

// raw SQL string, not allowed to interpolate:
db.table.sql({ raw: 'random()' });

// with resulting type:
db.table.sql<number>({ raw: 'random()' });

// with values:
db.table.sql({
  raw: '$$columnName = $one + $two',
  values: {
    columnName: 'column',
    one: 1,
    two: 2,
  },
});

// combine template literal, column type, and values:
db.table.sql`($one + $two) / $one`
  .type((t) => t.numeric())
  .values({ one: 1, two: 2 });
```

## select

[//]: # 'has JSDoc'

Takes a list of columns to be selected, and by default, the query builder will select all columns of the table.

Pass an object to select columns with aliases. Keys of the object are column aliases, value can be a column name, sub-query, or raw SQL expression.

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
  raw: db.table.sql<number>`1 + 2`,
});

// select raw SQL value, the resulting type can be set by providing a column type in such way:
db.table.select({
  raw: db.table.sql`1 + 2`.type((t) => t.integer()),
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

## selectAll

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

## distinct

[//]: # 'has JSDoc'

Adds a `DISTINCT` keyword to `SELECT`:

```ts
db.table.distinct().select('name');
```

Can accept column names or raw SQL expressions to place it to `DISTINCT ON (...)`:

```ts
// Distinct on the name and raw SQL
db.table.distinct('name', db.table.sql`raw sql`).select('id', 'name');
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

```ts
// accepts sub-query:
db.table.from(Otherdb.table.select('foo', 'bar'));

// accepts raw SQL by template literal:
const value = 123;
db.table.from`value = ${value}`;

// accepts raw SQL:
db.table.from(db.table.sql`value = ${value}`);

// accepts alias of `WITH` expression:
q.with('foo', Otherdb.table.select('id', 'name')).from('foo');
```

Optionally takes a second argument of type `{ only?: boolean }`, (see `FROM ONLY` in Postgres docs, this is related to table inheritance).

```ts
db.table.from(Otherdb.table.select('foo', 'bar'), {
  only: true,
});
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
const results = Product.select('category')
  .selectSum('price', { as: 'sumPrice' })
  .group('category');
```

## order

[//]: # 'has JSDoc'

Adds an order by clause to the query.

Takes one or more arguments, each argument can be a column name, an object, or a raw SQL expression.

```ts
db.table.order('id', 'name'); // ASC by default

db.table.order({
  id: 'ASC', // or DESC

  // to set nulls order:
  name: 'ASC NULLS FIRST',
  age: 'DESC NULLS LAST',
});

// order by raw SQL expression:
db.table.order`raw sql`;
// or
db.table.order(db.table.sql`raw sql`);
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

## having

Build a `HAVING` clause to the query to filter records by results of [aggregate functions](#aggregate-functions).

The argument of `having` is a function where you call the aggregate function and compare it with some value by using [column operators](/guide/where.html#column-operators).

```ts
db.table.having((q) => q.count().gte(10));
// HAVING count(*) >= 10
```

Alternatively, it accepts a raw SQL template:

```ts
db.table.having`count(*) >= ${10}`;
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

`or` method is also available on the `q` query builder:

```ts
db.table.having((q) => q.or(q.min('column').gt(1), q.max('column').lt(10)));
// HAVING (min(column) > 1) OR (max(column) < 10)
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

## transform

[//]: # 'has JSDoc'

Transform the result of the query right after loading it.

`transform` method should be called in the last order, other methods can't be chained after calling it.

The [hooks](/guide/hooks.html) that are going to run after the query will receive the query result **before** transformation.

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

## toSql

[//]: # 'has JSDoc'

Call `toSql` on a query to get an object with a `text` SQL string and a `values` array of binding values:

```ts
const sql = db.table.select('id', 'name').where({ name: 'name' }).toSql();

expect(sql.text).toBe(
  'SELECT "table"."id", "table"."name" FROM "table" WHERE "table"."name" = $1',
);
expect(sql.values).toEqual(['name']);
```

`toSql` is called internally when awaiting a query.

It is caching the result. Not mutating query methods are resetting the cache, but need to be careful with mutating methods that start with `_` - they won't reset the cache, which may lead to unwanted results.

`toSql` optionally accepts such parameters:

```ts
type ToSqlOptions = {
  clearCache?: true;
  values?: [];
};
```