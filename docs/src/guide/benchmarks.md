<script setup>
import Chart from '../.vitepress/theme/components/Chart.vue'

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

# Benchmarks

The following benchmarks measure operations per second for different ORMs and query builders.
All the code with instruction is in the [repo here](https://github.com/romeerez/orchid-orm-examples/tree/main/packages/benchmarks).

::: warning
These measurements were taken in June 2023.

Actively maintained libraries are constantly being updated, so consider these benchmarks approximate and out of date.
:::

Contestants:

- **Orchid ORM** v1.11.0
- **Prisma** v4.15.0
- **Sequelize** v6.32.0
- **Knex** v2.4.2
- **Kysely** v0.25.0

For comparing with **Drizzle ORM** you can check [these benchmarks](https://github.com/webNeat/sql-single-vs-multiple-queries).

The connection pool is set to have size 10 for every ORM.
Benchmark is running 10 parallel queries for 10 seconds to calculate the average ops/s metric.

The results are from my laptop with Intel Core i7 10 Gen of U-series, 16 GB RAM, Manjaro Linux.

To ensure that nothing is cached on a database side between different ORMs, each ORM operates with a separate database.

## Load all records from a single table

Measuring a simple query which loads all records from the table with 10 columns and 100 records.

**ops/s**: higher is better

<Chart :chartData='queryAllData' />

## Load nested relation records

For this test,
we create 30 users,
1 post per each user (post belongs to user),
5 tags per each post (post has and belongs to many tags via a table in between),
10 comments per each post (columns, comment belongs to post and to a user).

And we want to fetch all posts with all the records they are connected to: post author, tags, comments, and authors of comments.

Here is code for `Orchid ORM`:

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

The queries of `Prisma` and `Sequelize` are fetching the same data, except that they don't allow to pick resulting field names like `lastComments`, so the result must be mapped on a JS side.

`Orchid ORM` is loading all the data with a single query, utilizing `JOIN LATERAL` which performs well for this task.

`Prisma` is loading every relation via a separate query, and as the test is performing locally, the roundtrips between database and node.js don't affect the performance much.

`Sequelize` is loading data in a strange way with the use of `UNION ALL` statements, making the query not efficient.

`Kysely` and `Knex` are skipped as it's not trivial to use them for such case.

**ops/s**: higher is better

<Chart :chartData='nestedSelectData' />

## Simple insert

Insert 7-columns large record.

**ops/s**: higher is better

<Chart :chartData='simpleInsertData' />

## Nested insert

Insert post with 3 comments and with 5 tags. Tags are connected to posts via a table in between.

Here is code for `Orchid ORM`:

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

`Prisma` is the only competitor here as it is hardly possible with Sequelize, and the relations aren't managed by query builders.

**ops/s**: higher is better

<Chart :chartData='nestedInsertData' />

## Why Orchid ORM performs faster

`Orchid ORM` is micro-optimized where possible, and performs fewer queries to achieve goals.

`Prisma` is based upon Rust server, communication between node.js and the Rust server is implemented inefficiently, loads relations in separate queries.
Though, it was drastically optimized in the last few month.

`Sequelize` is generating gigantic inefficient SQL queries when it tries to load relations.

Some ORMs like `Sequelize`, `TypeORM`, `MikroORM` are performing mapping to a class instance:
first data is loaded from db, then they construct class instances with the data, performing some logic when instantiating.
And later the classes needs to be converted back to simple JS objects before encoding to JSON for response.
