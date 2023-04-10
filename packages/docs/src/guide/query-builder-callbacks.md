# Query builder callbacks

You can add callbacks to run before or after the query.

Callbacks are executed concurrently by using `Promise.all` under the hood.

```ts
// query is a query object
type BeforeCallback = (query: Query) => void | Promise<void>

// query is a query object, data is the result of the query
type AfterCallback = (query: Query, data: unknown) => void | Promise<void>
```

## beforeQuery, afterQuery

`beforeQuery` and `afterQuery` callbacks will run on any kind of query.

If the query has both `beforeQuery` and `beforeCreate`, `beforeCreate` will run first.

If the query has both `afterQuery` and `afterCreate`, `afterCreate` will run last.

```ts
await db.table
  .beforeQuery(() => console.log('before query'))
  .afterQuery((_, data) => console.log('after query', data))
  .all()
```

## beforeCreate, afterCreate

`beforeCreate` and `afterCreate` callbacks will run only on the `create` query:

```ts
await db.table
  .beforeCreate(() => console.log('before create'))
  .afterCreate((_, data) => console.log('after create', data))
  .create(data)
```

## beforeUpdate, afterUpdate

`beforeUpdate` and `afterUpdate` callbacks will run only on the update query:

```ts
await db.table
  .beforeUpdate(() => console.log('before update'))
  .afterUpdate((_, data) => console.log('after update', data))
  .where({ ...conditions })
  .update({ key: 'value' })
```

## beforeDelete, afterDelete

`beforeDelete` and `afterDelete` callbacks will run only on the delete query:

```ts
await db.table
  .beforeDelete(() => console.log('before delete'))
  .afterDelete((_, data) => console.log('after delete', data))
  .where({ ...conditions })
  .delete()
```
