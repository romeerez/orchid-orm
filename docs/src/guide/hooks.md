# Lifecycle hooks

You can specify functions that will be called before or after certain type of query happens for the table.

These functions are executed concurrently by using `Promise.all` under the hood before and after the query.

First argument is a query object, `after` hooks have a second argument with a data returned from the database.

```ts
// query is a query object
type BeforeCallback = (query: Query) => void | Promise<void>;

// query is a query object, data is the result of the query
type AfterCallback = (query: Query, data: unknown) => void | Promise<void>;
```

## Setting hooks in a table

Lifecycle hooks can be defined in the table definition with `hooks = this.setHooks({ ... })`.

However, if you want to use a `db` instance to perform queries inside a hook, this won't work because `db` depends on this table,
and the table definition cannot depend on a `db`. For this case, see [setting hooks after defining db](/guide/hooks.html#setting-hooks-after-defining-db).

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  hooks = this.setHooks({
    // runs before any kind of query
    beforeQuery(q) {},
    // runs after any kind of query
    afterQuery(q, data) {},
    // runs before `create`, `createMany` queries
    beforeCreate(q) {},
    // runs after `create`, `createMany` queries
    afterCreate(q, data) {},
    // runs before `update` queries
    beforeUpdate(q) {},
    // runs after `update` queries
    afterUpdate(q, data) {},
    // runs before create or update queries
    beforeSave(q) {},
    // runs after create or update queries
    afterSave(q, data) {},
    // runs before delete queries
    beforeDelete(q) {},
    // runs after delete queries
    afterDelete(q, data) {},
  });
}
```

If the query has both `beforeQuery` and `beforeCreate`, `beforeCreate` will run first.

If the query has both `afterQuery` and `afterCreate`, `afterCreate` will run last.

The hooks also being called when performing nested [updates](/guide/relation-queries.html#nested-update) or [creates](/guide/relation-queries.html#nested-create):

```ts
// if the Author table has `beforeQuery`, `beforeCreate`, or `beforeSave` hook
// it will be called
const book = await db.book.create({
  title: 'Book title',
  author: {
    create: {
      name: 'Author',
    },
  },
});

// if the Author table has `beforeQuery`, `beforeUpdate`, or `beforeSave` hook
// it will be called
await db.book.find(1).update({
  author: {
    update: {
      name: 'new name',
    },
  },
});
```

## Setting hooks after defining db

If you want to use a `db` instance inside the hook, the function cannot be located in the table definition,
but it should be assigned after `const db = orchidORM(...)` occurs.

Pass the same hooks as shown above in `this.setHooks` to a `addTableHooks` function:

```ts
import { addTableHooks } from 'orchid-orm';

const db = orchidORM({ ...config }, { someTable: SomeTable });

addTableHooks(db.someTable, {
  async beforeSave(q) {
    // you can use db here:
    await db.someTable.where(...someConditions).update(...someData);
  },
  async afterSave(q, data) {
    // you can use db here as well:
    await db.someTable.where(...someConditions).update(...someData);
  },
});
```

## Setting hooks on a query

The lifecycle hooks can also be added to a query chain, and they will run only for this specific query:

```ts
await db.table
  .beforeQuery(() => console.log('before query'))
  .afterQuery((_, data) => console.log('after query', data))
  .all();

await db.table
  .beforeCreate(() => console.log('before create'))
  .afterCreate((_, data) => console.log('after create', data))
  .beforeSave(() => console.log('before save'))
  .afterSave((_, data) => console.log('after save', data))
  .create(data);

await db.table
  .beforeUpdate(() => console.log('before update'))
  .afterUpdate((_, data) => console.log('after update', data))
  .beforeSave(() => console.log('before save'))
  .afterSave((_, data) => console.log('after save', data))
  .where({ ...conditions })
  .update({ key: 'value' });

await db.table
  .beforeDelete(() => console.log('before delete'))
  .afterDelete((_, data) => console.log('after delete', data))
  .where({ ...conditions })
  .delete();
```
