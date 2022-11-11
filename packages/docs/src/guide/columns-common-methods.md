# Common column methods

All following methods are available on any kind of column.

## primaryKey

Mark the column as a primary key. This column type becomes an argument of the `.find` method. So if primary key is of `serial` type, `.find` will except number, or if primary key is of `uuid` type, `.find` will expect a string.

```ts
const someTable = db('someTable', (t) => ({
  id: t.serial().primaryKey(),
}))

someTable.find(1)
```

## hidden

Remove the column from default selection. For example, password of user may be marked as hidden, and then this column won't load by default, only when specifically listed in `.select`.

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

Type of `input` argument will be used as type of the column when creating and updating.

```ts
const someTable = db('someTable', (t) => ({
  column: t.text().encode((input: boolean | number | string) => String(input))
}))

// numbers and booleans will be converted to string:
await someTable.create({ column: 123 })
await someTable.create({ column: true })
await someTable.where({ column: 'true' }).update({ column: false })
```

## parse

Process value when loading it from database.

Type of input is the type of column before `.parse`, resulting type will replace type of column.

```ts
const someTable = db('someTable', (t) => ({
  column: t.text().parse((input) => parseInt(input))
}))

// column will be parsed to a number
const value: number = await someTable.get('column')
```

## as

This method doesn't affect on any column behavior, it only changes TS type of the column to the provided one.

Before calling `.as` need to use `.encode` with input of same type as input of target column,
and `.parse` which returns correct type.

```ts
// column as the same type as t.integer()
const column = t.text()
  .encode((input: number) => input)
  .parse((text) => parseInt(text))
  .as(t.integer())
```

## timestamps

Adds `createdAt` and `updatedAt` columns of type `timestamp` (without time zone) with default SQL `now()`.

`timestamps` function is using `timestamp` internally. If `timestamp` is overridden to be parsed into `Date`, so will do `timestamps`.

`updatedAt` adds a hook to refresh its date on every `update` query, unless you specify `updatedAt` value explicitly in the update.

```ts
const someTable = db('someTable', (t) => ({
  ...t.timestamps()
}))
```

## modifyQuery

Specify a callback which can modify a model for ORM or table instance for query builder.

When mutating a query in this callback, the changes will be applied for all future queries of this table.

```ts
const someTable = db('someTable', (t) => ({
  name: t.text().modifyQuery((table) => {
    // table argument === someTable from outside
  })
}))
```

## methods for migration

Column methods such as `default`, `foreignKey`, `index`, `unique` and others have effect only when used in migrations, read more about it in [migration column methods](/guide/migration-column-methods) document.
