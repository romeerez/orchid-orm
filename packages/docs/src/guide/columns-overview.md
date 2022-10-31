# Columns schema overview

Columns schema is used in both query builder and the ORM to store information about table columns, to make querying type-safe, to add additional features for querying.

When using query-builder as a standalone, define columns in a such way:

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

When using ORM, define columns in a such way:

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

Each column type has a specific database type, input type and output type.

In most cases input and output is the same, but in some cases may differ.

For example, `timestamp` will be returned as a string by default (this may be overridden), but when inserting or updating it may accept `string` or `Date`.

```ts
// get createdAt field from the first table record
const createdAt: string = await Table.get('createdAt')

await Table.insert({
  // Date is fine
  createdAt: new Date(),
})

await Table.insert({
  // string in ISO format is fine as well
  createdAt: new Date().toISOString(),
})
```

All column types supports following operators in `where` conditions:

value can be of the same type as the column, or a sub query, or a raw expression (using `raw` function):

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

Different types of columns supports different operations in `where` conditions:

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

It is possible to override parsing of columns returned from the database.

For example, by default timestamps are returned as strings, and here is how to override it to be parsed into `Date` objects.

For query builder:

```ts
import { createDb, columnTypes } from 'pqb'

const db = createDb({
  connectionString: process.env.DATABASE_URL,
  columnTypes: {
    ...columnTypes,
    timestamp() {
      return columnTypes.timestamp().parse((input) => new Date(input))
    },
  }
})

const someTable = db('someTable', (t) => ({
  datetime: t.timestamp(),
  ...t.timestamps(),
}))

const record = await someTable.take()
// `datetime` is parsed and it has a proper TS type:
const isDate1: Date = record.datetime
// createdAt and updatedAt are defined by ...t.timestamps() and they use the output of custom timestamp()
const isDate2: Date = record.createdAt
const isDate3: Date = record.updatedAt
```

For ORM:

```ts
import { createModel } from 'porm'
import { columnTypes } from 'pqb';

export const Model = createModel({
  columnTypes: {
    ...columnTypes,
    timestamp() {
      return columnTypes.timestamp().parse((input) => new Date(input))
    },
  },
})
```
