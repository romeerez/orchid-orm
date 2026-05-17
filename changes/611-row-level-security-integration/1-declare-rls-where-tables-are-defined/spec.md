## Summary

Add table-attached Postgres row-level-security declarations to Orchid, with migration generation support for table RLS flags and policies. Users declare desired RLS state in ORM table classes with `defineRls`, can set default table flag values in `orchidORM`, and can use readable `rake-db` migration methods when writing migrations manually.

```ts
import { defineRls } from 'orchid-orm';
import { BaseTable, sql } from './base-table';

export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey(),
    tenantId: t.name('tenant_id').uuid(),
    name: t.text(),
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
        for: 'ALL',
        to: 'app_user',
        using: sql`archived_at IS NULL`,
        withCheck: sql`archived_at IS NULL`,
      },
    ],
  });
}
```

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    // optional
    rls: {
      // optional
      tableRlsDefaults: {
        // optional
        enable: true,
        // optional
        force: true,
      },
    },
  },
  {
    project: ProjectTable,
  },
);
```

```ts
change(async (db) => {
  await db.createPolicy('project', 'project_select_same_tenant', {
    as: 'permissive',
    for: 'SELECT',
    to: ['app_user', 'app_admin'],
    using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });

  await db.enableRls('project');
  await db.forceRls('project');
});
```

## What Changes

- Add an ORM table `rls = defineRls(...)` declaration for desired table RLS state.
- Add `orchidORM({ rls: { tableRlsDefaults } }, tables)` so omitted `enable` and `force` flags can default per project without implicitly opting every table into RLS.
- Add optional `introspectDbSchema(adapter, { rls: true })` support for table RLS flags and, after policy support, table policies.
- Add `rake-db` migration DSL, AST, SQL generation, migration-code rendering, and pull support for RLS table flags and policies.
- Add ORM migration generation that compares declared table RLS state to the database only when code tables declare RLS.
- Add RLS-specific generator ignore controls for externally managed table RLS state or named policies.
- Document RLS table flags, policies, defaults, default-deny behavior, and the boundary between policies and roles/grants.

## Assumptions

- The ORM migration generator manages RLS only for code tables that declare an `rls` property. A table without `rls` is not changed by RLS diffing even when another table causes RLS introspection to run.
- To intentionally disable RLS or remove policies from a managed table, users keep an explicit `rls` declaration and set `enable: false`, `force: false`, and empty policy arrays as needed.

## Capabilities

- `rls-schema-introspection`: Optionally load table RLS flags and policy metadata from Postgres into `DbStructure`.
- `rls-table-state`: Represent, migrate, diff, and document table-level `enable` and `force` RLS flags.
- `rls-policy`: Represent, migrate, diff, and document Postgres row security policies attached to tables.

## Detailed Design

### Public API

`orm` exports `defineRls` and public RLS config types from `orchid-orm`. `defineRls` is an identity helper: it preserves the object users provide while giving TypeScript a concrete target for excess-property checks, required policy fields, and command-specific expression rules.

```ts
interface RlsConfig {
  enable?: boolean;
  force?: boolean;
  permit: RlsPermitPolicy[];
  restrict?: RlsRestrictPolicy[];
}

interface OrchidOrmRlsOptions {
  rls?: {
    tableRlsDefaults?: {
      enable?: boolean;
      force?: boolean;
    };
  };
}

interface GeneratorIgnore {
  rls?: {
    tables?: string[];
    policies?: {
      table: string;
      names: string[];
    }[];
  };
}
```

- `enable: true` means `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- `enable: false` means `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`.
- `force: true` means `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.
- `force: false` means `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY`.
- `orchidORM` stores the provided `rls` option on the underlying `db.internal` structure for later migration-generator use. If users omit the `rls` option, that internal value remains `undefined`.
- `tableRlsDefaults` applies only when a table has an `rls` declaration and omits either flag.
- A table without an `rls` property is outside ORM RLS management and does not receive defaults.

### RLS Policy Shape

Policies are grouped by mode at the table level. `permit` is required and maps to Postgres `AS PERMISSIVE`. `restrict` is optional and maps to `AS RESTRICTIVE`.

```ts
type RlsPolicyCommand = 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

interface RlsPolicyBase {
  name: string;
  for?: RlsPolicyCommand;
  to?: string | string[];
}
```

- Policy names are SQL identifiers scoped to one table and are preserved exactly.
- `for` is optional and defaults to Postgres `ALL`; only uppercase command values are accepted.
- `to` accepts one role or an array of roles. When omitted, Orchid relies on Postgres's default target of `PUBLIC`.
- Policy expressions are raw SQL values, normally from `sql` exported by the app's `BaseTable`.
- `SELECT` and `DELETE` policies require `using` and do not allow `withCheck`.
- `INSERT` policies require `withCheck` and do not allow `using`.
- `UPDATE`, explicit `ALL`, and omitted `for` policies require both `using` and `withCheck`, even though Postgres can reuse `USING` in some omitted `WITH CHECK` cases.
- TypeScript should reject unsupported command/expression combinations where practical. Runtime validation should not duplicate TypeScript-only guarantees.

### rake-db Table Flags

`rake-db` adds standalone methods for reversible table RLS flag changes:

```ts
await db.enableRls('project');
await db.disableRls('project');
await db.forceRls('project');
await db.noForceRls('project');
```

- `enableRls` reverses to `disableRls`.
- `forceRls` reverses to `noForceRls`.
- Table names accept the same optional `schema.table` form as other table-level migration methods.
- Table RLS flags are represented as separate AST items rather than as column or constraint changes.
- Generated migration code should use these methods instead of raw SQL.

### rake-db Policies

`rake-db` adds policy methods that use the same policy command and expression rules as ORM table declarations.

```ts
await db.createPolicy('project', 'project_select_same_tenant', {
  as: 'permissive',
  for: 'SELECT',
  to: ['app_user', 'app_admin'],
  using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
});

await db.dropPolicy('project', 'project_select_same_tenant', {
  as: 'permissive',
  for: 'SELECT',
  to: ['app_user', 'app_admin'],
  using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
});

await db.changePolicy('project', 'project_select_same_tenant', {
  from: {
    to: ['app_user', 'app_admin'],
  },
  to: {
    to: ['app_user', 'app_admin', 'report_user'],
  },
});
```

- `createPolicy` requires `as: 'permissive' | 'restrictive'`.
- `dropPolicy` receives the same policy definition shape as `createPolicy` so rollback can recreate the dropped policy.
- `changePolicy(table, name, { from, to })` uses direct `ALTER POLICY` for supported Postgres changes: rename, target roles, `USING`, and `WITH CHECK`.
- `table` and `name` identify the current policy and are not repeated in `from`.
- `to.name` by itself is a rename and must not recreate the policy.
- For alter-only changes, supported keys present in `from` must be present in `to`, and supported keys absent from `from` must not appear in `to`. `from` does not support `table` or `name` because the current table and policy name are already taken from the first and second `changePolicy` arguments.
- If `to` includes `table`, `as`, or `for`, the operation recreates the policy because Postgres cannot alter those fields in place. In that branch, `to` must satisfy the same required fields as `createPolicy`, and `from` must carry the old create-policy fields needed for rollback except table and name.

### Introspection and Pull

`introspectDbSchema` accepts `rls?: boolean` in its params.

```ts
const structure = await introspectDbSchema(adapter, { rls: true });
```

- When `rls` is omitted or false, the introspection query does not load table RLS flags or policies, and `DbStructure.Table.rls` remains absent.
- When `rls` is true, every table includes `rls: { enable: boolean; force: boolean }`.
- Policy support expands that shape with `policies`, loaded from `pg_policy` with expression text from `pg_get_expr`.
- Policy introspection preserves schema name, table name, policy name, permissive/restrictive mode, command, target roles, `USING`, and `WITH CHECK`.
- `rake-db` pull and structure-to-AST conversion should include RLS AST only when RLS introspection is requested by that workflow.

### ORM Migration Generation

The ORM generator discovers RLS participation from code tables.

- Before introspection, the generator iterates code tables and checks whether any table has an `rls` declaration. Only then does it pass `rls: true` to `introspectDbSchema`.
- A table with `rls` is normalized by applying `tableRlsDefaults` to omitted `enable` and `force`; omitted project defaults fall back to `enable: false` and `force: false`.
- The generator compares normalized table flags only for code tables with `rls`.
- Policy diffing is also limited to code tables with `rls`.
- Existing `generatorIgnore.tables` continues to ignore a whole table, including RLS.
- `generatorIgnore.rls.tables` ignores table RLS flags and policies for the listed tables without disabling ordinary table diffing.
- `generatorIgnore.rls.policies` ignores only the listed policy names for a table; table names use the same schema-qualified string format as other table ignore settings, and policy names are matched exactly.
- New tables with policies should generate create table, create policies, enable RLS, and then force RLS.
- Enabling RLS on an existing table should generate desired policy changes first, then enable RLS, then force RLS.
- Disabling RLS and removing policies should disable RLS before dropping policies.
- Changing policy roles or expressions should use `changePolicy` when possible.
- Changing policy command or mode should recreate the policy.

### Error Handling and Limits

- Orchid does not create roles or grants for policy `to` values. Missing roles or privileges fail with normal Postgres errors or must be managed by existing roles/default-privileges features.
- RLS policy expressions may depend on functions, settings, schemas, or tables that Orchid does not model. Those dependencies must already exist or be created earlier in migrations.
- Owners, superusers, and roles with `BYPASSRLS` may bypass policies even when policies exist; `force` affects table owners but not superusers or `BYPASSRLS`.
- `TRUNCATE`, `REFERENCES`, internal constraint checks, and some view behavior remain Postgres RLS limits and are not abstracted by Orchid.
- Orchid should avoid runtime validation for inputs that TypeScript can already reject, but database errors should surface clearly when Postgres rejects DDL.

### Documentation

The docs should present table flags before policies, explain `tableRlsDefaults`, and warn that enabling RLS without an applicable permissive policy creates default-deny behavior. Policy docs must explicitly say that a useful restrictive policy still requires at least one applicable `permit` policy; otherwise Postgres denies access even if restrictive policies are present. The docs should also keep roles/grants separate from policies and show raw SQL policy expressions using `current_setting(..., true)`.
