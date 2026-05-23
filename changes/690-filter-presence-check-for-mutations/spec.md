## Summary

Make `update`, `updateOrThrow`, `delete`, and `hardDelete` reject empty effective `where` filters, so dynamic objects whose values are all ignored cannot accidentally mutate every row. Full-table mutations remain available only when the query explicitly uses `all()`.

```ts
await db.table.where({ id }).delete(); // allowed
await db.table.where({ id }).update(data); // allowed

await db.table.where({}).delete(); // throws
await db.table.where({ id: undefined }).update(data); // throws

await db.table.all().where({ id: undefined }).delete(); // allowed explicit all-row mutation
await db.table.all().update(data); // allowed explicit all-row mutation
```

## What Changes

- Refine the existing mutation safety guard so calling a where-like method is not enough; `update` and `delete` require at least one effective user-supplied predicate or an explicit `all()`.
- Preserve current read-query behavior where `where({})` and `where({ key: undefined })` are valid and simply produce no SQL predicate.
- Keep `all()` as the public opt-in for full-table `update` and `delete`, including when an empty dynamic filter is chained after it.
- Treat soft-delete's implicit non-deleted filter as insufficient by itself, so soft-deleting with an empty additional filter also requires `all()`.
- Update user docs around `where`, `update`, `delete`, and soft delete to explain the difference between read filters and mutation filters.

## Assumptions

- A named user scope that adds conditions should continue to satisfy the mutation guard, because scopes are already an explicit query-filtering surface and existing behavior relies on scoped mutations.
- Empty nested condition objects and operator objects whose values are all `undefined` should be treated the same as a top-level empty `where` object for mutation safety.

## Capabilities

This change introduces no standalone capability. It tightens the existing pqb mutation safety contract for `update` and `delete` while preserving the existing `all()` opt-in surface.

## Detailed Design

### Public Mutation Contract

`update`, `updateOrThrow`, `delete`, and `hardDelete` must require one of two public signals before they produce a mutating query:

- at least one effective user-supplied predicate from a where-like surface
- an explicit `all()` call

An effective predicate is a condition that can contribute SQL or intentionally prevents execution, not merely the presence of query metadata. `where({})`, `where({ key: undefined })`, and nested/operator objects that become empty after ignored `undefined` values are removed do not count as effective predicates.

`all()` continues to mean "I intentionally allow this mutation to target all rows visible to this query." If `all()` is present, empty later filters are allowed and must not make the mutation unsafe again.

### Read Query Behavior

Read queries keep the current permissive `where` behavior:

- `where({})` is valid and produces no `WHERE` clause.
- `where({ key: undefined })` is valid and treats `key` as not supplied.
- Nested undefined operator values are still ignored.

The new rejection is a mutation-time safety check, not a general validation rule for `where`.

### Where-Like Surfaces

The guard must apply consistently to every pqb surface that authorizes mutation by setting where conditions:

- object `where`, `whereNot`, `whereOneOf`, `whereNotOneOf`, `orWhere`, and `orWhereNot`
- callback-based `where` forms after the callback is resolved
- raw SQL predicates such as `whereSql` and `whereNotSql`
- relation/existence predicates such as `whereExists` and `whereNotExists`
- `find`, `findBy`, and non-empty `whereIn` style helpers
- named scopes that add conditions, except for the built-in soft-delete non-deleted scope described below

Empty iterable helpers that already convert a mutation to a safe no-op, such as empty `whereIn`/`notIn` behavior, should keep that no-op behavior and must not become full-table mutations.

### Soft Delete

For tables configured with `softDelete`, the implicit `deletedAt IS NULL` filter is not enough to authorize a mutation by itself.

```ts
await db.softDeletedTable.where({}).delete(); // throws
await db.softDeletedTable.where({ id }).delete(); // allowed
await db.softDeletedTable.all().delete(); // allowed, soft-deletes all non-deleted rows

await db.softDeletedTable.where({}).hardDelete(); // throws
await db.softDeletedTable.all().hardDelete(); // allowed
```

This keeps soft delete safe for dynamic filters while preserving the existing explicit all-row behavior. Other explicitly selected named scopes that add conditions may still authorize mutations.

### Errors and Limits

- Empty effective filters should fail with the existing dangerous mutation error family rather than introducing a new public error type.
- The failure should happen before SQL execution and should apply whether the query returns a row count, selected rows, or a selected value.
- The guard does not need to prove that a predicate is selective; raw SQL predicates and scopes count when they are explicitly present.

### Documentation

Docs should make clear that `undefined` values are still ignored for reads, but an empty effective filter cannot be used to authorize `update` or `delete`. Mutation docs should show `all()` as the required way to intentionally mutate all rows, and soft-delete docs should mention that its implicit non-deleted filter does not replace the explicit user filter requirement.
