# relation queries

Load related records by using record object (supported by all kinds of relations).

Resulting record of `belongsTo` and `hasOne` relation can be undefined if `required` option was not set.

```ts
const book = await db.book.find(1)

// type of argument is { authorId: number }
const author = await db.book.author(book)

// type of argument is { id: number }
const books = await db.author.books(author)

// additional query methods can be applied:
const partialAuthor = await db.book.author(book).select('id', 'name')

const countBooks: number = await db.author.books(author)
  .where({ title: 'Kobzar' }).count()

const authorHasBooks: boolean = await db.author.books(author).exists()
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

To load specific fields or to apply `where`, `order`, `limit` and other methods,
relation can be selected by adding a callback to the select list:

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
  {
    author: (q) => q.author.select('id', 'name'),
  },
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
  {
    books: (q) => q.books
      .select('id', 'title')
      .where(...conditions)
      .order('title')
      .limit(5),
  }
).take()
```

All relations are supporting `exists` in select (get a boolean to know whether related records exist or not):

```ts
type Result = {
  id: number
  hasTags: boolean
  hasSpecificTag: boolean
}

const result: Result = await db.post.select(
  'id',
  {
    hasTags: (q) => q.tags.exists(),
    hasSpecificTag: (q) => q.tags.where({ name: 'specific' }).exists(),
  }
)
```

For `hasMany` and `hasAndBelongsToMany` the select can handle aggregation queries such as `count`, `min`, `max`, `sum`, `avg`:

```ts
type Result = {
  id: number
  tagsCount: number
  tagsCommaSeparated: string
}

const result: Result = await db.post.select(
  'id',
  {
    tagsCount: (q) => q.tags.count(),
    tagsCommaSeparated: (q) => q.tags.stringAgg('name', ', '),
  }
).take()
```

## create, update, delete related records

At this part `Porm` is inspired by `Prisma` which makes it very easy to do modifications of related records.

For `belongsTo` and `hasOne` you can do only one thing per each relation.
For instance, create author while creating a book, or connect book to the author while creating it.
But not create and connect at the same time.

For `hasMany` and `hasAndBelongsToMany` you can combine multiple commands for a single relations:
while updating the author you can create new books, connect some books, delete books by conditions.

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

Nested create is supported when creating many as well:

```ts
const books = await db.book.createMany([
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

## create related records from update

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

Supported when creating multiple records as well.

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

`connectOrCreate` options will try to find a record to connect with, and it will create the record if not found.

This is also supported when creating multiple records.

`belongsTo` and `hasOne` relations are accepting object `{ where: ..., create ... }`:

```ts
const result = await db.book.create({
  title: 'Book title',
  author: {
    connectOrCreate: {
      where: {
        name: 'Author',
      },
      create: {
        name: 'Author',
      }
    }
  }
})
```

`hasMany` and `hasAndBelongsToMany` relations are accepting array of `{ where: ..., create ... }`:

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

Also supported when creating multiple records.

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

Supported when updating multiple records for `belongsTo`.

```ts
await db.book.find(1).update({
  author: {
    upsert: {
      update: {
        name: 'new name',
      },
      create: {
        name: 'new name',
        email: 'some@email.com'
      }
    },
  }
})
```
