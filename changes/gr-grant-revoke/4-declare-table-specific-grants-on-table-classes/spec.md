## Summary

Add table-local grant declarations on ORM table classes so table-specific PostgreSQL table privileges can live next to the table definition while still feeding the existing central grant reconciliation flow.

```ts
import { setGrants } from 'orchid-orm';
import { BaseTable } from './base-table';

export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    tenantId: t.uuid(),
    name: t.text(),
  }));

  grants = setGrants([
    {
      to: 'app_user',
      privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
    {
      to: 'reporting_user',
      privileges: ['SELECT'],
    },
  ]);
}
```

Table grants merge with top-level ORM grants before generation:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    defaultGrantedBy: 'app_owner',
    grants: [
      {
        to: 'app_user',
        schemas: ['public'],
        privileges: ['USAGE'],
      },
      {
        to: 'app_user',
        allSequencesIn: ['public'],
        privileges: ['USAGE', 'SELECT', 'UPDATE'],
      },
    ],
  },
  {
    project: ProjectTable,
  },
);
```

Generated grant migrations continue to use ordinary `db.grant` / `db.revoke` calls:

```ts
change(async (db) => {
  await db.grant({
    to: 'reporting_user',
    tables: ['project'],
    privileges: ['SELECT'],
    grantedBy: 'app_owner',
  });
});
```

## What Changes

- Add a table-class `grants = setGrants([...])` declaration API for table-object grants.
- Add a table-local grant type that reuses existing `Grant.Role` and `Grant.TablePrivilege` semantics without requiring users to repeat the table name.
- Merge table-local grants with top-level `orchidORM` / `pqb` grant metadata into one effective grant view for migration generation.
- Preserve existing `defaultGrantedBy`, per-grant `grantedBy`, `generatorIgnore.grants`, and generated `db.grant` / `db.revoke` behavior.
- Document table-local grants beside generated grants and RLS guidance.

## Assumptions

- Table-local grants in this idea target the whole table object only. Column-level grants are not added because the existing public grant metadata, introspection, migration DSL, and generator state do not model column ACL targets.
- Table-local grants intentionally do not accept a `schema` or `tables` property. The table class already defines the table name and schema, and allowing overrides would make table-local declarations less reviewable.

## Capabilities

- `table-grant-metadata`: Declare whole-table PostgreSQL grant intent on ORM table classes and expose it to the existing grant reconciliation pipeline as normalized table grant metadata.

## Detailed Design

### Public API

`orm` adds a standalone `setGrants` identity helper and a `grants` metadata property to `ORMTableInput`. The helper mirrors `defineRls`: it does not belong to `BaseTable`, and its main job is to preserve a precise table-local grant type without making table classes depend on another base-class method.

```ts
export namespace Grant {
  export interface TableClassGrant {
    to: Role;
    grantedBy?: string;
    privileges?: TablePrivilege[];
    grantablePrivileges?: TablePrivilege[];
  }
}

export const setGrants = <Grants extends readonly Grant.TableClassGrant[]>(
  grants: Grants,
): Grants => grants;

export interface ORMTableInput {
  grants?: readonly Grant.TableClassGrant[];
}
```

- `to`, `grantedBy`, `privileges`, and `grantablePrivileges` keep the same meaning as top-level `Grant.TableGrant` metadata.
- `privileges` grants ordinary table privileges. `grantablePrivileges` grants table privileges with grant option.
- Supported privilege names are the existing `Grant.TablePrivilege` union: `ALL`, `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN`.
- `setGrants` accepts a readonly array of table grant objects and returns it unchanged for assignment to the `grants` class field.
- `setGrants` is exported from `orm` public API beside `defineRls`; users should import it from `orchid-orm` rather than call it through `this` or `BaseTable`.
- A table-local grant item must not accept target properties such as `tables`, `allTablesIn`, `schemas`, or a table-local schema override. Users should use top-level `grants` for cross-table, schema-wide, or non-table targets.
- The public API does not execute SQL at table construction time. It records metadata for the same generated migration flow that already handles top-level grants.

### Effective Grant Metadata

`orm` treats top-level grants and table-local grants as two authoring surfaces for one desired grant state.

- Top-level `orchidORM` / `pqb` `grants` remain the right place for schema grants, sequence grants, routine grants, database grants, schema-wide existing-object grants, and cross-cutting table grants.
- Table-local `grants` are converted to ordinary internal table grants by attaching the resolved table target to each declaration.
- If a table has an explicit schema, the normalized table target is schema-qualified. If the table relies on the current generation schema, the generated migration may keep the table target unqualified, matching existing grant output behavior.
- Dynamic table schemas are resolved the same way migration generation resolves table schemas elsewhere: use the table query schema during generation, not a separate schema value inside the grant declaration.
- The effective grant list is deterministic: top-level grants are preserved, then table-local grants are appended in ORM table registration order and table field order.
- Equivalent declarations from top-level and table-local sources represent one desired state. During reconciliation, duplicate ordinary privileges should not create duplicate generated grants, and a grantable declaration for a privilege should win over an ordinary duplicate for the same grantee, grantor, and table.

### ORM Integration and Lifecycle

Table-local grant metadata is collected when `orchidORM` binds table classes and made available to migration generation before `composeMigration` runs.

- `assignTablesToOrm` should preserve each table instance's `grants` metadata on the resulting table query internal state or another generation-visible table metadata path.
- Migration generation should build an effective internal grant view from global grants plus table-local grants after table schemas are known and before grant reconciliation decides whether to load database grants.
- The existing `processGrants` generator remains the owner of comparing desired grants with introspected ACL grants and emitting `RakeDbAst.Grant` items.
- `loadGrants` must become true when either top-level grant metadata or table-local grant metadata exists.
- `defaultGrantedBy` applies to table-local grants exactly as it applies to top-level grants. A table-local `grantedBy` overrides `defaultGrantedBy` for that declaration.
- `generatorIgnore.grants.roles`, `generatorIgnore.grants.tables`, and top-level `generatorIgnore.tables` apply to table-local grants after they are normalized into table targets.

### Package Boundaries

`pqb` owns the reusable public grant type additions because `Grant` is already exported from `pqb` and re-exported by `orm`. `orm` owns the standalone `setGrants` helper, the table-class metadata field, and the conversion from table-local grants into effective internal grant metadata.

- `pqb` should add only type surface needed for `Grant.TableClassGrant`; it should not learn about ORM table classes or the standalone `setGrants` helper.
- `orm` should import grant internals through `pqb/internal` where implementation needs internal grant shapes.
- `rake-db` should not change for this idea because manual grant/revoke migration methods, grant AST rendering, and grant introspection already operate on normalized table grant metadata.

### Error Handling and Limits

- Invalid target keys on table-local grants should be rejected by TypeScript rather than by runtime validation.
- This idea does not add column-level grants, table-specific sequence grants, schema grants, or automatic sequence inference for identity columns. Those remain top-level grant declarations.
- Table-local grants do not prove effective access. PostgreSQL role membership, ownership, `PUBLIC`, and superuser behavior can still make effective privileges broader than direct ACL entries.
- When `MAINTAIN` is used against a PostgreSQL version that does not support it, the existing grant SQL/generation path owns the resulting database compatibility behavior; table-local grants do not add a separate version gate.

### Documentation

Docs should show table grants near table definition and RLS guidance because RLS policies still require ordinary table privileges. The generated migration docs should explain when to use top-level grants versus table-local grants and call out that sequence access remains separate from table access.
