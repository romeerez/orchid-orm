## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md or guidelines/test.md for coding

## 1. orm

- [x] 1.1 Separate common and function-style table factory options
  - 1.1.1 scope: ORM table-factory public option types and legacy factory compatibility
  - 1.1.2 acceptance: the legacy `createBaseTable` continues to accept only shared options through `CommonTableFactoryOptions`, while function-style `createTableFactory` accepts its extended public `TableFactoryOptions`.
  - 1.1.3 Rename the shared options interface and introduce the function-style extension with factory defaults for `schema`, `noPrimaryKey`, and `generatorIgnore`.
  - 1.1.4 Preserve the public exports and generic column/schema typing for both factory styles.
  - 1.1.5 verify implementation against guidelines
  - 1.1.6 code must be covered by tests
  - 1.1.7 tests and types must pass: run `pnpm verify`
  - 1.1.8 reconcile `spec.md` for every new user-visible requirement

- [x] 1.2 Apply function-style factory defaults to table definitions
  - 1.2.1 scope: `createTableFactory` table construction and ORM/migration metadata
  - 1.2.2 acceptance: factory-level `schema`, `noPrimaryKey`, and `generatorIgnore` become table defaults, and explicitly supplied per-table values—including `false`—override them without affecting legacy tables or views.
  - 1.2.3 Resolve each supported default independently when creating a table so runtime SQL, primary-key handling, and migration-ignore metadata match equivalent per-table configuration.
  - 1.2.4 Widen the function-style per-table `generatorIgnore` option to permit an explicit `false` opt-out while retaining truthy migration-ignore behavior.
  - 1.2.5 verify implementation against guidelines
  - 1.2.6 code must be covered by tests
  - 1.2.7 tests and types must pass: run `pnpm verify`
  - 1.2.8 reconcile `spec.md` for every new user-visible requirement

- [x] 1.3 Add derived `defineTable` helpers
  - 1.3.1 scope: `defineTable` callable API, factory option inheritance, and table-definition typing
  - 1.3.2 acceptance: every function-style `defineTable` exposes chainable `extend(options)` that creates an independent helper with inherited, overridden options and the appropriate schema and column types.
  - 1.3.3 Implement immutable runtime composition so extensions affect only their descendant helpers and tables, retaining `defineTable` overloads, metadata, and file-path behavior without changing `defineView` or `sql`.
  - 1.3.4 Represent `extend` in the public `OrmTable.DefineTable` interface with generic propagation for overridden and retained `schemaConfig` and `columnTypes`.
  - 1.3.5 verify implementation against guidelines
  - 1.3.6 code must be covered by tests
  - 1.3.7 tests and types must pass: run `pnpm verify`
  - 1.3.8 reconcile `spec.md` for every new user-visible requirement

## 2. docs

- [x] 2.1 Document function-style table defaults and derived helpers
  - 2.1.1 Update the table-factory and table-definition guides with the supported factory defaults, per-table precedence, and a tenant-schema `defineTable.extend` example that makes clear the parent helper remains unchanged.

## 3. changeset

- [x] 3.1 Finalize the change
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
