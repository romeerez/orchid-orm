# Custom Select SQL For Columns

## Goal

Allow users to customize how a real column is selected in SQL while preserving normal create and update behavior for that same column.

The motivating example is a decimal `balance` column that writes as `"balance"` but reads as `trim_scale("balance") "balance"`. The feature should be broader than `trim_scale`: users should be able to attach SQL read projections to columns without making them virtual computed fields.

## Context from existing research

Orchid already supports SQL computed columns with `setComputed`. They are useful precedent because a user-facing selectable name can expand to a SQL expression in generated SQL. However, computed columns are intentionally virtual: they are marked `explicitSelect`, excluded from default select-all, and marked `readOnly` so they cannot be inserted or updated. This issue needs a separate real-column feature.

pqb's SQL builders already check `column.data.computed` in many explicit column-reference paths, including simple selects, dotted joined selects, aliases, where/order-style column SQL, and selected returning values. The default select-all path is more constrained because `selectAllColumns` is prebuilt as plain physical column strings. A real-column read projection therefore needs an explicit design decision for default select-all, `select('*')`, joined output, nested relation JSON, and mutation `RETURNING`.

Existing docs distinguish computed columns from generated database columns and explain that computed columns are not selected by default. The new feature should avoid the word `computed` as its main public concept because the desired column is stored and written normally.

## Solution 1: Column Method `selectSql`

- Summary: Add a column-level method, tentatively `selectSql`, that declares the SQL used whenever that real column is selected. This keeps the behavior directly beside the column type and makes it clear that the feature belongs to one physical column.
- User-facing interface: Users chain `.selectSql(...)` on a column definition. The callback receives a safe self-reference to the physical column, plus normal SQL helpers if needed. The method does not affect insert, update, migration column generation, or type inference except for the selected SQL expression's output type when explicitly narrowed.
- How it works: A column with `selectSql` remains a normal shape column. Create/update/upsert input still uses the physical column name and the column's normal encode behavior. Any query context that selects the column emits the configured SQL expression and aliases it back to the column key. This includes default selects, `select('*')`, explicit `select('balance')`, joined selections such as `account.balance`, nested relation selections, `pluck('balance')`, `get('balance')`, and mutation `RETURNING` selections. Filtering and ordering should keep using the physical column unless a later option explicitly opts into query-expression replacement.
- Workflow:
  - Define the real column and attach the read projection.
  - Write records normally with `create` and `update`.
  - Read records normally; selected output uses the SQL expression under the same property name.
  - Use explicit raw SQL or a separate computed column if the transformed value needs a different selectable name.
- Pros: Most discoverable for column-specific behavior. It naturally composes with existing column methods such as `.name(...)`, `.parse(...)`, `.encode(...)`, `.select(false)`, and `.readOnly()`. It avoids adding another table-level registry and makes migration behavior obvious because the column is still declared in the normal column list.
- Cons: The callback shape must be designed carefully so `q.column('balance')` or a self-reference means the physical column, not the transformed select expression. It is less convenient for applying one transform to many columns unless users write helper functions. It may create a large implementation surface if "selected everywhere" includes JSON relation payloads and select-all internals.

#### Example use case

- A table stores decimals normally but returns them without insignificant trailing scale:

  ```ts
  export class AccountTable extends BaseTable {
    readonly table = 'account';

    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
      balance: t.decimal().selectSql((q) => sql`trim_scale(${q.column})`),
    }));
  }
  ```

  `db.account.create({ balance: '12.3400' })` writes `"balance" = $1`.

  `db.account.select('balance')` selects `trim_scale("account"."balance") "balance"`.

## Solution 2: Column Type Helper Or Extension

- Summary: Let users define a reusable column helper, such as a custom decimal column type or extension method, that bakes in the select SQL behavior. Instead of every table calling `.selectSql(...)`, teams create a domain-specific column like `t.trimmedDecimal()` or `t.moneyAmount()`.
- User-facing interface: The base capability is still a column read projection, but users normally consume it through a custom column type or reusable helper. The helper can set the SQL projection, parsing, validation, precision/scale rules, and naming conventions together.
- How it works: The helper returns a normal writable column with the read projection already configured. Read behavior matches Solution 1: selecting the column emits the configured SQL and aliases it to the same property. Writes still target the physical column. The difference is workflow: direct `.selectSql(...)` remains available for one-off cases, while custom types are the recommended path for cross-project conventions.
- Workflow:
  - Define a custom column helper once in the app's base table or column-types setup.
  - Use that helper in table definitions.
  - Query and mutate the column as a normal column.
- Pros: Best for the original `trim_scale`-style motivation because numeric formatting is likely a project-wide convention. It keeps table files clean and encourages consistent behavior across all decimals, money columns, encrypted fields, or JSON-projected fields.
- Cons: This is not a complete standalone public surface unless the lower-level projection capability exists. Users still need documentation for how the helper works and how to override it per column. It may hide SQL behavior from readers of a table definition when the helper name is not explicit enough.

#### Example use case

- A project defines one reusable amount type:

  ```ts
  const trimmedDecimal = (t: ColumnTypes) =>
    t.decimal().selectSql((q) => sql`trim_scale(${q.column})`);

  export class AccountTable extends BaseTable {
    readonly table = 'account';

    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
      balance: trimmedDecimal(t),
      creditLimit: trimmedDecimal(t).nullable(),
    }));
  }
  ```

  Both columns are written normally and selected through the configured SQL expression.

## Solution 3: Table-Level `selectSql` Map

- Summary: Add a table-level declaration that maps existing column keys to read SQL expressions. This mirrors `setComputed` more closely while targeting real columns instead of creating new virtual columns.
- User-facing interface: Users define something like `selectSql = this.setSelectSql((q) => ({ balance: sql`trim_scale(${q.column('balance')})` }))` next to `columns` or `computed`. The keys must refer to real columns. Unlike `setComputed`, these keys do not add shape entries and do not make the columns read-only.
- How it works: The table-level map overrides selected SQL for specific existing columns. It has no effect on create/update input or migration generation. It affects selected output under the same contexts as Solution 1. The API can reuse the existing query-expression context that computed columns use, making it easy to reference other columns, dynamic SQL callbacks, and current helper functions.
- Workflow:
  - Define regular columns in `setColumns`.
  - Define a `setSelectSql` map for columns whose read SQL should differ from their physical SQL.
  - Query and mutate those columns under their normal names.
- Pros: Closest to the existing `setComputed` mental model and can reuse its expression-building style. It centralizes all read projections in one block, which can be easier to audit for tables with several transformed columns. It avoids expanding every column's method surface.
- Cons: The behavior is separated from the column declaration, so readers can miss that a real column has special read SQL. It is easier to confuse with computed columns despite different semantics. TypeScript must ensure map keys are existing real columns and that expression output stays compatible with the column output type.

#### Example use case

- A table has several SQL read projections that should be reviewed together:

  ```ts
  export class AccountTable extends BaseTable {
    readonly table = 'account';

    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
      balance: t.decimal(),
      available: t.decimal(),
    }));

    selectSql = this.setSelectSql((q) => ({
      balance: sql`trim_scale(${q.column('balance')})`,
      available: sql`trim_scale(${q.column('available')})`,
    }));
  }
  ```

## Solution 4: General Read/Write SQL Transformer

- Summary: Expose a broader column transformer API that can separately customize SQL for reading and writing. For this issue, users would configure only the read side, but the abstraction would leave room for encrypted columns, compressed values, or database-side normalization on writes.
- User-facing interface: A column could define `sql: { read, write }`, `.mapSql({ read, write })`, or a similar structured method. `read` controls selected SQL. `write` controls values emitted in insert/update SQL. Users can opt into only one side.
- How it works: The read side behaves like Solution 1. The write side, if provided, wraps or replaces insert/update values for that column while preserving parameterization. Because this expands mutation semantics, it would need clear rules for create, update, upsert merge, conflict targets, defaults, raw SQL values, and hooks.
- Workflow:
  - Define a normal column.
  - Provide a read transform, write transform, or both.
  - Query and mutate through the same property name while Orchid applies the configured SQL transforms.
- Pros: More future-proof if the project wants first-class encrypted columns or SQL-backed codecs. It presents a symmetrical model: database storage can differ from application reads and writes in controlled ways.
- Cons: Too broad for the current issue. Write-side SQL transforms are much riskier than read-side projections and touch more mutation paths. It may delay a focused select-SQL feature and make the API harder to explain.

#### Example use case

- A future encrypted text column could decrypt on read and encrypt on write:

  ```ts
  secret: t.text().mapSql({
    read: (q) => sql`decrypt(${q.column})`,
    write: (q, value) => sql`encrypt(${value})`,
  });
  ```

  This is intentionally beyond the `trim_scale` use case, but it shows why a generic transformer may be attractive later.

## Comparison

- Solution 1 is the strongest first feature. It is explicit, local to the column, and solves custom selected SQL without changing mutation semantics.
- Solution 2 is the best recommended workflow for repeated conventions, but it depends on the base capability from Solution 1 or an equivalent lower-level API.
- Solution 3 is appealing because it resembles `setComputed`, but that similarity is also a liability: users may expect computed-column semantics such as default exclusion or virtual read-only behavior.
- Solution 4 should be treated as a separate future design. It may eventually serve encryption and storage-codec features, but it is too large for the current read-projection problem.

The most natural Orchid path is Solution 1 plus documentation that shows Solution 2 as the reusable pattern. That gives users a small direct API and a clean way to make project-wide `trim_scale`-style behavior without making `trim_scale` itself a special case.

## References

- `changes/414-custom-column-select-sql/research.md` - local analysis of current computed-column behavior and pqb select/mutation constraints.
- `packages/pqb/src/query/extra-features/computed/computed.ts` - SQL computed columns attach expressions to columns but also mark them read-only and explicit-select.
- `packages/pqb/src/query/sql/column-to-sql.ts` - existing expression replacement points for explicit column references.
- `packages/pqb/src/query/basic-features/select/select.sql.ts` - default select-all behavior that a real-column read projection must handle.
- `docs/src/guide/computed-columns.md` - current user-facing computed-column semantics that this feature should avoid conflating with real columns.
