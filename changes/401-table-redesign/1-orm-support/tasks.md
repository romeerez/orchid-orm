## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. orm

- [x] 1.1 Support a basic function-style table
  - 1.1.1 scope: new ORM table definition interface and ORM setup acceptance
  - 1.1.2 acceptance: a table defined through `createTableFactory` can be registered in an ORM instance and its query builder produces a simple select SQL query.
  - 1.1.3 Use the draft interface in `packages/orm/src/orm-table/table.ts` as the starting point for this change; extend that interface only as needed for this basic table slice, and keep later table redesign functionality out of this task.
  - 1.1.4 When adding or changing ORM types that need to accept the new table definition values, use `OrmTable.Base` as the common type and extend it only when the implementation needs more structure from the new interface.
  - 1.1.5 Add a shared `test-utils` helper for the repeated `orchidORMWithAdapter({ adapter: testAdapter }, tables)` setup; overload it so tests can call it either as `helper(options, tables)` or as `helper(tables)` with the default test adapter options.
  - 1.1.6 Add the first behavior test for the new interface: use `createTableFactory`, define a simple table with no relations and no extra table metadata, create the ORM instance with `orchidORMWithAdapter({ adapter: testAdapter }, { table: TestTable })` through the new helper, and assert that `toSQL` on that table produces a simple select query.
  - 1.1.7 Implement only the runtime and type support needed for that test to pass while preserving existing class-based table behavior.
  - 1.1.8 After this task is complete, stop; the remaining table redesign tasks will be written later.
  - 1.1.9 verify implementation against guidelines
  - 1.1.10 code must be covered by tests
  - 1.1.11 tests and types must pass: run `pnpm verify`
  - 1.1.12 reconcile `spec.md` for every new user-visible requirement

- [x] 1.2 Support table type helpers for function-style tables
  - 1.2.1 scope: ORM table definition type-helper unwrapping
  - 1.2.2 acceptance: `Queryable`, `DefaultSelect`, `Selectable`, `Insertable`, and `Updatable` infer the same public table shapes for function-style definitions that they infer for equivalent class-based tables.
  - 1.2.3 Add one focused `packages/orm/src/orm-table/table.test.ts` test that defines a function-style table through `createTableFactory`, creates `db` the same way as the existing table test, and uses `assertType` to cover all five type helpers.
  - 1.2.4 Implement the minimal type unwrapping needed by the public helper types without changing query runtime behavior.
  - 1.2.5 verify implementation against guidelines
  - 1.2.6 code must be covered by tests
  - 1.2.7 tests and types must pass: run `pnpm verify`
  - 1.2.8 reconcile `spec.md` for every new user-visible requirement

- [x] 1.3 Support function-style `belongsTo` relation types
  - 1.3.1 scope: ORM relation selection typing for function-style `belongsTo`
  - 1.3.2 acceptance: selecting a function-style `belongsTo` relation from a function-style table infers the related table record type, including optional and `required` cases.
  - 1.3.3 Add `table.test.ts` coverage that constructs `db` like the existing function-style table test, selects with `db.mainTable.select({ rel: (q) => q.relatedTable })`, and uses `assertType` on the awaited query type for the basic and `required` cases.
  - 1.3.4 Limit implementation to handling table definition type differences in ORM relation types; do not add runtime relation behavior in this task.
  - 1.3.5 verify implementation against guidelines
  - 1.3.6 code must be covered by tests
  - 1.3.7 tests and types must pass: run `pnpm verify`
  - 1.3.8 reconcile `spec.md` for every new user-visible requirement

- [x] 1.4 Support function-style `hasOne` relation types
  - 1.4.1 scope: ORM relation selection typing for function-style `hasOne`
  - 1.4.2 acceptance: selecting a function-style `hasOne` relation from a function-style table infers the related table record type, including optional, `required`, and through-relation cases.
  - 1.4.3 Add `table.test.ts` coverage that constructs `db` like the existing function-style table test, selects with `db.mainTable.select({ rel: (q) => q.relatedTable })`, and uses `assertType` on the awaited query type for the basic, `required`, and `through` cases.
  - 1.4.4 Limit implementation to handling table definition type differences in ORM relation types; do not add runtime relation behavior in this task.
  - 1.4.5 verify implementation against guidelines
  - 1.4.6 code must be covered by tests
  - 1.4.7 tests and types must pass: run `pnpm verify`
  - 1.4.8 reconcile `spec.md` for every new user-visible requirement

- [x] 1.5 Support function-style `hasMany` relation types
  - 1.5.1 scope: ORM relation selection typing for function-style `hasMany`
  - 1.5.2 acceptance: selecting a function-style `hasMany` relation from a function-style table infers an array of related table records for direct and through-relation cases.
  - 1.5.3 Add `table.test.ts` coverage that constructs `db` like the existing function-style table test, selects with `db.mainTable.select({ rel: (q) => q.relatedTable })`, and uses `assertType` on the awaited query type for the basic and `through` cases.
  - 1.5.4 Limit implementation to handling table definition type differences in ORM relation types; do not add runtime relation behavior in this task.
  - 1.5.5 verify implementation against guidelines
  - 1.5.6 code must be covered by tests
  - 1.5.7 tests and types must pass: run `pnpm verify`
  - 1.5.8 reconcile `spec.md` for every new user-visible requirement

- [x] 1.6 Support function-style `hasAndBelongsToMany` relation types
  - 1.6.1 scope: ORM relation selection typing for function-style `hasAndBelongsToMany`
  - 1.6.2 acceptance: selecting a function-style `hasAndBelongsToMany` relation from a function-style table infers an array of related table records for the basic join-table case.
  - 1.6.3 Add `table.test.ts` coverage that constructs `db` like the existing function-style table test, selects with `db.mainTable.select({ rel: (q) => q.relatedTable })`, and uses `assertType` on the awaited query type for the basic case.
  - 1.6.4 Limit implementation to handling table definition type differences in ORM relation types; do not add runtime relation behavior in this task.
  - 1.6.5 verify implementation against guidelines
  - 1.6.6 code must be covered by tests
  - 1.6.7 tests and types must pass: run `pnpm verify`
  - 1.6.8 reconcile `spec.md` for every new user-visible requirement

- [x] 1.7 Support function-style composite primary key chain types
  - 1.7.1 scope: TypeScript support for `.primaryKey(...)` on function-style table definitions, matching the existing table-data method from the second callback argument of class-based `setColumns`.
  - 1.7.2 acceptance: a table defined with `.primaryKey(['tenantId', 'id'])` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.7.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.7.4 Do not test migration metadata, generated SQL, or runtime constraint behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.7.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.7.6 verify implementation against guidelines
  - 1.7.7 code must be covered by tests
  - 1.7.8 tests and types must pass: run `pnpm verify`
  - 1.7.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.8 Support function-style composite index chain types
  - 1.8.1 scope: TypeScript support for `.index(...)` on function-style table definitions, matching the existing table-data method from the second callback argument of class-based `setColumns`.
  - 1.8.2 acceptance: a table defined with `.index(['tenantId', 'name'])` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.8.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.8.4 Do not test migration metadata, generated SQL, or runtime index behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.8.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.8.6 verify implementation against guidelines
  - 1.8.7 code must be covered by tests
  - 1.8.8 tests and types must pass: run `pnpm verify`
  - 1.8.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.9 Support function-style composite search index chain types
  - 1.9.1 scope: TypeScript support for `.searchIndex(...)` on function-style table definitions, matching the existing table-data method from the second callback argument of class-based `setColumns`.
  - 1.9.2 acceptance: a table defined with `.searchIndex(['title', 'body'])` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.9.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.9.4 Do not test migration metadata, generated SQL, or runtime search-index behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.9.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.9.6 verify implementation against guidelines
  - 1.9.7 code must be covered by tests
  - 1.9.8 tests and types must pass: run `pnpm verify`
  - 1.9.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.10 Support function-style composite unique chain types
  - 1.10.1 scope: TypeScript support for `.unique(...)` on function-style table definitions, matching the existing table-data method from the second callback argument of class-based `setColumns`.
  - 1.10.2 acceptance: a table defined with `.unique(['tenantId', 'email'])` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.10.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.10.4 Do not test migration metadata, generated SQL, or runtime unique-index behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.10.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.10.6 verify implementation against guidelines
  - 1.10.7 code must be covered by tests
  - 1.10.8 tests and types must pass: run `pnpm verify`
  - 1.10.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.11 Support function-style composite exclude chain types
  - 1.11.1 scope: TypeScript support for `.exclude(...)` on function-style table definitions, matching the existing table-data method from the second callback argument of class-based `setColumns`.
  - 1.11.2 acceptance: a table defined with `.exclude([{ column: 'roomId', with: '=' }, { column: 'timeRange', with: '&&' }])` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.11.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.11.4 Do not test migration metadata, generated SQL, or runtime exclude behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.11.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.11.6 verify implementation against guidelines
  - 1.11.7 code must be covered by tests
  - 1.11.8 tests and types must pass: run `pnpm verify`
  - 1.11.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.12 Support function-style table check chain types
  - 1.12.1 scope: TypeScript support for `.check(...)` on function-style table definitions, matching the existing table-data method from the second callback argument of class-based `setColumns`.
  - 1.12.2 acceptance: a table defined with `.check(sql\`"startAt" < "endAt"\`)`can be passed to`testOrchidORMWithAdapter`, and `assertType`on a query from`db.table` confirms the table keeps the expected selected row type.
  - 1.12.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, gets `sql` from that same setup, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.12.4 Do not test migration metadata, generated SQL, or runtime check-constraint behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.12.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.12.6 verify implementation against guidelines
  - 1.12.7 code must be covered by tests
  - 1.12.8 tests and types must pass: run `pnpm verify`
  - 1.12.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.13 Support function-style composite foreign key chain types
  - 1.13.1 scope: TypeScript support for `.foreignKey(...)` on function-style table definitions, matching the existing table-data method from the second callback argument of class-based `setColumns`.
  - 1.13.2 acceptance: a table defined with `.foreignKey(['tenantId', 'orgId'], () => RelatedTable, ['tenantId', 'id'])` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.13.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines both related and main function-style tables through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable, relatedTable: RelatedTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.13.4 Do not test migration metadata, generated SQL, or runtime foreign-key behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.13.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.13.6 verify implementation against guidelines
  - 1.13.7 code must be covered by tests
  - 1.13.8 tests and types must pass: run `pnpm verify`
  - 1.13.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.14 Support function-style soft delete chain types
  - 1.14.1 scope: TypeScript support for `.softDelete()` and `.softDelete(columnName)` on function-style table definitions, matching the new table design where soft delete metadata is configured in the table chain.
  - 1.14.2 acceptance: a table defined with `.softDelete()` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.14.3 acceptance: a table defined with `.softDelete('archivedAt')` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.14.4 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines function-style tables through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.14.5 Do not test migration metadata, generated SQL, query filtering, delete behavior, or runtime soft-delete behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.14.6 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.14.7 verify implementation against guidelines
  - 1.14.8 code must be covered by tests
  - 1.14.9 tests and types must pass: run `pnpm verify`
  - 1.14.10 reconcile `spec.md` for every new user-visible requirement

- [x] 1.15 Support function-style computed column chain types
  - 1.15.1 scope: TypeScript support for `.computed(...)` on function-style table definitions, matching the existing class-based `setComputed` argument shapes.
  - 1.15.2 acceptance: a table defined with `.computed((q) => ({ fullName: q.computeAtRuntime(['firstName', 'lastName'], (record) => `${record.firstName} ${record.lastName}`) }))` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type including the computed column where selected.
  - 1.15.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.15.4 Do not test generated SQL, runtime computation, batch computation, hooks, or migration behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.15.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.15.6 verify implementation against guidelines
  - 1.15.7 code must be covered by tests
  - 1.15.8 tests and types must pass: run `pnpm verify`
  - 1.15.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.16 Support function-style scopes chain types
  - 1.16.1 scope: TypeScript support for `.scopes(...)` on function-style table definitions, matching the existing class-based `setScopes` object shape.
  - 1.16.2 acceptance: a table defined with `.scopes({ active: (q) => q.where({ active: true }) })` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a scoped query from `db.table` confirms the table keeps the expected selected row type.
  - 1.16.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.16.4 Do not test generated SQL, runtime scope application, default-scope behavior, or migration behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.16.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.16.6 verify implementation against guidelines
  - 1.16.7 code must be covered by tests
  - 1.16.8 tests and types must pass: run `pnpm verify`
  - 1.16.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.17 Support function-style grants chain types
  - 1.17.1 scope: TypeScript support for `.grants(...)` on function-style table definitions, matching the existing class-based `setGrants` table-local grant item array shape.
  - 1.17.2 acceptance: a table defined with `.grants([{ to: 'app_user', privileges: ['SELECT'] }])` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.17.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.17.4 Do not test migration metadata, generated SQL, grant generation, or runtime grant behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.17.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.17.6 verify implementation against guidelines
  - 1.17.7 code must be covered by tests
  - 1.17.8 tests and types must pass: run `pnpm verify`
  - 1.17.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.18 Support function-style RLS chain types
  - 1.18.1 scope: TypeScript support for `.rls(...)` on function-style table definitions, matching the same table RLS config type accepted by `defineRls`.
  - 1.18.2 acceptance: a table defined with `.rls({ enable: true, force: true, permit: [], restrict: [] })` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.18.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.18.4 Do not test migration metadata, generated SQL, RLS policy generation, or runtime RLS behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.18.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.18.6 verify implementation against guidelines
  - 1.18.7 code must be covered by tests
  - 1.18.8 tests and types must pass: run `pnpm verify`
  - 1.18.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.19 Support function-style init hook chain types
  - 1.19.1 scope: TypeScript support for `.init((orm, hooks) => void)` on function-style table definitions, matching the new table design where `init` receives the ORM instance and hook registration object instead of relying on `this`.
  - 1.19.2 acceptance: a table defined with `.init((orm, hooks) => { hooks.beforeCreate(({ set }) => { set({ name: 'new user' }); }); })` can be passed to `testOrchidORMWithAdapter`, and `assertType` on a query from `db.table` confirms the table keeps the expected selected row type.
  - 1.19.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test that defines the function-style table through `createTableFactory`, creates `db` with `testOrchidORMWithAdapter({ table: TestTable })`, and uses only `assertType` to verify the selected type from `db.table`.
  - 1.19.4 Do not test hook execution, generated SQL, insert/update/delete behavior, lifecycle ordering, or runtime init behavior in this task; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.19.5 Implement only the minimum TypeScript support needed for the test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.19.6 verify implementation against guidelines
  - 1.19.7 code must be covered by tests
  - 1.19.8 tests and types must pass: run `pnpm verify`
  - 1.19.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.20 Support config-bound `sql` types from function-style table config
  - 1.20.1 scope: TypeScript support for the `sql` returned from `createTableFactory` / `createTableFactory` in function-style view `sql` options, matching the public type behavior of `BaseTable.sql` and using the configured column types.
  - 1.20.2 acceptance: a table factory that destructures `{ defineView, sql }` can use `sql` in a function-style view `sql` option while preserving the expected selected row type.
  - 1.20.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test similar to the existing function-style table tests, using only `assertType` to verify the selected type from the view query.
  - 1.20.4 This task only needs type-level support; do not test SQL rendering, migration metadata, view creation, or runtime SQL behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.20.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.20.6 verify implementation against guidelines
  - 1.20.7 code must be covered by tests
  - 1.20.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.21 Support basic regular function-style view types
  - 1.21.1 scope: TypeScript support for `defineView(name, options, columns)` with a regular view `sql` option and the overloaded form without an options object when appropriate.
  - 1.21.2 acceptance: a regular view defined through `createTableFactory().defineView` can be registered under `views` in `testOrchidORMWithAdapter`, is exposed under `db.$views`, defaults to read-only at the type level, and preserves the expected selected row type.
  - 1.21.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test similar to the existing function-style table tests, using only `assertType` to verify `typeof db.$views.view.__readOnly` and the selected type from `db.$views.view`.
  - 1.21.4 This task only needs type-level support; do not test SQL rendering, view creation, migration metadata, read-only runtime errors, or runtime query behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.21.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.21.6 verify implementation against guidelines
  - 1.21.7 code must be covered by tests
  - 1.21.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.22 Support writable regular function-style view types
  - 1.22.1 scope: TypeScript support for `defineView(..., { readOnly: false, sql }, ...)`, matching class-based writable regular view typing.
  - 1.22.2 acceptance: a regular view defined with `readOnly: false` can be registered under `views`, is exposed under `db.$views`, does not carry `__readOnly: true`, and exposes mutation method types compatible with its insertable shape.
  - 1.22.3 Add one focused `packages/orm/src/orm-table/define-view.test.ts` type test similar to the existing function-style table tests, using only `assertType` to verify the writable view query type and mutation method type surface.
  - 1.22.4 This task only needs type-level support; do not test PostgreSQL write acceptance, SQL rendering, migration metadata, or runtime mutation behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.22.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.22.6 verify implementation against guidelines
  - 1.22.7 code must be covered by tests
  - 1.22.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.23 Support materialized function-style view types
  - 1.23.1 scope: TypeScript support for `defineView(..., { materialized: true, sql, withData }, ...)`, matching class-based materialized view typing.
  - 1.23.2 acceptance: a materialized view defined through `createTableFactory().defineView` can be registered under `views`, is exposed under `db.$views`, is always read-only at the type level, carries materialized query typing, and preserves the expected selected row type.
  - 1.23.3 Add one focused `packages/orm/src/orm-table/define-view.test.ts` type test similar to the existing function-style table tests, using only `assertType` to verify `__readOnly`, `__materialized`, and the selected type from `db.$views.view`.
  - 1.23.4 This task only needs type-level support; do not test refresh SQL, materialized view creation, migration metadata, read-only runtime errors, or runtime query behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.23.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.23.6 verify implementation against guidelines
  - 1.23.7 code must be covered by tests
  - 1.23.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.24 Support function-style view option types
  - 1.24.1 scope: TypeScript support for regular and materialized `defineView` option objects, including `schema`, `nameInDb`, `snakeCase`, `language`, `readOnly`, `generatorIgnore`, `sql`, `recursive`, `checkOption`, `securityBarrier`, `securityInvoker`, `materialized`, and `withData` where applicable.
  - 1.24.2 acceptance: regular and materialized views using the supported option combinations can be registered under `views`, and `assertType` on queries from `db.$views` confirms each view keeps the expected selected row type.
  - 1.24.3 Add one focused `packages/orm/src/orm-table/define-view.test.ts` type test similar to the existing function-style table tests, using only `assertType` to verify selected types from views that exercise the option surface.
  - 1.24.4 This task only needs type-level support; do not test option normalization, generated SQL, migration metadata, database names, or runtime option behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.24.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.24.6 verify implementation against guidelines
  - 1.24.7 code must be covered by tests
  - 1.24.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.25 Support query-defined function-style view types
  - 1.25.1 scope: TypeScript support for `.query((orm) => query)` on function-style view definitions, including typing the `orm` callback argument from the configured ORM shape.
  - 1.25.2 acceptance: a function-style view defined without an `sql` option can call `.query((orm) => orm.table.select(...))`, be registered under `views`, and preserve the expected selected row type from `db.$views.view`.
  - 1.25.3 Add one focused `packages/orm/src/orm-table/define-view.test.ts` type test similar to the existing function-style table tests, using only `assertType` to verify the callback can reference `orm.table` and the selected type from `db.$views.view`.
  - 1.25.4 This task only needs type-level support; do not test query compilation, generated SQL, migration metadata, missing SQL validation, dual SQL source validation, or runtime query behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.25.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.25.6 verify implementation against guidelines
  - 1.25.7 code must be covered by tests
  - 1.25.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.26 Support function-style view chain method types
  - 1.26.1 scope: TypeScript support for view-supported chain methods: `.computed(...)`, `.scopes(...)`, `.softDelete(...)`, `.relations(...)`, `.grants(...)`, and `.init(...)`.
  - 1.26.2 acceptance: a function-style view using these view-supported chain methods can be registered under `views`, and `assertType` on queries from `db.$views.view` confirms the view keeps the expected selected row type, including selected computed columns and scoped queries.
  - 1.26.3 Add focused `packages/orm/src/orm-table/define-view.test.ts` type tests similar to the existing function-style table tests, using only `assertType`; write one test per feature that needs support, such as one for `.computed(...)`, one for `.scopes(...)`, one for `.softDelete(...)`, one for `.relations(...)` covering all relation kinds, one for `.grants(...)`, and one for `.init(...)`.
  - 1.26.4 This task only needs type-level support; do not test generated SQL, runtime computation, runtime scope application, hook execution, soft-delete filtering, grants, relation SQL, or migration behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.26.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.26.6 verify implementation against guidelines
  - 1.26.7 code must be covered by tests
  - 1.26.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.27 Support direct relation types from function-style views
  - 1.27.1 scope: TypeScript support for function-style view `.relations(...)` direct `belongsTo`, `hasOne`, and `hasMany` relations using the same callable endpoint DSL as function-style tables.
  - 1.27.2 acceptance: selecting direct relations from `db.$views.view` infers the related table or view record type, including optional and `required` relation cases where supported.
  - 1.27.3 Add focused `packages/orm/src/orm-table/define-view.test.ts` type tests similar to the existing function-style table relation tests, using only `assertType` on awaited relation-select query types from `db.$views.view`; write separate tests for `belongsTo`, `hasOne`, `hasMany`, and their optional/required variants where supported.
  - 1.27.4 This task only needs type-level support; do not test relation SQL, runtime relation loading, generated SQL, foreign key generation, or migration behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.27.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.27.6 verify implementation against guidelines
  - 1.27.7 code must be covered by tests
  - 1.27.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.28 Support through and HABTM relation types from function-style views
  - 1.28.1 scope: TypeScript support for function-style view `.relations(...)` through `hasOne`, through `hasMany`, and `hasAndBelongsToMany` relations.
  - 1.28.2 acceptance: selecting through and HABTM relations from `db.$views.view` infers the related table or view record type with the same optionality and array behavior as equivalent function-style table relations.
  - 1.28.3 Add focused `packages/orm/src/orm-table/define-view.test.ts` type tests similar to the existing function-style table relation tests, using only `assertType` on awaited relation-select query types from `db.$views.view`; write separate tests for through `hasOne`, through `hasMany`, and `hasAndBelongsToMany`, and include all supported relation kinds across the direct and through relation tasks.
  - 1.28.4 This task only needs type-level support; do not test through-path runtime validation, relation SQL, join table metadata, generated SQL, foreign key generation, or migration behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.28.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.28.6 verify implementation against guidelines
  - 1.28.7 code must be covered by tests
  - 1.28.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.29 Support function-style view type helpers
  - 1.29.1 scope: TypeScript support for `Queryable`, `DefaultSelect`, `Selectable`, `Insertable`, and `Updatable` unwrapping function-style view definitions where the helper makes sense for read-only and writable views.
  - 1.29.2 acceptance: helper types infer the same public shapes for function-style regular, writable regular, and materialized view definitions that they infer for equivalent class-based views.
  - 1.29.3 Add focused `packages/orm/src/orm-table/define-view.test.ts` type tests similar to the existing table type-helper tests, using only `assertType`; write one test per helper or closely-related helper group instead of covering the whole surface in a single test.
  - 1.29.4 This task only needs type-level support; do not test schema generation, runtime mutation behavior, SQL rendering, or migration behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.29.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.29.6 verify implementation against guidelines
  - 1.29.7 code must be covered by tests
  - 1.29.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.30 Support validation method types on function-style definitions
  - 1.30.1 scope: TypeScript support for `inputSchema`, `outputSchema`, `querySchema`, `pkeySchema`, `createSchema`, and `updateSchema` methods directly on function-style table and view definition values.
  - 1.30.2 acceptance: function-style table and view definitions expose validation schema methods whose return types match the configured `schemaConfig` and the equivalent class-based helper method shapes.
  - 1.30.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test similar to the existing function-style table tests, using only `assertType` to verify the schema method return types.
  - 1.30.4 This task only needs type-level support; do not test schema parsing, schema caching, runtime validation, lazy column finalization, or migration behavior; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.30.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.30.6 verify implementation against guidelines
  - 1.30.7 code must be covered by tests
  - 1.30.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.31 Support function-style definitions in split ORM setup types
  - 1.31.1 scope: TypeScript support for `bundleOrchidORM` and `makeOrchidOrmDbWithAdapter` accepting function-style tables and views, including mixed class-based and function-style registries.
  - 1.31.2 acceptance: a bundled ORM configured with function-style tables and views exposes tables directly, views only under `$views`, and preserves the expected selected row types for both.
  - 1.31.3 Add one focused `packages/orm/src/orm-table/table.test.ts` type test similar to the existing function-style table tests, using only `assertType` to verify selected types from the bundled table and bundled view.
  - 1.31.4 This task only needs type-level support; do not test duplicate name errors, SQL rendering, migration generation, lifecycle execution, or runtime setup behavior beyond the minimum needed for the type test; do not use `expect`, `expectSql`, or `if (false)` in the new test.
  - 1.31.5 Implement only the minimum TypeScript support needed for the new `assertType` test. If the test fails at runtime, add the absolute minimum runtime stub needed and use casts such as `as never` where that keeps the runtime change tiny.
  - 1.31.6 verify implementation against guidelines
  - 1.31.7 code must be covered by tests
  - 1.31.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.32 Support HABTM join table snake-case opt-out
  - 1.32.1 scope: add explicit opt-out support for automatic HABTM join table snake-casing in both old class-based tables and new function-style tables.
  - 1.32.2 acceptance: when a class-based table has `snakeCase: true`, `hasAndBelongsToMany` still snake-cases `joinTable` automatically by default, and setting `snakeCase: false` on the same options object as `joinTable` preserves the provided join table name.
  - 1.32.3 acceptance: when a function-style table has `snakeCase: true`, `.hasAndBelongsToMany(...).through(table, currentColumns, relatedColumns)` still snake-cases the join table automatically by default, and `.through(table, currentColumns, relatedColumns, { joinTableSnakeCase: false })` preserves the provided join table name.
  - 1.32.4 Add focused coverage in `packages/orm/src/orm-table/legacy-table.test.ts` for the class-based behavior and in `packages/orm/src/orm-table/table.test.ts` for the function-style behavior.
  - 1.32.5 Implement only the runtime and type support needed for the opt-out while preserving existing default snake-case behavior.
  - 1.32.6 verify implementation against guidelines
  - 1.32.7 code must be covered by tests
  - 1.32.8 tests and types must pass: run `pnpm verify`
  - 1.32.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.33 Support schema-qualified HABTM join table names
  - 1.33.1 scope: ORM relation metadata and SQL generation for schema-qualified `hasAndBelongsToMany` join table names.
  - 1.33.2 acceptance: a function-style relation can target a join table in a specific schema by passing a dot-qualified table name to `.through`, such as `.through('schema.postTask', 'postId', 'taskId')`, and generated relation SQL qualifies the join table with that schema.
  - 1.33.3 Preserve the schema prefix separately from the join table name, so snake-casing still applies only to the table name part when enabled and `{ joinTableSnakeCase: false }` still preserves the provided table name part.
  - 1.33.4 Add focused coverage in `packages/orm/src/orm-table/table.test.ts` for function-style `hasAndBelongsToMany` through a schema-qualified join table.
  - 1.33.5 Implement only the runtime and type support needed for schema-qualified join tables while preserving existing non-qualified join table behavior.
  - 1.33.6 verify implementation against guidelines
  - 1.33.7 code must be covered by tests
  - 1.33.8 tests and types must pass: run `pnpm verify`
  - 1.33.9 reconcile `spec.md` for every new user-visible requirement
