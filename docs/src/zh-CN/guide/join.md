# 连接（Join）

## 选择关系

[//]: # 'has JSDoc'

在连接表之前，请考虑选择关系是否足够满足您的需求：

```ts
// 选择带有个人资料的用户
// 结果类型为 Array<{ name: string, profile: Profile }>
await db.user.select('name', {
  profile: (q) => q.profile,
});

// 选择带有评论计数的帖子，按评论计数过滤和排序
// 结果类型为 Array<Post & { commentsCount: number }>
await db.post
  .select('*', {
    commentsCount: (q) => q.comments.count(),
  })
  .where({ commentsCount: { gt: 10 } })
  .order({ commentsCount: 'DESC' });

// 选择带有其书籍标题数组的作者
// 结果类型为 Array<Author & { books: string[] }>
await db.author.select('*', {
  books: (q) => q.books.pluck('title'),
});
```

在内部，这种选择将使用 `LEFT JOIN LATERAL` 来连接关系。
如果您正在加载带有个人资料的用户（一对一关系），并且某些用户没有个人资料，则这些用户的 `profile` 属性将为 `NULL`。
如果您只想加载有个人资料的用户，并过滤掉其余用户，请在关系中添加 `.join()` 方法而不带参数：

```ts
// 仅加载有个人资料的用户
await db.user.select('*', {
  profile: (q) => q.profile.join(),
});

// 仅加载具有特定个人资料的用户
await db.user.select('*', {
  profile: (q) => q.profile.join().where({ age: { gt: 20 } }),
});
```

您还可以在一对多关系上使用 `.join()` 方法，空数组的记录将被过滤掉：

```ts
// 没有标签的帖子将不会被加载
// 结果类型为 Array<Post & { tags: Tag[] }>
db.post.select('*', {
  tags: (q) => q.tags.join(),
});
```

## 连接方法

[//]: # 'has JSDoc'

`join` 方法允许连接其他表、按名称的关系、[with](/zh-CN/guide/advanced-queries#with) 语句、子查询。

所有的 `join` 方法接受相同的参数，但返回类型不同，因为使用 `join` 时保证加载连接的表，而使用 `leftJoin` 时，如果未找到匹配记录，连接表的列可能为 `NULL`。

以下示例中，假设您有一个包含 `id` 和 `name` 的 `User` 表，以及一个包含 `id`、`text` 的 `Message` 表，消息通过 `userId` 列属于用户：

```ts
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
  }));

  relations = {
    messages: this.hasMany(() => MessageTable, {
      columns: ['id'],
      references: ['userId'],
    }),
  };
}

export class MessageTable extends BaseTable {
  readonly table = 'message';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer(),
    text: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      columns: ['userId'],
      references: ['id'],
    }),
  };
}
```

### join

[//]: # 'has JSDoc'

`join` 是 SQL `JOIN` 的方法，相当于 `INNER JOIN` 或 `LEFT INNER JOIN`。

当未找到匹配记录时，它将跳过主表的记录。

当多次连接同一表且条件相同时，重复的连接将被忽略：

```ts
// 连接关系
db.post.join('comments').join('comments');

// 通过条件连接表
db.post
  .join('comments', 'comments.postId', 'post.id')
  .join('comments', 'comments.postId', 'post.id');
```

两个查询将生成仅包含一个连接的 SQL：

```sql
SELECT * FROM post JOIN comments ON comments.postId = post.id
```

然而，这仅在连接没有动态值时才可能：

```ts
db.post
  .join('comments', (q) => q.where({ rating: { gt: 5 } }))
  .join('comments', (q) => q.where({ rating: { gt: 5 } }));
```

以上两个连接具有相同的 `{ gt: 5 }`，但 `5` 是动态值，在这种情况下连接将被重复，
导致数据库错误。

### 连接关系

[//]: # 'has JSDoc'

当表之间定义了关系时，可以通过关系名称连接它们。
连接的表可以通过关系名称从 `where` 和 `select` 中引用。

```ts
const result = await db.user
  .join('messages')
  // 连接表后，可以在 `where` 条件中使用它：
  .where({ 'messages.text': { startsWith: 'Hi' } })
  .select(
    'name', // name 是 User 列，表名可以省略
    'messages.text', // text 是 Message 列，表名是必需的
  );

// 结果具有以下类型：
const ok: { name: string; text: string }[] = result;
```

第一个参数也可以是回调，在回调中可以通过 `q` 的属性选择关系名称。
通过这种方式，可以使用 `as` 为关系设置别名，添加 `where` 条件，使用其他查询方法。

```ts
const result = await db.user.join((q) =>
  q.messages.as('m').where({ text: 'some text' }),
);
```

可选地，可以传递第二个回调参数，使 `on` 和 `orOn` 方法可用。

但请记住，当连接关系时，相关的 `ON` 条件已经自动处理。

```ts
const result = await db.user.join(
  (q) => q.messages.as('m'),
  (q) =>
    q
      .on('messages.text', 'user.name') // 另外，匹配消息与用户名
      .where({ text: 'some text' }), // 也可以在第二个回调中添加 `where`。
);
```

### 选择完整的连接记录

[//]: # 'has JSDoc'

通过传递以 `.*` 结尾的表名，`select` 支持选择先前连接表的完整记录：

```ts
const result = await db.book.join('author').select('title', {
  author: 'author.*',
});

// 结果具有以下类型：
const ok: {
  // 书的标题
  title: string;
  // 包含完整的作者记录：
  author: { id: number; name: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

对于 `1:1`（`belongsTo`、`hasOne`）关系，它工作正常，但对于 `1:M` 或 `M:M`（`hasMany`、`hasAndBelongsToMany`）关系可能会有意外结果。
对于任何类型的关系，它会导致一个主表记录与一个连接表记录的数据，即以这种方式选择时，记录**不会**被收集到数组中。

```ts
const result = await db.user
  .join('messages')
  .where({ 'messages.text': { startsWith: 'Hi' } })
  .select('name', { messages: 'messages.*' });

// 结果具有以下类型：
const ok: {
  name: string;
  // 包含完整的消息：
  messages: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

因为它是一对多关系，一个用户有多条消息，用户数据将为不同的消息数据重复：

| name   | msg                            |
| ------ | ------------------------------ |
| user 1 | `{ id: 1, text: 'message 1' }` |
| user 1 | `{ id: 2, text: 'message 2' }` |
| user 1 | `{ id: 3, text: 'message 3' }` |

### 连接表

[//]: # 'has JSDoc'

如果未定义关系，请提供 `db.table` 实例并指定连接的列。
连接的表可以通过表名从 `where` 和 `select` 中引用。

```ts
db.user
  .join(db.message, 'userId', 'user.id')
  .where({ 'message.text': { startsWith: 'Hi' } })
  .select('name', 'message.text');
```

连接表的名称可以省略，但主表的名称不能省略：

```ts
db.user.join(db.message, 'userId', 'user.id');
```

连接的表可以有别名以供进一步引用：

```ts
db.user
  .join(db.message.as('m'), 'message.userId', 'user.id')
  .where({ 'm.text': { startsWith: 'Hi' } })
  .select('name', 'm.text');
```

连接的表可以像上面的关系连接一样作为对象选择：

```ts
const result = await db.user
  .join(db.message.as('m'), 'message.userId', 'user.id')
  .where({ 'm.text': { startsWith: 'Hi' } })
  .select('name', { msg: 'm.*' });

// 结果具有以下类型：
const ok: {
  name: string;
  // 完整的消息作为 msg 包含：
  msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

可以提供自定义比较运算符：

```ts
db.user.join(db.message, 'userId', '!=', 'user.id');
```

连接可以接受连接部分的原始 SQL：

```ts
db.user.join(
  db.message,
  // `sql` 可以从您的 `BaseTable` 文件中导入
  sql`lower("message"."text") = lower("user"."name")`,
);
```

连接可以接受原始 SQL 而不是列：

```ts
db.user.join(
  db.message,
  sql`lower("message"."text")`,
  sql`lower("user"."name")`,
);

// 使用运算符：
db.user.join(
  db.message,
  sql`lower("message"."text")`,
  '!=',
  sql`lower("user"."name")`,
);
```

要基于多个列进行连接，可以提供一个对象，其中键是连接表的列，值是主表的列或原始 SQL：

```ts
db.user.join(db.message, {
  'message.userId': 'user.id',

  // 连接表名可以省略
  userId: 'user.id',

  // 值可以是原始 SQL 表达式：
  text: sql`lower("user"."name")`,
});
```

通过提供 `true` 可以连接所有记录而无需条件：

```ts
db.user.join(db.message, true);
```

连接方法可以接受一个带有特殊查询构建器的回调，该查询构建器具有 `on` 和 `orOn` 方法以处理高级情况：

```ts
db.user.join(
  db.message,
  (q) =>
    q
      .on('message.userId', 'user.id')
      // 连接表名可以省略
      .on('userId', 'user.id')
      // 可以指定运算符：
      .on('userId', '!=', 'user.id')
      // 可以指定运算符和表名：
      .on('message.userId', '!=', 'user.id')
      // `.orOn` 接受与 `.on` 相同的参数并像 `.or` 一样工作：
      .on('userId', 'user.id') // where message.userId = user.id
      .orOn('text', 'user.name'), // 或 message.text = user.name
);
```

在 `where` 条件中应用的列名是连接表的，但可以指定表名以为主表添加条件。

```ts
db.user.join(db.message, (q) =>
  q
    .on('userId', 'user.id')
    .where({
      // 未加前缀的列名是连接表的：
      text: { startsWith: 'hello' },
      // 指定表名以设置主表的条件：
      'user.name': 'Bob',
    })
    // id 是连接表 Message 的列
    .whereIn('id', [1, 2, 3])
    // 用户的 id 条件
    .whereIn('user.id', [4, 5, 6]),
);
```

上述查询将生成以下 SQL（简化版）：

```sql
SELECT * FROM "user"
JOIN "message"
  ON "message"."userId" = "user"."id"
 AND "message"."text" ILIKE 'hello%'
 AND "user"."name" = 'Bob'
 AND "message"."id" IN (1, 2, 3)
 AND "user"."id" IN (4, 5, 6)
```

连接参数可以是带有 `select`、`where` 和其他方法的查询。在这种情况下，它将被视为子查询：

```ts
db.user.join(
  db.message
    .select('id', 'userId', 'text')
    .where({ text: { startsWith: 'Hi' } })
    .as('t'),
  'userId',
  'user.id',
);
```

它将生成以下 SQL：

```sql
SELECT * FROM "user"
JOIN (
  SELECT "t"."id", "t"."userId", "t"."text"
  FROM "message" AS "t"
) "t" ON "t"."userId" = "user"."id"
```

## 隐式连接 LATERAL

`JOIN` 的源表达式位于 `ON` 之前，不能访问其他表，但在某些情况下可能需要这样做。

例如，让我们考虑连接用户的最后 10 条消息：

```ts
await db.user.join('messages', (q) => q.order({ createdAt: 'DESC' }).limit(10));
```

当 `join` 的回调返回的查询比简单地应用某些条件更复杂时，
它将隐式生成 `JOIN LATERAL` SQL 查询，如下所示：

```sql
SELECT "user".*
FROM "user"
JOIN LATERAL (
  SELECT *
  FROM "message" AS "messages"
  WHERE "message"."userId" = "user"."id"
  ORDER BY "message"."createdAt" DESC
  LIMIT 10
) "messages" ON true
```

## joinLateral

[//]: # 'has JSDoc'

`joinLateral` 允许连接一个表和一个子查询，该子查询可以引用当前查询的主表和其他连接的表。

第一个参数是您要连接的其他表的名称，或者关系的名称，或者 `with` 定义的表的名称。

第二个参数是一个回调，您可以在其中引用其他表，使用 `on` 和 `orOn`，选择列，进行 `where` 条件，并使用任何其他查询方法来构建子查询。

请注意，当回调返回的查询足够复杂时，常规的 `join` 也会生成 `JOIN LATERAL` SQL 表达式（请参阅[隐式连接 LATERAL](/zh-CN/guide/join#implicit-join-lateral)）。

```ts
// joinLateral 一个 Message 表，将其别名为 `m`
// 如果不设置别名，可以通过表名引用消息
User.joinLateral(Message.as('m'), (q) =>
  q
    // 选择消息列
    .select('text')
    // 将消息连接到用户，列名可以加表名前缀
    .on('authorId', 'user.id')
    // 消息列可以不加前缀，
    // 外部表列可以加表名
    .where({ text: 'some text', 'user.name': 'name' })
    .order({ createdAt: 'DESC' }),
)
  // 只有选定的消息列可用于选择和条件
  .select('id', 'name', 'm.text')
  .where({ 'm.text': messageData.text });
```

与简单的 `join` 一样，`joinLateral` 可以选择完整的连接记录对象：

```ts
// 通过关系名称连接
const result = await User.joinLateral(
  'messages',
  (q) => q.as('message'), // 别名为 'message'
).select('name', { message: 'message.*' });

// 结果具有以下类型：
const ok: {
  name: string;
  // 包含完整的消息：
  message: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

`message` 也可以在 `select` 中设置别名，就像简单的 `join` 一样：

```ts
// 通过关系名称连接
const result = await User.joinLateral(
  'messages',
  (q) => q.as('message'), // 别名为 'message'
).select('name', { msg: 'message.*' });

// 结果具有以下类型：
const ok: {
  name: string;
  // 完整的消息作为 msg 包含：
  msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

## leftJoin

[//]: # 'has JSDoc'

`leftJoin` 是 SQL `LEFT JOIN` 的方法，相当于 `OUTER JOIN` 或 `LEFT OUTER JOIN`。

当未找到匹配记录时，它将在结果行中用 `NULL` 值填充连接表的列。

与 `join` 的工作方式相同，除了结果类型可能为 `null`：

```ts
const result = await db.user
  .leftJoin('messages')
  .select('name', 'messages.text');

// 相同的查询，但显式连接表
const result2: typeof result = await db.user
  .leftJoin(db.message, 'userId', 'user.id')
  .select('name', 'message.text');

// 结果具有以下类型：
const ok: { name: string; text: string | null }[] = result;
```

## leftJoinLateral

[//]: # 'has JSDoc'

与 `joinLateral` 相同，但当未找到记录时，它将结果设为 `null`：

```ts
const result = await db.user
  .leftJoinLateral('messages', (q) => q.as('message'))
  .select('name', 'message.text');

// 结果具有以下类型：
const ok: { name: string; text: string | null }[] = result;
```

## rightJoin

[//]: # 'has JSDoc'

`rightJoin` 是 SQL `RIGHT JOIN` 的方法，相当于 `RIGHT OUTER JOIN`。

接受与 `join` 相同的参数。

它将加载连接表的所有记录，并在未找到匹配时用 `null` 填充主表的列。

使用 `rightJoin` 时，您连接到的表的列将变为可空。

```ts
const result = await db.user
  .rightJoin('messages')
  .select('name', 'messages.text');

// 即使 name 不是可空列，在使用 rightJoin 后它变为可空
const ok: { name: string | null; text: string }[] = result;
```

## fullJoin

[//]: # 'has JSDoc'

`fullJoin` 是 SQL `FULL JOIN` 的方法，相当于 `FULL OUTER JOIN`。

接受与 `join` 相同的参数。

它将加载连接表的所有记录，当没有匹配时，连接的两侧可能会出现 `null` 值。

使用 `fullJoin` 后，所有列都变为可空。

```ts
const result = await db.user
  .rightJoin('messages')
  .select('name', 'messages.text');

// 所有列都可以为 null
const ok: { name: string | null; text: string | null }[] = result;
```

## onJsonPathEquals

[//]: # 'has JSDoc'

使用 `onJsonPathEquals` 根据 JSON 列的字段连接记录：

```ts
db.table.join(db.otherTable, (q) =>
  // '$.key' 是 JSON 路径
  q.onJsonPathEquals('otherTable.data', '$.key', 'table.data', '$.key'),
);
```

## joinData

此方法可能对与 [createManyFrom](/zh-CN/guide/create-update-delete.html#createmanyfrom-insertmanyfrom) 结合使用很有用。

`createManyFrom` 基于选择查询创建多个记录：

```sql
INSERT INTO t1(c1, c2)
SELECT c1, c2 FROM t2
```

这样的查询每个选定记录插入一个记录。

使用 `joinData` 插入选定记录和提供数据的乘积。

```ts
const data = [{ column2: 'one' }, { column2: 'two' }, { column2: 'three' }];

await db.table.createManyFrom(
  db.otherTable
    .joinData('data', (t) => ({ column2: t.text() }), data)
    .select('otherTable.column1', 'data.column2'),
);
```

如果其他表上的查询返回 2 条记录，
并且数据数组包含 3 条记录，则 2 \* 3 = 6 将被插入 - 每个组合。

连接的数据值在 `where` 中可用，就像平常一样。
