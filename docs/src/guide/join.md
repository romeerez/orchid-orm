# Joins

`join` methods allows to join other tables, relations by name, [with](/guide/query-builder-advanced#with) statements, sub queries.

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
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  };
}

export class MessageTable extends BaseTable {
  readonly table = 'message';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    text: t.text(),
    ...t.timestamps(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  };
}
```

## join

`join` is a method for SQL `JOIN`, which is equivalent to `INNER JOIN`, `LEFT INNERT JOIN`.

When no matching record is found, it will skip records of the main table.

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

Instead of selecting joined table columns individually, you can select a full joined table.

It works just fine for `1:1` (`belongsTo`, `hasOne`) relations, but may be unexpected for `1:M` or `M:M` (`hasMany`, `hasAndBelongsToMany`) relations.
For any kind of relation, it results in one main table record with data of exactly one joined table record, i.e. joined records **won't** be collected into arrays.

```ts
const result = await db.user
  .join('messages')
  .where({ 'messages.text': { startsWith: 'Hi' } })
  .select('name', 'messages');

// result has the following type:
const ok: {
  name: string;
  // full message is included:
  messages: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

`select` can accept an object where key is a new alias and the value refers to the joined table:

```ts
const result = await db.user
  .join('messages')
  .where({ 'messages.text': { startsWith: 'Hi' } })
  .select('name', { msg: 'messages' });

// result has the following type:
const ok: {
  name: string;
  // full message is included as msg:
  msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

The query above may result in the following records, multiple rows have the name of the same user:

| name   | msg                            |
| ------ | ------------------------------ |
| user 1 | `{ id: 1, text: 'message 1' }` |
| user 1 | `{ id: 2, text: 'message 2' }` |
| user 1 | `{ id: 3, text: 'message 3' }` |

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
  .select('name', { msg: 'm' });

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
  db.user.raw('lower("message"."text") = lower("user"."name")'),
);
```

Join can accept raw SQL instead of columns:

```ts
db.user.join(
  db.message,
  db.user.raw('lower("message"."text")'),
  db.user.raw('lower("user"."name")'),
);

// with operator:
db.user.join(
  db.message,
  db.user.raw('lower("message"."text")'),
  '!=',
  db.user.raw('lower("user"."name")'),
);
```

To join based on multiple columns, you can provide an object where keys are joining table columns, and values are main table columns or a raw SQL:

```ts
db.user.join(db.message, {
  userId: 'id',

  // with table names:
  'message.userId': 'user.id',

  // value can be a raw expression:
  text: db.user.raw('lower("user"."name")'),
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

Join query builder supports all `where` methods: `.where`, `.whereIn`, `.whereExists`, and all `.or`, `.not`, and `.orNot` forms.

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

The join argument can be a query with `select`, `where`, and other methods. In such case, it will be handled as a sub query:

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

## joinLateral

`joinLateral` allows joining a table with a sub-query that can reference the main table of current query and the other joined tables.

Regular `JOIN` also can have a sub-query in its definition, but it cannot reference other tables of this query.

`JOIN LATERAL` of Postgres can have conditions in the `ON` statement, but `Orchid ORM` decided that there are no useful use-cases for such conditions, and it is only building a sub-query.

First argument is the other table you want to join, or a name of relation, or a name of `with` defined table.

Second argument is a callback where you can reference other tables using `on` and `orOn`, select columns, do `where` conditions, and use any other query methods to build a sub-query.

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
).select('name', 'message');

// result has the following type:
const ok: {
  name: string;
  // full message is included:
  message: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

`message` can be aliased in the `select` as well as with simple `join`:

```ts
// join by relation name
const result = await User.joinLateral(
  'messages',
  (q) => q.as('message'), // alias to 'message'
).select('name', { msg: 'message' });

// result has the following type:
const ok: {
  name: string;
  // full message is included as msg:
  msg: { id: number; text: string; updatedAt: Date; createdAt: Date };
}[] = result;
```

## leftJoin

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

The same as `joinLateral`, but when no records found for the join it will result in `null`:

```ts
const result = await db.user
  .leftJoinLateral('messages', (q) => q.as('message'))
  .select('name', 'message.text');

// result has the following type:
const ok: { name: string; text: string | null }[] = result;
```

## rightJoin

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
