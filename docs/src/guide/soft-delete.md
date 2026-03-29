---
description: Soft delete functionality using deletedAt timestamp with includeDeleted and hardDelete methods.
---

# Soft Delete

`softDelete` configures the table to set `deletedAt` to current time instead of deleting records.
All queries on such table will filter out deleted records by default.

```ts
import { BaseTable } from './base-table';

export class SomeTable extends BaseTable {
  readonly table = 'some';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    deletedAt: t.timestamp().nullable(),
  }));

  // true is for using `deletedAt` column
  readonly softDelete = true;
  // or provide a different column name
  readonly softDelete = 'myDeletedAt';
}

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
```
