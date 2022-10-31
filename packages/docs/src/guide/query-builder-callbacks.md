# Query builder callbacks

Before callbacks run before query and have such type:

(returned promise will be awaited)

```ts
// query is a query object
type BeforeCallback = (query: Query) => void | Promise<void>
```

After callbacks run after query and have such type:

(returned promise will be awaited)

```ts
// query is a query object, data is result of the query
type AfterCallback = (query: Query, data: unknown) => void | Promise<void>
```

`beforeQuery` and `afterQuery` callbacks will run on any kind of query:

```ts
await Table
  .beforeQuery(() => console.log('before query'))
  .afterQuery((_, data) => console.log('after query', data))
  .all()
```

`beforeInsert` and `afterInsert` callbacks will run only on insert query:

```ts
await Table
  .beforeInsert(() => console.log('before insert'))
  .afterInsert((_, data) => console.log('after insert', data))
  .all()
```

`beforeUpdate` and `afterUpdate` callbacks will run only on update query:

```ts
await Table
  .beforeUpdate(() => console.log('before update'))
  .afterUpdate((_, data) => console.log('after update', data))
  .all()
```
