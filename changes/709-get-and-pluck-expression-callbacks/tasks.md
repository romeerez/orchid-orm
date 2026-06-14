## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Support expression callbacks in `get`, `getOptional`, and `pluck`.
  - 1.1.1 Extract the inner body of the `processSelectArg` object-argument `for (key in arg)` loop into a reusable function and keep `processSelectArg` using that function.
  - 1.1.2 Use the extracted function from `get`, `getOptional`, and `pluck` for callback-returned expressions only, while preserving existing column-name and direct-expression behavior.
  - 1.1.3 After the extraction and before adding new behavior, verify that all existing `pqb` and `orm` tests still pass.
  - 1.1.4 Temporarily add `if (isExpression(value)) { throw new Error('temp') }` inside the extracted function, run the relevant `pqb` and `orm` tests, and record where `select` expression callback behavior is covered.
  - 1.1.5 Remove the temporary throw and add equivalent expression callback coverage for `get`, `getOptional`, and `pluck`.
  - 1.1.6 verify if the implementation conforms to guidelines
  - 1.1.7 make sure you didn't forget to cover the implementation with tests
  - 1.1.8 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.9 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Support single-value query callbacks in `get`, `getOptional`, and `pluck`.
  - 1.2.1 Extend `get`, `getOptional`, and `pluck` callback typing so callbacks may return a query whose `returnType` is `value` or `valueOrThrow`.
  - 1.2.2 Route callback-returned single-value queries through the extracted select callback resolver, preserving parser setup, nullable result typing, return type metadata, relation lateral joins, aliases, and generated SQL.
  - 1.2.3 Temporarily add `throw new Error('temp')` inside the extracted function's `if (returnType === 'value' || returnType === 'valueOrThrow') {` branch, run the relevant `pqb` and `orm` tests, and record where `select` single-value query callback behavior is covered.
  - 1.2.4 Remove the temporary throw and add equivalent single-value query callback coverage for `get`, `getOptional`, and `pluck`.
  - 1.2.5 Verify the downstream ORM relation behavior that depends on pqb callback selection still passes, including `pnpm orm check` when the implementation is ready.
  - 1.2.6 verify if the implementation conforms to guidelines
  - 1.2.7 make sure you didn't forget to cover the implementation with tests
  - 1.2.8 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.9 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [x] 2.1 Document scalar selection callbacks.
  - 2.1.1 Update the root query-method docs for `get`, `getOptional`, and `pluck` with examples that use `q.ref`, `q.column`, or relation scalar queries inside callbacks.

## 3. changeset

- [x] 3.1 Finalize the change.
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
