## Summary

Extend `transaction` and `$transaction` so users can set a Postgres role and custom settings once for the lifetime of a transaction. The transaction-scoped session context must be applied by the shared adapter transaction flow, tracked in the transaction `AsyncLocalStorage` state, and restored correctly across nested savepoint-backed transactions.

```ts
await db.$transaction(
  {
    role: 'app_user',
    setConfig: {
      'app.tenant_id': tenantId,
      'app.user_id': userId,
    },
  },
  async () => {
    const project = await db.project.find(projectId);

    await db.$transaction(
      {
        role: 'project_admin',
        setConfig: { 'app.audit_reason': 'manual-review' },
      },
      async () => {
        await db.project.find(projectId).update({ reviewedAt: new Date() });
      },
    );

    return project;
  },
);
```

## What Changes

- Add `role` and `setConfig` to the public `transaction` / `$transaction` option object, alongside existing transaction options such as `level`, `readOnly`, `deferrable`, `log`, and `schema`.
- Pass the normalized transaction session options through the query transaction method to `adapter.transaction`.
- Add adapter-level transaction session handling that applies `role` and `setConfig` with transaction-local Postgres semantics for top-level transactions and nested savepoints.
- Rename the adapter's existing `locals` setting map to `setConfig`. It serves the same purpose as transaction `setConfig`, including existing values such as `search_path`.
- Track the effective transaction role and effective `setConfig` map in the transaction `AsyncLocalStorage` state so nested transactions can restore from Orchid's known parent state instead of querying the database for previous values.
- Keep query-scoped `withOptions` / `$withOptions` SQL session behavior separate from transaction-scoped session behavior.

## Capabilities

- `transaction-session-context`: Track and apply transaction-scoped SQL session state across real transactions and savepoint-backed nested transactions.
- `transaction-role`: Let transaction callbacks run under a transaction-local Postgres role.
- `transaction-set-config`: Let transaction callbacks run with transaction-local custom Postgres settings through the same adapter `setConfig` mechanism used for `SET LOCAL` values such as `search_path`.

## Detailed Design

### Public API

`pqb` adds `role` and `setConfig` to `QueryTransaction.transaction` options by reusing the existing SQL-session option interface that already defines those fields. `orm` exposes the same shape through `$transaction` because it delegates to `pqb`.

```ts
interface TransactionOptions extends SqlSessionState {
  log?: boolean;
  schema?: QuerySchema;
  level?: IsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
}
```

- `role` and `setConfig` may be provided together or independently.
- `SqlSessionState` itself stays unchanged; this is type reuse only for the public option shape.
- `setConfig` values are normalized before they are merged into adapter transaction-local settings.
- The isolation-level string overload stays unchanged and does not accept session options.
- `$ensureTransaction` stays unchanged; it does not gain an options overload in this idea.
- Invalid role names, missing role privileges, invalid config keys, and server-side setting restrictions fail with normal Postgres errors.

### Transaction Session Context

The transaction session context feature owns the transaction-specific hierarchy. It must use the transaction `AsyncLocalStorage` store, but it must not make transaction role/config look like query-scoped `$withOptions` state.

- Existing `role` and `setConfig` on `SqlSessionState` remain the reusable option shape for SQL session context.
- `transaction` / `$transaction` interpret those option fields as transaction-scoped when they appear in transaction options.
- The normalized transaction context is stored separately from query-scoped `AsyncState.role` / `AsyncState.setConfig`, so ordinary queries inside the transaction do not run the per-query `$withOptions` setup/cleanup path.
- A top-level transaction initializes the transaction session context for its callback scope. The context stores the effective transaction role, when any, and the effective `setConfig` map made from adapter base `setConfig` plus the transaction's `setConfig`.
- A nested transaction computes a child transaction session context from the parent ALS context. Provided `role` and `setConfig` values override the parent context for the nested callback only.
- A nested transaction that does not receive `role` or `setConfig` does not change the transaction session context. Deeper nested transactions therefore see the nearest outer transaction-scoped values.
- When a nested transaction finishes, Orchid restores the parent ALS transaction context before control returns to the outer callback.
- When the top-level transaction finishes, its transaction session context is no longer visible.

### Adapter Transaction Lifecycle

The shared adapter transaction flow owns transaction-scoped role/config SQL. This logic should live in `packages/pqb/src/adapters/features/transaction-session-context.ts`, with `adapter.ts` delegating to it at transaction lifecycle boundaries.

- Top-level transactions apply transaction session context after `BEGIN` and before the user callback runs.
- Role is applied with transaction-local Postgres role semantics, equivalent to `SET LOCAL ROLE`.
- Config values from transaction `setConfig` are normalized into the adapter `setConfig` structure and applied by the same `SET LOCAL` SQL path as existing transaction-local settings.
- Existing adapter `locals` terminology should be renamed to `setConfig` across adapter config, transaction options, helper names, tests, and implementation fields. This keeps search-path changes and RLS custom settings on the same nesting and restore path.
- The effective `setConfig` map stored in ALS is the source of truth for nested restore calculations. Nested transaction restore must not depend on querying `current_setting` to discover the parent value.
- The setup SQL must run on the same connection as the transaction callback.
- No explicit SQL restore is needed when the top-level transaction commits or rolls back because Postgres transaction-local settings end with the transaction.
- Adapter transaction options carry the normalized transaction `role` directly, while transaction `setConfig` is represented through adapter `setConfig`. This feature does not wrap either option in the existing query-scoped setup/cleanup flow.

### Nested Transaction Lifecycle

Nested transactions are savepoint-backed and need explicit transaction session handling around the savepoint boundary.

- If a nested transaction has no transaction session options and no new `setConfig`, it only inherits the current transaction session context and does not run additional role/config SQL.
- If a nested transaction has transaction session options or new `setConfig`, the adapter creates the savepoint first, applies the nested role and provided config overrides immediately after the savepoint, updates the transaction session context for the callback, and runs the callback under that context.
- On success, the adapter restores the previous role and config from the parent ALS transaction context, then releases the savepoint so the continuing outer transaction observes the parent context.
- On rollback to savepoint, Postgres cancels transaction-local `SET` / `SET LOCAL` effects that happened after that savepoint, so the adapter does not need a separate SQL restore for those nested changes. It must still restore the transaction session context before control returns to the outer transaction.
- Restoring a previous role means setting the previous transaction role when it exists, or resetting to the transaction's original role when no previous transaction role exists.
- Restoring config means restoring previous transaction-local values for keys that existed before the nested transaction and resetting keys that were introduced only by the nested transaction. This applies equally to `search_path` and entries that came from transaction `setConfig`.
- The adapter `setConfig` helpers must handle nesting explicitly: the merged config map defines what the nested callback sees, and restore SQL must not emit invalid values such as `undefined` for keys that were absent in the parent config map.
- Deeper nesting follows the same rule recursively: each nested transaction restores to the effective transaction context it observed before applying its own options.

### Boundary With Query-Scoped SQL Session Context

Transaction-scoped `role` and `setConfig` must not be implemented by changing or extending the query-scoped `withOptions` / `$withOptions` setup/cleanup logic.

- `withOptions` / `$withOptions` remains query-scoped and continues to reconcile its own `role` / `setConfig` around individual query execution windows.
- `transaction` / `$transaction` establishes a transaction-scoped baseline that is applied once for a top-level transaction or around savepoint boundaries for nested transactions.
- The two features reuse the same `SqlSessionState` option interface, but use distinct behavior and distinct adapter feature code.
- Transaction `setConfig` relies on adapter transaction `setConfig`; query-scoped `setConfig` does not.
- This idea does not change the existing nested-scope restrictions of `withOptions` / `$withOptions`.

### Error Handling and Limits

- If transaction session setup fails, the transaction fails and the user callback does not run.
- If nested transaction session setup fails after the savepoint is created, the adapter rolls back to that savepoint and surfaces the database error.
- If restoring the outer transaction session after a successful nested transaction fails, the transaction should fail rather than continue under an unknown role/config state.
- `setConfig` does not accept `null` at the TypeScript API. Use omitted keys to avoid setting a value.
- Manual raw SQL that changes role or settings inside the transaction is outside Orchid's transaction session tracking contract and may make later restores reflect Orchid's tracked state rather than the user's manual changes.

### Documentation

Docs and JSDoc should show `$transaction({ role, setConfig }, cb)` as the lower-overhead alternative to per-query `$withOptions` for request-scoped RLS work that is intentionally transaction-bound. They should explain that nested transactions can override transaction role/config temporarily, rollback to savepoint restores Postgres-local changes automatically, and successful nested transactions restore the outer transaction context before the outer callback continues.
