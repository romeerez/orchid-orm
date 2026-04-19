---
description: Row Level Security status, setup fundamentals, and Orchid-supported RLS-related features.
---

# Row Level Security

RLS support in Orchid ORM is currently work in progress.
You can already set up everything needed for RLS yourself with raw SQL in migrations, and Orchid provides some supporting features listed below.

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
3. Enable RLS and define table policies in SQL migrations.
   Once RLS is enabled, if no applicable policy exists, PostgreSQL falls back to default deny.
4. Set per-request context (such as user id) in SQL session for every incoming request.
   Policies can read such values with `current_setting(...)`.
   This must be isolated per request so one user cannot accidentally reuse another user's session context.

Use [$withOptions role/setConfig](/guide/orm-methods.html#role-and-setconfig-sql-session) to apply session settings safely around query execution.

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
- Automatically set SQL session `role` and/or `setConfig` per scope with `$withOptions`.
  See details and examples in [$withOptions role and setConfig](/guide/orm-methods.html#role-and-setconfig-sql-session).
