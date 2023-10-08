# pqb

## 0.18.24

### Patch Changes

- 0ea831ae: Return multiple records when chainging relation (#194)

## 0.18.23

### Patch Changes

- 828e22aa: Optimize `select` type. Now object is allowed only as the last arg.

## 0.18.22

### Patch Changes

- 3fcab80e: Fix belongsTo nested create type for a required relation

## 0.18.21

### Patch Changes

- 144e296d: Change generic columns type to the base form because it has conflicts when instantiating ORM

## 0.18.20

### Patch Changes

- 87a0dbae: Fix increment/decrement throwing not found error behavior (#199)

## 0.18.19

### Patch Changes

- 0ce2a897: Optimize exported types of columns and column methods by explicitly writing them instead of inferring
- Updated dependencies [0ce2a897]
  - orchid-core@0.10.12

## 0.18.18

### Patch Changes

- 7f06c119: Remove `JSON.stringify` encoder from `jsonText` column type as it's meant for JSON strings (#195)

## 0.18.17

### Patch Changes

- 7f39e294: Remove computed columns from the table shape for create and update in ORM (#188)
- Updated dependencies [7f39e294]
  - orchid-core@0.10.11

## 0.18.16

### Patch Changes

- eada7f0a: Fix timestamp comparison operators (#187)

## 0.18.15

### Patch Changes

- 56c5ff9f: Add computed columns (#59)
- Updated dependencies [56c5ff9f]
  - orchid-core@0.10.10

## 0.18.14

### Patch Changes

- 18018604: Handle updating with empty set by switching to a `SELECT` query (#185)

## 0.18.13

### Patch Changes

- 2343dad6: Serialize the default value with the encoding function of the column (#183)
- Updated dependencies [2343dad6]
  - orchid-core@0.10.9

## 0.18.12

### Patch Changes

- 2b467899: Override return type to optional when using `onConflict().ignore()` (#177)

## 0.18.11

### Patch Changes

- cb1c4c2c: Change `string` column type to be a varchar with 255 limit by default

## 0.18.10

### Patch Changes

- 4debeb31: Add insert methods that do all the same as create methods, but return row count by default
- Updated dependencies [4debeb31]
  - orchid-core@0.10.8

## 0.18.9

### Patch Changes

- 71a805af: Change db functions to be available equally on the query itself, in select, in having, and to be chainable with column operators
- Updated dependencies [71a805af]
  - orchid-core@0.10.7

## 0.18.8

### Patch Changes

- d733e029: Encode JSON columns with JSON.stringify (#175)
- Updated dependencies [d733e029]
  - orchid-core@0.10.6

## 0.18.7

### Patch Changes

- 5c3fb301: Remove `default` type from the `primaryKey` column method result (#174)
- Updated dependencies [5c3fb301]
  - orchid-core@0.10.5

## 0.18.6

### Patch Changes

- 043f0fbd: Add `data` prop and pass update data to `create` callback in `upsert` (#169)

## 0.18.5

### Patch Changes

- Updated dependencies [2d383dc6]
  - orchid-core@0.10.4

## 0.18.4

### Patch Changes

- 93006a0e: Change type of `create` for case of having multiple `belongsTo` relations to require all needed foreign keys or relation objects (#170)

## 0.18.3

### Patch Changes

- 07448a7f: Add `.asType` to column builder
- Updated dependencies [07448a7f]
  - orchid-core@0.10.3

## 0.18.2

### Patch Changes

- 64873aca: Fix generating code for json column shape (#158)

## 0.18.1

### Patch Changes

- 52ee35f4: Better support of default(null) (#159)
- Updated dependencies [52ee35f4]
  - orchid-core@0.10.2

## 0.18.0

### Minor Changes

- ec43e167: Rename `or` to `orWhere` and remove `and`

## 0.17.10

### Patch Changes

- 73b2beb8: Support a list of migrations in `rakeDb` to use for bundling (#155)

## 0.17.9

### Patch Changes

- 64a2e733: Fix update of JSON column with a sub query after using decrement (#142)

## 0.17.8

### Patch Changes

- 435ec9c1: Add Selectable, Insertable, Updateable, Queryable utility types. Remove TableType.
- Updated dependencies [435ec9c1]
  - orchid-core@0.10.1

## 0.17.7

### Patch Changes

- 634613ad: Allow multiple use of `testTransaction`

## 0.17.6

### Patch Changes

- 1688e82b: Add a dependency on "pg" and "@types/pg"
  - orchid-core@0.10.0

## 0.17.5

### Patch Changes

- f92e76ed: Support relations connected by multiple columns

## 0.17.4

### Patch Changes

- d5011e31: Add `none` method (#111)

## 0.17.3

### Patch Changes

- 3b63faac: Remove `LIMIT 1` SQL from `WHERE EXISTS` as it makes no difference here

## 0.17.2

### Patch Changes

- 607ca901: Add `modify` method to transform a query with a function (#107)

## 0.17.1

### Patch Changes

- ff06f0a6: Refactor relations types

## 0.17.0

### Minor Changes

- 83cf51c2: Rename `toSql` to `toSQL`

### Patch Changes

- Updated dependencies [83cf51c2]
  - orchid-core@0.10.0

## 0.16.6

### Patch Changes

- 52196f7d: Support searching by aggregated value in a `where` callback (#122)

## 0.16.5

### Patch Changes

- 23558c67: Support parsing a column into a different type, while letting to filter by an original type (#140)
- Updated dependencies [23558c67]
  - orchid-core@0.9.1

## 0.16.4

### Patch Changes

- Updated dependencies [ed4ab58c]
  - orchid-core@0.9.0

## 0.16.3

### Patch Changes

- a9e48cd8: Support `create`, `update`, `delete` sub-queries in update (#139)
- Updated dependencies [a9e48cd8]
  - orchid-core@0.8.2

## 0.16.2

### Patch Changes

- d1dad50d: Accept RawSQL object in db.query (#138)
- Updated dependencies [d1dad50d]
  - orchid-core@0.8.1

## 0.16.1

### Patch Changes

- 0ef20d80: Support subquery for a `where` column (#104)

## 0.16.0

### Minor Changes

- b7a2d035: Remove JSON types that doesn't make sense for JSON, such as `date`, `map`, `set`

### Patch Changes

- Updated dependencies [b7a2d035]
  - orchid-core@0.8.0

## 0.15.2

### Patch Changes

- 2d860221: Add support for generated columns and for the full text search
- Updated dependencies [2d860221]
  - orchid-core@0.7.1

## 0.15.1

### Patch Changes

- d43af0b2: Add logging to db.query, fix missing logging on a query error (#137)

## 0.15.0

### Minor Changes

- 1b3e98a5: Upgrade aggregate and window functions, having clause

### Patch Changes

- Updated dependencies [1b3e98a5]
  - orchid-core@0.7.0

## 0.14.3

### Patch Changes

- ccc5e2aa: Allow raw sql and values in a single parameter.
- Updated dependencies [ccc5e2aa]
  - orchid-core@0.6.2

## 0.14.2

### Patch Changes

- 7a201dfc: Expose `client` object of the database adapter in the transaction object (#133)
- 52fe89e5: Rename query data structure from `query` to `q` to use the `query` for different purpose
- d5dd3bd6: Allow creating records with some columns defined using a raw SQL
- 1e0e7e7a: Add `$query` and `$queryArrays` fn to the ORM, add `query` and `queryArrays` to `pqb` db.
- Updated dependencies [7a201dfc]
- Updated dependencies [52fe89e5]
- Updated dependencies [1e0e7e7a]
  - orchid-core@0.6.1

## 0.14.1

### Patch Changes

- 3b1bf602: Fix after hooks to call the function even if select is empty

## 0.14.0

### Minor Changes

- b178ee7: Change type and behavior of raw SQL methods for the better

### Patch Changes

- Updated dependencies [b178ee7]
  - orchid-core@0.6.0

## 0.13.3

### Patch Changes

- 81ebb5d: Allow calling update and delete for all records after `all` method

## 0.13.2

### Patch Changes

- Updated dependencies [a7baab8]
  - orchid-core@0.5.2

## 0.13.1

### Patch Changes

- Updated dependencies [695f390]
  - orchid-core@0.5.1

## 0.13.0

### Minor Changes

- 78b65c4: Add query hooks that can select data, run inside transaction, and after commit (#83)

### Patch Changes

- Updated dependencies [78b65c4]
  - orchid-core@0.5.0

## 0.12.5

### Patch Changes

- cbc1121: Fix `upsert` to return value when created when the query is changed with `get` (#121)

## 0.12.4

### Patch Changes

- 3116713: Throw runtime error when updating/deleting without where (#102). Export more query types (#93).

## 0.12.3

### Patch Changes

- c2d3eb0: Fix `transform` function for relations that does not have column parsers (#93)

## 0.12.2

### Patch Changes

- d16ab35: Add `tranform` method to transform query results (#93)
- Updated dependencies [d16ab35]
  - orchid-core@0.4.14

## 0.12.1

### Patch Changes

- 35c437e: Support json methods in the `update` column callback (#105)

## 0.12.0

### Minor Changes

- 96f2cef: Disallow selecting joined tables by only their names, allow selecting them as `table.*`

## 0.11.35

### Patch Changes

- 31e7d23: Add `LIMIT 1` for `get` queries

## 0.11.34

### Patch Changes

- d8bc7cf: Support sub-queries for updating and deleting records (#105)'

## 0.11.33

### Patch Changes

- 275cc73: Support nested select of the same table as above

## 0.11.32

### Patch Changes

- 2881707: Add `makeHelper` function to define query helper
- Updated dependencies [2881707]
  - orchid-core@0.4.13

## 0.11.31

### Patch Changes

- 8ae4fe3: Add pg dependency to pqb

## 0.11.30

### Patch Changes

- e9a4095: Change column.parse function to also process null values
- Updated dependencies [e9a4095]
  - orchid-core@0.4.12

## 0.11.29

### Patch Changes

- 4893640: Rename addParserToQuery to setParserToQuery, add overrideParserInQuery (#92)
- Updated dependencies [4893640]
  - orchid-core@0.4.11

## 0.11.28

### Patch Changes

- 0535450: Fix `then` and `catch` methods
- Updated dependencies [0535450]
  - orchid-core@0.4.10

## 0.11.27

### Patch Changes

- 4287137: Add `sql` method to accept raw SQL via template literals
- Updated dependencies [4287137]
  - orchid-core@0.4.9

## 0.11.26

### Patch Changes

- 2e8e2a3: Support $ syntax in raw method for column names

## 0.11.25

### Patch Changes

- a33d1a1: Update docs links in README.md and in package.json

## 0.11.24

### Patch Changes

- 83d8eed: Support defining hooks on tables (#83)

## 0.11.23

### Patch Changes

- Updated dependencies [9610b44]
  - orchid-core@0.4.8

## 0.11.22

### Patch Changes

- c7298d6: Throw when passing null or undefined to the find method

## 0.11.21

### Patch Changes

- 64353f7: Make identity column optional when creating
- 63934b5: Fix ordering and using where for the column of selected relation
- 23d8a2a: Fix `nowSQL` to be wrapped into parens automatically
- Updated dependencies [23d8a2a]
  - orchid-core@0.4.7

## 0.11.20

### Patch Changes

- Support returning data from a callback for creating record in `upsert`, `orCreate`
- e8a863d: Support `.join()` on relations to have JOIN LATERAL instead of LEFT JOIN LATERAL

## 0.11.19

### Patch Changes

- Allow to customize timestamp default value with `nowSQL` option of base table
- Updated dependencies
  - orchid-core@0.4.6

## 0.11.18

### Patch Changes

- Fix selecting a plain value from a sub query in select

## 0.11.17

### Patch Changes

- Fix aliasing relation sub queries in select; Fix ordering by selected value

## 0.11.16

### Patch Changes

- Fix selecting nested relations

## 0.11.15

### Patch Changes

- Fix selecting relation pluck with query methods like orderBy

## 0.11.14

### Patch Changes

- Handle releations selects with `JOIN LATERAL` internally
- dfc2b87: Remove ability to select a relation with a string in `select` because it may be confusing

## 0.11.13

### Patch Changes

- Change `createFactory` to `tableFactory` and `ormFactory`; Add factory.buildMany and factory.createMany
- 96504ef: Support `as` in joinLateral relation
- Updated dependencies
  - orchid-core@0.4.5

## 0.11.12

### Patch Changes

- cfdc2bb: Support nested transactions
- Add testTransaction utility for tests
  - orchid-core@0.4.4

## 0.11.11

### Patch Changes

- Rename timestampWithoutTimezone to timestampNoTZ; Add methods for it
- Updated dependencies
  - orchid-core@0.4.4

## 0.11.10

### Patch Changes

- Support joining a relation with a callback
- Updated dependencies
  - orchid-core@0.4.3

## 0.11.9

### Patch Changes

- Make passing this not required when customizing column types
- Updated dependencies
  - orchid-core@0.4.2

## 0.11.8

### Patch Changes

- Fix update method type to accept values by 'inputType' of the column instead of 'type'

## 0.11.7

### Patch Changes

- Support joinLateral

## 0.11.6

### Patch Changes

- Support selecting joined table with alias

## 0.11.5

### Patch Changes

- Change result handling to a sync function as optimization

## 0.11.4

### Patch Changes

- Support selecting full joined record
- Updated dependencies
  - orchid-core@0.4.1

## 0.11.3

### Patch Changes

- Updated dependencies
  - orchid-core@0.4.0

## 0.11.2

### Patch Changes

- Accept string, number, Date in date time columns
- Updated dependencies
  - orchid-core@0.3.1

## 0.11.1

### Patch Changes

- Updated dependencies
  - orchid-core@0.3.0

## 0.11.0

### Minor Changes

- Implicitly pass transaction object by using AsyncLocalStorage

### Patch Changes

- Updated dependencies
  - orchid-core@0.2.0

## 0.10.36

### Patch Changes

- Update dependencies

## 0.10.35

### Patch Changes

- Allow ordering by a sub-query in select

## 0.10.34

### Patch Changes

- Initial support for db views
- Updated dependencies
  - orchid-core@0.1.17

## 0.10.33

### Patch Changes

- Favor timestamptz over timestamp
- Updated dependencies
  - orchid-core@0.1.16

## 0.10.32

### Patch Changes

- Support conditional sub query result

## 0.10.31

### Patch Changes

- Support identity columns
- Updated dependencies
  - orchid-core@0.1.15

## 0.10.30

### Patch Changes

- Simplify current_timestamp, transaction_timestamp() to the equivalent now() in db pull

## 0.10.29

### Patch Changes

- Use gen_random_uuid as a default uuid default
- Updated dependencies
  - orchid-core@0.1.14

## 0.10.28

### Patch Changes

- Type-check required columns in createRaw

## 0.10.27

### Patch Changes

- Support NULLS NOT DISTINCT for unique index

## 0.10.26

### Patch Changes

- Change setting order nulls first/last

## 0.10.25

### Patch Changes

- Ignore undefined where values

## 0.10.24

### Patch Changes

- Remove undefined and void from json schema
- Updated dependencies
  - orchid-core@0.1.13

## 0.10.23

### Patch Changes

- Support db table checks and constraints
- Updated dependencies
  - orchid-core@0.1.12

## 0.10.22

### Patch Changes

- Support schema connection option

## 0.10.21

### Patch Changes

- Improve error classes

## 0.10.20

### Patch Changes

- Fix selecting value in a sub select

## 0.10.19

### Patch Changes

- Improve join arg types
- Updated dependencies
  - orchid-core@0.1.11

## 0.10.18

### Patch Changes

- Improve select and from types

## 0.10.17

### Patch Changes

- Improve onConflict without argument behavior
- Updated dependencies
  - orchid-core@0.1.10

## 0.10.16

### Patch Changes

- Fix generating enum column from db pull to ORM
- Updated dependencies
- Updated dependencies [c8df1f9]
  - orchid-core@0.1.9

## 0.10.15

### Patch Changes

- Support validation error messages
- Updated dependencies
  - orchid-core@0.1.8

## 0.10.14

### Patch Changes

- Fix handling undefined values in foreign key when pulling db
- Updated dependencies
  - orchid-core@0.1.7

## 0.10.13

### Patch Changes

- Support snakeCase option
- Updated dependencies
  - orchid-core@0.1.6

## 0.10.12

### Patch Changes

- Support selecting \*

## 0.10.11

### Patch Changes

- Support runtime default; Add createManyRaw and createManyFrom
- Updated dependencies
  - orchid-core@0.1.5

## 0.10.10

### Patch Changes

- Add citext

## 0.10.9

### Patch Changes

- 8d35851: Handle unsupported types

## 0.10.8

### Patch Changes

- Support domain types
- Updated dependencies
  - orchid-core@0.1.4

## 0.10.7

### Patch Changes

- Support database CHECK validation
- Updated dependencies
  - orchid-core@0.1.3

## 0.10.6

### Patch Changes

- Improve .unique code gen, save migration verion after db pull

## 0.10.5

### Patch Changes

- Support raw in a callback in a select

## 0.10.4

### Patch Changes

- Use readonly for table in the table class

## 0.10.3

### Patch Changes

- 384fbfc: Support enum, array columns in db pull
- Updated dependencies
  - orchid-core@0.1.2

## 0.10.2

### Patch Changes

- Fix creating belongsTo relation when id has no default

## 0.10.1

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.1

## 0.10.0

### Minor Changes

- Move common code into separate orchid-core package

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.0

## 0.9.27

### Patch Changes

- Add `raw` to column types to use in defaults

## 0.9.26

### Patch Changes

- Support join subquery

## 0.9.25

### Patch Changes

- Fix pluck in sub query

## 0.9.24

### Patch Changes

- Fix pluck subquery with empty result

## 0.9.23

### Patch Changes

- Fix returning pluck from sub query

## 0.9.22

### Patch Changes

- Fix returning related records in an extra array

## 0.9.21

### Patch Changes

- Add method $from to orm

## 0.9.20

### Patch Changes

- Fix number column operators

## 0.9.19

### Patch Changes

- Support from(query) with proper result, operators, parsers
- aa92f25: Remove `as` argument from `from` method in favor of specific `as` method

## 0.9.18

### Patch Changes

- Leave only dist in shipped packages

## 0.9.17

### Patch Changes

- Fix sub query columns parsing

## 0.9.16

### Patch Changes

- Store error stack trace in error cause

## 0.9.15

### Patch Changes

- Add createEnum and dropEnum to rake-db

## 0.9.14

### Patch Changes

- Fix TS error when using nullable type in migration

## 0.9.13

### Patch Changes

- Restructure for mysql init

## 0.9.13

### Patch Changes

- Restructure for mysql init

## 0.9.12

### Patch Changes

- Add orCreate method

## 0.9.11

### Patch Changes

- Improve code generation, fix ssl databaseUrl option

## 0.9.10

### Patch Changes

- Add init script

## 0.9.9

### Patch Changes

- Override column types via callback

## 0.9.8

### Patch Changes

- ee1961e: Make columnTypes optional in configs

## 0.9.7

### Patch Changes

- Handle table ordering by foreign key when pulling db

## 0.9.6

### Patch Changes

- Fix import timestamps issue

## 0.9.5

### Patch Changes

- Mix query builder into migration db interface

## 0.9.4

### Patch Changes

- Improve esm support

## 0.9.3

### Patch Changes

- Change package.json exports for esm support

## 0.9.2

### Patch Changes

- Improve pulling db structure

## 0.9.1

### Patch Changes

- Add command for pulling database structure into a migration

## 0.9.0

### Minor Changes

- Change index options: column or expression is required, operator renamed to opclass

### Patch Changes

- f1cd5db: Handle multiple indexes and foreignKeys of the column

## 0.8.5

### Patch Changes

- Change inner aspects of columns

## 0.8.4

### Patch Changes

- Add --code cli argument to rake-db
- Improve codegen

## 0.8.3

### Patch Changes

- Fix export

## 0.8.2

### Patch Changes

- Add code generator to change project files after migrations

## 0.8.1

### Patch Changes

- Add ability to convert columns to code

## 0.8.0

### Minor Changes

- 3f25b4d: Rename all model words to table words, because all models here are not models in OOP meaning

## 0.7.13

### Patch Changes

- Refactor create and update of relations

## 0.7.12

### Patch Changes

- Improve usability of raw SQL

## 0.7.11

### Patch Changes

- Allow to open connections after closing

## 0.7.10

### Patch Changes

- Fix incrorrect order on queries for automatic wrapping into transaction

## 0.7.9

### Patch Changes

- Set proper stack trace on errors

## 0.7.8

### Patch Changes

- Change connectionString to databaseURL option, add ssl option

## 0.7.7

### Patch Changes

- Change QueryError implemetation details

## 0.7.6

### Patch Changes

- Remove force flag from update and delete in favor of empty where

## 0.7.5

### Patch Changes

- Make text operators case insensitive by default

## 0.7.4

### Patch Changes

- Update homepage link in package.json

## 0.7.3

### Patch Changes

- Add required min and max parameters to text column

## 0.7.2

### Patch Changes

- 9b8b3d5: Prefix unique columns with sequences in test factory

## 0.7.1

### Patch Changes

- Handle tables without primary key

## 0.7.0

### Minor Changes

- 883c3e4: Add changeset
