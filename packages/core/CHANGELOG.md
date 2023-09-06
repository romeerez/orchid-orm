# orchid-core

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

- 435ec9c1: Add Selectable, Insertable, Updateable, Queryable utility types. Remove TableType.

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
