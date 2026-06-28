## Summary

Add null-safe comparison operators to Orchid column conditions so users can express Postgres `IS DISTINCT FROM` and `IS NOT DISTINCT FROM` without raw SQL or manual `OR` conditions.

```ts
await db.post.where({ title: { isDistinctFrom: 'a' } }).count();
await db.post.where({ title: { isNotDistinctFrom: 'a' } }).count();
await db.post.where({ title: { isDistinctFrom: null } }).all();
```

With rows where `title` is `'a'`, `'b'`, and `null`, `{ title: { isDistinctFrom: 'a' } }` matches `'b'` and `null`. `{ title: { isNotDistinctFrom: 'a' } }` matches only `'a'`, and `{ title: { isNotDistinctFrom: null } }` matches only rows where `title` is `null`.

## What Changes

- Add `isDistinctFrom` and `isNotDistinctFrom` to the base column operators available to every queryable column type.
- Compile `isDistinctFrom` to `column IS DISTINCT FROM value` and `isNotDistinctFrom` to `column IS NOT DISTINCT FROM value`.
- Accept the same value, subquery, and raw SQL expression inputs that `equals` and `not` accept for the same column type.
- Keep existing `not`, `whereNot`, and `{ NOT: ... }` behavior unchanged.
- Document the operators as null-safe comparison predicates and distinguish them from result-row `distinct()` and aggregate `{ distinct: true }`.

## Assumptions

- The public names are `isDistinctFrom` and `isNotDistinctFrom`, spelling out the underlying SQL phrase to avoid ambiguity with result-row `distinct()` and aggregate `{ distinct: true }`.
- The initial scope is single-column condition operators only; row-constructor or tuple `IS DISTINCT FROM` support is left out unless a separate feature introduces tuple condition operators.

## Capabilities

- `null-safe-comparison-operators`: Provide reusable base column operators for Postgres null-safe inequality and equality across condition objects and chainable scalar expressions.

## Detailed Design

### Public API

Every column operator group that currently includes `equals`, `not`, `in`, and `notIn` gains `isDistinctFrom` and `isNotDistinctFrom`.

```ts
interface Base<Value> {
  equals: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  not: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  isDistinctFrom: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  isNotDistinctFrom: Operator<Value | IsQuery | Expression, BooleanQueryColumn>;
  in: Operator<Value[] | IsQuery | Expression, BooleanQueryColumn>;
  notIn: Operator<Value[] | IsQuery | Expression, BooleanQueryColumn>;
}
```

The snippet is illustrative; implementation should reuse existing local types and keep the current operator typing style.

- `isDistinctFrom` means `IS DISTINCT FROM`, so `NULL` is treated as a comparable value rather than producing SQL unknown.
- `isNotDistinctFrom` means `IS NOT DISTINCT FROM`, the null-safe equality counterpart.
- Nullable columns accept `null` wherever the existing condition typing permits `null` for equality-style comparisons.
- Non-null columns keep the same nullability restrictions that `equals` and `not` currently have.
- Both operators accept subqueries and raw SQL expressions through the same argument preparation and quoting path as `equals` and `not`.
- The operators are available in condition objects, relation filters, callback conditions, aggregate filters, and chainable scalar expressions wherever base column operators are already exposed.

### Integration and Lifecycle

The operators belong in `pqb`'s central column-operator model so they flow through existing condition rendering and typing:

- `where({ column: { isDistinctFrom: value } })`
- `where({ column: { isNotDistinctFrom: value } })`
- `whereNot({ column: { isDistinctFrom: value } })`
- `whereOneOf({ column: { isDistinctFrom: value } }, otherCondition)`
- `where((q) => q.get('column').isDistinctFrom(value))`
- relation filters that reuse `pqb` where arguments

No new `orm` API is needed. ORM relation queries should gain the operators from the underlying `pqb` condition types.

### SQL Semantics

`isDistinctFrom` always renders the Postgres predicate directly:

```sql
"table"."column" IS DISTINCT FROM $1
```

`isNotDistinctFrom` renders:

```sql
"table"."column" IS NOT DISTINCT FROM $1
```

The SQL should not special-case `null` into `IS NOT NULL` or `IS NULL` even though scalar behavior overlaps for null arguments. Rendering the explicit Postgres predicate keeps the feature faithful, consistent for expressions/subqueries, and easy to inspect.

Negation stays structural. `whereNot({ title: { isDistinctFrom: 'a' } })` renders as a negated `IS DISTINCT FROM` condition instead of being rewritten to `IS NOT DISTINCT FROM`. This preserves existing `whereNot` behavior and keeps the direct `isNotDistinctFrom` operator available for users who want positive null-safe equality.

### Documentation

The where guide should place `isDistinctFrom` and `isNotDistinctFrom` with the "any operators" list. The docs should include the common nullable-column negation surprise:

```ts
await db.post.whereOneOf({ title: { not: 'a' } }, { title: null });
await db.post.where({ title: { isDistinctFrom: 'a' } });
```

Explain that `isDistinctFrom` here is a condition operator for `IS DISTINCT FROM`, unrelated to query result `distinct()` and aggregate `{ distinct: true }`.

### Error Handling and Limits

- Unknown operator errors continue to be handled by the existing condition renderer.
- Unsupported database behavior does not need a fallback because Orchid targets Postgres only.
- Tuple or row-value distinct comparisons are not part of this feature.
