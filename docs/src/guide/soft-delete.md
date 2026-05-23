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

Soft delete still follows the mutation condition safety rules. The default `deletedAt IS NULL` filter is implicit and does not authorize a mutation by itself, so an empty effective user filter throws:

```ts
await db.someTable.where({}).delete(); // throws
await db.someTable.where({ id: undefined }).delete(); // throws
await db.someTable.where({ id: 1 }).delete(); // allowed
await db.someTable.all().delete(); // soft-deletes all non-deleted records
```

`hardDelete` deletes records bypassing the `softDelete` behavior:

```ts
await db.someTable.find(1).hardDelete();
await db.someTable.all().hardDelete();
```

`hardDelete` also requires an effective condition or explicit `all()`.
