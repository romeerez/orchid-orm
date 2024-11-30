# Lifecycle hooks

You can specify functions that will be called before or after a certain type of query executes for the table.

The hook functions are called when records are created, updated, or deleted for a specific table, and they are also called when performing nested
[updates](/guide/relation-queries#nested-update),
[creates](/guide/relation-queries#nested-create),
and [deletes](/guide/relation-queries#delete-related-records).

## before hooks

`before*` hooks don't receive data from a database, as they run before the query.

Functions may return a `Promise`, and all before hook promises will be awaited with `Promise.all` before the query execution.

The argument passed to a function is a query object that is going to be executed.

If the query has both `beforeQuery` and `beforeCreate`, `beforeCreate` will run first.

[orCreate](/guide/create-update-delete.html#orcreate) executes two queries: the first to find a record, and the second to find and create if not found.
If the record is created by another process in between the two queries, `beforeCreate` hook will be triggerred, but no new data will be created.

[upsert](/guide/create-update-delete.html#upsert) has the same behavior for `beforeCreate` as `orCreate`.
`beforeUpdate` hook is always called once by this `upsert` command, even if the record for the update does not exist.

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    // `before` hooks don't receive data, only a query object
    this.beforeQuery((q) => console.log('before any query'));
    this.beforeCreate((q) => console.log('before create'));
    this.beforeUpdate((q) => console.log('before update'));
    this.beforeSave((q) => console.log('before create or update'));
    this.beforeDelete((q) => console.log('before delete'));

    // the `orm` argument is to be used for making queries in the query callbacks
    this.beforeUpdate(async () => {
      const data = await orm.someTable.where(...).select(...)
      // ...performing logic with the data
    })
  }
}
```

## after hooks

`after*` hooks require listing what columns are needed for the function,
so that data is selected from a database after creating, updating, or deleting records, and passed to a function.

The first argument is the array of records returned from a database,
it's guaranteed that the data has all the specified columns.

The second argument is a query object that was executed.

If no records were updated or deleted, the `afterUpdate` and `afterDelete` hooks **won't** run.

**Important note**: `after*` hooks are running in the same transaction as the query.
If the query wasn't running in a transaction, a new transaction will be opened automatically, and the query itself and all the `after*` hooks will be executed within it.
If the `after*` hook throws an error, the transaction will be rolled back and the query won't have any effect.

This makes `after*` hooks the right choice for updating something in a database based on the change, to ensure that all changes were applied, or all changes were rolled back together,
and it's impossible to have only a partially applied change.

For example, imagine we're building a messenger, each chat has a column `lastMessageText` which displays the text of the last message.
We can attach the `afterCreate` hook to a message, require its `chatId` and `text`, and update the `lastMessageText` of the chat in the hook.
And it won't be possible that the message was created but `lastMessageText` of the chat wasn't updated due to some error.

`after*` hooks are **not** a right choice for sending emails from it, and performing side effects that are not revertable by a rollback of the transaction.
For such side effects use [after-commit hooks](#after-commit-hooks).

The `afterQuery` hook is running after _any_ query, even when we're only selecting `count`, so it cannot select specific columns and doesn't have predictable data.

If the query has both `afterQuery` and `afterCreate`, `afterCreate` will run last.

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    // data is of type `unknown` - it can be anything
    this.afterQuery((data, q) => console.log('after any query'));

    // select `id` and `name` for the after-create hook
    this.afterCreate(['id', 'name'], (data, q) => {
      // data is an array of records
      for (const record of data) {
        // `id` and `name` are guaranteed to be loaded
        console.log(`Record with id ${record.id} has name ${record.name}.`);
      }
    });

    this.afterUpdate(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were updated`),
    );

    // run after creating and after updating
    this.afterSave(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were created or updated`),
    );

    this.afterDelete(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were deleted`),
    );
  }
}
```

Note the `orm: typeof db` argument: it is the db instance that has all the tables you can perform queries with.

For example, each time when a comment is created, we want to increase the `commentCount` column of the post where the comment belongs to:

```ts
class CommentTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    this.afterCreate(['postId'], async (data, q) => {
      const allPostIds = data.map((comment) => comment.postId);
      const uniquePostIds = [...new Set(allPostIds)];

      for (const postId of uniquePostIds) {
        // all the post update queries will be executed in a single transaction with the original query
        await db.post.find(postId).increment({
          commentsCount: data.filter((comment) => comment.postId === postId)
            .length,
        });
      }
    });
  }
}
```

## after-commit hooks

After-commit hooks are similar to [after hook](#after-hooks): they also can access the records data with the specified columns.

If the query was wrapped into a transaction, these hooks will run after the commit. For a single query without a transaction, these hooks will run after the query.

Regular [after hooks](#after-hooks) will run before the transaction commit, and it's possible that some of the following queries inside a transaction will fail and the transaction will be rolled back.
After-commit hooks have a guarantee that the transaction, or a single query, finished successfully before running the hook.

If no records were updated or deleted, the `afterUpdateCommit` and `afterDeleteCommit` hooks **won't** run.

If at least one of the after commit hooks fails, the whole transaction (even though it is committed) throws a special [AfterCommitError](#AfterCommitError) error.
Consider [catchAfterCommitError](#catchAfterCommitError) for catching such errors.

**after-commit** hooks are a better option for performing side effects outside of transaction, but beware that if a side effect, such as sending an email, fails, the transaction is not rolled back.
Third-party services can fail, leaving the side effect non-applied, even though the transaction data was persisted.
It's better to send such actions to a persistent message queue, where actions can be retried and monitored.

Even with a message queue in place, there is still a chance that the message queue itself will fail to accept the message, causing a loss of the needed action.
To have a 100% guarantee that the side effect is going to eventually happen, you need to apply some of distributed transaction techniques, such as Outbox Pattern.

In the case of sending emails upon user registration, you could save "send a registration email" action to a special table from the `afterCreate` hook,
then in `afterCreateCommit` send it to a message queue, then delete it from the special table.
If the message queue fails, the action is still saved in a db table, the table could be periodically scanned in a cron job and sent to the queue.

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    // select `id` and `name` for the after-create hook
    this.afterCreateCommit(['id', 'name'], (data, q) => {
      // data is an array of records
      for (const record of data) {
        // `id` and `name` are guaranteed to be loaded
        console.log(`Record with id ${record.id} has name ${record.name}.`);
      }
    });

    this.afterUpdateCommit(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were updated`),
    );

    // run after creating and after updating
    this.afterSaveCommit(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were created or updated`),
    );

    this.afterDeleteCommit(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were deleted`),
    );
  }
}
```

## setting hooks on a query

The lifecycle hooks can also be added to a query chain, and they will run only for this specific query:

```ts
await db.table
  .beforeQuery((q) => console.log('before any query'))
  // data is of type `unknown`
  .afterQuery((data, q) => console.log('after any query', data))
  .all();

await db.table
  .beforeCreate(() => console.log('before create'))
  .afterCreate(['id', 'name'], (data, q) => console.log('after create'))
  .afterCreateCommit(['id', 'name'], (data, q) =>
    console.log('after create commit'),
  )
  .beforeSave(() => console.log('before create or update'))
  .afterSave(['id', 'name'], (q, data) => console.log('after create or update'))
  .afterSaveCommit(['id', 'name'], (data, q) =>
    console.log('after create or update commit'),
  )
  .create(data);

await db.table
  .beforeUpdate(() => console.log('before update'))
  .afterUpdate((data, q) => console.log('after update'))
  .afterUpdateCommit((data, q) => console.log('after update commit'))
  .beforeSave(() => console.log('before save'))
  .afterSave((data, q) => console.log('after save'))
  .afterSaveCommit((data, q) => console.log('after save commit'))
  .where({ ...conditions })
  .update({ key: 'value' });

await db.table
  .beforeDelete(() => console.log('before delete'))
  .afterDelete((data, q) => console.log('after delete'))
  .afterDeleteCommit((data, q) => console.log('after delete commit'))
  .where({ ...conditions })
  .delete();
```

## catchAfterCommitError

[//]: # 'has JSDoc'

Add `catchAfterCommitError` to the query to catch possible errors that are coming from after commit hooks.

When it is used, the transaction will return its result disregarding of a failed hook.

Without `catchAfterCommitError`, the transaction function throws and won't return result.
Result is still accessible from the error object [AfterCommitError](#AfterCommitError).

```ts
const result = await db
  .$transaction(async () => {
    return db.table.create(data);
  })
  .catchAfterCommitError((err) => {
    // err is instance of AfterCommitError (see below)
  });

// result is available even if an after commit hook has failed
result.id;
```

## AfterCommitError

[//]: # 'has JSDoc'

`AfterCommitError` is thrown when one of after commit hooks throws.

```ts
interface AfterCommitError extends OrchidOrmError {
  // the result of transaction functions
  result: unknown;

  // Promise.allSettled result + optional function names
  hookResults: (
    | {
        status: 'fulfilled';
        value: unknown;
        name?: string;
      }
    | {
        status: 'rejected';
        reason: any; // the error object thrown by a hook
        name?: string;
      }
  )[];
}
```

Use `function name() {}` function syntax for hooks to give them names,
so later they can be identified when handling after commit errors.

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    // anonymous funciton - has no name
    this.afterCreateCommit([], async () => {
      // ...
    });

    // named function
    this.afterCreateCommit([], function myHook() => {
      // ...
    });
  }
}
```
