# orchid-orm

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