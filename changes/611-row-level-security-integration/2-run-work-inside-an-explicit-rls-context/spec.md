## Summary

Extend `withOptions` and `$withOptions` so users can declare the Postgres `role` and `setConfig` values that their row-level-security policies depend on. Orchid should keep callback-scoped SQL session state in `AsyncLocalStorage` and apply it on the same connection that executes each query, including queries that run inside explicit transactions or savepoints.

```ts
await db.$withOptions(
  {
    role: 'app_user',
    setConfig: {
      'app.tenant_id': tenantId,
      'app.user_id': userId,
    },
  },
  async () => {
    const project = await db.project.find(projectId);

    await db.$transaction(async () => {
      await db.project.find(projectId).update({
        lastViewedAt: new Date(),
      });
    });

    return project;
  },
);
```

## What Changes

- Extend the existing `withOptions` and `$withOptions` option shapes so callbacks can declare `role` and `setConfig` alongside `log` and `schema`.
- Add a shared query-time SQL session mechanism for `withOptions` / `$withOptions` that reads ambient async state, applies the requested role and custom settings on the real query connection, runs the target work, and restores the prior session state before the execution window ends.
- Keep driver-specific connection handling internal to `pqb`, using the checked-out `PoolClient` in `node-postgres`, `reserve()` for non-transactional `postgres-js`, and the active transaction connection when a query runs inside either adapter's explicit transaction flow.
- Leave `transaction` and `$transaction` as-is. This idea only requires their existing execution paths to preserve `withOptions` / `$withOptions` SQL session behavior for queries that run inside them.
- Document value normalization, the nested `withOptions` SQL session restriction, behavior inside explicit transactions and savepoints, dotted custom setting names, and the caveat that manual raw SQL session changes are outside the feature contract.

## Assumptions

- Ambient SQL session state also applies to Orchid raw query helpers such as `$query`, `$queryArrays`, and the equivalent `pqb` raw-query paths because they share the same connection-selection layer as table queries and are likely to be mixed with ORM queries inside RLS-scoped work.
- This idea keeps `withOptions` and `$withOptions` as the documented entry point for callback-scoped SQL session state. Explicit transactions opened inside a `withOptions` scope still inherit the outer callback-scoped state because their queries execute on the transaction connection under the same ambient async context.

## Capabilities

- `sql-session-context`: Store normalized desired SQL session state in `AsyncLocalStorage` and reconcile it on the exact connection that runs each Orchid query.
- `transaction-aware-query-execution`: Reconcile query-scoped SQL session state on the active transaction connection when a query runs inside an explicit transaction or savepoint.
- `role`: Let callback-scoped work request a Postgres role switch through `withOptions` and `$withOptions`.
- `set-config`: Let callback-scoped work request custom Postgres settings through `withOptions` and `$withOptions`.

## Detailed Design

### Public API

`pqb` keeps the existing `withOptions` and `transaction` methods, and `orm` keeps the existing `$withOptions` and `$transaction` methods. This idea only extends the option shapes for `withOptions` and `$withOptions`; it does not add an `rls` wrapper object and it does not introduce a scoped DB handle that must be passed through application code.

```ts
interface StorageOptions {
  log?: boolean;
  schema?: QuerySchema;
  role?: string;
  setConfig?: Record<string, string | number | boolean>;
}
```

- `role` and `setConfig` may be provided together or independently on `withOptions` / `$withOptions`.
- On `withOptions` / `$withOptions`, `role` and `setConfig` are callback-scoped query session options. Orchid reconciles them for each query execution window.
- `setConfig` accepts only `string`, `number`, and `boolean` values. Orchid normalizes `number` and `boolean` values to strings before storing or comparing them.
- Existing `log` and `schema` behavior stays unchanged and may be combined with `role` and `setConfig` in the same call.
- If the current async scope already has an active query-scoped `role` or `setConfig`, another `withOptions` or `$withOptions` call that supplies either SQL session field must reject instead of overriding or merging the outer query-scoped SQL session state.
- Nested callback scopes that only change `log` or `schema` continue to work and inherit the outer SQL session context.
- Existing `transaction` and `$transaction` signatures stay unchanged in this idea.

### Ambient SQL Session State

`AsyncLocalStorage` keeps the query-scoped SQL session target as part of Orchid's existing async state used for transactions, logging, and schema overrides.

```ts
interface SqlSessionState {
  role?: string;
  setConfig?: Record<string, string>;
}
```

- `setConfig` values are normalized to strings before they enter async state so both adapters work from the same canonical shape.
- `SqlSessionState` remains the query-scoped SQL session target used by `withOptions` / `$withOptions` and read by query execution.
- The async state does not represent a dedicated connection outside transactions. When a callback only changes `log` or `schema`, Orchid does not create a separate empty SQL session object; the SQL session parts of async state remain absent.
- When a query runs inside an explicit transaction or nested savepoint, Orchid must reconcile the same query-scoped state against the transaction's current connection rather than opening a separate connection.

### Query Execution Contract

Query execution becomes responsible for reconciling the ambient query-scoped SQL session state with the concrete adapter or transaction adapter chosen for the query.

- Orchid must resolve the active adapter first, then run SQL session setup, the target SQL, and cleanup on that same connection as one execution window.
- The setup step must capture the previous active role and the previous state of each requested config key, including whether a key was unset, before it applies the requested session state.
- Custom settings must be applied with parameterized `set_config` calls rather than interpolated `SET ...` statements so user values stay parameterized.
- Cleanup must run in `finally` and restore the previous role and previous setting state before Orchid considers that execution window complete.
- This contract applies to direct reads and writes, relation follow-up queries, hook-triggered queries, raw query helpers, batched SQL executed for one awaited Orchid query, and queries that run inside explicit transactions or savepoint-backed flows.
- Outside a user transaction, Orchid keeps the current callback model: it does not reserve one connection for the whole callback, only for the duration of each query execution window that needs SQL session state.
- Inside a user transaction, Orchid uses the current transaction connection and repeats the same setup/query/cleanup cycle on that connection for the query-scoped state from `withOptions` / `$withOptions`.
- Nested transactions do not create a second query-scoped SQL session object and do not introduce a separate transaction-scoped SQL session mode in this idea.

### node-postgres

`node-postgres` should use the same `PoolClient` that already executes the target query.

- Outside explicit transactions, Orchid checks out a `PoolClient`, performs SQL session setup, runs the target work, restores the previous session state, and then releases the client.
- Inside explicit transactions, Orchid uses the transaction's `PoolClient` for the same per-query setup/query/cleanup sequence whenever query-scoped `withOptions` / `$withOptions` state is active.
- The SQL session wrapper must compose with the adapter's existing per-client concerns such as search-path switching and savepoint handling instead of bypassing them with a separate execution path.

### postgres-js

`postgres-js` keeps the same public API but needs a different same-connection strategy outside transactions.

- Outside explicit transactions, Orchid reserves one connection with `sql.reserve()` for the query execution window, then runs setup, target SQL, and cleanup as separate awaited steps on that reserved connection before releasing it.
- Inside explicit transactions, Orchid uses the transaction's current connection for the same per-query setup/query/cleanup sequence whenever query-scoped `withOptions` / `$withOptions` state is active.
- Orchid must not pipeline setup and target SQL together. A failed setup step must prevent the target query from being sent.

### Error Handling and Limits

- Attempting to start a nested query-scoped SQL session by supplying `role` or `setConfig` to `withOptions` / `$withOptions` while an outer query-scoped SQL session is active rejects immediately.
- If SQL session setup fails, Orchid must surface that database error and skip the target query.
- Cleanup failures are part of the same operation and must not be silently ignored.
- `setConfig` does not support `null`; omitting a key is the only supported way to avoid setting it in this idea.
- Orchid does not add runtime validation for role names or config keys beyond the TypeScript surface. Invalid server-side values fail with normal Postgres errors.
- Manual raw SQL inside the callback that changes role or session settings, such as direct `SET ROLE`, `RESET ROLE`, or `set_config(...)`, is outside the feature contract and may invalidate Orchid's internal view of session state.

### Documentation

The user-facing docs and JSDoc for `$withOptions` should explain that `role` and `setConfig` are query-scoped SQL session options, including when those queries execute inside explicit transactions or nested savepoints. The docs should call out dotted custom setting names such as `app.tenant_id`, recommend `current_setting(name, true)` for policy code that treats missing values deliberately, and note that both supported adapters share the same public API even though their connection handling differs internally.
