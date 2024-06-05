---
description: Row Level Security status, setup fundamentals, and Orchid-supported RLS-related features.
---

# Row Level Security

Orchid ORM supports declaring table Row Level Security (RLS) flags and policies on table classes, generating migrations from those declarations, and writing RLS migrations manually with `rake-db` methods.

## Table RLS declaration and defaults

Declare `rls` on a table with `defineRls`:

```ts
import { defineRls } from 'orchid-orm';
import { BaseTable, sql } from './base-table';

export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    tenantId: t.uuid(),
    archivedAt: t.timestamp().nullable(),
  }));

  rls = defineRls({
    enable: true,
    permit: [
      {
        name: 'project_select_same_tenant',
        for: 'SELECT',
        to: ['app_user', 'app_admin'],
        using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      },
    ],
    restrict: [
      {
        name: 'project_select_not_archived',
        for: 'SELECT',
        to: 'app_user',
        using: sql`archived_at IS NULL`,
      },
    ],
  });
}
```

Table flags:

- `enable`: enable row level security on the table.
- `force`: force row level security for the table owner as well.

When `force` is omitted in an Orchid table RLS declaration, Orchid treats it as `true`.
This is intentionally safer than PostgreSQL's table default, where table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is set.
Forcing owner checks makes tests, migration checks, and other owner-like connections less likely to pass while production app roles behave differently.

You can define project defaults with `orchidORM` `rls.tableRlsDefaults`:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    rls: {
      tableRlsDefaults: {
        enable: true,
      },
    },
  },
  {
    project: ProjectTable,
  },
);
```

Defaults are applied only to tables that have an explicit `rls = defineRls(...)` declaration.
Tables without an `rls` declaration are ignored by the RLS migration generator.

Set `force: false` when table-owner bypass behavior is intentional.
You can opt out on a single table:

```ts
rls = defineRls({
  enable: true,
  force: false,
  permit: [
    {
      name: 'project_select_same_tenant',
      for: 'SELECT',
      to: 'app_user',
      using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
  ],
});
```

Or make omitted table `force` values default to PostgreSQL's owner-bypass behavior for the project:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    rls: {
      tableRlsDefaults: {
        force: false,
      },
    },
  },
  {
    project: ProjectTable,
  },
);
```

## RLS policies

`permit` policies map to PostgreSQL `AS PERMISSIVE`, and `restrict` policies map to `AS RESTRICTIVE`.
`permit` is for policies that can allow access.
`restrict` can only further limit rows that were already allowed by applicable permissive policies.
`defineRls` requires `permit` with at least one policy, so omitting `permit`, passing an empty array, or declaring only `restrict` policies is a TypeScript error.
This guards against accidentally enabling RLS in a default-deny state where no policy can allow access.

```ts
export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    tenantId: t.uuid(),
    archivedAt: t.timestamp().nullable(),
  }));

  rls = defineRls({
    enable: true,
    force: true,
    permit: [
      {
        name: 'project_select_same_tenant',
        for: 'SELECT',
        to: ['app_user', 'app_admin'],
        using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      },
      {
        name: 'project_insert_same_tenant',
        for: 'INSERT',
        to: 'app_user',
        withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      },
    ],
    restrict: [
      {
        name: 'project_not_archived',
        for: 'UPDATE',
        to: 'app_user',
        using: sql`archived_at IS NULL`,
        withCheck: sql`archived_at IS NULL`,
      },
    ],
  });
}
```

Policy fields:

- `name`: policy name, scoped to the table.
- `for`: one of `'ALL'`, `'SELECT'`, `'INSERT'`, `'UPDATE'`, `'DELETE'`; when omitted, PostgreSQL uses `ALL`.
- `to`: one role or an array of roles. Define roles and grants separately.
- `using`: raw SQL expression for row visibility and existing-row checks.
- `withCheck`: raw SQL expression for inserted or updated rows.

Policy expression rules:

- `SELECT` and `DELETE` require `using` and do not accept `withCheck`.
- `INSERT` requires `withCheck` and does not accept `using`.
- `UPDATE`, `ALL`, and omitted `for` require both `using` and `withCheck`.

**At least one applicable `permit` policy is required to allow access.**
Without it, roles subject to RLS cannot access rows; superusers and roles with `BYPASSRLS` bypass this.
When RLS is enabled, PostgreSQL denies access unless at least one applicable permissive policy allows it.
A restrictive policy by itself does not allow access, even when the restrictive condition looks useful.
Define at least one applicable `permit` policy for every role and command that should be able to read or change rows.

Policy expressions are raw SQL.
Use `current_setting('name', true)` when a setting may be absent; the second argument makes PostgreSQL return `NULL` instead of throwing for a missing setting.

## Migration generation

When a table has an `rls` declaration, generated migrations compare the table RLS flags and policies with the database.
Run `db g` after changing RLS declarations to generate the corresponding migration.

Use `generatorIgnore.rls.tables` for tables whose RLS flags and policies are managed outside Orchid while ordinary table, column, and constraint diffs should still be generated.
Use `generatorIgnore.rls.policies` to ignore only specific policy names on a table.
See [generatorIgnore](/guide/generate-migrations#generatorignore) for examples.

## Manual policy migrations

Use `createPolicy`, `dropPolicy`, and `changePolicy` when writing RLS policies manually:

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createPolicy('project', 'project_select_same_tenant', {
    as: 'PERMISSIVE',
    for: 'SELECT',
    to: ['app_user', 'app_admin'],
    using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });

  await db.enableRls('project');
  await db.forceRls('project');
});
```

For the full manual migration API, including `dropPolicy` and `changePolicy`, see [migration writing](/guide/migration-writing#createpolicy-droppolicy-changepolicy).

## RLS intro

Row Level Security (RLS) is a PostgreSQL feature that filters which rows a role can read or modify.
Policies run in the database, so tenant and user isolation is enforced even if application code has a missing check.

RLS is usually a good fit for multi-tenant apps and security-sensitive data isolation, especially when many queries touch shared tables.
It can be excessive for simple single-tenant systems, or for apps where keeping authorization checks in application code is simpler to reason about and operate.

## How RLS works in practice

1. Create an application role used by requests.
   A separate role is not strictly required, but a separate non-owner role is strongly recommended:
   table owners bypass RLS by default, and superusers or roles with `BYPASSRLS` bypass it as well.
2. Grant required privileges to that role.
   RLS does not replace normal `GRANT` privileges, it adds row filtering on top.
   Prefer [default privileges](/guide/generate-migrations#default-privileges) so new objects stay consistent.
3. Enable RLS and define table policies.
   Once RLS is enabled, if no applicable permissive policy exists, PostgreSQL falls back to default deny.
4. Set per-request context (such as user id) in SQL session for every incoming request.
   Policies can read such values with `current_setting(...)`.
   This must be isolated per request so one user cannot accidentally reuse another user's session context.

Use transaction-scoped [`$transaction({ role, setConfig }, cb)`](/guide/transactions.html#sql-session-context-in-transactions) when several DB calls for one request should share the same transaction-local role and settings, such as one `tenantId`.
The caveat is that the request keeps a transaction open for all work inside the callback, with the usual long-running transaction trade-offs.
Use query-scoped [`$withOptions({ role, setConfig }, cb)`](/guide/orm-methods.html#role-and-setconfig-sql-session) when each DB call should remain independent.
The caveat is extra DB calls around each query to set the request context and then clear it, but no request-wide transaction is held open.

## RLS on many-to-many join tables

`hasAndBelongsToMany` is for simple many-to-many relations where the join table exists in the database but does not need its own table class in Orchid.
Because the relation defines that join table implicitly, it is not the right place to declare RLS flags or policies for the join table.

When the join table also needs RLS, define it as a regular table class with its own `rls = defineRls(...)` declaration.
Then model the many-to-many relation with `hasMany` and `through` so the join table stays explicit in application code and migration generation can manage its RLS state.

## Request-scoped RLS context

When a request's database work should be atomic, wrap that work in `$transaction` and pass the RLS role and settings in the transaction options:

```ts
async function runRequestDbWork<T>(
  tenantId: string,
  userId: string,
  cb: () => Promise<T>,
) {
  return db.$transaction(
    {
      role: 'app_user',
      setConfig: {
        'app.tenant_id': tenantId,
        'app.user_id': userId,
      },
    },
    cb,
  );
}

await runRequestDbWork(tenantId, userId, async () => {
  const projects = await db.project.all();
  await db.project.create({ name: 'Private project' });
  return projects;
});
```

Orchid applies this role and config with transaction-local Postgres semantics, so RLS policies can read the values with `current_setting('app.tenant_id', true)` and `current_setting('app.user_id', true)` for the whole transaction.
Keep the transaction around the database work only; avoid holding it open while waiting on remote services, user input, or streaming responses.

Transaction-scoped `role` and `setConfig` are an alternative to query-scoped `$withOptions`.
`$withOptions` applies and restores SQL session context around each query, and a transaction opened inside that callback inherits the same query-scoped context.
`$transaction({ role, setConfig }, cb)` applies the context once for the transaction, which is lower overhead when the request is intentionally transaction-bound.

Nested transactions may temporarily override the parent transaction role and config:

```ts
await db.$transaction(
  {
    role: 'app_user',
    setConfig: { 'app.tenant_id': tenantId },
  },
  async () => {
    await db.project.find(projectId);

    await db.$transaction(
      {
        role: 'project_admin',
        setConfig: { 'app.audit_reason': 'manual-review' },
      },
      async () => {
        await db.project.find(projectId).update({ reviewedAt: new Date() });
      },
    );

    // Back to app_user and the outer transaction config.
    await db.project.find(projectId);
  },
);
```

The nested role replaces the parent role only for the nested callback, and nested `setConfig` is shallow-merged over the parent config.
When the nested transaction finishes, Orchid restores the parent transaction context before the outer callback continues.

## RLS alternatives and trade-offs

### RLS

Pros: centralized enforcement in the database, harder to bypass by forgetting an app-side filter, applies consistently across different query paths.
Cons: extra setup for roles, grants, policies, and per-request SQL session context, and policy design/debugging can become subtle.

### App-side checks (`tenantId` in queries)

Keep tenant filtering in app logic by including `tenantId` in queries and validating permissions in code.
Orchid can help keep this consistent with [Scopes](/guide/scopes.html#scopes), and the tenant column can be marked as [readOnly](/guide/common-column-methods.html#readonly) while being set automatically with [setOnSave](/guide/common-column-methods.html#setonsave).

Pros: simplest operational model, no DB policy layer.
Cons: easier to miss a check in one code path, especially in larger codebases.

### Schema-based multi-tenancy

Use separate schemas per tenant.
Orchid supports dynamic schema selection at runtime (for example with ALS) via [global db schema](/guide/orm-setup.html#global-db-schema), and migrations support dynamic schema too via [migrations db schema](/guide/migration-setup-and-overview.html#migrations-db-schema).

Pros: strong isolation between tenants and simpler per-tenant backup/export flows.
Cons: tenant provisioning, lifecycle management, and invoking migrations per tenant are up to you.

### Multi-database multi-tenancy

This is not supported as a dedicated Orchid multi-tenancy feature.
It is possible in principle, but setup and operations are usually too cumbersome for most Orchid use cases.

Pros: strongest tenant isolation and simplest tenant-level backup/restore boundaries.
Cons: highest operational overhead for provisioning, routing, connections, and running migrations across tenants.

## Supported features for RLS

- Manage roles in migration generation: [roles](/guide/generate-migrations#roles)
- Manage default privileges in migration generation: [default privileges](/guide/generate-migrations#default-privileges)
- Declare table RLS flags and policies with `defineRls`, and generate migrations for them.
- Write manual table RLS and policy migrations with `rake-db` methods.
- Automatically set SQL session `role` and/or `setConfig` for a transaction with `$transaction`.
  See details and examples in [SQL session context in transactions](/guide/transactions.html#sql-session-context-in-transactions).
- Automatically set SQL session `role` and/or `setConfig` per query scope with `$withOptions`.
  See details and examples in [$withOptions role and setConfig](/guide/orm-methods.html#role-and-setconfig-sql-session).

## PostgreSQL RLS gotchas

- RLS does not replace ordinary privileges. Roles still need `GRANT` (to be supported) or [default privileges](/guide/generate-migrations.html#default-privileges) for table access.
- PostgreSQL lets table owners bypass RLS by default. Orchid treats omitted table declaration `force` as `true`; set `force: false` only when owner bypass is intentional.
- Superusers and roles with `BYPASSRLS` bypass RLS policies.
- By default, when a view reads an RLS table, PostgreSQL checks underlying table permissions and RLS policies as the view owner. In PostgreSQL 15 and newer, Orchid's `createView` uses `securityInvoker: true` by default so the caller's permissions and RLS policies are used instead; set `securityInvoker: false` only when owner-checked behavior is intentional.
- `TRUNCATE`, `REFERENCES`, and internal constraint checks are not governed by row policies in the same way as `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- Use `current_setting('app.some_setting', true)` in policies when missing request context should evaluate to `NULL` rather than fail the query.
