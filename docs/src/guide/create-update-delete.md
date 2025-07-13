---
outline: deep
---

# Create, update, and delete records

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

## create

We have `create` methods that return a full record by default, and `insert` methods that by default will return only a count of inserted rows.

To perform custom actions before or after creating records, see `beforeCreate`, `afterCreate`, `afterCreateCommit` [lifecycle hooks](/guide/hooks).

`create*` and `insert*` methods require columns that are not nullable and don't have a default.

Place `select`, or `get` before or after `create` or `insert` to specify returning columns:

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
import { sql } from './baseTable';

const oneRecord = await db.table.create({
  name: 'John',
  password: '1234',
});

// When using `.onConflictIgnore()`,
// the record may be not created and the `createdCount` will be 0.
const createdCount = await db.table.insert(data).onConflictIgnore();

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

### createFrom, insertFrom

[//]: # 'has JSDoc'

These methods are for creating a single record, for batch creating see [createManyFrom](#createManyFrom-insertManyFrom).

`createFrom` is to perform the `INSERT ... SELECT ...` SQL statement, it does select and insert by performing a single query.

The first argument is a query for a **single** record, it should have `find`, `take`, or similar.

The second optional argument is a data which will be merged with columns returned from the select query.

The data for the second argument is the same as in [create](#create-insert).

Columns with runtime defaults (defined with a callback) are supported here.
The value for such a column will be injected unless selected from a related table or provided in a data object.

```ts
const oneRecord = await db.table.createFrom(
  // In the select, key is a related table column, value is a column to insert as
  RelatedTable.select({ relatedId: 'id' }).findBy({ key: 'value' }),
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

The query above will produce such SQL:

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

Similar to `createFrom`, but intended to create many records.

Unlike `createFrom`, it doesn't accept second argument with data, and runtime defaults cannot work with it.

```ts
const manyRecords = await db.table.createManyFrom(
  RelatedTable.select({ relatedId: 'id' }).where({ key: 'value' }),
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

The data can be returned from a function, it won't be called if the record was found:

```ts
const user = await User.selectAll()
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

Use [onConflictIgnore](#onconflictignore) to suppress the error and continue without updating the record,
or the [merge](#onconflict-merge) to update the record with new values automatically,
or the [set](#onconflict-set) to specify own values for the update.

`onConflict` only accepts column names that are defined in `primaryKey` or `unique` in the table definition.
To specify a constraint, its name also must be explicitly set in `primaryKey` or `unique` in the table code.

Postgres has a limitation that a single `INSERT` query can have only a single `ON CONFLICT` clause that can target only a single unique constraint
for updating the record.

If your table has multiple potential reasons for unique constraint violation, such as username and email columns in a user table,
consider using [upsert](#upsert) instead.

```ts
// leave `onConflict` without argument to ignore or merge on any conflict
db.table.create(data).onConflictIgnore();

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

### onConflictIgnore

[//]: # 'has JSDoc'

Use `onConflictIgnore` to suppress unique constraint violation error when creating a record.

Adds `ON CONFLICT (columns) DO NOTHING` clause to the insert statement, columns are optional.

Can also accept a constraint name.

```ts
db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
  })
  // on any conflict:
  .onConflictIgnore()
  // or, for a specific column:
  .onConflictIgnore('email')
  // or, for a specific constraint:
  .onConflictIgnore({ constraint: 'unique_index_name' });
```

When there is a conflict, nothing can be returned from the database, so `onConflictIgnore` adds `| undefined` part to the response type.

```ts
const maybeRecord: RecordType | undefined = await db.table
  .create(data)
  .onConflictIgnore();

const maybeId: number | undefined = await db.table
  .get('id')
  .create(data)
  .onConflictIgnore();
```

When creating multiple records, only created records will be returned. If no records were created, array will be empty:

```ts
// array can be empty
const arr = await db.table.createMany([data, data, data]).onConflictIgnore();
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

## update

[//]: # 'has JSDoc'

`update` takes an object with columns and values to update records.

By default, `update` will return a count of updated records.

Place `select`, `selectAll`, or `get` before `update` to specify returning columns.

You need to provide `where`, `findBy`, or `find` conditions before calling `update`.
To ensure that the whole table won't be updated by accident, updating without where conditions will result in TypeScript and runtime errors.

Use `all()` to update ALL records without conditions:

```ts
await db.table.all().update({ name: 'new name' });
```

If `select` and `where` were specified before the update it will return an array of updated records.

If `select` and `take`, `find`, or similar were specified before the update it will return one updated record.

For a column value you can provide a specific value, raw SQL, a query object that returns a single value, or a callback with a sub-query.

The callback is allowed to select a single value from a relation (see `fromRelation` column below),
or to use a [jsonSet](/guide/advanced-queries#jsonset),
[jsonInsert](/guide/advanced-queries#jsoninsert),
and [jsonRemove](/guide/advanced-queries#jsonremove) for a JSON column (see `jsonColumn` below).

```ts
import { sql } from './baseTable';

// returns number of updated records by default
const updatedCount = await db.table
  .where({ name: 'old name' })
  .update({ name: 'new name' });

// returning only `id`
const id = await db.table.find(1).get('id').update({ name: 'new name' });

// `selectAll` + `find` will return a full record
const oneFullRecord = await db.table
  .selectAll()
  .find(1)
  .update({ name: 'new name' });

// `selectAll` + `where` will return array of full records
const recordsArray = await db.table
  .select('id', 'name')
  .where({ id: 1 })
  .update({ name: 'new name' });

await db.table.where({ ...conditions }).update({
  // set the column to a specific value
  value: 123,

  // use custom SQL to update the column
  fromSql: () => sql`2 + 2`,

  // use query that returns a single value
  // returning multiple values will result in Postgres error
  fromQuery: () => db.otherTable.get('someColumn'),

  // select a single value from a related record
  fromRelation: (q) => q.relatedTable.get('someColumn'),

  // set a new value to the `.foo.bar` path into a JSON column
  jsonColumn: (q) => q.jsonSet('jsonColumn', ['foo', 'bar'], 'new value'),
});
```

`update` can be used in [with](/guide/advanced-queries#with) expressions:

```ts
db.$qb
  // update record in one table
  .with('a', db.table.find(1).select('id').update(data))
  // update record in other table using the first table record id
  .with('b', (q) =>
    db.otherTable
      .find(1)
      .select('id')
      .update({
        ...otherData,
        aId: () => q.from('a').get('id'),
      }),
  )
  .from('b');
```

### empty set

When trying to query update with an empty object, it will be transformed seamlessly to a `SELECT` query:

```ts
// imagine the data is an empty object
const data = req.body;

// query is transformed to `SELECT count(*) WHERE key = 'value'`
const count = await db.table.where({ key: 'value' }).update(data);

// will select a full record by id
const record = await db.table.find(1).selectAll().update(data);

// will select a single column by id
const name = await db.table.find(1).get('name').update(data);
```

If the table has `updatedAt` [timestamp](/guide/common-column-methods#timestamps), it will be updated even for an empty data.

### updateOrThrow

[//]: # 'has JSDoc'

To make sure that at least one row was updated use `updateOrThrow`:

```ts
import { NotFoundError } from 'orchid-orm';

try {
  // updatedCount is guaranteed to be greater than 0
  const updatedCount = await db.table
    .where(conditions)
    .updateOrThrow({ name: 'name' });

  // updatedRecords is guaranteed to be a non-empty array
  const updatedRecords = await db.table
    .where(conditions)
    .select('id')
    .updateOrThrow({ name: 'name' });
} catch (err) {
  if (err instanceof NotFoundError) {
    // handle error
  }
}
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
await User.selectAll()
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
await User.selectAll()
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

The data for `create` may be returned from a function, it won't be called if a record was updated:

```ts
await User.selectAll()
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
await User.selectAll()
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
const user = await User.selectAll()
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

## increment

[//]: # 'has JSDoc'

Increments a column by `1`, returns a count of updated record by default.

```ts
const updatedCount = await db.table
  .where(...conditions)
  .increment('numericColumn');
```

When using `find` or `get` it will throw `NotFoundError` when no records found.

```ts
// throws when not found
const updatedCount = await db.table.find(1).increment('numericColumn');

// also throws when not found
const updatedCount2 = await db.table
  .where(...conditions)
  .get('columnName')
  .increment('numericColumn');
```

Provide an object to increment multiple columns with different values.
Use `select` to specify columns to return.

```ts
// increment someColumn by 5 and otherColumn by 10, return updated records
const result = await db.table
  .selectAll()
  .where(...conditions)
  .increment({
    someColumn: 5,
    otherColumn: 10,
  });
```

## decrement

[//]: # 'has JSDoc'

Decrements a column by `1`, returns a count of updated record by default.

```ts
const updatedCount = await db.table
  .where(...conditions)
  .decrement('numericColumn');
```

When using `find` or `get` it will throw `NotFoundError` when no records found.

```ts
// throws when not found
const updatedCount = await db.table.find(1).decrement('numericColumn');

// also throws when not found
const updatedCount2 = await db.table
  .where(...conditions)
  .get('columnName')
  .decrement('numericColumn');
```

Provide an object to decrement multiple columns with different values.
Use `select` to specify columns to return.

```ts
// decrement someColumn by 5 and otherColumn by 10, return updated records
const result = await db.table
  .selectAll()
  .where(...conditions)
  .decrement({
    someColumn: 5,
    otherColumn: 10,
  });
```

## delete

[//]: # 'has JSDoc'

This method deletes one or more rows, based on other conditions specified in the query.

By default, `delete` will return a count of deleted records.

Place `select`, `selectAll`, or `get` before `delete` to specify returning columns.

Need to provide `where`, `findBy`, or `find` conditions before calling `delete`.
To prevent accidental deletion of all records, deleting without where will result in TypeScript and a runtime error.

Use `all()` to delete ALL records without conditions:

```ts
await db.table.all().delete();
```

```ts
// deletedCount is the number of deleted records
const deletedCount = await db.table.where(...conditions).delete();

// returns a single value, throws if not found
const id: number | undefined = await db.table
  .findBy(...conditions)
  .get('id')
  .delete();

// returns an array of records with specified columns
const deletedRecord = await db.table
  .select('id', 'name', 'age')
  .where(...conditions)
  .delete();

// returns an array of fully deleted records
const deletedUsersFull = await db.table
  .selectAll()
  .where(...conditions)
  .delete();
```

`delete` supports joining, under the hood the join is transformed to `USING` and `WHERE` statements:

```ts
// delete all users who have corresponding profile records:
db.table.join(Profile, 'profile.userId', 'user.id').all().delete();
```

`delete` can be used in [with](/guide/advanced-queries#with) expressions:

```ts
db.$qb
  // delete a record in one table
  .with('a', db.table.find(1).select('id').delete())
  // delete a record in other table using the first table record id
  .with('b', (q) =>
    db.otherTable.select('id').whereIn('aId', q.from('a').pluck('id')).delete(),
  )
  .from('b');
```
