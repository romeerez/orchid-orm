# Columns schema

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
  updatedAt: t.timestamp(),
  createdAt: t.timestamp(),
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
    updatedAt: t.timestamp(),
    createdAt: t.timestamp(),
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
  createdAt: t.timestamp(),
}))

const record = await someTable.take()
// createdAt is parsed and it has a proper TS type:
const isDate: Date = record.createdAt
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

## Common column methods

All following methods are available on any kind of column.

`.primaryKey`

Mark the column as a primary key. This column type becomes an argument of the `.find` method. So if primary key is of `serial` type, `.find` will except number, or if primary key is of `uuid` type, `.find` will expect a string.

```ts
const someTable = db('someTable', (t) => ({
  id: t.serial().primaryKey(),
}))

someTable.find(1)
```

`.foreignKey`

Mark the column to be a foreign key of other table's column. At the moment it does not have any effect, maybe it will later.

```ts
const someTable = db('someTable', (t) => ({
  otherId: t.integer().foreignKey('otherTableName', 'columnName'),
}))
```

In the ORM specify a function returning a model instead of table name:

```ts
export class SomeModel extends Model {
  table = 'someTable';
  columns = this.setColumns((t) => ({
    otherTableId: t.integer().foreignKey(() => OtherTable, 'id'),
  }))
}

export class OtherTable extends Model {
  table = 'otherTable'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }))
}
```

`.hidden`

Remove the column from default selection. For example, password of user may be marked as hidden, and then this column won't load by default, only when specifically listed in `.select`.

Caution: this functionality is not tested yet very well, to be done.

`.nullable`

Mark the column as nullable, by default it's not:

```ts
const someTable = db('someTable', (t) => ({
  column: t.integer().nullable(),
}))
```

`.encode`

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

`.parse`

Process value when loading it from database.

Type of input is the type of column before `.parse`, resulting type will replace type of column. 

```ts
const someTable = db('someTable', (t) => ({
  column: t.text().parse((input) => parseInt(input))
}))

// column will be parsed to a number
const value: number = await someTable.get('column')
```

## Using columns schema for validation

It's expected that validation happens at the moment when application is receiving data from client, in the controller layer.

ORM and query builder does not perform validation because it's expected that data is already validated when it reaches ORM.

## Common methods for validation

Methods listed below does **not** affect on parsing or encoding when getting data from db or inserting, it is only makes effect when converting columns schema to Zod schema for validation.

`.default`

Set default value or a function, in case of function it's called on each validation.

```ts
const someTable = db('someTable', (t) => ({
  column: t.text().default('default value')
  dateColumn: t.date().default(() => new Date()),
}))
```

`.transform`

Transform value with a custom function. Returned type of value becomes a type of the column (this is not particularly useful).

```ts
const someTable = db('someTable', (t) => ({
  // reverse a string during validation
  column: t.text().transform((val) => val.split('').reverse().join(''))
}))
```

`.to`

Similar to `.preprocess` function of Zod, it allows to transform one type to another. The column last type is counted as the type of the column.

```ts
const someTable = db('someTable', (t) => ({
  // transform text to integer
  column: t.text().to((val) => parseInt(val), t.integer())
}))
```

`.refine`

Return truthy value when input is okay, return falsy value to produce error.

```ts
const someTable = db('someTable', (t) => ({
  // will produce error when value is not 'something'
  column: t.text().refine((val) => val === 'something')
}))
```

`.superRefine`

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

## Numeric types

As not all database numeric types can fit into JS number type, some types will be returned as string.

```ts
// signed two-byte integer
t.smallint() // -> number

// signed four-byte integer
t.integer() // -> number

// signed eight-byte integer
t.bigint() // -> string

// exact numeric of selectable precision
t.numeric(precision?: number, scale?: number) // -> string

// decimal is alias for numeric
t.decimal(precision?: number, scale?: number) // -> string

// single precision floating-point number (4 bytes)
t.real() // -> number

// double precision floating-point number (8 bytes)
t.doublePrecision() // -> number

// autoincrementing two-byte integer
t.smallSerial() // -> number

// autoincrementing four-byte integer
t.serial() // -> number

// autoincrementing eight-byte integer
t.bigSerial() // -> string
```

As listed in code comments above, `bigint`, `numeric`, `decimal`, `bigSerial` have string output.

You can set up parsing to a `number` type, (remember this can cause bugs on large numbers):

```ts
t.bigint().parse(parseInt)
```

Or `bigint` postgres type can be parsed to `bigint` JavaScript type, but be aware that such values should be explicitly turned to a string when preparing JSON response:

```ts
t.bigint().parse(BigInt)
```

Numeric type columns supports following `where` operators:

```ts
db.someModel.where({
  numericColumn: {
    // lower than
    lt: value,
    // lower than or equal to
    lte: value,
    // greater than
    gt: value,
    // greater than or equal to
    gte: value,
    // between x and y
    between: [x, y]
  }
})
```

## Text types

Use `t.text()` type as a go-to for strings, other types are for special cases.

```ts
// character varying(n), varchar(n) variable-length with limit
t.varchar(limit?: number) // -> string

// character(n), char(n) fixed-length, blank padded
t.chat(limit?: number) // -> string

// text variable unlimited length
t.text() // -> string

// Alias for t.text()
t.string()
```

Text type columns supports following `where` operators:

```ts
db.someModel.where({
  textColumn: {
    // LIKE '%string%'
    contains: 'string',
    // ILIKE '%string%'
    containsInsensitive: 'string',
    // LIKE 'string%'
    startsWith: 'string',
    // ILIKE 'string%'
    startsWithInsensitive: 'string',
    // LIKE '%string'
    endsWith: 'string',
    // ILIKE '%string'
    endsWithInsensitive: 'string',
  }
})
```

## Binary data type

The bytea data type allows storage of binary strings, it is returned as a node.js Buffer object.

```ts
t.bytea() // -> Buffer
```

## Date/Time types

```ts
// 4 bytes date (no time of day)
t.date() // -> string

// timestamp [ (p) ] [ without time zone ] 8 bytes both date and time (no time zone) 4713 BC 294276 AD 1 microsecond
t.timestamp(precision?: number) // -> string

// timestamp [ (p) ] with time zone	8 bytes	both date and time, with time zone	4713 BC	294276 AD	1 microsecond
t.timestampWithTimeZone(precision?: number) // -> string

// time [ (p) ] [ without time zone ]	8 bytes	time of day (no date)	00:00:00	24:00:00	1 microsecond
t.time(precision?: number) // -> string

// time [ (p) ] with time zone	12 bytes	time of day (no date), with time zone	00:00:00+1559	24:00:00-1559	1 microsecond
t.timeWithTimeZone(precision?: number) // -> string

// interval [ fields ] [ (p) ]	16 bytes	time interval	-178000000 years	178000000 years	1 microsecond
t.interval(fields?: string, precision?: number) // -> PostgresInterval object
```

`interval` type takes two optional parameters:

First parameter is a string containing `YEAR`, `MONTH`, `DAY`, `HOUR` and so on, check full list in postgres docs [here](https://www.postgresql.org/docs/current/datatype-datetime.html).

Second parameter specifies the number of fractional digits retained in the seconds field.

The output of `interval` column is an object containing `years`, `month` and other fields:

```ts
type Interval = {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

const result: Interval = await Table.get('intervalColumn')
```

## Boolean type

Boolean returns `true` or `false`.

```ts
// 1 byte, true or false
t.boolean() // -> boolean
```

## Enum type

Create the enum database type:

```ts
await db.adapter.query(`
  CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');
`)
```

Define enum, first argument is a name of enum in database, second is array of possible values:

```ts
t.enum('mood', ['sad', 'ok', 'happy']); // -> outputs Mood type
```

## Geometric types

Geometric types are not parsed and returned as strings as database returns them.

```ts
// point	16 bytes	Point on a plane	(x,y)
t.point() // -> string

// line	32 bytes	Infinite line	{A,B,C}
t.line() // -> string

// lseg	32 bytes	Finite line segment	[(x1,y1),(x2,y2)]
t.lseg() // -> string

// box	32 bytes	Rectangular box	((x1,y1),(x2,y2))
t.box() // -> string

// path	16+16n bytes	Closed path (similar to polygon)	((x1,y1),...)
// path	16+16n bytes	Open path	[(x1,y1),...]
t.path() // -> string

// polygon	40+16n bytes	Polygon (similar to closed path)	((x1,y1),...)
t.polygon() // -> string

// circle	24 bytes	Circle	<(x,y),r> (center point and radius)
t.circle() // -> string
```

## Network address types

```ts
// cidr	7 or 19 bytes	IPv4 and IPv6 networks
t.cidr() // -> string, example: 192.168.100.128/25

// inet	7 or 19 bytes	IPv4 and IPv6 hosts and networks
t.inet() // -> string, example: 192.168.100.128/25

// macaddr	6 bytes	MAC addresses
t.macaddr() // -> string, example: 08:00:2b:01:02:03

// macaddr8	8 bytes	MAC addresses (EUI-64 format)
t.macaddr8() // -> string, example: 08:00:2b:ff:fe:01:02:03
```

## Bit string types

it strings are strings of 1's and 0's. They can be used to store or visualize bit masks.

```ts
// Bit strings are strings of 1's and 0's.
// They can be used to store or visualize bit masks.
// There are two SQL bit types: bit(n) and bit varying(n), where n is a positive integer.
t.bit() // -> string

// bit varying(n), where n is a positive integer
t.bitVarying() // -> string
```

## Text search types

```ts
// A tsvector value is a sorted list of distinct lexemes
t.tsvector() // -> string

// A tsquery value stores lexemes that are to be searched for
t.tsquery() // -> string
```

## UUID type

The data type uuid stores Universally Unique Identifiers (UUID).

```ts
// uuid stores Universally Unique Identifiers (UUID)
t.uuid() // -> string, example: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
```

## Array type

```ts
// array of other column type
t.array(item: ColumnType) // -> array of argument type
```

## JSON types

Postgres supports two types of JSON: `json` is for storing JSON strings as they were saved, and `jsonb` which is stored in binary format and which allows additional methods.

For `json` use `t.jsonText()`:

```ts
const someTable = db('someTable', (t) => ({
  data: t.jsonText() // -> string
}))
```

For `jsonb` use `t.json((t) => jsonSchema)` - it takes a schema, adds additional methods for querying:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    age: t.number(),
    name: t.string(),
    description: t.string().optional(),
    tags: t.string().array(),
  }))
}))
```

Text type columns supports following `where` operators:

```ts
db.someModel.where({
  jsonColumn: {
    // first element is JSON path,
    // second is a compare operator,
    // third value can be of any type, or a sub query, or a raw query
    jsonPath: ['$.name', '=', value],
    
    // check if JSON value in the column is a superset of provided value
    jsonSupersetOf: { key: 'value' },
    
    // check if JSON value in the column is a subset of provided value
    jsonSubsetOf: { key: 'value' },
  }
})
```

### JSON Schema types

Basic types are:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    number: t.number(), // -> number
    nan: t.nan(), // -> number, for a NaN value
    string: t.string(), // -> string
    literal: t.literal('value'), // -> type of literal
    boolean: t.boolean(), // -> boolean
    bigint: t.bigint(), // -> bigint
    null: t.null(), // -> null
    date: t.date(), // -> Date
    undefined: t.undefined(), // -> undefined
    never: t.never(), // -> never
    any: t.any(), // -> any
    unknown: t.unknown(), // -> unknown
    void: t.void(), // -> void
  }))
}))
```

`number` and `bigint` types can be chained with following validation methods:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    number: t.number()
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
}))
```

`string` type can be chained with following validation methods:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    string: t.string()
      .email() // validate email
      .url() // validate url
      .uuid() // validate uuid
      .cuid() // validate cuid
      .regex(/regex/) // validate string using a RegExp
      .trim() // trim string when validating
  }))
}))
```

#### optional, nullable and nullish

By default, all types are required. Append `.optional()` so the value may omit from the object:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    optionalNumber: t.number().optional()
  }))
}))
```

To require optional value back:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    requiredNumber: t.number().optional().required()
  }))
}))
```

Allow `null` value:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    nullableNumber: t.number().nullable()
  }))
}))
```

Turn back to non-nullable:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    nonNullableNumber: t.number().nullable().nonNullable()
  }))
}))
```

`nullish` is a combination of `optional` and `nullable`:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    nullishNumber: t.number().nullish()
  }))
}))
```

Turn back to required and non-nullable:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    nonNullishNumber: t.number().nullish().nonNullish()
  }))
}))
```

#### default

Set a default value which will be returned in case if input is `null` or `undefined`:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    defautedNumber: t.number().default(123)
  }))
}))
```

#### or, union

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // string | number
    stringOrNumber: t.string().or(t.number()),

    // equivalent to
    stringOrNumber2: t.union([t.string(), t.number()]),
  }))
}))
```

#### and, intersection

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // { name: string } & { age: number }
    obj: t.object({ name: t.string() }).and(t.object({ age: t.number() })),

    // equivalent to
    obj2: t.intersection(t.object({ name: t.string() }), t.object({ age: t.number() })),
  }))
}))
```

#### deepPartial

For a composite types such as `array`, `object`, `record`, `map`, `set` and some other, call `deepPartial()` to mark all inner object keys as optional:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // object with optional `name`:
    deepPartialObject: t.object({ name: t.string() }).deepPartial(),

    // array of objects with optional `name`:
    deepPartialArray: t.object({ name: t.string() }).array().deepPartial(),
  }))
}))
```

#### Transform

Specify a function to transform values.
For example, reverse a string:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    reverseString: t.string().transform((input) => input.reverse())
  }))
}))
```

To transform value from one type to another, use `.to`.

In following example, string will be transformed to number, and number method `lte` will become available:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    stringToNumber: t.string()
      .to(
        (input) => parseInt(input),
        t.number()
      )
      .lte(10)
  }))
}))
```

#### refine

Add a custom check for the value, validation will fail when falsy value is returned:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    refinedString: t.string().refine((val) => val.length <= 255)
  }))
}))
```

Refinements can also be async.

#### superRefine

`superRefine` allows to check a value and handle different cases using `ctx` context of the validation.

Refer to [Zod document](https://github.com/colinhacks/zod#superrefine) for it.

This library is designed to support Zod and later other validation libraries, so the `ctx` has type `any` and need to be explicitly typed with correct type of chosen lib:

```ts
import { z, RefinementCtx } from 'zod'

const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    superRefinedString: t.string().superRefine((val, ctx: RefinementCtx) => {
      if (val.length > 3) {
        ctx.addIssue({
          code: t.ZodIssueCode.too_big,
          maximum: 3,
          type: "array",
          inclusive: true,
          message: "Too many items 😡",
        });
      }
    })
  }))
}))
```

#### Array

Every type has `.array()` method to wrap it into array:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // array of numbers
    arrayOfNumbers: t.number().array(),

    // is equivalent to:
    arrayOfNumbers2: t.array(t.number()),
  }))
}))
```

`array` type can be chained with following validation methods:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    arrayOfNumbers: t.number().array()
      .nonEmpty() // require at least one element
      .min(number) // set minimum array length
      .max(number) // set maximum array length
      .length(number) // set exact array length
  }))
}))
```

#### Object

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // all properties are required by default
    // type will be { name: string, age: number }
    object: t.object({
      name: t.string(),
      age: t.number(),
    }),
  }))
}))
```

`.extend`:

You can add additional fields to an object schema with the `.extend` method.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be { one: number, two: string }
    extendObject: t.object({ one: t.number() })
      .extend({ two: t.string() }),
  }))
}))
```

`.merge`:

Merge two object types into one:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be { one: number, two: string }
    mergeObject: t.object({ one: t.number() })
      .merge(t.object({ two: t.string() }));
  }))
}))
```

`.pick`:

To only keep certain keys, use `.pick`:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be { one: number, two: number }
    pickObject: t.object({ one: t.number(), two: t.number(), three: t.number() })
      .pick('one', 'two')
  }))
}))
```

`.omit`:

To remove certain keys, use `.omit`:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be { three: number }
    omitObject: t.object({ one: t.number(), two: t.number(), three: t.number() })
      .omit('one', 'two')
  }))
}))
```

`.partial`:

The .partial method makes all properties optional:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be { one?: number, two?: number }
    partialObject: t.object({ one: t.number(), two: t.number() }).partial()
  }))
}))
```

You can also specify which properties to make optional:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be { one?: number, two: number }
    partialOne: t.object({ one: t.number(), two: t.number() }).partial('one')
  }))
}))
```

`.passthrough`:

By default, object schemas strip out unrecognized keys during parsing.

Instead, if you want to pass through unknown keys, use `.passthrough()`.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // will validate only `one` key and preserve all other keys when parsing
    object: t.object({ one: t.number() }).passthrough()
  }))
}))
```

`.strict`:

By default, object schemas strip out unrecognized keys during parsing.

You can disallow unknown keys with `.strict()`. If there are any unknown keys in the input, it will throw an error.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // will throw if unknown keys will be found during parsing
    object: t.object({ one: t.number() }).strict()
  }))
}))
```

`.strip`:

You can use the `.strip` method to reset an object schema to the default behavior (stripping unrecognized keys).

`.catchall`:

You can pass a "catchall" schema into an object schema. All unknown keys will be validated against it.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // check `name` to be string and all other keys to have numbers
    object: t.object({ name: t.string() }).catchall(t.number());
  }))
}))
```

#### Record

Record schemas are used to validate types such as `{ [k: string]: number }`.

If you want to validate the values of an object against some schema but don't care about the keys, use `t.record(valueType)`:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be { [k: string]: number }
    record: t.record(t.number())
  }))
}))
```

If you want to validate both the keys and the values, use `t.record(keyType, valueType)`:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    record: t.record(t.string().min(1), t.number()),
  }))
}))
```

#### Tuple

Tuples have a fixed number of elements and each element can have a different type.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be [string, number, { pointsScored: number }] 
    tuple: t.tuple([
      t.string(),
      t.number(),
      t.object({
        pointsScored: t.number(),
      }),
    ]);
  }))
}))
```

A variadic ("rest") argument can be added with the `.rest` method.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // type will be [string, ...number]
    tupleWithRest: t.tuple([t.string()]).rest(t.number()),
  }))
}))
```

#### Enum

`t.enum` is a way to declare a schema with a fixed set of allowable string values:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    enum: t.enum(["Salmon", "Tuna", "Trout"]),
  }))
}))
```

Alternatively, use `as const` to define your enum values as a tuple of strings:

```ts
const VALUES = ["Salmon", "Tuna", "Trout"] as const;

const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    enum: t.enum(VALUES)
  }))
}))
```

#### Native enums

`t.enum` is the recommended approach to defining and validating enums.
But if you need to validate against an enum from a third-party library (or you don't want to rewrite your existing enums) you can use t.nativeEnum().

```ts
enum Fruits {
  Apple,
  Banana,
}

const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    enum: t.nativeEnum(Fruits)
  }))
}))
```

#### Discriminated union

If the union consists of object schemas all identifiable by a common property, it is possible to use the `t.discriminatedUnion` method.

The advantage is in more efficient evaluation and more human friendly errors. With the basic union method the input is tested against each of the provided "options", and in the case of invalidity, issues for all the "options" are shown in the zod error. On the other hand, the discriminated union allows for selecting just one of the "options", testing against it, and showing only the issues related to this "option".

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    object: t
      .discriminatedUnion("type", [
        t.object({ type: t.literal("a"), a: t.string() }),
        t.object({ type: t.literal("b"), b: t.string() }),
      ])
      .parse({ type: "a", a: "abc" });
  }))
}))
```

### Maps

For JS `Map` type which can use any type of keys to access values:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    map: t.map(t.string(), t.number()),
  }))
}))
```

### Sets

For JS `Set` type which holds a unique set of elements:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    set: t.set(t.number()),
  }))
}))
```

#### Instanceof

You can use t.instanceof to check that the input is an instance of a class. This is useful to validate inputs against classes that are exported from third-party libraries.

```ts
class Test {
  name: string;
}

const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    object: t.instanceof(Test);
  }))
}))
```

#### Recursive JSON types

You can define a recursive schema, but because of a limitation of TypeScript, their type can't be statically inferred. Instead, you'll need to define the type definition manually, and provide it as a "type hint".

```ts
import { JSONType, jsonTypes as t } from 'pqb'

interface Category {
  name: string;
  subCategories: Category[];
}

const Category: JSONType<Category> = t.lazy(() =>
  t.object({
    name: t.string(),
    subCategories: t.array(Category),
  })
);

const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    name: t.string(),
    category: Category,
  }))
}))
```

## Other column types

```ts
// for currency amount (8 bytes)
t.money() // -> string, example: '$12.34'

// xml data type can be used to store XML data
t.xml() // -> string
```
