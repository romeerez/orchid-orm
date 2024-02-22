# Overview

`Orchid ORM` is a library for node.js to help to work with a Postgres database,
with super-flexible and type-safe query builder,
allowing to easily define and compose queries with table relations.

The main focus is to keep it as powerful as possible, concise and intuitive, performant, and completely type-safe.

To get maximum control over the db, it has a query builder `pqb` which is inspired by [knex](http://knexjs.org/) and has all the same functionalities,
but `pqb` is written from scratch with TypeScript in mind.

Type safeness is achieved by defining a schema of columns and using inferred types in all query methods.

Unlike other ORMs in OOP style that rely on Active Record pattern and may look similar to:

```ts
// In some other ORMs, post is an instance of class Post
const post = await Post.findBy({ id: 123 });
await post.update({ title: 'new title' });
```

`Orchid ORM` is designed with different goals, so the records are returned as a plain objects:

```ts
// In Orchid ORM, post is a plain object
const post = await Post.findBy({ id: 123 });
await Post.update(post, { title: 'new title' });
```

This approach allows to select relations in a nested way, perform customized sub-queries, and keep everything type-safe:

```ts
// post type is completely inferred
const post = await Post.find(123).select('title', 'body', {
  likesCount: (q) => q.likes.count(),
  comments: (q) =>
    q.comments
      .order({ createdAt: 'DESC' })
      .limit(50)
      .select('body', {
        author: (q) => q.author.select('avatar', 'username'),
      }),
});
```

The query builder functionality is aimed to be as flexible as possible, allowing to chain queries with relations and conditions.

For example, selecting posts that have 2 specific tags:

```ts
const posts = await Post.where((q) =>
  q.tags.whereIn('tagName', ['typescript', 'node.js']).count().gte(2),
);
```

Relations can be chained in a sub-query.
Collecting array of all commenters' names for every post:

```ts
const posts = await Post.select({
  // `pluck` collects a plain array
  commentedBy: (q) => q.comments.author.pluck('username'),
});
```

Custom SQL can be injected into any place of the query.
Inserted values are properly handled to not allow SQL injections.

```ts
const posts = await;
Customer.select({
  upper: Post.sql<string>`upper(title)`,
}).whereSql`reverse(title) = ${reversedTitle}`.orderSql`reverse(title)`
  .havingSql`count("someColumn") > 300`;
```

## Comparison with other database tools

Before building yet another ORM I researched existing ones and wrote an [article](https://romeerez.hashnode.dev/nodejs-orms-overview-and-comparison) about it.
And I concluded that there is not a single ORM that can satisfy the typical needs of a TS node.js project.
And that's why `Orchid ORM` was born because an alternative is needed.

If all the ORMs feel limiting and messy, you may want to try using query builders or raw SQL instead, but they bring their disadvantages:

With raw SQL it is much harder and error-prone to write dynamic queries, when the query structure depends on user parameters it may result in a messy SQL parts concatenation.

Query-builder is not aware of relations between tables, so each time when querying posts with comments you have to write a join query explicitly, and there may be 3, 4, or 10 levels of joins.
To create or update related records you need to do that with separate queries and wrap them into a transaction.
An ORM does that for you.

Other ORMs take different ways of defining models:

- `Prisma` has its language for defining schema, which requires recompiling it to TS on each change.
- `Sequelize` was designed for JS, and it takes a lot of boilerplate for TS.
- `Objection` was designed for JS, and it won't let TS autocomplete or check relation names or columns in your queries.
- `TypeORM`, and `MikroORM` models rely on experimental TS decorators and require specific typescript settings.
- `DeepKit` hacks the TS compiler entirely.

With `Orchid ORM` you write table classes in a such way:

```ts
export type User = Selectable<UserTable>;
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(3, 30), // 3 characters minimum, 30 maximum
    password: t.text(8, 200),
    // adds createdAt and updatedAt with defaults:
    ...t.timestamps(),
  }));

  relations = {
    // User has one Profile, user.id -> profile.userId
    // there are also belongsTo, hasMany, hasAndBelongsToMany
    profile: this.hasOne(() => ProfileTable, {
      required: true,
      columns: ['id'],
      references: ['userId'],
    }),
  };
}
```

There is no additional language to use and recompile, no decorators, no TS compiler tweaks, and no type safeness compromises.

Different ORMs enforce different problems when there is a need to customize a query.

- In `Prisma` you have to rewrite a full query to raw SQL even if a small part of `WHERE` statement requires a custom piece SQL that's not officially supported by `Prisma`.
- `Sequelize` result type is always a full record, even if you selected only specific columns, the type doesn't know whether you included a relation or not
- `TypeORM`, and `MikroORM` offers you to use a very limited ORM interface for simple queries (with the same problem as in `Sequelize`), and to use a query builder for more complex queries which won't be type-safe.
- `MikroORM` started supporting partial result type in recent versions, but accessing nested records has jQuery-like syntax.
- `Objection` is easier for writing queries, but it is not type-safe.

`Orchid ORM` queries have no such problems, it is designed to build complex queries with relations and keep track of all the types:

```ts
// posts type will be: Array<{ id: number, name: string, authorName: string, commentsCount: number }>
const posts = await db.post
  // .join allows specifying only the relation name defined in the Post table
  .join('author')
  // .select autocompletes and checks for Post columns
  .select('id', 'name', {
    // select "author.name" as "authorName"
    // 'author.name' is selectable only after joining 'author', otherwise compilation error
    authorName: 'author.name',

    // select the number of post comments:
    commentsCount: (q) => q.comments.count(),
  });
```

`Orchid ORM` allows you to define custom chainable methods (via [repository](/guide/repo)) to write clean abstract queries like:

```ts
const posts = await postRepo
  .selectForList()
  .search('word')
  .filterByTags(['tag 1', 'tag 2'])
  .orderByPopularity()
  .limit(20);
```
