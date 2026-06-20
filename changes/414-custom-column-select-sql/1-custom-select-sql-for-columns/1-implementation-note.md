# Shared Selected Projection Without Reusing Computed Semantics

## Context

SQL computed columns and `selectSql` both need selected output to render an expression instead of a plain column reference. They should reuse that selected-output rendering path where possible, but they do not have the same table-shape semantics.

Current SQL computed columns store their expression in `column.data.computed` and also set `explicitSelect` and `readOnly`. Migration generation also removes columns with `data.computed` from the table shape. Those behaviors are correct for virtual computed columns and wrong for `selectSql` real columns.

## Findings

`data.computed` is not just a select expression. Existing code treats it as a virtual-column marker:

- `applyComputedColumns` stores the expression in `data.computed`, then sets `explicitSelect = true` and `readOnly = true`.
- migration generation deletes `table.shape[key]` when `column.data.computed` is set.
- generic column-reference helpers such as `simpleColumnToSQL`, `simpleExistingColumnToSQL`, `columnToSql`, `ColumnRefExpression`, and `RefExpression` expand `data.computed`; these helpers are also used outside selected output.
- selected-output helpers such as `ownColumnToSqlWithAs`, `tableColumnToSqlWithAs`, explicit select handling, hook select handling, and `SelectItemExpression` are the places where `selectSql` should apply.

Storing `selectSql` directly in `data.computed`, even with patched flags, would make it too easy for the new real-column projection to leak into migrations, writes, filters, ordering, joins, and user-authored `q.column` or `q.ref` expressions. A discriminator on a single shared field can work only if every existing `data.computed` consumer is audited and split by purpose; that is a larger and riskier refactor than the feature needs.

The code can still avoid duplicated SQL rendering by extracting a selected-projection helper. The reusable concept should be "when this selectable is selected as output, does it render as an expression?", not "is this column computed?". A good way to make that concrete is to let SQL computed columns keep `data.computed` for their virtual/read-only/default-excluded semantics, while also assigning the same selected-output renderer to `data.selectSql`.

JSON row construction has a separate trap. `makeRowToJson` and `RowToJsonExpression` currently optimize to `row_to_json(table.*)` unless a named column or `jsonCast` forces `json_build_object`. A `selectSql` column must also force the expression-aware `json_build_object` path; otherwise nested relation JSON and joined wildcard payloads will bypass the transform. The existing `jsonCast` handling should remain attached to the output column metadata: use the expression result column when `.type(...)` is supplied, otherwise use the original physical column.

## Recommended approach

Store selected-output SQL on distinct column data, for example `column.data.selectSql`, and keep `data.computed` as the SQL-computed/virtual-column marker. For SQL computed columns, set both:

```ts
data.computed = expression;
data.selectSql = expression;
```

For real `selectSql` columns, set only:

```ts
data.selectSql = expression;
```

This keeps the selected-output SQL construction logic simple: selected-output helpers can check `data.selectSql` only, while all code that needs to know whether a column is virtual continues to check `data.computed`.

The renderer should have the same practical shape as an expression render call:

```ts
data.selectSql.toSQL(ctx, quotedAs);
```

or, if stored as a function:

```ts
data.selectSql(ctx, quotedAs);
```

Prefer storing the same `Expression` shape as computed columns unless the implementation shows a function wrapper is needed, because existing computed rendering already uses `expression.toSQL(ctx, quotedAs)` and expression result metadata can be reused for parser and `jsonCast` decisions.

Then route selected output through helpers such as:

- `selectedColumnToSql(ctx, key, column, quotedAs)`
- `selectedColumnToSqlWithAs(ctx, key, column, as, quotedAs)`
- `selectedColumnJsonItemToSql(ctx, key, column, tableOrAlias)`

These selected-output helpers should check only `data.selectSql`. Do not make generic physical-reference helpers expand `data.selectSql`. In particular, keep `simpleColumnToSQL`, `simpleExistingColumnToSQL`, `columnToSql` in non-select contexts, `ColumnRefExpression`, and `RefExpression` physically grounded for real `selectSql` columns.

For SQL computed columns, generic helpers may continue to expand `data.computed`, preserving the existing ability to reference SQL computeds in query expressions. For real `selectSql` columns, generic helpers must not use `data.selectSql`, so writes, filters, ordering, grouping, joins, and user-authored `q.column`/`q.ref` keep using the physical column.

The `selectSql` callback should receive a physical-column expression, not `Query.column(...)`. That expression should render `"active_alias"."db_column_name"` from the current `quotedAs` and the column's database name, and must ignore both `data.selectSql` and `data.computed` to avoid recursion.

Default select-all needs special handling. `selectAllColumns` is precomputed as strings and later prefixed for joins/update-from/update-many, so it cannot represent alias-sensitive expressions by itself. Either:

- stop using `selectAllColumns` for shapes containing `selectSql` and generate select-all through the selected-projection helper at SQL time, or
- store expression-capable select-all items instead of plain strings.

The smaller change is to mark `prepareSelectAll = true` for `selectSql` columns, keep `selectAllShape` authoritative for default output membership, and make `internalSelectAllSql`/`selectAllSql` use expression-aware generation when any selected default column has a selected projection.

For JSON, update both JSON builders:

- `RowToJsonExpression` already calls `selectToSql` into a wrapped subquery and receives `jsonList`; ensure selected `selectSql` columns put the effective output column into `jsonList`, so `json_build_object('key', t."key"::cast)` is chosen when needed.
- `makeRowToJson` cannot call `row_to_json(table.*)` when any included column has `data.selectSql`. It should use a projection-aware `json_build_object` item for those columns and preserve existing `jsonCast` behavior.

## Tasks affected

- `1.1`: refactor SQL computed columns so they populate both `data.computed` and `data.selectSql`, and make selected-output SQL helpers read `data.selectSql` for computed selections.
- `1.2`: implement real-column `selectSql` under `packages/pqb/src/query/extra-features/select-sql`, reusing the selected-output helpers while avoiding SQL computed virtual/read-only/default-excluded semantics.
- `1.3`: make relation JSON, joined wildcard JSON, parser metadata, and `jsonCast` use the effective selected output column.
- `2.1`: keep migration generation keyed to `data.computed` only, and verify ORM relation paths inherit the pqb selected-output behavior.

## Verification focus

Add SQL tests that prove the boundary:

- default select, `select('*')`, explicit select, alias select, `get`, `pluck`, joined select, joined wildcard, nested relation JSON, and mutation `RETURNING` use `selectSql`.
- create/update/upsert input, conflict/merge SQL, where/order/group/join conditions, `q.column`, and `q.ref` use the physical column.
- a decimal `selectSql` column inside JSON still uses `json_build_object` with the correct cast to avoid precision loss.
- an explicitly typed `selectSql` expression supplies parser and `jsonCast` metadata; an untyped expression falls back to the original column metadata.
- migration generation keeps `selectSql` columns and still removes SQL computed columns.
