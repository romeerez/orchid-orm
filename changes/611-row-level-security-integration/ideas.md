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

### 2. Run work inside an explicit RLS context

- Why: Policies often depend on request-local tenant, user, JWT, or role values, and pooled connections make manual `SET LOCAL` usage easy to misuse.
- Adds: A safe wrapper for reads, writes, relation queries, and hooks that all need the same role and settings for one request-scoped operation.
- How:
  - Expose a callback-style helper that applies one role plus custom settings for a single safe operation scope.
  - Make it compose with existing transaction APIs so request-local context does not leak across pooled connections.
  - Make the call site explicit so users can see when code depends on RLS context instead of looking like an ordinary query.
- Depends on: None.

**Use cases**:

- A web request sets `app.tenant_id` and `app_user` once, then runs nested reads and writes inside one callback so every policy sees the same context without leaking it into the next request.

### 3. Keep RLS security boundaries visible

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

### 4. Support many-to-many relations without insecure gaps

- Why: Implicit join tables are a recurring weak spot for tenant isolation, because the link table must obey the same row-level rules as the records it connects.
- Adds: A clear path for relation helpers in RLS-heavy applications instead of forcing users to discover unsafe defaults after adoption.
- How:
  - Let join tables participate in the same RLS declaration flow as ordinary tables, or
  - require an explicit through-table model when Orchid cannot guarantee safe implicit behavior.
- Depends on: Declare RLS where tables are defined, Run work inside an explicit RLS context.

**Use cases**:

- A `project_users` join table follows the same tenant rules as `project` and `user`, or Orchid requires the application to model that join table explicitly instead of creating an insecure implicit table.

### 5. Explain the Postgres edge cases Orchid will not hide

- Why: Views, uniqueness checks, foreign keys, and expensive policy predicates can still surprise users even with first-class ORM support.
- Adds: Guidance users can apply when policies look correct but behavior, security expectations, or performance still go wrong.
- How:
  - Explain when `securityInvoker` matters for views built on top of RLS-managed tables.
  - Warn that hidden rows can still leak through unique and foreign-key checks.
  - Show the practical guardrails: index policy columns, scope policies to roles, and handle missing auth context explicitly.
- Depends on: Declare RLS where tables are defined.
