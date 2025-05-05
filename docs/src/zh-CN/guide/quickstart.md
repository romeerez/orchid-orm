# 快速开始

Orchid ORM 提供了一个脚本，通过命令行提示初始化项目。
您可以使用它从头开始创建一个新项目，也可以运行相同的命令在现有项目中生成 Orchid ORM 的脚手架，它不会删除任何现有文件。

在熟悉本节内容后，您可以阅读[构建示例应用程序](https://github.com/romeerez/orchid-orm-sample-blog-api-guide)指南，该指南演示了使用 Orchid ORM 构建实际应用程序的过程，
涵盖了设置过程、迁移、创建表、编写复杂查询、将查询抽象到存储库以及编写测试。

## 生成 Orchid ORM

无论是为新项目生成脚手架还是将 ORM 添加到现有项目中，都可以运行以下脚本。

```sh
# 使用 npm:
npm create orchid-orm@latest

# 使用 pnpm:
pnpm create orchid-orm

# 使用 bun:
bun create orchid-orm

# 使用 yarn:
yarn create orchid-orm
```

此脚本将询问一些问题以自定义设置：

> 将 Orchid ORM 安装到哪里？

按回车键选择当前目录，或输入新目录的名称，或输入相对或绝对路径。
它将递归创建目录，除非它们已经存在。

> 选择一个工具来执行 TS 文件

当使用 `bun` 运行命令时，此问题将被跳过并使用 `bun`。
否则，可以选择 [tsx](https://github.com/privatenumber/tsx)、[vite-node](https://github.com/vitest-dev/vitest/tree/main/packages/vite-node) 和 [ts-node](https://github.com/TypeStrong/ts-node)。

除了从 `.ts` 文件应用迁移，对于 `tsx`、`vite-node` 和 `ts-node`，还会有 package.json 脚本来构建迁移到 `.js` 并应用编译的迁移。

> 返回时间戳为：

在这里，您可以选择时间戳从数据库返回的方式：作为字符串、作为数字或作为 Date 对象。

这可以稍后更改，并且可以为特定表覆盖。

> 为测试添加单独的数据库？

如果您打算在真实数据库上运行测试，请按 `y`。

Orchid ORM 有特殊的工具（请参阅 [testTransaction](/zh-CN/guide/transactions#testtransaction)）
和 [record factories](/zh-CN/guide/test-factories)
使编写测试变得简单有趣。

> 与验证库集成？

可选地，添加与 Zod 或 Valibot 的集成，详细信息请参阅[验证方法](/zh-CN/guide/columns-validation-methods)部分。

Orchid ORM 本身不验证数据。

> 为编写测试添加对象工厂？

按 `y` 以使用 [record factories](/zh-CN/guide/test-factories)（从表生成模拟对象）。

> 添加演示表？

添加帖子和评论表文件、迁移、示例的种子文件。

在收到答案后，脚本将创建所有必要的配置文件。

## package.json

运行脚本后，请查看 package.json 文件，并安装依赖项。

```js
{
  "name": "project",
  // "type": "module" is set when choosing tsx, vite-node, or bun
  "type": "module",
  "scripts": {
    // for running db scripts, like npm run db create, npm run db migrate
    "db": "tsx src/db/dbScript.ts"
  },
  "dependencies": {
    // dotenv loads variables from .env
    "dotenv": "^16.0.3",
    // the ORM is responsible for defining tables and relations between them
    "orchid-orm": "^1.5.18",
    // convert table columns to a Zod schema to use it for validations
    "orchid-orm-schema-to-zod": "^0.2.18"
  },
  "devDependencies": {
    // for generating mock objects in tests
    "orchid-orm-test-factory": "^0.2.24",
    // for the fastest typescript compilation
    "@swc/core": "^1.3.32",
    // node.js types
    "@types/node": "^18.11.18",
    "typescript": "^4.9.5",
    // for running typescript
    "tsx": "^4.1.1"
  }
}
```

如果您已经在此目录中有一个 `tsconfig.json` 文件，它将不会被更改。

为了使一切正常工作，`tsconfig.json` 必须有一个 `target` 属性和 `"strict": true`。

## 使用 Vite 进行配置

有一个很棒的插件 [vite-plugin-node](https://github.com/axe-me/vite-plugin-node)，它为开发 node.js 后端启用 HMR，
如果您的开发服务器正在使用 Vite 运行，那么也可以使用它来捆绑和运行数据库脚本。

如果您选择了 `vite-node`，package.json 将包括：

```json
{
  "type": "module",
  "scripts": {
    // to run db scripts
    "db": "vite-node src/db/dbScript.ts --",
    // build migrations
    "build:migrations": "vite build --config vite.migrations.mts",
    // run compiled migrations
    "db:compiled": "node dist/db/dbScript.mjs"
  },
  "devDependencies": {
    // vite bundler itself
    "vite": "^4.5.0",
    // for executing typescript
    "vite-node": "^0.34.6",
    // special plugin for compiling migrations
    "rollup-plugin-node-externals": "^6.1.2"
  }
}
```

:::info
注意 `"type": "module"` 在顶部：所有编译的文件将被视为 ES 模块。
如果您的项目依赖于 commonjs 模块，请删除 `"type": "module"`，编译的迁移仍然可以正常工作。
:::

OrchidORM 的脚手架脚本不会对如何启动和编译您的应用程序做出假设，
它添加了用于构建和编译迁移的单独脚本，您可以在 CI/CD 中使用它们。

在某些情况下，执行原始 TS 迁移文件以迁移生产数据库可能没有区别。
在其他情况下，可能希望尽可能快地运行迁移文件，而编译的 JS 文件执行速度更快。

## 使用 tsx 进行配置

[tsx](https://github.com/privatenumber/tsx) 仅用于执行 typescript，
对于编译，我们需要 `esbuild`。

如果您选择了 `tsx`，package.json 将包括：

```json
{
  "type": "module",
  "scripts": {
    // to run db scripts
    "db": "NODE_ENV=development tsx src/db/dbScript.ts",
    // build migrations
    "build:migrations": "rimraf dist/db && node esbuild.migrations.js",
    // run compiled migrations
    "db:compiled": "NODE_ENV=production node dist/db/dbScript.js"
  },
  "devDependencies": {
    // for executing TS
    "tsx": "^4.1.1",
    // for compiling
    "esbuild": "^0.19.5",
    // to clean dist directory
    "rimraf": "^5.0.5"
  }
}
```

:::info
注意 `"type": "module"` 在顶部：所有编译的文件将被视为 ES 模块。
如果您的项目依赖于 commonjs 模块，请删除 `"type": "module"`，编译的迁移仍然可以正常工作。
:::

此配置允许运行迁移，将其编译为 `.js` 文件，并运行编译的迁移。

## 结构

考虑创建的结构：

```
.
├── src/
│   └── db/
│       ├── migrations/ - contains migrations files that can be migrated or rolled back.
│       │   ├── timestamp_createPost.ts
│       │   └── timestamp_createComment.ts
│       ├── tables/ - tables are used in the app, define columns and relations here.
│       │   ├── comment.table.ts
│       │   └── post.table.ts
│       ├── baseTable.ts - for defining column type overrides.
│       ├── config.ts - database credentials are exported from here.
│       ├── db.ts - main file for the ORM, connects all tables into one `db` object.
│       ├── dbScript.ts - script run by `npm run db *command*`.
│       └── seed.ts - for filling tables with data.
├── .env - contains database credentials.
├── .gitignore - .env must be ignored by git.
├── package.json
└── tsconfig.json - specifying strict mode is very important.
```

## 数据库设置

更改 `.env` 文件中的数据库凭据：

```sh
DATABASE_URL=postgres://user:password@localhost:5432/dbname?ssl=true|false

# 如果您希望有一个单独的测试数据库
DATABASE_TEST_URL=postgres://user:password@localhost:5432/dbname-test?ssl=true|false
```

默认情况下使用 `public` 数据库模式，您可以通过附加 URL 参数 `schema` 来更改它：

```sh
DATABASE_URL=postgres://user:password@localhost:5432/dbname?schema=customSchemaName
```

如果您使用托管数据库，请在上述配置中将 `ssl` 更改为 true。

如果使用托管数据库，它已经由提供者创建，但如果您使用本地 Postgres 开发，请使用以下命令创建数据库：

```sh
# command to create a database:
npm run db create
```

默认情况下，数据库中的列使用 `camelCase` 命名。
如果您更喜欢在数据库中使用 snake_case（无论如何它在应用程序端将是 `camelCase`），
请在 `src/db/baseTable.ts` 中设置 `snakeCase: true` 选项：

```ts
// src/db/baseTable.ts

export const BaseTable = createBaseTable({
  snakeCase: true,
  // ...snip
});

// to use later for custom raw SQL expressions
export const { sql } = BaseTable;
```

如果您选择创建演示表，则在 `src/db/migrations` 中有迁移文件。运行迁移：

```sh
# command to run migrations (create tables):
npm run db up
```

运行演示表的种子：

```sh
npm run db seed
```

此时设置已完全完成。接下来的步骤是创建您的表并编写查询。

要创建新的数据库表，您可以：

- 如果您有一个包含表的现有数据库，请使用 [db pull](/zh-CN/guide/migration-commands#pull) 为这些表生成代码。
- 在代码中[定义新表](/zh-CN/guide/orm-and-query-builder#define-a-table-class)并为其[生成迁移](/zh-CN/guide/orm-and-query-builder#generate-migrations)。
- 您还可以创建一个[新的迁移](/zh-CN/guide/migration-commands#new-blank-migration)文件并手动编写。

## 示例用法

```ts
// src/hello.ts
import { db } from './db';

const main = async () => {
  // load all records
  const records = await db.sample;

  // load first record
  const first = await db.sample.take();

  // select, where, order, limit, offset, etc
  const result = await db.sample
    .select('id', 'name')
    .where({ name: 'name' })
    .order({ name: 'DESC' })
    .limit(10)
    .offset(10);

  // find by id
  const recordById = await db.sample.find(123);

  // find one by conditions
  const record = await db.sample.findBy({ name: 'name' });
};

main();
```
