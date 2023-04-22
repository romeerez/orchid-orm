# Joins

`join` methods allows to join other tables, relations by name, [with](/guide/query-builder-advanced#with) statements, sub queries.

All the `join` methods accept the same arguments, but returning type is different because with `join` it's guaranteed to load joined table, and with `leftJoin` the joined table columns may be `NULL` when no matching record was found.

For the following examples, imagine we have a `User` table with `id` and `name`, and `Message` table with `id`, `text`, messages belongs to user via `userId` column:

```ts
export class UserTable extends BaseTable {
  readonly table = 'user'
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
  }))
  
  relations = {
    messages: this.hasMany(() => MessageTable, {
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}

export class MessageTable extends BaseTable {
  readonly table = 'message'
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    text: t.text(),
  }))

  relations = {
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}
```

## join

`join` is a method for SQL `JOIN`, which is equivalent to `INNER JOIN`, `LEFT INNERT JOIN`.

When no matching record is found, it will skip records of the main table.

When relations are defined between the tables, you can join them by a relation name.
Joined table can be references from `where` and `select` by a relation name.

```ts
const result = await db.user.join('messages')
  // after joining a table, we can use it in `where` conditions:
  .where({ 'messages.text': { startsWith: 'Hi' } })
  .select(
    'name', // name is User column, table name may be omitted
    'messages.text', // text is the Message column, and the table name is required
  )

// result has the following type:
const ok: { name: string, text: string }[] = result
```

Instead of selecting joined table columns individually, you can select a full joined table.

It works just fine for `1:1` (`belongsTo`, `hasOne`) relations, but may be unexpected for `1:M` or `M:M` (`hasMany`, `hasAndBelongsToMany`) relations.
For any kind of relation, it results in one main table record with data of exactly one joined table record, i.e. joined records **won't** be collected into arrays.

```ts
const result = await db.user.join('messages')
  .where({ 'messages.text': { startsWith: 'Hi' } })
  .select('name', 'messages')

// result has the following type:
const ok: { name: string, messages: { id: number, text: string } }[] = result
```

The query above may result in the following records, multiple rows have the same user name:

| name   | messages                           |
|--------|------------------------------------|
| user 1 | ```{ id: 1, text: 'message 1' }``` |
| user 1 | ```{ id: 2, text: 'message 2' }``` |
| user 1 | ```{ id: 3, text: 'message 3' }``` |

If relation wasn't defined, specify columns for the join.
Joined table can be references from `where` and `select` by a table name.

```ts
// Join message where userId = id:
db.user.join(db.message, 'userId', 'id')
  .where({ 'message.text': { startsWith: 'Hi' } })
  .select('name', 'message.text')
```

Columns in the join list may be prefixed with table names for clarity:

```ts
db.user.join(db.message, 'message.userId', 'user.id')
```

Joined table can have an alias for referencing it further:

```ts
db.user.join(db.message.as('m'), 'message.userId', 'user.id')
  .where({ 'm.text': { startsWith: 'Hi' } })
  .select('name', 'm.text')
```

You can provide a custom comparison operator

```ts
db.user.join(db.message, 'userId', '!=', 'id')
```

Join can accept raw SQL for the `ON` part of join:

```ts
db.user.join(db.message, db.user.raw('lower("message"."text") = lower("user"."name")'))
```

Join can accept raw SQL instead of columns:

```ts
db.user.join(db.message, db.user.raw('lower("message"."text")'), db.user.raw('lower("user"."name")'))

// with operator:
db.user.join(db.message, db.user.raw('lower("message"."text")'), '!=', db.user.raw('lower("user"."name")'))
```

To join based on multiple columns, you can provide an object where keys are joining table columns, and values are main table columns or a raw SQL:

```ts
db.user.join(db.message, {
  userId: 'id',

  // with table names:
  'message.userId': 'user.id',

  // value can be a raw expression:
  text: db.user.raw('lower("user"."name")'),
})
```

Join all records without conditions by providing `true`:

```ts
db.user.join(db.message, true)
```

Join methods can accept a callback with a special query builder that has `on` and `orOn` methods for handling advanced cases:

```ts
db.user.join(db.message, (q) =>
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
    .orOn('text', 'name') // or message.text = user.name
)
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
    .whereIn('user.id', [4, 5, 6])
)
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
)
```

It will produce such SQL:

```sql
SELECT * FROM "user"
JOIN (
  SELECT "t"."id", "t"."userId", "t"."text"
  FROM "message" AS "t"
) "t" ON "t"."userId" = "user"."id"
```

## leftJoin

`leftJoin` is a method for SQL `LEFT JOIN`, which is equivalent to `OUTER JOIN`, `LEFT OUTER JOIN`.

When no matching record is found, it will fill joined table columns with `NULL` values in the result rows.

Works just like `join`, except for result type that may have `null`:

```ts
const result = await db.user.leftJoin('messages')
  .select('name', 'messages.text')

// result has the following type:
const ok: { name: string, text: string | null }[] = result
```

## rightJoin

`rightJoin` is a method for SQL `RIGHT JOIN`, which is equivalent to `RIGHT OUTER JOIN`.

It will load all records from the joining table, and fill the main table columns with `null` when no match is found.

Works just like `join`, except that it can return `null` for main table columns. It is not reflected in TS type yet, to be done.

```ts
const result = await db.user.rightJoin('messages')
  .select('name', 'messages.text')

// name actually can be null if there is a message without a matching user
const ok: { name: string, text: string }[] = result
```

## fullJoin

`fullJoin` is a method for SQL `FULL JOIN`, which is equivalent to `FULL OUTER JOIN`.

It will load all records from the joining table, both sides of the join may result in `null` values when there is no match.

Works just like `join`, except that it can return `null` for both tables columns. It is not fully reflected in TS type yet, to be done.

```ts
const result = await db.user.rightJoin('messages')
  .select('name', 'messages.text')

// name also can be null if there is a message without a matching user
const ok: { name: string, text: string | null }[] = result
```
