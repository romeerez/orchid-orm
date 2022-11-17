# Columns schema overview

Columns schema is used in both the query builder and the ORM to store information about table columns, to make querying type-safe, and to add additional features for querying.

When using query-builder as a standalone, define columns in such way:

```ts
import { createDb } from 'pqb'

const db = createDb(...options)

const someTable = db('someTable', (t) => ({
  id: t.serial().primaryKey(),
  name: t.text(),
  active: t.boolean(),
  description: t.text().optional(),
  ...t.timestamps(),
}))
```

When using ORM, define columns in such way:

```ts
// see ORM docs about defining Model
import { Model } from './model'

export class SomeModel extends Model {
  table = 'someTable';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    active: t.boolean(),
    description: t.text().optional(),
    ...t.timestamps(),
  }))
}
```

Note that all columns are **required** by default, use `.optional()` to mark them as nullable.

## Column types

Each column type has a specific database type, input type, and output type.

In most cases, input and output are the same, but in some cases may differ.

For example, `timestamp` will be returned as a string by default (this may be overridden), but when creating or updating it may accept `string` or `Date`.

```ts
// get createdAt field from the first table record
const createdAt: string = await Table.get('createdAt')

await Table.create({
  // Date is fine
  createdAt: new Date(),
})

await Table.create({
  // string in ISO format is fine as well
  createdAt: new Date().toISOString(),
})
```

All column types support the following operators in `where` conditions:

value can be of the same type as the column, a sub-query, or a raw expression (using the `raw` function):

```ts
db.someModel.where({
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
export class SomeModel extends Model {
  table = 'someTable';
  columns = this.setColumns((t) => ({
    name: t.text(),
    age: t.integer(),
  }))
}

// When querying this model:
db.someModel.where({
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

## Override column types

It is possible to override the parsing of columns returned from the database.

Define `.encode` on a column to convert the value when creating or updating records,
define `.parse` to parse values returned from the database,
`.as` will change the TS type of one column to another for the `porm-schema-to-zod` module to use a different schema.

For example, by default timestamps are returned as strings.
Here is how to override this for all models to accept numbers when creating or updating,
and to parse the date to the number when returning from a database:

```ts
export const Model = createModel({
  columnTypes: {
    ...columnTypes,
    timestamp() {
      return columnTypes.timestamp()
        .encode((input: number) => new Date(input))
        .parse((input) => new Date(input))
        .as(columnTypes.integer())
    },
  },
})
```

Similarly, for query builder:

```ts
import { createDb, columnTypes } from 'pqb'

const db = createDb({
  connectionString: process.env.DATABASE_URL,
  columnTypes: {
    ...columnTypes,
    timestamp() {
      return columnTypes.timestamp()
        .encode((input: number) => new Date(input))
        .parse((input) => new Date(input))
        .as(columnTypes.integer())
    },
  }
})
```

The examples above demonstrate how to override column types in principle,
however, for the specific case of overriding timestamp, there are predefined shortcuts.

`timestamp().asNumber()` will encode/parse timestamp from and to a number,

`timestamp().asDate()` will encode/parse timestamp from and to a `Date` object.

```ts
export const Model = createModel({
  columnTypes: {
    ...columnTypes,
    timestamp() {
      // or use `.asDate()` to work with Date objects
      return columnTypes.timestamp().asNumber()
    },
  },
})
```
