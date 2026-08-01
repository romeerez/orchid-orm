---
outline: deep
description: Migrate Orchid ORM tables and views from class-based createBaseTable definitions to function-style createTableFactory definitions.
---

# Migrate to the new table design

This guide shows how to move existing class-based table and view definitions to the function-style API based on `createTableFactory`, `defineTable`, and `defineView`.

The old `createBaseTable` API remains supported, and Orchid accepts a mix of class-based and function-style definitions in the same ORM setup. Relation declarations cannot cross between the two styles: class-based tables can only define relations with class-based tables, and function-style tables can only define relations with function-style tables. Migrate related tables together.

## Migration order

1. Replace the shared `BaseTable` export with a table factory export.
2. Update `rake-db` config to use `defineTable` instead of `baseTable`.
3. Convert simple table classes to `defineTable`.
4. Move table options into the `defineTable` options object.
5. Move composite primary keys, indexes, checks, excludes, and foreign keys from the second `setColumns` callback to chain methods.
6. Convert relations to the callable relation DSL.
7. Convert views to `defineView`.
8. Move table features such as computed columns, scopes, soft delete, RLS, grants, and hooks to chain methods.
9. Update table type helpers and validation schema calls to use the table definition value.

## Factory setup

Replace the shared `BaseTable` with a table factory. Keep exporting `sql` from the same file, so custom column types, raw SQL fragments, and later `defineView` definitions use the same column configuration.
If your old `BaseTable` is exported from `base-table.ts`, rename that file to
`table-factory.ts` when you switch it to `createTableFactory`.

Old:

```ts
import { createBaseTable } from 'orchid-orm';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  snakeCase: true,
  schemaConfig: zodSchemaConfig,
  columnTypes: (t) => ({
    timestamp: () => t.timestamp().asDate(),
    myEnum: () => t.enum('myEnum', ['one', 'two', 'three']),
  }),
  nowSQL: `now() AT TIME ZONE 'UTC'`,
  language: 'english',
  autoForeignKeys: true,
});

export const { sql } = BaseTable;
```

New:

```ts
import { createTableFactory } from 'orchid-orm';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';

export const { defineTable, defineView, sql } = createTableFactory({
  snakeCase: true,
  schemaConfig: zodSchemaConfig,
  columnTypes: (t) => ({
    timestamp: () => t.timestamp().asDate(),
    myEnum: () => t.enum('myEnum', ['one', 'two', 'three']),
  }),
  nowSQL: `now() AT TIME ZONE 'UTC'`,
  language: 'english',
  autoForeignKeys: true,
  // the following are only needed in rare cases for `db pull` command,
  // normally they're not needed.
  defineTableExportAs: 'defineTable',
  filePath: '/optional/path.ts',
});
```

`createTableFactory` returns `defineTable`, `defineView`, `sql`, and `exportAs`. `defineTable` carries the table factory metadata used by `rake-db`: configured column types, export name, `nowSQL`, `snakeCase`, `language`, and `getFilePath()`.

Unlike older `createBaseTable` setups, `columnTypes` must be a callback:

```ts
columnTypes: (t) => ({
  timestamp: () => t.timestamp().asDate(),
});
```

Use `filePath` only when automatic file path detection is not reliable in your environment. If you customize `defineTableExportAs`, export the returned function under the same name so generated files can import it.

## Migration config

In `rake-db` config, pass `defineTable` instead of `baseTable`.

Old:

```ts
import { rakeDb } from 'orchid-orm/migrations/postgres-js';
import { config } from './config';
import { BaseTable } from './base-table';

export const change = rakeDb.run(config.database, {
  migrationsPath: './migrations',
  dbPath: './db',
  baseTable: BaseTable,
  import: (path) => import(path),
});
```

New:

```ts
import { rakeDb } from 'orchid-orm/migrations/postgres-js';
import { config } from './config';
import { defineTable } from './table-factory';

export const change = rakeDb.run(config.database, {
  migrationsPath: './migrations',
  dbPath: './db',
  defineTable,
  import: (path) => import(path),
});
```

`baseTable` and `defineTable` are mutually exclusive. Keep `baseTable` while you still generate class-style table files using `db generate`; switch to `defineTable` when migration generation should produce function-style table definitions.

When running `db pull`, Orchid uses `defineTable.getFilePath()` and `defineTable.exportAs` to generate imports for the table factory. If automatic path detection fails, set `filePath` in `createTableFactory`.

## Basic tables and columns

Simple table classes become exported constants created with `defineTable`.

Old:

```ts
import { BaseTable } from './base-table';

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
    ...t.timestamps(),
  }));
}
```

New:

```ts
import { defineTable } from './table-factory';

export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(),
  password: t.text(),
  ...t.timestamps(),
}));
```

The first argument is the query-facing table name, matching the old `readonly table` value. The callback returns the same column object that was previously returned from `this.setColumns`.

ORM setup accepts the new table definitions in the same places where it accepted table classes:

```ts
import { orchidORM } from 'orchid-orm';
import { UserTable } from './tables/user.table';

export const db = orchidORM(config.database, {
  user: UserTable,
});
```

This also applies to `orchidORMWithAdapter`, `bundleOrchidORM`, and `makeOrchidOrmDbWithAdapter`. Register tables in the second argument. Register views later in the first options argument under `views`.

## Table options

Move table class properties into the second `defineTable` argument. The first argument is still the query-facing table alias, matching the old `readonly table` value.

Old:

```ts
import { BaseTable } from './base-table';

export class UserTable extends BaseTable {
  readonly table = 'user';
  schema = 'customSchema';
  readonly nameInDb = 'app_users';
  comment = 'table comment';
  noPrimaryKey = true;
  snakeCase = true;
  language = 'ukrainian';
  readonly readOnly = true;
  readonly generatorIgnore = true;
  autoForeignKeys = false;

  columns = this.setColumns((t) => ({
    id: t.integer(),
    firstName: t.text(),
  }));
}
```

New:

```ts
import { defineTable } from './table-factory';

export const UserTable = defineTable(
  'user',
  {
    schema: 'customSchema',
    nameInDb: 'app_users',
    comment: 'table comment',
    noPrimaryKey: true,
    snakeCase: true,
    language: 'ukrainian',
    readOnly: true,
    generatorIgnore: true,
    autoForeignKeys: false,
  },
  (t) => ({
    id: t.integer(),
    firstName: t.text(),
  }),
);
```

`schema` can still be a string or a function:

```ts
export const UserTable = defineTable(
  'user',
  { schema: () => tenantManager.getStore().currentSchema },
  (t) => ({
    id: t.identity().primaryKey(),
  }),
);
```

`nameInDb` is the database table name. When `snakeCase` is enabled, an explicit `nameInDb` is used as-is and is not converted.

`readOnly` is a TypeScript API restriction for queries. `noPrimaryKey` suppresses the missing-primary-key warning or error for this table. `generatorIgnore` tells the migration generator to ignore this table's DDL.

`autoForeignKeys` can be configured on the table factory or overridden per table:

```ts
export const { defineTable } = createTableFactory({
  autoForeignKeys: { onUpdate: 'RESTRICT' },
});

export const UserTable = defineTable(
  'user',
  { autoForeignKeys: false },
  (t) => ({
    id: t.identity().primaryKey(),
  }),
);
```

## Table constraints and indexes

Move the second `setColumns` callback to chain methods on the table definition.

Old:

```ts
import { BaseTable, sql } from './base-table';
import { OrganizationTable } from './organization.table';

export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns(
    (t) => ({
      tenantId: t.integer(),
      id: t.integer(),
      email: t.text(),
      orgId: t.integer(),
      roomId: t.integer(),
      startAt: t.timestamp(),
      endAt: t.timestamp(),
      title: t.text(),
      body: t.text(),
    }),
    (t) => [
      t.primaryKey(['tenantId', 'id']),
      t.index(['tenantId', 'email']),
      t.searchIndex(['title', 'body']),
      t.unique(['tenantId', 'email']),
      t.foreignKey(['tenantId', 'orgId'], () => OrganizationTable, [
        'tenantId',
        'id',
      ]),
      t.exclude([
        { column: 'roomId', with: '=' },
        { expression: `tstzrange("startAt", "endAt")`, with: '&&' },
      ]),
      t.check(sql`"startAt" < "endAt"`, 'constraintName'),
    ],
  );
}
```

New:

```ts
import { defineTable, sql } from './table-factory';
import { OrganizationTable } from './organization.table';

export const ProjectTable = defineTable('project', (t) => ({
  tenantId: t.integer(),
  id: t.integer(),
  email: t.text(),
  orgId: t.integer(),
  roomId: t.integer(),
  startAt: t.timestamp().asDate(),
  endAt: t.timestamp().asDate(),
  title: t.text(),
  body: t.text(),
}))
  .primaryKey(['tenantId', 'id'])
  .index(['tenantId', 'email'])
  .searchIndex(['title', 'body'])
  .unique(['tenantId', 'email'])
  .foreignKey(['tenantId', 'orgId'], () => OrganizationTable, [
    'tenantId',
    'id',
  ])
  .exclude([
    { column: 'roomId', with: '=' },
    { expression: `tstzrange("startAt", "endAt")`, with: '&&' },
  ])
  .check(sql`"startAt" < "endAt"`, 'constraintName');
```

The chain methods accept the same argument shapes as the old table constraint helpers, and they can be called repeatedly.

Single-column constraints and indexes can stay on the column:

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  email: t.text().unique(),
  organizationId: t.integer().foreignKey(() => OrganizationTable, 'id'),
}));
```

## Relations

Move the `relations` class property to the `.relations` chain method. The callback receives a callable relation builder for the current table. For direct relations, call the builder with the local column or columns, then select the referenced column or columns by calling the target table inside the relation callback.

Old:

```ts
import { BaseTable } from './base-table';
import { OrganizationTable } from './organization.table';
import { ProfileTable } from './profile.table';
import { PostTable } from './post.table';

export class UserTable extends BaseTable {
  readonly table = 'user';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    orgId: t.integer(),
    name: t.text(),
  }));

  relations = {
    organization: this.belongsTo(() => OrganizationTable, {
      columns: ['orgId'],
      references: ['id'],
    }),
    profile: this.hasOne(() => ProfileTable, {
      columns: ['id'],
      references: ['userId'],
    }),
    posts: this.hasMany(() => PostTable, {
      columns: ['id'],
      references: ['authorId'],
    }),
  };
}
```

New:

```ts
import { defineTable } from './table-factory';
import { OrganizationTable } from './organization.table';
import { ProfileTable } from './profile.table';
import { PostTable } from './post.table';

export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  orgId: t.integer(),
  name: t.text(),
})).relations((user) => ({
  organization: user('orgId').belongsTo(() => OrganizationTable('id')),
  profile: user('id').hasOne(() => ProfileTable('userId')),
  posts: user('id').hasMany(() => PostTable('authorId')),
}));
```

The old `columns` option becomes the argument list passed to the current table builder: `user('orgId')`. The old `references` option becomes the argument list passed to the target table: `OrganizationTable('id')`.

For composite keys, pass multiple columns on both sides in the same order.

Old:

```ts
relations = {
  account: this.belongsTo(() => AccountTable, {
    columns: ['tenantId', 'accountId'],
    references: ['tenantId', 'id'],
  }),
};
```

New:

```ts
export const UserTable = defineTable('user', (t) => ({
  tenantId: t.integer(),
  accountId: t.integer(),
})).relations((user) => ({
  account: user('tenantId', 'accountId').belongsTo(() =>
    AccountTable('tenantId', 'id'),
  ),
}));
```

Move `required` from the relation options to a chain method. Use `.required()` for `required: true` and `.required(false)` for `required: false`.

Old:

```ts
relations = {
  profile: this.hasOne(() => ProfileTable, {
    columns: ['id'],
    references: ['userId'],
    required: true,
  }),
  manager: this.belongsTo(() => UserTable, {
    columns: ['managerId'],
    references: ['id'],
    required: false,
  }),
};
```

New:

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  managerId: t.integer().nullable(),
})).relations((user) => ({
  profile: user('id')
    .hasOne(() => ProfileTable('userId'))
    .required(),
  manager: user('managerId')
    .belongsTo(() => UserTable('id'))
    .required(false),
}));
```

`required` describes whether a selected `belongsTo` or `hasOne` relation is expected to exist. It does not change column nullability: keep nullable foreign key columns as `.nullable()` in the column definition.

Move relation conditions from `on` to `.where` on the target endpoint.

Old:

```ts
relations = {
  draftPosts: this.hasMany(() => PostTable, {
    columns: ['id'],
    references: ['authorId'],
    on: { status: 'draft' },
  }),
  activeUser: this.belongsTo(() => UserTable, {
    columns: ['userId'],
    references: ['id'],
    on: { active: true },
  }),
};
```

New:

```ts
export const ProfileTable = defineTable('profile', (t) => ({
  id: t.identity().primaryKey(),
  userId: t.integer(),
})).relations((profile) => ({
  activeUser: profile('userId').belongsTo(() =>
    UserTable('id').where({ active: true }),
  ),
}));

export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  active: t.boolean(),
})).relations((user) => ({
  draftPosts: user('id').hasMany(() =>
    PostTable('authorId').where({ status: 'draft' }),
  ),
}));
```

Through relations no longer use `{ through, source }` options on the relation. Instead, call `.through()` on the target table or query. Pass at least two relation names: first the relation from the current table to the intermediate table, then the relation from that table to the final target. Add more names to continue the path.

Old:

```ts
relations = {
  profile: this.hasOne(() => ProfileTable, {
    columns: ['id'],
    references: ['userId'],
  }),
  picture: this.hasOne(() => PictureTable, {
    through: 'profile',
    source: 'picture',
    required: true,
  }),
  tags: this.hasMany(() => TagTable, {
    through: 'posts',
    source: 'tags',
  }),
};
```

New:

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
})).relations((user) => ({
  profile: user('id').hasOne(() => ProfileTable('userId')),
  posts: user('id').hasMany(() => PostTable('authorId')),
  picture: user
    .hasOne(() => PictureTable.through('profile', 'picture'))
    .required(),
  tags: user.hasMany(() => TagTable.through('posts', 'tags')),
}));
```

For a condition on a through relation, put `.where` on the target query before or after `.through()`.

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
})).relations((user) => ({
  draftTags: user.hasMany(() =>
    TagTable.where({ status: 'draft' }).through('posts', 'tags'),
  ),
  activePicture: user.hasOne(() =>
    PictureTable.through('profile', 'picture').where({ active: true }),
  ),
}));
```

`hasAndBelongsToMany` also uses the current table builder for local columns and a target endpoint for referenced columns. Move join table configuration to `.through(joinTable, selfColumns, relatedColumns, options)`.

Old:

```ts
relations = {
  tags: this.hasAndBelongsToMany(() => TagTable, {
    columns: ['id'],
    references: ['postId'],
    through: {
      table: 'postTag',
      columns: ['tagId'],
      references: ['id'],
      schema: 'schema',
      snakeCase: false,
      foreignKey: { onUpdate: 'RESTRICT' },
    },
    foreignKey: false,
  }),
};
```

New:

```ts
export const PostTable = defineTable('post', (t) => ({
  id: t.identity().primaryKey(),
})).relations((post) => ({
  tags: post('id')
    .hasAndBelongsToMany(() => TagTable('id'))
    .through('postTag', 'postId', 'tagId', {
      joinTableSnakeCase: false,
    })
    .foreignKey({
      forThisTable: false,
      forRelatedTable: { onUpdate: 'RESTRICT' },
    }),
}));
```

In the new form, the `.through()` arguments are:

```ts
.through(joinTableName, joinColumnsToThisTable, joinColumnsToRelatedTable)
```

Use arrays for composite join columns:

```ts
export const PostTable = defineTable('post', (t) => ({
  id: t.integer(),
  tenantId: t.integer(),
})).relations((post) => ({
  tags: post('tenantId', 'id')
    .hasAndBelongsToMany(() => TagTable('tenantId', 'id'))
    .through('postTags', ['tenantId', 'postId'], ['tenantId', 'tagId']),
}));
```

If the old `through` config included a string `schema`, prefix the join table
name in the first `.through` argument:

```ts
export const PostTable = defineTable('post', (t) => ({
  id: t.identity().primaryKey(),
})).relations((post) => ({
  tags: post('id')
    .hasAndBelongsToMany(() => TagTable('id'))
    .through('joinSchema.postTag', 'postId', 'tagId'),
}));
```

If the old `schema` was a function, pass it in the fourth `.through` argument:

```ts
export const PostTable = defineTable('post', (t) => ({
  id: t.identity().primaryKey(),
})).relations((post) => ({
  tags: post('id')
    .hasAndBelongsToMany(() => TagTable('id'))
    .through('postTag', 'postId', 'tagId', {
      schema: () => tenantManager.getStore().joinSchema,
    }),
}));
```

When `snakeCase` is enabled, Orchid snake-cases the join table name part. The
schema prefix is used as-is. To preserve the join table name exactly, keep using
`{ joinTableSnakeCase: false }`.

Move relation foreign key options to `.foreignKey()`.

Old:

```ts
relations = {
  organization: this.belongsTo(() => OrganizationTable, {
    columns: ['orgId'],
    references: ['id'],
    foreignKey: { onDelete: 'CASCADE' },
  }),
  posts: this.hasMany(() => PostTable, {
    columns: ['id'],
    references: ['authorId'],
    foreignKey: false,
  }),
};
```

New:

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  orgId: t.integer(),
})).relations((user) => ({
  organization: user('orgId')
    .belongsTo(() => OrganizationTable('id'))
    .foreignKey({ onDelete: 'CASCADE' }),
  posts: user('id')
    .hasMany(() => PostTable('authorId'))
    .foreignKey(false),
}));
```

For direct relations, `.foreignKey()` with no arguments means `true` and uses the configured `autoForeignKeys` defaults. `.foreignKey(false)` skips that relation's foreign key. `.foreignKey({ onDelete: 'CASCADE' })` creates it with custom options.

For `belongsTo`, the foreign key is created on the current table. For `hasOne` and `hasMany`, it is created on the related table. For `hasAndBelongsToMany`, `.foreignKey()` controls foreign keys on the join table: use `forThisTable`, `forRelatedTable`, or `forBothTables` for per-side control.

Foreign keys are generated only when auto foreign keys are enabled, either globally in `createTableFactory` or per table in `defineTable` options, or when `.foreignKey()` is called for the relation.

```ts
export const { defineTable } = createTableFactory({
  autoForeignKeys: { onUpdate: 'RESTRICT' },
});

export const UserTable = defineTable(
  'user',
  { autoForeignKeys: true },
  (t) => ({
    id: t.identity().primaryKey(),
    orgId: t.integer(),
  }),
).relations((user) => ({
  organization: user('orgId').belongsTo(() => OrganizationTable('id')),
}));
```

Views use the same `.relations` DSL:

```ts
export const ActiveUserView = defineView('activeUser', (t) => ({
  id: t.integer(),
}))
  .query((orm: typeof db) => orm.user.select('id').where({ active: true }))
  .relations((activeUser) => ({
    profile: activeUser('id').hasOne(() => ProfileTable('userId')),
    tags: activeUser.hasMany(() => TagTable.through('posts', 'tags')),
  }));
```

View relations are available for queries, but they do not generate foreign key constraints.

## Views

View classes become exported constants created with `defineView`. Export
`defineView` from the same `createTableFactory` setup that exports
`defineTable` and `sql`.

Old:

```ts
import { orchidORM, setGrants } from 'orchid-orm';
import { BaseTable, sql } from './base-table';
import { UserTable } from './user.table';

export class MonthlySalesView extends BaseTable.View {
  schema = 'analytics';
  readonly name = 'monthly_sales';

  securityInvoker = true;
  checkOption = 'LOCAL' as const;

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

  grants = setGrants([
    {
      to: 'reporting_user',
      privileges: ['SELECT'],
    },
  ]);
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
```

New:

```ts
import { orchidORM } from 'orchid-orm';
import { defineView, sql } from './table-factory';
import { UserTable } from './user.table';

export const MonthlySalesView = defineView(
  'monthlySales',
  {
    schema: 'analytics',
    nameInDb: 'monthly_sales',
    securityInvoker: true,
    checkOption: 'LOCAL',
    sql: sql`
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
  .relations((monthlySales) => ({
    user: monthlySales('userId').belongsTo(() => UserTable('id')),
  }))
  .grants([
    {
      to: 'reporting_user',
      privileges: ['SELECT'],
    },
  ]);

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
```

The first `defineView` argument is the query-facing view alias. It replaces the
old view `name` for query typing and qualified column names. `nameInDb` is the
database view or materialized view name. When `snakeCase` is enabled and
`nameInDb` is omitted, Orchid derives the database name from the first argument.
Use `schema` to qualify the database relation.

Views are still registered in the first `orchidORM` options argument under
`views`, and runtime queries still go through `db.$views.<key>`:

```ts
const rows = await db.$views.monthlySales
  .select('userId', 'total')
  .where({ userId: 1 })
  .order({ total: 'DESC' });
```

For a simple view without options, pass the column callback as the second
argument:

```ts
export const UserNameView = defineView('userName', (t) => ({
  id: t.integer(),
  name: t.text(),
}));
```

Regular views are read-only by default. If the view is writable in PostgreSQL,
move `readonly readOnly = false` to the options object:

Old:

```ts
export class ActiveUserView extends BaseTable.View {
  readonly name = 'activeUser';
  readonly readOnly = false;
  readonly checkOption = 'CASCADED';

  columns = this.setColumns((t) => ({
    id: t.integer().primaryKey(),
    name: t.text(),
    active: t.boolean(),
  }));

  sql = sql`SELECT id, name, active FROM "user" WHERE active = true`;
}
```

New:

```ts
export const ActiveUserView = defineView(
  'activeUser',
  {
    readOnly: false,
    checkOption: 'CASCADED',
    sql: sql`SELECT id, name, active FROM "user" WHERE active = true`,
  },
  (t) => ({
    id: t.integer().primaryKey(),
    name: t.text(),
    active: t.boolean(),
  }),
);
```

For migration-managed regular views, provide the view SQL either with the `sql`
option or with `.query()`.
The `.query` callback argument must have an explicit ORM type annotation, such
as `orm: typeof db`.

Old query-defined view:

```ts
export class ActiveUserView extends BaseTable.View {
  readonly name = 'activeUser';

  columns = this.setColumns((t) => ({
    id: t.integer(),
    name: t.text(),
  }));

  init(db: typeof appDb) {
    this.query = db.user.select('id', 'name').where({ active: true });
  }
}
```

New query-defined view:

```ts
export const ActiveUserView = defineView('activeUser', (t) => ({
  id: t.integer(),
  name: t.text(),
})).query((orm: typeof db) =>
  orm.user.select('id', 'name').where({ active: true }),
);
```

In the new design, `.init()` is unrelated to defining view SQL. Use `.init()`
only for hook setup.

Materialized views use `defineView` with `materialized: true`. Move
`withData` into the options object. Materialized views remain read-only even if
`readOnly: false` is passed.

Old:

```ts
import { refreshMaterializedView } from 'orchid-orm';
import { BaseTable, sql } from './base-table';

export class MonthlySalesView extends BaseTable.MaterializedView {
  schema = 'analytics';
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
}

await refreshMaterializedView(db.$views.monthlySales, {
  concurrently: true,
  withData: true,
});
```

New:

```ts
import { refreshMaterializedView } from 'orchid-orm';
import { defineView, sql } from './table-factory';

export const MonthlySalesView = defineView(
  'monthlySales',
  {
    materialized: true,
    withData: false,
    schema: 'analytics',
    nameInDb: 'monthly_sales',
    sql: sql`
      SELECT
        "userId",
        date_trunc('month', "createdAt")::date AS month,
        sum(total) AS total
      FROM sale
      GROUP BY "userId", date_trunc('month', "createdAt")::date
    `,
  },
  (t) => ({
    userId: t.integer(),
    month: t.date(),
    total: t.decimal(),
  }),
);

await refreshMaterializedView(db.$views.monthlySales, {
  concurrently: true,
  withData: true,
});
```

Regular view options are `nameInDb`, `schema`, `recursive`, `checkOption`,
`securityBarrier`, `securityInvoker`, `readOnly`, and `generatorIgnore`.
Materialized views use materialized behavior plus `withData`; regular-view
options such as `recursive`, `checkOption`, `securityBarrier`, and
`securityInvoker` do not apply to materialized views.

Views can use the chain methods that make sense for queryable relations:
`.computed`, `.scopes`, `.softDelete`, `.relations`, `.grants`, and `.init`.
They also expose validation schema methods and type helpers from the view
definition value. Views do not support table-only metadata such as table
comments, table row-level security, table auto foreign keys, or no-primary-key
enforcement.

Each configured table or view must resolve to a unique database relation name
within its schema. Duplicate database names across tables and views are
rejected.

## Computed columns

Move `setComputed` into the `.computed` chain method. The callback receives the
same query helper as before, so SQL computed columns and runtime computed
columns keep the same shapes.

Before:

```ts
class UserTable extends BaseTable {
  readonly table = 'user';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
  }));

  computed = this.setComputed((q) => ({
    fullName: q.computeAtRuntime(
      ['firstName', 'lastName'],
      (record) => `${record.firstName} ${record.lastName}`,
    ),
    sqlFullName:
      sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
        (t) => t.string(),
      ),
  }));
}
```

After:

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  firstName: t.string(),
  lastName: t.string(),
})).computed((q) => ({
  fullName: q.computeAtRuntime(
    ['firstName', 'lastName'],
    (record) => `${record.firstName} ${record.lastName}`,
  ),
  sqlFullName:
    sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type((t) =>
      t.string(),
    ),
}));
```

`.computed` accepts the same object or callback forms as `setComputed`,
including SQL computed columns, `computeAtRuntime`, and
`computeBatchAtRuntime`. Computed columns are still not selected by default.
Views can also define computed columns with `.computed`.

## Scopes

Move `setScopes` into the `.scopes` chain method. Scope names and query behavior
stay the same.

Before:

```ts
class UserTable extends BaseTable {
  readonly table = 'user';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    hidden: t.boolean(),
    active: t.boolean(),
  }));

  scopes = this.setScopes({
    default: (q) => q.where({ hidden: false }),
    active: (q) => q.where({ active: true }),
  });
}
```

After:

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  hidden: t.boolean(),
  active: t.boolean(),
})).scopes({
  default: (q) => q.where({ hidden: false }),
  active: (q) => q.where({ active: true }),
});
```

Query usage is unchanged: use `db.some.scope('active')` to apply a named scope
and `unscope('default')` to remove the default scope. Views can also define
scopes with `.scopes`.

## Soft delete

Replace the `softDelete` class property with the `.softDelete` chain method.
Calling it without arguments uses the default `deletedAt` column.

Before:

```ts
class UserTable extends BaseTable {
  readonly table = 'user';
  readonly softDelete = true;

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    deletedAt: t.timestamp().nullable(),
  }));
}
```

After:

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  deletedAt: t.timestamp().nullable(),
})).softDelete();
```

For a custom soft-delete column, pass its name to `.softDelete`. The column must
exist in the table definition.

Before:

```ts
class UserTable extends BaseTable {
  readonly table = 'user';
  readonly softDelete = 'archivedAt' as const;

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    archivedAt: t.timestamp().nullable(),
  }));
}
```

After:

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  archivedAt: t.timestamp().nullable(),
})).softDelete('archivedAt');
```

Queries still filter deleted records by default, and `includeDeleted` and
`hardDelete` behavior is unchanged. Views can use `.softDelete` when it makes
sense, especially writable views; materialized and read-only views still cannot
mutate normally.

## Row level security

Replace `defineRls` with the `.rls` chain method on the table definition. The
configuration shape is the same: `enable`, `force`, `permit`, and `restrict`
are migrated without changing policy names, roles, commands, or SQL
expressions.

Before:

```ts
import { defineRls } from 'orchid-orm';
import { BaseTable, sql } from './base-table';

export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    tenantId: t.uuid(),
    archivedAt: t.timestamp().nullable(),
  }));

  rls = defineRls({
    enable: true,
    force: true,
    permit: [
      {
        name: 'project_select_same_tenant',
        for: 'SELECT',
        to: ['app_user', 'app_admin'],
        using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
      },
    ],
    restrict: [
      {
        name: 'project_select_not_archived',
        for: 'SELECT',
        to: 'app_user',
        using: sql`archived_at IS NULL`,
      },
    ],
  });
}
```

After:

```ts
import { defineTable, sql } from './table-factory';

export const ProjectTable = defineTable('project', (t) => ({
  id: t.identity().primaryKey(),
  tenantId: t.uuid(),
  archivedAt: t.timestamp().nullable(),
})).rls({
  enable: true,
  force: true,
  permit: [
    {
      name: 'project_select_same_tenant',
      for: 'SELECT',
      to: ['app_user', 'app_admin'],
      using: sql`tenant_id = current_setting('app.tenant_id', true)::uuid`,
    },
  ],
  restrict: [
    {
      name: 'project_select_not_archived',
      for: 'SELECT',
      to: 'app_user',
      using: sql`archived_at IS NULL`,
    },
  ],
});
```

Migration generation emits the same table RLS flags and policies for the new
definition. RLS is supported for tables only; `defineView` does not support
`.rls`. ORM-level `rls.tableRlsDefaults` configuration is unchanged.

## Grants and generator ignore

Replace table-local `setGrants` with the `.grants` chain method. The grant
objects are the same, but the wrapper is no longer needed.

Before:

```ts
import { setGrants } from 'orchid-orm';
import { BaseTable } from './base-table';

export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
  }));

  grants = setGrants([
    {
      to: 'app_user',
      grantedBy: 'owner',
      privileges: ['SELECT'],
      grantablePrivileges: ['UPDATE'],
    },
  ]);
}
```

After:

```ts
import { defineTable } from './table-factory';

export const ProjectTable = defineTable('project', (t) => ({
  id: t.identity().primaryKey(),
})).grants([
  {
    to: 'app_user',
    grantedBy: 'owner',
    privileges: ['SELECT'],
    grantablePrivileges: ['UPDATE'],
  },
]);
```

Views and materialized views also support `.grants`:

```ts
export const ActiveProjectView = defineView('activeProject', (t) => ({
  id: t.integer(),
  tenantId: t.uuid(),
}))
  .query((orm: typeof db) =>
    orm.project.where({ archivedAt: null }).select('id', 'tenantId'),
  )
  .grants([
    {
      to: 'app_user',
      privileges: ['SELECT'],
    },
  ]);
```

Move table-local `generatorIgnore` into the `defineTable` options object.

Before:

```ts
export class TestTable extends BaseTable {
  readonly table = 'test';
  readonly generatorIgnore = true;

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
  }));
}
```

After:

```ts
export const TestTable = defineTable(
  'test',
  { generatorIgnore: true },
  (t) => ({
    id: t.identity().primaryKey(),
  }),
);
```

`defineView` accepts the same option:

```ts
export const TestView = defineView(
  'testView',
  { generatorIgnore: true },
  (t) => ({
    id: t.integer(),
  }),
).query((orm: typeof db) => orm.test.select('id'));
```

Table-local and view-local `generatorIgnore` skip that table or view DDL during
migration generation. ORM-level `grants`, `defaultGrantedBy`, and
`generatorIgnore` configuration stays unchanged, and grant-specific or
RLS-specific generator ignores still live in ORM config as before.

## Hooks

Move table initialization hooks from an `init` method on the table class to the
`.init` chain method on the table definition. The `init` callback receives the
ORM instance first and a `hooks` object second. Use the ORM instance for database
queries as before, and register table hooks on `hooks` instead of `this`.

Old:

```ts
import { BaseTable } from './base-table';
import { db } from './db';

export class UserTable extends BaseTable {
  readonly table = 'user';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
  }));

  init(orm: typeof db) {
    this.beforeCreate(({ set }) => {
      set({ name: 'overridden' });
    });

    this.afterCreate(['id', 'name'], (records) => {
      for (const record of records) {
        console.log(record.id, record.name);
      }
    });

    this.afterCreateCommit(['id'], async (records) => {
      await orm.auditLog.createMany(
        records.map((record) => ({
          tableName: 'user',
          recordId: record.id,
          action: 'create',
        })),
      );
    });
  }
}
```

New:

```ts
import { defineTable } from './table-factory';
import { db } from './db';

export const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(),
  password: t.text(),
})).init((orm: typeof db, hooks) => {
  hooks.beforeCreate(({ set }) => {
    set({ name: 'overridden' });
  });

  hooks.afterCreate(['id', 'name'], (records) => {
    for (const record of records) {
      console.log(record.id, record.name);
    }
  });

  hooks.afterCreateCommit(['id'], async (records) => {
    await orm.auditLog.createMany(
      records.map((record) => ({
        tableName: 'user',
        recordId: record.id,
        action: 'create',
      })),
    );
  });
});
```

Hook names, callback argument shapes, selected columns for after hooks, and
before/after/after-commit timing are unchanged. Only the registration target
changes from `this` to the `hooks` argument.

The same migration applies to all table hook methods:
`beforeQuery`, `beforeCreate`, `beforeUpdate`, `beforeDelete`, `beforeSave`,
`afterQuery`, `afterCreate`, `afterUpdate`, `afterDelete`, `afterSave`,
`afterCreateCommit`, `afterUpdateCommit`, `afterDeleteCommit`, and
`afterSaveCommit`.

Views can also use `.init`. Writable regular views can use mutation hooks in the
same way as tables. Read-only views and materialized views still cannot use
mutation hooks because they cannot be mutated.

Query-level hook registration is unchanged:

```ts
db.user.beforeCreate(({ set }) => {
  set({ name: 'overridden' });
});
```

## Type helpers and validation schemas

Table type helpers keep the same names. With class-based tables, pass the table
class type to the helper:

Old:

```ts
import {
  DefaultSelect,
  Insertable,
  Queryable,
  Selectable,
  Updatable,
} from 'orchid-orm';
import { UserTable } from './user.table';

export type User = Selectable<UserTable>;
export type UserDefault = DefaultSelect<UserTable>;
export type UserNew = Insertable<UserTable>;
export type UserUpdate = Updatable<UserTable>;
export type UserWhere = Queryable<UserTable>;
```

With function-style table definitions, pass the definition value type with
`typeof`:

New:

```ts
import {
  DefaultSelect,
  Insertable,
  Queryable,
  Selectable,
  Updatable,
} from 'orchid-orm';
import { defineTable } from './table-factory';

export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(),
  email: t.text(),
}));

export type User = Selectable<typeof UserTable>;
export type UserDefault = DefaultSelect<typeof UserTable>;
export type UserNew = Insertable<typeof UserTable>;
export type UserUpdate = Updatable<typeof UserTable>;
export type UserWhere = Queryable<typeof UserTable>;
```

The helpers support both old class instance types and new definition values, so
mixed migrations can update each exported type when its table is converted.

The same `typeof` rule applies to `defineView` values:

```ts
export const ActiveUserView = defineView('activeUser', (t) => ({
  id: t.integer(),
  name: t.text(),
})).query((orm: typeof db) =>
  orm.user.where({ active: true }).select('id', 'name'),
);

export type ActiveUser = Selectable<typeof ActiveUserView>;
export type ActiveUserWhere = Queryable<typeof ActiveUserView>;
```

`Insertable` and `Updatable` are mainly useful for tables and writable regular
views. Read-only views and materialized views cannot be inserted into or updated
through Orchid.

Validation schema methods also keep the same names. If the old base table was
created with a schema config, those methods were available as static methods on
the table class:

Old:

```ts
import { createBaseTable } from 'orchid-orm';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  schemaConfig: zodSchemaConfig,
});

export class UserTable extends BaseTable {
  readonly table = 'user';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    email: t.text(),
  }));
}

export const userInputSchema = UserTable.inputSchema();
export const userOutputSchema = UserTable.outputSchema();
export const userQuerySchema = UserTable.querySchema();
export const userPkeySchema = UserTable.pkeySchema();
export const userCreateSchema = UserTable.createSchema();
export const userUpdateSchema = UserTable.updateSchema();
```

With `createTableFactory`, keep `schemaConfig` in the factory and call the same
methods directly on the definition value. Do not use `typeof` for schema method
calls:

New:

```ts
import { createTableFactory } from 'orchid-orm';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';

export const { defineTable } = createTableFactory({
  schemaConfig: zodSchemaConfig,
});

export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.text(),
  email: t.text(),
}));

export const userInputSchema = UserTable.inputSchema();
export const userOutputSchema = UserTable.outputSchema();
export const userQuerySchema = UserTable.querySchema();
export const userPkeySchema = UserTable.pkeySchema();
export const userCreateSchema = UserTable.createSchema();
export const userUpdateSchema = UserTable.updateSchema();
```

Adapter-specific schema config advice is unchanged: keep using the schema config
package that matches your validation library, and pass it to the table factory
that creates your tables and views.

## Final checklist

- Export `defineTable`, and usually `defineView` and `sql`, from a shared
  `createTableFactory` setup.
- Switch `rake-db` config from `baseTable` to `defineTable` when migration
  generation should emit function-style definitions.
- Convert table classes to `defineTable` values.
- Move table properties such as `schema`, `nameInDb`, `readOnly`,
  `generatorIgnore`, and `autoForeignKeys` into the options object.
- Move composite primary keys, indexes, checks, excludes, and table foreign keys
  to table chain methods.
- Convert relations to the callable relation DSL. Any tables connected by
  relations need to be migrated together, because class-based and function-style
  relation declarations cannot reference each other.
- Convert views to `defineView` and register them in ORM config under `views`.
- Move computed columns, scopes, soft delete, RLS, grants, and hooks to chain
  methods.
- Update type helpers for converted definitions to use `typeof UserTable`.
- Keep validation schema calls on the table or view value:
  `UserTable.inputSchema()`, `UserTable.createSchema()`, and the other schema
  helpers.
- Run `pnpm verify` after code changes, and run `db g` or the appropriate
  migration generation command when table or view DDL should be regenerated.

The old `createBaseTable` API remains supported, so you do not need to migrate
everything in one pass. Class-based and function-style definitions can coexist
while you move tables and views over gradually, but relation-connected tables
must stay within the same table definition style.
