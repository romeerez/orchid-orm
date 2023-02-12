# rake-db

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
