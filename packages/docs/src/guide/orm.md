# ORM

**Porm** stands for Postgres ORM, where ORM is an abstract interface to work with models and relations between them with ease and fun.

While `pqb` query builder is designed to cover abilities of [knex](https://knexjs.org) to allow building any possible queries, `porm` takes inspiration from [prisma](https://prisma.io/) and other ORMs to give the highest productivity.

`porm` models are interfaces on top of `pqb` tables, and all methods of `pqb` are also available here. For query methods see [query builder](/guide/query-builder) document.

## setup

`porm` is an entry function of the ORM.

First argument is a connection options object, for all connection options see: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool).

Connection options may include `log` and `logger`, see [createDb](/guide/query-builder.html#createDb) for details.
 
Second argument is an object where keys are model names and values are models (see next section for defining model).

Returns instance with models and some specific functions as `destroy`.

```ts
import { porm } from 'porm'

// import all models
import { UserModel } from './models/user'
import { MessageModel } from './models/message'

export const db = porm({
  // in the format: postgres://user:password@localhost:5432/dbname
  connectionString: process.env.DATABASE_URL,
  log: true, // option for logging, false by default
})({
  user: UserModel,
  message: MessageModel,
})
```

Call `destroy` to close connection:

```ts
await db.destroy()
```

## model

First need to create a base `Model` class to extend from, this code should be in a separate from `db` file:

```ts
import { createModel } from 'porm'

export const Model = createModel()
```

This step is needed for case of customization of column types.

For example, by default timestamps are returned as strings, and if you want to parse them to `Date` objects for every model, here is the solution:

```ts
import { createModel } from 'porm'
import { columnTypes } from 'pqb';

export const Model = createModel({
  columnTypes: {
    ...columnTypes,
    timestamp() {
      return columnTypes.timestamp().parse((input) => new Date(input))
    },
  },
})
```

Models are defined as classes with two required properties:

`table` is a table name and `columns` is for defining table column types (see [Columns schema](/guide/columns-schema) document for details).

```ts
// import Model from a file from previous step:
import { Model } from './model'

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

## relations

Different kinds of relations available: `belongsTo`, `hasOne`, `hasMany` and `hasAndBelongsToMany`.

Each defined relation adds methods and additional abilities for the model to simplify building queries and inserting related data.

Two models can have relation with each other without circular dependency problems:

```ts
// user.model.ts
import { Model } from 'porm'
import { ProfileModel } from './profile.model'

export type User = UserModel['columns']['type']
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

export type Profile = ProfileModel['columns']['type']
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

export type Author = AuthorModel['columns']['type']
export class AuthorModel extends Model {
  table = 'author'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
}

export type Book = BookModel['columns']['type']
export class BookModel extends Model {
  table = 'book'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    // book has a column pointing to author table
    authorId: t.integer(),
  }))
  
  relations = {
    author: this.belongsTo(() => AuthorModel, {
      // required is affecting on TS type of returned record
      required: true,
      // primaryKey is a column of Author to connect with
      primaryKey: 'id',
      // foreignKey is a column of Book to use
      foreignKey: 'authorId',
    })
  }
}
```

## hasOne

`hasOne` association indicates that one other model has a reference to this model. That model can be fetched through this association.

This association adds all the same queries and abilities as `belongsTo`, only difference is the reference column is located in another table.

For example, if each supplier in your application has only one account, you'd declare the supplier model like this:

```ts
import { Model } from 'porm'

export type Supplier = SupplierModel['columns']['type']
export class SupplierModel extends Model {
  table = 'supplier'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    brand: t.text(),
    // here are no reference columns for an Account
  }))

  relations = {
    account: this.hasOne(() => AccountModel, {
      // required is offecting on TS type of returned record
      required: true,
      // primaryKey is a column of Supplier to use
      primaryKey: 'id',
      // foreignKey is a column of Account to connect with
      foreignKey: 'supplierId',
    })
  }
}

export type Account = AccountModel['columns']['type']
export class AccountModel extends Model {
  table = 'account'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    // Account has a column pointing to Supplier:
    supplierId: t.integer(),
  }))
}
```

## hasOne through

A `hasOne through` association sets up a one-to-one connection with another model.
This association indicates that the declaring model can be matched with one instance of another model by proceeding through a third model.

`hasOne through` gives the same querying abilities as a regular `hasOne`, but without nested create functionality.

For example, if each supplier has one account, and each account is associated with one account history, then the supplier model could look like this:

```ts
import { Model } from 'porm'

export type Supplier = SupplierModel['columns']['type']
export class SupplierModel extends Model {
  table = 'supplier'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    brand: t.text(),
  }))

  relations = {
    account: this.hasOne(() => AccountModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'supplierId',
    }),
    
    accountHistory: this.hasOne(() => AccountModel, {
      required: true,
      // previously defined relation name
      through: 'account',
      // name of relation in Account model
      source: 'accountHistory',
    }),
  }
}

export type Account = AccountModel['columns']['type']
export class AccountModel extends Model {
  table = 'account'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    // Account has a column pointing to Supplier:
    supplierId: t.integer(),
  }))
  
  relations = {
    accountHistory: this.hasOne(() => AccountHistoryModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'accountId',
    }),
  }
}

export type AccountHistory = AccountHistoryModel['columns']['type']
export class AccountHistoryModel extends Model {
  table = 'accountHistory'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    data: t.text(),
    // column pointing to the Account
    accountId: t.integer(),
  }))

  relations = {
    account: this.belongsTo(() => AccountModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'accountId',
    }),
  }
}
```

## hasMany

A `hasMany` association is similar to `hasOne`, but indicates a one-to-many connection with another model.
You'll often find this association on the "other side" of a `belongsTo` association.
This association indicates that each instance of the model has zero or more instances of another model.

For example, in an application containing authors and books, the author model could be declared like this:

```ts
import { Model } from 'porm'

export type Author = AuthorModel['columns']['type']
export class AuthorModel extends Model {
  table = 'author'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
  
  relations = {
    books: this.hasMany(() => BookModel, {
      // primaryKey is a column of Author to use
      primaryKey: 'id',
      // foreignKey is a column of Book to connect with
      foreignKey: 'authorId',
    })
  }
}

export type Book = BookModel['columns']['type']
export class BookModel extends Model {
  table = 'book'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    // book has a column pointing to author table
    authorId: t.integer(),
  }))
}
```

## hasMany through

A `hasMany though` association is often used to set up a many-to-many connection with another model.
This association indicates that the declaring model can be matched with zero or more instances of another model by proceeding through a third model.

`hasMany through` gives the same querying abilities as a regular `hasMany`, but without nested create functionality.

For example, consider a medical practice where patients make appointments to see physicians. The relevant association declarations could look like this:

```ts
import { Model } from 'porm'

export type Physician = PhysicianModel['columns']['type']
export class PhysicianModel extends Model {
  table = 'physician'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))

  relations = {
    appointments: this.hasMany(() => AppointmentModel, {
      // primaryKey is a column of Physician to use
      primaryKey: 'id',
      // foreignKey is a column of Appointment to connect with
      foreignKey: 'authorId',
    }),
    
    patients: this.hasMany(() => PatienModel, {
      // previously defined relation name
      through: 'appointments',
      // name of relation in Appointment model
      source: 'patient',
    }),
  }
}

export type Appointment = AppointmentModel['columns']['type']
export class AppointmentModel extends Model {
  table = 'appointment'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    appointmentDate: t.datetime(),
    // column references physycian:
    physycianId: t.integer(),
    // column references patient:
    patientId: t.integer(),
  }))
  
  relations = {
    physician: this.belongsTo(() => PhysicianModel, {
      primaryKey: 'id',
      foreignKey: 'physycianId',
    }),
    
    patient: this.belongsTo(() => PatientModel, {
      primaryKey: 'id',
      foreignKey: 'patientId',
    }),
  }
}

export type Patient = PatientModel['columns']['type']
export class PatientModel extends Model {
  table = 'patient'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
  
  relations = {
    appointments: this.hasMany(() => AppointmentModel, {
      primaryKey: 'id',
      foreignKey: 'patientId',
    }),
    
    physicians: this.hasMany(() => PhysicianModel, {
      // previously defined relation name
      through: 'appointments',
      // name of relation in Appointment model
      source: 'physician',
    })
  }
}
```

## hasAndBelongsToMany

A `hasAndBelongsToMany` association creates a direct many-to-many connection with another model, with no intervening model.
This association indicates that each instance of the declaring model refers to zero or more instances of another model.

For example, if your application includes posts and tags, with each post having many tags and each tag appearing in many posts, you could declare the models this way:

```ts
import { Model } from 'porm'

export type Post = PostModel['columns']['type']
export class PostModel extends Model {
  table = 'post'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
  }))

  relations = {
    tags: this.hasAndBelongsToMany(() => TagModel, {
      // primaryKey is a column of this model
      primaryKey: 'id',
      // foreignKey is a column of joinTable to connect with this model
      foreignKey: 'postId',
      // associationPrimaryKey is a primaryKey of related model
      associationPrimaryKey: 'id',
      // associationForeignKey is a column of joinTable to connect with related model
      associationForeignKey: 'tagId',
      // joinTable is a connection table between this and related models
      joinTable: 'postTag',
    })
  }
}

export type Tag = TagModel['columns']['type']
export class TagModel extends Model {
  table = 'tag'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
  
  relations = {
    posts: this.hasAndBelongsToMany(() => PostModel, {
      primaryKey: 'id',
      foreignKey: 'tagId',
      associationPrimaryKey: 'id',
      associationForeignKey: 'postId',
      joinTable: 'postTag',
    })
  }
}
```

## relation queries

Load related records by using record object (supported by all kinds of relations).

Resulting record of `belongsTo` and `hasOne` relation can be undefined if `required` option was not set.

```ts
const book = await db.book.find(1)

const author = await db.book.author(book) // type of argument is { authorId: number }

const books = await db.author.books(author) // type of argument is { id: number }

// additional query methods can be applied:
const partialAuthor = await db.book.author(book).select('id', 'name')

const countBooks = await db.author.books(author).where({ title: 'Kobzar' }).count()
```

Relation can be used in `.whereExists` (supported by all kinds of relations):

```ts
// load books which have author
await db.book.whereExists('author')

// load authors which have books
await db.authors.whereExists('book')

// additional query methods can be applied in a callback:
await db.book.whereExists('author', (q) =>
  q.where({ 'author.name': 'Olexiy' })
)
```

Relation can be used in `.join`.

Supported by all kinds of relations, but it is not suggested for `hasMany` and `hasAndBelongsToMany` because data will be duplicated.

```ts
await db.book.join('author').select(
  // column without table is for current book table
  'title',
  // select column of joined table
  'author.name',
)

// author name will be repeated for each book title:
await db.author.join('books').select('name', 'books.title')

// additional query methods can be applied in a callback:
await db.book.join('author', (q) =>
  q.where({ 'author.name': 'Olexiy' })
).select('title', 'author.name')
```

Relation can be loaded using `.select` and a related records will be added to each record.

`belongsTo` and `hasOne` will add object (can be `null` if not found).

`hasMany` and `hasAndBelongsToMany` will add array of objects.

For `hasMany` and `hasAndBelongsToMany` this works better than `join` because it won't lead to duplicative data.

Use the name of relation to load full records:

```ts
// if `required` option is not set in the model,
// type of author will be Author | null 
const booksWithAuthor: Book & { author: Author } = await db.book
  .select('*', 'author')
  .take();

const authorWithBooks: Author & { books: Book[] } = await db.book
  .select('*', 'author')
  .take();
```

To load specific fields or to apply `where`, `order`, `limit` and other methods, use such syntax:

```ts
type BookResult = {
  id: number
  title: string
  author: {
    id: number
    name: number
  }
}

const bookWithAuthor: BookResult = await db.book.select(
  'id',
  'title',
  db.book.author.select('id', 'name'),
).take()

type AuthorResult = {
  id: number
  name: string
  books: {
    id: number
    title: string[]
  }
}

const authorWithBooks: AuthorResult = await db.author.select(
  'id',
  'name',
  db.author.book.select('id', 'title').where(...conditions).order('title').limit(5),
).take()
```

For `hasMany` and `hasAndBelongsToMany` the select can also handle aggregation queries such as `count`, `min`, `max`, `sum`, `avg`:

```ts
type PostResult = {
  id: number,
  tags: number
}

const result: Result = await db.post.select(
  'id',
  db.post.tags.count()
).take()
```

Value of `count` and other aggregations will be returned under the name of relation, but you can use an alias to change it:

```ts
type PostResult = {
  id: number
  tagsCount: number
  tagsCommaSeparated: string | null // null if there is no tags
}

const result: Result = await db.post.select(
  'id',
  db.post.tags.count().as('tagsCount'),
  db.post.tags.stringAgg('name', ', ').as('tagsCommaSeparated'),
).take()
```

## nested create

Create record with related records all at once:

This will run two insert queries in a transaction, (three insert queries in case of `hasAndBelongsToMany`).

```ts
const book = await db.book.create({
  title: 'Book title',
  author: {
    create: {
      name: 'Author',
    }
  }
})

const author = await db.author.create({
  name: 'Author',
  books: {
    create: [
      { title: 'Book 1' },
      { title: 'Book 2' },
      { title: 'Book 3' },
    ]
  }
})
```

Nested create is supported when inserting many as well:

```ts
const books = await db.book.create([
  {
    title: 'Book 1',
    author: {
      create: {
        name: 'Author 1',
      }
    }
  },
  {
    title: 'Book 2',
    author: {
      create: {
        name: 'Author 2',
      }
    }
  },
])
```

### create related records from update

Create related records when updating:

For `belongsTo`, `hasOne`, `hasMany` it is available when updating one record, there must be `find`, or `findBy`, or `take` before update.

For `hasAndBelongsToMany` this will connect all found records for the update with all created records.

`hasOne` relation will nullify `foreignKey` of previous related record if exists, so it has to be nullable.

```ts
await db.book.find(1).update({
  title: 'update book title',
  author: {
    create: {
      name: 'new author',
    },
  },
})

await db.author.find(1).update({
  name: 'update author name',
  books: {
    create: [
      { title: 'new book 1' },
      { title: 'new book 2' },
    ],
  },
})

// this will connect all 3 posts with 2 tags
await db.post.where({ id: { in: [1, 2, 3] } }).update({
  tags: {
    create: [
      { name: 'new tag 1' },
      { name: 'new tag 2' },
    ]
  }
})
```

For `belongsTo` when updating multiple records, `create` option will connect new record with all updating records:

```ts
await db.book.where({ id: { in: [1, 2, 3] } }).update({
  title: 'update book title',
  author: {
    // all books will be connected with this author:
    create: {
      name: 'new author',
    },
  },
})
```

## connect related records

Connect records when creating:

This will search a record by provided where condition, throw `NotFoundError` if not found, and update the referring column.

Supported when inserting multiple records as well.

```ts
const book = await db.book.create({
  title: 'Book title',
  author: {
    connect: {
      name: 'Author',
    }
  }
})

const author = await db.author.create({
  name: 'Author name',
  books: {
    connect: [
      {
        title: 'Book 1',
      },
      {
        title: 'Book 2',
      },
    ]
  }
})
```

## connect or create

First look for record to connect with and then create it in case if not found.

Also supported when inserting multiple records.

`belongsTo` and `hasOne` relations are accepting `connect` and `create` options in such way:

```ts
const result = await db.book.create({
  title: 'Book title',
  author: {
    connect: {
      name: 'Author',
    },
    create: {
      name: 'Author',
    }
  }
})
```

`hasMany` and `hasAndBelongsToMany` relations are accepting `connectOrCreate` option in such way:

```ts
const result = await db.author.create({
  name: 'Author',
  books: {
    connectOrCreate: [
      {
        where: { title: 'Book 1' },
        create: { title: 'Book 1' },
      },
      {
        where: { title: 'Book 2' },
        create: { title: 'Book 2' },
      },
    ]
  }
})
```

## disconnect related records

This will delete join table records for `hasAndBelongsToMany`, and nullify the `foreignKey` column for the other kinds (the column has to be nullable).

Also supported when inserting multiple records.

For `belongsTo` and `hasOne` relations write `disconnect: true`:

```ts
await db.book.where({ title: 'book title' }).update({
  author: {
    disconnect: true,
  },
})
```

`hasMany` and `hasAndBelongsToMany` relations are accepting filter conditions.

```ts
await db.post.where({ title: 'post title' }).update({
  tags: {
    disconnect: {
      name: 'some tag',
    },
  },
})
```

It may be an array of conditions:

Each provided condition may match 0 or more related records, there is no check to find exactly one.

```ts
await db.post.where({ title: 'post title' }).update({
  tags: {
    disconnect: [
      { id: 1 },
      { id: 2 },
    ],
  },
})
```

## set related records

Set related records when updating.

For `hasOne` and `hasMany` it is available only when updating one record, so query should have `find`, or `findBy`, or `take` before the update.

For `hasOne` and `hasMany`, if there was a related record before update, it's `foreignKey` column will be updated to `NULL`, so it has to be nullable.

In `hasAndBelongsToMany` relation this will delete all previous rows of join table and create new ones.

```ts
const author = await db.author.find(1)

// this will update book with author's id from the given object
await db.book.find(1).update({
  author: {
    set: author,
  },
})

// this will find first author with given conditions to use their id
await db.book.find(2).update({
  author: {
    set: { name: 'author name' }
  },
})

// TypeScript error because need to use `findBy` instead of `where`:
await db.author.where({ id: 1 }).update({
  books: {
    set: { id: 1 }
  }
})

await db.author.find(1).update({
  books: {
    // all found books with such title will be connected to the author
    set: { title: 'book title' }
  }
})

await db.author.find(1).update({
  books: {
    // array of conditions can be provided:
    set: [{ id: 1 }, { id: 2 }]
  }
})
```

## delete related records

Deletes related record.

For `belongsTo` relation it will update `foreignKey` to `NULL` before deleting.

`hasMany` and `hasAndBelongsToMany` are accepting same conditions as `.where` method to delete only matching records, as object or as array of objects.

Empty `{}` or `[]` will delete all related records.

```ts
await db.book.find(1).update({
  author: {
    delete: true,
  },
})

await db.author.find(1).update({
  account: {
    // delete author book by conditions
    delete: { title: 'book title' }
  },
})

await db.author.find(1).update({
  account: {
    // array of conditions:
    delete: [{ id: 1 }, { id: 2 }]
  },
})
```

## nested update

Update related record.

`belongsTo` and `hasOne` are accepting object with data for update.

`hasMany` and `hasAndBelongsToMany` are accepting `where` conditions and `data` object. `where` can be an object or an array of objects.

```ts
await db.book.find(1).update({
  author: {
    update: {
      name: 'new name',
    },
  },
})

await db.author.find(1).update({
  books: {
    update: {
      where: {
        title: 'old book title',
      },
      data: {
        title: 'new book title',
      },
    }
  },
})
```

When updating multiple records, all their related records will be updated:

```ts
await db.book.where({ id: { in: [1, 2, 3] } }).update({
  author: {
    update: {
      name: 'new name',
    },
  },
})

await db.author.where({ id: [1, 2, 3] }).update({
  books: {
    update: {
      where: {
        title: 'old book title',
      },
      data: {
        title: 'new book title',
      }
    }
  },
})
```

## upsert: update or insert

Update related record if exists, and create if it doesn't.

Only available for `belongsTo` and `hasOne` relations.

Supported when updating multiple records as well.

```ts
await db.book.find(1).update({
  author: {
    upsert: {
      name: 'new name',
    },
    create: {
      name: 'new name',
      email: 'some@email.com'
    }
  }
})
```
