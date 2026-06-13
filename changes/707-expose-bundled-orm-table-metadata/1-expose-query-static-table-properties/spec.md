## Summary

Expose static query-compatible table metadata on table helpers returned by `bundleOrchidORMTables`, starting with the table name.

```ts
const orm = bundleOrchidORMTables({
  user: UserTable,
});

orm.user.table; // 'user'
orm.user.makeHelper((q) => q.select('id'));
```

## What Changes

- `bundleOrchidORMTables` table entries expose `table` with the same literal type as the DB-aware ORM table query.
- Bundled table entries remain non-queryable helper objects; exposing metadata must not add SQL generation, execution, relation, or DB-bound APIs.
- Static table-class properties are exposed from bundles only when the property is a direct property of the public `pqb` `Query` interface.
- `schema` is not exposed by this change because the current public `Query` interface does not define a direct `schema` property.

## Assumptions

- The bundle should expose table-local values from the table class instance, not values that depend on later DB binding options such as the default schema passed to `makeOrchidOrmDb`.

## Capabilities

This idea only extends the existing split ORM setup surface. It does not introduce a standalone capability that should exist independently of `bundleOrchidORMTables`.

## Detailed Design

### Public API

`bundleOrchidORMTables` continues to return one object property per table key. Each bundled table entry exposes `makeHelper` and `table`.

```ts
export interface OrchidORMTableHelper<T extends Query> {
  table: T['table'];
  makeHelper<Args extends unknown[], Result>(
    fn: (q: T, ...args: Args) => Result,
  ): OrchidORMQueryHelper<T, Args, Result>;
}
```

- `orm.<tableKey>.table` is available immediately after `bundleOrchidORMTables`, before a DB adapter, database URL, or DB-aware ORM instance exists.
- The type of `orm.<tableKey>.table` preserves the literal table name inferred from the table class, matching the eventual DB-aware table query.
- Existing `makeHelper` behavior and helper result typing stay unchanged.
- The bundle object still exposes only the user-provided table keys plus non-enumerable internal metadata.

### Static Property Exposure Rule

When analyzing table-class properties for bundle exposure, include only properties that satisfy both conditions:

- The value is available from the table class instance without creating a DB-aware query.
- The property name exists directly on the public `Query` interface from `pqb`.

Under the current codebase, `table` satisfies this rule because `Query` extends `PickQueryTable`, which defines `table?: string`, and ORM table classes already define a `table` instance property.

`schema` is intentionally excluded. ORM table classes can define `schema`, and DB-aware queries store schema in `q.schema`, but `schema` is not a direct property on the public `Query` interface. If a future PQB change adds `schema` as a direct `Query` property, exposing bundled `schema` can be considered in a separate change using the same rule.

Do not expose table-class-only metadata such as `columns`, `types`, `language`, `softDelete`, `scopes`, `computed`, `comment`, `rls`, `grants`, `filePath`, or relation definitions unless the public `Query` interface directly grows a matching property and the value is static before DB binding.

### Integration and Lifecycle

Bundling should instantiate or reuse the same immutable table-class instance that is already used as the source of later DB-aware binding metadata. The bundled helper reads static metadata from that instance and stores it on the helper object.

The exposed value must be independent of later calls to `makeOrchidOrmDb` or `makeOrchidOrmDbWithAdapter`. Binding the same bundle multiple times must not mutate `orm.<tableKey>.table`, and `orm.<tableKey>` must remain distinct from every DB-aware table query object.

### Error Handling and Limits

- Existing validation that table keys must not start with `$` remains unchanged.
- If a table class does not provide a concrete `table` value, the bundle exposes the same value the DB-aware path would receive from the table instance; this feature should not add a new runtime validation layer.
- This change does not make bundled table entries usable where a `Query` is required.

### Documentation

Update the split setup documentation to show `orm.<tableKey>.table` as available on bundled table helpers and to keep the warning that bundled table entries are not queryable. Mention that schema is not exposed from the bundle; use the DB-aware table query when query metadata beyond static table name is needed.
