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

## nested transactions

Transactions can be nested one in another.
The top level transaction is the real one,
and the nested ones are emulated with [savepoint](https://www.postgresql.org/docs/current/sql-savepoint.html) instead of `BEGIN`
and [release savepoint](https://www.postgresql.org/docs/current/sql-release-savepoint.html) instead of `COMMIT`.

```ts
const result = await db.$transaction(async () => {
  await db.table.create(...one);
  
  const result = await db.$transaction(async () => {
    await db.table.create(...two)
    return 123;
  });
  
  await db.table.create(...three);
  
  return result;
});

// result is returned from the inner transaction
result === 123;
```

If the inner transaction throws an error, and it is caught by `try/catch` of outer transaction,
it performs [rollback to savepoint](https://www.postgresql.org/docs/current/sql-rollback-to.html)
and the outer transaction can continue:

```ts
class CustomError extends Error {}

await db.$transaction(async () => {
  try {
    await db.$transaction(async () => {
      throw new CustomError()
    })
  } catch (err) {
    if (err instanceof CustomError) {
      // ignore this error
      return;
    }
    throw err;
  }
  
  // this transaction can continue
  await db.table.create(...data)
})
```

If the error in the inner transaction is not caught, all nested transactions are rolled back and aborted.

## testTransaction

`Orchid ORM` has a special utility to wrap your tests in transactions which are rolled back after each test.
This allows to keep the database state unchanged between test runs.
In such way, tests runs very fast, because data is never saved to disc, all data changes are handled by Postgres in memory.

Create a separate file for test utilities, let's say it is located in `src/lib/test-utils.ts`, and export such "hook":

```ts
// src/lib/test-utils.ts
import { testTransaction } from 'orchid-orm';
import { db } from './path-to-your-db';

export const useTestDatabase = () => {
  beforeAll(async () => {
    await testTransaction.start(db);
  });

  beforeEach(async () => {
    await testTransaction.start(db);
  });

  afterEach(async () => {
    await testTransaction.rollback(db);
  });

  afterAll(async () => {
    await testTransaction.close(db);
  });
};
```

- `testTransaction.start` starts a new transaction
- `testTransaction.rollback` performs a rollback
- `testTransaction.close` performs a rollback, when called for a top-level transaction it will close `db`.

Now, we can use it in our tests in such way:

```ts
import { useTestDatabase } from '../lib/test-utils';
import { db } from '../path-to-your-db';

describe('title', () => {
  useTestDatabase();

  it('should create a record', async () => {
    await db.table.create({ ...data });

    const count = await db.table.count();
    // record was successfully created:
    expect(count).toBe(1);
  });

  it('should run a nested transaction', async () => {
    // the record from the previous test disappeared
    expect(await db.table.count()).toBe(0);
    
    // nested transactions works just fine
    await db.$transaction(async () => {
      await db.table.create({ ...data });
    });
    
    // record in a nested transaction was saved and is available until the end of this `it` test block
    const count = await db.table.count();
    expect(count).toBe(1);
  });
});
```

Additionally, you can use `useTestDatabase` in the nested `describe` to have a data created only in the scope of this `describe`:

```ts
import { useTestDatabase } from './test-utils';

describe('outer', () => {
  useTestDatabase();
  
  it('should have no records', async () => {
    expect(await db.table.count()).toBe(0);
  });
  
  describe('inner', () => {
    useTestDatabase();
    
    beforeAll(async () => {
      await db.table.create(...data)
    });
    
    // all `it` block in the inner describe will have a created record in the db
    it('should have the created record', async () => {
      expect(await db.table.count(1)).toBe(1);
    });
  })
  
  // data was cleared in the end of inner describe
  it('should have no records again', async () => {
    expect(await db.table.count()).toBe(0);
  });
});
```

Check out [test factories](/guide/test-factories), a perfect pair with `testTransaction` to use for testing.

## isolation level

By default, transaction isolation level is `SERIALIZABLE`, it is the strictest level and suites most cases.

You can choose other level by passing it as a string to `$transaction` (this is ignored for nested transactions):

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

You can set it by passing such object (this is ignored for nested transactions):

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
