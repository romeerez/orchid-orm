# Validation methods of columns

It's expected that validation happens at the moment when the application is receiving data from the client, in the controller layer.

ORM and query builder do not perform validation because it's expected that data is already validated when it reaches ORM.

You can convert the column schema into a validation schema with the use of an additional package.

Column methods described in this section have **no** effect on parsing, or encoding values, or tables schema in migrations,
they only have an effect after converting to validation schema and using it in a controller or elsewhere.

For now, only conversion to [Zod](https://github.com/colinhacks/zod) is supported.

Install a package:

```sh
npm i orchid-orm-schema-to-zod
```

Use the `tableToZod` utility to get a validation schema from a table class:

```ts
import { tableToZod } from 'orchid-orm-schema-to-zod';
import { BaseTable } from './baseTable'

export class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
  }))
}

export const SomeTableSchema = tableToZod(SomeTable)
```

Later in the code which is receiving user input, you can use this schema for validation:

```ts
import { Request } from 'express' // express is for example
import { SomeTableSchema } from './some.table'

// id is omitted because it's not needed in the update:
const updateSomeItemSchema = SomeTableSchema.omit('id')

export const updateSomeItemController = (req: Request) => {
  // dataForUpdate has a proper TS type and it is validated
  const dataForUpdate = updateSomeItemSchema.parse(req.body)
  // ...do something with dataForUpdate
}
```

## errors

`errors` allows to specify two following validation messages:

```ts
t.text().errors({
  required: 'This column is required',
  invalidType: 'This column must be an integer',
})
```

It will be converted into `Zod`'s messages:

```ts
z.string({
  required_error: 'This column is required',
  invalid_type_error: 'This column must be an integer',
});
```

Each validation method can accept an error message as a string:

```ts
t.text().min(5, 'Must be 5 or more characters long');
t.text().max(5, 'Must be 5 or fewer characters long');
t.text().length(5, 'Must be exactly 5 characters long');
t.text().email('Invalid email address');
t.text().url('Invalid url');
t.text().emoji('Contains non-emoji characters');
t.text().uuid('Invalid UUID');
t.text().includes("tuna", 'Must include tuna');
t.text().startsWith("https://", 'Must provide secure URL');
t.text().endsWith(".com", 'Only .com domains allowed');
```

Except for `text().datetime()` and `text().ip()`:

these methods can have their own parameters, so the error message is passed in object.

```ts
t.text().datetime({ message: 'Invalid datetime string! Must be UTC.' });
t.text().ip({ message: 'Invalid IP address' });
```

Error messages are supported for a JSON schema as well:

```ts
t.json((j) => ({
  one: j.string().errors({ required: 'One is required' }).min(5, 'Must be 5 or more characters long'),
  two: j.string().errors({ invalidType: 'Two should be a string' }).max(5, 'Must be 5 or fewer characters long'),
  three: j.string().length(5, 'Must be exactly 5 characters long'),
}))
```

## validationDefault

Set default value or a function, in the case of a function it's called on each validation.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    column: t.text(1, 100).validationDefault('default value'),
    dateColumn: t.date().validationDefault(() => new Date()),
  }))
}
```

## transform

Transform value with a custom function. Returned type of value becomes a type of column (this is not particularly useful).

```ts
class SomeTable extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    // reverse a string during validation
    column: t.text(1, 100).transform((val) => val.split('').reverse().join(''))
  }))
}
```

## to

Similar to the `.preprocess` function of Zod, it allows the transformation of one type to another. The column last type is counted as the type of the column.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    // transform text to integer
    column: t.text(1, 100).to((val) => parseInt(val), t.integer())
  }))
}
```

## refine

Return the truthy value when the input is okay, and return the falsy value to produce an error.

Optionally takes error message parameter.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    // will produce an error when the value is not 'something'
    column: t.text(1, 100).refine((val) => val === 'something', 'error message')
  }))
}
```

## superRefine

Add a custom check with access to the validation context, see the `.superRefine` method in Zod for details.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    column: t.text(1, 100).superRefine((val, ctx) => {
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
}
```

## Numeric columns

Numeric columns `smallint`, `integer`, `numeric`, `decimal`, `real`, `smallSerial`, and `serial` have such validation methods:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    number: t.integer()
      .lt(number) // must be lower than number
      .lte(number) // must be lower than or equal to the number
      .max(number) // alias for .lte
      .gt(number) // must be greater than number
      .gte(number) // must be greater than or equal to the number
      .min(number) // alias for .gte
      .positive() // must be greater than 0
      .nonNegative() // must be greater than or equal to 0
      .negative() // must be lower than 0
      .nonPositive() // must be lower than or equal to 0
      .multipleOf(number) // must be a multiple of the number
      .step(number) // alias for .multipleOf
      .finite() // useful only for `numeric`, `decimal`, `real`, because Infinity won't pass integer check
      .safe() // equivalient to .lte(Number.MAX_SAFE_INTEGER)
  }))
}
```

## Text columns

Text columns `varchar`, `char`, and `text` have such validation methods:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    number: t.text()
      .nonEmpty() // equivalent for .min(1)
      .min(1)
      .max(10)
      .length(5)
      .email()
      .url()
      .emoji()
      .uuid()
      .cuid()
      .cuid2()
      .ulid()
      .datetime({ offset: true, precision: 5 }) // see Zod docs for details
      .ip({ version: 'v4' }) // v4, v6 or don't pass the parameter for both
      .regex(/regex/)
      .includes('str')
      .startsWith('str')
      .endsWith('str')
      .trim()
      .toLowerCase()
      .toUpperCase()
  }))
}
```

## Array columns

Array columns have such validation methods:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table'
  columns = this.setColumns((t) => ({
    number: t.integer()
      .nonEmpty() // require at least one element
      .min(number) // set minimum array length
      .max(number) // set maximum array length
      .length(number) // set exact array length
  }))
}
```
