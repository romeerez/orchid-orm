# Delete records

## del / delete

Aliased to `del` as `delete` is a reserved word in JavaScript,
this method deletes one or more rows,
based on other conditions specified in the query.

By default `.delete` will return a count of deleted records.

Place `.select`, `.selectAll`, or `.get` before `.delete` to specify returning columns.

Need to provide `.where`, `.findBy`, or `.find` conditions before calling `.delete`.
To prevent accidental deletion of all records, deleting without where will result in TypeScript and a runtime error.

To delete all records without conditions add an empty `where`:

```ts
await Table.where().delete()
```

```ts
// deletedCount is the number of deleted records
const deletedCount = await Table
  .where(...conditions)
  .delete()

// returns a single value, throws if not found
const id: number | undefined = await Table
  .findBy(...conditions)
  .get('id')
  .delete()

// returns an array of records with specified columns
const deletedRecord = await Table
  .select('id', 'name', 'age')
  .where(...conditions)
  .delete()

// returns an array of fully deleted records
const deletedUsersFull = await Table
  .selectAll()
  .where(...conditions)
  .delete()
```

`.delete` supports joining, under the hood the join is transformed to `USING` and `WHERE` statements:

```ts
// delete all users who have corresponding profile records:
Table
  .join(Profile, 'profile.userId', 'user.id')
  .where()
  .delete()
```
