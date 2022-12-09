# Overview

`Orchid ORM` is a library for node.js to help to work with a Postgres database (more databases to come),
is allows to perform queries in a query builder style, define models and relations like an ORM.

The main focus is to keep it as powerful as possible, concise and intuitive, performant, and fully type-safe.

Node.js already has a lot of ORMs, and query builders, but all of them force compromises.

To get maximum control over the db, it has a query builder `pqb` which is inspired by [knex](http://knexjs.org/) and has all the same functionalities, but `pqb` is written from scratch with TypeScript in mind.

Type safeness is achieved by defining a schema of columns in the way [Zod](https://github.com/colinhacks/zod) works and using inferred types in all methods.

## Not an ORM in OOP sense

ORMs in OOP languages make it so all the records loaded from the database are instantiated as instances of a specific class,
and it is allowed to call methods on these instances, this is called Active Record pattern. For example:

```ts
const post = await Post.findBy({ id: 123 })
await post.update({ title: 'new title' })
```

Orchid ORM is designed with different goals, so the records are returned as a plain objects, for example:

```ts
const post = await Post.findBy({ id: 123 })
await Post.update(post, { title: 'new title' })
```

This is done because instantiating records consumes some CPU time,
accessing record data through getters/setters also takes some CPU time,
serializing records to JSON would require a separate step.
Only when selecting all columns it is possible to instantiate properly,
because the model class requires all columns to be defined.
So, the in author's opinion, Active Record pattern only complicates things and takes away a bit of performance.

For the same reasons, Data Mapper pattern, Unit of Work, and Data encapsulation are not included, therefore,
`Orchid ORM` is not an ORM in a traditional OOP sense.

## Comparison with other database tools

Before building yet another ORM I researched existing ones and wrote an [article](https://romeerez.hashnode.dev/nodejs-orms-overview-and-comparison#heading-typeorm) about it. And I concluded that there is not a single ORM that can satisfy the typical needs of a TS node.js project. And that's why `Orchid ORM` was born because an alternative is needed.

If all the ORMs feel limiting and messy, you may want to try using query builders or raw SQL instead, but they bring their disadvantages:

With raw SQL it is much harder and error-prone to write dynamic queries, when the query structure depends on user parameters it may result in a messy SQL parts concatenation.

Query-builder is not aware of relations between tables, so each time when querying posts with comments you have to write a join query explicitly, and there may be 3, 4, or 10 levels of joins.
An ORM does that for you.

Other ORMs take different ways of defining models:

- `Prisma` has its language for defining schema, which requires recompiling it to TS on each change.
- `Sequelize` was designed for JS, and it takes a lot of boilerplate for TS.
- `Objection` was designed for JS, and it won't let TS autocomplete or check relation names or columns in your queries.
- `TypeORM`, and `MikroORM` models rely on decorators and require specific typescript settings.
- `DeepKit` hacks the compiler entirely, and it simply didn't work for me with strange errors.

With `Orchid ORM` you write models in a such way:

```ts
export type User = UserModel['columns']['type']
export class UserModel extends Model {
  table = 'user';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 30), // 3 characters minimum, 30 maximum
    password: t.text(8, 200),
    // adds createdAt and updatedAt with defaults:
    ...t.timestamps(),
  }))
  
  relations = {
    profile: this.hasOne(() => ProfileModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}
```

There is no additional language to use and recompile, no decorators, no TS compiler tweaks, and no type safeness compromises.

Different ORMs enforce different problems when there is a need to customize a query.

- In `Prisma` you have to rewrite a full query to raw SQL even if a small part of `WHERE` statement requires a custom condition
- `Sequelize` result type is always a full record, even if you selected only specific columns, the type doesn't know whether you included a relation or not
- `TypeORM`, and `MikroORM` offers you to use a very limited ORM interface for simple queries (with the same problem as in `Sequelize`), and to use a query builder for more complex queries which won't be type-safe.
- `Objection` is easier for writing queries, but it is not type-safe.

`Orchid ORM` queries have no such problems, it is designed to build complex queries with relations and keep track of all the types:

```ts
// posts type will be: Array<{ id: number, name: string, authorName: string, commentsCount: number }>
const posts = await db.post
  // .join allows specifying only the relation name defined in the Post model
  .join('author')
  // .select autocompletes and checks for Post columns
  .select('id', 'name', {
    // select "author.name" as "authorName"
    // 'author.name' is selectable only after joining 'author', otherwise compilation error
    authorName: 'author.name',

    // select the number of post comments:
    commentsCount: (q) => q.comments.count(),
  })
```

`Orchid ORM` allows you to define custom chainable methods (via [repository](/guide/orm-repo)) to write clean abstract queries like:

```ts
const posts = await postRepo
  .selectForList()
  .search('word')
  .filterByTags(['tag 1', 'tag 2'])
  .orderByPopularity()
  .limit(20)
```
