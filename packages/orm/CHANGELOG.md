# orchid-orm

## 1.32.2

### Patch Changes

- Updated dependencies [fa0f367]
  - rake-db@2.22.2

## 1.32.1

### Patch Changes

- Updated dependencies [8d076c6]
  - pqb@0.36.1
  - rake-db@2.22.1

## 1.32.0

### Minor Changes

- f278b19: Improve column casting to snake case in migrations and code gen:

  When the `snakeCase` option is enabled, columns can be written in camelCase in all contexts,
  and will be translated to snake_case.

  This includes columns in primary keys, indexes, foreign keys options.

### Patch Changes

- Updated dependencies [f278b19]
  - rake-db@2.22.0
  - pqb@0.36.0
  - orchid-core@0.19.0

## 1.31.7

### Patch Changes

- 3b9228c: Fix nested aliased select return type
- Updated dependencies [3b9228c]
  - pqb@0.35.7
  - rake-db@2.21.8

## 1.31.6

### Patch Changes

- Updated dependencies [1663d8b]
  - pqb@0.35.6
  - rake-db@2.21.7

## 1.31.5

### Patch Changes

- Updated dependencies [e8682bf]
  - orchid-core@0.18.2
  - pqb@0.35.5
  - rake-db@2.21.6

## 1.31.4

### Patch Changes

- b54bca1: Change types to allow using `Table` type for generics (#301)
- Updated dependencies [b54bca1]
  - pqb@0.35.4
  - rake-db@2.21.5

## 1.31.3

### Patch Changes

- 7546bc8: Simplify output types
- Updated dependencies [7546bc8]
  - pqb@0.35.3
  - orchid-core@0.18.1
  - rake-db@2.21.4

## 1.31.2

### Patch Changes

- c2ee6a9: Removing `primaryKey`, `foreignKey`, `associationForeignKey`, and such, as options for `belongsTo`, `hasMany`, etc.
- Updated dependencies [c2ee6a9]
  - pqb@0.35.2
  - rake-db@2.21.3

## 1.31.1

### Patch Changes

- Updated dependencies [8cde8eb]
  - pqb@0.35.1
  - rake-db@2.21.2

## 1.31.0

### Minor Changes

- 8dd2832: JS computed columns;

  Change `returnType` type to be `undefined` by default.

### Patch Changes

- Updated dependencies [8dd2832]
  - pqb@0.35.0
  - orchid-core@0.18.0
  - rake-db@2.21.1

## 1.30.0

### Minor Changes

- 9eb720a: Change `text`, `varchar` types, remove `char` (#277)

  The text no longer accepts min and max: `text(min, max)` -> `text()`

  Varchar's limit becomes required: `varchar(limit?: number)` -> `varchar(limit: number)`

### Patch Changes

- Updated dependencies [9eb720a]
  - rake-db@2.21.0
  - pqb@0.34.0
  - orchid-core@0.17.0

## 1.29.2

### Patch Changes

- Updated dependencies [353d06a]
  - pqb@0.33.2
  - rake-db@2.20.29

## 1.29.1

### Patch Changes

- Updated dependencies [9c82aca]
  - pqb@0.33.1
  - orchid-core@0.16.1
  - rake-db@2.20.28

## 1.29.0

### Minor Changes

- ee49636: json\* methods rework (#287)

### Patch Changes

- Updated dependencies [ee49636]
  - pqb@0.33.0
  - orchid-core@0.16.0
  - rake-db@2.20.27

## 1.28.14

### Patch Changes

- Updated dependencies [fb7fdf6]
  - pqb@0.32.0
  - rake-db@2.20.26

## 1.28.13

### Patch Changes

- Updated dependencies [d42bdb3]
  - pqb@0.31.9
  - rake-db@2.20.25

## 1.28.12

### Patch Changes

- Updated dependencies [61215ad]
  - rake-db@2.20.24
  - pqb@0.31.8
  - orchid-core@0.15.6

## 1.28.11

### Patch Changes

- Updated dependencies [9e3f1c9]
  - pqb@0.31.7
  - rake-db@2.20.23

## 1.28.10

### Patch Changes

- Updated dependencies [8f06156]
  - pqb@0.31.6
  - rake-db@2.20.22

## 1.28.9

### Patch Changes

- Updated dependencies [d5390af]
  - pqb@0.31.5
  - rake-db@2.20.21

## 1.28.8

### Patch Changes

- 16cbe41: `orWhere` fixes (#278)
- Updated dependencies [16cbe41]
  - pqb@0.31.4
  - rake-db@2.20.20

## 1.28.7

### Patch Changes

- Updated dependencies [b8589cd]
  - rake-db@2.20.19

## 1.28.6

### Patch Changes

- 76a0838: Fix getting `snakeCase` from BaseTable in rake-db (#279)
- Updated dependencies [76a0838]
  - rake-db@2.20.18

## 1.28.5

### Patch Changes

- Updated dependencies [6b484a9]
  - rake-db@2.20.17

## 1.28.4

### Patch Changes

- Updated dependencies [77f0c75]
  - rake-db@2.20.16
  - pqb@0.31.3

## 1.28.3

### Patch Changes

- 5557bf5: rake-db: strip duplicated primary keys from composite pkey SQL
- c7dc1ef: Fix code gen for multiple has and belongs to many relations
- Updated dependencies [5557bf5]
  - rake-db@2.20.15

## 1.28.2

### Patch Changes

- Updated dependencies [f0b1e0e]
  - pqb@0.31.2
  - rake-db@2.20.14

## 1.28.1

### Patch Changes

- Updated dependencies [6a0d06d]
  - pqb@0.31.1
  - orchid-core@0.15.5
  - rake-db@2.20.13

## 1.28.0

### Minor Changes

- f27f8c4: Change `union` and `with`, add `withRecursive` and `withSql`.

  See updated docs for [union](https://orchid-orm.netlify.app/guide/advanced-queries#union-unionall-intersect-intersectall-except-exceptall)
  and [with](https://orchid-orm.netlify.app/guide/advanced-queries.html#with).

### Patch Changes

- Updated dependencies [f27f8c4]
  - pqb@0.31.0
  - rake-db@2.20.12

## 1.27.10

### Patch Changes

- 5a21099: Accept building expressions in create and update column callbacks
- 5a21099: Support joining relation with alias
- Updated dependencies [5a21099]
- Updated dependencies [5a21099]
  - pqb@0.30.7
  - orchid-core@0.15.4
  - rake-db@2.20.11

## 1.27.9

### Patch Changes

- 147091d: Resolve empty whereIn into a none query, handle none query in various selecting and joining cases (#266)
- Updated dependencies [147091d]
  - pqb@0.30.6
  - orchid-core@0.15.3
  - rake-db@2.20.10

## 1.27.8

### Patch Changes

- Updated dependencies [56f5fb8]
  - rake-db@2.20.9

## 1.27.7

### Patch Changes

- Updated dependencies [2d0da7b]
  - rake-db@2.20.8

## 1.27.6

### Patch Changes

- Updated dependencies [859c4cd]
  - pqb@0.30.5
  - rake-db@2.20.7

## 1.27.5

### Patch Changes

- Updated dependencies [8095627]
  - pqb@0.30.4
  - rake-db@2.20.6

## 1.27.4

### Patch Changes

- 15d8796: Make `import` setting optional in rake-db when the `migration` setting is set
- Updated dependencies [15d8796]
  - rake-db@2.20.5

## 1.27.3

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
  - rake-db@2.20.4
  - pqb@0.30.3
  - orchid-core@0.15.2

## 1.27.2

### Patch Changes

- 8ef6411: Support using selected aggregated value of relation in `where`

  ```ts
  await db.post
    .select({ commentsCount: (q) => q.comments.count() })
    // using `commentsCount` in the `where` wasn't supported previously:
    .where({ commentsCount: { gt: 5 } })
    .order({ commentsCount: 'DESC' });
  ```

- Updated dependencies [8ef6411]
- Updated dependencies [6ee467f]
  - pqb@0.30.2
  - rake-db@2.20.3

## 1.27.1

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
  - pqb@0.30.1
  - orchid-core@0.15.1
  - rake-db@2.20.2

## 1.27.0

### Minor Changes

- e92cebd: In snake_case mode, make `timestamps()` helper to snakerize a column key instead of default `created_at` and `updated_at`

### Patch Changes

- Updated dependencies [e92cebd]
  - pqb@0.30.0
  - orchid-core@0.15.0
  - rake-db@2.20.1

## 1.26.3

### Patch Changes

- 9c086a9: Fix: un-hardcode schema migrations table name in generation scripts
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

- Updated dependencies [c7790c4]
- Updated dependencies [9c086a9]
- Updated dependencies [bdef5b0]
  - rake-db@2.20.0
  - pqb@0.29.1
  - orchid-core@0.14.1

## 1.26.2

### Patch Changes

- 8ba2483: Fix importing db file on Windows

## 1.26.1

### Patch Changes

- Updated dependencies [1aa1fb3]
  - pqb@0.29.0
  - rake-db@2.19.1

## 1.26.0

### Minor Changes

- e254c22: - Rework composite indexes, primary and foreign keys.

  - Change `findBy` to filter only by unique columns.
  - `onConflict` now will require columns for `merge`, and it can also accept a constraint name.

  See the BREAKING_CHANGE.md at orchid-orm 1.26 at the repository root for details.

### Patch Changes

- Updated dependencies [e254c22]
  - rake-db@2.19.0
  - pqb@0.28.0
  - orchid-core@0.14.0

## 1.25.3

### Patch Changes

- dd816f9: Downgrade tsx dep in create-orm script because 4.9.1 is broken

## 1.25.2

### Patch Changes

- 42f5248: Fix generated dbScript for tsx, fix `db pull` for test database

## 1.25.1

### Patch Changes

- 907b2b8: Synchronize libraries by publishing them
- Updated dependencies [907b2b8]
  - rake-db@2.18.1
  - pqb@0.27.7
  - orchid-core@0.13.4

## 1.25.0

### Minor Changes

- 929f49b: Generate migrations from table files, see [generate migrations](https://orchid-orm.netlify.app/guide/orm-and-query-builder.html#generate-migrations) docs.

  Rename utility type `Updateable` to `Updatable`.

  Include `rake-db` migration toolkit to the `orchid-orm` package.
  If you're using `orchid-orm`, remove `rake-db` from dependencies and import `rakeDb` from `orchd-orm/migrations` instead.

### Patch Changes

- Updated dependencies [929f49b]
  - rake-db@2.18.0

## 1.24.7

### Patch Changes

- 05590044: Fix bug in nested `whereExists` when relation uses alias
- Updated dependencies [05590044]
- Updated dependencies [c94339ad]
  - pqb@0.27.6

## 1.24.6

### Patch Changes

- Updated dependencies [2385c314]
  - pqb@0.27.5

## 1.24.5

### Patch Changes

- 465827b1: Fix code generation for `timestamps()` with custom name (#256)
- Updated dependencies [465827b1]
  - pqb@0.27.4
  - orchid-core@0.13.3

## 1.24.4

### Patch Changes

- Updated dependencies [14465bf7]
  - pqb@0.27.3
  - orchid-core@0.13.2

## 1.24.3

### Patch Changes

- 0a2795d6: Implicit join lateral (#247)
- Updated dependencies [0a2795d6]
  - pqb@0.27.2
  - orchid-core@0.13.1

## 1.24.2

### Patch Changes

- 2c19eb70: Add migration methods for enums:

  - `addEnumValues`
  - `dropEnumValues`
  - `renameEnumValues`
  - `renameType`
  - `changeTypeSchema`

## 1.24.1

### Patch Changes

- Updated dependencies [ca5d8543]
  - pqb@0.27.1

## 1.24.0

### Minor Changes

- ba3d9c2e: Change behavior of `set` inside `update` in `hasMany` and `hasAndBelongsToMany` relations for when empty array or empty object is given.
  Before, empty array/object was setting to all records, which is a bug.
  Now, empty array/object means "set to no records".
  It will nullify all connected records' foreign keys for `hasMany` and will delete all join table records for `hasAndBelongsToMany`.

### Patch Changes

- Updated dependencies [ba3d9c2e]
  - pqb@0.27.0
  - orchid-core@0.13.0

## 1.23.11

### Patch Changes

- 79da9a41: Re-export orchid-core from orchid-orm for compatibility
- Updated dependencies [79da9a41]
  - pqb@0.26.7
  - orchid-core@0.12.4

## 1.23.10

### Patch Changes

- Updated dependencies [f6dacede]
  - pqb@0.26.6

## 1.23.9

### Patch Changes

- Updated dependencies [04e441da]
  - pqb@0.26.5

## 1.23.8

### Patch Changes

- 76798e65: Fix enforcing strict: true when instantiating ORM

## 1.23.7

### Patch Changes

- ce23936a: Add TS check to enforce strict: true when creating ORM instance

## 1.23.6

### Patch Changes

- Updated dependencies [ff771568]
  - pqb@0.26.4
  - orchid-core@0.12.3

## 1.23.5

### Patch Changes

- 216988fc: Support passing join callback arg to repo (#247)
- Updated dependencies [216988fc]
  - pqb@0.26.3

## 1.23.4

### Patch Changes

- Updated dependencies [7e7fb35c]
  - orchid-core@0.12.2
  - pqb@0.26.2

## 1.23.3

### Patch Changes

- f0324edb: Ignore duplicate joins (#242)
- Updated dependencies [f0324edb]
  - pqb@0.26.1

## 1.23.2

### Patch Changes

- 012752d0: Add valibot integration
- Updated dependencies [012752d0]
  - pqb@0.26.0
  - orchid-core@0.12.1

## 1.23.1

### Patch Changes

- 404dda21: Separate query methods accepting SQL template
- Updated dependencies [404dda21]
  - pqb@0.25.1

## 1.23.0

### Minor Changes

- 46809633: Fix nested subquery `where` problem (#222)

### Patch Changes

- Updated dependencies [46809633]
  - pqb@0.25.0

## 1.22.1

### Patch Changes

- Updated dependencies [cc95e071]
  - pqb@0.24.1

## 1.22.0

### Minor Changes

- 851e840e: Significantly optimize types

### Patch Changes

- Updated dependencies [851e840e]
  - pqb@0.24.0
  - orchid-core@0.12.0

## 1.21.6

### Patch Changes

- 32d1a3be: `makeHelper`: ignore input table alias (#232)
- Updated dependencies [32d1a3be]
  - pqb@0.23.5
  - orchid-core@0.11.2

## 1.21.5

### Patch Changes

- Updated dependencies [87ef1c7f]
  - pqb@0.23.4
  - orchid-core@0.11.1

## 1.21.4

### Patch Changes

- 3a3a5d9c: Fix where relation column inside where exits typing
- Updated dependencies [3a3a5d9c]
  - pqb@0.23.3

## 1.21.3

### Patch Changes

- Updated dependencies [d85a5492]
  - pqb@0.23.2

## 1.21.2

### Patch Changes

- ceace54f: Expose columnTypes from BaseTable

## 1.21.1

### Patch Changes

- Updated dependencies [125e17d5]
  - pqb@0.23.1

## 1.21.0

### Minor Changes

- 74be332e: Optimize types

### Patch Changes

- Updated dependencies [74be332e]
  - pqb@0.23.0

## 1.20.1

### Patch Changes

- cbe9ad6b: Remove mutative (starting with \_) query methods to make it a bit more lightweight for TS checker
- Updated dependencies [cbe9ad6b]
  - pqb@0.22.1

## 1.20.0

### Minor Changes

- 4c7015b4: Support multiple column schemas for various cases

### Patch Changes

- Updated dependencies [4c7015b4]
  - pqb@0.22.0
  - orchid-core@0.11.0

## 1.19.0

### Minor Changes

- c865fa77: Add `softDelete`, rename `unScope` to `unscope`, remove `del` in favor of `delete` (#205)

### Patch Changes

- Updated dependencies [c865fa77]
  - pqb@0.21.0

## 1.18.3

### Patch Changes

- Updated dependencies [e436974f]
  - pqb@0.20.1

## 1.18.2

### Patch Changes

- Updated dependencies [d6819aa9]
  - pqb@0.20.0

## 1.18.1

### Patch Changes

- 003de3d6: Add the `scopes` feature
- Updated dependencies [003de3d6]
  - pqb@0.19.1
  - orchid-core@0.10.17

## 1.18.0

### Minor Changes

- 49780b94: Support loading of chained relations (#173)

### Patch Changes

- Updated dependencies [49780b94]
  - pqb@0.19.0

## 1.17.38

### Patch Changes

- 46382c24: Re-export everything from pqb in orchid-orm
- Updated dependencies [46382c24]
  - pqb@0.18.34
  - orchid-core@0.10.16

## 1.17.37

### Patch Changes

- 16eaadbd: Fix getting schema in orchid-orm-schema-to-zod before calling `orchidORM` for the table

## 1.17.36

### Patch Changes

- 4d71aa88: Fix codegen `belongsTo`

## 1.17.35

### Patch Changes

- bdae988c: Improve codegen: update relations syntax

## 1.17.34

### Patch Changes

- 19bff227: Improve codegen: update relations syntax, output `string` for string column instead of `varchar`
- Updated dependencies [19bff227]
  - pqb@0.18.33

## 1.17.33

### Patch Changes

- e92bf8fa: Fix codegen when generating relations for new tables
- Updated dependencies [3c089403]
  - pqb@0.18.32

## 1.17.32

### Patch Changes

- Updated dependencies [e4e4f963]
  - pqb@0.18.31

## 1.17.31

### Patch Changes

- 057b1b5a: Change type of `Query.meta.defaults` from union of string literals to `Record<string, true>`, it is a more correct type for this case and it solves (#213)
- Updated dependencies [057b1b5a]
  - pqb@0.18.30
  - orchid-core@0.10.15

## 1.17.30

### Patch Changes

- Updated dependencies [f3cfab1a]
  - pqb@0.18.29

## 1.17.29

### Patch Changes

- 4781781b: Extract init script into own package and renew it

## 1.17.28

### Patch Changes

- Updated dependencies [c56498d2]
  - pqb@0.18.28

## 1.17.27

### Patch Changes

- Updated dependencies [67bafe78]
  - pqb@0.18.27

## 1.17.26

### Patch Changes

- 96a6d588: Fix `defaults` type for optional columns (#196)
- Updated dependencies [96a6d588]
  - pqb@0.18.26
  - orchid-core@0.10.14

## 1.17.25

### Patch Changes

- Updated dependencies [3eb3705e]
  - orchid-core@0.10.13
  - pqb@0.18.25

## 1.17.24

### Patch Changes

- 0ea831ae: Return multiple records when chainging relation (#194)
- Updated dependencies [0ea831ae]
  - pqb@0.18.24

## 1.17.23

### Patch Changes

- Updated dependencies [828e22aa]
  - pqb@0.18.23

## 1.17.22

### Patch Changes

- 3fcab80e: Fix belongsTo nested create type for a required relation
- Updated dependencies [3fcab80e]
  - pqb@0.18.22

## 1.17.21

### Patch Changes

- 144e296d: Change generic columns type to the base form because it has conflicts when instantiating ORM
- Updated dependencies [144e296d]
  - pqb@0.18.21

## 1.17.20

### Patch Changes

- Updated dependencies [87a0dbae]
  - pqb@0.18.20

## 1.17.19

### Patch Changes

- 0ce2a897: Optimize exported types of columns and column methods by explicitly writing them instead of inferring
- Updated dependencies [0ce2a897]
  - pqb@0.18.19
  - orchid-core@0.10.12

## 1.17.18

### Patch Changes

- Updated dependencies [7f06c119]
  - pqb@0.18.18

## 1.17.17

### Patch Changes

- 7f39e294: Remove computed columns from the table shape for create and update in ORM (#188)
- Updated dependencies [7f39e294]
  - pqb@0.18.17
  - orchid-core@0.10.11

## 1.17.16

### Patch Changes

- Updated dependencies [eada7f0a]
  - pqb@0.18.16

## 1.17.15

### Patch Changes

- 56c5ff9f: Add computed columns (#59)
- Updated dependencies [56c5ff9f]
  - pqb@0.18.15
  - orchid-core@0.10.10

## 1.17.14

### Patch Changes

- Updated dependencies [18018604]
  - pqb@0.18.14

## 1.17.13

### Patch Changes

- Updated dependencies [2343dad6]
  - pqb@0.18.13
  - orchid-core@0.10.9

## 1.17.12

### Patch Changes

- Updated dependencies [2b467899]
  - pqb@0.18.12

## 1.17.11

### Patch Changes

- Updated dependencies [cb1c4c2c]
  - pqb@0.18.11

## 1.17.10

### Patch Changes

- 4debeb31: Add insert methods that do all the same as create methods, but return row count by default
- Updated dependencies [4debeb31]
  - pqb@0.18.10
  - orchid-core@0.10.8

## 1.17.9

### Patch Changes

- 71a805af: Change db functions to be available equally on the query itself, in select, in having, and to be chainable with column operators
- Updated dependencies [71a805af]
  - pqb@0.18.9
  - orchid-core@0.10.7

## 1.17.8

### Patch Changes

- Updated dependencies [d733e029]
  - pqb@0.18.8
  - orchid-core@0.10.6

## 1.17.7

### Patch Changes

- Updated dependencies [5c3fb301]
  - pqb@0.18.7
  - orchid-core@0.10.5

## 1.17.6

### Patch Changes

- Updated dependencies [043f0fbd]
  - pqb@0.18.6

## 1.17.5

### Patch Changes

- Updated dependencies [2d383dc6]
  - orchid-core@0.10.4
  - pqb@0.18.5

## 1.17.4

### Patch Changes

- 93006a0e: Change type of `create` for case of having multiple `belongsTo` relations to require all needed foreign keys or relation objects (#170)
- Updated dependencies [93006a0e]
  - pqb@0.18.4

## 1.17.3

### Patch Changes

- Updated dependencies [07448a7f]
  - pqb@0.18.3
  - orchid-core@0.10.3

## 1.17.2

### Patch Changes

- 64873aca: Fix generating code for json column shape (#158)
- Updated dependencies [64873aca]
  - pqb@0.18.2

## 1.17.1

### Patch Changes

- Updated dependencies [52ee35f4]
  - pqb@0.18.1
  - orchid-core@0.10.2

## 1.17.0

### Minor Changes

- ec43e167: Rename `or` to `orWhere` and remove `and`

### Patch Changes

- Updated dependencies [ec43e167]
  - pqb@0.18.0

## 1.16.2

### Patch Changes

- Updated dependencies [73b2beb8]
  - pqb@0.17.10

## 1.16.1

### Patch Changes

- Updated dependencies [64a2e733]
  - pqb@0.17.9

## 1.16.0

### Minor Changes

- 435ec9c1: Add Selectable, Insertable, Updateable, Queryable utility types. Remove TableType.

### Patch Changes

- 0b6625a0: Replace `tableToZod` utility with `schemaProvider` config in the `BaseTable`
- Updated dependencies [435ec9c1]
  - pqb@0.17.8
  - orchid-core@0.10.1

## 1.15.2

### Patch Changes

- Updated dependencies [634613ad]
  - pqb@0.17.7

## 1.15.1

### Patch Changes

- 1688e82b: Add a dependency on "pg" and "@types/pg"
- Updated dependencies [1688e82b]
  - pqb@0.17.6
  - orchid-core@0.10.0

## 1.15.0

### Minor Changes

- f92e76ed: Support relations connected by multiple columns

### Patch Changes

- Updated dependencies [f92e76ed]
  - pqb@0.17.5

## 1.14.4

### Patch Changes

- Updated dependencies [d5011e31]
  - pqb@0.17.4

## 1.14.3

### Patch Changes

- 3b63faac: Remove `LIMIT 1` SQL from `WHERE EXISTS` as it makes no difference here
- Updated dependencies [3b63faac]
  - pqb@0.17.3

## 1.14.2

### Patch Changes

- Updated dependencies [607ca901]
  - pqb@0.17.2

## 1.14.1

### Patch Changes

- ff06f0a6: Refactor relations types
- Updated dependencies [ff06f0a6]
  - pqb@0.17.1

## 1.14.0

### Minor Changes

- 83cf51c2: Rename `toSql` to `toSQL`

### Patch Changes

- Updated dependencies [83cf51c2]
  - pqb@0.17.0
  - orchid-core@0.10.0

## 1.13.9

### Patch Changes

- 52196f7d: Support searching by aggregated value in a `where` callback (#122)
- Updated dependencies [52196f7d]
  - pqb@0.16.6

## 1.13.8

### Patch Changes

- Updated dependencies [23558c67]
  - pqb@0.16.5
  - orchid-core@0.9.1

## 1.13.7

### Patch Changes

- Updated dependencies [ed4ab58c]
  - orchid-core@0.9.0
  - pqb@0.16.4

## 1.13.6

### Patch Changes

- Updated dependencies [a9e48cd8]
  - pqb@0.16.3
  - orchid-core@0.8.2

## 1.13.5

### Patch Changes

- Updated dependencies [d1dad50d]
  - pqb@0.16.2
  - orchid-core@0.8.1

## 1.13.4

### Patch Changes

- Updated dependencies [0ef20d80]
  - pqb@0.16.1

## 1.13.3

### Patch Changes

- Updated dependencies [b7a2d035]
  - pqb@0.16.0
  - orchid-core@0.8.0

## 1.13.2

### Patch Changes

- 2d860221: Add support for generated columns and for the full text search
- Updated dependencies [2d860221]
  - pqb@0.15.2
  - orchid-core@0.7.1

## 1.13.1

### Patch Changes

- Updated dependencies [d43af0b2]
  - pqb@0.15.1

## 1.13.0

### Minor Changes

- 1b3e98a5: Upgrade aggregate and window functions, having clause

### Patch Changes

- Updated dependencies [1b3e98a5]
  - pqb@0.15.0
  - orchid-core@0.7.0

## 1.12.3

### Patch Changes

- Updated dependencies [ccc5e2aa]
  - pqb@0.14.3
  - orchid-core@0.6.2

## 1.12.2

### Patch Changes

- 52fe89e5: Rename query data structure from `query` to `q` to use the `query` for different purpose
- d5dd3bd6: Allow creating records with some columns defined using a raw SQL
- 1e0e7e7a: Add `$query` and `$queryArrays` fn to the ORM, add `query` and `queryArrays` to `pqb` db.
- Updated dependencies [7a201dfc]
- Updated dependencies [52fe89e5]
- Updated dependencies [d5dd3bd6]
- Updated dependencies [1e0e7e7a]
  - pqb@0.14.2
  - orchid-core@0.6.1

## 1.12.1

### Patch Changes

- Updated dependencies [3b1bf602]
  - pqb@0.14.1

## 1.12.0

### Minor Changes

- b178ee7: Change type and behavior of raw SQL methods for the better

### Patch Changes

- Updated dependencies [b178ee7]
  - pqb@0.14.0
  - orchid-core@0.6.0

## 1.11.4

### Patch Changes

- Updated dependencies [81ebb5d]
  - pqb@0.13.3

## 1.11.3

### Patch Changes

- 754d962: Add `import` function to `rakeDb` in the project init

## 1.11.2

### Patch Changes

- Updated dependencies [a7baab8]
  - orchid-core@0.5.2
  - pqb@0.13.2

## 1.11.1

### Patch Changes

- 695f390: Internal change: change filePath property of BaseTable and extended tables to the getFilePath method
- Updated dependencies [695f390]
  - orchid-core@0.5.1
  - pqb@0.13.1

## 1.11.0

### Minor Changes

- 78b65c4: Add query hooks that can select data, run inside transaction, and after commit (#83)

### Patch Changes

- Updated dependencies [78b65c4]
  - pqb@0.13.0
  - orchid-core@0.5.0

## 1.10.6

### Patch Changes

- Updated dependencies [cbc1121]
  - pqb@0.12.5

## 1.10.5

### Patch Changes

- 0bc5919: Fix querying a relation which is absent and not required (#110)

## 1.10.4

### Patch Changes

- Updated dependencies [3116713]
  - pqb@0.12.4

## 1.10.3

### Patch Changes

- Updated dependencies [c2d3eb0]
  - pqb@0.12.3

## 1.10.2

### Patch Changes

- Updated dependencies [d16ab35]
  - pqb@0.12.2
  - orchid-core@0.4.14

## 1.10.1

### Patch Changes

- Updated dependencies [35c437e]
  - pqb@0.12.1

## 1.10.0

### Minor Changes

- 96f2cef: Disallow selecting joined tables by only their names, allow selecting them as `table.*`

### Patch Changes

- Updated dependencies [96f2cef]
  - pqb@0.12.0

## 1.9.43

### Patch Changes

- 31e7d23: Add `LIMIT 1` for `get` queries
- Updated dependencies [31e7d23]
  - pqb@0.11.35

## 1.9.42

### Patch Changes

- d8bc7cf: Support sub-queries for updating and deleting records (#105)'
- Updated dependencies [d8bc7cf]
  - pqb@0.11.34

## 1.9.41

### Patch Changes

- 275cc73: Support nested select of the same table as above
- Updated dependencies [275cc73]
  - pqb@0.11.33

## 1.9.40

### Patch Changes

- 2881707: Add `makeHelper` function to define query helper
- Updated dependencies [2881707]
  - pqb@0.11.32
  - orchid-core@0.4.13

## 1.9.39

### Patch Changes

- ee740c6: Add TableType utility (#95)

## 1.9.38

### Patch Changes

- Updated dependencies [8ae4fe3]
  - pqb@0.11.31

## 1.9.37

### Patch Changes

- Updated dependencies [e9a4095]
  - pqb@0.11.30
  - orchid-core@0.4.12

## 1.9.36

### Patch Changes

- Updated dependencies [4893640]
  - pqb@0.11.29
  - orchid-core@0.4.11

## 1.9.35

### Patch Changes

- Updated dependencies [0535450]
  - pqb@0.11.28
  - orchid-core@0.4.10

## 1.9.34

### Patch Changes

- 4287137: Add `sql` method to accept raw SQL via template literals
- Updated dependencies [4287137]
  - pqb@0.11.27
  - orchid-core@0.4.9

## 1.9.33

### Patch Changes

- Updated dependencies [2e8e2a3]
  - pqb@0.11.26

## 1.9.32

### Patch Changes

- a33d1a1: Update docs links in README.md and in package.json
- Updated dependencies [a33d1a1]
  - pqb@0.11.25

## 1.9.31

### Patch Changes

- 83d8eed: Support defining hooks on tables (#83)
- Updated dependencies [83d8eed]
  - pqb@0.11.24

## 1.9.30

### Patch Changes

- Updated dependencies [9610b44]
  - orchid-core@0.4.8
  - pqb@0.11.23

## 1.9.29

### Patch Changes

- Updated dependencies [c7298d6]
  - pqb@0.11.22

## 1.9.28

### Patch Changes

- 64353f7: Make identity column optional when creating
- 63934b5: Fix ordering and using where for the column of selected relation
- 5046e74: Fix codegen for relations when re-appliying migrations
- 23d8a2a: Fix `nowSQL` to be wrapped into parens automatically
- Updated dependencies [64353f7]
- Updated dependencies [63934b5]
- Updated dependencies [23d8a2a]
  - pqb@0.11.21
  - orchid-core@0.4.7

## 1.9.27

### Patch Changes

- Support ESM in ORM codegen

## 1.9.26

### Patch Changes

- Fix importing of ORM in the ORM codegen

## 1.9.25

### Patch Changes

- Fix exporting codegen from the ORM

## 1.9.24

### Patch Changes

- Fix exporting codegen from ORM

## 1.9.23

### Patch Changes

- Move ORM codegen module to a separate bundle

## 1.9.22

### Patch Changes

- Support returning data from a callback for creating record in `upsert`, `orCreate`
- e8a863d: Support `.join()` on relations to have JOIN LATERAL instead of LEFT JOIN LATERAL
- Updated dependencies
- Updated dependencies [e8a863d]
  - pqb@0.11.20

## 1.9.21

### Patch Changes

- Allow to customize timestamp default value with `nowSQL` option of base table
- Updated dependencies
  - pqb@0.11.19
  - orchid-core@0.4.6

## 1.9.20

### Patch Changes

- Fix selecting a plain value from a sub query in select
- Updated dependencies
  - pqb@0.11.18

## 1.9.19

### Patch Changes

- Fix aliasing relation sub queries in select; Fix ordering by selected value
- Updated dependencies
  - pqb@0.11.17

## 1.9.18

### Patch Changes

- Fix selecting nested relations
- Updated dependencies
  - pqb@0.11.16

## 1.9.17

### Patch Changes

- Fix selecting relation pluck with query methods like orderBy
- Updated dependencies
  - pqb@0.11.15

## 1.9.16

### Patch Changes

- Handle releations selects with `JOIN LATERAL` internally
- dfc2b87: Remove ability to select a relation with a string in `select` because it may be confusing
- Updated dependencies
- Updated dependencies [dfc2b87]
  - pqb@0.11.14

## 1.9.15

### Patch Changes

- Change `createFactory` to `tableFactory` and `ormFactory`; Add factory.buildMany and factory.createMany
- 96504ef: Support `as` in joinLateral relation
- Updated dependencies
- Updated dependencies [96504ef]
  - pqb@0.11.13
  - orchid-core@0.4.5

## 1.9.14

### Patch Changes

- Add testTransaction utility for tests
- Updated dependencies [cfdc2bb]
- Updated dependencies
  - pqb@0.11.12
  - orchid-core@0.4.4

## 1.9.13

### Patch Changes

- Updated dependencies
  - pqb@0.11.11
  - orchid-core@0.4.4

## 1.9.12

### Patch Changes

- Support joining a relation with a callback
- Updated dependencies
  - pqb@0.11.10
  - orchid-core@0.4.3

## 1.9.11

### Patch Changes

- Make passing this not required when customizing column types
- Updated dependencies
  - pqb@0.11.9
  - orchid-core@0.4.2

## 1.9.10

### Patch Changes

- Updated dependencies
  - pqb@0.11.8

## 1.9.9

### Patch Changes

- Support joinLateral
- Updated dependencies
  - pqb@0.11.7

## 1.9.8

### Patch Changes

- Updated dependencies
  - pqb@0.11.6

## 1.9.7

### Patch Changes

- Change result handling to a sync function as optimization
- Updated dependencies
  - pqb@0.11.5

## 1.9.6

### Patch Changes

- Updated dependencies
  - pqb@0.11.4
  - orchid-core@0.4.1

## 1.9.5

### Patch Changes

- Remove unneeded dependencies

## 1.9.4

### Patch Changes

- Replace pluralize with inflection for es module support

## 1.9.3

### Patch Changes

- Automaticly define relations from db pull or after running migrations

## 1.9.2

### Patch Changes

- Fix orchid-orm init

## 1.9.1

### Patch Changes

- Fix orchid-orm init

## 1.9.0

### Minor Changes

- Change appCodeUpdater config to take path and name of the base table from baseTable option

### Patch Changes

- Updated dependencies
  - orchid-core@0.4.0
  - pqb@0.11.3

## 1.8.1

### Patch Changes

- Updated dependencies
  - pqb@0.11.2
  - orchid-core@0.3.1

## 1.8.0

### Minor Changes

- Support overriden column types in rake-db

### Patch Changes

- Updated dependencies
  - orchid-core@0.3.0
  - pqb@0.11.1

## 1.7.0

### Minor Changes

- Implicitly pass transaction object by using AsyncLocalStorage

### Patch Changes

- Updated dependencies
  - pqb@0.11.0
  - orchid-core@0.2.0

## 1.6.40

### Patch Changes

- Update dependencies
- Updated dependencies
  - pqb@0.10.36

## 1.6.39

### Patch Changes

- Updated dependencies
  - pqb@0.10.35

## 1.6.38

### Patch Changes

- Initial support for db views
- Updated dependencies
  - orchid-core@0.1.17
  - pqb@0.10.34

## 1.6.37

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.16
  - pqb@0.10.33

## 1.6.36

### Patch Changes

- Updated dependencies
  - pqb@0.10.32

## 1.6.35

### Patch Changes

- Support identity columns
- Updated dependencies
  - orchid-core@0.1.15
  - pqb@0.10.31

## 1.6.34

### Patch Changes

- Updated dependencies
  - pqb@0.10.30

## 1.6.33

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.14
  - pqb@0.10.29

## 1.6.32

### Patch Changes

- Updated dependencies
  - pqb@0.10.28

## 1.6.31

### Patch Changes

- Support NULLS NOT DISTINCT for unique index
- Updated dependencies
  - pqb@0.10.27

## 1.6.30

### Patch Changes

- Updated dependencies
  - pqb@0.10.26

## 1.6.29

### Patch Changes

- Updated dependencies
  - pqb@0.10.25

## 1.6.28

### Patch Changes

- Remove undefined and void from json schema
- Updated dependencies
  - orchid-core@0.1.13
  - pqb@0.10.24

## 1.6.27

### Patch Changes

- Support db table checks and constraints
- Updated dependencies
  - orchid-core@0.1.12
  - pqb@0.10.23

## 1.6.26

### Patch Changes

- Support schema connection option
- Updated dependencies
  - pqb@0.10.22

## 1.6.25

### Patch Changes

- Improve error classes
- Updated dependencies
  - pqb@0.10.21

## 1.6.24

### Patch Changes

- Updated dependencies
  - pqb@0.10.20

## 1.6.23

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.11
  - pqb@0.10.19

## 1.6.22

### Patch Changes

- Improve select and from types
- Updated dependencies
  - pqb@0.10.18

## 1.6.21

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.10
  - pqb@0.10.17

## 1.6.20

### Patch Changes

- c8df1f9: Fix camelCase and PascalCase table names in codegen
- Updated dependencies
- Updated dependencies [c8df1f9]
  - orchid-core@0.1.9
  - pqb@0.10.16

## 1.6.19

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.8
  - pqb@0.10.15

## 1.6.18

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.7
  - pqb@0.10.14

## 1.6.17

### Patch Changes

- Support snakeCase option
- Updated dependencies
  - orchid-core@0.1.6
  - pqb@0.10.13

## 1.6.16

### Patch Changes

- Support selecting \*
- Updated dependencies
  - pqb@0.10.12

## 1.6.15

### Patch Changes

- Support runtime default; Add createManyRaw and createManyFrom
- Updated dependencies
  - orchid-core@0.1.5
  - pqb@0.10.11

## 1.6.14

### Patch Changes

- Add citext
- Updated dependencies
  - pqb@0.10.10

## 1.6.13

### Patch Changes

- 8d35851: Handle unsupported types
- Updated dependencies [8d35851]
  - pqb@0.10.9

## 1.6.12

### Patch Changes

- Support domain types
- Updated dependencies
  - orchid-core@0.1.4
  - pqb@0.10.8

## 1.6.11

### Patch Changes

- Support database CHECK validation
- Updated dependencies
  - orchid-core@0.1.3
  - pqb@0.10.7

## 1.6.10

### Patch Changes

- Make swc optional in init

## 1.6.9

### Patch Changes

- Updated dependencies
  - pqb@0.10.6

## 1.6.8

### Patch Changes

- Updated dependencies
  - pqb@0.10.5

## 1.6.7

### Patch Changes

- Show current path as a hint in init script

## 1.6.6

### Patch Changes

- Handle cancel in init script

## 1.6.5

### Patch Changes

- Choose project path in init script

## 1.6.4

### Patch Changes

- Use readonly for table in the table class
- Updated dependencies
  - pqb@0.10.4

## 1.6.3

### Patch Changes

- Add log to appCodeUpdater, change file pathes to urls when logging
- Updated dependencies
- Updated dependencies [384fbfc]
  - orchid-core@0.1.2
  - pqb@0.10.3

## 1.6.2

### Patch Changes

- Fix creating belongsTo relation when id has no default
- Updated dependencies
  - pqb@0.10.2

## 1.6.1

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.1
  - pqb@0.10.1

## 1.6.0

### Minor Changes

- Move common code into separate orchid-core package

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.0
  - pqb@0.10.0

## 1.5.39

### Patch Changes

- Updated dependencies
  - pqb@0.9.27

## 1.5.38

### Patch Changes

- Support join subquery
- Updated dependencies
  - pqb@0.9.26

## 1.5.37

### Patch Changes

- Fix pluck in sub query
- Updated dependencies
  - pqb@0.9.25

## 1.5.36

### Patch Changes

- Fix pluck subquery with empty result
- Updated dependencies
  - pqb@0.9.24

## 1.5.35

### Patch Changes

- Fix returning pluck from sub query
- Updated dependencies
  - pqb@0.9.23

## 1.5.34

### Patch Changes

- Fix returning related records in an extra array
- Updated dependencies
  - pqb@0.9.22

## 1.5.33

### Patch Changes

- Add method $from to orm
- Updated dependencies
  - pqb@0.9.21

## 1.5.32

### Patch Changes

- Fix number column operators
- Updated dependencies
  - pqb@0.9.20

## 1.5.31

### Patch Changes

- Updated dependencies
- Updated dependencies [aa92f25]
  - pqb@0.9.19

## 1.5.30

### Patch Changes

- Leave only dist in shipped packages
- Updated dependencies
  - pqb@0.9.18

## 1.5.29

### Patch Changes

- Updated dependencies
  - pqb@0.9.17

## 1.5.28

### Patch Changes

- Updated dependencies
  - pqb@0.9.16

## 1.5.27

### Patch Changes

- Updated dependencies
  - pqb@0.9.15

## 1.5.26

### Patch Changes

- Updated dependencies
  - pqb@0.9.14

## 1.5.25

### Patch Changes

- Change relative paths in rake-db config generated by init script

## 1.5.24

### Patch Changes

- Updated dependencies
  - pqb@0.9.13

## 1.5.23

### Patch Changes

- Fix relative path resolution on windows for orm codegen

## 1.5.22

### Patch Changes

- Make codegen to not add table to the main file when the key already exist

## 1.5.21

### Patch Changes

- Fix baseTablePath in orm codegen

## 1.5.20

### Patch Changes

- Relative path in rakeDb config

## 1.5.19

### Patch Changes

- Improve init script

## 1.5.18

### Patch Changes

- Add orCreate method
- Updated dependencies
  - pqb@0.9.12

## 1.5.17

### Patch Changes

- Improve code generation, fix ssl databaseUrl option
- Updated dependencies
  - pqb@0.9.11

## 1.5.16

### Patch Changes

- Improve code generation

## 1.5.15

### Patch Changes

- Improve init script

## 1.5.14

### Patch Changes

- Improve init script

## 1.5.13

### Patch Changes

- Fix init script

## 1.5.12

### Patch Changes

- Add init script
- Updated dependencies
  - pqb@0.9.10

## 1.5.11

### Patch Changes

- Override column types via callback
- Updated dependencies
  - pqb@0.9.9

## 1.5.10

### Patch Changes

- ee1961e: Make columnTypes optional in configs
- Updated dependencies [ee1961e]
  - pqb@0.9.8

## 1.5.9

### Patch Changes

- Updated dependencies
  - pqb@0.9.7

## 1.5.8

### Patch Changes

- Fix import path on windows in generated code

## 1.5.7

### Patch Changes

- Updated dependencies
  - pqb@0.9.6

## 1.5.6

### Patch Changes

- Updated dependencies
  - pqb@0.9.5

## 1.5.5

### Patch Changes

- ESM support for orm

## 1.5.4

### Patch Changes

- Updated dependencies
  - pqb@0.9.4

## 1.5.3

### Patch Changes

- Change package.json exports for esm support
- Updated dependencies
  - pqb@0.9.3

## 1.5.2

### Patch Changes

- Updated dependencies
  - pqb@0.9.2

## 1.5.1

### Patch Changes

- Updated dependencies
  - pqb@0.9.1

## 1.5.0

### Minor Changes

- Change index options: column or expression is required, operator renamed to opclass

### Patch Changes

- f1cd5db: Handle multiple indexes and foreignKeys of the column
- Updated dependencies
- Updated dependencies [f1cd5db]
  - pqb@0.9.0

## 1.4.22

### Patch Changes

- Change inner aspects of columns
- Updated dependencies
  - pqb@0.8.5

## 1.4.21

### Patch Changes

- Add --code cli argument to rake-db
- Improve codegen
- Updated dependencies
- Updated dependencies
  - pqb@0.8.4

## 1.4.19

### Patch Changes

- Updated dependencies
  - pqb@0.8.3

## 1.4.18

### Patch Changes

- Add code generator to change project files after migrations
- Updated dependencies
  - pqb@0.8.2

## 1.4.17

### Patch Changes

- Updated dependencies
  - pqb@0.8.1

## 2.0.0

### Minor Changes

- 3f25b4d: Rename all model words to table words, because all models here are not models in OOP meaning

### Patch Changes

- Updated dependencies [3f25b4d]
  - pqb@0.8.0
  - rake-db@2.2.0

## 1.3.16

### Patch Changes

- Refactor create and update of relations
- Updated dependencies
  - pqb@0.7.13

## 1.3.15

### Patch Changes

- Updated dependencies
  - pqb@0.7.12

## 1.3.14

### Patch Changes

- Updated dependencies
  - pqb@0.7.11

## 1.3.13

### Patch Changes

- Updated dependencies
  - pqb@0.7.10

## 1.3.12

### Patch Changes

- Updated dependencies
  - pqb@0.7.9

## 1.3.11

### Patch Changes

- Change connectionString to databaseURL option, add ssl option
- Updated dependencies
  - pqb@0.7.8

## 1.3.10

### Patch Changes

- Updated dependencies
  - pqb@0.7.7

## 1.3.9

### Patch Changes

- Updated dependencies
  - pqb@0.7.6

## 1.3.8

### Patch Changes

- Updated dependencies
  - pqb@0.7.5

## 1.3.7

### Patch Changes

- Update homepage link in package.json
- Updated dependencies
  - pqb@0.7.4

## 1.3.6

### Patch Changes

- Add required min and max parameters to text column
- Updated dependencies
  - pqb@0.7.3

## 1.3.5

### Patch Changes

- Check if through and source relations are defined

## 1.3.4

### Patch Changes

- Updated dependencies [9b8b3d5]
  - pqb@0.7.2

## 1.3.3

### Patch Changes

- Handle tables without primary key
- Updated dependencies
  - pqb@0.7.1

## 1.3.2

### Patch Changes

- 1147182: Run relation callbacks when creating/updating/deleting in a nested way

## 1.3.0

### Minor Changes

- 883c3e4: Add changeset

### Patch Changes

- Updated dependencies [883c3e4]
  - pqb@0.7.0
