# Join

## Select relation

[//]: # 'has JSDoc'

Before joining a table, consider if selecting a relation is enough for your case:

```ts
// select users with profiles
// result type is Array<{ name: string, profile: Profile }>
await db.user.select('name', {
  profile: (q) => q.profile,
});

// select posts with counts of comments, filter and order by comments count
// result type is Array<Post & { commentsCount: number }>
await db.post
  .select('*', {
    commentsCount: (q) => q.comments.count(),
  })
  .where({ commentsCount: { gt: 10 } })
  .order({ commentsCount: 'DESC' });

// select authors with array of their book titles
// result type is Array<Author & { books: string[] }>
await db.author.select('*', {
  books: (q) => q.books.pluck('title'),
});
```

Internally, such selects will use `LEFT JOIN LATERAL` to join a relation.
If you're loading users with profiles (one-to-one relation), and some users don't have a profile, `profile` property will have `NULL` for such users.
If you want to load only users that have profiles, and filter out the rest, add `.join()` method to the relation without arguments:

```ts
// load only users who have a profile
await db.user.select('*', {
  profile: (q) => q.profile.join(),
});

// load only users who have a specific profile
await db.user.select('*', {
  profile: (q) => q.profile.join().where({ age: { gt: 20 } }),
});
```

You can also use this `.join()` method on the one-to-many relations, and records with empty array will be filtered out:

```ts
// posts that have no tags won't be loaded
// result type is Array<Post & { tags: Tag[] }>
db.post.select('*', {
  tags: (q) => q.tags.join(),
});
```

# Joins

[//]: # 'has JSDoc'

`join` methods allows to join other tables, relations by name, [with](/guide/advanced-queries#with) statements, sub queries.

All the `join` methods accept the same arguments, but returning type is different because with `join` it's guaranteed to load joined table, and with `leftJoin` the joined table columns may be `NULL` when no matching record was found.

For the following examples, imagine we have a `User` table with `id` and `name`, and `Message` table with `id`, `text`, messages belongs to user via `userId` column:

```ts
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
  }));

  relations = {
    messages: this.hasMany(() => MessageTable, {
      columns: ['id'],
      references: ['userId'],
    }),
  };
}

export class MessageTable extends BaseTable {
  readonly table = 'message';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer(),
    text: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      columns: ['userId'],
      references: ['id'],
    }),
  };
}
```

## join

[//]: # 'has JSDoc'

`join` is a method for SQL `JOIN`, which is equivalent to `INNER JOIN`, `LEFT INNERT JOIN`.

When no matching record is found, it will skip records of the main table.

When joining the same table with the same condition more than once, duplicated joins will be ignored:

```ts
// joining a relation
db.post.join('comments').join('comments');

// joining a table with a condition
db.post
  .join('comments', 'comments.postId', 'post.id')
  .join('comments', 'comments.postId', 'post.id');
```

Both queries will produce SQL with only 1 join

```sql
SELECT * FROM post JOIN comments ON comments.postId = post.id
```

However, this is only possible if the join has no dynamic values:

```ts
db.post
  .join('comments', (q) => q.where({ rating: { gt: 5 } }))
  .join('comments', (q) => q.where({ rating: { gt: 5 } }));
```

Both joins above have the same `{ gt: 5 }`, but still, the `5` is a dynamic value and in this case joins will be duplicated,
resulting in a database error.

### join relation

[//]: # 'has JSDoc'

When relations are defined between the tables, you can join them by a relation name.
Joined table can be references from `where` and `select` by a relation name.

```ts
const result = await db.user
  .join('messages')
  // after joining a table, we can use it in `where` conditions:
  .where({ 'messages.text': { startsWith: 'Hi' } })
  .select(
    'name', // name is User column, table name may be omitted
    'messages.text', // text is the Message column, and the table name is required
  );

// result has the following type:
const ok: { name: string; text: string }[] = result;
```

The first argument can also be a callback, where instead of relation name as a string we're picking it as a property of `q`.
In such a way, we can alias the relation with `as`, add `where` conditions, use other query methods.

```ts
const result = await db.user.join((q) =>
  q.messages.as('m').where({ text: 'some text' }),
);
```

Optionally, you can pass a second callback argument, it makes `on` and `orOn` methods available.

But remember that when joining a relation, the relevant `ON` conditions are already handled automatically.

```ts
const result = await db.user.join(
  (q) => q.messages.as('m'),
  (q) =>
    q
      .on('text', 'name') // additionally, match message with user name
      .where({ text: 'some text' }), // you can add `where` in a second callback as well.
);
```

### Selecting full joined records

[//]: # 'has JSDoc'

`select` supports selecting a full record of a previously joined table by passing a table name with `.*` at the end:

```ts
const result = await db.book.join('author').select('title', {
  author: 'author.*',
});

// result has the following type:
const ok: {
  // title of the book
  title: string;
  // a full author record is included:
  author: { id: number; name: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

It works fine for `1:1` (`belongsTo`, `hasOne`) relations, but it may have an unexpected result for `1:M` or `M:M` (`hasMany`, `hasAndBelongsToMany`) relations.
For any kind of relation, it results in one main table record with data of exactly one joined table record, i.e. when selecting in this way, the records **won't** be collected into arrays.

```ts
const result = await db.user
  .join('messages')
  .where({ 'messages.text': { startsWith: 'Hi' } })
  .select('name', { messages: 'messages.*' });

// result has the following type:
const ok: {
  name: string;
  // full message is included:
  messages: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

Because it's a one-to-many relation, one user has many messages, the user data will be duplicated for different messages data:

| name   | msg                            |
| ------ | ------------------------------ |
| user 1 | `{ id: 1, text: 'message 1' }` |
| user 1 | `{ id: 2, text: 'message 2' }` |
| user 1 | `{ id: 3, text: 'message 3' }` |

### join table

[//]: # 'has JSDoc'

If relation wasn't defined, provide a `db.table` instance and specify columns for the join.
Joined table can be references from `where` and `select` by a table name.

```ts
// Join message where userId = id:
db.user
  .join(db.message, 'userId', 'id')
  .where({ 'message.text': { startsWith: 'Hi' } })
  .select('name', 'message.text');
```

Columns in the join list may be prefixed with table names for clarity:

```ts
db.user.join(db.message, 'message.userId', 'user.id');
```

Joined table can have an alias for referencing it further:

```ts
db.user
  .join(db.message.as('m'), 'message.userId', 'user.id')
  .where({ 'm.text': { startsWith: 'Hi' } })
  .select('name', 'm.text');
```

Joined table can be selected as an object as well as the relation join above:

```ts
const result = await db.user
  .join(db.message.as('m'), 'message.userId', 'user.id')
  .where({ 'm.text': { startsWith: 'Hi' } })
  .select('name', { msg: 'm.*' });

// result has the following type:
const ok: {
  name: string;
  // full message is included as msg:
  msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

You can provide a custom comparison operator

```ts
db.user.join(db.message, 'userId', '!=', 'id');
```

Join can accept raw SQL for the `ON` part of join:

```ts
db.user.join(
  db.message,
  // `sql` can be imported from your `BaseTable` file
  sql`lower("message"."text") = lower("user"."name")`,
);
```

Join can accept raw SQL instead of columns:

```ts
db.user.join(
  db.message,
  sql`lower("message"."text")`,
  sql`lower("user"."name")`,
);

// with operator:
db.user.join(
  db.message,
  sql`lower("message"."text")`,
  '!=',
  sql`lower("user"."name")`,
);
```

To join based on multiple columns, you can provide an object where keys are joining table columns, and values are main table columns or a raw SQL:

```ts
db.user.join(db.message, {
  userId: 'id',

  // with table names:
  'message.userId': 'user.id',

  // value can be a raw SQL expression:
  text: sql`lower("user"."name")`,
});
```

Join all records without conditions by providing `true`:

```ts
db.user.join(db.message, true);
```

Join methods can accept a callback with a special query builder that has `on` and `orOn` methods for handling advanced cases:

```ts
db.user.join(
  db.message,
  (q) =>
    q
      // left column is the db.message column, right column is the db.user column
      .on('userId', 'id')
      // table names can be provided:
      .on('message.userId', 'user.id')
      // operator can be specified:
      .on('userId', '!=', 'id')
      // operator can be specified with table names as well:
      .on('message.userId', '!=', 'user.id')
      // `.orOn` takes the same arguments as `.on` and acts like `.or`:
      .on('userId', 'id') // where message.userId = user.id
      .orOn('text', 'name'), // or message.text = user.name
);
```

Column names in the where conditions are applied for the joined table, but you can specify a table name to add a condition for the main table.

```ts
db.user.join(db.message, (q) =>
  q
    .on('userId', 'id')
    .where({
      // not prefixed column name is for joined table:
      text: { startsWith: 'hello' },
      // specify a table name to set condition on the main table:
      'user.name': 'Bob',
    })
    // id is a column of a joined table Message
    .whereIn('id', [1, 2, 3])
    // condition for id of a user
    .whereIn('user.id', [4, 5, 6]),
);
```

The query above will generate the following SQL (simplified):

```sql
SELECT * FROM "user"
JOIN "message"
  ON "message"."userId" = "user"."id"
 AND "message"."text" ILIKE 'hello%'
 AND "user"."name" = 'Bob'
 AND "message"."id" IN (1, 2, 3)
 AND "user"."id" IN (4, 5, 6)
```

The join argument can be a query with `select`, `where`, and other methods. In such a case, it will be handled as a sub query:

```ts
db.user.join(
  db.message
    .select('id', 'userId', 'text')
    .where({ text: { startsWith: 'Hi' } })
    .as('t'),
  'userId',
  'id',
);
```

It will produce such SQL:

```sql
SELECT * FROM "user"
JOIN (
  SELECT "t"."id", "t"."userId", "t"."text"
  FROM "message" AS "t"
) "t" ON "t"."userId" = "user"."id"
```

## implicit join lateral

`JOIN`'s source expression that comes before `ON` cannot access other tables, but in some cases this may be needed.

For example, let's consider joining last 10 messages of a user:

```ts
await db.user.join('messages', (q) => q.order({ createdAt: 'DESC' }).limit(10));
```

When the `join`'s callback returns a more complex query than the one that simply applies certain conditions,
it will implicitly generate a `JOIN LATERAL` SQL query, as the following:

```sql
SELECT "user".*
FROM "user"
JOIN LATERAL (
  SELECT *
  FROM "message" AS "messages"
  WHERE "message"."userId" = "user"."id"
  ORDER BY "message"."createdAt" DESC
  LIMIT 10
) "messages" ON true
```

## joinLateral

[//]: # 'has JSDoc'

`joinLateral` allows joining a table with a sub-query that can reference the main table of current query and the other joined tables.

First argument is the other table you want to join, or a name of relation, or a name of `with` defined table.

Second argument is a callback where you can reference other tables using `on` and `orOn`, select columns, do `where` conditions, and use any other query methods to build a sub-query.

Note that the regular `join` will also generate `JOIN LATERAL` SQL expression when the query returned from callback is complex enough (see [implicit join lateral](/guide/join.html#implicit-join-lateral)).

```ts
// joinLateral a Message table, alias it as `m`
// without aliasing you can refer to the message by a table name
User.joinLateral(Message.as('m'), (q) =>
  q
    // select message columns
    .select('text')
    // join the message to the user, column names can be prefixed with table names
    .on('authorId', 'id')
    // message columns are available without prefixing,
    // outer table columns are available with a table name
    .where({ text: 'some text', 'user.name': 'name' })
    .order({ createdAt: 'DESC' }),
)
  // only selected message columns are available in select and where
  .select('id', 'name', 'm.text')
  .where({ 'm.text': messageData.text });
```

As well as simple `join`, `joinLateral` can select an object of full joined record:

```ts
// join by relation name
const result = await User.joinLateral(
  'messages',
  (q) => q.as('message'), // alias to 'message'
).select('name', { message: 'message.*' });

// result has the following type:
const ok: {
  name: string;
  // full message is included:
  message: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

`message` can be aliased withing the `select` as well as in case of a simple `join`:

```ts
// join by relation name
const result = await User.joinLateral(
  'messages',
  (q) => q.as('message'), // alias to 'message'
).select('name', { msg: 'message.*' });

// result has the following type:
const ok: {
  name: string;
  // full message is included as msg:
  msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

## leftJoin

[//]: # 'has JSDoc'

`leftJoin` is a method for SQL `LEFT JOIN`, which is equivalent to `OUTER JOIN`, `LEFT OUTER JOIN`.

When no matching record is found, it will fill joined table columns with `NULL` values in the result rows.

Works just like `join`, except for result type that may have `null`:

```ts
const result = await db.user
  .leftJoin('messages')
  .select('name', 'messages.text');

// the same query, but joining table explicitly
const result2: typeof result = await db.user
  .leftJoin(db.message, 'userId', 'id')
  .select('name', 'message.text');

// result has the following type:
const ok: { name: string; text: string | null }[] = result;
```

## leftJoinLateral

[//]: # 'has JSDoc'

The same as `joinLateral`, but when no records found for the join it will result in `null`:

```ts
const result = await db.user
  .leftJoinLateral('messages', (q) => q.as('message'))
  .select('name', 'message.text');

// result has the following type:
const ok: { name: string; text: string | null }[] = result;
```

## rightJoin

[//]: # 'has JSDoc'

`rightJoin` is a method for SQL `RIGHT JOIN`, which is equivalent to `RIGHT OUTER JOIN`.

Takes the same arguments as `json`.

It will load all records from the joining table, and fill the main table columns with `null` when no match is found.

The columns of the table you're joining to are becoming nullable when using `rightJoin`.

```ts
const result = await db.user
  .rightJoin('messages')
  .select('name', 'messages.text');

// even though name is not a nullable column, it becomes nullable after using rightJoin
const ok: { name: string | null; text: string }[] = result;
```

## fullJoin

[//]: # 'has JSDoc'

`fullJoin` is a method for SQL `FULL JOIN`, which is equivalent to `FULL OUTER JOIN`.

Takes the same arguments as `json`.

It will load all records from the joining table, both sides of the join may result in `null` values when there is no match.

All columns become nullable after using `fullJoin`.

```ts
const result = await db.user
  .rightJoin('messages')
  .select('name', 'messages.text');

// all columns can be null
const ok: { name: string | null; text: string | null }[] = result;
```

## onJsonPathEquals

[//]: # 'has JSDoc'

Use `onJsonPathEquals` to join record based on a field of their JSON column:

```ts
db.table.join(db.otherTable, (q) =>
  // '$.key' is a JSON path
  q.onJsonPathEquals('otherTable.data', '$.key', 'table.data', '$.key'),
);
```
