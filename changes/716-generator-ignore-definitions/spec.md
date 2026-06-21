## Summary

Add `generatorIgnore = true` to table, regular view, and materialized view class definitions so manually managed table-like database objects stay queryable while generated migrations leave their DDL unmanaged.

```ts
class LegacyReport extends BaseTable {
  readonly table = 'legacy_report';
  generatorIgnore = true;

  columns = this.setColumns((t) => ({
    id: t.integer().primaryKey(),
    payload: t.json(),
  }));
}

class LegacyReportView extends BaseTable.View {
  name = 'legacy_report_view';
  generatorIgnore = true;
  sql = BaseTable.sql`SELECT id, payload FROM legacy_report`;

  columns = this.setColumns((t) => ({
    id: t.integer(),
    payload: t.json(),
  }));
}

class LegacyReportMaterializedView extends BaseTable.MaterializedView {
  name = 'legacy_report_materialized_view';
  generatorIgnore = true;
  sql = BaseTable.sql`SELECT id, payload FROM legacy_report`;

  columns = this.setColumns((t) => ({
    id: t.integer(),
    payload: t.json(),
  }));
}
```

## What Changes

- Add a definition-side `generatorIgnore = true` option to `BaseTable`, `BaseTable.View`, and `BaseTable.MaterializedView` instances.
- Keep ignored definitions available in runtime ORM query APIs, relations, validation schema generation, and materialized-view refresh APIs.
- Make migration generation skip create, change, schema-move, drop, and nested reconciliation for ignored table definitions.
- Make migration generation skip create, change, and drop reconciliation for ignored regular and materialized view definitions.
- Document definition-side ignore as a local alternative to config-level `generatorIgnore.tables` and `generatorIgnore.views`, not as a replacement for config-level selectors.

## Assumptions

- Definition-side ignored tables should behave like entries in top-level `generatorIgnore.tables`; this means existing generator behavior for table-local grants and RLS follows the same top-level table ignore semantics.
- Definition-side ignored views should behave like entries in `generatorIgnore.views`; view DDL is ignored, while grants on the view still require the existing grant ignore controls when users want grant reconciliation ignored too.

## Capabilities

- `definition-generator-ignore`: Carries table-like definition ignore intent from ORM class metadata into migration generation and applies it to table, regular view, and materialized view reconciliation.

## Detailed Design

### Public API

Table-like ORM definitions accept an optional literal `generatorIgnore = true` property.

```ts
interface BaseTableInstance<ColumnTypes> {
  /**
   * Keep this table-like definition available at runtime, but exclude it from
   * generated migration DDL reconciliation.
   */
  generatorIgnore?: true;
}
```

- The option is valid on ordinary table classes, regular view classes, and materialized view classes.
- Only literal `true` enables the behavior. Omitted, `undefined`, or `false` means the definition remains generator-managed.
- The property does not change runtime query behavior. Ignored tables and views are still included in `db`, `db.$views`, relations, schema generation, read-only view enforcement, and materialized-view refresh support.
- The property is intentionally not added to columns, constraints, indexes, checks, foreign keys, RLS policies, grants, enums, domains, schemas, roles, extensions, or default privileges.

### Shared Metadata

Definition-side ignore intent should be normalized into query internal metadata when `orchidORM` constructs table and view query objects.

```ts
interface QueryInternal {
  generatorIgnored?: true;
}
```

The metadata belongs to the query object for the table-like definition that declared the property. It should not be copied from a base class unless normal JavaScript class inheritance makes the property visible on the concrete definition instance.

### Table Migration Generation

For ordinary tables, `generatorIgnored` is equivalent to listing the resolved table name in config-level `generatorIgnore.tables`.

- Ignored code tables are not created when absent from the database.
- Ignored code tables are not changed when present in the database.
- Ignored code tables are not matched as schema-move candidates.
- Ignored database tables are not dropped when they match an ignored code table by resolved schema and table name.
- The whole table is unmanaged by generated migrations: table DDL, columns, constraints, indexes, checks, foreign keys, RLS table flags, RLS policies, and table-local DDL reconciliation through that table are skipped.
- Existing config-level `generatorIgnore.schemas` and `generatorIgnore.tables` remain supported and idempotent when they also match the same table.

### View Migration Generation

For regular and materialized views, `generatorIgnored` is equivalent to listing the resolved view name in config-level `generatorIgnore.views`.

- Ignored code views are not created when absent from the database.
- Ignored code views are not changed or recreated when present in the database.
- Ignored database views are not dropped when they match an ignored code view by resolved schema and view name.
- For regular views, ignored DDL includes SQL, columns, recursive, check-option, security-barrier, and security-invoker reconciliation.
- For materialized views, ignored DDL includes SQL, columns, `withData`, dependencies, and view index reconciliation that belongs to materialized-view generation.
- Existing config-level `generatorIgnore.schemas` and `generatorIgnore.views` remain supported and idempotent when they also match the same view.

### Grants and Partial Management

Definition-side ignore does not introduce new partial-management behavior.

- Ignored tables follow existing top-level table ignore behavior, including any existing grant and RLS interactions of `generatorIgnore.tables`.
- Ignored views follow existing `generatorIgnore.views` behavior: view DDL is ignored, but view grants are not ignored by this option alone.
- Users who need to ignore grants should continue to use `generatorIgnore.grants`.
- Users who need to ignore only table RLS state while still managing ordinary table DDL should continue to use `generatorIgnore.rls`.

### Documentation

The generated migration docs should show definition-side `generatorIgnore = true` beside config-level `generatorIgnore`.

- Explain that definition-side ignore is best for tables and views that are represented in code for querying but are created or changed outside Orchid.
- Keep config-level `generatorIgnore` documented as the right tool for regex selectors, schema-wide ignores, environment-specific ignores, provider-created objects, and objects without table/view class definitions.
- The view guide should mention `generatorIgnore = true` for both `BaseTable.View` and `BaseTable.MaterializedView`, and should keep the existing note that there is no separate materialized-view ignore option.
