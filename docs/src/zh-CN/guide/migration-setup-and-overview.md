# 迁移设置和概览

迁移允许您随着时间的推移演进数据库模式。与编写原始 SQL 迁移或使用其他工具相比，此迁移工具包具有以下几个优点：

- 迁移是用 TypeScript 编写的，因此可以包含任何逻辑和使用查询构建器进行的数据库查询。
- 在回滚迁移时更改会自动撤销，无需手动编写 `down` 部分（大多数情况下）。
- 当将其集成到现有项目时，它可以根据现有数据库结构自动生成初始迁移。
- Orchid ORM 可以从应用程序代码中自动生成迁移。

如果您正在使用 OrchidORM，迁移工具包已经内置，直接从 `orchid-orm/migrations` 导入，无需单独安装。

您也可以将其作为独立工具使用，安装并使用 `rake-db` 包。

## 工作原理

特殊表 `schemaMigrations` 会自动创建，用于跟踪所有迁移文件的前缀和名称。
允许两个迁移具有相同的名称，但所有迁移必须具有不同的数字前缀。

所有更改都包装在单个事务中。如果您有 3 个待处理的迁移，而最后一个抛出错误，
则它们都不会被应用。

事务开始时会设置一个锁（[pg_advisory_xact_lock](https://www.postgresql.org/docs/current/functions-admin.html)）。
如果您正在部署一个 Node.js 应用程序集群，并且每个应用程序尝试同时应用迁移，
第一个应用程序会设置锁并应用迁移，其余的会等待锁，
锁释放后所有迁移已经应用。

在本地，迁移在运行之前会从 TS 动态编译为 JS。
在部署到远程服务器时，您可能希望先预编译迁移，以使服务器端的迁移过程更快。

如果您希望将 `rake-db` 与 OrchidORM 一起使用，[ORM 初始化脚本](/zh-CN/guide/quickstart) 可以生成配置。
当将其作为独立工具使用时，您仍然可以使用相同的脚本并仅复制其中的 rake-db（配置在 `dbScript.ts` 文件中）。
生成的脚本允许在 `tsx`、`vite` 和 `ts-node` 之间选择运行迁移，并根据所选工具生成不同的配置。
生成的 package.json 将具有 `build:migrations` 和 `db:compiled` 脚本，用于在生产环境中预编译和运行迁移。

## 设置

如果您运行了 [快速开始](/zh-CN/guide/quickstart) 中的初始化脚本，它已经设置好了。

要将其作为独立工具使用，请安装此包：

```sh
npm i -D rake-db
# 或
pnpm i -D rake-db
```

::: info
`rake-db` 的命名来源于 Ruby on Rails 中的一个命令，因为它最初受其启发。
:::

由于配置是在 TypeScript 中完成的，因此高度可定制。

最好从单独的文件中导出数据库配置选项，
这样迁移工具和初始化 ORM 时都可以使用相同的数据库配置。

示例结构（如果您遵循 [快速开始](/zh-CN/guide/quickstart)，它会自动创建）：

```
src/
└── db/
    ├── migrations/ - 包含可以迁移或回滚的迁移文件。
    │   ├── recurrent/ - 可选：触发器和函数的 SQL 文件
    │   │   └── my-function.sql - 包含 CREATE OR REPLACE 的 SQL 文件
    │   ├── 0001_createPost.ts
    │   └── 0002_createComment.ts
    ├── baseTable.ts - 用于定义列类型覆盖。
    ├── config.ts - 数据库凭据从这里导出。
    ├── db.ts - ORM 的主文件，将所有表连接到一个 `db` 对象中。
    ├── dbScript.ts - 由 `npm run db *command*` 运行的脚本。
    └── seed.ts - 用于填充表数据。
```

导出数据库选项：

在此示例中，使用了 `dotenv` 并配置为首先从 `.env.local` 获取环境变量，然后从 `.env` 文件获取。

`DATABASE_URL` 包含数据库凭据，您还可以在其中指定数据库模式和 SSL 模式，请参阅 [数据库设置](/zh-CN/guide/quickstart#database-setup)。

```ts
// db/config.ts

import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config();

const database = {
  databaseURL: process.env.DATABASE_URL,
};
if (!database.databaseURL) throw new Error('DATABASE_URL is missing in .env');

export const config = {
  database,
};
```

在 `db/dbScript.ts` 中配置迁移：

```ts
// db/dbScript.ts

import { rakeDb } from 'orchid-orm/migrations'; // 使用 Orchid ORM 时
import { rakeDb } from 'rake-db'; // 使用独立 rake-db 时

import { config } from './config';
import { BaseTable } from './baseTable';

export const change = rakeDb(config.database, {
  // 当前文件的相对路径：
  migrationsPath: './migrations',
  // 它也可以是绝对路径：
  // migrationsPath: path.resolve(__dirname, 'migrations'),

  // 仅当您使用诸如 Vite 的打包器时才需要：
  migrations: import.meta.glob('./migrations/*.ts'),

  // 默认是 'serial'（0001、0002 等），也可以是 'timestamp'。
  // 下面阅读有关 serial 和 timestamp 的更多信息。
  migrationId: 'serial',

  // （使用 ORM 时）列类型覆盖和 snakeCase 选项将从 BaseTable 中获取：
  baseTable: BaseTable,
  // （使用 ORM 时）ORM `db` 实例的路径，这需要自动生成迁移。
  dbPath: './db',

  // 可以定义自定义命令，如下所示：
  commands: {
    // dbOptions 是数据库配置的数组
    // config 是上面定义的 `rakeDb` 配置
    // args 类型为 string[] 是命令行参数数组，从命令名称开始
    async seed(dbOptions, config, args) {
      const { seed } = await import('./seed');
      await seed();
    },
  },

  // 这是为了与 `tsx` 和其他 TS 运行器兼容，无需更改。
  // 当设置了 `migrations` 时是可选的，否则是必需的。
  import: (path) => import(path),
});
```

将 `db` 脚本添加到您的 `package.json`：

```json
{
  "scripts": {
    "db": "tsx|vite-node|ts-node|bun src/db/dbScript.ts"
  }
}
```

现在可以从命令行使用它：

```sh
npm run db new create-a-table
pnpm db new create-a-table
yarn db new create-a-table
```

## serial vs timestamp

迁移文件可以以序列号（0001、0002 等）或时间戳为前缀。
序列号是默认值，对于时间戳前缀，请在配置中设置 `migrationId: 'timestamp'`。

关键区别在于处理可能的冲突。

考虑一种场景：您在本地分支中创建了一个迁移，然后您的同事创建了一个迁移并将其提交到存储库。
您拉取更改，它们在您的机器上工作，您推送您的工作，迁移以与您运行的顺序不同的顺序执行，
因为在远程服务器上您的同事的迁移首先运行，而在您的本地它最后运行。

使用序列号可以使上述情况不可能发生，但需要解决此类冲突。

您可以使用 `rebase` 命令自动解决文件冲突，阅读更多 [关于 rebase 的信息](/zh-CN/guide/migration-commands#rebase)。

使用时间戳可以避免文件冲突，但可能会因错误的迁移执行顺序而导致问题。

如果您希望将现有迁移从时间戳重命名为序列号，可以使用 [change-ids](/zh-CN/guide/migration-commands#change-ids)。

## 等待 rakeDb

`rakeDb` 函数在调用后立即开始执行，`node.js` 将保持程序运行直到至少有一个未完成的 promise，并在 `rakeDb` 完成后关闭。

但某些其他环境可能不会自动等待 `rakeDb` 完成，那么您需要以以下方式手动等待它：

```ts
export const change = rakeDb(dbConfig, rakeDbConfig);

// 等待 `rakeDb` 完成：
await change.promise;
```

promise 解析为结果对象：

```ts
interface RakeDbResult {
  // 数据库连接选项
  options: AdapterOptions[];
  // rake-db 配置
  config: AnyRakeDbConfig;
  // 传递给 `rakeDb.lazy` 的命令和参数或从 process.argv 获取
  args: string[];
}
```

命令的别名会被解析，因此如果使用 `pnpm db migrate` 运行，命令将是 `up`。
完整的别名列表请参阅 `rakeDbAliases`，它从 `rake-db` 包导出。

## rakeDb lazy

`rakeDb` 设计为通过 CLI 启动，它将执行一个命令并完成。

但在某些情况下，您可能希望以编程方式运行它，可以使用 `rakeDb.lazy`：

```ts
export const { change, run } = rakeDb.lazy(dbConfig, rakeDbConfig);

// 以编程方式运行命令：
await run(['migrate']);

// 可选地，您可以提供部分 `rakeDbConfig` 来覆盖某些值，
// 这里我们覆盖了日志记录器。
const result = await run(['migrate'], {
  log: true,
  logger: {
    log(message: string): void {
      console.log(message);
    },
    warn(message: string): void {
      console.warn(message);
    },
    error(message: string): void {
      console.error(message);
    },
  },
});

// 与“等待 rakeDb”部分中的结果类型相同。
result.options;
result.config;
result.args;
```

`rakeDb.lazy` 接受与 `rakeDb` 相同的选项，并返回两个函数。

`change` 用于在迁移中包装数据库更改。

`run` 是一个执行命令的函数，
它接受与 `rakeDb` 相同的 CLI 参数（请参阅 [命令部分](./migration-commands.md)），
可选地接受配置覆盖，返回一个 `Promise<void>`。

## rakeDb

设置脚本中的 `rakeDb` 函数接受连接选项、迁移配置和命令行参数：

```ts
const rakeDb = async (
  options: MaybeArray<AdapterOptions>,
  partialConfig?: Partial<MigrationConfig>,
  args: string[] = process.argv.slice(2),
) => {
  // ...
};
```

第一个参数的类型为 `AdapterOptions`，它在配置查询构建器和 ORM 时使用。
提供此类选项的数组以同时迁移两个或更多数据库，这有助于维护测试数据库。

第二个可选参数的类型为 `MigrationConfig`，所有属性都是可选的，以下是类型：

```ts
type MigrationConfig = {
  // （对于 Orchid ORM）列类型和 snakeCase 可以从 ORM 的 BaseTable 应用
  baseTable?: BaseTable;
  // （对于 Orchid ORM）导入路径到 Orchid ORM `db` 实例，用于自动生成迁移。
  dbPath?: string;
  // （对于 Orchid ORM）如果 ORM 实例以不同于 `db` 的名称导出，请更改此项。
  dbExportedAs?: string; // 默认值为 'db'

  // 或者可以手动设置：
  columnTypes?: (t) => {
    // 与 BaseTable 定义中的 columnTypes 配置相同
  };
  // 设置为 true 以在应用程序中所有列命名为 camelCase，但在数据库中为 snake_case
  // 默认情况下，应用程序和数据库中都期望 camelCase
  snakeCase?: boolean;

  // basePath 和 dbScript 是自动确定的
  // basePath 是调用 `rakeDb` 的文件的目录名称，dbScript 是此文件的名称
  basePath?: string;
  dbScript?: string;

  // 迁移目录的路径
  migrationsPath?: string;

  // 迁移文件的前缀为序列号（默认）或时间戳
  migrationId?: 'serial' | 'timestamp';

  // 循环迁移目录的路径
  // migrationsPath + '/recurrent' 是默认值
  recurrentPath?: string;

  // 数据库中存储迁移版本的表
  migrationsTable?: string;

  // 导入 TypeScript 迁移文件的函数
  import?(path: string): void;

  // 指定在表上未定义主键时的行为
  noPrimaryKey?: 'error' | 'warn' | 'ignore';

  // 日志选项，请参阅查询构建器文档中的“日志选项”
  log?: boolean | Partial<QueryLogObject>;
  // 默认情况下为标准控制台
  logger?: {
    log(message: string): void;
    error(message: string): void;
  };

  // 如果迁移没有默认导出，则抛出错误
  forceDefaultExports?: boolean;

  beforeMigrate?(db: Db): Promise<void>;
  afterMigrate?(db: Db): Promise<void>;
  beforeRollback?(db: Db): Promise<void>;
  afterRollback?(db: Db): Promise<void>;
};
```

要配置日志记录，请参阅查询构建器文档中的 [日志选项](/zh-CN/guide/orm-and-query-builder#log-option)。

注意 `migrationsPath` 可以接受绝对路径或当前文件的相对路径。

默认值为：

- `basePath` 是调用 `rakeDb` 的文件的目录名称
- `migrationPath` 是 `src/db/migrations`
- `recurrentPath` 是 `src/db/migrations/recurrent`（如果不需要则不必存在目录）
- `migrationsTable` 是 `schemaMigrations`
- `snakeCase` 是 `false`，因此应用程序和数据库中都期望 camelCase
- `import` 将使用标准 `import` 函数
- `noPrimaryKey` 是 `error`，如果您不小心忘记为新表添加主键，它会提醒您
- `log` 是开启的
- `logger` 是标准 `console`

`rakeDb` 的第三个可选参数是命令行中的字符串数组，默认情况下它将使用 `process.argv` 获取参数，但您可以通过手动传递参数来覆盖它。

## snakeCase

默认情况下，此选项为 `false`，并且数据库中期望 camelCase，如果数据库中的所有或大多数列为 snake_case，请将其更改为 `true`。

当 `snakeCase` 为 `true` 时，迁移中的所有列名将自动转换为 snake_case。

它会更改 `db pull` 命令在处理列名和时间戳时的行为，请参阅 [db pull](/zh-CN/guide/migration-commands#pull) 了解详细信息。

## seeds

要制作数据库种子，请创建具有所需逻辑的脚本。

在示例中，使用 `createDb` 构造新的数据库实例，
但您可以从应用程序中定义 `db` 对象导入。

```ts
// db/seed.ts
import { db } from './db';

export const seed = async () => {
  await db.table.createMany([{ name: 'record 1' }, { name: 'record 2' }]);

  await db.close();
};
```

将自定义命令添加到 `rake-db` 配置中：

```ts
// db/dbScript

// ...省略导入

export const change = rakeDb(config.database, {
  // ...其他选项

  commands: {
    async seed(options) {
      const { seed } = await import('./seed');
      await seed();
    },
  },
});
```

使用命令运行种子：

```sh
npm run db seed
# 或
pnpm db seed
```

## 循环迁移

循环迁移在您希望定期更新 SQL 函数、触发器和其他数据库项时非常有用。

此功能是可选的，不需要有 `recurrent` 目录。

例如，将 `add` SQL 函数存储到 `src/db/migrations/recurrent/add.sql`：

```sql
CREATE OR REPLACE FUNCTION add(integer, integer) RETURNS integer
  AS 'select $1 + $2;'
  LANGUAGE SQL
  IMMUTABLE
RETURNS NULL ON NULL INPUT;
```

当您运行命令 `recurrent`（别名为 `rec`）时，`rake-db` 将递归扫描 `recurrent` 目录并并行执行所有 sql 文件。

由于它们是并行执行的，如果一个函数依赖于另一个函数，最好将它们放在一个 sql 文件中。

由于它是递归扫描的，您可以根据需要组织 `recurrent` 目录，例如：

```
src/
└── db/
    └── migrations/
        └── recurrent/
            ├── functions/
            │   └── my-function.sql
            └── triggers/
                └── my-trigger.sql
```

## 前后回调

[//]: # 'has JSdoc'

要在 `migrate` 或 `rollback` 命令之前或之后运行任意代码，请在 `rakeDb` 配置对象中定义函数。

这些回调每个命令每个数据库触发一次。
如果应用了 5 个迁移，回调将在所有 5 个迁移之前或之后调用。

除 `afterChangeCommit` 外的所有回调都与迁移一起在事务中执行。
如果回调抛出错误，事务将回滚，所有迁移更改都不会保存。

- `beforeMigrate`、`afterMigrate`：在向上迁移之前或之后调用
- `beforeRollback`、`afterRollback`：在向下迁移之前或之后调用
- `beforeChange`、`afterChange`：在迁移或回滚之前或之后调用
- `afterChangeCommit`：在迁移事务提交并释放数据库锁后发生。

非“Change”回调接收单个查询构建器实例参数，这不是 ORM 实例，
但它可以用于构建和执行查询。

示例：每次运行 `npm run db migrate` 时，在所有迁移成功应用后，如果特定表为空，将创建新记录。

```ts
export const change = rakeDb(options, {
  async afterMigrate({ db, migrations }) {
    // 如果没有执行迁移，则跳过
    if (!migrations.length) return;

    const haveRecords = await db('table').exists();
    if (!haveRecords) {
      await db('table').createMany([
        { name: 'one' },
        { name: 'two' },
        { name: 'three' },
      ]);
    }
  },
});
```

`beforeChange` 和 `afterChange` 接收两个额外的参数：布尔值 `up` 用于检查是迁移还是回滚，
以及布尔值 `redo` 用于检查是否正在向下迁移然后向上迁移以进行 [redo](/zh-CN/guide/migration-commands#redo) 命令。

示例：如何在迁移或回滚后运行代码，但不在 `redo` 中间运行：

```ts
export const change = rakeDb(options, {
  afterChange({ db, up, redo, migrations }) {
    if (!up && redo) return;

    console.log('迁移、回滚或重做命令已完成', {
      migrations, // 执行的迁移列表
    });
  },
});
```

要转储数据库，您应该使用 `afterChangeCommit`，因为在事务提交之前 `pg_dump` 不会工作（因为数据库锁）。
示例：

```ts
import { execSync } from 'node:child_process';

export const change = rakeDb(
  { databaseURL: 'postgres://...' },
  {
    afterChangeCommit({ options, migrations }) {
      // 如果没有待处理的迁移，则跳过转储
      if (!migrations.length) return;

      // `as string` 是安全的，因为您可以看到上面设置了 databaseURL
      dump(options[0].databaseURL as string);
    },
  },
);

function dump(databaseURL: string) {
  execSync(`pg_dump --schema-only ${databaseURL} > structure.sql`);

  console.log('数据库结构已转储到 structure.sql');
}
```
