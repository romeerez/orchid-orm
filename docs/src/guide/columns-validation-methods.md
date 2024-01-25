# Validation methods of columns

It's expected that validation happens at the moment when the application is receiving data from the client, in the controller layer (aka route handler).

ORM and query builder do not perform validation because it's expected that data is already validated when it reaches ORM.

You can convert the column schema into a validation schema with the use of an additional package.

Column methods described in this section have **no** effect on parsing, or encoding values, or tables schema in migrations,
they only alter the validation schema exposed by `Table.inputSchema()`, `Table.outputSchema()`, and similar,
and you are supposed to use the `Table.inputSchema()` when validating incoming parameters.

For now, only [Zod](https://github.com/colinhacks/zod) is supported.

Install a package:

```sh
npm i orchid-orm-schema-to-zod
```

Set `schemaConfig` of the `BaseTable` to `zodSchemaConfig`:

```ts
import { createBaseTable } from 'orchid-orm';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  schemaConfig: zodSchemaConfig,
});
```

All table classes will now expose schemas for different purposes:

- `Table.inputSchema()` - validating input data for inserting records.
- `Table.updateSchema()` - partial `inputSchema` for updating records.
- `Table.ouputSchema()` - not sure why you might want to validate output, but you can. Perhaps, for testing purposes.
- `Table.querySchema()` - validating parameters for use in `where` or `find`. It's a very rare case when it does not much the `inputSchema`, so you can simply use the `inputSchema` for this instead.
- `Table.pkeySchema()` - picked table primary keys from `querySchema`, validates object like `{ id: 123 }`.

Use it in your controllers:

```ts
// we want to validate params which are sent from client:
const params = req.body;

// validate params with the `parse` method:
const validated = SomeTable.inputSchema().parse(params);

// the schema is a Zod schema, it can be extended with `pick`, `omit`, `and`, `merge`, `extend` and other methods:
const extendedSchema = SomeTable.inputSchema()
  .pick({
    name: true,
  })
  .extend({
    additional: z.number(),
  });
```

The schema of table is memoized when calling the schema function, so calling it multiple times doesn't have a performance penalty.

`inputSchema()` and similar are building `zod` schema on the first call and remembers it for next calls.

## errors

`errors` allows to set validation messages for `required` and `invalidType` errors:

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

## extending validation schemas

Use `inputSchema`, `outputSchema`, `querySchema` to extend Zod schemas, any zod specific methods can be used inside a callback:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    column: t
      .string()
      .inputSchema((s) => s.default('Default only for validation'))
      .outputSchema((s) =>
        s.transform((val) => val.split('').reverse().join('')),
      ),
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
      .step(number) // must be a multiple of the number
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
