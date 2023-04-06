# rake-db

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
