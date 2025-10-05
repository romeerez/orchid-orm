---
outline: deep
---

# Relation queries

## queryRelated

Use `queryRelated` to load related records for an already loaded record.

For `belongsTo` and `hasOne` the result may be undefined if `required: true` is not set in their configuration,
it's a default.

```ts
const book = await db.book.find(1);

// second argument requires `authorId` of a book
const author = await db.book.queryRelated('author', book);

// second argument requires id of an author
const books = await db.author.queryRelated('books', author);

// additional query methods may be applied:
const countBooks: number = await db.author
  .queryRelated('books', author)
  .count();

const authorHasBooks: boolean = await db.author
  .queryRelated('books', author)
  .exists();
```

## chain

Use `chain` to "switch" a query chain to its relation.

### chain in select

Note that `chain` is similar to `join`, but it has one important distinction:

- `chain` will always return unique records by their primary key.
- `join` may return duplicates, depending on the relation types.

Imagine having an order for several pizzas, every pizza can have multiple ingredients,
and we want to query ingredients needed for the order.

```ts
db.order.select({
  chainedIngredients: (q) =>
    q.pizzas.order('hasPineapples').chain('ingredients').limit(10),
  joinedIngredients: (q) =>
    q.pizzas
      .order('hasPineapples')
      .join('ingredients')
      .select('ingredients.*')
      .limit(10),
});
```

`chainedIngredients` does what is expected: takes 10 ingredients for pizzas ordered by pizza column.

But `joinedIngredients` can return duplicated ingredients in a case
when the same ingredient is used for more than one pizza.

`chain` relies on a table primary key to de-duplicate records, so the table must have a primary key.

You can use `chain` in conjunction with all other query methods such as `order`, `limit`, `offset`, `where`.

`order` and `where` support columns of all the tables referenced before.

```ts
db.order.select({
  chainedIngredients: (q) =>
    q.pizzas
      .chain('ingredients')
      .order(
        'pizzas.name', // column of pizza must be prefixed with the table name
        'name', // column of the current `ingredients` table doesn't have to be prefixed
      )
      .where({
        // same in `where`: current table's columns doesn't have to be prefixed,
        // other columns must be prefixed with the table namm
        'pizza.price': { gt: 100 },
        inStock: true,
      }),
});
```

When chaining only `belongsTo` or `hasOne` relations, it will result in a single record.
When chaining `hasMany` or `hasAndBelongsToMany` with `belongsTo` or `hasOne`, it will load an array of records.

```ts
// a pizza has many orders, an order has a single customer.
db.pizza.select({
  // querying pizza customers will return an array.
  customers: (q) => q.orders.chain('customer'),
});

// an order has a single customer, a customer has a single delivery address.
db.order.select({
  // returns a single object.
  // using `order`, `limit`, `offset` makes no sense here as this is querying only a single record.
  deliveryAddress: (q) => q.customer.chain('deliveryAddress'),
});
```

If `order` is applied both before and after the `chain`, it's written to SQL in the same order as it was applied.

```ts
db.table.select({
  x: (q) => q.one.order('a').chain('two').order('one.b', 'c'),
});
```

```sql
ORDER BY "one"."a", "one"."b", "two"."c"
```

### chain out of select

When using `chain` out of `select` it is similar to `whereExists` but the other way around.

"find a book where certain authors exist"
is equivalent to "find certain authors, and let's chain (switch to) their books."

```ts
// load an author by a book id:
const author = await db.book.find(1).chain('author');

// load awards for an author by book id, in a single query:
const authorAwards = await db.book.find(1).chain('author').chain('awards');

// find many books and load their authors:
const manyAuthors = await db.book
  .where({ id: { in: [1, 2, 3] } })
  .chain('author');

// filter both books and the authors and load authors in one query:
const filteredAuthors = await db.book
  .where({ booksCondition: '...' })
  .chain('author')
  .where({ authorCondition: '...' });

// find the author and load their books:
const booksFromOneAuthor = await db.author.find(1).chain('books');

// find many authors and load their books:
const booksFromManyAuthors = await db.author
  .where({ id: { in: [1, 2, 3] } })
  .chain('books');

// imagine a book has many reviews,
// load book reviews for an author, in a one query:
const bookReviews = await db.author
  .findBy({ name: '...' })
  .chain('books')
  .chain('reviews');

// filter both authors and books and load books in one query:
const filteredBooks = await db.author
  .where({ authorCondition: '...' })
  .chain('books')
  .where({ booksCondition: '...' });
```

## whereExist

Any relation can be used in [whereExists](/guide/where.html#whereexists):

```ts
// load books which have author
await db.book.whereExists('author');

// load authors which have books
await db.authors.whereExists('book');

// additional query methods can be applied in a callback:
await db.book.whereExists('author', (q) =>
  q.where({ 'author.name': 'Uladzimir Karatkievich' }),
);
```

## join

Any relation can be used in [join](/guide/join.html#join-1).

Not recommended for `hasMany` and `hasAndBelongsToMany` relations,
because joining multiple records lead to duplicating the main table values.

```ts
await db.book.join('author').select(
  // column without a table is for the current book table
  'title',
  // select the column of a joined table
  'author.name',
);

// author name will be repeated for every book title:
await db.author.join('books').select('name', 'books.title');

// additional query methods can be applied in a callback:
await db.book
  .join('author', (q) => q.where({ 'author.name': 'Ayzek Asimov' }))
  .select('title', 'author.name');
```

## select

Any relation can be loaded with a callback in `select`, related records will be added to each record.

`belongsTo` and `hasOne` will add an object (can be `null` if not found, the type is configured by `required` option in the relation config).

`hasMany` and `hasAndBelongsToMany` will add an array of objects.

For `hasMany` and `hasAndBelongsToMany` this works better than `join` because it won't lead to data duplication.

Inside the callback, you can set `select`, `where`, `order`, `limit`, and other methods for the relation.

```ts
// type will be inferred, this is for demonstration.
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

Use `exists()` to load a boolean to know whether the related record exists.

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

### inner-joined relation

As described in [join: select relation](/guide/join#select-relation),
you can set empty `join` on the relation
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

Relation selects can be deeply nested and load records from the same table multiple times, without name collisions.

For example, posts have and belong to many tags.
For some reason, we want to select posts, their tags, the posts of the tags, and the tags of those posts.

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
this is resolved internally and is completely hidden.

You can add `where` conditions for the relation _after_ selecting it,
this is only available for `belongsTo` and `hasOne` relation.

Because `hasMany` and `hasAndBelongsToMany` relations are loaded as a JSON array,
they cannot accept `where` conditions after being selected.

In the following example, the inner author table is internally aliased as `author2`,
and the condition `author.name` is automatically replaced with `author2.name`.

```ts
await db.author.select('*', {
  books: (q) =>
    q.books
      .select({
        // internally selected as author2
        author: (q) => q.author,
      })
      // refers to author2, not the top-level author
      .where({ 'author.name': 'Jack London' }),
});
```

## create update delete

`Orchid ORM` makes it straightforward to do modifications of related records,
it allows building a query chain to modify related records,
it supports nested creates and updates.

For `belongsTo` and `hasOne` you can do only one thing per each relation.
For instance, create an author while creating a book, or connect the book to the author while creating it.
But not create and connect at the same time.

For `hasMany` and `hasAndBelongsToMany` you can combine multiple commands for a single relation:
while updating the author, you can create new books, connect some books, and delete books by conditions.

### create

#### create in a chain

It is possible to chain querying of the table with the creating of its relation, in a such way:

```ts
await db.author.find(id).chain('books').create({
  title: 'Book title',
});

// post hasAndBelongsToMany tags
await db.post.find(id).chain('tags').create({
  name: 'tag name',
});

// createMany is supported as well
await db.post
  .find(id)
  .chain('tags')
  .create([
    {
      name: 'first tag',
    },
    {
      name: 'second tag',
    },
  ]);
```

This is possible for `hasOne`, `hasMany`, and `hasAndBelongsToMany`, but this is disabled for `belongsTo` and `hasOne`/`hasMany` with the `through` option.

This is only allowed to perform creation based on a query that returns one record,
so you have to use methods `find`, `findBy`, `take`, or similar.

Because the `create` method is designed to return a full record by default,
in the case when a record is not found by the condition it will throw `NotFoundError`, even when using `findOptional`:

```ts
// will throw if no post with such a title
await db.post
  .findBy({ title: 'non-existing' })
  .chain('tags')
  .create({ name: 'tag name' });

// will throw either
const tag = await db.post
  .findByOptional({ title: 'non-existing' })
  .chain('tags')
  .create({ name: 'tag name' });

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
  .chain('books')
  .takeOptional()
  .create({ name: 'Book title' });

const createdCount = await db.author
  .findByOptional({ name: 'Author name' })
  .chain('books')
  .count()
  .create({ name: 'Book title' });

// hasAndBelongsToMany will throw when not found anyway:
await db.post
  .findByOptional({ title: 'Post title' })
  .chain('tags')
  .takeOptional()
  .create({ name: 'tag name' });
```

#### nested create

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

#### create from update

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

### update

#### nested update

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

### upsert: update or insert

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

### delete

#### delete in a chain

Delete related records from a relation query chain.

This is supported for all kinds of relations only except `belongsTo`.

```ts
// delete all books of the author
await db.author.find(1).books.all().delete();

// delete specific books of specific authors
await db.author
  .where({ name: 'author name' })
  .chain('books')
  .where({ title: 'book title' })
  .delete();

// TypeScript will highlight the `delete` method
// because deleting a `belongsTo` relation is not allowed
await db.book.find(1).chain('author').delete();
```

### delete in update

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

## connect and disconnect

Any relation supports `connect` and `connectOrCreate` to connect related records when creating,
and varying interfaces when updating.

### when creating

#### connect

For any kind of relation, `connect` searches for records by given conditions and connects them.
Throws `NotFoundError` if no record found.

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

#### connectOrCreate

The `connectOrCreate` option searches for a record by given conditions,
creates a new record if not found.

`belongsTo` and `hasOne` are accepting a single `{ where: ..., create ... }`:

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

`hasMany` and `hasAndBelongsToMany` are accepting an array of `{ where: ..., create ... }`:

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

### when updating

#### set

`set` disconnects existing related records and connects new ones.

For `hasOne` and `hasMany` it is available only when updating one record,
the query must have `find`, `findBy`, or `take` before the update.

`hasOne` and `hasMany` disconnect existing records by nullifying their referencing columns, so the column has to be nullable.

`hasAndBelongsToMany` deletes existing joining records and creates new ones.

All relations kinds support `set` when updating a single record,
only `belongsTo` and `hasAndBelongsToMany` support `set` in a batch update.

`belongsTo` and `hasOne` expect a single objects for searching,
`hasMany` and `hasAndBelongsToMany` expect a single object or an array.

Setting an empty array to `hasMany` or `hasAndBelongsToMany` relation will disconnect all records.

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

#### add

Use `add` to connect more records in `hasMany` and `hasAndBelongsToMany`, without disconnecting already connected ones.

For `hasMany` it is only available when updating a single record,
in `hasAndBelongsToMany` it works for batch updates as well.

```ts
await db.author.find(1).update({
  books: {
    add: { id: 1 },
    // or an array:
    add: [{ id: 1 }, { id: 2 }],
  },
});
```

In the following example, two tags are added to all posts having a certain title.

- if multiple tags are found by the same condition (2 tags by name 'javascript'), all of them will be connected.
- if less than array length (2 in the example) tags are found, an error shall be thrown.

```ts
await db.post.where({ title: { contains: 'node.js' } }).update({
  tags: {
    add: [{ name: 'javascript' }, { name: 'programming' }],
  },
});
```

#### disconnect related records

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
