# Column Method `selectSql`

## Goal

Allow users to customize how a real column is selected in SQL while preserving normal create and update behavior for that same column.

The motivating example is a decimal `balance` column that writes as `"balance"` but reads as `trim_scale("balance") "balance"`. The feature should be broader than `trim_scale`: users should be able to attach SQL read projections to columns without making them virtual computed fields.

## Context from existing research

Orchid already supports SQL computed columns with `setComputed`. They are useful precedent because a user-facing selectable name can expand to a SQL expression in generated SQL. However, computed columns are intentionally virtual: they are marked `explicitSelect`, excluded from default select-all, and marked `readOnly` so they cannot be inserted or updated. This issue needs a separate real-column feature.

pqb's SQL builders already check `column.data.computed` in many explicit column-reference paths, including simple selects, dotted joined selects, aliases, where/order-style column SQL, and selected returning values. The default select-all path is more constrained because `selectAllColumns` is prebuilt as plain physical column strings. A real-column read projection therefore needs an explicit design decision for default select-all, `select('*')`, joined output, nested relation JSON, and mutation `RETURNING`.

Existing docs distinguish computed columns from generated database columns and explain that computed columns are not selected by default. The new feature should avoid the word `computed` as its main public concept because the desired column is stored and written normally.

## Solution

- Summary: Add a column-level method, tentatively `selectSql`, that declares the SQL used whenever that real column is selected. This keeps the behavior directly beside the column type and makes it clear that the feature belongs to one physical column.
- User-facing interface: Users chain `.selectSql(...)` on a column definition. The callback receives the physical column SQL reference for the current select context. The method does not affect insert, update, migration column generation, or type inference except for the selected SQL expression's output type when explicitly narrowed.
- How it works: A column with `selectSql` remains a normal shape column. Create/update/upsert input still uses the physical column name and the column's normal encode behavior. Any query context that selects the column emits the configured SQL expression and aliases it back to the column key. This includes default selects, `select('*')`, explicit `select('balance')`, joined selections such as `account.balance`, nested relation selections, `pluck('balance')`, `get('balance')`, and mutation `RETURNING` selections. Filtering and ordering should keep using the physical column unless a later option explicitly opts into query-expression replacement.
- Workflow:
  - Define the real column and attach the read projection.
  - Write records normally with `create` and `update`.
  - Read records normally; selected output uses the SQL expression under the same property name.
  - Use explicit raw SQL or a separate computed column if the transformed value needs a different selectable name.
- Pros: Most discoverable for column-specific behavior. It naturally composes with existing column methods such as `.name(...)`, `.parse(...)`, `.encode(...)`, `.select(false)`, and `.readOnly()`. It avoids adding another table-level registry and makes migration behavior obvious because the column is still declared in the normal column list.
- Cons: The callback intentionally exposes only the current physical column, so expressions that need sibling columns should use a separate computed column or a future table-level API. It is less convenient for applying one transform to many columns unless users write helper functions. It may create a large implementation surface if "selected everywhere" includes JSON relation payloads and select-all internals.

#### Example use case

- A table stores decimals normally but returns them without insignificant trailing scale:

  ```ts
  export class AccountTable extends BaseTable {
    readonly table = 'account';

    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
      balance: t.decimal().selectSql((column) => sql`trim_scale(${column})`),
    }));
  }
  ```

  `db.account.create({ balance: '12.3400' })` writes `"balance" = $1`.

  `db.account.select('balance')` selects `trim_scale("account"."balance") "balance"`.

## References

- `changes/414-custom-column-select-sql/research.md` - local analysis of current computed-column behavior and pqb select/mutation constraints.
- `packages/pqb/src/query/extra-features/computed/computed.ts` - SQL computed columns attach expressions to columns but also mark them read-only and explicit-select.
- `packages/pqb/src/query/sql/column-to-sql.ts` - existing expression replacement points for explicit column references.
- `packages/pqb/src/query/basic-features/select/select.sql.ts` - default select-all behavior that a real-column read projection must handle.
- `docs/src/guide/computed-columns.md` - current user-facing computed-column semantics that this feature should avoid conflating with real columns.
