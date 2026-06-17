# ORM Split Bundle

`orm.ts` owns split ORM init.

- `bundleOrchidORMTables` creates helper-only table bundle.
- `makeOrchidOrmDbWithAdapter` binds bundle to explicit `adapter` or existing `db`.
- `privateOrchidORMWithAdapter` builds real DB-aware ORM.
- `orchidORMWithAdapter` keeps old one-step shape and calls `privateOrchidORMWithAdapter` directly.
- Driver entrypoints expose `makeOrchidOrmDb` and keep one-step `orchidORM` by bundling then binding.

Bundled table entries are plain helper objects, not query objects. Runtime public shape: `table`, `makeHelper`. No `select`, `where`, `find`, `toSQL`, relation APIs, columns, schema, soft delete, scopes, RLS, grants, file path, or root `$` methods.

Bundle metadata is non-enumerable symbol data:

- original table classes, used later by DB binding.
- `setDbAwareInstance`, used by lazy helpers.

This keeps `Object.keys(bundle)` limited to user table keys. `makeOrchidOrmDbWithAdapter` rejects objects without this metadata.

`makeHelper` is lazy. Helper from bundle stores callback, then on first helper use delegates to `dbAwareInstance[key].makeHelper(...)`. That means helper normally gets used after binding. It preserves full DB-aware query behavior without putting query methods or execution state on bundle.

`OrchidORMTableHelper<T>` has dedicated bundled `makeHelper` signature. Do not reuse full query object `makeHelper` type; bundle runtime is smaller. Callback receives full DB-aware `TableToDb` query type, so helper result stays usable on real tables after binding.

`makeOrchidOrmDbWithAdapter` creates fresh ORM per call. It does not mutate bundle or replace bundled table entries. Each DB-aware ORM gets own adapter or existing query builder link, root `$` methods, table query objects, relations, RLS metadata, grants metadata, and `init` hook pass.

`init` runs only in DB-aware construction. Bundle phase does not run it. Binding same bundle multiple times runs `init` once per created ORM instance.

Driver wrappers in `adapters/postgres-js.ts`, `adapters/node-postgres.ts`, and `adapters/bun.ts` construct first-party `AdapterClass` and pass driver config without ORM-only `log`. `log` is forwarded to ORM options, not driver adapter config.

When exposing more static metadata from bundled tables, same rule as `table`: value must be available from table class instance before DB binding and be direct public `pqb` `Query` property. Table-class-only details stay internal to DB binding.

`schema` stays hidden on bundled entries. Table classes can define schema and DB-aware queries can carry schema, but schema is not direct public `Query` property. Use DB-aware table query for schema and other metadata.
