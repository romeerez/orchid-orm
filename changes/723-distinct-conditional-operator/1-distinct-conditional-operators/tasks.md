## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/test.md for coding

## 1. pqb

- [x] 1.1 Add null-safe comparison operators to base column operators.
  - 1.1.1 scope: `pqb` column operator typing, SQL rendering, condition objects, and chainable scalar expressions.
  - 1.1.2 acceptance: every existing base-operator column type accepts `isDistinctFrom` and `isNotDistinctFrom`, and generated SQL uses `IS DISTINCT FROM` / `IS NOT DISTINCT FROM` without changing `not` or `whereNot` semantics.
  - 1.1.3 Extend the shared base operator interface and base operator object in `packages/pqb/src/columns/operators.ts` so all existing operator groups inherit `isDistinctFrom` and `isNotDistinctFrom`.
  - 1.1.4 Keep argument typing and value preparation aligned with `equals` and `not`, including simple values, nullable values when permitted by the column type, subqueries, and raw SQL expressions.
  - 1.1.5 Cover public behavior through existing where/operator tests, including simple values, `null`, subqueries or raw SQL expressions, and structural negation with `whereNot` or `{ NOT: ... }`.
  - 1.1.6 Cover chained expression behavior where base operators are exposed on scalar expressions or aggregate/filter callbacks.
  - 1.1.7 verify implementation against guidelines
  - 1.1.8 code must be covered by tests
  - 1.1.9 tests and types must pass: run `pnpm verify`
  - 1.1.10 reconcile `spec.md` for every new user-visible requirement

## 2. docs

- [x] 2.1 Document null-safe comparison operators.
  - 2.1.1 scope: `docs/src/guide/where.md` column-operator documentation and generated docs index content if required by the docs workflow.
  - 2.1.2 acceptance: users can find `isDistinctFrom` and `isNotDistinctFrom` under any-column operators, understand their SQL semantics, and see how `isDistinctFrom` replaces the manual nullable `not` workaround.
  - 2.1.3 Add concise examples for `isDistinctFrom`, `isNotDistinctFrom`, and nullable-column filtering.
  - 2.1.4 Clarify that condition-object `isDistinctFrom` is unrelated to query-result `distinct()` and aggregate `{ distinct: true }`.
  - 2.1.5 verify implementation against guidelines
  - 2.1.6 code must be covered by tests
  - 2.1.7 tests and types must pass: run `pnpm verify`
  - 2.1.8 reconcile `spec.md` for every new user-visible requirement

## 3. changeset

- [x] 3.1 Finalize the change.
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
