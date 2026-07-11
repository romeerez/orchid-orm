## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/test.md for coding
- you must follow packages/orm/src/migrations/generate/generators/guidelines/test.md for coding

## 1. pqb

- [x] 1.1 Add resolved database relation names to query data and standalone table construction.
  - 1.1.1 scope: `pqb` table construction options, `Db` initialization, `QueryData`, and query cloning.
  - 1.1.2 acceptance: standalone query-builder tables can keep a user-facing `table` alias while storing a separate database relation name used by SQL generation.
  - 1.1.3 Add `nameInDb?: string` to table options accepted by `createDb` table construction.
  - 1.1.4 Resolve `q.nameInDb` from explicit `nameInDb`, otherwise from `table`, applying the resolved table `snakeCase` option when appropriate.
  - 1.1.5 Preserve the current public `table` literal on query objects and in query typings.
  - 1.1.6 Cover explicit `nameInDb`, default `nameInDb`, snake-case-derived `nameInDb`, cloned queries, and unchanged behavior for tables whose alias already equals the database name.
  - 1.1.7 verify implementation against guidelines
  - 1.1.8 code must be covered by tests
  - 1.1.9 tests and types must pass: run `pnpm verify`
  - 1.1.10 reconcile `spec.md` for every new user-visible requirement
- [x] 1.2 Render SQL with database names and user-facing aliases.
  - 1.2.1 scope: `pqb` SQL relation quoting for reads, joins, mutations, truncation, materialized view refresh, and related helper paths.
  - 1.2.2 acceptance: SQL uses `nameInDb` for physical relation references and aliases the relation back to the user-facing table alias whenever qualified columns need that alias.
  - 1.2.3 Update table quoting helpers to prefer `q.nameInDb` for physical relation names while preserving schema handling.
  - 1.2.4 Update `FROM` and `JOIN` SQL so a table whose `nameInDb` differs from `table` is rendered as `"db_name" "Table"` unless an explicit query alias is already active.
  - 1.2.5 Ensure insert, update, delete, truncate, refresh materialized view, subquery, and CTE-related SQL paths still render valid relation names and aliases.
  - 1.2.6 Cover main query SQL, joined table SQL, explicit `.as(...)`, schema-qualified tables, mutations, and materialized view refreshes.
  - 1.2.7 verify implementation against guidelines
  - 1.2.8 code must be covered by tests
  - 1.2.9 tests and types must pass: run `pnpm verify`
  - 1.2.10 reconcile `spec.md` for every new user-visible requirement

## 2. orm

- [x] 2.1 Add `nameInDb` metadata to table and view classes.
  - 2.1.1 scope: `orm` base table/view instance typing, `createBaseTable`, ORM table assignment, and view registration.
  - 2.1.2 acceptance: ORM table classes and view classes can define explicit `nameInDb`, and missing `nameInDb` is derived from `table` or `name` with `snakeCase` when enabled.
  - 2.1.3 Add optional `nameInDb` typing to table, regular view, and materialized view instances.
  - 2.1.4 Normalize missing table `nameInDb` from `table` and missing view `nameInDb` from `name`, applying the instance `snakeCase` setting only when the user did not provide `nameInDb`.
  - 2.1.5 Pass the public table/view alias as the `Db` table argument and the resolved database name through `DbTableOptions`.
  - 2.1.6 Update duplicate table/view detection to compare schema-qualified database names rather than public aliases.
  - 2.1.7 Cover table classes, regular views, materialized views, explicit `nameInDb`, snake-case-derived `nameInDb`, and unchanged lowercase-name behavior.
  - 2.1.8 verify implementation against guidelines
  - 2.1.9 code must be covered by tests
  - 2.1.10 tests and types must pass: run `pnpm verify`
  - 2.1.11 reconcile `spec.md` for every new user-visible requirement
- [x] 2.2 Use `nameInDb` for database-facing ORM metadata.
  - 2.2.1 scope: `orm` migration generation, migration reporting, relation-backed metadata, grants, RLS, foreign keys, indexes, and view DDL.
  - 2.2.2 acceptance: generated migrations and database-facing metadata refer to the resolved database relation name while generated TypeScript and query-facing APIs preserve `table` and view `name`.
  - 2.2.3 Update migration generation inputs that currently read table or view aliases as database names to read resolved `nameInDb`.
  - 2.2.4 Ensure view creation, materialized view creation, grants, RLS policies, foreign keys, indexes, and duplicate reporting consistently use database names.
  - 2.2.5 Cover generated migration behavior for table and view aliases that differ from database names.
  - 2.2.6 verify implementation against guidelines
  - 2.2.7 code must be covered by tests
  - 2.2.8 tests and types must pass: run `pnpm verify`
  - 2.2.9 reconcile `spec.md` for every new user-visible requirement

## 3. test-utils

- [x] 3.1 Capitalize shared ORM test table aliases.
  - 3.1.1 scope: `packages/test-utils/src/test-db.ts` table aliases and first-party tests that reference those aliases in query strings.
  - 3.1.2 acceptance: shared tests exercise TypeScript table aliases that differ from database table names after snake-casing while generated SQL continues to target lowercase database table names through `snakeCase`.
  - 3.1.3 Change one-word `readonly table` declarations in `packages/test-utils/src/test-db.ts` to start with a capital letter, such as `User` instead of `user`, while keeping multi-word camelCase aliases such as `profilePic`.
  - 3.1.4 Update all existing tests that reference those table names in query-qualified column strings to use the capitalized alias on the query side.
  - 3.1.5 Keep expected SQL using the existing lowercase database table names.

## 4. docs

- [x] 4.1 Document table and view database names.
  - 4.1.1 scope: user docs for base tables, table definitions, views, and standalone query builder table construction.
  - 4.1.2 acceptance: users can distinguish `table` or view `name` as query aliases from `nameInDb` as the database relation name.
  - 4.1.3 Add examples for `snakeCase: true` deriving `nameInDb` from table and view aliases.
  - 4.1.4 Add examples for explicit table `nameInDb`, explicit view `nameInDb`, and standalone `createDb` `{ nameInDb }`.
  - 4.1.5 Explain that schema qualification still uses the existing `schema` option or proerty.
  - 4.1.6 verify implementation against guidelines
  - 4.1.7 code must be covered by tests
  - 4.1.8 tests and types must pass: run `pnpm verify`
  - 4.1.9 reconcile `spec.md` for every new user-visible requirement

## 5. changeset

- [x] 5.1 Finalize the change.
  - 5.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
