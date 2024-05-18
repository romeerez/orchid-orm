---
'create-orchid-orm': patch
'rake-db': patch
'pqb': patch
'orchid-core': patch
'orchid-orm': patch
---

Change `fn`, export `sql` from the `BaseTable`

The `fn` query builder accepted a column type via parameter, now it accepts the type via `type` method, see [docs](https://orchid-orm.netlify.app/guide/sql-expressions#fn).

Instead of importing `raw` from 'orchid-core', as was documented before, export `sql` helper from your `BaseTable` file:

```ts
import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable();

export const { sql } = BaseTable;
```
