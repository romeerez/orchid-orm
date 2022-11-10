# Query methods

Table object (returned from `db(table, () => schema)`) has lots of query methods.

Each query method does **not** mutate the query chain, so calling it conditionally won't have effect:

```ts
let query = Table.select('id', 'name')

// WRONG: won't have effect
if (params.name) {
  query.where({ name: params.name })
}

// CORRECT: reassing `query` variable
if (params.name) {
  query = query.where({ name: params.name })
}

const results = await query
```

Each query method has a mutating pair starting with `_`:
```ts
const query = Table.select('id', 'name')

// Calling mutating method `_where`:
if (params.name) {
  query._where({ name: params.name })
}

const results = await query
```

Mutating methods started with `_` are used internally, however, their use is not recommended because it would be easier to make mistakes, code will be less obvious.

## querying multiple records, single, arrays, values

Query methods are building blocks for a query chain, and when query is ready use `await` to get all records:
```ts
const records: { id: number, name: string }[] = await Table.select('id', 'name')
```

`.take()` to get only one record, it will add `LIMIT 1` to the query, will throw `NotFoundError` when not found.

`.find(id)` and `.findBy(conditions)` also returns one record.

```ts
import { NotFoundError } from 'pqb'

try {
  // take one record:
  const takenRecord = await Table.take()
  
  const foundById = await Table.find(1)
  
  const foundByConditions = await Table.findBy({ email: 'some@email.com' })
} catch (err) {
  if (err instanceof NotFoundError) {
    // handle error
  }
}
```

`.takeOptional()` to get one record or `undefined` when not found.

`.findOptional(id)` and `.findByOptional(conditions)` also returns one record or `undefined`.

```ts
const recordOrUndefined = await Table.takeOptional()
```

`.rows` returns array of rows without field names:
```ts
const rows = await Table.rows()
rows.forEach((row) => {
  row.forEach((value) => {
    // ...
  })
})
```

`.pluck` returns array of values:
```ts
const ids = await Table.select('id').pluck()
// ids is array of all users id
```

`.get` returns a single value, it will add `LIMIT 1` to the query, accepts column name or a raw expression.
It will throw `NotFoundError` when not found.
```ts
import { NumberColumn } from 'pqb'

const firstName: string = await Table.get('name')

const rawResult: number = await Table.get(Table.raw((t) => t.integer(), '1 + 1'))
```

`.getOptional` returns single value or undefined when not found:
```ts
const firstName: string | undefined = await Table.getOptional('name')
```

`.exec` won't parse response at all, returns undefined:
```ts
const nothing = await Table.take().exec()
```

`.all` is a default behavior, returns array of objects:
```ts
const records = Table
  .take() // .take() will be overriden by .all()
  .all()
```

## raw

When there is a need to use a piece of raw SQL, use `raw` method.

When it is needed to select a value with raw SQL, first argument is a callback with type.
The inferred type will be used for the query result.

```ts
const result: { num: number }[] = await Table.select({ num: Table.raw((t) => t.integer(), '1 + 1') })
```

When using raw SQL in `where` statement or in any other place which does not affect on query result, omit first type argument, provide only SQL:

```ts
const result = await Table.where(Table.raw('someColumn = $1', 'value'))
```

To safely use values in the query, write `$1`, `$2` and so on in the SQL and provide the values as the rest arguments.
Values can be of any type.

```ts
raw('a = $1 AND b = $2 AND c = $3', 'string', 123, true)
```

For now, it is the only supported way to interpolate values, this will be extended in the future.

## select

Takes a list of columns to be selected, by default query builder will select all columns of the table.

Pass an object to select columns with aliases. Keys of the object are column aliases, value can be a column name, sub query, or raw expression.

```ts
// select columns of the table:
Table.select('id', 'name', { idAlias: 'id' })

// accepts columns with table name:
Table.select('user.id', 'user.name', { nameAlias: 'user.name' })

// table name may refer to the current table or to a joined table:
Table
  .join(Message, 'authorId', 'id')
  .select('user.name', 'message.text', { textAlias: 'message.text' })

// select value from subquery,
// this sub query should returng single record and single column:
Table.select({
  subQueryResult: OtherTable.select('column').take(),
})

// select raw expression,
// provide a column type to have a properly typed result:
import { IntegerColumn } from 'pqb'

Table.select({
  raw: Table.raw((t) => t.integer(), '1 + 2'),
})
```

## selectAll

For `SELECT` query all columns will be selected by default, but for `INSERT`, `UPDATE`, `DELETE` queries by default will be returned rows count.

Use `selectAll` to select all columns. If `.select` method was applied before it will be discarded was applied before it will be discarded.

```ts
const selectFull = await Table
  .select('id', 'name') // discarded by `selectAll`
  .selectAll()

const createdFull = await Table
  .create(data)

const updatedFull = await Table
  .selectAll()
  .where(conditions)
  .update(data)

const deletedFull = await Table
  .selectAll()
  .where(conditions)
  .delete()
```

## distinct

Adds a `DISTINCT` keyword to `SELECT`:

```ts
Table.distinct().select('name')
```

Can accept column names or raw expressions to place it to `DISTINCT ON (...)`:

```ts
// Distinct on name and raw sql
Table.distinct('name', Table.raw('raw sql')).select('id', 'name')
```

## as

Sets table alias:
```ts
Table.as('u').select('u.name')

// Can be used in join:
Table.join(Profile.as('p'), 'p.userId', 'user.id')
```

## from

Set the `FROM` value, by default table name is used.
```ts
// accepts sub query:
Table.from(OtherTable.select('foo', 'bar'))

// accepts raw query:
Table.from(Table.raw('raw sql expression'))

// accepts alias of `WITH` expression:
q.with('foo', OtherTable.select('id', 'name'))
  .from('foo');
```

Optionally takes a second argument of type `{ as?: string; only?: boolean }`:
```ts
Table.from(
  OtherTable.select('foo', 'bar'),
  {
    as: 'alias', // set FROM source alias

    // only is for table inheritance, check postgres docs for details
    only: true,
  }
)
```

## with

Add Common Table Expression (CTE) to the query.

```ts
import { columnTypes } from 'pqb';
import { NumberColumn } from './number';

// .with optionally takes such options:
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
Table.with(
  'alias',
  { id: columnTypes.integer(), name: columnTypes.text() },
  Table.raw('SELECT id, name FROM "someTable"'),
)

// accepts query:
Table.with(
  'alias',
  Table.all(),
)

// accepts a callback for a query builder:
Table.with(
  'alias',
  (qb) => qb.select({ one: Table.raw((t) => t.integer(), '1') }),
)

// All mentional forms can accept options as a second argument:
Table.with(
  'alias',
  {
    recursive: true,
    materialized: true,
  },
  rawOrQueryOrCallback,
)
```

Defined `WITH` table can be used in `.from` or `.join` with all the type safeness:
```ts
Table
  .with('alias', Table.all())
  .from('alias')
  .select('alias.id')

Table
  .with('alias', Table.all())
  .join('alias', 'alias.id', 'user.id')
  .select('alias.id')
```

## withSchema

Specifies the schema to be used as prefix of table name.

Though this method can be used to set the schema right when building query,
it's better to specify schema when calling `db(table, () => columns, { schema: string })`

```ts
Table.withSchema('customSchema').select('id')
```

Resulting sql:

```sql
SELECT "user"."id" FROM "customSchema"."user"
```

## jsonPathQuery

Selects a value from json data using a JSON path.
```ts
import { columnTypes } from 'pqb'

Table.jsonPathQuery(
  columnTypes.text(), // type of the value
  'data', // name of the json column
  '$.name', // JSON path
  'name', // select value as name
  
  // Optionally supports `vars` and `silent` options
  // check postgres docs for jsonb_path_query for details
  {
    vars: 'vars',
    silent: true,
  }
);
```

Nested JSON operations can be used in place of json column name:
```ts
Table.jsonPathQuery(
  columnTypes.text(),
  // Available: .jsonSet, .jsonInsert, .jsonRemove
  Table.jsonSet('data', ['key'], 'value'),
  '$.name',
  'name',
)
```

## jsonSet

Return a json value/object/array where a given value is set at the given path.
Path is an array of keys to access the value.
```ts
const result = await Table
  .jsonSet('data', ['name'], 'new value')
  .take()

expect(result.data).toEqual({ name: 'new value' })
```

Optionally takes parameters of type `{ as?: string, createIfMissing?: boolean }`
```ts
await Table.jsonSet(
  'data',
  ['name'],
  'new value',
  {
    as: 'alias', // select data as `alias`
    createIfMissing: true, // ignored if missing by default
  }
)
```

## jsonInsert

Return a json value/object/array where a given value is inserted at the given JSON path. Value can be single value or json object. If a value exists at the given path, the value is not replaced.
```ts
// imagine user has data = { tags: ['two'] }
const result = await Table
  .jsonInsert('data', ['tags', 0], 'one')
  .take()

// 'one' is inserted to 0 position
expect(result.data).toEqual({ tags: ['one', 'two'] })
```

Optionally takes parameters of type `{ as?: string, insertAfter?: boolean }`
```ts
// imagine user has data = { tags: ['one'] }
const result = await Table
  .jsonInsert(
    'data',
    ['tags', 0],
    'two',
    {
      as: 'alias', // select as alias
      insertAfter: true // insert after specified position
    },
  )
  .take()

// 'one' is inserted to 0 position
expect(result.alias).toEqual({ tags: ['one', 'two'] })
```

## jsonRemove

Return a json value/object/array where a given value is removed at the given JSON path.
```ts
// imagine user has data = { tags: ['one', 'two'] }
const result = await Table
  .jsonRemove(
    'data',
    ['tags', 0],
    // optional parameters:
    {
      as: 'alias', // select as alias
    }
  )
  .take();

expect(result.alias).toEqual({ tags: ['two'] })
```

## offset

Adds an offset clause to the query.
```ts
Table.offset(10)
```

## limit

Adds a limit clause to the query.
```ts
Table.limit(10)
```

## union, unionAll, intersect, intersectAll, except, exceptAll

Creates a union query, taking an array or a list of callbacks, builders, or raw statements to build the union statement, with optional boolean `wrap`. If the `wrap` parameter is true, the queries will be individually wrapped in parentheses.
```ts
SomeTable
  .select('id', 'name')
  .union(
    [
      OtherTable.select('id', 'name'),
      SomeTable.raw(`SELECT id, name FROM "thirdTable"`)
    ],
    true, // optional wrap parameter
  )
  // Other methods takes the same arguments,
  // they are different by SQL keyword:
  // .unionAll(...)
  // .intersect(...)
  // .intersectAll(...)
  // .except(...)
  // .exceptAll(...)
```

## create, createMany, createRaw

`create` will create one record:

```ts
const createdRecord = await Table.create({
  name: 'John', password: '1234'
})
```

`createMany` will create a batch of records:

In case if one of objects has fewer fields, `DEFAULT` sql keyword will be placed on its place in `VALUES` statement.

```ts
const createdRecords = await Table.createMany([
  { name: 'John', password: '1234' },
  { name: 'Peter', password: '4321' }
])
```

`createRaw` is for creating records with a raw expression:

```ts
const createdRecords = await Table.createRaw({
  columns: ['name', 'password'],
  values: Table.raw(`raw expression for VALUES`)
})
```

`beforeCreate` and `afterCreate` callback are supported for create, see [callbacks](#callbacks).

By default, all create methods will return a full record.

Place `.select`, or `.get` before `.create` to specify returning columns:

```ts
const id: number = await Table.get('id').create(data)

// returns single object when creating single record
const objectWithId: { id: number } = await Table.select('id').create(data)

// returns array of objects when creating multiple
const arrayOfIds: { id: number }[] = await Table.select('id').createMany([one, two])

// returns array of objects as well for raw values:
const arrayOfIds2 = await Table.select('id').createRaw({
  columns: ['name', 'password'],
  values: Table.raw(`raw expression for VALUES`)
})
```

## createFrom

`createFrom` is to perform `INSERT ... SELECT ...` SQL statement, it does select and insert in a single query.

First argument is a query, this query should search for one record by using `find`, `take`, or similar.

Second argument is data which will be merged with columns returned from select query.

```ts
await Table.createFrom(
  RelatedTable.select({ relatedId: 'id' }).find(1),
  {
    key: 'value',
  }
)
```

The query above will produce such SQL:

```sql
INSERT INTO "table"("relatedId", "key")
SELECT "relatedTable"."id" AS "relatedId", 'value' FROM "relatedTable"
RETURNING *
```

## onConflict

A modifier for create queries that specify alternative behaviour in the case of a conflict.
A conflict occurs when a table has a `PRIMARY KEY` or a `UNIQUE` index on a column
(or a composite index on a set of columns) and a row being created has the same value as a row
which already exists in the table in this column(s).
The default behaviour in case of conflict is to raise an error and abort the query.
Using this method you can change this behaviour to either silently ignore the error by using .onConflict().ignore()
or to update the existing row with new data (perform an "UPSERT") by using .onConflict().merge().

```ts
// single column:
Table.create(data).onConfict('email')

// array of columns:
Table.create(data).onConfict(['email', 'name'])

// raw expression:
Table.create(data).onConfict(Table.raw('(email) where condition'))
```

::: info
The column(s) specified by this method must either be the table's PRIMARY KEY or have a UNIQUE index on them, or the query will fail to execute.
When specifying multiple columns, they must be a composite PRIMARY KEY or have composite UNIQUE index.

You can use Table.raw(...) function in onConflict.
It can be useful to specify condition when you have partial index:

```ts
Table
  .create({
    email: "ignore@example.com",
    name: "John Doe",
    active: true
  })
  // ignore only on email conflict and active is true.
  .onConflict(Table.raw('(email) where active'))
  .ignore()
```
:::

See documentation on .ignore() and .merge() methods for more details.

## ignore

Available only after `.onConflict`.

Modifies a create query, and causes it to be silently dropped without an error if a conflict occurs.

Adds `ON CONFLICT (columns) DO NOTHING` clause to the insert statement.

```ts
Table
  .create({
    email: "ignore@example.com",
    name: "John Doe"
  })
  .onConflict('email')
  .ignore()
```

## merge

Available only after `.onConflict`.

Modifies a create query, to turn it into an 'upsert' operation.

Adds an `ON CONFLICT (columns) DO UPDATE` clause to the insert statement.

By default, it merges all columns.

```ts
Table
  .create({
    email: "ignore@example.com",
    name: "John Doe"
  })
  .onConflict('email')
  .merge()
```

This also works with batch creates:

```ts
Table
  .createMany([
    { email: "john@example.com", name: "John Doe" },
    { email: "jane@example.com", name: "Jane Doe" },
    { email: "alex@example.com", name: "Alex Doe" },
  ])
  .onConflict('email')
  .merge()
```

It is also possible to specify a subset of the columns to merge when a conflict occurs.
For example, you may want to set a `createdAt` column when creating but would prefer not to update it if the row already exists:

```ts
const timestamp = Date.now();

Table
  .create({
    email: "ignore@example.com",
    name: "John Doe",
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .onConflict('email')
  // string argument for single column:
  .merge('email')
  // array of strings for multiple columns:
  .merge(['email', 'name', 'updatedAt'])
```

It is also possible to specify data to update separately from the data to create.
This is useful if you want to make an update with different data than in create.
For example, you may want to change a value if the row already exists:

```ts
const timestamp = Date.now();

Table
  .create({
    email: "ignore@example.com",
    name: "John Doe",
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .onConflict('email')
  .merge({
    name: "John Doe The Second",
  })
```

It is also possible to add a WHERE clause to conditionally update only the matching rows:

```ts
const timestamp = Date.now();

Table
  .create({
    email: "ignore@example.com",
    name: "John Doe",
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .onConflict('email')
  .merge({
    name: "John Doe",
    updatedAt: timestamp,
  })
  .where({ updatedAt: { lt: timestamp } })
```

`.merge` also accepts raw expression:

```ts
Table.create(data).onConflict().merge(Table.raw('raw SQL expression'))
```

## defaults

`.defaults` allows to set values which will be used later in `.create`.

Columns provided in `.defaults` are marked as optional in following `.create`.

```ts
// Will use firstName from defauls and lastName from create argument:
Table.defaults({
  firstName: 'first name',
  lastName: 'last name',
}).create({
  lastName: 'override last name'
})
```

## update

`.update` takes an object with columns and values to update records.

By default `.update` will return count of created records.

Place `.select`, or `.selectAll`, or `.get` before `.update` to specify returning columns.

You need to provide `.where`, or `.findBy`, or `.find` conditions before calling `.update`.
To ensure that whole table won't be updated by accident, update without where conditions will result in TypeScript and runtime error.

To update table without conditions put `true` in second argument:

```ts
await Table.update({ name: 'new name' }, true)
```

If `.select` and `.where` were specified before the update it will return array of updated records.

If `.select` and `.take`, `.find` or similar were specified before the update it will return one updated records.

```ts
const updatedCount = await Table.where({ name: 'old name' }).update({ name: 'new name' })

const id = await Table
  .find(1)
  .get('id')
  .update({ name: 'new name' })

const oneFullRecord = await Table
  .selectAll()
  .find(1)
  .update({ name: 'new name' })

const recordsArray = await Table
  .select('id', 'name')
  .where({ id: 1 })
  .update({ name: 'new name' })
```

`null` value will set column to `NULL`, and `undefined` value will be skipped:
```ts
Table.findBy({ id: 1 }).update({
  name: null, // updates to null
  age: undefined, // skipped, no effect
})
```

## updateRaw

`updateRaw` is for update records with raw expression.

The behavior is the same as a regular `update` method has:
add a second `true` argument if you want to update without conditions,
it returns updated count by default,
you can customize returning data by using `select`.

```ts
const updatedCount = await Table.find(1).update(Table.raw(`name = $1`, ['name']))
```

## updateOrThrow

To make sure that at least one row was updated use `updateOrThrow`:

```ts
import { NotFoundError } from 'pqb'

try {
  // updatedCount is guaranteed to be greater than 0
  const updatedCount = await Table.where(conditions).updateOrThrow({ name: 'name' })

  // updatedRecords is guaranteed to be non-empty array
  const updatedRecords = await Table.where(conditions).select('id')
    .updateOrThrow({ name: 'name' })
} catch (err) {
  if (err instanceof NotFoundError) {
    // handle error
  }
}
```

## upsert

`.upsert` tries to update one record, and it will perform create in case if record was not found.

It will implicitly wrap queries in transaction if it was not wrapped yet.

`.find` or `.findBy` must precede `.upsert` because it does not work with multiple update.

In case if more than row was updated, it will throw `MoreThanOneRowError` and transaction will be rolled back.

`update` and `create` properties are accepting the same type of objects as `update` and `create` command.

Not returning value by default, place `.select` or `.selectAll` before `.upsert` to specify returning columns.

```ts
const user = await User
  .selectAll()
  .find({ email: 'some@email.com' })
  .upsert({
    update: {
      name: 'updated user',
    },
    create: {
      email: 'some@email.com',
      name: 'created user'
    },
  })
```

## increment

Increments a column value by the specified amount. Optionally takes `returning` argument.


```ts
// increment numericColumn column by 1, return updated records
const result = await Table
  .selectAll()
  .where(...conditions)
  .increment('numericColumn')


// increment someColumn by 5 and otherColumn by 10, return updated records
const result2 = await Table
  .selectAll()
  .where(...conditions)
  .increment({
    someColumn: 5,
    otherColumn: 10,
  })
```

## decrement

Decrements a column value by the specified amount. Optionally takes `returning` argument.


```ts
// decrement numericColumn column by 1, return updated records
const result = await Table
  .selectAll()
  .where(...conditions)
  .decrement('numericColumn')

// decrement someColumn by 5 and otherColumn by 10, return updated records
const result2 = await Table
  .selectAll()
  .where(...conditions)
  .decrement({
    someColumn: 5,
    otherColumn: 10,
  })
```

## del / delete

Aliased to `del` as `delete` is a reserved word in JavaScript,
this method deletes one or more rows,
based on other conditions specified in the query.

By default `.delete` will return count of deleted records.

Place `.select`, or `.selectAll`, or `.get` before `.delete` to specify returning columns.

Need to provide `.where`, or `.findBy`, or `.find` conditions before calling `.delete`.
To prevent accidental deletion of all records , delete without where will result in TypeScript and runtime error.

To delete all records without conditions add `true` argument:

```ts
await Table.delete(true)
```

```ts
// deletedCount is the number of deleted records
const deletedCount = await Table
  .where(...conditions)
  .delete()

// returns single value, throws if not found
const id: number | undefined = await Table
  .findBy(...conditions)
  .get('id')
  .delete()

// returns array of records with specified columns
const deletedRecord = await Table
  .select('id', 'name', 'age')
  .where(...conditions)
  .delete()

// returns array of full deleted records
const deletedUsersFull = await Table
  .selectAll()
  .where(...conditions)
  .delete()
```

`.delete` supports joining, under the hood the join is transformed to `USING` and `WHERE` statements:

```ts
// delete all users which have corresponding profile records:
Table
  .join(Profile, 'profile.userId', 'user.id')
  .delete(true)
```

## transaction

All queries within a transaction are executed on the same database connection, and run the entire set of queries as a single unit of work. Any failure will mean the database will rollback any queries executed on that connection to the pre-transaction state.

Transactions are handled by passing a handler function into `db.transaction`.

`COMMIT` happens automatically after `.transaction` callback was successfully resolved, `ROLLBACK` is done automatically if callback fails.

`.transaction` method exists both on object returned by `createDb` and on table wrappers returned by `db(table, () => schema)`.

```ts
import { createDb } from 'pqb'

const db = createDb(options)

const Catalogue = db('catalogue', () => ({
  id: t.serial().primaryKey(),
  name: t.text(),
}))

const Book = db('book', () => ({
  id: t.serial().primaryKey(),
  title: t.text(),
  catalogueId: t.integer(),
}))

try {
  // db.transaction returns data which is returned from callback
  const books = await db.transaction(async (tr) => {
    const books = [
      { title: 'Canterbury Tales' },
      { title: 'Moby Dick' },
      { title: 'Hamlet' },
    ]

    // create new catalogue and return id
    const catalogueId = await Catalogue
      .transacting(tr)
      .select('id')
      .create({ name: 'Old Books' })

    // create multiple books and return full records
    await Book
      .transacting(tr)
      .createMany(
        books.map((book) => ({ ...book, catalogueId })),
      )
  })
} catch (error) {
  // handle transaction error
}
```

## transacting

Used by `.transaction`, the transacting method may be chained to any query and passed the object you wish to join the query as part of the transaction for.

## forUpdate

To be used in select queries inside of transaction, adds `FOR UPDATE` table lock modifier.

```ts
Table.transacting(tr).forUpdate()

// Can specify columns for the lock (FOR UPDATE OF column list)
Table.transacting(tr).forUpdate(['someColumn', 'otherColumn'])
```

## forNoKeyUpdate

To be used in select queries inside of transaction, adds `FOR NO KEY UPDATE` table lock modifier.

```ts
Table.transacting(tr).forUpdate()

// Can specify columns for the lock (FOR NO KEY UPDATE OF column list)
Table.transacting(tr).forNoKeyUpdate(['someColumn', 'otherColumn'])
```

## forShare

To be used in select queries inside of transaction, adds `FOR SHARE` table lock modifier.

```ts
Table.transacting(tr).forUpdate()

// Can specify columns for the lock (FOR SHARE OF column list)
Table.transacting(tr).forShare(['someColumn', 'otherColumn'])
```

## forKeyShare

To be used in select queries inside of transaction, adds `FOR KEY SHARE` table lock modifier.

```ts
Table.transacting(tr).forUpdate()

// Can specify columns for the lock (FOR KEY SHARE OF column list)
Table.transacting(tr).forKeyShare(['someColumn', 'otherColumn'])
```

## skipLocked

This method can be used after a lock mode has been specified with either `forUpdate` or `forShare`, and will cause the query to skip any locked rows, returning an empty set if none are available.

```ts
Table.transacting(tr).forUpdate().skipLocked()
```

## noWait

This method can be used after a lock mode has been specified with either forUpdate or forShare, and will cause the query to fail immediately if any selected rows are currently locked.

```ts
Table.transacting(tr).forUpdate().noWait()
```

## aggregate functions

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
  
  // adds WITHIN GROUP sql statement
  withinGroup?: boolean;
  
  // defines OVER clause.
  // Can be a name of window defined by calling .window() method, 
  // or object the same as .window() method takes to define a window.
  over?: WindowName | WindowArg
}
```

### count, selectCount

Performs count, returns number:

```ts
// count all:
const number = Table.count()

// count where column is not NULL:
Table.count('name')

// see options above:
Table.count('*', aggregateOptions)
```

`selectCount` supports the same parameters as `count`, use with `group`.

Select count among other fields:

```ts
// record contains both id and count
const record = Table
  .select('id')
  .selectCount()
  .group('id')
  .take()
```

### min, selectMin

Gets the minimum value for the specified column, returns number or `null`.

```ts
const numberOrNull = Table.min('numericColumn', aggregateOptions)
```

`selectMin` supports the same parameters as `min`, use with `group`.

Select min among other fields:

```ts
// record contains both id and min
const record = Table
  .select('id')
  .selectMin('numericColumn')
  .group('id')
  .take()
```

### max, selectMax

Gets the maximum value for the specified column, returns number or `null`.

```ts
const numberOrNull = Table.max('numericColumn', aggregateOptions)
```

`selectMax` supports the same parameters as `max`, use with `group`.

Select max among other fields:

```ts
// record contains both id and max
const record = Table
  .select('id')
  .selectMax('numericColumn')
  .group('id')
  .take()
```

### sum, selectSum

Retrieve the sum of the values of a given column, returns number or `null`.

```ts
const numberOrNull = Table.sum('numericColumn', aggregateOptions)
```

`selectSum` supports the same parameters as `sum`, use with `group`.

Select sum among other fields:

```ts
// record contains both id and sum
const record = Table
  .select('id')
  .selectSum('numericColumn')
  .group('id')
  .take()
```

### avg, selectAvg

Retrieve the average of the values, returns number or `null`.

```ts
const numberOrNull = Table.avg('numericColumn', aggregateOptions)
```

`selectAvg` supports the same parameters as `avg`, use with `group`.

Select avg among other fields:

```ts
// record contains both id and avg
const record = Table
  .select('id')
  .selectAvg('numericColumn')
  .group('id')
  .take()
```

### bitAnd, selectBitAnd

Bitwise and aggregation, returns `number` or `null`

```ts
const numberOrNull = Table.bitAnd('numericColumn', aggregateOptions)
```

`selectBitAnd` supports the same parameters as `bitAnd`, use with `group`.

Select bit and among other fields:

```ts
// record contains both id and bit and
const record = Table
  .select('id')
  .selectBitAnd('numericColumn')
  .group('id')
  .take()
```

### bitOr, selectBitOr

Bitwise or aggregation, returns `number` or `null`

```ts
const numberOrNull = Table.bitOr('numericColumn', aggregateOptions)
```

`selectBitOr` supports the same parameters as `bitOr`, use with `group`.

Select bit or among other fields:

```ts
// record contains both id and bit or
const record = Table
  .select('id')
  .selectBitOr('numericColumn')
  .group('id')
  .take()
```

### boolAnd, selectBoolAnd

Aggregate booleans with and logic, returns `boolean` or `null`

```ts
const booleanOrNull = Table.boolAnd('booleanColumn', aggregateOptions)
```

`selectBoolAnd` supports the same parameters as `boolAnd`, use with `group`.

Select bool and among other fields:

```ts
// record contains both id and bool and
const record = Table
  .select('id')
  .selectBoolAnd('booleanColumn')
  .group('id')
  .take()
```

### boolOr, selectBoolOr

Aggregate booleans with or logic, returns `boolean` or `null`

```ts
const booleanOrNull = Table.boolOr('booleanColumn', aggregateOptions)
```

`selectBoolOr` supports the same parameters as `boolOr`, use with `group`.

Select bool or among other fields:

```ts
// record contains both id and bool or
const record = Table
  .select('id')
  .selectBoolOr('booleanColumn')
  .group('id')
  .take()
```

### every, selectEvery

Equivalent to `boolAnd`.

### jsonAgg, selectJsonAgg, jsonbAgg, selectJsonbAgg

Aggregate values into array, returns array column values or `null`.

`jsonAgg` is different from `jsonbAgg` by internal representation in the database, possibly one of them will work a bit faster.

```ts
// ids have type number[] | null
const idsOrNull = Table.jsonAgg('id', aggregateOptions)

// names have type string[] | null
const namesOrNull = Table.jsonbAgg('name', aggregateOptions)
```

`selectJsonAgg` supports the same parameters as `jsonAgg`, use with `group`.

```ts
// record contains both id and ids
const record = Table
  .select('id')
  .selectJsonAgg('id', { as: 'ids' })
  .group('id')
  .take()
```

### jsonObjectAgg, selectJsonObjectAgg, jsonbObjectAgg, selectJsonbObjectAgg

It does construction of json objects, keys are provided strings and values can be table columns or raw expressions, returns `object` or `null`.

`jsonObjectAgg` is different from `jsonbObjectAgg` by internal representation in the database, possibly one of them will work a bit faster.

```ts
import { TextColumn } from './string';

// object have type { nameAlias: string, foo: string } | null
const object = Table.jsonAgg({
  nameAlias: 'name',
  foo: Table.raw((t) => t.text(), '"bar" || "baz"')
}, aggregateOptions)
```

`selectJsonObjectAgg` supports the same parameters as `jsonObjectAgg`, use with `group`.

```ts
// record contains both id and object
const record = Table
  .select('id')
  .selectJsonObjectAgg({ nameAlias: 'name' }, { as: 'object' })
  .group('id')
  .take()
```

### stringAgg, selectStringAgg

It performs joining of string using a delimiter, returns `string` or `null`.

```ts
const stringOrNull = Table.stringAgg('name', ', ', aggregateOptions)
```

`selectStringAgg` supports the same parameters as `stringAgg`, use with `group`.

```ts
// record contains both id and names
const record = Table
  .select('id')
  .selectStringAgg('name', ', ', aggregateOptions)
  .group('id')
  .take()
```

### xmlAgg, selectXmlAgg

No one use XML nowadays, this method is here for collection.

Argument is a column of XML type, returns a `string` or `null`.

```ts
// xml is of type string | null
const xml = await LegacyTable.xmlAgg('xmlColumn', aggregateOptions)
```

`selectXmlAgg` supports the same parameters as `xmlAgg`, use with `group`.

```ts
// record contains both id and xmlData
const record = LegacyTable
  .select('id')
  .selectJsonAgg('xmlColumn', { as: 'xmlData' })
  .group('id')
  .take()
```

## window functions

Window functions such as `row_number`, `rank`.

Each of the window functions can accept such options:

```ts
type AggregateOptions = {
  // set select alias
  as?: string;
  
  // Expression can be a table column name or Table.raw()
  partitionBy?: Expression | Expression[];
  
  order?:
    | {
      columnName:
        | 'ASC' | 'DESC'
        | { dir: 'ASC' | 'DESC', nulls: 'FIRST' | 'LAST' }
    }
    | RawExpression;
}
```

### selectRowNumber

Selects `row_number` window function.

Returns the number of the current row within its partition, counting from 1.

```ts
// result is of type Array<{ id: number, rowNumber: number }>
const result = await Table
  .select('id')
  .selectRowNumber({
    as: 'rowNumber',
    partitionBy: 'someColumn',
    order: { createdAt: 'ASC' }
  })
```

### selectRank

Selects `rank` window function.

Returns the rank of the current row, with gaps; that is, the row_number of the first row in its peer group.

```ts
// result is of type Array<{ id: number, rank: number }>
const result = await Table
  .select('id')
  .selectRank({
    as: 'rank',
    partitionBy: 'someColumn',
    order: { createdAt: 'ASC' }
  })
```

### selectDenseRank

Selects `dense_rank` window function.

Returns the rank of the current row, without gaps; this function effectively counts peer groups.

```ts
// result is of type Array<{ id: number, denseRank: number }>
const result = await Table
  .select('id')
  .selectDenseRank({
    as: 'denseRank',
    partitionBy: 'someColumn',
    order: { createdAt: 'ASC' }
  })
```

### selectPercentRank

Selects `percent_rank` window function.

Returns the relative rank of the current row, that is (rank - 1) / (total partition rows - 1). The value thus ranges from 0 to 1 inclusive.

```ts
// result is of type Array<{ id: number, percentRank: number }>
const result = await Table
  .select('id')
  .selectPercentRank({
    as: 'percentRank',
    partitionBy: 'someColumn',
    order: { createdAt: 'ASC' }
  })
```

### selectCumeDist

Selects `cume_dist` window function.

Returns the cumulative distribution, that is (number of partition rows preceding or peers with current row) / (total partition rows). The value thus ranges from 1/N to 1.

```ts
// result is of type Array<{ id: number, cumeDist: number }>
const result = await Table
  .select('id')
  .selectCumeDist({
    as: 'cumeDist',
    partitionBy: 'someColumn',
    order: { createdAt: 'ASC' }
  })
```

## truncate

Truncates the specified table.

```ts
// simply truncate
await Table.truncate()

// restart autoincrementing columns:
await Table.truncate({ restartIdentity: true })

// truncate also dependant tables:
await Table.truncate({ cascade: true })
```

## clone

Clones the current query chain, useful for re-using partial query snippets in other queries without mutating the original.

Used under the hood, not really needed on app side.

## columnInfo

Returns an object with the column info about the current table, or an individual column if one is passed, returning an object with the following keys:

```ts
type ColumnInfo = {
  defaultValue: unknown; // the default value for the column
  type: string; // the column type
  maxLength: number | null; // the max length set for the column, present on string types
  nullable: boolean; // whether the column may be null
}

// columnInfo has type Record<string, ColumnInfo>, where string is name of columns
const columnInfo = await Table.columnInfo()

// singleColumnInfo has type ColumnInfo
const singleColumnInfo = await Table.columnInfo('name')
```

## where

Constructing `WHERE` conditions:

```ts
Table.where({
  // column of the current table
  name: 'John',
  
  // table name may be specified, it can be a name of joined table
  'table.lastName': 'Johnsonuk',
  
  // object with operators, see "column operators" section to see a full list of them:
  age: {
    gt: 30,
    lt: 70,
  },
  
  // where column equals to raw sql
  column: Table.raw('raw expression')
})

```

`.where` can accept other query and merge its conditions:

```ts
const otherQuery = Table.where({ name: 'John' })

Table.where({ id: 1 }, otherQuery)
// this will produce WHERE "table"."id" = 1 AND "table"."name' = 'John'
```

`.where` supports raw argument:

```ts
Table.where(Table.raw('a = b'))
```

`.where` can accept a callback with specific query builder containing all "where" methods such as `.where`, `.or`, `.whereNot`, `.whereIn`, `.whereExists`:

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

Object passed to `.where` can contain special keys, each of the key corresponds to own method and takes the same value as the type of argument of the method.

For example, key `EXISTS` is for `WHERE EXISTS` SQL statement, code below will find posts where at least one comment exists:

```ts
Post.where({
  EXISTS: [Comment, 'postId', 'id']
})
```

The same query may be achieved with the method `whereExists`:

```ts
Post.whereExists(Comment, 'postId', 'id')
```

Using methods are shorter and cleaner way, but in some cases such object keys way may be more convenient.

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
  
  // see .in, key syntax requires object with columns and values
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

Database is processing `AND` before `OR`, so this should be intuitively clear.

```ts
Table.or({ id: 1, color: 'red' }, { id: 2, color: 'blue' })
````

This query will produce such sql (simplified):
```sql
SELECT * FROM "table"
WHERE id = 1 AND color = 'red'
   OR id = 2 AND color = 'blue'
```

## find

`find` methods is available only for tables which has exactly one primary key.

Find record by id, throw `NotFoundError` if not found:

```ts
await Table.find(1)
```

## findOptional

Find record by id, returns `undefined` when not found:

```ts
await Table.findOptional(1)
```

## findBy

`.findBy` Takes the same arguments as `.where` and returns single record, throws `NotFoundError` if not found.

```ts
Table.findBy(...conditions)
// is equivalent to:
Table.where(...conditions).take()
```

## findOptional

`.findOptional` Takes the same arguments as `.where` and returns single record, returns `undefined` when not found:

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

`.andNot` is alias for `.whereNot`

## orNot

`.orNot` takes the same arguments as `.or`, and prepends each condition with `NOT` just as `.whereNot` does.

## whereIn, orWhereIn, whereNotIn, orWhereNotIn

`.whereIn` and related methods are for `IN` operator to check for inclusion in a list of values.

`.orWhereIn` acts as `.or`, `.whereNotIn` acts as `.whereNot`, `.orWhereNotIn` acts as `.orNot`.

When using with a single column it works like equivalent to `in` column operator:

```ts
Table.whereIn('column', [1, 2, 3])
// the same as:
Table.where({ column: [1, 2, 3] })
```

`.whereIn` can support a tuple of columns, that's what `in` operator cannot support:

```ts
Table.whereIn(
  ['id', 'name'],
  [[1, 'Alice'], [2, 'Bob']],
)
```

It supports sub query which should return records with columns of same type:

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

`.whereExists` and related methods are for support of `WHERE EXISTS (query)` clause.

This method is accepting the same arguments as `.join`, see [join](#join) section for more details.

`.orWhereExists` acts as `.or`, `.whereNotExists` acts as `.whereNot`, `.orWhereNotExists` acts as `.orNot`.

```ts
User.whereExists(Account, 'account.id', 'user.id')

User.whereExists(Account, (q) =>
  q.on('account.id', '=', 'user.id')
)
```

## exists

Use `.exists()` to check if there is at least one record matching conditions.

It will discard previous `.select` statements if any. Returns a boolean.

```ts
const exists: boolean = await Table.where(...conditions).exists()
```

## column operators

`.where` argument can take object where key is the name of operator and value is it's argument.

Different types of columns supports different sets of operators.

All column operators can take a value of the same type as the column, or a sub query, or a raw expression:

```ts
Table.where({
  numericColumn: {
    // lower than 5
    lt: 5,

    // lower than value returned by sub query
    lt: OtherTable.select('someNumber').take(),

    // raw expression, produces WHERE "numericColumn" < "otherColumn" + 10
    lt: Table.raw('"otherColumn" + 10')
  }
})
```

### Any type of column operators

`equals` is a simple `=` operator, it may be useful for comparing column value with JSON object:

```ts
Table.where({
  // this will fail because object with operators is expected
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

`in` is for `IN` operator to check if column value is included in a list of values.

Takes array of same type as column, or a sub query which returns a list of values, or a raw expression which returns a list.

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

`notIn` is for `NOT IN` operator, takes the same arguments as `in`

### Numeric, Date, Time column operators

To compare numbers, dates, time.

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

`between` also works with numeric, dates and time columns, it takes array of two elements.

Both elements can be of same type as column, or a sub query, or a raw query.

```ts
Table.where({
  column: {
    // simple values
    between: [1, 10],
    
    // sub query and raw expression
    between: [
      OtherTable.select('column').take(),
      Table.raw('2 + 2'),
    ],
  }
})
```

### Text column operators

For `text`, `char`, `varchar`, `json` columns.

`json` is stored as text, so it has text operators. Use `jsonb` type for json operators.

Takes string, or sub query returning string, or raw expression as well as other operators.

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

For `jsonb` column, note that `json` type has text operators instead.

`jsonPath` operator: compare a column value under a given JSON path with provided value.

Value can be of any type to compare with json value, or it can be a sub query, or a raw expression.

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

`jsonSupersetOf`: check if column value is a superset of provided value.

For instance, it is true if column has json `{ "a": 1, "b": 2 }` and provided value is `{ "a": 1 }`.

Takes value of any type, or sub query which returns single value, or a raw expression.

```ts
Table.where({
  jsonbColumn: {
    jsonSupersetOf: { a: 1 },
  }
})
```

`jsonSubsetOf`: check if column value is a subset of provided value.

For instance, it is true if column has json `{ "a": 1 }` and provided value is `{ "a": 1, "b": 2 }`.

Takes value of any type, or sub query which returns single value, or a raw expression.

```ts
Table.where({
  jsonbColumn: {
    jsonSupersetOf: { a: 1 },
  }
})
```

## join

Several methods are provided which assist in building joins, they all take the same arguments:

| method         | SQL join type    | description                                                                            |
|----------------|------------------|----------------------------------------------------------------------------------------|
| join           | JOIN             | returns rows when there is a match in both tables.                                     |
| innerJoin      | INNER JOIN       | equals to join.                                                                        |
| leftJoin       | LEFT JOIN        | returns all rows from the left table, even if there are no matches in the right table. |
| leftOuterJoin  | LEFT OUTER JOIN  | equals to leftJoin.                                                                    |
| rightJoin      | RIGHT JOIN       | returns all rows from the right table, even if there are no matches in the left table. |
| rightOuterJoin | RIGHT OUTER JOIN | equals to rightJoin.                                                                   |
| fullOuterJoin  | FULL OUTER JOIN  | combines the results of both left and right outer joins.                               |

```ts
// Our main table is User
const User = db('user', (t) => ({
  id: t.serial().primaryKey(),
  name: t.text(),
}))

// User has many messages, each message has "userId" column
const Message = db('message', (t) => ({
  userId: t.integer(),
  text: t.text(),
}))

// Join message where authorId = id:
User.join(Message, 'userId', 'id')
  .select(
    'name', // name is User column, table name may be omitted
    'message.text', // text is Message column, table name is required
  )

// Table names can be provided for clarity:
User.join(Message, 'message.userId', 'user.id')

// Message can have table alias:
User
  .join(Message.as('msg'), 'msg.userId', 'user.id')
  .select(
    'name',
    'msg.text',
  )

// Custom comparison operator can be provided:
User.join(Message, 'userId', '!=', 'id')

// with table names:
User.join(Message, 'message.userId', '!=', 'user.id')

// can accept raw expression:
User.join(Message, User.raw('"message"."userId" = "user"."id"'))

// one of the columns or both can be raw expressions:
User.join(Message, User.raw('left raw expression'), User.raw('rigth raw expression'))

// with operator:
User.join(Message, User.raw('left raw expression'), '!=', User.raw('rigth raw expression'))

// can accept object where keys are joined table columns and values are main table columns:
User.join(Message, {
  userId: 'id',
  
  // with table names:
  'message.userId': 'user.id',
  
  // value can be a raw expression:
  userId: User.raw('sql expression'),
})
```

`.join` and other join methods can accept a callback with a special query builder:

```ts
User.join(Message, (q) =>
  // left column is Message column, right column is User column
  q.on('userId', 'id')
)

User.join(Message, (q) =>
  // table names can be provided:
  q.on('message.userId', 'user.id')
)

User.join(Message, (q) =>
  // operator can be specified:
  q.on('userId', '!=', 'id')
)

User.join(Message, (q) =>
  // operator can be specified with table names as well:
  q.on('message.userId', '!=', 'user.id')
)

User.join(Message, (q) =>
  // `.orOn` takes the same arguments as `.on` and acts like `.or`:
  q
    .on('a', 'b') // where a = b
    .orOn('c', 'd') // or c = d
)
```

Join query builder supports all `where` methods: `.where`, `.whereIn`, `.whereExists`, and all `.or`, `.not`, `.orNot` forms.

Important note that this where methods are applied to main table we are joining to, not to the joining table.

Where conditions in the callback are applied inside of `JOIN` condition.

```ts
User.join(Message, (q) =>
  q
    .on('a', 'b')
    // this where methods are for User, not for Message:
    .where({ name: 'Vasya' })
    .whereIn('age', [20, 25, 30])
)
```

To add where conditions on joining table, add `.where` to first `.join` argument:

```ts
// join where message id is 1 and user id is 2
User.join(
  Message.where({ id: 1 }),
  (q) => q.where({ id: 2 })
)
```

## group

For `GROUP BY` SQL statement, it is accepting column names or raw expressions.

`group` is useful when aggregating values.

```ts
// Select category and sum of prices grouped by the category
const results = Product
  .select('category')
  .selectSum('price', { as: 'sumPrice' })
  .group('category')
```

## order

Adds an order by clause to the query.

Takes one or more arguments, each argument can be a column name, an object, or a raw expression.

```ts
Table.order('id', 'name') // ASC by default

Table.order({
  id: 'ASC', // or DESC
  
  // to set nulls order:
  name: {
    dir: 'ASC', // or DESC
    nulls: 'FIRST', // or LAST
  },
}, Table.raw('raw sql'))
```

## having, havingOr

Adds a `HAVING` clause to the query.

`.having` takes aggregate function names as keys, see all functions in [aggregate functions](#aggregate-functions) section.

If value of a function is a primitive, it's treated as `*`:

```ts
Table.having({
  count: 5,
})
```

```sql
SELECT * FROM "table"
HAVING count(*) = 5
```

If value of function is an object, key is a column name to pass to the function and value is for equality check:

```ts
Table.having({
  count: {
    id: 5,
  },
})
```

```sql
SELECT * FROM "table"
HAVING count(id) = 5
```

Value of a function can be an object
where keys are column operators (see [column operators](#column-operators) section for full list)
and values are values to compare with.

```ts
Table.having({
  sum: {
    price: {
      gt: 10,
      lt: 20,
    }
  }
})
```

```sql
SELECT * FROM "table"
HAVING sum(price) > 10 AND sum(price) < 20
```

`distinct` option is for `DISTINCT` keyword in aggregation function:

```ts
// 
Table.having({
  count: {
    column: {
      equals: 10,
      distinct: true,
    }
  }
})
```

```sql
SELECT * FROM "table"
HAVING count(DISTINCT column) = 10
```

`order` option is for `ORDER` in aggregation function, see [order](#order) for value spec.

```ts
Table.having({
  count: {
    column: {
      equals: 10,
      order: {
        id: 'ASC',
      }
    }
  }
})
```

```sql
SELECT * FROM "table"
HAVING count(column ORDER BY id ASC) = 10
```

`filter` is for `FILTER` clause to apply to the aggregation function.

`filterOr` is for `OR` logic in the filter, it takes array of conditions.

```ts
Table.having({
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
          }
        }
      ]
    }
  }
})
```

```sql
SELECT * FROM "table"
HAVING
  count(column) FILTER (
    WHERE id < 10 OR id = 15 OR id > 20
  ) = 10
```

`withinGroup` option is for `WITHIN GROUP` sql statement.

```ts
Table.having({
  count: {
    column: {
      equals: 10,
      withingGroup: true,
      order: {
        name: 'ASC'
      },
    }
  }
})
```

```sql
SELECT * FROM "table"
HAVING count(column) WITHIN GROUP (ORDER name ASC) = 10
```

`.having` method supports raw sql:

```ts
Table.having(Table.raw('raw sql'))
```

`.havingOr` takes the same arguments as `.having`, but joins them with `OR`:

```ts
Table.havingOr({ count: 1 }, { count: 2 })
```

```sql
SELECT * FROM "table"
HAVING count(*) = 1 OR count(*) = 2
```

## log

Override `log` option, which can also be set in `createDb` or when creating table instance:

```ts
// turn log on for this query:
await Table.all().log(true)
await Table.all().log() // no argument for true

// turn log off for this query:
await Table.all().log(false)
```

## clear

Clears the specified operator from the query, accepts one or more string keys.

Clear key can be one of the following:

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

Note that currently it does not affect on resulting TypeScript type, it may be improved in the future.

```ts
// Clears select statement but resulting type still has `id` column selected.
Table.select('id').clear('id')
```

## merge

Merge two queries into one, with a decent type safety:

```ts
const query1 = Table.select('id').where({ id: 1 })
const query2 = Table.select('name').where({ name: 'name' })

// result has a proper type { id: number, name: string }
const result = await query1.merge(query2).take()
```

Main info such as table name, column types, will not be overridden by `.merge(query)`,
but all other query data will be merged if possible (`select`, `where`, `join`, `with`, and many others),
or will be used from provided query argument if not possible to merge (`as`, `onConflict`, returning one or many).

## toSql

Call `toSql` on a query to get an object with `text` SQL string and `values` array of binding values:

```ts
const sql = Table.select('id', 'name').where({ name: 'name' }).toSql()

expect(sql.text).toBe('SELECT "table"."id", "table"."name" FROM "table" WHERE "table"."name" = $1')
expect(sql.values).toEqual(['name'])
```

`toSql` is called internally when awaiting a query.

It is caching result. Not mutating query methods are resetting the cache, but need to be careful with mutating methods which starts with `_` - they won't reset the cache, which may lead to unwanted result.

`toSql` optionally accepts such parameters:

```ts
type ToSqlOptions = {
  clearCache?: true
  values?: []
}
```
