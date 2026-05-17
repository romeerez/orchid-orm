# Declare RLS Where Tables Are Defined

## Goal

Give Orchid users a reliable, schema-owned way to declare Postgres row-level security (RLS) next to the tables it protects, so migration generation can keep `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and table policies synchronized with application code.

The design must primarily answer how users define policies in ORM table classes. It should also give `rake-db` a manual migration DSL that feels close to the table API, because generated migrations should be readable and users still need an escape hatch for hand-written migrations.

## Context from existing research

Postgres models RLS as two related but separate pieces: table-level RLS flags and table-specific policy objects. `ALTER TABLE` owns the enabled/disabled and force/no-force state, and Postgres explicitly allows policies to exist while RLS is disabled; when RLS is enabled and no applicable policy exists, default-deny applies ([Postgres ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html), [Postgres CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)). Policies have SQL-shaped fields: name, permissive/restrictive mode, command, target roles, `USING`, and `WITH CHECK`; multiple policies can apply to one table and combine according to Postgres rules ([Postgres row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)).

The policy API should stay close to Postgres because `ALTER POLICY` can only rename or alter roles/expressions; changing command or permissive/restrictive mode requires drop/recreate ([Postgres ALTER POLICY](https://www.postgresql.org/docs/current/sql-alterpolicy.html)). Raw SQL expressions are required because policies often depend on `current_setting(...)`, auth-provider helper functions, security-definer functions, subqueries, or explicit `true` predicates.

Orchid table definitions already put database behavior beside columns: table classes expose properties such as `table`, `schema`, `comment`, `softDelete`, `scopes`, `relations`, and `columns = this.setColumns(...)` with a second callback for table-level constraints. Local docs also emphasize raw SQL through `sql` exported from `BaseTable`, automatic migration generation from table code, `generatorIgnore` for externally managed objects, and manual migration methods such as `createTable`, `changeTable`, `addIndex`, and raw `db.query` (`docs/src/.vitepress/dist/llms.txt`, `docs/src/guide/define-tables.md`, `docs/src/guide/sql-expressions.md`, `docs/src/guide/generate-migrations.md`, `docs/src/guide/migration-writing.md`).

Existing ecosystem designs point in two useful directions. Drizzle attaches policies to `pgTable`, supports `pgPolicy`, raw SQL expressions, role objects, and provider-specific role ignore controls ([Drizzle RLS](https://orm.drizzle.team/docs/rls)). Atlas separates table `row_security` state from standalone `policy` blocks linked to a table, which makes the distinction between table flags and policy objects very explicit ([Atlas HCL RLS](https://atlasgo.io/atlas-schema/hcl), [Atlas security as code](https://atlasgo.io/guides/postgres/security-declarative)). Supabase keeps the user model SQL-first and stresses that RLS must be enabled deliberately, roles/grants are separate, and policies are attached to tables ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).

## Solution 1: Plain Table `rls` Object

- Summary: Add a simple `readonly rls` object property to table classes. It directly mirrors Postgres concepts: `enabled`, `force`, and a `policies` array of objects with `name`, `as`, `for`, `to`, `using`, and `withCheck`. This is the most direct and least magical API.
- User-facing interface: Users define an object beside `columns`, `relations`, and other table properties. Policy expressions use the existing `sql` helper exported from the app's `BaseTable`.
- How it works: `rls` is desired schema state for the table. `enabled: true` generates `ENABLE ROW LEVEL SECURITY`; `enabled: false` generates `DISABLE ROW LEVEL SECURITY` while preserving declared policies; `force: true` generates `FORCE ROW LEVEL SECURITY`; `force: false` generates `NO FORCE ROW LEVEL SECURITY`. Each policy object maps to one Postgres policy. Omitted `as`, `for`, and `to` use Postgres defaults: permissive, all commands, and public. Invalid command/expression combinations are rejected where practical, such as `withCheck` on `select` or `delete`, and `using` on `insert`. Removing a policy from the table declaration drops it unless the table or policy is ignored through an RLS-specific ignore option or existing `generatorIgnore`.
- Workflow:
  - Define or edit the table's `rls` property.
  - Run migration generation.
  - Orchid diffs table flags and policies against the database.
  - Generated migrations create/alter/drop policies and enable/force RLS in safe order.
- Pros: Very easy to read, close to Postgres docs, easy to serialize for pull output, and easy for generated migrations to render. It supports disabled-with-policies and enabled-without-policies without inventing extra concepts.
- Cons: Object literals do not guide users strongly through command-specific rules. Policy arrays can become verbose on tables with many command/role combinations. Reusable policy patterns require user-defined helper functions rather than a first-class Orchid pattern.

#### Example use case

- A multi-tenant app wants policy state to be obvious in the same file as the table:

  ```ts
  import { BaseTable, sql } from './base-table';

  export class ProjectTable extends BaseTable {
    readonly table = 'project';

    columns = this.setColumns((t) => ({
      id: t.uuid().primaryKey(),
      tenantId: t.name('tenant_id').uuid(),
      name: t.text(),
    }));

    readonly rls = {
      enabled: true,
      force: true,
      policies: [
        {
          name: 'project_select_same_tenant',
          for: 'select',
          to: 'app_user',
          using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        },
        {
          name: 'project_insert_same_tenant',
          for: 'insert',
          to: 'app_user',
          withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        },
        {
          name: 'project_update_same_tenant',
          for: 'update',
          to: 'app_user',
          using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
          withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        },
      ],
    };
  }
  ```

  The closest `rake-db` DSL would use standalone table-level methods:

  ```ts
  await db.createPolicy('project', 'project_select_same_tenant', {
    for: 'select',
    to: 'app_user',
    using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });
  await db.enableRls('project');
  await db.forceRls('project');
  ```

## Solution 2: `setRls` Builder With Command Helpers

- Summary: Add `this.setRls((r) => ...)` to table classes. The builder exposes command-specific policy helpers such as `r.select`, `r.insert`, `r.update`, `r.delete`, and `r.all`, plus table-state helpers for enabled/default-deny/forced states. This keeps RLS visible in table definitions while giving users stronger guidance than a plain object.
- User-facing interface: Users call `this.setRls` in a table class. The builder returns a structured RLS declaration but lets TypeScript expose different option shapes per command: `select` and `delete` accept `using`, `insert` accepts `withCheck`, and `update`/`all` accept both. A generic `r.policy(name, options)` can remain available for advanced cases.
- How it works: The builder still produces the same desired schema state as Solution 1: table flags plus policy definitions. The difference is ergonomic and validation-focused. Command-specific helpers make invalid combinations harder to write, and named helpers such as `r.defaultDeny({ force: true })` can make "enabled with no policies" explicit. Raw SQL remains the only policy-expression language for the first version.
- Workflow:
  - Define RLS with a builder block in the table class.
  - Prefer command helpers for normal policies.
  - Use `r.policy` only when a future Postgres option or uncommon shape is not covered by a helper.
  - Run migration generation; generated SQL and diff behavior match Solution 1.
- Pros: Best user guidance for Postgres's command-specific policy rules. Matches Orchid's existing `this.setColumns`, `this.setComputed`, and `this.setScopes` style. It can keep examples concise and makes deliberate default-deny states self-documenting.
- Cons: More API surface to design and document. The migration DSL must either duplicate builder helpers or expose lower-level methods, so the table API and migration API may not be perfectly symmetrical. Users who already know Postgres may find helper names less direct than plain policy objects.

#### Example use case

- A team wants the ORM to guide policy shape without hiding Postgres:

  ```ts
  import { BaseTable, sql } from './base-table';

  export class ProjectTable extends BaseTable {
    readonly table = 'project';

    columns = this.setColumns((t) => ({
      id: t.uuid().primaryKey(),
      tenantId: t.name('tenant_id').uuid(),
      name: t.text(),
    }));

    readonly rls = this.setRls((r) => ({
      enabled: true,
      force: true,
      policies: [
        r.select('project_select_same_tenant', {
          to: 'app_user',
          using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        }),
        r.insert('project_insert_same_tenant', {
          to: 'app_user',
          withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        }),
        r.update('project_update_same_tenant', {
          to: 'app_user',
          using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
          withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
        }),
      ],
    }));
  }
  ```

  A close `rake-db` shape would mirror the same helper vocabulary:

  ```ts
  await db.changeRls('project', (r) => [
    r.enable({ force: true }),
    r.create.select('project_select_same_tenant', {
      to: 'app_user',
      using: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    }),
    r.create.insert('project_insert_same_tenant', {
      to: 'app_user',
      withCheck: db.sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    }),
  ]);
  ```

## Solution 3: Policy Objects Linked to Tables

- Summary: Introduce named policy objects that can be defined independently and linked to a table declaration. This follows the shape used by tools that treat policies as schema objects, while still letting Orchid table files gather the policies that protect a table.
- User-facing interface: Users create `rlsPolicy(...)` objects, usually in the same table file, and attach them through the table's `rls` declaration. Policies can also link to provider-owned or externally defined tables when a table class is not the source of truth.
- How it works: A policy object has the same Postgres fields as Solution 1. The table declaration owns table-level state and lists the policy objects that belong to that table. Migration generation diffs table flags and policy objects separately. A linked policy can point at a table class, a table name, or an existing external table. If roles become first-class schema objects in the same app, `to` can accept role objects as well as strings, similar to Drizzle's role-aware policy API.
- Workflow:
  - Define reusable or named policies.
  - Attach policy objects to the table's RLS declaration.
  - Use policy objects in manual migrations or generated migration output.
  - Link policies to external tables when Orchid should manage a policy but not the table.
- Pros: Strong fit when policies are reusable, generated, shared across multiple table modules, or attached to provider-owned tables. It makes policies visible as their own schema objects, which aligns with Postgres catalogs and Atlas's separation between table row-security state and policy blocks.
- Cons: More ceremony for common app tables. Policies can drift away from the table definition if teams put them in separate files. Table-first readability is weaker unless examples strongly encourage colocating policy objects with the table.

#### Example use case

- A project has a shared tenant policy factory used by many tables:

  ```ts
  import { BaseTable, sql, rlsPolicy } from './base-table';

  const tenantRead = rlsPolicy('project_select_same_tenant', {
    for: 'select',
    to: 'app_user',
    using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });

  const tenantInsert = rlsPolicy('project_insert_same_tenant', {
    for: 'insert',
    to: 'app_user',
    withCheck: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  });

  export class ProjectTable extends BaseTable {
    readonly table = 'project';

    columns = this.setColumns((t) => ({
      id: t.uuid().primaryKey(),
      tenantId: t.name('tenant_id').uuid(),
      name: t.text(),
    }));

    readonly rls = {
      enabled: true,
      force: true,
      policies: [tenantRead, tenantInsert],
    };
  }
  ```

  The closest migration DSL would accept the same object shape:

  ```ts
  await db.createPolicy('project', tenantRead);
  await db.createPolicy('project', tenantInsert);
  await db.enableRls('project', { force: true });
  ```

## Solution 4: Higher-Level Tenant Policy Presets

- Summary: Provide table-level presets for common RLS patterns, especially same-tenant access based on a tenant column and a runtime setting. Users configure the policy intent rather than each Postgres policy object. This can be a useful later layer, but it is risky as the first complete RLS design because it cannot represent the full policy surface.
- User-facing interface: A table uses a preset helper such as `this.tenantRls(...)` or `r.tenant(...)`. The helper expands to multiple concrete policies for select/insert/update/delete with conventional names, roles, and SQL expressions.
- How it works: The preset is still desired schema state. It expands to ordinary policies before diffing and migration generation. Users can override generated policy names, choose commands, provide separate read/write roles, and add extra raw policies for exceptions. The preset must expose the generated policy list clearly in docs and generated migrations so users can reason about actual Postgres behavior.
- Workflow:
  - Choose a supported preset, such as tenant isolation by column and runtime setting.
  - Configure role, tenant column, setting name, and commands.
  - Add custom raw policies for cases the preset does not cover.
  - Generated migrations render normal policy DDL, not a hidden abstraction.
- Pros: Very fast path for the most common multi-tenant use case. Encourages consistent policy naming and avoids repeated SQL snippets across many tables. Can reduce mistakes for simple tenant-owned tables.
- Cons: Too narrow for many real RLS designs: membership tables, admin bypass rules, restrictive policies, provider auth helpers, security-definer functions, and subquery-based policies all need the raw policy model. It risks teaching users that RLS is simpler than it is. It should be built on top of Solution 1 or 2 rather than replacing them.

#### Example use case

- A CRUD-heavy SaaS app has many tables with the same `tenant_id` rule:

  ```ts
  export class ProjectTable extends BaseTable {
    readonly table = 'project';

    columns = this.setColumns((t) => ({
      id: t.uuid().primaryKey(),
      tenantId: t.name('tenant_id').uuid(),
      name: t.text(),
    }));

    readonly rls = this.setRls((r) =>
      r.tenant({
        role: 'app_user',
        tenantColumn: 'tenantId',
        setting: 'app.tenant_id',
        commands: ['select', 'insert', 'update', 'delete'],
        force: true,
      }),
    );
  }
  ```

  The migration DSL could expose the same preset only as a convenience:

  ```ts
  await db.addTenantRls('project', {
    role: 'app_user',
    tenantColumn: 'tenant_id',
    setting: 'app.tenant_id',
    force: true,
  });
  ```

## Comparison

- Solution 1 is the best minimal core: it is explicit, maps cleanly to Postgres, and should be easiest to introspect, diff, pull, and render in generated migrations.
- Solution 2 is the best user-facing table API if Orchid wants stronger ergonomics. It preserves the same data model as Solution 1 but uses helpers to guide users through Postgres's command-specific `USING` and `WITH CHECK` rules. This seems most natural for Orchid because it follows existing `setColumns`-style table configuration without hiding raw SQL.
- Solution 3 is valuable for advanced workflows and externally owned tables, but it should not be the only table API. It is strongest as an optional compatibility layer or a way to reuse policies once the table-owned model exists.
- Solution 4 should be a later convenience layer. A tenant preset can be helpful, but Orchid needs a complete raw-policy model first because real RLS setups vary too much for a preset-only design.
- For `rake-db`, the best alignment is to expose low-level methods that match the core data model regardless of which table API is chosen: `enableRls`, `disableRls`, `forceRls`, `noForceRls`, `createPolicy`, `changePolicy`, `renamePolicy`, and `dropPolicy`. If Solution 2 is chosen for tables, `db.changeRls(table, (r) => [...])` can provide a higher-level wrapper over those same methods.

## References

- PostgreSQL row security policies: table ownership, owner bypass, multiple policies, and permissive/restrictive composition shape the required policy model. https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL `CREATE POLICY`: defines the exact user-visible fields Orchid must represent and the default-deny behavior when RLS is enabled without policies. https://www.postgresql.org/docs/current/sql-createpolicy.html
- PostgreSQL `ALTER POLICY`: limits what generated migrations can alter in place, which affects user expectations around renaming and changing policies. https://www.postgresql.org/docs/current/sql-alterpolicy.html
- PostgreSQL `ALTER TABLE`: separates enable/disable and force/no-force table flags from stored policies. https://www.postgresql.org/docs/current/sql-altertable.html
- Drizzle ORM RLS docs: precedent for table-attached policies, raw SQL policy expressions, role objects, and provider role ignore controls. https://orm.drizzle.team/docs/rls
- Atlas schema docs: precedent for modeling table row-security state separately from linked policy objects. https://atlasgo.io/atlas-schema/hcl
- Atlas security as code guide: shows desired-state diffing for roles, grants, tables, and policies together. https://atlasgo.io/guides/postgres/security-declarative
- Supabase RLS docs: reinforces explicit enablement, table-attached SQL policies, grants as a separate layer, and performance guidance around policy predicates. https://supabase.com/docs/guides/database/postgres/row-level-security
- Orchid local docs: `docs/src/.vitepress/dist/llms.txt`, `docs/src/guide/define-tables.md`, `docs/src/guide/base-table.md`, `docs/src/guide/sql-expressions.md`, `docs/src/guide/generate-migrations.md`, `docs/src/guide/migration-writing.md`, and `docs/src/guide/row-level-security.md` shaped naming and workflow expectations.
