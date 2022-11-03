# Overview

`Porm` is a library for node.js to help to work with a Postgres database (more databases to come), it allows to define models, relations, and keep everything type safe.

Main focus is to keep it as powerful as possible, concise and intuitive, performant, and fully type safe.

Node.js already has a lot of ORMs, query builders, but all of them forces compromises.

To get maximum control over the db, it has a query builder `pqb` which is inspired by [knex](http://knexjs.org/) and has all the same functionalities, but `pqb` is written from scratch with TypeScript in mind.

Type safeness is achieving by defining a schema of columns in the way as [Zod](https://github.com/colinhacks/zod) works and using inferred types in all methods.

## Comparison with other database tools

Before building yet another ORM I researched existing ones and wrote an [article](https://romeerez.hashnode.dev/nodejs-orms-overview-and-comparison#heading-typeorm) about it. And I came to conclusion that there is not a single ORM which can satisfy typical needs of a TS node.js project. And that's why `Porm` was born, because alternative is really needed.

If all the ORMs feels limiting and messy, you may want to try using query builders or raw SQL instead, but they bring own disadvantages:

With raw SQL it is much harder and error-prone to write dynamic queries, when the query structure depends on user parameters it may result in a messy SQL parts concatenation.

Query-builder is not aware of relations between tables, so each time when querying posts with comments you have to write join query explicitly, and there may be 3, 4, 10 levels of joins.
ORM does that for you.

Other ORMs takes different ways for defining models:

- `Prisma` has own language for defining schema, which requires to recompile it to TS on each change.
- `Sequelize` was designed for JS, and it takes a lot of boilerplate for TS.
- `Objection` was designed for JS, and it won't let TS to autocomplete or check relation names or columns in your queries.
- `TypeORM`, `MikroORM` models relies on decorators and requires specific typescript settings.
- `DeepKit` hacks the compiler entirely, and it simply didn't work for me with strange errors.

With `Porm` you write models in a such way:

```ts
export type User = UserModel['columns']['type']
export class UserModel extends Model {
  table = 'user';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    password: t.text(),
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

There is no additional language to use and recompile, no decorators, no TS compiler tweaks, no type safeness compromises.

Different ORMs enforces different problems when there is a need to customize a query.

- In `Prisma` you have to rewrite a full query to raw SQL even if a small `WHERE` statement requires a custom condition
- `Sequelize` result type is always a full record, even if you selected only specific columns, the type doesn't know whether you included relation or not
- `TypeORM`, `MikroORM` offers you to use very limited ORM interface for simple queries (with the same problem as in `Sequelize`), and to use a query builder for more complex queries which won't be type safe.
- `Objection` is easier for writing queries, but it is not type safe.

`Porm` queries have no such problems, it is designed to build complex queries with relations and keep track of all the types:

```ts
// posts type will be: Array<{ id: number, name: string, authorName: string, commentsCount: number }>
const posts = await db.post
  // .join allows to specify only relation name defined in Post model
  .join('author')
  // .select autocompletes and checks for Post columns
  .select('id', 'name', {
    // select "author.name" as "authorName"
    // 'author.name' is selectable only after joining 'author', otherwise compilation error
    authorName: 'author.name',
    
    // select number of post comments:
    commentsCount: (q) => q.comments.count(),
  })
```

`Porm` allows to define custom chainable methods (via [repository](/guide/orm-repo)) to write clean abstract queries like:

```ts
const posts = await postRepo
  .selectForList()
  .search('word')
  .filterByTags(['tag 1', 'tag 2'])
  .orderByPopularity()
  .limit(20)
```
