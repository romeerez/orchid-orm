# ORM Split Bundle

`orm.ts` owns split ORM setup:

- `bundleOrchidORMTables` creates the pre-DB bundle.
- `makeOrchidOrmDbWithAdapter` binds that bundle to an adapter or existing query builder.
- Driver adapters expose their own `makeOrchidOrmDb` wrappers and keep one-step `orchidORM` behavior by bundling and binding internally.

Bundled table entries are plain helper objects, not preliminary query objects. Each entry stores the table-class instance's `table` value and a `makeHelper` function. The bundle's table classes and DB-aware instance setter live in non-enumerable symbol metadata on the bundle object, which keeps `Object.keys(bundle)` limited to user-provided table keys.

`makeHelper` is lazy. A helper created from a bundle defers to `dbAwareInstance[key].makeHelper(...)` on first use, after the bundle has been bound by `makeOrchidOrmDbWithAdapter` or a driver-specific make function. This preserves full DB-aware query behavior without putting query methods or execution state on the bundle.

The public `OrchidORMTableHelper<T>` type exposes `table: T['table']` and the dedicated bundled `makeHelper` signature. Do not reuse the full query object's `makeHelper` surface here; the bundle intentionally has a smaller runtime and type surface.

When exposing more static metadata from bundled tables, apply the same rule as `table`: the value must be available from the table class instance before DB binding, and the property must be a direct public `pqb` `Query` property. Table-class-only details such as `schema`, `columns`, `softDelete`, `scopes`, relation definitions, RLS, grants, and file paths remain internal to later DB binding.

`schema` is deliberately not exposed from bundled entries. Table classes can define schema and DB-aware queries can carry schema, but schema is not a direct public `Query` property. Use the DB-aware table query for schema and other query metadata.
