<script setup>
import Chart from '../../.vitepress/theme/components/Chart.vue'

const queryAllData = {
  labels: ['Orchid ORM', 'Prisma', 'Sequelize', 'Kysely', 'Knex'],
  datasets: [{
    data: [2696, 2298, 1161, 1745, 1693],
    backgroundColor: [
      '#b469ff',
      '#5a67d8',
      '#52b0e7',
      '#ccb765',
      '#c85b24',
    ],
  }]
}

const nestedSelectData = {
  labels: ['Orchid ORM', 'Prisma', 'Sequelize'],
  datasets: [{
    data: [1218, 734, 135],
    backgroundColor: [
      '#b469ff',
      '#5a67d8',
      '#52b0e7',
    ],
  }]
}

const simpleInsertData = {
  labels: ['Orchid ORM', 'Prisma', 'Sequelize', 'Kysely', 'Knex'],
  datasets: [{
    data: [9224, 4893, 3931, 9930, 9460],
    backgroundColor: [
      '#b469ff',
      '#5a67d8',
      '#52b0e7',
      '#ccb765',
      '#c85b24',
    ],
  }]
}

const nestedInsertData = {
  labels: ['Orchid ORM', 'Prisma'],
  datasets: [{
    data: [2205, 1523],
    backgroundColor: [
      '#b469ff',
      '#5a67d8',
      '#52b0e7',
    ],
  }]
}

</script>

# 基准测试

以下基准测试衡量了不同 ORM 和查询构建器的每秒操作数。
所有代码和说明都在[此仓库](https://github.com/romeerez/orchid-orm-benchmarks)。

::: warning
这些测量是在 2023 年 6 月进行的。

活跃维护的库会不断更新，因此请将这些基准测试视为近似值且可能已过时。
:::

参赛者：

- **Orchid ORM** v1.11.0
- **Prisma** v4.15.0
- **Sequelize** v6.32.0
- **Knex** v2.4.2
- **Kysely** v0.25.0

要比较 **Drizzle ORM**，可以查看[这些基准测试](https://github.com/webNeat/sql-single-vs-multiple-queries)。

连接池为每个 ORM 设置为大小 10。
基准测试运行 10 个并行查询 10 秒以计算平均 ops/s 指标。

结果来自我的笔记本电脑，Intel Core i7 10 Gen U 系列，16 GB RAM，Manjaro Linux。

为了确保在不同 ORM 之间数据库端没有缓存，每个 ORM 使用单独的数据库。

## 从单个表加载所有记录

测量一个简单查询，该查询从具有 10 列和 100 条记录的表中加载所有记录。

**ops/s**：值越高越好

<Chart :chartData='queryAllData' />

## 加载嵌套关系记录

对于此测试，
我们创建 30 个用户，
每个用户 1 个帖子（帖子属于用户），
每个帖子 5 个标签（帖子通过中间表与标签相关联），
每个帖子 10 条评论（列，评论属于帖子和用户）。

我们希望获取所有帖子及其连接的所有记录：帖子作者、标签、评论和评论作者。

以下是 `Orchid ORM` 的代码：

```ts
await db.post
  .select('id', 'title', 'description', {
    author: (q) => q.author.select('id', 'firstName', 'lastName'),
    tags: (q) => q.postTags.pluck('tagName'),
    lastComments: (q) =>
      q.comments
        .select('id', 'text', {
          author: (q) => q.author.select('id', 'firstName', 'lastName'),
        })
        .order({ createdAt: 'DESC' })
        .limit(10),
  })
  .order({ createdAt: 'DESC' });
```

`Prisma` 和 `Sequelize` 的查询获取相同的数据，只是它们不允许选择结果字段名称，例如 `lastComments`，因此结果必须在 JS 端进行映射。

`Orchid ORM` 使用单个查询加载所有数据，利用 `JOIN LATERAL` 在此任务中表现良好。

`Prisma` 通过单独的查询加载每个关系，由于测试是在本地执行的，因此数据库和 node.js 之间的往返不会对性能产生太大影响。

`Sequelize` 使用 `UNION ALL` 语句以一种奇怪的方式加载数据，使查询效率低下。

`Kysely` 和 `Knex` 被跳过，因为在这种情况下使用它们并不简单。

**ops/s**：值越高越好

<Chart :chartData='nestedSelectData' />

## 简单插入

插入一个包含 7 列的大记录。

**ops/s**：值越高越好

<Chart :chartData='simpleInsertData' />

## 嵌套插入

插入一个帖子，包含 3 条评论和 5 个标签。标签通过中间表与帖子相关联。

以下是 `Orchid ORM` 的代码：

```ts
const tagNames = ['one', 'two', 'three', 'four', 'five'];

const postData = {
  userId: 1,
  title: 'Post title',
  description: 'Post description',
};

const commentData = {
  userId: 1,
  text: 'Comment text',
};

await db.post.insert({
  ...postData,
  comments: {
    create: [commentData, commentData, commentData],
  },
  postTags: {
    create: tagNames.map((tagName) => ({ tagName })),
  },
});
```

`Prisma` 是这里唯一的竞争者，因为使用 Sequelize 几乎不可能，而查询构建器不管理关系。

**ops/s**：值越高越好

<Chart :chartData='nestedInsertData' />

## 为什么 Orchid ORM 表现更快

`Orchid ORM` 在可能的情况下进行了微优化，并执行了更少的查询以实现目标。

`Prisma` 基于 Rust 服务器，node.js 和 Rust 服务器之间的通信实现效率低下，加载关系时使用单独的查询。
不过，它在过去几个月中得到了大幅优化。

`Sequelize` 在尝试加载关系时生成了巨大的低效 SQL 查询。

一些 ORM，如 `Sequelize`、`TypeORM`、`MikroORM`，执行映射到类实例：
首先从数据库加载数据，然后使用数据构造类实例，在实例化时执行一些逻辑。
之后，在编码为 JSON 以响应之前，类需要转换回简单的 JS 对象。
