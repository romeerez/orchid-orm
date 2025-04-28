# 事务

事务中的所有查询都在同一个数据库连接上执行，并将整个查询集作为一个单元运行。任何失败都将导致数据库回滚该连接上执行的所有查询，恢复到事务前的状态。

## transaction

[//]: # 'has JSDoc'

在 Orchid ORM 中，该方法是 `$transaction`，当单独使用 `pqb` 时，它是 `transaction`。

`COMMIT` 会在回调成功解析后自动发生，而如果回调失败，则会自动执行 `ROLLBACK`。

让我们考虑从一个用户向另一个用户转账的情况：

```ts
export const transferMoney = async (
  fromId: number,
  toId: number,
  amount: number,
) => {
  try {
    // db.$transaction 返回从回调中返回的数据
    // 此处的结果是 senderRemainder
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
    // 处理事务错误
  }
};
```

它在单个事务中执行了 3 个查询：加载发送者记录、减少发送者的余额、增加接收者的余额。

如果发送者或接收者记录不存在，它将抛出 `NotFound` 错误，并且当发送者的余额太低时会抛出错误。
在这种情况下，事务将被回滚，数据库不会应用任何更改。

在内部，ORM 依赖于 Node.js 的 [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) 功能，
它允许隐式传递事务对象。因此，任何在回调中完成的查询都将在事务中运行。

## 嵌套事务

[//]: # 'has JSDoc'

事务可以嵌套在另一个事务中。
顶级事务是真实的事务，
而嵌套事务是通过 [savepoint](https://www.postgresql.org/docs/current/sql-savepoint.html) 而不是 `BEGIN` 来模拟的，
并通过 [release savepoint](https://www.postgresql.org/docs/current/sql-release-savepoint.html) 而不是 `COMMIT` 来模拟。

使用 [ensureTransaction](#ensuretransaction) 在单个事务中运行所有查询。

```ts
const result = await db.$transaction(async () => {
  await db.table.create(...one);

  const result = await db.$transaction(async () => {
    await db.table.create(...two);
    return 123;
  });

  await db.table.create(...three);

  return result;
});

// result 是从内部事务返回的
result === 123;
```

如果内部事务抛出错误，并且被外部事务的 `try/catch` 捕获，
它会执行 [rollback to savepoint](https://www.postgresql.org/docs/current/sql-rollback-to.html)，
外部事务可以继续：

```ts
class CustomError extends Error {}

await db.$transaction(async () => {
  try {
    await db.$transaction(async () => {
      throw new CustomError();
    });
  } catch (err) {
    if (err instanceof CustomError) {
      // 忽略此错误
      return;
    }
    throw err;
  }

  // 此事务可以继续
  await db.table.create(...data);
});
```

如果内部事务中的错误未被捕获，则所有嵌套事务将被回滚并中止。

## ensureTransaction

[//]: # 'has JSDoc'

当您希望确保查询序列在事务中运行，但不需要 Postgres [savepoints](https://www.postgresql.org/docs/current/sql-savepoint.html) 时，请使用 `$ensureTransaction`。

```ts
async function updateUserBalance(userId: string, amount: number) {
  await db.$ensureTransaction(async () => {
    await db.transfer.create({ userId, amount })
    await db.user.find(userId).increment({ balance: amount })
  })
}

async function saveDeposit(userId: string, deposit: { ... }) {
  await db.$ensureTransaction(async () => {
    await db.deposit.create(deposit)
    // updateUserBalance 中的事务不会启动
    await updateUserBalance(userId, deposit.amount)
  })
}
```

## isInTransaction

返回 `true` 或 `false` 以检查是否在事务中。

忽略打开的 [test transaction](#testtransaction)。

```ts
db.$isInTransaction(); // -> false

db.$transaction(async () => {
  db.$isInTransaction(); // -> true
});
```

## testTransaction

`Orchid ORM` 有一个特殊的工具，可以将您的测试包装在事务中，这些事务在每次测试后都会回滚。
这允许在测试运行之间保持数据库状态不变。
以这种方式运行测试非常快，因为数据从未保存到磁盘，所有数据更改都由 Postgres 在内存中处理。

为测试工具创建一个单独的文件，比如它位于 `src/lib/test-utils.ts`，并导出这样的“钩子”：

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

- `testTransaction.start` 启动一个新事务
- `testTransaction.rollback` 执行回滚
- `testTransaction.close` 执行回滚，当为顶级事务调用时，它将关闭 `db`。

现在，我们可以在测试中这样使用它：

```ts
import { useTestDatabase } from '../lib/test-utils';
import { db } from '../path-to-your-db';

describe('title', () => {
  useTestDatabase();

  it('should create a record', async () => {
    await db.table.create({ ...data });

    const count = await db.table.count();
    // 记录已成功创建：
    expect(count).toBe(1);
  });

  it('should run a nested transaction', async () => {
    // 上一个测试中的记录消失了
    expect(await db.table.count()).toBe(0);

    // 嵌套事务工作正常
    await db.$transaction(async () => {
      await db.table.create({ ...data });
    });

    // 嵌套事务中的记录已保存，并在此 `it` 测试块结束之前可用
    const count = await db.table.count();
    expect(count).toBe(1);
  });
});
```

此外，您可以在嵌套的 `describe` 中使用 `useTestDatabase`，以便仅在此 `describe` 的范围内创建数据：

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
      await db.table.create(...data);
    });

    // 内部 describe 中的所有 `it` 块将在数据库中有一个创建的记录
    it('should have the created record', async () => {
      expect(await db.table.count(1)).toBe(1);
    });
  });

  // 数据在内部 describe 结束时被清除
  it('should have no records again', async () => {
    expect(await db.table.count()).toBe(0);
  });
});
```

查看 [test factories](/zh-CN/guide/test-factories)，它是与 `testTransaction` 搭配使用的完美工具。

## isolation level

默认情况下，事务隔离级别是 `SERIALIZABLE`，它是最严格的级别，适合大多数情况。

您可以通过将其作为字符串传递给 `$transaction` 来选择其他级别（对于嵌套事务，此设置将被忽略）：

```ts
// 允许的级别：
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

Postgres 中的事务可以接受 `READ WRITE` | `READ ONLY` 和 `[ NOT ] DEFERRABLE` 选项 ([Postgres docs](https://www.postgresql.org/docs/current/sql-set-transaction.html))。

您可以通过传递这样的对象来设置它（对于嵌套事务，此设置将被忽略）：

```ts
db.$transaction(
  {
    // 可选地，您可以在此处设置级别：
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

在事务中的选择查询中使用，为表锁添加 `FOR UPDATE` 修饰符。

```ts
await db.$transaction(async () => {
  await db.table.forUpdate();

  // 可以指定锁定的表（FOR UPDATE OF table list）
  await db.table.forUpdate(['someTable', 'otherTable']);
});
```

## forNoKeyUpdate

在事务中的选择查询中使用，为表锁添加 `FOR NO KEY UPDATE` 修饰符。

```ts
await db.$transaction(async () => {
  await db.table.forUpdate();

  // 可以指定锁定的表（FOR NO KEY UPDATE OF table list）
  await db.table.forNoKeyUpdate(['someTable', 'otherTable']);
});
```

## forShare

在事务中的选择查询中使用，为表锁添加 `FOR SHARE` 修饰符。

```ts
await db.$transaction(async () => {
  await db.table.forUpdate();

  // 可以指定锁定的表（FOR SHARE OF table list）
  await db.table.forShare(['someTable', 'otherTable']);
});
```

## forKeyShare

在事务中的选择查询中使用，为表锁添加 `FOR KEY SHARE` 修饰符。

```ts
await db.$transaction(async () => {
  await db.table.forUpdate();

  // 可以指定锁定的表（FOR KEY SHARE OF table list）
  await db.table.forKeyShare(['someTable', 'otherTable']);
});
```

## skipLocked

此方法可以在使用 `forUpdate` 或 `forShare` 指定锁定模式后使用，并将导致查询跳过任何锁定的行，如果没有可用的行，则返回空集。

```ts
await db.$transaction(async () => {
  await db.table.forUpdate().skipLocked();
});
```

## noWait

此方法可以在使用 `forUpdate` 或 `forShare` 指定锁定模式后使用，并将导致查询在任何选定的行当前被锁定时立即失败。

```ts
await db.$transaction(async () => {
  await db.table.forUpdate().noWait();
});
```

## log transaction queries

将 `{ log: true }` 传递给事务以打开其所有查询的日志记录，包括 `BEGIN` 和 `COMMIT`。

请注意，在事务上设置日志将覆盖特定查询的日志设置。

```ts
await db.$transaction({ log: true }, async () => {
  await db.table.insert(data);
  // 原始 SQL 查询也将被记录
  await db.$query`SELECT 1`;
});
```
