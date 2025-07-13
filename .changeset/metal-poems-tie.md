---
'pqb': minor
'orchid-core': minor
'orchid-orm': minor
---

Change `create`, `update`, `onConflict().set` methods

Change `create` methods signature to forbid sql and sub-queries without a callback.

Drop `updateSql` in favor of supporting sql for values in a regular `update`.

Change `onConflict().set` accordingly to the update change.

Drop `createRaw`, `insertRaw`, `createManyRaw`, `insertManyRaw` in favor of regular `create` methods with SQL values.
