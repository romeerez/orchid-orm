# pqb

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
