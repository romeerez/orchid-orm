# Transactions

All queries within a transaction are executed on the same database connection and run the entire set of queries as a single unit of work. Any failure will mean the database will rollback any queries executed on that connection to the pre-transaction state.

## transaction

In Orchid ORM the method is `$transaction`, when using `pqb` on its own it is `transaction`.

`COMMIT` happens automatically after the callback was successfully resolved, and `ROLLBACK` is done automatically if the callback fails.

Let's consider the case of transferring money from one user to another:

```ts
export const transferMoney = async (
  fromId: number,
  toId: number,
  amount: number,
) => {
  try {
    // db.$transaction returns data that is returned from the callback
    // result here is senderRemainder
    const result = await db.$transaction(async () => {
      const sender = await db.user.find(fromId);
      const senderRemainder = sender.balance - amount;
      if (senderRemainder < 0) {
        throw new Error('Sender does not have enough money');
      }

      await db.user.find(fromId).decrement({
        balance: amount,
      });
      await db.user.find(toId).increment({
        balance: amount,
      });

      return senderRemainder;
    });
  } catch (error) {
    // handle transaction error
  }
};
```

It performs 3 queries in a single transaction: load sender record, decrement sender's balance, increment receiver's balance.

If sender or receiver record doesn't exist, it will throw `NotFound` error, and there is an error thrown when sender's balance is too low.
In such case, the transaction will be rolled back and no changes will be applied to the database.

Internally, ORM relies on [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) feature of node.js,
it allows passing the transaction object implicitly. So that any query that is done inside of callback, will run inside a transaction.

## isolation level

By default, transaction isolation level is `SERIALIZABLE`, it is the strictest level and suites most cases.

You can choose other level by passing it as a string to `$transaction`:

```ts
// allowed levels:
type IsolationLevel =
  | 'SERIALIZABLE'
  | 'REPEATABLE READ'
  | 'READ COMMITTED'
  | 'READ UNCOMMITTED';

db.$transaction('REPEATABLE READ', async () => {
  // ...
});
```

## read only, deferrable

Transactions in Postgres can accept `READ WRITE` | `READ ONLY` and `[ NOT ] DEFERRABLE` options ([Postgres docs](https://www.postgresql.org/docs/current/sql-set-transaction.html)).

You can set it by passing such object:

```ts
db.$transaction(
  {
    // optionally, you can set level here:
    // level: 'REPEATABLE READ',
    readOnly: true,
    deferrable: true,
  },
  async () => {
    // ...
  },
);
```

## forUpdate

To be used in select queries inside the transaction adds the `FOR UPDATE` table lock modifier.

```ts
await db.$transaction(async () => {
  await db.table.forUpdate();

  // Can specify columns for the lock (FOR UPDATE OF column list)
  await db.table.forUpdate(['someColumn', 'otherColumn']);
});
```

## forNoKeyUpdate

To be used in select queries inside the transaction adds the `FOR NO KEY UPDATE` table lock modifier.

```ts
await db.$transaction(async () => {
  await db.table.forUpdate();

  // Can specify columns for the lock (FOR NO KEY UPDATE OF column list)
  await db.table.forNoKeyUpdate(['someColumn', 'otherColumn']);
});
```

## forShare

To be used in select queries inside the transaction adds the `FOR SHARE` table lock modifier.

```ts
await db.$transaction(async () => {
  await db.table.forUpdate();

  // Can specify columns for the lock (FOR SHARE OF column list)
  await db.table.forShare(['someColumn', 'otherColumn']);
});
```

## forKeyShare

To be used in select queries inside the transaction adds the `FOR KEY SHARE` table lock modifier.

```ts
await db.$transaction(async () => {
  await db.table.forUpdate();

  // Can specify columns for the lock (FOR KEY SHARE OF column list)
  await db.table.forKeyShare(['someColumn', 'otherColumn']);
});
```

## skipLocked

This method can be used after a lock mode has been specified with either `forUpdate` or `forShare`, and will cause the query to skip any locked rows, returning an empty set if none are available.

```ts
await db.$transaction(async () => {
  await db.table.forUpdate().skipLocked();
});
```

## noWait

This method can be used after a lock mode has been specified with either forUpdate or forShare, and will cause the query to fail immediately if any selected rows are currently locked.

```ts
await db.$transaction(async () => {
  await db.table.forUpdate().noWait();
});
```
