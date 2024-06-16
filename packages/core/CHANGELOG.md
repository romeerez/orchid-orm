# orchid-core

## 0.16.1

### Patch Changes

- 9c82aca: Add `map` helper method similar to `transform` (#281)

## 0.16.0

### Minor Changes

- ee49636: json\* methods rework (#287)

## 0.15.6

### Patch Changes

- 61215ad: Auto-batch inserts when exceeding max binding params limit (#288)

## 0.15.5

### Patch Changes

- 6a0d06d: Support accessing WITH table value in create, update, delete

## 0.15.4

### Patch Changes

- 5a21099: Accept building expressions in create and update column callbacks
- 5a21099: Support joining relation with alias

## 0.15.3

### Patch Changes

- 147091d: Resolve empty whereIn into a none query, handle none query in various selecting and joining cases (#266)

## 0.15.2

### Patch Changes

- 98ad6a6: Change `fn`, export `sql` from the `BaseTable`

  The `fn` query builder accepted a column type via parameter, now it accepts the type via `type` method, see [docs](https://orchid-orm.netlify.app/guide/sql-expressions#fn).

  Instead of importing `raw` from 'orchid-core', as was documented before, export `sql` helper from your `BaseTable` file:

  ```ts
  import { createBaseTable } from 'orchid-orm';

  export const BaseTable = createBaseTable();

  export const { sql } = BaseTable;
  ```

## 0.15.1

### Patch Changes

- 4e9082f: Improve query `column` method, add `ref` method

  The `column` method was just good for referencing a table column, now it also can be chained with column operators
  to construct SQL expressions.

  The `column` method can only reference a current table's column,
  new `ref` method can reference any available column in the current query.

  ```ts
  await db.table.select({
    // select `("table"."id" = 1 OR "table"."name" = 'name') AS "one"`,
    // returns a boolean
    one: (q) =>
      q.sql<boolean>`${q.column('id')} = ${1} OR ${q.column(
        'name',
      )} = ${'name'}`,

    // selects the same as above, but by building a query
    two: (q) => q.column('id').equals(1).or(q.column('name').equals('name')),
  });
  ```

## 0.15.0

### Minor Changes

- e92cebd: In snake_case mode, make `timestamps()` helper to snakerize a column key instead of default `created_at` and `updated_at`

## 0.14.1

### Patch Changes

- bdef5b0: Override certain column types to be non-nullable after creating a _belongs to_ record that defines such columns.

  ```ts
  // let's say a tree optionally belongs to a forest,
  // a tree has a `forestId: number | null`

  const tree = db.tree.create({
    name: 'Willow',
    forest: {
      name: 'Eerie forest',
    },
  });

  // ok, the `forestId` is not nullable
  const num: number = tree.forestId;
  ```

## 0.14.0

### Minor Changes

- e254c22: - Rework composite indexes, primary and foreign keys.

  - Change `findBy` to filter only by unique columns.
  - `onConflict` now will require columns for `merge`, and it can also accept a constraint name.

  See the BREAKING_CHANGE.md at orchid-orm 1.26 at the repository root for details.

## 0.13.4

### Patch Changes

- 907b2b8: Synchronize libraries by publishing them

## 0.13.3

### Patch Changes

- 465827b1: Fix code generation for `timestamps()` with custom name (#256)

## 0.13.2

### Patch Changes

- 14465bf7: Allow to customize timestamps names (#256)

## 0.13.1

### Patch Changes

- 0a2795d6: Implicit join lateral (#247)

## 0.13.0

### Minor Changes

- ba3d9c2e: Change behavior of `set` inside `update` in `hasMany` and `hasAndBelongsToMany` relations for when empty array or empty object is given.
  Before, empty array/object was setting to all records, which is a bug.
  Now, empty array/object means "set to no records".
  It will nullify all connected records' foreign keys for `hasMany` and will delete all join table records for `hasAndBelongsToMany`.

## 0.12.4

### Patch Changes

- 79da9a41: Re-export orchid-core from orchid-orm for compatibility

## 0.12.3

### Patch Changes

- ff771568: Minor column type fix for proper default columns in rake-db

## 0.12.2

### Patch Changes

- 7e7fb35c: Add command `up force` for timestamp migrations

## 0.12.1

### Patch Changes

- 012752d0: Add valibot integration

## 0.12.0

### Minor Changes

- 851e840e: Significantly optimize types

## 0.11.2

### Patch Changes

- 32d1a3be: `makeHelper`: ignore input table alias (#232)

## 0.11.1

### Patch Changes

- 87ef1c7f: Add connectRetry connection option

## 0.11.0

### Minor Changes

- 4c7015b4: Support multiple column schemas for various cases

## 0.10.17

### Patch Changes

- 003de3d6: Add the `scopes` feature

## 0.10.16

### Patch Changes

- 46382c24: Re-export everything from pqb in orchid-orm

## 0.10.15

### Patch Changes

- 057b1b5a: Change type of `Query.meta.defaults` from union of string literals to `Record<string, true>`, it is a more correct type for this case and it solves (#213)

## 0.10.14

### Patch Changes

- 96a6d588: Fix `defaults` type for optional columns (#196)

## 0.10.13

### Patch Changes

- 3eb3705e: Fix columnTypes type in RawSQL (#201)

## 0.10.12

### Patch Changes

- 0ce2a897: Optimize exported types of columns and column methods by explicitly writing them instead of inferring

## 0.10.11

### Patch Changes

- 7f39e294: Remove computed columns from the table shape for create and update in ORM (#188)

## 0.10.10

### Patch Changes

- 56c5ff9f: Add computed columns (#59)

## 0.10.9

### Patch Changes

- 2343dad6: Serialize the default value with the encoding function of the column (#183)

## 0.10.8

### Patch Changes

- 4debeb31: Add insert methods that do all the same as create methods, but return row count by default

## 0.10.7

### Patch Changes

- 71a805af: Change db functions to be available equally on the query itself, in select, in having, and to be chainable with column operators

## 0.10.6

### Patch Changes

- d733e029: Encode JSON columns with JSON.stringify (#175)

## 0.10.5

### Patch Changes

- 5c3fb301: Remove `default` type from the `primaryKey` column method result (#174)

## 0.10.4

### Patch Changes

- 2d383dc6: Add `hasDefault` column method (#168)

## 0.10.3

### Patch Changes

- 07448a7f: Add `.asType` to column builder

## 0.10.2

### Patch Changes

- 52ee35f4: Better support of default(null) (#159)

## 0.10.1

### Patch Changes

- 435ec9c1: Add Selectable, Insertable, Updatable, Queryable utility types. Remove TableType.

## 0.10.0

### Minor Changes

- 83cf51c2: Rename `toSql` to `toSQL`

## 0.9.1

### Patch Changes

- 23558c67: Support parsing a column into a different type, while letting to filter by an original type (#140)

## 0.9.0

### Minor Changes

- ed4ab58c: Fixed issue where trying to set updatedAt on a table with snakecase resulted in error (#144)

## 0.8.2

### Patch Changes

- a9e48cd8: Support `create`, `update`, `delete` sub-queries in update (#139)

## 0.8.1

### Patch Changes

- d1dad50d: Accept RawSQL object in db.query (#138)

## 0.8.0

### Minor Changes

- b7a2d035: Remove JSON types that doesn't make sense for JSON, such as `date`, `map`, `set`

## 0.7.1

### Patch Changes

- 2d860221: Add support for generated columns and for the full text search

## 0.7.0

### Minor Changes

- 1b3e98a5: Upgrade aggregate and window functions, having clause

## 0.6.2

### Patch Changes

- ccc5e2aa: Allow raw sql and values in a single parameter.

## 0.6.1

### Patch Changes

- 7a201dfc: Expose `client` object of the database adapter in the transaction object (#133)
- 52fe89e5: Rename query data structure from `query` to `q` to use the `query` for different purpose
- 1e0e7e7a: Add `$query` and `$queryArrays` fn to the ORM, add `query` and `queryArrays` to `pqb` db.

## 0.6.0

### Minor Changes

- b178ee7: Change type and behavior of raw SQL methods for the better

## 0.5.2

### Patch Changes

- a7baab8: Fix `getCallerFilePath` to correctly find out a caller library path

## 0.5.1

### Patch Changes

- 695f390: Internal change: change filePath property of BaseTable and extended tables to the getFilePath method

## 0.5.0

### Minor Changes

- 78b65c4: Add query hooks that can select data, run inside transaction, and after commit (#83)

## 0.4.14

### Patch Changes

- d16ab35: Add `tranform` method to transform query results (#93)

## 0.4.13

### Patch Changes

- 2881707: Add `makeHelper` function to define query helper

## 0.4.12

### Patch Changes

- e9a4095: Change column.parse function to also process null values

## 0.4.11

### Patch Changes

- 4893640: Rename addParserToQuery to setParserToQuery, add overrideParserInQuery (#92)

## 0.4.10

### Patch Changes

- 0535450: Fix `then` and `catch` methods

## 0.4.9

### Patch Changes

- 4287137: Add `sql` method to accept raw SQL via template literals

## 0.4.8

### Patch Changes

- 9610b44: Add code comments

## 0.4.7

### Patch Changes

- 23d8a2a: Fix `nowSQL` to be wrapped into parens automatically

## 0.4.6

### Patch Changes

- Allow to customize timestamp default value with `nowSQL` option of base table

## 0.4.5

### Patch Changes

- Change `createFactory` to `tableFactory` and `ormFactory`; Add factory.buildMany and factory.createMany

## 0.4.4

### Patch Changes

- Rename timestampWithoutTimezone to timestampNoTZ; Add methods for it

## 0.4.3

### Patch Changes

- Support joining a relation with a callback

## 0.4.2

### Patch Changes

- Make passing this not required when customizing column types

## 0.4.1

### Patch Changes

- Support selecting full joined record

## 0.4.0

### Minor Changes

- Change appCodeUpdater config to take path and name of the base table from baseTable option

## 0.3.1

### Patch Changes

- Accept string, number, Date in date time columns

## 0.3.0

### Minor Changes

- Support overriden column types in rake-db

## 0.2.0

### Minor Changes

- Implicitly pass transaction object by using AsyncLocalStorage

## 0.1.17

### Patch Changes

- Initial support for db views

## 0.1.16

### Patch Changes

- Favor timestamptz over timestamp

## 0.1.15

### Patch Changes

- Support identity columns

## 0.1.14

### Patch Changes

- Use gen_random_uuid as a default uuid default

## 0.1.13

### Patch Changes

- Remove undefined and void from json schema

## 0.1.12

### Patch Changes

- Support db table checks and constraints

## 0.1.11

### Patch Changes

- Improve join arg types

## 0.1.10

### Patch Changes

- Improve onConflict without argument behavior

## 0.1.9

### Patch Changes

- Fix generating enum column from db pull to ORM
- c8df1f9: Fix camelCase and PascalCase table names in codegen

## 0.1.8

### Patch Changes

- Support validation error messages

## 0.1.7

### Patch Changes

- Fix handling undefined values in foreign key when pulling db

## 0.1.6

### Patch Changes

- Support snakeCase option

## 0.1.5

### Patch Changes

- Support runtime default; Add createManyRaw and createManyFrom

## 0.1.4

### Patch Changes

- Support domain types

## 0.1.3

### Patch Changes

- Support database CHECK validation

## 0.1.2

### Patch Changes

- Add log to appCodeUpdater, change file pathes to urls when logging

## 0.1.1

### Patch Changes

- Fix build of orchid-core

## 0.1.0

### Minor Changes

- Move common code into separate orchid-core package
