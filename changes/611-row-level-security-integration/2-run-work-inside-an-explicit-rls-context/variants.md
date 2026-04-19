# Run work inside an explicit RLS context

## Goal

Give users one explicit way to run request-scoped work with the role and session settings their Postgres RLS policies depend on, without forcing them to pass a special DB instance through application code and without reducing application concurrency by pinning one pool connection for the full request.

## Context from existing research

Postgres RLS often depends on request-local state such as tenant or user identifiers read through `current_setting(...)`, plus the active SQL role ([PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [PostgreSQL configuration functions](https://www.postgresql.org/docs/current/functions-admin.html), [PostgreSQL `SET ROLE`](https://www.postgresql.org/docs/current/sql-set-role.html)). Orchid already has an ambient request-scope mechanism in `AsyncLocalStorage`: transactions, `$withOptions`, and query execution all read state from ALS and apply it when queries are executed ([transactions guide](docs/src/guide/transactions.md), [ORM methods](docs/src/guide/orm-methods.md), [storage implementation](../../../packages/pqb/src/query/basic-features/storage/storage.ts), [query execution](../../../packages/pqb/src/query/then/then.ts)).

That makes a query-time RLS design a natural fit for Orchid. Instead of reserving a connection for the whole callback, Orchid can store desired RLS state in ALS and apply the needed `SET ROLE` and custom session settings immediately before a query runs. This avoids reducing concurrency to the pool size for request handling.

The trade-off is driver behavior. `node-postgres` exposes a checked-out `PoolClient` for each query path and Orchid already stores custom metadata on that client, so Orchid can cache which RLS state is currently applied on each connection ([node-postgres adapter](../../../packages/pqb/src/adapters/node-postgres.ts)). `postgres-js` is less straightforward: its README says there are no guarantees about query execution order unless using `sql.begin()` or `max: 1`, so the exact way to force `SET ...` and the real query to run in the required order and on the required connection must be researched against the driver implementation before Orchid commits to a concrete internal strategy there ([postgres-js README](https://github.com/porsager/postgres#the-connection-pool)).

Connection-pinning variants were explored and rejected for this idea because they either require passing a scoped instance around or can make application concurrency depend directly on pool size. Nested RLS overrides were also rejected for v1 because they add internal complexity without a strong practical use case.

## Solution 1: ALS-backed query-time RLS state in `$withOptions`

- Summary: Extend `db.$withOptions` with an `rls` option so users declare RLS context once for a callback, while Orchid stores that desired state in `AsyncLocalStorage` and applies it just in time when each query executes.
- User-facing interface: Users call `db.$withOptions({ rls: { role, settings } }, async () => { ... })` and use ordinary `db.*` queries inside the callback. No special scoped instance needs to be threaded through services.
- How it works: Entering `$withOptions({ rls })` records the desired role and settings in ALS. On query execution, Orchid reads the desired RLS state from ALS and ensures the live database connection is configured correctly before running the real SQL. For `node-postgres`, Orchid can compare the desired state with metadata cached on the checked-out client and only send the missing `SET ROLE` or session-setting changes before the query. For `postgres-js`, Orchid must use the same public API but leave the internal strategy open until its implementation is examined carefully enough to prove how query ordering and connection affinity can be controlled without reserving a connection. If `rls` is already active, entering another RLS scope should throw instead of trying to override and restore nested state.
- Workflow:
  - Wrap a request-scoped operation in `db.$withOptions({ rls: ... }, async () => { ... })`.
  - Run ordinary reads, writes, relation queries, and hooks inside the callback.
  - Let Orchid apply the required session state just before each query instead of holding one reserved connection for the whole callback.
- Pros: Keeps the API small by reusing `$withOptions`, avoids passing a special DB handle through application code, avoids making request concurrency depend on pool size, and matches Orchid’s existing ALS-based design style.
- Cons: Driver internals diverge, `postgres-js` needs explicit follow-up research before its internal strategy can be specified, and Orchid will not try to defend against users deliberately issuing raw SQL that changes role or session settings.

#### Example use case

- A web request sets tenant and role once, then application code continues to use ordinary ORM queries:

```ts
await db.$withOptions(
  {
    rls: {
      role: 'app_user',
      settings: {
        'app.tenant_id': tenantId,
        'app.user_id': userId,
      },
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
- [Transactions guide](docs/src/guide/transactions.md): Shows Orchid’s existing ALS-backed ambient query scope.
- [ORM methods](docs/src/guide/orm-methods.md): Shows `$withOptions`, which is the natural public API surface for request-local RLS state.
- [Storage implementation](../../../packages/pqb/src/query/basic-features/storage/storage.ts): Shows how Orchid currently stores callback-scoped options in ALS.
- [Query execution](../../../packages/pqb/src/query/then/then.ts): Shows that ALS state is read at query execution time.
- [node-postgres adapter](../../../packages/pqb/src/adapters/node-postgres.ts): Relevant because Orchid can attach per-connection applied-state metadata to `PoolClient`.
- [postgres-js README](https://github.com/porsager/postgres#the-connection-pool): Important because it documents that query order is not guaranteed unless using `sql.begin()` or `max: 1`, so the postgres-js strategy needs explicit investigation.
