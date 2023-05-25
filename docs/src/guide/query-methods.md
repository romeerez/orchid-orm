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

## querying multiple records, single, arrays, values

Query methods are building blocks for a query chain, and when a query is a ready use `await` to get all records:

```ts
const records: { id: number; name: string }[] = await db.table.select(
  'id',
  'name',
);
```

`.take()` to get only one record, it will add `LIMIT 1` to the query and will throw `NotFoundError` when not found.

`.find(id)` and `.findBy(conditions)` also returns one record.

```ts
import { NotFoundError } from 'pqb';

try {
  // take one record:
  const takenRecord = await db.table.take();

  const foundById = await db.table.find(1);

  const foundByConditions = await db.table.findBy({ email: 'some@email.com' });
} catch (err) {
  if (err instanceof NotFoundError) {
    // handle error
  }
}
```

`.takeOptional()` to get one record or `undefined` when not found.

`.findOptional(id)` and `.findByOptional(conditions)` also returns one record or `undefined`.

```ts
const recordOrUndefined = await db.table.takeOptional();
```

`.rows` returns an array of rows without field names:

```ts
const rows = await db.table.rows();
rows.forEach((row) => {
  row.forEach((value) => {
    // ...
  });
});
```

`.pluck` returns an array of values:

```ts
const ids = await db.table.select('id').pluck();
// ids are an array of all users' id
```

`.get` returns a single value, it will add `LIMIT 1` to the query, and accepts a column name or a raw expression.
It will throw `NotFoundError` when not found.

```ts
import { NumberColumn } from 'pqb';

const firstName: string = await db.table.get('name');

const rawResult: number = await db.table.get(
  db.table.sql((t) => t.integer())`1 + 1`,
);
```

`.getOptional` returns a single value or undefined when not found:

```ts
const firstName: string | undefined = await db.table.getOptional('name');
```

`.exec` won't parse the response at all, and returns undefined:

```ts
const nothing = await db.table.take().exec();
```

`.all` is a default behavior, that returns an array of objects:

```ts
const records = db.table
  .take() // .take() will be overridden by .all()
  .all();
```

## raw sql

When there is a need to use a piece of raw SQL, use the `sql` method.

To select with a raw SQL, need to specify a column type as a first argument, so the TS could use it to guess the result type of the query:

```ts
const result: { num: number }[] = await db.table.select({
  num: db.table.sql((t) => t.integer())`
    random() * 100
  `,
});
```

Other than for select, the column type can be omitted:

```ts
await db.table.where(db.table.sql`
  "someValue" = random() * 100
`);
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

To inject values into `raw` SQL strings, define it with `$` in the string and provide `values` object.

Use `$$` to provide column or/and table name. Column names will be quoted so don't quote them manually.

```ts
// get value from user-provided params
const { value } = req.params;

// this is SAFE, SQL injection are prevented:
await db.table.where(
  db.table.sql({
    values: {
      column: 'someTable.someColumn', // or simply 'column'
      one: value,
      two: 123,
    },
    raw: '$$column = random() * $value',
  }),
);
```

Summarizing:

```ts
// simplest form:
db.table`key = ${value}`;

// with column type for select:
db.table((t) => t.boolean())`key = ${value}`;

// raw SQL string, not allowed to interpolate:
db.table({ raw: 'random()' });

// with values:
db.table({
  values: {
    column: 'columnName',
    one: 1,
    two: 2,
  },
  raw: '$$columnName = $one + $two',
});

// with column type for select:
db.table((t) => t.decimal(), { raw: 'random()' });

// combine values and template literal:
db.table({ values: { one: 1, two: 2 } })`
  ($one + $two) / $one
`;
```

## select

Takes a list of columns to be selected, and by default, the query builder will select all columns of the table.

Pass an object to select columns with aliases. Keys of the object are column aliases, value can be a column name, sub-query, or raw expression.

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

// select raw SQL value, the first argument of `raw` is a column type, it is used for return type of the query
db.table.select({
  raw: db.table.sql((t) => t.integer())`1 + 2`,
});

// same raw SQL query as above, but raw value is returned from a callback
db.table.select({
  raw: (q) => q.sql((t) => t.integer())`1 + 2`,
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

Adds a `DISTINCT` keyword to `SELECT`:

```ts
db.table.distinct().select('name');
```

Can accept column names or raw expressions to place it to `DISTINCT ON (...)`:

```ts
// Distinct on the name and raw SQL
db.table.distinct('name', db.table.sql`raw sql`).select('id', 'name');
```

## as

Sets table alias:

```ts
db.table.as('u').select('u.name');

// Can be used in the join:
db.table.join(Profile.as('p'), 'p.userId', 'user.id');
```

## from

Set the `FROM` value, by default the table name is used.

```ts
// accepts sub-query:
db.table.from(Otherdb.table.select('foo', 'bar'));

// accepts raw sql by template literal:
const value = 123;
db.table.from`value = ${value}`;

// accepts raw sql:
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

Adds an offset clause to the query.

```ts
db.table.offset(10);
```

## limit

Adds a limit clause to the query.

```ts
db.table.limit(10);
```

## truncate

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

Clones the current query chain, useful for re-using partial query snippets in other queries without mutating the original.

Used under the hood, and not really needed on the app side.

## group

The `GROUP BY` SQL statement, it is accepting column names or raw expressions.

`group` is useful when aggregating values.

```ts
// Select the category and sum of prices grouped by the category
const results = Product.select('category')
  .selectSum('price', { as: 'sumPrice' })
  .group('category');
```

## order

Adds an order by clause to the query.

Takes one or more arguments, each argument can be a column name, an object, or a raw expression.

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

## having, havingOr

Adds a `HAVING` clause to the query.

`.having` takes aggregate function names as keys, see all functions in [aggregate functions](#aggregate-functions) section.

If the value of a function is a primitive, it's treated as `*`:

```ts
db.table.having({
  count: 5,
});
```

```sql
SELECT * FROM "table"
HAVING count(*) = 5
```

If the value of the function is an object, the key is a column name to pass to the function and the value is for the equality check:

```ts
db.table.having({
  count: {
    id: 5,
  },
});
```

```sql
SELECT * FROM "table"
HAVING count(id) = 5
```

The value of a function can be an object
where keys are column operators (see [column operators](#column-operators) section for full list)
and values are values to compare with.

```ts
db.table.having({
  sum: {
    price: {
      gt: 10,
      lt: 20,
    },
  },
});
```

```sql
SELECT * FROM "table"
HAVING sum(price) > 10 AND sum(price) < 20
```

The `distinct` option is for the `DISTINCT` keyword in the aggregation function:

```ts
//
db.table.having({
  count: {
    column: {
      equals: 10,
      distinct: true,
    },
  },
});
```

```sql
SELECT * FROM "table"
HAVING count(DISTINCT column) = 10
```

The `order` option is for `ORDER` in the aggregation function, see [order](#order) for value spec.

```ts
db.table.having({
  count: {
    column: {
      equals: 10,
      order: {
        id: 'ASC',
      },
    },
  },
});
```

```sql
SELECT * FROM "table"
HAVING count(column ORDER BY id ASC) = 10
```

`filter` is for the `FILTER` clause to apply to the aggregation function.

`filterOr` is for `OR` logic in the filter, it takes an array of conditions.

```ts
db.table.having({
  count: {
    column: {
      equals: 10,
      filter: {
        id: {
          lt: 10,
        },
      },
      filterOr: [
        {
          id: {
            equals: 15,
          },
        },
        {
          id: {
            gt: 20,
          },
        },
      ],
    },
  },
});
```

```sql
SELECT * FROM "table"
HAVING count(column) FILTER (
         WHERE id < 10 OR id = 15 OR id > 20
       ) = 10
```

The `withinGroup` option is for the `WITHIN GROUP` SQL statement.

```ts
db.table.having({
  count: {
    column: {
      equals: 10,
      withingGroup: true,
      order: {
        name: 'ASC',
      },
    },
  },
});
```

```sql
SELECT * FROM "table"
HAVING count(column) WITHIN GROUP (ORDER name ASC) = 10
```

The `.having` method supports raw SQL:

```ts
db.table.having`raw SQL`;

// or
db.table.having(db.table.sql`raw SQL`);
```

`.havingOr` takes the same arguments as `.having`, but joins them with `OR`:

```ts
db.table.havingOr({ count: 1 }, { count: 2 });
```

```sql
SELECT * FROM "table"
HAVING count(*) = 1 OR count(*) = 2
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

## toSql

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
