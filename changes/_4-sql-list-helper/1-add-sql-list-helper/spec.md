## Summary

Add `sql.join` as a raw SQL helper for safely composing SQL-separated lists inside Orchid SQL template literals. It covers the Kysely `sql.join` use case with the same public helper name.

```ts
import { sql } from './base-table';

const nicknames = ['johnny', 'john', 'jon'];

await db.user.whereSql`
  "nicknames" @> ARRAY[${sql.join(nicknames)}]
`;

await db.user.whereSql`
  ("name", "age") IN (${sql.join(
    users.map((user) => sql`(${user.name}, ${user.age})`),
  )})
`;

await db.user.select({
  displayName: (q) =>
    sql<string>`concat(${sql.join(
      [q.column('firstName'), q.column('lastName')],
      sql` || ' ' || `,
    )})`,
});
```

## What Changes

- Add `sql.join(items, separator?)` to the public `sql` helper exported by `pqb` and re-exported through Orchid's existing BaseTable/query SQL surfaces.
- Render list items using the same interpolation rules as values inside `sql` template literals: expressions render SQL, while plain JavaScript values become bound query parameters.
- Use `, ` as the default separator and allow a custom raw SQL separator expression.
- Document `sql.join` alongside `sql` and `sql.ref`.

## Assumptions

- The public name is `sql.join`, matching the comparable Kysely helper.
- No alias should be added in the first implementation. The feature is new to Orchid, so there is no compatibility need for two names.
- Empty lists render an empty SQL fragment. Callers are responsible for using the helper only in SQL contexts where an empty fragment is valid.

## Capabilities

- `sql-join-expression`: Build a composable expression that renders a sequence of raw SQL template substitutions separated by raw SQL separators.

## Detailed Design

### Public API

`sql.join` is a method on the existing callable `sql` helper.

```ts
interface SqlFn {
  join<T = unknown>(
    items: readonly unknown[],
    separator?: RawSqlBase,
  ): RawSql<Column.Pick.QueryColumnOfType<T>, ColumnTypes>;
}
```

The snippet is illustrative. The implementation should use Orchid's existing `SqlFn`, `RawSql`, `RawSqlBase`, `Expression`, and column type names without widening public exports unnecessarily.

- `items` accepts readonly arrays so literal tuples, `as const` arrays, and normal arrays all work.
- Each item is treated as though it appeared in a normal `sql` template interpolation.
- Plain JavaScript values become query parameters and keep SQL injection protection.
- Orchid expressions such as `sql` fragments, `sql.ref(...)`, `q.column(...)`, and `q.ref(...)` render as SQL instead of becoming bound values.
- The default separator is equivalent to a raw SQL `, ` fragment.
- `separator` is an SQL expression, not a plain string. This keeps custom separators explicit because separators are SQL syntax, not user values.
- The returned value is an expression usable anywhere current `sql` expressions are accepted: `whereSql`, `select`, `orderSql`, `havingSql`, nested `sql` template literals, `db.$query`, and column defaults/generated SQL where the current raw SQL expression type is already accepted.
- The optional generic type parameter describes the expression output type only when the surrounding SQL fragment needs a result type. It does not transform item types.

### SQL Rendering

`sql.join` should render list items in order, inserting the separator between adjacent items only.

```ts
sql`ARRAY[${sql.join([1, 2, 3])}]`;
// ARRAY[$1, $2, $3]

sql`${sql.join([sql.ref('name'), sql.ref('age')])}`;
// "name", "age"

sql`${sql.join([1, sql.ref('age')], sql`::int, `)}`;
// $1::int, "age"
```

The helper must preserve value ordering in the final query's `values` array. Interleaving plain values, expression items, and separators that contain their own parameters should produce placeholders in the same left-to-right order as the rendered SQL.

### Integration and Lifecycle

The feature belongs in `pqb` because raw SQL expression construction, interpolation, and exported `sql` helpers live there. `orm`, `rake-db`, and docs should receive the API through existing public exports and imports unless a downstream package has its own SQL helper typing that must be updated.

Implementation should extend the existing raw SQL expression machinery rather than introducing a separate query-builder concept. `sql.join` should compose inside `templateLiteralToSQL` the same way `sql.ref` and `RawSql` currently compose.

### Type Behavior

`sql.join` should be type-light and instantiation-cheap:

- Do not try to infer SQL tuple structure from the list.
- Do not validate SQL grammar at the type level.
- Preserve the existing `sql<T>` style for callers that need to state the resulting expression type.
- Avoid adding a new exported item type unless it is required for implementation reuse across files.

### Error Handling and Limits

- No new public error type is required.
- Empty arrays render `''`, so SQL such as `IN (${sql.join([])})` will generate invalid SQL; this should remain caller responsibility rather than a runtime error.
- Invalid item values should follow the same behavior as invalid template literal substitutions today.
- Custom separators are raw SQL expressions. Documentation should not suggest building separators from unchecked user input.

### Documentation

Document `sql.join` in the SQL expressions guide after the main `sql` section and before `sql.ref`.

Docs should show:

- value lists for `ARRAY[...]` and `IN (...)`
- expression lists that include `sql.ref`, `q.column`, or nested `sql` fragments
- custom separator usage
