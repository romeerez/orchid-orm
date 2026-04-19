# ALS-backed query-time RLS state in `$withOptions`

## Goal

Give users one explicit way to run request-scoped work with the role and session settings their Postgres RLS policies depend on, without forcing them to pass a special DB instance through application code and without reducing application concurrency by pinning one pool connection for the full request.

## Context from existing research

Postgres RLS often depends on request-local state such as tenant or user identifiers read through `current_setting(...)`, plus the active SQL role ([PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [PostgreSQL configuration functions](https://www.postgresql.org/docs/current/functions-admin.html), [PostgreSQL `SET ROLE`](https://www.postgresql.org/docs/current/sql-set-role.html)). Orchid already has an ambient request-scope mechanism in `AsyncLocalStorage`: transactions, `$withOptions`, and query execution all read state from ALS and apply it when queries are executed ([transactions guide](docs/src/guide/transactions.md), [ORM methods](docs/src/guide/orm-methods.md), [storage implementation](../../../packages/pqb/src/query/basic-features/storage/storage.ts), [query execution](../../../packages/pqb/src/query/then/then.ts)).

That makes a query-time RLS design a natural fit for Orchid. Instead of reserving a connection for the whole callback, Orchid can store desired RLS state in ALS and apply the needed `SET ROLE` and custom session settings immediately before a query runs. This avoids reducing concurrency to the pool size for request handling.

The trade-off is driver behavior. `node-postgres` exposes a checked-out `PoolClient` for each query path and Orchid already stores custom metadata on that client, so Orchid can cache which RLS state is currently applied on each connection ([node-postgres adapter](../../../packages/pqb/src/adapters/node-postgres.ts)). `postgres-js` has a different connection model, so Orchid needs a separate internal same-connection strategy there while keeping the public API identical. The current conclusion is that `postgres-js` can achieve the required safety by reserving one connection per affected query, but not by pipelining the setup and target query together.

For session settings, the practical SQL primitive is `set_config(name, value, is_local)`. It is a better fit than interpolated `SET ...` statements because the values can be parameterized safely. PostgreSQL custom setting names should also use dotted names such as `app.tenant_id`; this does not change Orchid’s API shape, but it should be called out in user-facing docs later.

Connection-pinning variants were explored and rejected for this idea because they either require passing a scoped instance around or can make application concurrency depend directly on pool size. Nested RLS overrides were also rejected for v1 because they add internal complexity without a strong practical use case.

## Solution

- Summary: Extend `db.$withOptions` so users declare RLS-related role and session settings directly for a callback, while Orchid stores that desired state in `AsyncLocalStorage` and applies it just in time when each query executes.
- User-facing interface: Users call `db.$withOptions({ role, setConfig }, async () => { ... })` and use ordinary `db.*` queries inside the callback. No special scoped instance needs to be threaded through services.
- How it works: Entering `$withOptions({ role, setConfig })` records the desired role and settings in ALS. On query execution, Orchid reads that desired state from ALS and ensures the live database connection is configured correctly before running the real SQL. For `node-postgres`, Orchid can compare the desired state with metadata cached on the checked-out client and only send the missing `SET ROLE` or `set_config` changes before the query. For `postgres-js`, Orchid should `reserve()` one connection for the duration of that query execution, run a pre-query step on that reserved connection that captures the previous role and previous setting values while applying the requested ones, execute the target query, restore the previous role and previous settings in `finally`, and then release the connection. Orchid should not pipeline setup and the target query with `Promise.all`, because a failed setup query does not reliably prevent the later query from executing. `setConfig` corresponds to PostgreSQL `set_config(name, value, is_local)`: keys are strings, Orchid should accept string, number, and boolean values and cast them on the JavaScript side before sending them, and it should not accept `null`. If role or settings are already active in ALS, entering another scope should throw instead of trying to override nested state.
- Workflow:
  - Wrap a request-scoped operation in `db.$withOptions({ role, setConfig }, async () => { ... })`.
  - Run ordinary reads, writes, relation queries, and hooks inside the callback.
  - Let Orchid apply the required session state just before each query instead of holding one reserved connection for the whole callback.
- Pros: Keeps the API small by reusing `$withOptions`, matches PostgreSQL’s actual primitives (`SET ROLE` and `set_config`) instead of wrapping them in an extra `rls` object, avoids passing a special DB handle through application code, avoids making request concurrency depend on pool size, and matches Orchid’s existing ALS-based design style.
- Cons: Driver internals diverge, `postgres-js` needs a separate internal same-connection strategy and an additional setup/query round trip, and Orchid will not try to defend against users deliberately issuing raw SQL that changes role or session settings.

#### Example use case

- A web request sets tenant and role once, then application code continues to use ordinary ORM queries:

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

    await db.project.find(projectId).update({
      lastViewedAt: new Date(),
    });

    return project;
  },
);
```

## References

- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html): Grounds the overall RLS model and the fact that policies depend on the current role and session state.
- [PostgreSQL configuration functions](https://www.postgresql.org/docs/current/functions-admin.html): Defines `current_setting` and `set_config`, which are the basis for policy-driven request settings.
- [PostgreSQL `SET ROLE`](https://www.postgresql.org/docs/current/sql-set-role.html): Relevant to switching the active SQL role for policy evaluation.
- [PostgreSQL customized options](https://www.postgresql.org/docs/current/runtime-config-custom.html): Relevant because custom settings used by RLS should use dotted names such as `app.tenant_id`.
- [Transactions guide](docs/src/guide/transactions.md): Shows Orchid’s existing ALS-backed ambient query scope.
- [ORM methods](docs/src/guide/orm-methods.md): Shows `$withOptions`, which is the natural public API surface for request-local RLS state.
- [Storage implementation](../../../packages/pqb/src/query/basic-features/storage/storage.ts): Shows how Orchid currently stores callback-scoped options in ALS.
- [Query execution](../../../packages/pqb/src/query/then/then.ts): Shows that ALS state is read at query execution time.
- [node-postgres adapter](../../../packages/pqb/src/adapters/node-postgres.ts): Relevant because Orchid can attach per-connection applied-state metadata to `PoolClient`.
- [postgres-js README](https://github.com/porsager/postgres#the-connection-pool): Important because it documents pool behavior and connection-reservation APIs that constrain the `postgres-js` strategy.
- [Pipelining reproduction](./research-postgres-pipelining.js): Local repro showing that a failed first pipelined query did not prevent the later insert from persisting on a reserved `postgres-js` connection.

## Refinement

### 1. Should v1 support both adapters?

#### Answer:

Yes. `node-postgres` and `postgres-js` are both in scope for v1. The public API stays adapter-agnostic, and their implementation differences stay internal to Orchid.

### 2. How should `postgres-js` safely apply per-query RLS state on a single connection?

#### Answer:

Use `sql.reserve()` to isolate one connection for the query, then run setup, the target query, and cleanup as separate awaited queries on that same reserved connection before releasing it. This achieves the required same-connection behavior, but it does not preserve the attempted pipeline optimization.

The pipeline variant was investigated and rejected. In a local reproduction using `reserve()` plus `Promise.all`, the first query intentionally failed and the later insert still persisted, so a failed setup query does not reliably block a later query that was already pipelined on that connection. Because of that, `postgres-js` must treat the RLS setup query and the target query as separate awaited steps.

See also [research-postgres-pipelining.js](./research-postgres-pipelining.js) for the concrete reproduction used to confirm that behavior.

### 3. Should `$withOptions` use an `rls` object, or expose the Postgres primitives directly?

#### Answer:

Expose the Postgres primitives directly and do not add an `rls` wrapper object. `$withOptions` should accept:

- `role?: string`
- `setConfig?: Record<string, string | number | boolean>`

This keeps the API aligned with the SQL concepts users already need to understand for RLS. `role` maps to `SET ROLE`, and `setConfig` maps to PostgreSQL `set_config`. The `setConfig` name also makes the parameterization requirement explicit: Orchid should prefer `set_config` over dynamic `SET ...` SQL because `set_config` supports parameterized values.

When `role` is used, Orchid should capture the current role in the same pre-query round trip that applies the requested role so it can restore the prior value in `finally` if it was different. When `setConfig` is used, Orchid should capture the previous value of each key in that same pre-query round trip before changing it and restore those values in `finally` as well. That same restore flow applies in both adapters even though the underlying connection handling differs.
