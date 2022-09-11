# ORM

**Porm** stands for Postgres ORM, where ORM is an abstract interface to work with models and relations between them with ease and fun.

While `pqb` query builder is designed to cover abilities of [knex](https://knexjs.org) to allow building any possible queries, `porm` takes inspiration from [prisma](https://prisma.io/) and other ORMs to give the highest productivity.

`porm` models are interfaces on top of `pqb` tables, and all methods of `pqb` are also available here. For query methods see [query builder](/guide/query-builder) document.

## Setup

`porm` is an entry function of the ORM, it takes `Adapter` which is accepting the same options as [node-postgres](https://node-postgres.com/) library.

For all connection options see: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool)

`porm` returns another function which takes object where keys are model names and values are models (see next section for defining model).

```ts
import { Adapter } from 'pqb'
import { porm } from 'porm'

// import all models
import { UserModel } from './models/user'
import { MessageModel } from './models/message'

export const db = porm(Adapter({
  // in the format: postgres://user:password@localhost:5432/dbname
  connectionString: process.env.DATABASE_URL
}))({
  user: UserModel,
  message: MessageModel,
})
```

## Model

Models are defined as classes with two required properties:

`table` is a table name and `columns` is for defining table column types (see [Columns schema](/guide/columns-schema) document for details).

```ts
// export type of User object:
export type User = UserModel['columns']['type']
export class UserModel extends Model {
  table = 'user';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    password: t.text(),
    updatedAt: t.timestamp(),
    createdAt: t.timestamp(),
  }))
}
```

After defining model place it to main `db` file as in [setup](#setup) step:

```ts
import { UserModel } from './models/user'

export const db = porm(Adapter(options))({
  user: UserModel,
})
```

And now it's available for querying:

```ts
import { db } from './db'

const user = await db.user.findBy({ name: 'John' })
```

Don't use model classes directly, it won't work:
```ts
// error
await UserModel.findBy({ name: 'John' })
```

## Relations

Different kinds of relations available: `belongsTo`, `hasOne`, `hasMany` and `hasAndBelongsToMany`.

Each defined relation adds methods and additional abilities for the model to simplify building queries and inserting related data.

Two models can have relation with each other without circular dependency problems:

```ts
// user.model.ts
import { Model } from 'porm'
import { ProfileModel } from './profile.model'

export class UserModel extends Model {
  table = 'user'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }))
  
  relations = {
    profile: this.hasOne(() => ProfileModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}

// profile.model.ts
import { Model } from 'porm'
import { UserModel } from './user.model'

export class ProfileModel extends Model {
  table = 'profile'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer(),
  }))

  relations = {
    profile: this.hasOne(() => UserModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}
```

## belongsTo

`belongsTo` is for a model which has a column pointing to another model.

For example, `Book` belongs to `Author`:

```ts
import { Model } from 'porm'

export class Author extends Model {
  table = 'author'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
}

export class Book extends Model {
  table = 'book'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    // book has a column pointing to author table
    authorId: t.integer(),
  }))
  
  relations = {
    author: this.belongsTo(() => Author, {
      // required is affecting on TS type of returned record
      required: true,
      // primaryKey is a column of Author to connect with
      primaryKey: 'id',
      // foreignKey is a column of Book to use
      foreignKey: 'bookId',
    })
  }
}
```

### belongsTo queries

Query author of the book when already having a book record:

```ts
const book = await db.book.find(1).takeOrThrow()

// type of author can be undefined if relation option required is not true:
const author = await db.book.author(book)

// additional query methods can be applied:
const authorWithName = await db.book.author(book).where({ name: 'Vasyl' })
```

Relation can be used in `.whereExists`, following query will find all books where related authors exists:

```ts
await db.book.whereExists('author')

// additional query methods can be applied in a callback:
await db.book.whereExists('author', (q) =>
  q.where({ 'author.name': 'Alex' })
)
```

Relation can be used in `.join`, following query will join and select author name:

```ts
await db.book.join('author').select(
  // column without table is for current book table
  'title',
  // select column of joined table
  'author.name',
)

// additional query methods can be applied in a callback:
await db.book.join('author', (q) =>
  q.where({ 'author.name': 'Alex' })
).select('title', 'author.name')
```

Relation can be added to select and a related object will be added to each record.

If there is no related record in the database it will be returned as `null`.

```ts
const bookWithAuthor = await db.book.select(
  'id',
  'title',
  db.book.author.select('id', 'name'),
).takeOrThrow()

// result has selected columns as usually:
bookWithAuthor.title

// result has object `author` with its columns:
bookWithAuthor.author.id
bookWithAuthor.author.name

// author can be null unless relation has option required: true
bookWithAuthor.author?.id
```

### belongsTo nested insert

Insert book with author all at once (two queries will run in transaction):

```ts
const { id } = await db.book.insert(
  {
    title: 'Book title',
    author: {
      create: {
        name: 'Peter',
      }
    }
  },
  ['id']
)
```
