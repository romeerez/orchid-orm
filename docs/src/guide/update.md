---
outline: deep
description: Updating records with set values, sub-queries, updateFrom, and increment/decrement operations.
---

# Update records

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
import { sql } from './base-table';

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

### updateFrom

[//]: # 'has JSDoc'

Use `updateFrom` to update records in one table based on a query result from another table or CTE.

`updateFrom` accepts the same arguments as [join](/guide/join.html#join-1).

```ts
// save all author names to their books by using a relation name:
db.books.updateFrom('author').set({ authorName: (q) => q.ref('author.name') });

// update from authors that match the condition:
db.books
  .updateFrom((q) => q.author.where({ writingSkills: 'good' }))
  .set({ authorName: (q) => q.ref('author.name') });

// update from any table using custom `on` conditions:
db.books
  .updateFrom(
    () => db.authors,
    (q) => q.on('authors.id', 'books.authorId'),
  )
  .set({ authorName: (q) => q.ref('author.name') });

// conditions after `updateFrom` can reference both tables:
db.books
  .updateFrom(() => db.authors)
  .where({
    'authors.id': (q) => q.ref('books.authorId'),
  })
  .set({ authorName: (q) => q.ref('author.name') });

// can join and use another table in between `updateFrom` and `set`:
db.books
  .updateFrom('author')
  .join('publisher')
  .set({
    authorName: (q) => q.ref('author.name'),
    publisherName: (q) => q.ref('publisher.name'),
  });

// updating from a CTE
db.books
  .with('a', () =>
    db.authors.where({ writingSkills: 'good' }).select('id', 'name').limit(10),
  )
  .updateFrom('a', (q) => q.on('a.id', 'books.authorId'))
  .set({ authorName: (q) => q.ref('author.name') });
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

## updateMany

[//]: # 'has JSDoc'

Updates multiple records with different per-row data in a single query.

Each row must include the primary key and the columns to update.
All rows must have the same set of non-key columns.

Returns a count of updated records by default.
Use `select`, `selectAll`, `get`, or `pluck` alongside `updateMany` to return updated records.

Throws [NotFoundError](/guide/error-handling) if any record is not found.
Use `updateManyOptional` to skip missing records without throwing.

```ts
// returns count of updated records
const count = await db.table.updateMany([
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
]);

// returns array of updated records
const records = await db.table.select('id', 'name').updateMany([
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]);
```

`.set()` applies shared values to all rows.
`.set()` values take precedence over per-row values for the same column.

```ts
await db.table
  .updateMany([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ])
  .set({ updatedBy: currentUser.id });
```

## updateManyOptional

[//]: # 'has JSDoc'

Same as `updateMany`, but skips missing records rather than throwing.

```ts
// updates what it can, doesn't throw for missing id: 999
const count = await db.table.updateManyOptional([
  { id: 1, name: 'Alice' },
  { id: 999, name: 'Ghost' },
]);
```

## updateManyBy

[//]: # 'has JSDoc'

Like `updateMany`, but matches rows by a unique column or a compound unique constraint instead of the primary key.

Throws [NotFoundError](/guide/error-handling) if any record is not found.
Use `updateManyByOptional` to skip records with no matching key without throwing.

```ts
// single unique column
await db.table.updateManyBy('email', [
  { email: 'alice@test.com', name: 'Alice' },
  { email: 'bob@test.com', name: 'Bob' },
]);

// compound unique constraint
await db.table.updateManyBy(
  ['firstName', 'lastName'],
  [{ firstName: 'John', lastName: 'Doe', bio: 'updated' }],
);
```

## updateManyByOptional

[//]: # 'has JSDoc'

Same as `updateManyBy`, but skips records with no matching key rather than throwing.

```ts
await db.table.updateManyByOptional('email', [
  { email: 'alice@test.com', name: 'Alice' },
  { email: 'unknown@test.com', name: 'Ghost' },
]);
```
