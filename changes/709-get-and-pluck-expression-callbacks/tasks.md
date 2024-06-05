## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [ ] 1.1 Add expression callback arguments to scalar selection methods.
  - 1.1.1 Extend `get`, `getOptional`, and `pluck` argument typing so callbacks receive the current query and must return an `Expression`.
  - 1.1.2 Resolve callback arguments during query construction and route the returned expression through the same scalar selection path used by direct expression arguments.
  - 1.1.3 Preserve current column-name and direct-expression behavior, including parser setup, nullable result typing, return type metadata, and chained expression operators.
  - 1.1.4 verify if the implementation conforms to guidelines
  - 1.1.5 make sure you didn't forget to cover the implementation with tests
  - 1.1.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [ ] 2.1 Document scalar expression callbacks.
  - 2.1.1 Update the root query-method docs for `get`, `getOptional`, and `pluck` with examples that use `q.ref` or `q.column` inside a callback returning an SQL expression.
