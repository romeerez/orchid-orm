# Row Level Security Integration

## Purpose and goals

Issue [#611](https://github.com/romeerez/orchid-orm/issues/611) is asking for first-class help with Postgres row-level security (RLS) in Orchid ORM.

The underlying user goal is not just "support `CREATE POLICY` SQL". It is to make database-enforced tenant or user isolation practical in day-to-day Orchid usage:

- define which tables participate in RLS without relying on manual remembrance,
- express read and write policy rules in application-owned schema definitions or migrations,
- make request-scoped runtime context such as `tenant_id`, `user_id`, JWT claims, or active role reliably available to policies,
- keep the feature clearly Postgres-specific and optional.

## Valuable external context

Postgres RLS is table-level and opt-in. A table has no row-security behavior until `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is applied. Once enabled, normal reads and writes must satisfy at least one applicable policy; if no policy exists, Postgres falls back to default deny. RLS does not replace SQL privileges: users still need normal `GRANT` access first. `TRUNCATE` and `REFERENCES` are explicitly outside RLS.

Policies are defined per table and can target commands (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, or `ALL`) and roles. `USING` controls which existing rows are visible or targetable; `WITH CHECK` controls whether inserted or updated rows are allowed. If `WITH CHECK` is omitted for `ALL` or `UPDATE`, Postgres reuses the `USING` expression. Multiple permissive policies combine with `OR`, while restrictive policies combine with `AND`.

Some important Postgres behaviors materially affect ORM design. Table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is enabled, and superusers or roles with `BYPASSRLS` always bypass it. Policy expressions run for each row before user query predicates, except for leakproof-function optimizations. `WITH CHECK` is enforced after `BEFORE ROW` triggers but before other constraints, so trigger-based value mutation and RLS checks interact.

Runtime context is a separate problem from policy DDL. Many RLS setups depend on request-specific settings read through `current_setting(...)`, helper functions such as `auth.uid()`, or active roles. Postgres exposes `current_setting(name, missing_ok)` and `set_config(name, value, is_local)` for this. If `missing_ok` is not used, reading an unset custom setting raises an error. `SET LOCAL` and transaction-local `set_config(..., true)` only last for the current transaction; outside a transaction, `SET LOCAL` warns and has no effect. In practice, safe request-local RLS context usually means either wrapping work in a transaction or reserving a single connection for the whole request lifecycle.

RLS also has operational edge cases beyond plain table queries. Postgres does not apply policies during internal referential-integrity checks or other constraint validation, which means uniqueness and foreign-key behavior can still leak the existence of hidden rows. Views are another trap: common platform guidance notes that views often bypass underlying RLS unless they are created with security-invoker behavior on supported Postgres versions or otherwise locked down.

Drizzle is the clearest example of a mature TypeScript ORM exposing RLS as a schema feature. Its docs model roles and policies as first-class schema objects (`pgRole`, `pgPolicy`), allow policies to be attached to tables or linked to existing tables, and include migration controls for provider-owned roles. Drizzle also documents a transaction wrapper pattern for runtime RLS context, using `set_config(...)` and `SET LOCAL ROLE` before running queries.

Supabase's RLS guidance adds two useful product lessons. First, forgetting to enable RLS on new tables is common enough that they document an event-trigger approach to auto-enable it. Second, policy ergonomics and performance matter: they recommend scoping policies to roles with `TO`, indexing policy columns, avoiding unnecessary joins inside policy expressions, and handling unauthenticated cases explicitly because helper functions such as `auth.uid()` may return `NULL`.

## Community ideas and pain points

The issue thread shows a few recurring pain points:

- users want centralized, database-level access rules because relying on `.where({ userId })` everywhere is easy to forget;
- relation helpers and implicit join tables are a weak spot, because user-managed tenant columns are harder to thread through automatically generated relation writes;
- runtime context must be applied safely per request, without letting tenant or user settings leak across pooled connections;
- migration ergonomics matter as much as query ergonomics, because forgetting to enable RLS or create/update policies makes the feature unreliable;
- multi-schema tenancy is often evaluated as an alternative, but the issue discussion repeatedly comes back to RLS as the long-term direction.

## Requirements and edge cases

- The feature must be explicitly Postgres-only. Orchid packages support only Postgres, but the user-facing API should still make the database dependency obvious.
- It is not enough to expose raw `CREATE POLICY` snippets. A complete RLS story needs both schema or migration support and runtime context support.
- Any integrated design should account for the fact that grants/roles and policies are separate layers. A policy alone does not let a role query a table.
- Enabling RLS without policies creates default deny. That is correct but surprising, so Orchid should make this state deliberate and visible.
- Owners, superusers, and `BYPASSRLS` roles can bypass policies. This means migration/test connections may not behave like production app roles unless users opt into stricter behavior such as `FORCE ROW LEVEL SECURITY`.
- Policy expressions may depend on request-local GUC values. Safe ergonomics require transaction or reserved-connection semantics; otherwise context can leak between pooled requests.
- Policy expressions should support both read (`USING`) and write (`WITH CHECK`) rules. Update paths need special care because Postgres checks `WITH CHECK` after `BEFORE` triggers.
- Policy composition matters. Orchid should not assume "one table, one policy"; Postgres supports multiple permissive and restrictive policies with different commands and roles.
- Views need explicit treatment. If Orchid supports view definitions around RLS-managed tables, the design should warn about or expose security-invoker behavior where appropriate.
- Hidden-row leakage through unique constraints and foreign keys is a real limitation of Postgres RLS and should be documented rather than abstracted away.
- Performance-sensitive users will need guidance around indexing policy columns, role scoping, and avoiding expensive joins in policy predicates.
- The issue discussion specifically raises "forgetting" concerns for new tables and relation join tables. Any design that requires manual duplication for every new table will feel incomplete.

## Existing support in orchid-orm

Native RLS integration does not exist today. I did not find any public API or migration helper for `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, `CREATE POLICY`, `ALTER POLICY`, or `DROP POLICY` in docs, code, or tests. There is also no existing change folder for RLS work before this research document.

What Orchid does already have is a useful set of adjacent primitives:

- **Manual SQL escape hatch in migrations.** Migration docs explicitly support raw SQL via `db.query`, so users can already hand-write `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and policy SQL.
- **Roles and default privileges are first-class.** `orchidORM` config supports `roles`, including `bypassRls`, and generated migrations can sync roles and default privileges. This is relevant because RLS depends on role and privilege setup, even though Orchid does not yet manage policies themselves.
- **Programmatic migrations already exist.** `migrate`, `rollback`, `redo`, `createMigrationsSchemaAndTable`, and related APIs are documented and transaction-aware. They also support `transactionSearchPath`, which is useful for the multi-schema alternative discussed in the issue.
- **Dynamic schema switching exists as a separate path.** Global `schema: () => ...` is documented to run for every query and sub-query, which is the current multi-schema building block. By contrast, `withSchema` is documented as a single-query table prefix tool, and existing tests only verify direct query usage.
- **Application-layer tenant enforcement exists.** Default scopes can apply mandatory `where` filters to all queries, but they only support `where` conditions and are not database-enforced security. Hooks, `readOnly`, and `setOnCreate`/`setOnSave` support can populate tenant columns from `AsyncLocalStorage`.
- **Transaction and adapter primitives exist.** Orchid already uses `AsyncLocalStorage` for transactions, exposes `$transaction`, `$ensureTransaction`, and `$isInTransaction`, and supports `orchidORMWithAdapter` for custom adapter behavior. This is enough for advanced users to build their own request-local `SET LOCAL` or reserved-connection wrapper, but not as a polished public RLS feature.
- **Views already expose one RLS-related knob.** Migration docs support `createView(..., { with: { securityInvoker: true }})`, which is relevant because view behavior is a known RLS edge case.

The current project state is therefore **partial only in supporting infrastructure**: Orchid has some of the surrounding pieces needed for RLS, but the actual RLS feature is absent.

This implies the design should build on existing primitives instead of fighting them:

- keep multi-schema support and RLS support as separate features,
- keep scopes/hooks as application-layer ergonomics, not as a synonym for RLS,
- reuse existing roles/default-privileges work rather than inventing a second security model,
- add an explicit runtime helper for request-local policy context instead of pushing users toward unsupported adapter monkey-patching.

## Proposed user-facing design

The cleanest Orchid-facing design is a two-part feature: **database declarations** and **runtime policy context**.

For database declarations, RLS should live close to table definitions and migrations, not as scattered raw SQL. A table-level declaration is the most natural fit for Orchid's existing API shape:

```ts
export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey(),
    tenantId: t.uuid().readOnly(),
    name: t.text(),
  }));

  readonly rls = {
    enable: true,
    force: true,
    policies: [
      {
        name: 'project_select_same_tenant',
        for: 'select',
        to: 'app_user',
        using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      },
      {
        name: 'project_modify_same_tenant',
        for: ['insert', 'update', 'delete'],
        to: 'app_user',
        using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      },
    ],
  };
}
```

This should generate the user-visible migration behavior people expect:

- enable or disable RLS when the table declaration changes,
- optionally force RLS for owner-tested safety,
- create, alter, rename, and drop policies alongside other schema changes,
- keep raw SQL escape hatches for advanced policy expressions.

For runtime behavior, Orchid should offer an explicit callback-based helper that guarantees one connection scope for the whole operation, for example:

```ts
await db.$withRls(
  {
    role: 'app_user',
    settings: {
      'app.tenant_id': tenantId,
    },
  },
  async (tx) => {
    return tx.project.find(projectId);
  },
);
```

The exact name can vary, but the behavior matters more than the spelling:

- it must scope role and custom settings to one safe request-local connection context,
- it should compose naturally with existing `$transaction` behavior,
- it should be obvious from the API that this is different from a plain query,
- it should work for reads, writes, nested relation queries, and hooks triggered within the same operation.

Automatic relation join tables need deliberate handling. If Orchid keeps supporting implicit join tables, users need a way to make those tables participate in RLS too. If that cannot be done cleanly, Orchid should require an explicit through-table model for RLS-sensitive many-to-many relations instead of silently producing insecure defaults.

The design should also stay honest about feature boundaries:

- default scopes remain an app-layer convenience, not a security boundary;
- existing roles and default privileges stay relevant, because policies do not replace grants;
- if Orchid still lacks direct grant-management APIs for existing objects, the first RLS release should document that clearly instead of pretending policies are sufficient;
- view support should document when `securityInvoker` is needed around RLS-managed tables.

In short, the user-facing design should feel like: **declare policies with the table, run queries inside an explicit RLS context, keep grants/roles visible, and do not rely on hidden magic for pooled-connection safety.**

## References

- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://www.postgresql.org/docs/current/sql-createpolicy.html
- https://www.postgresql.org/docs/current/sql-set.html
- https://www.postgresql.org/docs/current/functions-admin.html
- https://orm.drizzle.team/docs/rls
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://github.com/romeerez/orchid-orm/issues/611
- docs/src/.vitepress/dist/llms.txt
- docs/src/guide/scopes.md
- docs/src/guide/hooks.md
- docs/src/guide/transactions.md
- docs/src/guide/customize-db-adapter.md
- docs/src/guide/generate-migrations.md
- docs/src/guide/migration-programmatic-use.md
- docs/src/guide/migration-writing.md
- docs/src/guide/orm-setup.md
- docs/src/guide/advanced-queries.md
