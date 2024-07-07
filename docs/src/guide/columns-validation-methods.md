# Validation methods of columns

It's expected that validation happens at the moment when the application is receiving data from the client, in the controller layer (aka route handler).

ORM and query builder do not perform validation because it's expected that data is already validated when it reaches ORM.

You can convert the column schema into a validation schema with the use of an additional package.

Column methods described in this section have **no** effect on parsing, or encoding values, or tables schema in migrations,
they only have affect on the validation schema exposed by `Table.createSchema()`, `Table.updateSchema()`, and others.

[Zod](https://github.com/colinhacks/zod) and [Valibot](https://valibot.dev/) are supported.

:::warning
This approach isn't suitable for sharing schemas with frontend in monorepo setup.

Designed to be used on backend only.
:::

Install a package:

```sh
# for zod
npm i orchid-orm-schema-to-zod
# for valibot
npm i orchid-orm-valibot
```

Set `schemaConfig` of the `BaseTable` to `zodSchemaConfig` or `valibotSchemaConfig`:

```ts
import { createBaseTable } from 'orchid-orm';

import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
// or
import { valibotSchemaConfig } from 'orchid-orm-valibot';

export const BaseTable = createBaseTable({
  schemaConfig: zodSchemaConfig,
  // or
  schemaConfig: valibotSchemaConfig,
});
```

All table classes will now expose schemas for different purposes.

- `Table.inputSchema()` - validating input data for inserting records, primary keys are not omitted.
  Nullable and columns with default are optional, the rest are required.
  Timestamps can be accepted as a string or a number.

- `Table.ouputSchema()` - validation schema for data as it is returned from a database,
  may be useful for test purposes.

- `Table.querySchema()` - is partial, validating parameters to use in `where` or `find`.
  Unless you customize columns with custom `parse` functions, types are the same as in the `inputSchema`.

- `Table.pkeySchema()` - picked primary keys from `querySchema`, validates object like `{ id: 123 }`.

- `Table.createSchema()` - `inputSchema` with omitted primary keys, to validate data for creating records.

- `Table.updateSchema()` - omitted primary keys, partial `inputSchema` for updating records.

Use it in your controllers:

```ts
// we want to validate params which are sent from client:
const params = req.body;

// `inputSchema` is of type of the library you have chosen.
// Parse with zod:
const zodValidated = SomeTable.inputSchema().parse(params);
// Parse with valibot:
const valibotValidated = parse(SomeTable.inputSchema(), params);

// zod schema can be extended with `pick`, `omit`, `and`, `merge`, `extend` and other methods:
const extendedZodSchema = SomeTable.inputSchema()
  .pick({
    name: true,
  })
  .extend({
    additional: z.number(),
  });

// the same for valibot:
const extendedValibotSchema = merge(
  pick(SomeTable.inputSchema(), ['name']),
  object({
    additional: number(),
  }),
);
```

`inputSchema()` and similar are building a schema on the first call and remembers it for next calls.

## errors

Customize column type error with `errors` method.

For zod, set messages for `required` and `invalidType` errors:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    intColumn: t.integer().errors({
      required: 'This column is required',
      invalidType: 'This column must be an integer',
    }),
  }));
}
```

For valibot, provide a single validation message:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    intColumn: t.integer().errors('This column must be an integer'),
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

Only for zod: `text().datetime()` and `text().ip()` methods can have their own parameters,
so the error message is being passed via object.

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    stringDate: t.text().datetime({
      message: 'Invalid datetime string! Must be UTC.',
      offset: true,
    }),
    ipAddress: t.text().ip({ message: 'Invalid IP address', version: 'v4' }),
  }));
}
```

## extending validation schemas

Use `inputSchema`, `outputSchema`, `querySchema` to extend validation schemas:

```ts
class SomeTable extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    zodColumn: t
      .string()
      .inputSchema((s) => s.default('Default only for validation'))
      .outputSchema((s) =>
        s.transform((val) => val.split('').reverse().join('')),
      ),
    valibotColumn: t
      .string()
      .inputSchema((s) => optional(s, 'Default only for validation'))
      .outputSchema((s) =>
        transform(s, (val) => val.split('').reverse().join('')),
      ),
  }));
}
```

## numeric columns

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
      .safe(), // between number.MIN_SAFE_INTEGER and number.MAX_SAFE_INTEGER
  }));
}
```

## text columns

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
      // see Zod docs for datetime params, Valibot doesn't support params
      .datetime({ offset: true, precision: 5 })
      // params for Zod only: v4, v6 or don't pass the parameter for both
      .ip({ version: 'v4' })
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

## array columns

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
