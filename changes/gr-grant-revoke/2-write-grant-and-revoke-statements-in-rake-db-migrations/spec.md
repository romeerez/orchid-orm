## Summary

Add typed `grant` and `revoke` migration methods to `rake-db` so migrations can change privileges on existing PostgreSQL objects without raw SQL. Both methods accept the same strict public argument shape based on `pqb` `Grant.Privilege`; `rake-db` adds only `revokeMode` for emitted `REVOKE` statements and uses loose internal grant state for SQL rendering.

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.createRole('app_user', { canLogin: true });

  await db.grant({
    to: 'app_user',
    schemas: ['public'],
    privileges: ['USAGE'],
  });

  await db.grant({
    to: 'app_user',
    tables: ['project', 'task'],
    privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  });

  await db.grant({
    to: 'app_user',
    sequences: ['project_id_seq'],
    privileges: ['USAGE', 'SELECT'],
  });
});
```

```ts
import { change } from '../db-script';

change(async (db) => {
  await db.revoke({
    to: 'PUBLIC',
    routines: ['public.reset_password(text)'],
    privileges: ['EXECUTE'],
    revokeMode: 'CASCADE',
  });

  await db.revoke({
    to: 'readonly',
    tables: ['project'],
    grantablePrivileges: ['UPDATE'],
    revokeMode: 'RESTRICT',
  });
});
```

## What Changes

- Add `db.grant(params)` for PostgreSQL object `GRANT` statements in manual `rake-db` migrations.
- Add `db.revoke(params)` for PostgreSQL object `REVOKE` statements, including `REVOKE GRANT OPTION FOR` and `CASCADE` / `RESTRICT` through `revokeMode`.
- Use the same strict public argument type for `grant` and `revoke`, reusing `pqb` grant target, privilege, `to`, `grantedBy`, and `grantablePrivileges` concepts.
- Add one loose internal `rake-db` grant privilege shape that extends `pqb` `Grant.InternalPrivilege` with `revokeMode` for SQL rendering and future generated migration reuse.
- Document the migration DSL and keep generated grant reconciliation, grant introspection, and ORM metadata comparison out of scope.

## Assumptions

- Idea 2 should expose the same common object target surface as the related grant metadata contract: schemas, tables, all tables in schema, sequences, all sequences in schema, routines, all routines in schema, types, domains, and databases. Less common PostgreSQL targets remain out of scope until generated reconciliation or a follow-up migration DSL idea needs them.
- The public `revoke` API should intentionally use the same `to` property as `grant` instead of introducing `from`, because keeping one argument type makes `grant` and `revoke` naturally reversible and avoids a second public grant-like union.

## Capabilities

- `grant-migration-dsl`: Execute typed existing-object `GRANT` statements from manual `rake-db` migrations.
- `revoke-migration-dsl`: Execute typed existing-object `REVOKE` statements from manual `rake-db` migrations, including grant-option-only revocation.
- `grant-sql-state`: Provide one loose internal grant/revoke statement shape that SQL rendering and later generated grant reconciliation can share.

## Detailed Design

### Public API

`rake-db` adds two migration methods to `Migration` and therefore to the `db` argument passed into `change` callbacks:

```ts
interface Migration<CT = unknown> {
  grant(params: GrantMigrationArg): Promise<void>;
  revoke(params: GrantMigrationArg): Promise<void>;
}
```

`GrantMigrationArg` is the strict public argument type for both existing-object grants and revokes. It should be built from the existing `pqb` `Grant.Privilege` target-specific union and add only the migration-specific `revokeMode` option.

```ts
import type { Grant as PqbGrant } from 'pqb';

type RevokeMode = 'CASCADE' | 'RESTRICT';
type GrantMigrationArg = PqbGrant.Privilege & {
  revokeMode?: RevokeMode;
};
```

- `to` accepts one role specification or a non-empty role list, following the existing `Grant.Role` contract. In `revoke`, `to` still names the roles whose privileges are revoked.
- `grantedBy` emits PostgreSQL `GRANTED BY <role>` for users who need to control or document the grantor context.
- `privileges` on `grant` emits an ordinary `GRANT ... ON ... TO ...` statement.
- `grantablePrivileges` on `grant` emits `GRANT ... ON ... TO ... WITH GRANT OPTION`.
- `privileges` on `revoke` emits ordinary `REVOKE ... ON ... FROM ...` and removes both ordinary privileges and their grant options, matching PostgreSQL behavior.
- `grantablePrivileges` on `revoke` emits `REVOKE GRANT OPTION FOR ... ON ... FROM ...` and leaves the underlying ordinary privilege in place.
- When both `privileges` and `grantablePrivileges` are present, `rake-db` emits separate statements so each privilege group has the correct grant-option behavior.
- `revokeMode` emits `CASCADE` or `RESTRICT` only when the emitted statement is a `REVOKE`; omitted mode uses PostgreSQL's default `RESTRICT` behavior without adding a keyword.

### Target and Privilege Semantics

The migration DSL uses the same target keys and privilege meanings as the related `Grant.Privilege` metadata contract.

- `schemas` maps to `ON SCHEMA` and accepts `Grant.SchemaPrivilege`.
- `tables` maps to `ON TABLE` and accepts `Grant.TablePrivilege`.
- `allTablesIn` maps to `ON ALL TABLES IN SCHEMA` and accepts `Grant.TablePrivilege`.
- `sequences` maps to `ON SEQUENCE` and accepts `Grant.SequencePrivilege`.
- `allSequencesIn` maps to `ON ALL SEQUENCES IN SCHEMA` and accepts `Grant.SequencePrivilege`.
- `routines` maps to `ON ROUTINE` and accepts `Grant.RoutinePrivilege`.
- `allRoutinesIn` maps to `ON ALL ROUTINES IN SCHEMA` and accepts `Grant.RoutinePrivilege`.
- `types` maps to `ON TYPE` and accepts `Grant.TypePrivilege`.
- `domains` maps to `ON DOMAIN` and accepts `Grant.DomainPrivilege`.
- `databases` maps to `ON DATABASE` and accepts `Grant.DatabasePrivilege`.
- `ALL` renders as `ALL PRIVILEGES` for the selected target kind.
- `TEMP` remains accepted as a database privilege alias for PostgreSQL `TEMPORARY`.
- `MAINTAIN` remains present in table privilege types, matching the existing grant metadata contract; PostgreSQL versions before 17 may reject SQL that uses it.

Object names are migration DSL strings. Schema prefixes are optional for tables, sequences, routines, types, and domains. When a concrete schema-scoped object name is unqualified, `rake-db` should use the same default-schema prefixing behavior already used throughout migrations, based on the configured or adapter current schema. Schema-wide targets such as `allTablesIn` name schemas directly and must not be auto-prefixed.

### Rollback Semantics

`grant` and `revoke` are reversible migration methods that use the same argument shape.

- On migrate, `grant` emits `GRANT`; on rollback, it emits the corresponding `REVOKE`.
- On migrate, `revoke` emits `REVOKE`; on rollback, it emits the corresponding `GRANT`.
- Rolling back a `grant.privileges` item emits an ordinary `REVOKE` for those privileges.
- Rolling back a `grant.grantablePrivileges` item emits an ordinary `REVOKE` for those privileges, removing both the privilege and grant option that the migration granted.
- Rolling back a `revoke.privileges` item emits an ordinary `GRANT` for those privileges.
- Rolling back a `revoke.grantablePrivileges` item emits `GRANT ... WITH GRANT OPTION` for those privileges.
- `revokeMode` applies only when the operation being emitted is a `REVOKE`. It applies to `grant` rollback and to `revoke` migrate, and is ignored for statements that emit `GRANT`.

### Shared State or Data Shape

Internal migration state should reuse the loose `Grant` shapes from `packages/pqb/src/query/extra-features/grants/grants.db.ts` whenever suitable. Public strictness belongs at the migration method boundary; internal AST and SQL-rendering types should use `string[]` privilege lists instead of duplicating public union literals.

`rake-db` should define one internal migration privilege interface in its grant migration subsystem:

```ts
import type { Grant as PqbGrant } from 'pqb/internal';

type RevokeMode = 'CASCADE' | 'RESTRICT';

interface GrantPrivilege extends PqbGrant.InternalPrivilege {
  revokeMode?: RevokeMode;
}
```

The `RakeDbAst` shape should use one grant AST node for both directions:

```ts
namespace RakeDbAst {
  interface Grant extends GrantPrivilege {
    type: 'grant';
    action: 'grant' | 'revoke';
  }
}
```

- Do not define separate public or AST interfaces for grant and revoke target bags.
- Cast the strict public `GrantMigrationArg` into the loose internal `GrantPrivilege` shape at the migration boundary after normalizing `to` to an array.
- If the existing `PqbGrant.InternalPrivilege` shape is not suitable, update or minimally extend `grants.db.ts`; do not introduce a second unrelated grant target/privilege bag in `rake-db`.

### Integration and Lifecycle

`rake-db` owns execution for this idea.

- Add grant SQL rendering in a migration subsystem organized like `pqb` default privileges: one focused grant feature module with shared target/privilege constants or maps and a small renderer, rather than spreading grant-specific rules through generic migration code.
- Add the methods to the mixed-in `Migration` class so existing `change(async (db) => ...)` migrations can call them.
- Execute generated statements through the migration adapter in the same way as other manual migration methods.
- Preserve the current migration logging and rollback flow.
- Do not add database introspection, generated migration comparison, generated migration reporting, or ORM metadata behavior in this idea.

`pqb` is affected only as the source of shared grant types.

- Public migration argument types should reuse strict `Grant` privilege unions that are already exported by `pqb`.
- Internal migration state should reuse loose `Grant` internal shapes from `grants.db.ts`.
- No query builder runtime behavior changes are part of this idea.

### Error Handling and Limits

- This feature does not validate that roles or target objects exist before emitting SQL.
- This feature does not expand `ALL`, deduplicate overlapping privilege lists, or compare effective privileges through role membership.
- This feature does not hide PostgreSQL errors for invalid privileges, unavailable version-specific privileges, invalid grant options to `PUBLIC`, invalid routine identities, or unsupported grantor contexts.
- Empty privilege groups produce no SQL for that group; a call with no renderable `privileges` or `grantablePrivileges` should be a no-op rather than an artificial runtime validation failure.
- Role membership grants are out of scope; this feature only covers object privileges.
- Column-level table grants and less common PostgreSQL grant targets are out of scope for this idea.

### Documentation

The migration writing guide should show how existing-object grants differ from default privileges for future objects. It should call out that table grants do not grant sequence access, schema `USAGE` is still needed for object lookup, revoking from `PUBLIC` does not prove a role lacks effective access through membership, schema prefixes are optional for concrete schema-scoped objects because migrations apply the configured default schema, and `GRANT` / `REVOKE` affect existing objects only.
