## Summary

Make Orchid's RLS table declaration safer by default: omitted `force` now means `true`, even though PostgreSQL's table default is `NO FORCE ROW LEVEL SECURITY`. Keep RLS policy intent visible by requiring `permit` and making it non-empty, so users cannot accidentally declare an RLS table without any policy that can allow access.

```ts
rls = defineRls({
  enable: true,
  permit: [
    {
      name: 'project_select_same_tenant',
      for: 'SELECT',
      to: 'app_user',
      using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
  ],
});
// Orchid treats omitted `force` as `force: true` and generates FORCE ROW LEVEL SECURITY
// when the database is currently not forced.
```

```ts
rls = defineRls({
  enable: true,
  force: false,
  // Explicitly opt out when table-owner bypass behavior is intentional.
  permit: [
    {
      name: 'project_select_same_tenant',
      for: 'SELECT',
      to: 'app_user',
      using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
  ],
});
```

```ts
rls = defineRls({
  enable: true,
  // @ts-expect-error empty permit arrays are not allowed
  permit: [],
});

rls = defineRls({
  enable: true,
  // @ts-expect-error permit is required
});
```

## What Changes

- Change Orchid's code-side default for omitted table RLS `force` from `false` to `true`.
- Keep PostgreSQL/database introspection semantics as `force: false` when the table is not forced, so generated migrations compare Orchid's desired default against the database's actual default.
- Update the `defineRls`/table RLS TypeScript surface so `permit` is required and must contain at least one policy.
- Keep the `permit` tightening type-only, with no runtime checks.
- Update user-facing RLS and migration-generation docs to explain the safer Orchid default, why it differs from PostgreSQL, and how to opt out with `force: false`.

## Capabilities

This idea extends existing RLS declaration, migration-generation, and documentation surfaces. It does not introduce a standalone capability.

## Detailed Design

### Table RLS Defaults

For ORM table declarations, omitted `force` means `true` after table-level defaults are applied.

```ts
export interface TableRlsConfig {
  enable?: boolean;
  force?: boolean;
  permit: [RlsPolicy.Policy, ...RlsPolicy.Policy[]];
  restrict?: RlsPolicy.Policy[];
}
```

- `enable` keeps its current omitted default of `false`.
- `force` changes its Orchid declaration default to `true` for tables that have an `rls` declaration and omit `force`.
- `orchidORM({ rls: { tableRlsDefaults: { force } } })` continues to override the omitted table value. Projects that need PostgreSQL owner-bypass behavior can set `tableRlsDefaults.force: false`, and individual tables can still set `force: false`.
- Tables without an `rls` declaration remain outside RLS migration management and do not receive any RLS defaults.

### Migration Generation Semantics

Migration generation must compare two different kinds of defaults:

- Code-side default: omitted table `force`, after project defaults, is `true`.
- Database-side default: an introspected or absent forced flag means `false` unless PostgreSQL reports `FORCE ROW LEVEL SECURITY`.

This distinction is required because PostgreSQL defaults table owners to bypass RLS, while Orchid's declaration default intentionally favors owner-tested safety. A table with `rls = defineRls({ enable: true })` should generate `enableRls` and `forceRls` when the database table is enabled neither for RLS nor forced.

Existing explicit values keep their meaning:

- `force: true` generates or preserves `FORCE ROW LEVEL SECURITY`.
- `force: false` generates or preserves `NO FORCE ROW LEVEL SECURITY`.
- Project `tableRlsDefaults.force` applies before the Orchid code-side fallback.

### Permit Policy Typing

`permit` is required and TypeScript must require at least one policy item. Users can still express restrictive policies with `restrict`, but every table RLS declaration must include at least one permissive policy because restrictive policies cannot allow access by themselves.

The type change is limited to the existing exported `TableRlsConfig` interface and existing `RlsPolicy.Policy` type in `packages/pqb/src/query/extra-features/rls/rls.db.ts`. Other related types should not be redesigned or separately tightened for this idea.

- `defineRls({ permit: [] })` should become a TypeScript error.
- `defineRls({})`, `defineRls({ enable: true })`, and `defineRls({ restrict: [...] })` should become TypeScript errors because they omit the required permissive policy list.
- No runtime validation is added for an empty `permit` array.

### Documentation

User-facing docs should explicitly say that Orchid's omitted `force` default is `true`, which is different from PostgreSQL's default table-owner bypass behavior. The explanation should connect the default to the RLS safety boundary: application tests and migration-time checks often run through owner-like connections, so forcing owner checks makes RLS behavior less likely to look correct while production app roles behave differently.

Docs should also state the opt-out path:

- set `force: false` on an individual table declaration, or
- set `orchidORM({ rls: { tableRlsDefaults: { force: false } } })` when a project intentionally wants PostgreSQL's owner-bypass default for omitted table declarations.

Documentation that shows `tableRlsDefaults` examples must stop presenting `force: false` as the ordinary default without explanation.
