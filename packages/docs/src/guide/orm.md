# ORM

**Porm** stands for Postgres ORM, where ORM is an abstract interface to work with models and relations between them with ease and fun.

While `pqb` query builder is designed to cover abilities of [knex](https://knexjs.org) to allow building any possible queries, `porm` takes inspiration from [prisma](https://prisma.io/) and other ORMs to give the highest productivity.

`porm` models are interfaces on top of `pqb` tables, and all methods of `pqb` are also available here. For query methods see [query builder](/guide/query-builder) document.

## Setup

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

### belongsTo queries

Query author of the book when we already have a book record:

```ts
const book = await db.book.find(1).takeOrThrow()

// type of author can be undefined if relation option required is not true:
const author = await db.book.author(book) // type of argument is { authorId: number }

// additional query methods can be applied:
const authorWithSpecificName = await db.book.author(book).where({ name: 'Vasyl' })
```

Relation can be used in `.whereExists`, following query will find all books where related authors exists:

```ts
await db.book.whereExists('author')

// additional query methods can be applied in a callback:
await db.book.whereExists('author', (q) =>
  q.where({ 'author.name': 'Olexiy' })
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
  q.where({ 'author.name': 'Olexiy' })
).select('title', 'author.name')
```

Relation can be added to select and a related object will be added to each record.

If there is no related record in the database it will be returned as `null`.

Select full related object by providing relation name to `.select`:

```ts
const booksWithAuthor = await db.book.select('*', 'author').takeOrThrow()
```

Select specific fields of related object in such way:

```ts
type Result = Pick<Book, 'id' | 'title'> & {
  author: Pick<Author, 'id', 'name'>
}

const bookWithAuthor: Result = await db.book.select(
  'id',
  'title',
  db.book.author.select('id', 'name'),
).takeOrThrow()

// result has selected columns as usually:
bookWithAuthor.title

// result has object `author` with its columns:
bookWithAuthor.author.id
bookWithAuthor.author.name

// author can be null unless relation has option required set to true
bookWithAuthor.author?.id
```

### belongsTo nested create

Insert book with author all at once:

This will run two insert queries in a transaction.

```ts
const result: Pick<Book, 'id' | 'authorId'> = await db.book.insert(
  {
    title: 'Book title',
    author: {
      create: {
        name: 'Author',
      }
    }
  },
  ['id', 'authorId']
)
```

Insert many books with authors:

This will also run only two insert queries in a transaction.

```ts
const result: Pick<Book, 'id' | 'authorId'>[] = await db.book.insert(
  [
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
  ],
  ['id', 'authorId']
)
```

### belongsTo connect in insert

Connect record to another record while inserting:

This will search a record by provided where condition, throw if not found, and use its id for the inserting record.

Also supported when inserting multiple records.

```ts
const result: Pick<Book, 'id' | 'authorId'> =  await db.book.insert(
  {
    title: 'Book title',
    author: {
      connect: {
        name: 'Author',
      }
    }
  }
)
```

### belongsTo connect or create

Specify both `connect` and `create` properties to first look for record to connect with and then create it in case if not found.

Also supported when inserting multiple records.

```ts
const result: Pick<Book, 'id' | 'authorId'> =  await db.book.insert(
  {
    title: 'Book title',
    author: {
      connect: {
        name: 'Author',
      },
      create: {
        name: 'Author',
      }
    }
  }
)
```

### belongsTo disconnect

Disconnect related record by writing `{ disconnect: true }` in `update`.

This command will update foreignKey of current record to `NULL`, the foreignKey has to be nullable.

Following query will set `authorId` of the book to `NULL`:

```ts
await db.book.where({ title: 'book title' }).update({
  author: {
    disconnect: true,
  },
})
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

### hasOne through

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

### hasOne queries

Query account of the supplier when we already have a supplier record:

```ts
const supplier = await db.supplier.find(1).takeOrThrow()

// type of account can be undefined if relation option required is not true
const account = await db.supplier.account(supplier) // type of argument is { id: number }

// additional query methods can be applied:
const accountWithSpecificName = await db.supplier.account(supplier).where({ name: 'Andriy' })
```

Relation can be used in `.whereExists`, following query will find all suppliers where related account exists:

```ts
await db.supplier.whereExists('account')

// additional query methods can be applied in a callback:
await db.supplier.whereExists('account', (q) =>
  q.where({ 'account.name': 'Dmytro' })
)
```

Relation can be used in `.join`, following query will join and select account name:

```ts
await db.supplier.join('account').select(
  // column without table is for current book table
  'id',
  // select column of joined table
  'account.name',
)

// additional query methods can be applied in a callback:
await db.supplier.join('account', (q) =>
  q.where({ 'account.name': 'Dmytro' })
).select('id', 'account.name')
```

Relation can be added to select and a related object will be added to each record.

If there is no related record in the database it will be returned as `null`.

Select full related object by providing relation name to `.select`:

```ts
const suppliersWithAccount = await db.supplier.select('*', 'account')
```

Select specific fields of related object in such way:

```ts
type Result = Pick<Supplier, 'id'> & {
  account: Pick<Accunt, 'id' | 'name'>
}

const supplierWithAccount: Result = await db.supplier.select(
  'id',
  db.supplier.account.select('id', 'name'),
).takeOrThrow()

// result has selected columns as usually:
supplierWithAccount.id

// result has object `account` with its columns:
supplierWithAccount.account.id
supplierWithAccount.account.name

// account can be null unless relation has option required set to true
supplierWithAccount.account?.id
```

### hasOne nested create

Insert supplier with account all at once:

This will run two insert queries in a transaction.

```ts
const result: Pick<Supplier, 'id'> = db.supplier.insert(
  {
    brand: 'Supplier 1',
    account: {
      create: {
        name: 'Account 1',
      }
    }
  },
  ['id']
)
```

Insert many suppliers with authors:

This will also run only two insert queries in a transaction.

```ts
const result: Pick<Supplier, 'id'>[] = await db.supplier.insert(
  [
    {
      brand: 'Supplier 1',
      account: {
        create: {
          name: 'Author 1',
        }
      }
    },
    {
      brand: 'Supplier 2',
      account: {
        create: {
          name: 'Author 2',
        }
      }
    },
  ],
  ['id']
)
```

### hasOne connect in insert

Connect record to another record while inserting:

This will search a record by provided where condition, throw if not found, and update it to connect to the inserted record.

Also supported when inserting multiple records.

```ts
const result: Pick<Supplier, 'id'> = db.supplier.insert(
  {
    brand: 'Supplier 1',
    account: {
      connect: {
        name: 'Account 1',
      }
    }
  },
  ['id']
)
```

### hasOne connect or create

Specify both `connect` and `create` properties to first look for record to connect with and then create it in case if not found.

Also supported when inserting multiple records.

```ts
const result: Pick<Supplier, 'id'> = db.supplier.insert(
  {
    brand: 'Supplier 1',
    account: {
      connect: {
        name: 'Account 1',
      },
      create: {
        name: 'Account 1',
      }
    }
  },
  ['id']
)
```

### hasOne disconnect

Disconnect related record by writing `{ disconnect: true }` in `update`.

This command will update foreignKey of related record to `NULL`, the foreignKey has to be nullable.

Following query will set `supplierId` of the account to `NULL`:

```ts
await db.supplier.where({ brand: 'supplier brand' }).update({
  account: {
    disconnect: true,
  },
})
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

### hasMany through

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

### hasMany queries

Query books of the author when we already have an author record:

```ts
const author = await db.author.find(1).takeOrThrow()

const books = await db.author.books(author) // type of argument is { id: number }

// additional query methods can be applied:
const countBooks = await db.author.books(author).where({ title: 'Kobzar' }).count()
```

Relation can be used in `.whereExists`, following query will find all authors where at least one book exists:

```ts
await db.author.whereExists('books')

// additional query methods can be applied in a callback:
await db.author.whereExists('books', (q) =>
  q.where({ 'books.title': 'Eneida' })
)
```

Relation can be used in `.join`, but it is not suggested for `hasMany` relation because author columns will be duplicated for each book:

```ts
await db.author.join('books').select(
  // column without table is for current author table
  'name',
  // select column of joined table
  'books.title',
)

// additional query methods can be applied in a callback:
await db.author.join('books', (q) =>
  q.where({ 'books.title': 'Kamenyari' })
).select('name', 'books.title')
```

Relation can be added to select and a related array of object will be added to each record.

This works better than `join` because it won't lead to duplicative data.

Select full related objects by providing relation name to `.select`:

```ts
const authorsWithBooks = await db.author.select('*', 'books')
```

Select specific fields of related object in such way:

```ts
type Result = Pick<Author, 'id' | 'name'> & {
  books: Pick<Book, 'id' | 'title'>[]
}

const authorWithBooks: Result = await db.author.select(
  'id',
  'name',
  db.author.books.select('id', 'title'),
).takeOrThrow()

// result has selected columns as usually:
authorWithBooks.name

// result has array `books` with object:
authorWithBooks.books.forEach((book) => {
  book.id
  book.title
})
```

In the select you can also apply aggregation queries such as `count`, `min`, `max`, `sum`, `avg`:

```ts
type Result = Pick<Author, 'id'> & {
  // books number is for the count
  books: number
}

const result: Result = await db.author.select(
  'id',
  db.author.books.count()
).takeOrThrow()
```

Value of `count` and other aggregations will be returned under the name of relation, but you can use an alias to change it:

```ts
type Result = Pick<Author, 'id'> & {
  booksCount: number
  booksAvgYear: number | null // null if there is no books
}

const result: Result = await db.author.select(
  'id',
  db.author.books.count().as('booksCount'),
  db.author.books.avg('year').as('booksAvgYear'),
).takeOrThrow()
```

### hasMany nested create

Insert author with books all at once:

This will run two insert queries in a transaction.

```ts
const result: Pick<Author, 'id'> = await db.author.insert(
  {
    name: 'Author',
    books: {
      create: [
        {
          title: 'Book 1',
        },
        {
          title: 'Book 2',
        },
      ]
    }
  },
  ['id']
)
```

Insert many authors with books:

This will also run only two insert queries in a transaction.

```ts
const result: Pick<Author, 'id'>[] = await db.author.insert(
  [
    {
      name: 'Author 1',
      books: {
        create: [
          {
            title: 'Book 1',
          },
          {
            title: 'Book 2',
          },
        ],
      },
    },
    {
      name: 'Author 2',
      books: {
        create: [
          {
            title: 'Book 3',
          },
          {
            title: 'Book 4',
          },
        ],
      }
    },
  ],
  ['id']
)
```

### hasMany connect in insert

Connect record to another record while inserting:

This will search one record per provided where condition, throw if any of them is not found, and update found records to connect to the inserted record.

Also supported when inserting multiple records.

```ts
const result: Pick<Author, 'id'> = await db.author.insert(
  {
    name: 'Author',
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
  },
  ['id']
)
```

### hasMany connectOrCreate

Specify `connectOrCreate` object with `where` and `connect` properties to first look for record to connect with and then create it in case if not found.

Also supported when inserting multiple records.

```ts
const result: Pick<Author, 'id'> = await db.author.insert(
  {
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
  },
  ['id']
)
```

### hasMany disconnect

Disconnect related record with array of conditions in `update`:

This command will update foreignKey of related records to `NULL`, the foreignKey has to be nullable.

Each provided condition may match 0 or more related records, there is no check to find exactly one.

Following query will set `authorId` of related books found by conditions to `NULL`:

```ts
await db.author.where({ name: 'author name' }).update({
  books: {
    disconnect: [
      { id: 5 },
      { title: 'book title' }
    ],
  },
})
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

### hasAndBelongsToMany queries

Query tags of the post when we already have a post record:

```ts
const post = await db.post.find(1).takeOrThrow()

const tags = await db.post.tags(post) // type of argument is { id: number }

// additional query methods can be applied:
const specificTags = await db.post.tags(post).where({ name: { startsWith: 'a' } })
```

Relation can be used in `.whereExists`, following query will find all posts where at least one tag exists:

```ts
await db.post.whereExists('tags')

// additional query methods can be applied in a callback:
await db.post.whereExists('tags', (q) =>
  q.where({ 'tags.name': 'porm' })
)
```

Relation can be used in `.join`, but it is not suggested for `hasAndBelongsToMany` relation because post columns will be duplicated for each tag:

```ts
await db.post.join('tags').select(
  // column without table is for current author table
  'title',
  // select column of joined table
  'tags.name',
)

// additional query methods can be applied in a callback:
await db.post.join('tags', (q) =>
  q.where({ 'tags.name': 'pqb' })
).select('title', 'tags.name')
```

Relation can be added to select and a related array of object will be added to each record.

This works better than `join` because it won't lead to duplicative data.

Select full related object by providing relation name to `.select`:

```ts
const postsWithTags = await db.post.select('*', 'tags')
```

Select specific fields of related object in such way:

```ts
type Result = Pick<Post, 'id' | 'title'> & {
  tags: Pick<Tag, 'id' | 'name'>[]
}

const postWithTags: Result = await db.post.select(
  'id',
  'title',
  db.post.tags.select('id', 'name'),
).takeOrThrow()

// result has selected columns as usually:
postWithTags.title

// result has array `books` with object:
postWithTags.tags.forEach((tag) => {
  tag.id
  tag.title
})
```

In the select you can also apply aggregation queries such as `count`, `min`, `max`, `sum`, `avg`:

```ts
type Result = Pick<Post, 'id'> & {
  // tags number is for the count
  tags: number
}

const result: Result = await db.post.select(
  'id',
  db.post.tags.count()
).takeOrThrow()
```

Value of `count` and other aggregations will be returned under the name of relation, but you can use an alias to change it:

```ts
type Result = Pick<Post, 'id'> & {
  tagsCount: number
  tagsCommaSeparated: string | null // null if there is no books
}

const result: Result = await db.author.select(
  'id',
  db.post.tags.count().as('booksCount'),
  db.post.tags.stringAgg('name', ', ').as('tagsCommaSeparated'),
).takeOrThrow()
```

### hasAndBelongsToMany nested create

Insert post with tags all at once:

This will run three insert queries in a transaction. One insert for post, one for tags and one for join table.

```ts
const result: Pick<Post, 'id'> = await db.post.insert(
  {
    title: 'Post',
    tags: {
      create: [
        {
          name: 'Tag 1',
        },
        {
          name: 'Tag 2',
        },
      ]
    }
  },
  ['id']
)
```

Insert many posts with tags:

This will also run only three insert queries in a transaction.

```ts
const result: Pick<Post, 'id'>[] = await db.post.insert(
  [
    {
      title: 'Post 1',
      tags: {
        create: [
          {
            name: 'Tag 1',
          },
          {
            name: 'Tag 2',
          },
        ],
      },
    },
    {
      title: 'Post 2',
      tags: {
        create: [
          {
            name: 'Tag 3',
          },
          {
            name: 'Tag 4',
          },
        ],
      }
    },
  ],
  ['id']
)
```

### hasAndBelongsToMany connect in insert

Connect record to another record while inserting:

This will search one record per provided where condition, throw if any of them is not found, and insert join table entries to connect found records and inserted.

It is supported in insert multiple as well.

```ts
const result: Pick<Post, 'id'> = await db.post.insert(
  {
    title: 'Post',
    tags: {
      connect: [
        {
          name: 'Tag 1',
        },
        {
          name: 'Tag 2',
        },
      ]
    }
  },
  ['id']
)
```

### hasAndBelongsToMany connectOrCreate

Specify `connectOrCreate` object with `where` and `connect` properties to first look for record to connect with and then create it in case if not found.

Also supported when inserting multiple records.

```ts
const result: Pick<Post, 'id'> = await db.post.insert(
  {
    title: 'Post',
    tags: {
      connectOrCreate: [
        {
          where: { name: 'Tag 1' },
          create: { name: 'Tag 1' },
        },
        {
          where: { name: 'Tag 2' },
          create: { name: 'Tag 2' },
        },
      ]
    }
  },
  ['id']
)
```

### hasAndBelongsToMany disconnect

Disconnect related record with array of conditions in `update`:

This command will delete connecting rows from join table for related records found by conditions.

Each provided condition may match 0 or more related records, there is no check to find exactly one.

Following query delete join table rows between the post and matching tags:

```ts
await db.post.where({ title: 'post title' }).update({
  tags: {
    disconnect: [
      { id: 5 },
      { name: 'some tag' }
    ],
  },
})
```
