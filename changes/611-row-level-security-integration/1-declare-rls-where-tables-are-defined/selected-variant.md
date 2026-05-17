# Plain Table `rls` Object

## Goal

Give Orchid users a reliable, schema-owned way to declare Postgres row-level security (RLS) next to the tables it protects, so migration generation can keep `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and table policies synchronized with application code.

The design must primarily answer how users define policies in ORM table classes. It should also give `rake-db` a manual migration DSL that feels close to the table API, because generated migrations should be readable and users still need an escape hatch for hand-written migrations.

## Context from existing research

Postgres models RLS as two related but separate pieces: table-level RLS flags and table-specific policy objects. `ALTER TABLE` owns the enable/disable and force/no-force state, and Postgres explicitly allows policies to exist while RLS is disabled; when RLS is active and no applicable policy exists, default-deny applies ([Postgres ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html), [Postgres CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)). Policies have SQL-shaped fields: name, permissive/restrictive mode, command, target roles, `USING`, and `WITH CHECK`; multiple policies can apply to one table and combine according to Postgres rules ([Postgres row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)).

The policy API should stay close to Postgres because `ALTER POLICY` can only rename or alter roles/expressions; changing command or permissive/restrictive mode requires drop/recreate ([Postgres ALTER POLICY](https://www.postgresql.org/docs/current/sql-alterpolicy.html)). Raw SQL expressions are required because policies often depend on `current_setting(...)`, auth-provider helper functions, security-definer functions, subqueries, or explicit `true` predicates.

Orchid table definitions already put database behavior beside columns: table classes expose properties such as `table`, `schema`, `comment`, `softDelete`, `scopes`, `relations`, and `columns = this.setColumns(...)` with a second callback for table-level constraints. Local docs also emphasize raw SQL through `sql` exported from `BaseTable`, automatic migration generation from table code, `generatorIgnore` for externally managed objects, and manual migration methods such as `createTable`, `changeTable`, `addIndex`, and raw `db.query` (`docs/src/.vitepress/dist/llms.txt`, `docs/src/guide/define-tables.md`, `docs/src/guide/sql-expressions.md`, `docs/src/guide/generate-migrations.md`, `docs/src/guide/migration-writing.md`).

Existing ecosystem designs point in two useful directions. Drizzle attaches policies to `pgTable`, supports `pgPolicy`, raw SQL expressions, role objects, and provider-specific role ignore controls ([Drizzle RLS](https://orm.drizzle.team/docs/rls)). Atlas separates table `row_security` state from standalone `policy` blocks linked to a table, which makes the distinction between table flags and policy objects very explicit ([Atlas HCL RLS](https://atlasgo.io/atlas-schema/hcl), [Atlas security as code](https://atlasgo.io/guides/postgres/security-declarative)). Supabase keeps the user model SQL-first and stresses that RLS must be activated deliberately, roles/grants are separate, and policies are attached to tables ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).

## Solution

- Summary: Add a simple `rls = defineRls({ ... })` object property to table classes. It directly mirrors Postgres concepts: optional `enable` and `force` table flags, a required `permit` array for `AS PERMISSIVE` policies, and an optional `restrict` array for `AS RESTRICTIVE` policies. `permit` can be empty when a table intentionally relies on default-deny behavior. This keeps the API direct while using `defineRls` to enforce the TypeScript shape of object literals.
- User-facing interface: Users define an object beside `columns`, `relations`, and other table properties. Policy expressions use the existing `sql` helper exported from the app's `BaseTable`, and ORM exposes `defineRls` as an identity helper that takes the RLS config and returns it as-is. The helper has no runtime behavior beyond preserving the provided value, but it gives TypeScript a concrete target type for required keys, excess-property checks, command-specific policy shapes, and role arrays.
- How it works: `rls` is desired schema state for the table. `enable` and `force` are optional. Their global defaults are `enable: false` and `force: false`; the first argument to `orchidORM` can override those defaults with `rls.tableRlsDefaults`. These defaults apply when a table has an `rls` declaration and omits either flag. A table without an `rls` property does not implicitly get an RLS declaration from the defaults alone. `enable: true` generates `ENABLE ROW LEVEL SECURITY`; `enable: false` generates `DISABLE ROW LEVEL SECURITY` while preserving declared policies; `force: true` generates `FORCE ROW LEVEL SECURITY`; `force: false` generates `NO FORCE ROW LEVEL SECURITY`. Each policy object maps to one Postgres policy. Objects in `permit` generate `CREATE POLICY ... AS PERMISSIVE`; objects in `restrict` generate `CREATE POLICY ... AS RESTRICTIVE`. Omitted `for` and `to` use Postgres defaults: all commands and public. `to` accepts either one role or an array of roles. Invalid command/expression combinations are rejected where practical, such as `withCheck` on `SELECT` or `DELETE`, and `using` on `INSERT`. Removing a policy from the table declaration drops it unless the table or policy is ignored through an RLS-specific ignore option or existing `generatorIgnore`; moving a policy between `permit` and `restrict` requires drop/recreate because Postgres cannot alter policy mode in place.
- Workflow:
  - Define or edit the table's `rls = defineRls({ ... })` property.
  - Optionally configure `orchidORM({ rls: { tableRlsDefaults } }, tables)` when most RLS declarations should share the same omitted `enable` or `force` value.
  - Run migration generation.
  - Orchid diffs table flags and policies against the database.
  - Generated migrations create/alter/drop policies and enable/force RLS in safe order.
- Pros: Very easy to read, close to Postgres docs, easy to serialize for pull output, and easy for generated migrations to render. `defineRls` addresses the weakest part of plain object literals by giving TypeScript a clear config type to check. `permit` and `restrict` make policy mode visible at the table level without repeating `as` on every policy. The shape supports disabled-with-policies and active-without-policies without inventing extra concepts.
- Cons: This is still less guided than a command-helper builder, especially for users learning which commands allow `USING` and `WITH CHECK`. Policy arrays can become verbose on tables with many command/role combinations. Reusable policy patterns require user-defined helper functions rather than a first-class Orchid pattern.

#### Example use case

- A multi-tenant app wants policy state to be obvious in the same file as the table:

  ```ts
  import { BaseTable, sql } from './base-table';
  import { defineRls } from 'orchid-orm';

  export class ProjectTable extends BaseTable {
    table = 'project';

    columns = this.setColumns((t) => ({
      id: t.uuid().primaryKey(),
      tenantId: t.name('tenant_id').uuid(),
      name: t.text(),
    }));

    rls = defineRls({
      // optional
      enable: true,
      // optional
      force: true,
      // required
      permit: [
        {
          // required
          name: 'project_select_same_tenant',
          // optional, default 'ALL'
          for: 'SELECT',
          to: ['app_user', 'app_admin'],
          // required for SELECT, UPDATE, DELETE, should be omitted from TS type for INSERT as it makes no sense there
          using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        },
        {
          name: 'project_insert_same_tenant',
          for: 'INSERT',
          to: 'app_user',
          // withCheck is required for INSERT and UPDATE, and it makes no sense for SELECT and DELETE so the TS type shouldn't even allow it for them
          withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        },
        {
          name: 'project_update_same_tenant',
          for: 'UPDATE',
          to: 'app_user',
          using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
          withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        },
      ],
      // optional
      restrict: [
        {
          name: 'project_user_tenant_required',
          for: 'ALL',
          to: 'app_user',
          using: sql`tenant_id IS NOT NULL`,
          withCheck: sql`tenant_id IS NOT NULL`,
        },
      ],
    });
  }
  ```

  When using granular `for` the `using` and `withCheck` are required/optional/omitted from TS types based on comments above.
  When using `for: 'ALL'` then both `using` and `withCheck` are required.

  A project can override the omitted table-flag defaults in the first `orchidORM` argument:

  ```ts
  export const db = orchidORM(
    {
      databaseURL: process.env.DATABASE_URL,
      rls: {
        tableRlsDefaults: {
          enable: true,
          force: true,
        },
      },
    },
    {
      project: ProjectTable,
    },
  );
  ```

  The `rake-db` DSL would use standalone table-level methods with paired reverses for table flags:

  ```ts
  await db.enableRls('project');
  await db.disableRls('project');
  await db.forceRls('project');
  await db.noForceRls('project');
  ```

  Policy creation uses the same command-specific `using` and `withCheck` rules as the table config:

  ```ts
  await db.createPolicy('project', 'project_select_same_tenant', {
    // as is required
    as: 'permissive',
    for: 'SELECT',
    to: ['app_user', 'app_admin'],
    using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });
  // table can include schema
  await db.createPolicy('schema.project', 'project_user_tenant_required', {
    as: 'restrictive',
    for: 'ALL',
    to: 'app_user',
    using: db.sql`tenant_id IS NOT NULL`,
    withCheck: db.sql`tenant_id IS NOT NULL`,
  });
  ```

  `dropPolicy` requires the same policy definition fields as `createPolicy`, so the migration can be reverted by recreating the dropped policy:

  ```ts
  await db.dropPolicy('project', 'project_select_same_tenant', {
    as: 'permissive',
    for: 'SELECT',
    to: ['app_user', 'app_admin'],
    using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });
  ```

  `changePolicy` uses `table` and `name` as the first two arguments. Those values identify the current policy, so they do not belong in `from`. `to` may include `name` to rename the policy, and may include `table` when the policy must be recreated on another table. `to.name` by itself emits a rename and does not recreate the policy unless the same `to` object also has `table`, `as`, or `for`:

  ```ts
  await db.changePolicy('project', 'project_select_same_tenant', {
    to: {
      name: 'project_select_visible_tenant',
    },
  });
  ```

  Postgres `ALTER POLICY` supports renaming, changing `TO`, changing `USING`, and changing `WITH CHECK`. `changePolicy` should use direct `ALTER POLICY` for those cases. For alter-only changes, the TS type should keep `from` and `to` symmetric for `to`, `using`, and `withCheck`: if a supported key is present in `from`, the same key is required in `to`; if it is absent from `from`, it cannot be specified in `to`. `from` does not support `table` or `name` because the current table and policy name are already taken from the first and second `changePolicy` arguments.

  ```ts
  await db.changePolicy('project', 'project_select_same_tenant', {
    from: {
      to: ['app_user', 'app_admin'],
    },
    to: {
      to: ['app_user', 'app_admin', 'report_user'],
    },
  });

  await db.changePolicy('project', 'project_select_same_tenant', {
    from: {
      using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
    to: {
      using: db.sql`
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND archived_at IS NULL
      `,
    },
  });

  await db.changePolicy('project', 'project_update_same_tenant', {
    from: {
      withCheck: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
    to: {
      withCheck: db.sql`
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND archived_at IS NULL
      `,
    },
  });
  ```

  If `to` has any of `table`, `as`, or `for`, the change cannot be expressed as `ALTER POLICY`; `changePolicy` should recreate the policy. In that branch, TS must require `to` to have the same required fields as `createPolicy`. `from` must provide the old create-policy fields needed for rollback, except `table` and `name`, which are already the first two arguments:

  ```ts
  await db.changePolicy('project', 'project_select_same_tenant', {
    from: {
      as: 'permissive',
      for: 'SELECT',
      to: ['app_user', 'app_admin'],
      using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
    to: {
      table: 'archive.project',
      name: 'archive_project_select_same_tenant',
      as: 'permissive',
      for: 'SELECT',
      to: ['app_user', 'app_admin'],
      using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
  });
  ```

  All policy methods must follow the same required/optional/omit from TS type rules for `using` and `withCheck` as mentioned in the table config.

## References

- PostgreSQL row security policies: table ownership, owner bypass, multiple policies, and permissive/restrictive composition shape the required policy model. https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL `CREATE POLICY`: defines the exact user-visible fields Orchid must represent and the default-deny behavior when RLS is active without policies. https://www.postgresql.org/docs/current/sql-createpolicy.html
- PostgreSQL `ALTER POLICY`: limits what generated migrations can alter in place, which affects user expectations around renaming and changing policies. https://www.postgresql.org/docs/current/sql-alterpolicy.html
- PostgreSQL `ALTER TABLE`: separates enable/disable and force/no-force table flags from stored policies. https://www.postgresql.org/docs/current/sql-altertable.html
- Drizzle ORM RLS docs: precedent for table-attached policies, raw SQL policy expressions, role objects, and provider role ignore controls. https://orm.drizzle.team/docs/rls
- Atlas schema docs: precedent for modeling table row-security state separately from linked policy objects. https://atlasgo.io/atlas-schema/hcl
- Atlas security as code guide: shows desired-state diffing for roles, grants, tables, and policies together. https://atlasgo.io/guides/postgres/security-declarative
- Supabase RLS docs: reinforces explicit enablement, table-attached SQL policies, grants as a separate layer, and performance guidance around policy predicates. https://supabase.com/docs/guides/database/postgres/row-level-security
- Orchid local docs: `docs/src/.vitepress/dist/llms.txt`, `docs/src/guide/define-tables.md`, `docs/src/guide/base-table.md`, `docs/src/guide/sql-expressions.md`, `docs/src/guide/generate-migrations.md`, `docs/src/guide/migration-writing.md`, and `docs/src/guide/row-level-security.md` shaped naming and workflow expectations.

## Refinement

### Question 1: How should the plain object API get stronger TypeScript checking without becoming a builder?

#### Answer:

Expose `defineRls`. The table property should be written as `rls = defineRls({ ... })`; the helper takes the config and returns it as-is. This keeps the selected plain-object variant while giving TypeScript a concrete target type for required fields, excess-property checks, command-specific policy shapes, and role arrays.

### Question 2: How should permissive and restrictive policy modes be modeled?

#### Answer:

Use a required `permit` array for policies that generate `AS PERMISSIVE`, and an optional `restrict` array for policies that generate `AS RESTRICTIVE`. `permit` can be empty when a table intentionally relies on default-deny behavior. Do not use a single `policies` array with per-policy `as` values in table declarations. This makes the mode visible at the table level and keeps the common permissive case concise.

### Question 3: What should policy `to` accept?

#### Answer:

`to` should accept either one role or an array of roles. If omitted, Orchid should use Postgres's default target role behavior, which is public.

### Question 4: How should `enable` and `force` defaults work?

#### Answer:

Both flags are optional. The global defaults are `enable: false` and `force: false`. The first argument to `orchidORM` accepts an optional `rls` object with `tableRlsDefaults: { enable?: boolean; force?: boolean }` to override those defaults for table declarations that omit either flag. These defaults should not implicitly add an RLS declaration to tables that do not define `rls`.

### Question 5: How should `rake-db` model reversible RLS policy migrations?

#### Answer:

`enableRls` pairs with `disableRls`, and `forceRls` pairs with `noForceRls`. `createPolicy` and `dropPolicy` should use the same policy definition interface, including the same command-specific `using` and `withCheck` requirements, because `dropPolicy` needs enough information to reverse by recreating the dropped policy.

`changePolicy(table, name, { from, to })` should use direct `ALTER POLICY` for the changes Postgres supports: rename, `TO`, `USING`, and `WITH CHECK`. `table` and `name` are the first two arguments and must not be repeated in `from`; `to` can include `name` for rename and `table` for move-by-recreate. `to.name` alone is a rename-only change and must not recreate the policy. For alter-only changes, the TypeScript type should make `to` match the supported keys present in `from`: if `from` has `withCheck`, then `to.withCheck` is required; if `from` does not have `withCheck`, then `to.withCheck` is not allowed. The same symmetry applies to `to` roles and `using`. `from` does not support `table` or `name` because the current table and policy name come from the first two arguments.

If `to` includes `table`, `as`, or `for`, the operation must recreate the policy because Postgres cannot alter those fields in place. In that recreate branch, `to` must satisfy the same required field rules as `createPolicy`, while `from` carries the old create-policy fields needed for rollback except for table and name, which come from the first two arguments.
