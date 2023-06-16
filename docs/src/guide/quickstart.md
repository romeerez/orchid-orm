# Quickstart

Orchid ORM has a script to initialize the project with a command-line prompts.
Use it to start from scratch, or it can be run inside the existing project, it won't remove any existing files.

## init script

```sh
npx orchid-orm@latest
# or if you're using pnpm
pnpm dlx orchid-orm@latest
```

This script will ask a few questions to customize the setup:

```
Where would you like to install Orchid ORM?
```

Press enter to init in the current directory, or specify a path. It will create directories recursively unless they exist.

```
Preferred type of returned timestamps:
```

Here you can choose how timestamps will be returned from a database: as a string, as a number, or as a Date object.

This can be changed later, and this can be overridden for a specific table.

```
Should the script add a separate database for tests:
```

Hit `y` if you're going to write integration tests over a real database.

```
Are you going to use `Zod` for validation?
```

When chosen, table schemas can be used as `Zod` schemas for validation. `orchid-orm` does not perform validation on its own.

```
Do you want object factories for writing tests?
```

This adds a library for generating mock objects from defined tables.

```
Should the script add demo tables?
```

Adds two tables for example.

```
Let's add fast TS compiler swc?
```

It's only asked when initializing a new project (when no `tsconfig.json` found), this will add [swc](https://swc.rs/) compiler to a `package.json` and to `tsconfig.json`.

After answering these questions, it will create all the necessary config files.

## package.json

After running the script, check if the package.json file looks well, and install dependencies (`npm i`) :

```js
{
  "scripts": {
    // for running db scripts, like npm run db create, npm run db migrate
    "db": "ts-node src/db/dbScript.ts"
  },
  "dependencies": {
    // dotenv loads variables from .env
    "dotenv": "^16.0.3",
    // the ORM is responsible for defining tables and relations between them
    "orchid-orm": "^1.5.18",
    // query builder, used by other parts to build chainable query objects
    "pqb": "^0.9.12",
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
    // for running typescript
    "ts-node": "^10.9.1",
    "typescript": "^4.9.5"
  }
}
```

## ES modules

Note the `db` script: it is for running migrations, and it's being launched with `ts-node`.

If you'd like to use `ts-node` in ES modules mode (it works, but outputs experimental warning), change the script to:

```json
{
  "scripts": {
    "db": "node --loader ts-node/esm src/db/dbScript.ts"
  }
}
```

If you'd like to use `vite-node` instead, which works in ES modules mode by default, install `vite-node` and change the script to:

```json
{
  "scripts": {
    "db": "vite-node src/db/dbScript.ts --"
  }
}
```

Note the double-dash at the end - it is needed.

If, during init script, you opted for `swc` compiler - it's no longer needed, remove `swc` from dependencies and from `tsconfig.json`.

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

```
DATABASE_URL=postgres://user:password@localhost:5432/dbname?ssl=false
DATABASE_TEST_URL=postgres://user:password@localhost:5432/dbname-test?ssl=false
```

If you're using a hosted database, change `ssl` to true in the above config.

In case of using hosted database, it's already created by provided, but if you develop with a local Postgres, create databases with this command:

```sh
# command to create a database:
npm run db create
```

By default, camelCase naming is used for columns in a database.
If you prefer snake_case, set `snakeCase: true` option in `src/db/dbScript.ts` and `src/db/baseTable.ts`:

```ts
// src/db/baseTable.ts

export const BaseTable = createBaseTable({
  snakeCase: true,
  // ...snip
});
```

```ts
// src/db/dbScript.ts

export const change = rakeDb(config.database, {
  snakeCase: true,
  // ...other options
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
