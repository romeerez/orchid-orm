## Summary

Allow `get`, `getOptional`, and `pluck` to accept a query-aware callback that returns an SQL expression, matching the expression callback pattern already supported by `select`.

```ts
const isOwnPost: boolean = await db.post
  .find(1)
  .get((q) => sql<boolean>`${q.ref('userId')} = ${currentUserId}`);

const optionalFlag: boolean | undefined = await db.post
  .where({ id })
  .getOptional((q) => q.ref('userId').equals(currentUserId));

const flags: boolean[] = await db.post.pluck(
  (q) => sql<boolean>`${q.ref('userId')} = ${currentUserId}`,
);
```

## What Changes

- Add a callback argument form to `get`, `getOptional`, and `pluck` where the callback receives the current query and must return an `Expression`.
- Infer the return type, parsers, nullable behavior, and expression operators from the returned expression exactly as when the same expression is passed directly.
- Invoke the callback at query-building time so expressions can reference the current query with `q.ref`, `q.column`, joined selectables, aliases, CTE/from selectables, and correlated subqueries.
- Keep existing column-name and direct-expression argument behavior unchanged.
- Document the callback form alongside the existing `get`, `getOptional`, and `pluck` query methods.

## Assumptions

- The callback form is limited to expressions. It does not add relation-selection or subquery-returning callback support to `get`, `getOptional`, or `pluck`, because these methods select exactly one scalar value.

## Capabilities

- `expression-selection-callbacks`: Resolve query-aware callbacks that return SQL expressions for single-value selection methods, while preserving the same result typing and parser behavior as direct expressions.

## Detailed Design

### Public API

`get`, `getOptional`, and `pluck` accept their current argument types plus a callback whose parameter is the current query type and whose return value is an `Expression`.

```ts
interface Query {
  get<Arg extends GetArg<this>>(arg: Arg): GetResult<this, Arg>;
  getOptional<Arg extends GetArg<this>>(arg: Arg): GetResultOptional<this, Arg>;
  pluck<Arg extends PluckArg<this>>(arg: Arg): PluckResult<this, Arg>;
}

type GetArg<Q> =
  | (keyof Q['__selectable'] & string)
  | Expression
  | ((q: Q) => Expression);
type PluckArg<Q> =
  | '*'
  | keyof Q['__selectable']
  | Expression
  | ((q: Q) => Expression);
```

The snippet is illustrative: the implementation should keep Orchid's existing type names and performance-conscious mapped type style.

- `get((q) => expr)` returns the expression output type and throws `NotFoundError` when the query finds no row, the same as `get(expr)`.
- `getOptional((q) => expr)` returns the expression output type plus `undefined` when the query finds no row, the same as `getOptional(expr)`.
- `pluck((q) => expr)` returns an array of the expression output type, the same as `pluck(expr)`.
- The callback argument should be type-safe: `q` exposes the same query-aware expression helpers available in `select({ value: (q) => expr })`, including `ref` and `column`.
- The callback return type must be constrained to `Expression`; returning a relation query, record query, `rows()`, `undefined`, or a plain value is not part of the public API.
- The existing direct-expression overloads remain valid and keep the same inferred result types.

### Expression Resolution

The callback must be invoked during query construction against the cloned query being configured. This preserves Orchid's non-mutating query chaining contract and lets the returned expression reference the final query context that `get`, `getOptional`, or `pluck` is building.

After the callback returns an expression, the method should proceed as if the caller had supplied that expression directly:

- set the same return type metadata that the method already sets for direct expressions
- select the returned expression as the single selected value
- attach the same parser metadata from the expression's result column
- expose the same column operators for chained expression operations where the current direct-expression form already exposes them

The callback form must not change SQL generation for equivalent direct-expression usage.

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

This includes columns from the base table, joined tables, aliases, `from` sources, and CTE-derived selectable columns when those are already available to the query type. Correlated subqueries are supported by composing expressions inside the callback in the same way as `select` expression callbacks.

### Package Boundaries

The change belongs in `pqb`, because `get`, `getOptional`, `pluck`, expression helpers, and selection parser behavior are query-builder responsibilities. Downstream `orm` query instances should receive the new API through their existing pqb query inheritance; no standalone `orm` public API should be added.

Public exports should not be expanded unless an existing exported type that describes `get` or `pluck` arguments must change. Any internal helper shared across `get` and `pluck` should stay inside `pqb` query internals unless downstream packages already need it.

### Error Handling and Limits

- No new public error type is required.
- TypeScript should reject non-expression callback returns for typed callers.
- Runtime behavior for invalid JavaScript callback returns should fail through the same internal assumptions that invalid direct selection arguments already use; do not add runtime validation that only duplicates the TypeScript contract.
- A callback is not a lazy per-row callback. It is executed once while building the query and produces a SQL expression evaluated by Postgres.

### Documentation

Docs should show that the callback is useful when the expression needs access to the current query, especially `q.ref` or `q.column`. The docs should also make clear that the callback returns an SQL expression, not a JavaScript value computed for each result row.
