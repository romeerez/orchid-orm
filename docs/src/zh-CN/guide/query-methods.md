---
outline: deep
---

# 查询方法

每个查询方法**不会**修改查询链，因此有条件地调用它不会产生效果：

```ts
let query = db.table.select('id', 'name');

// 错误：不会产生效果
if (params.name) {
  query.where({ name: params.name });
}

// 正确：重新赋值 `query` 变量
if (params.name) {
  query = query.where({ name: params.name });
}

const results = await query;
```

每个查询方法都有一个以 `_` 开头的可变版本：

```ts
const query = db.table.select('id', 'name');

// 调用可变方法 `_where`：
if (params.name) {
  query._where({ name: params.name });
}

const results = await query;
```

可变方法以 `_` 开头，主要用于内部使用，但不推荐使用，因为容易出错，代码也不够直观。

## NotFoundError 处理

[//]: # 'has JSDoc'

当我们搜索单条记录且未找到时，可以选择抛出错误或返回 `undefined`。

与其他数据库库不同，`Orchid ORM` 默认在使用 `take`、`find`、`findBy`、`get` 方法且未找到记录时抛出错误。
在集中位置捕获常见错误是[良好的实践](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/centralizedhandling.md)（参见[全局错误处理](/zh-CN/guide/error-handling#global-error-handling)），这使代码更简洁。

如果更适合返回 `undefined` 而不是抛出错误，请使用 `takeOptional`、`findOptional`、`findByOptional`、`getOptional`。

## take

[//]: # 'has JSDoc'

使用 `take` 来“获取”单条记录。它添加 `LIMIT 1`，未找到时抛出 `NotFoundError`。

```ts
const taken: TableType = await db.table.where({ key: 'value' }).take();
```

如果查询之前有 [get](#get-and-getoptional)、[pluck](#pluck)、[exec](#exec)，则无效。

将 [getOptional](#get-and-getoptional) 更改为 [get](#get-and-getoptional)。

## takeOptional

[//]: # 'has JSDoc'

使用 `takeOptional` 来“获取”单条记录。它添加 `LIMIT 1`，未找到时返回 `undefined`。

```ts
const takenOptional: TableType | undefined = await db.table
  .where({ key: 'value' })
  .takeOptional();
```

如果查询之前有 [getOptional](#get-and-getoptional)、[pluck](#pluck)、[exec](#exec)，则无效。

将 [get](#get-and-getoptional) 更改为 [getOptional](#get-and-getoptional)。

## find

[//]: # 'has JSDoc'

通过主键（id）查找单条记录，未找到时抛出 [NotFoundError](/zh-CN/guide/error-handling)。
如果表没有主键或有多个主键，则不可用。

```ts
const result: TableType = await db.table.find(1);
```

### findOptional

[//]: # 'has JSDoc'

通过主键（id）查找单条记录，未找到时返回 `undefined`。
如果表没有主键或有多个主键，则不可用。

```ts
const result: TableType | undefined = await db.table.find(123);
```

### findBy

[//]: # 'has JSDoc'

查找单条唯一记录，未找到时抛出 [NotFoundError](/zh-CN/guide/error-handling)。
它接受表上定义的主键或唯一索引的值。
`findBy` 的参数类型是所有可能的唯一条件集合的联合。

对于非唯一条件，可以使用 `where(...).take()`。

```ts
await db.table.findBy({ key: 'value' });
```

### findByOptional

[//]: # 'has JSDoc'

查找单条唯一记录，未找到时返回 `undefined`。
它接受表上定义的主键或唯一索引的值。
`findBy` 的参数类型是所有可能的唯一条件集合的联合。

对于非唯一条件，可以使用 `where(...).takeOptional()`。

```ts
await db.table.findByOptional({ key: 'value' });
```

### findBySql

[//]: # 'has JSDoc'

使用给定的 SQL 查找单条记录，未找到时抛出 [NotFoundError](/zh-CN/guide/error-handling)：

```ts
await db.user.findBySql`
  age = ${age} AND
  name = ${name}
`;
```

### findBySqlOptional

[//]: # 'has JSDoc'

使用给定的 SQL 查找单条记录。
未找到时返回 `undefined`。

```ts
await db.user.findBySqlOptional`
  age = ${age} AND
  name = ${name}
`;
```

## get 和 getOptional

[//]: # 'has JSDoc'

`get` 返回单个值，向查询添加 `LIMIT 1`，并接受列名或原始 SQL 表达式。

`get` 未找到时抛出 `NotFoundError`，`getOptional` 未找到时返回 `undefined`。

```ts
import { NumberColumn } from 'orchid-orm';
import { sql } from './baseTable';

const firstName: string = await db.table.get('name');

const rawResult: number = await db.table.get(sql((t) => t.integer())`1 + 1`);

const firstNameOptional: string | undefined = await db.table.getOptional(
  'name',
);
```

## rows

[//]: # 'has JSDoc'

`.rows` 返回一个没有字段名称的数组数组：

```ts
const rows: Array<Array<number | string>> = await db.table
  .select('id', 'name')
  .rows();

rows.forEach((row) => {
  // row 是列值的数组
  row.forEach((value) => {
    // value 是 id 或 name
  });
});
```

## pluck

[//]: # 'has JSDoc'

`.pluck` 返回单个选定列值的数组：

```ts
const ids = await db.table.pluck('id');
// ids 是所有用户 id 的数组，例如 [1, 2, 3]
```

## exec

[//]: # 'has JSDoc'

`.exec` 不会解析响应，返回 undefined：

```ts
const nothing = await db.table.take().exec();
```

## all

[//]: # 'has JSdoc'

`.all` 是默认行为，返回对象数组：

```ts
const records = db.table
  .take() // .take() 将被 .all() 覆盖
  .all();
```

## none

[//]: # 'has JSDoc'

`none` 将查询解析为空结果，而不执行数据库查询。

```ts
await db.table.none(); // -> 空数组
await db.table.findOptional(123).none(); // -> undefined
await db.table.find(123).none(); // 抛出 NotFoundError
```

[insert](/zh-CN/guide/create-update-delete#create-insert)、[update](/zh-CN/guide/create-update-delete#update) 和 [delete](/zh-CN/guide/create-update-delete#delete) 返回受影响记录的计数。

当它们与 `none` 一起调用时，查询不会执行并返回 0。

```ts
await db.table.insert(data).none(); // -> 0
await db.table.all().update(data).none(); // -> 0
await db.table.all().delete().none(); // -> 0
```

当它在子查询中使用时，它将返回空数组、`undefined` 或计数的 `0`，
或者如果子查询需要结果，它将抛出：

```ts
await db.user.select({
  // 返回空数组
  pets: (q) => q.pets.none(),
  // 返回 `undefined`
  firstPet: (q) => q.pets.none().takeOptional(),
  // 抛出 NotFound 错误
  requriedFirstPet: (q) => q.pets.none().take(),
  // 返回 `undefined`
  firstPetName: (q) => q.pets.none().getOptional('name'),
  // 抛出 NotFound 错误
  requiredFirstPetName: (q) => q.pets.none().get('name'),
  // 返回空数组
  petsNames: (q) => q.pets.none().pluck('name'),
  // 返回 0
  petsCount: (q) => q.pets.none().count(),
});
```

当 `none` 查询用于需要匹配的连接时，主查询将返回空结果：

```ts
// 以下所有查询将解析为空数组

await db.user.select({
  pets: (q) => q.pets.join().none(),
});

await db.user.join((q) => q.pets.none());

await db.user.join('pets', (q) => q.none());
```

当它用于 `leftJoin` 或 `fullJoin` 时，它会隐式地将 `ON false` 添加到连接的 SQL 中。

```ts
// 此查询可以返回用户记录
await db.user.leftJoin('pets', (q) => q.none());

// 此查询不会返回用户记录，因为添加了 where 条件
await db.user.leftJoin('pets', (q) => q.none()).where({ 'pets.name': 'Kitty' });
```

## select

[//]: # 'has JSDoc'

接受要选择的列列表，默认情况下，查询构建器将选择表的所有列。

最后一个参数可以是一个对象。对象的键是列别名，值可以是列名、子查询或原始 SQL 表达式。

```ts
import { sql } from './baseTable';

// 选择表的列：
db.table.select('id', 'name', { idAlias: 'id' });

// 接受带表名的列：
db.table.select('user.id', 'user.name', { nameAlias: 'user.name' });

// 表名可以指当前表或连接表：
db.table
  .join(Message, 'authorId', 'user.id')
  .select('user.name', 'message.text', { textAlias: 'message.text' });

// 从子查询中选择值，
// 此子查询应返回单条记录和单列：
db.table.select({
  subQueryResult: Otherdb.table.select('column').take(),
});

// 选择原始 SQL 值，通过 <generic> 语法指定返回类型：
db.table.select({
  raw: sql<number>`1 + 2`,
});

// 选择原始 SQL 值，返回类型可以通过提供列类型来设置：
db.table.select({
  raw: sql`1 + 2`.type((t) => t.integer()),
});

// 与上面相同的原始 SQL 查询，但 sql 是从回调返回的
db.table.select({
  raw: () => sql`1 + 2`.type((t) => t.integer()),
});
```

当您使用 ORM 并定义关系时，`select` 还可以接受带相关表查询的回调：

```ts
await db.author.select({
  allBooks: (q) => q.books,
  firstBook: (q) => q.books.order({ createdAt: 'ASC' }).take(),
  booksCount: (q) => q.books.count(),
});
```

当您选择通过 `belongsTo` 或 `hasOne` 连接的关系时，它可以在 `order` 或 `where` 中使用：

```ts
// 选择按作者名称排序并按作者列过滤的书籍及其作者：
await db.books
  .select({
    author: (q) => q.author,
  })
  .order('author.name')
  .where({ 'author.isPopular': true });
```

### 条件选择

`if` 允许根据条件选择其他列：

```ts
type Result = { id: number; title?: string; description?: string };

const result: Result = await db.table
  .select('id')
  .if(condition, (q) => q.select('title', 'description'));
```

### selectAll

[//]: # 'has JSDoc'

查询表或创建记录时，默认选择所有列，
但更新和删除查询默认返回受影响的行数。

使用 `selectAll` 选择所有列。如果之前应用了 `.select` 方法，它将被丢弃。

```ts
const selectFull = await db.table
  .select('id', 'name') // 被 `selectAll` 丢弃
  .selectAll();

const updatedFull = await db.table.selectAll().where(conditions).update(data);

const deletedFull = await db.table.selectAll().where(conditions).delete();
```

### distinct

[//]: # 'has JSDoc'

向 `SELECT` 添加 `DISTINCT` 关键字：

```ts
db.table.distinct().select('name');
```

可以接受列名或原始 SQL 表达式，将其放置到 `DISTINCT ON (...)`：

```ts
import { sql } from './baseTable';

// 在名称和原始 SQL 上去重
db.table.distinct('name', sql`raw sql`).select('id', 'name');
```

## as

[//]: # 'has JSDoc'

设置表别名：

```ts
db.table.as('u').select('u.name');

// 可用于连接：
db.table.join(Profile.as('p'), 'p.userId', 'user.id');
```

## from

[//]: # 'has JSDoc'

设置 `FROM` 值，默认使用表名。

`from` 确定查询中的可用表和列集，
因此它不能跟在 `select` 之后，只有在 `from` 之后使用 `select`。

```ts
// 接受子查询：
db.table.from(db.otherTable.select('foo', 'bar'));

// 接受 `WITH` 表达式的别名：
q.with('withTable', db.table.select('id', 'name'))
  .from('withTable')
  // `select` 在 `from` 之后
  .select('id', 'name');
```

`from` 可以接受多个来源：

```ts
db.table
  // 添加一个名为 `withTable` 的 `WITH` 语句
  .with('withTable', db.table.select('one'))
  // 从 `withTable` 和 `otherTable` 中选择
  .from('withTable', db.otherTable.select('two'))
  // 源名称和列名称在选择时正确键入
  .select('withTable.one', 'otherTable.two');
```

### fromSql

[//]: # 'has JSDoc'

使用自定义 SQL 设置 `FROM` 值：

```ts
const value = 123;
db.table.fromSql`value = ${value}`;
```

### only

[//]: # 'has JSDoc'

向 `FROM` 添加 `ONLY` SQL 关键字。
当从具有表继承的父表中选择时，
设置 `only` 将使其仅从父表中选择行。

```ts
db.table.only();

// 在启用后禁用 `only`
db.table.only().only(false);
```

## offset

[//]: # 'has JSDoc'

向查询添加偏移子句。

```ts
db.table.offset(10);
```

## limit

[//]: # 'has JSDoc'

向查询添加限制子句。

```ts
db.table.limit(10);
```

## truncate

[//]: # 'has JSDoc'

截断指定的表。

```ts
// 简单截断
await db.table.truncate();

// 重启自增列：
await db.table.truncate({ restartIdentity: true });

// 也截断依赖表：
await db.table.truncate({ cascade: true });
```

## clone

[//]: # 'has JSDoc'

克隆当前查询链，便于在其他查询中重用部分查询片段而不修改原始查询。

在底层使用，在应用端不太需要。

## group

[//]: # 'has JSDoc'

对于 `GROUP BY` SQL 语句，它接受列名或原始 SQL 表达式。

`group` 在聚合值时很有用。

```ts
// 按类别分组选择类别和价格总和
const results = db.product
  .select('category')
  .selectSum('price', { as: 'sumPrice' })
  .group('category');
```

此外，还可以按选定值分组：

```ts
import { sql } from './baseTable';

const results = db.product
  .select({
    month: sql`extract(month from "createdAt")`.type((t) =>
      // month 返回为字符串，将其解析为 int
      t.string().parse(parseInt),
    ),
  })
  .selectSum('price', { as: 'sumPrice' })
  // 按从 "createdAt" 中提取的月份分组
  .group('month');
```

`select` 中的列别名优先于表列，
因此如果在上面的查询中 `db.product` 有一个列 `month`，
查询将以完全相同的方式工作，分组将引用选定的 `month` 表达式。

## order

[//]: # 'has JSDoc'

向查询添加 order by 子句。

接受一个或多个参数，每个参数可以是列名或对象

```ts
db.table.order('id', 'name'); // 默认 ASC

db.table.order({
  id: 'ASC', // 或 DESC

  // 设置 nulls 顺序：
  name: 'ASC NULLS FIRST',
  age: 'DESC NULLS LAST',
});
```

`order` 可以引用从 `select` 子查询返回的值（与 `where` 不同，`where` 不能）。
因此，您可以选择相关记录的计数并按其排序。

例如，`comment` 有很多 `likes`。
我们选择 `comment` 的几列，通过子查询在选择中选择 `likesCount`，并按喜欢计数排序评论：

```ts
db.comment
  .select('title', 'content', {
    likesCount: (q) => q.likes.count(),
  })
  .order({
    likesCount: 'DESC',
  });
```

### orderSql

[//]: # 'has JSDoc'

按原始 SQL 表达式排序。

```ts
db.table.orderSql`raw sql`;
```

## having

[//]: # 'has JSDoc'

为查询构建 `HAVING` 子句，以通过 [聚合函数](#aggregate-functions) 的结果过滤记录。

`having` 的参数是一个函数，您可以在其中调用聚合函数并使用 [列运算符](/zh-CN/guide/where#column-operators) 将其与某些值进行比较。

```ts
db.table.having((q) => q.count().gte(10));
// HAVING count(*) >= 10
```

多个 having 条件将与 `AND` 组合：

```ts
db.table.having(
  (q) => q.sum('column').gt(5),
  (q) => q.avg('column').lt(10),
);
// HAVING sum(column) > 5 AND avg(column) < 10
```

在应用比较后，`or` 和 `and` 方法变得可用：

```ts
db.table.having((q) =>
  q.sum('column').equals(5).or(q.min('column').gt(1), q.max('column').lt(10)),
);
// HAVING (sum(column) = 5) OR (min(column) > 1 AND max(column) < 10)
```

聚合函数与 [聚合函数](#aggregate-functions) 中描述的完全相同，它们可以接受聚合选项：

```ts
db.table.having((q) =>
  q
    .count('id', {
      distinct: true,
      order: { createdAt: 'DESC', filter: { someColumn: { not: null } } },
    })
    .gte(10),
);
```

聚合函数和比较的参数可以是原始 SQL：

```ts
import { sql } from './baseTable';

db.table.having((q) => q.count(sql('coalesce(one, two)')).gte(sql`2 + 2`));
```

### havingSql

[//]: # 'has JSDoc'

为 `HAVING` SQL 语句提供 SQL 表达式：

```ts
db.table.havingSql`count(*) >= ${10}`;
```

## map

[//]: # 'has JSDoc'

使用 `map` 转换查询结果的单个记录。如果查询返回多个，`map` 函数将逐个转换记录。

对于可选查询结果（`findOptional`、`getOptional` 等），空结果**不会**调用 `map`。

对于 `sum`、`avg` 等聚合：
当 `sum` 和 `avg` 返回 `null`（无记录）时，`map` **不会**被调用。

要转换查询或子查询的完整结果，
以及处理 `null` 值，请考虑使用 [transform](#transform)。

[钩子](/zh-CN/guide/hooks) 将在查询之后运行，它们将在转换**之前**接收查询结果。

```ts
// 为每个帖子添加一个 `titleLength`
const posts = await db.post.limit(10).map((post) => ({
  ...post,
  titleLength: post.title.length,
}));

posts[0].titleLength; // number

// 使用完全相同的 `map` 函数转换单个帖子
const singlePost = await db.post.find(id).map((post) => ({
  ...post,
  titleLength: post.title.length,
}));

singlePost.titleLength; // number

// 可用于子查询
const postsWithComments = await db.post.select('title', {
  comments: (q) =>
    q.comments.map((comment) => ({
      ...comment,
      truncatedContent: comment.content.slice(0, 100),
    })),
});

postsWithComments[0].comments[0].truncatedContent; // string
```

## transform

[//]: # 'has JSDoc'

在加载查询结果后立即转换查询结果。

`transform` 方法应在最后调用，其他方法不能在调用后链接。

它旨在转换查询或子查询的完整结果，
要转换单个记录，请考虑使用 [map](#map)。

`transform` 处理 `null` 值，与 [map](#map) 不同。

[钩子](/zh-CN/guide/hooks) 将在查询之后运行，它们将在转换**之前**接收查询结果。

`avg`、`sum` 和类似聚合在没有行时结果为 `null`，您可以使用 `transform` 在这种情况下返回 0。

```ts
await db.order.sum('amount').transform((sum) => sum ?? 0);
```

考虑以下基于游标的分页示例：

```ts
const lastId: number | undefined = req.query.cursor;

type Result = {
  nodes: { id: number; text: string }[];
  cursor?: number;
};

// 结果仅用于演示，将被推断
const posts: Result = await db.post
  .select('id', 'text')
  .where({ id: { lt: lastId } })
  .order({ id: 'DESC' })
  .limit(100)
  .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id }));
```

您还可以在嵌套子查询中使用 `tranform`：

```ts
type Result = {
  nodes: {
    id: number;
    text: string;
    comments: { nodes: { id: number; text: string }[]; cursor?: number };
  }[];
  cursor?: number;
};

const postsWithComments: Result = await db.post
  .select('id', 'text')
  .select({
    comments: (q) =>
      q.comments
        .select('id', 'text')
        .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id })),
  })
  .transform((nodes) => ({ nodes, cursor: nodes.at(-1)?.id }));
```

## narrowType

[//]: # 'has JSDoc'

缩小查询输出类型的一部分。
谨慎使用，不保证类型安全。
这类似于使用 TypeScript 的 `as` 关键字，除了它仅适用于结果的一部分。

语法 `()<{ ... }>()` 由内部限制强制执行。

```ts
const rows = db.table
  // 筛选出 `nullableColumn` 为 null 的记录
  .where({ nullableColumn: { not: null } });
  // 仅缩小指定列，其余结果保持不变
  .narrowType()<{ nullableColumn: string }>();

// 列的类型为 `string | null`，现在为 `string`
rows[0].nullableColumn;

// 假设表有一个枚举列 kind，变体为 'first' | 'second'
// 和一个布尔值 `approved`
db.table
  .where({ kind: 'first', approved: true })
  // 应用此类 `where` 后，缩小类型以接收文字值是安全的
  .narrowType()<{ kind: 'first', approved: true }>();
```

## log

覆盖 `log` 选项，也可以在 `createDb` 或创建表实例时设置：

```ts
// 为此查询打开日志：
await db.table.all().log(true);
await db.table.all().log(); // 无参数为 true

// 为此查询关闭日志：
await db.table.all().log(false);
```

## clear

清除查询中的指定操作符，接受一个或多个字符串键。

清除键可以是以下之一：

- with
- select
- where
- union
- using
- join
- group
- order
- having
- limit
- offset
- counters: 删除增量和减量

请注意，目前它不会影响结果的 TypeScript 类型，将来可能会改进。

```ts
// 清除 select 语句，但结果类型仍然选择了 `id` 列。
db.table.select('id').clear('id');
```

## merge

将两个查询合并为一个，具有适当的类型安全性：

```ts
const query1 = db.table.select('id').where({ id: 1 });
const query2 = db.table.select('name').where({ name: 'name' });

// 结果具有正确的类型 { id: number, name: string }
const result = await query1.merge(query2).take();
```

主要信息如表名和列类型不会被 `.merge(query)` 覆盖，
但所有其他查询数据将尽可能合并（`select`、`where`、`join`、`with` 等），
或者如果无法合并，则将从提供的查询参数中使用（`as`、`onConflict`、返回一个或多个）。

## makeHelper

[//]: # 'has JSDoc'

使用 `makeHelper` 创建查询助手 - 一个可以修改查询的函数，并在不同地方重用此函数。

```ts
const defaultAuthorSelect = db.author.makeHelper((q) => {
  return q.select('firstName', 'lastName');
});

// 这将选择 id、firstName、lastName，具有正确的 TS 类型
// 并返回单条记录
const result = await defaultAuthorSelect(db.author.select('id').find(1));
```

此类助手可用于关系查询中的 `select`：

```ts
await db.book.select({
  author: (book) => defaultAuthorSelect(book.author),
});
```

助手可以接受其他参数：

```ts
const selectFollowing = db.user.makeHelper((q, currentUser: { id: number }) => {
  return q.select({
    following: (q) =>
      q.followers.where({ followerId: currentUser.id }).exists(),
  });
});

// 从用户中选择一些列和 `following` 布尔字段
await selectFollowing(db.user.select('id', 'name'), currentUser);
```

要获取查询助手的结果类型，请使用 `QueryHelperResult` 类型：

```ts
import { QueryHelperResult } from 'orchid-orm';

const selectHelper = db.table.makeHelper((q) => q.select('id', 'name'));

// 此类型与 `db.table.select('id', 'name')` 相同
type SelectQuery = QueryHelperResult<typeof selectHelper>;

// 等待以获取结果，类型为 `{ id: number, name: string }[]`
type Result = Awaited<QueryHelperResult<typeof selectHelper>>;
```

## modify

[//]: # 'has JSDoc'

`modify` 允许使用 [makeHelper](#makehelper) 定义的助手修改查询：

```ts
const helper = db.table.makeHelper((q) => {
  // 所有查询方法都可用
  return q.select('name').where({ active: true }).order({ createdAt: 'DESC' });
});

const record = await db.table.select('id').modify(helper).find(1);

record.id; // id 在 `modify` 之前选择
record.name; // name 由函数选择
```

当助手结果不确定时，它将导致所有可能性的联合。
请谨慎使用，因为它会使处理结果变得复杂。

```ts
const helper = db.table.helper((q) => {
  if (Math.random() > 0.5) {
    return q.select('one');
  } else {
    return q.select('two');
  }
};

const record = await db.table.modify(helper).find(1);

// TS 错误：我们无法确定是否选择了 `one`。
record.one;

// 使用 `in` 运算符来消除结果类型的歧义
if ('one' in record) {
  record.one;
} else {
  record.two;
}
```

您可以定义和传递参数：

```ts
const helper = db.table.makeHelper((q, select: 'id' | 'name') => {
  return q.select(select);
});

const record = await db.table.modify(helper, 'id').find(1);
// 记录类型为 { id: number } | { name: string }
if ('id' in record) {
  record.id;
}
```

## toSQL

[//]: # 'has JSDoc'

在查询上调用 `toSQL` 以获取一个包含 `text` SQL 字符串和绑定值数组的对象：

```ts
const sql = db.table.select('id', 'name').where({ name: 'name' }).toSQL();

expect(sql.text).toBe(
  'SELECT "table"."id", "table"."name" FROM "table" WHERE "table"."name" = $1',
);
expect(sql.values).toEqual(['name']);
```

`toSQL` 在内部调用时等待查询。

它正在缓存结果。未修改查询方法会重置缓存，但需要注意以 `_` 开头的可变方法 - 它们不会重置缓存，这可能会导致意外结果。

`toSQL` 可选择接受以下参数：

```ts
type ToSqlOptions = {
  clearCache?: true;
  values?: [];
};
```
