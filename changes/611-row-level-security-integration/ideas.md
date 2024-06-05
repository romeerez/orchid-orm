# Row Level Security Integration

## Must haves

### 1. Declare RLS where tables are defined

- Why: Users need a reliable way to opt tables into row-level security and keep policy changes in sync with schema changes instead of scattering raw SQL they can forget.
- Adds: A Postgres-specific table-level declaration for enabling RLS, optionally forcing owner checks, and defining multiple policies by command and role.
- How:
  - Add an `rls` block next to a table definition so RLS participation is visible in the same place as columns and other table behavior.
  - Let generated migrations enable, disable, or force RLS and create, alter, rename, or drop policies from that declaration.
  - Keep raw SQL available for policy expressions that need full Postgres flexibility.
- Depends on: None.

**Use cases**:

- A multi-tenant `project` table declares both read and write policies in one place, and migration generation keeps the database aligned when those rules change later.

### 2. Run work inside an explicit per-query RLS context

- Why: Policies often depend on request-local tenant, user, JWT, or role values, and pooled connections make manual `SET LOCAL` usage easy to misuse.
- Adds: A safe wrapper for reads, writes, relation queries, and hooks that all need the same role and settings for one request-scoped operation, without requiring a long-running transaction.
- How:
  - Expose an explicit helper such as `$withOptions` that stores role and custom settings in async local storage for the current application flow.
  - Apply that role and settings around each individual query, restoring the previous values afterward so context does not leak across pooled connections.
  - Keep the call site explicit so users can see when code depends on RLS context instead of looking like an ordinary query.
  - Accept the trade-off that this adds extra queries per database operation, in exchange for avoiding one transaction per request and reducing pressure on the connection pool.
- Depends on: None.

**Use cases**:

- A web request sets `app.tenant_id` and `app_user` once with `$withOptions`, then runs nested reads and writes that each apply the same context on a per-query basis without holding a transaction open for the whole request.

### 3. Run work inside a transaction-level RLS context

- Why: Some applications want to set role and config once at the start of a request, keep that context stable for all database work in the request, and avoid the overhead of reapplying it for every individual query.
- Adds: A transaction-scoped RLS mode where all reads, writes, relation queries, and hooks run inside one transaction with the proper role and settings already applied.
- How:
  - Let users begin a transaction at the start of a request and configure one role plus custom settings for the lifetime of that transaction.
  - Keep all app code in that request running through the transaction so every query sees the same RLS context automatically.
  - Commit or roll back when the request finishes, making the transaction boundary the same boundary for RLS context.
- Depends on: None.

**Use cases**:

- A web request starts a transaction, sets `app.tenant_id` and `app_user` once, runs all nested reads and writes through that transaction, and commits when the request completes.

### 4. Keep RLS security boundaries visible

- Why: RLS can look complete while still failing in practice if grants are missing, no policy exists yet, or tests run as roles that bypass policies.
- Adds: An RLS workflow users can reason about without false confidence about what the database is enforcing.
- How:
  - Make "enabled but default-deny" and `force` states deliberate parts of the RLS setup instead of hidden side effects.
  - Keep roles and grants in the story so users do not mistake policies for a full permission system.
  - Call out when owner, superuser, or `BYPASSRLS` connections behave differently from production app roles.
- Depends on: None.

**Use cases**:

- A team enables RLS on a table before adding policies and can clearly see that this creates an intentional default-deny state rather than a broken migration.
- A test suite using an owner connection is warned that passing queries may still fail for the real application role unless `FORCE ROW LEVEL SECURITY` is part of the setup.

## Valuables

### 5. Support many-to-many relations without insecure gaps

- Why: Implicit join tables are a recurring weak spot for tenant isolation, because the link table must obey the same row-level rules as the records it connects.
- Adds: A clear path for relation helpers in RLS-heavy applications instead of forcing users to discover unsafe defaults after adoption.
- How:
  - Let join tables participate in the same RLS declaration flow as ordinary tables, or
  - require an explicit through-table model when Orchid cannot guarantee safe implicit behavior.
- Depends on: Declare RLS where tables are defined, Run work inside an explicit per-query RLS context.

**Use cases**:

- A `project_users` join table follows the same tenant rules as `project` and `user`, or Orchid requires the application to model that join table explicitly instead of creating an insecure implicit table.

### 6. Default manually created views to security invoker

- Why: Views over RLS-managed tables are usually expected to use the caller's permissions and RLS policies, but PostgreSQL's ordinary view behavior checks the underlying tables as the view owner unless `security_invoker` is enabled.
- Adds: A safer default for the existing `rake-db` `createView` option, plus docs that explain the default and the explicit opt-out.
- How:
  - Treat omitted `with.securityInvoker` as `true` when manual migrations create views with `createView`.
  - Keep `with.securityInvoker: false` as the opt-out for migrations that intentionally want PostgreSQL's owner-checked view behavior.
  - Document that `securityInvoker: true` is Orchid's default for manual view creation because it is safer around RLS-managed tables.
  - Do not add generated-migration support for views; ORM generated migrations do not currently support view declarations from application code.
- Depends on: Declare RLS where tables are defined.
