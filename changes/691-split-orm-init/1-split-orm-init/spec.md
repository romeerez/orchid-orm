## Summary

Add a split OrchidORM setup flow where users can first bundle table classes into helper-only temporary table objects, define reusable `makeHelper` helpers without database configuration, and later bind the bundle to adapter or driver options to get the normal database-aware ORM instance.

```ts
import {
  AdapterClass,
  bundleOrchidORMTables,
  makeOrchidOrmDbWithAdapter,
} from 'orchid-orm';
import { Adapter as PostgresJsAdapter } from 'orchid-orm/postgres-js';
import { UserTable } from './tables/user';
import { MessageTable } from './tables/message';

export const orm = bundleOrchidORMTables({
  user: UserTable,
  message: MessageTable,
});

export const selectProfile = orm.user.makeHelper((q) => q.select('id', 'name'));

export const db = makeOrchidOrmDbWithAdapter(orm, {
  adapter: new AdapterClass({
    driverAdapter: PostgresJsAdapter,
    config: { databaseURL: process.env.DATABASE_URL },
  }),
  log: true,
});
```

```ts
import { makeOrchidOrmDb } from 'orchid-orm/postgres-js';
import { orm } from './orm';

export const db = makeOrchidOrmDb(orm, {
  databaseURL: process.env.DATABASE_URL,
  log: true,
});
```

Existing one-step setup remains supported and remains the recommended default for simpler applications:

```ts
import { orchidORM } from 'orchid-orm/postgres-js';

export const db = orchidORM(
  { databaseURL: process.env.DATABASE_URL },
  {
    user: UserTable,
    message: MessageTable,
  },
);
```

## What Changes

- Add `bundleOrchidORMTables` to `orchid-orm` for constructing an object of helper-only temporary ORM table objects without database configuration or root `$` ORM methods.
- Narrow bundled table objects so their public surface exposes only `makeHelper`; they must not be full queryable table structures before DB binding.
- Redeclare the bundled table `makeHelper` type so it is bounded to the corresponding full DB-aware table query type, with `Args` and `Result` generics but without the full table type as a generic `this` parameter.
- Add `makeOrchidOrmDbWithAdapter` to `orchid-orm` for binding a bundled table object to explicit adapter or query-builder options and returning the normal database-aware `OrchidORM`.
- Add driver-specific `makeOrchidOrmDb` wrappers to `orchid-orm/node-postgres` and `orchid-orm/postgres-js` that accept the same driver configuration shape as `orchidORM`.
- Refactor existing `orchidORMWithAdapter` and driver-specific `orchidORM` functions to use the new split setup functions while preserving their public behavior.
- Document the split setup as an advanced optional workflow for defining `makeHelper` helpers before DB configuration, and make clear that bundled tables are not queryable table objects.
- `makeOrchidOrmDbWithAdapter` and driver-specific `makeOrchidOrmDb` return a new DB-aware ORM instance and do not add `$` methods to the table bundle passed in.

## Capabilities

- `orm-table-bundle`: Builds a helper-only temporary ORM table surface that can create reusable `makeHelper` helpers without database configuration or root ORM methods.
- `orm-db-binding`: Converts an ORM table bundle plus adapter or driver options into a normal DB-aware OrchidORM instance.

## Detailed Design

### Public API

The root `orchid-orm` entrypoint exports a helper-only table-bundle type and two new functions.

```ts
export interface OrchidORMTableHelper<T extends ORMTableInput> {
  makeHelper<Args extends unknown[], Result extends MergeQueryArg>(
    fn: (q: TableToDb<T>, ...args: Args) => Result,
  ): QueryHelper<TableToDb<T>, Args, Result>;
}

export type OrchidORMTables<T extends TableClasses = TableClasses> = {
  [K in keyof T]: T[K] extends { new (): infer R extends ORMTableInput }
    ? OrchidORMTableHelper<R>
    : never;
};

export type OrchidORMDbTables<T extends TableClasses = TableClasses> = {
  [K in keyof T]: T[K] extends { new (): infer R extends ORMTableInput }
    ? TableToDb<R>
    : never;
};

export type OrchidORM<T extends TableClasses = TableClasses> =
  OrchidORMDbTables<T> & OrchidORMMethods;

export declare const bundleOrchidORMTables: <T extends TableClasses>(
  tables: T,
) => OrchidORMTables<T>;

export declare const makeOrchidOrmDbWithAdapter: <T extends TableClasses>(
  orm: OrchidORMTables<T>,
  options: OrchidOrmParam<
    ({ db: Query } | { adapter: Adapter }) & DbSharedOptions
  >,
) => OrchidORM<T>;
```

- `bundleOrchidORMTables` accepts the same table-class object currently passed as the second argument of `orchidORMWithAdapter` and driver-specific `orchidORM`.
- The returned bundle exposes only the table keys from the input object. It must not expose `$query`, `$queryArrays`, `$withOptions`, `$transaction`, `$from`, `$qb`, `$close`, `$getAdapter`, or other root `$` ORM methods.
- Each table property on the bundle exposes only `makeHelper`. It must not expose query methods such as `select`, `where`, `find`, `create`, `update`, `delete`, `toSQL`, relation APIs, table metadata, or any other full table query surface.
- `OrchidORMTableHelper.makeHelper` is a distinct declaration for bundled temporary tables. Its callback receives the corresponding full DB-aware `TableToDb<T>` query type, and the returned helper must be usable with that same full table type after DB binding.
- The bundled table `makeHelper` declaration must have `Args` and `Result` generics, but it must not have the full query type as a generic `this` parameter. Reusing the full query object's generic `this`-based `makeHelper` signature is not sufficient because the temporary table object itself is intentionally minimal.
- `makeOrchidOrmDbWithAdapter` takes the bundle as the first argument and DB options as the second argument. This order is part of the public contract.
- `makeOrchidOrmDbWithAdapter` returns the same DB-aware `OrchidORM<T>` shape as `orchidORMWithAdapter` returns today.
- Existing `orchidORMWithAdapter(options, tables)` remains public and keeps its current parameter order and return type.

The driver entrypoints export a `makeOrchidOrmDb` wrapper next to the existing `orchidORM`, `createDb`, and `Adapter` exports.

```ts
// orchid-orm/postgres-js
export declare const makeOrchidOrmDb: <T extends TableClasses>(
  orm: OrchidORMTables<T>,
  options: OrchidOrmParam<PostgresJsOrchidORMOptions>,
) => OrchidORM<T>;

// orchid-orm/node-postgres
export declare const makeOrchidOrmDb: <T extends TableClasses>(
  orm: OrchidORMTables<T>,
  options: OrchidOrmParam<NodePostgresAdapterOptions & DbSharedOptions>,
) => OrchidORM<T>;
```

- Driver-specific `makeOrchidOrmDb` creates the same first-party adapter as the corresponding `orchidORM` wrapper.
- Driver-specific config types and semantics stay unchanged, including not passing ORM-only options such as `log` to the underlying driver adapter.
- The existing driver-specific `orchidORM(options, tables)` remains the recommended simple setup and keeps returning the normal DB-aware `OrchidORM<T>`.

### Table Bundle Semantics

Bundling tables should produce temporary table helper objects, not DB-aware table query objects.

- Each temporary table object exposes `makeHelper` and nothing else as public runtime API. The bundle can use internal full table state or metadata to implement `makeHelper` and later DB binding, but that state must not be observable through public properties, enumerable keys, or TypeScript table members.
- Temporary table objects must not be reusable as cached query objects because any query builder or adapter options involved in helper creation are not the DB-aware options. The DB-aware make step is the only stage that may expose full queryable table objects.
- Relations, table metadata such as `definedAs`, `filePath`, and `name`, computed columns, scopes, soft-delete behavior, schemas, `nowSQL`, RLS table metadata, and default table options are still part of the DB-aware table construction performed by `makeOrchidOrmDbWithAdapter`, driver-specific `makeOrchidOrmDb`, and existing one-step constructors. They are not part of the temporary bundle table surface.
- Table `init` hooks are part of DB-aware initialization. They must still receive the DB-aware ORM when `makeOrchidOrmDbWithAdapter`, driver-specific `makeOrchidOrmDb`, or existing one-step constructors create a DB-aware instance, and the split refactor must not cause existing one-step setup to register `init` hook effects more times than it does today.
- For the split flow, table `init` hooks run during the `makeOrchidOrmDbWithAdapter` or driver-specific `makeOrchidOrmDb` phase, not during `bundleOrchidORMTables`. Calling a make function multiple times for the same bundle runs table `init` hooks for each created DB-aware ORM instance.
- A bundle can be used to define `makeHelper` helpers before DB configuration. Those helpers must remain usable against the DB-aware tables returned by `makeOrchidOrmDbWithAdapter` or driver-specific `makeOrchidOrmDb`.
- The bundle may carry internal non-enumerable metadata needed to create later DB-aware instances, but that metadata must not appear as a public table key and must not change `Object.keys(bundle)` or normal property iteration over user tables.
- The bundle remains table-only after DB binding. Creating a DB-aware instance must not mutate the bundle by adding `$` methods or replacing its table properties.

### DB Binding Lifecycle

Binding a table bundle to DB options creates a normal, independent ORM instance.

- Each call to `makeOrchidOrmDbWithAdapter` or driver-specific `makeOrchidOrmDb` creates a DB-aware ORM with its own adapter, root query builder, async storage, root `$` methods, and table query objects.
- Multiple DB-aware instances can be created from the same bundle. They must not share DB-bound runtime state except for immutable table-class definitions, internal bundle metadata, and helper functions that users explicitly reuse.
- The DB-aware instance must preserve the current `orchidORMWithAdapter` behavior for raw queries, transactions, `$withOptions`, `$from`, `$close`, relation queries, `init` hooks, table SQL generation, and RLS-related metadata.
- The DB-aware instance should be a fresh object rather than the original bundle, so TypeScript and runtime behavior agree that the bundle has no `$` methods.
- Existing `{ db: Query }` support in `orchidORMWithAdapter` should remain available through `makeOrchidOrmDbWithAdapter`, preserving current behavior for creating an ORM from an existing query builder.

### Constructor Refactor

The existing constructors become compatibility wrappers around the split flow.

- `orchidORMWithAdapter(options, tables)` should bundle the provided tables and then call `makeOrchidOrmDbWithAdapter` with the same options.
- `orchid-orm/node-postgres` `orchidORM(options, tables)` should bundle the tables and then call that entrypoint's `makeOrchidOrmDb`.
- `orchid-orm/postgres-js` `orchidORM(options, tables)` should bundle the tables and then call that entrypoint's `makeOrchidOrmDb`.
- The refactor must preserve current type inference, runtime shape, public exports, adapter construction, and error behavior for existing one-step users.

### Error Handling and Limits

- Bundled tables are intentionally not typed as queryable table objects. TypeScript must reject calls such as `orm.user.find(123)`, `orm.user.select('id')`, and `orm.user.toSQL()` on a bundle.
- The only supported operation on a bundled table is creating reusable helpers with `makeHelper`. Users must call `makeOrchidOrmDbWithAdapter` or driver-specific `makeOrchidOrmDb` and use the returned DB-aware table for query construction, SQL generation, and execution.
- The split setup does not add custom runtime execution errors for bundled table queries because bundled tables do not expose executable query APIs. Accessing hidden internals or bypassing the public type surface is unsupported.
- The split setup does not add a lazy global database configuration mechanism. Users must explicitly call `makeOrchidOrmDbWithAdapter` or driver-specific `makeOrchidOrmDb` and use the returned DB-aware object for executable queries.
- The split setup does not replace the one-step constructor and should not make the common setup path more complex.

### Documentation

The docs should present the existing `orchidORM(options, tables)` flow first and keep it framed as the recommended setup. The split setup should be documented as an advanced option for codebases that want to define reusable `makeHelper` helpers before DB connection configuration is available. Documentation must explicitly say that the table bundle has no `$` methods and that bundled table objects expose only `makeHelper`; all query-building, SQL generation, relation, metadata, and execution APIs live on the DB-aware ORM returned by `makeOrchidOrmDbWithAdapter` or driver-specific `makeOrchidOrmDb`. Documentation must also mention that table `init` hooks run when the make function creates the DB-aware ORM instance, and that calling a make function multiple times for the same bundle runs `init` multiple times.
