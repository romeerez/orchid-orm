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

Process value for the column when inserting or updating.

Type of `input` argument will be used as type of the column when inserting and updating.

```ts
const someTable = db('someTable', (t) => ({
  column: t.text().encode((input: boolean | number | string) => String(input))
}))

// numbers and booleans will be converted to string:
await someTable.insert({ column: 123 })
await someTable.insert({ column: true })
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

## methods for validation

It's expected that validation happens at the moment when application is receiving data from client, in the controller layer.

ORM and query builder does not perform validation because it's expected that data is already validated when it reaches ORM.

You can convert the column schema into a validation schema with the use of additional package.

For now only conversion to [Zod](https://github.com/colinhacks/zod) is supported.

Install a package:

```sh
npm i porm-schema-to-zod
```

Use `modelToZod` utility to get a validation schema from a model:

```ts
import { modelToZod } from 'porm-schema-to-zod';
import { Model } from './model'

export class SomeModel extends Model {
  table = 'someTable';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
}

export const SomeModelSchema = modelToZod(SomeModel)
```

Later in the code which is receiving user input you can use this schema for a validation:

```ts
import { Request } from 'express' // express is for example
import { SomeModelSchema } from './some.model'

// id is omitted because it's not needed in update:
const updateSomeItemSchema = SomeModelSchema.omit('id')

export const updateSomeItemController = (req: Request) => {
  // dataForUpdate has a proper TS type and it is validated
  const dataForUpdate = updateSomeItemSchema.parse(req.body)
  // ...do something with dataForUpdate
}
```

Methods listed below does **not** affect on parsing or encoding when getting data from db or inserting, it is only makes effect when converting columns schema to Zod schema for validation.

## validationDefault

Set default value or a function, in case of function it's called on each validation.

```ts
const someTable = db('someTable', (t) => ({
  column: t.text().validationDefault('default value'),
  dateColumn: t.date().validationDefault(() => new Date()),
}))
```

## transform

Transform value with a custom function. Returned type of value becomes a type of the column (this is not particularly useful).

```ts
const someTable = db('someTable', (t) => ({
  // reverse a string during validation
  column: t.text().transform((val) => val.split('').reverse().join(''))
}))
```

## to

Similar to `.preprocess` function of Zod, it allows to transform one type to another. The column last type is counted as the type of the column.

```ts
const someTable = db('someTable', (t) => ({
  // transform text to integer
  column: t.text().to((val) => parseInt(val), t.integer())
}))
```

## refine

Return truthy value when input is okay, return falsy value to produce error.

```ts
const someTable = db('someTable', (t) => ({
  // will produce error when value is not 'something'
  column: t.text().refine((val) => val === 'something')
}))
```

## superRefine

Add a custom check with access to the validation context, see `.superRefine` method in Zod for details.

```ts
import { z } from 'zod'

const someTable = db('someTable', (t) => ({
  column: t.text().superRefine((val, ctx) => {
    if (val.length > 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 3,
        type: 'string',
        inclusive: true,
        message: 'Too many items 😡',
      });
    }
  })
}))
```
