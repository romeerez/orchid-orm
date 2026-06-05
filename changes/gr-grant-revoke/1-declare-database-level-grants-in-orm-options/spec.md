## Summary

Add declarative `grants` and `defaultGrantedBy` options to `orchidORM` / `pqb` shared database options so projects can record desired PostgreSQL object grants in database metadata. Add `generatorIgnore.grants` so projects can declare which grantees or grant targets future grant reconciliation should ignore while still keeping grant intent in code. This idea only stores typed metadata; it does not emit `GRANT` / `REVOKE` SQL or generate grant migrations yet.

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
        to: 'app_user',
        allSequencesIn: ['public'],
        privileges: ['USAGE', 'SELECT', 'UPDATE'],
      },
      {
        to: 'readonly',
        grantedBy: 'security_admin',
        tables: ['public.project', 'public.task'],
        privileges: ['SELECT'],
      },
    ],
  },
  { ...tables },
);
```

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

- Add a typed top-level `grants` option to `DbSharedOptions`, available to `pqb` and `orm` database setup.
- Add an optional top-level `defaultGrantedBy` option and optional per-grant `grantedBy` metadata for future grant SQL generation.
- Store normalized grant declarations on `QueryInternal` beside existing role, default-privilege, RLS, extension, domain, and `generatorIgnore` metadata.
- Add `generatorIgnore.grants` selector config for roles and grant targets that should be ignored by future grant migration generation.
- Do not add grant SQL execution, database introspection, migration DSL, migration generation, or verification behavior in this idea.

## Assumptions

- The first metadata API should cover common database setup grants for schemas, tables, sequences, routines, types, domains, and databases, including schema-wide existing-object shortcuts for tables, sequences, and routines. Less common PostgreSQL grant targets such as large objects, parameters, languages, foreign data wrappers, foreign servers, and tablespaces remain out of scope until the migration DSL or generator needs them.

## Capabilities

- `grant-metadata`: Record desired PostgreSQL existing-object grants in shared database metadata without executing SQL.
- `grant-generation-ignore`: Let projects keep grant metadata in code while configuring which roles or grant targets future generated grant reconciliation should ignore.

## Detailed Design

### Public API

`pqb` adds a public `Grant` namespace, a `grants?: Grant.Privilege[]` option, and a `defaultGrantedBy?: string` option to `DbSharedOptions`. Because `orchidORM` adapter and setup options already extend `DbSharedOptions`, the same options become available in `orm` setup without a separate ORM-specific shape.

```ts
export interface DbSharedOptions extends QueryLogOptions {
  defaultGrantedBy?: string;
  grants?: Grant.Privilege[];
  generatorIgnore?: GeneratorIgnore;
}

export interface GeneratorIgnore {
  schemas?: string[];
  enums?: string[];
  domains?: string[];
  extensions?: string[];
  tables?: string[];
  grants?: Grant.Ignore;
}
```

- `to` accepts one role name or a non-empty array of role names. Use `'PUBLIC'`, `'CURRENT_ROLE'`, `'CURRENT_USER'`, or `'SESSION_USER'` when those PostgreSQL role specifications are intended.
- `defaultGrantedBy` records a default grantor role for future SQL generation when individual grant declarations do not specify `grantedBy`.
- `grantedBy` records the grantor role for a specific grant declaration and takes precedence over `defaultGrantedBy` for that declaration.
- Each grant item must identify exactly one target kind by using exactly one target key, such as `schemas`, `tables`, or `allTablesIn`. Combining target keys in one item is not part of the public contract; users should write separate items when privileges differ by target.
- The concrete grant interfaces are target-specific shapes with shared `to`, `grantedBy`, `privileges`, and `grantablePrivileges` properties. `Grant.Privilege` is the union that controls which privilege list belongs to which target key.
- `privileges` records ordinary privileges. `grantablePrivileges` records privileges granted with grant option.
- At least one of `privileges` or `grantablePrivileges` must be present in the type surface.
- Privilege names are target-specific. For example, table targets accept table privileges, schema targets accept schema privileges, and database targets accept database privileges.
- `'ALL'` means PostgreSQL `ALL PRIVILEGES` for the selected target kind. Orchid stores it as intent and does not expand it during this idea.
- Grant options to `'PUBLIC'` are rejected by TypeScript where the public type can detect the literal `'PUBLIC'`; otherwise PostgreSQL rules are enforced only when later SQL support executes the metadata.
- `generatorIgnore.grants.roles` selects grants by grantee role. For example, `roles: ['app_user']` means future grant generation ignores grants for `app_user`.
- Each `generatorIgnore.grants` target selector selects grants by the same target kind used in `grants`. For example, `tables: ['project']` ignores grants on the `project` table, and `allTablesIn: ['public']` ignores schema-wide existing-table grants for the `public` schema.
- A selector value may be a string, a regular expression, or an array of strings and regular expressions.

### Target Semantics

The metadata model distinguishes concrete object targets from schema-wide existing-object targets because PostgreSQL treats those as different `GRANT` forms.

- `schemas`, `tables`, `sequences`, `routines`, `types`, `domains`, and `databases` name concrete objects.
- `allTablesIn`, `allSequencesIn`, and `allRoutinesIn` represent PostgreSQL's `ALL ... IN SCHEMA` forms and apply to existing objects only.
- Concrete table targets include tables, views, materialized views, and foreign tables, matching PostgreSQL's table privilege form.
- `routines` represents routine execution privileges for functions and procedures at the metadata level. Routine identity strings should use PostgreSQL-compatible names, including argument types when overloads matter.
- Schema-scoped object names may be schema-qualified strings such as `'public.project'` or unqualified strings such as `'project'`. This applies to tables, sequences, routines, types, domains, and future selector matching for those target kinds.
- Column-level table grants are not part of this first metadata API.

### Privilege Sets

The public type surface defines target-specific privilege unions based on PostgreSQL object privileges and existing Orchid default-privilege naming.

```ts
export namespace Grant {
  export type TablePrivilege =
    | 'ALL'
    | 'SELECT'
    | 'INSERT'
    | 'UPDATE'
    | 'DELETE'
    | 'TRUNCATE'
    | 'REFERENCES'
    | 'TRIGGER'
    | 'MAINTAIN';

  export type SequencePrivilege = 'ALL' | 'USAGE' | 'SELECT' | 'UPDATE';
  export type RoutinePrivilege = 'ALL' | 'EXECUTE';
  export type TypePrivilege = 'ALL' | 'USAGE';
  export type DomainPrivilege = 'ALL' | 'USAGE';
  export type SchemaPrivilege = 'ALL' | 'USAGE' | 'CREATE';
  export type DatabasePrivilege =
    | 'ALL'
    | 'CREATE'
    | 'CONNECT'
    | 'TEMPORARY'
    | 'TEMP';
}
```

- `TEMP` is accepted as a database privilege alias for PostgreSQL `TEMPORARY`.
- `MAINTAIN` remains present in the type surface for table grants, matching current default-privilege support. Later SQL generation must filter it for PostgreSQL versions before 17.
- This idea does not add runtime privilege validation because TypeScript already constrains the supported public shape.

### Metadata Storage

`pqb` owns the shared option type and stores grant metadata on `QueryInternal`.

```ts
export interface QueryInternal {
  defaultGrantedBy?: string;
  grants?: Grant.InternalPrivilege[];
  generatorIgnore?: GeneratorIgnore;
}
```

- Runtime setup normalizes grant declarations only enough to make later consumers deterministic: `to` is stored as an array, target names are stored as arrays, and privilege arrays preserve user order.
- `defaultGrantedBy` is stored on query internal metadata next to `grants`. Per-grant `grantedBy` is stored unchanged on the normalized grant item.
- Normalization must not resolve object names, expand `'ALL'`, validate roles against `roles`, apply `defaultGrantedBy` into individual grant objects, apply current schema, or compare against database state.
- The metadata is available through `db.$qb.internal.grants` for first-party `orm` migration generation code, the same way roles and default privileges are available today.
- `generatorIgnore.grants` is stored unchanged on `QueryInternal.generatorIgnore`.
- Providing `grants` does not imply that `roles` must also be configured. Role creation/management remains separate.

### Grant Ignore Selectors

`generatorIgnore.grants` records future generator ignore intent. It does not affect current migration generation because this idea does not add grant reconciliation.

- `roles` ignores grants where any grantee matches the selector.
- Target selectors ignore grants whose target key and target name match the selector.
- Selectors for schema-wide targets, such as `allTablesIn`, match schema names rather than object names.
- String selectors match exact values. Regular expression selectors match the stored string value.
- For schema-scoped object targets, future matching must support both schema-qualified and unqualified names because users may declare either form in grant metadata.

### ORM and Migration Boundaries

`orm` should accept the new option through its existing `DbSharedOptions` integration and preserve it on the underlying query builder metadata. No generated migration behavior changes in this idea.

- `orchidORM` setup accepts `defaultGrantedBy` and `grants` for all supported adapters because adapter options already include shared database options.
- Migration generation must continue to ignore grant metadata until the later grant generator idea is implemented.
- `generatorIgnore.grants` has no current generator side effect beyond being stored; it is intentionally added now so projects can configure their desired future behavior early.
- This idea does not change `rake-db` migration interfaces, `introspectDbSchema`, `RakeDbAst`, `astToMigration`, or generated migration reports.

### Error Handling and Limits

- Invalid object names, missing roles, unavailable privileges, and PostgreSQL version-specific privilege restrictions are not checked by this metadata-only feature.
- Duplicate or overlapping grant declarations are preserved as user intent. Later generator work may canonicalize or report conflicts when it owns SQL comparison.
- This feature does not model revocation operations directly. Revokes are introduced by the migration DSL idea and by future generated reconciliation that treats missing configured grants as grants to remove.
- This feature does not manage effective privileges through role membership; it only records direct desired grants for the listed grantees.
