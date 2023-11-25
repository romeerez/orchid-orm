# Quickstart

Orchid ORM has a script to initialize the project with a command-line prompts.
You can use it to start a new project from scratch, also you can run the same command to scaffold Orchid ORM inside the existing project, it won't remove any existing files.

After familiarizing with this section, you can read the [Building A Sample App](https://github.com/romeerez/orchid-orm-sample-blog-api-guide) guide that demonstrates the process of building a real world app with Orchid ORM,
it walks through setup process, migrations, creating tables, writing complex queries, abstracting queries into repositories, writing tests.

## Scaffold Orchid ORM

Run the following script for both cases of scaffolding a new project or adding the ORM to already existing project.

```sh
# with npm:
npm create orchid-orm@latest

# with pnpm:
pnpm create orchid-orm

# with bun:
bun create orchid-orm

# with yarn:
yarn create orchid-orm
```

This script will ask a few questions to customize the setup:

> Where to install Orchid ORM?

Hit enter to use the current directory, or enter a name for a new directory, or a relative or absolute path.
It will create directories recursively unless they exist.

> Choose a tool for executing TS files

When running command with `bun`, this question is skipped and `bun` will be used.
Otherwise, choose between [tsx](https://github.com/privatenumber/tsx), [vite-node](https://github.com/vitest-dev/vitest/tree/main/packages/vite-node), and [ts-node](https://github.com/TypeStrong/ts-node).

In addition to apply migrations from `.ts` files, for `tsx`, `vite-node`, and `ts-node` there will be package.json scripts to build migrations to `.js` and apply compiled migrations.

> Return timestamps as:

Here you can choose how timestamps will be returned from a database: as a string, as a number, or as a Date object.

This can be changed later, and this can be overridden for a specific table.

> Add a separate database for tests?

Hit `y` if you're going to run tests over a real database.

Orchid ORM has special utilities (see [testTransaction](/guide/transactions.html#testtransaction))
and [record factories](/guide/test-factories.html)
to make writing tests easy and fun.

> Add Zod for validations?

Hit `y` to have a `Zod` integration (see [validation methods](/guide/columns-validation-methods.html)).
Orchid ORM does not validate data on its own.

> Add object factories for writing tests?

Hit `y` for [record factories](/guide/test-factories.html) (generating mock objects from tables).

> Add demo tables?

Adds a post and a comment table files, migrations, seed file for example.

After receiving the answers, the script will create all the necessary config files.

## package.json

After running the script, take a look at the package.json file, and install dependencies.

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
    // rake-db is a toolkit for migrations
    "rake-db": "^2.3.17",
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

If you already have a `tsconfig.json` file in this directory, it won't be changed.

For everything to work properly, `tsconfig.json` must have a `target` property and `"strict": true`.

## Configuring with Vite

There is a wonderful plugin [vite-plugin-node](https://github.com/axe-me/vite-plugin-node) that enables HMR for developing node.js backends,
and if your dev server is running with Vite, it makes sense to also use it for bundling and running db scripts.

If you chose `vite-node`, package.json will include:

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
Notice `"type": "module"` at the top: all compiled files will be treated as ES modules.
In case your project relies on commonjs modules, remove the `"type": "module"`, compiled migrations would still work as expected.
:::

Orchid ORM's scaffolding script does not make assumptions on how you start and compile your app,
it adds separate scripts for building and compiling migrations that you can use for CI/CD.

In some scenarios it may not make a difference if the original TS migration files are executed to migrate production db.
In other cases, it may be wanted to run migration files as fast as possible, and the compiled JS files are executing faster.

## Configuring with tsx

[tsx](https://github.com/privatenumber/tsx) is only meant for executing typescript,
for compiling we'll need `esbuild`.

If you chose `tsx`, package.json will include:

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
Notice `"type": "module"` at the top: all compiled files will be treated as ES modules.
In case your project relies on commonjs modules, remove the `"type": "module"`, compiled migrations would still work as expected.
:::

This config allows to run migrations, compile them to `.js` files, and to run compiled migrations.

## structure

Consider the created structure:

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

## database setup

Change database credentials in the `.env` file:

```sh
DATABASE_URL=postgres://user:password@localhost:5432/dbname?ssl=true|false

# If you'd like to have a separate database for tests
DATABASE_TEST_URL=postgres://user:password@localhost:5432/dbname-test?ssl=true|false
```

`public` database schema is used by default, you can change it by appending URL parameter `schema`:

```sh
DATABASE_URL=postgres://user:password@localhost:5432/dbname?schema=customSchemaName
```

If you're using a hosted database, change `ssl` to true in the above config.

In case of using hosted database, it's already created by provided, but if you develop with a local Postgres, create databases with this command:

```sh
# command to create a database:
npm run db create
```

By default, `camelCase` naming is used for columns in a database.
If you prefer to have snake_case in the database (it will be `camelCase` on the app side anyway),
set `snakeCase: true` option in `src/db/baseTable.ts`:

```ts
// src/db/baseTable.ts

export const BaseTable = createBaseTable({
  snakeCase: true,
  // ...snip
});
```

If you chose to create demo tables, there are migrations files in `src/db/migrations`. Run migrations:

```sh
# command to run migrations (create tables):
npm run db migrate
```

Run the seeds for demo tables:

```sh
npm run db seed
```

The setup is completely ready at this point. For the next steps, create your tables and write queries.

Generate a new migration by running a command:

```sh
npm run db new createSample
```

The file with such content will appear in the `src/db/migrations` directory:

```ts
// src/db/migrations/*timestamp*_createSample.ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('sample', (t) => ({}));
});
```

Add columns to the table:

```ts
// src/migrations/*timestamp*_createTable.ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('sample', (t) => ({
    id: t.identity().primaryKey(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
```

Apply migration by running:

```sh
npm run db migrate
```

## defining tables

`src/db/tables/sample.table.ts` was created after running a migration.

TypeScript should highlight `t.text()` because it doesn't have `min` and `max` specified,
this is needed to prevent unpleasant situations when empty or huge texts are submitted.

```ts
// src/sb/tables/sample.table.ts
import { BaseTable } from './baseTable';

export class SampleTable extends BaseTable {
  readonly table = 'sample';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    // specify min and max length
    text: t.text(1, 10000),
    ...t.timestamps(),
  }));
}
```

`src/db/db.ts` is the main file for the ORM, it connects all tables into one `db` object.

```ts
// src/db/db.ts
import { orchidORM } from 'orchid-orm';
import { config } from './config';
import { PostTable } from './tables/post.table';
import { CommentTable } from './tables/comment.table';
import { SampleTable } from './tables/sample.table';

export const db = orchidORM(config.database, {
  post: PostTable,
  comment: CommentTable,
  sample: SampleTable,
});
```

## example usage

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
