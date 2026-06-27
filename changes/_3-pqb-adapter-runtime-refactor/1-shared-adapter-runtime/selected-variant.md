# Shared adapter runtime with thin driver ports

## Goal

Refactor `pqb` adapter internals so driver-specific code is as small and simple as possible while preserving the stable user-facing entrypoints where adapter-specific config is provided.

The important public contract to preserve is:

- `createDb` and downstream driver entrypoints still accept driver-specific config shapes
- the existing adapters continue to support `databaseURL`
- all adapters are expected to support `database`, `user`, `password`, and `searchPath` as part of the common adapter contract

The refactor should move shared responsibilities out of `node-postgres` and `postgres-js` adapter implementations and into one shared runtime that future adapters can reuse.

## Context from existing research

Current `node-postgres` and `postgres-js` adapters duplicate a large amount of logic that is not truly driver-specific:

- parsing and patching `databaseURL`
- metadata getters such as database, user, host, schema, and search path
- connect-retry wiring
- top-level and nested transaction orchestration
- locals and `search_path` merging and reset
- SQL session state setup and cleanup
- adapter lifecycle concerns such as close and recreation
- error copying into `QueryError`

The existing `reconfigure` implementations are effectively identical across both drivers, and the meaningful first-party use is in `rake-db` for create/drop flows that need to switch database or credentials.

`postgres-js` and `node-postgres` differ in one important lifecycle detail: `postgres-js` is not queryable after `close`, while `node-postgres` can be reused after `close`. That difference should be handled by the shared runtime instead of being left as driver-specific adapter behavior.

First-party tests and re-exports already depend on driver-specific adapter class names. The refactor should minimize driver-specific responsibilities without forcing a larger-than-needed rewrite of those entrypoints.

## Solution

Introduce shared generic runtime classes in `pqb`, `Adapter` and `TransactionAdapter`, and move common adapter behavior there. Driver-specific adapters become thin implementations behind interface ports that the shared runtime uses.

`AdapterConfigBase` becomes the real common config contract and includes:

- `databaseURL?`
- `database?`
- `user?`
- `password?`
- `searchPath?`
- existing shared options such as `connectRetry`

Each concrete adapter runtime instance stores:

- the original adapter-specific config
- the concrete adapter constructor so the runtime can create a fresh instance of the same adapter class
- a normalized common connection view derived from `databaseURL` and direct common config fields

The shared runtime owns:

- `query` and `arrays`
- root and transaction adapter behavior
- top-level and nested transaction orchestration
- locals and `search_path` handling
- SQL session state handling
- metadata getters
- connect retry
- `close`
- `assignError`
- `clone(params?)`

`clone(params?)` replaces both `reconfigure` and `updateConfig`.

- `clone()` with no params returns a fresh adapter instance with the same config
- `clone(params)` returns a fresh adapter instance with patched shared adapter config fields from `AdapterConfigBase`, including `databaseURL`, `database`, `user`, `password`, `searchPath`, and `connectRetry`
- `rake-db` uses `clone` instead of `reconfigure`
- the shared runtime can also use the same recreation path internally when it needs a fresh driver object after `close`

`AdapterBase` and `TransactionAdapterBase` remain in the design, but they change role: they become the interface ports for driver-specific adapters, and the shared `Adapter` / `TransactionAdapter` runtime relies on those ports.

Driver-specific code behind those ports is limited to:

- creating the underlying driver object
- closing the underlying driver object
- starting a real top-level transaction
- borrowing and releasing a concrete driver connection when needed
- executing object and array queries on a given session
- exposing `errorClass`
- declaring which error fields should be copied into `QueryError`
- declaring whether the driver remains queryable after `close`

The driver ports should expose these hooks as `borrowConnection` and `releaseConnection`.

- for `postgres-js`, this maps to `reserve`
- for `node-postgres`, this maps to `pool.connect`

`close` becomes runtime-managed:

- when a driver remains queryable after `close`, runtime only closes it
- when a driver does not remain queryable after `close`, runtime closes it and recreates the underlying driver object from the stored config

Driver entrypoints keep their current user-facing role:

- `createDb` ergonomics stay the same
- driver-specific config types stay the same except for inheriting the stronger common base contract
- driver-specific exported adapter classes may stay exposed and keep underlying handles such as `pool` or `sql`, but they should be thin wrappers around the shared runtime instead of each owning their own full adapter behavior

## References

- `packages/pqb/src/adapters/adapter.ts`
- `packages/pqb/src/adapters/adapter.utils.ts`
- `packages/pqb/src/adapters/node-postgres.ts`
- `packages/pqb/src/adapters/postgres-js.ts`
- `packages/pqb/src/adapters/features/sql-session-context.ts`
- `packages/rake-db/src/cli/database.cli.ts`
- `packages/rake-db/src/commands/create-or-drop.ts`
- `docs/src/guide/customize-db-adapter.md`
- `docs/src/guide/migration-programmatic-use.md`
