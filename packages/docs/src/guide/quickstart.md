# Quickstart

The ORM is shipped with an automated script to initialize the project.
Use it to start from scratch, or it can be run inside the existing project, it won't remove any existing files.

```sh
mkdir project
cd project

npx orchid-orm
# or if you're using pnpm
pnpm dlx orchid-orm
```

This script will ask a few questions to customize the setup:

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

After answering these questions, it will create all the necessary config files.

Check the package.json file:

```js
{
  "scripts": {
    // for running db scripts, like npm run db create, npm run db migrate
    "db": "ts-node src/db/dbScripts.ts"
  },
  "dependencies": {
    // dotenv loads variables from .env
    "dotenv": "^16.0.3",
    // the ORM is responsible for defining tables and relations between them
    "orchid-orm": "^1.5.18",
    // query builder, used by other parts to build chainable query objects
    "pqb": "^0.9.12",
    // pg is the postgres driver for node.js
    "pg": "^8.9.0",
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

Install dependencies (`npm i`).

Let's consider the created structure:

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

Change database credentials in the `.env` file:

```
DATABASE_URL=postgres://user:password@localhost:5432/dbname?ssl=false
DATABASE_TEST_URL=postgres://user:password@localhost:5432/dbname-test?ssl=false
```

If you're using a hosted database, change `ssl` to true in the above config.

In case of using hosted database, it's already created by provided.

But if you develop with a local Postgres, create databases with this command:

```sh
# command to create a database:
npm run db create
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
npm run db g createSample
```

The file with such content will appear in the `src/db/migrations` directory:

```ts
// src/db/migrations/*timestamp*_createSample.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('sample', (t) => ({
  }));
});
```

Add columns to the table:

```ts
// src/migrations/*timestamp*_createTable.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('sample', (t) => ({
    id: t.serial().primaryKey(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
```

Apply migration by running:

```sh
npm run db migrate
```

`src/db/tables/sample.table.ts` was created.

TypeScript should highlight `t.text()` because it doesn't have `min` and `max` specified,
this is needed to prevent unpleasant situations when empty or huge texts are submitted.

```ts
// src/sb/tables/sample.table.ts
import { BaseTable } from './baseTable'

export class SampleTable extends BaseTable {
  table = 'sample'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    // specify min and max length
    text: t.text(1, 10000),
    ...t.timestamps(),
  }))
}
```

`src/db/db.ts` is the main file for the ORM, it connects all tables into one `db` object. Add your new table to it:

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

Example usage:

```ts
// src/hello.ts
import { db } from './db'

const main = async () => {
  // load all records
  const records = await db.sample

  // load first record
  const first = await db.sample.take()

  // select, where, order, limit, offset, etc
  const result = await db.sample
    .select('id', 'name')
    .where({ name: 'name' })
    .order({ name: 'DESC' })
    .limit(10)
    .offset(10)

  // find by id
  const recordById = await db.sample.find(123)

  // find one by conditions
  const record = await db.sample.findBy({ name: 'name' })
}

main()
```
