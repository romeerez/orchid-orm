## Summary

Add a column-level `selectSql` method for real columns. The column remains writable and migrates as a normal database column, but every selection of that column uses the configured SQL expression and aliases the result back to the column key.

```ts
import { sql } from './base-table';

export class AccountTable extends BaseTable {
  readonly table = 'account';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    balance: t.decimal().selectSql((column) => sql`trim_scale(${column})`),
  }));
}

await db.account.create({ balance: '12.3400' });

await db.account.select('balance');
// SELECT trim_scale("account"."balance") "balance" FROM "account"

await db.account.take();
// includes `balance`, selected with trim_scale("account"."balance") "balance"
```

When the selected SQL expression intentionally returns a different type, users can type the expression with the existing SQL expression API:

```ts
columns = this.setColumns((t) => ({
  encryptedEmail: t
    .text()
    .selectSql((column) => sql`decrypt_email(${column})`.type((t) => t.text())),
}));
```

## What Changes

- Add `.selectSql((column) => expression)` to all regular column definitions.
- Store the read-side SQL projection with metadata that is distinct from SQL computed-column virtual/read-only/default-excluded semantics, while allowing selected-output SQL rendering to use a shared projection helper.
- Use the configured projection whenever the column is selected, including default select-all, `select('*')`, explicit selects, aliases, joined selections, nested relation JSON payloads, `get`, `pluck`, and mutation `RETURNING`.
- Keep create, update, upsert, filtering, ordering, grouping, and migration generation based on the physical column.
- Document the feature as a real-column read projection, distinct from SQL computed columns and from generated database columns.

## Capabilities

- `column-select-sql`: Adds a real-column read projection that can render custom SQL for selected output while preserving the column's normal storage, input, query, and migration behavior.

## Detailed Design

### Public API

Every column supports a chainable `selectSql` method:

```ts
column.selectSql((column) => sql`some_sql(${column})`);
```

- The callback receives a SQL expression that references the current physical column in the current select context.
- The self-reference must render the physical database column with the active table alias and must not recursively expand through `selectSql`.
- The callback returns an existing Orchid SQL expression. Users continue to use `sql`, `.type(...)`, `.values(...)`, and expression operators the same way they do for custom select expressions and SQL computed columns.
- By default, the column's selected TypeScript output remains the original column output type. If the returned expression is explicitly typed with `.type(...)`, selected output uses that expression result type and parser metadata.
- `selectSql` does not change the column's `__inputType`, `__queryType`, validation schema, encoder, database column name, default, nullability, read-only flags, indexes, constraints, or migration metadata.

### Selection Semantics

A `selectSql` column is still a normal shape column. Any query path that selects that column as output must render the configured SQL expression and alias it back to the selected property name.

This applies to:

- default table reads such as `db.account.take()` and `db.account.all()`
- `selectAll()` and `select('*')`
- explicit column selections such as `select('balance')`
- aliased selections such as `select({ amount: 'balance' })`
- joined selections such as `select('account.balance')` and `select({ account: 'account.*' })`
- nested relation selections that build JSON payloads
- `get('balance')` and `pluck('balance')`
- mutation read projections, including `create`, `insert`, `update`, `delete`, and `upsert` calls with `select`, `selectAll`, `get`, or `pluck`

The projection must preserve the selected alias. Selecting `balance` returns a `balance` property, selecting `{ amount: 'balance' }` returns an `amount` property, and relation JSON uses the relation field key.

`select(false)` remains independent. A column with both `select(false)` and `selectSql(...)` is still excluded from default selection and `select('*')`, but explicit selections of that column use the configured SQL projection.

### Physical-Column Semantics

`selectSql` is a read-projection feature only. The following operations continue to reference the real column unless the user explicitly writes custom SQL:

- create, update, upsert, conflict target, and merge assignment SQL
- `where`, `order`, `group`, `having`, join conditions, and query expression helpers
- `q.column('balance')` and `q.ref('balance')` inside user-authored SQL expressions outside the `selectSql` callback
- migration generation and table-code introspection

This keeps a transformed decimal, encrypted value, or formatted JSON fragment writable and queryable as its stored database value. Users who need a queryable transformed expression under a separate name should use a SQL computed column or an explicit SQL expression in the query.

### Named Columns, Aliases, and JSON Payloads

The physical self-reference provided to `selectSql` must respect `name(...)`, snake-case naming, schemas, table aliases, joined table aliases, CTE aliases, and subquery aliases in the same way as existing selected column SQL.

When rows are wrapped into JSON for relation payloads or joined `table.*` selections, `selectSql` must be treated as a selected expression rather than as a plain `"table"."column"` field. Existing output handling such as parsers and `jsonCast` still applies. If the returned expression is explicitly typed, the expression result column supplies the output parser and JSON cast behavior; otherwise the original column supplies them.

### Relationship to SQL Computed Columns

SQL computed columns and `selectSql` columns both need a reusable "selected SQL projection" path: a selectable name can expand to SQL when it appears in selected output. The reusable internal concept is selected-output projection, not virtual-column identity. Their table-shape semantics remain different:

- SQL computed columns are virtual, read-only, and excluded from default selection and `select('*')`.
- `selectSql` columns are physical, writable, migratable columns and remain selected by default unless `select(false)` is also used.

The implementation should keep these differences explicit rather than treating `selectSql` as a SQL computed column with flags patched afterward. A shared selected-output helper may use `data.selectSql` for both SQL computed columns and real `selectSql` columns, but `data.computed` must remain the independent SQL-computed marker so migrations, writes, default selection, and physical column references can distinguish them.

### Error Handling and Limits

- `selectSql` does not add runtime validation for expression result compatibility; TypeScript typing and explicit `.type(...)` are the contract.
- The callback receives only the current physical column. Expressions that depend on sibling columns should use a SQL computed column, a query-level SQL expression, or a future broader API.
- Unsafe raw SQL rules are unchanged: users should build expressions with the existing `sql` APIs so values are parameterized and identifiers are quoted.

### Documentation

Document `selectSql` with common column methods. The docs should emphasize that it is selected by default because it is still a real column, unlike SQL computed columns. The computed-columns page should cross-reference `selectSql` for cases where the user wants to transform how a stored column is read without creating a virtual read-only field.
