---
outline: deep
---

# ORM 和查询构建器

`OrchidORM` 由查询构建器（例如 [Knex](https://knexjs.org/) 或 [Kysely](https://www.kysely.dev/docs/intro)）和一个用于定义、查询和利用关系的层（类似于 [Prisma](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)）组成。

查询构建器用于构建和执行 SQL 查询，例如 `select`、`create`、`update` 和 `delete`。

ORM 允许定义 `belongsTo`、`hasMany` 和[其他关系](/zh-CN/guide/relations)，选择并连接它们，与相关记录一起创建/更新/删除记录，以及[更多功能](/zh-CN/guide/relation-queries)。

## 设置

通过以下命令安装：

```sh
npm i orchid-orm
# 或
pnpm i orchid-orm
```

`orchidORM` 是 ORM 的入口函数。

第一个参数是连接选项对象，ORM 特定选项如下所述，
还可以查看可以通过同一对象传递的 `pg` 适配器选项：[客户端选项](https://node-postgres.com/api/client) + [池选项](https://node-postgres.com/api/pool)。

第二个参数是一个对象，其中键是名称，值是表类（请参阅下一节以定义表类）。

返回一个实例，其中包含表和一些以 `$` 符号为前缀的特定函数，以避免与您的表重叠。

```ts
import { orchidORM } from 'orchid-orm';

// 导入所有表
import { UserTable } from './tables/user';
import { MessageTable } from './tables/message';

export const db = orchidORM(
  {
    // databaseURL 的详细信息如下
    databaseURL: process.env.DATABASE_URL,

    // ssl 和 schema 可以在此处设置，也可以作为 databaseURL 参数：
    ssl: true,
    schema: 'my_schema',

    // 数据库启动时重试连接，默认情况下不重试，
    // 请参阅下面的 `connectRetry` 部分
    connectRetry: true,

    // 日志选项，默认值为 false
    log: true,

    // 自动为关系创建外键
    // 请参阅下面的 `autoForeignKeys` 部分
    autoForeignKeys: true,

    // 选项以隐式方式创建命名的预备语句，默认值为 false
    autoPreparedStatements: true,
  },
  {
    user: UserTable,
    message: MessageTable,
  },
);
```

如果需要，可以传递 `Adapter` 实例而不是连接选项：

```ts
import { orchidORM, Adapter } from 'orchid-orm';

export const db = orchidORM(
  {
    adapter: new Adapter({ databaseURL: process.env.DATABASE_URL }),
    log: true,
  },
  {
    // ...tables
  },
);
```

## 定义基础表

定义一个基础表类以进行扩展，此代码应与 `db` 文件分开：

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable();

export const { sql } = BaseTable;
```

`sql` 在此处导出，因为这样可以将其与 `BaseTable` 中定义的自定义列链接。

可以选择在此处自定义列类型行为，以供将来所有表使用：

```ts
import { createBaseTable } from 'orchid-orm';
// 可选地，使用以下验证集成之一：
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { valibotSchemaConfig } from 'orchid-orm-valibot';

export const BaseTable = createBaseTable({
  // 如果数据库中的列为 snake_case，请设置为 true
  snakeCase: true,

  // 可选，但推荐：从您的表派生并使用验证模式
  schemaConfig: zodSchemaConfig,
  // 或
  schemaConfig: valibotSchemaConfig,

  columnTypes: (t) => ({
    // 默认情况下，时间戳返回为字符串，覆盖为 Data
    timestamp: () => t.timestamp().asDate(),

    // 在 BaseTable 中定义自定义类型以便以后在表中使用
    myEnum: () => t.enum('myEnum', ['one', 'two', 'three']),
  }),
});

export const { sql } = BaseTable;
```

有关自定义列的详细信息，请参阅[覆盖列类型](/zh-CN/guide/columns-overview#override-column-types)。

表定义为类 `table` 和 `columns` 所需属性：

`table` 是表名，`columns` 用于定义表列类型（有关详细信息，请参阅[列模式](/zh-CN/guide/columns-overview)文档）。

请注意，`table` 属性标记为 `readonly`，这是 TypeScript 检查查询中表使用所需的。

```ts
import { Selectable, DefaultSelect, Insertable, Updatable } from 'orchid-orm';
// 从上一步的文件导入 BaseTable：
import { BaseTable } from './baseTable';

// 导出各种用例的用户类型：
export type User = Selectable<UserTable>;
export type UserDefault = DefaultSelect<UserTable>;
export type UserNew = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string(),
    ...t.timestamps(),
  }));
}
```

定义表后，将其放置在主 `db` 文件中，如[设置](#设置)步骤中所示：

```ts
import { UserTable } from './tables/user';

export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
  },
  {
    user: UserTable,
  },
);
```

现在可以查询了：

```ts
import { db } from './db';

const user = await db.user.findBy({ name: 'John' });
```

不要直接使用表类，这不起作用：

```ts
// 错误
await UserTable.findBy({ name: 'John' });
```

`snakeCase` 可以为表覆盖：

```ts
import { BaseTable } from './baseTable';

export class SnakeCaseTable extends BaseTable {
  readonly table = 'table';
  // 覆盖 snakeCase：
  snakeCase = true;
  columns = this.setColumns((t) => ({
    // 数据库中的 snake_column
    snakeColumn: t.text(),
  }));
}
```

## 定义表类

表类类似于其他 ORM 中的模型或实体。
主要区别在于模型/实体还包含业务逻辑，
而 OrchidORM 中的表仅用于配置数据库表列、关系、允许定义[软删除](/zh-CN/guide/orm-and-query-builder#softdelete)，
查询[钩子](/zh-CN/guide/hooks#lifecycle-hooks)（又称回调），因此定义数据库表和查询特性，而不是应用程序的逻辑。

```ts
import { BaseTable, sql } from './baseTable';
import { PostTable } from './post.table';
import { SubscriptionTable } from './subscription.table';

export class UserTable extends BaseTable {
  schema = 'customSchema';
  readonly table = 'user';

  // 注释将保留到数据库的表元数据中。
  comment = '这是一个用于存储用户的表';

  // 如果您未定义主键，OrchidORM 会通过错误提醒您，
  // 如果您确实需要一个没有主键的表，请设置 `noPrimaryKey = true`。
  noPrimaryKey = true;

  // 您可以为所有表在 `BaseTable` 中设置 `snakeCase`，
  // 或者可以为单个表启用它。
  snakeCase = true;

  // 对于全文搜索：'english' 是默认值，您可以将其设置为其他语言
  language = 'spanish';

  // 对于“软删除”功能
  readonly softDelete = true; // 或一个带有列名的字符串

  columns = this.setColumns(
    (t) => ({
      id: t.uuid().primaryKey(),
      firstName: t.string(),
      lastName: t.string(),
      username: t.string().unique(),
      email: t.string().email().unique(),
      deletedAt: t.timestamp().nullable(),
      subscriptionProvider: t.enum('paymentProvider', ['stripe', 'paypal']),
      subscriptionId: t.uuid(),
      startDate: t.timestamp(),
      endDate: t.timestamp(),
      ...t.timestamps(),
    }),
    // 第二个函数是可选的，用于复合主键、索引等。
    // 对于单个项目无需将其包装在数组中：
    // (t) => t.index(['role', 'deletedAt']),
    // 对于多个项目，返回数组：
    (t) => [
      // 复合主键
      t.primaryKey(['firstName', 'lastName']),
      // 复合唯一索引
      t.unique(['subscriptionProvider', 'subscriptionId']),
      // 复合外键
      t.foreignKey(
        ['subscriptionProvider', 'subscriptionId'],
        () => SubscriptionTable,
        ['provider', 'id'],
      ),
      // postgres `EXCLUDE` 约束：不允许不同行的时间范围重叠
      t.exclude([
        { expression: `tstzrange("startDate", "endDate")`, with: '&&' },
      ]),
      // 数据库级检查
      t.check(sql`username != email`),
    ],
  );

  // 定义将在数据库端使用自定义 SQL 计算的“虚拟”列
  computed = this.setComputed({
    fullName: (q) =>
      sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
        (t) => t.string(),
      ),
  });

  // `default` 范围将应用于所有查询，
  // 您可以定义其他范围以在构建查询时使用它们。
  scopes = this.setScopes({
    default: (q) => q.where({ hidden: false }),
    active: (q) => q.where({ active: true }),
  });

  relations = {
    posts: this.hasMany(() => PostTable, {
      columns: ['id'],
      references: ['authorId'],
    }),
  };
}
```

- `table` 和 `softDelete` 必须是 readonly 的，以便 TS 正确识别它们，其他属性不必是 readonly 的。
- 有关配置列，请参阅[列模式概述](/zh-CN/guide/columns-overview)。
- 复合主键、索引、排除、外键的文档位于[迁移列方法](/zh-CN/guide/migration-column-methods)
- 有关定义表的关系，请参阅[建模关系](/zh-CN/guide/relations)。
- 查看[软删除](/zh-CN/guide/orm-and-query-builder#softdelete)
- 有关 `computed`，请参阅[计算列](/zh-CN/guide/orm-and-query-builder#computed-columns)。
- 有关 `scopes`，请参阅[范围](/zh-CN/guide/orm-and-query-builder#scopes)。

所有表文件必须链接到 `orchidORM` 实例，如上面[设置](#设置)部分所示。

当在已经有表的现有项目中尝试 OrchidORM 时，
您可以运行命令生成表代码及其迁移，方法是运行[db pull](/zh-CN/guide/migration-commands#pull)。

## 生成迁移

在应用程序代码中定义、修改或删除表或列后，
运行 `db g` 命令以生成相应的迁移：

```shell
npm run db g
# 或
pnpm db g
```

可选地，提供迁移文件名：

```shell
pnpm db g create-some-tables
```

它在启动时自动调用 `db up` 以应用现有迁移。

如果您希望在生成迁移后立即应用迁移，请传递 `up` 参数：

```shell
pnpm db g create-some-tables up

# 或，使用默认的“generated”文件名
pnpm db g up
```

:::warning
仅在数据库可以完全由您的应用程序管理时使用此方法。

此工具将删除所有未被您的应用程序代码引用的数据库实体（模式、表等）。
:::

此工具将自动编写迁移以创建、删除、更改、重命名数据库项目。

当您在代码中重命名表、列、枚举或模式时，它会通过终端交互式询问您是否要创建新项目或重命名旧项目。
例如在重命名列时，您可以选择删除旧列并创建新列（数据将丢失），或者重命名现有列（数据将保留）。

如果您未为索引、主键、外键、排除约束设置自定义约束名称，它们具有默认名称，例如 `table_pkey`、`table_column_idx`、`table_someId_fkey`、`table_column_exclude`。
重命名表时，表主键也会被重命名。重命名列时，其索引或外键也会被重命名。

该工具处理迁移生成
表、列、模式、枚举、主键、外键、索引、数据库检查、排除约束、扩展、域类型。

如果您希望支持其他数据库功能，例如视图、触发器、过程，请通过打开问题告诉我。

## Postgres 扩展

要启用 Postgres 扩展，例如 `citext`，请在 `orchidORM` 调用中的 `extensions` 配置中列出它：

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    extensions: [
      // 仅扩展名称用于最近版本
      'citext',

      // 您可以指定特定版本
      { name: 'citext', version: '1.2.3' },

      // 仅为特定模式定义扩展：
      'mySchema.citext',
    ],
  },
  { ...tables },
);
```

运行迁移生成器（`npm run g`）并应用迁移（`npm run db up`）。

如果扩展自动创建表，例如 `postgis`，
请在 `generatorIgnore` 配置中列出其表，
这样迁移生成器不会认为它是多余的并不会删除它：

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    extensions: ['postgis'],
    generatorIgnore: {
      // spatial_ref_sys 是由 postgis 自动创建的
      tables: ['spatial_ref_sys'],
    },
  },
  { ...tables },
);
```

## Postgres 域

域是基于其他类型的自定义数据库类型，可以包括 `NOT NULL` 和 `CHECK`（请参阅[Postgres 教程](https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/)）。

定义域如下，以便迁移生成器编写相应的迁移：

```ts
import { sql } from './baseTable';

export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    domains: {
      domainName: (t) =>
        t
          .integer()
          .nullable()
          .check(sql`VALUE = 69`),

      // 域位于某个模式中：
      'mySchema.domainName': (t) => t.integer().default(123),
    },
  },
  { ...tables },
);
```

## 表实用类型

### Selectable

`Selectable` 表示从数据库返回的记录类型，并使用[列解析器](/zh-CN/guide/common-column-methods#parse)进行解析。

例如，当使用 `asDate` 用于[时间戳](/zh-CN/guide/columns-types#date-and-time)列时，`Selectable` 将为此列具有 `Date` 类型。

它包含所有列，包括标记为[select(false)](/zh-CN/guide/common-column-methods.html#exclude-from-select)的列，
以及[计算列](/zh-CN/guide/computed-columns)。

```ts
import { Selectable } from 'orchid-orm';

export type User = Selectable<UserTable>;
```

### DefaultSelect

`DefaultSelect` 用于从数据库返回的表类型，考虑列解析器，仅限于默认选择的列。

它不包括[select(false)](/zh-CN/guide/common-column-methods.html#exclude-from-select)列，以及[计算列](/zh-CN/guide/computed-columns)。

```ts
import { DefaultSelect } from 'orchid-orm';

export type UserDefault = DefaultSelect<UserTable>;
```

### Insertable

`Insertable` 类型化了您可以用来创建新记录的对象。

列类型可以通过[encode](/zh-CN/guide/common-column-methods#encode)函数更改。

时间戳列的 `Insertable` 类型是联合 `string | number | Date`。

```ts
import { Insertable } from 'orchid-orm';

export type UserNew = Insertable<UserTable>;
```

### Updatable

`Updatable` 与 `Insertable` 相同，但所有字段都是可选的。

```ts
import { Updatable } from 'orchid-orm';

export type UserUpdate = Updatable<UserTable>;
```

### Queryable

`Queryable`：无论是否指定了[parse](/zh-CN/guide/common-column-methods#parse)或[encode](/zh-CN/guide/common-column-methods#encode)函数，
接受的类型在 `where` 和其他查询方法中保持不变。

使用此类型接受查询表的数据。

```ts
import { Queryable } from 'orchid-orm';

export type UserQueryable = Queryable<UserTable>;
```

## createDb

[//]: # 'has JSDoc'

如果您希望将 OrchidORM 的查询构建器作为独立工具使用，请安装 `pqb` 包并使用 `createDb` 初始化它。

由于 `Orchid ORM` 专注于 ORM 使用，文档示例主要展示如何使用 ORM 定义的表，
但与表关系无关的所有内容也应该可以与 `pqb` 查询构建器单独使用。

它接受与 `orchidORM` 相同的选项 + `createBaseTable` 的选项：

```ts
import { createDb } from 'orchid-orm';

import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
// 或
import { SchemaConfig } from 'orchid-orm-valibot';

const db = createDb({
  // 数据库连接选项
  databaseURL: process.env.DATABASE_URL,
  log: true,

  // 数据库中的列为 snake case：
  snakeCase: true,

  // 覆盖时间戳的默认 SQL，请参阅上面的 `nowSQL`
  nowSQL: `now() AT TIME ZONE 'UTC'`,

  // 可选，但推荐：为您的表生成 zod 模式
  schemaConfig: zodSchemaConfig,
  // 或
  schemaConfig: valibotSchemaConfig,

  // 覆盖列类型：
  columnTypes: (t) => ({
    // 默认情况下时间戳返回为字符串，覆盖为数字
    timestamp: () => t.timestamp().asNumber(),
  }),
});
```

定义 `db` 后，以以下方式构造可查询表：

```ts
export const User = db('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.string(),
  age: t.integer().nullable(),
  ...t.timestamps(),
}));
```

现在可以使用 `User` 进行类型安全查询：

```ts
const users = await User.select('id', 'name') // 仅允许已知列
  .where({ age: { gte: 20 } }) // gte 仅在数字字段上可用，并且仅允许数字
  .order({ createdAt: 'DESC' }) // 类型安全
  .limit(10);

// users 数组具有正确的类型 Array<{ id: number, name: string }>
```

可选的第三个参数用于表选项：

```ts
const Table = db('table', (t) => ({ ...columns }), {
  // 如果表属于特定数据库模式，请提供此值：
  schema: 'customTableSchema',
  // 覆盖 `createDb` 的 `log` 选项：
  log: true, // 布尔值或对象描述 `createdDb` 部分
  logger: { ... }, // 覆盖记录器
  noPrimaryKey: 'ignore', // 覆盖 noPrimaryKey
  snakeCase: true, // 覆盖 snakeCase
})
```

## databaseURL 选项

`databaseURL` 格式如下：

```
postgres://user:password@localhost:5432/dbname
```

`schema` 和 `ssl` 选项可以作为参数指定：

```
postgres://user:password@localhost:5432/dbname?schema=my_schema&ssl=true
```

如果 `schema` 设置并且与 `public` 不同，
将在每个数据库连接运行的第一个查询之前执行 `SET search_path = schema` 查询。

## snakeCase 选项

默认情况下，所有列名都应命名为 camelCase。

如果只有某些列命名为 snake_case，可以使用 `name` 方法指示：

```ts
import { BaseTable } from './baseTable';

class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    camelCase: t.integer(),
    snakeCase: t.name('snake_case').integer(),
  }));
}

// 所有列都可以通过 camelCase 名称访问，
// 即使 `snakeCase` 在数据库中具有不同的名称
const records = await table.select('camelCase', 'snakeCase');
```

将 `snakeCase` 设置为 `true`，如果您希望所有列自动转换为 snake_case。

列名仍然可以通过 `name` 方法覆盖。

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  snakeCase: true,
});

class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    // camelCase 列需要显式名称
    camelCase: t.name('camelCase').integer(),
    // snakeCase 在生成 SQL 时自动转换为 snake_case
    snakeCase: t.integer(),
  }));
}

// 结果与之前相同
const records = await table.select('camelCase', 'snakeCase');
```

## log 选项

`log` 选项默认值为 false，可以提供 `true` 或自定义对象：

```ts
type LogOption = {
  // 对于彩色日志，默认值为 true
  colors?: boolean;

  // 查询前运行的回调
  // Query 是查询对象，sql 是 { text: string, values: unknown[] }
  // 返回值将传递给 afterQuery 和 onError
  beforeQuery?(sql: Sql): unknown;

  // 查询后运行的回调，logData 是 beforeQuery 返回的数据
  afterQuery?(sql: Sql, logData: unknown): void;

  // 在错误情况下运行的回调
  onError?(error: Error, sql: Sql, logData: unknown): void;
};
```

日志将使用 `console.log` 和 `console.error` 默认值，可以通过传递 `logger` 选项覆盖：

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    log: true,
    logger: {
      log(message: string): void {
        // ...
      },
      error(message: string): void {
        // ...
      },
    },
  },
  {
    // ...tables
  },
);
```

## autoForeignKeys

通常，始终在相关表之间定义数据库级外键是一个好习惯，
因此数据库保证数据完整性，并且记录不能错误地具有不存在记录的 ID。

将 `autoForeignKeys: true` 选项添加到 `createBaseTable` 将根据定义的关系自动生成外键（如果您正在使用迁移生成器）。

您可以提供外键选项而不是 `true`，以供所有自动生成的外键使用。

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  autoForeignKeys: true, // 使用默认选项

  // 或者，您可以提供自定义选项
  autoForeignKeys: {
    // 所有字段都是可选的
    match: 'FULL', // 默认值为 'SIMPLE'，可以是 'FULL'、'PARTIAL'、'SIMPLE'。
    onUpdate: 'CASCADE', // 默认值为 'NO ACTION'，可以是 'NO ACTION'、'RESTRICT'、'CASCADE'、'SET NULL'、'SET DEFAULT'。
    onDelete: 'CASCADE', // 与 `onUpdate` 相同。
    dropMode: 'CASCADE', // 用于向下迁移，默认值为 'RESTRICT'，可以是 'CASCADE' 或 'RESTRICT'。
  },
});
```

启用此功能后，可以为特定表禁用它。
当全局禁用此功能时，可以仅为特定表启用它。

```ts
import { BaseTable } from './baseTable';

export class MyTable extends BaseTable {
  autoForeignKey = false; // 仅为此表禁用
  autoForeignKey = { onUpdate: 'RESTRICT' }; // 或者，仅为此表覆盖选项
}
```

自动外键也可以为具体关系启用、禁用、覆盖：

```ts
import { BaseTable } from './baseTable';

export class MyTable extends BaseTable {
  relations = {
    btRel: this.belongsTo(() => OtherTable, {
      columns: ['otherId'],
      references: ['id'],

      // 为此关系禁用
      foreignKey: false,
      // 或者，为此关系自定义选项
      foreignKey: {
        onUpdate: 'RESTRICT',
      },
    }),

    habtmRel: this.hasAndBelongsToMany(() => OtherTable, {
      columns: ['id'],
      references: ['myId'],

      // 禁用从连接表到此表的外键
      foreignKey: false,

      through: {
        table: 'joinTable',
        columns: ['otherId'],
        references: ['id'],

        // 自定义从连接表到其他表的外键
        foreignKey: {
          onUpdate: 'RESTRICT',
        },
      },
    }),
  };
}
```

## connectRetry

[//]: # 'has JSDoc'

此选项在 CI 中可能很有用，当数据库容器已启动，CI 开始执行下一步，
迁移开始应用，尽管数据库可能尚未完全准备好连接。

设置 `connectRetry: true` 以使用默认的回退策略。它执行 10 次尝试，从 50ms 延迟开始，并根据以下公式以指数方式增加延迟：

```
(factor, defaults to 1.5) ** (currentAttempt - 1) * (delay, defaults to 50)
```

因此，第 2 次尝试将在开始后 50ms 发生，第 3 次尝试在 125ms，第 3 次尝试在 237ms，依此类推。

您可以通过传递以下内容自定义最大尝试次数、`factor` 乘数和起始延迟：

```ts
const options = {
  databaseURL: process.env.DATABASE_URL,
  connectRetry: {
    attempts: 15, // 最大尝试次数
    strategy: {
      delay: 100, // 初始延迟
      factor: 2, // 上述公式的乘数
    }
  }
};

rakeDb(options, { ... });
```

您可以将自定义函数传递给 `strategy` 以自定义延迟行为：

```ts
import { setTimeout } from 'timers/promises';

const options = {
  databaseURL: process.env.DATABASE_URL,
  connectRetry: {
    attempts: 5,
    stragegy(currentAttempt: number, maxAttempts: number) {
      // 线性：在第 1 次尝试后等待 100ms，然后在第 2 次尝试后等待 200ms，依此类推。
      return setTimeout(currentAttempt * 100);
    },
  },
};
```

## nowSQL 选项

对于特定情况，您可以使用 `nowSQL` 选项指定 SQL 以覆盖 `timestamps()` 方法的默认值。

如果您使用的是 `timestamp` 而不是 `timestampNoTZ`，则没有问题，
或者如果您在时区为 UTC 的数据库中使用 `timestampNoTZ`，也没有问题，
但如果您在时区不同的数据库中使用 `timestampNoTZ`，
并且您仍然希望 `updatedAt` 和 `createdAt` 列自动保存当前时间（UTC），
可以为基础表指定 `nowSQL`：

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  nowSQL: `now() AT TIME ZONE 'UTC'`,

  // ...其他选项
});
```

此值用于：

- 更新记录时的 `updatedAt` 列
- 数据库中 `updatedAt` 和 `createdAt` 列的默认值，在迁移中应用

需要指定 `rakeDb` 的 `baseTable` 参数以使其在迁移中工作。

默认情况下，`Orchid ORM` 使用 `now()` 作为 `updatedAt` 和 `createdAt` 的时间戳值，在上面的示例中我们
将其覆盖为 `now() AT TIME ZONE 'UTC'`，因此即使在不同时区的数据库中也会为 `timestampNoTZ` 列生成 UTC 时间戳。

## autoPreparedStatements 选项

此选项旨在加快查询速度，但基准测试无法证明这一点，因此目前请忽略此选项。

底层使用的 `pg` 节点模块默认执行“未命名”预备语句（[链接](https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY)到 Postgres 详细信息）。

当选项设置为 `true` 时，查询构建器将为每个不同的查询生成一个名称以使语句命名。

## noPrimaryKey

所有表都应该有主键。即使是连接表，也应该有一个由外键列组成的复合主键。

如果您忘记定义主键，ORM 将通过抛出错误发送友好的提醒。

通过设置 `noPrimaryKey` 属性为特定表禁用检查：

```ts
import { BaseTable } from './baseTable';

export class NoPrimaryKeyTable extends BaseTable {
  readonly table = 'table';
  noPrimaryKey = true; // 设置为 `true` 以忽略主键的缺失
  columns = this.setColumns((t) => ({
    // ...未定义主键
  }));
}
```

或者，您可以通过将 `noPrimaryKey` 选项放入 `orchidORM` 配置中覆盖所有表的此行为：

`ignore` 将禁用检查，`warning` 将打印警告而不是抛出错误。

```ts
// 忽略所有表的主键缺失
const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    noPrimaryKey: 'ignore',
  },
  {
    // ...tables
  },
);

// 打印所有没有主键的表的警告
const db2 = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    noPrimaryKey: 'warning',
  },
  {
    // ...tables
  },
);
```

## softDelete

[//]: # 'has JSDoc'

`softDelete` 配置表以设置 `deletedAt` 为当前时间而不是删除记录。
默认情况下，所有此类表的查询将过滤掉已删除的记录。

```ts
import { BaseTable } from './baseTable';

export class SomeTable extends BaseTable {
  readonly table = 'some';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    deletedAt: t.timestamp().nullable(),
  }));

  // true 用于使用 `deletedAt` 列
  readonly softDelete = true;
  // 或提供不同的列名
  readonly softDelete = 'myDeletedAt';
}

const db = orchidORM(
  { databaseURL: '...' },
  {
    someTable: SomeTable,
  },
);

// 默认情况下忽略已删除的记录
const onlyNonDeleted = await db.someTable;
```

`includeDeleted` 禁用默认的 `deletedAt` 过滤器：

```ts
const allRecords = await db.someTable.includeDeleted();
```

`delete` 行为被更改：

```ts
await db.someTable.find(1).delete();
// 等效于：
await db.someTable.find(1).update({ deletedAt: sql`now()` });
```

`hardDelete` 删除记录绕过 `softDelete` 行为：

```ts
await db.someTable.find(1).hardDelete();
```

## scopes

[//]: # 'has JSDoc'

此功能允许定义一组查询修饰符以供以后使用。
范围中只能设置[条件](/zh-CN/guide/where)。
如果您定义了名为 `default` 的范围，它将默认应用于所有表查询。

```ts
import { BaseTable } from './baseTable';

export class SomeTable extends BaseTable {
  readonly table = 'some';
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

const db = orchidORM(
  { databaseURL: '...' },
  {
    some: SomeTable,
  },
);

// 默认范围应用于所有查询：
const nonHiddenRecords = await db.some;
```

### scope

[//]: # 'has JSDoc'

使用 `scope` 方法应用预定义范围。

```ts
// 使用表中定义的 `active` 范围：
await db.some.scope('active');
```

### unscope

[//]: # 'has JSDoc'

从查询中删除范围添加的条件。

```ts
// SomeTable 有一个默认范围，忽略此查询：
await db.some.unscope('default');
```

## 计算列

[//]: # 'has JSDoc'

```ts
import { BaseTable, sql } from './baseTable';

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
  }));

  computed = this.setComputed({
    fullName: () =>
      sql`${q.column('firstName')} || ' ' || ${q.column('lastName')}`.type(
        (t) => t.string(),
      ),
  });
}
```

`setComputed` 接受一个对象，其中键是计算列名称，值是返回原始 SQL 的函数。

如上所示使用 `q.column` 引用表列，即使表在不同名称下连接，也会使用正确的表名称作为前缀。

计算列默认不选择，仅按需选择：

```ts
const a = await db.user.take();
a.fullName; // 未选择

const b = await db.user.select('*', 'fullName');
b.fullName; // 已选择

// 表 post 属于 user 作为作者。
// 可以选择连接的计算列：
const posts = await db.post
  .join('author')
  .select('post.title', 'author.fullName');
```

SQL 查询可以根据当前请求上下文动态生成。

假设我们使用 [AsyncLocalStorage](https://nodejs.org/api/async_context.html#asynchronous-context-tracking)
跟踪当前用户的语言。

我们有翻译成不同语言的文章，每篇文章都有 `title_en`、`title_uk`、`title_be` 等。

我们可以通过将函数传递给 `sql` 方法来定义计算的 `title`：

```ts
import { sql } from './baseTable';

type Locale = 'en' | 'uk' | 'be';
const asyncLanguageStorage = new AsyncLocalStorage<Locale>();
const defaultLocale: Locale = 'en';

export class ArticleTable extends BaseTable {
  readonly table = 'article';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title_en: t.text(),
    title_uk: t.text().nullable(),
    title_be: t.text().nullable(),
  }));

  computed = this.setComputed({
    title: () =>
      // `sql` 接受一个回调以在每次运行时生成新查询
      sql(() => {
        // 根据当前存储值动态获取语言环境
        const locale = asyncLanguageStorage.getStore() || defaultLocale;

        // 使用 COALESCE，当本地化标题为 NULL 时，使用 title_en
        return sql`COALESCE(
            ${q.column(`title_${locale}`)},
            ${q.column(`title_${defaultLocale}`)}
          )`;
      }).type((t) => t.text()),
  });
}
```

## $query

使用 `$query` 执行原始 SQL 查询。

```ts
const value = 1;

// 在反引号（``）中插值是安全的：
const result = await db.$query<{ one: number }>`SELECT ${value} AS one`;
// 数据在 `rows` 数组中：
result.rows[0].one;
```

如果查询在事务中执行，它将自动使用事务连接。

```ts
await db.$transaction(async () => {
  // 两个查询将在同一事务中执行
  await db.$query`SELECT 1`;
  await db.$query`SELECT 2`;
});
```

或者，提供使用 `sql` 函数创建的原始 SQL 对象：

```ts
import { sql } from './baseTable';

// 在简单字符串中插值是不安全的，请使用 `values` 传递值。
const result = await db.$query<{ one: number }>(
  sql({
    raw: 'SELECT $value AS one',
    values: {
      value: 123,
    },
  }),
);

// 数据在 `rows` 数组中：
result.rows[0].one;
```

## $queryArrays

与 `$query` 相同，但返回数组的数组而不是对象：

```ts
const value = 1;

// 在反引号（``）中插值是安全的：
const result = await db.$queryArrays<[number]>`SELECT ${value} AS one`;
// `rows` 是一个数组的数组：
const row = result.rows[0];
row[0]; // 我们的值
```

## $from

使用 `$from` 构建围绕子查询的查询，类似于以下内容：

```ts
const subQuery = db.someTable.select('name', {
  relatedCount: (q) => q.related.count(),
});

const result = await db
  .$from(subQuery)
  .where({ relatedCount: { gte: 5 } })
  .limit(10);
```

它与查询构建器中可用的[from](/zh-CN/guide/query-methods#from)方法相同，也可以接受多个来源。

## $close

调用 `$clone` 结束数据库连接：

```ts
await db.$close();
```

对于独立查询构建器，该方法为 `close`。
