## Summary

Make `rake-db` create views with `securityInvoker: true` by default, so views created through Orchid use caller permissions and caller RLS policies unless the migration explicitly opts out.

```ts
await db.createView(
  'visible_projects',
  `
    SELECT id, name
    FROM project
  `,
);
// Generates CREATE VIEW ... WITH ( security_invoker = true ) ...
```

```ts
await db.createView(
  'owner_checked_projects',
  {
    with: {
      securityInvoker: false,
    },
  },
  `
    SELECT id, name
    FROM project
  `,
);
// Explicit opt-out keeps PostgreSQL's owner-checked view behavior.
```

## What Changes

- Change `rake-db` `createView` / rollback-side `dropView` creation SQL so omitted `with.securityInvoker` means `true` when creating a view.
- Preserve `with.securityInvoker: false` as the explicit opt-out for PostgreSQL's default owner-checked view behavior.
- Update create-view user docs to say `securityInvoker: true` is Orchid's default because it is safer for views over RLS-managed tables.
- Keep ORM generated migrations out of scope because they do not currently support views.
- Keep this idea scoped to the view option default and docs; do not add uniqueness-check or foreign-key RLS guidance in this change.

## Capabilities

This idea extends the existing `rake-db` manual view creation surface. It does not introduce a standalone capability.

## Detailed Design

### Public API

The public `createView` / `dropView` overloads keep their current shape. The semantic change is the default for `options.with.securityInvoker` during view creation.

```ts
export interface ViewOptions {
  createOrReplace?: boolean;
  dropIfExists?: boolean;
  dropMode?: DropMode;
  temporary?: boolean;
  recursive?: boolean;
  columns?: string[];
  with?: {
    checkOption?: 'LOCAL' | 'CASCADED';
    securityBarrier?: boolean;
    securityInvoker?: boolean;
  };
}
```

- Omitting the options object creates the view with `security_invoker = true`.
- Providing options without `with.securityInvoker` also creates the view with `security_invoker = true`.
- Providing `with.securityInvoker: true` keeps the current explicit true behavior.
- Providing `with.securityInvoker: false` opts out and creates the view with PostgreSQL's ordinary owner-checked behavior. If no other `WITH` options are present, the generated SQL may omit the `WITH` clause entirely; if other `WITH` options are present, it must not include `security_invoker = true`.
- The changed default applies only to create-side SQL. Drop-side SQL remains governed by existing drop options such as `dropIfExists` and `dropMode`.

### ORM Generated Migrations Boundary

ORM generated migrations do not currently support view declarations from application code. The generator pulls database structures with `views: []` for generated comparisons, and the public docs list views as migration-only support.

Because of that boundary, this idea must not add tasks or behavior for generated view migrations. The only migration-generation-related behavior in scope is the normal rollback behavior of manual `createView` / `dropView` migration methods.

### RLS Boundary

This change is intentionally limited to the existing view creation feature. It does not introduce new RLS policy APIs, grant management, uniqueness handling, or foreign-key behavior.

The security reason for the default is that views over RLS-managed tables are commonly expected to enforce the caller's permissions and RLS policies. PostgreSQL's ordinary view behavior uses the view owner for underlying table checks unless security-invoker behavior is requested on supported PostgreSQL versions.

### Documentation

The create-view docs should state that Orchid defaults `securityInvoker` to `true` for safer behavior with RLS-managed tables, and should show `securityInvoker: false` as the explicit opt-out when owner-checked view behavior is intentional.

RLS docs may refer readers to the create-view option, but this idea should not add or expand guidance about uniqueness checks or foreign keys.
