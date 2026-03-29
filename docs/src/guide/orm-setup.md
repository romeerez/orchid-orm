---
outline: deep
description: ORM and query builder setup, configuration options, databaseURL, logging, and connection settings.
---

# ORM setup

`OrchidORM` consists of a query builder (such as [Knex](https://knexjs.org/) or [Kysely](https://www.kysely.dev/docs/intro)) + layer on top of it for defining, querying and utilizing relations (as in [Prisma](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)).

The query builder is for building and executing SQL queries, such as `select`, `create`, `update`, and `delete`.

ORM allows defining `belongsTo`, `hasMany` and [other relations](/guide/relations), select and join them, create/update/delete records together with their related records and [more](/guide/relation-queries).

## setup

Install by running:

```sh
npm i orchid-orm
# or
pnpm i orchid-orm
```

`orchidORM` is an entry function of the ORM.

The first argument is an ORM configuration options object, the ORM-specific options are described below,
see also options for a `pg` adapter that could be passed via the same object: [client options](https://node-postgres.com/api/client) + [pool options](https://node-postgres.com/api/pool).

The second argument is an object where keys are names and values are table classes (see next section for defining a table class).

Returns an instance with tables and some specific functions prefixed with a `$` sign to not overlap with your tables.

```ts
// for porsager/postgres driver:
import { orchidORM } from 'orchid-orm/postgres-js';
// for node-postgres driver:
import { orchidORM } from 'orchid-orm/node-postgres';

// import all tables
import { UserTable } from './tables/user';
import { MessageTable } from './tables/message';

export const db = orchidORM(
  {
    // details for databaseURL are below
    databaseURL: process.env.DATABASE_URL,

    // ssl and schema can be set here or as databaseURL parameters:
    ssl: true,
    schema: 'my_schema',

    // retry connecting when db is starting up, no retry by default,
    // see `connectRetry` section below
    connectRetry: true,

    // option for logging, false by default
    log: true,

    // automatically create foreign keys for relations
    // see `autoForeignKeys` section below
    autoForeignKeys: true,

    // option to create named prepared statements implicitly, false by default
    autoPreparedStatements: true,
  },
  {
    user: UserTable,
    message: MessageTable,
  },
);
```

## instantiate `orchidORM`

After [defining the table](/guide/define-tables) place it in the main `db` file as in [setup](#setup) step:

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

And now it's available for querying:

```ts
import { db } from './db';

const user = await db.user.findBy({ name: 'John' });
```

Don't use table classes directly, this won't work:

```ts
// error
await UserTable.findBy({ name: 'John' });
```

## ORM configuration options

### databaseURL

`databaseURL` has the following format:

```
postgres://user:password@localhost:5432/dbname
```

`schema` and `ssl` option can be specified as a parameter:

```
postgres://user:password@localhost:5432/dbname?schema=my_schema&ssl=true
```

If `schema` is set and is different from `public`,
the `SET search_path = schema` query will be performed before the first query run per each database connection.

### log

The `log` option is false by default, `true` or custom object can be provided:

```ts
type LogOption = {
  // for colorful log, true by default
  colors?: boolean;

  // callback to run before query
  // Query is a query object, sql is { text: string, values: unknown[] }
  // returned value will be passed to afterQuery and onError
  beforeQuery?(sql: Sql): unknown;

  // callback to run after query, logData is data returned by beforeQuery
  afterQuery?(sql: Sql, logData: unknown): void;

  // callback to run in case of error
  onError?(error: Error, sql: Sql, logData: unknown): void;
};
```

The log will use `console.log` and `console.error` by default, it can be overridden by passing the `logger` option:

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

### connectRetry

[//]: # 'has JSDoc'

This option may be useful in CI when database container has started, CI starts performing next steps,
migrations begin to apply though database may be not fully ready for connections yet.

Set `connectRetry: true` for the default backoff strategy. It performs 10 attempts starting with 50ms delay and increases delay exponentially according to this formula:

```
(factor, defaults to 1.5) ** (currentAttempt - 1) * (delay, defaults to 50)
```

So the 2nd attempt will happen in 50ms from start, 3rd attempt in 125ms, 3rd in 237ms, and so on.

You can customize max attempts to be made, `factor` multiplier and the starting delay by passing:

```ts
const options = {
  databaseURL: process.env.DATABASE_URL,
  connectRetry: {
    attempts: 15, // max attempts
    strategy: {
      delay: 100, // initial delay
      factor: 2, // multiplier for the formula above
    },
  },
};
```

You can pass a custom function to `strategy` to customize delay behavior:

```ts
import { setTimeout } from 'timers/promises';

const options = {
  databaseURL: process.env.DATABASE_URL,
  connectRetry: {
    attempts: 5,
    stragegy(currentAttempt: number, maxAttempts: number) {
      // linear: wait 100ms after 1st attempt, then 200m after 2nd, and so on.
      return setTimeout(currentAttempt * 100);
    },
  },
};
```

### global db schema

Set a common database schema for all tables:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    schema: 'schema',
  },
  // ...
);
```

The schema can be provided by a function, it will be invoked for every query and sub-query.
It is useful for schema-based multi-tenancy. You can use `AsyncLocalStorage` to provide a dynamic schema value.

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    schema: () => tenantStorage.getStore().currentSchema,
  },
  // ...
);
```

The global schema can be overridden for an individual table, see [table db schema](/guide/define-tables#table-db-schema).

### noPrimaryKey

Primary key presence checks are on by default. You can configure it globally by placing `noPrimaryKey` option into `orchidORM` config:

`ignore` will disable the check, `warning` will print a warning instead of throwing error.

```ts
// ignore absence of primary keys for all tables
const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    noPrimaryKey: 'ignore',
  },
  {
    // ...tables
  },
);

// print a warning for all tables without primary key
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

You can also override this for a specific table, see [noPrimaryKey](/guide/define-tables#noPrimaryKey).

## ORM Methods

The ORM exposes specific functions prefixed with a `$` sign to not overlap with your table names. See [ORM Methods](/guide/orm-methods) for details on `$query`, `$queryArrays`, `$withOptions`, `$getAdapter`, `$from`, and `$close`.
