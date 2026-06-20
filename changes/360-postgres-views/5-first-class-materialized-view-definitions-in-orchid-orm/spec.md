## Summary

Add first-class materialized view classes to `orchid-orm` by reusing the regular `BaseTable.View`, ORM `views`, `$views`, relation, ignore, and migration-generator design wherever possible. Materialized views are always read-only query objects, carry a type-level `materialized: true` marker, support `withData` for generated migrations, and can be refreshed through a typed runtime query helper.

```ts
import { orchidORM, refreshMaterializedView } from 'orchid-orm';
import { BaseTable, sql } from './base-table';
import { UserTable } from './user.table';

export class MonthlySalesView extends BaseTable.MaterializedView {
  readonly name = 'monthly_sales';
  withData = false;

  columns = this.setColumns((t) => ({
    userId: t.integer(),
    month: t.date(),
    total: t.decimal(),
  }));

  sql = sql`
    SELECT
      "userId",
      date_trunc('month', "createdAt")::date AS month,
      sum(total) AS total
    FROM sale
    GROUP BY "userId", date_trunc('month', "createdAt")::date
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
    generatorIgnore: {
      views: ['legacy_materialized_view', /^external_/],
    },
  },
  {
    user: UserTable,
  },
);

const rows = await db.$views.monthlySales.where({ userId: 1 });

await db.$views.monthlySales.create({ userId: 1 });
//                         ^ TypeScript error: materialized views are read-only.

await refreshMaterializedView(db.$views.monthlySales, {
  concurrently: true,
  withData: true,
});
```

## What Changes

- `createBaseTable` exposes `BaseTable.MaterializedView`, implemented as a materialized specialization of `BaseTable.View`.
- `BaseTable.MaterializedView` query objects always have `readOnly: true` and `materialized: true` at the type level.
- `pqb` `Query` metadata stores `materialized?: true` in the same style as `readOnly`, and clones/query transformations preserve it.
- `pqb` exposes `refreshMaterializedView(query, options?)` from `query/extra-features/materialized-view/materialized-view.query.ts`; it accepts only query objects with `materialized: true`.
- Materialized view classes support `withData?: boolean`, and ORM migration generation passes it to `rake-db` materialized-view AST/options.
- ORM materialized views reuse the existing `views` option, `$views` namespace, relation resolution, `generatorIgnore.views`, and `loadViews` migration-generator switch instead of adding separate materialized-view registries.
- `rake-db` uses the existing `loadViews` introspection boolean for materialized views as well as regular views.

## Assumptions

- Materialized views are never writable through the normal ORM mutation API, so `BaseTable.MaterializedView` must not support the regular view `readOnly = false` opt-in.

## Capabilities

- `materialized-query-capability`: Adds a query-level materialized marker and typed refresh helper for runtime `REFRESH MATERIALIZED VIEW`.
- `orm-materialized-view-definition`: Defines materialized views as first-class ORM view objects that reuse the regular view registry and migration-generator flow with materialized-specific DDL metadata.

## Detailed Design

### Materialized View Class API

`createBaseTable` exposes `BaseTable.MaterializedView` next to `BaseTable.View`.

```ts
class SomeMaterializedView extends BaseTable.MaterializedView {
  readonly name = 'some_materialized_view';
  schema = 'analytics';
  withData = false;

  columns = this.setColumns((t) => ({
    id: t.integer(),
  }));

  sql = sql`SELECT id FROM some_table`;
}
```

- `BaseTable.MaterializedView` extends the existing `BaseTable.View` class/interface and should share its table-like column, schema, computed, scope, soft-delete, grant, and relation behavior where that behavior already applies to queryable read-only relations.
- The materialized specialization sets `materialized: true` on the instance and resulting query type.
- The materialized specialization keeps `readOnly: true` and must not expose the regular-view write opt-in. User code should not be able to make a materialized view query writable by declaring `readOnly = false`.
- `name`, `schema`, `columns`, and `sql` have the same meaning as on regular views.
- Regular-view-only DDL options are not part of the materialized view contract: `recursive`, `checkOption`, `securityBarrier`, and `securityInvoker`.
- `withData?: boolean` is the materialized-view creation option. `false` emits `WITH NO DATA`, `true` emits `WITH DATA`, and omission lets PostgreSQL use its default.
- Table-only options such as table RLS, `autoForeignKeys`, and direct table primary-key requirements remain outside the materialized view contract.

### Query Materialized Marker

`pqb` query types gain a materialized capability marker in the same style as `readOnly`.

```ts
interface Query {
  materialized: true | undefined;
}

namespace Query {
  interface MaterializedQuery extends Query {
    __materialized: true;
  }
}
```

- The marker is type metadata for query capabilities and is also available on query objects in the same way `readOnly` is.
- `Db` receives the marker through table/query construction options and exposes it as `query.__materialized` (only the type).
- Query cloning and read-oriented query transformations preserve the marker.
- Normal tables and regular views have `__materialized: undefined`.
- Materialized views have both `__readOnly: true` and `__materialized: true`.

### Runtime Refresh Helper

`pqb` adds `query/extra-features/materialized-view/materialized-view.query.ts` exporting `refreshMaterializedView`.

```ts
interface RefreshMaterializedViewOptions {
  concurrently?: boolean;
  withData?: boolean;
}

function refreshMaterializedView<T extends Query.MaterializedQuery>(
  query: T,
  options?: RefreshMaterializedViewOptions,
): Promise<void>;
```

- The helper accepts a query object, derives the schema-qualified materialized view name from that query, and executes `REFRESH MATERIALIZED VIEW`.
- `concurrently: true` emits `CONCURRENTLY`.
- `withData: false` emits `WITH NO DATA`; `withData: true` emits `WITH DATA`; omitted `withData` omits the clause.
- `concurrently: true` combined with `withData: false` is rejected before SQL execution, matching the migration helper behavior.
- The helper is a runtime operation, not a query builder chain, so it returns `Promise<void>` after executing against the query's adapter.
- PostgreSQL remains responsible for state-dependent refresh constraints such as requiring a suitable unique index for concurrent refresh and requiring the materialized view to already be populated.

### ORM Registration and `$views`

Materialized views reuse the existing regular-view ORM registration surface.

```ts
const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    views: {
      monthlySales: MonthlySalesView,
      activeUsers: ActiveUsersView,
    },
  },
  tables,
);

db.$views.monthlySales;
```

- The `views` option accepts both `BaseTable.View` and `BaseTable.MaterializedView` classes.
- Both regular and materialized views are exposed under `db.$views` by the configured key.
- Materialized views participate in the same relation resolution as regular views: table-to-materialized-view, materialized-view-to-table, and view-to-view relations work when the declared columns provide the needed join keys.
- Duplicate schema-qualified database relation names are rejected across tables, regular views, and materialized views.
- Grants declared on materialized view classes remain table-like relation grants and target the materialized view relation.
- `generatorIgnore.views` and `generatorIgnore.schemas` apply to both regular and materialized views. There is no separate `generatorIgnore.materializedViews` option.

### Migration Generation

Configured materialized view classes become desired ORM-managed materialized-view state while using the same opt-in ownership model as regular views.

- If no ORM views are configured, migration generation must not load or diff regular views or materialized views.
- When any ORM view is configured, `rake-db` introspection uses `loadViews: true` to load both regular views and materialized views.
- Code items can distinguish regular views from materialized views via `query.__materialized` or equivalent internal metadata, but they stay in the same view collection because the public ORM surface is still `views`.
- A configured materialized view maps to a `RakeDbAst.MaterializedView` create-side item with schema, name, shape, SQL, dependencies, `columns: Object.keys(view.shape)`, and `withData` when the class defines it.
- Generated migration output uses `createMaterializedView` and `dropMaterializedView`, never regular `createView` or `dropView`, for materialized view classes.
- Existing materialized-view comparison, dependency ordering, index handling, and generated migration output from `rake-db` should be reused.
- Ignored materialized views are skipped whether they are present only in code, only in the database, or in both places, using the same normalized view-name matching as regular views.

### Package Boundaries

- `pqb` owns the query-level `__materialized` marker and the runtime `refreshMaterializedView` helper.
- `orm` owns `BaseTable.MaterializedView`, mapping materialized view classes into read-only materialized query objects, `$views` typing, relation registry integration, and conversion from configured materialized view classes into migration-generator code items.
- `rake-db` owns materialized-view introspection, AST, `createMaterializedView` / `dropMaterializedView` / migration-time `refreshMaterializedView`, generated SQL, dependency ordering, and the `loadViews` switch behavior.
- Docs should describe materialized views as part of the existing views story, with a clear distinction between regular views, materialized views, creation `withData`, refresh, indexes, and stale stored data.

### Error Handling and Limits

- TypeScript prevents calling `refreshMaterializedView` on regular views and tables because they do not have `__materialized: true`.
- TypeScript prevents normal ORM mutations on materialized views because they are read-only.
- Runtime refresh rejects only `concurrently: true` with `withData: false`, because that invalid combination is fully known from the option object.
- PostgreSQL validates invalid materialized-view SQL, missing dependencies, unsupported refresh state, missing unique indexes for concurrent refresh, and database permissions.
- Temporary materialized views, `CREATE OR REPLACE MATERIALIZED VIEW`, and materialized-view-specific write opt-ins are not supported.

### Documentation

Document materialized view classes in the view guide near regular view classes. The docs should show `BaseTable.MaterializedView`, registration through `views`, querying through `$views`, `withData`, refreshing with `refreshMaterializedView`, `generatorIgnore.views`, and the fact that `loadViews`/generated migrations manage materialized views only when ORM views are configured. Link or refer to migration-writing docs for manual `createMaterializedView`, indexes, and PostgreSQL refresh constraints.
