## Summary

Add first-class regular view classes to `orchid-orm`. Views are defined next to tables, are queryable through `db.$views`, participate in relations with tables and other views, default to read-only queries, and can be managed by generated regular-view migrations only when the user opts in by listing views in ORM options.

```ts
import { orchidORM } from 'orchid-orm';
import { BaseTable, sql } from './base-table';
import { UserTable } from './user.table';

export class MonthlySalesView extends BaseTable.View {
  schema = 'custom';
  readonly name = 'monthly_sales_view';
  securityInvoker = true;
  securityBarrier = true;

  columns = this.setColumns((t) => ({
    id: t.integer(),
    userId: t.integer(),
    total: t.decimal(),
  }));

  sql = sql`
    SELECT
      row_number() over () AS id,
      "userId",
      sum(total) AS total
    FROM sale
    GROUP BY "userId"
  `;

  relations = {
    user: this.belongsTo(() => UserTable, {
      columns: ['userId'],
      references: ['id'],
    }),
  };
}

export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    views: {
      monthlySales: MonthlySalesView,
    },
  },
  {
    user: UserTable,
  },
);

const rows = await db.$views.monthlySales
  .select('userId', 'total')
  .where({ userId: 1 })
  .limit(10)
  .offset(10);

await db.$views.monthlySales.create({ userId: 1, total: '10' });
//                         ^ TypeScript error: views are read-only by default.
```

```ts
export class UpdatableActiveUsersView extends BaseTable.View {
  readonly name = 'active_users';
  readonly readOnly = false;
  checkOption = 'CASCADED';

  columns = this.setColumns((t) => ({
    id: t.integer().primaryKey(),
    name: t.text(),
    active: t.boolean(),
  }));

  sql = sql`SELECT id, name, active FROM "user" WHERE active = true`;
}
```

```ts
const orm = bundleOrchidORM({
  views: {
    monthlySales: MonthlySalesView,
  },
  tables: {
    user: UserTable,
  },
});
```

## What Changes

- `createBaseTable` exposes `BaseTable.View`, a base class for defining regular PostgreSQL views with `name`, `columns`, `sql`, optional `schema`, relations, computed columns, scopes, soft delete, grants, and supported regular-view options.
- `orchidORM` and `orchidORMWithAdapter` accept view classes in the first options argument, and `bundleOrchidORM` accepts optional `views` and `tables` in a single object; all expose DB-aware view queries under `db.$views`.
- View queries use the existing query API and relation system, but an omitted `readOnly` maps to `true`; users may set `readonly readOnly = false` for simple updatable PostgreSQL views.
- View classes default `noPrimaryKey` to ignored behavior and do not support table-only `rls` declarations or `autoForeignKeys`.
- Relations work in all combinations: table-to-table, view-to-view, table-to-view, and view-to-table.
- Migration generation manages regular views only when ORM `views` are configured; declared views become desired `createView` state, and otherwise database views are not loaded or diffed.
- `generatorIgnore.views` supports string and regular-expression selectors for excluding regular views from view reconciliation.

## Assumptions

- First-class managed views require an `sql` definition on the view class so migration generation can create and compare declared views. Query-only view-backed objects without DDL ownership can continue to use normal table classes with `readonly readOnly = true`.
- `db.$views` exists as an object on every ORM instance and is empty when no views are configured, so application code has one stable namespace for view queries.

## Capabilities

- `orm-view-definition`: Defines regular PostgreSQL views as first-class ORM schema objects with table-like query metadata and view-specific defaults.
- `orm-view-registry`: Keeps configured view classes separate from table classes while exposing DB-aware queries under `db.$views` and letting relations resolve across both registries.
- `regular-view-schema-generation`: Converts configured ORM view classes into desired regular-view migration AST and reconciles them only when the user opted into view management.

## Detailed Design

### View Class API

`createBaseTable` exposes a nested `View` base class on the returned base table constructor. A view class is intentionally similar to a table class, but uses `name` for the database relation name instead of `table`.

```ts
class SomeView extends BaseTable.View {
  readonly name = 'some_view';
  schema = 'analytics';
  recursive = false;
  checkOption = 'LOCAL';
  securityBarrier = true;
  securityInvoker = true;

  columns = this.setColumns((t) => ({
    id: t.integer(),
  }));

  sql = sql`SELECT id FROM some_table`;
}
```

- `readonly name` is required and is the PostgreSQL view name without schema.
- `schema` accepts the same string or function shape as table `schema` and participates in query SQL the same way.
- `columns` uses the same `setColumns` API as tables. The migration `columns` option is derived from `Object.keys(columns.shape)` and is not user-supplied as an array.
- `sql` is required for view classes that are configured in ORM `views`; it must be a string or `RawSqlBase` compatible with `rake-db` `createView`.
- for view options, only the regular-view creation options that make sense for persistent ORM-managed views: `recursive`, `checkOption`, `securityBarrier`, and `securityInvoker`.
- view options must not expose `createOrReplace`, `dropIfExists`, `dropMode`, `temporary`, or `columns`.
- `computed`, `scopes`, `softDelete`, and `grants` have the same public meaning as on tables.
- `rls` and `autoForeignKeys` are not part of the view class contract.
- `noPrimaryKey` defaults to ignored behavior for views because PostgreSQL views do not have table primary keys. Users may still mark one or more columns with `primaryKey()` when they want ORM identity metadata for relation and query typing.
- `readonly readOnly = false` is the explicit opt-in for exposing mutation APIs. Omitting `readOnly` produces a read-only query.

The view class API does not replace existing view-backed table classes. A normal table class can still point at a database view, and `readonly readOnly = true` remains the migration-neutral query-only path.

### ORM Options and `$views`

`orchidORM`, adapter-specific `orchidORM`, and `orchidORMWithAdapter` accept configured view classes in the first options argument. `bundleOrchidORM` accepts a single object with optional `tables` and optional `views`.

```ts
const db = orchidORMWithAdapter(
  {
    db: existingDb,
    views: {
      monthlySales: MonthlySalesView,
    },
  },
  {
    user: UserTable,
  },
);

db.user;
db.$views.monthlySales;
```

`bundleOrchidORMTables` is renamed to `bundleOrchidORM`. It does not gain an overload; it accepts a single object with optional `tables` and optional `views`.

```ts
const onlyTables = bundleOrchidORM({
  tables: { user: UserTable },
});

const onlyViews = bundleOrchidORM({
  views: { monthlySales: MonthlySalesView },
});

const tablesAndViews = bundleOrchidORM({
  tables: { user: UserTable },
  views: { monthlySales: MonthlySalesView },
});
```

- Tables remain exposed directly on the ORM instance by their table registry key.
- Views are exposed only under `db.$views` by their view registry key.
- View registry keys do not collide with table registry keys because they live under `$views`; duplicate database object names in the same schema must still be rejected across tables and views.
- View options are ORM-level configuration and must not be forwarded to the lower-level query builder as unknown shared DB options.
- Split setup binds view helpers the same way it binds table helpers so helpers can be created before the DB-aware ORM instance exists.

### Query Mapping and Read-Only Defaults

A DB-aware view query is built with the same lower-level `Db` query object as a table query, but the public class property `name` is mapped to the query's internal table/relation name.

- The query `table` value used by SQL generation is the view class `name`.
- The query schema comes from view `schema` or the ORM default schema using the same precedence as tables.
- The query shape includes view columns and computed columns in the same way table queries do.
- When a view class omits `readOnly`, the generated query has the read-only capability set to `true`.
- When a view class declares `readonly readOnly = false`, the generated query is writable at the TypeScript level, subject to PostgreSQL accepting the actual view mutation.
- The runtime query object remains a query object over a PostgreSQL relation. This feature does not add runtime validation that a view is updatable.

### Relations Across Tables and Views

Relation declarations may reference table classes or view classes.

```ts
class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.integer().primaryKey(),
  }));

  relations = {
    monthlySales: this.hasMany(() => MonthlySalesView, {
      columns: ['id'],
      references: ['userId'],
    }),
  };
}
```

- Existing table-to-table relations continue to work unchanged.
- A view can define `belongsTo`, `hasOne`, `hasMany`, and `hasAndBelongsToMany` relations when its declared columns provide the needed join keys.
- A table relation may target a configured view class, and a view relation may target a configured table or view class.
- Relation lookup resolves classes across both the table registry and the view registry.
- Relation query metadata must preserve the target query's read-only capability. Nested mutations are unavailable when the target relation query is read-only.
- `autoForeignKeys` does not generate foreign keys for view relations or from view classes.

### Migration Generation

Configured view classes are the desired ORM-managed regular-view state. If no views are configured in ORM options, migration generation must not introspect or diff database regular views, so existing externally managed views are preserved by default.

When at least one view is configured:

- `rake-db` introspection loads regular views from the database only when the caller requests view loading and keeps the existing materialized-view handling separate.
- Code items include a `views` collection separate from `tables`.
- Each configured view maps to a `RakeDbAst.View` create-side item with the view schema, name, shape, SQL, dependencies, and options.
- The generated `createView` options use `columns: Object.keys(view.columns.shape)` plus the supported `recursive`, `checkOption`, `securityBarrier`, and `securityInvoker` options from the view class.
- View comparison and generated migration output use the existing regular-view migration API from `rake-db`.
- Dropping or changing an ORM-managed view follows the regular-view diff behavior established by the rake-db view migration support.
- Existing grants declared on view classes are included in effective grants as table-like grants targeting the view relation name.
- View RLS state is never generated from view classes.
- View relations do not create auto foreign keys.

Schema creation should include schemas referenced by configured views, just as it includes schemas referenced by configured tables and configured role/default-grant metadata.

### Ignoring Views

`generatorIgnore.views` excludes regular views from view reconciliation.

```ts
const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    views: {
      monthlySales: MonthlySalesView,
    },
    generatorIgnore: {
      views: ['legacy_view', /^external_/],
    },
  },
  tables,
);
```

- A string selector matches a normalized view name using the same schema-qualified format as table ignores: `view_name` for the current schema or `schema.view_name` for another schema.
- A regular expression selector matches the same normalized string form.
- Ignored views are skipped whether they are present only in the database, only in code, or in both places.
- `generatorIgnore.schemas` also ignores views in matching schemas.
- `generatorIgnore.grants.tables` continues to apply to table-like grant targets, including views, but grant-specific ignores only suppress grant reconciliation and do not suppress view DDL reconciliation.

### Package Boundaries

- `orm` owns the view class API, ORM options, `$views` namespace, relation registry integration, view-to-query mapping, and conversion from configured view classes into migration-generator code items.
- `pqb` owns only shared option and ignore-selector types needed by ORM options, plus any query-builder type surface required to represent read-only view queries through the existing read-only capability.
- `rake-db` remains the owner of regular-view DDL AST, `createView`/`dropView` SQL generation, and the opt-in database-structure switch that loads regular views only when the ORM generator asks for them.
- Docs should describe view definitions near table definitions and migration generation, with a clear note that views are not managed unless listed in ORM `views`.

### Error Handling and Limits

- Configuring two tables/views with the same schema-qualified database name is an ORM setup error.
- A configured view without a `name`, `columns`, or `sql` definition is an ORM setup or TypeScript error, matching how missing table metadata is handled today.
- PostgreSQL remains responsible for rejecting invalid view SQL, invalid recursive-view syntax, unsupported `WITH CHECK OPTION` combinations, and writes to non-updatable views.
- The feature covers regular PostgreSQL views only. Materialized view class definitions and refresh operations remain separate work.
- Temporary views, `CREATE OR REPLACE`, drop options, and externally managed trigger/rule details are not part of this API.

### Documentation

Document that `BaseTable.View` is the first-class path for ORM-managed regular views, while a normal read-only table class remains available for externally managed query-only views. Call out the default read-only behavior, the explicit `readOnly = false` opt-in for simple PostgreSQL updatable views, the `$views` namespace, supported view options, relation support, and the migration-generator opt-in behavior.
