# Custom Column Select SQL

## Purpose and goals

Issue #414 asks for support around `trim_scale` on numeric values, but the broader feature is not specific to that Postgres function. The useful abstraction is: let a real table column keep its normal create and update behavior while allowing reads of that column to use custom SQL.

The motivating example is a decimal `balance` column. Users want normal writes:

```ts
await db.account.create({ balance: '12.3400' });
await db.account.find(id).update({ balance: '15.0000' });
```

but generated read SQL should select the column through an expression:

```sql
SELECT trim_scale("account"."balance") "balance" FROM "account"
```

From the TypeScript and mutation perspective, `balance` is still the real `balance` column. The SQL expression is only a read/query projection concern.

## Existing `sqlComputed` support

The closest existing feature is SQL computed columns. User-facing ORM tables define them with `computed = this.setComputed((q) => ({ ... }))`; pqb receives the same concept through the `computed` table option.

Relevant local references:

- `packages/orm/src/base-table.ts` documents `setComputed`.
- `docs/src/guide/computed-columns.md` documents SQL computed columns.
- `packages/pqb/src/query/extra-features/computed/computed.ts` applies computed definitions to a query shape.
- `packages/pqb/src/query/sql/column-to-sql.ts` replaces selected computed column names with SQL expressions.
- `packages/pqb/src/query/basic-features/select/select.sql.ts` handles computed columns in select and hook-select SQL.
- `packages/pqb/src/query/extra-features/computed/computed.test.ts` covers select, where/order, joins, returning from mutations, and runtime computed behavior.

SQL computed columns are implemented by creating or reusing a column object in the table/query shape, storing an `Expression` on `column.data.computed`, and marking the column:

- `explicitSelect = true`, so it is not selected by default or by `select('*')` unless explicitly listed.
- `readOnly = true`, so it is rejected in create and update inputs.

When SQL generation sees a column with `data.computed`, it emits the expression instead of a physical column reference. This happens in helper paths such as `simpleColumnToSQL`, `simpleExistingColumnToSQL`, `columnWithDotToSql`, `ownColumnToSqlWithAs`, and `tableColumnToSqlWithAs`.

That makes computed columns available as selectables, where/order expressions, joined-table selectables, nested subquery selectables, and mutation `RETURNING` selectables. The tests explicitly show that computed columns are not accepted in create or update inputs but can be returned from insert/update/upsert.

## Why this issue is different from computed columns

SQL computed columns model virtual read-only fields that do not exist in the database. The requested feature models a real writable database column with a custom read expression.

Important differences:

- The column should stay in the normal table shape as a real column.
- It should remain accepted in create and update inputs unless separately marked read-only.
- It should normally remain in default select output, because users expect `db.account.take()` to include `balance`.
- It should probably be included in `select('*')`, because this is still the regular `balance` column from the user's perspective.
- Its SQL expression should preserve the same output alias as the original column key.
- Migration generation should still treat it as a normal column, not as a computed or virtual column.

The existing `data.computed` flag is too broad for this behavior because it currently also means virtual/read-only/default-excluded. Reusing the same data field directly would risk changing mutation and default-select behavior unless the semantics are split.

## Relevant select behavior in pqb

pqb has several paths that turn a user-facing column key into SQL:

- `simpleColumnToSQL` and `simpleExistingColumnToSQL` are used for simple column references and already switch to `data.computed` when present.
- `columnToSql`, `maybeSelectedColumnToSql`, and dotted-column handling route joined and aliased column references to the same computed-aware helpers.
- `ownColumnToSqlWithAs` and `tableColumnToSqlWithAs` produce aliased select output and also check `data.computed`.
- `selectToSqlList` handles explicit selects, hook selects, `select('*')`, and fallback select-all.
- `selectAllSql` currently uses prebuilt `q.selectAllColumns` strings for plain select-all and prefixes those strings for joins/update-from/update-many.

The last point matters for real-column custom select SQL. `selectAllColumns` is prepared when the table query is constructed, and it currently contains strings such as `"balance"` or `"db_column" "propertyName"`. If a real column's default select should become `trim_scale("account"."balance") "balance"`, select-all cannot keep using plain physical-column strings for that column unless those strings are generated with the new read expression.

For joins and subqueries, there are additional details:

- Existing computed expressions call `toSQL(ctx, quotedAs)` so table aliases can be substituted correctly.
- `makeRowToJson` builds JSON objects from `"table"."column"` references and currently only accounts for aliases and `jsonCast`; it does not call `data.computed`.
- Subquery shape mapping can remove `data.name` and `explicitSelect` from selected columns, which is relevant for named columns but should not erase the intended read transform for a real selected column.

The feature should explicitly decide whether the custom SQL applies only to top-level select lists or also to JSON relation payloads, nested relation selects, `pluck`, `get`, `where`, `order`, and `returning` from mutations.

## Mutation behavior

Create and update paths already use physical column names and separately reject `appReadOnly` or `readOnly` columns:

- `packages/pqb/src/query/basic-features/mutate/create.ts` processes create input keys, skips virtual columns, and throws only for `appReadOnly`/`readOnly`.
- `packages/pqb/src/query/basic-features/mutate/update.ts` and `update.sql.ts` use the same read-only checks for updates.
- `packages/pqb/src/query/basic-features/mutate/insert.sql.ts` uses physical names for conflict targets and merge assignments.

This is a useful existing separation: as long as the new feature does not set `readOnly`, `appReadOnly`, or `virtual`, writes can continue to target the physical column.

Mutation `RETURNING` is different. It is a read projection attached to a mutative statement. The computed-column tests already expect selected computed columns to work when inserting, updating, or upserting. For a real column custom read SQL, users will likely expect `.select('balance').insert(...)` and `.select('balance').update(...)` to return the transformed value as well.

## User-facing design constraints

The API should make it clear that this is a read-side SQL projection, not a database generated column, not a virtual computed column, and not a parser/encoder.

It should work with existing column type behavior:

- `encode` still applies to create/update values.
- `_parse` and `outputType` still describe the returned value.
- `jsonCast` still matters for decimal precision when rows are wrapped as JSON.
- `data.name` still maps property names to database column names.
- `select(false)` remains a separate feature for excluding columns from default selection.

The expression should be written with existing SQL helpers so users can safely reference the actual column with the correct table alias. The current computed docs already teach `q.column('firstName')` for this purpose; a column-local API could instead provide a self-reference helper.

## Open design questions

- Scope: Should the custom SQL apply to all query contexts that read the column, including `where`, `order`, and `having`, or only to selected output?
- Default select: Should a transformed real column always affect `db.table.take()` and `select('*')`? The motivating case suggests yes.
- Returning: Should mutation `RETURNING` use the transformed expression? This seems consistent with "how the column is selected."
- Aliasing: How should users reference the physical column inside the expression without accidentally recursing into the transformed expression?
- JSON relations: Should nested relation JSON output use the transformed expression? If yes, `makeRowToJson`-style SQL builders need to treat this as a select expression, not as a plain `"table"."column"` field.
- Naming: The public name should avoid confusion with SQL computed columns. Names like `selectSql`, `readSql`, `selectAs`, or `sqlSelect` describe the read-only projection better than `computed`.

## Proposed direction

The most natural model is to introduce a distinct concept for real columns: custom SQL used when selecting the column. It can reuse the expression-rendering idea from SQL computed columns, but it should not reuse the virtual/read-only/default-excluded semantics.

At a product level, the feature should say:

> This column is stored as a normal database column and is written normally. When Orchid reads this column, it emits the configured SQL expression and aliases it back to the column key.

This framing covers the `trim_scale(balance)` use case while also supporting broader read-normalization patterns such as decrypting selected values, formatting stored values, selecting a JSON path from a physical JSON column, applying `COALESCE`, or selecting a domain-specific SQL function.

## References

- `packages/pqb/src/query/extra-features/computed/computed.ts` - how SQL computed columns attach expressions to query shape columns.
- `packages/pqb/src/query/sql/column-to-sql.ts` - where column references are replaced by computed SQL expressions.
- `packages/pqb/src/query/basic-features/select/select.sql.ts` - select-list and select-all SQL generation.
- `packages/pqb/src/query/basic-features/mutate/create.ts` - create input handling and read-only checks.
- `packages/pqb/src/query/basic-features/mutate/update.ts` and `packages/pqb/src/query/basic-features/mutate/update.sql.ts` - update input handling and read-only checks.
- `packages/pqb/src/query/basic-features/mutate/insert.sql.ts` - insert/upsert physical column naming.
- `packages/pqb/src/query/sql/sql.ts` - JSON row construction currently using physical column references.
- `docs/src/guide/computed-columns.md` - current user-facing computed column behavior and naming.
