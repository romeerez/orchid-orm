## Summary

Add a function-call table definition API that replaces class authoring with `createTableFactory`, `defineTable`, and `defineView`, while preserving the same normalized ORM table/view metadata, query behavior, migration generation, relations, hooks, validation schemas, and type helpers that class-based tables use today.

```ts
import { createTableFactory } from 'orchid-orm';

// createTableFactory acts similarly to the existing `createBaseTable`,
// returns defineTable and defineView functions, and a `sql` function.
export const { defineTable, defineView, sql } = createTableFactory();

// with options:
export const { defineTable, defineView, sql } = createTableFactory({
  snakeCase: true,
  schemaConfig: zodSchemaConfig,
  // let `columnTypes` be always a function (still optional),
  // unlike createBaseTable accepting an object of columnTypes.
  columnTypes: (t) => ({
    timestamp: () => t.timestamp().asDate(),
  }),
  // customize the export name used when generating code; defaults to 'defineTable'.
  defineTableExportAs: 'defineTable',
});

// Selectable, DefaultSelect, and similar type helpers should support both the existing class-based and the new tables
export type User = Selectable<typeof UserTable>;

// `defineTable` is overloaded: 2nd options object can be omitted
const UserTable = defineTable(
  'user',
  {
    // function or a string
    schema: () => 'schemaName',
    // can do `db.user.select('user.id')` in queries, 'user' will become 'app_user' in SQL.
    nameInDb: 'app_user',
    id: 'UserTable',
    // other options that do not depend on columns will go here.
    // same types as in the existing class-based tables
    comment: 'table comment',
    noPrimaryKey: true,
    snakeCase: true,
    language: 'en',
    readOnly: true,
    generatorIgnore: true,
    autoForeignKeys: true,
  },
  (t) => ({
    // columns go here
    id: t.identity().primaryKey(),
    name: t.text(),
    orgId: t.integer(),
    deletedAt: t.timestamp(),
  }),
)
  // composite primaryKey: same as the existing in 2nd argument of `setColumns`
  .primaryKey(['foo', 'bar'])
  // composite index: same as the existing in 2nd argument of `setColumns`
  .index(['foo', 'bar'])
  .searchIndex(['foo', 'bar'])
  // composite unique: same as the existing in 2nd argument of `setColumns`
  .unique(['foo', 'bar'])
  // composite exclude: same as the existing in 2nd argument of `setColumns`
  .exlude(['foo', 'bar'])
  // table check: same as the existing in 2nd argument of `setColumns`
  .check(t.sql`a < b`)
  // softDelete is on `deletedAt` by default, accepts a column name for customizing
  .softDelete()
  // same argument as in `setComputed` of the current class-based tables
  .computed((q) => ({
    fullName: q.computeAtRuntime(
      ['firstName', 'lastName'],
      (record) => `${record.firstName} ${record.lastName}`,
    ),
  }))
  // same argument as in `setScopes` of the current class-based tables
  .scopes({
    default: (q) => q.where({ hidden: false }),
    active: (q) => q.where({ active: true }),
  })
  .relations((user) => ({
    // belongsTo relation
    org: user('orgId').belongsTo(() => OrganizationTable('id')),
    org2: user('orgId')
      .belongsTo(() => OrganizationTable('id'))
      // `foreignKey` goes from options in class-based into a method. No arguments = true
      .foreignKey({
        onUpdate: 'CASCADE',
      }),
    // hasOne relation
    profile: user('id')
      .hasOne(() => ProfileTable('userId'))
      .required(), // marking as required means we expect there to always be an associated profile
    // hasOne through
    // current class-based design has `through` - relation name in this table, and `source` - relation name in the related table,
    // but here we have an vararg that requires at least 2 names for same purpose, but allows specifying more to dig the target relation even deeper.
    // it's impossible to type-check this properly in the existing class-based design and in the new one, but this will be checked at runtime at booting.
    picture: user.hasOne(() => PictureTable).through('profile', 'picture'),
    // hasMany relation
    posts: user('id').hasMany(() => PostTable('authorId')),
    // hasMany through is same as hasOne
    likes: user.hasMany(() => LikesTable).through('profile', 'likes'),
    // hasAndBelongsToMany:
    tasks: user('id')
      .hasAndBelongsToMany(() => TaskTable('id'))
      // if `defineTable` was configured with `snakeCase: true`, the 'userTasks' join table will be translated to 'user_tasks'.
      // 1st arg is a table name, 2nd is a foreignKey for the current table, 3rd is a foreign key for the related table.
      // Supports composite foreign keys: 2nd and 3rd arguments can be arrays.
      // 4th arg can disable join table snake-casing with { joinTableSnakeCase: false }.
      .through('userTasks', 'userId', 'taskId')
      // for hasAndBelongsToMany, foreignKey configures database foreign keys on the join table.
      // forThisTable = FK from join table to current table, forRelatedTable = FK from join table to related table.
      // no arguments = both enabled, false = both disabled.
      .foreignKey({
        forThisTable: { onUpdate: 'CASCADE' },
        forRelatedTable: true,
      }),
    // all the connections can have composite keys
    whatever: user('id', 'name').hasOne(() =>
      WhateverTable('userId', 'userName'),
    ),
    // `where` supports conditions for the relation
    activeProfile: user('id')
      .hasOne(() => ProfileTable('userId').where({ active: true }))
      .required(),
  }))
  // same type as in `defineRls`
  .rls({
    enable: true,
    force: true,
    permit: [
      /* ... */
    ],
    restrict: [
      /* ... */
    ],
  })
  // same type as in `setGrants`
  .grants([
    {
      to: 'app_user',
      privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
  ])
  // init: similar to the existing one in class-based but without `this`, hooks type will be inferred
  .init((orm: typeof db, hooks) => {
    hooks.beforeCreate(({ set }) => {
      set({ name: 'new user' });
    });
  });

// `defineView` implementation should reuse as much as possible from tables,
// options type is different here.
// Views support relations, scopes, computed columns, softDelete (views can be readOnly: false), and grants, and maybe I forgot to list something from tables,
// basically they support everything from tables that makes sense in views.
const MontlySalesView = defineView(
  'monthly_sales',
  {
    schema: 'analytics',
    securityInvoker: true,
    // ...omitting some fields, make sure to support all views fields
    checkOption: 'LOCAL',
    recursive: true,
    sql: `
  SELECT
    row_number() over () AS id,
    "userId",
    sum(total) AS total
  FROM sale
  GROUP BY "userId"
`,
  },
  (t) => ({
    id: t.integer(),
    userId: t.integer(),
    total: t.decimal(),
  }),
)
  // Alternatively to `sql` option:
  // .query passes an orm instance and expects a returned query object,
  // this is to replace what class-based views support via `this.query = ` in `init`.
  .query((orm: typeof db) =>
    orm.sale
      .select({
        userId: 'userId',
        total: (q) => q.sum('total'),
      })
      .group('userId'),
  );

// materialized views support slightly different options via 2nd arg
const MontlySalesMaterializedView = defineView(
  'monthly_sales',
  {
    materialized: true,
    withData: false,
    schema: 'analytics',
    sql: `
  SELECT
    row_number() over () AS id,
    "userId",
    sum(total) AS total
  FROM sale
  GROUP BY "userId"
`,
  },
  (t) => ({
    id: t.integer(),
    userId: t.integer(),
    total: t.decimal(),
  }),
);

// new tables support same validation methods as the existing class-based tables
const zodValidated = UserTable.inputSchema().parse(params);
```

## What Changes

- Add `createTableFactory` as the function-style counterpart to `createBaseTable`; it returns `defineTable`, `defineView`, a config-bound `sql` function, and an `exportAs` string.
- Add `defineTable` for creating callable table definition values with chain methods for table options, table-data metadata, computed columns, scopes, relations, RLS, grants, soft delete, and init hooks.
- Add `defineView` for regular and materialized view definition values that reuse table definition behavior where it makes sense and expose view-specific options and query-builder SQL definitions.
- Accept new definition values wherever class-based table/view classes are accepted today: `orchidORM`, adapter-specific ORM setup, `bundleOrchidORM`, relation targets, migration generation, validation schemas, and table type helpers.
- Keep existing `createBaseTable` and class-based definitions supported; this change adds a new authoring surface rather than a migration-breaking replacement.

## Assumptions

- `defineTable` and `defineView` should produce values that are both definition metadata and callable relation endpoints; users should not need a separate helper to reference table columns in relations.
- The table-data chain should expose all existing second-argument `setColumns` table-data methods, including `foreignKey`, even though the motivating example only highlights primary keys, indexes, unique indexes, excludes, and checks.
- The example's `.exlude(...)` spelling is treated as a typo; the public method is `.exclude(...)` to match the existing API.
- Function-style definitions are registered explicitly in the same places as class-based definitions; `defineTable` and `defineView` do not auto-register themselves in an ORM instance.

## Capabilities

- `table-config-factory`: Creates a configured function-style table-definition environment with shared column types, schema config, naming defaults, and SQL helpers.
- `function-table-definition`: Defines ordinary ORM tables without classes while preserving the same query, migration, schema, hook, and metadata semantics.
- `function-view-definition`: Defines regular and materialized views without classes while preserving `$views`, read-only defaults, query-defined view SQL, migration metadata, and materialized-view refresh support.
- `chain-table-metadata`: Accumulates table-data constraints, indexes, computed columns, scopes, RLS, grants, soft delete, relations, and init hooks through fluent methods.
- `function-relation-dsl`: Provides a relation-specific DSL based on callable table endpoints instead of `this.belongsTo` / `this.hasOne` methods.
- `table-definition-type-helpers`: Makes `Selectable`, `DefaultSelect`, `Insertable`, `Updatable`, `Queryable`, and validation schema helpers work with both class-based and function-style definitions.

## Detailed Design

### Public API

`orchid-orm` exports `createTableFactory` from the public entry point beside `createBaseTable`.

```ts
export function createTableFactory<
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>(
  options?: createTableFactoryOptions<SchemaConfig, ColumnTypes>,
): {
  defineTable: DefineTable<SchemaConfig, ColumnTypes>;
  defineView: DefineView<SchemaConfig, ColumnTypes>;
  sql: DbSqlMethod<ColumnTypes>;
  exportAs: string;
};
```

- `createTableFactoryOptions` matches the `createBaseTable` options that apply to function-style definitions: `schemaConfig`, `snakeCase`, `filePath`, `nowSQL`, `language`, `autoForeignKeys`, and `defineTableExportAs`.
- `filePath` specifies the file path where the table factory is defined. When provided, `defineTable.getFilePath()` returns this value directly. When omitted, the file path is determined automatically using stack trace analysis.
- `defineTableExportAs` customizes the export identifier name used when generating code; it defaults to `'defineTable'`.
- `columnTypes` remains optional, but when present it must be a function `(t) => ({ ... })`; the object form accepted by `createBaseTable` is intentionally not part of `createTableFactory`.
- The returned `sql` is bound to the configured column types and has the same public behavior as `BaseTable.sql`.
- The returned `exportAs` is the resolved `defineTableExportAs` value (defaults to `'defineTable'`).
- `createBaseTable` remains unchanged for class users.

### `defineTable`

`defineTable` is overloaded so the options object can be omitted.

```ts
const Table = defineTable('tableAlias', (t) => ({
  id: t.identity().primaryKey(),
}));

const Table = defineTable(
  'tableAlias',
  {
    schema: 'custom',
    nameInDb: 'table_in_db',
    comment: 'comment',
    noPrimaryKey: true,
    snakeCase: true,
    language: 'english',
    readOnly: true,
    generatorIgnore: true,
    autoForeignKeys: { onUpdate: 'CASCADE' },
  },
  (t) => ({
    id: t.identity().primaryKey(),
  }),
);
```

- The first argument is the query-facing table alias. It has the same public meaning as class `readonly table`.
- `id` is the stable relation-resolution identity. When omitted, it defaults to the table alias.
- `nameInDb` is the database relation name. When omitted and `snakeCase` is enabled, it is derived from the table alias by `toSnakeCase`; otherwise it defaults to the alias.
- `schema` accepts the same string or function shape as class-based tables.
- `comment`, `snakeCase`, `language`, `readOnly`, `generatorIgnore`, and `autoForeignKeys` have the same meanings as the corresponding class properties.
- `noPrimaryKey` suppresses the error thrown when a table has no primary key column or composite primary key. By default, omitting a primary key causes an ORM initialization error; set `noPrimaryKey: true` to allow keyless tables.
- The column callback receives the configured column types and returns the same column shape accepted by `setColumns`.
- Function-style table definitions should normalize to the same internal shape as class-based `ORMTableInput` before creating `Db` query objects.

The returned definition value is callable for relation declarations:

```ts
UserTable('id');
UserTable('tenantId', 'id');
UserTable('id').where({ active: true });
```

- Calling a definition with one or more column names returns a typed relation endpoint for those columns.
- The columns must be keys of the definition's shape.
- Calling `.where(...)` on a relation endpoint attaches relation conditions equivalent to the existing relation `on` option: relation queries filter by the condition, and nested creates include condition values where existing relation behavior does so.
- A definition value called with no columns is not a relation endpoint; through relations use the definition value itself as the target.

Each definition value carries an `exportAs` string property matching the factory's `defineTableExportAs` (default `'defineTable'`). This identifier is used by migration code generation when producing function-style table exports.

The `defineTable` function also exposes a `getFilePath()` method that returns the file path where the table factory was defined:

```ts
const { defineTable, sql } = createTableFactory();

// Returns the file path where createTableFactory was called
defineTable.getFilePath();

// Or with an explicit filePath option:
const { defineTable } = createTableFactory({
  filePath: '/path/to/tables.ts',
});
defineTable.getFilePath(); // '/path/to/tables.ts'
```

- `getFilePath()` returns the file path determined by stack trace analysis when `filePath` option is not provided.
- When `filePath` option is provided to `createTableFactory`, `getFilePath()` returns that value directly.
- If file path cannot be determined automatically and `filePath` option was not provided, `getFilePath()` throws an error.

### Table Chain Metadata

Table definitions expose fluent metadata methods. Each method returns the same definition value with accumulated type and runtime metadata.

```ts
const ProjectTable = defineTable('project', (t) => ({
  tenantId: t.integer(),
  id: t.identity().primaryKey(),
  code: t.text(),
}))
  .primaryKey(['tenantId', 'id'])
  .foreignKey(['tenantId'], () => TenantTable, ['id'])
  .unique(['tenantId', 'code'], { name: 'project_code_key' })
  .index(['tenantId'])
  .searchIndex(['code'])
  .exclude([{ expression: 'tstzrange("startAt", "endAt")', with: '&&' }])
  .check(sql`"code" <> ''`);
```

- `.primaryKey`, `.unique`, `.index`, `.searchIndex`, `.exclude`, `.foreignKey`, and `.check` accept the same argument shapes and have the same migration/query metadata meaning as the existing `TableDataMethods` used in the second argument of `setColumns`.
- `.foreignKey` accepts class-based table targets and function-style table targets wherever the existing API accepts a table class target.
- Table-data methods may be called multiple times; the accumulated result is equivalent to returning an array from the class-based `setColumns` second argument.
- `.softDelete()` enables soft delete on `deletedAt`; `.softDelete(columnName)` uses a custom column name. The column must exist in the table shape.
- `.computed((q) => ({ ... }))` and `.computed({ ... })` accept the same shapes as class `setComputed` and preserve SQL computed, runtime computed, and batch runtime computed behavior.
- `.scopes({ ... })` accepts the same object shape as class `setScopes`.
- `.rls(config)` accepts the same table RLS config type as `defineRls`.
- `.grants(grants)` accepts the same table-local grant item array as `setGrants`.
- `.init((orm, hooks) => void)` replaces class `init(orm)` for function-style tables. `hooks` exposes the same hook registration methods as table query hooks, so hook setup no longer relies on `this`.

### Relation DSL

`.relations` accepts a callback that receives a relation builder for the current table.

```ts
const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  orgId: t.integer(),
})).relations((user) => ({
  org: user('orgId')
    .belongsTo(() => OrganizationTable('id'))
    .foreignKey(),
  profile: user('id')
    .hasOne(() => ProfileTable('userId'))
    .required(),
  posts: user('id').hasMany(() => PostTable('authorId')),
  avatar: user.hasOne(() => PictureTable).through('profile', 'picture'),
}));
```

- `builder(...columns)` selects local columns for direct relations and supports composite keys.
- `.belongsTo(() => RelatedTable(...relatedColumns))` maps to existing `belongsTo` with `columns` and `references`.
- `.hasOne(() => RelatedTable(...relatedColumns))` maps to existing `hasOne` with `columns` and `references`.
- `.hasMany(() => RelatedTable(...relatedColumns))` maps to existing `hasMany` with `columns` and `references`.
- `.hasOne(() => RelatedTable).through(first, second, ...rest)` and `.hasMany(() => RelatedTable).through(first, second, ...rest)` map to existing through relations. At least two relation names are required. The first name is the local relation, and the remaining path is resolved at ORM boot time.
- Through path type-checking is best-effort only. Invalid paths must produce a clear boot-time error before queries run.
- `.required()` is available for relation kinds that support the existing `required` option and sets `required: true`.
- `.required(false)` is allowed where the existing relation supports explicit optional behavior.
- `.foreignKey()` and `.foreignKey(options)` are available on direct relations that support the existing `foreignKey` option. No arguments means `foreignKey: true`.
- `.foreignKey(false)` disables a concrete relation foreign key.
- Relation endpoint `.where(condition)` maps to the existing `on` relation condition.

`hasAndBelongsToMany` keeps its existing semantics but moves join-table details to chain methods.

```ts
const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
})).relations((user) => ({
  tasks: user('id')
    .hasAndBelongsToMany(() => TaskTable('id'))
    .through('userTasks', 'userId', 'taskId', {
      joinTableSnakeCase: false,
    })
    .foreignKey({
      forThisTable: { onUpdate: 'CASCADE' },
      forRelatedTable: true,
    }),
}));
```

- `.through(table, currentColumns, relatedColumns, options?)` is required for `hasAndBelongsToMany`.
- The `table` argument can be schema-qualified with a dot to target a join table in a specific schema, for example `.through('schema.postTask', 'postId', 'taskId')`.
- The optional fourth `.through` argument accepts `schema: QuerySchema` to target a join table schema with the same string or function shape as table schemas, for example `.through('postTask', 'postId', 'taskId', { schema: () => 'schema' })`.
- When both a schema-qualified `table` argument and `options.schema` are provided, `options.schema` is used as the join table schema.
- When a schema-qualified join table is provided, the schema prefix is preserved separately from the join table name, and snake-casing applies only to the join table name when enabled.
- `currentColumns` and `relatedColumns` accept a string for single-column joins or a non-empty string tuple for composite joins.
- When the owning definition has `snakeCase: true`, join table and join column names are converted the same way existing class-based HABTM relation metadata does.
- HABTM join table snake-casing is already implemented for both function-style `defineTable` tables and old class-based tables.
- Function-style HABTM can opt out of join table snake-casing by passing `{ joinTableSnakeCase: false }` as the optional fourth `.through` argument. This affects only the join table name; join column names continue to follow the normal column snake-case behavior.
- Class-based HABTM can opt out of join table snake-casing by setting `snakeCase: false` on the same options object where `joinTable` is set.
- `.foreignKey()` configures database foreign keys for the join table.
- No arguments means both foreign keys are enabled (equivalent to `true`).
- `.foreignKey(false)` disables both foreign keys.
- `.foreignKey({ forThisTable, forRelatedTable })` configures each side independently:
  - `forThisTable` controls the join table foreign key pointing to the current table (passed as `options.foreignKey` to `addAutoForeignKey`).
  - `forRelatedTable` controls the join table foreign key pointing to the related table (passed as `options.through.foreignKey` to `addAutoForeignKey`).
- `.foreignKey({ forBothTables })` applies the same value to both sides.
- Each side accepts `boolean` (`true` = use factory default, `false` = disable) or an `TableData.References.BaseOptions` object (e.g. `{ onDelete: 'CASCADE' }`).
- When `autoForeignKeys` is set on `createTableFactory` or `defineTable`, `foreignKey: true` inherits those default options.

### `defineView`

`defineView` is overloaded like `defineTable`, with view-specific options.

```ts
const ActiveUsersView = defineView(
  'activeUsers',
  {
    schema: 'analytics',
    nameInDb: 'active_users',
    readOnly: false,
    sql: sql`SELECT id, name FROM "user" WHERE active = true`,
    checkOption: 'CASCADED',
    recursive: true,
    securityBarrier: true,
    securityInvoker: true,
    generatorIgnore: true,
  },
  (t) => ({
    id: t.integer().primaryKey(),
    name: t.text(),
  }),
);
```

- The first argument is the query-facing view alias. It has the same public meaning as class view `readonly name`.
- Regular view options include `schema`, `nameInDb`, `snakeCase`, `language`, `readOnly`, `generatorIgnore`, `sql`, `recursive`, `checkOption`, `securityBarrier`, and `securityInvoker`.
- `readOnly` defaults to `true` for regular views. `readOnly: false` exposes mutation methods at the TypeScript level, subject to PostgreSQL accepting writes.
- `materialized: true` switches to materialized-view behavior. Materialized views are always read-only, may use `withData`, and support refresh through the existing materialized-view API.
- Views do not support table-only metadata that does not make sense for views: table comments, table RLS, table auto foreign keys, and no-primary-key enforcement.
- Views do support columns, computed columns, scopes, soft delete, relations, grants, `generatorIgnore`, validation schema methods, and init hooks where those concepts already work for class-based views.

`defineView` also supports query-builder view definitions.

```ts
const MonthlySalesView = defineView(
  'monthlySales',
  {
    schema: 'analytics',
  },
  (t) => ({
    userId: t.integer(),
    total: t.decimal(),
  }),
).query((orm: typeof db) =>
  orm.sale
    .select({
      userId: 'userId',
      total: (q) => q.sum('total'),
    })
    .group('userId'),
);
```

- A view definition must provide either an `sql` option or a `.query((orm) => query)` chain.
- `.query` replaces the class-based pattern of assigning `this.query` inside `init`.
- During migration generation, a query-defined view is compiled to SQL and values exactly like existing class-based view `query` support.
- Runtime reads still go through `db.$views.<key>`.

### Type Helpers and Validation Methods

Existing table type helpers must support both class-based table instance types and function-style definition values.

```ts
type ClassUser = Selectable<UserTableClass>;
type FunctionUser = Selectable<typeof UserTable>;

type UserDefault = DefaultSelect<typeof UserTable>;
type UserNew = Insertable<typeof UserTable>;
type UserUpdate = Updatable<typeof UserTable>;
type UserWhere = Queryable<typeof UserTable>;
```

- `Selectable`, `DefaultSelect`, `Insertable`, `Updatable`, and `Queryable` should internally unwrap either a class-based table instance type or a function-style definition value to the same table input shape.
- Function-style definitions expose `inputSchema`, `outputSchema`, `querySchema`, `pkeySchema`, `createSchema`, and `updateSchema` methods directly on the definition value.
- Validation methods use the `schemaConfig` from `createTableFactory` and return the same schemas as the corresponding class static methods.
- Schema methods should instantiate or finalize columns lazily when practical, but repeated calls must be cached the same way class static schema methods are cached.

### ORM Setup and Lifecycle

New definition values are valid wherever table/view classes are valid today.

```ts
const db = orchidORM(
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

const orm = bundleOrchidORM({
  tables: { user: UserTable },
  views: { monthlySales: MonthlySalesView },
});
```

- `orchidORM`, `orchidORMWithAdapter`, adapter-specific setup functions, and `bundleOrchidORM` accept a mix of class-based and function-style definitions.
- Table definitions remain exposed directly on the ORM instance by registry key.
- View definitions remain exposed only under `db.$views` by registry key.
- Duplicate database relation names across configured tables and views are rejected the same way they are today.
- Function-style definitions must produce the same `DbTableOptions`, `viewData`, `tableRls`, `tableGrants`, and `generatorIgnore` internal metadata that class-based definitions produce.
- `.init((orm, hooks) => void)` runs after DB-aware query objects and relations are created, matching the class `init` lifecycle.
- Hook registrations from the `hooks` argument affect the DB-aware base query exactly as class `this.beforeCreate`, `this.beforeUpdate`, and related hook methods do.

### Migration Generation

Migration generation treats function-style definitions as another source of code table/view metadata.

- Ordinary table definitions participate in table creation, change detection, drops, columns, indexes, excludes, checks, primary keys, foreign keys, comments, RLS, grants, soft delete metadata, `generatorIgnore`, and schema creation exactly like class-based tables.
- Regular view definitions participate in regular-view generation exactly like `BaseTable.View`.
- Materialized view definitions participate in materialized-view generation exactly like `BaseTable.MaterializedView`, including `withData`, materialized-view indexes where supported, and refresh support at runtime.
- Table aliases, `nameInDb`, `schema`, and `snakeCase` resolve to migration AST names the same way class-based definitions resolve them.
- Auto foreign keys derived from relations work for function-style table relations with the same limits as class-based relation declarations.
- Function-style view relations do not generate foreign keys, matching class-based view behavior.

### Package Boundaries

- `orm` owns the public function-style table/view API, relation DSL, ORM setup acceptance, type-helper unwrapping, and migration-generator integration.
- `pqb` owns reusable lower-level pieces already used by `orm`: column types, table data methods, query hooks, query type helpers, schema config types, SQL helpers, and normalized query metadata.
- `rake-db` should not need a new public table-definition API for this change; it receives the same generated migration AST and manual migration DSL inputs it receives today.
- Downstream packages should use `pqb/internal` only for existing first-party internal access patterns.

### Error Handling and Limits

- Invalid column names in table-data chains, relation endpoints, soft-delete column names, and composite relation keys should be TypeScript errors when column names are statically known.
- Invalid through relation paths must be detected at ORM boot time with a clear error naming the source table, relation name, and unresolved path segment.
- A function-style view with neither `sql` nor `.query(...)` is invalid for migration-managed views and should fail before generation emits a migration.
- Calling `.query(...)` on a view that already has `sql` is invalid unless a deliberate overwrite rule is added; the public contract should reject ambiguous dual SQL sources.
- Function-style definitions do not attempt to solve dynamic-schema type checking beyond the existing class-based guarantees.
- Function-style definitions do not remove or deprecate class-based definitions in this change.

### Documentation

Document function-style tables as the preferred authoring API while keeping class-based examples available for compatibility.

- The base table guide should introduce `createTableFactory`, show `columnTypes` as a callback-only option, and explain why `sql` is exported from the config.
- The define tables guide should show the overloaded `defineTable` form, `nameInDb`, table-data chains, computed columns, scopes, soft delete, RLS, grants, and `init` hooks.
- The relations guide should show the new callable endpoint DSL for direct, through, HABTM, required, conditional, composite-key, and foreign-key-enabled relations.
- The views guide should show `defineView`, materialized views, `.query((orm) => ...)`, read-only defaults, writable regular views, `$views`, relations, grants, and refresh support.
- The validation docs should show `UserTable.inputSchema()` on function-style definitions and mention that type helpers use `typeof UserTable`.
