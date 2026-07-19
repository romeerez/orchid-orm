## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/orm/src/migrations/generate/generators/guidelines/test.md for coding

## 1. pqb

- [x] 1.1 Add deferrable unique option types and metadata.
  - 1.1.1 scope: table data index and unique option typing.
  - 1.1.2 acceptance: all existing index and unique declaration surfaces can carry `deferrable?: false | 'immediate' | 'deferred'` only where the definition is unique.
  - 1.1.3 Make `index` function option arguments a union where `deferrable` is only available together with `unique: true`.
  - 1.1.4 Keep `unique` function option arguments non-union while allowing optional `deferrable`.
  - 1.1.5 Ensure `deferrable: true` is rejected by the public types.
  - 1.1.6 Store deferrability together with the existing index options in normalized table data.
  - 1.1.7 Cover the few user-facing index-definition use cases: column `.index({ unique: true })`, table `t.index(..., { unique: true })`, column `.unique(...)`, and table `t.unique(...)`.
  - 1.1.8 verify implementation against guidelines
  - 1.1.9 code must be covered by tests
  - 1.1.10 tests and types must pass: run `pnpm verify`
  - 1.1.11 reconcile `spec.md` for every new user-visible requirement

## 2. rake-db

- [x] 2.1 Emit deferrable unique constraint SQL from migration table definitions.
  - 2.1.1 scope: create-table and change-table SQL generation for unique index metadata.
  - 2.1.2 acceptance: deferrable unique definitions generate Postgres unique constraint SQL with the correct initial timing mode.
  - 2.1.3 Add `create-table` coverage showing column and composite unique definitions with `deferrable` affect generated SQL.
  - 2.1.4 Add `change-table` coverage showing add, drop, and change flows for deferrable unique definitions affect generated SQL.
  - 2.1.5 Keep non-deferrable unique definitions on the existing SQL path unless `deferrable` is `'immediate'` or `'deferred'`.
  - 2.1.6 Fail clearly instead of generating invalid SQL for active deferrability combined with unsupported partial, expression, or index-only options.
  - 2.1.7 verify implementation against guidelines
  - 2.1.8 code must be covered by tests
  - 2.1.9 tests and types must pass: run `pnpm verify`
  - 2.1.10 reconcile `spec.md` for every new user-visible requirement

- [x] 2.2 Preserve deferrable unique metadata for generation inputs.
  - 2.2.1 scope: database structure and AST conversion for unique index/constraint metadata.
  - 2.2.2 acceptance: introspected deferrable unique constraints retain `'immediate'` or `'deferred'` so downstream migration generation can compare them with code definitions.
  - 2.2.3 Include deferrability in the database structure shape used by index and unique migration generation.
  - 2.2.4 Normalize `false` and omitted deferrability so current non-deferrable behavior remains unchanged.
  - 2.2.5 verify implementation against guidelines
  - 2.2.6 code must be covered by tests
  - 2.2.7 tests and types must pass: run `pnpm verify`
  - 2.2.8 reconcile `spec.md` for every new user-visible requirement

## 3. orm

- [x] 3.1 Generate migrations for deferrable unique differences.
  - 3.1.1 scope: index and exclude migration generator comparison for unique definitions.
  - 3.1.2 acceptance: ORM migration generation detects adding, dropping, and changing deferrable unique definitions.
  - 3.1.3 Add tests in `indexes-and-excludes.generator.test` for adding a deferrable unique index/constraint from code.
  - 3.1.4 Add tests in `indexes-and-excludes.generator.test` for dropping a deferrable unique index/constraint missing from code.
  - 3.1.5 Add tests in `indexes-and-excludes.generator.test` for changing from one deferrable option to another, including non-deferrable to deferrable and immediate to deferred.
  - 3.1.6 Ensure generated migration code includes `deferrable: 'immediate'` or `deferrable: 'deferred'` on the existing `t.unique` or unique `t.index` surfaces.
  - 3.1.7 verify implementation against guidelines
  - 3.1.8 code must be covered by tests
  - 3.1.9 tests and types must pass: run `pnpm verify`
  - 3.1.10 reconcile `spec.md` for every new user-visible requirement

## 4. docs

- [x] 4.1 Document deferrable unique constraints.
  - 4.1.1 Update migration/index documentation to show `deferrable: 'immediate'` and `deferrable: 'deferred'` on unique definitions.
  - 4.1.2 State that `deferrable: true` is not supported.
  - 4.1.3 Explain that partial unique indexes with `where` cannot be deferrable in Postgres, so soft-delete scoped uniqueness must remain an immediate partial unique index or become an all-row deferrable unique constraint.

## 5. changeset

- [-] 5.1 Finalize the change
  - 5.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
