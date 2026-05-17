# Declare RLS Where Tables Are Defined - Research

## Scope

This document covers only idea 1 from `changes/611-row-level-security-integration/ideas.md`: defining Postgres row-level security policy state beside Orchid table definitions, comparing that desired state with the live database, and generating migrations through `orm` and `rake-db`.

Runtime RLS context is covered by ideas 2 and 3. Roles, grants, and privileges are out of scope for this item, except that policies have a `TO` role target list and policy DDL can fail if referenced roles do not exist.

Sources were checked against PostgreSQL 18 current documentation on 2026-05-10.

## Main conclusions

- RLS support must model two different things: table-level row-security state and table-specific policy definitions.
- Table-level state is not just "has policies". Postgres stores `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` as independent table flags.
- Policy definitions have six relevant properties: name, permissive/restrictive mode, command, target roles, `USING` expression, and `WITH CHECK` expression.
- `ALTER POLICY` is limited. It can rename a policy or replace roles / `USING` / `WITH CHECK`; changing command or permissive/restrictive mode requires drop and recreate.
- Disabling RLS does not drop policies. Dropping the last policy while RLS remains enabled leaves the table in default-deny behavior.
- A complete Orchid feature needs table DSL types, migration DSL methods, AST representation, SQL generation, database introspection, diffing, generated migration code, pull support, verification support, docs, and focused tests.
- Raw SQL policy expressions are required. A higher-level ORM condition DSL would not cover Postgres policy capabilities, especially `current_setting(...)`, provider helper functions, security-definer functions, and subqueries.

## PostgreSQL RLS model

RLS is table-level and opt-in. A table without RLS enabled behaves according to ordinary SQL privileges. Once RLS is enabled, ordinary reads and writes must be allowed by at least one applicable policy, otherwise Postgres uses default-deny behavior.

The table-level flags live in `pg_class`:

- `relrowsecurity`: row-level security is enabled.
- `relforcerowsecurity`: row-level security, when enabled, also applies to the table owner.

The policy rows live in `pg_policy`, and a readable system view exists as `pg_policies`.

Important behavior for Orchid:

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` turns policy enforcement on.
- `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` turns policy enforcement off, but leaves policies stored on the table.
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY` subjects the table owner to policies when RLS is enabled.
- `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY` restores the default owner bypass behavior.
- Superusers and roles with `BYPASSRLS` bypass policies even when `FORCE ROW LEVEL SECURITY` is set.
- `TRUNCATE` and `REFERENCES` are not covered by RLS.
- Internal referential-integrity checks and constraint validation bypass RLS, so unique and foreign-key checks can reveal hidden-row existence.
- Enabling/disabling RLS and creating/altering/dropping policies require table ownership.

Roles and privileges remain separate from policies. This feature should not create roles or grants, but docs must keep that boundary visible so users do not mistake policy definitions for complete permission setup.

## Policy capabilities

Each policy belongs to one table. Policy names are unique per table, but the same policy name may be reused on different tables.

A policy has these fields:

- `name`: SQL identifier scoped to one table.
- `as`: `PERMISSIVE` or `RESTRICTIVE`; default is permissive.
- `for`: `ALL`, `SELECT`, `INSERT`, `UPDATE`, or `DELETE`; default is all commands.
- `to`: one or more role targets; default is `PUBLIC`.
- `using`: boolean SQL expression applied to existing rows.
- `withCheck`: boolean SQL expression applied to proposed inserted or updated rows.

Policy target roles can be ordinary role names or the Postgres-recognized target keywords `PUBLIC`, `CURRENT_ROLE`, `CURRENT_USER`, and `SESSION_USER`. For migration generation, ordinary role names and `PUBLIC` are the important stable cases. The `CURRENT_*` targets are context-sensitive at DDL execution time and should be documented as advanced/manual use because introspection will expose the resolved role state, not necessarily the source token the user wrote.

Policy expressions:

- Must be SQL boolean expressions.
- Cannot contain aggregate or window functions.
- Are evaluated by Postgres as part of the user's query.
- Run with the privileges of the query user, unless the expression calls security-definer functions.
- Are normally evaluated before user query predicates, except for leakproof-function planner optimizations.
- May refer to row columns directly.
- May call functions such as `current_setting('app.tenant_id', true)`.
- May use subqueries or functions that query other tables, but this has concurrency and performance implications.

Postgres syntax allows predicate clauses to be omitted. Orchid should be able to introspect and preserve omitted expressions for existing databases and manual migrations, but examples should prefer explicit `` sql`true` `` when a policy intentionally allows all rows. Silent broad access is too easy to miss in a table DSL.

## Command-specific behavior

Policy command selection is not a one-to-one match with the user-visible SQL statement. `ALL` policies combine with command-specific policies, and some commands require multiple policy classes.

Requirement summary:

| Policy command | `USING`     | `WITH CHECK` | Notes                                                                                                                                     |
| -------------- | ----------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ALL`          | supported   | supported    | Applies to every command. If `WITH CHECK` is omitted, Postgres reuses `USING` for inserts/updates.                                        |
| `SELECT`       | supported   | not allowed  | Also applies where SELECT rights are required, such as `RETURNING`, `UPDATE`, `DELETE`, some `INSERT ... ON CONFLICT`, and `MERGE` cases. |
| `INSERT`       | not allowed | supported    | Applies to `INSERT` and `MERGE ... INSERT` actions. Proposed rows are checked and failures abort the statement.                           |
| `UPDATE`       | supported   | supported    | `USING` filters existing rows; `WITH CHECK` checks updated rows. If `WITH CHECK` is omitted, Postgres reuses `USING`.                     |
| `DELETE`       | supported   | not allowed  | Filters existing rows that may be deleted. `MERGE ... DELETE` has stricter error behavior when a visible row fails the delete policy.     |

Other command notes to document and test:

- `SELECT FOR UPDATE/SHARE` can involve both SELECT and UPDATE policy checks.
- `RETURNING` can require SELECT policies on rows that were inserted or updated.
- `INSERT ... ON CONFLICT` checks insert policies even for rows that later conflict.
- `ON CONFLICT DO UPDATE` additionally applies update policies to the row being updated and to the updated row.
- `MERGE` uses SELECT policies before joining source and target rows, and then applies the policy class for the selected action.
- Multiple applicable policy groups are combined by command type. Different command types needed by one SQL statement combine with `AND`.

## Multiple policy composition

Postgres supports many policies on one table. Orchid must not assume one table has one policy, or one role has one policy.

Composition rules:

- Applicable permissive policies are combined with `OR`.
- Applicable restrictive policies are combined with `AND`.
- A useful restrictive policy requires at least one applicable permissive policy; if only restrictive policies exist, access is denied.
- `ALL` policies are treated as the same command type as the concrete command being evaluated.
- Different required command classes combine with `AND`; for example an update that also requires select access needs both SELECT/ALL and UPDATE/ALL policy permission.

This means the DSL must preserve `as` and `for` exactly. Simplifying them away would change behavior.

## Policy DDL operations

`CREATE POLICY` supports:

- policy name,
- table name,
- `AS PERMISSIVE` / `AS RESTRICTIVE`,
- `FOR ALL|SELECT|INSERT|UPDATE|DELETE`,
- `TO` role target list,
- `USING (...)`,
- `WITH CHECK (...)`.

There is no `CREATE OR REPLACE POLICY` and no `CREATE POLICY IF NOT EXISTS` in PostgreSQL 18.

`ALTER POLICY` supports only:

- `ALTER POLICY old_name ON table RENAME TO new_name`,
- replacing `TO`,
- replacing `USING`,
- replacing `WITH CHECK`.

`ALTER POLICY` cannot change `FOR` command or permissive/restrictive mode. Generated migrations must drop/recreate, or rename old/create new/drop old, when those fields change.

`DROP POLICY` supports `IF EXISTS` and `CASCADE|RESTRICT`, but the cascade/restrict keywords have no effect because policies have no dependent objects.

## Ordering requirements for generated migrations

Ordering matters because enabled RLS with no applicable policy is default deny, and because disabling RLS leaves policies in place.

Recommended generated order:

- Creating a new table with policies: create table, create policies, enable RLS, then force RLS if requested.
- Enabling RLS on an existing table: create or update desired policies first, then enable RLS, then force RLS if requested.
- Forcing owner checks on an already-enabled table: `FORCE ROW LEVEL SECURITY` can be emitted with the table-level change.
- Dropping all policies from an enabled table intentionally: keep RLS enabled and drop policies only when the desired declaration is explicit default-deny.
- Disabling RLS and removing policies: disable RLS first, then drop policies, so non-transactional execution does not create an accidental default-deny window.
- Changing only roles or expressions: use `ALTER POLICY` when possible.
- Changing `for` or `as`: recreate the policy because Postgres cannot alter those fields.
- Renaming with equivalent definition: use `ALTER POLICY ... RENAME TO`.
- Renaming plus changing alterable fields: rename, then alter roles/expressions.
- Replacing a policy while RLS remains enabled: prefer a strategy that avoids an intermediate "no matching policy" state when possible. A transaction usually hides intermediate DDL from other sessions, but rake-db should still generate conservative order.

If a policy references a role created in the same generated migration, the policy AST should depend on the role AST when that role is managed by Orchid. This does not mean this feature manages roles; it only avoids generating policy DDL before known role DDL.

Policy expressions can reference functions, operators, tables, or schemas that Orchid does not model. The first release can leave those dependencies to the user and rely on normal Postgres errors, but docs should say that raw SQL dependencies must exist before the policy is created.

## Desired table DSL requirements

The table declaration should make RLS participation visible next to columns and other table behavior.

A complete table DSL needs to represent:

```ts
interface RlsConfig {
  enabled?: boolean;
  force?: boolean;
  policies?: RlsPolicy[];
}

interface RlsPolicy {
  name: string;
  as?: 'permissive' | 'restrictive';
  for?: 'all' | 'select' | 'insert' | 'update' | 'delete';
  to?: RlsPolicyTarget | RlsPolicyTarget[];
  using?: RawSqlBase;
  withCheck?: RawSqlBase;
}

type RlsPolicyTarget =
  | string
  | 'public'
  | 'current_role'
  | 'current_user'
  | 'session_user';
```

The exact exported type names can differ, but the capability set should not.

DSL requirements:

- Support `enabled: true` with an empty policy list for intentional default deny.
- Support `enabled: false` with policies present, because Postgres can store policies while ignoring them.
- Preserve `force` independently from policy definitions.
- Preserve policy names exactly. Policy names are SQL identifiers, not TypeScript object keys that should be auto-snake-cased without an explicit design choice.
- Support multiple policies per table.
- Support raw SQL expressions for `using` and `withCheck`.
- Avoid an ORM object-condition DSL for the first complete version; it cannot cover the full Postgres expression surface.
- Validate impossible command/expression combinations at TypeScript/runtime boundaries where reasonable: no `withCheck` for select/delete, no `using` for insert.
- Make broad allow policies explicit in examples.
- Do not hide role/grant requirements. A policy declaration can mention role names, but it does not grant table privileges.

Open API choice:

- `rls` absent can mean "Orchid-managed desired state is no RLS and no policies", matching the generator's usual "code is desired schema" model.
- That is useful for synchronization, but it can drop externally managed policies. Complete support should include either generator ignore controls for RLS/policies or a documented `rls: 'ignore'` / config-level ignore option for users who manage policies manually.

## rake-db migration DSL requirements

`rake-db` needs first-class DDL methods so generated migrations are readable and users can write policies manually without raw SQL.

Minimum manual DSL capabilities:

- Enable RLS on a table.
- Disable RLS on a table.
- Force RLS on a table.
- No-force RLS on a table.
- Create a policy with all fields.
- Alter a policy's roles, `USING`, and `WITH CHECK`.
- Rename a policy.
- Drop a policy, with optional `ifExists`.
- Recreate a policy when command or mode changes.

One possible API shape:

```ts
await db.enableRls('project');
await db.forceRls('project');

await db.createPolicy('project', 'project_select_same_tenant', {
  for: 'select',
  to: 'app_user',
  using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
});

await db.changePolicy('project', 'project_select_same_tenant', {
  from: {
    to: 'app_user',
    using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  },
  to: {
    to: ['app_user', 'report_user'],
    using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
  },
});

await db.renamePolicy('project', 'old_policy', 'new_policy');
await db.dropPolicy('project', 'new_policy');
await db.noForceRls('project');
await db.disableRls('project');
```

The final names can be different, but the rollback story must be explicit:

- `enableRls` reverses to `disableRls`.
- `forceRls` reverses to `noForceRls`.
- `createPolicy` reverses to `dropPolicy`.
- `dropPolicy` reverses to `createPolicy` only if the old policy definition is available.
- `changePolicy` needs old and new definitions for reversible migrations.
- Recreate operations need enough old state to reverse.

For `createTable`, rake-db can either accept `rls` in table options or add a `t.rls(...)` table-data helper. For `changeTable`, policy changes may be clearer as standalone methods because policies are separate table-level objects, not column changes.

## AST and SQL generation requirements

`rake-db` currently models tables, constraints, views, roles, and default privileges in `RakeDbAst`. RLS can be represented either as fields on table/change-table ASTs or as separate AST nodes. Separate AST nodes are likely cleaner because policies have their own DDL lifecycle.

Needed AST concepts:

- Table RLS state change: enable/disable and force/no-force.
- Policy create/drop.
- Policy rename.
- Policy alter for roles and expressions.
- Policy recreate for command/mode changes.

Suggested identities for dependency sorting:

- Table RLS state key: `schema.table:rls`.
- Policy key: `schema.table:policy:policy_name`.
- Dependencies: schema, table, and referenced managed roles where known.

SQL generation details:

- Quote schema, table, policy, and role identifiers correctly.
- Emit `PUBLIC` as a keyword, not a quoted role.
- Treat `current_role`, `current_user`, and `session_user` as keywords only when the user explicitly selected those special targets.
- Do not parameterize identifiers.
- Prefer policy expression SQL fragments that are static migration SQL. Values used by policies should normally come from runtime settings or functions, not migration-time parameters.
- Preserve raw SQL expression output through existing `RawSqlBase` mechanisms where possible.
- Add tests for SQL output and rollback output.

## Introspection requirements

`DbStructure.Table` currently has schema/name/comment/columns and separate arrays for constraints, indexes, triggers, etc. RLS support needs to add table RLS state and policy details to introspected structure.

A useful introspected shape:

```ts
interface RlsInfo {
  enabled: boolean;
  forced: boolean;
  policies: RlsPolicyInfo[];
}

interface RlsPolicyInfo {
  schemaName: string;
  tableName: string;
  name: string;
  permissive: boolean;
  command: 'all' | 'select' | 'insert' | 'update' | 'delete';
  roles: string[]; // ['PUBLIC'] for public
  using?: string;
  withCheck?: string;
}
```

Database sources:

- `pg_class.relrowsecurity` and `pg_class.relforcerowsecurity` for table flags.
- `pg_policy.polname`, `polcmd`, `polpermissive`, `polroles`, `polqual`, and `polwithcheck` for canonical fields.
- `pg_get_expr(polqual, polrelid, false)` and `pg_get_expr(polwithcheck, polrelid, false)` for expression text.
- `pg_get_userbyid(role_oid)` for role names; role OID `0` means `PUBLIC`.
- `pg_policies` can be useful for readable output, but direct catalog access gives the table OID and raw flags needed for stable joins.

Command mapping:

- `*` -> `all`
- `r` -> `select`
- `a` -> `insert`
- `w` -> `update`
- `d` -> `delete`

Expression deparsing should use `pretty = false`, matching Postgres guidance that non-pretty decompiled output is more stable for dump-like use.

## Diffing requirements

The migration generator must compare desired table DSL state with introspected DB state.

Table-level diff:

- DB disabled, code enabled: generate enable.
- DB enabled, code disabled: generate disable.
- DB unforced, code forced: generate force.
- DB forced, code unforced: generate no-force.
- Missing code `rls` must follow the chosen managed/ignored semantics.

Policy diff:

- Policy in code but not DB: create.
- Policy in DB but not code: drop, unless ignored.
- Equivalent policy under a different name: prompt/create rename support, similar to table rename prompts.
- Same name but roles/using/withCheck changed: alter.
- Same name but command or permissive/restrictive changed: recreate.
- Same name but multiple fields changed: use the smallest correct operation sequence.

Comparison details:

- Role target order should be canonicalized before comparison because role list order does not change policy semantics.
- `PUBLIC` should be canonicalized consistently.
- Defaults should be normalized: omitted `as` means permissive, omitted `for` means all, omitted `to` means public.
- Omitted expressions and `` sql`true` `` are not identical at the catalog level; decide whether to treat them as equivalent only after testing. For first complete support, exact expression-state comparison is safer.
- Expression comparison should reuse the existing generator strategy for SQL expression normalization where possible: create a temporary view over a fake table row and compare deparsed SQL. This avoids churn from harmless parentheses and casts.
- Policy expression comparison needs a table-shaped source with all non-virtual columns, like check constraint comparison.
- If a policy expression cannot be parsed for comparison because a referenced type/function/table is not available yet, the generator should conservatively mark it changed or abort in verification mode, matching existing generated migration behavior for hard-to-compare SQL.

## Pull and generated-code requirements

Pull support should be able to read live RLS state and produce equivalent code/migration artifacts.

Generated code requirements:

- Tables with enabled RLS and no policies must round-trip as explicit default-deny state.
- Disabled tables with stored policies must round-trip without losing policies.
- Forced tables must round-trip.
- All policy properties must round-trip.
- Existing policy names should be preserved exactly.
- Expressions should be emitted as raw SQL snippets.
- Public role target should be emitted clearly as `public`/`PUBLIC`, not as a quoted role named `"PUBLIC"`.

## Verification requirements

Generated migration verification must include RLS state in the after-apply comparison. Otherwise the generator can report success while missing policy changes.

Verification needs to check:

- `relrowsecurity`
- `relforcerowsecurity`
- policy presence
- policy names
- command
- permissive/restrictive mode
- target roles
- `USING`
- `WITH CHECK`

Tests should include both normal generation and verification failure paths.

## Documentation requirements

User docs should cover:

- RLS table declarations in Orchid table classes.
- rake-db policy migration methods.
- Default-deny behavior for enabled tables with no applicable policy.
- The fact that roles/grants are separate and out of scope for this feature.
- Owner bypass and `FORCE ROW LEVEL SECURITY`.
- Superuser and `BYPASSRLS` bypass.
- Command-specific `USING` / `WITH CHECK` rules.
- Multiple policies and permissive/restrictive composition.
- `RETURNING`, `ON CONFLICT`, and `MERGE` surprises.
- `TRUNCATE`, `REFERENCES`, and RI/constraint leakage.
- Policy performance guidance: index columns used by policy predicates, prefer simple row-local predicates, scope policies to roles where possible, and be careful with subqueries.
- Race risks when policy predicates query other tables.
- View behavior: policies on base tables can be evaluated as the view owner unless the view uses `security_invoker`; Orchid already has `createView(..., { with: { securityInvoker: true } })`.
- Runtime context is separate and handled by `$withOptions({ role, setConfig })` / `$transaction({ role, setConfig })` work.

## Test requirements

Focused tests should cover:

- rake-db SQL for enable, disable, force, no-force.
- rake-db SQL for create, alter, rename, drop, and recreate policy.
- Reversible migration output for each operation.
- Validation of illegal expression combinations by command.
- Introspection of enabled and forced flags.
- Introspection of policies for all commands.
- Introspection of permissive and restrictive policies.
- Introspection of `PUBLIC` and multiple role targets.
- Diff from no RLS to enabled default-deny.
- Diff from enabled to disabled while preserving policies.
- Diff for creating, dropping, renaming, altering, and recreating policies.
- Diff expression normalization for harmless SQL formatting differences.
- Generated migration verification includes RLS.
- Pull output includes RLS declarations.
- Existing generator ignore behavior, or new ignore behavior, can prevent dropping externally managed policies.

Behavioral integration tests against Postgres should include:

- Enabled table with no policies denies normal non-owner role access.
- `FORCE ROW LEVEL SECURITY` affects owner queries.
- Select/update/insert/delete policies enforce the expected `USING` and `WITH CHECK` checks.
- `WITH CHECK` failures raise errors while `USING` filters usually suppress rows.
- Multiple permissive policies OR together.
- Restrictive policies AND with the permissive result.

## Current Orchid codebase implications

Local findings:

- Native policy DDL support is not present in `rake-db` migration methods.
- `RakeDbAst` has no RLS or policy AST node yet.
- `DbStructure.Table` has no RLS flags or policies yet.
- `introspectDbSchema` currently fetches tables, views, indexes, constraints, triggers, extensions, enums, domains, collations, roles, and default privileges, but not table RLS state or policies.
- `processTables` in the ORM migration generator is the natural place to attach table-driven RLS diffing after table create/rename/change decisions are known.
- `TableData` currently stores primary keys, indexes, excludes, and constraints. RLS could be added there, but standalone policy ASTs may fit migration ordering better.
- Existing SQL expression comparison for check constraints is relevant and should be reused or adapted for policy expressions.
- Existing role/default-privilege generation can remain separate. Policy generation should only depend on managed roles when known.

## Risks and design guardrails

- Do not silently enable RLS just because a policy array is non-empty unless the API makes that default explicit. Drizzle does this, but Orchid should decide deliberately because enabled-with-no-policy default-deny is a security boundary.
- Do not hide disabled-with-policies state. Postgres supports it and it is useful for staged rollouts.
- Do not drop externally managed policies without an ignore story.
- Do not try to infer policy expressions from Orchid query filters in the first complete version.
- Do not claim policies secure views unless `security_invoker` behavior is handled or documented.
- Do not claim policies replace privileges.
- Do not treat tests that use owner/superuser connections as proof that app roles are protected.

## References

- PostgreSQL row security policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL `CREATE POLICY`: https://www.postgresql.org/docs/current/sql-createpolicy.html
- PostgreSQL `ALTER POLICY`: https://www.postgresql.org/docs/current/sql-alterpolicy.html
- PostgreSQL `DROP POLICY`: https://www.postgresql.org/docs/current/sql-droppolicy.html
- PostgreSQL `ALTER TABLE` RLS actions: https://www.postgresql.org/docs/current/sql-altertable.html
- PostgreSQL `pg_policy`: https://www.postgresql.org/docs/current/catalog-pg-policy.html
- PostgreSQL `pg_policies`: https://www.postgresql.org/docs/current/view-pg-policies.html
- PostgreSQL `pg_class` RLS flags: https://www.postgresql.org/docs/current/catalog-pg-class.html
- PostgreSQL `pg_get_expr`: https://www.postgresql.org/docs/current/functions-info.html
- PostgreSQL `current_setting` and `set_config`: https://www.postgresql.org/docs/current/functions-admin.html
- PostgreSQL `row_security` setting: https://www.postgresql.org/docs/current/runtime-config-client.html
- PostgreSQL view `security_invoker` notes: https://www.postgresql.org/docs/current/sql-createview.html
- Drizzle ORM RLS schema precedent: https://orm.drizzle.team/docs/rls
