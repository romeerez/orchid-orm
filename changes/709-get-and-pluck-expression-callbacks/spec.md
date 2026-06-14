## Summary

Allow `get`, `getOptional`, and `pluck` to accept a query-aware callback that returns either an SQL expression or a single-value query, matching the callback pattern already supported by `select`.

```ts
const isOwnPost = await db.post
  .find(1)
  .get((q) => sql<boolean>`${q.ref('userId')} = ${currentUserId}`);

const authorName = await db.post
  .find(postId)
  .getOptional((q) => q.author.get('name'));

const commentFlags = await db.post.pluck((q) => q.comments.exists());
```

## What Changes

- Add a callback argument form to `get`, `getOptional`, and `pluck` where the callback receives the current query and must return either an `Expression` or a query whose `returnType` is `value` or `valueOrThrow`.
- Infer the return type, parsers, nullable behavior, and expression operators from the returned expression or single-value query exactly as when the same value is selected via `select`.
- Invoke the callback once at query-building time so expressions can reference the current query with `q.ref`, `q.column`, joined selectables, aliases, CTE/from selectables, and correlated subqueries.
- Support relation scalar queries returned from the callback, including the same lateral join, parser, empty-result, aliasing, and relation-join behavior that `select({ field: (q) => q.relation.get(...) })` already has.
- Keep existing column-name and direct-expression argument behavior unchanged.
- Document the callback form alongside the existing `get`, `getOptional`, and `pluck` query methods.

## Capabilities

- `select-item-callback-resolution`: Extract the existing callback-value handling from `processSelectArg` into a reusable scalar/select item resolver that keeps current `select` behavior for expressions, relation queries, lateral joins, parsers, and aliases.
- `scalar-selection-callbacks`: Resolve query-aware callbacks for `get`, `getOptional`, and `pluck` when they return an expression or a single-value query, while preserving scalar result typing and parser behavior.

## Detailed Design

### Public API

`get`, `getOptional`, and `pluck` accept their current argument types plus a callback whose parameter is the current query type and whose return value is an `Expression` or a query whose `returnType` is `value` or `valueOrThrow`.

```ts
interface Query {
  get<Arg extends GetArg<this>>(arg: Arg): GetResult<this, Arg>;
  getOptional<Arg extends GetArg<this>>(arg: Arg): GetResultOptional<this, Arg>;
  pluck<Arg extends PluckArg<this>>(arg: Arg): PluckResult<this, Arg>;
}

type GetArg<Q> =
  | (keyof Q['__selectable'] & string)
  | Expression
  | ((q: Q) => Expression | SingleValueQuery);
type PluckArg<Q> =
  | '*'
  | keyof Q['__selectable']
  | Expression
  | ((q: Q) => Expression | SingleValueQuery);

interface SingleValueQuery {
  returnType: 'value' | 'valueOrThrow';
}
```

The snippet is illustrative: the implementation should keep Orchid's existing type names and performance-conscious mapped type style.

- `get((q) => expr)` returns the expression output type and throws `NotFoundError` when the query finds no row, the same as `get(expr)`.
- `getOptional((q) => expr)` returns the expression output type plus `undefined` when the query finds no row, the same as `getOptional(expr)`.
- `pluck((q) => expr)` returns an array of the expression output type, the same as `pluck(expr)`.
- `get((q) => q.relation.get('column'))`, `getOptional((q) => q.relation.getOptional('column'))`, and `pluck((q) => q.relation.count())` use the returned query's `result.value` column as the scalar result type.
- The callback argument should be type-safe: `q` exposes the same query-aware expression helpers available in `select({ value: (q) => expr })`, including `ref` and `column`, and keeps the current query's selectable context.
- The callback return type must be constrained to `Expression` or a single-value query. Returning a relation query that still returns records, arrays, rows, or plucks, or returning `undefined` or a plain JavaScript value, is not part of the public API.
- The existing direct-expression overloads remain valid and keep the same inferred result types.

### Scalar Callback Resolution

The callback must be invoked during query construction against the cloned query being configured. This preserves Orchid's non-mutating query chaining contract and lets the returned value reference the final query context that `get`, `getOptional`, or `pluck` is building.

After the callback returns an expression or single-value query, the method should proceed as if the caller had selected that value through the same select-item machinery used by `select`:

- set the same return type metadata that the method already sets for direct expressions
- select the returned expression or query value as the single selected value
- attach the same parser metadata from the returned value's result column
- expose the same column operators for chained scalar operations where the current direct-expression form already exposes them
- preserve relation query processing when the returned query is a relation scalar query

The callback form must not change SQL generation for equivalent direct-expression usage, and it should match `select({ field: (q) => q.relation.get(...) })` semantics for equivalent single-value relation queries.

`get` and `getOptional` should resolve callback arguments before their existing string-versus-expression branch reads expression metadata. `pluck` should resolve callback arguments before the existing selected-item parser path receives the selected value. Both paths should preserve their current behavior for plain column names and direct expressions.

### Shared Select Callback Handling

The existing `processSelectArg` implementation in `select.utils.ts` contains the authoritative runtime behavior for object-select callback values. Its per-key logic should be extracted, extended, or otherwise integrated so `select`, `get`, `getOptional`, and `pluck` share the same resolver for callback-returned values.

The shared resolver must keep these existing `select` guarantees intact:

- expression callbacks can use `q.ref`, `q.column`, SQL helpers, window/aggregate/search expressions, CTE/from selectables, and joined selectable columns
- callbacks returning relation value queries are converted to lateral joins with the same relation filters, aliases, `join()` inner-join behavior, `on` relation behavior, and through-relation behavior as today
- selected relation scalar values remain usable through their selected aliases for ordering and filtering in the surrounding query
- repeated scalar selections from the same relation can still be deduplicated into a single lateral join when `select` selects more than one value from that relation
- returned query parsers, nullable columns, `getOptional` empty-result defaults, required `get` not-found errors, `count` zero defaults, and `exists` false defaults remain consistent with current `select` behavior

For `get`, `getOptional`, and `pluck`, TypeScript should restrict returned queries to `returnType: 'value' | 'valueOrThrow'`. Runtime code can still reuse the broader `select` resolver even though that resolver also handles record, array, pluck, and relation-object cases for `select`.

### Query Context

The callback receives the query with the same selectable context as the method call site.

```ts
const q = db.post
  .join('author')
  .where({ published: true })
  .get(
    (q) =>
      sql<boolean>`${q.ref('author.active')} AND ${q.ref('post.published')}`,
  );
```

This includes columns from the base table, joined tables, aliases, `from` sources, relation queries, and CTE-derived selectable columns when those are already available to the query type. Correlated subqueries are supported by composing expressions or single-value relation queries inside the callback in the same way as `select` callbacks.

```ts
const q = db.user
  .with('activeProfiles', db.profile.select('UserId', 'Bio'))
  .pluck((q) =>
    q.profile
      .join('activeProfiles', 'activeProfiles.UserId', 'profile.UserId')
      .getOptional('activeProfiles.Bio'),
  );
```

### Package Boundaries

The change belongs in `pqb`, because `get`, `getOptional`, `pluck`, expression helpers, and selection parser behavior are query-builder responsibilities. Downstream `orm` query instances should receive the new API through their existing pqb query inheritance; no standalone `orm` public API should be added.

Public exports should not be expanded unless an existing exported type that describes `get` or `pluck` arguments must change. Any internal helper shared across `get` and `pluck` should stay inside `pqb` query internals unless downstream packages already need it.

### Error Handling and Limits

- No new public error type is required.
- TypeScript should reject callback returns that are neither expressions nor single-value queries for typed callers.
- Runtime behavior for invalid JavaScript callback returns should fail through the same internal assumptions that invalid direct selection arguments already use; do not add runtime validation that only duplicates the TypeScript contract.
- A callback is not a lazy per-row callback. It is executed once while building the query and produces a SQL expression or SQL subquery evaluated by Postgres.
- Relation queries returned from callbacks must be single-value queries at the public type level. `select`, `take`, `rows`, and `pluck` relation queries remain supported by `select` object callbacks, but not by scalar `get`, `getOptional`, or `pluck` callbacks.

### Documentation

Docs should show that the callback is useful when the selected scalar needs access to the current query, especially `q.ref`, `q.column`, or a relation query such as `q.profile.get('Bio')` or `q.messages.count()`. The docs should also make clear that the callback returns SQL-building objects, not a JavaScript value computed for each result row.
