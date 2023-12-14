# Create, update, and delete records

We have `create` methods that returns a full record by default, and `insert` methods that by default will return only a count of inserted rows.

To perform custom actions before or after creating records, see `beforeCreate`, `afterCreate`, `afterCreateCommit` [lifecycle hooks](/guide/hooks.html).

`create*` and `insert*` methods require columns that are not nullable and don't have a default.

Place `select`, or `get` before `create` or `insert` to specify returning columns:

```ts
// to return only `id`, use get('id')
const id: number = await db.table.get('id').create(data);

// returns a single object when creating a single record
const objectWithId: { id: number } = await db.table.select('id').create(data);

// returns an array of objects when creating multiple
const objects: { id: number }[] = await db.table
  .select('id')
  .createMany([one, two]);

// returns an array of objects as well for raw SQL values:
const objects2: { id: number }[] = await db.table.select('id').createRaw({
  columns: ['name', 'password'],
  values: db.table.sql`'Joe', 'asdfqwer'`,
});
```

## create, insert

[//]: # 'has JSDoc'

`create` and `insert` will create one record.

Each column may accept a specific value, a raw SQL, or a query that returns a single value.

```ts
const oneRecord = await db.table.create({
  name: 'John',
  password: '1234',
});

// When using `.onConflict().ignore()`,
// the record may be not created and the `createdCount` will be 0.
const createdCount = await db.table.insert(data).onConflict().ignore();

await db.table.create({
  // raw SQL
  column1: db.table.sql`'John' | 'Doe'`,

  // query that returns a single value
  // returning multiple values will result in Postgres error
  column2: db.otherTable.get('someColumn'),
});
```

## createMany, insertMany

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

## createRaw, insertRaw

[//]: # 'has JSDoc'

`createRaw` and `insertRaw` are for creating one record with a raw SQL expression.

Provided SQL will be wrapped into parens for a single `VALUES` record.

If the table has a column with runtime defaults (defined with callbacks), the value will be appended to your SQL.

`columns` are type-checked to contain all required columns.

```ts
const oneRecord = await db.table.createRaw({
  columns: ['name', 'amount'],
  values: db.table.sql`'name', random()`,
});
```

## createManyRaw, insertManyRaw

[//]: # 'has JSDoc'

`createManyRaw` and `insertManyRaw` are for creating many record with raw SQL expressions.

Takes array of SQL expressions, each of them will be wrapped into parens for `VALUES` records.

If the table has a column with runtime defaults (defined with callbacks), function will be called for each SQL and the value will be appended.

`columns` are type-checked to contain all required columns.

```ts
const manyRecords = await db.table.createManyRaw({
  columns: ['name', 'amount'],
  values: [db.table.sql`'one', 2`, db.table.sql`'three', 4`],
});
```

## createFrom, insertFrom

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

## createManyFrom, insertManyFrom

[//]: # 'has JSDoc'

Similar to `createFrom`, but intended to create many records.

Unlike `createFrom`, it doesn't accept second argument with data, and runtime defaults cannot work with it.

```ts
const manyRecords = await db.table.createManyFrom(
  RelatedTable.select({ relatedId: 'id' }).where({ key: 'value' }),
);
```

## orCreate

[//]: # 'has JSDoc'

`orCreate` creates a record only if it was not found by conditions.

It will implicitly wrap queries in a transaction if it was not wrapped yet.

`find` or `findBy` must precede `orCreate`.

It is accepting the same argument as `create` commands.

By default, it is not returning columns, place `get`, `select`, or `selectAll` before `orCreate` to specify returning columns.

```ts
const user = await User.selectAll().find({ email: 'some@email.com' }).orCreate({
  email: 'some@email.com',
  name: 'created user',
});
```

The data may be returned from a function, it won't be called if the record was found:

```ts
const user = await User.selectAll()
  .find({ email: 'some@email.com' })
  .orCreate(() => ({
    email: 'some@email.com',
    name: 'created user',
  }));
```

## onConflict

[//]: # 'has JSDoc'

A modifier for creating queries that specify alternative behavior in the case of a conflict.
A conflict occurs when a table has a `PRIMARY KEY` or a `UNIQUE` index on a column
(or a composite index on a set of columns) and a row being created has the same value as a row
that already exists in the table in this column(s).
The default behavior in case of conflict is to raise an error and abort the query.

Use `onConflict` to either ignore the error by using `.onConflict().ignore()`,
or to update the existing row with new data (perform an "UPSERT") by using `.onConflict().merge()`.

```ts
// leave `onConflict` without argument to ignore or merge on any conflict
db.table.create(data).onConflict().ignore();

// single column:
db.table.create(data).onConfict('email');

// array of columns:
db.table.create(data).onConfict(['email', 'name']);

// raw SQL expression:
db.table.create(data).onConfict(db.table.sql`(email) where condition`);
```

::: info
The column(s) given to the `onConflict` must either be the table's PRIMARY KEY or have a UNIQUE index on them, or the query will fail to execute.
When specifying multiple columns, they must be a composite PRIMARY KEY or have a composite UNIQUE index.

You can use the db.table.sql function in onConflict.
It can be useful to specify a condition when you have a partial index:

```ts
db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
    active: true,
  })
  // ignore only when having conflicting email and when active is true.
  .onConflict(db.table.sql`(email) where active`)
  .ignore();
```

:::

See the documentation on the .ignore() and .merge() methods for more details.

## ignore

[//]: # 'has JSDoc'

Available only after `onConflict`.

`ignore` modifies a create query, and causes it to be silently dropped without an error if a conflict occurs.

Adds the `ON CONFLICT (columns) DO NOTHING` clause to the insert statement.

It produces `ON CONFLICT DO NOTHING` when no `onConflict` argument provided.

```ts
db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
  })
  .onConflict('email')
  .ignore();
```

When there is a conflict, nothing can be returned from the database, that's why `ignore` has to add `| undefined` part to the response type.

`create` returns a full record by default, it becomes `RecordType | undefined` after applying `ignore`.

```ts
const maybeRecord: RecordType | undefined = await db.table
  .create(data)
  .onConflict()
  .ignore();

const maybeId: number | undefined = await db.table
  .get('id')
  .create(data)
  .onConflict()
  .ignore();
```

When creating many records, only the created records will be returned. If no records were created, array will be empty:

```ts
// array can be empty
const arr = await db.table.createMany([data, data, data]).onConflict().ignore();
```

## merge

[//]: # 'has JSDoc'

Available only after `onConflict`.

Modifies a create query, to turn it into an 'upsert' operation.

Adds an `ON CONFLICT (columns) DO UPDATE` clause to the insert statement.

When no `onConflict` argument provided,
it will automatically collect all table columns that have unique index and use them as a conflict target.

```ts
db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
  })
  .onConflict('email')
  .merge();
```

This also works with batch creates:

```ts
db.table
  .createMany([
    { email: 'john@example.com', name: 'John Doe' },
    { email: 'jane@example.com', name: 'Jane Doe' },
    { email: 'alex@example.com', name: 'Alex Doe' },
  ])
  .onConflict('email')
  .merge();
```

It is also possible to specify a subset of the columns to merge when a conflict occurs.
For example, you may want to set a `createdAt` column when creating but would prefer not to update it if the row already exists:

```ts
const timestamp = Date.now();

db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .onConflict('email')
  // string argument for a single column:
  .merge('email')
  // array of strings for multiple columns:
  .merge(['email', 'name', 'updatedAt']);
```

It is also possible to specify data to update separately from the data to create.
This is useful if you want to make an update with different data than in creating.
For example, you may want to change a value if the row already exists:

```ts
const timestamp = Date.now();

db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .onConflict('email')
  .merge({
    name: 'John Doe The Second',
  });
```

It is also possible to add a WHERE clause to conditionally update only the matching rows:

```ts
const timestamp = Date.now();

db.table
  .create({
    email: 'ignore@example.com',
    name: 'John Doe',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .onConflict('email')
  .merge({
    name: 'John Doe',
    updatedAt: timestamp,
  })
  .where({ updatedAt: { lt: timestamp } });
```

`merge` also accepts raw SQL expression:

```ts
db.table
  .create(data)
  .onConflict()
  .merge(db.table.sql`raw SQL expression`);
```

## defaults

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
or to use a [jsonSet](/guide/advanced-queries.html#jsonset),
[jsonInsert](/guide/advanced-queries.html#jsoninsert),
and [jsonRemove](/guide/advanced-queries.html#jsonremove) for a JSON column (see `jsonColumn` below).

```ts
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
  column1: 123,

  // use raw SQL to update the column
  column2: db.table.sql`2 + 2`,

  // use query that returns a single value
  // returning multiple values will result in Postgres error
  column3: db.otherTable.get('someColumn'),

  // select a single value from a related record
  fromRelation: (q) => q.relatedTable.get('someColumn'),

  // set a new value to the `.foo.bar` path into a JSON column
  jsonColumn: (q) => q.jsonSet('jsonColumn', ['foo', 'bar'], 'new value'),
});
```

### sub-queries

In addition to sub-queries that are simply selecting a single value, it's supported to update a column with a result of the provided `create`, `update`, or `delete` sub-query.

```ts
await db.table.where({ ...conditions }).update({
  // `column` will be set to a value of the `otherColumn` of the created record.
  column: db.otherTable.get('otherColumn').create({ ...data }),

  // `column2` will be set to a value of the `otherColumn` of the updated record.
  column2: db.otherTable
    .get('otherColumn')
    .findBy({ ...conditions })
    .update({ key: 'value' }),

  // `column3` will be set to a value of the `otherColumn` of the deleted record.
  column3: db.otherTable
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
UPDATE "table"
SET "column" = (SELECT * FROM "q")
```

The query is atomic, and if the sub-query fails, or the update part fails, or if multiple rows are returned from a sub-query, no changes will persist in the database.

Though it's possible to select a single value from a callback for the column to update:

```ts
await db.table.find(1).update({
  // update column `one` with the value of column `two` of the related record.
  one: (q) => q.relatedTable.get('two'),
});
```

It is **not** supported to use `create`, `update`, or `delete` kinds of sub-query on related tables:

```ts
await db.table.find(1).update({
  // TS error, this is not allowed:
  one: (q) => q.relatedTable.get('two').create({ ...data }),
});
```

It is not supported because query inside `WITH` cannot reference the table in `UPDATE`.

### null, undefined, unknown columns

- `null` value will set a column to `NULL`
- `undefined` value will be ignored
- unknown columns will be ignored

```ts
db.table.findBy({ id: 1 }).update({
  name: null, // updates to null
  age: undefined, // skipped, no effect
  lalala: 123, // skipped
});
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

If the table has `updatedAt` [timestamp](/guide/common-column-methods.html#timestamps), it will be updated even for an empty data.

## updateRaw

[//]: # 'has JSDoc'

`updateRaw` is for updating records with raw SQL expression.

The behavior is the same as a regular `update` method has:
`find` or `where` must precede calling this method,
it returns an updated count by default,
you can customize returning data by using `select`.

```ts
const value = 'new name';

// update with SQL template string
const updatedCount = await db.table.find(1).updateRaw`name = ${value}`;

// or update with `sql` function:
await db.table.find(1).updateRaw(db.table.sql`name = ${value}`);
```

## updateOrThrow

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

`upsert` tries to update one record, and it will perform create in case a record was not found.

It will implicitly wrap queries in a transaction if it was not wrapped yet.

`find` or `findBy` must precede `upsert` because it does not work with multiple updates.

In case more than one row was updated, it will throw `MoreThanOneRowError` and the transaction will be rolled back.

It can take `update` and `create` objects, then they are used separately for update and create queries.
Or, it can take `data` and `create` objects, `data` will be used for update and be mixed to `create` object.

`data` and `update` objects are of the same type that's expected by `update` method, `create` object is of type of `create` method argument.

It is not returning a value by default, place `select` or `selectAll` before `upsert` to specify returning columns.

```ts
await User.selectAll()
  .find({ email: 'some@email.com' })
  .upsert({
    data: {
      // update record's name
      name: 'new name',
    },
    create: {
      // create a new record with this email and a name 'new name'
      email: 'some@email.com',
    },
  });

// the same as above but using `update` and `create`
await User.selectAll()
  .find({ email: 'some@email.com' })
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
  .find({ email: 'some@email.com' })
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
  .find({ email: 'some@email.com' })
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
  .find({ email: 'some@email.com' })
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
