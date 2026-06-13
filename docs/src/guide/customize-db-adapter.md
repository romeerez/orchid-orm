---
description: Customizing the database adapter with orchidORMWithAdapter for manual adapter instantiation.
---

# Customize db adapter

`orchidORM` imported from driver-specific path creates an adapter (a layer between ORM and db driver) automatically.

For more control, use `orchidORMWithAdapter` to initiate ORM with a manually instantiated adapter.

```ts
import { AdapterClass, orchidORMWithAdapter } from 'orchid-orm';
// for porsager/postgres driver:
import { Adapter as PostgresJsAdapter } from 'orchid-orm/postgres-js';
// for node-postgres driver:
// import { Adapter as NodePostgresAdapter } from 'orchid-orm/node-postgres';
// for Bun SQL driver:
// import { Adapter as BunAdapter } from 'orchid-orm/bun';

const adapter = new AdapterClass({
  driverAdapter: PostgresJsAdapter,
  config: { databaseURL: process.env.DATABASE_URL },
});

export const db = orchidORMWithAdapter(
  {
    adapter,
    log: true,
  },
  {
    // ...tables
  },
);
```

`orchidORMWithAdapter` is the one-step setup for a manually instantiated adapter.
If you need to bundle tables before database config exists, use `bundleOrchidORMTables` first and bind it later with `makeOrchidOrmDb` from the same adapter path that you would import `orchidORM` from:

```ts
import { bundleOrchidORMTables } from 'orchid-orm';
import { makeOrchidOrmDb } from 'orchid-orm/postgres-js';
// for node-postgres driver:
// import { makeOrchidOrmDb } from 'orchid-orm/node-postgres';
// for Bun SQL driver:
// import { makeOrchidOrmDb } from 'orchid-orm/bun';

import { UserTable } from './tables/user';
import { MessageTable } from './tables/message';

export const orm = bundleOrchidORMTables({
  user: UserTable,
  message: MessageTable,
});

export const selectUserProfile = orm.user.makeHelper((q) =>
  q.select('id', 'name'),
);

export const db = makeOrchidOrmDb(orm, {
  databaseURL: process.env.DATABASE_URL,
  log: true,
});
```

The bundle has only your table keys, and each bundled table object exposes only `makeHelper`.
Bundled table objects are not queryable table objects and do not expose query-building, SQL generation, relation, metadata, or execution APIs.
Use the returned DB-aware `db` for all table queries, SQL generation, relation APIs, metadata access, and execution.
