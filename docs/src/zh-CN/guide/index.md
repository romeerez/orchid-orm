# 概览

`Orchid ORM` 是一个用于 node.js 的库，帮助与 Postgres 数据库交互，
提供了一个超级灵活且类型安全的查询构建器，
允许轻松定义和组合带有表关系的查询。

其主要目标是保持强大功能、简洁直观、高性能以及完全类型安全。

为了最大限度地控制数据库，它提供了一个名为 `pqb` 的查询构建器，灵感来自 [knex](http://knexjs.org/)，并具有相同的功能，
但 `pqb` 是从头开始用 TypeScript 编写的。

通过定义列的模式并在所有查询方法中使用推断类型，实现了类型安全。

与其他基于 OOP 风格的 ORM 不同，后者依赖于 Active Record 模式，可能看起来像这样：

```ts
// 在其他 ORM 中，post 是类 Post 的实例
const post = await Post.findBy({ id: 123 });
await post.update({ title: 'new title' });
```

`Orchid ORM` 的设计目标不同，因此记录以普通对象的形式返回：

```ts
// 在 Orchid ORM 中，post 是一个普通对象
const post = await db.post.findBy({ id: 123 });
await db.post.update(post, { title: 'new title' });
```

这种方法允许以嵌套方式选择关系，执行自定义子查询，并保持所有内容类型安全：

```ts
// post 类型完全推断
const post = await db.post
  .find(123)
  .select('title', 'body', {
    likesCount: (q) => q.likes.count(),
    comments: (q) =>
      q.comments
        .order({ createdAt: 'DESC' })
        .limit(50)
        .select('body', {
          author: (q) => q.author.select('avatar', 'username'),
        }),
  })
  // 可以根据选定的点赞数量进行过滤和排序
  .where({ likesCount: { gt: 100 } })
  .order({ likesCount: 'DESC' });
```

查询构建器的功能旨在尽可能灵活，允许通过关系和条件链接查询。

例如，选择具有两个特定标签的帖子：

```ts
const posts = await db.post.where((q) =>
  q.tags.whereIn('tagName', ['typescript', 'node.js']).count().gte(2),
);
```

关系可以在子查询中链接。
为每个帖子收集所有评论者的名字数组：

```ts
const posts = await db.post.select({
  // `pluck` 收集一个普通数组
  commentedBy: (q) => q.comments.author.pluck('username'),
});
```

自定义 SQL 可以注入到查询的任何位置。
插入的值被正确处理以防止 SQL 注入。

<!-- prettier-ignore-start -->

```ts
import { sql } from './baseTable';

const posts = await db.customer
  .select({
    upper: sql<string>`upper(title)`,
  })
  .whereSql`reverse(title) = ${reversedTitle}`
  .orderSql`reverse(title)`
  .havingSql`count("someColumn") > 300`;
```

<!-- prettier-ignore-end -->

## 与其他数据库工具的比较

在构建另一个 ORM 之前，我研究了现有的 ORM 并写了一篇[文章](https://romeerez.hashnode.dev/nodejs-orms-overview-and-comparison)。
我得出的结论是，没有一个 ORM 能够满足 TS node.js 项目的典型需求。
这就是为什么 `Orchid ORM` 诞生了，因为需要一个替代品。

如果所有 ORM 都感觉限制多且混乱，你可能想尝试使用查询构建器或原始 SQL，但它们带来了以下缺点：

使用原始 SQL 编写动态查询更加困难且容易出错，当查询结构依赖于用户参数时，可能导致 SQL 部分拼接混乱。

查询构建器不了解表之间的关系，因此每次查询带有评论的帖子时，都必须显式编写连接查询，可能有 3、4 或 10 层连接。
要创建或更新相关记录，需要使用单独的查询并将它们包装到事务中。
ORM 会为你完成这些操作。

其他 ORM 采用不同的方式定义模型：

- `Prisma` 有自己的语言来定义模式，每次更改都需要重新编译为 TS。
- `Sequelize` 是为 JS 设计的，使用 TS 需要大量样板代码。
- `Objection` 是为 JS 设计的，它不会让 TS 自动完成或检查查询中的关系名称或列。
- `TypeORM` 和 `MikroORM` 模型依赖于实验性的 TS 装饰器，并需要特定的 TypeScript 设置。
- `DeepKit` 完全修改了 TS 编译器。

使用 `Orchid ORM` 可以这样编写表类：

```ts
export type User = Selectable<UserTable>;
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(), // `string` 是 varchar，默认限制为 255
    password: t.varchar(50), // 最大 50 个字符
    // 添加 createdAt 和 updatedAt，带默认值：
    ...t.timestamps(),
  }));

  relations = {
    // 用户有一个 Profile，user.id -> profile.userId
    // 还有 belongsTo, hasMany, hasAndBelongsToMany
    profile: this.hasOne(() => ProfileTable, {
      required: true,
      columns: ['id'],
      references: ['userId'],
    }),
  };
}
```

没有额外的语言需要使用和重新编译，没有装饰器，没有 TS 编译器调整，也没有类型安全性妥协。

当需要自定义查询时，不同的 ORM 会强制出现不同的问题。

- 在 `Prisma` 中，即使 `WHERE` 语句的一小部分需要自定义 SQL 片段（不被 `Prisma` 官方支持），也必须将整个查询重写为原始 SQL。
- `Sequelize` 的结果类型始终是完整记录，即使你只选择了特定列，类型也不知道你是否包含了关系。
- `TypeORM` 和 `MikroORM` 提供了一个非常有限的 ORM 接口用于简单查询（与 `Sequelize` 中的问题相同），并提供查询构建器用于更复杂的查询，但它们不是类型安全的。
- `MikroORM` 在最近的版本中开始支持部分结果类型，但访问嵌套记录具有类似 jQuery 的语法。
- `Objection` 更容易编写查询，但它不是类型安全的。

`Orchid ORM` 查询没有这些问题，它旨在构建复杂的关系查询并跟踪所有类型：

```ts
// posts 类型将是：Array<{ id: number, name: string, authorName: string, commentsCount: number }>
const posts = await db.post
  // .join 允许仅指定在 Post 表中定义的关系名称
  .join('author')
  // .select 自动完成并检查 Post 列
  .select('id', 'name', {
    // 选择 "author.name" 作为 "authorName"
    // 'author.name' 只有在连接 'author' 后才可选择，否则编译错误
    authorName: 'author.name',

    // 选择帖子评论的数量：
    commentsCount: (q) => q.comments.count(),
  });
```

`Orchid ORM` 允许定义自定义可链接方法（通过[repository](/zh-CN/guide/repo)）以编写干净的抽象查询，例如：

```ts
const posts = await postRepo
  .selectForList()
  .search('word')
  .filterByTags(['tag 1', 'tag 2'])
  .orderByPopularity()
  .limit(20);
```
