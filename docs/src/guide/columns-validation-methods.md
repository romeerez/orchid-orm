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

Set `schemaProvider` of the `BaseTable` to `zodSchemaProvider`:

```ts
import { createBaseTable } from 'orchid-orm';
import { zodSchemaProvider } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  schemaProvider: zodSchemaProvider,
});
```

`schema` method became available for all table classes.
In the code which is receiving input from client, you can use table schemas for validation:

```ts
// we want to validate params which are sent from client:
const params = req.body;

// validate params with the `parse` method:
const validated = SomeTable.schema().parse(params);

// the schema is a Zod schema, it can be extended with `pick`, `omit`, `and`, `merge`, `extend` and other methods:
const extendedSchema = SomeTable.schema()
  .pick({
    name: true,
  })
  .extend({
    additional: z.number(),
  });
```

The schema of table is memoized when calling `schema()`, so calling it multiple times doesn't have a performance penalty.

## errors

`errors` allows to specify two following validation messages:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    textColumn: t.text().errors({
      required: 'This column is required',
      invalidType: 'This column must be an integer',
    }),
  }));
}
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
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    notTooShortText: t.text().min(5, 'Must be 5 or more characters long'),
    notTooLongText: t.text().max(5, 'Must be 5 or fewer characters long'),
    fiveCharsText: t.text().length(5, 'Must be exactly 5 characters long'),
    email: t.text().email('Invalid email address'),
    url: t.text().url('Invalid url'),
    emojiText: t.text().emoji('Contains non-emoji characters'),
    uuid: t.text().uuid('Invalid UUID'),
    aboutTuna: t.text().includes('tuna', 'Must include tuna'),
    httpsLink: t.text().startsWith('https://', 'Must provide secure URL'),
    dotComLink: t.text().endsWith('.com', 'Only .com domains allowed'),
  }));
}
```

Except for `text().datetime()` and `text().ip()`:

these methods can have their own parameters, so the error message is passed in object.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    stringDate: t
      .text()
      .datetime({ message: 'Invalid datetime string! Must be UTC.' }),
    ipAddress: t.text().ip({ message: 'Invalid IP address' }),
  }));
}
```

Error messages are supported for a JSON schema as well:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    data: t.json((j) =>
      j.object({
        one: j
          .string()
          .errors({ required: 'One is required' })
          .min(5, 'Must be 5 or more characters long'),
        two: j
          .string()
          .errors({ invalidType: 'Two should be a string' })
          .max(5, 'Must be 5 or fewer characters long'),
        three: j.string().length(5, 'Must be exactly 5 characters long'),
      }),
    ),
  }));
}
```

## validationDefault

Set default value or a function, in the case of a function it's called on each validation.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    column: t.text(1, 100).validationDefault('default value'),
    dateColumn: t.date().validationDefault(() => new Date()),
  }));
}
```

## transform

Transform value with a custom function. Returned type of value becomes a type of column (this is not particularly useful).

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // reverse a string during validation
    column: t.text(1, 100).transform((val) => val.split('').reverse().join('')),
  }));
}
```

## to

Similar to the `.preprocess` function of Zod, it allows the transformation of one type to another. The column last type is counted as the type of the column.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // transform text to integer
    column: t.text(1, 100).to((val) => parseInt(val), t.integer()),
  }));
}
```

## refine

Return the truthy value when the input is okay, and return the falsy value to produce an error.

Optionally takes error message parameter.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // will produce an error when the value is not 'something'
    column: t
      .text(1, 100)
      .refine((val) => val === 'something', 'error message'),
  }));
}
```

## superRefine

Add a custom check with access to the validation context, see the `.superRefine` method in Zod for details.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
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
    }),
  }));
}
```

## Numeric columns

Numeric columns `smallint`, `integer`, `numeric`, `decimal`, `real`, `smallSerial`, and `serial` have such validation methods:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    number: t
      .integer()
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
      .safe(), // equivalient to .lte(Number.MAX_SAFE_INTEGER)
  }));
}
```

## Text columns

Text columns `varchar`, `char`, and `text` have such validation methods:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    number: t
      .text()
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
      .toUpperCase(),
  }));
}
```

## Array columns

Array columns have such validation methods:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    number: t
      .integer()
      .nonEmpty() // require at least one element
      .min(number) // set minimum array length
      .max(number) // set maximum array length
      .length(number), // set exact array length
  }));
}
```
