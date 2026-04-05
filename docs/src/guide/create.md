---
outline: deep
description: Creating records with accepted values, sub-queries, selecting related data, upsert, and conflict handling.
---

# Create records

## accepted values

### null, undefined, unknown columns

- `null` value will set a column to `NULL`
- `undefined` value will be ignored
- unknown columns will be ignored
- pass `sql` expressions and sub-queries via `() =>` functions

```ts
db.table.create({
  name: null, // sets to null
  age: undefined, // skipped, no effect
  lalala: 123, // unknown columns are skipped
  fromSql: () => sql`custom sql`,
  fromSubQuery: () => db.otherTable.find(id).get('column'),
});

db.table.findBy({ id: 1 }).update({
  name: null, // updates to null
  age: undefined, // skipped, no effect
  lalala: 123, // unknown columns are skipped
  fromSql: () => sql`custom sql`,
  fromSubQuery: () => db.otherTable.find(id).get('column'),
});
```

### sub-queries

[//]: # 'has JSDoc in update'

In all `create`, `update`, `upsert` methods,
you can use sub queries that are either selecting a single value,
or creating/updating/deleting a record and return a single value.

```ts
await db.table.where({ ...conditions }).update({
  // `column` will be set to a value of the `otherColumn` of the created record.
  column: () => db.otherTable.get('otherColumn').create({ ...data }),

  // `column2` will be set to a value of the `otherColumn` of the updated record.
  column2: () =>
    db.otherTable
      .get('otherColumn')
      .findBy({ ...conditions })
      .update({ key: 'value' }),

  // `column3` will be set to a value of the `otherColumn` of the deleted record.
  column3: () =>
    db.otherTable
      .get('otherColumn')
      .findBy({ ...conditions })
      .delete(),
});
```

This is achieved by defining a `WITH` clause under the hood, it produces such a query:

```sql
WITH q AS (
  INSERT INTO "otherTable"(col1, col2, col3)
  VALUES ('val1', 'val2', 'val3')
  RETURNING "otherTable"."selectedColumn"
)
-- In a case of create
INSERT INTO "table"("column") VALUES ((SELECT * FROM "q"))
-- In a case of update
UPDATE "table"
SET "column" = (SELECT * FROM "q")
```

The query is atomic.
No changes will persist in the database if the sub-query fails, or if the top-level query fails, or if multiple rows are returned from a sub-query.

[//]: # 'not supported in create because cannot query related records for a thing that is not created yet'
[//]: # 'modificational sub queries are not allowed in update because it would be too hard to join a with statement to the update query'

Only selective sub-queries are supported in `update` queries when the sub-query is using a relation:

```ts
db.book.update({
  authorName: (q) => q.author.get('name'),
});
```

## selecting relations

You can load related data in `create`, `update`, and `delete` methods by chaining `.select()` with relation queries.

This is not yet supported for `upsert` and `orCreate`.

For **create** and **update**, the ORM loads relation data in a follow-up query after the main mutation. Both queries are wrapped in a transaction to keep the operation atomic and ensure consistent results.

For **delete**, the approach is different: relation data is loaded in a CTE (Common Table Expression) **before** the table record(s) are deleted. This allows returning relation data even after the source row is gone.

```ts
// example: creating multiple orders with their order items,
// selecting both orders and order items data.
db.order
  .createMany([
    {
      ...order1Data,
      orderItems: [{ ...orderItemData }],
    },
    {
      ...order2Data,
      orderItems: [{ ...orderItemData }],
    },
  ])
  .select('*', {
    orderItems: (q) => q.orderItems,
  });

// updating order, creating a new order item,
// selecting both the order and all its items.
db.order
  .find(orderId)
  .update({
    column: 'value',
    orderItems: {
      create: [{ ...orderItemData }],
    },
  })
  .select('*', {
    orderItems: (q) => q.orderItems,
  });
```

## create

We have `create` methods that return a full record by default, and `insert` methods that by default will return only a count of inserted rows.

To perform custom actions before or after creating records, see `beforeCreate`, `afterCreate`, `afterCreateCommit` [lifecycle hooks](/guide/hooks).

`create*` and `insert*` methods require columns that are not nullable and don't have a default.

Use `select`, `selectAll`, `get`, or `pluck` alongside `create` or `insert` to specify returning columns:

```ts
// to return only `id`, use get('id')
const id: number = await db.table.get('id').create(data);

// same as above
const id2: number = await db.table.create(data).get('id');

// returns a single object when creating a single record
const objectWithId: { id: number } = await db.table.select('id').create(data);

// same as above
const objectWithId2: { id: number } = await db.table.create(data).select('id');

// returns an array of objects when creating multiple
const objects: { id: number }[] = await db.table
  .select('id')
  .createMany([one, two]);
```

### create, insert

[//]: # 'has JSDoc'

`create` and `insert` create a single record.

Each column may accept a specific value, a raw SQL, or a query that returns a single value.

```ts
import { sql } from './base-table';

const oneRecord = await db.table.create({
  name: 'John',
  password: '1234',
});

// When using `.onConflictDoNothing()`,
// the record may be not created and the `createdCount` will be 0.
const createdCount = await db.table.insert(data).onConflictDoNothing();

await db.table.create({
  // raw SQL
  column1: () => sql`'John' || ' ' || 'Doe'`,

  // query that returns a single value
  // returning multiple values will result in Postgres error
  column2: () => db.otherTable.get('someColumn'),

  // nesting creates, updates, deletes produces a single SQL
  column4: () => db.otherTable.create(data).get('someColumn'),
  column5: (q) => q.relatedTable.find(id).update(data).get('someColumn'),
});
```

Creational methods can be used in [with](/guide/advanced-queries#with) expressions:

```ts
db.$qb
  // create a record in one table
  .with('a', db.table.select('id').create(data))
  // create a record in other table using the first table record id
  .with('b', (q) =>
    db.otherTable.select('id').create({
      ...otherData,
      aId: () => q.from('a').get('id'),
    }),
  )
  .from('b');
```

### createMany, insertMany

[//]: # 'has JSDoc'

`createMany` and `insertMany` will create a batch of records.

Each column may be set with a specific value, a raw SQL, or a query, the same as in [create](#create-insert).

In case one of the objects has fewer fields, the `DEFAULT` SQL keyword will be placed in its place in the `VALUES` statement.

```ts
const manyRecords = await db.table.createMany([
  { key: 'value', otherKey: 'other value' },
  { key: 'value' }, // default will be used for `otherKey`
]);

// `createdCount` will be 3.
const createdCount = await db.table.insertMany([data, data, data]);
```

When nesting creates, a separate create query will be executed for every time it's used:

```ts
// will be performed twice, even though it is defined once
const nestedCreate = db.otherTable.create(data).get('column');

await db.table.createMany([{ column: nestedCreate }, { column: nestedCreate }]);
```

Because of a limitation of Postgres protocol, queries having more than **65535** of values are going to fail in runtime.
To solve this seamlessly, `OrchidORM` will automatically batch such queries, and wrap them into a transaction, unless they are already in a transaction.

```ts
// OK: executes 2 inserts wrapped into a transaction
await db.table.createMany(
  Array.from({ length: 65536 }, () => ({ text: 'text' })),
);
```

However, this only works in the case shown above. This **won't** work if you're using the `createMany` in `with` statement,
or if the insert is used as a sub-query in other query part.

### createOneFrom, insertFrom

[//]: # 'has JSDoc'

Inserts a single record based on a query that selects a single record.

Performs a single SQL query based on `INSERT ... SELECT ... FROM`.

See [createManyFrom](#createmanyfrom-insertmanyfrom) to insert multiple records based on a single record query,
and [createForEachFrom](#createforeachfrom-insertforeachfrom) to insert a record per every one found by the query.

The first argument is a query of a **single** record, it should have `find`, `take`, or similar.

The second optional argument is a data which will be merged with columns returned by the query.

The data for the second argument is the same as in [create](#create-insert).

Columns with runtime defaults (defined with a callback) are supported here.
The value for such a column will be injected unless selected from a related table or provided in a data object.

```ts
const oneRecord = await db.table.createOneFrom(
  db.relatedTable
    // use select to map columns from one table to another
    .select({
      // relatedTable's id will be inserted as "relatedId"
      relatedId: 'id',
    })
    .findBy({ key: 'value' }),
  // optional argument:
  {
    key: 'value',
    // supports sql, nested select, create, update, delete queries
    fromSql: () => sql`custom sql`,
    fromQuery: () => db.otherTable.find(id).update(data).get('column'),
    fromRelated: (q) => q.relatedTable.create(data).get('column'),
  },
);
```

The query above will produce such a SQL (omitting `from*` values):

```sql
INSERT INTO "table"("relatedId", "key")
SELECT "relatedTable"."id" AS "relatedId", 'value'
FROM "relatedTable"
WHERE "relatedTable"."key" = 'value'
LIMIT 1
RETURNING *
```

### createManyFrom, insertManyFrom

[//]: # 'has JSDoc'

Inserts multiple records based on a query that selects a single record.

Performs a single SQL query based on `INSERT ... SELECT ... FROM`.

See [createOneFrom](#createonefrom-insertfrom) to insert a single record based on a single record query,
and [createForEachFrom](#createforeachfrom-insertforeachfrom) to insert a record per every one found by the query.

The first argument is a query of a **single** record, it should have `find`, `take`, or similar.

The second argument is array of objects to be merged with columns returned by the query.

The data for the second argument is the same as in [createMany](#createmany-insertmany).

Columns with runtime defaults (defined with a callback) are supported here.
The value for such a column will be injected unless selected from a related table or provided in a data object.

```ts
const twoRecords = await db.table.createManyFrom(
  db.relatedTable
    // use select to map columns from one table to another
    .select({
      // relatedTable's id will be inserted as "relatedId"
      relatedId: 'id',
    })
    .findBy({ key: 'value' }),
  [
    {
      key: 'value 1',
      // supports sql, nested select, create, update, delete queries
      fromSql: () => sql`custom sql`,
      fromQuery: () => db.otherTable.find(id).update(data).get('column'),
      fromRelated: (q) => q.relatedTable.create(data).get('column'),
    },
    {
      key: 'value 2',
    },
  ],
);
```

The query above will produce such a SQL (omitting `from*` values):

```sql
WITH "relatedTable" AS (
  SELECT "relatedTable"."id" AS "relatedId", 'value'
  FROM "relatedTable"
  WHERE "relatedTable"."key" = 'value'
  LIMIT 1
)
INSERT INTO "table"("relatedId", "key")
SELECT "relatedTable".*, v."key"::text
FROM "relatedTable", (VALUES ('value1'), ('value2')) v("key")
RETURNING *
```

### createForEachFrom, insertForEachFrom

[//]: # 'has JSDoc'

Inserts a single record per every record found in a given query.

Performs a single SQL query based on `INSERT ... SELECT ... FROM`.

Unlike [createOneFrom](#createonefrom-insertfrom), it doesn't accept second argument with data.

Runtime defaults cannot work with it.

```ts
const manyRecords = await db.table.createForEachFrom(
  db.relatedTable.select({ relatedId: 'id' }).where({ key: 'value' }),
);
```

### orCreate

[//]: # 'has JSDoc'

`orCreate` creates a record only if it was not found by conditions.

`find` or `findBy` must precede `orCreate`.

It is accepting the same argument as `create` commands.

No result is returned by default, place `get`, `select`, or `selectAll` before `orCreate` to specify returning columns.

```ts
const user = await db.user
  .selectAll()
  .findBy({ email: 'some@email.com' })
  .orCreate({
    email: 'some@email.com',
    name: 'created user',
    // supports sql and nested queries
    fromSQL: () => sql`*SQL expression*`,
    fromQuery: () => db.someTable.create(data).get('column'),
  });
```

The data can be returned from a function, the function won't be normally called if the record was found.

It's also called when a record is created by someone else between find and create, don't rely on it not being called for important side effects.

```ts
const user = await db.user
  .selectAll()
  .findBy({ email: 'some@email.com' })
  .orCreate(() => ({
    email: 'some@email.com',
    name: 'created user',
  }));
```

`orCreate` works by performing just a single query in the case if the record exists, and one additional query when the record does not exist.

At first, it performs a "find" query, the query cost is exact same as if you didn't use `orCreate`.

Then, if the record wasn't found, it performs a single query with CTE expressions to try finding it again, for the case it was already created just a moment before,
and then it creates the record if it's still not found. Using such CTE allows to skip using transactions, while still conforming to atomicity.

```sql
-- first query
SELECT * FROM "table" WHERE "key" = 'value'

-- the record could have been created in between these two queries

-- second query
WITH find_row AS (
  SELECT * FROM "table" WHERE "key" = 'value'
)
WITH insert_row AS (
  INSERT INTO "table" ("key")
  SELECT 'value'
  -- skip the insert if the row already exists
  WHERE NOT EXISTS (SELECT 1 FROM find_row)
  RETURNING *
)
SELECT * FROM find_row
UNION ALL
SELECT * FROM insert_row
```

### onConflict

[//]: # 'has JSDoc'

By default, violating unique constraint will cause the creative query to throw,
you can define what to do on a conflict: to ignore it, or to merge the existing record with a new data.

A conflict occurs when a table has a primary key or a unique index on a column,
or a composite primary key unique index on a set of columns,
and a row being created has the same value as a row that already exists in the table in this column(s).

Use [onConflictDoNothing](#onconflictdonothing) to suppress the error and continue without updating the record,
or the [merge](#onconflict-merge) to update the record with new values automatically,
or the [set](#onconflict-set) to specify own values for the update.

`onConflict` only accepts column names that are defined in `primaryKey` or `unique` in the table definition.
To specify a constraint, its name also must be explicitly set in `primaryKey` or `unique` in the table code.

`onConflict` can accept:

- No arguments to handle any conflict
- A column name or array of column names to target a specific unique constraint
- A constraint name using the `{ constraint: 'name' }` syntax
- A raw SQL expression for complex conditions

```ts
// Handle any conflict
db.table.create(data).onConflictDoNothing();

// Target a specific column
db.table.create(data).onConflict('email').merge();

// Target multiple columns
db.table.create(data).onConflict(['email', 'name']).merge();

// Target a specific constraint
db.table.create(data).onConflict({ constraint: 'unique_index_name' }).merge();

// Use raw SQL expression
db.table
  .create(data)
  .onConflict(sql`(email) where active`)
  .merge();
```

Postgres has a limitation that a single `INSERT` query can have only a single `ON CONFLICT` clause that can target only a single unique constraint
for updating the record.

If your table has multiple potential reasons for unique constraint violation, such as username and email columns in a user table,
consider using [upsert](#upsert) instead.

```ts
// leave `onConflict` without argument to ignore or merge on any conflict
db.table.create(data).onConflictDoNothing();

// single column:
db.table.create(data).onConflict('email').merge();

// array of columns:
// (this requires a composite primary key or unique index, see below)
db.table.create(data).onConflict(['email', 'name']).merge();

// constraint name
db.table.create(data).onConflict({ constraint: 'unique_index_name' }).merge();

// raw SQL expression:
db.table
  .create(data)
  .onConflict(sql`(email) where condition`)
  .merge();
```

:::info
A primary key or a unique index for a **single** column can be fined on a column:

```ts
export class MyTable extends BaseTable {
  columns = this.setColumns((t) => ({
    pkey: t.uuid().primaryKey(),
    unique: t.string().unique(),
  }));
}
```

But for composite primary keys or indexes (having multiple columns), define it in a separate function:

```ts
export class MyTable extends BaseTable {
  columns = this.setColumns(
    (t) => ({
      one: t.integer(),
      two: t.string(),
      three: t.boolean(),
    }),
    (t) => [t.primaryKey(['one', 'two']), t.unique(['two', 'three'])],
  );
}
```

:::

You can use the `sql` function exported from your `BaseTable` file in onConflict.
It can be useful to specify a condition when you have a partial index:

```ts
db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
    active: true,
  })
  // ignore only when having conflicting email and when active is true.
  .onConflict(sql`(email) where active`)
  .ignore();
```

If you define an inlined primary key on two columns instead, it won't be accepted by `onConflict`.

For `merge` and `set`, you can append [where](/guide/where) to update data only for the matching rows:

```ts
const timestamp = Date.now();

db.table
  .create(data)
  .onConflict('email')
  .set({
    name: 'John Doe',
    updatedAt: timestamp,
  })
  .where({ updatedAt: { lt: timestamp } });
```

### onConflictDoNothing

[//]: # 'has JSDoc'

Use `onConflictDoNothing` to suppress unique constraint violation error when creating a record.

Adds `ON CONFLICT (columns) DO NOTHING` clause to the insert statement, columns are optional.

Can also accept a constraint name.

```ts
db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
  })
  // on any conflict:
  .onConflictDoNothing()
  // or, for a specific column:
  .onConflictDoNothing('email')
  // or, for a specific constraint:
  .onConflictDoNothing({ constraint: 'unique_index_name' });
```

When there is a conflict, nothing can be returned from the database, so `onConflictDoNothing` adds `| undefined` part to the response type.

```ts
const maybeRecord: RecordType | undefined = await db.table
  .create(data)
  .onConflictDoNothing();

const maybeId: number | undefined = await db.table
  .get('id')
  .create(data)
  .onConflictDoNothing();
```

When creating multiple records, only created records will be returned. If no records were created, array will be empty:

```ts
// array can be empty
const arr = await db.table.createMany([data, data, data]).onConflictDoNothing();
```

### onConflict merge

[//]: # 'has JSDoc'

Available only after [onConflict](#onconflict).

Use this method to merge all the data you have passed into [create](#create-insert) to update the existing record on conflict.

If the table has columns with **dynamic** default values, such values will be applied as well.

You can exclude certain columns from being merged by passing the `except` option.

```ts
// merge the full data
db.table.create(data).onConflict('email').merge();

// merge only a single column
db.table.create(data).onConflict('email').merge('name');

// merge multiple columns
db.table.create(data).onConflict('email').merge(['name', 'quantity']);

// merge all columns except some
db.table
  .create(data)
  .onConflict('email')
  .merge({ except: ['name', 'quantity'] });

// merge can be applied also for batch creates
db.table.createMany([data1, data2, data2]).onConflict('email').merge();

// update records only on certain conditions
db.table
  .create(data)
  .onConflict('email')
  .merge()
  .where({ ...certainConditions });
```

### onConflict set

[//]: # 'has JSDoc'

Available only after [onConflict](#onconflict).

Updates the record with a given data when conflict occurs.

```ts
db.table
  .create(data)
  .onConflict('email')
  .set({
    // supports plain values and SQL expressions
    key: 'value',
    fromSql: () => sql`custom sql`,
  })
  // to update records only on certain conditions
  .where({ ...certainConditions });
```

### defaults

[//]: # 'has JSDoc'

`defaults` allows setting values that will be used later in `create`.

Columns provided in `defaults` are marked as optional in the following `create`. `defaults`

Default data is the same as in [create](#create-insert) and [createMany](#createMany-insertMany),
so you can provide a raw SQL, or a query.

```ts
// Will use firstName from defaults and lastName from create argument:
db.table
  .defaults({
    firstName: 'first name',
    lastName: 'last name',
  })
  .create({
    lastName: 'override the last name',
  });
```

### values from `with`

[//]: # 'has JSDoc avobe `with` method'

You can use values returned from [with](/guide/advanced-queries.html#with) statements when creating records:

```ts
db.table
  .with('created', () => db.someTable.create(data).select('one', 'two'))
  .create({
    column: (q) => q.from('created').get('one'),
    otherColumn: (q) => q.from('created').get('two'),
  });

// A record in `with` is created once, its values are used to create two records
db.table
  .with('created', () => db.someTable.create(data).select('one', 'two'))
  .createMany([
    {
      column: (q) => q.from('created').get('one'),
      otherColumn: (q) => q.from('created').get('two'),
    },
    {
      column: (q) => q.from('created').get('one'),
      otherColumn: (q) => q.from('created').get('two'),
    },
  ]);
```

## upsert

[//]: # 'has JSDoc'

`upsert` tries to update a single record, and then it creates the record if it doesn't yet exist.

`find` or `findBy` must precede `upsert` because it does not work with multiple updates.

In case more than one row was updated, it will throw `MoreThanOneRowError` and the transaction will be rolled back.

It can take `update` and `create` objects, then they are used separately for update and create queries.
Or, it can take `data` and `create` objects, `data` will be used for update and be mixed to `create` object.

`data` and `update` objects are of the same type that's expected by `update` method, `create` object is of type of `create` method argument.

No values are returned by default, place `select` or `selectAll` before `upsert` to specify returning columns.

```ts
await db.user
  .selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    data: {
      // update record's name
      name: 'new name',
      // supports sql and nested queries
      fromSQL: () => sql`*SQL expression*`,
      fromQuery: () => db.someTable.create(data).get('column'),
    },
    create: {
      // create a new record with this email and a name 'new name'
      email: 'some@email.com',
      // supports sql and nested queries as well
    },
  });

// the same as above but using `update` and `create`
await db.user
  .selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    update: {
      name: 'updated user',
    },
    create: {
      email: 'some@email.com',
      // here we use a different name when creating a record
      name: 'created user',
    },
  });
```

The data for `create` may be returned from a function, it won't be normally called if a record was found.

It's also called when a record is created by someone else between find and create, don't rely on it not being called for important side effects.

```ts
await db.user
  .selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    update: {
      name: 'updated user',
    },
    create: () => ({
      email: 'some@email.com',
      name: 'created user',
    }),
  });

// the same as above using `data`
await db.user
  .selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    data: {
      name: 'updated user',
    },
    create: () => ({
      email: 'some@email.com',
      // name in `create` is overriding the name from `data`
      name: 'created user',
    }),
  });
```

Data from `data` or `update` is passed to the `create` function and can be used:

```ts
const user = await db.user
  .selectAll()
  .findBy({ email: 'some@email.com' })
  .upsert({
    data: {
      name: 'updated user',
    },
    // `updateData` has the exact type of what is passed to `data`
    create: (updateData) => ({
      email: `${updateData.name}@email.com`,
    }),
  });
```

`upsert` works in the exact same way as [orCreate](#orCreate), but with `UPDATE` statement instead of `SELECT`.
it also performs a single query if the record exists, and two queries if there is no record yet.
