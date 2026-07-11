## Summary

Add an optional database relation name for tables and views so Orchid can keep ergonomic TypeScript table aliases while emitting the correct PostgreSQL table or view names in SQL and generated migrations.

```ts
export const BaseTable = createBaseTable({
  snakeCase: true,
});

export class UserTable extends BaseTable {
  readonly table = 'User';
  // nameInDb defaults to 'user' because BaseTable has snakeCase: true.
  columns = this.setColumns((t) => ({
    Id: t.identity().primaryKey(),
    FirstName: t.text(),
  }));
}

export class ReportUserTable extends BaseTable {
  readonly table = 'ReportUser';
  readonly nameInDb = 'app_users';
  columns = this.setColumns((t) => ({
    Id: t.identity().primaryKey(),
  }));
}

export class ActiveUserView extends BaseTable.View {
  readonly name = 'ActiveUser';
  // nameInDb defaults to 'active_user' because BaseTable has snakeCase: true.
  sql = sql`SELECT * FROM "user" WHERE "active" = true`;
  columns = this.setColumns((t) => ({
    Id: t.integer(),
  }));
}

await db.User.join('profile')
  .select('User.FirstName', 'profile.Bio')
  .where({ 'User.Id': 1 });
// SELECT ... FROM "user" "User" ...

const User = db(
  'User',
  (t) => ({
    Id: t.identity().primaryKey(),
    FirstName: t.text(),
  }),
  undefined,
  { nameInDb: 'app_users' },
);
// User.table remains 'User' for query typing; SQL reads from "app_users" "User".
```

## What Changes

- Add optional `nameInDb` metadata to ORM table classes and view classes.
- Derive `nameInDb` from `table` or `name` by default, applying `snakeCase` when the table or view uses snake-case mapping and the user did not define `nameInDb`.
- Add a `nameInDb` option to standalone `createDb` table options and keep the resolved database name in `QueryData`.
- Render base tables, views, standalone `createDb` tables, joins, subqueries, mutation targets, materialized view refreshes, and migration generation against `nameInDb` while preserving `table` and `name` as the user-facing TypeScript aliases.
- Update shared tests so one-word aliases in `packages/test-utils/src/test-db.ts` use capitalized ORM table aliases while existing SQL expectations still target lowercase database names.

## Assumptions

- Standalone `createDb` should derive `nameInDb` from the table argument with the resolved table `snakeCase` option when no explicit `nameInDb` is provided. This matches `createBaseTable` behavior even though the prompt only explicitly required the `createDb` `nameInDb` option.
- `nameInDb` is a database relation name only, not a new query alias. Query-qualified column names, relation typing, `getQueryAs`, bundle metadata, and public `table`/`name` literals continue to use the user-defined `table` or view `name`.
- `nameInDb` is a single unqualified relation name. Existing `schema` support continues to own schema qualification.

## Capabilities

- `db-relation-name`: Store a database-level table or view name separately from the user-facing TypeScript table alias.
- `alias-aware-sql`: Emit SQL against the database relation name while aliasing that relation back to the user-facing name when those names differ.

## Detailed Design

### Public API

Table classes may define `readonly nameInDb = 'database_name'` next to the existing `readonly table` property.

```ts
class UserTable extends BaseTable {
  readonly table = 'User';
  readonly nameInDb = 'app_users';
}
```

View classes may define `readonly nameInDb = 'database_view_name'` next to the existing `readonly name` property.

```ts
class ActiveUserView extends BaseTable.View {
  readonly name = 'ActiveUser';
  readonly nameInDb = 'active_user';
}
```

Standalone `createDb` table construction accepts `nameInDb` in its table options.

```ts
const User = db(
  'User',
  (t) => ({
    Id: t.identity().primaryKey(),
  }),
  undefined,
  { nameInDb: 'app_users' },
);
```

- The existing `table` property on table classes remains required and keeps its literal type for query-qualified column names such as `'User.Id'`.
- The existing `name` property on view classes remains required and keeps its literal type for query-qualified column names on `db.$views`.
- `nameInDb` is optional. When absent, it defaults to the user-defined `table` or `name`.
- When the applicable `snakeCase` setting is true and `nameInDb` is absent, Orchid stores `toSnakeCase(table)` or `toSnakeCase(name)` as the database name.
- An explicit `nameInDb` always wins over `snakeCase`.
- `nameInDb` does not change object keys passed to `orchidORM`, `bundleOrchidORM`, or `db.$views`.

### Shared State or Data Shape

`QueryData` gets an optional resolved `nameInDb?: string`.

- ORM table and view instantiation resolves `nameInDb` once from the class instance before constructing the `Db` query object.
- Standalone `createDb` resolves `nameInDb` from table options and stores it in the table query's `QueryData`.
- Query cloning preserves `q.nameInDb`.
- SQL rendering reads the database relation name from `q.nameInDb` and falls back to the existing `table` or string `from` behavior for compatibility with query objects that do not have it.

### Integration and Lifecycle

The main query object keeps two distinct names:

- `query.table`: the TypeScript/user-facing table alias used by query typings, qualified column strings, relation aliases, and `getQueryAs`.
- `query.q.nameInDb`: the PostgreSQL table or view name used when SQL needs a physical relation.

When SQL renders a physical relation and `q.nameInDb !== query.table`, it must alias the relation to `query.table` unless another explicit query alias is already in effect.

```sql
FROM "user" "User"
JOIN "profile" "profile" ON "profile"."user_id" = "User"."id"
```

When a query already has an explicit alias from `.as(...)`, SQL should use the explicit alias instead of the table alias, preserving current `.as(...)` behavior.

### `pqb` Behavior

`pqb` owns the lower-level `nameInDb` data shape and SQL writing behavior.

- `DbTableOptions` includes `nameInDb?: string`.
- `Db` resolves the stored `q.nameInDb` from `options.nameInDb`, `snakeCase`, and `table`.
- `quoteTableWithSchema`, `requireTableOrStringFrom`, `FROM`, `JOIN`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFRESH MATERIALIZED VIEW`, and related helpers should use the resolved database name for physical relation references.
- SQL that references a query alias or column qualifier should continue to use `getQueryAs`, `q.as`, or the public `table` alias as it does today.
- Joining a table whose `nameInDb` differs from `table` should render the database name and alias it to the joined table's user-facing name, so no joined-table name mapping is needed in `QueryData`.

### `orm` Behavior

`orm` owns table and view class metadata.

- `BaseTableInstance`, `BaseViewInstance`, and `BaseMaterializedViewInstance` include optional `nameInDb?: string`.
- `createBaseTable` normalizes a missing `nameInDb` for table and view instances from `table` or `name`, applying the instance's `snakeCase` setting.
- `assignTablesToOrm` passes the public alias as the `Db` table argument and passes the resolved `nameInDb` through table options.
- View/table duplicate detection compares resolved database names with schema qualification, not public aliases.
- Migration generation, pull/diff reporting, grant metadata, RLS metadata, foreign keys, indexes, and view DDL use `nameInDb` when they refer to a database relation, while generated TypeScript and query-facing metadata preserve `table` or `name`.

### Test Utility Migration

`packages/test-utils/src/test-db.ts` should intentionally exercise the new alias split.

- Change one-word `readonly table` values in that file to start with a capital letter, for example `readonly table = 'User'` instead of `readonly table = 'user'`.
- Keep multi-word camelCase table and view aliases, such as `profilePic`, `postTag`, and `activeUser`, because they already differ from their snake-cased database names.
- Update existing tests that query those tables with qualified column strings to use the new capitalized table alias on the query side.
- Keep SQL expectations against the existing lowercase database names because `BaseTable` has `snakeCase: true`.
- Keep explicitly named columns, relation option column names, and join-table names focused on their current database behavior unless a test must change to use the new table alias.

### Error Handling and Limits

- No new runtime validation is required for `nameInDb`; invalid database identifiers should fail the same way invalid `table` or `name` values fail today when SQL is executed or generated.
- `nameInDb` does not support schema-qualified strings. Users should continue to use the existing `schema` property or option for schema names.
- Existing tables with lowercase `table` or view `name` values should produce identical SQL unless they add `nameInDb` or rely on `snakeCase` for a non-snake-case relation alias.

### Documentation

Document `nameInDb` near table naming and view naming docs.

Docs should show:

- `snakeCase: true` deriving `nameInDb` from a capitalized or camelCase table alias.
- An explicit table `nameInDb`.
- An explicit view `nameInDb`.
- Standalone `createDb` usage with `{ nameInDb }`.
- A short note that `table` and view `name` remain query aliases and `nameInDb` is only the database relation name.
