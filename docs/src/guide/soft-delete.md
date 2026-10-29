---
description: Soft delete functionality using deletedAt timestamp with includeDeleted and hardDelete methods.
---

# Soft Delete

`softDelete` configures the table to set `deletedAt` to current time instead of deleting records.
All queries on such table will filter out deleted records by default.

```ts
import { defineTable } from './table-factory';

export const SomeTable = defineTable('some', (t) => ({
  id: t.identity().primaryKey(),
  deletedAt: t.timestamp().nullable(),
}))
  // true is for using `deletedAt` column
  .softDelete();

// or provide a different column name
export const OtherTable = defineTable('other', (t) => ({
  id: t.identity().primaryKey(),
  myDeletedAt: t.timestamp().nullable(),
})).softDelete('myDeletedAt');

const db = orchidORM(
  { databaseURL: '...' },
  {
    someTable: SomeTable,
  },
);

// deleted records are ignored by default
const onlyNonDeleted = await db.someTable;
```

`includeDeleted` disables the default `deletedAt` filter:

```ts
const allRecords = await db.someTable.includeDeleted();
```

`delete` behavior is altered:

```ts
await db.someTable.find(1).delete();
// is equivalent to:
await db.someTable.find(1).update({ deletedAt: sql`now()` });
```

`hardDelete` deletes records bypassing the `softDelete` behavior:

```ts
await db.someTable.find(1).hardDelete();
await db.someTable.all().hardDelete();
```

The `deletedAt` filter doesn't count as a condition for `delete`, `update`, and `hardDelete`: they throw without other conditions, unless `all()` is called.
