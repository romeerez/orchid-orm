# Columns schema overview

Columns schema stores information about table columns to make querying type-safe, and to add additional features for querying.

Note that all columns are **non-nullable** by default, use `.nullable()` to mark them as nullable.

## Column types

Each column type has a specific database type, input type, and output type.

In most cases, input and output are the same, but in some cases may differ.

For example, `timestamp` will be returned as a string by default (this may be overridden), but when creating or updating it may accept `string` or `Date`.

```ts
// get createdAt field from the first table record
const createdAt: string = await db.table.get('createdAt')

await db.table.create({
  // Date is fine
  createdAt: new Date(),
})

await db.table.create({
  // string in ISO format is fine as well
  createdAt: new Date().toISOString(),
})
```

All column types support the following operators in `where` conditions:

value can be of the same type as the column, a sub-query, or a raw expression (using the `raw` function):

```ts
db.someTable.where({
  column: {
    equals: value,
    not: value,
    in: [value1, value2, value3],
    notIn: [value1, value2, value3],
  }
})
```

Different types of columns support different operations in `where` conditions:

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    name: t.text(3, 100),
    age: t.integer(),
  }))
}

// When querying this table:
db.someTable.where({
  name: {
    // contains is available for strings
    contains: 'x'
  },
  age: {
    // gte is available for numbers
    gte: 18,
  },
})
```

## Add custom columns

It's possible to define custom columns, they can have some special behavior or meaning, or just for simplicity.

For example, we can add `id` column which would be an alias to `identity().primaryKey()` or `uuid().primaryKey()`:

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    // for autoincementing integer ID:
    id: () => t.identity().primaryKey(),
    // or, for UUID:
    id: () => t.uuid().primaryKey(),
  }),
});
```

Or maybe you'd like to have a `cuid` type of ID, generating new values on JS side:

```ts
import { generateCUID } from 'some-lib'

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    id() {
      return t.varchar(36).primaryKey().default(() => generateCUID());
    },
  }),
});
```

And then we can use custom columns on our tables just as well as predefined ones:

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // custom column
    id: t.id(),
  }));
}
```

## Override column types

It is possible to override the parsing of columns returned from the database.

`text` method requires `min` and `max` parameters, you can override it to use defaults:

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 3, max = 100) => t.text(min, max),
  }),
})
```

With such config, all text columns will be validated to have at least 3 and at most 100 characters:

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    // name will be validated to have at least 3 and at most 100 chars
    name: t.text(),
    // override min
    password: t.text().min(8),
    // override max
    bio: t.text().max(1000),
  }))
}
```

You can define an `.encode` on a column to convert the value when creating or updating records,
define `.parse` to parse values returned from the database,
`.as` will change the TS type of one column to another for the `orchid-orm-schema-to-zod` module to use a different schema.

For example, by default timestamps are returned as strings.
Here is how to override this for all tables to accept numbers when creating or updating,
and to parse the date to the number when returning from a database:

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    timestamp() {
      return t.timestamp
        .encode((input: number) => new Date(input))
        .parse((input) => new Date(input))
        .as(t.integer())
    },
  }),
})
```

The examples above demonstrate how to override column types in principle,
however, for the specific case of overriding timestamp, there are predefined shortcuts.

`timestamp().asNumber()` will encode/parse timestamp from and to a number,

`timestamp().asDate()` will encode/parse timestamp from and to a `Date` object.

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    // or use `.asDate()` to work with Date objects
    timestamp: () => t.timestamp().asNumber(),
  }),
})
```
