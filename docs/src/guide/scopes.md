---
description: Query scopes including default scopes, custom scopes, scope method, and unscope functionality.
---

# Scopes

This feature allows defining a set of query modifiers to use it later.
Only [where conditions](/guide/where) can be set in a scope.
If you define a scope with name `default`, it will be applied for all table queries by default.

```ts
import { BaseTable } from './base-table';

export class SomeTable extends BaseTable {
  readonly table = 'some';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    hidden: t.boolean(),
    active: t.boolean(),
  }));

  scopes = this.setScopes({
    default: (q) => q.where({ hidden: false }),
    active: (q) => q.where({ active: true }),
  });
}

const db = orchidORM(
  { databaseURL: '...' },
  {
    some: SomeTable,
  },
);

// the default scope is applied for all queries:
const nonHiddenRecords = await db.some;
```

## scope

Use the `scope` method to apply a pre-defined scope.

```ts
// use the `active` scope that is defined in the table:
await db.some.scope('active');
```

## unscope

Remove conditions that were added by the scope from the query.

```ts
// SomeTable has a default scope, ignore it for this query:
await db.some.unscope('default');
```
