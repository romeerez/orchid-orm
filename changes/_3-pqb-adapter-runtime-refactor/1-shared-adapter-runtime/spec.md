## Summary

Introduce shared non-generic `Adapter` and `TransactionAdapter` runtime orchestrator classes in `pqb` and reduce `node-postgres` and `postgres-js` to thin driver-specific port implementations behind them. The stable user-facing contract remains the driver-specific config accepted by `createDb` and related entrypoints, while first-party low-level adapter recreation moves to a shared `clone(params?)` contract and removes legacy `reconfigure` / `updateConfig` from first-party adapters and callers.

```ts
import { createDb, Adapter } from 'orchid-orm/node-postgres';

const db = createDb({
  databaseURL: process.env.DATABASE_URL,
  max: 20,
});

const adminAdapter = new Adapter({
  databaseURL: process.env.DATABASE_URL,
  max: 20,
}).clone({
  database: 'postgres',
  user: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
});
```

## What Changes

- Add a shared adapter runtime in `pqb` that owns common adapter and transaction behavior instead of duplicating it in each driver file.
- Make `AdapterConfigBase` the actual common connection contract with `databaseURL`, `database`, `user`, `password`, `searchPath`, and shared options such as `connectRetry`, while keeping driver-specific config extensions stable.
- Replace `reconfigure` and `updateConfig` with common `clone(params?)` behavior, remove legacy methods from first-party adapters/callers, and move close/recreate lifecycle management into the shared runtime.
- Move common URL-derived metadata access, connect-retry wiring, SQL session state orchestration, locals handling, and `QueryError` field copying into the shared runtime, leaving only minimal driver-native hooks in adapter-specific files.
- Update first-party low-level adapter callers and docs to use `clone`, while keeping `createDb` ergonomics and driver entrypoint shapes unchanged.

## Capabilities

- `adapter-runtime`: Shared root and transaction adapter behavior that is independent of the concrete database driver.
- `adapter-port`: Minimal driver-specific port contract that the shared runtime depends on for constructing, querying, transacting, closing, and describing a concrete driver implementation.

## Detailed Design

### Public API

The stable public boundary of this refactor is the config input accepted by driver entrypoints such as `pqb/node-postgres`, `pqb/postgres-js`, `orchid-orm/node-postgres`, and `orchid-orm/postgres-js`.

```ts
interface AdapterConfigBase {
  databaseURL?: string;
  database?: string;
  user?: string;
  password?: string;
  searchPath?: string;
  connectRetry?: AdapterConfigConnectRetryParam | true;
}

interface AdapterClass {
  new (config: AdapterConfigBase): AdapterBase;
}

declare class Adapter implements AdapterBase {
  constructor(params: {
    adapterClass: AdapterClass;
    config: AdapterConfigBase;
    adapter?: AdapterBase;
  });
  clone(params?: AdapterConfigBase): Adapter;
}

declare class TransactionAdapter implements TransactionAdapterBase {
  constructor(params: {
    adapter: TransactionAdapterBase;
    adapterClass: AdapterClass;
    config: AdapterConfigBase;
  });
  clone(params?: AdapterConfigBase): Adapter;
}
```

- `clone(params?)` is the shared low-level recreation contract for first-party adapters and consumers.
- `Adapter` and `TransactionAdapter` are composition-based runtime orchestrators around driver-specific `AdapterBase` and `TransactionAdapterBase` implementations; they are not extended by driver adapters.
- `TransactionAdapter` is the shared runtime transaction layer used for in-transaction behavior.
- `TransactionAdapter.clone(params?)` recreates through the shared runtime using the stored adapter class and config.
- `AdapterBase` and `TransactionAdapterBase` are retained as the driver-specific port interfaces that the shared runtime depends on, not as the main runtime adapter surface exposed to the rest of `pqb`.
- Driver-specific adapter option interfaces continue to extend `AdapterConfigBase` and keep their driver-native fields and naming unchanged.
- `createDb` signatures and driver-specific config ergonomics stay unchanged from the user's perspective.
- `clone(params?)` replaces `reconfigure` and `updateConfig` on low-level runtime-backed adapter classes, and first-party adapters/callers should no longer rely on the removed methods.
- `clone()` with no params returns a fresh adapter instance of the same concrete class and config.
- `clone(params)` patches the shared adapter config fields from `AdapterConfigBase`, including `databaseURL`, `database`, `user`, `password`, `searchPath`, and `connectRetry`, and returns a fresh adapter instance of the same concrete class.
- Concrete driver adapter class names remain available at the current entrypoints. Access to driver-native handles such as `pool` and `sql` may remain available on those classes, but they should be thin wrappers around the shared runtime and this refactor does not treat the full class shape as the primary stable public contract.

### Shared Runtime State

The shared runtime stores the information needed to recreate or inspect a concrete adapter without re-implementing the logic in every driver file.

```ts
interface AdapterConnectionState<Config> {
  originalConfig: Config;
  databaseURL?: string;
  database?: string;
  user?: string;
  password?: string;
  searchPath?: string;
  host?: string;
  schema?: QuerySchema;
}
```

- The runtime keeps the original concrete config object and the concrete adapter constructor so it can create a fresh instance of the same adapter class.
- The runtime derives a normalized common connection view from `databaseURL` and direct common fields and uses that view for metadata getters and clone patching.
- For the existing adapters, `databaseURL` remains supported and is the default source for URL-derived fields when present.
- The normalized state is a shared conceptual contract; driver-specific adapters project it into driver-native options instead of owning their own separate reconfiguration logic.

### Runtime and Port Boundary

The shared runtime owns the cross-driver behavior once, while the driver-specific port implementations provide only the minimum hooks needed to talk to a concrete driver.

```ts
interface AdapterBase<Config, Driver, Connection> {
  errorClass: new (...args: never[]) => Error;
  errorFields: readonly string[];
  queryableAfterClose: boolean;
  createDriver(config: Config): Driver;
  closeDriver(driver: Driver): Promise<void>;
  borrowConnection(driver: Driver): Promise<Connection>;
  releaseConnection(connection: Connection): Promise<void>;
  beginTransaction<T>(
    driver: Driver,
    options: AdapterTransactionOptions | undefined,
    run: (connection: Connection) => Promise<T>,
  ): Promise<T>;
  execute(
    connection: Connection,
    input: AdapterExecutionInput,
  ): Promise<QueryResult | QueryArraysResult>;
}

interface TransactionAdapterBase<Config, Driver, Connection> {
  execute(
    connection: Connection,
    input: AdapterExecutionInput,
  ): Promise<QueryResult | QueryArraysResult>;
}
```

- The shared runtime owns `query`, `arrays`, top-level transaction orchestration, nested transaction behavior, locals handling, SQL session state handling, connect retry, metadata getters, `assignError`, `clone`, and `close`.
- The shared transaction adapter behavior also moves into shared runtime code. Driver-specific transaction adapter exports may remain as thin wrappers or thin port-backed classes if first-party code still imports those names.
- `AdapterBase` and `TransactionAdapterBase` are the only interfaces the shared runtime should need from driver-specific implementations.
- The shared runtime should use `borrowConnection` and `releaseConnection` as the generic hooks for connection-scoped logic that must run on one concrete driver connection before handing control back to driver-neutral code.
- Driver-specific adapter files must not keep their own copies of URL patching, lifecycle mutation, nested transaction restoration, or error-copying logic.
- Adding a future adapter should mean implementing the minimal port interfaces and inheriting the shared runtime behavior by default.

### Lifecycle and Cloning

`clone` and `close` become shared runtime lifecycle features instead of per-driver adapter logic.

- `clone` never mutates the current adapter instance; it always returns a fresh adapter instance of the same concrete class.
- `clone(params?)` uses the stored constructor plus the stored original config to rebuild a concrete config object with patched shared adapter config fields.
- `close()` is runtime-owned and must preserve current observable behavior for the existing adapters: after `close`, the adapter remains reusable for later queries.
- When `queryableAfterClose` is `true`, runtime closes the current driver object and leaves the adapter ready for reuse under the driver's normal semantics.
- When `queryableAfterClose` is `false`, runtime closes the current driver object and immediately recreates a fresh driver object from the stored config so the adapter remains reusable.
- First-party code that needs alternate database, user, password, or search path values should use `clone` instead of directly reconstructing adapter-specific config in downstream packages.

### node-postgres

`node-postgres` becomes a thin specialization over the shared runtime.

- The driver-specific root and transaction pieces should implement the adapter port interfaces, while the shared runtime `Adapter` / `TransactionAdapter` layers own the cross-driver behavior.
- The concrete adapter continues exposing a `Pool`-backed driver and may keep its `pool` property for advanced low-level use.
- The driver-specific ports are responsible only for creating and closing the pool, implementing `borrowConnection` and `releaseConnection` via `pool.connect` and client release, starting a real top-level transaction on a checked-out client, and executing object or array queries on a given client.
- Shared runtime logic must continue to compose with existing `node-postgres` behavior that depends on the active `PoolClient`, including savepoint-aware execution, search-path application, locals handling, and SQL session state reconciliation.

### postgres-js

`postgres-js` also becomes a thin specialization over the shared runtime.

- The driver-specific root and transaction pieces should implement the adapter port interfaces, while the shared runtime `Adapter` / `TransactionAdapter` layers own the cross-driver behavior.
- The concrete adapter continues exposing the underlying `sql` handle for advanced low-level use.
- The driver-specific ports are responsible only for creating and closing the `sql` client, implementing `borrowConnection` and `releaseConnection` via `reserve` and release, starting a real top-level transaction, and executing object or array queries on the provided connection.
- `postgres-js` remains the driver that is not queryable after `close`, and the shared runtime must handle the required recreation step instead of leaving it to adapter-specific close logic.
- The runtime must preserve the same same-connection guarantees currently required for `postgres-js` non-transactional session work and transaction reuse.

### rake-db Integration

`rake-db` is the main first-party consumer of low-level adapter recreation.

- `rake-db` create/drop flows switch from `reconfigure` to `clone` and keep working with the shared clone-based adapter interface.
- `rake-db` should rely only on the shared common connection patching contract for database, user, password, and search path overrides.
- `rake-db` may also pass `databaseURL` or `connectRetry` through `clone` when a flow needs to preserve or adjust those shared adapter config fields.
- `rake-db` must not own its own adapter-specific URL mutation logic or adapter reconstruction rules.
- From a user's perspective, programmatic create/drop workflows keep working the same way; only the low-level helper name and shared implementation boundary change.

### Error Handling and Limits

- All adapters are expected to support the common connection fields `databaseURL`, `database`, `user`, `password`, and `searchPath`. If a future driver needs translation or emulation, that adaptation belongs inside its thin driver-specific port implementation.
- `clone(params)` only patches the shared adapter config fields from `AdapterConfigBase`, including `connectRetry`. Changing driver-specific options outside that shared set still requires constructing a new adapter directly with the full driver config object.
- `assignError` becomes runtime-owned and copies only the fields explicitly declared by the driver-specific port. The runtime must not hard-code separate field-copy blocks per driver.
- Failed runtime-managed recreate steps surface their errors directly. The runtime must not silently fall back to stale driver objects.
- The refactor should not add runtime validation that merely duplicates TypeScript guarantees for clone inputs or adapter config shapes.

### Documentation

Root docs and JSDoc that currently demonstrate `reconfigure` for programmatic migration or create/drop flows should switch to `clone`. The documentation should also make the stable boundary explicit: users continue passing driver-specific config into `createDb` and related entrypoints, while low-level adapter classes remain advanced tools whose full shape is not the primary compatibility promise of this refactor.
