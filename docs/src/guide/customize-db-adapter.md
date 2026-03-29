---
description: Customizing the database adapter with orchidORMWithAdapter for manual adapter instantiation.
---

# Customize db adapter

`orchidORM` imported from driver-specific path creates an adapter (a layer between ORM and db driver) automatically.

For more control, use `orchidORMWithAdapter` to initiate ORM with a manually instantiated adapter.

```ts
import { orchidORMWithAdapter } from 'orchid-orm';
// for porsager/postgres driver:
import { Adapter } from 'orchid-orm/postgres-js';
// for node-postgres driver:
import { Adapter } from 'orchid-orm/node-postgres';

const adapter = new Adapter({ databaseURL: process.env.DATABASE_URL });

// to get the underlying instance of postgres-js
adapter.sql;
// to get the underlying pool of node-postgres
adapter.pool;

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
