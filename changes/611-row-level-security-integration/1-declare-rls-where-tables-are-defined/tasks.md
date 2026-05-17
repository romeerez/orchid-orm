## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. orm

- [ ] 1.1 Orchid ORM RLS table flag declaration baseline
  - 1.1.1 Add the `orchidORM` `rls.tableRlsDefaults` option and store the provided `rls` setting on the underlying `db.internal` structure for later migration-generator use; leave it `undefined` there when the user does not pass `rls`.
  - 1.1.2 Export a minimal `defineRls` identity helper and table `rls` metadata shape that support only `enable` and `force`; do not add policy arrays or policy migration behavior in this task.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. rake-db

- [ ] 2.1 DB structure introspection for table RLS flags
  - 2.1.1 Add `rls?: boolean` to `introspectDbSchema` params and load table `enable` and `force` RLS flags only when that param is true.
  - 2.1.2 Keep policy introspection out of this task and preserve the existing introspected structure when `rls` is omitted or false.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 2.2 RLS table flag support throughout rake-db
  - 2.2.1 Add reversible `enableRls`, `disableRls`, `forceRls`, and `noForceRls` migration methods with schema-qualified table-name support.
  - 2.2.2 Represent table RLS flag changes in AST, dependency sorting, migration SQL execution, generated migration code, structure-to-AST conversion, and pull flows without adding policy support.
  - 2.2.3 verify if the implementation conforms to guidelines
  - 2.2.4 make sure you didn't forget to cover the implementation with tests
  - 2.2.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.2.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. orm

- [ ] 3.1 ORM migration generation for table RLS flags
  - 3.1.1 Before introspection, scan all code tables for an `rls` declaration and pass `rls: true` to `introspectDbSchema` only when at least one declaration exists.
  - 3.1.2 Normalize declared table `enable` and `force` flags with `tableRlsDefaults`, compare them to introspected table flags, and generate only rake-db table-flag migration methods.
  - 3.1.3 Keep policy configuration and policy diffing out of this task.
  - 3.1.4 verify if the implementation conforms to guidelines
  - 3.1.5 make sure you didn't forget to cover the implementation with tests
  - 3.1.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 3.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 4. docs

- [ ] 4.1 Document table RLS flags and defaults
  - 4.1.1 Update the RLS and setup docs to show `defineRls` with `enable` and `force`, explain `orchidORM` `rls.tableRlsDefaults`, and state that defaults apply only to tables with an explicit `rls` declaration.
  - 4.1.2 Explain that enabling RLS without applicable policies is Postgres default deny, and keep policy examples out until policy support is implemented.

## 5. rake-db

- [ ] 5.1 DB structure introspection for RLS policies
  - 5.1.1 Expand `introspectDbSchema(adapter, { rls: true })` to load policy metadata from Postgres, including table identity, policy name, mode, command, roles, `USING`, and `WITH CHECK`.
  - 5.1.2 Preserve the no-policy behavior from table-flag introspection when `rls` is omitted or false.
  - 5.1.3 verify if the implementation conforms to guidelines
  - 5.1.4 make sure you didn't forget to cover the implementation with tests
  - 5.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 5.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 5.2 Rake-db policy support
  - 5.2.1 Add typed `createPolicy`, `dropPolicy`, and `changePolicy` migration methods with permissive/restrictive mode, command-specific `using` and `withCheck` rules, role targets, and reversible rollback data.
  - 5.2.2 Add policy AST, dependency sorting, migration SQL execution, generated migration code, structure-to-AST conversion, and pull support independently of ORM table declarations.
  - 5.2.3 Make `changePolicy` use direct `ALTER POLICY` for supported rename, role, `USING`, and `WITH CHECK` changes, and recreate policies when table, mode, or command changes.
  - 5.2.4 verify if the implementation conforms to guidelines
  - 5.2.5 make sure you didn't forget to cover the implementation with tests
  - 5.2.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 5.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 6. orm

- [ ] 6.1 ORM table policy config and migration generation
  - 6.1.1 Expand `defineRls` to the final table policy shape with required `permit`, optional `restrict`, raw SQL expressions, role targets, and command-specific TypeScript rules.
  - 6.1.2 Normalize declared policies, compare them to introspected policies for tables with `rls`, and generate rake-db policy methods in the ordering required by RLS enablement and default-deny behavior.
  - 6.1.3 Add RLS-specific generator ignore support for managed tables or named policies without changing ordinary table diffing behavior.
  - 6.1.4 verify if the implementation conforms to guidelines
  - 6.1.5 make sure you didn't forget to cover the implementation with tests
  - 6.1.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 6.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 7. docs

- [ ] 7.1 Document RLS policies
  - 7.1.1 Add policy docs that show `permit` and `restrict`, raw SQL expressions, policy command rules, role targets, migration generation, and manual rake-db policy methods.
  - 7.1.2 Warn that users must define at least one applicable `permit` policy to allow access; restrictive policies alone still result in Postgres deny-all behavior.
  - 7.1.3 Keep roles and grants documented as separate requirements, and call out owner, superuser, `BYPASSRLS`, view, constraint-check, and `current_setting(..., true)` gotchas.
