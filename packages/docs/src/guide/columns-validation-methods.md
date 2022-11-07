# Validation methods of columns

It's expected that validation happens at the moment when application is receiving data from client, in the controller layer.

ORM and query builder does not perform validation because it's expected that data is already validated when it reaches ORM.

You can convert the column schema into a validation schema with use of additional package.

Column methods described in this section do **not** affect on parsing or encoding when getting data from db or creating,
they only have effect after converting to validation schema and using it in a controller or elsewhere.

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
  table = 'table';
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

## validationDefault

Set default value or a function, in case of function it's called on each validation.

```ts
class SomeModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
    column: t.text().validationDefault('default value'),
    dateColumn: t.date().validationDefault(() => new Date()),
  }))
}
```

## transform

Transform value with a custom function. Returned type of value becomes a type of the column (this is not particularly useful).

```ts
class SomeModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
    // reverse a string during validation
    column: t.text().transform((val) => val.split('').reverse().join(''))
  }))
}
```

## to

Similar to `.preprocess` function of Zod, it allows to transform one type to another. The column last type is counted as the type of the column.

```ts
class SomeModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
    // transform text to integer
    column: t.text().to((val) => parseInt(val), t.integer())
  }))
}
```

## refine

Return truthy value when input is okay, return falsy value to produce error.

```ts
class SomeModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
    // will produce error when value is not 'something'
    column: t.text().refine((val) => val === 'something')
  }))
}
```

## superRefine

Add a custom check with access to the validation context, see `.superRefine` method in Zod for details.

```ts
class SomeModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
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
}
```

## Numeric columns

Numeric columns `smallint`, `integer`, `numeric`, `decimal`, `real`, `smallSerial`, `serial` have such validation methods:

```ts
class SomeModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
    number: t.integer()
      .lt(number) // must be lower than number
      .lte(number) // must be lower than or equal to number
      .max(number) // alias for .lte
      .gt(number) // must be greater than number
      .gte(number) // must be greater than or equal to number
      .min(number) // alias for .gte
      .positive() // must be greater than 0
      .nonNegative() // must be greater than or equal to 0
      .negative() // must be lower than 0
      .nonPositive() // must be lower than or equal to 0
      .multipleOf(number) // must be a multiple of number
      .step(number) // alias for .multipleOf
  }))
}
```

## Text columns

Text columns `varchar`, `char`, `text` have such validation methods:

```ts
class SomeModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
    number: t.integer()
      .email() // validate email
      .url() // validate url
      .uuid() // validate uuid
      .cuid() // validate cuid
      .regex(/regex/) // validate string using a RegExp
      .trim() // trim string when validating
  }))
}
```

## Array columns

Array columns have such validation methods:

```ts
class SomeModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
    number: t.integer()
      .nonEmpty() // require at least one element
      .min(number) // set minimum array length
      .max(number) // set maximum array length
      .length(number) // set exact array length
  }))
}
```
