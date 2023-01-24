# Update records

## update

`.update` takes an object with columns and values to update records.

By default `.update` will return a count of created records.

Place `.select`, `.selectAll`, or `.get` before `.update` to specify returning columns.

You need to provide `.where`, `.findBy`, or `.find` conditions before calling `.update`.
To ensure that the whole table won't be updated by accident, updating without where conditions will result in TypeScript and runtime errors.

To update the table without conditions use `where` method without arguments:

```ts
await Table.where().update({ name: 'new name' })
```

If `.select` and `.where` were specified before the update it will return an array of updated records.

If `.select` and `.take`, `.find`, or similar were specified before the update it will return one updated record.

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

`null` value will set a column to `NULL`, and the `undefined` value will be skipped:
```ts
Table.findBy({ id: 1 }).update({
  name: null, // updates to null
  age: undefined, // skipped, no effect
})
```

## updateRaw

`updateRaw` is for updating records with raw expression.

The behavior is the same as a regular `update` method has:
`find` or `where` must precede calling this method,
it returns an updated count by default,
you can customize returning data by using `select`.

```ts
const updatedCount = await Table.find(1).updateRaw(
  Table.raw(`name = $name`, { name: 'name' })
)
```

## updateOrThrow

To make sure that at least one row was updated use `updateOrThrow`:

```ts
import { NotFoundError } from 'pqb'

try {
  // updatedCount is guaranteed to be greater than 0
  const updatedCount = await Table.where(conditions).updateOrThrow({ name: 'name' })

  // updatedRecords is guaranteed to be a non-empty array
  const updatedRecords = await Table.where(conditions).select('id')
    .updateOrThrow({ name: 'name' })
} catch (err) {
  if (err instanceof NotFoundError) {
    // handle error
  }
}
```

## upsert

`.upsert` tries to update one record, and it will perform create in case a record was not found.

It will implicitly wrap queries in a transaction if it was not wrapped yet.

`.find` or `.findBy` must precede `.upsert` because it does not work with multiple updates.

In case more than one row was updated, it will throw `MoreThanOneRowError` and the transaction will be rolled back.

`update` and `create` properties are accepting the same type of objects as the `update` and `create` commands.

Not returning a value by default, place `.select` or `.selectAll` before `.upsert` to specify returning columns.

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
