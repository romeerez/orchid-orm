# Query builder callbacks

You can add callbacks to run before or after the query. 

Callbacks are executed concurrently by using `Promise.all` under the hood.

```ts
// query is a query object
type BeforeCallback = (query: Query) => void | Promise<void>

// query is a query object, data is result of the query
type AfterCallback = (query: Query, data: unknown) => void | Promise<void>
```

## beforeQuery, afterQuery

`beforeQuery` and `afterQuery` callbacks will run on any kind of query.

If query has both `beforeQuery` and `beforeInsert`, `beforeInsert` will run first.

If query has both `afterQuery` and `afterInsert`, `afterInsert` will run last.

```ts
await Table
  .beforeQuery(() => console.log('before query'))
  .afterQuery((_, data) => console.log('after query', data))
  .all()
```

## beforeInsert, afterInsert

`beforeInsert` and `afterInsert` callbacks will run only on insert query:

```ts
await Table
  .beforeInsert(() => console.log('before insert'))
  .afterInsert((_, data) => console.log('after insert', data))
  .create(data)
```

## beforeUpdate, afterUpdate

`beforeUpdate` and `afterUpdate` callbacks will run only on update query:

```ts
await Table
  .beforeUpdate(() => console.log('before update'))
  .afterUpdate((_, data) => console.log('after update', data))
  .where({ ...conditions })
  .update({ key: 'value' })
```

## beforeDelete, afterDelete

`beforeDelete` and `afterDelete` callbacks will run only on delete query:

```ts
await Table
  .beforeDelete(() => console.log('before delete'))
  .afterDelete((_, data) => console.log('after delete', data))
  .where({ ...conditions })
  .delete()
```
