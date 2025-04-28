# 生命周期钩子

您可以为表指定在某种类型的查询执行之前或之后调用的函数。

当为特定表创建、更新或删除记录时，将调用钩子函数，同时在执行嵌套的
[更新](/zh-CN/guide/relation-queries#nested-update)、
[创建](/zh-CN/guide/relation-queries#nested-create)、
和[删除](/zh-CN/guide/relation-queries#delete-related-records)时也会调用。

## before 钩子

`before*` 钩子不会接收来自数据库的数据，因为它们在查询之前运行。

函数可以返回一个 `Promise`，在查询执行之前，所有 `before` 钩子的 Promise 都会通过 `Promise.all` 等待完成。

传递给函数的参数是即将执行的查询对象。

如果查询同时具有 `beforeQuery` 和 `beforeCreate`，则 `beforeCreate` 将首先运行。

[orCreate](/zh-CN/guide/create-update-delete.html#orcreate) 会执行两个查询：第一个查询记录，第二个在未找到记录时创建记录。
如果在这两个查询之间记录被另一个进程创建，则会触发 `beforeCreate` 钩子，但不会创建新数据。

[upsert](/zh-CN/guide/create-update-delete.html#upsert) 对 `beforeCreate` 的行为与 `orCreate` 相同。
`beforeUpdate` 钩子总是由此 `upsert` 命令调用一次，即使更新的记录不存在。

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    // `before` 钩子不会接收数据，仅接收查询对象
    this.beforeQuery((q) => console.log('before any query'));
    this.beforeCreate((q) => console.log('before create'));
    this.beforeUpdate((q) => console.log('before update'));
    this.beforeSave((q) => console.log('before create or update'));
    this.beforeDelete((q) => console.log('before delete'));

    // `orm` 参数用于在查询回调中进行查询
    this.beforeUpdate(async () => {
      const data = await orm.someTable.where(...).select(...);
      // ...使用数据执行逻辑
    });
  }
}
```

## after 钩子

`after*` 钩子需要列出函数所需的列，
以便在创建、更新或删除记录后从数据库中选择数据并传递给函数。

第一个参数是从数据库返回的记录数组，
可以保证数据包含所有指定的列。

第二个参数是已执行的查询对象。

如果没有记录被更新或删除，则 `afterUpdate` 和 `afterDelete` 钩子**不会**运行。

**重要说明**：`after*` 钩子与查询运行在同一事务中。
如果查询未在事务中运行，则会自动打开一个新事务，查询本身和所有 `after*` 钩子将在其中执行。
如果 `after*` 钩子抛出错误，事务将回滚，查询将不会产生任何效果。

这使得 `after*` 钩子成为基于更改更新数据库内容的正确选择，以确保所有更改都已应用，或者所有更改都一起回滚，
并且不可能仅部分应用更改。

例如，假设我们正在构建一个消息应用，每个聊天都有一个 `lastMessageText` 列，用于显示最后一条消息的文本。
我们可以将 `afterCreate` 钩子附加到消息上，要求其 `chatId` 和 `text`，并在钩子中更新聊天的 `lastMessageText`。
这样就不可能出现消息已创建但聊天的 `lastMessageText` 未更新的情况。

`after*` 钩子**不**适合用于发送电子邮件或执行无法通过事务回滚恢复的副作用。
对于此类副作用，请使用[after-commit 钩子](#after-commit-hooks)。

`afterQuery` 钩子在*任何*查询之后运行，即使我们仅选择 `count`，因此它无法选择特定列并且没有可预测的数据。

如果查询同时具有 `afterQuery` 和 `afterCreate`，则 `afterCreate` 将最后运行。

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    // 数据类型为 `unknown` - 它可以是任何内容
    this.afterQuery((data, q) => console.log('after any query'));

    // 为 after-create 钩子选择 `id` 和 `name`
    this.afterCreate(['id', 'name'], (data, q) => {
      // 数据是记录数组
      for (const record of data) {
        // `id` 和 `name` 保证已加载
        console.log(`Record with id ${record.id} has name ${record.name}.`);
      }
    });

    this.afterUpdate(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were updated`),
    );

    // 在创建和更新后运行
    this.afterSave(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were created or updated`),
    );

    this.afterDelete(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were deleted`),
    );
  }
}
```

注意 `orm: typeof db` 参数：它是具有所有表的数据库实例，您可以使用它执行查询。

例如，每次创建评论时，我们希望增加评论所属帖子的 `commentCount` 列：

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
        // 所有帖子更新查询将与原始查询在单个事务中执行
        await db.post.find(postId).increment({
          commentsCount: data.filter((comment) => comment.postId === postId)
            .length,
        });
      }
    });
  }
}
```

## after-commit 钩子

after-commit 钩子类似于[after 钩子](#after-hooks)：它们也可以通过指定的列访问记录数据。

如果查询被包装到事务中，这些钩子将在提交后运行。对于没有事务的单个查询，这些钩子将在查询后运行。

常规[after 钩子](#after-hooks)将在事务提交之前运行，并且事务中的某些后续查询可能会失败，事务将回滚。
after-commit 钩子保证事务或单个查询在运行钩子之前已成功完成。

如果没有记录被更新或删除，则 `afterUpdateCommit` 和 `afterDeleteCommit` 钩子**不会**运行。

如果至少有一个 after-commit 钩子失败，则整个事务（即使已提交）会抛出一个特殊的[AfterCommitError](#AfterCommitError)错误。
请考虑使用[catchAfterCommitError](#catchAfterCommitError)来捕获此类错误。

**after-commit** 钩子是执行事务外副作用的更好选择，但请注意，如果副作用（例如发送电子邮件）失败，事务不会回滚。
第三方服务可能会失败，导致副作用未应用，即使事务数据已持久化。
最好将此类操作发送到持久消息队列，在那里可以重试和监控操作。

即使有消息队列，也仍然有可能消息队列本身无法接受消息，导致所需操作丢失。
为了确保副作用最终发生，您需要应用一些分布式事务技术，例如 Outbox Pattern。

例如，在用户注册时发送电子邮件，您可以从 `afterCreate` 钩子保存“发送注册电子邮件”操作到一个特殊表，
然后在 `afterCreateCommit` 中将其发送到消息队列，然后从特殊表中删除它。
如果消息队列失败，操作仍然保存在数据库表中，该表可以在定时任务中定期扫描并发送到队列。

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    // 为 after-create 钩子选择 `id` 和 `name`
    this.afterCreateCommit(['id', 'name'], (data, q) => {
      // 数据是记录数组
      for (const record of data) {
        // `id` 和 `name` 保证已加载
        console.log(`Record with id ${record.id} has name ${record.name}.`);
      }
    });

    this.afterUpdateCommit(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were updated`),
    );

    // 在创建和更新后运行
    this.afterSaveCommit(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were created or updated`),
    );

    this.afterDeleteCommit(['id', 'name'], (data, q) =>
      console.log(`${data.length} records were deleted`),
    );
  }
}
```

## 在查询上设置钩子

生命周期钩子也可以添加到查询链中，它们将仅针对此特定查询运行：

```ts
await db.table
  .beforeQuery((q) => console.log('before any query'))
  // 数据类型为 `unknown`
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

在查询中添加 `catchAfterCommitError` 以捕获可能来自 after-commit 钩子的错误。

使用时，事务将返回其结果，而不考虑钩子失败。

如果没有使用 `catchAfterCommitError`，事务函数将抛出错误并且不会返回结果。
结果仍然可以从错误对象 [AfterCommitError](#AfterCommitError) 中访问。

```ts
const result = await db
  .$transaction(async () => {
    return db.table.create(data);
  })
  .catchAfterCommitError((err) => {
    // err 是 AfterCommitError 的实例（见下文）
  });

// 即使 after-commit 钩子失败，结果仍然可用
result.id;
```

## AfterCommitError

[//]: # 'has JSDoc'

当一个 after-commit 钩子抛出错误时，会抛出 `AfterCommitError`。

```ts
interface AfterCommitError extends OrchidOrmError {
  // 事务函数的结果
  result: unknown;

  // Promise.allSettled 结果 + 可选的函数名称
  hookResults: (
    | {
        status: 'fulfilled';
        value: unknown;
        name?: string;
      }
    | {
        status: 'rejected';
        reason: any; // 钩子抛出的错误对象
        name?: string;
      }
  )[];
}
```

使用 `function name() {}` 函数语法为钩子命名，
以便稍后在处理 after-commit 错误时可以识别它们。

```ts
class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...someColumns,
  }));

  init(orm: typeof db) {
    // 匿名函数 - 没有名称
    this.afterCreateCommit([], async () => {
      // ...
    });

    // 命名函数
    this.afterCreateCommit([], function myHook() {
      // ...
    });
  }
}
```
