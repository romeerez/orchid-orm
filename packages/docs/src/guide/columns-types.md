# Column types

## numeric

As not all database numeric types can fit into JS number type, some types will be returned as a string.

```ts
// signed two-byte integer
t.smallint() // -> number

// signed four-byte integer
t.integer() // -> number

// signed eight-byte integer
t.bigint() // -> string

// exact numeric of selectable precision
t.numeric(precision?: number, scale?: number) // -> string

// decimal is an alias for numeric
t.decimal(precision?: number, scale?: number) // -> string

// single-precision floating-point number (4 bytes)
t.real() // -> number

// double-precision floating-point number (8 bytes)
t.doublePrecision() // -> number

// autoincrementing two-byte integer
t.smallSerial() // -> number

// autoincrementing four-byte integer
t.serial() // -> number

// autoincrementing eight-byte integer
t.bigSerial() // -> string
```

As listed in code comments above, `bigint`, `numeric`, `decimal`, and `bigSerial` have string output.

You can set up parsing to a `number` type, (remember this can cause bugs on large numbers):

```ts
t.bigint().parse(parseInt)
```

Or `bigint` Postgres type can be parsed to `bigint` JavaScript type, but be aware that such values should be explicitly turned to a string when preparing JSON response:

```ts
t.bigint().parse(BigInt)
```

Numeric-type columns support the following `where` operators:

```ts
db.someTable.where({
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

## text

Use `t.text(min, max)` type as a go-to for strings, other types are for special cases.

`min` and `max` number parameters defines a validation of string length, they are required to ensure that the app won't accept empty or enormous values from user.

These parameters are not required on the `text` method in migrations, because they don't affect on a database column type.

```ts
// character varying(n), varchar(n) variable-length with limit
t.varchar(limit?: number) // -> string

// character(n), char(n) fixed-length, blank padded
t.chat(limit?: number) // -> string

// text variable unlimited length
t.text(min: number, max: number) // -> string

// Alias for t.text()
t.string(min: number, max: number)
```

Text type columns support the following `where` operators:

`contains`, `startsWith`, `endsWith` are case-insensitive.

```ts
db.someTable.where({
  textColumn: {
    // ILIKE '%string%'
    contains: 'string',
    // LIKE '%string%'
    containsSensitive: 'string',
    // ILIKE 'string%'
    startsWith: 'string',
    // LIKE 'string%'
    startsWithSensitive: 'string',
    // ILIKE '%string'
    endsWith: 'string',
    // LIKE '%string'
    endsWithSensitive: 'string',
  }
})
```

## citext

[citext](https://www.postgresql.org/docs/current/citext.html) is a database type that behaves almost exactly like `text`,
but is case-insensitive in all operations.

To use it, first enable `citext` extension, create migration:

```sh
npm run db new enableCitext
```

```ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createExtension('citext');
});
```

```sh
npm run db migrate
```

And now `citext` is available and can be used just as a `text` type.

It requires `min` and `max`, but can be [overridden](/guide/columns-overview.html#override-column-types) in the same way as the `text`.

```ts
// text variable unlimited length
t.citext(min: number, max: number) // -> string
```

## binary

The bytea data type allows storage of binary strings, it is returned as a node.js Buffer object.

```ts
t.bytea() // -> Buffer
```

## date and time

```ts
// 4 bytes date (no time of day)
t.date() // -> string

// timestamp [ (p) ] [ without time zone ] 8 bytes both date and time (no time zone) 4713 BC 294276 AD 1 microsecond
t.timestamp(precision?: number) // -> string

// timestamp [ (p) ] with time zone    8 bytes    both date and time, with time zone 4713 BC    294276 AD  1 microsecond
t.timestampWithTimeZone(precision?: number) // -> string

// time [ (p) ] [ without time zone ]  8 bytes    time of day (no date)  00:00:00   24:00:00   1 microsecond
t.time(precision?: number) // -> string

// time [ (p) ] with time zone 12 bytes   time of day (no date), with time zone  00:00:00+1559  24:00:00-1559  1 microsecond
t.timeWithTimeZone(precision?: number) // -> string

// interval [ fields ] [ (p) ] 16 bytes   time interval  -178000000 years   178000000 years    1 microsecond
t.interval(fields?: string, precision?: number) // -> PostgresInterval object
```

The `interval` type takes two optional parameters:

The first parameter is a string containing `YEAR`, `MONTH`, `DAY`, `HOUR`, and so on, check the full list in Postgres docs [here](https://www.postgresql.org/docs/current/datatype-datetime.html).

The second parameter specifies the number of fractional digits retained in the second field.

The output of the `interval` column is an object containing `years`, `month`, and other fields:

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

## boolean

Boolean returns `true` or `false`.

```ts
// 1 byte, true or false
t.boolean() // -> boolean
```

## enum

Create the enum database type:

```ts
await db.adapter.query(`
  CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');
`)
```

Define enum, first argument is the name of an enum in the database, second is an array of possible values:

```ts
t.enum('mood', ['sad', 'ok', 'happy']); // -> outputs Mood type
```

## geometry

Geometric types are not parsed and returned as strings as the database returns them.

```ts
// point   16 bytes   Point on a plane   (x,y)
t.point() // -> string

// line    32 bytes   Infinite line  {A,B,C}
t.line() // -> string

// lseg    32 bytes   Finite line segment    [(x1,y1),(x2,y2)]
t.lseg() // -> string

// box 32 bytes   Rectangular box    ((x1,y1),(x2,y2))
t.box() // -> string

// path    16+16n bytes   Closed path (similar to polygon)   ((x1,y1),...)
// path    16+16n bytes   Open path  [(x1,y1),...]
t.path() // -> string

// polygon 40+16n bytes   Polygon (similar to closed path)   ((x1,y1),...)
t.polygon() // -> string

// circle  24 bytes   Circle <(x,y),r> (center point and radius)
t.circle() // -> string
```

## network addresses

```ts
// CIDR    7 or 19 bytes  IPv4 and IPv6 networks
t.cidr() // -> string, example: 192.168.100.128/25

// inet    7 or 19 bytes  IPv4 and IPv6 hosts and networks
t.inet() // -> string, example: 192.168.100.128/25

// macaddr 6 bytes    MAC addresses
t.macaddr() // -> string, example: 08:00:2b:01:02:03

// macaddr8    8 bytes    MAC addresses (EUI-64 format)
t.macaddr8() // -> string, example: 08:00:2b:ff:fe:01:02:03
```

## bit string

it strings are strings of 1's and 0's. They can be used to store or visualize bit masks.

```ts
// Bit strings are strings of 1's and 0's.
// They can be used to store or visualize bit masks.
// There are two SQL bit types: bit(n) and bit varying(n), where n is a positive integer.
t.bit() // -> string

// bit varying(n), where n is a positive integer
t.bitVarying() // -> string
```

## full text search

```ts
// A tsvector value is a sorted list of distinct lexemes
t.tsvector() // -> string

// A tsquery value stores lexemes that are to be searched for
t.tsquery() // -> string
```

## UUID

The data type uuid stores Universally Unique Identifiers (UUID).

```ts
// UUID stores Universally Unique Identifiers (UUID)
t.uuid() // -> string, example: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
```

## array

```ts
// array of another column type
t.array(item: ColumnType) // -> array of argument type
```

## unsupported types

For user-defined custom types, or if some database type is not supported yet, use `type` and `as` to treat this column as other type:

```ts
t.type('type_name').as(t.integer())
```

## domain

Domain is a custom database type that allows to predefine a `NOT NULL` and a `CHECK` (see [postgres tutorial](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)).

In same way as with `type`, specify `as(otherType)` to treat this column in queries as the other type:

```ts
t.domain('domainName').as(t.integer())
```

## money

For currency amount (8 bytes)

```ts
t.money() // -> string, example: '$12.34'
```

## xml

XML data type can be used to store XML data

```ts
t.xml() // -> string
```
