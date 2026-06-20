## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Refactor SQL computed columns to use shared selected-output SQL
  - 1.1.1 Read and follow `1-implementation-note.md` for the storage model: keep `data.computed` as the SQL-computed marker, store selected-output SQL in `data.selectSql`, and let SQL computed columns populate both fields.
  - 1.1.2 Add `data.selectSql` metadata support to pqb columns for selected-output SQL rendering.
  - 1.1.3 Update SQL computed column setup so SQL computed columns keep `data.computed` and also assign the same expression to `data.selectSql`.
  - 1.1.4 Refactor selected-output SQL helpers to read `data.selectSql` for computed columns while preserving existing SQL computed column behavior, including aliases, dotted joined selections, `get`, `pluck`, hook selects, select-all exclusion, and mutation `RETURNING`.
  - 1.1.5 Keep existing SQL computed semantics unchanged: virtual/read-only/default-excluded behavior still comes from `data.computed`, not from `data.selectSql`.
  - 1.1.6 verify if the implementation conforms to guidelines
  - 1.1.7 make sure you didn't forget to cover the implementation with tests
  - 1.1.8 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.9 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Implement real-column `selectSql` in `pqb` extra features
  - 1.2.1 Add the new feature under `packages/pqb/src/query/extra-features/select-sql`, following the shared selected-output SQL model from `1-implementation-note.md`.
  - 1.2.2 Add a chainable column method that stores a read-side SQL projection in `data.selectSql` without setting SQL computed-column virtual/read-only/default-excluded state.
  - 1.2.3 Define the physical self-reference passed to the callback so it renders the current physical column with the active alias and cannot recurse through `selectSql`.
  - 1.2.4 Use a physical-column expression for the callback self-reference; do not use helpers that can expand selected projections.
  - 1.2.5 Preserve normal column input, query, encode, validation, and migration-facing metadata while allowing explicitly typed expressions to drive selected output metadata.
  - 1.2.6 Route explicit selects, aliased selects, dotted joined selects, select-all, `get`, `pluck`, hook selects, and mutation `RETURNING` through selected-output helpers that check `data.selectSql`.
  - 1.2.7 Preserve physical-column SQL for create, update, upsert, conflict targets, merge assignments, query conditions, ordering, grouping, join conditions, and user-authored column references outside the `selectSql` callback.
  - 1.2.8 Make select-all and wildcard paths produce projected SQL for transformed columns without changing `select(false)` exclusion behavior.
  - 1.2.9 Cover all relevant cases with tests: default select, `select('*')`, explicit select, aliased select, dotted joined select, joined wildcard, nested relation JSON, `get`, `pluck`, hook selects, mutation `RETURNING`, physical write/query paths, parser metadata, and `jsonCast`.
  - 1.2.10 verify if the implementation conforms to guidelines
  - 1.2.11 make sure you didn't forget to cover the implementation with tests
  - 1.2.12 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.13 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.3 Preserve output shape, parser, and JSON behavior
  - 1.3.1 Keep selected result shapes aligned with normal real-column selection for default selects, subqueries, aliases, and wildcard selections.
  - 1.3.2 Apply the correct parser and JSON-cast metadata for nested relation JSON, joined wildcard payloads, and expression-typed `selectSql` results.
  - 1.3.2a Follow `1-implementation-note.md` for JSON row builders: `selectSql` must force expression-aware `json_build_object` where `row_to_json(table.*)` would bypass the projection, while preserving `jsonCast`.
  - 1.3.3 verify if the implementation conforms to guidelines
  - 1.3.4 make sure you didn't forget to cover the implementation with tests
  - 1.3.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.3.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [x] 2.1 Preserve ORM integration boundaries
  - 2.1.1 Ensure ORM table definitions, relation selections, and mutation relation selections inherit `pqb` `selectSql` behavior for selected output.
  - 2.1.2 Ensure migration generation treats `selectSql` columns as physical columns and continues to exclude only virtual SQL computed columns from generated database structure.
  - 2.1.2a Follow `1-implementation-note.md`: migration generation must keep using SQL-computed metadata as the virtual-column marker and must not remove columns solely because they have `selectSql`.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. docs

- [x] 3.1 Document real-column select SQL
  - 3.1.1 Add user-facing docs for `.selectSql(...)` near common column methods and cross-reference it from computed columns as the right choice for transforming reads of a stored writable column.
  - 3.1.2 Note the important gotchas: it is selected by default unless `select(false)` is used, writes and filters still use the physical column, and sibling-column expressions should use SQL computed columns or query-level SQL.

## 4. changeset

- [x] 4.1 Finalize the change
  - 4.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
