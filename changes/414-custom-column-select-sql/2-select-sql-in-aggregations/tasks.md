## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `## Detailed Design`, before starting implementation. Follow that design for every later task.
- 0.2 For coding work, read and follow:
  - `guidelines/code.md`
  - `packages/pqb/src/query/guidelines/code.md`

## 1. pqb

- [x] 1.1 Add aggregate `selectSql` SQL coverage
  - 1.1.1 Add or keep the failing runtime case in `packages/pqb/src/query/extra-features/select-sql/select-sql.test.ts`: `UserWithAge.sum('balance')` with `balance: t.decimal().selectSql((column) => sql\`trim_scale(${column})\`)`should return`'3.3'`for`1.1000 + 2.2000`.
  - 1.1.2 Add SQL-shape coverage showing an aggregate argument uses `selectSql`, for example `sum('balance')` renders `sum(trim_scale("user_with_age"."balance"))`.
  - 1.1.3 Add SQL-shape coverage showing aggregate options remain physical, for example the aggregate argument uses `trim_scale(...)` while `filter` or `order` still uses `"user_with_age"."balance"`.

- [x] 1.2 Route aggregate value arguments through selected-output SQL
  - 1.2.1 Update aggregate function argument rendering so string selectable arguments use the selected-output column SQL helper that checks `data.selectSql`.
  - 1.2.2 Apply the same selected-output behavior to aggregate object pair values such as `jsonObjectAgg({ amount: 'balance' })`.
  - 1.2.3 Preserve raw SQL expression behavior exactly: expression arguments still render via their own `toSQL`.
  - 1.2.4 Keep `count('*')` rendering as `count(*)`.

- [x] 1.3 Preserve physical semantics outside aggregate values
  - 1.3.1 Ensure aggregate `order`, `filter`, `filterOr`, `over.partitionBy`, and `over.order` still use physical column SQL.
  - 1.3.2 Ensure normal `where`, `order`, `group`, joins, writes, and migration-facing metadata are not changed.
  - 1.3.3 Ensure no `selectSql` expansion happens for user-authored physical column references outside selected-output or aggregate-value contexts.

- [x] 1.4 Verify
  - 1.4.1 Run `pnpm pqb check packages/pqb/src/query/extra-features/select-sql/select-sql.test.ts`.
  - 1.4.2 Run `pnpm pqb check -o`.
  - 1.4.3 Run `pnpm pqb types`.
  - 1.4.4 If implementation changes the public contract from `spec.md`, update `spec.md` before finishing.

## 2. docs

- [x] 2.1 Update docs if implementation confirms the behavior
  - 2.1.1 Add aggregate value arguments to the list of contexts where `selectSql` applies in `docs/src/guide/common-column-methods.md`.
  - 2.1.2 Rebuild or update generated docs artifacts if the repo workflow requires it.
