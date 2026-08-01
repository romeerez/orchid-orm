## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/orm/src/migrations/generate/generators/guidelines/test.md for coding

## 1. orm

- [x] 1.1 Attach rake-db metadata to function-style table factories
  - 1.1.1 scope: `createTableFactory` / `createTableFactory` factory metadata
  - 1.1.2 acceptance: the returned `defineTable` exposes the column types, export name, `nowSQL`, file path, snake-case option, and language option needed by rake-db without requiring class constructor behavior.
  - 1.1.3 Preserve the existing `defineTable.getFilePath()`, `exportAs`, and table-definition behavior while adding only factory-level metadata needed by rake-db.
  - 1.1.4 Cover the metadata on `defineTable` returned from `createTableFactory`, including configured `columnTypes`, `snakeCase`, `language`, `nowSQL`, and `defineTableExportAs`.
  - 1.1.5 verify implementation against guidelines
  - 1.1.6 code must be covered by tests
  - 1.1.7 tests and types must pass: run `pnpm verify`
  - 1.1.8 reconcile `spec.md` for every new user-visible requirement

## 2. rake-db

- [x] 2.1 Add normalized table-factory config support
  - 2.1.1 scope: rake-db config types and config processing
  - 2.1.2 acceptance: every public rake-db config surface that accepts `baseTable` also accepts `defineTable`, and processed config exposes effective column types, snake-case, language, `nowSQL`, export name, and file path from exactly one selected source.
  - 2.1.3 Define a structural `RakeDbDefineTable` type in rake-db without importing from orm.
  - 2.1.4 Add a normalized internal table-factory metadata shape and helper so command, migration, generation, and pull code paths do not inspect `baseTable.prototype` directly.
  - 2.1.5 Reject configs that provide both `baseTable` and `defineTable` with a clear error.
  - 2.1.6 Cover effective `columnTypes`, `snakeCase`, `language`, and mutual-exclusion behavior in config-level tests.
  - 2.1.7 verify implementation against guidelines
  - 2.1.8 code must be covered by tests
  - 2.1.9 tests and types must pass: run `pnpm verify`
  - 2.1.10 reconcile `spec.md` for every new user-visible requirement

- [x] 2.2 Use normalized metadata in migration runtime
  - 2.2.1 scope: manual migration runtime and migration DSL defaults
  - 2.2.2 acceptance: migrations run with `defineTable` config apply the same custom column types, snake-case naming, default language, no-primary-key handling, and `nowSQL` behavior that `baseTable` config applies today.
  - 2.2.3 Update migration runtime code that reads `config.baseTable` for `snakeCase`, `language`, or `nowSQL` to use normalized metadata.
  - 2.2.4 Cover programmatic `migrate` with `defineTable` metadata and timestamp default SQL from `defineTable.nowSQL`.
  - 2.2.5 Preserve `baseTable` runtime tests and behavior.
  - 2.2.6 verify implementation against guidelines
  - 2.2.7 code must be covered by tests
  - 2.2.8 tests and types must pass: run `pnpm verify`
  - 2.2.9 reconcile `spec.md` for every new user-visible requirement

## 3. orm

- [x] 3.1 Support function-style factory metadata in ORM migration generation and pull
  - 3.1.1 scope: ORM migration generator and ORM-backed pull configuration paths
  - 3.1.2 acceptance: generation and pull accept rake-db config with `defineTable` instead of `baseTable`, reject configs missing both, and preserve class-style behavior when `baseTable` is configured.
  - 3.1.3 Update invalid-config checks and messages so users know either `baseTable` or `defineTable` satisfies the generator/pull requirement.
  - 3.1.4 Route pull/app-code generation through the selected table factory source so `baseTable` keeps class-style output and `defineTable` produces function-style table definitions that import and call the configured factory export.
  - 3.1.5 Cover the `defineTable` generator requirement, pull path metadata, and legacy `baseTable` compatibility in focused ORM migration tests.
  - 3.1.6 verify implementation against guidelines
  - 3.1.7 code must be covered by tests
  - 3.1.8 tests and types must pass: run `pnpm verify`
  - 3.1.9 reconcile `spec.md` for every new user-visible requirement

## 4. docs

- [ ] 4.1 Document rake-db `defineTable` config
  - 4.1.1 scope: migration setup, programmatic migration config, and table factory docs
  - 4.1.2 acceptance: docs show function-style projects passing `defineTable` to rake-db config and explain that class-style projects continue to pass `baseTable`.
  - 4.1.3 Update examples that discuss inheriting column types, `snakeCase`, and language from `BaseTable` so they also cover the `defineTable` factory source.
  - 4.1.4 Mention that `db pull` uses `defineTable.getFilePath()` and `defineTable.exportAs` for function-style generated table files.
  - 4.1.5 verify implementation against guidelines
  - 4.1.6 code must be covered by tests
  - 4.1.7 tests and types must pass: run `pnpm verify`
  - 4.1.8 reconcile `spec.md` for every new user-visible requirement
