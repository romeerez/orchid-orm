## Summary

Extend the existing real-column `selectSql` feature so aggregate helpers use the configured selected-output SQL for their value argument.

```ts
const Account = testDb('account', (t) => ({
  id: t.identity().primaryKey(),
  balance: t.decimal().selectSql((column) => sql`trim_scale(${column})`),
}));

await Account.sum('balance');
// SELECT sum(trim_scale("account"."balance")) FROM "schema"."account"
```

## What Changes

- Aggregate helper value arguments use `selectSql` when the argument is a selectable column with selected-output SQL.
- The existing `selectSql` contract stays unchanged for writes, filters, ordering, grouping, joins, migrations, and user-authored physical column references.
- Aggregate options keep physical-column semantics so `filter`, `filterOr`, `order`, and window option columns are not rewritten through `selectSql`.
- The failing `sum('balance')` case in `packages/pqb/src/query/extra-features/select-sql/select-sql.test.ts` becomes supported behavior.

## Assumptions

- Aggregating a column value is treated as reading the selected value of that column, so aggregate function arguments should use the same selected-output SQL path as `get`, `pluck`, and explicit selects.
- Aggregate option clauses are query predicates or ordering/window clauses, not selected values, so they continue to use physical columns.

## Capabilities

- `aggregate-select-sql-arguments`: Aggregate value argument rendering respects `selectSql` for selectable columns while preserving physical-column semantics for aggregate options and surrounding query clauses.

## Detailed Design

### Public API

No new public API is added. Existing aggregate methods continue to accept the same column names and SQL expressions:

```ts
await db.account.sum('balance');

await db.account.select({
  total: (q) => q.sum('balance'),
});

await db.account.having((q) => q.sum('balance').gt('10'));
```

When `balance` has `selectSql`, the aggregate function receives that selected-output expression:

```sql
sum(trim_scale("account"."balance"))
```

If a user passes a raw SQL expression instead of a column name, Orchid uses that expression exactly as before.

### Aggregate Value Semantics

The first selectable value argument of aggregate helpers must render through selected-output column SQL:

- `count('column')`
- `min('column')`
- `max('column')`
- `sum('column')`
- `avg('column')`
- `bitAnd('column')`
- `bitOr('column')`
- `boolAnd('column')`
- `boolOr('column')`
- `every('column')`
- `jsonAgg('column')`
- `jsonbAgg('column')`
- `stringAgg('column', delimiter)`
- `xmlAgg('column')`

Object aggregate values also use selected-output SQL for their selectable values:

```ts
await db.account.jsonObjectAgg({
  total: 'balance',
});
// json_object_agg($1::text, trim_scale("account"."balance"))
```

Custom function aggregates built with the same aggregate expression path should receive the same behavior for selectable arguments.

The behavior applies in every context where aggregate expressions can appear: direct aggregate value queries, select callbacks, relation aggregate subqueries, `having` predicates, boolean operator chains on aggregate expressions, and windowed aggregate calls.

### Aggregate Options Stay Physical

Aggregate options keep using the same physical-column rendering they use today:

```ts
await db.account.sum('balance', {
  filter: { balance: '1.1000' },
  order: { balance: 'DESC' },
});
```

The aggregate argument uses `selectSql`, but `filter` and `order` use the stored column:

```sql
sum(trim_scale("account"."balance") ORDER BY "account"."balance" DESC)
  FILTER (WHERE "account"."balance" = $1)
```

The same physical-column rule applies to `filterOr`, `over.partitionBy`, and `over.order`.

### Type and Parser Behavior

Aggregate return types stay governed by the existing aggregate method contracts. This feature changes SQL rendering, not the public TypeScript signatures.

For numeric aggregates, existing aggregate result parsers continue to apply. If a `selectSql` expression is explicitly typed, its selected-output metadata may inform SQL rendering and selected output elsewhere, but this change does not introduce new aggregate result type inference rules.

### Package Boundaries

The implementation belongs in `pqb`, primarily in the aggregate SQL expression rendering path and the existing selected-output SQL helpers.

`orm`, `rake-db`, and migration generation need no new public surface. They inherit the `pqb` query behavior and should continue treating `selectSql` columns as normal physical columns.

### Error Handling and Limits

- No new runtime validation is added for whether the `selectSql` expression is valid inside a given aggregate.
- TypeScript continues to restrict aggregate helpers to their existing accepted argument types.
- Query contexts outside aggregate value arguments are not changed.

## Docs

Update the `selectSql` docs to mention aggregate value arguments as another selected-output context. The aggregate docs can stay unchanged unless implementation reveals a user-visible caveat worth documenting.
