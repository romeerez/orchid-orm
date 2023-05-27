# orchid-core

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
