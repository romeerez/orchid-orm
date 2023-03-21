# JSON types

Postgres supports two types of JSON: `json` is for storing JSON strings as they were saved, and `jsonb` is stored in binary format and allows additional methods.

For `json` use `t.jsonText()`:

```ts
const someTable = db('someTable', (t) => ({
  data: t.jsonText() // -> JSON string
}))
```

For `jsonb` use `t.json((t) => jsonSchema)` - it takes a schema, and adds additional methods for querying:

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

Error messages described in [validation docs](/guide/column-validation-methods.html#errors) are working in the same way for nested JSON schemas.

Text type columns support the following `where` operators:

```ts
db.someTable.where({
  jsonColumn: {
    // first element is JSON path,
    // second is a compare operator,
    // third value can be of any type, or a subquery, or a raw query
    jsonPath: ['$.name', '=', value],
    
    // check if the JSON value in the column is a superset of the provided value
    jsonSupersetOf: { key: 'value' },
    
    // check if the JSON value in the column is a subset of the provided value
    jsonSubsetOf: { key: 'value' },
  }
})
```

## basic JSON types

The basic types are:

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

`number` and `bigint` types can be chained with the the same methods as numeric columns:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    number: t.number()
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
      .finite() // not Infinity
      .safe() // equivalient to .lte(Number.MAX_SAFE_INTEGER)
  }))
}))
```

`string` type can be chained with the methods as text columns:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    string: t.string()
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
}))
```

## optional, nullable and nullish

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

## default

Set a default value that will be returned in case input is `null` or `undefined`. If the function is provided, it will be called on each validation to use the returned value.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    defautedNumber: t.number().default(123),
    defautedRandom: t.number().default(() => Math.random()),
  }))
}))
```

## or, union

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

## and, intersection

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

## deepPartial

For a composite type such as `array`, `object`, `record`, `map`, `set`, and some others, call `deepPartial()` to mark all inner object keys as optional:

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

## transform

Specify a function to transform values.
For example, reverse a string:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    reverseString: t.string().transform((input) => input.split('').reverse().join(''))
  }))
}))
```

To transform value from one type to another, use `.to`.

In the following example, the string will be transformed into a number, and the number method `lte` will become available:

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

## refine

Add a custom check for the value, validation will fail when a falsy value is returned:

Optionally takes error message.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    refinedString: t.string().refine((val) => val.length <= 255, 'error message')
  }))
}))
```

Refinements can also be async.

## superRefine

`superRefine` allows one to check a value and handle different cases using the `ctx` context of the validation.

Refer to [Zod document](https://github.com/colinhacks/zod#superrefine) for it.

This library is designed to support Zod and later other validation libraries, so the `ctx` has type `any` and needs to be explicitly typed with the correct type of chosen lib:

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

## array

Every type has the`.array()` method to wrap it into the array:

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

The `array` type can be chained with the following validation methods:

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

## object

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

### extend

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

### merge

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

### pick

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

### omit

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

### partial

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

### passthrough

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

### strict

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

### strip

You can use the `.strip` method to reset an object schema to the default behavior (stripping unrecognized keys).

### catchall

You can pass a "catchall" schema into an object schema. All unknown keys will be validated against it.

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    // check `name` to be a string and all other keys to have numbers
    object: t.object({ name: t.string() }).catchall(t.number());
  }))
}))
```

## record

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

## tuple

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

## enum

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

## native enums

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

## discriminated union

If the union consists of object schemas all identifiable by a common property, it is possible to use the `t.discriminatedUnion` method.

The advantage is in the more efficient evaluation and more human-friendly errors. With the basic union method the input is tested against each of the provided "options", and in the case of invalidity, issues for all the "options" are shown in the zod error. On the other hand, the discriminated union allows for selecting just one of the "options", testing against it, and showing only the issues related to this "option".

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

### maps

For JS `Map` type which can use any type of keys to access values:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    map: t.map(t.string(), t.number()),
  }))
}))
```

### sets

For the JS `Set` type which holds a unique set of elements:

```ts
const someTable = db('someTable', (t) => ({
  data: t.json((t) => ({
    set: t.set(t.number()),
  }))
}))
```

## instanceof

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

## recursive JSON types

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
