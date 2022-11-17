# Common column methods

All the following methods are available in any kind of column.

## primaryKey

Mark the column as a primary key. This column type becomes an argument of the `.find` method. So if the primary key is of `serial` type, `.find` will accept the number, or if the primary key is of `UUID` type, `.find` will expect a string.

```ts
const someTable = db('someTable', (t) => ({
  id: t.serial().primaryKey(),
}))

someTable.find(1)
```

## hidden

Remove the column from the default selection. For example, the password of the user may be marked as hidden, and then this column won't load by default, only when specifically listed in `.select`.

Caution: `.hidden` functionality is not tested yet very well, to be done.

## nullable

Mark the column as nullable, by default it's not:

```ts
const someTable = db('someTable', (t) => ({
  column: t.integer().nullable(),
}))
```

## encode

Process value for the column when creating or updating.

The type of `input` argument will be used as the type of the column when creating and updating.

```ts
const someTable = db('someTable', (t) => ({
  column: t.text().encode((input: boolean | number | string) => String(input))
}))

// numbers and booleans will be converted to a string:
await someTable.create({ column: 123 })
await someTable.create({ column: true })
await someTable.where({ column: 'true' }).update({ column: false })
```

## parse

Process value when loading it from a database.

The type of input is the type of column before `.parse`, the resulting type will replace the type of column.

```ts
const someTable = db('someTable', (t) => ({
  column: t.text().parse((input) => parseInt(input))
}))

// column will be parsed to a number
const value: number = await someTable.get('column')
```

## as

This method changes a column type without modifying its behavior.
This is needed when converting columns to a validation schema, the converter will pick a different type specified by `.as`.

Before calling `.as` need to use `.encode` with the input of the same type as the input of the target column,
and `.parse` which returns the correct type.

```ts
// column as the same type as t.integer()
const column = t.text()
  .encode((input: number) => input)
  .parse((text) => parseInt(text))
  .as(t.integer())
```

## timestamps

Adds `createdAt` and `updatedAt` columns of type `timestamp` (without time zone) with default SQL `now()`.

The `timestamps` function is using `timestamp` internally. If `timestamp` is overridden to be parsed into `Date`, so will do `timestamps`.

`updatedAt` adds a hook to refresh its date on every `update` query, unless you specify the `updatedAt` value explicitly in the update.

```ts
const someTable = db('someTable', (t) => ({
  ...t.timestamps()
}))
```

## modifyQuery

Specify a callback that can modify a model for ORM or table instance for query builder.

When mutating a query in this callback, the changes will be applied to all future queries of this table.

```ts
const someTable = db('someTable', (t) => ({
  name: t.text().modifyQuery((table) => {
    // table argument === someTable from outside
  })
}))
```

## methods for migration

Column methods such as `default`, `foreignKey`, `index`, `unique` and others have effects only when used in migrations, read more about it in [migration column methods](/guide/migration-column-methods) document.
