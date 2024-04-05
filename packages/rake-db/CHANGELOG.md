# rake-db

## 2.17.0

### Minor Changes

- bbe7f4eb: Add `afterChangeCommit`, change callbacks signatures.

  `beforeMigrate`, `afterMigrate`, `beforeRollback`, `afterRollback` were previously receiving only `db` argument,
  now they're receiving an object `{ db, migrations }` where `migrations` is an array of executed migrations.

  `beforeChange`, `afterChange` were previously receiving `db, up, redo` arguments,
  now they're receiving an object `{ db, up, redo, migrations }`.

  `afterChangeCommit` receives object `{ options, up, migrations }` where `options` is for database connection options.

## 2.16.0

### Minor Changes

- 0c67c17c: Return result from rakeDb to have command data; Make `migrate` an alias of `up` eliminating a subtle difference.

## 2.15.11

### Patch Changes

- Updated dependencies [ba3d9c2e]
  - pqb@0.27.0
  - orchid-core@0.13.0

## 2.15.10

### Patch Changes

- Updated dependencies [79da9a41]
  - pqb@0.26.7
  - orchid-core@0.12.4

## 2.15.9

### Patch Changes

- e8f1fe63: Support changing schema with `renameTable`, add `changeTableSchema` migration method
- a9a2dbf7: Export rake-db types for portability

## 2.15.8

### Patch Changes

- Updated dependencies [f6dacede]
  - pqb@0.26.6

## 2.15.7

### Patch Changes

- Updated dependencies [04e441da]
  - pqb@0.26.5

## 2.15.6

### Patch Changes

- f2f0ed5a: Fix bug in rake-db

## 2.15.5

### Patch Changes

- ff771568: Minor column type fix for proper default columns in rake-db
- Updated dependencies [ff771568]
  - pqb@0.26.4
  - orchid-core@0.12.3

## 2.15.4

### Patch Changes

- Updated dependencies [216988fc]
  - pqb@0.26.3

## 2.15.3

### Patch Changes

- 7e7fb35c: Add command `up force` for timestamp migrations
- Updated dependencies [7e7fb35c]
  - orchid-core@0.12.2
  - pqb@0.26.2

## 2.15.2

### Patch Changes

- Updated dependencies [f0324edb]
  - pqb@0.26.1

## 2.15.1

### Patch Changes

- b7505735: rake-db: fix create schemaMigration name column when it was absent

## 2.15.0

### Minor Changes

- acd9e43e: Add serial migration prefix format and use it by default, add `change-ids` and `rebase` commands

## 2.14.5

### Patch Changes

- 59468272: showing list of up & down migrations on pnpm db list
- 4acd5dff: Change rake-db migrations status command

## 2.14.4

### Patch Changes

- 012752d0: Add valibot integration
- Updated dependencies [012752d0]
  - pqb@0.26.0
  - orchid-core@0.12.1

## 2.14.3

### Patch Changes

- 10278b53: Refactor query fetching db structure to a single query
- Updated dependencies [404dda21]
  - pqb@0.25.1

## 2.14.2

### Patch Changes

- Updated dependencies [46809633]
  - pqb@0.25.0

## 2.14.1

### Patch Changes

- Updated dependencies [cc95e071]
  - pqb@0.24.1

## 2.14.0

### Minor Changes

- 506d8c51: Create "schemaMigrations" table if not exists when executing migrations (#238)

## 2.13.0

### Minor Changes

- 851e840e: Significantly optimize types

### Patch Changes

- Updated dependencies [851e840e]
  - pqb@0.24.0
  - orchid-core@0.12.0

## 2.12.7

### Patch Changes

- Updated dependencies [32d1a3be]
  - pqb@0.23.5
  - orchid-core@0.11.2

## 2.12.6

### Patch Changes

- 87ef1c7f: Add connectRetry connection option
- Updated dependencies [87ef1c7f]
  - pqb@0.23.4
  - orchid-core@0.11.1

## 2.12.5

### Patch Changes

- Updated dependencies [3a3a5d9c]
  - pqb@0.23.3

## 2.12.4

### Patch Changes

- Updated dependencies [d85a5492]
  - pqb@0.23.2

## 2.12.3

### Patch Changes

- Updated dependencies [125e17d5]
  - pqb@0.23.1

## 2.12.2

### Patch Changes

- Updated dependencies [74be332e]
  - pqb@0.23.0

## 2.12.1

### Patch Changes

- Updated dependencies [cbe9ad6b]
  - pqb@0.22.1

## 2.12.0

### Minor Changes

- 4c7015b4: Support multiple column schemas for various cases

### Patch Changes

- Updated dependencies [4c7015b4]
  - pqb@0.22.0
  - orchid-core@0.11.0

## 2.11.4

### Patch Changes

- Updated dependencies [c865fa77]
  - pqb@0.21.0

## 2.11.3

### Patch Changes

- Updated dependencies [e436974f]
  - pqb@0.20.1

## 2.11.2

### Patch Changes

- Updated dependencies [d6819aa9]
  - pqb@0.20.0

## 2.11.1

### Patch Changes

- Updated dependencies [003de3d6]
  - pqb@0.19.1
  - orchid-core@0.10.17

## 2.11.0

### Minor Changes

- 913be12e: rake-db: use a single transaction for multiple migrations, use a database lock to prevent concurrency issues

## 2.10.73

### Patch Changes

- Updated dependencies [49780b94]
  - pqb@0.19.0

## 2.10.72

### Patch Changes

- Updated dependencies [46382c24]
  - pqb@0.18.34
  - orchid-core@0.10.16

## 2.10.71

### Patch Changes

- 16eaadbd: Fix getting schema in orchid-orm-schema-to-zod before calling `orchidORM` for the table

## 2.10.70

### Patch Changes

- Updated dependencies [19bff227]
  - pqb@0.18.33

## 2.10.69

### Patch Changes

- Updated dependencies [3c089403]
  - pqb@0.18.32

## 2.10.68

### Patch Changes

- Updated dependencies [e4e4f963]
  - pqb@0.18.31

## 2.10.67

### Patch Changes

- ee7aaeaf: Fix inconsistent order of changes applied when running migration up and down programmatically multiple times (#214)

## 2.10.66

### Patch Changes

- 057b1b5a: Change type of `Query.meta.defaults` from union of string literals to `Record<string, true>`, it is a more correct type for this case and it solves (#213)
- Updated dependencies [057b1b5a]
  - pqb@0.18.30
  - orchid-core@0.10.15

## 2.10.65

### Patch Changes

- Updated dependencies [f3cfab1a]
  - pqb@0.18.29

## 2.10.64

### Patch Changes

- 4781781b: Extract init script into own package and renew it

## 2.10.63

### Patch Changes

- 67eeefd3: Change resolving path to dbScript to support bundling

## 2.10.62

### Patch Changes

- Updated dependencies [c56498d2]
  - pqb@0.18.28

## 2.10.61

### Patch Changes

- Updated dependencies [67bafe78]
  - pqb@0.18.27

## 2.10.60

### Patch Changes

- Updated dependencies [96a6d588]
  - pqb@0.18.26
  - orchid-core@0.10.14

## 2.10.59

### Patch Changes

- Updated dependencies [3eb3705e]
  - orchid-core@0.10.13
  - pqb@0.18.25

## 2.10.58

### Patch Changes

- Updated dependencies [0ea831ae]
  - pqb@0.18.24

## 2.10.57

### Patch Changes

- Updated dependencies [828e22aa]
  - pqb@0.18.23

## 2.10.56

### Patch Changes

- Updated dependencies [3fcab80e]
  - pqb@0.18.22

## 2.10.55

### Patch Changes

- Updated dependencies [144e296d]
  - pqb@0.18.21

## 2.10.54

### Patch Changes

- Updated dependencies [87a0dbae]
  - pqb@0.18.20

## 2.10.53

### Patch Changes

- 0ce2a897: Optimize exported types of columns and column methods by explicitly writing them instead of inferring
- Updated dependencies [0ce2a897]
  - pqb@0.18.19
  - orchid-core@0.10.12

## 2.10.52

### Patch Changes

- Updated dependencies [7f06c119]
  - pqb@0.18.18

## 2.10.51

### Patch Changes

- Updated dependencies [7f39e294]
  - pqb@0.18.17
  - orchid-core@0.10.11

## 2.10.50

### Patch Changes

- Updated dependencies [eada7f0a]
  - pqb@0.18.16

## 2.10.49

### Patch Changes

- f021abb2: Allow overriding config in rakeDb.lazy (#180)

## 2.10.48

### Patch Changes

- 56c5ff9f: Add computed columns (#59)
- Updated dependencies [56c5ff9f]
  - pqb@0.18.15
  - orchid-core@0.10.10

## 2.10.47

### Patch Changes

- Updated dependencies [18018604]
  - pqb@0.18.14

## 2.10.46

### Patch Changes

- 2343dad6: Serialize the default value with the encoding function of the column (#183)
- Updated dependencies [2343dad6]
  - pqb@0.18.13
  - orchid-core@0.10.9

## 2.10.45

### Patch Changes

- Updated dependencies [2b467899]
  - pqb@0.18.12

## 2.10.44

### Patch Changes

- cb1c4c2c: Change `string` column type to be a varchar with 255 limit by default
- Updated dependencies [cb1c4c2c]
  - pqb@0.18.11

## 2.10.43

### Patch Changes

- Updated dependencies [4debeb31]
  - pqb@0.18.10
  - orchid-core@0.10.8

## 2.10.42

### Patch Changes

- Updated dependencies [71a805af]
  - pqb@0.18.9
  - orchid-core@0.10.7

## 2.10.41

### Patch Changes

- Updated dependencies [d733e029]
  - pqb@0.18.8
  - orchid-core@0.10.6

## 2.10.40

### Patch Changes

- Updated dependencies [5c3fb301]
  - pqb@0.18.7
  - orchid-core@0.10.5

## 2.10.39

### Patch Changes

- f4d2493a: Do not drop index when dropping a column in `changeTable` because it's done by db (#172)

## 2.10.38

### Patch Changes

- Updated dependencies [043f0fbd]
  - pqb@0.18.6

## 2.10.37

### Patch Changes

- Updated dependencies [2d383dc6]
  - orchid-core@0.10.4
  - pqb@0.18.5

## 2.10.36

### Patch Changes

- 5d693378: Add `rakeDb.lazy`, handle default exports in migrations (#167)

## 2.10.35

### Patch Changes

- Updated dependencies [93006a0e]
  - pqb@0.18.4

## 2.10.34

### Patch Changes

- Updated dependencies [07448a7f]
  - pqb@0.18.3
  - orchid-core@0.10.3

## 2.10.33

### Patch Changes

- 7d11ab40: Fix order of migrations for rollback when passing migrations record to rake-db config (#162)

## 2.10.32

### Patch Changes

- 8468dbc3: Fix order of calling `change` functions in rake-db `redo` command (#161)

## 2.10.31

### Patch Changes

- 64873aca: Fix generating code for json column shape (#158)
- Updated dependencies [64873aca]
  - pqb@0.18.2

## 2.10.30

### Patch Changes

- b79f647e: Don't add database `DEFAULT` to the column if default value is a function (#160)

## 2.10.29

### Patch Changes

- 52ee35f4: Better support of default(null) (#159)
- Updated dependencies [52ee35f4]
  - pqb@0.18.1
  - orchid-core@0.10.2

## 2.10.28

### Patch Changes

- Updated dependencies [ec43e167]
  - pqb@0.18.0

## 2.10.27

### Patch Changes

- cc626464: Throw error when calling rake-db script without suffix

## 2.10.26

### Patch Changes

- 73b2beb8: Support a list of migrations in `rakeDb` to use for bundling (#155)
- Updated dependencies [73b2beb8]
  - pqb@0.17.10

## 2.10.25

### Patch Changes

- 61991b5b: Automatically create a db schema if not exists in `db migrate` command

## 2.10.24

### Patch Changes

- Updated dependencies [64a2e733]
  - pqb@0.17.9

## 2.10.23

### Patch Changes

- a02a86bb: Allow omitting `t.add` in `changeTable`

## 2.10.22

### Patch Changes

- Updated dependencies [435ec9c1]
  - pqb@0.17.8
  - orchid-core@0.10.1

## 2.10.21

### Patch Changes

- Updated dependencies [634613ad]
  - pqb@0.17.7

## 2.10.20

### Patch Changes

- 5dcbaf93: Add the `pull` command to help output of rake-db

## 2.10.19

### Patch Changes

- Updated dependencies [1688e82b]
  - pqb@0.17.6
  - orchid-core@0.10.0

## 2.10.18

### Patch Changes

- 12e88c30: Support creating a databaase without specifying a user

## 2.10.17

### Patch Changes

- f92e76ed: Support relations connected by multiple columns
- Updated dependencies [f92e76ed]
  - pqb@0.17.5

## 2.10.16

### Patch Changes

- Updated dependencies [d5011e31]
  - pqb@0.17.4

## 2.10.15

### Patch Changes

- 352b58b4: rake-db: fix create and drop the table with options but without columns

## 2.10.14

### Patch Changes

- 3b63faac: rake-db: add `createIfNotExists` and `dropIfExists` to table options; allow creating empty table
- Updated dependencies [3b63faac]
  - pqb@0.17.3

## 2.10.13

### Patch Changes

- Updated dependencies [607ca901]
  - pqb@0.17.2

## 2.10.12

### Patch Changes

- Updated dependencies [ff06f0a6]
  - pqb@0.17.1

## 2.10.11

### Patch Changes

- Updated dependencies [83cf51c2]
  - pqb@0.17.0
  - orchid-core@0.10.0

## 2.10.10

### Patch Changes

- Updated dependencies [52196f7d]
  - pqb@0.16.6

## 2.10.9

### Patch Changes

- Updated dependencies [23558c67]
  - pqb@0.16.5
  - orchid-core@0.9.1

## 2.10.8

### Patch Changes

- Updated dependencies [ed4ab58c]
  - orchid-core@0.9.0
  - pqb@0.16.4

## 2.10.7

### Patch Changes

- Updated dependencies [a9e48cd8]
  - pqb@0.16.3
  - orchid-core@0.8.2

## 2.10.6

### Patch Changes

- Updated dependencies [d1dad50d]
  - pqb@0.16.2
  - orchid-core@0.8.1

## 2.10.5

### Patch Changes

- Updated dependencies [0ef20d80]
  - pqb@0.16.1

## 2.10.4

### Patch Changes

- 3735f9dd: rake-db: drop column default before setting a new one when chaning column type

## 2.10.3

### Patch Changes

- Updated dependencies [b7a2d035]
  - pqb@0.16.0
  - orchid-core@0.8.0

## 2.10.2

### Patch Changes

- 2d860221: Add support for generated columns and for the full text search
- Updated dependencies [2d860221]
  - pqb@0.15.2
  - orchid-core@0.7.1

## 2.10.1

### Patch Changes

- Updated dependencies [d43af0b2]
  - pqb@0.15.1

## 2.10.0

### Minor Changes

- 1b3e98a5: Upgrade aggregate and window functions, having clause

### Patch Changes

- Updated dependencies [1b3e98a5]
  - pqb@0.15.0
  - orchid-core@0.7.0

## 2.9.3

### Patch Changes

- Updated dependencies [ccc5e2aa]
  - pqb@0.14.3
  - orchid-core@0.6.2

## 2.9.2

### Patch Changes

- Updated dependencies [7a201dfc]
- Updated dependencies [52fe89e5]
- Updated dependencies [d5dd3bd6]
- Updated dependencies [1e0e7e7a]
  - pqb@0.14.2
  - orchid-core@0.6.1

## 2.9.1

### Patch Changes

- Updated dependencies [3b1bf602]
  - pqb@0.14.1

## 2.9.0

### Minor Changes

- b178ee7: Change type and behavior of raw SQL methods for the better

### Patch Changes

- Updated dependencies [b178ee7]
  - pqb@0.14.0
  - orchid-core@0.6.0

## 2.8.50

### Patch Changes

- Updated dependencies [81ebb5d]
  - pqb@0.13.3

## 2.8.49

### Patch Changes

- 3e52bce: Add `createCollation` and `dropCollation` migration methods.
  Fix bug when specifying a collation for the column.

## 2.8.48

### Patch Changes

- Updated dependencies [a7baab8]
  - orchid-core@0.5.2
  - pqb@0.13.2

## 2.8.47

### Patch Changes

- 695f390: Internal change: change filePath property of BaseTable and extended tables to the getFilePath method
- Updated dependencies [695f390]
  - orchid-core@0.5.1
  - pqb@0.13.1

## 2.8.46

### Patch Changes

- Updated dependencies [78b65c4]
  - pqb@0.13.0
  - orchid-core@0.5.0

## 2.8.45

### Patch Changes

- Updated dependencies [cbc1121]
  - pqb@0.12.5

## 2.8.44

### Patch Changes

- Updated dependencies [3116713]
  - pqb@0.12.4

## 2.8.43

### Patch Changes

- Updated dependencies [c2d3eb0]
  - pqb@0.12.3

## 2.8.42

### Patch Changes

- Updated dependencies [d16ab35]
  - pqb@0.12.2
  - orchid-core@0.4.14

## 2.8.41

### Patch Changes

- Updated dependencies [35c437e]
  - pqb@0.12.1

## 2.8.40

### Patch Changes

- Updated dependencies [96f2cef]
  - pqb@0.12.0

## 2.8.39

### Patch Changes

- Updated dependencies [31e7d23]
  - pqb@0.11.35

## 2.8.38

### Patch Changes

- Updated dependencies [d8bc7cf]
  - pqb@0.11.34

## 2.8.37

### Patch Changes

- Updated dependencies [275cc73]
  - pqb@0.11.33

## 2.8.36

### Patch Changes

- Updated dependencies [2881707]
  - pqb@0.11.32
  - orchid-core@0.4.13

## 2.8.35

### Patch Changes

- Updated dependencies [8ae4fe3]
  - pqb@0.11.31

## 2.8.34

### Patch Changes

- e9a4095: Change column.parse function to also process null values
- Updated dependencies [e9a4095]
  - pqb@0.11.30
  - orchid-core@0.4.12

## 2.8.33

### Patch Changes

- Updated dependencies [4893640]
  - pqb@0.11.29
  - orchid-core@0.4.11

## 2.8.32

### Patch Changes

- Updated dependencies [0535450]
  - pqb@0.11.28
  - orchid-core@0.4.10

## 2.8.31

### Patch Changes

- 4287137: Add `sql` method to accept raw SQL via template literals
- Updated dependencies [4287137]
  - pqb@0.11.27
  - orchid-core@0.4.9

## 2.8.30

### Patch Changes

- Updated dependencies [2e8e2a3]
  - pqb@0.11.26

## 2.8.29

### Patch Changes

- Updated dependencies [a33d1a1]
  - pqb@0.11.25

## 2.8.28

### Patch Changes

- Updated dependencies [83d8eed]
  - pqb@0.11.24

## 2.8.27

### Patch Changes

- Updated dependencies [9610b44]
  - orchid-core@0.4.8
  - pqb@0.11.23

## 2.8.26

### Patch Changes

- Updated dependencies [c7298d6]
  - pqb@0.11.22

## 2.8.25

### Patch Changes

- 64353f7: Make identity column optional when creating
- 63934b5: Fix ordering and using where for the column of selected relation
- 23d8a2a: Fix `nowSQL` to be wrapped into parens automatically
- Updated dependencies [64353f7]
- Updated dependencies [63934b5]
- Updated dependencies [23d8a2a]
  - pqb@0.11.21
  - orchid-core@0.4.7

## 2.8.24

### Patch Changes

- Support ESM in ORM codegen

## 2.8.23

### Patch Changes

- Fix importing of ORM in the ORM codegen

## 2.8.22

### Patch Changes

- Move ORM codegen module to a separate bundle

## 2.8.21

### Patch Changes

- Ignore directories in migrations dir when migrating

## 2.8.20

### Patch Changes

- Add recurrent migrations

## 2.8.19

### Patch Changes

- Updated dependencies
- Updated dependencies [e8a863d]
  - pqb@0.11.20

## 2.8.18

### Patch Changes

- Allow to customize timestamp default value with `nowSQL` option of base table
- Updated dependencies
  - pqb@0.11.19
  - orchid-core@0.4.6

## 2.8.17

### Patch Changes

- Updated dependencies
  - pqb@0.11.18

## 2.8.16

### Patch Changes

- Updated dependencies
  - pqb@0.11.17

## 2.8.15

### Patch Changes

- Updated dependencies
  - pqb@0.11.16

## 2.8.14

### Patch Changes

- Updated dependencies
  - pqb@0.11.15

## 2.8.13

### Patch Changes

- Updated dependencies
- Updated dependencies [dfc2b87]
  - pqb@0.11.14

## 2.8.12

### Patch Changes

- Updated dependencies
- Updated dependencies [96504ef]
  - pqb@0.11.13
  - orchid-core@0.4.5

## 2.8.11

### Patch Changes

- Add testTransaction utility for tests
- Updated dependencies [cfdc2bb]
- Updated dependencies
  - pqb@0.11.12
  - orchid-core@0.4.4

## 2.8.10

### Patch Changes

- Rename timestampWithoutTimezone to timestampNoTZ; Add methods for it
- Updated dependencies
  - pqb@0.11.11
  - orchid-core@0.4.4

## 2.8.9

### Patch Changes

- Updated dependencies
  - pqb@0.11.10
  - orchid-core@0.4.3

## 2.8.8

### Patch Changes

- Make passing this not required when customizing column types
- Updated dependencies
  - pqb@0.11.9
  - orchid-core@0.4.2

## 2.8.7

### Patch Changes

- Updated dependencies
  - pqb@0.11.8

## 2.8.6

### Patch Changes

- Updated dependencies
  - pqb@0.11.7

## 2.8.5

### Patch Changes

- Updated dependencies
  - pqb@0.11.6

## 2.8.4

### Patch Changes

- Updated dependencies
  - pqb@0.11.5

## 2.8.3

### Patch Changes

- Updated dependencies
  - pqb@0.11.4
  - orchid-core@0.4.1

## 2.8.2

### Patch Changes

- Remove unneeded dependencies

## 2.8.1

### Patch Changes

- Automaticly define relations from db pull or after running migrations

## 2.8.0

### Minor Changes

- Change appCodeUpdater config to take path and name of the base table from baseTable option

### Patch Changes

- Updated dependencies
  - orchid-core@0.4.0
  - pqb@0.11.3

## 2.7.2

### Patch Changes

- Fix import error

## 2.7.1

### Patch Changes

- Updated dependencies
  - pqb@0.11.2
  - orchid-core@0.3.1

## 2.7.0

### Minor Changes

- Support overriden column types in rake-db

### Patch Changes

- Updated dependencies
  - orchid-core@0.3.0
  - pqb@0.11.1

## 2.6.0

### Minor Changes

- Remove cli columns parsing when generating new migration

## 2.5.0

### Minor Changes

- Implicitly pass transaction object by using AsyncLocalStorage

### Patch Changes

- Updated dependencies
  - pqb@0.11.0
  - orchid-core@0.2.0

## 2.4.44

### Patch Changes

- Better support for custom schema in rake-db

## 2.4.43

### Patch Changes

- Update dependencies
- Updated dependencies
  - pqb@0.10.36

## 2.4.42

### Patch Changes

- Updated dependencies
  - pqb@0.10.35

## 2.4.41

### Patch Changes

- Initial support for db views
- Updated dependencies
  - orchid-core@0.1.17
  - pqb@0.10.34

## 2.4.40

### Patch Changes

- Favor timestamptz over timestamp
- Updated dependencies
  - orchid-core@0.1.16
  - pqb@0.10.33

## 2.4.39

### Patch Changes

- Updated dependencies
  - pqb@0.10.32

## 2.4.38

### Patch Changes

- Support identity columns
- Updated dependencies
  - orchid-core@0.1.15
  - pqb@0.10.31

## 2.4.37

### Patch Changes

- Simplify current_timestamp, transaction_timestamp() to the equivalent now() in db pull
- Updated dependencies
  - pqb@0.10.30

## 2.4.36

### Patch Changes

- Return table interface from createTable

## 2.4.35

### Patch Changes

- Use gen_random_uuid as a default uuid default
- Updated dependencies
  - orchid-core@0.1.14
  - pqb@0.10.29

## 2.4.34

### Patch Changes

- Updated dependencies
  - pqb@0.10.28

## 2.4.33

### Patch Changes

- Hide internal query log in migrations

## 2.4.32

### Patch Changes

- Support NULLS NOT DISTINCT for unique index
- Updated dependencies
  - pqb@0.10.27

## 2.4.31

### Patch Changes

- Updated dependencies
  - pqb@0.10.26

## 2.4.30

### Patch Changes

- Updated dependencies
  - pqb@0.10.25

## 2.4.29

### Patch Changes

- Remove undefined and void from json schema
- Updated dependencies
  - orchid-core@0.1.13
  - pqb@0.10.24

## 2.4.28

### Patch Changes

- Support db table checks and constraints
- Updated dependencies
  - orchid-core@0.1.12
  - pqb@0.10.23

## 2.4.27

### Patch Changes

- Updated dependencies
  - pqb@0.10.22

## 2.4.26

### Patch Changes

- Updated dependencies
  - pqb@0.10.21

## 2.4.25

### Patch Changes

- Updated dependencies
  - pqb@0.10.20

## 2.4.24

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.11
  - pqb@0.10.19

## 2.4.23

### Patch Changes

- Updated dependencies
  - pqb@0.10.18

## 2.4.22

### Patch Changes

- Add `db redo` command, rename `db g` to `db new`

## 2.4.21

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.10
  - pqb@0.10.17

## 2.4.20

### Patch Changes

- Fix generating enum column from db pull to ORM
- Updated dependencies
- Updated dependencies [c8df1f9]
  - orchid-core@0.1.9
  - pqb@0.10.16

## 2.4.19

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.8
  - pqb@0.10.15

## 2.4.18

### Patch Changes

- Fix handling undefined values in foreign key when pulling db
- Updated dependencies
  - orchid-core@0.1.7
  - pqb@0.10.14

## 2.4.17

### Patch Changes

- Support snakeCase option
- Updated dependencies
  - orchid-core@0.1.6
  - pqb@0.10.13

## 2.4.16

### Patch Changes

- Updated dependencies
  - pqb@0.10.12

## 2.4.15

### Patch Changes

- Support runtime default; Add createManyRaw and createManyFrom
- Updated dependencies
  - orchid-core@0.1.5
  - pqb@0.10.11

## 2.4.14

### Patch Changes

- Add citext
- Updated dependencies
  - pqb@0.10.10

## 2.4.13

### Patch Changes

- Improve handling of array and domains in db pull

## 2.4.12

### Patch Changes

- Fix pulling domain column

## 2.4.11

### Patch Changes

- Fix db pull

## 2.4.10

### Patch Changes

- 8d35851: Handle unsupported types
- Updated dependencies [8d35851]
  - pqb@0.10.9

## 2.4.9

### Patch Changes

- Support domain types
- Updated dependencies
  - orchid-core@0.1.4
  - pqb@0.10.8

## 2.4.8

### Patch Changes

- Support database CHECK validation
- Updated dependencies
  - orchid-core@0.1.3
  - pqb@0.10.7

## 2.4.7

### Patch Changes

- Improve .unique code gen, save migration verion after db pull
- Updated dependencies
  - pqb@0.10.6

## 2.4.6

### Patch Changes

- Run appCodeUpdater after db pull

## 2.4.5

### Patch Changes

- Updated dependencies
  - pqb@0.10.5

## 2.4.4

### Patch Changes

- Updated dependencies
  - pqb@0.10.4

## 2.4.3

### Patch Changes

- Add log to appCodeUpdater, change file pathes to urls when logging
- 2b6dd66: Run appCodeUpdater after commit in migrations
- 384fbfc: Support enum, array columns in db pull
- Updated dependencies
- Updated dependencies [384fbfc]
  - orchid-core@0.1.2
  - pqb@0.10.3

## 2.4.2

### Patch Changes

- Updated dependencies
  - pqb@0.10.2

## 2.4.1

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.1
  - pqb@0.10.1

## 2.4.0

### Minor Changes

- Move common code into separate orchid-core package

### Patch Changes

- Updated dependencies
  - orchid-core@0.1.0
  - pqb@0.10.0

## 2.3.44

### Patch Changes

- Fix rake-db import on windows in ESM

## 2.3.43

### Patch Changes

- Add `raw` to column types to use in defaults
- Updated dependencies
  - pqb@0.9.27

## 2.3.42

### Patch Changes

- Updated dependencies
  - pqb@0.9.26

## 2.3.41

### Patch Changes

- Updated dependencies
  - pqb@0.9.25

## 2.3.40

### Patch Changes

- Updated dependencies
  - pqb@0.9.24

## 2.3.39

### Patch Changes

- Updated dependencies
  - pqb@0.9.23

## 2.3.38

### Patch Changes

- Updated dependencies
  - pqb@0.9.22

## 2.3.37

### Patch Changes

- Fix migrating multiple databases

## 2.3.36

### Patch Changes

- Fix migration path resolution on windows

## 2.3.35

### Patch Changes

- Updated dependencies
  - pqb@0.9.21

## 2.3.34

### Patch Changes

- Updated dependencies
  - pqb@0.9.20

## 2.3.33

### Patch Changes

- Remove myqb from rake-db deps

## 2.3.32

### Patch Changes

- Updated dependencies
- Updated dependencies [aa92f25]
  - pqb@0.9.19

## 2.3.31

### Patch Changes

- Leave only dist in shipped packages
- Updated dependencies
  - pqb@0.9.18

## 2.3.30

### Patch Changes

- Updated dependencies
  - pqb@0.9.17

## 2.3.29

### Patch Changes

- Updated dependencies
  - pqb@0.9.16

## 2.3.28

### Patch Changes

- Support enum in rake-db

## 2.3.26

### Patch Changes

- Add createEnum and dropEnum to rake-db
- Updated dependencies
  - pqb@0.9.15

## 2.3.25

### Patch Changes

- Updated dependencies
  - pqb@0.9.14

## 2.3.24

### Patch Changes

- Handle ssl required case in db create; Confirm db creation before asking for creds

## 2.3.23

### Patch Changes

- Updated dependencies
  - pqb@0.9.13

## 2.3.22

### Patch Changes

- Fix file resolution in CI

## 2.3.21

### Patch Changes

- Improve windows support for path resolution

## 2.3.20

### Patch Changes

- Fix path resolution

## 2.3.19

### Patch Changes

- Fix path resolution

## 2.3.18

### Patch Changes

- Relative path in rakeDb config

## 2.3.17

### Patch Changes

- Updated dependencies
  - pqb@0.9.12

## 2.3.16

### Patch Changes

- Updated dependencies
  - pqb@0.9.11

## 2.3.15

### Patch Changes

- Updated dependencies
  - pqb@0.9.10

## 2.3.14

### Patch Changes

- Updated dependencies
  - pqb@0.9.9

## 2.3.13

### Patch Changes

- ee1961e: Make columnTypes optional in configs
- Updated dependencies [ee1961e]
  - pqb@0.9.8

## 2.3.12

### Patch Changes

- Handle table ordering by foreign key when pulling db
- Updated dependencies
  - pqb@0.9.7

## 2.3.11

### Patch Changes

- Add generating extension to db pull

## 2.3.10

### Patch Changes

- Add custom commands to rake-db

## 2.3.9

### Patch Changes

- Add migrate and rollback callbacks

## 2.3.8

### Patch Changes

- Updated dependencies
  - pqb@0.9.6

## 2.3.7

### Patch Changes

- Mix query builder into migration db interface
- Updated dependencies
  - pqb@0.9.5

## 2.3.6

### Patch Changes

- Improve esm support
- Updated dependencies
  - pqb@0.9.4

## 2.3.5

### Patch Changes

- Change package.json exports for esm support
- Updated dependencies
  - pqb@0.9.3

## 2.3.4

### Patch Changes

- Remove createJoinTable

## 2.3.3

### Patch Changes

- Improve pullindg db structure

## 2.3.2

### Patch Changes

- Improve pulling db structure
- Updated dependencies
  - pqb@0.9.2

## 2.3.1

### Patch Changes

- Add command for pulling database structure into a migration
- Updated dependencies
  - pqb@0.9.1

## 2.3.0

### Minor Changes

- Change index options: column or expression is required, operator renamed to opclass

### Patch Changes

- f1cd5db: Handle multiple indexes and foreignKeys of the column
- Updated dependencies
- Updated dependencies [f1cd5db]
  - pqb@0.9.0

## 2.2.6

### Patch Changes

- Change inner aspects of columns
- Updated dependencies
  - pqb@0.8.5

## 2.2.5

### Patch Changes

- Fix useCodeUpdater option default

## 2.2.4

### Patch Changes

- Add --code cli argument to rake-db
- Improve codegen
- Updated dependencies
- Updated dependencies
  - pqb@0.8.4

## 2.2.3

### Patch Changes

- Updated dependencies
  - pqb@0.8.3

## 2.2.2

### Patch Changes

- Add code generator to change project files after migrations
- Updated dependencies
  - pqb@0.8.2

## 2.2.1

### Patch Changes

- Updated dependencies
  - pqb@0.8.1

## 2.2.0

### Minor Changes

- 3f25b4d: Rename all model words to table words, because all models here are not models in OOP meaning

### Patch Changes

- Updated dependencies [3f25b4d]
  - pqb@0.8.0

## 2.1.18

### Patch Changes

- Updated dependencies
  - pqb@0.7.13

## 2.1.17

### Patch Changes

- Support composite primary key by setting primaryKey on multiple columns

## 2.1.16

### Patch Changes

- Updated dependencies
  - pqb@0.7.12

## 2.1.15

### Patch Changes

- Fix creating a transaction

## 2.1.14

### Patch Changes

- Updated dependencies
  - pqb@0.7.11

## 2.1.13

### Patch Changes

- Updated dependencies
  - pqb@0.7.10

## 2.1.12

### Patch Changes

- Updated dependencies
  - pqb@0.7.9

## 2.1.11

### Patch Changes

- Change connectionString to databaseURL option, add ssl option
- Updated dependencies
  - pqb@0.7.8

## 2.1.10

### Patch Changes

- Updated dependencies
  - pqb@0.7.7

## 2.1.9

### Patch Changes

- Updated dependencies
  - pqb@0.7.6

## 2.1.8

### Patch Changes

- Updated dependencies
  - pqb@0.7.5

## 2.1.7

### Patch Changes

- Update homepage link in package.json
- Updated dependencies
  - pqb@0.7.4

## 2.1.6

### Patch Changes

- Add required min and max parameters to text column
- Updated dependencies
  - pqb@0.7.3

## 2.1.5

### Patch Changes

- Updated dependencies [9b8b3d5]
  - pqb@0.7.2

## 2.1.4

### Patch Changes

- Handle tables without primary key
- ecd7521: Support copy
- Updated dependencies
  - pqb@0.7.1

## 2.1.3

### Patch Changes

- 06b0182: Support changing compression, index, and foreign key to changeTable migration

## 2.1.0

### Minor Changes

- 883c3e4: Add changeset

### Patch Changes

- Updated dependencies [883c3e4]
  - pqb@0.7.0
