# Quickstart

Install dependencies:

```sh
npm i dotenv # for loading .env
npm i -D typescript @types/node
```

Orchid ORM dependencies:

```sh
npm i orchid-orm pqb orchid-orm-schema-to-zod
# dev dependencies:
npm i -D rake-db orchid-orm-test-factory
```

- **orchid-orm**: is responsible for defining tables and relations between them
- **pqb**: query builder, used by other parts to build chainable query objects
- **rake-db**: is responsible for migrations
- **orchid-orm-schema-to-zod**: convert table columns to a Zod schema to use it for validations
- **orchid-orm-test-factory**: for building mock data in tests

Add `.env` file with database credentials:

```
DATABASE_URL=postgres://user:password@localhost:5432/db-name
```

For SSL connection to database, you can specify a `ssl` parameter right on this url:

```
DATABASE_URL=postgres://user:password@localhost:5432/db-name?ssl=true
```

Place a script for `db` somewhere, for example, in `src/scripts/db.ts`:

```ts
// src/scripts/db.ts
import 'dotenv/config';
import { rakeDb } from 'rake-db';
import { appCodeUpdater } from 'orchid-orm';

rakeDb({
  databaseURL: process.env.DATABASE_URL as string,
  // ssl alternatively can be specified as an option here:
  ssl: true,
}, {
  migrationsPath: '../migrations',
  
  // optionally, for automatic code updating after running migrations:
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => `src/app/tables/${tableName}.table.ts`,
    baseTablePath: 'src/lib/baseTable.ts',
    baseTableName: 'BaseTable',
    mainFilePath: 'src/db.ts',
  }),
});
```

Add it to `package.json` scripts section:

```json
{
  "scripts": {
    "db": "ts-node src/scripts/db.ts"
  }
}
```

Create databases from the command line:

```sh
npm run db create
```

Generate a new migration by running a command:

```sh
npm run db g createTable
```

The file with such content will appear in `/migrations` directory:

```ts
// src/migrations/*timestamp*_createTable.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('table', (t) => ({
  }));
});
```

Add columns to the table:

```ts
// src/migrations/*timestamp*_createTable.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('myTable', (t) => ({
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

`baseTable.ts` file should have been created automatically with the following content:

```ts
// src/baseTable.ts
import { createBaseTable } from 'orchid-orm';
import { columnTypes } from 'pqb';

export const BaseTable = createBaseTable({
  columnTypes: {
    ...columnTypes,
  },
});
```

`src/tables/myTable.table.ts` was created.

TypeScript should highlight `t.text()` because it doesn't have `min` and `max` specified,
this is needed to prevent unpleasant situations when empty or huge texts are submitted.

```ts
// src/tables/myTable.table.ts
import { BaseTable } from './baseTable'

export class MyTable extends BaseTable {
  table = 'table'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    // specify min and max length
    text: t.text(1, 10000),
    ...t.timestamps(),
  }))
}
```

`db.ts` also was created after running migration, add a proper configuration to it:

```ts
// src/db.ts
import 'dotenv/config'
import { orchidORM } from 'orchid-orm';
import { Table } from './table'

export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL as string,
    // log queries to console
    log: true,
  },
  {
    table: Table,
  }
);
```

Voilà! Everything is set up and is usable now.

```ts
// src/hello.ts
import { db } from './db'

const main = async () => {
  // load all records
  const records = await db.table
  
  // load first record
  const first = await db.table.take()
  
  // select, where, order, limit, offset, etc
  const result = await db.table
    .select('id', 'name')
    .where({ name: 'name' })
    .order({ name: 'DESC' })
    .limit(10)
    .offset(10)
  
  // find by id
  const recordById = await db.table.find(123)
  
  // find one by conditions
  const record = await db.table.findBy({ name: 'name' })
}

main()
```
