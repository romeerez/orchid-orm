# Columns schema overview

Columns schema stores information about table columns to make querying type-safe, and to add additional features for querying.

Note that all columns are **non-nullable** by default, use `.nullable()` to mark them as nullable.

## Column types

Each column type has a specific database type, input type, output type, and query type:

- **database type** is used in migrations to add columns of a specific type, such as `integer`, `varchar`.
- **input type** is used when creating or updating records.
- **output type** is a type of data returned by the database when selecting data.
- **query type** is the type accepted for a column when applying `where`.

In most cases, input, output, and query type are the same, but in some cases may differ.

For example, `timestamp` will be returned as a string by default (this may be overridden), but when creating or updating it may accept a epoch integer, or string, or a Date object.

```ts
// get createdAt field from the first table record
const createdAt: string = await db.table.get('createdAt');

await db.table.create({
  // Date is fine
  createdAt: new Date(),
});

await db.table.create({
  // string in ISO format is fine as well
  createdAt: new Date().toISOString(),
});
```

The query type of the timestamp is `number | string | Date`, just like the input type.

You can customize the input type to accept some additional data structure, for example, [dayjs](https://day.js.org/) objects,
but the query type stays the same and cannot be changed.

All column types support the following operators in `where` conditions:

value can be of the same type as the column, a sub-query, or a raw SQL (using `sql` or `raw` function):

```ts
db.someTable.where({
  column: {
    equals: value,
    not: value,
    in: [value1, value2, value3],
    notIn: [value1, value2, value3],
  },
});
```

Different types of columns support different operations in `where` conditions:

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    name: t.text(3, 100),
    age: t.integer(),
  }));
}

// When querying this table:
db.someTable.where({
  name: {
    // contains is available for strings
    contains: 'x',
  },
  age: {
    // gte is available for numbers
    gte: 18,
  },
});
```

## Add custom columns

It's possible to define custom columns, they can have a special behavior or a meaning, or to simply serve as an alias.

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

If you'd like use the [cuid2](https://github.com/paralleldrive/cuid2) type of ID, generate new values on JS side:

```ts
import { createId } from '@paralleldrive/cuid2';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    id() {
      return t
        .varchar(36)
        .primaryKey()
        .default(() => createId());
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

## Override column parsing/encoding

It is possible to override the parsing of columns returned from the database.

You can define an `.encode` on a column to convert the value when creating or updating records,
define `.parse` to parse values returned from the database,
`.as` will change the TS type of this column to another, enabling different set of column operations inside `where`.

Let's consider example of overriding a timestamp input and output type.

Validations schemas are optional, here is changing input and output type of timestamp when the `schemaConfig` is not set:

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    timestamp() {
      return t
        .timestamp()
        .encode((input: number) => new Date(input))
        .parse((input) => new Date(input).getTime())
        .as(t.integer());
    },
  }),
});
```

The same when using `orchid-orm-schema-to-zod`, specify validation schemas:

```ts
import { zodSchemaConfig } from 'orchid-orm-zod-schema-to-zod';
import { z } from 'zod';

export const BaseTable = createBaseTable({
  schemaConfig: zodSchemaConfig,
  columnTypes: (t) => ({
    ...t,
    timestamp() {
      return t
        .timestamp()
        .encode(z.number(), (input: number) => new Date(input))
        .parse(z.number(), (input) => new Date(input).getTime())
        .as(t.integer());
    },
  }),
});
```

The example above demonstrate how to override column types in principle,
however, for the specific case of overriding timestamp, there are predefined shortcuts.

`timestamp().asNumber()` will encode/parse timestamp from and to a number,

`timestamp().asDate()` will encode/parse timestamp from and to a `Date` object.

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps into `Date` objects:
    timestamp: () => t.timestamp().asDate(),
    // Or, parse timestamps into numbers:
    timestamp: () => t.timestamp().asNumber(),
  }),
});
```

## Override column default validation

ORM doesn't validate inputs by itself,
use `Table.inputSchema()` (see [Validation methods](/guide/columns-validation-methods.html)) in your request handlers,
and then it's guaranteed that user won't be able to submit empty or a million chars long username and other text data.

Type of `text` method forces you to provide the `min` and `max` each time when calling it. To simplify this, define common defaults for all text columns:

```ts
export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 3, max = 100) => t.text(min, max),
  }),
});
```

With such config, all text columns will be validated to have at least 3 and at most 100 characters.

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
  }));
}
```
