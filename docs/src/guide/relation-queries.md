# Relation queries

Here is how to load related records by using a record object (supported by all kinds of relations):

The resulting record of the `belongsTo` and `hasOne` relation can be undefined if the `required` option was not set in the table class.

```ts
const book = await db.book.find(1);

// type of `db.book.author` argument is { authorId: number }
const author = await db.book.author(book);

// type of `db.author.books` argument is { id: number }
const books = await db.author.books(author);

// additional query methods can be applied:
const partialAuthor = await db.book.author(book).select('id', 'name');

const countBooks: number = await db.author
  .books(author)
  .where({ title: 'Kobzar' })
  .count();

const authorHasBooks: boolean = await db.author.books(author).exists();
```

It's possible to chain relations query without providing a loaded record (supported by all kinds of relations).

Each chained relation can have own `where` conditions and all query methods are applicable here.
No limits on chaining.

```ts
// load author by book id, in a one query:
const author = await db.book.find(1).author;

// imagine an author has many awards,
// load awards for an author by book id, in a one query:
const authorAwards = await db.book.find(1).author.awards;

// find many books and load their authors:
const manyAuthors = await db.book.where({ id: { in: [1, 2, 3] } }).author;

// filter both books and the authors and load authors in one query:
const filteredAuthors = await db.book
  .where({ booksCondition: '...' })
  .author.where({ authorCondition: '...' });

// find the author and load their books:
const booksFromOneAuthor = await db.author.find(1).books;

// find many authors and load their books:
const booksFromManyAuthors = await db.author.where({ id: { in: [1, 2, 3] } })
  .books;

// imagine a book has many reviews,
// load book reviews for an author, in a one query:
const bookReviews = await db.author.findBy({ name: '...' }).books.reviews;

// filter both authors and books and load books in one query:
const filteredBooks = await db.author
  .where({ authorCondition: '...' })
  .books.where({ booksCondition: '...' });
```

The relation can be used in `.whereExists` (supported by all kinds of relations):

```ts
// load books which have author
await db.book.whereExists('author');

// load authors which have books
await db.authors.whereExists('book');

// additional query methods can be applied in a callback:
await db.book.whereExists('author', (q) =>
  q.where({ 'author.name': 'Uladzimir' }),
);
```

The relation can be used in `.join`.

Supported by all kinds of relations, but it is not suggested for `hasMany` and `hasAndBelongsToMany` because data will be duplicated.

```ts
await db.book.join('author').select(
  // column without a table is for the current book table
  'title',
  // select the column of a joined table
  'author.name',
);

// author name will be repeated for each book title:
await db.author.join('books').select('name', 'books.title');

// additional query methods can be applied in a callback:
await db.book
  .join('author', (q) => q.where({ 'author.name': 'Olexiy' }))
  .select('title', 'author.name');
```

The relation can be loaded by placing a callback in `.select`, related records will be added to each record.

`belongsTo` and `hasOne` will add an object (can be `null` if not found).

`hasMany` and `hasAndBelongsToMany` will add an array of objects.

For `hasMany` and `hasAndBelongsToMany` this works better than `join` because it won't lead to duplicative data.

Inside the callback, you can set `select`, `where`, `order`, `limit`, and other methods for the relation.

```ts
// type will be inferred, it is here for demonstration.
type BookResult = {
  id: number;
  title: string;
  author: {
    id: number;
    name: number;
  };
};

const bookWithAuthor: BookResult = await db.book
  .select('id', 'title', {
    author: (q) => q.author.select('id', 'name'),
  })
  .take();

type AuthorResult = {
  id: number;
  name: string;
  books: {
    id: number;
    title: string[];
  };
};

const authorWithBooks: AuthorResult = await db.author
  .select('id', 'name', {
    books: (q) =>
      q.books
        .select('id', 'title')
        .where(...conditions)
        .order('title')
        .limit(5),
  })
  .take();
```

You can chain relations inside `select` callback with no limits:

```ts
type BookResult = {
  id: number;
  title: string;
  author: {
    id: number;
    name: string;
    awards: {
      name: string;
      year: string;
    }[];
  };
};

const result: BookResult = await db.book
  .select('id', 'title', {
    author: (q) =>
      q.author.select('id', 'name', {
        awards: (q) => q.awards.select('name', 'year'),
      }),
  })
  .take();
```

All relations are supporting `exists` in select (get a boolean to know whether related records exist or not):

```ts
type Result = {
  id: number;
  hasTags: boolean;
  hasSpecificTag: boolean;
};

const result: Result = await db.post.select('id', {
  hasTags: (q) => q.tags.exists(),
  hasSpecificTag: (q) => q.tags.where({ name: 'specific' }).exists(),
});
```

For `hasMany` and `hasAndBelongsToMany` the select can handle aggregation queries such as `count`, `min`, `max`, `sum`, and `avg`.
You can use the aggregated selected values in `where` and in `order`.

```ts
type Result = {
  id: number;
  tagsCount: number;
  tagsCommaSeparated: string;
};

const result: Result = await db.post
  .select('id', {
    tagsCount: (q) => q.tags.count(),
    tagsCommaSeparated: (q) => q.tags.stringAgg('name', ', '),
  })
  .where({ tagsCount: { gt: 5 } })
  .order({ tagsCount: 'DESC' })
  .take();
```

### select relation with a strict join

As described in [join: select relation](/guide/join.html#select-relation),
you can set empty `.join` on the relation
if you want to filter out main table records that don't have a matching relation:

```ts
// load only those authors who have at least one book that is published after 2000
const author = await db.author
  .select({
    books: (q) => q.books.join().where({ yearPublished: { gte: 2000 } }),
  })
  .take();

// `join()` guarantees that the `author.books` can not be empty
assert(author.books.length > 0);
```

### selecting the same table

It's possible to make such a nested select where the same table is being referenced twice on different levels.
For example, posts has and belongs to many tags. For some reason, we want to select posts, their tags, the posts of the tags, and the tags of those posts.

```ts
// select posts
await db.post.select('*', {
  tags: (q) =>
    // select tags
    q.tags.select('*', {
      posts: (q) =>
        // select posts of the tags
        q.posts.select('*', {
          // select tags of the deeper posts
          tags: (q) => q.tags,
        }),
    }),
});
```

Internally, the deeper tags are joined as `tags2`, and the deeper posts are joined as `posts2` to avoid naming collisions,
but this is resolved internally, and you don't have to worry about it.

You can add `where` conditions for the selected relation after selecting it,
but this is only available for `belongsTo` and `hasOne` relation.

Because in `hasMany` and `hasAndBelongsToMany` relation is loaded as a JSON array, it can't accept conditions after being selected.

In the following example, inner author table internally is aliased as `author2`, and the condition `author.name` is automatically replaced with `author2.name`.

```ts
await db.author.select('*', {
  books: (q) =>
    q.books
      .select({
        author: (q) => q.author,
      })
      .where({ 'author.name': 'Jack London' }),
});
```

## create update delete

`Orchid ORM` makes it very easy to do modifications of related records,
it allows building a query chain to modify related records,
it supports nested creates and updates.

For `belongsTo` and `hasOne` you can do only one thing per each relation.
For instance, create an author while creating a book, or connect the book to the author while creating it.
But not create and connect at the same time.

For `hasMany` and `hasAndBelongsToMany` you can combine multiple commands for a single relation:
while updating the author you can create new books, connect some books, and delete books by conditions.

## create from relation query

It is possible to chain querying of the table with the creating of its relation, in a such way:

```ts
await db.author.find(1).books.create({
  title: 'Book title',
});

// post hasAndBelongsToMany tags
await db.post.find(1).tags.create({
  name: 'tag name',
});
```

This is possible for `hasOne`, `hasMany`, and `hasAndBelongsToMany`, but this is disabled for `belongsTo` and `hasOne`/`hasMany` with the `through` option.

This is only allowed to perform create based on a query that returns one record, so you have to use methods `find`, `findBy`, `take`, or similar.

`db.post.tags.create` or `db.post.where(...).tags.create` won't work because multiple posts are returned in these queries.

Using `createMany` or `createRaw` in such chained queries is not implemented yet, but it's in the plans.

Because the `create` method is designed to return a full record by default,
in the case when a record is not found by the condition it will throw `NotFoundError`, even when using `findOptional`:

```ts
// will throw if no post with such a title
await db.post
  .findBy({ title: 'non-existing' })
  .tags.create({ name: 'tag name' });

// will throw either
const tag = await db.post
  .findByOptional({ title: 'non-existing' })
  .tags.create({ name: 'tag name' });

// we can be sure that the tag is always returned
tag.name;
```

If you want `undefined` to be returned instead of throwing `NotFoundError`,
use `takeOptional()` to get `RecordType | undefined`, or `count()` to get 0 for not found and 1 for a created.

`hasAndBelowToMany` relation will throw `NotFoundError` either way,
to make sure we're not creating hanging records not connected to other records.

```ts
const tagOrUndefined = await db.author
  .findByOptional({ name: 'Author name' })
  .books.takeOptional()
  .create({ name: 'Book title' });

const createdCount = await db.author
  .findByOptional({ name: 'Author name' })
  .books.count()
  .create({ name: 'Book title' });

// hasAndBelongsToMany will throw when not found anyway:
await db.post
  .findByOptional({ title: 'Post title' })
  .tags.takeOptional()
  .create({ name: 'tag name' });
```

## delete from relation query

Delete related records from a relation query chain.

This is supported for all kinds of relations only except `belongsTo`.

```ts
// delete all books of the author
await db.author.find(1).books.all().delete();

// delete specific books of specific authors
await db.author
  .where({ name: 'author name' })
  .books.where({ title: 'book title' })
  .delete();

// TypeScript will highlight the `delete` method
// because deleting a `belongsTo` relation is not allowed
await db.book.find(1).author.delete();
```

## nested create

Create a record with related records all at once:

This will run two insert queries in a transaction, (three insert queries in the case of `hasAndBelongsToMany`).

For relations with the `through` option need to nest `creates` explicitly.

If a post table has many tags through "postTags", needs to create a post, inside it create postTags, and inside it create tags.

But if you do the same relation with `hasAndBelongsToMany`, you can create tags directly from post creation,
and the postTag record in between will be created automatically.

```ts
const book = await db.book.create({
  title: 'Book title',
  author: {
    create: {
      name: 'Author',
    },
  },
});

const author = await db.author.create({
  name: 'Author',
  books: {
    create: [{ title: 'Book 1' }, { title: 'Book 2' }, { title: 'Book 3' }],
  },
});

// post hasMany tags through postTags
// we cannot create tags directly
const post = await db.post.create({
  title: 'Post title',
  postTags: {
    create: [
      {
        tag: {
          create: {
            name: 'tag name',
          },
        },
      },
    ],
  },
});
```

Nested create is supported when creating many as well:

```ts
const books = await db.book.createMany([
  {
    title: 'Book 1',
    author: {
      create: {
        name: 'Author 1',
      },
    },
  },
  {
    title: 'Book 2',
    author: {
      create: {
        name: 'Author 2',
      },
    },
  },
]);
```

## create from update

Create related records when doing an update:

For `belongsTo`, `hasOne`, and `hasMany` it is available when updating one record, there must be `find`, `findBy`, or `take` before the update.

For `hasAndBelongsToMany` this will connect all found records for the update with all created records.

The `hasOne` relation will nullify the `foreignKey` of the previous related record if exists, so it has to be nullable.

```ts
await db.book.find(1).update({
  title: 'update book title',
  author: {
    create: {
      name: 'new author',
    },
  },
});

await db.author.find(1).update({
  name: 'update author name',
  books: {
    create: [{ title: 'new book 1' }, { title: 'new book 2' }],
  },
});

// this will connect all 3 posts with 2 tags
await db.post.where({ id: { in: [1, 2, 3] } }).update({
  tags: {
    create: [{ name: 'new tag 1' }, { name: 'new tag 2' }],
  },
});
```

For `belongsTo` when updating multiple records, the `create` option will connect the new record with all updating records:

```ts
await db.book.where({ id: { in: [1, 2, 3] } }).update({
  title: 'update book title',
  author: {
    // all books will be connected with this author:
    create: {
      name: 'new author',
    },
  },
});
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
    },
  },
});

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
    ],
  },
});
```

## connect or create

The `connectOrCreate` option will try to find a record to connect with, and it will create the record if not found.

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
      },
    },
  },
});
```

`hasMany` and `hasAndBelongsToMany` relations are accepting an array of `{ where: ..., create ... }`:

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
    ],
  },
});
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
});
```

`hasMany` and `hasAndBelongsToMany` relations are accepting filter conditions.

```ts
await db.post.where({ title: 'post title' }).update({
  tags: {
    disconnect: {
      name: 'some tag',
    },
  },
});
```

It may be an array of conditions:

Each provided condition may match 0 or more related records, there is no check to find exactly one.

```ts
await db.post.where({ title: 'post title' }).update({
  tags: {
    disconnect: [{ id: 1 }, { id: 2 }],
  },
});
```

## set related records

Set related records when updating.

For `hasOne` and `hasMany` it is available only when updating one record, so the query should have `find`, `findBy`, or `take` before the update.

For `hasOne` and `hasMany`, if there was a related record before the update, its `foreignKey` column will be updated to `NULL`, so it has to be nullable.

For `hasAndBelongsToMany` relation this will delete all previous rows of the join table and create new ones.
When empty array or empty object is given, this is going to delete all relevant join table rows, without creating new ones.

```ts
const author = await db.author.find(1);

// this will update the book with the author's id from the given object
await db.book.find(1).update({
  author: {
    set: author,
  },
});

// this will find the first author with given conditions to use their id
await db.book.find(2).update({
  author: {
    set: { name: 'author name' },
  },
});

// TypeScript error because of the need to use `findBy` instead of `where`:
await db.author.where({ id: 1 }).update({
  books: {
    set: { id: 1 },
  },
});

await db.author.find(1).update({
  books: {
    // all found books with such titles will be connected to the author
    set: { title: 'book title' },
  },
});

await db.author.find(1).update({
  books: {
    // array of conditions can be provided:
    set: [{ id: 1 }, { id: 2 }],
  },
});

// for `hasMany` this will nullify all relevant books `authorId`s,
// for `hasAndBelongsToMany` this will delete all relevant join table records.
await db.author.find(1).update({
  books: {
    set: [],
  },
});
```

## delete related records

Deletes related records.

For the `belongsTo` relation it will update `foreignKey` to `NULL` before deleting.

`hasMany` and `hasAndBelongsToMany` are accepting the same conditions as the `.where` method to delete only matching records, as an object or as an array of objects.

Empty `{}` or `[]` will delete all related records.

```ts
await db.book.find(1).update({
  author: {
    delete: true,
  },
});

await db.author.find(1).update({
  account: {
    // delete author book by conditions
    delete: { title: 'book title' },
  },
});

await db.author.find(1).update({
  account: {
    // array of conditions:
    delete: [{ id: 1 }, { id: 2 }],
  },
});
```

## nested update

Update related records.

`belongsTo` and `hasOne` accept objects with data for the update.

`hasMany` and `hasAndBelongsToMany` accepts `where` conditions and `data` objects. `where` can be an object or an array of objects.

```ts
await db.book.find(1).update({
  author: {
    update: {
      name: 'new name',
    },
  },
});

await db.author.find(1).update({
  books: {
    update: {
      where: {
        title: 'old book title',
      },
      data: {
        title: 'new book title',
      },
    },
  },
});
```

When updating multiple records, all their related records will be updated:

```ts
await db.book.where({ id: { in: [1, 2, 3] } }).update({
  author: {
    update: {
      name: 'new name',
    },
  },
});

await db.author.where({ id: [1, 2, 3] }).update({
  books: {
    update: {
      where: {
        title: 'old book title',
      },
      data: {
        title: 'new book title',
      },
    },
  },
});
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
        email: 'some@email.com',
      },
    },
  },
});
```

`create` data may return from a callback, it will be called only if related record wasn't found for update:

```ts
await db.book.find(1).update({
  author: {
    upsert: {
      update: {
        name: 'new name',
      },
      create: () => ({
        name: 'new name',
        email: 'some@email.com',
      }),
    },
  },
});
```
