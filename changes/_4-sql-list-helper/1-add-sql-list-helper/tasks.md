## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/test.md for coding

## 1. pqb

- [x] 1.1 Add `sql.join` to the raw SQL helper surface.
  - 1.1.1 scope: `pqb` raw SQL expression helpers and public `sql` typing.
  - 1.1.2 acceptance: callers can interpolate `sql.join` in every place that currently accepts `sql` expressions, with plain items parameterized and expression items rendered as SQL.
  - 1.1.3 Extend the callable `sql` helper interface with a `join(items, separator?)` method while keeping existing `sql`, `sql.ref`, and `sql.unsafe` behavior unchanged.
  - 1.1.4 Add expression rendering for list items and custom separators using the same SQL context and value collection order as template literal interpolation.
  - 1.1.5 Keep the default separator equivalent to raw SQL `, ` and require custom separators to be SQL expressions.
  - 1.1.6 Cover values, expression items, mixed values and expressions, custom separators, value ordering, readonly arrays, empty arrays, and use through a public query method such as `whereSql` or `select`.
  - 1.1.7 verify implementation against guidelines
  - 1.1.8 code must be covered by tests
  - 1.1.9 tests and types must pass for `pqb`: `pnpm pqb check` and `pnpm pqb types`
  - 1.1.10 reconcile `spec.md` for every new user-visible requirement

## 2. docs

- [x] 2.1 Document `sql.join`.
  - 2.1.1 scope: SQL expressions guide and generated docs surface for the public `sql` helper.
  - 2.1.2 acceptance: users can discover how to build SQL lists of values and expressions and choose a custom separator.
  - 2.1.3 Update `docs/src/guide/sql-expressions.md` with examples for `ARRAY[...]`, `IN (...)`, expression lists, and custom separators.
  - 2.1.4 Ensure the `SqlFn.join` JSDoc is sufficient for the docs generator to expose the helper consistently with `sql.ref`.
  - 2.1.5 verify implementation against guidelines
  - 2.1.6 code must be covered by tests
  - 2.1.7 tests and types must pass for `pqb`: `pnpm pqb check` and `pnpm pqb types`
  - 2.1.8 reconcile `spec.md` for every new user-visible requirement

## 3. changeset

- [x] 3.1 Finalize the change.
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
