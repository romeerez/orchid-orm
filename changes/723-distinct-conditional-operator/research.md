# Distinct Conditional Operator

## Purpose and goals

`whereNot` and ordinary not-equal predicates follow SQL three-valued logic: comparing a nullable column to a non-null value does not match rows where the column is `NULL`. This is correct SQL behavior, but it is surprising when the user's intent is "all rows whose value is different from this value, including unknown values".

The goal is to add a first-class, type-safe query condition for Postgres `IS DISTINCT FROM` so users can express null-safe inequality without writing raw SQL or manually expanding the condition into `OR` branches.

The motivating issue is `whereNot({ title: 'a' })` returning only the `"b"` row for `['a', 'b', null]`, while the user expects both `"b"` and `NULL` when using null-safe distinct semantics.

## Valuable external context

Postgres documents ordinary comparison operators as returning `NULL` ("unknown"), not `true` or `false`, whenever either side is `NULL`. It recommends `IS DISTINCT FROM` and `IS NOT DISTINCT FROM` when this behavior is not suitable. For non-null inputs, `a IS DISTINCT FROM b` behaves like `a <> b`; when one side is `NULL` and the other is not, it returns `true`; when both are `NULL`, it returns `false`. `IS NOT DISTINCT FROM` is the null-safe equality counterpart.

Postgres also supports row constructor forms:

```sql
row_constructor IS DISTINCT FROM row_constructor
row_constructor IS NOT DISTINCT FROM row_constructor
```

For row constructors, the result is always boolean, never `NULL`: null fields are considered equal to null fields and distinct from non-null fields. This matters if Orchid later considers tuple or composite-column comparisons, but the issue only requires the single-column condition form.

Kysely added `"is distinct from"` and `"is not distinct from"` as comparison operators after a Postgres-focused feature request. Its public operator model exposes the SQL phrase directly in expression-builder style APIs. This validates the feature for a TypeScript query builder, but the naming style is lower-level than Orchid's condition-object API.

Sequelize users have requested `IS DISTINCT FROM` / `IS NOT DISTINCT FROM` support as a null-safe way to match predicates without manually mixing inequality with `IS NULL`. The discussion notes two API-shape options: a dedicated `distinctFrom` operator or extending an existing `is` operator. The same discussion points out that Postgres `IS` is only valid with `NULL`, `TRUE`, `FALSE`, `UNKNOWN`, or their negated forms, so reusing `is` for arbitrary values would not be a faithful Postgres mapping.

Prisma documents `null` as an actual filter value and `undefined` as "do nothing". A 2025 Prisma feature request shows the same user pain point for nullable columns: `not: 'NEGATIVE'` excludes `NULL` rows because it compiles to ordinary SQL inequality, while users often intend to exclude only the known value and keep unknown/null values. This is a useful signal that changing existing `not` semantics would be risky, and an explicit null-safe operator is clearer.

## Community ideas and pain points

The Orchid issue requests a direct condition-object operator:

```ts
await db.post.where({ title: { isDistinctFrom: 'a' } }).count();
```

The core pain point is not knowing or not wanting to spell the SQL workaround:

```ts
await db.post.whereOneOf({ NOT: { title: 'a' } }, { title: null }).count();
```

Similar requests in Sequelize, Kysely, and Prisma communities show that nullable-column negation is a common source of surprises because library APIs make `not` read like ordinary JavaScript inequality, while SQL's `NULL` behavior is different.

## Requirements and edge cases

- The operator must compile to Postgres `column IS DISTINCT FROM value`, not `column <> value`.
- A complementary null-safe equality form should be considered, because Postgres exposes both `IS DISTINCT FROM` and `IS NOT DISTINCT FROM`. Naming could use SQL-phrase-style names such as `isDistinctFrom` / `isNotDistinctFrom` or another pair that fits Orchid condition names.
- `isDistinctFrom: null` should be valid for nullable columns and should behave like `IS NOT NULL` for scalar columns, but remain an explicit null-safe comparison rather than a replacement for `not: null`.
- The operator should accept the same value domain as ordinary equality for the column, including raw SQL or expression values if existing equality operators support them.
- Type-level nullability should follow existing Orchid condition rules: nullable columns can compare against `null`; non-null columns should probably not accept `null` unless existing condition APIs already permit runtime nulls.
- Boolean columns need no special SQL syntax beyond `IS DISTINCT FROM`; this avoids confusion with `IS TRUE` / `IS FALSE`.
- The condition name should avoid ambiguity with `SELECT DISTINCT`, `distinctOn`, and deduplicating result rows. Documentation should call it "null-safe distinct comparison" or "IS DISTINCT FROM condition", not just "distinct query".
- `whereNot({ title: { isDistinctFrom: 'a' } })` should have a predictable meaning if nested negation is already supported. Logically, `NOT (title IS DISTINCT FROM 'a')` is equivalent to `title IS NOT DISTINCT FROM 'a'`.
- The operator should compose with `whereOneOf`, nested `NOT`, relation filters, and other condition-object operators without special syntax.
- Array and JSON columns need careful distinction from `SELECT DISTINCT`: this operator compares the entire stored value using Postgres equality semantics for the type.
- If tuple or row comparisons are ever exposed, Postgres row constructor behavior gives a natural extension, but it should not be part of the initial single-column condition unless Orchid already has tuple conditions.

## Existing support in orchid-orm

This feature does not currently exist as a where-condition operator.

Related functionality already exists in several nearby areas:

- `pqb` column operators are defined centrally in `packages/pqb/src/columns/operators.ts`. The base operators available for every column type are `equals`, `not`, `in`, and `notIn`.
- `equals` compiles `null` to `IS NULL` and non-null values to `=`.
- `not` compiles `null` to `IS NOT NULL` and non-null values to `<>`. This is the SQL behavior that motivates the issue: `<>` does not match `NULL` rows.
- The same base operators are reused by text, numeric, date/time, boolean, JSON, array, custom, virtual, and PostGIS columns through the `Operators` groups, so a new base operator would naturally become available across column types.
- `where` object typing derives accepted operator names from each column's `operators` object, so a new operator needs to fit the existing column-operator model rather than invent a special `where` syntax.
- `whereNot` and `{ NOT: ... }` negate an entire condition group. Existing tests assert SQL such as `NOT (col = $1 AND nullable IS NULL)` and `NOT col > $1`; they do not rewrite not-equal into null-safe comparison.
- `whereOneOf` / `whereNotOneOf` can express the workaround today by combining ordinary inequality with a `NULL` branch, but that is verbose and hides the user's actual intent.
- `whereSql` / raw SQL can express `IS DISTINCT FROM` today, but loses the condition-object ergonomics and type guidance that the issue is asking for.
- Query-result `distinct()` already exists in `packages/pqb/src/query/basic-features/distinct/` and docs under query methods. This is unrelated to `IS DISTINCT FROM` and creates naming ambiguity for a short `distinct` condition operator.
- Aggregate functions support a `{ distinct: true }` option, also unrelated to conditional comparison.
- Migrations and schema generation already support Postgres `NULLS NOT DISTINCT` for indexes and unique indexes. This is also unrelated to filtering, but it means docs should distinguish index null-distinctness from query-condition null-safe comparison.
- `docs/src/.vitepress/dist/llms.txt` and `docs/src/guide/where.md` document column operators, `whereNot`, and `whereOneOf`, but do not mention `IS DISTINCT FROM`, `IS NOT DISTINCT FROM`, or a null-safe comparison operator.

The implication for design is that the feature belongs in `pqb` as a general column operator, with docs in the where/operator section. `orm` relation filters should receive it automatically because relation query conditions reuse pqb where arguments.

## Proposed user-facing design

Add explicit null-safe comparison operators to the condition-object API.

Recommended surface:

```ts
await db.post.where({ title: { isDistinctFrom: 'a' } }).count();
await db.post.where({ title: { isNotDistinctFrom: 'a' } }).count();
```

`isDistinctFrom` should mean `IS DISTINCT FROM`: include rows where the column and value are different, treating `NULL` as a comparable value. With rows `['a', 'b', null]`, `{ title: { isDistinctFrom: 'a' } }` should match `"b"` and `NULL`.

`isNotDistinctFrom` should mean `IS NOT DISTINCT FROM`: null-safe equality. With rows `['a', 'b', null]`, `{ title: { isNotDistinctFrom: null } }` should match the `NULL` row, and `{ title: { isNotDistinctFrom: 'a' } }` should match only `"a"`.

The explicit names avoid ambiguity with row-deduplication `distinct()` and still match existing condition operator naming style such as `equals`, `not`, `in`, and `notIn`. Documentation should always spell out the generated SQL phrase near the operator name so users do not confuse it with row-deduplication `distinct()`.

Do not change existing `not` or `whereNot` behavior. They should continue to map to ordinary SQL negation / inequality so existing queries remain SQL-faithful and backwards-compatible. Users who want null-safe behavior should opt into it explicitly.

The operator should feel like `equals` and `not`: usable in plain `where`, relation filters, aggregate filters, callbacks over expressions, and with values, subqueries, and raw SQL expressions wherever those inputs are already accepted by comparable operators.

Docs should include the common workaround it replaces:

```ts
// Before:
await db.post.whereOneOf({ title: { not: 'a' } }, { title: null });

// After:
await db.post.where({ title: { isDistinctFrom: 'a' } });
```

This keeps the feature small, explicit, and aligned with Postgres while avoiding a behavioral surprise in existing nullable-column filters.

## References

- Issue: <https://github.com/romeerez/orchid-orm/issues/723>
- Postgres comparison predicates: <https://www.postgresql.org/docs/current/functions-comparison.html>
- Postgres row constructor comparison: <https://www.postgresql.org/docs/current/functions-comparisons.html>
- Postgres row constructors: <https://www.postgresql.org/docs/current/sql-expressions.html#SQL-SYNTAX-ROW-CONSTRUCTORS>
- Kysely issue: <https://github.com/kysely-org/kysely/issues/673>
- Kysely comparison operators API: <https://kysely-org.github.io/kysely-apidoc/variables/COMPARISON_OPERATORS.html>
- Sequelize issue: <https://github.com/sequelize/sequelize/issues/12612>
- Sequelize operators docs: <https://sequelize.org/docs/v7/querying/operators/>
- Prisma null and undefined docs: <https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/null-and-undefined>
- Prisma nullable `not` issue: <https://github.com/prisma/prisma/issues/27622>
