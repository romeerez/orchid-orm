## Summary

Generate migrations that reconcile PostgreSQL existing-object grants declared in `orchidORM` metadata with actual database ACL state. `rake-db` extends common schema introspection and generated-code support for grant AST nodes, while `orm` adds a dedicated `grants.generator.ts` that compares metadata against introspected grants and emits `db.grant` / `db.revoke` calls.

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    roles: [{ name: 'app_user' }, { name: 'readonly' }],
    defaultGrantedBy: 'app_owner',
    grants: [
      {
        to: 'app_user',
        schemas: ['public'],
        privileges: ['USAGE'],
      },
      {
        to: 'app_user',
        allTablesIn: ['public'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      {
        to: 'readonly',
        tables: ['public.project', 'public.task'],
        privileges: ['SELECT'],
        grantablePrivileges: ['REFERENCES'],
      },
    ],
  },
  { ...tables },
);
```

When `db g` sees missing or stale grants, it generates ordinary reversible rake-db migration calls:

```ts
import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.grant({
    to: 'app_user',
    schemas: ['public'],
    privileges: ['USAGE'],
    grantedBy: 'app_owner',
  });

  await db.grant({
    to: 'app_user',
    allTablesIn: ['public'],
    privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    grantedBy: 'app_owner',
  });

  await db.revoke({
    to: 'readonly',
    tables: ['public.old_report'],
    privileges: ['SELECT'],
  });
});
```

Projects can opt out of grant reconciliation without removing metadata:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    grants: [
      {
        to: 'app_user',
        allTablesIn: ['public'],
        privileges: ['SELECT'],
      },
    ],
    generatorIgnore: {
      grants: {
        roles: ['external_role'],
        tables: [/^audit_/, 'external_table'],
        allTablesIn: ['external_schema'],
      },
    },
  },
  { ...tables },
);
```

## What Changes

- Add database grant introspection in `rake-db` through the existing `introspectDbSchema` flow, including actual grants only when generation asks for them.
- Make `RakeDbAst.Grant` usable by generated migrations instead of treating it as manual-migration-only state.
- Add an ORM `grants.generator.ts` that normalizes ORM grant metadata, compares it with introspected ACL grants, respects `generatorIgnore.grants`, and emits grant/revoke AST items.
- Include grant changes in generated migration code, dependency ordering, verification, and generated migration reports.
- Write user docs for declarative grant metadata, manual `grant` / `revoke` migrations, and generated grant reconciliation, including links from RLS guidance.

## Assumptions

- Grantor comparison is opt-in through metadata. When a grant declaration resolves to a `grantedBy` value from either per-grant `grantedBy` or top-level `defaultGrantedBy`, that grantor participates in comparison and generated SQL. When no grantor is declared, matching is grantor-agnostic and generated SQL omits `GRANTED BY`.
- Introspection records concrete object ACLs only. PostgreSQL does not store `ALL TABLES IN SCHEMA` as a separate ACL object, so schema-wide metadata is reconciled by comparing it against the current concrete objects of the matching kind in that schema.
- Generated grant reconciliation manages direct ACL entries only. It does not try to prove effective access through role membership, ownership, or superuser bypass.

## Capabilities

- `grant-introspection`: Load normalized PostgreSQL existing-object ACL grants through common schema introspection when `loadGrants` is requested.
- `grant-code-generation`: Render `RakeDbAst.Grant` items as generated `db.grant` / `db.revoke` migration calls with ordering metadata.
- `grant-reconciliation-generator`: Compare ORM grant metadata with introspected grants and emit the grant or revoke AST items needed to restore declared intent.

## Detailed Design

### Rake-DB Grant Introspection

`rake-db` extends the existing `introspectDbSchema` path with optional grant loading.

```ts
export interface IntrospectDbStructureParams {
  loadGrants?: boolean;
}
```

- Grant state is loaded only through `introspectDbSchema(db, { loadGrants: true })`; there is no standalone public helper for loading only grants.
- When `loadGrants` is omitted or false, `IntrospectedStructure.grants` remains `undefined`, matching the optional loading pattern already used for roles and default privileges.
- Raw database grant rows belong under the existing `RawDbStructure` namespace in `rake-db`, with an appropriate raw db-level grants shape chosen during implementation.
- The normalized introspected grant shape should follow existing `DbStructure` / `IntrospectedStructure` patterns and stay compatible with `pqb` grant metadata concepts, but the exact interface details are left to the implementing agent that will wire the parser and comparison code.
- Introspection covers the target kinds from the grant metadata contract: `schemas`, `tables`, `sequences`, `routines`, `types`, `domains`, and `databases`.
- Introspection does not emit `allTablesIn`, `allSequencesIn`, or `allRoutinesIn` entries because PostgreSQL stores those grants as concrete ACLs on existing objects.
- Each returned grant item represents one target kind and one target name group with one grantee and, when available, one grantor. Ordinary privileges are stored in `privileges`; privileges with grant option are stored in `grantablePrivileges` and are not duplicated in `privileges`.
- A null catalog ACL is interpreted through PostgreSQL defaults, not as no privileges. This matters for default `PUBLIC` privileges on databases, routines, types, domains, and languages; only target kinds supported by this feature are returned.
- Owner implicit privileges and superuser bypass are not emitted as explicit grants unless they exist as ACL entries.
- The grant introspection shape uses the same target keys and privilege names as `pqb` `Grant.InternalPrivilege`, including `ALL` only when a later normalizer intentionally collapses a full privilege set. Raw database ACL rows usually contain concrete privilege names.

### Generated Grant AST and Migration Code

`RakeDbAst.Grant` becomes a real generated migration AST node.

```ts
namespace RakeDbAst {
  export interface Grant extends PqbGrant.InternalPrivilege {
    type: 'grant';
    action: 'grant' | 'revoke';
    revokeMode?: 'CASCADE' | 'RESTRICT';
  }
}
```

- `astToMigration` renders `action: 'grant'` as `await db.grant({...})` and `action: 'revoke'` as `await db.revoke({...})`.
- Generated code uses the public `rake-db` grant/revoke argument shape from idea 2 instead of raw SQL.
- `to`, target arrays, `privileges`, `grantablePrivileges`, `grantedBy`, and `revokeMode` are rendered only when present.
- `grantablePrivileges` on generated `grant` means grant with grant option. `grantablePrivileges` on generated `revoke` means revoke a privilege that should be granted back with grant option on rollback.
- When generated reconciliation needs to remove a grantable privilege entirely, including any grant option, it emits that privilege in `grantablePrivileges` on `db.revoke`.
- Generated grant items declare dependencies on referenced roles, grantor roles, schemas, and concrete object targets so grant changes are ordered after role and object creation and before role or object removal where the generator ordering model can express that.
- Generated migration reports include concise grant and revoke messages, with grant-option changes reported separately from ordinary privilege changes, matching the style of default-privilege reports.

### ORM Grant Reconciliation

`orm` adds `packages/orm/src/migrations/generate/generators/grants.generator.ts` and calls it from `composeMigration` after role/default-privilege processing and before object drops can make grant targets disappear.

- The generator runs only when `internal.grants` is present and `generatorIgnore.grants` does not ignore every relevant declaration.
- `generate.ts` and `verify-migration.ts` request `loadGrants: true` whenever grant reconciliation can run, including verification after the generated migration is applied.
- Grant metadata in code is normalized into the same conceptual shape as introspected grant state: one target kind, one target name, one grantee, optional effective grantor, ordinary privileges, and grantable privileges.
- The effective grantor for a code grant is `grant.grantedBy ?? internal.defaultGrantedBy`. It is stored in generated AST as `grantedBy` when present.
- The generator does not require grant grantees or grantors to be listed in `roles`; role creation and grant management stay separate capabilities.
- `PUBLIC`, `CURRENT_ROLE`, `CURRENT_USER`, and `SESSION_USER` remain valid role specifications in metadata and generated code.
- Schema-qualified concrete object names are compared against introspected schema/name pairs. Unqualified concrete object names are interpreted relative to the current schema, matching migration naming behavior.
- Metadata using `allTablesIn`, `allSequencesIn`, or `allRoutinesIn` is compared against every currently introspected concrete object of that kind in the listed schemas.
- Missing configured privileges produce `RakeDbAst.Grant` items with `action: 'grant'`.
- Actual privileges that are no longer configured produce `RakeDbAst.Grant` items with `action: 'revoke'`, unless ignored.
- `ALL` in metadata compares as the full supported privilege set for the target kind and current PostgreSQL version. The generator may emit `ALL` when that was the user's declared intent and it is safe for the target/version.
- `TEMP` compares as the database `TEMPORARY` privilege, while generated code may preserve `TEMP` or emit `TEMPORARY` consistently with the rake-db grant DSL.
- Table `MAINTAIN` is included only for PostgreSQL versions that support it.

### Grant Option Reconciliation

Grant option is part of the desired state for each target, grantee, grantor, and privilege.

- If code declares an ordinary privilege and the database has no such privilege, generate `db.grant({ privileges: [...] })`.
- If code declares a grantable privilege and the database has no such privilege, generate `db.grant({ grantablePrivileges: [...] })`.
- If code declares a grantable privilege and the database has only an ordinary privilege, generate `db.grant({ grantablePrivileges: [...] })` to add the grant option.
- If code declares an ordinary privilege and the database has the same privilege with grant option, generate `db.revoke({ grantablePrivileges: [...] })` followed by `db.grant({ privileges: [...] })` so the grant option is removed while the ordinary privilege remains.
- If code does not declare a privilege and the database has an ordinary version, generate `db.revoke({ privileges: [...] })`.
- If code does not declare a privilege and the database has a grantable version, generate `db.revoke({ grantablePrivileges: [...] })` so rollback restores the grant with grant option.

### Ignore Semantics

Grant generation respects both object-level generator ignores and grant-specific ignores.

- `generatorIgnore.grants.roles` ignores actual and configured grants for matching grantees.
- `generatorIgnore.grants.<targetKey>` ignores grants for the matching target kind and target names.
- String selectors match exact normalized names. Regular expression selectors test normalized names.
- For concrete schema-scoped targets, matching supports both qualified and unqualified names where the current schema makes them equivalent.
- `generatorIgnore.grants.allTablesIn`, `allSequencesIn`, and `allRoutinesIn` ignore schema-wide declarations and concrete actual grants for the matching object kind in those schemas.
- Top-level ignored schemas suppress grant reconciliation for objects in those schemas. Top-level ignored tables and domains suppress grant reconciliation for those objects. Grant-specific ignores can suppress only grants while leaving object diffing active.
- Ignored configured grants do not generate `GRANT`; ignored actual grants do not generate `REVOKE`.

### Integration and Verification

Generated grant reconciliation participates in the existing generation lifecycle.

- Initial generation and verification use the same `loadGrants` decision so a generated grant migration verifies by re-running the same comparison after applying the migration inside the verification transaction.
- Schema names referenced by grant metadata are added to generation's known schema set so a schema used only by configured grants is not treated as absent code intent.
- Grant reconciliation does not create, drop, or rename roles or grant targets. It assumes role and object generators own those changes.
- If a configured grant references an object that Orchid is otherwise going to drop, the normal object diff still wins unless the object is ignored or represented in code.
- Generated migrations are deterministic: equivalent metadata and database state should produce stable grant/revoke call ordering.

### Documentation

Docs should cover the whole grant feature, not only this generator idea.

- Migration generation docs should explain `grants`, `defaultGrantedBy`, generated grant reconciliation, and `generatorIgnore.grants` beside roles and default privileges.
- Migration writing docs should document manual `db.grant` and `db.revoke`, including grant option, `revokeMode`, supported target keys, and the difference between existing-object grants and default privileges.
- RLS docs should link to grant docs and remove wording that says grant support is future-only.
- Gotchas should stay visible: table grants do not grant sequence access, schema `USAGE` is still needed for object lookup, default privileges affect future objects while `GRANT` / `REVOKE` affect existing objects, and effective access through role membership is broader than direct ACL entries.
