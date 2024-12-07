# pqb

## 0.43.4

### Patch Changes

- 340a1cb: Discard 'map' and 'transform' when applying aggregations (#440)
- 07290ae: Add search operators for array column type (#441)

## 0.43.3

### Patch Changes

- c46e693: Fix upsert (#438)

## 0.43.2

### Patch Changes

- 529abe0: Optimize orCreate and upsert (#431)
- 9c58c3b: Fix bytea parsing in nested select (#437)
- e02df5e: Fix TS type when selecting multiple nested selections. Allow accessing column from a different query in `ref`. (#430)
- 26d8b2e: Pass records to query hooks even when nothing is selected (#436)
- 64826ba: Conditional select with `if` (#433)
- 2b3ae9b: Fix integration between upsert and query hooks (#434)
- Updated dependencies [e02df5e]
  - orchid-core@0.21.5

## 0.43.1

### Patch Changes

- d0b5653: Support `autoForeignKeys` option (#322)
- 8313205: Db checks fixes, support many checks on a single column (#418)
- Updated dependencies [8313205]
  - orchid-core@0.21.4

## 0.43.0

### Minor Changes

- e9ee271: Require select before using group (#428)
- bf894cb: Change `group` to reference selected values with a precedence over table columns (#429)

### Patch Changes

- 8c364ed: Fix TS error when selecting a column after selecting object (#428)

## 0.42.9

### Patch Changes

- Updated dependencies [6b780dd]
  - orchid-core@0.21.3

## 0.42.8

### Patch Changes

- 4935042: Support `EXCLUDE` constraints (#419)

## 0.42.7

### Patch Changes

- c8699da: Support generation migration for generated columns (#424)
- Updated dependencies [c8699da]
  - orchid-core@0.21.2

## 0.42.6

### Patch Changes

- a97ebe8: Fix makeHelper/repo in a nested select on same table (#423)

## 0.42.5

### Patch Changes

- f912552: Update build target to es2020 (node v14+)

## 0.42.4

### Patch Changes

- 6210ae0: Make test factories usable disregarding of validation library (#245)

## 0.42.3

### Patch Changes

- c52fdb1: Add `$isInTransaction` (#411)

## 0.42.2

### Patch Changes

- 442061f: Simplify return types in a shallow way to support branded types (#412)
- Updated dependencies [442061f]
  - orchid-core@0.21.1

## 0.42.1

### Patch Changes

- 0d88002: Support parsing db array of jsonb type (#415)

## 0.42.0

### Minor Changes

- 5cd5ac1: Add `queryRelated` and `chain` instead of implicit relation chaining (#351), (#337)

### Patch Changes

- Updated dependencies [5cd5ac1]
  - orchid-core@0.21.0

## 0.41.6

### Patch Changes

- ab7ad6b: Fix typing error in softDelete

## 0.41.5

### Patch Changes

- 74c1232: Support placing select after create/update/delete (#361)
- Updated dependencies [74c1232]
  - orchid-core@0.20.1

## 0.41.4

### Patch Changes

- 374bb5d: Don't log ROLLBACK for error in after\*Commit (#376)

## 0.41.3

### Patch Changes

- 7af0640: Fix `transform`ing value of the samee table in select (#384)

## 0.41.2

### Patch Changes

- 19975ae: Fix typing when defining a non-unique index and a unique one (#392)

## 0.41.1

### Patch Changes

- 6685176: Fix `makeHelper` to respect `hasWhere` and `hasSelect` of both queries of the equasion (#403)

## 0.41.0

### Minor Changes

- d89252d: Stop handling null in column `parse`, add `parseNull` for this instead (#405), (#96)

### Patch Changes

- Updated dependencies [d89252d]
  - orchid-core@0.20.0

## 0.40.12

### Patch Changes

- 0e06547: Support selecting a relation with the same name as the outer table (#407)

## 0.40.11

### Patch Changes

- 1bfe969: Prevent computed columns from getting into default select, and some other snake_case related fixes (#404)

## 0.40.10

### Patch Changes

- 0ab781e: Support whereExists with a single fn argument (#395)

## 0.40.9

### Patch Changes

- d288a45: Add `select(false)` for columns (#393)
- Updated dependencies [d288a45]
  - orchid-core@0.19.13

## 0.40.8

### Patch Changes

- 2218208: Add `ensureTransaction` (#398)

## 0.40.7

### Patch Changes

- 77ab544: Fix quoting empty array in migration (#390)

## 0.40.6

### Patch Changes

- 890dfb4: Add basic support for postgis geography point type
- Updated dependencies [890dfb4]
  - orchid-core@0.19.12

## 0.40.5

### Patch Changes

- dcbd839: Support ignoring table from migration generator

## 0.40.4

### Patch Changes

- b822dd0: Support citext column in generator

## 0.40.3

### Patch Changes

- 5f14844: Do not call query `map` for empty (undefined) query results (#387)
- c6a8975: Support returning scalars from query `map` (#386)
- Updated dependencies [5f14844]
- Updated dependencies [c6a8975]
  - orchid-core@0.19.11

## 0.40.2

### Patch Changes

- 68d1f07: Fix transform on aggregated values (#389)

## 0.40.1

### Patch Changes

- 041f3ac: More precise arg types for aggregate functions + fix parse null for arrgay and money (#391, #353)
- Updated dependencies [041f3ac]
  - orchid-core@0.19.10

## 0.40.0

### Minor Changes

- d7c98b5: Use ARRAY[] for arrays, support native JS bigint for raw values.

## 0.39.4

### Patch Changes

- 2bff8da: Handle after commit hooks inside test transaction without user transaction (#375)

## 0.39.3

### Patch Changes

- c8f9549: Handle after commit hook errors, add `catchAfterCommitError` (#376)
- 216a42a: Fix `onConflict` type error when the table has a composite index (#381)
- Updated dependencies [c8f9549]
- Updated dependencies [b61b6ba]
  - orchid-core@0.19.9

## 0.39.2

### Patch Changes

- c8b03d9: Fix type parsing for SQL computeds (#380)

## 0.39.1

### Patch Changes

- 109287f: Fix text array parsing (#371)
- 9cf9a6d: Make ORM error property `query` to be private to fix serializing problem of Jest (#373)
- Updated dependencies [9dff1fa]
  - orchid-core@0.19.8

## 0.39.0

### Minor Changes

- edfa4cb: Select empty record with empty `select()` (#364)

## 0.38.8

### Patch Changes

- 60596d1: Support JS BigInt in create/update/increment (#365)

## 0.38.7

### Patch Changes

- 8e600c8: Fix `sql` exported from BaseTable and deprecate `sql` as a query method (#336)
  - orchid-core@0.19.7

## 0.38.6

### Patch Changes

- 1de9370: Allow numeric columns in numeric aggregations and in increment (#356)

## 0.38.5

### Patch Changes

- ae0cc21: Fix `afterCreateCommit` (#355)
- Updated dependencies [ae0cc21]
  - orchid-core@0.19.7

## 0.38.4

### Patch Changes

- dec67df: Fix js computed columns when querying `get` (#346)

## 0.38.3

### Patch Changes

- 279f556: Fix empty where when soft deleting and having empty object in where (#347)

## 0.38.2

### Patch Changes

- 15ce29a: Fix `asDate` type to keep base column types (#350)

## 0.38.1

### Patch Changes

- d163e5a: Fix jsonPathQueryFirst type casting when applying a text operator (#343)

## 0.38.0

### Minor Changes

- f8a45d1: Escape special chars in LIKE, allow LIKE for jsonb columns (#342)

## 0.37.0

### Minor Changes

- dc1fb10: Change join behavior so that unprefixed columns are always addressed to the joining table

## 0.36.16

### Patch Changes

- d401313: Make varchar limit optional (#331)
- 637b970: Fix incorrect whereExist query wrapping into a sub query (#333)
- 1073559: Fix: prevent calling `encode` with undefined when creating (#340)
- 684945e: Fix inserting multiple empty records (#339)
- Updated dependencies [d401313]
  - orchid-core@0.19.6

## 0.36.15

### Patch Changes

- 2dca8a5: Change repository types to allow reassigning queries in some cases (#329)
- Updated dependencies [2dca8a5]
  - orchid-core@0.19.5

## 0.36.14

### Patch Changes

- c35175b: Fix `jsonSet` and similar methods for snake case columns (#327)
- b372aaa: Respect `nowSQL` option in soft delete (#328)

## 0.36.13

### Patch Changes

- b658f19: Fix QueryResultType type (#319)

## 0.36.12

### Patch Changes

- 81af2e1: Fix overriding return type when merging queries (#320)

## 0.36.11

### Patch Changes

- 86aead8: Fix deeply nested select \* (#322)

## 0.36.10

### Patch Changes

- Updated dependencies [3db10bd]
  - orchid-core@0.19.4

## 0.36.9

### Patch Changes

- 6bbea86: Fix create result type for tables without relations (#317)

## 0.36.8

### Patch Changes

- 1285118: Fix migration gen: handle column changes together with primaryKey/index/foreignKey/check changes (#316)
- Updated dependencies [1285118]
  - orchid-core@0.19.3

## 0.36.7

### Patch Changes

- e7656c4: Fix migration generation for array columns

## 0.36.6

### Patch Changes

- 15cdb45: Fix callback arg typing in update for a table without relations (#311)

## 0.36.5

### Patch Changes

- 690ecad: Fix passing a callback for a belongsTo foreign key in create

## 0.36.4

### Patch Changes

- c9697c9: Add `whereOneOf` method

## 0.36.3

### Patch Changes

- aa9ee08: Fix using `val` query helper inside select
- Updated dependencies [aa9ee08]
  - orchid-core@0.19.2

## 0.36.2

### Patch Changes

- 57e9e9c: Allow setting `log: true` for a transaction
- Updated dependencies [57e9e9c]
  - orchid-core@0.19.1

## 0.36.1

### Patch Changes

- 8d076c6: Fix typings for selecting all columns and object (#310)

## 0.36.0

### Minor Changes

- f278b19: Improve column casting to snake case in migrations and code gen:

  When the `snakeCase` option is enabled, columns can be written in camelCase in all contexts,
  and will be translated to snake_case.

  This includes columns in primary keys, indexes, foreign keys options.

### Patch Changes

- Updated dependencies [f278b19]
  - orchid-core@0.19.0

## 0.35.7

### Patch Changes

- 3b9228c: Fix nested aliased select return type

## 0.35.6

### Patch Changes

- 1663d8b: Fix selecting count of a joined table

## 0.35.5

### Patch Changes

- Updated dependencies [e8682bf]
  - orchid-core@0.18.2

## 0.35.4

### Patch Changes

- b54bca1: Change types to allow using `Table` type for generics (#301)

## 0.35.3

### Patch Changes

- 7546bc8: Simplify output types
- Updated dependencies [7546bc8]
  - orchid-core@0.18.1

## 0.35.2

### Patch Changes

- c2ee6a9: Removing `primaryKey`, `foreignKey`, `associationForeignKey`, and such, as options for `belongsTo`, `hasMany`, etc.

## 0.35.1

### Patch Changes

- 8cde8eb: Fix: don't mutate query when selecting a computed column

## 0.35.0

### Minor Changes

- 8dd2832: JS computed columns;

  Change `returnType` type to be `undefined` by default.

### Patch Changes

- Updated dependencies [8dd2832]
  - orchid-core@0.18.0

## 0.34.0

### Minor Changes

- 9eb720a: Change `text`, `varchar` types, remove `char` (#277)

  The text no longer accepts min and max: `text(min, max)` -> `text()`

  Varchar's limit becomes required: `varchar(limit?: number)` -> `varchar(limit: number)`

### Patch Changes

- Updated dependencies [9eb720a]
  - orchid-core@0.17.0

## 0.33.2

### Patch Changes

- 353d06a: Fix `json` column type to accept an interface type (#295)

## 0.33.1

### Patch Changes

- 9c82aca: Add `map` helper method similar to `transform` (#281)
- Updated dependencies [9c82aca]
  - orchid-core@0.16.1

## 0.33.0

### Minor Changes

- ee49636: json\* methods rework (#287)

### Patch Changes

- Updated dependencies [ee49636]
  - orchid-core@0.16.0

## 0.32.0

### Minor Changes

- fb7fdf6: Don't JSON.stringify null values for JSON columns (#290)

## 0.31.9

### Patch Changes

- d42bdb3: Fix inserting record with a raw SQL for a json column (#291)

## 0.31.8

### Patch Changes

- 61215ad: Auto-batch inserts when exceeding max binding params limit (#288)
- Updated dependencies [61215ad]
  - orchid-core@0.15.6

## 0.31.7

### Patch Changes

- 9e3f1c9: Make `DO NOTHING` for `merge` when all columns are excluded (#282)

## 0.31.6

### Patch Changes

- 8f06156: Exclude ON CONFLICT target from merge's UPDATE SET (#282)

## 0.31.5

### Patch Changes

- d5390af: Update order and group to not prefix column with table when the column was selected with an expression (#283)

## 0.31.4

### Patch Changes

- 16cbe41: `orWhere` fixes (#278)

## 0.31.3

### Patch Changes

- 77f0c75: rake-db: fix auto schema migration when migrating; fix default column validation schema

## 0.31.2

### Patch Changes

- f0b1e0e: Make `then` configurable to make mocking possible

## 0.31.1

### Patch Changes

- 6a0d06d: Support accessing WITH table value in create, update, delete
- Updated dependencies [6a0d06d]
  - orchid-core@0.15.5

## 0.31.0

### Minor Changes

- f27f8c4: Change `union` and `with`, add `withRecursive` and `withSql`.

  See updated docs for [union](https://orchid-orm.netlify.app/guide/advanced-queries#union-unionall-intersect-intersectall-except-exceptall)
  and [with](https://orchid-orm.netlify.app/guide/advanced-queries.html#with).

## 0.30.7

### Patch Changes

- 5a21099: Accept building expressions in create and update column callbacks
- 5a21099: Support joining relation with alias
- Updated dependencies [5a21099]
- Updated dependencies [5a21099]
  - orchid-core@0.15.4

## 0.30.6

### Patch Changes

- 147091d: Resolve empty whereIn into a none query, handle none query in various selecting and joining cases (#266)
- Updated dependencies [147091d]
  - orchid-core@0.15.3

## 0.30.5

### Patch Changes

- 859c4cd: Accept readonly arrays in enum type (#269)

## 0.30.4

### Patch Changes

- 8095627: Support query builder in `where` column callback:

  ```ts
  db.user.where({
    firstName: (q) => q.ref('lastName'),
  });
  ```

## 0.30.3

### Patch Changes

- 98ad6a6: Change `fn`, export `sql` from the `BaseTable`

  The `fn` query builder accepted a column type via parameter, now it accepts the type via `type` method, see [docs](https://orchid-orm.netlify.app/guide/sql-expressions#fn).

  Instead of importing `raw` from 'orchid-core', as was documented before, export `sql` helper from your `BaseTable` file:

  ```ts
  import { createBaseTable } from 'orchid-orm';

  export const BaseTable = createBaseTable();

  export const { sql } = BaseTable;
  ```

- Updated dependencies [98ad6a6]
  - orchid-core@0.15.2

## 0.30.2

### Patch Changes

- 8ef6411: Support using selected aggregated value of relation in `where`

  ```ts
  await db.post
    .select({ commentsCount: (q) => q.comments.count() })
    // using `commentsCount` in the `where` wasn't supported previously:
    .where({ commentsCount: { gt: 5 } })
    .order({ commentsCount: 'DESC' });
  ```

- 6ee467f: Add `narrowType` query helper

## 0.30.1

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

- Updated dependencies [4e9082f]
  - orchid-core@0.15.1

## 0.30.0

### Minor Changes

- e92cebd: In snake_case mode, make `timestamps()` helper to snakerize a column key instead of default `created_at` and `updated_at`

### Patch Changes

- Updated dependencies [e92cebd]
  - orchid-core@0.15.0

## 0.29.1

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

- Updated dependencies [bdef5b0]
  - orchid-core@0.14.1

## 0.29.0

### Minor Changes

- 1aa1fb3: `onConflict` changes:

  - `onConflictIgnore` is renamed to `onConflictDoNothing` (was closer to Knex, becomes closer to SQL).
  - `onConflict(...).merge` no longer accepts a set for update, only columns for merging.
  - New `onConflict(...).set`: use `set` for setting specific values instead of `merge` as it was previously.
  - `onConflict(...).merge` now can also accept `{ except: string | string[] }` to merge all values except for specified.

## 0.28.0

### Minor Changes

- e254c22: - Rework composite indexes, primary and foreign keys.

  - Change `findBy` to filter only by unique columns.
  - `onConflict` now will require columns for `merge`, and it can also accept a constraint name.

  See the BREAKING_CHANGE.md at orchid-orm 1.26 at the repository root for details.

### Patch Changes

- Updated dependencies [e254c22]
  - orchid-core@0.14.0

## 0.27.7

### Patch Changes

- 907b2b8: Synchronize libraries by publishing them
- Updated dependencies [907b2b8]
  - orchid-core@0.13.4

## 0.27.6

### Patch Changes

- 05590044: Fix bug in nested `whereExists` when relation uses alias
- c94339ad: Support empty array arg in createMany and insertMany (#260)

## 0.27.5

### Patch Changes

- 2385c314: Hide default `parse` method from code generated for timestamps

## 0.27.4

### Patch Changes

- 465827b1: Fix code generation for `timestamps()` with custom name (#256)
- Updated dependencies [465827b1]
  - orchid-core@0.13.3

## 0.27.3

### Patch Changes

- 14465bf7: Allow to customize timestamps names (#256)
- Updated dependencies [14465bf7]
  - orchid-core@0.13.2

## 0.27.2

### Patch Changes

- 0a2795d6: Implicit join lateral (#247)
- Updated dependencies [0a2795d6]
  - orchid-core@0.13.1

## 0.27.1

### Patch Changes

- ca5d8543: Fix json sub-queries for tables with a default scope

  Specifically, this fixes selecting relation data from a table that has `softDelete` enabled.

## 0.27.0

### Minor Changes

- ba3d9c2e: Change behavior of `set` inside `update` in `hasMany` and `hasAndBelongsToMany` relations for when empty array or empty object is given.
  Before, empty array/object was setting to all records, which is a bug.
  Now, empty array/object means "set to no records".
  It will nullify all connected records' foreign keys for `hasMany` and will delete all join table records for `hasAndBelongsToMany`.

### Patch Changes

- Updated dependencies [ba3d9c2e]
  - orchid-core@0.13.0

## 0.26.7

### Patch Changes

- 79da9a41: Re-export orchid-core from orchid-orm for compatibility
- Updated dependencies [79da9a41]
  - orchid-core@0.12.4

## 0.26.6

### Patch Changes

- f6dacede: Fix type in valibot

## 0.26.5

### Patch Changes

- 04e441da: Fix parsing columns of joined record

## 0.26.4

### Patch Changes

- ff771568: Minor column type fix for proper default columns in rake-db
- Updated dependencies [ff771568]
  - orchid-core@0.12.3

## 0.26.3

### Patch Changes

- 216988fc: Support passing join callback arg to repo (#247)

## 0.26.2

### Patch Changes

- Updated dependencies [7e7fb35c]
  - orchid-core@0.12.2

## 0.26.1

### Patch Changes

- f0324edb: Ignore duplicate joins (#242)

## 0.26.0

### Minor Changes

- 012752d0: Add valibot integration

### Patch Changes

- Updated dependencies [012752d0]
  - orchid-core@0.12.1

## 0.25.1

### Patch Changes

- 404dda21: Separate query methods accepting SQL template

## 0.25.0

### Minor Changes

- 46809633: Fix nested subquery `where` problem (#222)

## 0.24.1

### Patch Changes

- cc95e071: Prevent internal query builder error when passing wrong column to subquery select (#236)

## 0.24.0

### Minor Changes

- 851e840e: Significantly optimize types

### Patch Changes

- Updated dependencies [851e840e]
  - orchid-core@0.12.0

## 0.23.5

### Patch Changes

- 32d1a3be: `makeHelper`: ignore input table alias (#232)
- Updated dependencies [32d1a3be]
  - orchid-core@0.11.2

## 0.23.4

### Patch Changes

- 87ef1c7f: Add connectRetry connection option
- Updated dependencies [87ef1c7f]
  - orchid-core@0.11.1

## 0.23.3

### Patch Changes

- 3a3a5d9c: Fix where relation column inside where exits typing

## 0.23.2

### Patch Changes

- d85a5492: Fix jsonSet inside update for default column types

## 0.23.1

### Patch Changes

- 125e17d5: Support null in `jsonPath` operator

## 0.23.0

### Minor Changes

- 74be332e: Optimize types

## 0.22.1

### Patch Changes

- cbe9ad6b: Remove mutative (starting with \_) query methods to make it a bit more lightweight for TS checker

## 0.22.0

### Minor Changes

- 4c7015b4: Support multiple column schemas for various cases

### Patch Changes

- Updated dependencies [4c7015b4]
  - orchid-core@0.11.0

## 0.21.0

### Minor Changes

- c865fa77: Add `softDelete`, rename `unScope` to `unscope`, remove `del` in favor of `delete` (#205)

## 0.20.1

### Patch Changes

- e436974f: Fix scopes: it was mutating query data

## 0.20.0

### Minor Changes

- d6819aa9: Fix `whereNot` behavior to negate a whole condition group

## 0.19.1

### Patch Changes

- 003de3d6: Add the `scopes` feature
- Updated dependencies [003de3d6]
  - orchid-core@0.10.17

## 0.19.0

### Minor Changes

- 49780b94: Support loading of chained relations (#173)

## 0.18.34

### Patch Changes

- 46382c24: Re-export everything from pqb in orchid-orm
- Updated dependencies [46382c24]
  - orchid-core@0.10.16

## 0.18.33

### Patch Changes

- 19bff227: Improve codegen: update relations syntax, output `string` for string column instead of `varchar`

## 0.18.32

### Patch Changes

- 3c089403: Make `delete` to throw when not found when it's chained with `take`, `find`, `findBy`, `value`

## 0.18.31

### Patch Changes

- e4e4f963: Add `QueryHelperResult` type helper (#215)

## 0.18.30

### Patch Changes

- 057b1b5a: Change type of `Query.meta.defaults` from union of string literals to `Record<string, true>`, it is a more correct type for this case and it solves (#213)
- Updated dependencies [057b1b5a]
  - orchid-core@0.10.15

## 0.18.29

### Patch Changes

- f3cfab1a: Support `group` by selected value (#212)

## 0.18.28

### Patch Changes

- c56498d2: Do not turn string for date and timestamp column to Date before saving (#179)

## 0.18.27

### Patch Changes

- 67bafe78: Fix transactions in Bun (#198)

## 0.18.26

### Patch Changes

- 96a6d588: Fix `defaults` type for optional columns (#196)
- Updated dependencies [96a6d588]
  - orchid-core@0.10.14

## 0.18.25

### Patch Changes

- Updated dependencies [3eb3705e]
  - orchid-core@0.10.13

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
