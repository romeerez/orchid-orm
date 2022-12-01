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

- **orchid-orm**: this is the ORM, responsible for defining models, relations
- **pqb**: query builder, used by other parts to build chainable query objects
- **rake-db**: is responsible for migrations
- **orchid-orm-schema-to-zod**: convert model columns to a Zod schema to use it for validations
- **orchid-orm-test-factory**: for building mock data in tests

Add `.env` file with database credentials:

```
DATABASE_URL=postgres://user:password@localhost:5432/db-name
```

Place a script for `db` somewhere, for example, in `src/scripts/db.ts`:

```ts
// src/scripts/db.ts
import 'dotenv/config'
import { rakeDb } from 'rake-db';

rakeDb({
  connectionString: process.env.DATABASE_URL as string,
}, {
  migrationsPath: path.resolve(__dirname, '..', 'migrations'),
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

Now we can create databases from the command line:

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

Add some columns to it:

```ts
// src/migrations/*timestamp*_createTable.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.serial().primaryKey(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
```

Apply migration by running the command:

```sh
npm run db migrate
```

Add a base model:

```ts
// src/model.ts
import { createModel } from 'orchid-orm';
import { columnTypes } from 'pqb';

export const Model = createModel({
  columnTypes,
});
```

Add a model for the table (columns are simply copy-pasted from the migration):

```ts
// src/table.model.ts
import { Model } from './model'

export class TableModel extends Model {
  table = 'table'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    // specify min and max length
    text: t.text(1, 10000),
    ...t.timestamps(),
  }))
}
```

Add a main instance of the database:

```ts
// src/db.ts
import 'dotenv/config'
import { orchidORM } from 'orchid-orm';
import { TableModel } from './table.model'

export const db = orchidORM(
  {
    connectionString: process.env.DATABASE_URL as string,
    log: true,
  },
  {
    table: TableModel,
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
